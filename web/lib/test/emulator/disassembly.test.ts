import { describe, expect, it } from "vitest";
import { buildDisassembly, listingLength } from "@/lib/emulator/disassembly";
import { emptyLineMap, parseLineMap } from "@/lib/emulator/line-map";

const BASE = 0x400000;

// A prompt string in .text above main, the shape the report found: its 17
// bytes and padding fill the first five words, and the linker's map starts
// at main (the map below has the shape the real assembler returns for it).
const SOURCE = [
  "define(count_r, x19)",
  "fp .req x29",
  "        .text",
  'prompt: .string "Enter a number: "',
  "        .balign 4",
  "        .global main",
  "main:",
  "        stp     x29, x30, [sp, -16]!",
  "        mov     x29, sp",
  "        adr     x0, prompt",
  "        bl      printf",
  "        mov     count_r, 5",
  "        mov     w0, 0",
  "        ldp     x29, x30, [sp], 16",
  "        ret",
].join("\n");
const MAP = parseLineMap([
  BASE + 0x14, 8, BASE + 0x18, 9, BASE + 0x1c, 10, BASE + 0x20, 11,
  BASE + 0x24, 12, BASE + 0x28, 13, BASE + 0x2c, 14, BASE + 0x30, 15,
]);
// "Ente" read as a little-endian word, then zeros for the rest.
const BYTES = new Uint8Array(13 * 4);
BYTES.set([0x45, 0x6e, 0x74, 0x65]);

describe("listingLength", () => {
  it("runs on past instruction_count to the last mapped instruction", () => {
    // Eight instructions, but the last sits at word 12.
    expect(listingLength(BASE, 8, MAP)).toBe(13);
  });

  it("keeps the count when the map is empty or ends inside it", () => {
    expect(listingLength(BASE, 8, emptyLineMap())).toBe(8);
    expect(listingLength(BASE, 8, parseLineMap([BASE, 1, BASE + 4, 2]))).toBe(8);
  });
});

describe("buildDisassembly", () => {
  const rows = buildDisassembly({ base: BASE, count: 13, codeBytes: BYTES, source: SOURCE, map: MAP });

  it("shows words the map leaves out as data, never as a source line", () => {
    expect(rows[0].text).toBe(".word 0x65746e45");
    for (const row of rows.slice(0, 5)) {
      expect(row.text).toMatch(/^\.word 0x/);
      expect(row.text).not.toMatch(/define|\.req/);
    }
  });

  it("labels every instruction with its own line, the last one included", () => {
    expect(rows[5].text).toBe("stp     x29, x30, [sp, -16]!");
    expect(rows[9].text).toBe("mov     count_r, 5");
    expect(rows[12]).toMatchObject({ address: BASE + 0x30, text: "ret" });
  });
});
