import { formatWord32 } from "@/lib/emulator/format-hex";
import { isEmptyLineMap, pcToSourceLineFromMap, type LineMap } from "@/lib/emulator/line-map";
import { indexedInstructionText, stripSourceLines } from "@/lib/emulator/source-lines";

export interface DecodedInstruction {
  address: number;
  hex: string;
  text: string;
}

/**
 * How many words the listing reads from the code base. Data in .text (a
 * prompt string above main) sits among the instructions, so the last one can
 * lie past `count` words; with a map, the listing runs on to it.
 */
export function listingLength(base: number, count: number, map: LineMap): number {
  let last = -1;
  for (const addr of map.addrToLine.keys()) if (addr > last) last = addr;
  return last < base ? count : Math.max(count, (last - base) / 4 + 1);
}

/**
 * The instruction listing for one assembly, each word labelled with the
 * source line that produced it. The source is stripped once here: stripping
 * it per instruction costs source size times instruction count, enough to
 * block the page for minutes on a 1 MB workspace.
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
    // that line's text. The map lists every instruction, so a word it leaves
    // out is data (a string in .text, a literal pool) and is shown as data,
    // the way objdump does. Bare-metal programs have no map and count lines.
    let text: string;
    if (mapped) {
      const line = pcToSourceLineFromMap(addr, map);
      text = line == null ? `.word ${hex}` : strippedLines[line - 1] ?? "";
    } else {
      text = instrTexts[i] ?? "";
    }
    instrs.push({ address: addr, hex, text });
  }
  return instrs;
}
