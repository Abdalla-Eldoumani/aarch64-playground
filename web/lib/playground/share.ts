"use client";

import LZString from "lz-string";
import { buildDeepLinkQuery } from "@/lib/hooks/use-deep-link";
import { validateFileName } from "@/lib/playground/file-map";
import { MAX_SHARE_DECOMPRESSED_BYTES, MAX_SHARE_HASH_BYTES } from "@/lib/playground/upload-guard";
import type { Theme } from "@/lib/hooks/use-theme";

const PREFIX_V2 = "p2=";
const PREFIX_V1 = "p=";

export interface ShareState {
  source: string;
  /** Extra source files (the files tab strip) so a multi-file program
   *  survives the link. Old links without them decode as before; old
   *  clients reading a new link ignore the key. */
  files?: { name: string; body: string }[];
  args?: string;
  stdin?: string;
  cursor?: { line: number; column: number };
}

/** More files than this in a hash is a hand-crafted payload, not a
 *  workspace; the whole-fragment byte caps bound the content itself. */
const MAX_SHARE_FILES = 16;

export interface ShareOptions {
  example?: string;
  theme?: Theme;
}

/**
 * The four distinct outcomes of reading a location hash. Collapsing the
 * failure kinds into null made a truncated link silently boot the default
 * buffer -- an absent banner was the only signal.
 */
export type ShareReadResult =
  | { kind: "none" }
  | { kind: "ok"; state: ShareState }
  | { kind: "corrupt" }
  | { kind: "too-large" };

/** djb2 over the source, hex, as a paste-corruption checksum. Not a
 *  security boundary: it exists to catch the one-character mangles a
 *  chat app or a partial copy introduces, which can decode to a valid
 *  payload whose source differs from what the sender shared. */
function sourceChecksum(source: string): string {
  let h = 5381;
  for (let i = 0; i < source.length; i++) {
    h = ((h << 5) + h + source.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

/**
 * Encode the editor state as a shareable URL hash. lz-string's
 * `compressToEncodedURIComponent` keeps the payload safe inside a
 * `#p2=...` fragment and survives copy-paste through chat apps. The
 * v2 prefix carries the full state JSON; the older `#p=` form carrying
 * just the source string is still decoded by `readShareHash` so links
 * shared before this change keep working.
 */
export function buildShareHash(state: ShareState): string {
  const json = JSON.stringify({ ...state, h: sourceChecksum(state.source) });
  return `#${PREFIX_V2}${LZString.compressToEncodedURIComponent(json)}`;
}

/**
 * The compressed payload length of a built hash, against the cap
 * `readShareHash` enforces on the way back in. The sender's browser is the
 * only place this can be caught: a link built over the cap copies, pastes,
 * and opens to "that share link is too large", with the sender none the
 * wiser. A real multi-file workspace clears 12 KB easily -- the 12-file
 * data-structures example compresses to ~86,000 characters -- so the
 * dialog checks before it offers the link.
 */
export function shareHashSize(hash: string): { chars: number; max: number } {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  const payload = trimmed.startsWith(PREFIX_V2)
    ? trimmed.slice(PREFIX_V2.length)
    : trimmed.startsWith(PREFIX_V1)
      ? trimmed.slice(PREFIX_V1.length)
      : trimmed;
  return { chars: payload.length, max: MAX_SHARE_HASH_BYTES };
}

/**
 * lz-string does not fail closed: a fragment whose 2-bit header bits
 * decode to the unhandled case leaves the decoder's state undefined and
 * it throws mid-stream instead of returning null. readShareHash runs
 * during render on boot, so an uncontained throw is a blank page.
 */
function safeDecompress(compressed: string): string | null {
  try {
    return LZString.decompressFromEncodedURIComponent(compressed);
  } catch {
    return null;
  }
}

/**
 * Parse a share hash (with or without leading `#`). Tries the v2 JSON
 * payload first, then falls back to the v1 source-only form. The prefix
 * check runs FIRST so the caps and decode failures apply only to hashes
 * that are provably ours, and each failure keeps its identity.
 */
export function readShareHash(hash: string): ShareReadResult {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (trimmed.startsWith(PREFIX_V2)) {
    const compressed = trimmed.slice(PREFIX_V2.length);
    // Bomb wall: bound the raw fragment before lz-string runs (see
    // MAX_SHARE_HASH_BYTES for the sizing math).
    if (compressed.length > MAX_SHARE_HASH_BYTES) return { kind: "too-large" };
    const decoded = safeDecompress(compressed);
    if (!decoded) return { kind: "corrupt" };
    if (decoded.length > MAX_SHARE_DECOMPRESSED_BYTES) return { kind: "too-large" };
    try {
      const parsed = JSON.parse(decoded) as unknown;
      if (parsed == null || typeof parsed !== "object") return { kind: "corrupt" };
      const o = parsed as Record<string, unknown>;
      if (typeof o.source !== "string") return { kind: "corrupt" };
      // Checksum (v2 links carry one): a mangled fragment can decode to a
      // VALID payload with a different program; 17 of 68 one-character
      // substitutions did in the audit. Old links without it still load.
      if (typeof o.h === "string" && o.h !== sourceChecksum(o.source)) {
        return { kind: "corrupt" };
      }
      const out: ShareState = { source: o.source };
      if (
        Array.isArray(o.files) &&
        o.files.length <= MAX_SHARE_FILES &&
        o.files.every(
          (f) =>
            f != null &&
            typeof f === "object" &&
            typeof (f as { name?: unknown }).name === "string" &&
            typeof (f as { body?: unknown }).body === "string",
        )
      ) {
        // Store the TRIMMED name: validateFileName trims before its shape
        // check, so an untrimmed store would validate "\nhelper.s" as
        // helper.s and then hand the newline to the boundary comment.
        const files = (o.files as { name: string; body: string }[]).map((f) => ({
          name: f.name.trim(),
          body: f.body,
        }));
        // A hostile NAME is not a mangle, so the whole link is refused
        // rather than loaded minus its helpers: a newline in one writes its
        // own assembly lines into the `// ---- name ----` marker
        // combineSources builds, and the linker reads them as program text.
        // A wrong-SHAPED files array stays tolerated above -- that is an old
        // or partial serialization, and nothing hostile survives it.
        if (files.some((f, i) => validateFileName(f.name, files, i) !== null)) {
          return { kind: "corrupt" };
        }
        out.files = files;
      }
      if (typeof o.args === "string") out.args = o.args;
      if (typeof o.stdin === "string") out.stdin = o.stdin;
      if (
        o.cursor != null &&
        typeof o.cursor === "object" &&
        typeof (o.cursor as { line?: unknown }).line === "number" &&
        typeof (o.cursor as { column?: unknown }).column === "number"
      ) {
        const c = o.cursor as { line: number; column: number };
        out.cursor = { line: c.line, column: c.column };
      }
      return { kind: "ok", state: out };
    } catch {
      return { kind: "corrupt" };
    }
  }
  if (trimmed.startsWith(PREFIX_V1)) {
    const compressed = trimmed.slice(PREFIX_V1.length);
    if (compressed.length > MAX_SHARE_HASH_BYTES) return { kind: "too-large" };
    const decoded = safeDecompress(compressed);
    if (!decoded || decoded.length === 0) return { kind: "corrupt" };
    if (decoded.length > MAX_SHARE_DECOMPRESSED_BYTES) return { kind: "too-large" };
    return { kind: "ok", state: { source: decoded } };
  }
  return { kind: "none" };
}

/**
 * Full shareable URL (origin + pathname + optional deep-link query +
 * share hash). When the caller passes example / theme, an
 * instructor can link to a specific example in a specific layout.
 */
export function buildShareUrl(state: ShareState, options: ShareOptions = {}): string {
  const query = buildDeepLinkQuery(options);
  if (typeof window === "undefined") return `${query}${buildShareHash(state)}`;
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return `${url.origin}${url.pathname}${query}${buildShareHash(state)}`;
}
