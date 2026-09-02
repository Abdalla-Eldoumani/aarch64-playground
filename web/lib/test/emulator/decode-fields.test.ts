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

  it("slices adc into the with-carry layout with Rd as the destination", () => {
    // adc x0, x1, x2 assembles to 0x9a020020: sf=1 op=0 S=0 Rm=2 Rn=1 Rd=0.
    const decoded = decodeFields(0x9a020020);
    const labels = decoded.fields.map((field) => field.label);
    expect(labels).toEqual(["sf", "op", "S", "11010000", "Rm", "000000", "Rn", "Rd"]);
    expect(decoded.fields[1].meaning).toBe("adc");
    expect(decoded.fields[4].meaning).toBe("x2");
    expect(decoded.fields[6].meaning).toBe("x1");
    expect(decoded.destIndex).toBe(7);
    // sbcs w0, w1, w2 (0x7a020020) reads as the subtracting form at W width.
    const sbcs = decodeFields(0x7a020020);
    expect(sbcs.fields[1].meaning).toBe("sbc");
    expect(sbcs.fields[7].meaning).toBe("w0");
  });

  it("falls back to a single unsplit word for unmapped encodings", () => {
    // An FP data-processing word (fadd d2, d0, d1) is outside the mapped set.
    const decoded = decodeFields(0x1e612802);
    expect(decoded.fields.length).toBe(1);
    expect(decoded.fields[0].bits).toBe(32);
    expect(decoded.destIndex).toBeNull();
  });

  // The six classes tier 2 added. Their words come from `as` and
  // `objdump -d` on the course server, not from this file's arithmetic.
  it("re-concatenates every word of the newly mapped classes", () => {
    for (const word of [
      0x1f420c20, 0x1f628c20, 0x1f020c20, // fmadd/fnmsub d, fmadd s
      0x1e620c20, 0x1e221c20, 0x1e62fc20, // fcsel eq, ne at S width, nv
      0xdac01020, 0x5ac00820, 0xdac00820, // clz x, rev w, rev32 x
      0xfa410000, 0x7a5f1804, 0xba41b00f, // ccmp reg, ccmp imm, ccmn
      0x1e780000, 0x9e620000, 0x1e650000, // fcvtzs, scvtf, fcvtau
      0x9e18f9e1, 0x1e58f401, 0x9e42f020, // the fixed-point forms
    ]) {
      expect(reassembled(word), `word 0x${word.toString(16)}`).toBe(expected32(word));
    }
  });

  it("names the addend of an fp 3-source word and keeps it last", () => {
    // fmadd d0, d1, d2, d3 = 0x1f420c20. Ra is the addend, not a source
    // of the product, which is the whole reason the strip splits it out.
    const decoded = decodeFields(0x1f420c20);
    const labels = decoded.fields.map((field) => field.label);
    expect(labels).toEqual(["000", "11111", "ftype", "o1", "Rm", "o0", "Ra", "Rn", "Rd"]);
    const at = (label: string) => decoded.fields.find((f) => f.label === label);
    expect(at("o0")?.meaning).toBe("fmadd");
    expect(at("Ra")?.meaning).toBe("d3");
    expect(at("Rm")?.meaning).toBe("d2");
    expect(decoded.fields[decoded.destIndex!].meaning).toBe("d0");
    // fnmsub s0, s1, s2, s3 reads the other o1/o0 pair at S width.
    const single = decodeFields(0x1f228c20);
    expect(single.fields.find((f) => f.label === "o0")?.meaning).toBe("fnmsub");
    expect(single.fields.find((f) => f.label === "Ra")?.meaning).toBe("s3");
  });

  it("names the condition of an fp conditional select", () => {
    // fcsel d0, d1, d2, eq = 0x1e620c20; the S-width ne form is 0x1e221c20.
    const decoded = decodeFields(0x1e620c20);
    const labels = decoded.fields.map((field) => field.label);
    expect(labels).toEqual(["000", "11110", "ftype", "1", "Rm", "cond", "11", "Rn", "Rd"]);
    expect(decoded.fields.find((f) => f.label === "cond")?.meaning).toBe("eq");
    expect(decoded.fields.find((f) => f.label === "Rn")?.meaning).toBe("d1");
    expect(decoded.fields[decoded.destIndex!].meaning).toBe("d0");
    const single = decodeFields(0x1e221c20);
    expect(single.fields.find((f) => f.label === "cond")?.meaning).toBe("ne");
    expect(single.fields.find((f) => f.label === "Rm")?.meaning).toBe("s2");
  });

  it("keys a one-source word on the opcode AND the width", () => {
    // rev w0, w1 (0x5ac00820) and rev32 x0, x1 (0xdac00820) share opcode
    // 000010: reading the opcode alone shows one as the other.
    const revW = decodeFields(0x5ac00820);
    const labels = revW.fields.map((field) => field.label);
    expect(labels).toEqual(["sf", "1", "S", "11010110", "00000", "opcode", "Rn", "Rd"]);
    expect(revW.fields.find((f) => f.label === "opcode")?.meaning).toBe("rev");
    expect(revW.fields[revW.destIndex!].meaning).toBe("w0");
    const rev32X = decodeFields(0xdac00820);
    expect(rev32X.fields.find((f) => f.label === "opcode")?.meaning).toBe("rev32");
    expect(rev32X.fields[rev32X.destIndex!].meaning).toBe("x0");
    expect(decodeFields(0xdac01020).fields.find((f) => f.label === "opcode")?.meaning).toBe("clz");
    // The 2-source group next door keeps its own layout.
    expect(decodeFields(0x9ac20820).fields.map((f) => f.label)).toContain("Rm");
  });

  it("splits a conditional compare and marks no register write", () => {
    // ccmp x0, x1, #0, eq = 0xfa410000, the register form.
    const reg = decodeFields(0xfa410000);
    const labels = reg.fields.map((field) => field.label);
    expect(labels).toEqual([
      "sf", "op", "S", "11010010", "Rm/imm5", "cond", "imm", "o2", "Rn", "o3", "nzcv",
    ]);
    expect(reg.fields.find((f) => f.label === "op")?.meaning).toBe("ccmp");
    expect(reg.fields.find((f) => f.label === "Rm/imm5")?.meaning).toBe("x1");
    expect(reg.destIndex).toBeNull();
    // ccmp w0, #31, #4, ne = 0x7a5f1804: bit 11 flips the same field to
    // an immediate, and the nzcv nibble is the flags the false path sets.
    const imm = decodeFields(0x7a5f1804);
    expect(imm.fields.find((f) => f.label === "Rm/imm5")?.meaning).toBe("31");
    expect(imm.fields.find((f) => f.label === "cond")?.meaning).toBe("ne");
    expect(imm.fields.find((f) => f.label === "nzcv")?.value).toBe("0100");
    // ccmn x0, x1, #15, lt = 0xba41b00f is the adding form.
    expect(decodeFields(0xba41b00f).fields.find((f) => f.label === "op")?.meaning).toBe("ccmn");
  });

  it("joins rmode and opcode into the conversion mnemonic", () => {
    // fcvtzs w0, d0 = 0x1e780000: rmode 11 and opcode 000 each carry half
    // the name, so neither field names the instruction on its own.
    const toInt = decodeFields(0x1e780000);
    const labels = toInt.fields.map((field) => field.label);
    expect(labels).toEqual([
      "sf", "00", "11110", "ftype", "1", "rmode", "opcode", "000000", "Rn", "Rd",
    ]);
    expect(toInt.fields.find((f) => f.label === "opcode")?.meaning).toBe("fcvtzs");
    expect(toInt.fields.find((f) => f.label === "Rn")?.meaning).toBe("d0");
    expect(toInt.fields[toInt.destIndex!].meaning).toBe("w0");
    // scvtf d0, x0 = 0x9e620000 runs the other way, so the register kinds
    // swap sides.
    const fromInt = decodeFields(0x9e620000);
    expect(fromInt.fields.find((f) => f.label === "opcode")?.meaning).toBe("scvtf");
    expect(fromInt.fields.find((f) => f.label === "Rn")?.meaning).toBe("x0");
    expect(fromInt.fields[fromInt.destIndex!].meaning).toBe("d0");
    expect(decodeFields(0x1e650000).fields.find((f) => f.label === "opcode")?.meaning).toBe("fcvtau");
  });

  it("reads the fixed-point scale as 64 minus the field", () => {
    // fcvtzs w1, d0, #3 = 0x1e58f401: bit 21 is 0 and the scale field
    // holds 61, which is what a reader has to invert to see the #3.
    const decoded = decodeFields(0x1e58f401);
    const labels = decoded.fields.map((field) => field.label);
    expect(labels).toEqual([
      "sf", "00", "11110", "ftype", "0", "rmode", "opcode", "scale", "Rn", "Rd",
    ]);
    const scale = decoded.fields.find((f) => f.label === "scale");
    expect(scale?.value).toBe("111101");
    expect(scale?.meaning).toBe("#3 fraction bits");
    expect(decoded.fields.find((f) => f.label === "opcode")?.meaning).toBe("fcvtzs");
    expect(decoded.fields[decoded.destIndex!].meaning).toBe("w1");
    // scvtf d0, x1, #4 = 0x9e42f020 scales the other direction.
    const from = decodeFields(0x9e42f020);
    expect(from.fields.find((f) => f.label === "scale")?.meaning).toBe("#4 fraction bits");
    expect(from.fields.find((f) => f.label === "Rn")?.meaning).toBe("x1");
    // The integer form of the same mnemonic keeps the fixed-zero field.
    expect(decodeFields(0x1e780000).fields.map((f) => f.label)).toContain("000000");
  });
});
