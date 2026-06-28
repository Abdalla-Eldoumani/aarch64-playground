/**
 * The single source of truth for turning one line of source into a
 * plain-English gloss of the instruction the CPU is on. Both the always-on
 * CURRENT strip and the legacy explain strip read from here so the describe
 * logic and the m4 alias resolution live in exactly one place.
 */
import { lookupDoc } from "@/lib/instruction-docs";

/**
 * Collect `define(name, value)` macro aliases from the full source so a gloss
 * can show `score1_r=w19` next to the operand a student wrote.
 */
export function extractAliases(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^\s*define\(\s*([A-Za-z_][\w]*)\s*,\s*([^)]+?)\s*\)\s*$/gm;
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
    if (mnemonic.startsWith(".")) return `directive ${mnemonic.toLowerCase()} -- emits data or controls section layout`;
    return null;
  }
  if (doc.notImplemented) {
    return `${mnemonic.toLowerCase()} -- not implemented in this emulator`;
  }
  // Surface alias resolutions so a student sees `score1_r -> w19`.
  const resolved = aliases ? resolveAliases(operands, aliases) : null;
  const detail = resolved && resolved !== operands ? ` (aliases: ${resolved})` : "";
  return `${mnemonic.toLowerCase()} ${operands}${detail} -- ${doc.summary}`;
}

/**
 * Annotate each operand token that matches a known alias with its target, e.g.
 * `score1_r` -> `score1_r=w19`. Tokens with no alias are left untouched.
 */
export function resolveAliases(operands: string, aliases: Record<string, string>): string {
  if (!operands) return operands;
  return operands.replace(/\b([A-Za-z_][\w]*)\b/g, (match) => {
    const target = aliases[match];
    if (!target || target === match) return match;
    return `${match}=${target}`;
  });
}
