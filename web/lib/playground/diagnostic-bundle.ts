/**
 * Diagnostic-bundle helpers. A bundle captures a snapshot of what the student's
 * run looks like right now (source, stdin/argv, output, register state, last 64
 * stack bytes, last error) and serializes it as a `?bundle=<lz>` deep-link
 * query, so the recipient can re-open the same scenario in the playground with
 * a single click. The markdown form of the same snapshot lives in
 * bundle-markdown.ts, which needs no compressor.
 */

import LZString from "lz-string";
import { MAX_BUNDLE_DECOMPRESSED_BYTES, MAX_SHARE_HASH_BYTES } from "@/lib/playground/upload-guard";

export interface DiagnosticBundle {
  source: string;
  args?: string;
  stdin?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  /** General-purpose register hex strings, X0..X30 in order. */
  registers?: string[];
  sp?: string;
  pc?: string;
  /** Up to 64 bytes from the top of the stack as a hex string ("AB CD ..."). */
  stackBytes?: string;
  error?: string | null;
}

const BUNDLE_VERSION = 1;

/** lz-string compress for the `?bundle=...` query parameter. */
export function encodeBundle(bundle: DiagnosticBundle): string {
  const payload = { v: BUNDLE_VERSION, b: bundle };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

/**
 * The `?bundle=` deep link that reopens this scenario, for the markdown
 * report to carry. It lives beside the codec rather than beside the report,
 * because the link IS the compressor's output.
 */
export function bundleShareUrl(originUrl: string, bundle: DiagnosticBundle): string {
  return `${originUrl}?bundle=${encodeBundle(bundle)}`;
}

function isOptionalString(v: unknown): v is string | undefined {
  return v === undefined || typeof v === "string";
}

function isOptionalNumberOrNull(v: unknown): v is number | null | undefined {
  return v === undefined || v === null || typeof v === "number";
}

/**
 * Strict shape validation on a decoded bundle. Only fields this code renders
 * are accepted, in the types it expects. An attacker controlling a `?bundle=`
 * URL cannot smuggle non-string `args` or `stdin` past this gate to confuse
 * downstream code paths.
 */
function isValidBundle(b: unknown): b is DiagnosticBundle {
  if (b == null || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  if (typeof o.source !== "string") return false;
  if (!isOptionalString(o.args)) return false;
  if (!isOptionalString(o.stdin)) return false;
  if (!isOptionalString(o.stdout)) return false;
  if (!isOptionalString(o.stderr)) return false;
  if (!isOptionalNumberOrNull(o.exitCode)) return false;
  if (o.registers !== undefined) {
    if (!Array.isArray(o.registers)) return false;
    if (!o.registers.every((r) => typeof r === "string")) return false;
  }
  if (!isOptionalString(o.sp)) return false;
  if (!isOptionalString(o.pc)) return false;
  if (!isOptionalString(o.stackBytes)) return false;
  if (o.error !== undefined && o.error !== null && typeof o.error !== "string") return false;
  return true;
}

/**
 * The four outcomes of reading a `?bundle=` query, mirroring `ShareReadResult`.
 * Collapsing them into null lets a truncated bundle link boot the default
 * buffer with an absent banner as the only signal, so the page surfaces corrupt
 * / too-large as a notice.
 */
export type BundleReadResult =
  | { kind: "none" }
  | { kind: "ok"; bundle: DiagnosticBundle }
  | { kind: "corrupt" }
  | { kind: "too-large" };

/**
 * Decode a `?bundle=...` query value into a discriminated verdict: absent
 * (`none`), decoded and shape-valid (`ok`), oversized (`too-large`), or
 * anything else (bad encoding, malformed JSON, a future version, a failed shape
 * check): `corrupt`.
 */
export function decodeBundle(value: string | null): BundleReadResult {
  if (!value) return { kind: "none" };
  // Bomb wall: bound the raw (still-compressed) `?bundle=` fragment
  // before lz-string runs. The cap is sized so even the quadratic
  // worst case stays a bounded transient (see MAX_SHARE_HASH_BYTES);
  // the post-decode ceiling below rejects anything oversized.
  if (value.length > MAX_SHARE_HASH_BYTES) return { kind: "too-large" };
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(value);
    if (!decompressed) return { kind: "corrupt" };
    if (decompressed.length > MAX_BUNDLE_DECOMPRESSED_BYTES) return { kind: "too-large" };
    const parsed = JSON.parse(decompressed) as unknown;
    if (parsed == null || typeof parsed !== "object") return { kind: "corrupt" };
    const versioned = parsed as { v?: unknown; b?: unknown };
    if (versioned.v !== BUNDLE_VERSION) return { kind: "corrupt" };
    if (!isValidBundle(versioned.b)) return { kind: "corrupt" };
    return { kind: "ok", bundle: versioned.b };
  } catch {
    return { kind: "corrupt" };
  }
}
