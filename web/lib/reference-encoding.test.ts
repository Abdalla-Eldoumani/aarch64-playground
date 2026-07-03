// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { REFERENCE_INSTRUCTIONS } from "@/lib/reference-data";

// The worked encodings in reference-data.ts are authored bit strings, and an
// authored bit is a bit that can be wrong. This drives the real node-target
// emulator over each entry's `encodedAsm`, reads the machine word it actually
// assembled, and requires the concatenated field values to equal that word --
// so the diagram can never teach an encoding the machine disagrees with.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

/**
 * A minimal course-style module that puts the worked instruction at the entry
 * point, so the word to check is always the word at the loaded pc. Branch
 * examples need their labels laid out at the exact distances the authored
 * imm26 bits claim (b: two instructions ahead; bl: three).
 */
function probeSource(asm: string): string {
  const prologue = "        .text\n        .balign 4\n        .global main\nmain:\n";
  if (asm.startsWith("b ")) {
    return `${prologue}        ${asm}\n        nop\ndone:\n        mov     w0, 0\n        ret\n`;
  }
  if (asm.startsWith("bl ")) {
    return `${prologue}        ${asm}\n        mov     w0, 0\n        ret\nhelper:\n        ret\n`;
  }
  return `${prologue}        ${asm}\n        mov     w0, 0\n        ret\n`;
}

function assembledWord(asm: string): number {
  const emu = new Emulator();
  const result = emu.assemble_and_load_with_args(probeSource(asm), []) as {
    error?: string | null;
  };
  expect(result.error ?? null, `assemble failed for "${asm}"`).toBeNull();
  const pc = Number(emu.get_pc());
  const bytes = emu.get_memory_range(pc, 4);
  expect(bytes.length, `no code readable at the entry for "${asm}"`).toBe(4);
  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
}

const workedEntries = REFERENCE_INSTRUCTIONS.filter(
  (inst) => inst.encoding !== undefined && inst.encodedAsm !== undefined,
);

describe("worked encodings match the emulator's machine words", () => {
  it("has a worked example on every encoded entry, and vice versa", () => {
    const encodedOnly = REFERENCE_INSTRUCTIONS.filter(
      (inst) => inst.encoding !== undefined && inst.encodedAsm === undefined,
    ).map((inst) => inst.mnemonic);
    const asmOnly = REFERENCE_INSTRUCTIONS.filter(
      (inst) => inst.encoding === undefined && inst.encodedAsm !== undefined,
    ).map((inst) => inst.mnemonic);
    expect({ encodedOnly, asmOnly }).toEqual({ encodedOnly: [], asmOnly: [] });
    expect(workedEntries.length).toBeGreaterThan(0);
  });

  it("authors every field value at its field width", () => {
    for (const inst of workedEntries) {
      for (const field of inst.encoding ?? []) {
        expect(
          field.value,
          `${inst.mnemonic}: field ${field.label} has no worked value`,
        ).toBeDefined();
        expect(
          field.value?.length,
          `${inst.mnemonic}: field ${field.label} width`,
        ).toBe(field.bits);
        expect(
          field.value,
          `${inst.mnemonic}: field ${field.label} is not binary`,
        ).toMatch(/^[01]+$/);
      }
    }
  });

  for (const inst of workedEntries) {
    it(`${inst.mnemonic}: ${inst.encodedAsm}`, () => {
      const authored = (inst.encoding ?? []).map((f) => f.value).join("");
      const authoredWord = parseInt(authored, 2) >>> 0;
      const machineWord = assembledWord(inst.encodedAsm ?? "");
      expect(
        `0x${authoredWord.toString(16).padStart(8, "0")}`,
        `${inst.mnemonic}: authored fields disagree with the assembled word`,
      ).toBe(`0x${machineWord.toString(16).padStart(8, "0")}`);
    });
  }
});
