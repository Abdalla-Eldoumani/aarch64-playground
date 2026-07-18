"use client";

import { parseDeepLink, resolveExampleStem } from "@/lib/hooks/use-deep-link";
import { readShareHash } from "@/lib/playground/share";
import {
  MAX_VFS_BYTES,
  validateArgs,
  validateSource,
  validateStdin,
} from "@/lib/playground/upload-guard";

/**
 * Delivery of a program payload into the playground: the boot-time
 * precedence, the post-mount reconciliation that catches client-side
 * navigations (the router updates window.location at commit, after the
 * boot state was captured during render), and the example fetch with its
 * input fixtures. Everything here is pure or fetch-driven so the page
 * component stays thin and the decisions are table-testable.
 */

/** A complete program handoff: what lands in the editor plus the inputs
 *  the program runs with. `vfs` and `stdin` are re-seeded after every
 *  assemble because loading a program resets the whole machine. */
export interface HandoffPayload {
  source: string;
  /** Recents label for the buffer this payload replaces / this program. */
  label?: string;
  args?: string;
  stdin?: string;
  vfs?: Record<string, string>;
  cursor?: { line: number; column: number };
  /** Drives the loaded-from-a-share-link banner. */
  fromShare?: boolean;
}

/** The starter buffer resolved at first render. `fromShare` / `fromBundle`
 *  record which handoff the boot consumed so the post-mount pass can tell
 *  a hard load (already applied) from a client-side navigation (missed). */
export interface PlaygroundBoot {
  source: string;
  args: string;
  stdin?: string;
  cursor?: { line: number; column: number };
  fromShare: boolean;
  fromBundle: boolean;
  /** Set when the URL carried OUR share prefix but the payload failed:
   *  the boot fell back to autosave/default and the page must say so --
   *  an absent "loaded from a share link" banner is not a signal anyone
   *  notices. */
  shareError?: "corrupt" | "too-large";
  /** Same idea for a `?bundle=` deep-link that failed to decode. */
  bundleError?: "corrupt" | "too-large";
}

/**
 * Resolve the starter buffer from the URL actually visible at render
 * time. Precedence: a diagnostic bundle deep-link, then a share hash,
 * then the autosaved buffer, then the cold-load default.
 */
export function resolveBoot(
  search: string,
  hash: string,
  saved: string | null,
  fallback: string,
): PlaygroundBoot {
  const dl = parseDeepLink(search);
  if (dl.bundle) {
    return {
      source: dl.bundle.source,
      args: dl.bundle.args ?? "",
      stdin: dl.bundle.stdin,
      fromShare: false,
      fromBundle: true,
    };
  }
  const shared = readShareHash(hash);
  if (shared.kind === "ok") {
    return {
      source: shared.state.source,
      args: shared.state.args ?? "",
      stdin: shared.state.stdin,
      cursor: shared.state.cursor,
      fromShare: true,
      fromBundle: false,
    };
  }
  return {
    source: saved && saved.length > 0 ? saved : fallback,
    args: "",
    fromShare: false,
    fromBundle: false,
    shareError:
      shared.kind === "corrupt" || shared.kind === "too-large" ? shared.kind : undefined,
    bundleError: dl.bundleError,
  };
}

export type HandoffDecision =
  | { kind: "bundle" | "share"; payload: HandoffPayload }
  | { kind: "example"; stem: string }
  | { kind: "share-error"; reason: "corrupt" | "too-large" }
  | { kind: "bundle-error"; reason: "corrupt" | "too-large" }
  | null;

/**
 * Decide what the post-mount pass must still deliver. A bundle or share
 * payload the boot already consumed returns null (hard load, nothing to
 * do); one the boot missed (client-side navigation read the previous
 * URL) is returned for delivery. An example stem is always delivered
 * here -- the boot never fetches -- but only when no share-state payload
 * is in the URL, so a link carrying both never overwrites the richer
 * payload with the example file.
 */
export function resolveHandoff(
  boot: Pick<PlaygroundBoot, "fromShare" | "fromBundle" | "shareError" | "bundleError">,
  search: string,
  hash: string,
): HandoffDecision {
  const dl = parseDeepLink(search);
  if (dl.bundle) {
    if (boot.fromBundle) return null;
    return {
      kind: "bundle",
      payload: {
        source: dl.bundle.source,
        args: dl.bundle.args,
        stdin: dl.bundle.stdin,
        label: "diagnostic bundle",
      },
    };
  }
  const shared = readShareHash(hash);
  if (shared.kind === "ok") {
    if (boot.fromShare) return null;
    return {
      kind: "share",
      payload: {
        source: shared.state.source,
        args: shared.state.args,
        stdin: shared.state.stdin,
        cursor: shared.state.cursor,
        label: "shared program",
        fromShare: true,
      },
    };
  }
  // Neither a usable bundle nor a usable share; report whichever failed.
  // A corrupt bundle never blocks a valid share above (boot precedence).
  if (dl.bundleError) {
    // The boot pass already reported a hard load's failure; a client-side
    // navigation reaches it only here.
    return boot.bundleError ? null : { kind: "bundle-error", reason: dl.bundleError };
  }
  if (shared.kind === "corrupt" || shared.kind === "too-large") {
    // The boot pass already reported a hard load's failure; a client-side
    // navigation reaches it only here.
    return boot.shareError ? null : { kind: "share-error", reason: shared.kind };
  }
  if (dl.example) {
    return { kind: "example", stem: resolveExampleStem(dl.example) };
  }
  return null;
}

const EXAMPLES_PREFIX = "/examples/cpsc355/";
const FIXTURES_PREFIX = `${EXAMPLES_PREFIX}fixtures/`;
const STEM_PATTERN = /^[\w.-]+$/;

/** Most VFS files any one example may seed. */
export const MAX_VFS_FIXTURE_FILES = 16;
/** Longest VFS file name an example fixture may declare. */
export const MAX_VFS_FIXTURE_NAME_CHARS = 128;

/**
 * Which examples carry input fixtures (`<stem>.args`, `<stem>.stdin`,
 * `<stem>.vfs.json` under the fixtures directory). Kept in exact sync
 * with the fixtures directory by a test, so a new fixture cannot land
 * without the loader delivering it.
 */
export const EXAMPLE_INPUTS: Record<
  string,
  { args?: true; stdin?: true; vfs?: true }
> = {
  "array-scores": { stdin: true },
  "circle-area": { stdin: true },
  "command-line-args": { args: true },
  "copy-file": { vfs: true },
  echo: { stdin: true },
  locals: { stdin: true },
  "read-file": { vfs: true },
  snake: { stdin: true },
  "student-record": { stdin: true },
  "triangle-area": { stdin: true },
};

/**
 * Parse and bound a `<stem>.vfs.json` fixture: a flat JSON object of
 * file name to text content. Anything outside that shape, or outside
 * the size caps, throws -- the caller treats the payload as undeliverable
 * rather than seeding a partial or hostile file set.
 */
export function parseVfsFixture(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("vfs fixture is not valid JSON");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("vfs fixture must be an object of name to content");
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > MAX_VFS_FIXTURE_FILES) {
    throw new Error(`vfs fixture has too many files (max ${MAX_VFS_FIXTURE_FILES})`);
  }
  const out: Record<string, string> = {};
  for (const [name, body] of entries) {
    if (name.length === 0 || name.length > MAX_VFS_FIXTURE_NAME_CHARS) {
      throw new Error("vfs fixture file name is empty or too long");
    }
    if (typeof body !== "string") {
      throw new Error("vfs fixture contents must be strings");
    }
    if (body.length > MAX_VFS_BYTES) {
      throw new Error("vfs fixture file too large");
    }
    out[name] = body;
  }
  return out;
}

async function fetchFixture(stem: string, ext: string): Promise<string> {
  const res = await fetch(`${FIXTURES_PREFIX}${stem}.${ext}`);
  if (!res.ok) {
    throw new Error(`failed to load ${stem}.${ext}: ${res.status}`);
  }
  return res.text();
}

/**
 * Fetch an example program and every input fixture it declares, bounded
 * by the same caps as user uploads. Throws on a missing file, an
 * oversize payload, or a malformed fixture; the caller keeps the current
 * buffer in that case.
 */
export async function fetchExample(stem: string): Promise<HandoffPayload> {
  if (!STEM_PATTERN.test(stem)) {
    throw new Error("invalid example name");
  }
  const res = await fetch(`${EXAMPLES_PREFIX}${stem}.s`);
  if (!res.ok) {
    throw new Error(`failed to load example: ${res.status} ${res.statusText}`);
  }
  const source = await res.text();
  const sourceError = validateSource(source);
  if (sourceError) throw new Error(sourceError);

  const payload: HandoffPayload = { source, label: stem };
  const inputs = EXAMPLE_INPUTS[stem];
  if (!inputs) return payload;

  if (inputs.args) {
    const args = (await fetchFixture(stem, "args")).trim();
    const argsError = validateArgs(args);
    if (argsError) throw new Error(argsError);
    payload.args = args;
  }
  if (inputs.stdin) {
    const stdin = await fetchFixture(stem, "stdin");
    const stdinError = validateStdin(stdin);
    if (stdinError) throw new Error(stdinError);
    payload.stdin = stdin;
  }
  if (inputs.vfs) {
    payload.vfs = parseVfsFixture(await fetchFixture(stem, "vfs.json"));
  }
  return payload;
}
