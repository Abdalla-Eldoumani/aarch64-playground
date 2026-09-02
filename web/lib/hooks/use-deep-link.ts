"use client";

import type {
  BundleReadResult,
  DiagnosticBundle,
} from "@/lib/playground/diagnostic-bundle";
import type { LaunchMode } from "@/lib/playground/playground-handoff";
import type { Theme } from "@/lib/hooks/use-theme";

export interface DeepLink {
  example?: string;
  theme?: Theme;
  /** Which surface `?example=`'s program runs in, overriding that
   *  example's own default for this load only. Absent means the default,
   *  so every `?example=` link ever shared keeps its exact meaning. */
  run?: LaunchMode;
  embed: boolean;
  /** Decoded `?bundle=<lz>` payload, when present and well-formed. */
  bundle?: DiagnosticBundle;
  /** Set when a `?bundle=` was present but failed to decode, so the boot
   *  can report it instead of silently loading a different buffer. */
  bundleError?: "corrupt" | "too-large";
}

/**
 * The bundle codec's read, taken as an argument rather than imported.
 * Decoding is what pulls lz-string in, and the landing hero reaches this
 * module through EmbeddablePlayground -> useLaunchMode -> playground-handoff
 * without ever decoding a bundle; only the playground route supplies one.
 */
export type BundleDecoder = (value: string | null) => BundleReadResult;

/**
 * Parse the URL query string into a deep-link record. Pure so that
 * tests don't need a window. Unknown values for typed params are
 * dropped (treated as undefined) rather than passing through. With no
 * decoder supplied a `?bundle=` is left undecoded, so `bundle` and
 * `bundleError` stay absent.
 */
export function parseDeepLink(search: string, decode?: BundleDecoder): DeepLink {
  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(trimmed);
  const result: DeepLink = { embed: false };

  const example = params.get("example");
  if (example && /^[\w.-]+$/.test(example)) result.example = example;

  const theme = params.get("theme");
  if (theme === "dark" || theme === "light" || theme === "high-contrast") {
    result.theme = theme;
  }

  // Same drop-unknown discipline as theme: `?run=1`, `?run=interactive`,
  // and `?run=` are dropped rather than defaulted, so a typo falls back
  // to the example's own default instead of guessing at a surface.
  const run = params.get("run");
  if (run === "terminal" || run === "console") result.run = run;

  result.embed = params.get("embed") === "1";

  const bundle = decode?.(params.get("bundle"));
  if (bundle?.kind === "ok") {
    result.bundle = bundle.bundle;
  } else if (bundle?.kind === "corrupt" || bundle?.kind === "too-large") {
    result.bundleError = bundle.kind;
  }

  return result;
}

/**
 * Legacy example stems (the old course-labeled file names) mapped to the
 * renamed clean stems. A `?example=` link shared before the corpus was
 * renamed still resolves: the resolver translates the old stem to the new
 * one before fetching. This is a fixed allow-list -- only these known
 * stems are translated; everything else passes through untouched.
 */
export const LEGACY_EXAMPLE_ALIASES: Record<string, string> = {
  week03_exercise: "basics",
  week08_scores: "array-scores",
  week09_student_record: "student-record",
  week10_find_max: "find-max",
  week11_argv: "command-line-args",
  week11_static_counter: "static-counter",
  week12_fp_circle: "circle-area",
  week12_is_prime: "is-prime",
  week13_hello: "hello",
  week13_echo: "echo",
  week13_write_file: "write-file",
  week13_read_file: "read-file",
  week13_copy_file: "copy-file",
};

/**
 * Resolve a `?example=` stem to the file actually on disk, translating a
 * known legacy stem to its renamed clean stem. An unknown stem is returned
 * unchanged. Path safety stays with the `/^[\w.-]+$/` check in
 * `parseDeepLink`; this only remaps a fixed set of names.
 */
export function resolveExampleStem(stem: string): string {
  return LEGACY_EXAMPLE_ALIASES[stem] ?? stem;
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
