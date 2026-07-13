"use client";

import LZString from "lz-string";
import { buildDeepLinkQuery } from "@/lib/hooks/use-deep-link";
import { MAX_SHARE_DECOMPRESSED_BYTES, MAX_SHARE_HASH_BYTES } from "@/lib/playground/upload-guard";
import type { Theme } from "@/lib/hooks/use-theme";

const PREFIX_V2 = "p2=";
const PREFIX_V1 = "p=";

export interface ShareState {
  source: string;
  args?: string;
  stdin?: string;
  cursor?: { line: number; column: number };
}

export interface ShareOptions {
  example?: string;
  theme?: Theme;
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
  const json = JSON.stringify(state);
  return `#${PREFIX_V2}${LZString.compressToEncodedURIComponent(json)}`;
}

/**
 * Parse a share hash (with or without leading `#`). Tries the v2 JSON
 * payload first, then falls back to the v1 source-only form. Returns
 * `null` if the hash isn't ours or the payload is malformed.
 */
export function readShareHash(hash: string): ShareState | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  // Decompression-bomb guard: bound the raw (still-compressed) fragment
  // before lz-string runs, so a tiny payload can't expand to exhaust the
  // tab. The caller falls back to the default editor state on null.
  if (trimmed.length > MAX_SHARE_HASH_BYTES) return null;
  if (trimmed.startsWith(PREFIX_V2)) {
    const compressed = trimmed.slice(PREFIX_V2.length);
    const decoded = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decoded) return null;
    if (decoded.length > MAX_SHARE_DECOMPRESSED_BYTES) return null;
    try {
      const parsed = JSON.parse(decoded) as unknown;
      if (parsed == null || typeof parsed !== "object") return null;
      const o = parsed as Record<string, unknown>;
      if (typeof o.source !== "string") return null;
      const out: ShareState = { source: o.source };
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
      return out;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith(PREFIX_V1)) {
    const compressed = trimmed.slice(PREFIX_V1.length);
    const decoded = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decoded || decoded.length === 0) return null;
    if (decoded.length > MAX_SHARE_DECOMPRESSED_BYTES) return null;
    return { source: decoded };
  }
  return null;
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
