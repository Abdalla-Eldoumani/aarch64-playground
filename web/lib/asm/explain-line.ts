/**
 * Turns one line of source into a plain-English gloss of the instruction the
 * CPU is on, with m4 alias names resolved. The decode strip's "current
 * instruction" line is its one reader.
 */
import { lookupDoc } from "@/lib/asm/instruction-docs";

/**
 * Collect `define(name, value)` aliases so a gloss can show `score1_r = w19`.
 * The regex has no overlapping quantifiers and stops at the line end: an
 * earlier shape backtracked in O(n^3) on an unclosed `define(` and froze the
 * tab. Line-based matching also agrees with the emulator's m4 pass.
 */
export function extractAliases(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^[ \t]*define\([ \t]*([A-Za-z_]\w*)[ \t]*,([^)\n]*)\)[ \t]*$/gm;
  for (const m of source.matchAll(re)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/**
 * One-line plain-English explanation of a single source line. Returns null for
 * blank, comment-only, and label-only lines so callers can fall back to a
 * prompt. Optionally inlines m4 alias resolutions into the operand list.
 */
export function describeLine(
  rawLine: string,
  aliases?: Record<string, string>,
): string | null {
  if (!rawLine) return null;
  let line = rawLine.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
  if (!line) return null;
  // Strip a leading `label:` if present.
  const labelMatch = line.match(/^[A-Za-z_.$][\w.$]*\s*:\s*(.*)$/);
  if (labelMatch) line = labelMatch[1];
  if (!line) return null;
  const space = line.search(/\s/);
  const mnemonic = (space === -1 ? line : line.slice(0, space)).toUpperCase();
  const operands = space === -1 ? "" : line.slice(space).trim();

  const doc = lookupDoc(mnemonic);
  if (!doc) {
    // Directives, labels, and pseudo-ops fall through.
    if (mnemonic.startsWith(".")) return `directive ${mnemonic.toLowerCase()}: emits data, or controls where a section is laid out`;
    return null;
  }
  if (doc.notImplemented) {
    return `${mnemonic.toLowerCase()}: not implemented in this emulator`;
  }
  // Only the substitutions are named. Annotating the whole operand list would
  // claim the untouched literals are aliases too.
  const detail = aliases ? aliasPairs(operands, aliases) : "";
  // The summaries are written for the hover card, which renders Markdown;
  // this gloss is plain text, where the code backticks would print raw.
  return `${mnemonic.toLowerCase()} ${operands}${detail} · ${doc.summary.replace(/`/g, "")}`;
}

/**
 * The ` (name = target, ...)` suffix for the aliases these operands use, in
 * the order the tokens appear. Empty when nothing resolves.
 */
export function aliasPairs(operands: string, aliases: Record<string, string>): string {
  const seen = new Set<string>();
  const pairs: string[] = [];
  for (const m of operands.matchAll(/\b[A-Za-z_]\w*\b/g)) {
    const name = m[0];
    const target = aliases[name];
    if (!target || target === name || seen.has(name)) continue;
    seen.add(name);
    pairs.push(`${name} = ${target}`);
  }
  return pairs.length ? ` (${pairs.join(", ")})` : "";
}
