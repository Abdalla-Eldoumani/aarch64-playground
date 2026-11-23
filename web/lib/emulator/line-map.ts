/**
 * The linker's address -> editor-line map (`Emulator::get_line_map` in the
 * Rust crate). The current-line marker, the disassembly, and breakpoints use
 * it because counting source lines double-counts m4 `define()` and directive
 * lines. A bad or empty array gives an empty map and lookups return null, so
 * callers fall back to line counting instead of throwing during a render.
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
 * The instructions of the pc's editor line as [first, past the last): what
 * gdb's n and s step off. An m4 macro or `ldr x0, label` can make a line of
 * several. A pc no line holds (a library call, a bare-metal program's empty
 * map) gets its one instruction.
 */
export function lineRange(pc: number, map: LineMap): [number, number] {
  const line = map.addrToLine.get(pc);
  if (line === undefined) return [pc, pc + 4];
  let lo = pc;
  while (map.addrToLine.get(lo - 4) === line) lo -= 4;
  let hi = pc + 4;
  while (map.addrToLine.get(hi) === line) hi += 4;
  return [lo, hi];
}

/**
 * Instruction address for an editor line: the instruction at that line,
 * or the next instruction at a line at/after it, so a breakpoint set on a
 * label, a blank line, or a comment lands on the following real instruction.
 * Null when nothing is at or after the line, or the map is empty.
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
