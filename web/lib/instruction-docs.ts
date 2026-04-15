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
    example: "MOV X0, #42",
  },
  MOVZ: {
    summary: "Move wide zero-extended; writes `imm << hw*16`, zeros the rest.",
    example: "MOVZ X0, #0x1234, LSL #16",
  },
  MOVK: {
    summary: "Move wide, keep. Writes `imm << hw*16` but preserves the other halfwords.",
    example: "MOVK X0, #0xCAFE, LSL #32",
  },
  MOVN: { summary: "Move wide bitwise-NOT of immediate.", example: "MOVN X0, #0" },
  ADD: { summary: "Rd = Rn + Rm/imm. No flags.", example: "ADD X0, X1, X2" },
  ADDS: { summary: "Rd = Rn + Rm/imm, sets NZCV." },
  SUB: { summary: "Rd = Rn - Rm/imm. No flags." },
  SUBS: { summary: "Rd = Rn - Rm/imm, sets NZCV (the basis of `CMP`)." },
  AND: { summary: "Bitwise AND; register or bitmask immediate." },
  ANDS: { summary: "Bitwise AND with flag update (the basis of `TST`)." },
  ORR: { summary: "Bitwise OR; register or bitmask immediate." },
  EOR: { summary: "Bitwise XOR; register or bitmask immediate." },
  LSL: { summary: "Logical shift left (Rd = Rn << amount)." },
  LSR: { summary: "Logical shift right (unsigned)." },
  ASR: { summary: "Arithmetic shift right (sign-extending)." },
  MUL: { summary: "Rd = Rn * Rm. Low bits only." },
  MADD: { summary: "Rd = Ra + Rn * Rm." },
  MSUB: { summary: "Rd = Ra - Rn * Rm." },
  UDIV: { summary: "Unsigned divide; divide-by-zero writes 0." },
  SDIV: { summary: "Signed divide; divide-by-zero writes 0." },
  NEG: { summary: "Rd = -Rn (alias for `SUB Rd, ZR, Rn`)." },
  MVN: { summary: "Rd = ~Rn (alias for `ORN Rd, ZR, Rn`)." },
  CMP: { summary: "`SUBS ZR, Rn, op2`. Sets NZCV, discards result." },
  CMN: { summary: "`ADDS ZR, Rn, op2`. Sets NZCV." },
  TST: { summary: "`ANDS ZR, Rn, op2`. Sets NZCV; accepts bitmask immediates." },
  CSEL: { summary: "Rd = cond ? Rn : Rm.", example: "CSEL X0, X1, X2, EQ" },
  CSINC: { summary: "Rd = cond ? Rn : Rm+1. Basis of `CSET`." },
  CSET: { summary: "Rd = cond ? 1 : 0 (pseudo for `CSINC Rd, ZR, ZR, cond-inv`)." },
  LDR: {
    summary: "Load from memory. Picks 32-vs-64 bit based on Wt/Xt.",
    details: [
      "Addressing: immediate offset `[Xn, #imm]`, pre-index `[Xn, #imm]!`, post-index `[Xn], #imm`, register offset `[Xn, Xm]`, extended `[Xn, Wm, SXTW #k]`.",
      "`LDR Dt, [...]` reads an IEEE 754 double into the FP bank.",
      "`LDR Xt, =label` loads the label's address via a PC-relative literal pool.",
    ],
  },
  STR: { summary: "Store to memory. Same addressing modes as LDR." },
  LDRB: { summary: "Load byte into Wt." },
  STRB: { summary: "Store low byte of Wt." },
  LDRH: { summary: "Load halfword into Wt." },
  STRH: { summary: "Store low halfword of Wt." },
  LDRSB: { summary: "Load byte, sign-extend to Wt or Xt." },
  LDRSH: { summary: "Load halfword, sign-extend to Wt or Xt." },
  LDRSW: { summary: "Load word, sign-extend to Xt." },
  LDP: {
    summary: "Load pair: `LDP Xt1, Xt2, [Xn, #imm]`.",
    details: ["Offset is scaled by register size (8 for X, 4 for W)."],
  },
  STP: { summary: "Store pair; mirrors LDP." },
  B: { summary: "Unconditional branch to label (±128 MiB)." },
  BL: {
    summary: "Branch with link; writes return address to X30.",
    details: [
      "When the target is a host stub the linker rewrites this to hop through a trampoline in .text so the imm26 offset stays in range.",
    ],
  },
  BR: { summary: "Branch to address in Xn." },
  BLR: { summary: "BR with link (X30 := PC + 4 before jump)." },
  RET: { summary: "Return; jumps to Xn (default X30). Halts when X30 is the `__main_return` sentinel." },
  "B.COND": {
    summary: "Conditional branch (write as `B.EQ`, `B.NE`, `B.LT`, ...).",
    details: [BCOND_NOTE],
    example: "CMP W0, #0\nB.EQ done",
  },
  CBZ: { summary: "Compare-and-branch if register is zero." },
  CBNZ: { summary: "Compare-and-branch if register is non-zero." },
  TBZ: { summary: "Test-bit-and-branch if bit is clear.", example: "TBZ W0, #0, even" },
  TBNZ: { summary: "Test-bit-and-branch if bit is set." },
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
