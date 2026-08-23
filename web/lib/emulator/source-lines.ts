/**
 * Source-text line arithmetic, with no line map involved. The linker's
 * authoritative address->line map (line-map.ts) is the primary path; these
 * helpers cover the bare-metal fallback, where instruction index and
 * non-label source line are already 1:1, and supply the disassembly listing
 * its per-line text.
 */

/** One line with its comment stripped and its indentation trimmed. */
function stripLine(line: string): string {
  return line.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
}

/** Whether a stripped line emits an instruction. Blanks and label-only
 *  lines emit nothing, so they hold no instruction index. */
function emitsInstruction(stripped: string): boolean {
  return stripped.length > 0 && !stripped.endsWith(":");
}

/** The editor line holding the instruction at `instrIndex`, counting only
 *  emitting lines; null when the source is shorter than the index. */
export function pcToSourceLine(instrIndex: number, source: string): number | null {
  const lines = source.split("\n");
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!emitsInstruction(stripLine(lines[i]))) continue;
    if (idx === instrIndex) return i + 1;
    idx++;
  }
  return null;
}

/** The inverse: the instruction index an editor line holds, or null when
 *  that line emits nothing. */
export function sourceLineToInstrIndex(line: number, source: string): number | null {
  const lines = source.split("\n");
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!emitsInstruction(stripLine(lines[i]))) continue;
    if (i + 1 === line) return idx;
    idx++;
  }
  return null;
}

/**
 * Every source line with its comment stripped and trimmed, indexed by
 * 0-based line. One pass over the source; the disassembly loop indexes it
 * instead of re-splitting per instruction.
 */
export function stripSourceLines(source: string): string[] {
  return source.split("\n").map(stripLine);
}

/**
 * The instruction-index-ordered text: stripped lines with blanks and
 * label-only lines removed, so `[i]` is the i-th emitted instruction. The
 * bare-metal fallback (and the map's rare misses) index this.
 */
export function indexedInstructionText(strippedLines: string[]): string[] {
  const out: string[] = [];
  for (const line of strippedLines) {
    if (!emitsInstruction(line)) continue;
    out.push(line);
  }
  return out;
}

/** Whether the source holds anything to assemble. A buffer of comments,
 *  blanks, and bare labels reaches the backend as an empty program, so the
 *  hub refuses it with its own message rather than a linker error. */
export function hasAssemblableContent(source: string): boolean {
  return source.split("\n").some((line) => emitsInstruction(stripLine(line)));
}
