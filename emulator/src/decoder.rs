use crate::errors::EmuError;
use crate::registers::{Condition, ShiftType};

mod branch;
mod data_processing;
mod disassembly;
mod fp;
mod load_store;
mod simd;
mod simd_fp;

pub use data_processing::*;
pub use disassembly::*;
pub use fp::*;
pub use load_store::*;
pub use simd::*;
pub use simd_fp::*;
use branch::decode_branch_group;

// ---------------------------------------------------------------------------
// sub-enums
// ---------------------------------------------------------------------------

/// Data-processing (immediate and register) operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DpOp {
    Add,
    Adds,
    Sub,
    Subs,
}

/// Move-wide operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoveWideOp {
    Movn,
    Movz,
    Movk,
}

/// Logical operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogOp {
    And,
    Orr,
    Eor,
}

/// Load/store single-register direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LdStOp {
    Ldr,
    Str,
}

/// Access size for single-register loads/stores.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemSize {
    B,  // 1 byte
    H,  // 2 bytes
    W,  // 4 bytes
    X,  // 8 bytes
    Q,  // 16 bytes (SIMD&FP only)
}

impl MemSize {
    /// The access width a load/store encoding's 2-bit `size` field names.
    /// The assembler's offset-scaling and the decoder both come through
    /// here, so `bytes` below is the only place the bytes-per-size mapping
    /// is written down. Only the low two bits are read; there is no invalid
    /// value to reject. Q never comes out of this function: the 128-bit
    /// width is spelled by `opc<1>` beside the size field, so the SIMD&FP
    /// load/store decode picks it explicitly.
    pub fn from_size_field(size: u8) -> Self {
        match size & 0b11 {
            0b00 => Self::B,
            0b01 => Self::H,
            0b10 => Self::W,
            _ => Self::X,
        }
    }

    /// Number of bytes for this access width.
    pub fn bytes(self) -> u32 {
        match self {
            Self::B => 1,
            Self::H => 2,
            Self::W => 4,
            Self::X => 8,
            Self::Q => 16,
        }
    }
}

/// Load/store pair direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LdStPairOp {
    Ldp,
    Stp,
    /// Two words, each sign-extended into an X register.
    Ldpsw,
}

/// Which of the three shapes a structure load or store takes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdStructShape {
    /// Whole registers: every lane of each one is moved, de-interleaved
    /// on the way in and interleaved on the way out.
    Multiple,
    /// One lane of each register, the rest left alone.
    Lane(u8),
    /// One element read once and copied into every lane of each
    /// register (LD1R-LD4R). Loads only.
    Replicate,
}

/// Addressing mode for load/store.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexMode {
    SignedOffset,
    PreIndex,
    PostIndex,
}

/// How an Xm/Wm index register is extended into the effective-address
/// computation. `Lsl` treats the 64-bit register value as-is (equivalent to
/// UXTX on AArch64); the others sign- or zero-extend a 32-bit value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtendType {
    /// Zero-extend a 32-bit unsigned value.
    Uxtw,
    /// Use the 64-bit value directly (option 011 in the encoding).
    Lsl,
    /// Sign-extend a 32-bit value.
    Sxtw,
    /// Sign-extend a 64-bit value (no-op, kept for encoding symmetry).
    Sxtx,
}

/// The extend/shift keywords a load/store register-offset address accepts:
/// the spelling, its 3-bit `option` field, and whether the index register
/// must be an X (the ARM width rule: UXTW/SXTW take a Wm, the rest take
/// an Xm). `lsl` and `uxtx` share option 0b011 because they mean the same
/// thing for a 64-bit index; `lsl` is listed first so a lookup by option
/// spells it the way GAS disassembles it.
///
/// Deliberately separate from the assembler's `EXTEND_KEYWORDS`, which is
/// the ADD/SUB extended-register table: that one carries all eight options
/// (byte and halfword extends included) and skips the width check entirely,
/// because GAS assembles `add x0, x1, x2, sxtw` to the same word as the
/// `w2` spelling and refusing it would reject source the course toolchain
/// accepts. The two tables carry different rows and must stay separate.
pub const LDST_EXTENDS: &[(&str, u8, bool)] = &[
    ("lsl", 0b011, true),
    ("uxtw", 0b010, false),
    ("sxtw", 0b110, false),
    ("sxtx", 0b111, true),
    ("uxtx", 0b011, true),
];

/// Extension applied to Rm in the extended-register ADD/SUB form (the
/// 3-bit option field). UXTX doubles as LSL when the other operand is SP,
/// which is the alias GAS emits for `add x0, sp, x1`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegExtend {
    Uxtb,
    Uxth,
    Uxtw,
    Uxtx,
    Sxtb,
    Sxth,
    Sxtw,
    Sxtx,
}

impl RegExtend {
    fn from_option(option: u8) -> Self {
        match option & 0b111 {
            0b000 => RegExtend::Uxtb,
            0b001 => RegExtend::Uxth,
            0b010 => RegExtend::Uxtw,
            0b011 => RegExtend::Uxtx,
            0b100 => RegExtend::Sxtb,
            0b101 => RegExtend::Sxth,
            0b110 => RegExtend::Sxtw,
            _ => RegExtend::Sxtx,
        }
    }
}

/// Offset for single-register load/store.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LdStOffset {
    Immediate(i64),
    Register {
        rm: u8,
        extend: ExtendType,
        /// `Some(n)` when the encoding's S bit is set: the index is
        /// scaled by the access width and `n` is log2 of it. `None` when
        /// S is clear. For a byte access the two spell the same shift,
        /// so `[x0, x1]` and `[x0, x1, lsl #0]` differ only here.
        shift_amount: Option<u8>,
    },
}

/// Unconditional branch-to-register variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrRegOp {
    Br,
    Blr,
    Ret,
}

/// Conditional select variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CondSelOp {
    Csel,
    Csinc,
    Csinv,
    Csneg,
}

/// Multiply/divide variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MulDivOp {
    Mul,
    Udiv,
    Sdiv,
}

/// Multiply-accumulate variant. `Madd` computes `Rd = Ra + Rn*Rm`; `Msub`
/// computes `Rd = Ra - Rn*Rm`. The course uses MSUB for remainder:
/// `sdiv q, a, b; msub r, q, b, a` yields `r = a mod b`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MulAccumulateOp {
    Madd,
    Msub,
}

/// Widening and high-half multiply variant. `Smull`/`Umull` are 32x32 -> 64
/// (the SMADDL/UMADDL encodings with Ra=XZR, the only forms gcc emits);
/// `Smulh`/`Umulh` return the top 64 bits of the full 128-bit product. gcc
/// leans on these for division and remainder by a constant even at -O0.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MulWideOp {
    Smull,
    Umull,
    Smulh,
    Umulh,
    Smaddl,
    Smsubl,
    Umaddl,
    Umsubl,
}

/// The second operand of a conditional compare: a register, or the
/// 5-bit unsigned immediate the `#imm` form carries.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CondCmpOperand {
    Reg(u8),
    Imm(u8),
}

/// Data-processing 1-source operation: the bit and byte reversals plus
/// the two leading-bit counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dp1Op {
    Rbit,
    Rev16,
    Rev32,
    Rev,
    Clz,
    Cls,
}

/// The data-processing 1-source rows: mnemonic, the 6-bit opcode, the
/// register width the row requires (None when it has both), and the
/// operation. `rev` at W width and `rev32` at X width share opcode
/// 000010, so the encoder keys on (mnemonic, sf) and the decoder on
/// (opcode, sf); neither direction can pick a row from the opcode alone.
pub const DP1_OPS: &[(&str, u8, Option<bool>, Dp1Op)] = &[
    ("rbit", 0b000000, None, Dp1Op::Rbit),
    ("rev16", 0b000001, None, Dp1Op::Rev16),
    ("rev32", 0b000010, Some(true), Dp1Op::Rev32),
    ("rev", 0b000010, Some(false), Dp1Op::Rev),
    ("rev", 0b000011, Some(true), Dp1Op::Rev),
    ("clz", 0b000100, None, Dp1Op::Clz),
    ("cls", 0b000101, None, Dp1Op::Cls),
];

/// Floating-point binary operation. The instruction's `single` flag picks
/// the S (f32) or D (f64) form.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FpBinOp {
    Fadd,
    Fsub,
    Fmul,
    Fdiv,
    Fnmul,
    Fmax,
    Fmin,
    Fmaxnm,
    Fminnm,
}

/// Floating-point one-source operation (FP data-processing 1-source space,
/// same opcode field FMOV-register lives in). The instruction's `single`
/// flag picks the S (f32) or D (f64) form.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FpUnaryOp {
    Fneg,
    Fabs,
    Fsqrt,
}

/// The FP two-source rows: mnemonic, the 4-bit opcode field, and the
/// operation it decodes to. `encode_fp_binary` reads the opcode out of here
/// and `decode_fp_group` reads the operation back, so the two directions of
/// the same four numbers cannot drift apart.
pub const FP_BINARY_OPS: &[(&str, u8, FpBinOp)] = &[
    ("fadd", 0b0010, FpBinOp::Fadd),
    ("fsub", 0b0011, FpBinOp::Fsub),
    ("fmul", 0b0000, FpBinOp::Fmul),
    ("fdiv", 0b0001, FpBinOp::Fdiv),
    ("fnmul", 0b1000, FpBinOp::Fnmul),
    ("fmax", 0b0100, FpBinOp::Fmax),
    ("fmin", 0b0101, FpBinOp::Fmin),
    ("fmaxnm", 0b0110, FpBinOp::Fmaxnm),
    ("fminnm", 0b0111, FpBinOp::Fminnm),
];

/// Fused multiply-add variant. `Fa` is the ADDEND in every one of them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FpMulAddOp {
    Fmadd,
    Fmsub,
    Fnmadd,
    Fnmsub,
}

/// The FP 3-source rows: mnemonic, o1 (bit 21), o0 (bit 15), operation.
/// Read in both directions, like `FP_BINARY_OPS`.
pub const FP_MUL_ADD_OPS: &[(&str, u8, u8, FpMulAddOp)] = &[
    ("fmadd", 0, 0, FpMulAddOp::Fmadd),
    ("fmsub", 0, 1, FpMulAddOp::Fmsub),
    ("fnmadd", 1, 0, FpMulAddOp::Fnmadd),
    ("fnmsub", 1, 1, FpMulAddOp::Fnmsub),
];

/// The FP one-source rows that share `FpUnary`: mnemonic, the 6-bit opcode
/// field, and the operation. FMOV-register and FCVT live in the same opcode
/// space but stay out of the table: FMOV has its own instruction variant
/// and its own encoder, and FCVT's opcode carries the DESTINATION width, so
/// it is entangled with ftype rather than being a plain row.
pub const FP_UNARY_OPS: &[(&str, u8, FpUnaryOp)] = &[
    ("fabs", 0b000001, FpUnaryOp::Fabs),
    ("fneg", 0b000010, FpUnaryOp::Fneg),
    ("fsqrt", 0b000011, FpUnaryOp::Fsqrt),
];

/// The scalar roundings `frintn d0, d1` and friends, which sit in the same
/// 1-source class as FNEG rather than among the SIMD-scalar words. They
/// decode onto the vector rows' lane function, so one rounding rule (and
/// one NaN rule) serves both forms.
pub const FP_ROUND_OPS: &[(u8, SimdFpMiscOp)] = &[
    (0b001000, SimdFpMiscOp::Frintn),
    (0b001001, SimdFpMiscOp::Frintp),
    (0b001010, SimdFpMiscOp::Frintm),
    (0b001011, SimdFpMiscOp::Frintz),
    (0b001100, SimdFpMiscOp::Frinta),
    (0b001110, SimdFpMiscOp::Frintx),
    (0b001111, SimdFpMiscOp::Frinti),
];

/// FP-to-integer rounding mode and signedness. The letter pairs read the
/// way the mnemonics do: N nearest-ties-even, A nearest-ties-away, M
/// toward minus infinity, P toward plus infinity, Z toward zero; the
/// trailing S/U picks a signed or unsigned result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FpToIntOp { Ns, Nu, As, Au, Ms, Mu, Ps, Pu, Zs, Zu }

/// Integer-to-FP direction: SCVTF reads the source signed, UCVTF unsigned.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FpFromIntOp { Scvtf, Ucvtf }

/// The rmode:opcode rows of the FP/integer conversion class
/// (sf 0 0 11110 ftype 1 rmode(2) opcode(3) 000000 Rn Rd).
/// `encode_fp_cvt_int` reads the pair out of here and `decode_fp_group`
/// reads the operation back, so the two directions cannot drift.
/// FMOV's rmode 00 / opcode 110 and 111 stay out: FMOV has its own
/// variant and its own width-pairing rule.
pub const FP_TO_INT_OPS: &[(&str, u8, u8, FpToIntOp)] = &[
    ("fcvtns", 0b00, 0b000, FpToIntOp::Ns),
    ("fcvtnu", 0b00, 0b001, FpToIntOp::Nu),
    ("fcvtas", 0b00, 0b100, FpToIntOp::As),
    ("fcvtau", 0b00, 0b101, FpToIntOp::Au),
    ("fcvtps", 0b01, 0b000, FpToIntOp::Ps),
    ("fcvtpu", 0b01, 0b001, FpToIntOp::Pu),
    ("fcvtms", 0b10, 0b000, FpToIntOp::Ms),
    ("fcvtmu", 0b10, 0b001, FpToIntOp::Mu),
    ("fcvtzs", 0b11, 0b000, FpToIntOp::Zs),
    ("fcvtzu", 0b11, 0b001, FpToIntOp::Zu),
];

/// The two integer-to-FP rows of the same class.
pub const FP_FROM_INT_OPS: &[(&str, u8, u8, FpFromIntOp)] = &[
    ("scvtf", 0b00, 0b010, FpFromIntOp::Scvtf),
    ("ucvtf", 0b00, 0b011, FpFromIntOp::Ucvtf),
];

/// Bitfield-move variant. `Sbfm` sign-extends the extracted field; `Ubfm`
/// zero-extends it; `Bfm` merges the field into the destination and keeps
/// the other bits (the form behind `bfi`). The `sxtb`/`sxth`/`sxtw` and
/// `uxtb`/`uxth` extends, plus `sbfx`/`ubfx`, lower to the first two. The
/// LSL/LSR/ASR immediate aliases keep their dedicated decode (see
/// `decode_bitfield`) so this only covers the genuine bitfield moves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BitfieldOp {
    Sbfm,
    Ubfm,
    Bfm,
}

// ---------------------------------------------------------------------------
// instruction enum
// ---------------------------------------------------------------------------

/// A decoded ARM64 instruction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Instruction {
    /// ADD/SUB/ADDS/SUBS with 12-bit immediate.
    DpImm {
        op: DpOp,
        sf: bool,
        rd: u8,
        rn: u8,
        imm: u32,
        shift: u8, // 0 or 12
    },
    /// ADD/SUB/ADDS/SUBS with shifted register operand.
    DpReg {
        op: DpOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        shift: ShiftType,
        amount: u8,
    },
    /// CCMP / CCMN: compare only when `cond` holds, otherwise write the
    /// literal flags. `sub` is CCMP. `nzcv` is the 4-bit literal in
    /// `NzcvFlags::pack`'s layout (N=bit3, Z=bit2, C=bit1, V=bit0).
    CondCompare {
        sub: bool,
        sf: bool,
        rn: u8,
        operand: CondCmpOperand,
        cond: Condition,
        nzcv: u8,
    },
    /// CLZ/CLS/RBIT/REV/REV16/REV32: one source, one destination, no
    /// flags. `sf` is the operand width both registers share.
    DataProc1 {
        op: Dp1Op,
        sf: bool,
        rd: u8,
        rn: u8,
    },
    /// LSLV/LSRV/ASRV/RORV: shift Rn left/right by the amount in Rm,
    /// modulo the register width (the dp2 register-shift family).
    VarShift {
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        shift: ShiftType,
    },
    /// EXTR: the pair Rn:Rm shifted right by `lsb`, keeping the low
    /// register's worth (gcc's funnel shift). `ror Rd, Rn, #k` is the
    /// Rn == Rm case and decodes as the ORR-with-ROR form instead.
    Extr {
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        lsb: u8,
    },
    /// ADD/SUB/ADDS/SUBS with EXTENDED register operand (bit 21 = 1):
    /// the only register form that reaches SP: Rn = 31 reads SP, and
    /// Rd = 31 writes SP for the non-flag-setting ops. Rm = 31 stays XZR.
    DpRegExt {
        op: DpOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        extend: RegExtend,
        /// Left shift applied after the extend, 0..=4.
        shift: u8,
    },
    /// ADC/ADCS/SBC/SBCS: add (or subtract) with the carry flag as the
    /// low-order carry-in, the multi-precision arithmetic family. There is
    /// no immediate form in A64, and no shift/extend field: register 31 is
    /// ZR in every position, never SP.
    DpCarry {
        /// True for SBC/SBCS (Rn + NOT(Rm) + C), false for ADC/ADCS.
        sub: bool,
        set_flags: bool,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
    },
    /// MOVZ/MOVK/MOVN.
    MoveWide {
        op: MoveWideOp,
        sf: bool,
        rd: u8,
        imm16: u16,
        hw: u8,
    },
    /// AND/ORR/EOR with bitmask immediate.
    LogImm {
        op: LogOp,
        sf: bool,
        rd: u8,
        rn: u8,
        imm: u64,
        set_flags: bool,
    },
    /// AND/ORR/EOR/MVN with shifted register.
    LogReg {
        op: LogOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        shift: ShiftType,
        amount: u8,
        set_flags: bool,
        invert: bool, // true for MVN (ORN with rn=ZR), BIC, EON
    },
    /// LDR/STR/LDRB/STRB/LDRH/STRH.
    LdSt {
        op: LdStOp,
        rt: u8,
        rn: u8,
        offset: LdStOffset,
        size: MemSize,
        mode: IndexMode,
    },
    /// SIMD&FP LDR/STR. `size` is the register view being moved: B, H,
    /// W (the S view), X (the D view) or Q. Addressing matches the integer
    /// forms exactly: scaled unsigned offsets, unscaled signed offsets
    /// (the LDUR/STUR encodings), pre/post-index writeback via `mode`, and
    /// the register-offset form with the same extend rules.
    FpLdSt {
        load: bool,
        ft: u8,
        rn: u8,
        offset: LdStOffset,
        size: MemSize,
        mode: IndexMode,
        /// The imm9 offset form with no writeback: a distinct encoding
        /// from the scaled one and a distinct spelling, LDUR/STUR.
        unscaled: bool,
    },
    /// LDP/STP.
    LdStPair {
        op: LdStPairOp,
        sf: bool,
        rt: u8,
        rt2: u8,
        rn: u8,
        imm7: i16,
        mode: IndexMode,
    },
    /// LDP/STP/LDNP/STNP of the FP file (V=1): opc 00 = S pairs (size W),
    /// 01 = D pairs (size X), 10 = Q pairs (size Q). `imm7` is the byte
    /// offset, already scaled by the register width.
    FpLdStPair {
        op: LdStPairOp,
        size: MemSize,
        rt: u8,
        rt2: u8,
        rn: u8,
        imm7: i16,
        mode: IndexMode,
        /// The op2 00 encoding: LDNP/STNP, a signed offset with no
        /// writeback whose only other difference is a cache hint.
        no_allocate: bool,
    },
    /// LD1-LD4 / ST1-ST4: the Advanced SIMD structure loads and stores.
    /// `structures` is the number in the mnemonic (the interleave factor)
    /// and `count` how many registers the brace list names; the two differ
    /// only for the LD1/ST1 forms that take two, three or four registers
    /// without interleaving. The registers are consecutive from `rt`,
    /// wrapping past v31.
    SimdLdStStructure {
        load: bool,
        structures: u8,
        count: u8,
        /// Element width in bytes: 1, 2, 4 or 8.
        esize: u8,
        /// The 128-bit arrangement. Unread by the single-lane shape,
        /// where the Q bit is the top bit of the lane index instead.
        q: bool,
        shape: SimdStructShape,
        rt: u8,
        rn: u8,
        /// Post-index writeback: None for the plain `[Xn]` form,
        /// `Some(31)` for the immediate form (whose amount is always the
        /// total bytes moved, so the word spends no bits on it), and
        /// `Some(rm)` for the register form.
        post: Option<u8>,
    },
    /// B/BL (26-bit signed offset, already shifted left 2).
    BrImm {
        link: bool,
        offset: i64,
    },
    /// BR/BLR/RET.
    BrReg {
        op: BrRegOp,
        rn: u8,
    },
    /// B.cond (19-bit signed offset, already shifted left 2).
    BCond {
        cond: Condition,
        offset: i64,
    },
    /// CSEL/CSINC.
    CondSel {
        op: CondSelOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        cond: Condition,
    },
    /// MUL/UDIV/SDIV.
    MulDiv {
        op: MulDivOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
    },
    /// LDR (literal) of a SIMD&FP register: load St, Dt or Qt from a
    /// PC-relative offset. `size` is W (S), X (D) or Q.
    FpLdrLiteral {
        rt: u8,
        /// Byte offset relative to the instruction's PC, already shifted.
        offset: i64,
        size: MemSize,
    },
    /// LDR (literal): load Xt or Wt from a PC-relative offset. The linker
    /// places the referenced value in a literal pool after the `.text`
    /// section and back-patches the offset into this instruction word.
    LdrLiteral {
        sf: bool,
        rt: u8,
        /// Byte offset relative to the instruction's PC, already shifted.
        offset: i64,
    },
    /// CBZ / CBNZ: compare register to zero and branch. `nonzero` is
    /// true for CBNZ (branch when the register is nonzero).
    CompareBranch {
        sf: bool,
        rt: u8,
        nonzero: bool,
        /// Byte offset relative to the instruction's PC, already scaled.
        offset: i64,
    },
    /// TBZ / TBNZ: test one bit of a register and branch. `nonzero` is
    /// true for TBNZ (branch when the tested bit is 1). `bit_pos` is
    /// the 0-based bit index (0..=63).
    TestBranch {
        rt: u8,
        bit_pos: u8,
        nonzero: bool,
        /// Byte offset relative to the instruction's PC, already scaled.
        offset: i64,
    },
    /// MADD / MSUB: three-source multiply with an accumulator. The
    /// existing `MulDiv::Mul` path still handles MUL (MADD with Ra=XZR).
    MulAccumulate {
        op: MulAccumulateOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        ra: u8,
    },
    /// SMULL/UMULL (Xd = Wn * Wm, widening) and SMULH/UMULH (Xd = the top
    /// 64 bits of Xn * Xm). All four write an X destination, so no `sf`.
    MulWide {
        op: MulWideOp,
        rd: u8,
        rn: u8,
        rm: u8,
        /// `ra` is 31 for SMULL/UMULL/SMULH/UMULH, whose Ra field the
        /// aliases and the architecture both fix at XZR.
        ra: u8,
    },
    /// LDRSB / LDRSH / LDRSW: sign-extending loads. `sf` selects the
    /// target register width (Xt when true, Wt when false; LDRSW only
    /// has the Xt form so it always sets `sf = true`). `size` is the
    /// number of bytes read from memory (B, H, or W).
    LdrSignExtended {
        rt: u8,
        rn: u8,
        offset: LdStOffset,
        size: MemSize,
        mode: IndexMode,
        sf: bool,
    },
    /// FADD / FSUB / FMUL / FDIV. `single` picks the S (f32) form over D.
    FpBinary {
        op: FpBinOp,
        fd: u8,
        fn_: u8,
        fm: u8,
        single: bool,
    },
    /// FCSEL Fd, Fn, Fm, cond: the integer CSEL for the FP file. The
    /// chosen register's BITS are copied, so a NaN or a signed zero
    /// arrives untouched; the S form keeps only the low 32.
    FpCondSel {
        fd: u8,
        fn_: u8,
        fm: u8,
        cond: Condition,
        single: bool,
    },
    /// FMOV Fd, #imm (8-bit VFP immediate, already expanded to the full
    /// IEEE 754 bit pattern: f32 bits for the S form, f64 for D, so
    /// the executor just writes it).
    FpMoveImm {
        fd: u8,
        imm_bits: u64,
        single: bool,
    },
    /// FMOV Fd, Fn (reg-to-reg). The S form copies and zero-extends the
    /// low 32 bits.
    FpMoveReg {
        fd: u8,
        fn_: u8,
        single: bool,
    },
    /// FMOV between the general and FP register files, raw bits either
    /// direction. `to_fp` is the GP -> FP direction; `sf`/`single` always
    /// name a legal width pair (w<->s, x<->d), enforced at decode.
    FpMoveGeneral {
        to_fp: bool,
        sf: bool,
        single: bool,
        rd: u8,
        rn: u8,
    },
    /// FMOV between an X register and the UPPER 64-bit lane of a vector
    /// register (`fmov v3.d[1], x7`, `fmov x3, v7.d[1]`). The low lane is
    /// left alone in the GP -> vector direction, which is the whole point
    /// of the form: it is how a 128-bit value is assembled half at a time.
    FpMoveLane {
        to_fp: bool,
        rd: u8,
        rn: u8,
    },
    /// Advanced SIMD modified immediate: MOVI, MVNI, and the ORR and BIC
    /// that take an immediate instead of a third register. `value` is the
    /// immediate expanded and replicated across the destination's width
    /// and NOT inverted, so MVNI and BIC invert it as they apply it;
    /// `imm8`, `shift` and `msl` are kept because GAS prints the operand
    /// as it was written, not as it expands.
    SimdModifiedImm {
        op: SimdImmOp,
        /// The destination's shape. `None` is the scalar `movi d3, #imm64`
        /// form, the only one that names a d register.
        arrangement: Option<Arrangement>,
        rd: u8,
        value: u128,
        imm8: u8,
        shift: u8,
        msl: bool,
    },
    /// The bitwise three-same group over 8 or 16 bytes: AND, BIC, ORR,
    /// ORN, EOR and the three insert-by-mask forms BSL, BIT and BIF. GAS
    /// prints an ORR whose two sources are the same register as
    /// `mov Vd.T, Vn.T`.
    SimdLogicalReg {
        op: SimdLogicalOp,
        q: bool,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD three-same integer group: one operation applied
    /// lane by lane to two sources. `scalar` is the SIMD-scalar form,
    /// which runs the same table over a single b/h/s/d lane.
    SimdThreeSame {
        op: SimdSameOp,
        /// Lane width in bytes: 1, 2, 4 or 8.
        esize: u8,
        /// The 128-bit arrangement; meaningless when `scalar`.
        q: bool,
        scalar: bool,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD three-different group: the widening adds and
    /// subtracts, the widening multiplies and multiply-accumulates, and
    /// the high-half narrowing adds. `esize` is always the NARROW lane
    /// width, whichever side of the instruction that is on.
    SimdThreeDiff {
        op: SimdDiffOp,
        esize: u8,
        /// The `2` form: the narrow operands come from the upper half of
        /// their register, and a narrowing row writes the upper half of
        /// the destination instead of zeroing the register above its
        /// result. It is the Q bit, and the whole meaning of the suffix.
        upper: bool,
        scalar: bool,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD shift-by-immediate group. `esize` is the narrow
    /// lane width (the source for SSHLL, the destination for SHRN, both
    /// for everything else) and `shift` the amount immh:immb carried.
    SimdShiftImm {
        op: SimdShiftOp,
        esize: u8,
        /// Q: the 128-bit arrangement, and the `2` suffix on the
        /// lengthening and narrowing rows.
        q: bool,
        scalar: bool,
        shift: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD two-register misc group and the compares
    /// against zero: one source, one destination, lane by lane.
    SimdTwoMisc {
        op: SimdMiscOp,
        /// SOURCE lane width in bytes. The pairwise widening rows write
        /// lanes of twice this.
        esize: u8,
        q: bool,
        scalar: bool,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD across-lanes group: the whole source folded
    /// into one scalar destination.
    SimdAcross {
        op: SimdAcrossOp,
        /// Source lane width in bytes.
        esize: u8,
        q: bool,
        rn: u8,
        rd: u8,
    },
    /// ZIP1/ZIP2, UZP1/UZP2, TRN1/TRN2: two sources of one arrangement
    /// shuffled into a destination of the same one.
    SimdPermute {
        op: SimdPermuteOp,
        esize: u8,
        q: bool,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// EXT: Vn and Vm concatenated, `index` bytes in, for as many bytes
    /// as the arrangement holds. The 8b form uses the low halves.
    SimdExt {
        q: bool,
        /// The byte position the window starts at, imm4.
        index: u8,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// TBL and TBX: each byte of Vm indexes a byte table made of `len`
    /// consecutive registers starting at Vn (wrapping past v31). TBL
    /// answers zero for an index past the table, TBX leaves the
    /// destination byte alone, which is the whole difference.
    SimdTableLookup {
        /// TBX rather than TBL.
        extend: bool,
        q: bool,
        /// Table registers, 1 to 4.
        len: u8,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD by-element multiplies: one lane of Vm against
    /// every lane of Vn. `esize` is the width of that element and of
    /// Vn's lanes; the long rows write lanes of twice it.
    SimdByElement {
        op: SimdElemOp,
        esize: u8,
        /// Q: the 128-bit arrangement, and the `2` suffix on the long
        /// rows, where it names the half of Vn that is read.
        q: bool,
        scalar: bool,
        index: u8,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD three-same FLOAT group: one operation applied
    /// lane by lane to two sources, over 4-byte or 8-byte float lanes.
    /// `scalar` is the SIMD-scalar form, a single s or d lane.
    SimdFpThreeSame {
        op: SimdFpSameOp,
        /// Lane width in bytes: 4 (single) or 8 (double).
        esize: u8,
        /// The 128-bit arrangement; meaningless when `scalar`.
        q: bool,
        scalar: bool,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD two-register misc FLOAT group: the unary
    /// arithmetic, the roundings, the compares against zero, and the
    /// conversions in both directions. `esize` is the WIDE lane for the
    /// narrowing and lengthening rows and the only lane for the rest;
    /// `fbits` is 0 unless the line came through the shift-immediate
    /// encoding, which is where the fixed-point conversions live.
    SimdFpTwoMisc {
        op: SimdFpMiscOp,
        esize: u8,
        q: bool,
        scalar: bool,
        fbits: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD across-lanes FLOAT group, and the SIMD-scalar
    /// pairwise class that shares its encoding: a whole source folded
    /// into one scalar destination.
    SimdFpAcross {
        op: SimdFpAcrossOp,
        esize: u8,
        q: bool,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD by-element FLOAT multiplies: one s or d lane of
    /// Vm against every lane of Vn.
    SimdFpByElement {
        op: SimdFpElemOp,
        esize: u8,
        q: bool,
        scalar: bool,
        index: u8,
        rm: u8,
        rn: u8,
        rd: u8,
    },
    /// The Advanced SIMD copy group: DUP, INS, UMOV and SMOV share one
    /// encoding and are told apart by imm4, with imm5 naming the element
    /// size and the lane.
    SimdCopy {
        op: SimdCopyOp,
        /// Lane width in bytes: 1, 2, 4 or 8.
        esize: u8,
        /// The 128-bit destination view, or an X (rather than W) general
        /// register for UMOV and SMOV.
        q: bool,
        /// The destination lane for INS, the source lane for everything
        /// else. Unread by DUP (general), which fills every lane.
        index: u8,
        /// INS (element) only: the lane read out of the source register.
        index2: u8,
        rn: u8,
        rd: u8,
    },
    /// FCMP Fn, Fm. Sets NZCV; Fd is unused in the encoding.
    FpCompare {
        fn_: u8,
        fm: u8,
        single: bool,
    },
    /// FCMP Fn, #0.0: the compare against zero, which names no Fm.
    FpCompareZero {
        fn_: u8,
        single: bool,
    },
    /// FCCMP Fn, Fm, #nzcv, cond: FCMP when cond holds, the literal flags
    /// otherwise, as CCMP. FCCMPE lands here too: it differs only in an
    /// exception a quiet NaN raises, and the emulator raises none.
    FpCondCompare {
        fn_: u8,
        fm: u8,
        nzcv: u8,
        cond: Condition,
        single: bool,
    },
    /// FNEG / FABS Fd, Fn: sign flip / sign clear.
    FpUnary {
        op: FpUnaryOp,
        fd: u8,
        fn_: u8,
        single: bool,
    },
    /// FCVT{N,A,M,P,Z}{S,U} Rd, Fn: float to integer at a named rounding
    /// mode. `sf` picks Xd vs Wd, `single` picks Sn vs Dn. `fbits` is 0
    /// for the integer form and 1..=64 for the fixed-point form
    /// (`fcvtzs x1, s15, #2`), where the source is read as value * 2^fbits
    /// before rounding.
    FpToInt {
        op: FpToIntOp,
        rd: u8,
        fn_: u8,
        sf: bool,
        single: bool,
        fbits: u8,
    },
    /// SCVTF / UCVTF Fd, Rn: integer to float, the source read signed or
    /// unsigned. `fbits` carries the fixed-point scale, 0 for the plain form.
    FpFromInt {
        op: FpFromIntOp,
        fd: u8,
        rn: u8,
        sf: bool,
        single: bool,
        fbits: u8,
    },
    /// FMADD / FMSUB / FNMADD / FNMSUB: fused multiply-add. `fa` is the
    /// ADDEND and is the LAST operand in source order, not the first.
    FpMulAdd {
        op: FpMulAddOp,
        fd: u8,
        fn_: u8,
        fm: u8,
        fa: u8,
        single: bool,
    },
    /// FCVT: precision convert. `widen` = FCVT Dd, Sn (exact); otherwise
    /// FCVT Sd, Dn (rounds to nearest single).
    FpCvt {
        fd: u8,
        fn_: u8,
        widen: bool,
    },
    /// SBFM / UBFM extract-and-extend (the form behind `sxtb`/`sxth`/
    /// `sxtw`/`uxtb`/`uxth` and `sbfx`/`ubfx`). `immr` is the rotate/lsb,
    /// `imms` the top bit of the source field.
    Bitfield {
        op: BitfieldOp,
        sf: bool,
        rd: u8,
        rn: u8,
        immr: u8,
        imms: u8,
    },
    /// ADR / ADRP: PC-relative address formation. `adrp` true means the
    /// page form (PC masked to a 4 KiB boundary, `imm` already shifted left
    /// 12); `adrp` false is the byte-relative `adr`. `imm` is the resolved
    /// signed displacement.
    Adr {
        adrp: bool,
        rd: u8,
        imm: i64,
    },
    /// NOP.
    Nop,
    /// SVC supervisor call: `svc #0` enters the syscall dispatcher; any other immediate halts.
    Svc {
        imm16: u16,
    },
    /// BRK: a breakpoint trap. gcc plants `brk #1000` on a path it proved
    /// can only fault, and Linux stops the program there with SIGTRAP.
    Brk {
        imm16: u16,
    },
}

// ---------------------------------------------------------------------------
// bit-extraction helpers
// ---------------------------------------------------------------------------

fn bit(instr: u32, pos: u8) -> u32 {
    (instr >> pos) & 1
}

fn bits(instr: u32, hi: u8, lo: u8) -> u32 {
    (instr >> lo) & ((1 << (hi - lo + 1)) - 1)
}

fn sign_extend(val: u32, bit_width: u8) -> i64 {
    let shift = 64 - bit_width as u64;
    ((val as i64) << shift) >> shift
}

// ---------------------------------------------------------------------------
// top-level decoder
// ---------------------------------------------------------------------------

/// The NOP encoding, shared by the encoder arm, the decode fast path, and
/// the linker's `.text` alignment padding.
pub const NOP_WORD: u32 = 0xD503_201F;

/// Decode a 32-bit ARM64 instruction word into a typed `Instruction`.
pub fn decode(instr: u32) -> Result<Instruction, EmuError> {
    // NOP is a specific encoding
    if instr == NOP_WORD {
        return Ok(Instruction::Nop);
    }

    // SVC: 1101_0100 000i_iiii iiii_iiii iii0_0001
    if (instr & 0xFFE0_001F) == 0xD400_0001 {
        let imm16 = bits(instr, 20, 5) as u16;
        return Ok(Instruction::Svc { imm16 });
    }

    // BRK: 1101_0100 001i_iiii iiii_iiii iii0_0000
    if (instr & 0xFFE0_001F) == 0xD420_0000 {
        let imm16 = bits(instr, 20, 5) as u16;
        return Ok(Instruction::Brk { imm16 });
    }

    let op0 = bits(instr, 28, 25);

    match op0 {
        // data processing: immediate
        0b1000 | 0b1001 => decode_dp_imm_group(instr),
        // branches, exception, system
        0b1010 | 0b1011 => decode_branch_group(instr),
        // loads and stores
        0b0100 | 0b0110 | 0b1100 | 0b1110 => decode_ldst_group(instr),
        // data processing: register
        0b0101 | 0b1101 => decode_dp_reg_group(instr),
        // scalar FP and the Advanced SIMD classes that share its group
        0b0111 | 0b1111 => decode_fp_group(instr),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests;
