import { formatWord32 } from "@/lib/emulator/format-hex";
import { isEmptyLineMap, pcToSourceLineFromMap, type LineMap } from "@/lib/emulator/line-map";
import { indexedInstructionText, stripSourceLines } from "@/lib/emulator/source-lines";

export interface DecodedInstruction {
  address: number;
  hex: string;
  text: string;
}

/**
 * The instruction listing for one assembly: little-endian words read out of
 * the code region, each labelled with the source line that produced it.
 *
 * The source is stripped ONCE here. Both text lookups used to re-split the
 * source (and re-run two regexes per line) once PER INSTRUCTION, so the
 * decode cost grew with source x instructions: a dsav-sized workspace spent
 * ~1s of blocked main thread and a 1 MB one minutes.
 */
export function buildDisassembly(params: {
  base: number;
  count: number;
  codeBytes: Uint8Array;
  source: string;
  map: LineMap;
}): DecodedInstruction[] {
  const { base, count, codeBytes, source, map } = params;
  const mapped = !isEmptyLineMap(map);
  const strippedLines = stripSourceLines(source);
  const instrTexts = indexedInstructionText(strippedLines);
  const instrs: DecodedInstruction[] = [];
  for (let i = 0; i < count; i++) {
    const addr = base + i * 4;
    const off = i * 4;
    const word =
      (codeBytes[off] ?? 0) |
      ((codeBytes[off + 1] ?? 0) << 8) |
      ((codeBytes[off + 2] ?? 0) << 16) |
      ((codeBytes[off + 3] ?? 0) << 24);
    const hex = formatWord32(word);
    // The map gives the editor line for this instruction's address; render
    // that line's text. Fall back to the index-based source text when the
    // map is empty (bare-metal) or the address is unexpectedly absent.
    let text: string;
    if (mapped) {
      const line = pcToSourceLineFromMap(addr, map);
      text = line == null ? instrTexts[i] ?? "" : strippedLines[line - 1] ?? "";
    } else {
      text = instrTexts[i] ?? "";
    }
    instrs.push({ address: addr, hex, text });
  }
  return instrs;
}
