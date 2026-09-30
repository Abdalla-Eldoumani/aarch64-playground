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
mod tests {
    // Binary literals here group digits by instruction field (sf/opcode/imm/rn/rd)
    // rather than by nibble, and zero-valued fields stay written out. Both
    // are deliberate, so the encodings read like the architecture manual.
    #![allow(clippy::unusual_byte_groupings, clippy::identity_op)]
    use super::*;

    // -- bitmask immediate tests --

    #[test]
    fn bitmask_7_ones_in_8bit_element() {
        // element size 8 requires len=3: NOT(imms) must have bit 3 as highest.
        // imms=0b110110 -> NOT=0b001001 -> highest bit=3 -> len=3 -> esize=8
        // s = imms & 0b111 = 6 -> 7 ones = 0x7F, replicated
        let val = decode_bitmask_imm(false, 0, 0b110110, true).unwrap();
        assert_eq!(val, 0x7F7F_7F7F_7F7F_7F7F);
    }

    #[test]
    fn bitmask_alternating_bits() {
        // 0x5555... = alternating 01 pattern. Element size 2, 1 one, rotated by 0.
        // Element size 2 needs len=1, so NOT(imms) must top out at bit 1:
        // imms = 0b111100 -> NOT = 0b000011 -> len=1 -> esize=2.
        // s = imms & 1 = 0 -> 1 one, r = immr & 1
        // With immr=0: element = 0b01, replicated = 0x5555...
        let val = decode_bitmask_imm(false, 0, 0b111100, true).unwrap();
        assert_eq!(val, 0x5555_5555_5555_5555);
    }

    #[test]
    fn bitmask_64bit_lower_32() {
        // N=1, immr=0, imms=31 (0b011111) -> 64-bit element, 32 ones, no rotation
        // = 0x00000000_FFFFFFFF
        let val = decode_bitmask_imm(true, 0, 31, true).unwrap();
        assert_eq!(val, 0x0000_0000_FFFF_FFFF);
    }

    #[test]
    fn bitmask_rotated() {
        // N=1, immr=4, imms=7 -> 64-bit element, 8 ones rotated right by 4
        // 8 ones = 0xFF, ROR 4 = 0xF000_0000_0000_000F
        let val = decode_bitmask_imm(true, 4, 7, true).unwrap();
        assert_eq!(val, 0xF000_0000_0000_000F);
    }

    #[test]
    fn bitmask_32bit_mode() {
        // sf=false, N must be 0
        // N=0, immr=0, imms=0b001111 -> element=32 (len=5 since NOT(001111)=110000, highest=5)
        // s = imms & 0x1F = 15, r = immr & 0x1F = 0
        // 16 ones = 0x0000FFFF, no rotation
        let val = decode_bitmask_imm(false, 0, 0b001111, false).unwrap();
        assert_eq!(val, 0x0000_FFFF);
    }

    #[test]
    fn bitmask_n1_sf_false_rejected() {
        // N=1 with 32-bit register is invalid
        assert!(decode_bitmask_imm(true, 0, 0, false).is_err());
    }

    #[test]
    fn bitmask_encode_decode_round_trips_rotated_values() {
        // A single-bit immediate like `#2` needs a rotation; the encoder
        // must produce an (immr, imms) the decoder reads back to the same
        // value. Pins the rotate-direction fix.
        for &(value, sf) in &[
            (2u64, false),
            (2u64, true),
            (0x8000_0000u64, false),
            (0xF000_0000_0000_000Fu64, true),
            (0x0000_0000_FFFF_0000u64, true),
            (4u64, false),
            (0x40u64, true),
        ] {
            let (n, immr, imms) = encode_bitmask_imm(value, sf)
                .unwrap_or_else(|| panic!("{value:#x} should encode (sf={sf})"));
            let decoded = decode_bitmask_imm(n, immr, imms, sf).unwrap();
            let expected = if sf { value } else { value & 0xFFFF_FFFF };
            assert_eq!(decoded, expected, "round-trip {value:#x} sf={sf}");
        }
    }

    // -- MOV/MOVZ/MOVK tests --

    #[test]
    fn decode_movz_x0_42() {
        // MOVZ X0, #42 = 0xD280_0540
        // 1_10_100101_00_0000000000101010_00000
        let instr = 0xD280_0540;
        let decoded = decode(instr).unwrap();
        assert_eq!(
            decoded,
            Instruction::MoveWide {
                op: MoveWideOp::Movz,
                sf: true,
                rd: 0,
                imm16: 42,
                hw: 0,
            }
        );
    }

    #[test]
    fn decode_movk_x1_hw1() {
        // MOVK X1, #0xABCD, LSL #16
        // 1_11_100101_01_1010101111001101_00001
        let instr = 0xF2A0_0001 | (0xABCD << 5);
        let decoded = decode(instr).unwrap();
        match decoded {
            Instruction::MoveWide { op, sf, rd, imm16, hw } => {
                assert_eq!(op, MoveWideOp::Movk);
                assert!(sf);
                assert_eq!(rd, 1);
                assert_eq!(imm16, 0xABCD);
                assert_eq!(hw, 1);
            }
            _ => panic!("expected MoveWide"),
        }
    }

    // -- ADD/SUB immediate tests --

    #[test]
    fn decode_add_x0_x1_42() {
        // ADD X0, X1, #42
        // 1_0_0_10001_00_000000101010_00001_00000
        let instr: u32 = 0b1_0_0_10001_00_000000101010_00001_00000;
        let decoded = decode(instr).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpImm {
                op: DpOp::Add,
                sf: true,
                rd: 0,
                rn: 1,
                imm: 42,
                shift: 0,
            }
        );
    }

    #[test]
    fn decode_subs_w3_w4_100() {
        // SUBS W3, W4, #100
        // 0_1_1_10001_00_000001100100_00100_00011
        let instr: u32 = 0b0_1_1_10001_00_000001100100_00100_00011;
        let decoded = decode(instr).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpImm {
                op: DpOp::Subs,
                sf: false,
                rd: 3,
                rn: 4,
                imm: 100,
                shift: 0,
            }
        );
    }

    // -- add/sub register tests --

    #[test]
    fn decode_add_x0_x1_x2() {
        // ADD X0, X1, X2
        // 1_0_0_01011_00_0_00010_000000_00001_00000
        let instr: u32 = 0b1_0_0_01011_00_0_00010_000000_00001_00000;
        let decoded = decode(instr).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpReg {
                op: DpOp::Add,
                sf: true,
                rd: 0,
                rn: 1,
                rm: 2,
                shift: ShiftType::LSL,
                amount: 0,
            }
        );
    }

    // -- branch tests --

    #[test]
    fn decode_b_forward() {
        // B #8 -> offset 8 bytes = 2 instructions
        // 0_00101_00000000000000000000000010
        let instr: u32 = 0b0_00101_00000000000000000000000010;
        let decoded = decode(instr).unwrap();
        assert_eq!(decoded, Instruction::BrImm { link: false, offset: 8 });
    }

    #[test]
    fn decode_bl() {
        // BL #-4 -> offset -4 bytes
        // 1_00101_11111111111111111111111111
        let instr: u32 = 0b1_00101_11111111111111111111111111;
        let decoded = decode(instr).unwrap();
        assert_eq!(decoded, Instruction::BrImm { link: true, offset: -4 });
    }

    #[test]
    fn decode_br_x30() {
        // BR X30 = 0xD61F_03C0
        let instr = 0xD61F_03C0;
        let decoded = decode(instr).unwrap();
        assert_eq!(decoded, Instruction::BrReg { op: BrRegOp::Br, rn: 30 });
    }

    #[test]
    fn decode_ret() {
        // RET (X30) = 0xD65F_03C0
        let instr = 0xD65F_03C0;
        let decoded = decode(instr).unwrap();
        assert_eq!(decoded, Instruction::BrReg { op: BrRegOp::Ret, rn: 30 });
    }

    #[test]
    fn decode_b_eq() {
        // B.EQ #8
        // 0101_0100 0000_0000 0000_0000 0100_0000
        let instr: u32 = 0x5400_0040;
        let decoded = decode(instr).unwrap();
        assert_eq!(
            decoded,
            Instruction::BCond {
                cond: Condition::EQ,
                offset: 8,
            }
        );
    }

    // -- load/store tests --

    #[test]
    fn decode_str_x0_sp_offset() {
        // STR X0, [SP, #8] (unsigned offset)
        // 11_111_0_01_00_000000000010_11111_00000
        let instr: u32 = 0xF900_07E0;
        let decoded = decode(instr).unwrap();
        match decoded {
            Instruction::LdSt { op, rt, rn, offset, size, mode } => {
                assert_eq!(op, LdStOp::Str);
                assert_eq!(rt, 0);
                assert_eq!(rn, 31); // SP
                assert_eq!(size, MemSize::X);
                assert_eq!(mode, IndexMode::SignedOffset);
                if let LdStOffset::Immediate(off) = offset {
                    assert_eq!(off, 8);
                } else {
                    panic!("expected immediate offset");
                }
            }
            _ => panic!("expected LdSt"),
        }
    }

    #[test]
    fn decode_ldr_x1_x2_pre_index() {
        // LDR X1, [X2, #16]! (pre-index)
        // 11_111_0_00_01_0_000010000_11_00010_00001
        let instr: u32 = 0xF841_0C41;
        let decoded = decode(instr).unwrap();
        match decoded {
            Instruction::LdSt { op, rt, rn, offset, size, mode } => {
                assert_eq!(op, LdStOp::Ldr);
                assert_eq!(rt, 1);
                assert_eq!(rn, 2);
                assert_eq!(size, MemSize::X);
                assert_eq!(mode, IndexMode::PreIndex);
                if let LdStOffset::Immediate(off) = offset {
                    assert_eq!(off, 16);
                } else {
                    panic!("expected immediate offset");
                }
            }
            _ => panic!("expected LdSt"),
        }
    }

    #[test]
    fn decode_stp_x0_x1_sp_pre() {
        // STP X0, X1, [SP, #-16]! (pre-index)
        // 10_101_0_011_1111110_00001_11111_00000
        let instr: u32 = 0xA9BF_07E0;
        let decoded = decode(instr).unwrap();
        match decoded {
            Instruction::LdStPair { op, sf, rt, rt2, rn, imm7, mode } => {
                assert_eq!(op, LdStPairOp::Stp);
                assert!(sf);
                assert_eq!(rt, 0);
                assert_eq!(rt2, 1);
                assert_eq!(rn, 31);
                assert_eq!(imm7, -16);
                assert_eq!(mode, IndexMode::PreIndex);
            }
            _ => panic!("expected LdStPair, got {:?}", decoded),
        }
    }

    // -- NOP and SVC --

    #[test]
    fn decode_nop() {
        assert_eq!(decode(0xD503_201F).unwrap(), Instruction::Nop);
    }

    #[test]
    fn decode_svc_0() {
        let instr = 0xD400_0001;
        assert_eq!(decode(instr).unwrap(), Instruction::Svc { imm16: 0 });
    }

    // -- unknown instruction --

    #[test]
    fn decode_unknown() {
        assert!(decode(0x0000_0000).is_err());
    }

    // -- extended-register addressing --

    /// Build the instruction word for LDR Xt, [Xn, Rm, option shift].
    /// `option` is the 3-bit encoding (010=UXTW, 011=LSL, 110=SXTW, 111=SXTX).
    /// `s` is 1 when a shift is applied, 0 otherwise.
    fn build_ldr_x_extended(rt: u8, rn: u8, rm: u8, option: u8, s: u8) -> u32 {
        // size=11 (X), V=0, opc=01 (LDR), top nibble 0xF8, idx_type=10, imm9=0.
        let base: u32 = 0xF860_0800;
        base | ((rm as u32 & 0x1F) << 16)
            | ((option as u32 & 0x7) << 13)
            | ((s as u32 & 0x1) << 12)
            | ((rn as u32 & 0x1F) << 5)
            | (rt as u32 & 0x1F)
    }

    #[test]
    fn decode_ldr_extended_uxtw_no_shift() {
        let word = build_ldr_x_extended(0, 1, 2, 0b010, 0);
        match decode(word).unwrap() {
            Instruction::LdSt { offset: LdStOffset::Register { rm, extend, shift_amount }, .. } => {
                assert_eq!(rm, 2);
                assert_eq!(extend, ExtendType::Uxtw);
                assert_eq!(shift_amount, None);
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn decode_ldr_extended_sxtw_with_shift_3() {
        // For MemSize::X, S=1 gives shift 3 (scaled by 8 bytes).
        let word = build_ldr_x_extended(0, 1, 2, 0b110, 1);
        match decode(word).unwrap() {
            Instruction::LdSt { offset: LdStOffset::Register { rm, extend, shift_amount }, .. } => {
                assert_eq!(rm, 2);
                assert_eq!(extend, ExtendType::Sxtw);
                assert_eq!(shift_amount, Some(3));
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn decode_ldr_extended_lsl_and_sxtx() {
        let lsl = build_ldr_x_extended(0, 1, 2, 0b011, 1);
        let sxtx = build_ldr_x_extended(0, 1, 2, 0b111, 1);
        let matches = |w: u32, expected: ExtendType| match decode(w).unwrap() {
            Instruction::LdSt { offset: LdStOffset::Register { extend, .. }, .. } => {
                extend == expected
            }
            _ => false,
        };
        assert!(matches(lsl, ExtendType::Lsl));
        assert!(matches(sxtx, ExtendType::Sxtx));
    }

    #[test]
    fn decode_ldr_reserved_option_errors() {
        // option = 000 (UXTB) is not valid for indexed addressing.
        let bad = build_ldr_x_extended(0, 1, 2, 0b000, 0);
        assert!(decode(bad).is_err());
    }

    // -- compare-and-branch, test-bit-and-branch --

    fn build_cbz(sf: bool, nonzero: bool, rt: u8, offset_bytes: i64) -> u32 {
        let sf_bit = if sf { 1u32 << 31 } else { 0 };
        let op_bit = if nonzero { 1u32 << 24 } else { 0 };
        let imm19 = ((offset_bytes / 4) as u32) & 0x7_FFFF;
        0x3400_0000 | sf_bit | op_bit | (imm19 << 5) | (rt as u32 & 0x1F)
    }

    fn build_tbz(nonzero: bool, bit_pos: u8, rt: u8, offset_bytes: i64) -> u32 {
        let b5 = (bit_pos >> 5) as u32;
        let b40 = (bit_pos & 0x1F) as u32;
        let op_bit = if nonzero { 1u32 << 24 } else { 0 };
        let imm14 = ((offset_bytes / 4) as u32) & 0x3FFF;
        0x3600_0000 | (b5 << 31) | op_bit | (b40 << 19) | (imm14 << 5) | (rt as u32 & 0x1F)
    }

    #[test]
    fn decode_cbz_w() {
        let word = build_cbz(false, false, 3, 16);
        match decode(word).unwrap() {
            Instruction::CompareBranch { sf, rt, nonzero, offset } => {
                assert!(!sf);
                assert_eq!(rt, 3);
                assert!(!nonzero);
                assert_eq!(offset, 16);
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn decode_cbnz_x_negative_offset() {
        let word = build_cbz(true, true, 5, -8);
        match decode(word).unwrap() {
            Instruction::CompareBranch { sf, rt, nonzero, offset } => {
                assert!(sf);
                assert_eq!(rt, 5);
                assert!(nonzero);
                assert_eq!(offset, -8);
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn decode_tbz_bit_zero() {
        let word = build_tbz(false, 0, 7, 12);
        match decode(word).unwrap() {
            Instruction::TestBranch { rt, bit_pos, nonzero, offset } => {
                assert_eq!(rt, 7);
                assert_eq!(bit_pos, 0);
                assert!(!nonzero);
                assert_eq!(offset, 12);
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn decode_tbnz_high_bit() {
        let word = build_tbz(true, 63, 2, -4);
        match decode(word).unwrap() {
            Instruction::TestBranch { rt, bit_pos, nonzero, offset } => {
                assert_eq!(rt, 2);
                assert_eq!(bit_pos, 63);
                assert!(nonzero);
                assert_eq!(offset, -4);
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    // -- bitfield extract-and-extend (sxt*/uxt*) --

    #[test]
    fn decode_sxtb_x_is_sbfm() {
        // SXTB Xd, Wn = SBFM Xd, Xn, #0, #7: sf=1, opc=00, N=1, immr=0, imms=7.
        let word: u32 = (1 << 31) | (0b00 << 29) | (0b100110 << 23) | (1 << 22) | (7 << 10) | (1 << 5);
        match decode(word).unwrap() {
            Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
                assert_eq!(op, BitfieldOp::Sbfm);
                assert!(sf);
                assert_eq!(rd, 0);
                assert_eq!(rn, 1);
                assert_eq!(immr, 0);
                assert_eq!(imms, 7);
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn ldrs_register_offset_decodes_as_a_sign_extending_load() {
        // 0x38E26820 = ldrsb w0, [x1, x2]; keying the family on bit 22
        // alone misread it as a plain STR. 0xB8A27823 = ldrsw x3,
        // [x1, x2, lsl #2].
        match decode(0x38E2_6820).unwrap() {
            Instruction::LdrSignExtended { rt, rn, size, sf, offset, .. } => {
                assert_eq!(rt, 0);
                assert_eq!(rn, 1);
                assert_eq!(size, MemSize::B);
                assert!(!sf);
                assert!(matches!(offset, LdStOffset::Register { rm: 2, .. }));
            }
            other => panic!("expected LdrSignExtended, got {other:?}"),
        }
        match decode(0xB8A2_7823).unwrap() {
            Instruction::LdrSignExtended { rt, size, sf, .. } => {
                assert_eq!(rt, 3);
                assert_eq!(size, MemSize::W);
                assert!(sf);
            }
            other => panic!("expected LdrSignExtended, got {other:?}"),
        }
        // The writeback forms take the same arm rather than falling
        // through to a plain LDR/STR: 0x38C00421 = ldrsb w1, [x1], #0.
        match decode(0x38C0_0421).unwrap() {
            Instruction::LdrSignExtended { rt, rn, size, sf, mode, .. } => {
                assert_eq!((rt, rn), (1, 1));
                assert_eq!(size, MemSize::B);
                assert!(!sf);
                assert_eq!(mode, IndexMode::PostIndex);
            }
            other => panic!("expected LdrSignExtended, got {other:?}"),
        }
        // size=X stays reserved in this space: it is the prefetch encoding.
        assert!(decode(0xF8C0_0421).is_err());
    }

    #[test]
    fn dp1_source_words_decode_by_opcode_and_width() {
        // Bit 30 set is the DP 1-source group. The opcode alone does not
        // name the row: 000010 is rev32 at X width and rev at W width, so
        // a decoder keying on the opcode runs one as the other.
        assert!(
            matches!(
                decode(0xDAC0_0800),
                Ok(Instruction::DataProc1 { op: Dp1Op::Rev32, sf: true, .. })
            ),
            "rev32 x0,x0"
        );
        assert!(
            matches!(
                decode(0x5AC0_0800),
                Ok(Instruction::DataProc1 { op: Dp1Op::Rev, sf: false, .. })
            ),
            "rev w0,w0"
        );
        // Rows outside the table, the S bit, and a nonzero Rm field are
        // all reserved and must reject rather than run as something else.
        assert!(decode(0xDAC0_1800).is_err(), "opcode 000110 is not a row");
        assert!(decode(0xFAC0_1020).is_err(), "the S bit is reserved here");
        assert!(decode(0xDAC1_1020).is_err(), "Rm must be zero");
        // The cond-select op=1 family (csinv/csneg) shares the group.
        assert!(
            matches!(decode(0x5A80_0000), Ok(Instruction::CondSel { op: CondSelOp::Csinv, .. })),
            "csinv w0,w0,w0,eq decodes"
        );
        assert!(
            matches!(decode(0xDA80_0400), Ok(Instruction::CondSel { op: CondSelOp::Csneg, .. })),
            "csneg x0,x0,x0,eq decodes"
        );
        // sanity: the older forms still decode.
        assert!(decode(0x1A80_0000).is_ok(), "csel w0,w0,w0,eq");
        assert!(decode(0x1AC0_0800).is_ok(), "udiv w0,w0,w0");
    }

    #[test]
    fn reserved_32bit_bitfield_encodings_are_rejected() {
        // sf=0 with immr/imms >= 32 (or N != sf) is reserved; the LSL-alias
        // arm computes reg_size - immr and underflows without the guard.
        // Both words are reserved encodings: immr=33/imms=32 and
        // immr=46/imms=45.
        assert!(decode(0x5321_8000).is_err());
        assert!(decode(0x536E_B400).is_err());
        // N=1 with sf=0 is reserved even with small fields.
        assert!(decode(0x5340_0C41).is_err());
    }

    #[test]
    fn reserved_ext_8b_index_is_rejected() {
        // ext v3.8b, v7.8b, v21.8b, #11: imm4<3> set with Q=0 is reserved,
        // and the executor's 16-byte window would run past its end.
        assert!(decode(0x2E15_58E3).is_err());
        assert!(decode(0x2E15_78E3).is_err());
        // #7 is the last valid 8B index and #11 is fine with Q=1.
        assert!(decode(0x2E15_38E3).is_ok());
        assert!(decode(0x6E15_58E3).is_ok());
    }

    #[test]
    fn decode_uxth_w_is_ubfm() {
        // UXTH Wd, Wn = UBFM Wd, Wn, #0, #15: sf=0, opc=10, N=0, immr=0, imms=15.
        let word: u32 = (0b10 << 29) | (0b100110 << 23) | (15 << 10) | (2 << 5) | 3;
        match decode(word).unwrap() {
            Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
                assert_eq!(op, BitfieldOp::Ubfm);
                assert!(!sf);
                assert_eq!(rd, 3);
                assert_eq!(rn, 2);
                assert_eq!(immr, 0);
                assert_eq!(imms, 15);
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn decode_lsl_immediate_stays_a_shift_not_a_bitfield() {
        // `lsl x0, x1, #4` lowers to UBFM with imms+1==immr; it must keep
        // decoding as the shifted-register alias, not the general bitfield.
        let word: u32 =
            (1 << 31) | (0b10 << 29) | (0b100110 << 23) | (1 << 22) | (60 << 16) | (59 << 10) | (1 << 5);
        match decode(word).unwrap() {
            Instruction::LogReg { shift, amount, .. } => {
                assert_eq!(shift, ShiftType::LSL);
                assert_eq!(amount, 4);
            }
            other => panic!("expected LogReg (LSL alias), got {other:?}"),
        }
    }

    // -- ADR / ADRP --

    #[test]
    fn decode_adrp_recovers_page_displacement() {
        // ADRP X0, +1 page (imm21 = 1 -> byte displacement 0x1000).
        let imm21 = 1u32;
        let immlo = imm21 & 0x3;
        let immhi = (imm21 >> 2) & 0x7_FFFF;
        let word: u32 = (1 << 31) | (immlo << 29) | (0b10000 << 24) | (immhi << 5);
        match decode(word).unwrap() {
            Instruction::Adr { adrp, rd, imm } => {
                assert!(adrp);
                assert_eq!(rd, 0);
                assert_eq!(imm, 0x1000);
            }
            other => panic!("expected Adr, got {other:?}"),
        }
    }

    #[test]
    fn decode_adr_byte_relative() {
        // ADR X5, +8 bytes (imm21 = 8, no page scaling).
        let imm21 = 8u32;
        let immlo = imm21 & 0x3;
        let immhi = (imm21 >> 2) & 0x7_FFFF;
        let word: u32 = (immlo << 29) | (0b10000 << 24) | (immhi << 5) | 5;
        match decode(word).unwrap() {
            Instruction::Adr { adrp, rd, imm } => {
                assert!(!adrp);
                assert_eq!(rd, 5);
                assert_eq!(imm, 8);
            }
            other => panic!("expected Adr, got {other:?}"),
        }
    }

    // -- conditional select --

    #[test]
    fn decode_csel_x0_x1_x2_eq() {
        // CSEL X0, X1, X2, EQ
        // 1_0_0_11010100_00010_0000_00_00001_00000
        let decoded = decode(0x9A82_0020).unwrap();
        assert_eq!(
            decoded,
            Instruction::CondSel {
                op: CondSelOp::Csel,
                sf: true,
                rd: 0,
                rn: 1,
                rm: 2,
                cond: Condition::EQ,
            }
        );
    }

    #[test]
    fn decode_csinc_w0_w1_w2_ne() {
        // CSINC W0, W1, W2, NE
        // 0_0_0_11010100_00010_0001_01_00001_00000
        let decoded = decode(0x1A82_1420).unwrap();
        assert_eq!(
            decoded,
            Instruction::CondSel {
                op: CondSelOp::Csinc,
                sf: false,
                rd: 0,
                rn: 1,
                rm: 2,
                cond: Condition::NE,
            }
        );
    }

    // -- divide and multiply-accumulate --

    #[test]
    fn decode_udiv_x0_x1_x2() {
        // UDIV X0, X1, X2
        // 1_0_0_11010110_00010_000010_00001_00000
        let decoded = decode(0x9AC2_0820).unwrap();
        assert_eq!(
            decoded,
            Instruction::MulDiv { op: MulDivOp::Udiv, sf: true, rd: 0, rn: 1, rm: 2 }
        );
    }

    #[test]
    fn decode_sdiv_x0_x1_x2() {
        // SDIV X0, X1, X2
        // 1_0_0_11010110_00010_000011_00001_00000
        let decoded = decode(0x9AC2_0C20).unwrap();
        assert_eq!(
            decoded,
            Instruction::MulDiv { op: MulDivOp::Sdiv, sf: true, rd: 0, rn: 1, rm: 2 }
        );
    }

    #[test]
    fn decode_madd_x0_x1_x2_x3() {
        // MADD X0, X1, X2, X3
        // 1_00_11011_000_00010_0_00011_00001_00000
        let decoded = decode(0x9B02_0C20).unwrap();
        assert_eq!(
            decoded,
            Instruction::MulAccumulate {
                op: MulAccumulateOp::Madd,
                sf: true,
                rd: 0,
                rn: 1,
                rm: 2,
                ra: 3,
            }
        );
    }

    #[test]
    fn decode_msub_x0_x1_x2_x3() {
        // MSUB X0, X1, X2, X3
        // 1_00_11011_000_00010_1_00011_00001_00000
        let decoded = decode(0x9B02_8C20).unwrap();
        assert_eq!(
            decoded,
            Instruction::MulAccumulate {
                op: MulAccumulateOp::Msub,
                sf: true,
                rd: 0,
                rn: 1,
                rm: 2,
                ra: 3,
            }
        );
    }

    #[test]
    fn decode_madd_with_zr_accumulator_is_mul() {
        // MADD X0, X1, X2, XZR stays on the MulDiv::Mul path.
        let decoded = decode(0x9B02_7C20).unwrap();
        assert_eq!(
            decoded,
            Instruction::MulDiv { op: MulDivOp::Mul, sf: true, rd: 0, rn: 1, rm: 2 }
        );
    }

    // -- load/store pair index modes --

    #[test]
    fn decode_ldp_post_index_scales_imm7_by_eight() {
        // LDP X0, X1, [SP], #16 (raw imm7 = 2, scaled by 8)
        // 10_101_0_001_1_0000010_00001_11111_00000
        let decoded = decode(0xA8C1_07E0).unwrap();
        assert_eq!(
            decoded,
            Instruction::LdStPair {
                op: LdStPairOp::Ldp,
                sf: true,
                rt: 0,
                rt2: 1,
                rn: 31,
                imm7: 16,
                mode: IndexMode::PostIndex,
            }
        );
    }

    // -- add/sub with carry --

    #[test]
    fn decode_adc_x0_x1_x2() {
        // ADC X0, X1, X2 = 0x9A020020
        let decoded = decode(0x9A02_0020).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpCarry {
                sub: false,
                set_flags: false,
                sf: true,
                rd: 0,
                rn: 1,
                rm: 2,
            }
        );
    }

    #[test]
    fn decode_adcs_w3_w4_w5() {
        // ADCS W3, W4, W5 = 0x3A050083
        let decoded = decode(0x3A05_0083).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpCarry {
                sub: false,
                set_flags: true,
                sf: false,
                rd: 3,
                rn: 4,
                rm: 5,
            }
        );
    }

    #[test]
    fn decode_sbc_x9_x10_x11() {
        // SBC X9, X10, X11 = 0xDA0B0149
        let decoded = decode(0xDA0B_0149).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpCarry {
                sub: true,
                set_flags: false,
                sf: true,
                rd: 9,
                rn: 10,
                rm: 11,
            }
        );
    }

    #[test]
    fn decode_sbcs_w0_w1_w2() {
        // SBCS W0, W1, W2 = 0x7A020020
        let decoded = decode(0x7A02_0020).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpCarry {
                sub: true,
                set_flags: true,
                sf: false,
                rd: 0,
                rn: 1,
                rm: 2,
            }
        );
    }

    #[test]
    fn decode_adc_with_zero_register_operand() {
        // ADC X0, X1, XZR = 0x9A1F0020: register 31 is ZR here, never SP.
        let decoded = decode(0x9A1F_0020).unwrap();
        assert_eq!(
            decoded,
            Instruction::DpCarry {
                sub: false,
                set_flags: false,
                sf: true,
                rd: 0,
                rn: 1,
                rm: 31,
            }
        );
    }

    #[test]
    fn decode_rejects_carry_word_with_nonzero_fixed_field() {
        // Same space with bits [15:10] = 000001, which no instruction uses:
        // it must stay unknown rather than decoding as ADC.
        assert!(decode(0x9A02_0420).is_err());
    }

    #[test]
    fn decode_stp_w_signed_offset_scales_imm7_by_four() {
        // STP W0, W1, [X2, #4] (raw imm7 = 1, scaled by 4)
        // 00_101_0_010_0_0000001_00001_00010_00000
        let decoded = decode(0x2900_8440).unwrap();
        assert_eq!(
            decoded,
            Instruction::LdStPair {
                op: LdStPairOp::Stp,
                sf: false,
                rt: 0,
                rt2: 1,
                rn: 2,
                imm7: 4,
                mode: IndexMode::SignedOffset,
            }
        );
    }

    // -- the half-precision pair (FCVTN / FCVTL over 4H) --

    /// Every expected value here is worked out by hand from the format,
    /// not read back off the implementation. A half subnormal is
    /// `frac * 2^-24`, the least normal is `2^-14`, and the largest
    /// finite half is 65504.
    #[test]
    fn f32_to_f16_rounds_and_denormalizes_by_hand() {
        // Subnormals: the value IS the fraction field, in units of 2^-24.
        assert_eq!(f32_to_f16(2f32.powi(-20)), 0x0010); // 16 * 2^-24
        assert_eq!(f32_to_f16(2f32.powi(-24)), 0x0001); // the least subnormal
        // Half a unit in the last place, so round-to-nearest-EVEN keeps
        // the even neighbour, which is zero.
        assert_eq!(f32_to_f16(2f32.powi(-25)), 0x0000);
        // Three quarters of a ulp rounds up instead.
        assert_eq!(f32_to_f16(1.5 * 2f32.powi(-25)), 0x0001);
        // 65520 sits exactly halfway between the largest finite half and
        // 65536, so ties-to-even carries it out of the format entirely.
        assert_eq!(f32_to_f16(65520.0), 0x7c00);
        assert_eq!(f32_to_f16(65504.0), 0x7bff);
        assert_eq!(f32_to_f16(1.0), 0x3c00);
        assert_eq!(f32_to_f16(-2.5), 0xc100);
        assert_eq!(f32_to_f16(f32::INFINITY), 0x7c00);
        assert_eq!(f32_to_f16(f32::NEG_INFINITY), 0xfc00);
        assert_eq!(f32_to_f16(-0.0), 0x8000);
        // A NaN keeps its sign and the payload bits half precision has
        // room for, and a signalling one is quieted on the way down.
        assert_eq!(f32_to_f16(f32::from_bits(0x7FC0_2000)), 0x7e01);
        assert_eq!(f32_to_f16(f32::from_bits(0x7F80_2000)), 0x7e01);
        assert_eq!(f32_to_f16(f32::from_bits(0xFFC0_2000)), 0xfe01);
    }

    #[test]
    fn f16_to_f32_widens_exactly_by_hand() {
        assert_eq!(f16_to_f32(0x0001), 2f32.powi(-24));
        assert_eq!(f16_to_f32(0x0010), 2f32.powi(-20));
        assert_eq!(f16_to_f32(0x0400), 2f32.powi(-14)); // the least normal
        assert_eq!(f16_to_f32(0x3c00), 1.0);
        assert_eq!(f16_to_f32(0x7bff), 65504.0);
        assert_eq!(f16_to_f32(0xc100), -2.5);
        assert_eq!(f16_to_f32(0x7c00), f32::INFINITY);
        assert_eq!(f16_to_f32(0xfc00), f32::NEG_INFINITY);
        assert_eq!(f16_to_f32(0x0000).to_bits(), 0);
        assert_eq!(f16_to_f32(0x8000).to_bits(), 0x8000_0000);
        // The quiet bit is set on the way up too, and the payload moves.
        assert_eq!(f16_to_f32(0x7e00).to_bits(), 0x7FC0_0000);
        assert_eq!(f16_to_f32(0x7e01).to_bits(), 0x7FC0_2000);
        assert_eq!(f16_to_f32(0x7c01).to_bits(), 0x7FC0_2000);
    }

    /// Widening is exact, so narrowing has to undo it bit for bit. The
    /// loops cover every finite non-zero half: the subnormals, where the
    /// leading one has to be found and put back, and the normals.
    #[test]
    fn every_finite_f16_round_trips_through_f32() {
        for half in (0x0001u16..=0x7bff).chain(0x8001u16..=0xfbff) {
            let back = f32_to_f16(f16_to_f32(half));
            assert_eq!(back, half, "0x{half:04x} came back as 0x{back:04x}");
        }
    }
}
