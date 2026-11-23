// Pure functions, so no "use client": the landing builds its playground link
// on the server through share.ts, and the directive would ship this file there.
import type {
  BundleReadResult,
  DiagnosticBundle,
} from "@/lib/playground/diagnostic-bundle";
import type { LaunchMode } from "@/lib/playground/playground-handoff";
import type { Theme } from "@/lib/hooks/use-theme";
import { isThemeId } from "@/lib/theme/themes";

export interface DeepLink {
  example?: string;
  theme?: Theme;
  /** Which surface `?example=`'s program runs in, overriding that
   *  example's own default for this load only. Absent means the default,
   *  so an older `?example=` link resolves the same way it always did. */
  run?: LaunchMode;
  embed: boolean;
  /** Decoded diagnostic bundle, when present and well-formed. */
  bundle?: DiagnosticBundle;
  /** Set when a diagnostic bundle was present but failed to decode, so the
   *  boot can report it instead of silently loading a different buffer. */
  bundleError?: "corrupt" | "too-large";
}

/**
 * The bundle codec's read, taken as an argument rather than imported: share.ts
 * and playground-handoff import this module, and neither should carry the
 * codec (diagnostic-bundle.ts), which loads only for a diagnostic link.
 */
export type BundleDecoder = (value: string | null) => BundleReadResult;

/** Not a share prefix (p2=, p=). */
export const BUNDLE_PREFIX = "bundle=";

/**
 * A diagnostic link's payload, or null if none. Links put it in the fragment,
 * which the page's request line leaves out; older links use `?bundle=`.
 */
export function bundleValue(search: string, hash: string): string | null {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (fragment.startsWith(BUNDLE_PREFIX)) return fragment.slice(BUNDLE_PREFIX.length);
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("bundle");
}

/**
 * Parse the URL query string, and the fragment for a diagnostic link, into a
 * deep-link record. Pure so that tests don't need a window. Unknown values
 * for typed params are dropped (treated as undefined) rather than passing
 * through. With no decoder supplied a bundle is left undecoded, so `bundle`
 * and `bundleError` stay absent.
 */
export function parseDeepLink(search: string, decode?: BundleDecoder, hash = ""): DeepLink {
  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(trimmed);
  const result: DeepLink = { embed: false };

  const example = params.get("example");
  if (example && /^[\w.-]+$/.test(example)) result.example = example;

  const theme = params.get("theme");
  if (isThemeId(theme)) result.theme = theme;

  // Drop unknown values the way theme does: a typo falls back to the
  // example's own default instead of guessing at a surface.
  const run = params.get("run");
  if (run === "terminal" || run === "console") result.run = run;

  result.embed = params.get("embed") === "1";

  const bundle = decode?.(bundleValue(search, hash));
  if (bundle?.kind === "ok") {
    result.bundle = bundle.bundle;
  } else if (bundle?.kind === "corrupt" || bundle?.kind === "too-large") {
    result.bundleError = bundle.kind;
  }

  return result;
}

/** Compose the query-string portion of a share URL from a partial DeepLink. */
export function buildDeepLinkQuery(link: Omit<DeepLink, "embed"> & { embed?: boolean }): string {
  const params = new URLSearchParams();
  if (link.example) params.set("example", link.example);
  if (link.run) params.set("run", link.run);
  if (link.theme) params.set("theme", link.theme);
  if (link.embed) params.set("embed", "1");
  const s = params.toString();
  return s ? `?${s}` : "";
}
