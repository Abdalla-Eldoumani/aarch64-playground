"use client";

import { bundleValue, parseDeepLink, type BundleDecoder } from "@/lib/hooks/use-deep-link";
import { EXAMPLES, type Example } from "@/lib/playground/example-catalog";
import { validateFileName, type SourceFile } from "@/lib/playground/file-map";
import type { ProgramCheck } from "@/lib/playground/program-checks";
import { readShareHash } from "@/lib/playground/share";
import {
  MAX_VFS_BYTES,
  validateArgs,
  validateSource,
  validateStdin,
} from "@/lib/playground/upload-guard";

/**
 * How a program reaches the playground: which source wins at boot, a second
 * pass after mount that catches client-side navigations (the URL changes
 * after the boot state was read), and the example fetch with its inputs.
 */

/**
 * Where a run starts when run is pressed: the terminal pane or the console.
 * It never limits the program: one that switches to raw mode still takes the
 * terminal mid-run, and `./name` runs anything in the pane.
 */
export type LaunchMode = "terminal" | "console";

/**
 * Read a stored launch value. The key held `"1"` / `"0"` before the mode had
 * two names, so "terminal" and "1" mean terminal; anything else is console.
 */
export function decodeLaunch(value: string | null | undefined): LaunchMode {
  return value === "terminal" || value === "1" ? "terminal" : "console";
}

/** A complete program handoff: what lands in the editor plus the inputs
 *  the program runs with. `vfs` and `stdin` are re-seeded after every
 *  assemble because loading a program resets the whole machine. */
export interface HandoffPayload {
  source: string;
  /** Extra source files the program links with (the files tab strip);
   *  a payload without them clears the strip, so a loaded program never
   *  inherits another workspace's helpers. */
  files?: SourceFile[];
  /** Who owns the pane when this program's run is pressed. Absent means
   *  console, the same thing an absent flag meant before the field had two
   *  names. */
  launch?: LaunchMode;
  /** The example stem this payload came from, when it came from one. The
   *  label is the human name (and callers overwrite it), so the stem is
   *  what the run-mode control tests its offer table against. */
  stem?: string;
  /** Recents label for the buffer this payload replaces / this program. */
  label?: string;
  args?: string;
  stdin?: string;
  vfs?: Record<string, string>;
  cursor?: { line: number; column: number };
  /** Test cases for the checks panel. A payload without them empties the
   *  list: checks belong to the program they were written for. */
  checks?: ProgramCheck[];
  /** Drives the loaded-from-a-share-link banner. */
  fromShare?: boolean;
}

/** The starter buffer resolved at first render. `fromShare` / `fromBundle`
 *  record which handoff the boot consumed so the post-mount pass can tell
 *  a hard load (already applied) from a client-side navigation (missed). */
export interface PlaygroundBoot {
  source: string;
  /** Extra files a share link carried; undefined for every other boot so
   *  the persisted workspace strip stays untouched. */
  files?: SourceFile[];
  args: string;
  stdin?: string;
  cursor?: { line: number; column: number };
  checks?: ProgramCheck[];
  fromShare: boolean;
  fromBundle: boolean;
  /** Set when the URL carried our share prefix but the payload failed: the
   *  boot fell back to autosave or the default, and the page must say so,
   *  since nobody notices a missing "loaded from a share link" banner. */
  shareError?: "corrupt" | "too-large";
  /** Same idea for a diagnostic link that failed to decode. */
  bundleError?: "corrupt" | "too-large";
}

/**
 * The bundle decoder, loaded only for a URL that carries a diagnostic link
 * (`#bundle=`, or `?bundle=` from older links). A static import would put
 * lz-string on every page that reaches this module, the landing hero included.
 */
export async function loadBundleDecoder(
  search: string,
  hash = "",
): Promise<BundleDecoder | undefined> {
  if (bundleValue(search, hash) === null) return undefined;
  const { decodeBundle } = await import("@/lib/playground/diagnostic-bundle");
  return decodeBundle;
}

/**
 * The starting program at render time: a diagnostic link, then a share link,
 * then the autosave, then the default. Render cannot await loadBundleDecoder,
 * so the playground route boots without it and the pass after mount delivers
 * the bundle, or the share in the same URL if the bundle does not decode.
 */
export function resolveBoot(
  search: string,
  hash: string,
  saved: string | null,
  fallback: string,
  decode?: BundleDecoder,
): PlaygroundBoot {
  const dl = parseDeepLink(search, decode, hash);
  if (dl.bundle) {
    return {
      source: dl.bundle.source,
      files: dl.bundle.files,
      args: dl.bundle.args ?? "",
      stdin: dl.bundle.stdin,
      fromShare: false,
      fromBundle: true,
    };
  }
  // A bundle still to be decoded outranks the share, so booting the share now
  // would load a second program over it after mount.
  const bundlePending = !decode && bundleValue(search, hash) !== null;
  const shared = bundlePending ? ({ kind: "none" } as const) : readShareHash(hash);
  if (shared.kind === "ok") {
    return {
      source: shared.state.source,
      files: shared.state.files,
      args: shared.state.args ?? "",
      stdin: shared.state.stdin,
      cursor: shared.state.cursor,
      checks: shared.state.checks,
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
 * What the pass after mount must still deliver: a bundle or share the boot
 * missed, or an example (only this pass fetches, and a bundle or share in the
 * same URL wins). It can await the decoder, so a diagnostic link lands here.
 */
export function resolveHandoff(
  boot: Pick<PlaygroundBoot, "fromShare" | "fromBundle" | "shareError" | "bundleError">,
  search: string,
  hash: string,
  decode?: BundleDecoder,
): HandoffDecision {
  const dl = parseDeepLink(search, decode, hash);
  if (dl.bundle) {
    if (boot.fromBundle) return null;
    return {
      kind: "bundle",
      payload: {
        source: dl.bundle.source,
        files: dl.bundle.files,
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
        files: shared.state.files,
        args: shared.state.args,
        stdin: shared.state.stdin,
        cursor: shared.state.cursor,
        checks: shared.state.checks,
        label: "shared program",
        fromShare: true,
      },
    };
  }
  // Neither a usable bundle nor a usable share; report whichever failed.
  // A corrupt bundle never blocks a valid share above (boot precedence).
  if (dl.bundleError) {
    // Stay quiet only when the boot pass reported it; a bundle the boot could
    // not decode, or a client-side navigation, is reported here.
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
const MAX_VFS_FIXTURE_NAME_CHARS = 128;

/**
 * The catalog's record for `stem`. It matches by value, so a built-in object
 * key such as `constructor` finds nothing.
 */
export function exampleFor(stem: string): Example | undefined {
  return EXAMPLES.find((example) => example.stem === stem);
}

/**
 * The args box for `stem` under `mode`, or null when the mode does not set
 * it. The box never holds argv[0]: the emulator adds `./program` itself.
 */
export function modeArgsFor(
  stem: string | null | undefined,
  mode: LaunchMode,
): string | null {
  if (!stem || !exampleFor(stem)?.modeArgs) return null;
  return mode === "console" ? "console" : "";
}

/**
 * The console-face seed the box held before the emulator owned argv[0].
 * A returning student's persisted args can still carry it; the playground
 * migrates that exact string to the current seed and touches nothing else.
 */
export function legacyModeArgsFor(stem: string | null | undefined): string | null {
  if (!stem || !exampleFor(stem)?.modeArgs) return null;
  return `./${stem} console`;
}

/**
 * Resolve a `?example=` stem to the file actually on disk, translating a stem
 * an example was renamed from to its current one. An unknown stem is returned
 * unchanged. Path safety stays with the `/^[\w.-]+$/` check in
 * `parseDeepLink`; this only remaps the catalog's old names.
 */
export function resolveExampleStem(stem: string): string {
  return EXAMPLES.find((example) => example.aliases?.includes(stem))?.stem ?? stem;
}

/**
 * Parse a `<stem>.vfs.json` fixture: a flat object of file name to text. Any
 * other shape, or anything past the size caps, throws, so a partial file set
 * never loads.
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
 * Fetch an example and its input files under the same caps as an upload.
 * Throws on a missing, oversized, or malformed file, and the caller keeps
 * the current program.
 */
export async function fetchExample(stem: string): Promise<HandoffPayload> {
  // A built-in object key (constructor, __proto__) names no example, and a
  // link carrying one has always been answered as an invalid name.
  if (!STEM_PATTERN.test(stem) || stem in Object.prototype) {
    throw new Error("invalid example name");
  }
  const res = await fetch(`${EXAMPLES_PREFIX}${stem}.s`);
  if (!res.ok) {
    throw new Error(`failed to load example: ${res.status} ${res.statusText}`);
  }
  const source = await res.text();
  const sourceError = validateSource(source);
  if (sourceError) throw new Error(sourceError);

  const payload: HandoffPayload = { source, label: stem, stem };
  const example = exampleFor(stem);
  if (example?.terminal) payload.launch = "terminal";

  const extraNames = example?.files;
  if (extraNames) {
    // Names checked before a single fetch goes out: each one is pasted into
    // a URL path and then into combineSources' `// ---- name ----` marker,
    // so a name outside the file-name shape is undeliverable, not repaired.
    const seen: SourceFile[] = [];
    for (const name of extraNames) {
      const nameError = validateFileName(name, seen);
      if (nameError) throw new Error(`example file: ${nameError}`);
      seen.push({ name, body: "" });
    }
    payload.files = await Promise.all(
      extraNames.map(async (name) => {
        const fileRes = await fetch(`${EXAMPLES_PREFIX}${stem}/${name}`);
        if (!fileRes.ok) {
          throw new Error(
            `failed to load example file ${name}: ${fileRes.status} ${fileRes.statusText}`,
          );
        }
        const body = await fileRes.text();
        const bodyError = validateSource(body);
        if (bodyError) throw new Error(`${name}: ${bodyError}`);
        return { name, body };
      }),
    );
  }

  const inputs = example?.inputs;
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
