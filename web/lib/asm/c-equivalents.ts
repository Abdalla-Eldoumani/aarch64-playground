/**
 * The C equivalent of every instruction the playground assembles, shown in
 * the editor's hover card and on the reference page.
 *
 * Each entry is plain C that computes what the instruction computes. A form is
 * one block: its first line is a comment that declares the operands as C
 * variables (`// .8b: int8_t Vd[8], Vn[8], Vm[8]` reads "the .8b arrangement,
 * eight signed bytes per register"), then the code. Blocks are separated by a
 * blank line. Registers keep their assembly names: Rd, Rn and Rm for the
 * general registers, Vd, Vn and Vm for vector registers as arrays of lanes,
 * and Bd, Hd, Sd and Dd for the 8, 16, 32 and 64-bit views of a SIMD&FP
 * register. `cond` is the condition an instruction names, true or false for
 * the flags it reads, and N, Z, C and V are the four condition flags.
 *
 * The C relies on two things gcc defines: `>>` on a negative value shifts in
 * copies of the sign bit, and storing an int into a narrower signed type keeps
 * its low bits. An intrinsic is a C function the compiler turns into one
 * instruction: the vector ones come from arm_neon.h and the `__` ones from
 * arm_acle.h.
 *
 * Kept apart from instruction-docs.ts so the pages that only need the one-line
 * summaries (lessons, the completion list) never load this text.
 */
export interface CEquivalent {
  /** Plain C, one blank-line-separated block per form. */
  c: string;
  /** The intrinsic that compiles to this instruction, where one exists. */
  intrinsic?: string;
}

export const C_EQUIVALENTS: Record<string, CEquivalent> = {
  // data processing
  MOV: {
    c: `// uint64_t Rd, Rm (an immediate works the same way)
Rd = Rm;

// .16b: uint8_t Vd[16], Vn[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i];`,
  },
  MOVZ: {
    c: `// uint64_t Rd, imm; int hw (the shift is hw * 16)
Rd = imm << (hw * 16);`,
  },
  MOVK: {
    c: `// uint64_t Rd, imm; int hw (the shift is hw * 16)
uint64_t field = 0xffffULL << (hw * 16);
Rd = (Rd & ~field) | (imm << (hw * 16));   // the other halfwords stay`,
  },
  MOVN: {
    c: `// uint64_t Rd, imm; int hw (the shift is hw * 16)
Rd = ~(imm << (hw * 16));`,
  },
  ADD: {
    c: `// uint64_t Rd, Rn, op2 (op2 is Rm or an immediate)
Rd = Rn + op2;

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] + Vm[i];   // each lane wraps`,
    intrinsic: "vaddq_u8",
  },
  ADDS: {
    c: `// uint64_t Rd, Rn, op2; int N, Z, C, V
Rd = Rn + op2;
N = Rd >> 63;                          // the sign bit
Z = Rd == 0;
C = Rd < Rn;                           // the unsigned sum carried out
V = ((Rn ^ Rd) & (op2 ^ Rd)) >> 63;    // the signed sum overflowed`,
  },
  SUB: {
    c: `// uint64_t Rd, Rn, op2 (op2 is Rm or an immediate)
Rd = Rn - op2;

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] - Vm[i];   // each lane wraps`,
    intrinsic: "vsubq_u8",
  },
  SUBS: {
    c: `// uint64_t Rd, Rn, op2; int N, Z, C, V
Rd = Rn - op2;
N = Rd >> 63;                          // the sign bit
Z = Rd == 0;
C = Rn >= op2;                         // no borrow
V = ((Rn ^ op2) & (Rn ^ Rd)) >> 63;    // the signed difference overflowed`,
  },
  ADC: {
    c: `// uint64_t Rd, Rn, Rm; int C (the carry flag)
Rd = Rn + Rm + C;`,
  },
  ADCS: {
    c: `// uint64_t Rd, Rn, Rm; int N, Z, C, V (C arrives as the carry in)
unsigned __int128 sum = (unsigned __int128)Rn + Rm + C;
Rd = (uint64_t)sum;
N = Rd >> 63;
Z = Rd == 0;
C = sum >> 64;                         // the carry out
V = ((Rn ^ Rd) & (Rm ^ Rd)) >> 63;`,
  },
  SBC: {
    c: `// uint64_t Rd, Rn, Rm; int C (the carry flag: 1 means no borrow)
Rd = Rn - Rm - (1 - C);`,
  },
  SBCS: {
    c: `// uint64_t Rd, Rn, Rm; int N, Z, C, V (C arrives as the carry in)
Rd = Rn - Rm - (1 - C);
N = Rd >> 63;
Z = Rd == 0;
C = C ? Rn >= Rm : Rn > Rm;            // 1 when nothing was borrowed
V = ((Rn ^ Rm) & (Rn ^ Rd)) >> 63;`,
  },
  MUL: {
    c: `// uint64_t Rd, Rn, Rm
Rd = Rn * Rm;                          // the low 64 bits of the product

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] * Vm[i];   // the low 8 bits`,
    intrinsic: "vmulq_u8",
  },
  MADD: {
    c: `// uint64_t Rd, Rn, Rm, Ra
Rd = Ra + Rn * Rm;`,
  },
  MSUB: {
    c: `// uint64_t Rd, Rn, Rm, Ra
Rd = Ra - Rn * Rm;`,
  },
  MNEG: {
    c: `// uint64_t Rd, Rn, Rm
Rd = -(Rn * Rm);`,
  },
  NEGS: {
    c: `// uint64_t Rd, Rm; int N, Z, C, V
Rd = 0 - Rm;
N = Rd >> 63;
Z = Rd == 0;
C = Rm == 0;                           // 0 - Rm borrows unless Rm is 0
V = Rm == 0x8000000000000000;          // the one value whose negation overflows`,
  },
  SMULL: {
    c: `// int64_t Xd; int32_t Wn, Wm
Xd = (int64_t)Wn * Wm;                 // exact: no 32-bit wrap

// .8h from .8b: int16_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] * Vm[i];`,
    intrinsic: "vmull_s8",
  },
  UMULL: {
    c: `// uint64_t Xd; uint32_t Wn, Wm
Xd = (uint64_t)Wn * Wm;                // exact: no 32-bit wrap

// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] * Vm[i];`,
    intrinsic: "vmull_u8",
  },
  SMULH: {
    c: `// int64_t Xd, Xn, Xm
Xd = (__int128)Xn * Xm >> 64;          // the top half of the 128-bit product`,
  },
  UMULH: {
    c: `// uint64_t Xd, Xn, Xm
Xd = (unsigned __int128)Xn * Xm >> 64; // the top half of the 128-bit product`,
  },
  SMADDL: {
    c: `// uint64_t Xd, Xa; int32_t Wn, Wm
Xd = Xa + (int64_t)Wn * Wm;`,
  },
  SMSUBL: {
    c: `// uint64_t Xd, Xa; int32_t Wn, Wm
Xd = Xa - (int64_t)Wn * Wm;`,
  },
  UMADDL: {
    c: `// uint64_t Xd, Xa; uint32_t Wn, Wm
Xd = Xa + (uint64_t)Wn * Wm;`,
  },
  UMSUBL: {
    c: `// uint64_t Xd, Xa; uint32_t Wn, Wm
Xd = Xa - (uint64_t)Wn * Wm;`,
  },
  SMNEGL: {
    c: `// int64_t Xd; int32_t Wn, Wm
Xd = -((int64_t)Wn * Wm);`,
  },
  UMNEGL: {
    c: `// uint64_t Xd; uint32_t Wn, Wm
Xd = -((uint64_t)Wn * Wm);             // wraps at 64 bits`,
  },
  UDIV: {
    c: `// uint64_t Rd, Rn, Rm
Rd = Rm == 0 ? 0 : Rn / Rm;            // dividing by zero gives 0, no fault`,
  },
  SDIV: {
    c: `// int64_t Rd, Rn, Rm
if (Rm == 0) Rd = 0;                   // dividing by zero gives 0, no fault
else if (Rn == INT64_MIN && Rm == -1) Rd = INT64_MIN;   // too big: it wraps
else Rd = Rn / Rm;                     // rounds toward zero, as C does`,
  },
  NEG: {
    c: `// uint64_t Rd, Rm
Rd = 0 - Rm;

// .16b: uint8_t Vd[16], Vn[16]
for (int i = 0; i < 16; i++) Vd[i] = 0 - Vn[i];   // each lane wraps`,
    intrinsic: "vnegq_s8",
  },
  AND: {
    c: `// uint64_t Rd, Rn, op2 (op2 is Rm or a bitmask immediate)
Rd = Rn & op2;

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] & Vm[i];`,
    intrinsic: "vandq_u8",
  },
  ANDS: {
    c: `// uint64_t Rd, Rn, op2; int N, Z, C, V
Rd = Rn & op2;
N = Rd >> 63;
Z = Rd == 0;
C = 0;                                 // a logical op clears C and V
V = 0;`,
  },
  ORR: {
    c: `// uint64_t Rd, Rn, op2 (op2 is Rm or a bitmask immediate)
Rd = Rn | op2;

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] | Vm[i];`,
    intrinsic: "vorrq_u8",
  },
  EOR: {
    c: `// uint64_t Rd, Rn, op2 (op2 is Rm or a bitmask immediate)
Rd = Rn ^ op2;

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] ^ Vm[i];`,
    intrinsic: "veorq_u8",
  },
  MVN: {
    c: `// uint64_t Rd, Rm
Rd = ~Rm;

// .16b: uint8_t Vd[16], Vn[16]
for (int i = 0; i < 16; i++) Vd[i] = ~Vn[i];`,
    intrinsic: "vmvnq_u8",
  },
  BIC: {
    c: `// uint64_t Rd, Rn, Rm
Rd = Rn & ~Rm;

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] & ~Vm[i];`,
    intrinsic: "vbicq_u8",
  },
  ORN: {
    c: `// uint64_t Rd, Rn, Rm
Rd = Rn | ~Rm;

// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i] | ~Vm[i];`,
    intrinsic: "vornq_u8",
  },
  EON: {
    c: `// uint64_t Rd, Rn, Rm
Rd = Rn ^ ~Rm;`,
  },
  CLZ: {
    c: `// uint64_t Rd, Rn
Rd = Rn == 0 ? 64 : __builtin_clzll(Rn);   // gcc's count of leading zeros

// .16b: uint8_t Vd[16], Vn[16]
for (int i = 0; i < 16; i++) {
  int n = 0;                           // zeros from bit 7 down
  while (n < 8 && !(Vn[i] >> (7 - n) & 1)) n++;
  Vd[i] = n;
}`,
    intrinsic: "__clzll",
  },
  CLS: {
    c: `// uint64_t Rd; int64_t Rn
Rd = __builtin_clrsbll(Rn);            // bits below the top one that match it

// .16b: uint8_t Vd[16]; int8_t Vn[16]
for (int i = 0; i < 16; i++) {
  int n = 0;
  while (n < 7 && (Vn[i] >> (6 - n) & 1) == (Vn[i] >> 7 & 1)) n++;
  Vd[i] = n;
}`,
    intrinsic: "__clsll",
  },
  RBIT: {
    c: `// uint64_t Rd, Rn
Rd = 0;
for (int b = 0; b < 64; b++)
  Rd |= (Rn >> b & 1) << (63 - b);     // bit b moves to bit 63 - b

// .16b: uint8_t Vd[16], Vn[16] (each byte reversed on its own)
for (int i = 0; i < 16; i++) {
  Vd[i] = 0;
  for (int b = 0; b < 8; b++) Vd[i] |= (Vn[i] >> b & 1) << (7 - b);
}`,
    intrinsic: "__rbitll",
  },
  REV: {
    c: `// uint64_t Rd, Rn
Rd = __builtin_bswap64(Rn);            // the eight bytes in reverse order`,
    intrinsic: "__revll",
  },
  REV16: {
    c: `// uint64_t Rd, Rn
Rd = (Rn & 0x00ff00ff00ff00ff) << 8 | (Rn >> 8 & 0x00ff00ff00ff00ff);

// .16b: uint8_t Vd[16], Vn[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i ^ 1];   // swap each pair of bytes`,
    intrinsic: "__rev16ll",
  },
  REV32: {
    c: `// uint64_t Rd, Rn
Rd = (uint64_t)__builtin_bswap32(Rn >> 32) << 32 | __builtin_bswap32(Rn);

// .16b: uint8_t Vd[16], Vn[16]
for (int i = 0; i < 16; i++) Vd[i] = Vn[i ^ 3];   // reverse each group of 4`,
    intrinsic: "vrev32q_u8",
  },
  LSL: {
    c: `// uint64_t Rd, Rn; int shift (0 to 63)
Rd = Rn << shift;`,
  },
  LSR: {
    c: `// uint64_t Rd, Rn; int shift (0 to 63)
Rd = Rn >> shift;                      // zeros shift in at the top`,
  },
  ASR: {
    c: `// int64_t Rd, Rn; int shift (0 to 63)
Rd = Rn >> shift;                      // copies of the sign bit shift in`,
  },
  ROR: {
    c: `// uint64_t Rd, Rn; int shift (0 to 63)
Rd = shift == 0 ? Rn : Rn >> shift | Rn << (64 - shift);`,
    intrinsic: "__rorll",
  },
  SBFX: {
    c: `// int64_t Rd; uint64_t Rn; int lsb, width
Rd = (int64_t)(Rn << (64 - lsb - width)) >> (64 - width);   // sign-extended`,
  },
  SXTB: {
    c: `// int64_t Rd; uint32_t Rn
Rd = (int8_t)Rn;                       // the low byte, sign-extended`,
  },
  SXTH: {
    c: `// int64_t Rd; uint32_t Rn
Rd = (int16_t)Rn;                      // the low halfword, sign-extended`,
  },
  SXTW: {
    c: `// int64_t Rd; uint32_t Rn
Rd = (int32_t)Rn;`,
  },
  UXTB: {
    c: `// uint32_t Rd, Rn
Rd = (uint8_t)Rn;                      // the low byte, the rest zero`,
  },
  UXTH: {
    c: `// uint32_t Rd, Rn
Rd = (uint16_t)Rn;`,
  },
  UXTW: {
    c: `// uint64_t Rd; uint32_t Rn
Rd = Rn;                               // the top 32 bits become 0`,
  },
  UBFX: {
    c: `// uint64_t Rd, Rn; int lsb, width
uint64_t mask = ~0ULL >> (64 - width); // width ones
Rd = Rn >> lsb & mask;`,
  },
  BFI: {
    c: `// uint64_t Rd, Rn; int lsb, width
uint64_t mask = ~0ULL >> (64 - width);
Rd = (Rd & ~(mask << lsb)) | (Rn & mask) << lsb;   // the rest of Rd stays`,
  },
  BFXIL: {
    c: `// uint64_t Rd, Rn; int lsb, width
uint64_t mask = ~0ULL >> (64 - width);
Rd = (Rd & ~mask) | (Rn >> lsb & mask);            // the rest of Rd stays`,
  },
  UBFIZ: {
    c: `// uint64_t Rd, Rn; int lsb, width
uint64_t mask = ~0ULL >> (64 - width);
Rd = (Rn & mask) << lsb;               // everything else is zero`,
  },
  SBFIZ: {
    c: `// int64_t Rd; uint64_t Rn; int lsb, width
Rd = (int64_t)(Rn << (64 - width)) >> (64 - width - lsb);   // sign-extended`,
  },

  // compare and test
  CMP: {
    c: `// uint64_t Rn, op2; int N, Z, C, V
uint64_t r = Rn - op2;                 // subs, with the result thrown away
N = r >> 63;
Z = r == 0;
C = Rn >= op2;                         // no borrow
V = ((Rn ^ op2) & (Rn ^ r)) >> 63;`,
  },
  CMN: {
    c: `// uint64_t Rn, op2; int N, Z, C, V
uint64_t r = Rn + op2;                 // adds, with the result thrown away
N = r >> 63;
Z = r == 0;
C = r < Rn;                            // the unsigned sum carried out
V = ((Rn ^ r) & (op2 ^ r)) >> 63;`,
  },
  TST: {
    c: `// uint64_t Rn, op2; int N, Z, C, V
uint64_t r = Rn & op2;                 // ands, with the result thrown away
N = r >> 63;
Z = r == 0;
C = 0;
V = 0;`,
  },
  CCMP: {
    c: `// uint64_t Rn, op2; int nzcv, cond, N, Z, C, V
if (cond) {                            // compare, exactly as cmp does
  uint64_t r = Rn - op2;
  N = r >> 63;
  Z = r == 0;
  C = Rn >= op2;
  V = ((Rn ^ op2) & (Rn ^ r)) >> 63;
} else {                               // write the #nzcv literal instead
  N = nzcv >> 3 & 1;
  Z = nzcv >> 2 & 1;
  C = nzcv >> 1 & 1;
  V = nzcv & 1;
}`,
  },
  CCMN: {
    c: `// uint64_t Rn, op2; int nzcv, cond, N, Z, C, V
if (cond) {                            // compare, exactly as cmn does
  uint64_t r = Rn + op2;
  N = r >> 63;
  Z = r == 0;
  C = r < Rn;
  V = ((Rn ^ r) & (op2 ^ r)) >> 63;
} else {                               // write the #nzcv literal instead
  N = nzcv >> 3 & 1;
  Z = nzcv >> 2 & 1;
  C = nzcv >> 1 & 1;
  V = nzcv & 1;
}`,
  },

  // conditional select
  CSEL: {
    c: `// uint64_t Rd, Rn, Rm; int cond
Rd = cond ? Rn : Rm;`,
  },
  CSINC: {
    c: `// uint64_t Rd, Rn, Rm; int cond
Rd = cond ? Rn : Rm + 1;`,
  },
  CSINV: {
    c: `// uint64_t Rd, Rn, Rm; int cond
Rd = cond ? Rn : ~Rm;`,
  },
  CSNEG: {
    c: `// uint64_t Rd, Rn, Rm; int cond
Rd = cond ? Rn : 0 - Rm;`,
  },
  CSET: {
    c: `// uint64_t Rd; int cond
Rd = cond ? 1 : 0;`,
  },
  CSETM: {
    c: `// uint64_t Rd; int cond
Rd = cond ? UINT64_MAX : 0;            // all ones, or zero`,
  },
  CINC: {
    c: `// uint64_t Rd, Rn; int cond
Rd = cond ? Rn + 1 : Rn;`,
  },
  CINV: {
    c: `// uint64_t Rd, Rn; int cond
Rd = cond ? ~Rn : Rn;`,
  },
  CNEG: {
    c: `// uint64_t Rd, Rn; int cond
Rd = cond ? 0 - Rn : Rn;`,
  },

  // memory
  LDR: {
    c: `// uint64_t Xt; uint32_t Wt; double Dt; char *Xn; int64_t off
Xt = *(uint64_t *)(Xn + off);          // ldr xt, [xn, off]: 8 bytes
Wt = *(uint32_t *)(Xn + off);          // ldr wt: 4 bytes, the top of xt cleared
Dt = *(double *)(Xn + off);            // ldr dt: into the floating-point file
// [xn, off]! adds off to Xn before the load; [xn], off adds it after`,
  },
  STR: {
    c: `// uint64_t Xt; uint32_t Wt; double Dt; char *Xn; int64_t off
*(uint64_t *)(Xn + off) = Xt;          // str xt, [xn, off]: 8 bytes
*(uint32_t *)(Xn + off) = Wt;          // str wt: 4 bytes
*(double *)(Xn + off) = Dt;            // str dt: from the floating-point file
// [xn, off]! adds off to Xn before the store; [xn], off adds it after`,
  },
  LDRB: {
    c: `// uint32_t Wt; char *Xn; int64_t off
Wt = *(uint8_t *)(Xn + off);           // one byte, zero-extended`,
  },
  STRB: {
    c: `// uint32_t Wt; char *Xn; int64_t off
*(uint8_t *)(Xn + off) = (uint8_t)Wt;  // the low byte only`,
  },
  LDRH: {
    c: `// uint32_t Wt; char *Xn; int64_t off
Wt = *(uint16_t *)(Xn + off);          // two bytes, zero-extended`,
  },
  STRH: {
    c: `// uint32_t Wt; char *Xn; int64_t off
*(uint16_t *)(Xn + off) = (uint16_t)Wt;   // the low halfword only`,
  },
  LDRSB: {
    c: `// int64_t Xt; int32_t Wt; char *Xn; int64_t off
Xt = *(int8_t *)(Xn + off);            // ldrsb xt: one byte, sign-extended
Wt = *(int8_t *)(Xn + off);            // ldrsb wt: to 32 bits, the top of xt cleared`,
  },
  LDRSH: {
    c: `// int64_t Xt; int32_t Wt; char *Xn; int64_t off
Xt = *(int16_t *)(Xn + off);           // ldrsh xt: two bytes, sign-extended
Wt = *(int16_t *)(Xn + off);           // ldrsh wt: to 32 bits, the top of xt cleared`,
  },
  LDRSW: {
    c: `// int64_t Xt; char *Xn; int64_t off
Xt = *(int32_t *)(Xn + off);           // four bytes, sign-extended`,
  },
  LDP: {
    c: `// uint64_t Xt1, Xt2; char *Xn; int64_t off
Xt1 = *(uint64_t *)(Xn + off);
Xt2 = *(uint64_t *)(Xn + off + 8);     // the next 8 bytes (4 for w, 16 for q)
// ldp xt1, xt2, [sp], 16 is the pop: load, then sp += 16`,
  },
  STP: {
    c: `// uint64_t Xt1, Xt2; char *Xn; int64_t off
*(uint64_t *)(Xn + off) = Xt1;
*(uint64_t *)(Xn + off + 8) = Xt2;     // the next 8 bytes (4 for w, 16 for q)
// stp xt1, xt2, [sp, -16]! is the push: sp -= 16, then store`,
  },
  LDUR: {
    c: `// double Dt; char *Xn; int64_t off (-256 to 255)
Dt = *(double *)(Xn + off);            // off counts bytes and is never scaled`,
  },
  STUR: {
    c: `// double Dt; char *Xn; int64_t off (-256 to 255)
*(double *)(Xn + off) = Dt;            // off counts bytes and is never scaled`,
  },
  LDNP: {
    c: `// double Dt1, Dt2; char *Xn; int64_t off
Dt1 = *(double *)(Xn + off);
Dt2 = *(double *)(Xn + off + 8);       // an ldp with a hint not to cache`,
  },
  STNP: {
    c: `// double Dt1, Dt2; char *Xn; int64_t off
*(double *)(Xn + off) = Dt1;
*(double *)(Xn + off + 8) = Dt2;       // an stp with a hint not to cache`,
  },

  // pc-relative addressing
  ADR: {
    c: `// uint64_t Xd
Xd = (uint64_t)&label;                 // any label within 1 MiB of the pc`,
  },
  ADRP: {
    c: `// uint64_t Xd
Xd = (uint64_t)&label & ~0xfffULL;     // the start of label's 4 KiB page
// add xd, xd, :lo12:label then adds the low 12 bits back`,
  },

  // branches
  B: {
    c: `goto label;`,
  },
  BL: {
    c: `label();                               // x30 = the address of the next instruction`,
  },
  BR: {
    c: `// void *Xn
goto *Xn;                              // gcc's computed goto`,
  },
  BLR: {
    c: `// void (*Xn)(void)
Xn();                                  // x30 = the address of the next instruction`,
  },
  RET: {
    c: `return;                                // jumps to the address in x30 (ret xn: in xn)`,
  },
  "B.COND": {
    c: `// int cond (b.eq: Z == 1, b.lt: N != V, and so on)
if (cond) goto label;`,
  },
  CBZ: {
    c: `// uint64_t Rt
if (Rt == 0) goto label;`,
  },
  CBNZ: {
    c: `// uint64_t Rt
if (Rt != 0) goto label;`,
  },
  TBZ: {
    c: `// uint64_t Rt; int bit
if ((Rt >> bit & 1) == 0) goto label;`,
  },
  TBNZ: {
    c: `// uint64_t Rt; int bit
if (Rt >> bit & 1) goto label;`,
  },

  // system
  NOP: {
    c: `;                                      // nothing happens; the pc moves on by 4`,
  },
  SVC: {
    c: `// uint64_t X0, X1, X2, X8 (svc 0: the kernel reads the call number in x8)
X0 = syscall(X8, X0, X1, X2);          // x8 = 64 is write(x0, x1, x2)`,
  },

  // floating point
  FMOV: {
    c: `// double Dd, Dn; uint64_t Xd, Xn
Dd = Dn;                               // fmov dd, dn
memcpy(&Dd, &Xn, 8);                   // fmov dd, xn: the bits, not the value
memcpy(&Xd, &Dn, 8);                   // fmov xd, dn
Dd = 5.0;                              // fmov dd, 5.0: only a few constants encode`,
  },
  FADD: {
    c: `// double Dd, Dn, Dm (float for the s form)
Dd = Dn + Dm;

// .4s: float Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) Vd[i] = Vn[i] + Vm[i];`,
    intrinsic: "vaddq_f32",
  },
  FSUB: {
    c: `// double Dd, Dn, Dm (float for the s form)
Dd = Dn - Dm;

// .4s: float Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) Vd[i] = Vn[i] - Vm[i];`,
    intrinsic: "vsubq_f32",
  },
  FMUL: {
    c: `// double Dd, Dn, Dm (float for the s form)
Dd = Dn * Dm;

// .4s: float Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) Vd[i] = Vn[i] * Vm[i];`,
    intrinsic: "vmulq_f32",
  },
  FDIV: {
    c: `// double Dd, Dn, Dm (float for the s form)
Dd = Dn / Dm;

// .4s: float Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) Vd[i] = Vn[i] / Vm[i];`,
    intrinsic: "vdivq_f32",
  },
  FNEG: {
    c: `// double Dd, Dn
Dd = -Dn;                              // only the sign bit flips

// .4s: float Vd[4], Vn[4]
for (int i = 0; i < 4; i++) Vd[i] = -Vn[i];`,
    intrinsic: "vnegq_f32",
  },
  FABS: {
    c: `// double Dd, Dn
Dd = fabs(Dn);                         // only the sign bit clears

// .4s: float Vd[4], Vn[4]
for (int i = 0; i < 4; i++) Vd[i] = fabsf(Vn[i]);`,
    intrinsic: "vabsq_f32",
  },
  FSQRT: {
    c: `// double Dd, Dn
Dd = sqrt(Dn);                         // a negative Dn gives NaN, no fault

// .4s: float Vd[4], Vn[4]
for (int i = 0; i < 4; i++) Vd[i] = sqrtf(Vn[i]);`,
    intrinsic: "vsqrtq_f32",
  },
  FCMP: {
    c: `// double Dn, Dm; int N, Z, C, V
if (isnan(Dn) || isnan(Dm)) { N = 0; Z = 0; C = 1; V = 1; }   // unordered
else if (Dn == Dm) { N = 0; Z = 1; C = 1; V = 0; }
else if (Dn < Dm)  { N = 1; Z = 0; C = 0; V = 0; }
else               { N = 0; Z = 0; C = 1; V = 0; }`,
  },
  FCMPE: {
    c: `// double Dn, Dm; int N, Z, C, V (the same flags fcmp sets)
if (isnan(Dn) || isnan(Dm)) { N = 0; Z = 0; C = 1; V = 1; }   // unordered
else if (Dn == Dm) { N = 0; Z = 1; C = 1; V = 0; }
else if (Dn < Dm)  { N = 1; Z = 0; C = 0; V = 0; }
else               { N = 0; Z = 0; C = 1; V = 0; }`,
  },
  FCVT: {
    c: `// double Dd; float Sn
Dd = Sn;                               // fcvt dd, sn: widening is exact

// float Sd; double Dn
Sd = (float)Dn;                        // fcvt sd, dn: rounds to the nearest float`,
  },
  SCVTF: {
    c: `// double Dd; int64_t Xn; int fbits (0 when there is no third operand)
Dd = ldexp((double)Xn, -fbits);        // Xn counts steps of 1 / 2^fbits

// .4s: float Vd[4]; int32_t Vn[4]
for (int i = 0; i < 4; i++) Vd[i] = (float)Vn[i];`,
    intrinsic: "vcvtq_f32_s32",
  },
  FCVTZS: {
    c: `// int32_t Wd; double Dn; int fbits (0 when there is no third operand)
double v = ldexp(Dn, fbits);           // the fixed-point form scales first
if (isnan(v)) Wd = 0;
else if (v >= 0x1p31) Wd = INT32_MAX;  // too big saturates
else if (v <= -0x1p31) Wd = INT32_MIN;
else Wd = (int32_t)v;                  // C's cast rounds toward zero too
// the vector form converts each lane the same way`,
    intrinsic: "vcvtq_s32_f32",
  },
  FCVTNS: {
    c: `// int32_t Wd; double Dn
double r = nearbyint(Dn);              // nearest, ties to even (C's default)
if (isnan(r)) Wd = 0;
else if (r >= 0x1p31) Wd = INT32_MAX;  // too big saturates
else if (r <= -0x1p31) Wd = INT32_MIN;
else Wd = (int32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtnq_s32_f32",
  },
  FCVTNU: {
    c: `// uint32_t Wd; double Dn
double r = nearbyint(Dn);              // nearest, ties to even (C's default)
if (isnan(r) || r <= 0) Wd = 0;        // negatives saturate to 0
else if (r >= 0x1p32) Wd = UINT32_MAX;
else Wd = (uint32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtnq_u32_f32",
  },
  FCVTZU: {
    c: `// uint32_t Wd; double Dn
if (isnan(Dn) || Dn <= 0) Wd = 0;      // negatives saturate to 0
else if (Dn >= 0x1p32) Wd = UINT32_MAX;
else Wd = (uint32_t)Dn;                // C's cast rounds toward zero too
// the vector form converts each lane the same way`,
    intrinsic: "vcvtq_u32_f32",
  },
  FCVTAS: {
    c: `// int32_t Wd; double Dn
double r = round(Dn);                  // nearest, ties away from zero
if (isnan(r)) Wd = 0;
else if (r >= 0x1p31) Wd = INT32_MAX;  // too big saturates
else if (r <= -0x1p31) Wd = INT32_MIN;
else Wd = (int32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtaq_s32_f32",
  },
  FCVTAU: {
    c: `// uint32_t Wd; double Dn
double r = round(Dn);                  // nearest, ties away from zero
if (isnan(r) || r <= 0) Wd = 0;        // negatives saturate to 0
else if (r >= 0x1p32) Wd = UINT32_MAX;
else Wd = (uint32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtaq_u32_f32",
  },
  FCVTMS: {
    c: `// int32_t Wd; double Dn
double r = floor(Dn);                  // toward minus infinity
if (isnan(r)) Wd = 0;
else if (r >= 0x1p31) Wd = INT32_MAX;  // too big saturates
else if (r <= -0x1p31) Wd = INT32_MIN;
else Wd = (int32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtmq_s32_f32",
  },
  FCVTMU: {
    c: `// uint32_t Wd; double Dn
double r = floor(Dn);                  // toward minus infinity
if (isnan(r) || r <= 0) Wd = 0;        // negatives saturate to 0
else if (r >= 0x1p32) Wd = UINT32_MAX;
else Wd = (uint32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtmq_u32_f32",
  },
  FCVTPS: {
    c: `// int32_t Wd; double Dn
double r = ceil(Dn);                   // toward plus infinity
if (isnan(r)) Wd = 0;
else if (r >= 0x1p31) Wd = INT32_MAX;  // too big saturates
else if (r <= -0x1p31) Wd = INT32_MIN;
else Wd = (int32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtpq_s32_f32",
  },
  FCVTPU: {
    c: `// uint32_t Wd; double Dn
double r = ceil(Dn);                   // toward plus infinity
if (isnan(r) || r <= 0) Wd = 0;        // negatives saturate to 0
else if (r >= 0x1p32) Wd = UINT32_MAX;
else Wd = (uint32_t)r;
// the vector form converts each lane the same way`,
    intrinsic: "vcvtpq_u32_f32",
  },
  UCVTF: {
    c: `// double Dd; uint64_t Xn
Dd = (double)Xn;                       // the bits read as unsigned

// .4s: float Vd[4]; uint32_t Vn[4]
for (int i = 0; i < 4; i++) Vd[i] = (float)Vn[i];`,
    intrinsic: "vcvtq_f32_u32",
  },
  FCSEL: {
    c: `// double Dd, Dn, Dm; int cond
Dd = cond ? Dn : Dm;                   // the bits are copied, NaN or -0.0 alike`,
  },
  FMAX: {
    c: `// double Dd, Dn, Dm
if (isnan(Dn) || isnan(Dm)) Dd = NAN;  // a NaN operand makes a NaN
else if (Dn == Dm) Dd = signbit(Dn) ? Dm : Dn;   // +0.0 beats -0.0
else Dd = Dn > Dm ? Dn : Dm;
// the vector form does the same in each lane`,
    intrinsic: "vmaxq_f32",
  },
  FMIN: {
    c: `// double Dd, Dn, Dm
if (isnan(Dn) || isnan(Dm)) Dd = NAN;  // a NaN operand makes a NaN
else if (Dn == Dm) Dd = signbit(Dn) ? Dn : Dm;   // -0.0 beats +0.0
else Dd = Dn < Dm ? Dn : Dm;
// the vector form does the same in each lane`,
    intrinsic: "vminq_f32",
  },
  FMAXNM: {
    c: `// double Dd, Dn, Dm
Dd = fmax(Dn, Dm);                     // C's fmax: a quiet NaN is ignored

// .4s: float Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) Vd[i] = fmaxf(Vn[i], Vm[i]);`,
    intrinsic: "vmaxnmq_f32",
  },
  FMINNM: {
    c: `// double Dd, Dn, Dm
Dd = fmin(Dn, Dm);                     // C's fmin: a quiet NaN is ignored

// .4s: float Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) Vd[i] = fminf(Vn[i], Vm[i]);`,
    intrinsic: "vminnmq_f32",
  },
  FNMUL: {
    c: `// double Dd, Dn, Dm
Dd = -(Dn * Dm);                       // the sign flips after the multiply`,
  },
  FMADD: {
    c: `// double Dd, Dn, Dm, Da
Dd = fma(Dn, Dm, Da);                  // Da + Dn * Dm, rounded once`,
  },
  FMSUB: {
    c: `// double Dd, Dn, Dm, Da
Dd = fma(-Dn, Dm, Da);                 // Da - Dn * Dm, rounded once`,
  },
  FNMADD: {
    c: `// double Dd, Dn, Dm, Da
Dd = -fma(Dn, Dm, Da);                 // -Da - Dn * Dm, rounded once`,
  },
  FNMSUB: {
    c: `// double Dd, Dn, Dm, Da
Dd = fma(Dn, Dm, -Da);                 // -Da + Dn * Dm, rounded once`,
  },

  // advanced simd: moves and immediates
  MOVI: {
    c: `// .16b: uint8_t Vd[16]; uint8_t imm
for (int i = 0; i < 16; i++) Vd[i] = imm;`,
    intrinsic: "vdupq_n_u8",
  },
  MVNI: {
    c: `// .4h: uint16_t Vd[4]; uint8_t imm
for (int i = 0; i < 4; i++) Vd[i] = ~imm;   // 0x55 gives 0xffaa`,
    intrinsic: "vdup_n_u16",
  },
  DUP: {
    c: `// .8b: uint8_t Vd[8]; uint32_t Wn
for (int i = 0; i < 8; i++) Vd[i] = Wn;     // the low byte, in every lane

// .4s from a lane: uint32_t Vd[4], Vn[4]; int j
for (int i = 0; i < 4; i++) Vd[i] = Vn[j];`,
    intrinsic: "vdup_n_u8",
  },
  INS: {
    c: `// uint8_t Vd[16]; uint32_t Wn; int j (the lane, 0 to 15)
Vd[j] = Wn;                            // the other lanes keep their values`,
    intrinsic: "vsetq_lane_u8",
  },
  UMOV: {
    c: `// uint32_t Wd; uint8_t Vn[16]; int j (the lane, 0 to 15)
Wd = Vn[j];                            // zero-extended`,
    intrinsic: "vgetq_lane_u8",
  },
  SMOV: {
    c: `// int32_t Wd; int8_t Vn[16]; int j (the lane, 0 to 15)
Wd = Vn[j];                            // sign-extended`,
    intrinsic: "vgetq_lane_s8",
  },

  // advanced simd: three-same
  MLA: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] += Vn[i] * Vm[i];   // wraps at 8 bits`,
    intrinsic: "vmla_u8",
  },
  MLS: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] -= Vn[i] * Vm[i];   // wraps at 8 bits`,
    intrinsic: "vmls_u8",
  },
  PMUL: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) {
  Vd[i] = 0;
  for (int b = 0; b < 8; b++)          // xor where multiply would add
    if (Vm[i] >> b & 1) Vd[i] ^= Vn[i] << b;
}`,
    intrinsic: "vmul_p8",
  },
  BSL: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // Vd is the mask: 1 picks Vn, 0 picks Vm
  Vd[i] = (Vd[i] & Vn[i]) | (~Vd[i] & Vm[i]);`,
    intrinsic: "vbsl_u8",
  },
  BIT: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // where Vm has a 1, take Vn's bit
  Vd[i] = (Vm[i] & Vn[i]) | (~Vm[i] & Vd[i]);`,
  },
  BIF: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // where Vm has a 0, take Vn's bit
  Vd[i] = (~Vm[i] & Vn[i]) | (Vm[i] & Vd[i]);`,
  },
  NOT: {
    c: `// .8b: uint8_t Vd[8], Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = ~Vn[i];`,
    intrinsic: "vmvn_u8",
  },

  // advanced simd: compares
  CMEQ: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] == Vm[i] ? 0xff : 0;`,
    intrinsic: "vceq_u8",
  },
  CMGT: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] > Vm[i] ? 0xff : 0;`,
    intrinsic: "vcgt_s8",
  },
  CMGE: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] >= Vm[i] ? 0xff : 0;`,
    intrinsic: "vcge_s8",
  },
  CMHI: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] > Vm[i] ? 0xff : 0;`,
    intrinsic: "vcgt_u8",
  },
  CMHS: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] >= Vm[i] ? 0xff : 0;`,
    intrinsic: "vcge_u8",
  },
  CMLE: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] <= 0 ? 0xff : 0;`,
    intrinsic: "vclez_s8",
  },
  CMLT: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] < 0 ? 0xff : 0;`,
    intrinsic: "vcltz_s8",
  },
  CMTST: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] & Vm[i]) != 0 ? 0xff : 0;`,
    intrinsic: "vtst_u8",
  },

  // advanced simd: saturating and halving
  SQADD: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) {
  int sum = Vn[i] + Vm[i];             // in int, so nothing wraps
  Vd[i] = sum > 127 ? 127 : sum < -128 ? -128 : sum;
}`,
    intrinsic: "vqadd_s8",
  },
  UQADD: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) {
  int sum = Vn[i] + Vm[i];
  Vd[i] = sum > 255 ? 255 : sum;
}`,
    intrinsic: "vqadd_u8",
  },
  SQSUB: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) {
  int diff = Vn[i] - Vm[i];
  Vd[i] = diff > 127 ? 127 : diff < -128 ? -128 : diff;
}`,
    intrinsic: "vqsub_s8",
  },
  UQSUB: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] > Vm[i] ? Vn[i] - Vm[i] : 0;`,
    intrinsic: "vqsub_u8",
  },
  SUQADD: {
    c: `// .8b: int8_t Vd[8]; uint8_t Vn[8]
for (int i = 0; i < 8; i++) {
  int sum = Vd[i] + Vn[i];
  Vd[i] = sum > 127 ? 127 : sum;
}`,
    intrinsic: "vuqadd_s8",
  },
  USQADD: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8]
for (int i = 0; i < 8; i++) {
  int sum = Vd[i] + Vn[i];
  Vd[i] = sum > 255 ? 255 : sum < 0 ? 0 : sum;
}`,
    intrinsic: "vsqadd_u8",
  },
  SQABS: {
    c: `// .8b: int8_t Vd[8], Vn[8]
for (int i = 0; i < 8; i++)
  Vd[i] = Vn[i] == -128 ? 127 : Vn[i] < 0 ? -Vn[i] : Vn[i];`,
    intrinsic: "vqabs_s8",
  },
  SQNEG: {
    c: `// .8b: int8_t Vd[8], Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] == -128 ? 127 : -Vn[i];`,
    intrinsic: "vqneg_s8",
  },
  SHADD: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] + Vm[i]) >> 1;   // summed in int`,
    intrinsic: "vhadd_s8",
  },
  UHADD: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] + Vm[i]) >> 1;   // summed in int`,
    intrinsic: "vhadd_u8",
  },
  SRHADD: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] + Vm[i] + 1) >> 1;`,
    intrinsic: "vrhadd_s8",
  },
  URHADD: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] + Vm[i] + 1) >> 1;`,
    intrinsic: "vrhadd_u8",
  },
  SHSUB: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] - Vm[i]) >> 1;`,
    intrinsic: "vhsub_s8",
  },
  UHSUB: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] - Vm[i]) >> 1;`,
    intrinsic: "vhsub_u8",
  },
  SQDMULH: {
    c: `// .4h: int16_t Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) {
  int64_t p = 2 * (int64_t)Vn[i] * Vm[i] >> 16;   // the high half
  Vd[i] = p > 32767 ? 32767 : p;       // only -32768 * -32768 saturates
}`,
    intrinsic: "vqdmulh_s16",
  },
  SQRDMULH: {
    c: `// .4h: int16_t Vd[4], Vn[4], Vm[4]
for (int i = 0; i < 4; i++) {
  int64_t p = (2 * (int64_t)Vn[i] * Vm[i] + 0x8000) >> 16;   // rounded
  Vd[i] = p > 32767 ? 32767 : p;
}`,
    intrinsic: "vqrdmulh_s16",
  },

  // advanced simd: max, min and across lanes
  SMAX: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] > Vm[i] ? Vn[i] : Vm[i];`,
    intrinsic: "vmax_s8",
  },
  SMIN: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] < Vm[i] ? Vn[i] : Vm[i];`,
    intrinsic: "vmin_s8",
  },
  UMAX: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] > Vm[i] ? Vn[i] : Vm[i];`,
    intrinsic: "vmax_u8",
  },
  UMIN: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] < Vm[i] ? Vn[i] : Vm[i];`,
    intrinsic: "vmin_u8",
  },
  SMAXP: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // Vn's pairs fill the low half
  Vd[i] = Vn[2*i] > Vn[2*i+1] ? Vn[2*i] : Vn[2*i+1];
  Vd[4+i] = Vm[2*i] > Vm[2*i+1] ? Vm[2*i] : Vm[2*i+1];
}`,
    intrinsic: "vpmax_s8",
  },
  SMINP: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // Vn's pairs fill the low half
  Vd[i] = Vn[2*i] < Vn[2*i+1] ? Vn[2*i] : Vn[2*i+1];
  Vd[4+i] = Vm[2*i] < Vm[2*i+1] ? Vm[2*i] : Vm[2*i+1];
}`,
    intrinsic: "vpmin_s8",
  },
  UMAXP: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // Vn's pairs fill the low half
  Vd[i] = Vn[2*i] > Vn[2*i+1] ? Vn[2*i] : Vn[2*i+1];
  Vd[4+i] = Vm[2*i] > Vm[2*i+1] ? Vm[2*i] : Vm[2*i+1];
}`,
    intrinsic: "vpmax_u8",
  },
  UMINP: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // Vn's pairs fill the low half
  Vd[i] = Vn[2*i] < Vn[2*i+1] ? Vn[2*i] : Vn[2*i+1];
  Vd[4+i] = Vm[2*i] < Vm[2*i+1] ? Vm[2*i] : Vm[2*i+1];
}`,
    intrinsic: "vpmin_u8",
  },
  ADDP: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // Vn's pairs fill the low half
  Vd[i] = Vn[2*i] + Vn[2*i+1];
  Vd[4+i] = Vm[2*i] + Vm[2*i+1];
}

// addp dd, vn.2d: uint64_t Dd, Vn[2]
Dd = Vn[0] + Vn[1];`,
    intrinsic: "vpadd_u8",
  },
  ADDV: {
    c: `// uint8_t Bd, Vn[8]
Bd = 0;
for (int i = 0; i < 8; i++) Bd += Vn[i];   // the total wraps at 8 bits`,
    intrinsic: "vaddv_u8",
  },
  SADDLV: {
    c: `// int16_t Hd; int8_t Vn[8]
Hd = 0;
for (int i = 0; i < 8; i++) Hd += Vn[i];   // twice as wide: it cannot wrap`,
    intrinsic: "vaddlv_s8",
  },
  UADDLV: {
    c: `// uint16_t Hd; uint8_t Vn[8]
Hd = 0;
for (int i = 0; i < 8; i++) Hd += Vn[i];   // twice as wide: it cannot wrap`,
    intrinsic: "vaddlv_u8",
  },
  SMAXV: {
    c: `// int8_t Bd, Vn[8]
Bd = Vn[0];
for (int i = 1; i < 8; i++) if (Vn[i] > Bd) Bd = Vn[i];`,
    intrinsic: "vmaxv_s8",
  },
  SMINV: {
    c: `// int8_t Bd, Vn[8]
Bd = Vn[0];
for (int i = 1; i < 8; i++) if (Vn[i] < Bd) Bd = Vn[i];`,
    intrinsic: "vminv_s8",
  },
  UMAXV: {
    c: `// uint8_t Bd, Vn[8]
Bd = Vn[0];
for (int i = 1; i < 8; i++) if (Vn[i] > Bd) Bd = Vn[i];`,
    intrinsic: "vmaxv_u8",
  },
  UMINV: {
    c: `// uint8_t Bd, Vn[8]
Bd = Vn[0];
for (int i = 1; i < 8; i++) if (Vn[i] < Bd) Bd = Vn[i];`,
    intrinsic: "vminv_u8",
  },
  SADDLP: {
    c: `// .4h from .8b: int16_t Vd[4]; int8_t Vn[8]
for (int i = 0; i < 4; i++) Vd[i] = Vn[2*i] + Vn[2*i+1];`,
    intrinsic: "vpaddl_s8",
  },
  UADDLP: {
    c: `// .4h from .8b: uint16_t Vd[4]; uint8_t Vn[8]
for (int i = 0; i < 4; i++) Vd[i] = Vn[2*i] + Vn[2*i+1];`,
    intrinsic: "vpaddl_u8",
  },
  SADALP: {
    c: `// .4h from .8b: int16_t Vd[4]; int8_t Vn[8]
for (int i = 0; i < 4; i++) Vd[i] += Vn[2*i] + Vn[2*i+1];   // wraps at 16 bits`,
    intrinsic: "vpadal_s8",
  },
  UADALP: {
    c: `// .4h from .8b: uint16_t Vd[4]; uint8_t Vn[8]
for (int i = 0; i < 4; i++) Vd[i] += Vn[2*i] + Vn[2*i+1];   // wraps at 16 bits`,
    intrinsic: "vpadal_u8",
  },

  // advanced simd: absolute differences
  SABD: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)
  Vd[i] = Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vabd_s8",
  },
  UABD: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++)
  Vd[i] = Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vabd_u8",
  },
  SABA: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // added to Vd, wrapping at 8 bits
  Vd[i] += Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vaba_s8",
  },
  UABA: {
    c: `// .8b: uint8_t Vd[8], Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // added to Vd, wrapping at 8 bits
  Vd[i] += Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vaba_u8",
  },

  // advanced simd: two-register misc
  ABS: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] < 0 ? -Vn[i] : Vn[i];   // -128 gives 0x80`,
    intrinsic: "vabs_s8",
  },
  CNT: {
    c: `// .8b: uint8_t Vd[8], Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = __builtin_popcount(Vn[i]);   // the 1 bits`,
    intrinsic: "vcnt_u8",
  },
  REV64: {
    c: `// .8b: uint8_t Vd[8], Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i ^ 7];   // the eight bytes reversed`,
    intrinsic: "vrev64_u8",
  },
  URECPE: {
    c: `// .2s: uint32_t Vd[2], Vn[2] (fractions: 0x80000000 is 0.5)
for (int i = 0; i < 2; i++) {
  if (Vn[i] < 0x80000000) { Vd[i] = 0xffffffff; continue; }   // below 0.5
  uint32_t a = (Vn[i] >> 23) * 2 + 1;  // the top 9 bits, made odd
  uint32_t r = ((1 << 19) / a + 1) / 2;   // 256 to 511, about 1 / Vn
  Vd[i] = r << 23;
}`,
    intrinsic: "vrecpe_u32",
  },
  URSQRTE: {
    c: `// .2s: uint32_t Vd[2], Vn[2] (fractions: 0x40000000 is 0.25)
for (int i = 0; i < 2; i++) {
  if (Vn[i] < 0x40000000) { Vd[i] = 0xffffffff; continue; }   // below 0.25
  uint32_t a = Vn[i] >> 23;            // the top 9 bits
  a = a < 256 ? a * 2 + 1 : (a | 1) * 2;
  uint32_t b = 512;
  while (a * (b + 1) * (b + 1) < (1u << 28)) b++;
  Vd[i] = (b + 1) / 2 << 23;           // about 1 / sqrt(Vn)
}`,
    intrinsic: "vrsqrte_u32",
  },

  // advanced simd: widening, narrowing and doubling
  SADDL: {
    c: `// .8h from .8b: int16_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] + Vm[i];   // wide enough not to wrap`,
    intrinsic: "vaddl_s8",
  },
  SADDL2: {
    c: `// .8h from .16b: int16_t Vd[8]; int8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] + Vm[8+i];   // the upper halves`,
    intrinsic: "vaddl_high_s8",
  },
  UADDL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] + Vm[i];`,
    intrinsic: "vaddl_u8",
  },
  UADDL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] + Vm[8+i];   // the upper halves`,
    intrinsic: "vaddl_high_u8",
  },
  SSUBL: {
    c: `// .8h from .8b: int16_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] - Vm[i];`,
    intrinsic: "vsubl_s8",
  },
  SSUBL2: {
    c: `// .8h from .16b: int16_t Vd[8]; int8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] - Vm[8+i];   // the upper halves`,
    intrinsic: "vsubl_high_s8",
  },
  USUBL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] - Vm[i];   // wraps at 16 bits`,
    intrinsic: "vsubl_u8",
  },
  USUBL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] - Vm[8+i];   // the upper halves`,
    intrinsic: "vsubl_high_u8",
  },
  SADDW: {
    c: `// .8h: int16_t Vd[8], Vn[8]; int8_t Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] + Vm[i];   // wraps at 16 bits`,
    intrinsic: "vaddw_s8",
  },
  SADDW2: {
    c: `// .8h: int16_t Vd[8], Vn[8]; int8_t Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] + Vm[8+i];   // Vm's upper half`,
    intrinsic: "vaddw_high_s8",
  },
  UADDW: {
    c: `// .8h: uint16_t Vd[8], Vn[8]; uint8_t Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] + Vm[i];   // wraps at 16 bits`,
    intrinsic: "vaddw_u8",
  },
  UADDW2: {
    c: `// .8h: uint16_t Vd[8], Vn[8]; uint8_t Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] + Vm[8+i];   // Vm's upper half`,
    intrinsic: "vaddw_high_u8",
  },
  SSUBW: {
    c: `// .8h: int16_t Vd[8], Vn[8]; int8_t Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] - Vm[i];   // wraps at 16 bits`,
    intrinsic: "vsubw_s8",
  },
  SSUBW2: {
    c: `// .8h: int16_t Vd[8], Vn[8]; int8_t Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] - Vm[8+i];   // Vm's upper half`,
    intrinsic: "vsubw_high_s8",
  },
  USUBW: {
    c: `// .8h: uint16_t Vd[8], Vn[8]; uint8_t Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] - Vm[i];   // wraps at 16 bits`,
    intrinsic: "vsubw_u8",
  },
  USUBW2: {
    c: `// .8h: uint16_t Vd[8], Vn[8]; uint8_t Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] - Vm[8+i];   // Vm's upper half`,
    intrinsic: "vsubw_high_u8",
  },
  SMULL2: {
    c: `// .8h from .16b: int16_t Vd[8]; int8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] * Vm[8+i];   // the upper halves`,
    intrinsic: "vmull_high_s8",
  },
  UMULL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] * Vm[8+i];   // the upper halves`,
    intrinsic: "vmull_high_u8",
  },
  SMLAL: {
    c: `// .8h from .8b: int16_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] += Vn[i] * Vm[i];   // wraps at 16 bits`,
    intrinsic: "vmlal_s8",
  },
  SMLAL2: {
    c: `// .8h from .16b: int16_t Vd[8]; int8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] += Vn[8+i] * Vm[8+i];`,
    intrinsic: "vmlal_high_s8",
  },
  UMLAL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] += Vn[i] * Vm[i];   // wraps at 16 bits`,
    intrinsic: "vmlal_u8",
  },
  UMLAL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] += Vn[8+i] * Vm[8+i];`,
    intrinsic: "vmlal_high_u8",
  },
  SMLSL: {
    c: `// .8h from .8b: int16_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] -= Vn[i] * Vm[i];   // wraps at 16 bits`,
    intrinsic: "vmlsl_s8",
  },
  SMLSL2: {
    c: `// .8h from .16b: int16_t Vd[8]; int8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] -= Vn[8+i] * Vm[8+i];`,
    intrinsic: "vmlsl_high_s8",
  },
  UMLSL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] -= Vn[i] * Vm[i];   // wraps at 16 bits`,
    intrinsic: "vmlsl_u8",
  },
  UMLSL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) Vd[i] -= Vn[8+i] * Vm[8+i];`,
    intrinsic: "vmlsl_high_u8",
  },
  SABDL: {
    c: `// .8h from .8b: uint16_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)
  Vd[i] = Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vabdl_s8",
  },
  SABDL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; int8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++)            // the upper halves
  Vd[i] = Vn[8+i] > Vm[8+i] ? Vn[8+i] - Vm[8+i] : Vm[8+i] - Vn[8+i];`,
    intrinsic: "vabdl_high_s8",
  },
  UABDL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)
  Vd[i] = Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vabdl_u8",
  },
  UABDL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++)            // the upper halves
  Vd[i] = Vn[8+i] > Vm[8+i] ? Vn[8+i] - Vm[8+i] : Vm[8+i] - Vn[8+i];`,
    intrinsic: "vabdl_high_u8",
  },
  SABAL: {
    c: `// .8h from .8b: uint16_t Vd[8]; int8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // added to Vd, wrapping at 16 bits
  Vd[i] += Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vabal_s8",
  },
  SABAL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; int8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++)            // the upper halves, added to Vd
  Vd[i] += Vn[8+i] > Vm[8+i] ? Vn[8+i] - Vm[8+i] : Vm[8+i] - Vn[8+i];`,
    intrinsic: "vabal_high_s8",
  },
  UABAL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // added to Vd, wrapping at 16 bits
  Vd[i] += Vn[i] > Vm[i] ? Vn[i] - Vm[i] : Vm[i] - Vn[i];`,
    intrinsic: "vabal_u8",
  },
  UABAL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++)            // the upper halves, added to Vd
  Vd[i] += Vn[8+i] > Vm[8+i] ? Vn[8+i] - Vm[8+i] : Vm[8+i] - Vn[8+i];`,
    intrinsic: "vabal_high_u8",
  },
  ADDHN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] + Vm[i]) >> 8;   // the high byte`,
    intrinsic: "vaddhn_u16",
  },
  ADDHN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // the upper half; the lower half stays
  Vd[8+i] = (Vn[i] + Vm[i]) >> 8;`,
    intrinsic: "vaddhn_high_u16",
  },
  RADDHN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] + Vm[i] + 0x80) >> 8;   // rounded`,
    intrinsic: "vraddhn_u16",
  },
  RADDHN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // the upper half; the lower half stays
  Vd[8+i] = (Vn[i] + Vm[i] + 0x80) >> 8;`,
    intrinsic: "vraddhn_high_u16",
  },
  SUBHN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] - Vm[i]) >> 8;   // the high byte`,
    intrinsic: "vsubhn_u16",
  },
  SUBHN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // the upper half; the lower half stays
  Vd[8+i] = (Vn[i] - Vm[i]) >> 8;`,
    intrinsic: "vsubhn_high_u16",
  },
  RSUBHN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] - Vm[i] + 0x80) >> 8;   // rounded`,
    intrinsic: "vrsubhn_u16",
  },
  RSUBHN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++)            // the upper half; the lower half stays
  Vd[8+i] = (Vn[i] - Vm[i] + 0x80) >> 8;`,
    intrinsic: "vrsubhn_high_u16",
  },
  SQDMULL: {
    c: `// .4s from .4h: int32_t Vd[4]; int16_t Vn[4], Vm[4]
for (int i = 0; i < 4; i++) {
  int64_t p = 2 * (int64_t)Vn[i] * Vm[i];
  Vd[i] = p > INT32_MAX ? INT32_MAX : p;   // only -32768 * -32768 saturates
}`,
    intrinsic: "vqdmull_s16",
  },
  SQDMULL2: {
    c: `// .4s from .8h: int32_t Vd[4]; int16_t Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // the upper halves
  int64_t p = 2 * (int64_t)Vn[4+i] * Vm[4+i];
  Vd[i] = p > INT32_MAX ? INT32_MAX : p;
}`,
    intrinsic: "vqdmull_high_s16",
  },
  SQDMLAL: {
    c: `// .4s from .4h: int32_t Vd[4]; int16_t Vn[4], Vm[4]
for (int i = 0; i < 4; i++) {
  int64_t p = 2 * (int64_t)Vn[i] * Vm[i];
  if (p > INT32_MAX) p = INT32_MAX;    // the product saturates first
  int64_t s = Vd[i] + p;               // then the sum
  Vd[i] = s > INT32_MAX ? INT32_MAX : s < INT32_MIN ? INT32_MIN : s;
}`,
    intrinsic: "vqdmlal_s16",
  },
  SQDMLAL2: {
    c: `// .4s from .8h: int32_t Vd[4]; int16_t Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // the upper halves
  int64_t p = 2 * (int64_t)Vn[4+i] * Vm[4+i];
  if (p > INT32_MAX) p = INT32_MAX;
  int64_t s = Vd[i] + p;
  Vd[i] = s > INT32_MAX ? INT32_MAX : s < INT32_MIN ? INT32_MIN : s;
}`,
    intrinsic: "vqdmlal_high_s16",
  },
  SQDMLSL: {
    c: `// .4s from .4h: int32_t Vd[4]; int16_t Vn[4], Vm[4]
for (int i = 0; i < 4; i++) {
  int64_t p = 2 * (int64_t)Vn[i] * Vm[i];
  if (p > INT32_MAX) p = INT32_MAX;    // the product saturates first
  int64_t s = Vd[i] - p;               // then the difference
  Vd[i] = s > INT32_MAX ? INT32_MAX : s < INT32_MIN ? INT32_MIN : s;
}`,
    intrinsic: "vqdmlsl_s16",
  },
  SQDMLSL2: {
    c: `// .4s from .8h: int32_t Vd[4]; int16_t Vn[8], Vm[8]
for (int i = 0; i < 4; i++) {          // the upper halves
  int64_t p = 2 * (int64_t)Vn[4+i] * Vm[4+i];
  if (p > INT32_MAX) p = INT32_MAX;
  int64_t s = Vd[i] - p;
  Vd[i] = s > INT32_MAX ? INT32_MAX : s < INT32_MIN ? INT32_MIN : s;
}`,
    intrinsic: "vqdmlsl_high_s16",
  },
  PMULL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8], Vm[8]
for (int i = 0; i < 8; i++) {
  Vd[i] = 0;
  for (int b = 0; b < 8; b++)          // xor where multiply would add
    if (Vm[i] >> b & 1) Vd[i] ^= Vn[i] << b;
}`,
    intrinsic: "vmull_p8",
  },
  PMULL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16], Vm[16]
for (int i = 0; i < 8; i++) {          // the upper halves
  Vd[i] = 0;
  for (int b = 0; b < 8; b++)
    if (Vm[8+i] >> b & 1) Vd[i] ^= Vn[8+i] << b;
}`,
    intrinsic: "vmull_high_p8",
  },
  XTN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i];   // the top byte is dropped`,
    intrinsic: "vmovn_u16",
  },
  XTN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8]
for (int i = 0; i < 8; i++) Vd[8+i] = Vn[i];   // the lower half stays`,
    intrinsic: "vmovn_high_u16",
  },
  SQXTN: {
    c: `// .8b from .8h: int8_t Vd[8]; int16_t Vn[8]
for (int i = 0; i < 8; i++)
  Vd[i] = Vn[i] > 127 ? 127 : Vn[i] < -128 ? -128 : Vn[i];`,
    intrinsic: "vqmovn_s16",
  },
  SQXTN2: {
    c: `// .16b from .8h: int8_t Vd[16]; int16_t Vn[8]
for (int i = 0; i < 8; i++)            // the lower half stays
  Vd[8+i] = Vn[i] > 127 ? 127 : Vn[i] < -128 ? -128 : Vn[i];`,
    intrinsic: "vqmovn_high_s16",
  },
  UQXTN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] > 255 ? 255 : Vn[i];`,
    intrinsic: "vqmovn_u16",
  },
  UQXTN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8]
for (int i = 0; i < 8; i++) Vd[8+i] = Vn[i] > 255 ? 255 : Vn[i];`,
    intrinsic: "vqmovn_high_u16",
  },
  SQXTUN: {
    c: `// .8b from .8h: uint8_t Vd[8]; int16_t Vn[8]
for (int i = 0; i < 8; i++)
  Vd[i] = Vn[i] < 0 ? 0 : Vn[i] > 255 ? 255 : Vn[i];`,
    intrinsic: "vqmovun_s16",
  },
  SQXTUN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; int16_t Vn[8]
for (int i = 0; i < 8; i++)            // the lower half stays
  Vd[8+i] = Vn[i] < 0 ? 0 : Vn[i] > 255 ? 255 : Vn[i];`,
    intrinsic: "vqmovun_high_s16",
  },
  SHLL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] << 8;   // by exactly the lane width`,
    intrinsic: "vshll_n_u8",
  },
  SHLL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] << 8;   // the upper half`,
    intrinsic: "vshll_high_n_u8",
  },

  // advanced simd: shifts
  SHL: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (0 to 7)
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] << shift;   // bits past 7 are lost`,
    intrinsic: "vshl_n_u8",
  },
  SSHR: {
    c: `// .8b: int8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] >> shift;   // the sign bit fills in`,
    intrinsic: "vshr_n_s8",
  },
  USHR: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] >> shift;   // zeros fill in`,
    intrinsic: "vshr_n_u8",
  },
  SSRA: {
    c: `// .8b: int8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) Vd[i] += Vn[i] >> shift;   // wraps at 8 bits`,
    intrinsic: "vsra_n_s8",
  },
  USRA: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) Vd[i] += Vn[i] >> shift;   // wraps at 8 bits`,
    intrinsic: "vsra_n_u8",
  },
  SRSHR: {
    c: `// .8b: int8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++)            // add half of what is shifted out
  Vd[i] = (Vn[i] + (1 << (shift - 1))) >> shift;`,
    intrinsic: "vrshr_n_s8",
  },
  URSHR: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++)            // add half of what is shifted out
  Vd[i] = (Vn[i] + (1 << (shift - 1))) >> shift;`,
    intrinsic: "vrshr_n_u8",
  },
  SRSRA: {
    c: `// .8b: int8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++)            // rounded, then added to Vd
  Vd[i] += (Vn[i] + (1 << (shift - 1))) >> shift;`,
    intrinsic: "vrsra_n_s8",
  },
  URSRA: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++)            // rounded, then added to Vd
  Vd[i] += (Vn[i] + (1 << (shift - 1))) >> shift;`,
    intrinsic: "vrsra_n_u8",
  },
  SLI: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (0 to 7)
for (int i = 0; i < 8; i++)            // Vd's low shift bits survive
  Vd[i] = Vn[i] << shift | (Vd[i] & ((1 << shift) - 1));`,
    intrinsic: "vsli_n_u8",
  },
  SRI: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++)            // Vd's high shift bits survive
  Vd[i] = Vn[i] >> shift | (Vd[i] & ~(0xff >> shift));`,
    intrinsic: "vsri_n_u8",
  },
  SQSHL: {
    c: `// .8b: int8_t Vd[8], Vn[8]; int shift (0 to 7)
for (int i = 0; i < 8; i++) {
  int v = Vn[i] * (1 << shift);        // the shift, done where it cannot overflow
  Vd[i] = v > 127 ? 127 : v < -128 ? -128 : v;
}`,
    intrinsic: "vqshl_n_s8",
  },
  UQSHL: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int shift (0 to 7)
for (int i = 0; i < 8; i++) {
  int v = Vn[i] << shift;
  Vd[i] = v > 255 ? 255 : v;
}`,
    intrinsic: "vqshl_n_u8",
  },
  SQSHLU: {
    c: `// .8b: uint8_t Vd[8]; int8_t Vn[8]; int shift (0 to 7)
for (int i = 0; i < 8; i++) {
  int v = Vn[i] * (1 << shift);
  Vd[i] = v < 0 ? 0 : v > 255 ? 255 : v;   // a negative lane gives 0
}`,
    intrinsic: "vqshlu_n_s8",
  },
  SSHLL: {
    c: `// .8h from .8b: int16_t Vd[8]; int8_t Vn[8]; int shift (0 to 7)
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] * (1 << shift);   // widened first`,
    intrinsic: "vshll_n_s8",
  },
  SSHLL2: {
    c: `// .8h from .16b: int16_t Vd[8]; int8_t Vn[16]; int shift (0 to 7)
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] * (1 << shift);   // the upper half`,
    intrinsic: "vshll_high_n_s8",
  },
  USHLL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8]; int shift (0 to 7)
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] << shift;   // widened first`,
    intrinsic: "vshll_n_u8",
  },
  USHLL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16]; int shift (0 to 7)
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i] << shift;   // the upper half`,
    intrinsic: "vshll_high_n_u8",
  },
  SXTL: {
    c: `// .8h from .8b: int16_t Vd[8]; int8_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i];   // sign-extended`,
    intrinsic: "vmovl_s8",
  },
  SXTL2: {
    c: `// .8h from .16b: int16_t Vd[8]; int8_t Vn[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i];   // the upper half`,
    intrinsic: "vmovl_high_s8",
  },
  UXTL: {
    c: `// .8h from .8b: uint16_t Vd[8]; uint8_t Vn[8]
for (int i = 0; i < 8; i++) Vd[i] = Vn[i];   // zero-extended`,
    intrinsic: "vmovl_u8",
  },
  UXTL2: {
    c: `// .8h from .16b: uint16_t Vd[8]; uint8_t Vn[16]
for (int i = 0; i < 8; i++) Vd[i] = Vn[8+i];   // the upper half`,
    intrinsic: "vmovl_high_u8",
  },
  SHRN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) Vd[i] = Vn[i] >> shift;   // then the low byte`,
    intrinsic: "vshrn_n_u16",
  },
  SHRN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) Vd[8+i] = Vn[i] >> shift;   // the lower half stays`,
    intrinsic: "vshrn_high_n_u16",
  },
  RSHRN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) Vd[i] = (Vn[i] + (1 << (shift - 1))) >> shift;`,
    intrinsic: "vrshrn_n_u16",
  },
  RSHRN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++)            // the lower half stays
  Vd[8+i] = (Vn[i] + (1 << (shift - 1))) >> shift;`,
    intrinsic: "vrshrn_high_n_u16",
  },
  SQSHRN: {
    c: `// .8b from .8h: int8_t Vd[8]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {
  int v = Vn[i] >> shift;              // shift at 16 bits, then clamp to 8
  Vd[i] = v > 127 ? 127 : v < -128 ? -128 : v;
}`,
    intrinsic: "vqshrn_n_s16",
  },
  SQSHRN2: {
    c: `// .16b from .8h: int8_t Vd[16]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {          // the lower half stays
  int v = Vn[i] >> shift;
  Vd[8+i] = v > 127 ? 127 : v < -128 ? -128 : v;
}`,
    intrinsic: "vqshrn_high_n_s16",
  },
  UQSHRN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {
  int v = Vn[i] >> shift;
  Vd[i] = v > 255 ? 255 : v;
}`,
    intrinsic: "vqshrn_n_u16",
  },
  UQSHRN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {          // the lower half stays
  int v = Vn[i] >> shift;
  Vd[8+i] = v > 255 ? 255 : v;
}`,
    intrinsic: "vqshrn_high_n_u16",
  },
  SQRSHRN: {
    c: `// .8b from .8h: int8_t Vd[8]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {
  int v = (Vn[i] + (1 << (shift - 1))) >> shift;   // rounded, then clamped
  Vd[i] = v > 127 ? 127 : v < -128 ? -128 : v;
}`,
    intrinsic: "vqrshrn_n_s16",
  },
  SQRSHRN2: {
    c: `// .16b from .8h: int8_t Vd[16]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {          // the lower half stays
  int v = (Vn[i] + (1 << (shift - 1))) >> shift;
  Vd[8+i] = v > 127 ? 127 : v < -128 ? -128 : v;
}`,
    intrinsic: "vqrshrn_high_n_s16",
  },
  UQRSHRN: {
    c: `// .8b from .8h: uint8_t Vd[8]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {
  int v = (Vn[i] + (1 << (shift - 1))) >> shift;
  Vd[i] = v > 255 ? 255 : v;
}`,
    intrinsic: "vqrshrn_n_u16",
  },
  UQRSHRN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; uint16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {          // the lower half stays
  int v = (Vn[i] + (1 << (shift - 1))) >> shift;
  Vd[8+i] = v > 255 ? 255 : v;
}`,
    intrinsic: "vqrshrn_high_n_u16",
  },
  SQSHRUN: {
    c: `// .8b from .8h: uint8_t Vd[8]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {
  int v = Vn[i] >> shift;
  Vd[i] = v < 0 ? 0 : v > 255 ? 255 : v;
}`,
    intrinsic: "vqshrun_n_s16",
  },
  SQSHRUN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {          // the lower half stays
  int v = Vn[i] >> shift;
  Vd[8+i] = v < 0 ? 0 : v > 255 ? 255 : v;
}`,
    intrinsic: "vqshrun_high_n_s16",
  },
  SQRSHRUN: {
    c: `// .8b from .8h: uint8_t Vd[8]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {
  int v = (Vn[i] + (1 << (shift - 1))) >> shift;
  Vd[i] = v < 0 ? 0 : v > 255 ? 255 : v;
}`,
    intrinsic: "vqrshrun_n_s16",
  },
  SQRSHRUN2: {
    c: `// .16b from .8h: uint8_t Vd[16]; int16_t Vn[8]; int shift (1 to 8)
for (int i = 0; i < 8; i++) {          // the lower half stays
  int v = (Vn[i] + (1 << (shift - 1))) >> shift;
  Vd[8+i] = v < 0 ? 0 : v > 255 ? 255 : v;
}`,
    intrinsic: "vqrshrun_high_n_s16",
  },
  SSHL: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8] (a negative count shifts right)
for (int i = 0; i < 8; i++) {
  int s = Vm[i] > 16 ? 16 : Vm[i] < -16 ? -16 : Vm[i];   // keeps C's shift defined
  Vd[i] = s >= 0 ? Vn[i] * (1 << s) : Vn[i] >> -s;
}`,
    intrinsic: "vshl_s8",
  },
  USHL: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int8_t Vm[8] (a negative count shifts right)
for (int i = 0; i < 8; i++) {
  int s = Vm[i] > 16 ? 16 : Vm[i] < -16 ? -16 : Vm[i];   // keeps C's shift defined
  Vd[i] = s >= 0 ? Vn[i] << s : Vn[i] >> -s;
}`,
    intrinsic: "vshl_u8",
  },
  SRSHL: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8] (a negative count shifts right, rounded)
for (int i = 0; i < 8; i++) {
  int s = Vm[i] > 16 ? 16 : Vm[i] < -16 ? -16 : Vm[i];
  Vd[i] = s >= 0 ? Vn[i] * (1 << s) : (Vn[i] + (1 << (-s - 1))) >> -s;
}`,
    intrinsic: "vrshl_s8",
  },
  URSHL: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int8_t Vm[8] (a negative count shifts right, rounded)
for (int i = 0; i < 8; i++) {
  int s = Vm[i] > 16 ? 16 : Vm[i] < -16 ? -16 : Vm[i];
  Vd[i] = s >= 0 ? Vn[i] << s : (Vn[i] + (1 << (-s - 1))) >> -s;
}`,
    intrinsic: "vrshl_u8",
  },
  SQRSHL: {
    c: `// .8b: int8_t Vd[8], Vn[8], Vm[8] (a negative count shifts right, rounded)
for (int i = 0; i < 8; i++) {
  int s = Vm[i] > 16 ? 16 : Vm[i] < -16 ? -16 : Vm[i];
  int v = s >= 0 ? Vn[i] * (1 << s) : (Vn[i] + (1 << (-s - 1))) >> -s;
  Vd[i] = v > 127 ? 127 : v < -128 ? -128 : v;
}`,
    intrinsic: "vqrshl_s8",
  },
  UQRSHL: {
    c: `// .8b: uint8_t Vd[8], Vn[8]; int8_t Vm[8] (a negative count shifts right, rounded)
for (int i = 0; i < 8; i++) {
  int s = Vm[i] > 16 ? 16 : Vm[i] < -16 ? -16 : Vm[i];
  int v = s >= 0 ? Vn[i] << s : (Vn[i] + (1 << (-s - 1))) >> -s;
  Vd[i] = v > 255 ? 255 : v;
}`,
    intrinsic: "vqrshl_u8",
  },

  // advanced simd: permutes and table lookups
  EXT: {
    c: `// .16b: uint8_t Vd[16], Vn[16], Vm[16]; int index (0 to 15)
for (int i = 0; i < 16; i++)           // Vn then Vm, read from byte index on
  Vd[i] = i + index < 16 ? Vn[i + index] : Vm[i + index - 16];`,
    intrinsic: "vextq_u8",
  },
  TBL: {
    c: `// .8b: uint8_t Vd[8], Vm[8]; uint8_t table[32] (two registers, v7 then v8)
for (int i = 0; i < 8; i++)            // an index past the table gives 0
  Vd[i] = Vm[i] < 32 ? table[Vm[i]] : 0;`,
    intrinsic: "vqtbl2_u8",
  },
  TBX: {
    c: `// .8b: uint8_t Vd[8], Vm[8]; uint8_t table[16] (one register)
for (int i = 0; i < 8; i++)            // an index past the table keeps Vd's byte
  if (Vm[i] < 16) Vd[i] = table[Vm[i]];`,
    intrinsic: "vqtbx1_u8",
  },
  ZIP1: {
    c: `// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 8; i++) {          // the lower halves, interleaved
  Vd[2*i] = Vn[i];
  Vd[2*i+1] = Vm[i];
}`,
    intrinsic: "vzip1q_u8",
  },
  ZIP2: {
    c: `// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 8; i++) {          // the upper halves, interleaved
  Vd[2*i] = Vn[8+i];
  Vd[2*i+1] = Vm[8+i];
}`,
    intrinsic: "vzip2q_u8",
  },
  UZP1: {
    c: `// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 8; i++) {          // the even lanes of Vn, then of Vm
  Vd[i] = Vn[2*i];
  Vd[8+i] = Vm[2*i];
}`,
    intrinsic: "vuzp1q_u8",
  },
  UZP2: {
    c: `// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 8; i++) {          // the odd lanes of Vn, then of Vm
  Vd[i] = Vn[2*i+1];
  Vd[8+i] = Vm[2*i+1];
}`,
    intrinsic: "vuzp2q_u8",
  },
  TRN1: {
    c: `// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i += 2) {      // the even lanes of both, alternating
  Vd[i] = Vn[i];
  Vd[i+1] = Vm[i];
}`,
    intrinsic: "vtrn1q_u8",
  },
  TRN2: {
    c: `// .16b: uint8_t Vd[16], Vn[16], Vm[16]
for (int i = 0; i < 16; i += 2) {      // the odd lanes of both, alternating
  Vd[i] = Vn[i+1];
  Vd[i+1] = Vm[i+1];
}`,
    intrinsic: "vtrn2q_u8",
  },

  // advanced simd: floating-point three-same and pairwise
  FMLA: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = fmaf(Vn[i], Vm[i], Vd[i]);   // rounded once`,
    intrinsic: "vfma_f32",
  },
  FMLS: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = fmaf(-Vn[i], Vm[i], Vd[i]);  // Vd - Vn * Vm`,
    intrinsic: "vfms_f32",
  },
  FMULX: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
for (int i = 0; i < 2; i++) {
  if ((isinf(Vn[i]) && Vm[i] == 0) || (Vn[i] == 0 && isinf(Vm[i])))
    Vd[i] = signbit(Vn[i]) != signbit(Vm[i]) ? -2.0f : 2.0f;   // not NaN
  else
    Vd[i] = Vn[i] * Vm[i];
}`,
    intrinsic: "vmulx_f32",
  },
  FABD: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = fabsf(Vn[i] - Vm[i]);`,
    intrinsic: "vabd_f32",
  },
  FRECPS: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
for (int i = 0; i < 2; i++) {
  if ((isinf(Vn[i]) && Vm[i] == 0) || (Vn[i] == 0 && isinf(Vm[i])))
    Vd[i] = 2.0f;                      // inf * 0 counts as 0 here
  else
    Vd[i] = fmaf(-Vn[i], Vm[i], 2.0f); // 2 - Vn * Vm, rounded once
}`,
    intrinsic: "vrecps_f32",
  },
  FRSQRTS: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
for (int i = 0; i < 2; i++) {          // (3 - Vn * Vm) / 2, rounded once
  if ((isinf(Vn[i]) && Vm[i] == 0) || (Vn[i] == 0 && isinf(Vm[i])))
    Vd[i] = 1.5f;                      // inf * 0 counts as 0 here
  else if (fabsf(Vn[i]) > fabsf(Vm[i]))
    Vd[i] = fmaf(-(Vn[i] / 2), Vm[i], 1.5f);   // halving the larger one is exact
  else
    Vd[i] = fmaf(-Vn[i], Vm[i] / 2, 1.5f);
}`,
    intrinsic: "vrsqrts_f32",
  },
  FADDP: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
Vd[0] = Vn[0] + Vn[1];                 // Vn's pair, then Vm's
Vd[1] = Vm[0] + Vm[1];`,
    intrinsic: "vpadd_f32",
  },
  FMAXP: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
float pair[4] = { Vn[0], Vn[1], Vm[0], Vm[1] };
for (int i = 0; i < 2; i++) {          // each pair folds the way fmax does
  float a = pair[2*i], b = pair[2*i+1];
  if (isnan(a) || isnan(b)) Vd[i] = NAN;
  else if (a == b) Vd[i] = signbit(a) ? b : a;
  else Vd[i] = a > b ? a : b;
}`,
    intrinsic: "vpmax_f32",
  },
  FMINP: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
float pair[4] = { Vn[0], Vn[1], Vm[0], Vm[1] };
for (int i = 0; i < 2; i++) {          // each pair folds the way fmin does
  float a = pair[2*i], b = pair[2*i+1];
  if (isnan(a) || isnan(b)) Vd[i] = NAN;
  else if (a == b) Vd[i] = signbit(a) ? a : b;
  else Vd[i] = a < b ? a : b;
}`,
    intrinsic: "vpmin_f32",
  },
  FMAXNMP: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
Vd[0] = fmaxf(Vn[0], Vn[1]);           // C's fmaxf ignores a quiet NaN too
Vd[1] = fmaxf(Vm[0], Vm[1]);`,
    intrinsic: "vpmaxnm_f32",
  },
  FMINNMP: {
    c: `// .2s: float Vd[2], Vn[2], Vm[2]
Vd[0] = fminf(Vn[0], Vn[1]);           // C's fminf ignores a quiet NaN too
Vd[1] = fminf(Vm[0], Vm[1]);`,
    intrinsic: "vpminnm_f32",
  },
  FMAXV: {
    c: `// float Sd, Vn[4]
Sd = Vn[0];
for (int i = 1; i < 4; i++) {          // a NaN anywhere makes a NaN
  if (isnan(Sd) || isnan(Vn[i])) Sd = NAN;
  else if (Vn[i] > Sd || (Vn[i] == Sd && !signbit(Vn[i]))) Sd = Vn[i];
}`,
    intrinsic: "vmaxvq_f32",
  },
  FMINV: {
    c: `// float Sd, Vn[4]
Sd = Vn[0];
for (int i = 1; i < 4; i++) {          // a NaN anywhere makes a NaN
  if (isnan(Sd) || isnan(Vn[i])) Sd = NAN;
  else if (Vn[i] < Sd || (Vn[i] == Sd && signbit(Vn[i]))) Sd = Vn[i];
}`,
    intrinsic: "vminvq_f32",
  },
  FMAXNMV: {
    c: `// float Sd, Vn[4]
Sd = fmaxf(fmaxf(Vn[0], Vn[1]), fmaxf(Vn[2], Vn[3]));   // quiet NaNs ignored`,
    intrinsic: "vmaxnmvq_f32",
  },
  FMINNMV: {
    c: `// float Sd, Vn[4]
Sd = fminf(fminf(Vn[0], Vn[1]), fminf(Vn[2], Vn[3]));   // quiet NaNs ignored`,
    intrinsic: "vminnmvq_f32",
  },

  // advanced simd: floating-point unary
  FRECPE: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) {
  if (isnan(Vn[i]) || isinf(Vn[i]) || Vn[i] == 0) { Vd[i] = 1 / Vn[i]; continue; }
  int e;
  float m = frexpf(fabsf(Vn[i]), &e);  // |Vn| = m * 2^e, 0.5 <= m < 1
  int a = (int)(m * 512) * 2 + 1;      // the top bits of m, made odd
  int r = ((1 << 19) / a + 1) / 2;     // 256 to 511: about 256 / m
  Vd[i] = copysignf(ldexpf(r / 256.0f, -e), Vn[i]);
}`,
    intrinsic: "vrecpe_f32",
  },
  FRSQRTE: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) {
  if (!(Vn[i] > 0) || isinf(Vn[i])) { Vd[i] = 1 / sqrtf(Vn[i]); continue; }
  int e;
  float m = frexpf(Vn[i], &e);         // Vn = m * 2^e, 0.5 <= m < 1
  if (e & 1) { m /= 2; e++; }          // an even e: 0.25 <= m < 1
  int a = (int)(m * 512);              // the top bits of m pick the entry
  a = a < 256 ? a * 2 + 1 : (a | 1) * 2;
  int b = 512;
  while (a * (b + 1) * (b + 1) < (1 << 28)) b++;
  Vd[i] = ldexpf((b + 1) / 2 / 256.0f, -e / 2);
}`,
    intrinsic: "vrsqrte_f32",
  },
  FRECPX: {
    c: `// float Sd, Sn
uint32_t bits;
memcpy(&bits, &Sn, 4);
uint32_t exp = bits >> 23 & 0xff;
if (isnan(Sn)) Sd = NAN;
else {                                 // keep the sign, flip the exponent, clear the rest
  bits = (bits & 0x80000000) | (exp == 0 ? 0xfe : ~exp & 0xff) << 23;
  memcpy(&Sd, &bits, 4);
}`,
    intrinsic: "vrecpxs_f32",
  },
  FRINTN: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = nearbyintf(Vn[i]);   // ties to even`,
    intrinsic: "vrndn_f32",
  },
  FRINTA: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = roundf(Vn[i]);   // ties away from zero`,
    intrinsic: "vrnda_f32",
  },
  FRINTM: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = floorf(Vn[i]);`,
    intrinsic: "vrndm_f32",
  },
  FRINTP: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = ceilf(Vn[i]);`,
    intrinsic: "vrndp_f32",
  },
  FRINTZ: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = truncf(Vn[i]);`,
    intrinsic: "vrnd_f32",
  },
  FRINTX: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = rintf(Vn[i]);   // the current mode: nearest-even`,
    intrinsic: "vrndx_f32",
  },
  FRINTI: {
    c: `// .2s: float Vd[2], Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = nearbyintf(Vn[i]);   // the current mode, quietly`,
    intrinsic: "vrndi_f32",
  },

  // advanced simd: floating-point compares
  FCMEQ: {
    c: `// .2s: uint32_t Vd[2]; float Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = Vn[i] == Vm[i] ? 0xffffffff : 0;`,
    intrinsic: "vceq_f32",
  },
  FCMGE: {
    c: `// .2s: uint32_t Vd[2]; float Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = Vn[i] >= Vm[i] ? 0xffffffff : 0;`,
    intrinsic: "vcge_f32",
  },
  FCMGT: {
    c: `// .2s: uint32_t Vd[2]; float Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = Vn[i] > Vm[i] ? 0xffffffff : 0;`,
    intrinsic: "vcgt_f32",
  },
  FCMLE: {
    c: `// .2s: uint32_t Vd[2]; float Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = Vn[i] <= 0 ? 0xffffffff : 0;`,
    intrinsic: "vclez_f32",
  },
  FCMLT: {
    c: `// .2s: uint32_t Vd[2]; float Vn[2]
for (int i = 0; i < 2; i++) Vd[i] = Vn[i] < 0 ? 0xffffffff : 0;`,
    intrinsic: "vcltz_f32",
  },
  FACGE: {
    c: `// .2s: uint32_t Vd[2]; float Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = fabsf(Vn[i]) >= fabsf(Vm[i]) ? 0xffffffff : 0;`,
    intrinsic: "vcage_f32",
  },
  FACGT: {
    c: `// .2s: uint32_t Vd[2]; float Vn[2], Vm[2]
for (int i = 0; i < 2; i++) Vd[i] = fabsf(Vn[i]) > fabsf(Vm[i]) ? 0xffffffff : 0;`,
    intrinsic: "vcagt_f32",
  },

  // advanced simd: floating-point conversions
  FCVTN: {
    c: `// .4h from .4s: _Float16 Vd[4]; float Vn[4]
for (int i = 0; i < 4; i++) Vd[i] = Vn[i];   // rounded to the nearest half`,
    intrinsic: "vcvt_f16_f32",
  },
  FCVTN2: {
    c: `// .8h from .4s: _Float16 Vd[8]; float Vn[4]
for (int i = 0; i < 4; i++) Vd[4+i] = Vn[i];   // the lower half stays`,
    intrinsic: "vcvt_high_f16_f32",
  },
  FCVTL: {
    c: `// .4s from .4h: float Vd[4]; _Float16 Vn[4]
for (int i = 0; i < 4; i++) Vd[i] = Vn[i];   // exact`,
    intrinsic: "vcvt_f32_f16",
  },
  FCVTL2: {
    c: `// .4s from .8h: float Vd[4]; _Float16 Vn[8]
for (int i = 0; i < 4; i++) Vd[i] = Vn[4+i];   // the upper half`,
    intrinsic: "vcvt_high_f32_f16",
  },
  FCVTXN: {
    c: `// .2s from .2d: float Vd[2]; double Vn[2]
for (int i = 0; i < 2; i++) {
  float f = (float)Vn[i];              // the nearest float first
  uint32_t bits;
  memcpy(&bits, &f, 4);
  if (f != Vn[i] && !isnan(f) && (bits & 1) == 0)   // inexact must end odd
    f = nextafterf(f, Vn[i] > f ? INFINITY : -INFINITY);
  Vd[i] = f;
}`,
    intrinsic: "vcvtx_f32_f64",
  },
  FCVTXN2: {
    c: `// .4s from .2d: float Vd[4]; double Vn[2]
for (int i = 0; i < 2; i++) {          // the lower half stays
  float f = (float)Vn[i];
  uint32_t bits;
  memcpy(&bits, &f, 4);
  if (f != Vn[i] && !isnan(f) && (bits & 1) == 0)
    f = nextafterf(f, Vn[i] > f ? INFINITY : -INFINITY);
  Vd[2+i] = f;
}`,
    intrinsic: "vcvtx_high_f32_f64",
  },

  // advanced simd: structure loads and stores
  LD1: {
    c: `// .8b: uint8_t Vt[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) Vt[i] = Xn[i];   // the upper 64 bits of vt become 0`,
    intrinsic: "vld1_u8",
  },
  ST1: {
    c: `// .16b: uint8_t Vt[16]; uint8_t *Xn
for (int i = 0; i < 16; i++) Xn[i] = Vt[i];`,
    intrinsic: "vst1q_u8",
  },
  LD2: {
    c: `// .8b: uint8_t Vt[8], Vt2[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // pairs come apart
  Vt[i] = Xn[2*i];
  Vt2[i] = Xn[2*i+1];
}`,
    intrinsic: "vld2_u8",
  },
  ST2: {
    c: `// .8b: uint8_t Vt[8], Vt2[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // interleaved into pairs
  Xn[2*i] = Vt[i];
  Xn[2*i+1] = Vt2[i];
}`,
    intrinsic: "vst2_u8",
  },
  LD3: {
    c: `// .8b: uint8_t Vt[8], Vt2[8], Vt3[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // triples come apart
  Vt[i] = Xn[3*i];
  Vt2[i] = Xn[3*i+1];
  Vt3[i] = Xn[3*i+2];
}`,
    intrinsic: "vld3_u8",
  },
  ST3: {
    c: `// .8b: uint8_t Vt[8], Vt2[8], Vt3[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // interleaved into triples
  Xn[3*i] = Vt[i];
  Xn[3*i+1] = Vt2[i];
  Xn[3*i+2] = Vt3[i];
}`,
    intrinsic: "vst3_u8",
  },
  LD4: {
    c: `// .8b: uint8_t Vt[8], Vt2[8], Vt3[8], Vt4[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // quads come apart
  Vt[i] = Xn[4*i];
  Vt2[i] = Xn[4*i+1];
  Vt3[i] = Xn[4*i+2];
  Vt4[i] = Xn[4*i+3];
}`,
    intrinsic: "vld4_u8",
  },
  ST4: {
    c: `// .8b: uint8_t Vt[8], Vt2[8], Vt3[8], Vt4[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // interleaved into quads
  Xn[4*i] = Vt[i];
  Xn[4*i+1] = Vt2[i];
  Xn[4*i+2] = Vt3[i];
  Xn[4*i+3] = Vt4[i];
}`,
    intrinsic: "vst4_u8",
  },
  LD1R: {
    c: `// .16b: uint8_t Vt[16]; uint8_t *Xn
for (int i = 0; i < 16; i++) Vt[i] = Xn[0];   // one byte read, sixteen written`,
    intrinsic: "vld1q_dup_u8",
  },
  LD2R: {
    c: `// .8b: uint8_t Vt[8], Vt2[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // one element per register
  Vt[i] = Xn[0];
  Vt2[i] = Xn[1];
}`,
    intrinsic: "vld2_dup_u8",
  },
  LD3R: {
    c: `// .8b: uint8_t Vt[8], Vt2[8], Vt3[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // one element per register
  Vt[i] = Xn[0];
  Vt2[i] = Xn[1];
  Vt3[i] = Xn[2];
}`,
    intrinsic: "vld3_dup_u8",
  },
  LD4R: {
    c: `// .8b: uint8_t Vt[8], Vt2[8], Vt3[8], Vt4[8]; uint8_t *Xn
for (int i = 0; i < 8; i++) {          // one element per register
  Vt[i] = Xn[0];
  Vt2[i] = Xn[1];
  Vt3[i] = Xn[2];
  Vt4[i] = Xn[3];
}`,
    intrinsic: "vld4_dup_u8",
  },
};
