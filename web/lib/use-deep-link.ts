"use client";

import { decodeBundle, type DiagnosticBundle } from "@/lib/diagnostic-bundle";
import type { Theme } from "@/lib/use-theme";

export interface DeepLink {
  example?: string;
  theme?: Theme;
  embed: boolean;
  /** Decoded `?bundle=<lz>` payload, when present and well-formed. */
  bundle?: DiagnosticBundle;
}

/**
 * Parse the URL query string into a deep-link record. Pure so that
 * tests don't need a window. Unknown values for typed params are
 * dropped (treated as undefined) rather than passing through.
 */
export function parseDeepLink(search: string): DeepLink {
  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(trimmed);
  const result: DeepLink = { embed: false };

  const example = params.get("example");
  if (example && /^[\w.-]+$/.test(example)) result.example = example;

  const theme = params.get("theme");
  if (theme === "dark" || theme === "light" || theme === "high-contrast") {
    result.theme = theme;
  }

  result.embed = params.get("embed") === "1";

  const bundle = decodeBundle(params.get("bundle"));
  if (bundle) result.bundle = bundle;

  return result;
}

/** Compose the query-string portion of a share URL from a partial DeepLink. */
export function buildDeepLinkQuery(link: Omit<DeepLink, "embed"> & { embed?: boolean }): string {
  const params = new URLSearchParams();
  if (link.example) params.set("example", link.example);
  if (link.theme) params.set("theme", link.theme);
  if (link.embed) params.set("embed", "1");
  const s = params.toString();
  return s ? `?${s}` : "";
}
