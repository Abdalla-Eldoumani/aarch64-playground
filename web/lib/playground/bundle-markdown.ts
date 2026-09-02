/**
 * The diagnostic bundle's markdown form: the report a student pastes into a
 * bug report or the course forum.
 *
 * Its own module because the two error boundaries want exactly this and nothing
 * else, while its sibling diagnostic-bundle.ts imports lz-string for the
 * `?bundle=` codec. Reaching the builder through that module put the
 * compressor, and this report format, in the script list of every document, the
 * landing's included.
 */

import type { DiagnosticBundle } from "@/lib/playground/diagnostic-bundle";

/**
 * Build a markdown bundle for the clipboard. The trailing share link is
 * optional: a caller that can reach the codec passes `bundleShareUrl`'s
 * result and the report becomes self-contained. It arrives already built so
 * this module never needs the compressor.
 */
export function bundleToMarkdown(bundle: DiagnosticBundle, shareUrl?: string): string {
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
  if (shareUrl) {
    lines.push(`[open in the playground](${shareUrl})`);
    lines.push("");
  }
  return lines.join("\n");
}
