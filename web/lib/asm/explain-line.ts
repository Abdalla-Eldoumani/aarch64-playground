/**
 * The single source of truth for turning one line of source into a
 * plain-English gloss of the instruction the CPU is on. Both the always-on
 * CURRENT strip and the legacy explain strip read from here so the describe
 * logic and the m4 alias resolution live in exactly one place.
 */
import { lookupDoc } from "@/lib/asm/instruction-docs";

/**
 * Collect `define(name, value)` macro aliases from the full source so a gloss
 * can show `score1_r = w19` beside the line a student wrote.
 *
 * The regex is deliberately free of overlapping quantifiers: an earlier
 * shape (`\s*` around a lazy `[^)]+?`, all three matching whitespace across
 * lines) backtracked in O(n^3) on an unclosed `define(` and froze the tab
 * on boot. One greedy body run bounded to the line keeps matching linear,
 * and matches the emulator's own line-based define parsing.
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
 * blank, comment-only, and label-only lines so callers can fall back to a calm
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
  // Only the substitutions are named. Annotating the whole operand list and
  // labelling it "aliases" swept the untouched literals in with them, so
  // `mov b, 5` claimed `5` was an alias.
  const detail = aliases ? aliasPairs(operands, aliases) : "";
  return `${mnemonic.toLowerCase()} ${operands}${detail} · ${doc.summary}`;
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
