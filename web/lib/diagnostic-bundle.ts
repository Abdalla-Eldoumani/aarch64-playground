/**
 * Diagnostic-bundle helpers. A bundle captures a snapshot of what the
 * student's run looks like right now -- source, stdin/argv, output,
 * register state, last 64 stack bytes, last error -- and serializes it
 * two ways:
 *
 *   - markdown, for pasting into a bug report or course forum, and
 *   - a `?bundle=<lz>` deep-link query, so the recipient can re-open the
 *     same scenario in the playground with a single click.
 */

import LZString from "lz-string";
import { MAX_BUNDLE_DECOMPRESSED_BYTES } from "@/lib/upload-guard";

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

/**
 * Build a markdown bundle for the clipboard. The trailing share link is
 * optional -- when an origin is provided the helper appends it so the
 * bundle is fully self-contained.
 */
export function bundleToMarkdown(bundle: DiagnosticBundle, originUrl?: string): string {
  const lines: string[] = [];
  lines.push("# diagnostic bundle");
  lines.push("");
  lines.push("```asm");
  lines.push(bundle.source.replace(/\r\n/g, "\n").trimEnd());
  lines.push("```");
  lines.push("");
  if (bundle.args) {
    lines.push(`**args:** \`${bundle.args}\``);
    lines.push("");
  }
  if (bundle.stdin) {
    lines.push("**stdin:**");
    lines.push("```");
    lines.push(bundle.stdin.trimEnd());
    lines.push("```");
    lines.push("");
  }
  if (bundle.stdout) {
    lines.push("**stdout:**");
    lines.push("```");
    lines.push(bundle.stdout.trimEnd());
    lines.push("```");
    lines.push("");
  }
  if (bundle.stderr) {
    lines.push("**stderr:**");
    lines.push("```");
    lines.push(bundle.stderr.trimEnd());
    lines.push("```");
    lines.push("");
  }
  if (bundle.exitCode != null) {
    lines.push(`**exit code:** ${bundle.exitCode}`);
    lines.push("");
  }
  if (bundle.error) {
    lines.push(`**last error:** ${bundle.error}`);
    lines.push("");
  }
  if (bundle.pc || bundle.sp || (bundle.registers && bundle.registers.length > 0)) {
    lines.push("**registers:**");
    lines.push("```");
    if (bundle.pc) lines.push(`pc = ${bundle.pc}`);
    if (bundle.sp) lines.push(`sp = ${bundle.sp}`);
    if (bundle.registers) {
      bundle.registers.forEach((v, i) => {
        lines.push(`x${i.toString().padStart(2, "0")} = ${v}`);
      });
    }
    lines.push("```");
    lines.push("");
  }
  if (bundle.stackBytes) {
    lines.push("**last 64 stack bytes (top of stack first):**");
    lines.push("```");
    lines.push(bundle.stackBytes);
    lines.push("```");
    lines.push("");
  }
  if (originUrl) {
    const link = `${originUrl}?bundle=${encodeBundle(bundle)}`;
    lines.push(`[open in the playground](${link})`);
    lines.push("");
  }
  return lines.join("\n");
}

/** lz-string compress for the `?bundle=...` query parameter. */
export function encodeBundle(bundle: DiagnosticBundle): string {
  const payload = { v: BUNDLE_VERSION, b: bundle };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

function isOptionalString(v: unknown): v is string | undefined {
  return v === undefined || typeof v === "string";
}

function isOptionalNumberOrNull(v: unknown): v is number | null | undefined {
  return v === undefined || v === null || typeof v === "number";
}

/**
 * Strict shape validation on a decoded bundle. We only accept fields we
 * know how to render, of the types we expect. An attacker controlling
 * a `?bundle=` URL cannot smuggle non-string `args` or `stdin` past
 * this gate to confuse downstream code paths.
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
 * Decode a `?bundle=...` query value. Returns null when the payload is
 * absent, badly encoded, oversized, or comes from a future bundle
 * version we don't understand. Keeps the playground's deep-link
 * bootstrap defensive against URL-borne attacks.
 */
export function decodeBundle(value: string | null): DiagnosticBundle | null {
  if (!value) return null;
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(value);
    if (!decompressed) return null;
    if (decompressed.length > MAX_BUNDLE_DECOMPRESSED_BYTES) return null;
    const parsed = JSON.parse(decompressed) as unknown;
    if (parsed == null || typeof parsed !== "object") return null;
    const versioned = parsed as { v?: unknown; b?: unknown };
    if (versioned.v !== BUNDLE_VERSION) return null;
    if (!isValidBundle(versioned.b)) return null;
    return versioned.b;
  } catch {
    return null;
  }
}
