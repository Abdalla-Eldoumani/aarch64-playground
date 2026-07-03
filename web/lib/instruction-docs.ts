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
  UBFX: {
    summary: "Unsigned bitfield extract: Rd = (Rn >> lsb) & ((1 << width) - 1).",
    details: ["Pulls `width` bits starting at `lsb` down to bit 0 and zeros the rest. The pattern for unpacking flag fields."],
    example: "ubfx w19, w20, #4, #4",
    cExample: "Rd = (Rn >> lsb) & ((1u << width) - 1);",
  },
  SXTB: { summary: "Sign-extend a byte to Wd/Xd (alias for `SBFM`).", example: "sxtb w0, w1", cExample: "Rd = (signed char)Rn;" },
  SXTH: { summary: "Sign-extend a halfword to Wd/Xd.", example: "sxth w0, w1", cExample: "Rd = (short)Rn;" },
  SXTW: { summary: "Sign-extend a word to 64-bit Xd.", example: "sxtw x0, w1", cExample: "Xd = (long)(int)Wn;" },
  UXTB: { summary: "Zero-extend a byte into Wd (alias for `UBFM`).", example: "uxtb w0, w1", cExample: "Rd = (unsigned char)Rn;" },
  UXTH: { summary: "Zero-extend a halfword into Wd.", example: "uxth w0, w1", cExample: "Rd = (unsigned short)Rn;" },
  MUL: { summary: "Rd = Rn * Rm. Low bits only.", cExample: "Rd = Rn * Rm;" },
  MADD: { summary: "Rd = Ra + Rn * Rm.", cExample: "Rd = Ra + Rn * Rm;" },
  MSUB: { summary: "Rd = Ra - Rn * Rm.", cExample: "Rd = Ra - Rn * Rm;" },
  UDIV: { summary: "Unsigned divide; divide-by-zero writes 0.", cExample: "Rd = (unsigned)Rn / (unsigned)Rm;" },
  SDIV: { summary: "Signed divide; divide-by-zero writes 0.", cExample: "Rd = (int)Rn / (int)Rm;" },
  NEG: { summary: "Rd = -Rn (alias for `SUB Rd, ZR, Rn`).", cExample: "Rd = -Rn;" },
  MVN: { summary: "Rd = ~Rn (alias for `ORN Rd, ZR, Rn`).", cExample: "Rd = ~Rn;" },
  CMP: { summary: "`SUBS ZR, Rn, op2`. Sets NZCV, discards result.", cExample: "// (Rn - op2) sets NZCV" },
  CMN: { summary: "`ADDS ZR, Rn, op2`. Sets NZCV.", cExample: "// (Rn + op2) sets NZCV" },
  TST: { summary: "`ANDS ZR, Rn, op2`. Sets NZCV; accepts bitmask immediates.", cExample: "// (Rn & op2) sets NZCV" },
  CSEL: { summary: "Rd = cond ? Rn : Rm.", example: "csel x0, x1, x2, eq", cExample: "Rd = cond ? Rn : Rm;" },
  CSINC: { summary: "Rd = cond ? Rn : Rm+1. Basis of `CSET`.", cExample: "Rd = cond ? Rn : Rm + 1;" },
  CSET: { summary: "Rd = cond ? 1 : 0 (pseudo for `CSINC Rd, ZR, ZR, cond-inv`).", cExample: "Rd = cond ? 1 : 0;" },
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
  LDRSB: { summary: "Load byte, sign-extend to Wt or Xt.", cExample: "Rd = *(signed char*)(Rn + off);" },
  LDRSH: { summary: "Load halfword, sign-extend to Wt or Xt.", cExample: "Rd = *(short*)(Rn + off);" },
  LDRSW: { summary: "Load word, sign-extend to Xt.", cExample: "Rd = *(int*)(Rn + off);" },
  LDP: {
    summary: "Load pair: `LDP Xt1, Xt2, [Xn, #imm]`.",
    details: ["Offset is scaled by register size (8 for X, 4 for W)."],
    cExample: "Rt1 = *(long*)(Rn + off); Rt2 = *(long*)(Rn + off + 8);",
  },
  STP: { summary: "Store pair; mirrors LDP.", cExample: "*(long*)(Rn + off) = Rt1; *(long*)(Rn + off + 8) = Rt2;" },
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
  FMOV: { summary: "Copy FP register bit-for-bit." },
  FADD: { summary: "Dd = Dn + Dm (double precision)." },
  FSUB: { summary: "Dd = Dn - Dm." },
  FMUL: { summary: "Dd = Dn * Dm." },
  FDIV: { summary: "Dd = Dn / Dm." },
  FCMP: {
    summary: "Set NZCV from Dn vs Dm.",
    details: ["Unordered (NaN) sets C and V; `<` sets N; `==` sets Z."],
  },
  SCVTF: { summary: "Signed-int -> double (`SCVTF Dd, Xn` / `Dd, Wn`)." },
  FCVTZS: { summary: "Double -> signed-int with truncation." },
};

/** Case-insensitive lookup; condition variants collapse to B.COND. */
export function lookupDoc(raw: string): InstructionDoc | undefined {
  const key = raw.toUpperCase();
  if (key.startsWith("B.") && key !== "B.COND") return INSTRUCTION_DOCS["B.COND"];
  return INSTRUCTION_DOCS[key];
}
