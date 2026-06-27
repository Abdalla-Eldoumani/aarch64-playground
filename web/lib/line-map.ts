/**
 * Pure helpers for the linker's authoritative address -> editor-line map.
 *
 * The map crosses the worker boundary as a flat `[addr, line, addr, line,
 * ...]` number array (see `Emulator::get_line_map` in the Rust crate,
 * sourced from `LinkedImage.line_map`). The current-line marker, the
 * disassembly text, and breakpoint placement all key off this map instead
 * of counting non-label source-text lines -- the old heuristic
 * double-counted m4 `define()` lines and `.data`/directive lines and so
 * drifted on complex programs.
 *
 * Everything here is defensive: a malformed or empty array parses to an
 * empty map, and the lookups return null on a miss, so the caller falls
 * back to the legacy line-count path rather than throwing in render or
 * indexing an array by an unchecked offset.
 */

export interface LineMap {
  /** instruction address -> 1-based editor source line */
  addrToLine: Map<number, number>;
  /** 1-based editor source line -> first instruction address at that line */
  lineToAddr: Map<number, number>;
}

/** Empty map. Callers treat this as "fall back to the legacy heuristic". */
export function emptyLineMap(): LineMap {
  return { addrToLine: new Map(), lineToAddr: new Map() };
}

/** Whether the map carries no entries (legacy bare-metal / failed assemble). */
export function isEmptyLineMap(map: LineMap): boolean {
  return map.addrToLine.size === 0;
}

/**
 * Parse the flat `[addr, line, addr, line, ...]` array into lookup maps.
 * Odd-length or non-finite input yields an empty map so the caller falls
 * back instead of indexing garbage. The line -> address map keeps the
 * first instruction seen for a given editor line (instructions are
 * emitted in address order, so that is the earliest address on the line).
 */
export function parseLineMap(flat: readonly number[] | null | undefined): LineMap {
  if (!flat || flat.length === 0 || flat.length % 2 !== 0) {
    return emptyLineMap();
  }
  const addrToLine = new Map<number, number>();
  const lineToAddr = new Map<number, number>();
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const addr = flat[i];
    const line = flat[i + 1];
    if (!Number.isFinite(addr) || !Number.isFinite(line)) {
      return emptyLineMap();
    }
    addrToLine.set(addr, line);
    if (!lineToAddr.has(line)) lineToAddr.set(line, addr);
  }
  return { addrToLine, lineToAddr };
}

/**
 * Editor line for a mapped pc, or null when the pc is not an instruction
 * address in the map (data, padding, a host stub, or an empty map).
 */
export function pcToSourceLineFromMap(pc: number, map: LineMap): number | null {
  const line = map.addrToLine.get(pc);
  return line === undefined ? null : line;
}

/**
 * Instruction address for an editor line: the instruction at that line,
 * or the next instruction at a line at/after it -- so a breakpoint set on
 * a label, a blank line, or a comment lands on the following real
 * instruction. Null when nothing is at or after the line, or the map is
 * empty.
 */
export function lineToAddrFromMap(line: number, map: LineMap): number | null {
  const exact = map.lineToAddr.get(line);
  if (exact !== undefined) return exact;
  let best: number | null = null;
  let bestLine = Infinity;
  for (const [mappedLine, addr] of map.lineToAddr) {
    if (mappedLine >= line && mappedLine < bestLine) {
      bestLine = mappedLine;
      best = addr;
    }
  }
  return best;
}
