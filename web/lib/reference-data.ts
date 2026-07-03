import type { BitField } from "@/components/BitFieldDiagram";
import { lookupDoc } from "./instruction-docs";

/**
 * The rich data source for the two-pane instruction reference. It is derived
 * from docs/instruction-reference.md (the canonical mnemonic list, the eight
 * category sections, and the Form column) and merges the hover-card prose from
 * instruction-docs.ts by mnemonic, so the one-line summary and the C-equivalent
 * keep a single source rather than being retyped here. A guard
 * (reference-data.test.ts) pins this set to the documented set so the two
 * cannot drift apart.
 *
 * `encoding` is authored for a small, instructive subset only: each layout
 * follows the real AArch64 form and its bit widths sum to 32. Instructions
 * without an authored encoding omit the field and render without a diagram.
 */

export type ReferenceCategory =
  | "Data processing"
  | "Compare and test"
  | "Conditional select"
  | "Memory"
  | "PC-relative addressing"
  | "Branches"
  | "System"
  | "Floating point";

export interface ReferenceInstruction {
  /** Lowercase display form, e.g. "mov", "b.cond". */
  mnemonic: string;
  category: ReferenceCategory;
  /** Operand shape taken from the doc's Form column, lowercase. */
  syntax: string;
  /** One-line summary, merged from instruction-docs. */
  summary: string;
  /** Short snippet: the merged hover example, else an authored fallback. */
  example: string;
  /** One-line C equivalent, merged from instruction-docs when present. */
  cExample?: string;
  /** Authored notes for traps worth calling out. */
  gotchas?: string[];
  /** Authored bit-field layout for the curated subset; widths sum to 32. */
  encoding?: BitField[];
  /** The concrete instruction the encoding's worked field values spell,
   *  e.g. "add x19, x0, 8"; shown as the diagram caption and pinned to the
   *  emulator's machine word by reference-encoding.test.ts. */
  encodedAsm?: string;
  /** Complete program for the try-in-playground deep-link, used when the bare
   *  example references an undefined label or symbol and so cannot assemble on
   *  its own. Other instructions wrap their example instead (playground-source). */
  runnable?: string;
}

/**
 * One authored row before the instruction-docs merge. The summary and the
 * C-equivalent come from the merge, so a seed carries only what the doc owns:
 * its category, its Form-derived syntax, an example fallback used when
 * instruction-docs has none, and the optional authored extras.
 */
interface ReferenceSeed {
  mnemonic: string;
  category: ReferenceCategory;
  syntax: string;
  /** Used only when instruction-docs has no example for this mnemonic. */
  example?: string;
  gotchas?: string[];
  encoding?: BitField[];
  /** The concrete instruction the encoding's worked bits spell. */
  encodedAsm?: string;
  /** Complete deep-link program when the bare example won't assemble alone. */
  runnable?: string;
}

// Operand fields are tinted so they read apart from the fixed opcode bits.
const operandTint = "var(--cyan)";

// Each encoding carries a worked example: per-field `value` bits plus what
// they decode to, verified against the emulator's own machine word by
// reference-encoding.test.ts. The diagram turns them into the exam's by-hand
// procedure (pack the fields, group nibbles, read hex). The `encodedAsm` on
// the seed names the concrete instruction the bits belong to.

// add immediate (add xd, xn, #imm); worked: add x19, x0, 8 = 0x91002013
const encAddImm: BitField[] = [
  { bits: 1, label: "sf", value: "1", meaning: "1 = x width" },
  { bits: 1, label: "op", value: "0", meaning: "0 = add, 1 = sub" },
  { bits: 1, label: "s", value: "0", meaning: "0 = no flags (adds sets 1)" },
  { bits: 6, label: "100010", value: "100010", meaning: "add/sub immediate class" },
  { bits: 1, label: "sh", value: "0", meaning: "0 = imm12 not shifted" },
  { bits: 12, label: "imm12", color: operandTint, value: "000000001000", meaning: "8" },
  { bits: 5, label: "Rn", color: operandTint, value: "00000", meaning: "x0" },
  { bits: 5, label: "Rd", color: operandTint, value: "10011", meaning: "x19" },
];

// add/sub shifted register (sub xd, xn, xm); op selects add vs sub;
// worked: sub x19, x0, x1 = 0xcb010013
const encAddSubShifted: BitField[] = [
  { bits: 1, label: "sf", value: "1", meaning: "1 = x width" },
  { bits: 1, label: "op", value: "1", meaning: "1 = sub, 0 = add" },
  { bits: 1, label: "s", value: "0", meaning: "0 = no flags (subs sets 1)" },
  { bits: 5, label: "01011", value: "01011", meaning: "add/sub shifted-register class" },
  { bits: 2, label: "shift", value: "00", meaning: "00 = lsl" },
  { bits: 1, label: "0", value: "0", meaning: "fixed" },
  { bits: 5, label: "Rm", color: operandTint, value: "00001", meaning: "x1" },
  { bits: 6, label: "imm6", value: "000000", meaning: "shift amount 0" },
  { bits: 5, label: "Rn", color: operandTint, value: "00000", meaning: "x0" },
  { bits: 5, label: "Rd", color: operandTint, value: "10011", meaning: "x19" },
];

// bitfield move, unsigned (ubfx xd, xn, #lsb, #width); opc 10, immr = lsb,
// imms = lsb + width - 1; worked: ubfx w19, w20, 4, 4 = 0x53041e93
const encUbfm: BitField[] = [
  { bits: 1, label: "sf", value: "0", meaning: "0 = w width" },
  { bits: 2, label: "10", value: "10", meaning: "10 = unsigned extract" },
  { bits: 6, label: "100110", value: "100110", meaning: "bitfield class" },
  { bits: 1, label: "N", value: "0", meaning: "matches sf for w" },
  { bits: 6, label: "immr", color: operandTint, value: "000100", meaning: "lsb = 4" },
  { bits: 6, label: "imms", color: operandTint, value: "000111", meaning: "lsb + width - 1 = 7" },
  { bits: 5, label: "Rn", color: operandTint, value: "10100", meaning: "w20" },
  { bits: 5, label: "Rd", color: operandTint, value: "10011", meaning: "w19" },
];

// bitfield move, insert (bfi xd, xn, #lsb, #width); opc 01,
// immr = (reg size - lsb) mod reg size, imms = width - 1;
// worked: bfi w19, w20, 8, 4 = 0x33180e93
const encBfm: BitField[] = [
  { bits: 1, label: "sf", value: "0", meaning: "0 = w width" },
  { bits: 2, label: "01", value: "01", meaning: "01 = insert" },
  { bits: 6, label: "100110", value: "100110", meaning: "bitfield class" },
  { bits: 1, label: "N", value: "0", meaning: "matches sf for w" },
  { bits: 6, label: "immr", color: operandTint, value: "011000", meaning: "(32 - lsb) mod 32 = 24" },
  { bits: 6, label: "imms", color: operandTint, value: "000011", meaning: "width - 1 = 3" },
  { bits: 5, label: "Rn", color: operandTint, value: "10100", meaning: "w20" },
  { bits: 5, label: "Rd", color: operandTint, value: "10011", meaning: "w19" },
];

// move wide, zero (movz xd, #imm, lsl #shift); opc 10;
// worked: movz x19, 0x1234 = 0xd2824693
const encMovz: BitField[] = [
  { bits: 1, label: "sf", value: "1", meaning: "1 = x width" },
  { bits: 2, label: "10", value: "10", meaning: "10 = movz" },
  { bits: 6, label: "100101", value: "100101", meaning: "move-wide class" },
  { bits: 2, label: "hw", value: "00", meaning: "halfword 0 = lsl 0" },
  { bits: 16, label: "imm16", color: operandTint, value: "0001001000110100", meaning: "0x1234" },
  { bits: 5, label: "Rd", color: operandTint, value: "10011", meaning: "x19" },
];

// move wide, keep (movk xd, #imm, lsl #shift); opc 11;
// worked: movk x19, 0xbeef, lsl 16 = 0xf2b7ddf3
const encMovk: BitField[] = [
  { bits: 1, label: "sf", value: "1", meaning: "1 = x width" },
  { bits: 2, label: "11", value: "11", meaning: "11 = movk" },
  { bits: 6, label: "100101", value: "100101", meaning: "move-wide class" },
  { bits: 2, label: "hw", value: "01", meaning: "halfword 1 = lsl 16" },
  { bits: 16, label: "imm16", color: operandTint, value: "1011111011101111", meaning: "0xbeef" },
  { bits: 5, label: "Rd", color: operandTint, value: "10011", meaning: "x19" },
];

// load, unsigned-offset form (ldr xt, [xn, #imm]); size 11, opc 01;
// worked: ldr x19, [x20, 16] = 0xf9400a93
const encLdrUoff: BitField[] = [
  { bits: 2, label: "11", value: "11", meaning: "size: 11 = 64-bit" },
  { bits: 3, label: "111", value: "111", meaning: "load/store class" },
  { bits: 1, label: "0", value: "0", meaning: "0 = integer register" },
  { bits: 2, label: "01", value: "01", meaning: "unsigned-offset form" },
  { bits: 2, label: "01", value: "01", meaning: "01 = load" },
  { bits: 12, label: "imm12", color: operandTint, value: "000000000010", meaning: "16 / 8 = 2, scaled by the size" },
  { bits: 5, label: "Rn", color: operandTint, value: "10100", meaning: "x20" },
  { bits: 5, label: "Rt", color: operandTint, value: "10011", meaning: "x19" },
];

// store, unsigned-offset form (str xt, [xn, #imm]); size 11, opc 00;
// worked: str x19, [x20, 16] = 0xf9000a93
const encStrUoff: BitField[] = [
  { bits: 2, label: "11", value: "11", meaning: "size: 11 = 64-bit" },
  { bits: 3, label: "111", value: "111", meaning: "load/store class" },
  { bits: 1, label: "0", value: "0", meaning: "0 = integer register" },
  { bits: 2, label: "01", value: "01", meaning: "unsigned-offset form" },
  { bits: 2, label: "00", value: "00", meaning: "00 = store" },
  { bits: 12, label: "imm12", color: operandTint, value: "000000000010", meaning: "16 / 8 = 2, scaled by the size" },
  { bits: 5, label: "Rn", color: operandTint, value: "10100", meaning: "x20" },
  { bits: 5, label: "Rt", color: operandTint, value: "10011", meaning: "x19" },
];

// unconditional branch (b label); op 0; worked: b done, with done two
// instructions ahead = 0x14000002
const encB: BitField[] = [
  { bits: 1, label: "0", value: "0", meaning: "0 = b (no link)" },
  { bits: 5, label: "00101", value: "00101", meaning: "branch class" },
  { bits: 26, label: "imm26", color: operandTint, value: "00000000000000000000000010", meaning: "2 instructions forward: word count, not bytes" },
];

// branch with link (bl label); op 1; worked: bl helper, with helper three
// instructions ahead = 0x94000003
const encBl: BitField[] = [
  { bits: 1, label: "1", value: "1", meaning: "1 = bl (writes lr)" },
  { bits: 5, label: "00101", value: "00101", meaning: "branch class" },
  { bits: 26, label: "imm26", color: operandTint, value: "00000000000000000000000011", meaning: "3 instructions forward: word count, not bytes" },
];

// Complete, self-contained programs for the try-in-playground deep-link. The
// bare one-line example for these instructions names an undefined label or
// symbol, so the link carries a runnable program that defines the target and
// demonstrates the instruction instead. Every other instruction wraps its
// illustrative example in a minimal main (see playground-source.ts).
const runB = `// unconditional branch: skip the line that would set a wrong code
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        b       finish          // jump over the next instruction
        mov     w0, 9           // never reached
finish:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runCbz = `// compare-and-branch if zero: w0 holds 0, so the branch is taken
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 0
        cbz     w0, done        // w0 == 0, so branch to done
        mov     w0, 9           // skipped
done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runCbnz = `// compare-and-branch if non-zero: loop until the counter hits zero
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w1, 3
countdown:
        sub     w1, w1, 1
        cbnz    w1, countdown   // keep looping while w1 is non-zero

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runTbz = `// test-bit-and-branch if clear: bit 0 of w0 is 0, so branch to even
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 4
        tbz     w0, #0, even    // bit 0 is clear, so branch
        mov     w0, 9           // odd path, skipped
even:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runTbnz = `// test-bit-and-branch if set: bit 0 of w0 is 1, so branch to odd
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 1
        tbnz    w0, #0, odd     // bit 0 is set, so branch
        mov     w0, 9           // even path, skipped
odd:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runBcond = `// conditional branch: compare, then branch on the equal flag
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 0
        cmp     w0, #0
        b.eq    done            // taken because w0 == 0
        mov     w0, 9           // skipped
done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runAdr = `// pc-relative address: adr forms the byte address of a nearby label
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        adr     x1, target      // x1 = address of the label below
        br      x1              // branch through the computed address
target:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runAdrp = `// pc-relative page address: adrp + add :lo12: reaches a data symbol
define(fp, x29)
define(lr, x30)

        .data
        .balign 4
message:
        .string "adrp plus lo12 reached a symbol\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        adrp    x0, message             // page base that contains message
        add     x0, x0, :lo12:message   // add the low 12 bits to reach it
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const referenceSeeds: ReferenceSeed[] = [
  // data processing
  {
    mnemonic: "mov",
    category: "Data processing",
    syntax: "mov xd, xn / mov xd, #imm / mov xd, sp",
    gotchas: [
      "the immediate form only takes a value that fits one shifted 16-bit field; a wider constant needs a move-wide then keep sequence.",
    ],
  },
  {
    mnemonic: "movz",
    category: "Data processing",
    syntax: "movz xd, #imm, lsl #shift",
    encoding: encMovz,
    encodedAsm: "movz x19, 0x1234",
  },
  {
    mnemonic: "movk",
    category: "Data processing",
    syntax: "movk xd, #imm, lsl #shift",
    encoding: encMovk,
    encodedAsm: "movk x19, 0xbeef, lsl 16",
  },
  {
    mnemonic: "movn",
    category: "Data processing",
    syntax: "movn xd, #imm, lsl #shift",
  },
  {
    mnemonic: "add",
    category: "Data processing",
    syntax: "add xd, xn, xm / add xd, xn, #imm",
    encoding: encAddImm,
    encodedAsm: "add x19, x0, 8",
  },
  {
    mnemonic: "adds",
    category: "Data processing",
    syntax: "adds xd, xn, xm / adds xd, xn, #imm",
    example: "adds x0, x1, x2",
  },
  {
    mnemonic: "sub",
    category: "Data processing",
    syntax: "sub xd, xn, xm / sub xd, xn, #imm",
    example: "sub x0, x1, x2",
    encoding: encAddSubShifted,
    encodedAsm: "sub x19, x0, x1",
  },
  {
    mnemonic: "subs",
    category: "Data processing",
    syntax: "subs xd, xn, xm / subs xd, xn, #imm",
    example: "subs x0, x1, x2",
  },
  {
    mnemonic: "mul",
    category: "Data processing",
    syntax: "mul xd, xn, xm",
    example: "mul x0, x1, x2",
  },
  {
    mnemonic: "madd",
    category: "Data processing",
    syntax: "madd xd, xn, xm, xa",
    example: "madd x0, x1, x2, x3",
  },
  {
    mnemonic: "msub",
    category: "Data processing",
    syntax: "msub xd, xn, xm, xa",
    example: "msub x0, x1, x2, x3",
  },
  {
    mnemonic: "udiv",
    category: "Data processing",
    syntax: "udiv xd, xn, xm",
    example: "udiv x0, x1, x2",
    gotchas: [
      "a zero divisor writes zero instead of trapping, so guard the divisor yourself when zero is possible.",
    ],
  },
  {
    mnemonic: "sdiv",
    category: "Data processing",
    syntax: "sdiv xd, xn, xm",
    example: "sdiv x0, x1, x2",
  },
  {
    mnemonic: "neg",
    category: "Data processing",
    syntax: "neg xd, xm",
    example: "neg x0, x1",
  },
  {
    mnemonic: "and",
    category: "Data processing",
    syntax: "and xd, xn, xm / and xd, xn, #imm",
    example: "and x0, x1, x2",
  },
  {
    mnemonic: "ands",
    category: "Data processing",
    syntax: "ands xd, xn, xm / ands xd, xn, #imm",
    example: "ands x0, x1, x2",
  },
  {
    mnemonic: "orr",
    category: "Data processing",
    syntax: "orr xd, xn, xm",
    example: "orr x0, x1, x2",
  },
  {
    mnemonic: "eor",
    category: "Data processing",
    syntax: "eor xd, xn, xm",
    example: "eor x0, x1, x2",
  },
  {
    mnemonic: "mvn",
    category: "Data processing",
    syntax: "mvn xd, xm",
    example: "mvn x0, x1",
  },
  {
    mnemonic: "bic",
    category: "Data processing",
    syntax: "bic xd, xn, xm",
    gotchas: [
      "register form only: there is no bic with an immediate. clear a constant mask with `and` and the inverted bits instead.",
      "does not set flags; pair with `tst` when the cleared result drives a branch.",
    ],
  },
  {
    mnemonic: "lsl",
    category: "Data processing",
    syntax: "lsl xd, xn, #imm",
    example: "lsl x0, x1, #2",
  },
  {
    mnemonic: "lsr",
    category: "Data processing",
    syntax: "lsr xd, xn, #imm",
    example: "lsr x0, x1, #2",
  },
  {
    mnemonic: "asr",
    category: "Data processing",
    syntax: "asr xd, xn, #imm",
    example: "asr x0, x1, #2",
  },
  {
    mnemonic: "sxtb",
    category: "Data processing",
    syntax: "sxtb xd, wn / sxtb wd, wn",
  },
  {
    mnemonic: "sxth",
    category: "Data processing",
    syntax: "sxth xd, wn / sxth wd, wn",
  },
  {
    mnemonic: "sxtw",
    category: "Data processing",
    syntax: "sxtw xd, wn",
  },
  {
    mnemonic: "uxtb",
    category: "Data processing",
    syntax: "uxtb wd, wn",
  },
  {
    mnemonic: "uxth",
    category: "Data processing",
    syntax: "uxth wd, wn",
  },
  {
    mnemonic: "ubfx",
    category: "Data processing",
    syntax: "ubfx xd, xn, #lsb, #width",
    gotchas: [
      "the field must fit the register: lsb + width can reach 32 (w form) or 64 (x form), never past it.",
      "the extracted field lands at bit 0 zero-extended; sign does not survive the move.",
    ],
    encoding: encUbfm,
    encodedAsm: "ubfx w19, w20, 4, 4",
  },
  {
    mnemonic: "bfi",
    category: "Data processing",
    syntax: "bfi xd, xn, #lsb, #width",
    gotchas: [
      "the destination is read before it is written: bits outside the field keep their old values, so xd must already hold what you mean to keep.",
      "only the low `width` bits of xn move; anything above them is ignored, not an error.",
    ],
    encoding: encBfm,
    encodedAsm: "bfi w19, w20, 8, 4",
  },

  // compare and test
  {
    mnemonic: "cmp",
    category: "Compare and test",
    syntax: "cmp xn, xm / cmp xn, #imm",
    example: "cmp x0, #0",
  },
  {
    mnemonic: "cmn",
    category: "Compare and test",
    syntax: "cmn xn, xm / cmn xn, #imm",
    example: "cmn x0, #1",
  },
  {
    mnemonic: "tst",
    category: "Compare and test",
    syntax: "tst xn, xm / tst xn, #imm",
    example: "tst x0, #1",
  },

  // conditional select
  {
    mnemonic: "csel",
    category: "Conditional select",
    syntax: "csel xd, xn, xm, cond",
  },
  {
    mnemonic: "csinc",
    category: "Conditional select",
    syntax: "csinc xd, xn, xm, cond",
    example: "csinc x0, x1, x2, ne",
  },
  {
    mnemonic: "cset",
    category: "Conditional select",
    syntax: "cset xd, cond",
    example: "cset x0, eq",
  },

  // memory
  {
    mnemonic: "ldr",
    category: "Memory",
    syntax: "ldr xt, [xn] / [xn, #imm] / [xn, #imm]! / [xn], #imm",
    example: "ldr x0, [x1, #8]",
    gotchas: [
      "the `=label` form loads the symbol's address; read the value it points at with a second load.",
    ],
    encoding: encLdrUoff,
    encodedAsm: "ldr x19, [x20, 16]",
  },
  {
    mnemonic: "str",
    category: "Memory",
    syntax: "str xt, [xn] / [xn, #imm] / [xn, #imm]! / [xn], #imm",
    example: "str x0, [x1, #8]",
    encoding: encStrUoff,
    encodedAsm: "str x19, [x20, 16]",
  },
  {
    mnemonic: "ldrb",
    category: "Memory",
    syntax: "ldrb wt, [xn, #imm]",
    example: "ldrb w0, [x1]",
  },
  {
    mnemonic: "strb",
    category: "Memory",
    syntax: "strb wt, [xn, #imm]",
    example: "strb w0, [x1]",
  },
  {
    mnemonic: "ldrh",
    category: "Memory",
    syntax: "ldrh wt, [xn, #imm]",
    example: "ldrh w0, [x1]",
  },
  {
    mnemonic: "strh",
    category: "Memory",
    syntax: "strh wt, [xn, #imm]",
    example: "strh w0, [x1]",
  },
  {
    mnemonic: "ldp",
    category: "Memory",
    syntax: "ldp xt1, xt2, [xn, #imm]",
    example: "ldp x0, x1, [sp]",
  },
  {
    mnemonic: "stp",
    category: "Memory",
    syntax: "stp xt1, xt2, [xn, #imm]",
    example: "stp x0, x1, [sp, #-16]!",
  },
  {
    mnemonic: "ldrsb",
    category: "Memory",
    syntax: "ldrsb wt, [xn, #imm] / ldrsb xt, [xn, #imm]",
    example: "ldrsb w0, [x1]",
  },
  {
    mnemonic: "ldrsh",
    category: "Memory",
    syntax: "ldrsh wt, [xn, #imm] / ldrsh xt, [xn, #imm]",
    example: "ldrsh w0, [x1]",
  },
  {
    mnemonic: "ldrsw",
    category: "Memory",
    syntax: "ldrsw xt, [xn, #imm]",
    example: "ldrsw x0, [x1]",
  },

  // pc-relative addressing
  {
    mnemonic: "adr",
    category: "PC-relative addressing",
    syntax: "adr xd, label",
    runnable: runAdr,
  },
  {
    mnemonic: "adrp",
    category: "PC-relative addressing",
    syntax: "adrp xd, label",
    gotchas: [
      "this lands on the 4 kib page base, not the symbol; add the low 12 bits with `:lo12:` to reach the exact address.",
    ],
    runnable: runAdrp,
  },

  // branches
  {
    mnemonic: "b",
    category: "Branches",
    syntax: "b label",
    example: "b loop",
    runnable: runB,
    encoding: encB,
    encodedAsm: "b done",
  },
  {
    mnemonic: "bl",
    category: "Branches",
    syntax: "bl label",
    example: "bl printf",
    encoding: encBl,
    encodedAsm: "bl helper",
  },
  {
    mnemonic: "br",
    category: "Branches",
    syntax: "br xn",
    example: "br x0",
  },
  {
    mnemonic: "blr",
    category: "Branches",
    syntax: "blr xn",
    example: "blr x0",
  },
  {
    mnemonic: "ret",
    category: "Branches",
    syntax: "ret / ret xn",
    example: "ret",
  },
  {
    mnemonic: "b.cond",
    category: "Branches",
    syntax: "b.eq label / b.ne label / b.lt label / ...",
    runnable: runBcond,
  },
  {
    mnemonic: "cbz",
    category: "Branches",
    syntax: "cbz rt, label",
    example: "cbz x0, done",
    runnable: runCbz,
  },
  {
    mnemonic: "cbnz",
    category: "Branches",
    syntax: "cbnz rt, label",
    example: "cbnz x0, loop",
    runnable: runCbnz,
  },
  {
    mnemonic: "tbz",
    category: "Branches",
    syntax: "tbz rt, #bit, label",
    runnable: runTbz,
  },
  {
    mnemonic: "tbnz",
    category: "Branches",
    syntax: "tbnz rt, #bit, label",
    example: "tbnz w0, #0, odd",
    runnable: runTbnz,
  },

  // system
  {
    mnemonic: "nop",
    category: "System",
    syntax: "nop",
    example: "nop",
  },
  {
    mnemonic: "svc",
    category: "System",
    syntax: "svc #0",
    example: "svc #0",
  },

  // floating point
  {
    mnemonic: "fmov",
    category: "Floating point",
    syntax: "fmov dd, dn / fmov dd, #imm",
    gotchas: [
      "the immediate is 8 bits of float: a power-of-two multiple of 1.0 through 1.9375. constants like 5.0 and 9.0 fit; 0.0 and most decimals do not, so load those from a `.double` in `.data`.",
    ],
  },
  {
    mnemonic: "fadd",
    category: "Floating point",
    syntax: "fadd dd, dn, dm",
    example: "fadd d0, d1, d2",
  },
  {
    mnemonic: "fsub",
    category: "Floating point",
    syntax: "fsub dd, dn, dm",
    example: "fsub d0, d1, d2",
  },
  {
    mnemonic: "fmul",
    category: "Floating point",
    syntax: "fmul dd, dn, dm",
    example: "fmul d0, d1, d2",
  },
  {
    mnemonic: "fdiv",
    category: "Floating point",
    syntax: "fdiv dd, dn, dm",
    example: "fdiv d0, d1, d2",
  },
  {
    mnemonic: "fneg",
    category: "Floating point",
    syntax: "fneg dd, dn",
    gotchas: [
      "the alternating-sign series idiom: `fneg sign, sign` each pass flips a running +1/-1 factor without a branch.",
    ],
  },
  {
    mnemonic: "fabs",
    category: "Floating point",
    syntax: "fabs dd, dn",
    gotchas: [
      "the convergence-test idiom: take `fabs` of an error term before `fcmp` against the epsilon, so the loop exits on distance from zero, not direction.",
    ],
  },
  {
    mnemonic: "fcmp",
    category: "Floating point",
    syntax: "fcmp dn, dm",
    example: "fcmp d0, d1",
  },
  {
    mnemonic: "scvtf",
    category: "Floating point",
    syntax: "scvtf dd, xn / scvtf dd, wn",
    example: "scvtf d0, x0",
  },
  {
    mnemonic: "fcvtzs",
    category: "Floating point",
    syntax: "fcvtzs xd, dn / fcvtzs wd, dn",
    example: "fcvtzs x0, d0",
  },
];

export const REFERENCE_INSTRUCTIONS: ReferenceInstruction[] = referenceSeeds.map(
  (seed): ReferenceInstruction => {
    const doc = lookupDoc(seed.mnemonic);
    if (!doc) {
      throw new Error(
        `reference-data: no instruction-docs entry for ${seed.mnemonic}`,
      );
    }
    const example = doc.example ?? seed.example;
    if (example === undefined) {
      throw new Error(`reference-data: no example for ${seed.mnemonic}`);
    }
    return {
      mnemonic: seed.mnemonic,
      category: seed.category,
      syntax: seed.syntax,
      summary: doc.summary,
      example,
      ...(doc.cExample !== undefined ? { cExample: doc.cExample } : {}),
      ...(seed.gotchas !== undefined ? { gotchas: seed.gotchas } : {}),
      ...(seed.encoding !== undefined ? { encoding: seed.encoding } : {}),
      ...(seed.encodedAsm !== undefined ? { encodedAsm: seed.encodedAsm } : {}),
      ...(seed.runnable !== undefined ? { runnable: seed.runnable } : {}),
    };
  },
);
