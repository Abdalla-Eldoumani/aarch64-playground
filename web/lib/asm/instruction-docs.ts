/**
 * Short hover-card content for every instruction the playground
 * understands, written in the cpsc 355 course voice. Monaco's hover
 * provider looks these up by upper-cased mnemonic; condition-code
 * variants (`B.EQ`, `B.NE`, ...) collapse onto the `B.cond` entry.
 */
export interface InstructionDoc {
  /** Short one-line summary. */
  summary: string;
  /** Optional longer notes; markdown-safe lines. */
  details?: string[];
  /** Brief example. */
  example?: string;
  /** Optional one-line C equivalent for students translating between
   *  asm and C. Operand names are placeholders (`Rd`, `Rn`, `op2`,
   *  `off`, etc.) -- the hover surfaces this verbatim. */
  cExample?: string;
  /** True when the mnemonic exists in ARMv8 but this emulator doesn't
   *  implement it; hover shows "not implemented" instead. */
  notImplemented?: boolean;
}

const BCOND_NOTE =
  "Conditional branch. NZCV set by an earlier `CMP`/`SUBS`/`ADDS`/`ANDS`/`TST`.";

export const INSTRUCTION_DOCS: Record<string, InstructionDoc> = {
  MOV: {
    summary: "Copy register or wide immediate into Rd.",
    details: [
      "`MOV Rd, Rm` is `ORR Rd, ZR, Rm`.",
      "`MOV Rd, #imm` auto-picks a MOVZ with the right `LSL` shift when the immediate fits one halfword.",
      "`MOV Xd, SP` / `MOV SP, Xn` lower to `ADD ..., #0`.",
    ],
    example: "mov x0, #42",
    cExample: "Rd = Rm; // or Rd = imm;",
  },
  MOVZ: {
    summary: "Move wide zero-extended; writes `imm << hw*16`, zeros the rest.",
    example: "movz x0, #0x1234, lsl #16",
    cExample: "Rd = imm << (hw * 16);",
  },
  MOVK: {
    summary: "Move wide, keep. Writes `imm << hw*16` but preserves the other halfwords.",
    example: "movk x0, #0xcafe, lsl #32",
    cExample: "Rd = (Rd & ~(0xffffULL << (hw * 16))) | (imm << (hw * 16));",
  },
  MOVN: { summary: "Move wide bitwise-NOT of immediate.", example: "movn x0, #0", cExample: "Rd = ~(imm << (hw * 16));" },
  ADD: { summary: "Rd = Rn + Rm/imm. No flags.", example: "add x0, x1, x2", cExample: "Rd = Rn + op2;" },
  ADDS: { summary: "Rd = Rn + Rm/imm, sets NZCV.", cExample: "Rd = Rn + op2; // NZCV updated" },
  SUB: { summary: "Rd = Rn - Rm/imm. No flags.", cExample: "Rd = Rn - op2;" },
  SUBS: { summary: "Rd = Rn - Rm/imm, sets NZCV (the basis of `CMP`).", cExample: "Rd = Rn - op2; // NZCV updated" },
  CLZ: {
    summary: "Rd = the number of leading zero bits in Rn.",
    details: ["Of zero it is the register width (64 for X, 32 for W), not an error."],
    example: "clz x0, x1",
    cExample: "Rd = __builtin_clzl(Rn); // 64 for Rn == 0",
  },
  CLS: {
    summary: "Rd = the number of leading bits matching the top bit, minus that bit.",
    details: ["Of 0 and of -1 alike it is the width minus one: 63 at X width, 31 at W."],
    example: "cls x0, x1",
  },
  RBIT: { summary: "Rd = Rn with its bit order reversed across the whole register.", example: "rbit x0, x1" },
  REV: {
    summary: "Rd = Rn with its byte order reversed (a byte-swap).",
    details: ["The X and W forms are different encodings, not one instruction with a width bit."],
    example: "rev x0, x1",
    cExample: "Rd = __builtin_bswap64(Rn);",
  },
  REV16: { summary: "Reverse the bytes inside each 16-bit halfword of Rn.", example: "rev16 x0, x1" },
  REV32: {
    summary: "Reverse the bytes inside each 32-bit word of Rn. X registers only.",
    details: ["There is no `REV32 Wd, Wn`: the W-sized byte-swap is `REV Wd, Wn`."],
    example: "rev32 x0, x1",
  },
  ADC: {
    summary: "Rd = Rn + Rm + C. No flags.",
    details: ["Register form only; AArch64 has no add-with-carry immediate. It follows an `ADDS` to carry one 64-bit word into the next."],
    example: "adc x0, x1, x2",
    cExample: "Rd = Rn + Rm + carry;",
  },
  ADCS: { summary: "Rd = Rn + Rm + C, sets NZCV.", example: "adcs w3, w4, w5", cExample: "Rd = Rn + Rm + carry; // NZCV updated" },
  SBC: {
    summary: "Rd = Rn - Rm - (1 - C). No flags.",
    details: ["The carry is the not-borrow an earlier `SUBS` left, so C = 1 means no borrow. Register form only."],
    example: "sbc x9, x10, x11",
    cExample: "Rd = Rn - Rm - (1 - carry);",
  },
  SBCS: { summary: "Rd = Rn - Rm - (1 - C), sets NZCV.", example: "sbcs w0, w1, w2", cExample: "Rd = Rn - Rm - (1 - carry); // NZCV updated" },
  AND: { summary: "Bitwise AND; register or bitmask immediate.", cExample: "Rd = Rn & op2;" },
  ANDS: { summary: "Bitwise AND with flag update (the basis of `TST`).", cExample: "Rd = Rn & op2; // NZCV updated" },
  ORR: { summary: "Bitwise OR; register or bitmask immediate.", cExample: "Rd = Rn | op2;" },
  EOR: { summary: "Bitwise XOR; register or bitmask immediate.", cExample: "Rd = Rn ^ op2;" },
  BIC: {
    summary: "Bit clear: Rd = Rn & ~Rm.",
    details: ["Register form only; AArch64 has no BIC-immediate. Clear a constant mask with `AND` and the inverted bits instead."],
    example: "bic w19, w20, w21",
    cExample: "Rd = Rn & ~Rm;",
  },
  LSL: { summary: "Logical shift left (Rd = Rn << amount).", cExample: "Rd = Rn << amt;" },
  LSR: { summary: "Logical shift right (unsigned).", cExample: "Rd = (unsigned)Rn >> amt;" },
  ASR: { summary: "Arithmetic shift right (sign-extending).", cExample: "Rd = (int)Rn >> amt;" },
  ROR: { summary: "Rotate right: bits leaving the bottom re-enter at the top.", cExample: "Rd = (Rn >> amt) | (Rn << (64 - amt));" },
  SBFX: { summary: "Extract a bitfield and sign-extend it.", cExample: "Rd = (int64_t)(Rn << (63 - (lsb + width - 1))) >> (64 - width);" },
  UBFX: {
    summary: "Unsigned bitfield extract: Rd = (Rn >> lsb) & ((1 << width) - 1).",
    details: ["Pulls `width` bits starting at `lsb` down to bit 0 and zeros the rest. The pattern for unpacking flag fields."],
    example: "ubfx w19, w20, #4, #4",
    cExample: "Rd = (Rn >> lsb) & ((1u << width) - 1);",
  },
  BFI: {
    summary: "Bitfield insert: low `width` bits of Rn land in Rd at `lsb`; other Rd bits survive.",
    details: ["The write is a merge, not a replace, so Rd keeps everything outside the field. UBFX is the matching read."],
    example: "bfi w19, w20, #8, #4",
    cExample: "Rd = (Rd & ~(mask << lsb)) | ((Rn & mask) << lsb);",
  },
  BFXIL: {
    summary: "Bitfield extract and insert low: the field lands at bit 0 of Rd, the rest of Rd survives.",
    details: ["Same `immr`/`imms` as `UBFX`; the difference is that `UBFX` zeroes everything outside the field and `BFXIL` leaves it."],
    example: "bfxil x0, x1, #8, #8",
    cExample: "Rd = (Rd & ~mask) | ((Rn >> lsb) & mask);",
  },
  UBFIZ: {
    summary: "Unsigned bitfield insert in zeros: the low `width` bits of Rn land at `lsb`, the rest of Rd is zeroed.",
    details: ["The inverse shape of `UBFX`. It is a plain write, not a merge: nothing of the old Rd survives."],
    example: "ubfiz x2, x1, #2, #32",
    cExample: "Rd = (unsigned long)(Rn & mask) << lsb;",
  },
  SBFIZ: {
    summary: "Signed bitfield insert: the same placement, sign-extended from the field's top bit.",
    example: "sbfiz x0, x1, #2, #30",
    cExample: "Rd = (long)(Rn & mask) << lsb; // sign filled above the field",
  },
  SXTB: { summary: "Sign-extend a byte to Wd/Xd (alias for `SBFM`).", example: "sxtb w0, w1", cExample: "Rd = (signed char)Rn;" },
  SXTH: { summary: "Sign-extend a halfword to Wd/Xd.", example: "sxth w0, w1", cExample: "Rd = (short)Rn;" },
  SXTW: { summary: "Sign-extend a word to 64-bit Xd.", example: "sxtw x0, w1", cExample: "Xd = (long)(int)Wn;" },
  UXTB: { summary: "Zero-extend a byte into Wd (alias for `UBFM`).", example: "uxtb w0, w1", cExample: "Rd = (unsigned char)Rn;" },
  UXTH: { summary: "Zero-extend a halfword into Wd.", example: "uxth w0, w1", cExample: "Rd = (unsigned short)Rn;" },
  UXTW: {
    summary: "Zero-extend a word into Xd.",
    details: ["GAS assembles it as `MOV Wd, Wn`: a W-register write clears the top half, so no separate bitfield word is needed. The counterpart of `SXTW`."],
    example: "uxtw x0, w1",
    cExample: "Xd = (unsigned long)(unsigned int)Wn;",
  },
  MUL: { summary: "Rd = Rn * Rm. Low bits only.", cExample: "Rd = Rn * Rm;" },
  MADD: { summary: "Rd = Ra + Rn * Rm.", cExample: "Rd = Ra + Rn * Rm;" },
  MSUB: { summary: "Rd = Ra - Rn * Rm.", cExample: "Rd = Ra - Rn * Rm;" },
  MNEG: {
    summary: "Rd = -(Rn * Rm). Alias for `MSUB Rd, Rn, Rm, ZR`.",
    example: "mneg x0, x1, x2",
    cExample: "Rd = -(Rn * Rm);",
  },
  SMULL: { summary: "Xd = Wn * Wm, the exact 64-bit product of two signed 32-bit values.", example: "smull x0, w1, w2", cExample: "long d = (long)a * b;" },
  UMULL: { summary: "Xd = Wn * Wm, the exact 64-bit product of two unsigned 32-bit values.", example: "umull x0, w1, w2", cExample: "unsigned long d = (unsigned long)a * b;" },
  SMULH: { summary: "Xd = the top 64 bits of the signed 128-bit product Xn * Xm.", example: "smulh x0, x1, x2", cExample: "Rd = (long)(((__int128)a * b) >> 64);" },
  UMULH: { summary: "Xd = the top 64 bits of the unsigned 128-bit product Xn * Xm.", example: "umulh x0, x1, x2", cExample: "Rd = (unsigned long)(((unsigned __int128)a * b) >> 64);" },
  UDIV: { summary: "Unsigned divide; divide-by-zero writes 0.", cExample: "Rd = (unsigned)Rn / (unsigned)Rm;" },
  SDIV: { summary: "Signed divide; divide-by-zero writes 0.", cExample: "Rd = (int)Rn / (int)Rm;" },
  NEG: { summary: "Rd = -Rn (alias for `SUB Rd, ZR, Rn`).", cExample: "Rd = -Rn;" },
  NEGS: { summary: "Rd = -Rn and sets NZCV (alias for `SUBS Rd, ZR, Rn`).", example: "negs x0, x1", cExample: "Rd = -Rn; // flags from 0 - Rn" },
  MVN: { summary: "Rd = ~Rn (alias for `ORN Rd, ZR, Rn`).", cExample: "Rd = ~Rn;" },
  ORN: {
    summary: "Rd = Rn | ~Rm. Logical OR with the second source inverted.",
    details: ["`MVN Rd, Rm` is this instruction with `XZR` as Rn."],
    example: "orn x0, x1, x2",
    cExample: "Rd = Rn | ~Rm;",
  },
  EON: {
    summary: "Rd = Rn ^ ~Rm, which is XNOR.",
    example: "eon x0, x1, x2",
    cExample: "Rd = ~(Rn ^ Rm);",
  },
  CMP: { summary: "`SUBS ZR, Rn, op2`. Sets NZCV, discards result.", cExample: "// (Rn - op2) sets NZCV" },
  CMN: { summary: "`ADDS ZR, Rn, op2`. Sets NZCV.", cExample: "// (Rn + op2) sets NZCV" },
  TST: { summary: "`ANDS ZR, Rn, op2`. Sets NZCV; accepts bitmask immediates.", cExample: "// (Rn & op2) sets NZCV" },
  CSEL: { summary: "Rd = cond ? Rn : Rm.", example: "csel x0, x1, x2, eq", cExample: "Rd = cond ? Rn : Rm;" },
  CSINC: { summary: "Rd = cond ? Rn : Rm+1. Basis of `CSET`.", cExample: "Rd = cond ? Rn : Rm + 1;" },
  CSINV: { summary: "Rd = cond ? Rn : ~Rm.", example: "csinv x0, x1, x2, eq", cExample: "Rd = cond ? Rn : ~Rm;" },
  CSNEG: { summary: "Rd = cond ? Rn : -Rm. How gcc spells abs().", example: "csneg x0, x1, x2, pl", cExample: "Rd = cond ? Rn : -Rm;" },
  CSET: { summary: "Rd = cond ? 1 : 0 (pseudo for `CSINC Rd, ZR, ZR, cond-inv`).", cExample: "Rd = cond ? 1 : 0;" },
  CSETM: { summary: "Rd = cond ? all-ones : 0 (pseudo for `CSINV Rd, ZR, ZR, cond-inv`).", example: "csetm w0, eq", cExample: "Rd = cond ? -1 : 0;" },
  CINC: { summary: "Rd = cond ? Rn+1 : Rn.", example: "cinc w2, w1, eq", cExample: "Rd = cond ? Rn + 1 : Rn;" },
  CINV: { summary: "Rd = cond ? ~Rn : Rn.", example: "cinv x0, x1, ne", cExample: "Rd = cond ? ~Rn : Rn;" },
  CNEG: { summary: "Rd = cond ? -Rn : Rn.", example: "cneg x0, x1, lt", cExample: "Rd = cond ? -Rn : Rn;" },
  LDR: {
    summary: "Load from memory. Picks 32-vs-64 bit based on Wt/Xt.",
    details: [
      "Addressing: immediate offset `[Xn, #imm]`, pre-index `[Xn, #imm]!`, post-index `[Xn], #imm`, register offset `[Xn, Xm]`, extended `[Xn, Wm, SXTW #k]`.",
      "`LDR Dt, [...]` reads an IEEE 754 double into the FP bank.",
      "`LDR Xt, =label` loads the label's address via a PC-relative literal pool.",
    ],
    cExample: "Rd = *(int*)(Rn + off);",
  },
  STR: { summary: "Store to memory. Same addressing modes as LDR.", cExample: "*(int*)(Rn + off) = Rd;" },
  LDRB: { summary: "Load byte into Wt.", cExample: "Rd = *(unsigned char*)(Rn + off);" },
  STRB: { summary: "Store low byte of Wt.", cExample: "*(unsigned char*)(Rn + off) = (unsigned char)Rd;" },
  LDRH: { summary: "Load halfword into Wt.", cExample: "Rd = *(unsigned short*)(Rn + off);" },
  STRH: { summary: "Store low halfword of Wt.", cExample: "*(unsigned short*)(Rn + off) = (unsigned short)Rd;" },
  LDRSB: {
    summary: "Load byte, sign-extend to Wt or Xt.",
    details: ["Takes the same pre/post-index writeback and unscaled negative offsets as `LDR`."],
    cExample: "Rd = *(signed char*)(Rn + off);",
  },
  LDRSH: {
    summary: "Load halfword, sign-extend to Wt or Xt.",
    details: ["Takes the same pre/post-index writeback and unscaled negative offsets as `LDR`."],
    cExample: "Rd = *(short*)(Rn + off);",
  },
  LDRSW: {
    summary: "Load word, sign-extend to Xt.",
    details: ["Takes the same pre/post-index writeback and unscaled negative offsets as `LDR`. GCC walks an int array with `ldrsw x0, [x1], 4`."],
    cExample: "Rd = *(int*)(Rn + off);",
  },
  LDP: {
    summary: "Load pair: `LDP Xt1, Xt2, [Xn, #imm]`, or the FP file with D/S registers.",
    details: ["Offset is scaled by register size (8 for X and D, 4 for W and S)."],
    cExample: "Rt1 = *(long*)(Rn + off); Rt2 = *(long*)(Rn + off + 8);",
  },
  STP: { summary: "Store pair; mirrors LDP (D/S pairs reach the FP file).", cExample: "*(long*)(Rn + off) = Rt1; *(long*)(Rn + off + 8) = Rt2;" },
  ADR: {
    summary: "Pc-relative byte address of a label into Xd.",
    example: "adr x0, label",
    cExample: "Rd = &label;",
  },
  ADRP: {
    summary: "Address of the 4 KiB page that contains a label.",
    details: ["Pair with `add Xd, Xd, :lo12:label` to add the low 12 bits and reach the exact address."],
    example: "adrp x0, msg\nadd x0, x0, :lo12:msg",
  },
  B: { summary: "Unconditional branch to label (±128 MiB).", cExample: "goto label;" },
  BL: {
    summary: "Branch with link; writes return address to X30.",
    details: [
      "When the target is a host stub the linker rewrites this to hop through a trampoline in .text so the imm26 offset stays in range.",
    ],
    cExample: "label(); // X30 = return address",
  },
  BR: { summary: "Branch to address in Xn.", cExample: "goto *(void*)Xn;" },
  BLR: { summary: "BR with link (X30 := PC + 4 before jump).", cExample: "((void(*)())Xn)(); // X30 = return address" },
  RET: { summary: "Return; jumps to Xn (default X30). Halts when X30 is the `__main_return` sentinel.", cExample: "return;" },
  "B.COND": {
    summary: "Conditional branch (write as `B.EQ`, `B.NE`, `B.LT`, ...).",
    details: [BCOND_NOTE],
    example: "cmp w0, #0\nb.eq done",
    cExample: "if (cond) goto label;",
  },
  CBZ: { summary: "Compare-and-branch if register is zero.", cExample: "if (Rn == 0) goto label;" },
  CBNZ: { summary: "Compare-and-branch if register is non-zero.", cExample: "if (Rn != 0) goto label;" },
  TBZ: { summary: "Test-bit-and-branch if bit is clear.", example: "tbz w0, #0, even", cExample: "if (((Rn >> bit) & 1) == 0) goto label;" },
  TBNZ: { summary: "Test-bit-and-branch if bit is set.", cExample: "if (((Rn >> bit) & 1) != 0) goto label;" },
  SVC: {
    summary: "Supervisor call. With `#0` dispatches on `x8`.",
    details: [
      "Hosted syscall numbers: 63 read, 64 write, 93 exit, 56 openat, 57 close, 62 lseek.",
      "`SVC #N` with `N != 0` halts the CPU.",
    ],
  },
  NOP: { summary: "Do nothing; PC advances." },
  FMOV: {
    summary: "Copy bits: FP to FP, between the register files, or an 8-bit float immediate.",
    details: [
      "`FMOV Dd, Xn` / `FMOV Xd, Dn` (and the S/W pair) move raw bits between the files with no conversion; use `scvtf`/`fcvtzs` to convert a value.",
      "`FMOV Dd, #imm` / `FMOV Sd, #imm` takes a small power-of-two multiple of 1.0-1.9375 (0.5, 1.0, 2.0, 5.0, 9.0 all fit).",
      "Values outside that set (0.0, 0.1, 100.0) do not encode; load them from a `.double` / `.float` instead.",
    ],
    example: "fmov d9, 5.0",
  },
  FADD: { summary: "Fd = Fn + Fm; the register width picks single (`Sd`) or double (`Dd`)." },
  FSUB: { summary: "Fd = Fn - Fm (S or D form)." },
  FMUL: { summary: "Fd = Fn * Fm (S or D form)." },
  FDIV: { summary: "Fd = Fn / Fm (S or D form)." },
  FNMUL: {
    summary: "Fd = -(Fn * Fm): the sign flips AFTER the multiply.",
    details: ["Not the same as negating an operand: `fnmul` of `+0.0` and `3.0` is `-0.0`."],
    example: "fnmul d0, d1, d2",
    cExample: "Fd = -(Fn * Fm);",
  },
  FMADD: {
    summary: "Fused multiply-add: Fd = Fa + Fn * Fm. The accumulator is the LAST operand.",
    details: [
      "Fused means one rounding, so it is not `fmul` followed by `fadd`.",
      "`fmadd d4, d1, d2, d3` is `d3 + d1*d2`, never `d1 + d2*d3`.",
    ],
    example: "fmadd d0, d1, d2, d3",
    cExample: "Fd = fma(Fn, Fm, Fa);",
  },
  FMSUB: { summary: "Fd = Fa - Fn * Fm (the product is subtracted FROM the accumulator).", example: "fmsub d0, d1, d2, d3", cExample: "Fd = fma(-Fn, Fm, Fa);" },
  FNMADD: { summary: "Fd = -Fa - Fn * Fm.", example: "fnmadd d0, d1, d2, d3", cExample: "Fd = -fma(Fn, Fm, Fa);" },
  FNMSUB: { summary: "Fd = -Fa + Fn * Fm.", example: "fnmsub d0, d1, d2, d3", cExample: "Fd = fma(Fn, Fm, -Fa);" },
  FMAX: {
    summary: "Fd = the larger of Fn and Fm (S or D form).",
    details: ["A NaN operand makes the result NaN; `FMAXNM` ignores it instead.", "`fmax(+0.0, -0.0)` is `+0.0` in either operand order."],
    example: "fmax d0, d1, d2",
  },
  FMIN: {
    summary: "Fd = the smaller of Fn and Fm (S or D form).",
    details: ["Same NaN rule as `FMAX`; `fmin(+0.0, -0.0)` is `-0.0`."],
    example: "fmin d0, d1, d2",
  },
  FMAXNM: {
    summary: "IEEE maxNum: a NaN operand is ignored and the number wins.",
    details: ["This is what C's `fmax()` compiles to; `FMAX` propagates the NaN."],
    example: "fmaxnm d0, d1, d2",
    cExample: "Fd = fmax(Fn, Fm);",
  },
  FMINNM: {
    summary: "IEEE minNum: a NaN operand is ignored and the number wins.",
    example: "fminnm d0, d1, d2",
    cExample: "Fd = fmin(Fn, Fm);",
  },
  FNEG: {
    summary: "Fd = -Fn (flips the sign bit; S or D form).",
    example: "fneg d16, d16",
    cExample: "Dd = -Dn;",
  },
  FABS: {
    summary: "Fd = fabs(Fn) (clears the sign bit; S or D form).",
    example: "fabs d0, d1",
    cExample: "Dd = fabs(Dn);",
  },
  FSQRT: {
    summary: "Fd = sqrt(Fn) (S or D form).",
    details: ["A negative operand gives NaN; the instruction never faults."],
    example: "fsqrt d1, d0",
    cExample: "Dd = sqrt(Dn);",
  },
  FCSEL: {
    summary: "Fd = cond ? Fn : Fm. The integer `CSEL` for the FP file.",
    details: [
      "The flags come from an earlier `FCMP` or `CMP`; `FCSEL` sets none of its own.",
      "The chosen register's bits are copied, so a NaN or a `-0.0` arrives untouched.",
    ],
    example: "fcsel d0, d1, d2, lt",
    cExample: "Fd = cond ? Fn : Fm;",
  },
  FCMP: {
    summary: "Set NZCV from Fn vs Fm (S or D form).",
    details: ["Unordered (NaN) sets C and V; `<` sets N; `==` sets Z."],
  },
  FCMPE: { summary: "Signaling FCMP; sets the same flags here (no FP exceptions are raised).", example: "fcmpe d0, d1", cExample: "// (a < b) etc. via NZCV" },
  FCVT: {
    summary: "Convert between the float views: `FCVT Dd, Sn` widens exactly, `FCVT Sd, Dn` narrows with rounding.",
    details: [
      "The step before printing a float: printf takes doubles, so widen with `fcvt d0, s0` first.",
    ],
    example: "fcvt d0, s0",
    cExample: "double d = (double)f;",
  },
  SCVTF: { summary: "Signed-int -> float (`SCVTF Dd, Xn` / `Dd, Wn` / `Sd, Wn`)." },
  UCVTF: {
    summary: "Unsigned integer -> float (`UCVTF Dd, Xn` / `Sd, Wn`).",
    details: ["`SCVTF` reads the same bits as signed, so the two differ on every value with the top bit set."],
    example: "ucvtf d0, x0",
    cExample: "Fd = (double)(unsigned long)Rn;",
  },
  FCVTZS: { summary: "Float -> signed-int with truncation (`FCVTZS Wd, Dn` / `Wd, Sn`)." },
  FCVTNS: {
    summary: "Float -> signed integer, rounding to nearest with ties to even.",
    details: ["Ties go to the EVEN neighbour: 2.5 gives 2 and 3.5 gives 4. `FCVTZS` truncates toward zero instead."],
    example: "fcvtns w0, d0",
    cExample: "Rd = (int)nearbyint(Fn); // FE_TONEAREST",
  },
  FCVTNU: { summary: "Float -> unsigned integer, ties to even. Negatives saturate to 0.", example: "fcvtnu w0, d0" },
  FCVTZU: { summary: "Float -> unsigned integer, truncating toward zero. Negatives saturate to 0.", example: "fcvtzu w0, d0" },
  FCVTAS: {
    summary: "Float -> signed integer, rounding to nearest with ties AWAY from zero.",
    details: ["The other nearest mode: 2.5 gives 3 and -2.5 gives -3, where `FCVTNS` gives 2 and -2."],
    example: "fcvtas w0, d0",
    cExample: "Rd = (int)round(Fn);",
  },
  FCVTAU: { summary: "Float -> unsigned integer, ties away from zero.", example: "fcvtau w0, d0" },
  FCVTMS: { summary: "Float -> signed integer, rounding toward minus infinity (floor).", example: "fcvtms w0, d0", cExample: "Rd = (int)floor(Fn);" },
  FCVTMU: { summary: "Float -> unsigned integer, floor. Negatives saturate to 0.", example: "fcvtmu w0, d0" },
  FCVTPS: { summary: "Float -> signed integer, rounding toward plus infinity (ceiling).", example: "fcvtps w0, d0", cExample: "Rd = (int)ceil(Fn);" },
  FCVTPU: { summary: "Float -> unsigned integer, ceiling.", example: "fcvtpu w0, d0" },
};

/** Case-insensitive lookup; condition variants collapse to B.COND. */
export function lookupDoc(raw: string): InstructionDoc | undefined {
  const key = raw.toUpperCase();
  if (key.startsWith("B.") && key !== "B.COND") return INSTRUCTION_DOCS["B.COND"];
  return INSTRUCTION_DOCS[key];
}
