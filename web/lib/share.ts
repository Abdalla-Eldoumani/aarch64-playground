"use client";

import LZString from "lz-string";
import { buildDeepLinkQuery } from "@/lib/use-deep-link";
import type { Theme } from "@/lib/use-theme";

const HASH_PREFIX = "p=";

export interface ShareOptions {
  view?: "playground" | "c-to-asm";
  example?: string;
  theme?: Theme;
}

/**
 * Encode the editor buffer as a shareable URL hash. Uses lz-string's
 * `compressToEncodedURIComponent` so the payload is safe to embed in a
 * `#p=...` fragment and survives being copy-pasted through chat apps.
 */
export function buildShareHash(source: string): string {
  return `#${HASH_PREFIX}${LZString.compressToEncodedURIComponent(source)}`;
}

/**
 * Parse a share hash (with or without leading `#`) and return the
 * decompressed source, or `null` if the hash isn't ours.
 */
export function readShareHash(hash: string): string | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed.startsWith(HASH_PREFIX)) return null;
  const compressed = trimmed.slice(HASH_PREFIX.length);
  const decoded = LZString.decompressFromEncodedURIComponent(compressed);
  return decoded && decoded.length > 0 ? decoded : null;
}

/**
 * Full shareable URL (origin + pathname + optional deep-link query +
 * share hash). When the caller passes view / example / theme, an
 * instructor can link to a specific example in a specific layout.
 */
export function buildShareUrl(source: string, options: ShareOptions = {}): string {
  const query = buildDeepLinkQuery(options);
  if (typeof window === "undefined") return `${query}${buildShareHash(source)}`;
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return `${url.origin}${url.pathname}${query}${buildShareHash(source)}`;
}
