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
  | "Floating point"
  | "Vector";

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
   *  state. Wins over the terse hover example; absent, the hover's is used.
   *
   *  Two conventions hold across every example. Comments start at column 32,
   *  which is column 40 once playground-source indents the body by eight
   *  spaces (the course's comment column); a line whose code already reaches
   *  32 takes a two-space gap instead. Immediates follow the row: a general-
   *  register row writes them bare, the way the course does, and a vector
   *  row carries the `#` on every line, its scalar setup lines included, so
   *  no block mixes the two spellings. The vector shift and compare-against-
   *  zero parsers reject the bare spelling, so the hashed one is the only
   *  form those rows can use, and it is what the reference's Form cells and
   *  the conformance inventory carry for them. */
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
        bl      printf          // lr = the next line, where printf returns

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
len = . - msg - 1               // length without the NUL

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
    syntax: "mov xd, xn / mov xd, #imm / mov xd, sp / mov vd.T, vn.T",
    example: `mov     x9, 42                  // x9 = 42
mov     x10, x9                 // copy: x10 = 42 too
movi    v1.16b, #12
mov     v3.16b, v1.16b          // every lane = 12`,
    gotchas: [
      "the immediate form only takes a value that fits one shifted 16-bit field; a wider constant needs a move-wide then keep sequence.",
    ],
  },
  {
    mnemonic: "movz",
    category: "Data processing",
    syntax: "movz xd, #imm, lsl #shift",
    example: `movz    x9, 0x1234, lsl 16      // x9 = 0x12340000; the rest zeroed`,
    encoding: encMovz,
    encodedAsm: "movz x19, 0x1234",
  },
  {
    mnemonic: "movk",
    category: "Data processing",
    syntax: "movk xd, #imm, lsl #shift",
    example: `movz    x9, 0x1234              // x9 = 0x1234
movk    x9, 0xbeef, lsl 16      // keep the rest: x9 = 0xbeef1234`,
    encoding: encMovk,
    encodedAsm: "movk x19, 0xbeef, lsl 16",
  },
  {
    mnemonic: "movn",
    category: "Data processing",
    syntax: "movn xd, #imm, lsl #shift",
    example: `movn    x9, 0                   // x9 = ~0 = -1, all ones`,
  },
  {
    mnemonic: "add",
    category: "Data processing",
    syntax: "add xd, xn, xm / add xd, xn, #imm / add vd.T, vn.T, vm.T",
    example: `mov     x9, 6
mov     x10, 7
add     x11, x9, x10            // x11 = 13
add     x12, x11, 100           // immediate form: x12 = 113
movi    v1.16b, #12
movi    v2.16b, #5
add     v3.16b, v1.16b, v2.16b  // every lane = 0x11`,
    encoding: encAddImm,
    encodedAsm: "add x19, x0, 8",
  },
  {
    mnemonic: "adds",
    category: "Data processing",
    syntax: "adds xd, xn, xm / adds xd, xn, #imm",
    example: `mov     w9, 5
adds    w10, w9, 7              // w10 = 12, and nzcv describes the sum`,
  },
  {
    mnemonic: "sub",
    category: "Data processing",
    syntax: "sub xd, xn, xm / sub xd, xn, #imm / sub vd.T, vn.T, vm.T",
    example: `mov     x9, 50
sub     x10, x9, 8              // x10 = 42
movi    v1.16b, #12
movi    v2.16b, #5
sub     v3.16b, v1.16b, v2.16b  // every lane = 7`,
    encoding: encAddSubShifted,
    encodedAsm: "sub x19, x0, x1",
  },
  {
    mnemonic: "subs",
    category: "Data processing",
    syntax: "subs xd, xn, xm / subs xd, xn, #imm",
    example: `mov     w9, 3
subs    w10, w9, 5              // w10 = -2 and n is set: b.lt reads that flag`,
  },
  {
    mnemonic: "adc",
    category: "Data processing",
    syntax: "adc xd, xn, xm",
    example: `movn    x9, 0                   // the low half of a 128-bit value
mov     x10, 1
adds    x11, x9, x10            // low sum wraps to 0 and sets c
mov     x12, 1
mov     x13, 2
adc     x14, x12, x13           // high sum = 1 + 2 + carry = 4`,
    gotchas: [
      "register form only: there is no add-with-carry immediate in AArch64.",
      "the carry-in is whatever NZCV holds, so the flag-setting instruction that produces it has to be the one right before.",
    ],
  },
  {
    mnemonic: "adcs",
    category: "Data processing",
    syntax: "adcs xd, xn, xm",
    example: `movn    w9, 0                   // 0xffffffff
mov     w10, 1
adds    w11, w9, w10            // w11 = 0 and c is set
adcs    w12, wzr, wzr           // w12 = 0 + 0 + 1 = 1, and nzcv updated`,
  },
  {
    mnemonic: "sbc",
    category: "Data processing",
    syntax: "sbc xd, xn, xm",
    example: `mov     x9, 0
mov     x10, 1
subs    x11, x9, x10            // the low half borrows, so c clears
mov     x12, 1
mov     x13, 0
sbc     x14, x12, x13           // high half = 1 - 0 - 1 = 0`,
    gotchas: [
      "the carry is the not-borrow: c set means the previous subtraction did not borrow, so nothing extra comes off.",
    ],
  },
  {
    mnemonic: "sbcs",
    category: "Data processing",
    syntax: "sbcs xd, xn, xm",
    example: `mov     x9, 5
mov     x10, 3
cmp     x9, x10                 // 5 >= 3, so c is set: no borrow
sbcs    x11, x9, x10            // x11 = 5 - 3 - 0 = 2, and nzcv updated`,
  },
  {
    mnemonic: "mul",
    category: "Data processing",
    syntax: "mul xd, xn, xm / mul vd.T, vn.T, vm.T",
    example: `mov     x9, 6
mov     x10, 7
mul     x11, x9, x10            // x11 = 42
movi    v1.16b, #12
movi    v2.16b, #5
mul     v3.8h, v1.8h, v2.8h     // every lane = 0x783c`,
  },
  {
    mnemonic: "madd",
    category: "Data processing",
    syntax: "madd xd, xn, xm, xa",
    example: `mov     x9, 6
mov     x10, 7
mov     x11, 100
madd    x12, x9, x10, x11       // x12 = 100 + 6 * 7 = 142`,
  },
  {
    mnemonic: "msub",
    category: "Data processing",
    syntax: "msub xd, xn, xm, xa",
    example: `mov     x9, 6
mov     x10, 7
mov     x11, 100
msub    x12, x9, x10, x11       // x12 = 100 - 6 * 7 = 58`,
  },
  {
    mnemonic: "mneg",
    category: "Data processing",
    syntax: "mneg xd, xn, xm",
    example: `mov     x1, 7
mov     x2, 6
mneg    x3, x1, x2              // x3 = -42`,
  },
  {
    mnemonic: "negs",
    category: "Data processing",
    syntax: "negs xd, xm",
    example: `mov     x9, 1
negs    x10, x9                 // x10 = -1 and n is set: subs from zero`,
  },
  {
    mnemonic: "smull",
    category: "Data processing",
    syntax: "smull xd, wn, wm / smull vd.8h, vn.8b, vm.8b",
    example: `mov     w9, -3
mov     w10, 5
smull   x11, w9, w10            // x11 = -15, exact in 64 bits
movi    v1.16b, #12
movi    v2.16b, #5
smull   v3.8h, v1.8b, v2.8b     // every lane = 0x003c`,
  },
  {
    mnemonic: "umull",
    category: "Data processing",
    syntax: "umull xd, wn, wm / umull vd.8h, vn.8b, vm.8b",
    example: `mov     w9, 0xffffffff
mov     w10, 2
umull   x11, w9, w10            // x11 = 0x1fffffffe: no 32-bit wrap
movi    v1.16b, #12
movi    v2.16b, #5
umull   v3.8h, v1.8b, v2.8b     // every lane = 0x003c`,
  },
  {
    mnemonic: "smulh",
    category: "Data processing",
    syntax: "smulh xd, xn, xm",
    example: `mov     x9, 0x4000000000000000
mov     x10, 4
smulh   x11, x9, x10            // x11 = 1: the product's top 64 bits`,
  },
  {
    mnemonic: "umulh",
    category: "Data processing",
    syntax: "umulh xd, xn, xm",
    example: `mov     x9, 0x8000000000000000
mov     x10, 2
umulh   x11, x9, x10            // x11 = 1: the carry out of bit 63`,
  },
  {
    mnemonic: "smaddl",
    category: "Data processing",
    syntax: "smaddl xd, wn, wm, xa",
    example: `mov     w1, -3
mov     w2, 5
mov     x3, 100
smaddl  x4, w1, w2, x3          // x4 = 85: 100 + (-15)`,
    gotchas: [
      "the accumulator is a full 64-bit register; only the two sources are 32-bit. `smaddl x4, w1, w2, x9` with x9 = 0x100000001 keeps the top half.",
    ],
  },
  {
    mnemonic: "smsubl",
    category: "Data processing",
    syntax: "smsubl xd, wn, wm, xa",
    example: `mov     w1, -3
mov     w2, 5
mov     x3, 100
smsubl  x5, w1, w2, x3          // x5 = 115: 100 - (-15)`,
  },
  {
    mnemonic: "umaddl",
    category: "Data processing",
    syntax: "umaddl xd, wn, wm, xa",
    example: `mov     w1, -3
mov     w2, 5
mov     x3, 100
umaddl  x6, w1, w2, x3          // x6 = 0x500000055: w1 read as 0xfffffffd`,
  },
  {
    mnemonic: "umsubl",
    category: "Data processing",
    syntax: "umsubl xd, wn, wm, xa",
    example: `mov     w1, -3
mov     w2, 5
mov     x3, 100
umsubl  x7, w1, w2, x3          // x7 = 0xfffffffb00000073`,
  },
  {
    mnemonic: "smnegl",
    category: "Data processing",
    syntax: "smnegl xd, wn, wm",
    example: `mov     w1, -3
mov     w2, 5
smnegl  x8, w1, w2              // x8 = 15`,
  },
  {
    mnemonic: "umnegl",
    category: "Data processing",
    syntax: "umnegl xd, wn, wm",
    example: `mov     w1, -3
mov     w2, 5
umnegl  x9, w1, w2              // x9 = 0xfffffffb0000000f`,
  },
  {
    mnemonic: "udiv",
    category: "Data processing",
    syntax: "udiv xd, xn, xm",
    example: `mov     x9, 42
mov     x10, 5
udiv    x11, x9, x10            // x11 = 8: the remainder is discarded`,
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
neg     x9, x9                  // x9 = -42
mov     x10, 5
sdiv    x11, x9, x10            // x11 = -8: truncation goes toward zero`,
  },
  {
    mnemonic: "neg",
    category: "Data processing",
    syntax: "neg xd, xm / neg vd.T, vn.T",
    example: `mov     x9, 7
neg     x10, x9                 // x10 = -7
movi    v1.16b, #12
neg     v3.16b, v1.16b          // every lane = 0xf4`,
  },
  {
    mnemonic: "and",
    category: "Data processing",
    syntax: "and xd, xn, xm / and xd, xn, #imm / and vd.T, vn.T, vm.T (8b / 16b)",
    example: `mov     w9, 0x2c
and     w10, w9, 0xf            // keep the low nibble: w10 = 0xc
movi    v1.16b, #12
movi    v2.16b, #5
and     v3.16b, v1.16b, v2.16b  // every lane = 4`,
  },
  {
    mnemonic: "ands",
    category: "Data processing",
    syntax: "ands xd, xn, xm / ands xd, xn, #imm",
    example: `mov     w9, 6
ands    w10, w9, 1              // w10 = 0 and z is set: 6 is even`,
  },
  {
    mnemonic: "orr",
    category: "Data processing",
    syntax: "orr xd, xn, xm / orr vd.T, vn.T, vm.T (8b / 16b) / orr vd.T, #imm8",
    example: `mov     w9, 0xf0
mov     w10, 0x0f
orr     w11, w9, w10            // w11 = 0xff
movi    v1.16b, #12
movi    v2.16b, #5
orr     v3.16b, v1.16b, v2.16b  // every lane = 13`,
  },
  {
    mnemonic: "eor",
    category: "Data processing",
    syntax: "eor xd, xn, xm / eor vd.T, vn.T, vm.T (8b / 16b)",
    example: `mov     w9, 0xff
mov     w10, 0x0f
eor     w11, w9, w10            // shared bits cancel: w11 = 0xf0
movi    v1.16b, #12
movi    v2.16b, #5
eor     v3.16b, v1.16b, v2.16b  // every lane = 9`,
  },
  {
    mnemonic: "mvn",
    category: "Data processing",
    syntax: "mvn xd, xm / mvn vd.T, vn.T (8b / 16b)",
    example: `mov     w9, 0xf
mvn     w10, w9                 // every bit flipped: w10 = 0xfffffff0
movi    v1.16b, #12
mvn     v3.16b, v1.16b          // every lane = 0xf3`,
  },
  {
    mnemonic: "bic",
    category: "Data processing",
    syntax: "bic xd, xn, xm / bic vd.T, vn.T, vm.T (8b / 16b) / bic vd.T, #imm8",
    example: `mov     w9, 0xff
mov     w10, 0x0f
bic     w11, w9, w10            // clear w10's bits out of w9: w11 = 0xf0
movi    v1.16b, #12
movi    v2.16b, #5
bic     v3.16b, v1.16b, v2.16b  // every lane = 8`,
    gotchas: [
      "register form only: there is no bic with an immediate. clear a constant mask with `and` and the inverted bits instead.",
      "does not set flags; pair with `tst` when the cleared result drives a branch.",
    ],
  },
  {
    mnemonic: "orn",
    category: "Data processing",
    syntax: "orn xd, xn, xm / orn vd.T, vn.T, vm.T (8b / 16b)",
    example: `mov     x1, 0
mov     x2, 0xff
orn     x0, x1, x2              // x0 = 0xffffffffffffff00
movi    v1.16b, #12
movi    v2.16b, #5
orn     v3.16b, v1.16b, v2.16b  // every lane = 0xfe`,
  },
  {
    mnemonic: "eon",
    category: "Data processing",
    syntax: "eon xd, xn, xm",
    example: `mov     x1, 0xff
mov     x2, 0xff
eon     x0, x1, x2              // x0 = -1: equal inputs make xnor all-ones`,
  },
  {
    mnemonic: "clz",
    category: "Data processing",
    syntax: "clz xd, xn / clz wd, wn / clz vd.T, vn.T (b, h, s lanes)",
    example: `movz    w1, 0x4567
movk    w1, 0x0123, lsl 16      // w1 = 0x01234567
clz     w0, w1                  // w0 = 7
mov     x2, 0
clz     x3, x2                  // x3 = 64: zero answers the full width
movi    v1.16b, #12
clz     v3.16b, v1.16b          // every lane = 4`,
  },
  {
    mnemonic: "cls",
    category: "Data processing",
    syntax: "cls xd, xn / cls wd, wn / cls vd.T, vn.T (b, h, s lanes)",
    example: `mov     x1, -1
cls     x0, x1                  // x0 = 63: 64 sign bits, minus the top one
mov     x2, 0
cls     x3, x2                  // x3 = 63 as well
movi    v1.16b, #12
cls     v3.16b, v1.16b          // every lane = 3`,
  },
  {
    mnemonic: "rbit",
    category: "Data processing",
    syntax: "rbit xd, xn / rbit wd, wn / rbit vd.T, vn.T (8b / 16b)",
    example: `movz    w1, 0x4567
movk    w1, 0x0123, lsl 16      // w1 = 0x01234567
rbit    w0, w1                  // w0 = 0xe6a2c480
movi    v1.16b, #12
rbit    v3.16b, v1.16b          // every lane = 0x30`,
  },
  {
    mnemonic: "rev",
    category: "Data processing",
    syntax: "rev xd, xn / rev wd, wn",
    example: `movz    w1, 0x4567
movk    w1, 0x0123, lsl 16      // w1 = 0x01234567
rev     w0, w1                  // w0 = 0x67452301`,
    gotchas: [
      "the x and w forms are separate encodings. `rev w0, w1` swaps four bytes; `rev x0, x1` swaps eight.",
    ],
  },
  {
    mnemonic: "rev16",
    category: "Data processing",
    syntax: "rev16 xd, xn / rev16 wd, wn / rev16 vd.T, vn.T (8b / 16b)",
    example: `movz    w1, 0x4567
movk    w1, 0x0123, lsl 16      // w1 = 0x01234567
rev16   w0, w1                  // w0 = 0x23016745
movi    v1.8h, #12, lsl #8
rev16   v3.16b, v1.16b          // v3 = 12 0 repeating`,
  },
  {
    mnemonic: "rev32",
    category: "Data processing",
    syntax: "rev32 xd, xn / rev32 vd.T, vn.T (b and h lanes)",
    example: `mov     x1, 0xff
rev32   x0, x1                  // x0 = 0xff000000
rev     x2, x1                  // x2 = 0xff00000000000000: the same opcode, the other width
movi    v1.4s, #12, lsl #24
rev32   v3.16b, v1.16b          // v3 = 12 0 0 0 repeating`,
    gotchas: [
      "there is no `rev32 wd, wn`. the 32-bit byte-swap is `rev wd, wn`, which shares this opcode at the other width.",
    ],
  },
  {
    mnemonic: "lsl",
    category: "Data processing",
    syntax: "lsl xd, xn, #imm",
    example: `mov     w9, 3
lsl     w10, w9, 4              // w10 = 48: left shift multiplies by 16`,
  },
  {
    mnemonic: "lsr",
    category: "Data processing",
    syntax: "lsr xd, xn, #imm",
    example: `mov     w9, 48
lsr     w10, w9, 4              // w10 = 3: unsigned divide by 16`,
  },
  {
    mnemonic: "asr",
    category: "Data processing",
    syntax: "asr xd, xn, #imm",
    example: `mov     w9, 32
neg     w9, w9                  // w9 = -32
asr     w10, w9, 2              // w10 = -8: asr copies the sign bit down`,
  },
  {
    mnemonic: "ror",
    category: "Data processing",
    syntax: "ror xd, xn, #imm",
    example: `mov     x9, 0xf
ror     x10, x9, 4              // the low nibble wraps to the top`,
  },
  {
    mnemonic: "sbfx",
    category: "Data processing",
    syntax: "sbfx xd, xn, #lsb, #width",
    example: `mov     w9, 0xf0
sbfx    w10, w9, 4, 4           // w10 = -1: the field's top bit is the sign`,
  },
  {
    mnemonic: "sxtb",
    category: "Data processing",
    syntax: "sxtb xd, wn / sxtb wd, wn",
    example: `mov     w9, 0x80                // as a signed byte: -128
sxtb    w10, w9                 // w10 = -128, the sign carried up`,
  },
  {
    mnemonic: "sxth",
    category: "Data processing",
    syntax: "sxth xd, wn / sxth wd, wn",
    example: `mov     w9, 0x8000              // as a signed halfword: -32768
sxth    w10, w9                 // w10 = -32768`,
  },
  {
    mnemonic: "sxtw",
    category: "Data processing",
    syntax: "sxtw xd, wn",
    example: `mov     w9, 1
mov     w10, 2
sub     w11, w9, w10            // w11 = -1 as an int
sxtw    x12, w11                // x12 = -1 across all 64 bits`,
  },
  {
    mnemonic: "uxtb",
    category: "Data processing",
    syntax: "uxtb wd, wn",
    example: `mov     w9, 0x141               // 321: more than one byte
uxtb    w10, w9                 // only the byte survives: w10 = 0x41`,
  },
  {
    mnemonic: "uxth",
    category: "Data processing",
    syntax: "uxth wd, wn",
    example: `mov     w9, 0x1234
lsl     w9, w9, 8               // w9 = 0x123400
uxth    w10, w9                 // low halfword only: w10 = 0x3400`,
  },
  {
    mnemonic: "uxtw",
    category: "Data processing",
    syntax: "uxtw xd, wn",
    example: `mov     x1, -1
uxtw    x2, w1                  // x2 = 0xffffffff
sxtw    x3, w1                  // x3 = -1: sxtw carries the sign, uxtw does not`,
  },
  {
    mnemonic: "ubfx",
    category: "Data processing",
    syntax: "ubfx xd, xn, #lsb, #width",
    example: `mov     w9, 0x2b40
ubfx    w10, w9, 8, 4           // pull bits 8-11 down to 0: w10 = 0xb`,
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
    example: `mov     w9, 0xff00              // bits outside the field, in place
mov     w10, 0xc
bfi     w9, w10, 4, 4           // merge at bit 4: w9 = 0xffc0`,
    gotchas: [
      "the destination is read before it is written: bits outside the field keep their old values, so xd must already hold what you mean to keep.",
      "only the low `width` bits of xn move; anything above them is ignored, not an error.",
    ],
    encoding: encBfm,
    encodedAsm: "bfi w19, w20, 8, 4",
  },
  {
    mnemonic: "bfxil",
    category: "Data processing",
    syntax: "bfxil xd, xn, #lsb, #width",
    example: `mov     x0, -1                  // every bit set
movz    x1, 0xab00
bfxil   x0, x1, 8, 8            // x0 = 0xffffffffffffffab: only the low byte changed
ubfx    x2, x1, 8, 8            // x2 = 0xab: the same field, everything else zeroed`,
    gotchas: [
      "`bfxil` reads its destination. unlike `ubfx` it is a merge, so whatever was in xd outside the field is still there.",
    ],
  },
  {
    mnemonic: "ubfiz",
    category: "Data processing",
    syntax: "ubfiz xd, xn, #lsb, #width",
    example: `mov     x1, 2                   // field 0b10
ubfiz   x2, x1, 4, 2            // x2 = 0x20: two bits, placed at bit 4, zeros above`,
  },
  {
    mnemonic: "sbfiz",
    category: "Data processing",
    syntax: "sbfiz xd, xn, #lsb, #width",
    example: `mov     x1, 2                   // field 0b10, top bit set
sbfiz   x2, x1, 4, 2            // x2 = 0xffffffffffffffe0: the sign fills upward`,
    gotchas: [
      "the sign comes from the top bit of the field, not of the source register: `sbfiz x2, x1, 4, 2` on 2 sign-extends because bit 1 of 2 is set.",
    ],
  },

  // compare and test
  {
    mnemonic: "cmp",
    category: "Compare and test",
    syntax: "cmp xn, xm / cmp xn, #imm",
    example: `mov     w9, 3
cmp     w9, 5                   // flags say: less
cset    w10, lt                 // w10 = 1: cset writes 1 when lt holds`,
  },
  {
    mnemonic: "cmn",
    category: "Compare and test",
    syntax: "cmn xn, xm / cmn xn, #imm",
    example: `mov     w9, 1
neg     w9, w9                  // w9 = -1, the not-found sentinel
cmn     w9, 1                   // adds 1: the result is 0, z set
cset    w10, eq                 // w10 = 1: w9 was -1`,
  },
  {
    mnemonic: "tst",
    category: "Compare and test",
    syntax: "tst xn, xm / tst xn, #imm",
    example: `mov     w9, 6
tst     w9, 1                   // bit 0 clear, so z is set
cset    w10, eq                 // w10 = 1: 6 is even`,
  },
  {
    mnemonic: "ccmp",
    category: "Compare and test",
    syntax: "ccmp xn, xm, #nzcv, cond / ccmp xn, #imm5, #nzcv, cond",
    example: `mov     w0, 1
mov     w1, 2
cmp     w0, 1
ccmp    w1, 2, 0, eq            // the first test held, so compare again
cset    w2, eq                  // w2 = 1: a == 1 && b == 2, no branch taken`,
    gotchas: [
      "the untaken path writes the literal into nzcv, it does not leave the old flags. a literal with z set makes a later `cset eq` fire even though the operands differ.",
      "the immediate second operand is 0 to 31 unsigned, and #nzcv is 0 to 15.",
    ],
  },
  {
    mnemonic: "ccmn",
    category: "Compare and test",
    syntax: "ccmn xn, xm, #nzcv, cond / ccmn xn, #imm5, #nzcv, cond",
    example: `mov     w0, 7
mov     w1, -3
cmp     w0, 7
ccmn    w1, 3, 0, eq            // -3 + 3 = 0, so z is set
cset    w2, eq                  // w2 = 1`,
  },

  // conditional select
  {
    mnemonic: "csel",
    category: "Conditional select",
    syntax: "csel xd, xn, xm, cond",
    example: `mov     w9, 3
mov     w10, 7
cmp     w9, w10
csel    w11, w9, w10, lt        // the smaller, no branch: w11 = 3`,
  },
  {
    mnemonic: "csinc",
    category: "Conditional select",
    syntax: "csinc xd, xn, xm, cond",
    example: `mov     w9, 3
cmp     w9, 3
csinc   w10, w9, w9, ne         // ne is false: the else arm, w10 = w9 + 1 = 4`,
  },
  {
    mnemonic: "csinv",
    category: "Conditional select",
    syntax: "csinv xd, xn, xm, cond",
    example: `mov     w9, 3
cmp     w9, 3
csinv   w10, w9, w9, ne         // ne is false: the else arm, w10 = ~3`,
  },
  {
    mnemonic: "csneg",
    category: "Conditional select",
    syntax: "csneg xd, xn, xm, cond",
    example: `mov     w9, -8
cmp     w9, 0
csneg   w10, w9, w9, pl         // pl is false: w10 = -w9 = 8. abs(), no branch`,
  },
  {
    mnemonic: "cset",
    category: "Conditional select",
    syntax: "cset xd, cond",
    example: `mov     w9, 5
cmp     w9, 0
cset    w10, gt                 // w10 = 1: 5 is positive`,
  },

  {
    mnemonic: "csetm",
    category: "Conditional select",
    syntax: "csetm xd, cond",
    example: `mov     w1, 5
cmp     w1, 5
csetm   w4, eq                  // condition true:  w4 = 0xffffffff
cmp     w1, 4
csetm   w5, eq                  // condition false: w5 = 0`,
  },
  {
    mnemonic: "cinc",
    category: "Conditional select",
    syntax: "cinc xd, xn, cond",
    example: `mov     w1, 5
cmp     w1, 5
cinc    w2, w1, eq              // condition true:  w2 = 6
cmp     w1, 4
cinc    w3, w1, eq              // condition false: w3 = 5, not 6`,
    gotchas: [
      "the encoded condition is the inverse of the one you write, which is why `al` and `nv` are refused: neither has an invertible spelling.",
    ],
  },
  {
    mnemonic: "cinv",
    category: "Conditional select",
    syntax: "cinv xd, xn, cond",
    example: `mov     w1, 5
cmp     w1, 5
cinv    w4, w1, eq              // condition true:  w4 = 0xfffffffa
cmp     w1, 4
cinv    w5, w1, eq              // condition false: w5 = 5`,
  },
  {
    mnemonic: "cneg",
    category: "Conditional select",
    syntax: "cneg xd, xn, cond",
    example: `mov     x6, 7
mov     w1, 5
cmp     w1, 5
cneg    x7, x6, eq              // condition true:  x7 = -7
cmp     w1, 4
cneg    x8, x6, eq              // condition false: x8 = 7`,
  },
  // memory: examples carve an aligned scratch slot below sp and put it back,
  // so every one runs clean inside the playground's wrapped main.
  {
    mnemonic: "ldr",
    category: "Memory",
    syntax: "ldr xt, [xn] / [xn, #imm] / [xn, #imm]! / [xn], #imm / ldr qt, [xn] (and bt, ht, st, dt, in every addressing form)",
    example: `sub     sp, sp, 16              // scratch slot, kept 16-byte aligned
mov     x9, 42
str     x9, [sp, 8]
ldr     x10, [sp, 8]            // x10 = 42
add     sp, sp, 16
movi    v1.16b, #12
sub     sp, sp, #16
str     q1, [sp]
ldr     q3, [sp]                // q3 = 0x0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c
add     sp, sp, #16`,
    gotchas: [
      "the `=label` form loads the symbol's address; read the value it points at with a second load.",
    ],
    encoding: encLdrUoff,
    encodedAsm: "ldr x19, [x20, 16]",
  },
  {
    mnemonic: "str",
    category: "Memory",
    syntax: "str xt, [xn] / [xn, #imm] / [xn, #imm]! / [xn], #imm / str qt, [xn] (and bt, ht, st, dt, in every addressing form)",
    example: `sub     sp, sp, 16
mov     w9, 7
str     w9, [sp, 12]            // the register width picks the store size
ldr     w10, [sp, 12]           // read back: w10 = 7
add     sp, sp, 16
movi    v1.16b, #12
sub     sp, sp, #16
str     q1, [sp]
ldr     q3, [sp]                // every lane = 12
add     sp, sp, #16`,
    encoding: encStrUoff,
    encodedAsm: "str x19, [x20, 16]",
  },
  {
    mnemonic: "ldrb",
    category: "Memory",
    syntax: "ldrb wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0x141               // 321: more than one byte
strb    w9, [sp, 8]             // only the low byte lands
ldrb    w10, [sp, 8]            // w10 = 0x41 = 65
add     sp, sp, 16`,
  },
  {
    mnemonic: "strb",
    category: "Memory",
    syntax: "strb wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 65
strb    w9, [sp, 8]             // one byte to memory
ldrb    w10, [sp, 8]            // w10 = 65
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldrh",
    category: "Memory",
    syntax: "ldrh wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0xbeef
strh    w9, [sp, 8]
ldrh    w10, [sp, 8]            // w10 = 0xbeef, zero-extended
add     sp, sp, 16`,
  },
  {
    mnemonic: "strh",
    category: "Memory",
    syntax: "strh wt, [xn, #imm]",
    example: `sub     sp, sp, 16
mov     w9, 0x1234
strh    w9, [sp, 10]            // halfwords want 2-byte alignment
ldrh    w10, [sp, 10]           // w10 = 0x1234
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldp",
    category: "Memory",
    syntax: "ldp xt1, xt2, [xn, #imm] / ldp qt1, qt2, [xn, #imm] (and st, dt pairs)",
    example: `mov     x9, 7
mov     x10, 9
stp     x9, x10, [sp, -16]!
ldp     x11, x12, [sp], 16      // one instruction, two loads: 7 and 9
movi    v1.16b, #12
movi    v2.16b, #5
sub     sp, sp, #32
stp     q1, q2, [sp]
ldp     q3, q4, [sp]            // q3 = 0x0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c
add     sp, sp, #32`,
  },
  {
    mnemonic: "stp",
    category: "Memory",
    syntax: "stp xt1, xt2, [xn, #imm] / stp dt1, dt2, [xn, #imm] / stp qt1, qt2, [xn, #imm] (and st, dt pairs)",
    example: `mov     x9, 1
mov     x10, 2
stp     x9, x10, [sp, -16]!     // push the pair; sp drops 16 first
ldp     x11, x12, [sp], 16      // pop it back: x11 = 1, x12 = 2
movi    v1.16b, #12
movi    v2.16b, #5
sub     sp, sp, #32
stp     q1, q2, [sp]
ldp     q3, q4, [sp]            // every lane = 12
add     sp, sp, #32`,
    gotchas: [
      "d and s pairs work too: `stp d8, d9, [sp, -16]!` is how a prologue saves the callee-saved fp registers.",
    ],
  },
  {
    mnemonic: "ldrsb",
    category: "Memory",
    syntax: "ldrsb wt, [xn, #imm] / [xn, #imm]! / [xn], #imm",
    example: `sub     sp, sp, 16
mov     w9, 0x80                // as a signed byte: -128
strb    w9, [sp, 8]
ldrsb   w10, [sp, 8]            // w10 = -128: the sign came back
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldrsh",
    category: "Memory",
    syntax: "ldrsh wt, [xn, #imm] / [xn, #imm]! / [xn], #imm",
    example: `sub     sp, sp, 16
mov     w9, 0x8000              // as a signed halfword: -32768
strh    w9, [sp, 8]
ldrsh   w10, [sp, 8]            // w10 = -32768
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldrsw",
    category: "Memory",
    syntax: "ldrsw xt, [xn, #imm] / [xn, #imm]! / [xn], #imm",
    example: `sub     sp, sp, 16
mov     w9, 1
neg     w9, w9                  // -1 as an int
str     w9, [sp, 8]
ldrsw   x10, [sp, 8]            // x10 = -1 across all 64 bits
add     sp, sp, 16`,
    gotchas: [
      "post-index (`ldrsw x0, [x1], 4`) loads from the old base and then advances it; pre-index (`[x1, 4]!`) advances first. gcc walks int arrays with the post-index form.",
    ],
  },
  {
    mnemonic: "ldur",
    category: "Memory",
    syntax: "ldur bt/ht/st/dt/qt, [xn, #imm]",
    example: `fmov    d1, 2.0
sub     sp, sp, 16
stur    d1, [sp, 4]             // an offset the scaled form cannot encode
ldur    d3, [sp, 4]             // d3 = 2.0
add     sp, sp, 16`,
    gotchas: [
      "simd&fp targets only, and the immediate runs [-256, 255] unscaled.",
      "`ldr` picks this encoding itself for a negative or unaligned offset, so a course file rarely spells it.",
    ],
  },
  {
    mnemonic: "stur",
    category: "Memory",
    syntax: "stur bt/ht/st/dt/qt, [xn, #imm]",
    example: `fmov    d1, 2.0
sub     sp, sp, 16
stur    d1, [sp, 4]             // eight bytes at an unscaled offset
ldur    d3, [sp, 4]             // d3 = 2.0
add     sp, sp, 16`,
  },
  {
    mnemonic: "ldnp",
    category: "Memory",
    syntax: "ldnp st1, st2, [xn, #imm] / dt1, dt2 / qt1, qt2",
    example: `fmov    d1, 2.0
fmov    d2, 3.0
sub     sp, sp, 16
stnp    d1, d2, [sp]
ldnp    d3, d4, [sp]            // d3 = 2.0, d4 = 3.0
add     sp, sp, 16`,
    gotchas: [
      "a plain signed offset with no writeback: there is no `[xn, #imm]!` form.",
      "identical to `ldp` here; on hardware the difference is a cache hint, not a result.",
    ],
  },
  {
    mnemonic: "stnp",
    category: "Memory",
    syntax: "stnp st1, st2, [xn, #imm] / dt1, dt2 / qt1, qt2",
    example: `fmov    d1, 2.0
fmov    d2, 3.0
sub     sp, sp, 16
stnp    d1, d2, [sp]
ldnp    d3, d4, [sp]            // d3 = 2.0, d4 = 3.0
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
      "this lands on the 4 KiB page base, not the symbol; add the low 12 bits with `:lo12:` to reach the exact address.",
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
    example: `mov     w0, 7                   // the return value convention: w0
ret                             // back to the caller: exit code 7`,
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
    syntax: "fmov dd, dn / fmov dd, xn / fmov xd, dn / fmov dd, #imm / fmov vd.T, #imm / fmov vd.d[1], xn / fmov xd, vn.d[1]",
    example: `fmov    d16, 5.0                // one of the encodable immediates
fcvtzs  x9, d16                 // x9 = 5: the double, made visible
fmov    v3.4s, #2.0             // every lane = 2.0`,
    gotchas: [
      "the immediate is 8 bits of float: a power-of-two multiple of 1.0 through 1.9375. constants like 5.0 and 9.0 fit; 0.0 and most decimals do not, so load those from a `.double` in `.data`.",
      "the between-files forms (`fmov d0, x0`, `fmov x0, d0`, and the s/w pair) copy raw bits with no conversion: `fmov d0, x0` with x0 = 42 is not 42.0. convert with `scvtf`/`fcvtzs`.",
    ],
  },
  {
    mnemonic: "fadd",
    category: "Floating point",
    syntax: "fadd dd, dn, dm / fadd sd, sn, sm / fadd vd.T, vn.T, vm.T (2s, 4s, 2d)",
    example: `fmov    d16, 1.5
fmov    d17, 2.5
fadd    d18, d16, d17           // d18 = 4.0
fcvtzs  x9, d18                 // x9 = 4
fmov    v1.4s, #2.0
fmov    v2.4s, #3.0
fadd    v3.4s, v1.4s, v2.4s     // every lane = 5.0`,
  },
  {
    mnemonic: "fsub",
    category: "Floating point",
    syntax: "fsub dd, dn, dm / fsub sd, sn, sm / fsub vd.T, vn.T, vm.T (2s, 4s, 2d)",
    example: `fmov    d16, 5.0
fmov    d17, 1.5
fsub    d18, d16, d17           // d18 = 3.5
fcvtzs  x9, d18                 // x9 = 3: conversion truncates
fmov    v1.4s, #5.0
fmov    v2.4s, #3.0
fsub    v3.4s, v1.4s, v2.4s     // every lane = 2.0`,
  },
  {
    mnemonic: "fmul",
    category: "Floating point",
    syntax: "fmul dd, dn, dm / fmul sd, sn, sm / fmul vd.T, vn.T, vm.T / fmul vd.T, vn.T, vm.Ts[i]",
    example: `fmov    d16, 2.5
fmov    d17, 4.0
fmul    d18, d16, d17           // d18 = 10.0
fcvtzs  x9, d18                 // x9 = 10
fmov    v1.4s, #2.0
fmov    v2.4s, #3.0
fmul    v3.4s, v1.4s, v2.4s     // every lane = 6.0`,
  },
  {
    mnemonic: "fdiv",
    category: "Floating point",
    syntax: "fdiv dd, dn, dm / fdiv sd, sn, sm / fdiv vd.T, vn.T, vm.T (2s, 4s, 2d)",
    example: `fmov    d16, 9.0
fmov    d17, 2.0
fdiv    d18, d16, d17           // d18 = 4.5
fcvtzs  x9, d18                 // x9 = 4: the fraction is cut, not rounded
fmov    v1.4s, #6.0
fmov    v2.4s, #2.0
fdiv    v3.4s, v1.4s, v2.4s     // every lane = 3.0`,
  },
  {
    mnemonic: "fneg",
    category: "Floating point",
    syntax: "fneg dd, dn / fneg sd, sn / fneg vd.T, vn.T (2s, 4s, 2d)",
    example: `fmov    d16, 2.0
fneg    d16, d16                // d16 = -2.0: only the sign bit changes
fcvtzs  x9, d16                 // x9 = -2
fmov    v1.4s, #2.0
fneg    v3.4s, v1.4s            // every lane = -2.0`,
    gotchas: [
      "the alternating-sign series idiom: `fneg sign, sign` each pass flips a running +1/-1 factor without a branch.",
    ],
  },
  {
    mnemonic: "fabs",
    category: "Floating point",
    syntax: "fabs dd, dn / fabs sd, sn / fabs vd.T, vn.T (2s, 4s, 2d)",
    example: `fmov    d16, 3.0
fneg    d16, d16                // d16 = -3.0
fabs    d17, d16                // d17 = 3.0: distance from zero
fcvtzs  x9, d17                 // x9 = 3
fmov    v1.4s, #-2.0
fabs    v3.4s, v1.4s            // every lane = 2.0`,
    gotchas: [
      "the convergence-test idiom: take `fabs` of an error term before `fcmp` against the epsilon, so the loop exits on distance from zero, not direction.",
    ],
  },
  {
    mnemonic: "fsqrt",
    category: "Floating point",
    syntax: "fsqrt dd, dn / fsqrt sd, sn / fsqrt vd.T, vn.T (2s, 4s, 2d)",
    example: `fmov    d16, 9.0
fsqrt   d17, d16                // d17 = 3.0
fcvtzs  x9, d17                 // x9 = 3
fmov    v1.4s, #4.0
fsqrt   v3.4s, v1.4s            // every lane = 2.0`,
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
fcmp    d16, d17                // same nzcv flags as integer cmp
cset    w9, lt                  // w9 = 1: d16 is below d17`,
  },
  {
    mnemonic: "fcmpe",
    category: "Floating point",
    syntax: "fcmpe dn, dm / fcmpe sn, sm",
    example: `fmov    d16, 1.5
fmov    d17, 2.5
fcmpe   d16, d17                // gcc's spelling for float < and >
cset    w9, lt                  // w9 = 1`,
  },
  {
    mnemonic: "fcvt",
    category: "Floating point",
    syntax: "fcvt dd, sn / fcvt sd, dn",
    example: `fmov    s0, 2.5                 // a float, in the register's low 32 bits
fcvt    d1, s0                  // widen: d1 = 2.5 exactly
fcvtzs  x9, d1                  // x9 = 2`,
    gotchas: [
      "printf takes doubles, never floats: widen with `fcvt d0, s0` before `bl printf`, or the printed value is garbage.",
      "narrowing `fcvt s0, d0` rounds to the nearest float; wide doubles lose precision on the way down.",
    ],
  },
  {
    mnemonic: "scvtf",
    category: "Floating point",
    syntax: "scvtf dd, xn / scvtf dd, wn / scvtf sd, wn / scvtf dd, xn, #fbits / scvtf vd.T, vn.T{, #fbits} / scvtf sd, sn",
    example: `mov     x9, 7
scvtf   d16, x9                 // d16 = 7.0
fcvtzs  x10, d16                // x10 = 7: round-tripped
mov     x11, 6
scvtf   d17, x11, 2             // d17 = 1.5: the fixed-point form divides by 4
movi    v1.4s, #6
scvtf   v3.4s, v1.4s            // every lane = 6.0`,
  },
  {
    mnemonic: "fcvtzs",
    category: "Floating point",
    syntax: "fcvtzs xd, dn / fcvtzs wd, sn / fcvtzs xd, sn, #fbits / fcvtzs vd.T, vn.T{, #fbits} / fcvtzs sd, sn",
    example: `fmov    d16, 1.9375             // the largest encodable mantissa
fcvtzs  w9, d16                 // w9 = 1: toward zero, never rounding
fmov    d17, 1.5
fcvtzs  w10, d17, 2             // w10 = 6: the fixed-point form scales by 4 first
fmov    v1.4s, #2.5
fcvtzs  v3.4s, v1.4s            // every lane = 2`,
    gotchas: [
      "`fbits` runs 1 to 32 for a w destination and 1 to 64 for an x one; it is stored in the word as 64 minus that.",
    ],
  },
  {
    mnemonic: "fcvtns",
    category: "Floating point",
    syntax: "fcvtns wd, dn / fcvtns xd, sn / fcvtns vd.T, vn.T / fcvtns sd, sn",
    example: `fmov    d0, 2.5
fcvtns  w1, d0                  // w1 = 2: the tie goes to the even neighbor
fcvtzs  w2, d0                  // w2 = 2 as well, but by truncation
fmov    d3, 3.5
fcvtns  w4, d3                  // w4 = 4: ties to even lands upward here
fmov    v1.4s, #2.5
fcvtns  v3.4s, v1.4s            // every lane = 2`,
  },
  {
    mnemonic: "fcvtnu",
    category: "Floating point",
    syntax: "fcvtnu wd, dn / fcvtnu xd, sn / fcvtnu vd.T, vn.T / fcvtnu sd, sn",
    example: `fmov    d0, 2.5
fcvtnu  w1, d0                  // w1 = 2
fmov    d2, -2.5
fcvtnu  w3, d2                  // w3 = 0: negatives saturate
fmov    v1.4s, #2.5
fcvtnu  v3.4s, v1.4s            // every lane = 2`,
  },
  {
    mnemonic: "fcvtzu",
    category: "Floating point",
    syntax: "fcvtzu wd, dn / fcvtzu xd, sn / fcvtzu vd.T, vn.T{, #fbits} / fcvtzu sd, sn",
    example: `fmov    d0, 2.5
fcvtzu  w1, d0                  // w1 = 2: the fraction is cut, not rounded
fmov    d2, -1.5
fcvtzu  w3, d2                  // w3 = 0: negatives saturate
fmov    v1.4s, #2.5
fcvtzu  v3.4s, v1.4s            // every lane = 2`,
  },
  {
    mnemonic: "fcvtas",
    category: "Floating point",
    syntax: "fcvtas wd, dn / fcvtas xd, sn / fcvtas vd.T, vn.T / fcvtas sd, sn",
    example: `fmov    d0, 2.5
fcvtas  w1, d0                  // w1 = 3: the tie goes away from zero
fcvtns  w2, d0                  // w2 = 2: the tie goes to the even neighbour
fmov    d3, -2.5
fcvtas  w4, d3                  // w4 = -3: away from zero in both directions
fmov    v1.4s, #2.5
fcvtas  v3.4s, v1.4s            // every lane = 3`,
  },
  {
    mnemonic: "fcvtau",
    category: "Floating point",
    syntax: "fcvtau wd, dn / fcvtau xd, sn / fcvtau vd.T, vn.T / fcvtau sd, sn",
    example: `fmov    d0, 2.5
fcvtau  w1, d0                  // w1 = 3
fmov    v1.4s, #2.5
fcvtau  v3.4s, v1.4s            // every lane = 3`,
  },
  {
    mnemonic: "fcvtms",
    category: "Floating point",
    syntax: "fcvtms wd, dn / fcvtms xd, sn / fcvtms vd.T, vn.T / fcvtms sd, sn",
    example: `fmov    d0, -0.5
fcvtms  w1, d0                  // w1 = -1: floor, so it walks away from zero
fcvtzs  w2, d0                  // w2 = 0: truncation walks toward it
fmov    v1.4s, #2.5
fcvtms  v3.4s, v1.4s            // every lane = 2`,
  },
  {
    mnemonic: "fcvtmu",
    category: "Floating point",
    syntax: "fcvtmu wd, dn / fcvtmu xd, sn / fcvtmu vd.T, vn.T / fcvtmu sd, sn",
    example: `fmov    d0, 2.5
fcvtmu  w1, d0                  // w1 = 2
fmov    v1.4s, #2.5
fcvtmu  v3.4s, v1.4s            // every lane = 2`,
  },
  {
    mnemonic: "fcvtps",
    category: "Floating point",
    syntax: "fcvtps wd, dn / fcvtps xd, sn / fcvtps vd.T, vn.T / fcvtps sd, sn",
    example: `fmov    d0, -0.5
fcvtps  w1, d0                  // w1 = 0: ceiling
fmov    d2, 2.5
fcvtps  w3, d2                  // w3 = 3
fmov    v1.4s, #2.5
fcvtps  v3.4s, v1.4s            // every lane = 3`,
  },
  {
    mnemonic: "fcvtpu",
    category: "Floating point",
    syntax: "fcvtpu wd, dn / fcvtpu xd, sn / fcvtpu vd.T, vn.T / fcvtpu sd, sn",
    example: `fmov    d0, 2.5
fcvtpu  w1, d0                  // w1 = 3
fmov    v1.4s, #2.5
fcvtpu  v3.4s, v1.4s            // every lane = 3`,
  },
  {
    mnemonic: "ucvtf",
    category: "Floating point",
    syntax: "ucvtf dd, xn / ucvtf sd, wn / ucvtf vd.T, vn.T{, #fbits} / ucvtf sd, sn",
    example: `mov     x0, -1
scvtf   d0, x0                  // d0 = -1.0
ucvtf   d1, x0                  // d1 = 1.8446744073709552e19: the same bits, read unsigned
movi    v1.4s, #6
ucvtf   v3.4s, v1.4s            // every lane = 6.0`,
  },
  {
    mnemonic: "fcsel",
    category: "Floating point",
    syntax: "fcsel dd, dn, dm, cond / fcsel sd, sn, sm, cond",
    example: `fmov    d1, 1.5
fmov    d2, 2.5
mov     w0, 5
cmp     w0, 5
fcsel   d3, d1, d2, eq          // d3 = 1.5: the condition held
cmp     w0, 4
fcsel   d4, d1, d2, eq          // d4 = 2.5: it did not
fcvtzs  x9, d3                  // x9 = 1`,
    gotchas: [
      "the flags come from an earlier `fcmp` or `cmp`. `fcsel` reads nzcv and never writes it.",
    ],
  },
  {
    mnemonic: "fmax",
    category: "Floating point",
    syntax: "fmax dd, dn, dm / fmax sd, sn, sm / fmax vd.T, vn.T, vm.T (2s, 4s, 2d)",
    example: `fmov    d1, 3.0
fmov    d2, 5.0
fmax    d3, d1, d2              // d3 = 5.0
fcvtzs  x9, d3                  // x9 = 5
fmov    v1.4s, #2.0
fmov    v2.4s, #3.0
fmax    v3.4s, v1.4s, v2.4s     // every lane = 3.0`,
    gotchas: [
      "a nan operand makes the result nan. for the c `fmax()` behaviour, where the number wins, use `fmaxnm`.",
    ],
  },
  {
    mnemonic: "fmin",
    category: "Floating point",
    syntax: "fmin dd, dn, dm / fmin sd, sn, sm / fmin vd.T, vn.T, vm.T (2s, 4s, 2d)",
    example: `fmov    d1, 3.0
fmov    d2, 5.0
fmin    d4, d1, d2              // d4 = 3.0
fcvtzs  x9, d4                  // x9 = 3
fmov    v1.4s, #2.0
fmov    v2.4s, #3.0
fmin    v3.4s, v1.4s, v2.4s     // every lane = 2.0`,
  },
  {
    mnemonic: "fmaxnm",
    category: "Floating point",
    syntax: "fmaxnm dd, dn, dm / fmaxnm sd, sn, sm / fmaxnm vd.T, vn.T, vm.T (2s, 4s, 2d)",
    example: `fmov    d1, 4.0
fneg    d1, d1
fsqrt   d1, d1                  // d1 = nan
fmov    d2, 5.0
fmaxnm  d3, d1, d2              // d3 = 5.0: the nan is ignored
fmax    d4, d1, d2              // d4 = nan
fcvtzs  x9, d3                  // x9 = 5
fmov    v1.4s, #2.0
fmov    v2.4s, #3.0
fmaxnm  v3.4s, v1.4s, v2.4s     // every lane = 3.0`,
  },
  {
    mnemonic: "fminnm",
    category: "Floating point",
    syntax: "fminnm dd, dn, dm / fminnm sd, sn, sm / fminnm vd.T, vn.T, vm.T (2s, 4s, 2d)",
    example: `fmov    d1, 3.0
fmov    d2, 5.0
fminnm  d3, d1, d2              // d3 = 3.0
fcvtzs  x9, d3                  // x9 = 3
fmov    v1.4s, #2.0
fmov    v2.4s, #3.0
fminnm  v3.4s, v1.4s, v2.4s     // every lane = 2.0`,
  },
  {
    mnemonic: "fnmul",
    category: "Floating point",
    syntax: "fnmul dd, dn, dm / fnmul sd, sn, sm",
    example: `fmov    d1, 2.0
fmov    d2, 3.0
fnmul   d3, d1, d2              // d3 = -6.0`,
  },
  {
    mnemonic: "fmadd",
    category: "Floating point",
    syntax: "fmadd dd, dn, dm, da",
    example: `fmov    d1, 3.0
fmov    d2, 4.0
fmov    d3, 10.0
fmadd   d4, d1, d2, d3          // d4 = 22.0: d3 + d1*d2, not d1 + d2*d3`,
    gotchas: [
      "the accumulator is the last operand, and it is the addend. reading it as the first product source gives 43 instead of 22.",
      "fused: the product is not rounded before the add, so `fmadd` and `fmul` plus `fadd` can differ in the last bit.",
    ],
  },
  {
    mnemonic: "fmsub",
    category: "Floating point",
    syntax: "fmsub dd, dn, dm, da",
    example: `fmov    d1, 3.0
fmov    d2, 4.0
fmov    d3, 10.0
fmsub   d5, d1, d2, d3          // d5 = -2.0: d3 - d1*d2, not d1*d2 - d3`,
  },
  {
    mnemonic: "fnmadd",
    category: "Floating point",
    syntax: "fnmadd dd, dn, dm, da",
    example: `fmov    d1, 3.0
fmov    d2, 4.0
fmov    d3, 10.0
fnmadd  d6, d1, d2, d3          // d6 = -22.0`,
  },
  {
    mnemonic: "fnmsub",
    category: "Floating point",
    syntax: "fnmsub dd, dn, dm, da",
    example: `fmov    d1, 3.0
fmov    d2, 4.0
fmov    d3, 10.0
fnmsub  d7, d1, d2, d3          // d7 = 2.0`,
  },
  // moves and immediates
  {
    mnemonic: "movi",
    category: "Vector",
    syntax: "movi vd.T, #imm8{, lsl #amount} / movi vd.2s, #imm8, msl #amount / movi vd.2d, #imm64 / movi dd, #imm64",
    example: `movi    v3.16b, #0x55           // every lane = 0x55`,
    gotchas: [
      "`imm8` is 0-255; `LSL` takes 0, 8, 16 or 24 for an `S` arrangement and 0 or 8 for an `H` one. `MSL` (8 or 16) shifts ones in below the byte. The `2D` and `Dd` forms take a 64-bit immediate whose every byte is `0x00` or `0xff`, which is what makes `movi d31, #0` the way gcc zeroes a double.",
    ],
  },
  {
    mnemonic: "mvni",
    category: "Vector",
    syntax: "mvni vd.T, #imm8{, lsl #amount} / mvni vd.2s, #imm8, msl #amount",
    example: `mvni    v3.4h, #0x55            // every lane = 0xffaa`,
  },
  {
    mnemonic: "dup",
    category: "Vector",
    syntax: "dup vd.T, wn / dup vd.2d, xn / dup vd.T, vn.Ts[i] / dup bd, vn.b[i]",
    example: `mov     w7, #12
dup     v3.8b, w7               // every lane = 12`,
    gotchas: [
      "the scalar destination (`dup b3, v7.b[15]`, printed `mov`) copies the one lane and zeroes everything above it.",
    ],
  },
  {
    mnemonic: "ins",
    category: "Vector",
    syntax: "ins vd.Ts[i], wn / ins vd.d[i], xn / ins vd.Ts[i], vn.Ts[j]",
    example: `movi    v3.16b, #17
mov     w7, #34
ins     v3.b[15], w7            // v3.b[15] = 0x22`,
  },
  {
    mnemonic: "umov",
    category: "Vector",
    syntax: "umov wd, vn.Ts[i] (b, h or s) / umov xd, vn.d[i]",
    example: `movi    v7.16b, #12
umov    w3, v7.b[15]            // w3 = 12: the byte zero-extended into the whole register`,
    gotchas: [
      "at the destination's own width GAS prints it `mov`.",
    ],
  },
  {
    mnemonic: "smov",
    category: "Vector",
    syntax: "smov wd, vn.Ts[i] (b or h) / smov xd, vn.Ts[i] (b, h or s)",
    example: `movi    v7.16b, #244
smov    w3, v7.b[15]            // w3 = -12: the byte sign-extended into the whole register`,
  },
  // three-same
  {
    mnemonic: "mla",
    category: "Vector",
    syntax: "mla vd.T, vn.T, vm.T / mla vd.4h, vn.4h, vm.h[index] (and 8h, 2s/4s with vm.s[index])",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
mla     v3.8b, v7.8b, v21.8b    // every lane = 0x16`,
  },
  {
    mnemonic: "mls",
    category: "Vector",
    syntax: "mls vd.T, vn.T, vm.T / mls vd.4h, vn.4h, vm.h[index] (and 8h, 2s/4s with vm.s[index])",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
mls     v3.8b, v7.8b, v21.8b    // every lane = 2`,
  },
  {
    mnemonic: "pmul",
    category: "Vector",
    syntax: "pmul vd.T, vn.T, vm.T (8b / 16b)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
pmul    v3.8b, v7.8b, v21.8b    // every lane = 0x3c`,
  },
  {
    mnemonic: "bsl",
    category: "Vector",
    syntax: "bsl vd.T, vn.T, vm.T",
    example: `movi    v3.16b, #240
movi    v7.16b, #17
movi    v21.16b, #34
bsl     v3.8b, v7.8b, v21.8b    // every lane = 0x12: the destination chose bit by bit between v7 and v21`,
  },
  {
    mnemonic: "bit",
    category: "Vector",
    syntax: "bit vd.T, vn.T, vm.T",
    example: `movi    v3.16b, #0
movi    v7.16b, #17
movi    v21.16b, #240
bit     v3.8b, v7.8b, v21.8b    // every lane = 0x10: v21's set bits took v7's`,
  },
  {
    mnemonic: "bif",
    category: "Vector",
    syntax: "bif vd.T, vn.T, vm.T",
    example: `movi    v3.16b, #0
movi    v7.16b, #17
movi    v21.16b, #240
bif     v3.8b, v7.8b, v21.8b    // every lane = 1: v21's clear bits took v7's`,
  },
  {
    mnemonic: "not",
    category: "Vector",
    syntax: "not vd.T, vn.T (8b / 16b)",
    example: `movi    v7.16b, #12
not     v3.8b, v7.8b            // every lane = 0xf3`,
  },
  // compares
  {
    mnemonic: "cmeq",
    category: "Vector",
    syntax: "cmeq vd.T, vn.T, vm.T / cmeq vd.T, vn.T, #0 / cmeq dd, dn, dm / cmeq dd, dn, #0",
    example: `movi    v7.16b, #12
movi    v21.16b, #12
cmeq    v3.8b, v7.8b, v21.8b    // every lane = all ones: a lane that holds equals a lane that holds`,
    gotchas: [
      "every compare here takes the `2D` arrangement and the `D` scalar as well as the narrower lanes.",
    ],
  },
  {
    mnemonic: "cmgt",
    category: "Vector",
    syntax: "cmgt vd.T, vn.T, vm.T / cmgt vd.T, vn.T, #0 / cmgt dd, dn, dm / cmgt dd, dn, #0",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
cmgt    v3.8b, v7.8b, v21.8b    // every lane = all ones`,
  },
  {
    mnemonic: "cmge",
    category: "Vector",
    syntax: "cmge vd.T, vn.T, vm.T / cmge vd.T, vn.T, #0 / cmge dd, dn, dm / cmge dd, dn, #0",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
cmge    v3.8b, v7.8b, v21.8b    // every lane = all ones`,
  },
  {
    mnemonic: "cmhi",
    category: "Vector",
    syntax: "cmhi vd.T, vn.T, vm.T / cmhi dd, dn, dm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
cmhi    v3.8b, v7.8b, v21.8b    // every lane = all ones`,
    gotchas: [
      "the `S`/`U` pair to watch: `CMGT` and `CMHI` differ only in how the lane is read.",
    ],
  },
  {
    mnemonic: "cmhs",
    category: "Vector",
    syntax: "cmhs vd.T, vn.T, vm.T / cmhs dd, dn, dm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
cmhs    v3.8b, v7.8b, v21.8b    // every lane = all ones`,
  },
  {
    mnemonic: "cmle",
    category: "Vector",
    syntax: "cmle vd.T, vn.T, #0 / cmle dd, dn, #0",
    example: `movi    v7.16b, #244
cmle    v3.8b, v7.8b, #0        // every lane = all ones: -12 is at or below zero`,
    gotchas: [
      "there is no register form: swap the operands and use `CMGE`.",
    ],
  },
  {
    mnemonic: "cmlt",
    category: "Vector",
    syntax: "cmlt vd.T, vn.T, #0 / cmlt dd, dn, #0",
    example: `movi    v7.16b, #244
cmlt    v3.8b, v7.8b, #0        // every lane = all ones: -12 is below zero`,
  },
  {
    mnemonic: "cmtst",
    category: "Vector",
    syntax: "cmtst vd.T, vn.T, vm.T / cmtst dd, dn, dm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
cmtst   v3.8b, v7.8b, v21.8b    // every lane = all ones`,
  },
  // saturating and halving
  {
    mnemonic: "sqadd",
    category: "Vector",
    syntax: "sqadd vd.T, vn.T, vm.T / sqadd bd, bn, bm (and h, s, d)",
    example: `movi    v7.16b, #112
movi    v21.16b, #112
sqadd   v3.8b, v7.8b, v21.8b    // every lane = 0x7f: 0x70 + 0x70 clamps at the signed byte top`,
  },
  {
    mnemonic: "uqadd",
    category: "Vector",
    syntax: "uqadd vd.T, vn.T, vm.T / uqadd bd, bn, bm (and h, s, d)",
    example: `movi    v7.16b, #240
movi    v21.16b, #48
uqadd   v3.8b, v7.8b, v21.8b    // every lane = all ones: 0xf0 + 0x30 clamps at 0xff`,
  },
  {
    mnemonic: "sqsub",
    category: "Vector",
    syntax: "sqsub vd.T, vn.T, vm.T / sqsub bd, bn, bm (and h, s, d)",
    example: `movi    v7.16b, #144
movi    v21.16b, #112
sqsub   v3.8b, v7.8b, v21.8b    // every lane = 0x80: 0x90 - 0x70 clamps at the signed byte floor`,
  },
  {
    mnemonic: "uqsub",
    category: "Vector",
    syntax: "uqsub vd.T, vn.T, vm.T / uqsub bd, bn, bm (and h, s, d)",
    example: `movi    v7.16b, #5
movi    v21.16b, #12
uqsub   v3.8b, v7.8b, v21.8b    // every lane = 0: an unsigned result below zero clamps there`,
  },
  {
    mnemonic: "suqadd",
    category: "Vector",
    syntax: "suqadd vd.T, vn.T / suqadd bd, bn (and h, s, d)",
    example: `movi    v3.16b, #112
movi    v7.16b, #112
suqadd  v3.8b, v7.8b            // every lane = 0x7f: the unsigned source saturates into the signed destination`,
    gotchas: [
      "two operands, three inputs: the destination is read.",
    ],
  },
  {
    mnemonic: "usqadd",
    category: "Vector",
    syntax: "usqadd vd.T, vn.T / usqadd bd, bn (and h, s, d)",
    example: `movi    v3.16b, #16
movi    v7.16b, #240
usqadd  v3.8b, v7.8b            // every lane = 0: the negative source clamps the unsigned destination at zero`,
  },
  {
    mnemonic: "sqabs",
    category: "Vector",
    syntax: "sqabs vd.T, vn.T / sqabs bd, bn (and h, s, d)",
    example: `movi    v7.16b, #128
sqabs   v3.8b, v7.8b            // every lane = 0x7f: -128 has no positive twin, so it clamps at 127`,
  },
  {
    mnemonic: "sqneg",
    category: "Vector",
    syntax: "sqneg vd.T, vn.T / sqneg bd, bn (and h, s, d)",
    example: `movi    v7.16b, #128
sqneg   v3.8b, v7.8b            // every lane = 0x7f: the same edge, negated`,
  },
  {
    mnemonic: "shadd",
    category: "Vector",
    syntax: "shadd vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
shadd   v3.8b, v7.8b, v21.8b    // every lane = 8: (12 + 5) >> 1, computed in nine bits`,
  },
  {
    mnemonic: "uhadd",
    category: "Vector",
    syntax: "uhadd vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uhadd   v3.8b, v7.8b, v21.8b    // every lane = 8`,
  },
  {
    mnemonic: "srhadd",
    category: "Vector",
    syntax: "srhadd vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
srhadd  v3.8b, v7.8b, v21.8b    // every lane = 9: 1 added before the shift rounds 8.5 up`,
  },
  {
    mnemonic: "urhadd",
    category: "Vector",
    syntax: "urhadd vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
urhadd  v3.8b, v7.8b, v21.8b    // every lane = 9`,
  },
  {
    mnemonic: "shsub",
    category: "Vector",
    syntax: "shsub vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
shsub   v3.8b, v7.8b, v21.8b    // every lane = 3`,
  },
  {
    mnemonic: "uhsub",
    category: "Vector",
    syntax: "uhsub vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uhsub   v3.8b, v7.8b, v21.8b    // every lane = 3`,
  },
  {
    mnemonic: "sqdmulh",
    category: "Vector",
    syntax: "sqdmulh vd.T, vn.T, vm.T (h, s lanes) / sqdmulh hd, hn, hm / sqdmulh sd, sn, sm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sqdmulh v3.4h, v7.4h, v21.4h    // every lane = 0x0078`,
    gotchas: [
      "the one input pair that saturates is the two minimum values, where `0x8000 * 0x8000` doubled lands one past the top and gives `0x7fff`.",
    ],
  },
  {
    mnemonic: "sqrdmulh",
    category: "Vector",
    syntax: "sqrdmulh vd.T, vn.T, vm.T (h, s lanes) / sqrdmulh hd, hn, hm / sqrdmulh sd, sn, sm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sqrdmulh v3.4h, v7.4h, v21.4h   // every lane = 0x0079`,
  },
  // max, min and across lanes
  {
    mnemonic: "smax",
    category: "Vector",
    syntax: "smax vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
smax    v3.8b, v7.8b, v21.8b    // every lane = 12`,
  },
  {
    mnemonic: "smin",
    category: "Vector",
    syntax: "smin vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
smin    v3.8b, v7.8b, v21.8b    // every lane = 5`,
  },
  {
    mnemonic: "umax",
    category: "Vector",
    syntax: "umax vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
umax    v3.8b, v7.8b, v21.8b    // every lane = 12`,
  },
  {
    mnemonic: "umin",
    category: "Vector",
    syntax: "umin vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
umin    v3.8b, v7.8b, v21.8b    // every lane = 5`,
  },
  {
    mnemonic: "smaxp",
    category: "Vector",
    syntax: "smaxp vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
smaxp   v3.8b, v7.8b, v21.8b    // v3 = 12 in the lower half, 5 in the upper`,
  },
  {
    mnemonic: "sminp",
    category: "Vector",
    syntax: "sminp vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sminp   v3.8b, v7.8b, v21.8b    // v3 = 12 in the lower half, 5 in the upper`,
  },
  {
    mnemonic: "umaxp",
    category: "Vector",
    syntax: "umaxp vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
umaxp   v3.8b, v7.8b, v21.8b    // v3 = 12 in the lower half, 5 in the upper`,
  },
  {
    mnemonic: "uminp",
    category: "Vector",
    syntax: "uminp vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uminp   v3.8b, v7.8b, v21.8b    // v3 = 12 in the lower half, 5 in the upper`,
  },
  {
    mnemonic: "addp",
    category: "Vector",
    syntax: "addp vd.T, vn.T, vm.T / addp dd, vn.2d",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
addp    v3.8b, v7.8b, v21.8b    // v3 = 0x18 in the lower half, 10 in the upper`,
    gotchas: [
      "the scalar form folds the two `D` lanes of one register into a `D` register.",
    ],
  },
  {
    mnemonic: "addv",
    category: "Vector",
    syntax: "addv bd, vn.8b / addv bd, vn.16b / addv hd, vn.4h / addv hd, vn.8h / addv sd, vn.4s",
    example: `movi    v7.16b, #12
addv    b3, v7.8b               // b3 = 0x60`,
    gotchas: [
      "`2S` is not accepted: the widest lane only comes in the 128-bit arrangement.",
    ],
  },
  {
    mnemonic: "saddlv",
    category: "Vector",
    syntax: "saddlv hd, vn.8b / saddlv sd, vn.4h / saddlv dd, vn.4s (and the 16b/8h forms)",
    example: `movi    v7.16b, #12
saddlv  h3, v7.8b               // h3 = 0x0060`,
  },
  {
    mnemonic: "uaddlv",
    category: "Vector",
    syntax: "uaddlv hd, vn.8b / uaddlv sd, vn.4h / uaddlv dd, vn.4s (and the 16b/8h forms)",
    example: `movi    v7.16b, #12
uaddlv  h3, v7.8b               // h3 = 0x0060`,
  },
  {
    mnemonic: "smaxv",
    category: "Vector",
    syntax: "smaxv bd, vn.8b (and the 16b, 4h, 8h, 4s forms)",
    example: `movi    v7.16b, #12
mov     w0, #5
ins     v7.b[0], w0
smaxv   b3, v7.8b               // b3 = 12`,
  },
  {
    mnemonic: "sminv",
    category: "Vector",
    syntax: "sminv bd, vn.8b (and the 16b, 4h, 8h, 4s forms)",
    example: `movi    v7.16b, #12
mov     w0, #5
ins     v7.b[0], w0
sminv   b3, v7.8b               // b3 = 5`,
  },
  {
    mnemonic: "umaxv",
    category: "Vector",
    syntax: "umaxv bd, vn.8b (and the 16b, 4h, 8h, 4s forms)",
    example: `movi    v7.16b, #12
mov     w0, #5
ins     v7.b[0], w0
umaxv   b3, v7.8b               // b3 = 12`,
  },
  {
    mnemonic: "uminv",
    category: "Vector",
    syntax: "uminv bd, vn.8b (and the 16b, 4h, 8h, 4s forms)",
    example: `movi    v7.16b, #12
mov     w0, #5
ins     v7.b[0], w0
uminv   b3, v7.8b               // b3 = 5`,
  },
  {
    mnemonic: "saddlp",
    category: "Vector",
    syntax: "saddlp vd.4h, vn.8b / vd.8h, vn.16b / vd.2s, vn.4h / vd.4s, vn.8h / vd.1d, vn.2s / vd.2d, vn.4s",
    example: `movi    v7.16b, #12
saddlp  v3.4h, v7.8b            // every lane = 0x0018`,
  },
  {
    mnemonic: "uaddlp",
    category: "Vector",
    syntax: "uaddlp vd.4h, vn.8b / vd.8h, vn.16b / vd.2s, vn.4h / vd.4s, vn.8h / vd.1d, vn.2s / vd.2d, vn.4s",
    example: `movi    v7.16b, #12
uaddlp  v3.4h, v7.8b            // every lane = 0x0018`,
  },
  {
    mnemonic: "sadalp",
    category: "Vector",
    syntax: "sadalp vd.4h, vn.8b / vd.8h, vn.16b / vd.2s, vn.4h / vd.4s, vn.8h / vd.1d, vn.2s / vd.2d, vn.4s",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
sadalp  v3.4h, v7.8b            // every lane = 0x0c16`,
  },
  {
    mnemonic: "uadalp",
    category: "Vector",
    syntax: "uadalp vd.4h, vn.8b / vd.8h, vn.16b / vd.2s, vn.4h / vd.4s, vn.8h / vd.1d, vn.2s / vd.2d, vn.4s",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
uadalp  v3.4h, v7.8b            // every lane = 0x0c16`,
  },
  // absolute differences
  {
    mnemonic: "sabd",
    category: "Vector",
    syntax: "sabd vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sabd    v3.8b, v7.8b, v21.8b    // every lane = 7`,
  },
  {
    mnemonic: "uabd",
    category: "Vector",
    syntax: "uabd vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uabd    v3.8b, v7.8b, v21.8b    // every lane = 7`,
  },
  {
    mnemonic: "saba",
    category: "Vector",
    syntax: "saba vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
saba    v3.8b, v7.8b, v21.8b    // every lane = 15`,
  },
  {
    mnemonic: "uaba",
    category: "Vector",
    syntax: "uaba vd.T, vn.T, vm.T (b, h, s lanes)",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
uaba    v3.8b, v7.8b, v21.8b    // every lane = 15`,
  },
  // two-register misc
  {
    mnemonic: "abs",
    category: "Vector",
    syntax: "abs vd.T, vn.T / abs dd, dn",
    example: `movi    v7.16b, #244
abs     v3.8b, v7.8b            // every lane = 12`,
  },
  {
    mnemonic: "cnt",
    category: "Vector",
    syntax: "cnt vd.T, vn.T (8b / 16b)",
    example: `movi    v7.16b, #12
cnt     v3.8b, v7.8b            // every lane = 2`,
  },
  {
    mnemonic: "rev64",
    category: "Vector",
    syntax: "rev64 vd.T, vn.T (b, h, s lanes)",
    example: `movi    v7.4s, #12
rev64   v3.8b, v7.8b            // v3 = 0 0 0 12 0 0 0 12`,
    gotchas: [
      "the lane has to be narrower than the container, which is why each of the three takes a different set.",
    ],
  },
  {
    mnemonic: "urecpe",
    category: "Vector",
    syntax: "urecpe vd.T, vn.T (2s / 4s)",
    example: `movi    v7.4s, #0x80, lsl #24
urecpe  v3.2s, v7.2s            // every lane = 0xff800000: the estimate for 0.5 read from the table`,
    gotchas: [
      "an operand below 0.5 (top bit clear) has no representable reciprocal and answers all ones.",
    ],
  },
  {
    mnemonic: "ursqrte",
    category: "Vector",
    syntax: "ursqrte vd.T, vn.T (2s / 4s)",
    example: `movi    v7.4s, #0x80, lsl #24
ursqrte v3.2s, v7.2s            // every lane = 0xb4800000: the reciprocal-square-root estimate for 0.5`,
  },
  // widening, narrowing and doubling
  {
    mnemonic: "saddl",
    category: "Vector",
    syntax: "saddl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
saddl   v3.8h, v7.8b, v21.8b    // every lane = 0x0011`,
  },
  {
    mnemonic: "saddl2",
    category: "Vector",
    syntax: "saddl2 vd.8h, vn.16b, vm.16b (and 4s/8h, 2d/4s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
saddl2  v3.8h, v7.16b, v21.16b  // every lane = 0x0011`,
    gotchas: [
      "every `2` form in this table is its base form reading those lanes instead of the low ones.",
    ],
  },
  {
    mnemonic: "uaddl",
    category: "Vector",
    syntax: "uaddl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uaddl   v3.8h, v7.8b, v21.8b    // every lane = 0x0011`,
  },
  {
    mnemonic: "uaddl2",
    category: "Vector",
    syntax: "uaddl2 vd.8h, vn.16b, vm.16b (and 4s/8h, 2d/4s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uaddl2  v3.8h, v7.16b, v21.16b  // every lane = 0x0011`,
  },
  {
    mnemonic: "ssubl",
    category: "Vector",
    syntax: "ssubl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
ssubl   v3.8h, v7.8b, v21.8b    // every lane = 7`,
  },
  {
    mnemonic: "ssubl2",
    category: "Vector",
    syntax: "ssubl2 vd.8h, vn.16b, vm.16b (and 4s/8h, 2d/4s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
ssubl2  v3.8h, v7.16b, v21.16b  // every lane = 7`,
  },
  {
    mnemonic: "usubl",
    category: "Vector",
    syntax: "usubl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
usubl   v3.8h, v7.8b, v21.8b    // every lane = 7`,
  },
  {
    mnemonic: "usubl2",
    category: "Vector",
    syntax: "usubl2 vd.8h, vn.16b, vm.16b (and 4s/8h, 2d/4s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
usubl2  v3.8h, v7.16b, v21.16b  // every lane = 7`,
  },
  {
    mnemonic: "saddw",
    category: "Vector",
    syntax: "saddw vd.8h, vn.8h, vm.8b (and 4s/4s/4h, 2d/2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
saddw   v3.8h, v7.8h, v21.8b    // every lane = 0x0c11`,
  },
  {
    mnemonic: "saddw2",
    category: "Vector",
    syntax: "saddw2 vd.8h, vn.8h, vm.16b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
saddw2  v3.8h, v7.8h, v21.16b   // every lane = 0x0c11`,
  },
  {
    mnemonic: "uaddw",
    category: "Vector",
    syntax: "uaddw vd.8h, vn.8h, vm.8b (and 4s/4s/4h, 2d/2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uaddw   v3.8h, v7.8h, v21.8b    // every lane = 0x0c11`,
  },
  {
    mnemonic: "uaddw2",
    category: "Vector",
    syntax: "uaddw2 vd.8h, vn.8h, vm.16b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uaddw2  v3.8h, v7.8h, v21.16b   // every lane = 0x0c11`,
  },
  {
    mnemonic: "ssubw",
    category: "Vector",
    syntax: "ssubw vd.8h, vn.8h, vm.8b (and 4s/4s/4h, 2d/2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
ssubw   v3.8h, v7.8h, v21.8b    // every lane = 0x0c07`,
  },
  {
    mnemonic: "ssubw2",
    category: "Vector",
    syntax: "ssubw2 vd.8h, vn.8h, vm.16b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
ssubw2  v3.8h, v7.8h, v21.16b   // every lane = 0x0c07`,
  },
  {
    mnemonic: "usubw",
    category: "Vector",
    syntax: "usubw vd.8h, vn.8h, vm.8b (and 4s/4s/4h, 2d/2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
usubw   v3.8h, v7.8h, v21.8b    // every lane = 0x0c07`,
  },
  {
    mnemonic: "usubw2",
    category: "Vector",
    syntax: "usubw2 vd.8h, vn.8h, vm.16b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
usubw2  v3.8h, v7.8h, v21.16b   // every lane = 0x0c07`,
  },
  {
    mnemonic: "smull2",
    category: "Vector",
    syntax: "smull2 vd.8h, vn.16b, vm.16b (and 4s/8h, 2d/4s) / smull2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
smull2  v3.8h, v7.16b, v21.16b  // every lane = 0x003c`,
    gotchas: [
      "plain `SMULL` is the same mnemonic as the general-register widening multiply in [Data processing](#data-processing); a `V` first operand is what picks this reading.",
    ],
  },
  {
    mnemonic: "umull2",
    category: "Vector",
    syntax: "umull2 vd.8h, vn.16b, vm.16b (and 4s/8h, 2d/4s) / umull2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
umull2  v3.8h, v7.16b, v21.16b  // every lane = 0x003c`,
  },
  {
    mnemonic: "smlal",
    category: "Vector",
    syntax: "smlal vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s) / smlal vd.4s, vn.4h, vm.h[index] (and 2d/2s with vm.s[index])",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
smlal   v3.8h, v7.8b, v21.8b    // every lane = 0x0c16`,
  },
  {
    mnemonic: "smlal2",
    category: "Vector",
    syntax: "smlal2 vd.8h, vn.16b, vm.16b / smlal2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
smlal2  v3.8h, v7.16b, v21.16b  // every lane = 0x0c16`,
  },
  {
    mnemonic: "umlal",
    category: "Vector",
    syntax: "umlal vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s) / umlal vd.4s, vn.4h, vm.h[index] (and 2d/2s with vm.s[index])",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
umlal   v3.8h, v7.8b, v21.8b    // every lane = 0x0c16`,
  },
  {
    mnemonic: "umlal2",
    category: "Vector",
    syntax: "umlal2 vd.8h, vn.16b, vm.16b / umlal2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
umlal2  v3.8h, v7.16b, v21.16b  // every lane = 0x0c16`,
  },
  {
    mnemonic: "smlsl",
    category: "Vector",
    syntax: "smlsl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s) / smlsl vd.4s, vn.4h, vm.h[index] (and 2d/2s with vm.s[index])",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
smlsl   v3.8h, v7.8b, v21.8b    // every lane = 0x0c02`,
  },
  {
    mnemonic: "smlsl2",
    category: "Vector",
    syntax: "smlsl2 vd.8h, vn.16b, vm.16b / smlsl2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
smlsl2  v3.8h, v7.16b, v21.16b  // every lane = 0x0c02`,
  },
  {
    mnemonic: "umlsl",
    category: "Vector",
    syntax: "umlsl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s) / umlsl vd.4s, vn.4h, vm.h[index] (and 2d/2s with vm.s[index])",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
umlsl   v3.8h, v7.8b, v21.8b    // every lane = 0x0c02`,
  },
  {
    mnemonic: "umlsl2",
    category: "Vector",
    syntax: "umlsl2 vd.8h, vn.16b, vm.16b / umlsl2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
umlsl2  v3.8h, v7.16b, v21.16b  // every lane = 0x0c02`,
  },
  {
    mnemonic: "sabdl",
    category: "Vector",
    syntax: "sabdl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sabdl   v3.8h, v7.8b, v21.8b    // every lane = 7`,
  },
  {
    mnemonic: "sabdl2",
    category: "Vector",
    syntax: "sabdl2 vd.8h, vn.16b, vm.16b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sabdl2  v3.8h, v7.16b, v21.16b  // every lane = 7`,
  },
  {
    mnemonic: "uabdl",
    category: "Vector",
    syntax: "uabdl vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uabdl   v3.8h, v7.8b, v21.8b    // every lane = 7`,
  },
  {
    mnemonic: "uabdl2",
    category: "Vector",
    syntax: "uabdl2 vd.8h, vn.16b, vm.16b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uabdl2  v3.8h, v7.16b, v21.16b  // every lane = 7`,
  },
  {
    mnemonic: "sabal",
    category: "Vector",
    syntax: "sabal vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
sabal   v3.8h, v7.8b, v21.8b    // every lane = 0x0c0f`,
  },
  {
    mnemonic: "sabal2",
    category: "Vector",
    syntax: "sabal2 vd.8h, vn.16b, vm.16b",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
sabal2  v3.8h, v7.16b, v21.16b  // every lane = 0x0c0f`,
  },
  {
    mnemonic: "uabal",
    category: "Vector",
    syntax: "uabal vd.8h, vn.8b, vm.8b (and 4s/4h, 2d/2s)",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
uabal   v3.8h, v7.8b, v21.8b    // every lane = 0x0c0f`,
  },
  {
    mnemonic: "uabal2",
    category: "Vector",
    syntax: "uabal2 vd.8h, vn.16b, vm.16b",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
uabal2  v3.8h, v7.16b, v21.16b  // every lane = 0x0c0f`,
  },
  {
    mnemonic: "addhn",
    category: "Vector",
    syntax: "addhn vd.8b, vn.8h, vm.8h (and 4h/4s, 2s/2d)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
addhn   v3.8b, v7.8h, v21.8h    // every lane = 0x11`,
  },
  {
    mnemonic: "addhn2",
    category: "Vector",
    syntax: "addhn2 vd.16b, vn.8h, vm.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
addhn2  v3.16b, v7.8h, v21.8h   // v3 = 12 in the lower half, 7 in the upper`,
  },
  {
    mnemonic: "raddhn",
    category: "Vector",
    syntax: "raddhn vd.8b, vn.8h, vm.8h (and 4h/4s, 2s/2d)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
raddhn  v3.8b, v7.8h, v21.8h    // every lane = 0x11`,
  },
  {
    mnemonic: "raddhn2",
    category: "Vector",
    syntax: "raddhn2 vd.16b, vn.8h, vm.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
raddhn2 v3.16b, v7.8h, v21.8h   // v3 = 12 in the lower half, 7 in the upper`,
  },
  {
    mnemonic: "subhn",
    category: "Vector",
    syntax: "subhn vd.8b, vn.8h, vm.8h (and 4h/4s, 2s/2d)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
subhn   v3.8b, v7.8h, v21.8h    // every lane = 7`,
  },
  {
    mnemonic: "subhn2",
    category: "Vector",
    syntax: "subhn2 vd.16b, vn.8h, vm.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
subhn2  v3.16b, v7.8h, v21.8h   // v3 = 12 in the lower half, 3 in the upper`,
  },
  {
    mnemonic: "rsubhn",
    category: "Vector",
    syntax: "rsubhn vd.8b, vn.8h, vm.8h (and 4h/4s, 2s/2d)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
rsubhn  v3.8b, v7.8h, v21.8h    // every lane = 7`,
  },
  {
    mnemonic: "rsubhn2",
    category: "Vector",
    syntax: "rsubhn2 vd.16b, vn.8h, vm.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
rsubhn2 v3.16b, v7.8h, v21.8h   // v3 = 12 in the lower half, 3 in the upper`,
  },
  {
    mnemonic: "sqdmull",
    category: "Vector",
    syntax: "sqdmull vd.4s, vn.4h, vm.4h / vd.2d, vn.2s, vm.2s / sqdmull sd, hn, hm / sqdmull dd, sn, sm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sqdmull v3.4s, v7.4h, v21.4h    // every lane = 0x0078f078`,
    gotchas: [
      "`H` and `S` lanes only. The one input pair that saturates is the two minimum values: `0x8000 * 0x8000` doubled lands one past the top of a word.",
    ],
  },
  {
    mnemonic: "sqdmull2",
    category: "Vector",
    syntax: "sqdmull2 vd.4s, vn.8h, vm.8h / vd.2d, vn.4s, vm.4s / sqdmull2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sqdmull2 v3.4s, v7.8h, v21.8h   // every lane = 0x0078f078`,
  },
  {
    mnemonic: "sqdmlal",
    category: "Vector",
    syntax: "sqdmlal vd.4s, vn.4h, vm.4h / vd.2d, vn.2s, vm.2s / sqdmlal sd, hn, hm / sqdmlal dd, sn, sm",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
sqdmlal v3.4s, v7.4h, v21.4h    // every lane = 0x0c203420`,
    gotchas: [
      "it saturates TWICE, once on the product and once on the sum, so a product already at the limit cannot wrap on the way in.",
    ],
  },
  {
    mnemonic: "sqdmlal2",
    category: "Vector",
    syntax: "sqdmlal2 vd.4s, vn.8h, vm.8h / vd.2d, vn.4s, vm.4s / sqdmlal2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
sqdmlal2 v3.4s, v7.8h, v21.8h   // every lane = 0x0c203420`,
  },
  {
    mnemonic: "sqdmlsl",
    category: "Vector",
    syntax: "sqdmlsl vd.4s, vn.4h, vm.4h / vd.2d, vn.2s, vm.2s / sqdmlsl sd, hn, hm / sqdmlsl dd, sn, sm",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
sqdmlsl v3.4s, v7.4h, v21.4h    // every lane = 0x0bf7e3f8`,
  },
  {
    mnemonic: "sqdmlsl2",
    category: "Vector",
    syntax: "sqdmlsl2 vd.4s, vn.8h, vm.8h / vd.2d, vn.4s, vm.4s / sqdmlsl2 vd.4s, vn.8h, vm.h[index]",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
movi    v21.16b, #2
sqdmlsl2 v3.4s, v7.8h, v21.8h   // every lane = 0x0bf7e3f8`,
  },
  {
    mnemonic: "pmull",
    category: "Vector",
    syntax: "pmull vd.8h, vn.8b, vm.8b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
pmull   v3.8h, v7.8b, v21.8b    // every lane = 0x003c`,
  },
  {
    mnemonic: "pmull2",
    category: "Vector",
    syntax: "pmull2 vd.8h, vn.16b, vm.16b",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
pmull2  v3.8h, v7.16b, v21.16b  // every lane = 0x003c`,
  },
  {
    mnemonic: "xtn",
    category: "Vector",
    syntax: "xtn vd.8b, vn.8h (and 4h/4s, 2s/2d)",
    example: `movi    v7.16b, #12
xtn     v3.8b, v7.8h            // every lane = 12`,
  },
  {
    mnemonic: "xtn2",
    category: "Vector",
    syntax: "xtn2 vd.16b, vn.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
xtn2    v3.16b, v7.8h           // v3 = 12 in the lower half, 5 in the upper`,
  },
  {
    mnemonic: "sqxtn",
    category: "Vector",
    syntax: "sqxtn vd.8b, vn.8h / sqxtn bd, hn (and h/s, s/d)",
    example: `movi    v7.16b, #12
sqxtn   v3.8b, v7.8h            // every lane = 0x7f`,
  },
  {
    mnemonic: "sqxtn2",
    category: "Vector",
    syntax: "sqxtn2 vd.16b, vn.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
sqxtn2  v3.16b, v7.8h           // v3 = 12 in the lower half, 0x7f in the upper`,
  },
  {
    mnemonic: "uqxtn",
    category: "Vector",
    syntax: "uqxtn vd.8b, vn.8h / uqxtn bd, hn (and h/s, s/d)",
    example: `movi    v7.16b, #12
uqxtn   v3.8b, v7.8h            // every lane = all ones`,
  },
  {
    mnemonic: "uqxtn2",
    category: "Vector",
    syntax: "uqxtn2 vd.16b, vn.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
uqxtn2  v3.16b, v7.8h           // v3 = 12 in the lower half, all ones in the upper`,
  },
  {
    mnemonic: "sqxtun",
    category: "Vector",
    syntax: "sqxtun vd.8b, vn.8h / sqxtun bd, hn (and h/s, s/d)",
    example: `movi    v7.16b, #12
sqxtun  v3.8b, v7.8h            // every lane = all ones`,
  },
  {
    mnemonic: "sqxtun2",
    category: "Vector",
    syntax: "sqxtun2 vd.16b, vn.8h",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
sqxtun2 v3.16b, v7.8h           // v3 = 12 in the lower half, all ones in the upper`,
  },
  {
    mnemonic: "shll",
    category: "Vector",
    syntax: "shll vd.8h, vn.8b, #8 / vd.4s, vn.4h, #16 / vd.2d, vn.2s, #32",
    example: `movi    v7.16b, #12
shll    v3.8h, v7.8b, #8        // every lane = 0x0c00`,
    gotchas: [
      "the amount is not a choice: it has to be the source lane's width.",
    ],
  },
  {
    mnemonic: "shll2",
    category: "Vector",
    syntax: "shll2 vd.8h, vn.16b, #8 (and 4s/8h, 2d/4s)",
    example: `movi    v7.16b, #12
shll2   v3.8h, v7.16b, #8       // every lane = 0x0c00`,
  },
  // shifts
  {
    mnemonic: "shl",
    category: "Vector",
    syntax: "shl vd.T, vn.T, #shift / shl dd, dn, #shift",
    example: `movi    v7.16b, #12
shl     v3.8b, v7.8b, #5        // every lane = 0x80`,
  },
  {
    mnemonic: "sshr",
    category: "Vector",
    syntax: "sshr vd.T, vn.T, #shift / sshr dd, dn, #shift",
    example: `movi    v7.16b, #240
sshr    v3.8b, v7.8b, #5        // every lane = all ones: the sign fills in from the left`,
  },
  {
    mnemonic: "ushr",
    category: "Vector",
    syntax: "ushr vd.T, vn.T, #shift / ushr dd, dn, #shift",
    example: `movi    v7.16b, #240
ushr    v3.8b, v7.8b, #5        // every lane = 7: zeros fill in instead`,
  },
  {
    mnemonic: "ssra",
    category: "Vector",
    syntax: "ssra vd.T, vn.T, #shift / ssra dd, dn, #shift",
    example: `movi    v3.16b, #1
movi    v7.16b, #240
ssra    v3.8b, v7.8b, #5        // every lane = 0`,
  },
  {
    mnemonic: "usra",
    category: "Vector",
    syntax: "usra vd.T, vn.T, #shift / usra dd, dn, #shift",
    example: `movi    v3.16b, #1
movi    v7.16b, #240
usra    v3.8b, v7.8b, #5        // every lane = 8`,
  },
  {
    mnemonic: "srshr",
    category: "Vector",
    syntax: "srshr vd.T, vn.T, #shift / srshr dd, dn, #shift",
    example: `movi    v7.16b, #240
srshr   v3.8b, v7.8b, #5        // every lane = 0`,
  },
  {
    mnemonic: "urshr",
    category: "Vector",
    syntax: "urshr vd.T, vn.T, #shift / urshr dd, dn, #shift",
    example: `movi    v7.16b, #240
urshr   v3.8b, v7.8b, #5        // every lane = 8`,
  },
  {
    mnemonic: "srsra",
    category: "Vector",
    syntax: "srsra vd.T, vn.T, #shift / srsra dd, dn, #shift",
    example: `movi    v3.16b, #1
movi    v7.16b, #240
srsra   v3.8b, v7.8b, #5        // every lane = 1`,
  },
  {
    mnemonic: "ursra",
    category: "Vector",
    syntax: "ursra vd.T, vn.T, #shift / ursra dd, dn, #shift",
    example: `movi    v3.16b, #1
movi    v7.16b, #240
ursra   v3.8b, v7.8b, #5        // every lane = 9`,
  },
  {
    mnemonic: "sli",
    category: "Vector",
    syntax: "sli vd.T, vn.T, #shift / sli dd, dn, #shift",
    example: `movi    v3.16b, #255
movi    v7.16b, #0
sli     v3.8b, v7.8b, #5        // every lane = 0x1f: the destination's low five bits survive the shift`,
  },
  {
    mnemonic: "sri",
    category: "Vector",
    syntax: "sri vd.T, vn.T, #shift / sri dd, dn, #shift",
    example: `movi    v3.16b, #255
movi    v7.16b, #0
sri     v3.8b, v7.8b, #5        // every lane = 0xf8: the destination's high five bits survive`,
  },
  {
    mnemonic: "sqshl",
    category: "Vector",
    syntax: "sqshl vd.T, vn.T, #shift / sqshl bd, bn, #shift (and h, s, d)",
    example: `movi    v7.16b, #64
sqshl   v3.8b, v7.8b, #5        // every lane = 0x7f`,
    gotchas: [
      "see also the register form below, which shares the mnemonic.",
    ],
  },
  {
    mnemonic: "uqshl",
    category: "Vector",
    syntax: "uqshl vd.T, vn.T, #shift / uqshl bd, bn, #shift (and h, s, d)",
    example: `movi    v7.16b, #64
uqshl   v3.8b, v7.8b, #5        // every lane = all ones`,
  },
  {
    mnemonic: "sqshlu",
    category: "Vector",
    syntax: "sqshlu vd.T, vn.T, #shift / sqshlu bd, bn, #shift (and h, s, d)",
    example: `movi    v7.16b, #240
sqshlu  v3.8b, v7.8b, #5        // every lane = 0`,
  },
  {
    mnemonic: "sshll",
    category: "Vector",
    syntax: "sshll vd.8h, vn.8b, #shift (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
sshll   v3.8h, v7.8b, #3        // every lane = 0x0060`,
    gotchas: [
      "the amount is `#0` to `#esize - 1` of the SOURCE lane.",
    ],
  },
  {
    mnemonic: "sshll2",
    category: "Vector",
    syntax: "sshll2 vd.8h, vn.16b, #shift",
    example: `movi    v7.16b, #12
sshll2  v3.8h, v7.16b, #3       // every lane = 0x0060`,
  },
  {
    mnemonic: "ushll",
    category: "Vector",
    syntax: "ushll vd.8h, vn.8b, #shift (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
ushll   v3.8h, v7.8b, #3        // every lane = 0x0060`,
  },
  {
    mnemonic: "ushll2",
    category: "Vector",
    syntax: "ushll2 vd.8h, vn.16b, #shift",
    example: `movi    v7.16b, #12
ushll2  v3.8h, v7.16b, #3       // every lane = 0x0060`,
  },
  {
    mnemonic: "sxtl",
    category: "Vector",
    syntax: "sxtl vd.8h, vn.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
sxtl    v3.8h, v7.8b            // every lane = 12`,
  },
  {
    mnemonic: "sxtl2",
    category: "Vector",
    syntax: "sxtl2 vd.8h, vn.16b",
    example: `movi    v7.16b, #12
sxtl2   v3.8h, v7.16b           // every lane = 12`,
  },
  {
    mnemonic: "uxtl",
    category: "Vector",
    syntax: "uxtl vd.8h, vn.8b (and 4s/4h, 2d/2s)",
    example: `movi    v7.16b, #12
uxtl    v3.8h, v7.8b            // every lane = 12`,
  },
  {
    mnemonic: "uxtl2",
    category: "Vector",
    syntax: "uxtl2 vd.8h, vn.16b",
    example: `movi    v7.16b, #12
uxtl2   v3.8h, v7.16b           // every lane = 12`,
  },
  {
    mnemonic: "shrn",
    category: "Vector",
    syntax: "shrn vd.8b, vn.8h, #shift (and 4h/4s, 2s/2d)",
    example: `movi    v7.16b, #12
shrn    v3.8b, v7.8h, #3        // every lane = 0x81`,
  },
  {
    mnemonic: "shrn2",
    category: "Vector",
    syntax: "shrn2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
shrn2   v3.16b, v7.8h, #3       // v3 = 12 in the lower half, 0xa0 in the upper`,
  },
  {
    mnemonic: "rshrn",
    category: "Vector",
    syntax: "rshrn vd.8b, vn.8h, #shift (and 4h/4s, 2s/2d)",
    example: `movi    v7.16b, #12
rshrn   v3.8b, v7.8h, #3        // every lane = 0x82`,
  },
  {
    mnemonic: "rshrn2",
    category: "Vector",
    syntax: "rshrn2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
rshrn2  v3.16b, v7.8h, #3       // v3 = 12 in the lower half, 0xa1 in the upper`,
  },
  {
    mnemonic: "sqshrn",
    category: "Vector",
    syntax: "sqshrn vd.8b, vn.8h, #shift / sqshrn bd, hn, #shift",
    example: `movi    v7.16b, #12
sqshrn  v3.8b, v7.8h, #3        // every lane = 0x7f`,
  },
  {
    mnemonic: "sqshrn2",
    category: "Vector",
    syntax: "sqshrn2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
sqshrn2 v3.16b, v7.8h, #3       // v3 = 12 in the lower half, 0x7f in the upper`,
  },
  {
    mnemonic: "uqshrn",
    category: "Vector",
    syntax: "uqshrn vd.8b, vn.8h, #shift / uqshrn bd, hn, #shift",
    example: `movi    v7.16b, #12
uqshrn  v3.8b, v7.8h, #3        // every lane = all ones`,
  },
  {
    mnemonic: "uqshrn2",
    category: "Vector",
    syntax: "uqshrn2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
uqshrn2 v3.16b, v7.8h, #3       // v3 = 12 in the lower half, 0xa0 in the upper`,
  },
  {
    mnemonic: "sqrshrn",
    category: "Vector",
    syntax: "sqrshrn vd.8b, vn.8h, #shift / sqrshrn bd, hn, #shift",
    example: `movi    v7.16b, #12
sqrshrn v3.8b, v7.8h, #3        // every lane = 0x7f`,
  },
  {
    mnemonic: "sqrshrn2",
    category: "Vector",
    syntax: "sqrshrn2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
sqrshrn2 v3.16b, v7.8h, #3      // v3 = 12 in the lower half, 0x7f in the upper`,
  },
  {
    mnemonic: "uqrshrn",
    category: "Vector",
    syntax: "uqrshrn vd.8b, vn.8h, #shift / uqrshrn bd, hn, #shift",
    example: `movi    v7.16b, #12
uqrshrn v3.8b, v7.8h, #3        // every lane = all ones`,
  },
  {
    mnemonic: "uqrshrn2",
    category: "Vector",
    syntax: "uqrshrn2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
uqrshrn2 v3.16b, v7.8h, #3      // v3 = 12 in the lower half, 0xa1 in the upper`,
  },
  {
    mnemonic: "sqshrun",
    category: "Vector",
    syntax: "sqshrun vd.8b, vn.8h, #shift / sqshrun bd, hn, #shift",
    example: `movi    v7.16b, #12
sqshrun v3.8b, v7.8h, #3        // every lane = all ones`,
  },
  {
    mnemonic: "sqshrun2",
    category: "Vector",
    syntax: "sqshrun2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
sqshrun2 v3.16b, v7.8h, #3      // v3 = 12 in the lower half, 0xa0 in the upper`,
  },
  {
    mnemonic: "sqrshrun",
    category: "Vector",
    syntax: "sqrshrun vd.8b, vn.8h, #shift / sqrshrun bd, hn, #shift",
    example: `movi    v7.16b, #12
sqrshrun v3.8b, v7.8h, #3       // every lane = all ones`,
  },
  {
    mnemonic: "sqrshrun2",
    category: "Vector",
    syntax: "sqrshrun2 vd.16b, vn.8h, #shift",
    example: `movi    v3.16b, #12
movi    v7.16b, #5
sqrshrun2 v3.16b, v7.8h, #3     // v3 = 12 in the lower half, 0xa1 in the upper`,
  },
  {
    mnemonic: "sshl",
    category: "Vector",
    syntax: "sshl vd.T, vn.T, vm.T / sshl dd, dn, dm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sshl    v3.8b, v7.8b, v21.8b    // every lane = 0x80`,
  },
  {
    mnemonic: "ushl",
    category: "Vector",
    syntax: "ushl vd.T, vn.T, vm.T / ushl dd, dn, dm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
ushl    v3.8b, v7.8b, v21.8b    // every lane = 0x80`,
  },
  {
    mnemonic: "srshl",
    category: "Vector",
    syntax: "srshl vd.T, vn.T, vm.T / srshl dd, dn, dm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
srshl   v3.8b, v7.8b, v21.8b    // every lane = 0x80`,
  },
  {
    mnemonic: "urshl",
    category: "Vector",
    syntax: "urshl vd.T, vn.T, vm.T / urshl dd, dn, dm",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
urshl   v3.8b, v7.8b, v21.8b    // every lane = 0x80`,
  },
  {
    mnemonic: "sqrshl",
    category: "Vector",
    syntax: "sqrshl vd.T, vn.T, vm.T / sqrshl bd, bn, bm (and h, s, d)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
sqrshl  v3.8b, v7.8b, v21.8b    // every lane = 0x7f`,
    gotchas: [
      "`SQSHL` and `UQSHL` take this same register form, listed with their immediate rows above.",
    ],
  },
  {
    mnemonic: "uqrshl",
    category: "Vector",
    syntax: "uqrshl vd.T, vn.T, vm.T / uqrshl bd, bn, bm (and h, s, d)",
    example: `movi    v7.16b, #12
movi    v21.16b, #5
uqrshl  v3.8b, v7.8b, v21.8b    // every lane = all ones`,
  },
  // permutes and table lookups
  {
    mnemonic: "ext",
    category: "Vector",
    syntax: "ext vd.16b, vn.16b, vm.16b, #index (and 8b)",
    example: `movi    v7.16b, #17
movi    v21.16b, #34
ext     v3.16b, v7.16b, v21.16b, #11  // v3 = 0x11 (5 lanes) then 0x22 (11 lanes)`,
    gotchas: [
      "the `8B` form concatenates the two LOW halves, so its index stops at 7; the `16B` form's at 15.",
    ],
  },
  {
    mnemonic: "tbl",
    category: "Vector",
    syntax: "tbl vd.16b, {vn.16b}, vm.16b (and 8b, and tables of 2, 3 or 4 registers)",
    example: `movi    v7.16b, #0x11
movi    v8.16b, #0x22
movi    v21.8b, #20
tbl     v3.8b, {v7.16b, v8.16b}, v21.8b  // every lane = 0x22: index 20 is lane 4 of the second table register`,
    gotchas: [
      "the table is always spelled `16B` whatever the destination is, the list wraps past `v31` (`{v30.16b-v1.16b}`), and an index at or past `16 x n` gives ZERO.",
    ],
  },
  {
    mnemonic: "tbx",
    category: "Vector",
    syntax: "tbx vd.16b, {vn.16b}, vm.16b (and 8b, and tables of 2, 3 or 4 registers)",
    example: `movi    v3.8b, #0x99
movi    v7.16b, #0x11
movi    v21.8b, #40
tbx     v3.8b, {v7.16b}, v21.8b // every lane = 0x99: index 40 is past the table, so the byte survives`,
    gotchas: [
      "that is the whole difference between the two.",
    ],
  },
  {
    mnemonic: "zip1",
    category: "Vector",
    syntax: "zip1 vd.T, vn.T, vm.T (8b/16b, 4h/8h, 2s/4s, 2d)",
    example: `movi    v7.8h, #0x11, lsl #8
movi    v0.8h, #0x33, lsl #8
ins     v7.d[1], v0.d[0]
movi    v21.16b, #0x22
zip1    v3.16b, v7.16b, v21.16b // v3 = 0 0x22 0x11 0x22 repeating`,
  },
  {
    mnemonic: "zip2",
    category: "Vector",
    syntax: "zip2 vd.T, vn.T, vm.T (8b/16b, 4h/8h, 2s/4s, 2d)",
    example: `movi    v7.8h, #0x11, lsl #8
movi    v0.8h, #0x33, lsl #8
ins     v7.d[1], v0.d[0]
movi    v21.16b, #0x22
zip2    v3.16b, v7.16b, v21.16b // v3 = 0 0x22 0x33 0x22 repeating`,
  },
  {
    mnemonic: "uzp1",
    category: "Vector",
    syntax: "uzp1 vd.T, vn.T, vm.T (8b/16b, 4h/8h, 2s/4s, 2d)",
    example: `movi    v7.8h, #0x11, lsl #8
movi    v0.8h, #0x33, lsl #8
ins     v7.d[1], v0.d[0]
movi    v21.16b, #0x22
uzp1    v3.16b, v7.16b, v21.16b // v3 = 0 in the lower half, 0x22 in the upper`,
  },
  {
    mnemonic: "uzp2",
    category: "Vector",
    syntax: "uzp2 vd.T, vn.T, vm.T (8b/16b, 4h/8h, 2s/4s, 2d)",
    example: `movi    v7.8h, #0x11, lsl #8
movi    v0.8h, #0x33, lsl #8
ins     v7.d[1], v0.d[0]
movi    v21.16b, #0x22
uzp2    v3.16b, v7.16b, v21.16b // v3 = 0x11 (4 lanes) then 0x33 (4 lanes) then 0x22 (8 lanes)`,
  },
  {
    mnemonic: "trn1",
    category: "Vector",
    syntax: "trn1 vd.T, vn.T, vm.T (8b/16b, 4h/8h, 2s/4s, 2d)",
    example: `movi    v7.8h, #0x11, lsl #8
movi    v0.8h, #0x33, lsl #8
ins     v7.d[1], v0.d[0]
movi    v21.16b, #0x22
trn1    v3.16b, v7.16b, v21.16b // v3 = 0 0x22 repeating`,
  },
  {
    mnemonic: "trn2",
    category: "Vector",
    syntax: "trn2 vd.T, vn.T, vm.T (8b/16b, 4h/8h, 2s/4s, 2d)",
    example: `movi    v7.8h, #0x11, lsl #8
movi    v0.8h, #0x33, lsl #8
ins     v7.d[1], v0.d[0]
movi    v21.16b, #0x22
trn2    v3.16b, v7.16b, v21.16b // v3 = 0x11 0x22 repeating in the lower half, 0x33 0x22 repeating in the upper`,
  },
  // floating-point three-same and pairwise
  {
    mnemonic: "fmla",
    category: "Vector",
    syntax: "fmla vd.T, vn.T, vm.T / fmla vd.T, vn.T, vm.Ts[i] / fmla sd, sn, vm.s[i]",
    example: `fmov    v3.4s, #2.0
fmov    v7.4s, #3.0
fmov    v21.4s, #4.0
fmla    v3.2s, v7.2s, v21.2s    // every lane = 14.0: 4.0 + 2.0 * 3.0, with one rounding`,
    gotchas: [
      "the destination lane is an operand, so it is also the first NaN the lane can propagate.",
    ],
  },
  {
    mnemonic: "fmls",
    category: "Vector",
    syntax: "fmls vd.T, vn.T, vm.T / fmls vd.T, vn.T, vm.Ts[i] / fmls sd, sn, vm.s[i]",
    example: `fmov    v3.4s, #20.0
fmov    v7.4s, #3.0
fmov    v21.4s, #4.0
fmls    v3.2s, v7.2s, v21.2s    // every lane = 8.0: 20.0 - 2.0 * 3.0`,
    gotchas: [
      "the pseudocode negates `Vn`'s lane before the fused multiply-add, never the result, so a NaN arriving in `Vn` comes back with its sign flipped.",
    ],
  },
  {
    mnemonic: "fmulx",
    category: "Vector",
    syntax: "fmulx vd.T, vn.T, vm.T / fmulx sd, sn, sm / by element",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #3.0
fmulx   v3.2s, v7.2s, v21.2s    // every lane = 6.0`,
  },
  {
    mnemonic: "fabd",
    category: "Vector",
    syntax: "fabd vd.T, vn.T, vm.T / fabd sd, sn, sm",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #5.0
fabd    v3.2s, v7.2s, v21.2s    // every lane = 3.0`,
    gotchas: [
      "the absolute value is a bit clear applied after the subtract, so it strips the sign off a propagated NaN too.",
    ],
  },
  {
    mnemonic: "frecps",
    category: "Vector",
    syntax: "frecps vd.T, vn.T, vm.T / frecps sd, sn, sm",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #0.5
frecps  v3.2s, v7.2s, v21.2s    // every lane = 1.0: 2.0 - 2.0 * 0.5, the Newton-Raphson step`,
    gotchas: [
      "an infinity against a zero gives exactly `2.0`. `Vn` is negated before the NaN rule looks at it.",
    ],
  },
  {
    mnemonic: "frsqrts",
    category: "Vector",
    syntax: "frsqrts vd.T, vn.T, vm.T / frsqrts sd, sn, sm",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #0.5
frsqrts v3.2s, v7.2s, v21.2s    // every lane = 1.0: (3.0 - 2.0 * 0.5) / 2`,
  },
  {
    mnemonic: "faddp",
    category: "Vector",
    syntax: "faddp vd.T, vn.T, vm.T / faddp sd, vn.2s / faddp dd, vn.2d",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #3.0
faddp   v3.2s, v7.2s, v21.2s    // v3 = 4.0 (1 lane) then 6.0 (1 lane)`,
    gotchas: [
      "the two-operand form folds the pair it has into one scalar.",
    ],
  },
  {
    mnemonic: "fmaxp",
    category: "Vector",
    syntax: "fmaxp vd.T, vn.T, vm.T / fmaxp sd, vn.2s / fmaxp dd, vn.2d",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #3.0
fmaxp   v3.2s, v7.2s, v21.2s    // v3 = 2.0 (1 lane) then 3.0 (1 lane)`,
  },
  {
    mnemonic: "fminp",
    category: "Vector",
    syntax: "fminp vd.T, vn.T, vm.T / fminp sd, vn.2s / fminp dd, vn.2d",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #3.0
fminp   v3.2s, v7.2s, v21.2s    // v3 = 2.0 (1 lane) then 3.0 (1 lane)`,
  },
  {
    mnemonic: "fmaxnmp",
    category: "Vector",
    syntax: "fmaxnmp vd.T, vn.T, vm.T / fmaxnmp sd, vn.2s / fmaxnmp dd, vn.2d",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #3.0
fmaxnmp v3.2s, v7.2s, v21.2s    // v3 = 2.0 (1 lane) then 3.0 (1 lane)`,
  },
  {
    mnemonic: "fminnmp",
    category: "Vector",
    syntax: "fminnmp vd.T, vn.T, vm.T / fminnmp sd, vn.2s / fminnmp dd, vn.2d",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #3.0
fminnmp v3.2s, v7.2s, v21.2s    // v3 = 2.0 (1 lane) then 3.0 (1 lane)`,
  },
  {
    mnemonic: "fmaxv",
    category: "Vector",
    syntax: "fmaxv sd, vn.4s",
    example: `fmov    v7.4s, #2.0
fmov    s0, #5.0
ins     v7.s[0], v0.s[0]
fmaxv   s3, v7.4s               // s3 = 5.0`,
    gotchas: [
      "only the `4S` arrangement exists: folding two lanes is what the pairwise forms are for. The fold is a tree (halves, then their answers), which is what decides WHICH NaN comes out when there is more than one.",
    ],
  },
  {
    mnemonic: "fminv",
    category: "Vector",
    syntax: "fminv sd, vn.4s",
    example: `fmov    v7.4s, #2.0
fmov    s0, #0.5
ins     v7.s[0], v0.s[0]
fminv   s3, v7.4s               // s3 = 0.5`,
  },
  {
    mnemonic: "fmaxnmv",
    category: "Vector",
    syntax: "fmaxnmv sd, vn.4s",
    example: `fmov    v7.4s, #2.0
fmov    s0, #5.0
ins     v7.s[0], v0.s[0]
fmaxnmv s3, v7.4s               // s3 = 5.0`,
  },
  {
    mnemonic: "fminnmv",
    category: "Vector",
    syntax: "fminnmv sd, vn.4s",
    example: `fmov    v7.4s, #2.0
fmov    s0, #0.5
ins     v7.s[0], v0.s[0]
fminnmv s3, v7.4s               // s3 = 0.5`,
  },
  // floating-point unary
  {
    mnemonic: "frecpe",
    category: "Vector",
    syntax: "frecpe vd.T, vn.T / frecpe sd, sn",
    example: `fmov    v7.4s, #4.0
frecpe  v3.2s, v7.2s            // every lane = 0.249512: an eight-bit estimate of 1/4, not 0.25 exactly`,
    gotchas: [
      "a zero gives an infinity of the same sign, an infinity gives a zero, and anything below `2^-(bias+1)` overflows to an infinity.",
    ],
  },
  {
    mnemonic: "frsqrte",
    category: "Vector",
    syntax: "frsqrte vd.T, vn.T / frsqrte sd, sn",
    example: `fmov    v7.4s, #4.0
frsqrte v3.2s, v7.2s            // every lane = 0.499023: an eight-bit estimate of 1/sqrt(4)`,
    gotchas: [
      "a zero gives an infinity, a negative gives the default NaN, and `+inf` gives `+0.0`.",
    ],
  },
  {
    mnemonic: "frecpx",
    category: "Vector",
    syntax: "frecpx sd, sn / frecpx dd, dn",
    example: `fmov    v7.4s, #5.0
frecpx  s3, s7                  // s3 = 0.5: the exponent complemented, the mantissa cleared`,
    gotchas: [
      "a zero or subnormal answers the largest exponent short of the one infinities claim.",
    ],
  },
  {
    mnemonic: "frintn",
    category: "Vector",
    syntax: "frintn vd.T, vn.T",
    example: `fmov    v7.4s, #2.5
frintn  v3.2s, v7.2s            // every lane = 2.0: ties go to the even neighbour`,
  },
  {
    mnemonic: "frinta",
    category: "Vector",
    syntax: "frinta vd.T, vn.T",
    example: `fmov    v7.4s, #2.5
frinta  v3.2s, v7.2s            // every lane = 3.0: ties go away from zero`,
    gotchas: [
      "the `.5` cases are the only place it differs from `FRINTN`, exactly as `FCVTAS` differs from `FCVTNS`.",
    ],
  },
  {
    mnemonic: "frintm",
    category: "Vector",
    syntax: "frintm vd.T, vn.T",
    example: `fmov    v7.4s, #2.5
frintm  v3.2s, v7.2s            // every lane = 2.0`,
  },
  {
    mnemonic: "frintp",
    category: "Vector",
    syntax: "frintp vd.T, vn.T",
    example: `fmov    v7.4s, #2.5
frintp  v3.2s, v7.2s            // every lane = 3.0`,
  },
  {
    mnemonic: "frintz",
    category: "Vector",
    syntax: "frintz vd.T, vn.T",
    example: `fmov    v7.4s, #2.5
frintz  v3.2s, v7.2s            // every lane = 2.0`,
  },
  {
    mnemonic: "frintx",
    category: "Vector",
    syntax: "frintx vd.T, vn.T",
    example: `fmov    v7.4s, #2.5
frintx  v3.2s, v7.2s            // every lane = 2.0`,
    gotchas: [
      "it differs from `FRINTI` only in raising the inexact exception, and this emulator raises none.",
    ],
  },
  {
    mnemonic: "frinti",
    category: "Vector",
    syntax: "frinti vd.T, vn.T",
    example: `fmov    v7.4s, #2.5
frinti  v3.2s, v7.2s            // every lane = 2.0`,
  },
  // floating-point compares
  {
    mnemonic: "fcmeq",
    category: "Vector",
    syntax: "fcmeq vd.T, vn.T, vm.T / fcmeq vd.T, vn.T, #0.0 / fcmeq sd, sn, sm / fcmeq sd, sn, #0.0",
    example: `fmov    v7.4s, #2.0
fmov    v21.4s, #2.0
fcmeq   v3.2s, v7.2s, v21.2s    // every lane = all ones`,
    gotchas: [
      "`+0.0` equals `-0.0`, and a NaN is equal to nothing, itself included.",
    ],
  },
  {
    mnemonic: "fcmge",
    category: "Vector",
    syntax: "fcmge vd.T, vn.T, vm.T / fcmge vd.T, vn.T, #0.0 / fcmge sd, sn, sm / fcmge sd, sn, #0.0",
    example: `fmov    v7.4s, #3.0
fmov    v21.4s, #2.0
fcmge   v3.2s, v7.2s, v21.2s    // every lane = all ones`,
  },
  {
    mnemonic: "fcmgt",
    category: "Vector",
    syntax: "fcmgt vd.T, vn.T, vm.T / fcmgt vd.T, vn.T, #0.0 / fcmgt sd, sn, sm / fcmgt sd, sn, #0.0",
    example: `fmov    v7.4s, #3.0
fmov    v21.4s, #2.0
fcmgt   v3.2s, v7.2s, v21.2s    // every lane = all ones`,
  },
  {
    mnemonic: "fcmle",
    category: "Vector",
    syntax: "fcmle vd.T, vn.T, #0.0 / fcmle sd, sn, #0.0",
    example: `fmov    v7.4s, #-2.0
fcmle   v3.2s, v7.2s, #0.0      // every lane = all ones`,
    gotchas: [
      "there is no register form: swap the operands and use `FCMGE`.",
    ],
  },
  {
    mnemonic: "fcmlt",
    category: "Vector",
    syntax: "fcmlt vd.T, vn.T, #0.0 / fcmlt sd, sn, #0.0",
    example: `fmov    v7.4s, #-2.0
fcmlt   v3.2s, v7.2s, #0.0      // every lane = all ones`,
  },
  {
    mnemonic: "facge",
    category: "Vector",
    syntax: "facge vd.T, vn.T, vm.T / facge sd, sn, sm",
    example: `fmov    v7.4s, #-3.0
fmov    v21.4s, #2.0
facge   v3.2s, v7.2s, v21.2s    // every lane = all ones: the signs are dropped, so -3.0 beats 2.0`,
  },
  {
    mnemonic: "facgt",
    category: "Vector",
    syntax: "facgt vd.T, vn.T, vm.T / facgt sd, sn, sm",
    example: `fmov    v7.4s, #-3.0
fmov    v21.4s, #2.0
facgt   v3.2s, v7.2s, v21.2s    // every lane = all ones: the same, strictly`,
  },
  // floating-point conversions
  {
    mnemonic: "fcvtn",
    category: "Vector",
    syntax: "fcvtn vd.4h, vn.4s / fcvtn vd.2s, vn.2d",
    example: `fmov    v7.4s, #2.0
fcvtn   v3.4h, v7.4s            // every lane = 0x4000: 2.0 as an IEEE binary16`,
  },
  {
    mnemonic: "fcvtn2",
    category: "Vector",
    syntax: "fcvtn2 vd.8h, vn.4s / fcvtn2 vd.4s, vn.2d",
    example: `movi    v3.16b, #0
fmov    v7.4s, #2.0
fcvtn2  v3.8h, v7.4s            // v3 = 0 in the lower half, 0x4000 in the upper: the narrowed lanes land above the low half`,
  },
  {
    mnemonic: "fcvtl",
    category: "Vector",
    syntax: "fcvtl vd.4s, vn.4h / fcvtl vd.2d, vn.2s",
    example: `movi    v7.8h, #0x40, lsl #8
fcvtl   v3.4s, v7.4h            // every lane = 2.0`,
    gotchas: [
      "the plain form reads the LOW half of the source.",
    ],
  },
  {
    mnemonic: "fcvtl2",
    category: "Vector",
    syntax: "fcvtl2 vd.4s, vn.8h / fcvtl2 vd.2d, vn.4s",
    example: `movi    v7.8h, #0x40, lsl #8
fcvtl2  v3.4s, v7.8h            // every lane = 2.0`,
  },
  {
    mnemonic: "fcvtxn",
    category: "Vector",
    syntax: "fcvtxn vd.2s, vn.2d / fcvtxn sd, dn",
    example: `fmov    v7.2d, #2.0
fcvtxn  v3.2s, v7.2d            // every lane = 2.0`,
  },
  {
    mnemonic: "fcvtxn2",
    category: "Vector",
    syntax: "fcvtxn2 vd.4s, vn.2d",
    example: `movi    v3.16b, #0
fmov    v7.2d, #2.0
fcvtxn2 v3.4s, v7.2d            // v3 = 0.0 in the lower half, 2.0 in the upper`,
  },
  // structure loads and stores
  {
    mnemonic: "ld1",
    category: "Vector",
    syntax: "ld1 {vt.T}, [xn] / {vt.T, vt2.T} / three / four (8b/16b, 4h/8h, 2s/4s, 1d/2d), plus [xn], #imm and [xn], xm",
    example: `mov     w0, #9
sub     sp, sp, #32
mov     x7, sp
str     x0, [x7]
ld1     {v3.8b}, [x7]           // v3 = 9 (1 lane) then 0 (7 lanes)
add     sp, sp, #32`,
    gotchas: [
      "the only family that spells `1D`, and the only one whose list can be longer than its digit. A 64-bit arrangement (`8B`, `4H`, `2S`, `1D`) zeroes bits 127:64 of every destination.",
    ],
  },
  {
    mnemonic: "st1",
    category: "Vector",
    syntax: "st1 {vt.T}, [xn] / {vt.T, vt2.T} / three / four (8b/16b, 4h/8h, 2s/4s, 1d/2d), plus [xn], #imm and [xn], xm",
    example: `movi    v3.16b, #7
sub     sp, sp, #16
mov     x7, sp
st1     {v3.16b}, [x7]
ldr     q0, [x7]                // every lane = 7
add     sp, sp, #16`,
    gotchas: [
      "nothing outside the bytes the list covers is written.",
    ],
  },
  {
    mnemonic: "ld2",
    category: "Vector",
    syntax: "ld2 {vt.T, vt2.T}, [xn] (8b/16b, 4h/8h, 2s/4s, 2d), plus the two post-index forms / ld2 {vt.b, vt2.b}[index], [xn] (and h, s, d)",
    example: `movi    v0.8b, #7
movi    v1.8b, #9
sub     sp, sp, #32
mov     x7, sp
st2     {v0.8b, v1.8b}, [x7]
ld2     {v3.8b, v4.8b}, [x7]    // every lane = 7 (v4 = 9): the interleaved pairs come apart
add     sp, sp, #32`,
    gotchas: [
      "no `1D` form, because a one-element list has nothing to interleave.",
    ],
  },
  {
    mnemonic: "st2",
    category: "Vector",
    syntax: "st2 {vt.T, vt2.T}, [xn] (8b/16b, 4h/8h, 2s/4s, 2d), plus the two post-index forms / st2 {vt.b, vt2.b}[index], [xn] (and h, s, d)",
    example: `movi    v3.8b, #7
movi    v4.8b, #9
sub     sp, sp, #16
mov     x7, sp
st2     {v3.8b, v4.8b}, [x7]
ldr     q0, [x7]                // v0 = 7 9 repeating: the two registers interleaved in memory
add     sp, sp, #16`,
  },
  {
    mnemonic: "ld3",
    category: "Vector",
    syntax: "ld3 {vt.T, vt2.T, vt3.T}, [xn] (the same arrangements as ld2) / ld3 {vt.b, vt2.b, vt3.b}[index], [xn] (and h, s, d)",
    example: `movi    v0.8b, #7
movi    v1.8b, #9
movi    v2.8b, #11
sub     sp, sp, #32
mov     x7, sp
st3     {v0.8b, v1.8b, v2.8b}, [x7]
ld3     {v3.8b, v4.8b, v5.8b}, [x7]  // every lane = 7 (v4 = 9, v5 = 11): the triples come apart
add     sp, sp, #32`,
  },
  {
    mnemonic: "st3",
    category: "Vector",
    syntax: "st3 {vt.T, vt2.T, vt3.T}, [xn] (the same arrangements as ld2) / st3 {vt.b, vt2.b, vt3.b}[index], [xn] (and h, s, d)",
    example: `movi    v3.8b, #7
movi    v4.8b, #9
movi    v5.8b, #11
sub     sp, sp, #32
mov     x7, sp
st3     {v3.8b, v4.8b, v5.8b}, [x7]
ldr     q0, [x7]                // v0 = 7 9 11 7 9 11 7 9 11 7 9 11 7 9 11 7: the three registers interleaved in memory
add     sp, sp, #32`,
  },
  {
    mnemonic: "ld4",
    category: "Vector",
    syntax: "ld4 {vt.T, vt2.T, vt3.T, vt4.T}, [xn] (the same arrangements) / ld4 {vt.b, vt2.b, vt3.b, vt4.b}[index], [xn] (and h, s, d)",
    example: `movi    v0.8b, #7
movi    v1.8b, #9
movi    v2.8b, #11
movi    v3.8b, #13
sub     sp, sp, #32
mov     x7, sp
st4     {v0.8b, v1.8b, v2.8b, v3.8b}, [x7]
ld4     {v4.8b, v5.8b, v6.8b, v7.8b}, [x7]  // every lane = 7 (v5 = 9, v6 = 11, v7 = 13): the quads come apart
add     sp, sp, #32`,
  },
  {
    mnemonic: "st4",
    category: "Vector",
    syntax: "st4 {vt.T, vt2.T, vt3.T, vt4.T}, [xn] (the same arrangements) / st4 {vt.b, vt2.b, vt3.b, vt4.b}[index], [xn] (and h, s, d)",
    example: `movi    v3.8b, #7
movi    v4.8b, #9
movi    v5.8b, #11
movi    v6.8b, #13
sub     sp, sp, #32
mov     x7, sp
st4     {v3.8b, v4.8b, v5.8b, v6.8b}, [x7]
ldr     q0, [x7]                // v0 = 7 9 11 13 repeating: the four registers interleaved in memory
add     sp, sp, #32`,
  },
  {
    mnemonic: "ld1r",
    category: "Vector",
    syntax: "ld1r {vt.T}, [xn] (8b/16b, 4h/8h, 2s/4s, 1d/2d), plus [xn], #imm and [xn], xm",
    example: `mov     w0, #9
sub     sp, sp, #32
mov     x7, sp
str     x0, [x7]
ld1r    {v3.16b}, [x7]          // every lane = 9: one byte read, sixteen written
add     sp, sp, #32`,
    gotchas: [
      "a 64-bit arrangement zeroes bits 127:64. The post-index immediate is the ELEMENT width, not the register width: `ld1r {v3.16b}, [x7], #1`.",
    ],
  },
  {
    mnemonic: "ld2r",
    category: "Vector",
    syntax: "ld2r {vt.T, vt2.T}, [xn] (the same arrangements, 1d included)",
    example: `movi    v0.8b, #7
movi    v1.8b, #9
sub     sp, sp, #32
mov     x7, sp
st2     {v0.8b, v1.8b}, [x7]
ld2r    {v3.8b, v4.8b}, [x7]    // every lane = 7 (v4 = 9): one element broadcast into each register
add     sp, sp, #32`,
  },
  {
    mnemonic: "ld3r",
    category: "Vector",
    syntax: "ld3r {vt.T, vt2.T, vt3.T}, [xn]",
    example: `movi    v0.8b, #7
movi    v1.8b, #9
movi    v2.8b, #11
sub     sp, sp, #32
mov     x7, sp
st3     {v0.8b, v1.8b, v2.8b}, [x7]
ld3r    {v3.8b, v4.8b, v5.8b}, [x7]  // every lane = 7 (v4 = 9, v5 = 11): one element per register
add     sp, sp, #32`,
  },
  {
    mnemonic: "ld4r",
    category: "Vector",
    syntax: "ld4r {vt.T, vt2.T, vt3.T, vt4.T}, [xn]",
    example: `movi    v0.8b, #7
movi    v1.8b, #9
movi    v2.8b, #11
movi    v3.8b, #13
sub     sp, sp, #32
mov     x7, sp
st4     {v0.8b, v1.8b, v2.8b, v3.8b}, [x7]
ld4r    {v4.8b, v5.8b, v6.8b, v7.8b}, [x7]  // every lane = 7 (v5 = 9, v6 = 11, v7 = 13): one element per register
add     sp, sp, #32`,
    gotchas: [
      "`ld4r {v3.2s-v6.2s}, [x7], #16` walks four words.",
    ],
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
