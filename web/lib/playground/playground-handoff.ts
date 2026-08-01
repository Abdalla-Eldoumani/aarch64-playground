"use client";

import { parseDeepLink, resolveExampleStem } from "@/lib/hooks/use-deep-link";
import type { SourceFile } from "@/lib/playground/file-map";
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

/**
 * Which surface owns the pane at run press: a live terminal session
 * ("terminal") or the classic console flow ("console"). It is NOT a
 * statement about whether the program may ever own the pane -- a raw-mode
 * program still takes the terminal mid-run under either value, and
 * `./name` still runs anything in the pane.
 */
export type LaunchMode = "terminal" | "console";

/**
 * Decode a launch value that came from outside the type system: the
 * persisted key (which held `"1"` / `"0"` before the mode had two names)
 * or any other stored string. Only the two known "terminal" spellings
 * resolve to terminal; everything else, absent included, is console.
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
   *  console -- the same thing an absent flag meant before the field had
   *  two names. */
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
      files: shared.state.files,
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
        files: shared.state.files,
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
/**
 * Extra source files a multi-file example loads into the files strip,
 * served from `<stem>/<name>` beside the main `<stem>.s`. Order is the
 * tab order.
 */
/** Examples whose DEFAULT owner at run press is the terminal pane: run
 *  takes it over (clear, focus, live keys) instead of routing scanf to
 *  the console. Both entries draw a full-screen ANSI frame, which the
 *  console's plain-text scrollback renders as escape-sequence garbage. */
export const EXAMPLE_TERMINAL: Record<string, true> = {
  dsav: true,
  "two-sum": true,
};

/** Examples the run-mode control is offered for: the ones where both
 *  surfaces are a real answer. It gates a SURFACE, never behavior -- a
 *  program outside it runs exactly as it does today, and a stem listed
 *  here before its source lands simply never reaches the loader. */
export const EXAMPLE_INTERACTIVE: Record<string, true> = {
  snake: true,
  dsav: true,
  calc: true,
  "temp-convert": true,
  "two-sum": true,
  deadzone: true,
};

/** Examples that present a different face per launch mode: run them in the
 *  console and they take one extra argument, the word `console`, and print
 *  plain line-at-a-time output the console's plain-text scrollback can
 *  actually render; run them in the terminal and they take no arguments and
 *  draw their full-screen ANSI face. The token is always the same word --
 *  this table only marks who takes it.
 *
 *  The rule the playground applies from it: for a stem listed here the mode
 *  OWNS the args box, at load and on every run-mode flip. That overrides the
 *  fixture args EXAMPLE_INPUTS seeds (temp-convert is in both tables), and it
 *  stops at the student -- a box edited to anything other than the two seeded
 *  forms or the payload's own value is theirs and is left alone. */
export const EXAMPLE_MODE_ARGS: Record<string, true> = {
  calc: true,
  "temp-convert": true,
  "two-sum": true,
};

/**
 * The args a mode-args example runs with under `mode`: the console face
 * takes the token after the program name, the terminal face takes nothing.
 * Null for a stem the table does not list, meaning "the mode has no opinion
 * here; whatever seeded the box stands".
 */
export function modeArgsFor(
  stem: string | null | undefined,
  mode: LaunchMode,
): string | null {
  if (!stem || EXAMPLE_MODE_ARGS[stem] !== true) return null;
  return mode === "console" ? `./${stem} console` : "";
}

export const EXAMPLE_FILES: Record<string, string[]> = {
  dsav: [
    "theme.s",
    "ui.s",
    "ansi.s",
    "display.s",
    "utils.s",
    "array.s",
    "stack.s",
    "queue.s",
    "list.s",
    "bst.s",
    "rbt.s",
    "heap.s",
    "hash.s",
    "graph.s",
    "sort.s",
    "search.s",
    "recursion.s",
  ],
  // The repo builds this one with m4 include(), and the paste order is
  // load-bearing: an equate only resolves for the modules below it, so
  // constants comes first and the rest follow the includes. main's own
  // uses reach back through the assembler's positional first-definition
  // fallback, but a helper's do not.
  deadzone: [
    "constants.s",
    "terminal.s",
    "input.s",
    "player.s",
    "enemies.s",
    "projectiles.s",
    "upgrades.s",
    "file-io.s",
    "effects.s",
    "boss.s",
    "abilities.s",
  ],
};

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
  "student-record": { stdin: true },
  "temp-convert": { args: true },
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

  const payload: HandoffPayload = { source, label: stem, stem };
  if (EXAMPLE_TERMINAL[stem]) payload.launch = "terminal";

  const extraNames = EXAMPLE_FILES[stem];
  if (extraNames) {
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
