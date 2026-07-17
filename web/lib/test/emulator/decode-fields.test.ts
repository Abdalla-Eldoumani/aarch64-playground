// Validates the presentation-side field slicer against machine words the
// real assembler produces: every layout must re-concatenate to exactly the
// 32 bits it was given, and the operand fields must decode to the registers
// the source names. Expected register indices come from the source text (an
// independent statement of intent), never recomputed from the slicer.
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeFields } from "@/lib/emulator/decode-fields";

const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm/aarch64_emulator");

/** Assemble a program and return its machine words in program order. */
function assembleWords(source: string): number[] {
  const emu = new Emulator();
  const result = emu.assemble_and_load(source) as {
    success: boolean;
    error?: string;
    instruction_count: number;
  };
  expect(result.success, result.error).toBe(true);
  const base = emu.code_base();
  const words: number[] = [];
  for (let index = 0; index < result.instruction_count; index++) {
    const bytes = emu.get_memory_range(base + index * 4, 4) as Uint8Array;
    words.push(
      ((bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0),
    );
  }
  emu.free();
  return words;
}

function reassembled(word: number): string {
  return decodeFields(word)
    .fields.map((field) => field.value)
    .join("");
}

function expected32(word: number): string {
  let out = "";
  for (let index = 31; index >= 0; index--) out += ((word >>> index) & 1).toString();
  return out;
}

// One instruction per mapped class, drawn from real course-style code.
// Hosted-mode header: the literal-pool `ldr xN, =label` form needs the
// section-aware pipeline, which `.global main` selects.
const PROGRAM = `        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        movz    x19, 0x1234
        movk    x19, 0xbeef, lsl 16
        add     x20, x19, 8
        add     x21, x19, x20
        and     x22, x19, x20
        mul     x23, x19, x20
        udiv    x24, x19, x20
        ldr     x25, =main
        str     x19, [sp, 8]
        ldr     x26, [sp, 8]
        ldr     w27, [x19, x20, lsl 2]
        add     x28, sp, x19
        cmp     x19, 0
        b.ne    skip
        cbz     x19, skip
skip:
        bl      leaf
        b       done
leaf:
        ret
done:
        mov     x0, 0
        mov     x8, 93
        svc     0
        ldp     x29, x30, [sp], 16
`;

describe("decodeFields", () => {
  it("re-concatenates every assembled word to exactly its 32 bits", () => {
    for (const word of assembleWords(PROGRAM)) {
      expect(reassembled(word), `word 0x${word.toString(16)}`).toBe(expected32(word));
    }
  });

  it("slices movz into the move-wide layout with Rd as the destination", () => {
    // movz x19, 42 assembles to 0xd2800553 (verified against the emulator's
    // own disassembly panel): sf=1 opc=10 hw=00 imm16=42 Rd=19.
    const decoded = decodeFields(0xd2800553);
    const labels = decoded.fields.map((field) => field.label);
    expect(labels).toEqual(["sf", "opc", "100101", "hw", "imm16", "Rd"]);
    expect(decoded.fields[4].meaning).toBe("42");
    expect(decoded.fields[5].meaning).toBe("x19");
    expect(decoded.destIndex).toBe(5);
  });

  it("slices a register-offset load into Rm/option/S, never a fabricated imm9", () => {
    // The strip used to route this word through the pre/post-index
    // layout: a fabricated imm9 box, a `0` box showing 1, and no sign of
    // the index register anywhere.
    const [word] = assembleWords(
      "        .text\n        .global main\nmain:\n        ldr     w0, [x1, x2, lsl 2]\n        ret\n",
    );
    const decoded = decodeFields(word);
    const labels = decoded.fields.map((field) => field.label);
    expect(labels).toContain("Rm");
    expect(labels).toContain("option");
    expect(labels).toContain("S");
    expect(labels).not.toContain("imm9");
    const rm = decoded.fields.find((field) => field.label === "Rm");
    expect(rm?.meaning).toContain("x2");
    const option = decoded.fields.find((field) => field.label === "option");
    expect(option?.meaning).toBe("lsl");
  });

  it("marks loads but not stores as register writes", () => {
    const [strWord, ldrWord] = assembleWords(
      ".text\n.global main\nmain:\n        str x1, [sp, 8]\n        ldr x2, [sp, 8]\n        mov x0, 0\n        mov x8, 93\n        svc 0\n",
    );
    expect(decodeFields(strWord).destIndex).toBeNull();
    const ldr = decodeFields(ldrWord);
    expect(ldr.destIndex).not.toBeNull();
    expect(ldr.fields[ldr.destIndex!].meaning).toBe("x2");
  });

  it("names the condition on a conditional branch", () => {
    const words = assembleWords(
      ".text\n.global main\nmain:\n        cmp x0, 0\n        b.ne out\nout:\n        mov x0, 0\n        mov x8, 93\n        svc 0\n",
    );
    const cond = decodeFields(words[1]);
    const condField = cond.fields.find((field) => field.label === "cond");
    expect(condField?.meaning).toBe("ne");
  });

  it("falls back to a single unsplit word for unmapped encodings", () => {
    // An FP data-processing word (fadd d2, d0, d1) is outside the mapped set.
    const decoded = decodeFields(0x1e612802);
    expect(decoded.fields.length).toBe(1);
    expect(decoded.fields[0].bits).toBe(32);
    expect(decoded.destIndex).toBeNull();
  });
});
