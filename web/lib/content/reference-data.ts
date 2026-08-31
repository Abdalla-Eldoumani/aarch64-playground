import { lookupDoc } from "@/lib/asm/instruction-docs";

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

/**
 * One field of an authored encoding. The shape lives with the data that
 * authors it rather than with BitFieldDiagram, which only draws it.
 */
export interface BitField {
  /** Width of the field in bits; the box width is proportional to this. */
  bits: number;
  /** Short field name shown in the box, e.g. "opcode", "Rn", "Rd". */
  label: string;
  /** Optional explicit accent color (a CSS color or a token reference like
   *  `var(--cyan)`). Falls back to a token-driven neutral cap when omitted. */
  color?: string;
  /** Worked-example bits for this field ("10011"); length must equal `bits`.
   *  When every field carries one, the diagram turns interactive. */
  value?: string;
  /** What the worked bits decode to, e.g. "x19" or "16 / 8 = 2". */
  meaning?: string;
}

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
 * its category, its Form-derived syntax, the reference-page example, and the
 * optional authored extras.
 */
interface ReferenceSeed {
  mnemonic: string;
  category: ReferenceCategory;
  syntax: string;
  /** Worked example for the reference page: concrete values and the result
   *  in a comment, so reading it teaches and running it in place shows real
   *  state. Wins over the terse hover example; absent, the hover's is used. */
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

const runBl = `// branch with link: bl saves its return address in lr
define(fp, x29)
define(lr, x30)

        .data
msg:    .string "printf returned right here\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =msg
        bl      printf          // lr = the next line; printf rides it back

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runBr = `// branch through a register: compute a target, then jump to it
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        adr     x9, past        // x9 = the address of the label below
        br      x9              // jump through the register
        mov     w0, 9           // skipped
past:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

const runBlr = `// call through a register: the helper's address travels in x9
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        adr     x9, triple
        mov     w0, 14
        blr     x9              // call whatever x9 points at; lr = return
        // w0 came back tripled: the exit code reads 42

        ldp     fp, lr, [sp], 16
        ret

triple:
        lsl     w10, w0, 1      // w10 = w0 * 2
        add     w0, w0, w10     // w0 * 3, a leaf: no frame needed
        ret
`;

const runSvc = `// svc 0 dispatches on x8: 64 is write(fd, buf, count)
        .data
msg:    .string "written by the raw syscall\\n"
len = . - msg - 1

        .text
        .balign 4
        .global main
main:
        mov     x0, 1           // fd 1: stdout
        ldr     x1, =msg
        mov     x2, len
        mov     x8, 64          // the write syscall number
        svc     0

        mov     x0, 0
        mov     x8, 93          // exit(0): no return, no frame needed
        svc     0
`;

const referenceSeeds: ReferenceSeed[] = [
  // data processing
  {
    mnemonic: "mov",
    category: "Data processing",
    syntax: "mov xd, xn / mov xd, #imm / mov xd, sp",
    example: `mov     x9, 42              // x9 = 42
mov     x10, x9             // copy: x10 = 42 too`,
    gotchas: [
      "the immediate form only takes a value that fits one shifted 16-bit field; a wider constant needs a move-wide then keep sequence.",
    ],
  },
  {
    mnemonic: "movz",
    category: "Data processing",
    syntax: "movz xd, #imm, lsl #shift",
    example: `movz    x9, 0x1234, lsl 16  // x9 = 0x12340000; the rest zeroed`,
    encoding: encMovz,
    encodedAsm: "movz x19, 0x1234",
  },
  {
    mnemonic: "movk",
    category: "Data processing",
    syntax: "movk xd, #imm, lsl #shift",
    example: `movz    x9, 0x1234          // x9 = 0x1234
movk    x9, 0xbeef, lsl 16  // keep the rest: x9 = 0xbeef1234`,
    encoding: encMovk,
    encodedAsm: "movk x19, 0xbeef, lsl 16",
  },
  {
    mnemonic: "movn",
    category: "Data processing",
    syntax: "movn xd, #imm, lsl #shift",
    example: `movn    x9, 0               // x9 = ~0 = -1, all ones`,
  },
  {
    mnemonic: "add",
    category: "Data processing",
    syntax: "add xd, xn, xm / add xd, xn, #imm",
    example: `mov     x9, 6
mov     x10, 7
add     x11, x9, x10        // x11 = 13
add     x12, x11, 100       // immediate form: x12 = 113`,
    encoding: encAddImm,
    encodedAsm: "add x19, x0, 8",
  },
  {
    mnemonic: "adds",
    category: "Data processing",
    syntax: "adds xd, xn, xm / adds xd, xn, #imm",
    example: `mov     w9, 5
adds    w10, w9, 7          // w10 = 12, and nzcv describes the sum`,
  },
  {
    mnemonic: "sub",
    category: "Data processing",
    syntax: "sub xd, xn, xm / sub xd, xn, #imm",
    example: `mov     x9, 50
sub     x10, x9, 8          // x10 = 42`,
    encoding: encAddSubShifted,
    encodedAsm: "sub x19, x0, x1",
  },
  {
    mnemonic: "subs",
    category: "Data processing",
    syntax: "subs xd, xn, xm / subs xd, xn, #imm",
    example: `mov     w9, 3
subs    w10, w9, 5          // w10 = -2 and n is set: the branch fuel`,
  },
  {
    mnemonic: "adc",
    category: "Data processing",
    syntax: "adc xd, xn, xm",
    example: `movn    x9, 0               // the low half of a 128-bit value
mov     x10, 1
adds    x11, x9, x10        // low sum wraps to 0 and sets c
mov     x12, 1
mov     x13, 2
adc     x14, x12, x13       // high sum = 1 + 2 + carry = 4`,
    gotchas: [
      "Register form only: there is no add-with-carry immediate in AArch64.",
      "The carry-in is whatever NZCV holds, so the flag-setting instruction that produces it has to be the one right before.",
    ],
  },
  {
    mnemonic: "adcs",
    category: "Data processing",
    syntax: "adcs xd, xn, xm",
    example: `movn    w9, 0               // 0xffffffff
mov     w10, 1
adds    w11, w9, w10        // w11 = 0 and c is set
adcs    w12, wzr, wzr       // w12 = 0 + 0 + 1 = 1, and nzcv updated`,
  },
  {
    mnemonic: "sbc",
    category: "Data processing",
    syntax: "sbc xd, xn, xm",
    example: `mov     x9, 0
mov     x10, 1
subs    x11, x9, x10        // the low half borrows, so c clears
mov     x12, 1
mov     x13, 0
sbc     x14, x12, x13       // high half = 1 - 0 - 1 = 0`,
    gotchas: [
      "The carry is the not-borrow: c set means the previous subtraction did NOT borrow, so nothing extra comes off.",
    ],
  },
  {
    mnemonic: "sbcs",
    category: "Data processing",
    syntax: "sbcs xd, xn, xm",
    example: `mov     x9, 5
mov     x10, 3
cmp     x9, x10             // 5 >= 3, so c is set: no borrow
sbcs    x11, x9, x10        // x11 = 5 - 3 - 0 = 2, and nzcv updated`,
  },
  {
    mnemonic: "mul",
    category: "Data processing",
    syntax: "mul xd, xn, xm",
    example: `mov     x9, 6
mov     x10, 7
mul     x11, x9, x10        // x11 = 42`,
  },
  {
    mnemonic: "madd",
    category: "Data processing",
    syntax: "madd xd, xn, xm, xa",
    example: `mov     x9, 6
mov     x10, 7
mov     x11, 100
madd    x12, x9, x10, x11   // x12 = 100 + 6 * 7 = 142`,
  },
  {
    mnemonic: "msub",
    category: "Data processing",
    syntax: "msub xd, xn, xm, xa",
    example: `mov     x9, 6
mov     x10, 7
mov     x11, 100
msub    x12, x9, x10, x11   // x12 = 100 - 6 * 7 = 58`,
  },
  {
    mnemonic: "negs",
    category: "Data processing",
    syntax: "negs xd, xm",
    example: `mov     x9, 1
negs    x10, x9             // x10 = -1 and n is set: subs from zero`,
  },
  {
    mnemonic: "smull",
    category: "Data processing",
    syntax: "smull xd, wn, wm",
    example: `mov     w9, -3
mov     w10, 5
smull   x11, w9, w10        // x11 = -15, exact in 64 bits`,
  },
  {
    mnemonic: "umull",
    category: "Data processing",
    syntax: "umull xd, wn, wm",
    example: `mov     w9, 0xffffffff
mov     w10, 2
umull   x11, w9, w10        // x11 = 0x1fffffffe: no 32-bit wrap`,
  },
  {
    mnemonic: "smulh",
    category: "Data processing",
    syntax: "smulh xd, xn, xm",
    example: `mov     x9, 0x4000000000000000
mov     x10, 4
smulh   x11, x9, x10        // x11 = 1: the product's top 64 bits`,
  },
  {
    mnemonic: "umulh",
    category: "Data processing",
    syntax: "umulh xd, xn, xm",
    example: `mov     x9, 0x8000000000000000
mov     x10, 2
umulh   x11, x9, x10        // x11 = 1: the carry out of bit 63`,
  },
  {
    mnemonic: "udiv",
    category: "Data processing",
    syntax: "udiv xd, xn, xm",
    example: `mov     x9, 42
mov     x10, 5
udiv    x11, x9, x10        // x11 = 8: the remainder is simply gone`,
    gotchas: [
      "a zero divisor writes zero instead of trapping, so guard the divisor yourself when zero is possible.",
      "no remainder comes back; recover it with `msub xr, xq, xm, xn` after the divide.",
    ],
  },
  {
    mnemonic: "sdiv",
    category: "Data processing",
    syntax: "sdiv xd, xn, xm",
    example: `mov     x9, 42
neg     x9, x9              // x9 = -42
mov     x10, 5
sdiv    x11, x9, x10        // x11 = -8: truncation goes toward zero`,
  },
  {
    mnemonic: "neg",
    category: "Data processing",
    syntax: "neg xd, xm",
    example: `mov     x9, 7
neg     x10, x9             // x10 = -7`,
  },
  {
    mnemonic: "and",
    category: "Data processing",
    syntax: "and xd, xn, xm / and xd, xn, #imm",
    example: `mov     w9, 0x2c
and     w10, w9, 0xf        // keep the low nibble: w10 = 0xc`,
  },
  {
    mnemonic: "ands",
    category: "Data processing",
    syntax: "ands xd, xn, xm / ands xd, xn, #imm",
    example: `mov     w9, 6
ands    w10, w9, 1          // w10 = 0 and z is set: 6 is even`,
  },
  {
    mnemonic: "orr",
    category: "Data processing",
    syntax: "orr xd, xn, xm",
    example: `mov     w9, 0xf0
mov     w10, 0x0f
orr     w11, w9, w10        // w11 = 0xff`,
  },
  {
    mnemonic: "eor",
    category: "Data processing",
    syntax: "eor xd, xn, xm",
    example: `mov     w9, 0xff
mov     w10, 0x0f
eor     w11, w9, w10        // shared bits cancel: w11 = 0xf0`,
  },
  {
    mnemonic: "mvn",
    category: "Data processing",
    syntax: "mvn xd, xm",
    example: `mov     w9, 0xf
mvn     w10, w9             // every bit flipped: w10 = 0xfffffff0`,
  },
  {
    mnemonic: "bic",
    category: "Data processing",
    syntax: "bic xd, xn, xm",
    example: `mov     w9, 0xff
mov     w10, 0x0f
bic     w11, w9, w10        // clear w10's bits out of w9: w11 = 0xf0`,
    gotchas: [
      "register form only: there is no bic with an immediate. clear a constant mask with `and` and the inverted bits instead.",
      "does not set flags; pair with `tst` when the cleared result drives a branch.",
    ],
  },
  {
    mnemonic: "lsl",
    category: "Data processing",
    syntax: "lsl xd, xn, #imm",
    example: `mov     w9, 3
lsl     w10, w9, 4          // w10 = 48: left shift multiplies by 16`,
  },
  {
    mnemonic: "lsr",
    category: "Data processing",
    syntax: "lsr xd, xn, #imm",
    example: `mov     w9, 48
lsr     w10, w9, 4          // w10 = 3: unsigned divide by 16`,
  },
  {
    mnemonic: "asr",
    category: "Data processing",
    syntax: "asr xd, xn, #imm",
    example: `mov     w9, 32
neg     w9, w9              // w9 = -32
asr     w10, w9, 2          // w10 = -8: the sign bit rides along`,
  },
  {
    mnemonic: "ror",
    category: "Data processing",
    syntax: "ror xd, xn, #imm",
    example: `mov     x9, 0xf
ror     x10, x9, 4          // the low nibble wraps to the top`,
  },
  {
    mnemonic: "sbfx",
    category: "Data processing",
    syntax: "sbfx xd, xn, #lsb, #width",
    example: `mov     w9, 0xf0
sbfx    w10, w9, 4, 4       // w10 = -1: the field's top bit is the sign`,
  },
  {
    mnemonic: "sxtb",
    category: "Data processing",
    syntax: "sxtb xd, wn / sxtb wd, wn",
    example: `mov     w9, 0x80            // as a signed byte: -128
sxtb    w10, w9             // w10 = -128, the sign carried up`,
  },
  {
    mnemonic: "sxth",
    category: "Data processing",
    syntax: "sxth xd, wn / sxth wd, wn",
    example: `mov     w9, 0x8000          // as a signed halfword: -32768
sxth    w10, w9             // w10 = -32768`,
  },
  {
    mnemonic: "sxtw",
    category: "Data processing",
    syntax: "sxtw xd, wn",
    example: `mov     w9, 1
mov     w10, 2
sub     w11, w9, w10        // w11 = -1 as an int
sxtw    x12, w11            // x12 = -1 across all 64 bits`,
  },
  {
    mnemonic: "uxtb",
    category: "Data processing",
    syntax: "uxtb wd, wn",
    example: `mov     w9, 0x141           // 321: more than one byte
uxtb    w10, w9             // only the byte survives: w10 = 0x41`,
  },
  {
    mnemonic: "uxth",
    category: "Data processing",
    syntax: "uxth wd, wn",
    example: `mov     w9, 0x1234
lsl     w9, w9, 8           // w9 = 0x123400
uxth    w10, w9             // low halfword only: w10 = 0x3400`,
  },
  {
    mnemonic: "ubfx",
    category: "Data processing",
    syntax: "ubfx xd, xn, #lsb, #width",
    example: `mov     w9, 0x2b40
ubfx    w10, w9, 8, 4       // pull bits 8-11 down to 0: w10 = 0xb`,
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
    example: `mov     w9, 0xff00          // bits outside the field, in place
mov     w10, 0xc
bfi     w9, w10, 4, 4       // merge at bit 4: w9 = 0xffc0`,
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
    example: `mov     w9, 3
cmp     w9, 5               // flags say: less
cset    w10, lt             // the verdict, captured: w10 = 1`,
  },
  {
    mnemonic: "cmn",
    category: "Compare and test",
    syntax: "cmn xn, xm / cmn xn, #imm",
    example: `mov     w9, 1
neg     w9, w9              // w9 = -1, the not-found sentinel
cmn     w9, 1               // adds 1: the result is 0, z set
cset    w10, eq             // w10 = 1: w9 was -1`,
  },
  {
    mnemonic: "tst",
    category: "Compare and test",
    syntax: "tst xn, xm / tst xn, #imm",
    example: `mov     w9, 6
tst     w9, 1               // bit 0 clear, so z is set
cset    w10, eq             // w10 = 1: 6 is even`,
  },

  // conditional select
  {
    mnemonic: "csel",
    category: "Conditional select",
    syntax: "csel xd, xn, xm, cond",
    example: `mov     w9, 3
mov     w10, 7
cmp     w9, w10
csel    w11, w9, w10, lt    // the smaller, no branch: w11 = 3`,
  },
  {
    mnemonic: "csinc",
    category: "Conditional select",
    syntax: "csinc xd, xn, xm, cond",
    example: `mov     w9, 3
cmp     w9, 3
csinc   w10, w9, w9, ne     // ne is false: the else arm, w10 = w9 + 1 = 4`,
  },
  {
    mnemonic: "csinv",
    category: "Conditional select",
    syntax: "csinv xd, xn, xm, cond",
    example: `mov     w9, 3
cmp     w9, 3
csinv   w10, w9, w9, ne     // ne is false: the else arm, w10 = ~3`,
  },
  {
    mnemonic: "csneg",
    category: "Conditional select",
    syntax: "csneg xd, xn, xm, cond",
    example: `mov     w9, -8
cmp     w9, 0
csneg   w10, w9, w9, pl     // pl is false: w10 = -w9 = 8. abs(), no branch`,
  },
  {
    mnemonic: "cset",
    category: "Conditional select",
    syntax: "cset xd, cond",
    example: `mov     w9, 5
cmp     w9, 0
cset    w10, gt             // w10 = 1: 5 is positive`,
  },

  // memory: examples carve an aligned scratch slot below sp and put it back,
  // so every one runs clean inside the playground's wrapped main.
  {
    mnemonic: "ldr",
    category: "Memory",
    syntax: "ldr xt, [xn] / [xn, #imm] / [xn, #imm]! / [xn], #imm",
    example: `sub     sp, sp, 16          // scratch slot, kept 16-byte aligned
mov     x9, 42
str     x9, [sp, 8]
ldr     x10, [sp, 8]        // x10 = 42
add     sp, sp, 16`,
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
    example: `sub     sp, sp, 16
mov     w9, 7
str     w9, [sp, 12]        // the register width picks the store size
ldr     w10, [sp, 12]       // read back: w10 = 7
add     sp, sp, 16`,
    encoding: encStrUoff,
    encodedAsm: "str x19, [x20, 16]",
  },
  {
    mnemonic: "ldrb",
    category: "Memory",
    syntax: "ldrb wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0x141           // 321: more than one byte
strb    w9, [sp, 8]         // only the low byte lands
ldrb    w10, [sp, 8]        // w10 = 0x41 = 65
add     sp, sp, 16`,
  },
  {
    mnemonic: "strb",
    category: "Memory",
    syntax: "strb wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 65
strb    w9, [sp, 8]         // one byte to memory
ldrb    w10, [sp, 8]        // w10 = 65
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldrh",
    category: "Memory",
    syntax: "ldrh wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0xbeef
strh    w9, [sp, 8]
ldrh    w10, [sp, 8]        // w10 = 0xbeef, zero-extended
add     sp, sp, 16`,
  },
  {
    mnemonic: "strh",
    category: "Memory",
    syntax: "strh wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0x1234
strh    w9, [sp, 10]        // halfwords want 2-byte alignment
ldrh    w10, [sp, 10]       // w10 = 0x1234
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldp",
    category: "Memory",
    syntax: "ldp xt1, xt2, [xn, #imm]",
    example: `mov     x9, 7
mov     x10, 9
stp     x9, x10, [sp, -16]!
ldp     x11, x12, [sp], 16  // one instruction, two loads: 7 and 9`,
  },
  {
    mnemonic: "stp",
    category: "Memory",
    syntax: "stp xt1, xt2, [xn, #imm] / stp dt1, dt2, [xn, #imm]",
    example: `mov     x9, 1
mov     x10, 2
stp     x9, x10, [sp, -16]! // push the pair; sp drops 16 first
ldp     x11, x12, [sp], 16  // pop it back: x11 = 1, x12 = 2`,
    gotchas: [
      "d and s pairs work too: `stp d8, d9, [sp, -16]!` is how a prologue saves the callee-saved fp registers.",
    ],
  },
  {
    mnemonic: "ldrsb",
    category: "Memory",
    syntax: "ldrsb wt, [xn, #imm] / ldrsb xt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0x80            // as a signed byte: -128
strb    w9, [sp, 8]
ldrsb   w10, [sp, 8]        // w10 = -128: the sign came back
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldrsh",
    category: "Memory",
    syntax: "ldrsh wt, [xn, #imm] / ldrsh xt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0x8000          // as a signed halfword: -32768
strh    w9, [sp, 8]
ldrsh   w10, [sp, 8]        // w10 = -32768
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldrsw",
    category: "Memory",
    syntax: "ldrsw xt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 1
neg     w9, w9              // -1 as an int
str     w9, [sp, 8]
ldrsw   x10, [sp, 8]        // x10 = -1 across all 64 bits
add     sp, sp, 16`,
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
    runnable: runBl,
    encoding: encBl,
    encodedAsm: "bl helper",
  },
  {
    mnemonic: "br",
    category: "Branches",
    syntax: "br xn",
    example: "br x0",
    runnable: runBr,
  },
  {
    mnemonic: "blr",
    category: "Branches",
    syntax: "blr xn",
    example: "blr x0",
    runnable: runBlr,
  },
  {
    mnemonic: "ret",
    category: "Branches",
    syntax: "ret / ret xn",
    example: `mov     w0, 7               // the return value convention: w0
ret                         // back to the caller: exit code 7`,
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
    example: "svc 0",
    runnable: runSvc,
  },

  // floating point: each example lands its result in an integer register
  // through fcvtzs, so the value is visible in the register panel when run.
  {
    mnemonic: "fmov",
    category: "Floating point",
    syntax: "fmov dd, dn / fmov dd, xn / fmov xd, dn / fmov dd, #imm",
    example: `fmov    d16, 5.0            // one of the encodable immediates
fcvtzs  x9, d16             // x9 = 5: the double, made visible`,
    gotchas: [
      "the immediate is 8 bits of float: a power-of-two multiple of 1.0 through 1.9375. constants like 5.0 and 9.0 fit; 0.0 and most decimals do not, so load those from a `.double` in `.data`.",
      "the between-files forms (`fmov d0, x0`, `fmov x0, d0`, and the s/w pair) copy raw bits with no conversion: `fmov d0, x0` with x0 = 42 is not 42.0. convert with `scvtf`/`fcvtzs`.",
    ],
  },
  {
    mnemonic: "fadd",
    category: "Floating point",
    syntax: "fadd dd, dn, dm / fadd sd, sn, sm",
    example: `fmov    d16, 1.5
fmov    d17, 2.5
fadd    d18, d16, d17       // d18 = 4.0
fcvtzs  x9, d18             // x9 = 4`,
  },
  {
    mnemonic: "fsub",
    category: "Floating point",
    syntax: "fsub dd, dn, dm / fsub sd, sn, sm",
    example: `fmov    d16, 5.0
fmov    d17, 1.5
fsub    d18, d16, d17       // d18 = 3.5
fcvtzs  x9, d18             // x9 = 3: conversion truncates`,
  },
  {
    mnemonic: "fmul",
    category: "Floating point",
    syntax: "fmul dd, dn, dm / fmul sd, sn, sm",
    example: `fmov    d16, 2.5
fmov    d17, 4.0
fmul    d18, d16, d17       // d18 = 10.0
fcvtzs  x9, d18             // x9 = 10`,
  },
  {
    mnemonic: "fdiv",
    category: "Floating point",
    syntax: "fdiv dd, dn, dm / fdiv sd, sn, sm",
    example: `fmov    d16, 9.0
fmov    d17, 2.0
fdiv    d18, d16, d17       // d18 = 4.5
fcvtzs  x9, d18             // x9 = 4: the fraction is cut, not rounded`,
  },
  {
    mnemonic: "fneg",
    category: "Floating point",
    syntax: "fneg dd, dn / fneg sd, sn",
    example: `fmov    d16, 2.0
fneg    d16, d16            // d16 = -2.0: just the sign bit flips
fcvtzs  x9, d16             // x9 = -2`,
    gotchas: [
      "the alternating-sign series idiom: `fneg sign, sign` each pass flips a running +1/-1 factor without a branch.",
    ],
  },
  {
    mnemonic: "fabs",
    category: "Floating point",
    syntax: "fabs dd, dn / fabs sd, sn",
    example: `fmov    d16, 3.0
fneg    d16, d16            // d16 = -3.0
fabs    d17, d16            // d17 = 3.0: distance from zero
fcvtzs  x9, d17             // x9 = 3`,
    gotchas: [
      "the convergence-test idiom: take `fabs` of an error term before `fcmp` against the epsilon, so the loop exits on distance from zero, not direction.",
    ],
  },
  {
    mnemonic: "fsqrt",
    category: "Floating point",
    syntax: "fsqrt dd, dn / fsqrt sd, sn",
    example: `fmov    d16, 9.0
fsqrt   d17, d16            // d17 = 3.0
fcvtzs  x9, d17             // x9 = 3`,
    gotchas: [
      "a negative operand gives NaN instead of an error, and NaN compares unordered: `fcmp` against it sets c and v, so a `b.lt` after it never takes. check the sign before taking the root.",
    ],
  },
  {
    mnemonic: "fcmp",
    category: "Floating point",
    syntax: "fcmp dn, dm / fcmp sn, sm",
    example: `fmov    d16, 1.5
fmov    d17, 2.5
fcmp    d16, d17            // same nzcv flags as integer cmp
cset    w9, lt              // w9 = 1: d16 is below d17`,
  },
  {
    mnemonic: "fcmpe",
    category: "Floating point",
    syntax: "fcmpe dn, dm / fcmpe sn, sm",
    example: `fmov    d16, 1.5
fmov    d17, 2.5
fcmpe   d16, d17            // gcc's spelling for float < and >
cset    w9, lt              // w9 = 1`,
  },
  {
    mnemonic: "fcvt",
    category: "Floating point",
    syntax: "fcvt dd, sn / fcvt sd, dn",
    example: `fmov    s0, 2.5             // a float, in the register's low 32 bits
fcvt    d1, s0              // widen: d1 = 2.5 exactly
fcvtzs  x9, d1              // x9 = 2`,
    gotchas: [
      "printf takes doubles, never floats: widen with `fcvt d0, s0` before `bl printf`, or the printed value is garbage.",
      "narrowing `fcvt s0, d0` rounds to the nearest float; wide doubles lose precision on the way down.",
    ],
  },
  {
    mnemonic: "scvtf",
    category: "Floating point",
    syntax: "scvtf dd, xn / scvtf dd, wn / scvtf sd, wn",
    example: `mov     x9, 7
scvtf   d16, x9             // d16 = 7.0
fcvtzs  x10, d16            // x10 = 7: round-tripped`,
  },
  {
    mnemonic: "fcvtzs",
    category: "Floating point",
    syntax: "fcvtzs xd, dn / fcvtzs wd, dn / fcvtzs wd, sn",
    example: `fmov    d16, 1.9375         // the largest encodable mantissa
fcvtzs  w9, d16             // w9 = 1: toward zero, never rounding`,
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
    // The seed's worked example wins on the reference page; the hover card
    // keeps its own terse example straight from instruction-docs.
    const example = seed.example ?? doc.example;
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
