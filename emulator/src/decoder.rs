use crate::errors::EmuError;
use crate::registers::{Condition, ShiftType};

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
// Advanced SIMD operand shapes
// ---------------------------------------------------------------------------

/// A vector operand's arrangement: `v3.16b` is sixteen lanes of one byte,
/// `v3.2d` two lanes of eight. The pair (lane width, 64 or 128 bits) is
/// all any encoding here carries; the lane count follows from it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Arrangement {
    /// Lane width in bytes: 1, 2, 4 or 8.
    pub esize: u8,
    /// The 128-bit form; false is the 64-bit one, whose upper half is
    /// zeroed by every write.
    pub q: bool,
}

impl Arrangement {
    /// The suffix GAS spells this arrangement with, without the dot.
    pub fn suffix(self) -> &'static str {
        match (self.esize, self.q) {
            (1, false) => "8b",
            (1, true) => "16b",
            (2, false) => "4h",
            (2, true) => "8h",
            (4, false) => "2s",
            (4, true) => "4s",
            (8, false) => "1d",
            _ => "2d",
        }
    }
}

/// The letter GAS names a lane width with (`v3.b[15]`).
pub fn element_letter(esize: u8) -> char {
    match esize {
        1 => 'b',
        2 => 'h',
        4 => 's',
        _ => 'd',
    }
}

/// Which mnemonic one `cmode`/`op` pair of the Advanced SIMD
/// modified-immediate group spells.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdImmOp {
    Movi,
    Mvni,
    Orr,
    Bic,
    /// FMOV (vector, immediate): cmode 1111, where imm8 is the VFP
    /// 8-bit float rather than a bit pattern.
    Fmov,
}

/// What a `cmode`/`op` pair means: the mnemonic, the element the
/// immediate fills, and how imm8 is spread across it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SimdImmForm {
    pub op: SimdImmOp,
    /// Element width in bytes the immediate fills: 1, 2, 4, or 8 for the
    /// byte-mask form.
    pub esize: u8,
    /// The `lsl` or `msl` amount in bits.
    pub shift: u8,
    /// "Shifting ones": the bits below the shifted imm8 come in as ones.
    pub msl: bool,
}

/// Read one `cmode`/`op` pair of the modified-immediate group. This is
/// the single table both the encoder and the decoder work from, so the
/// two cannot disagree about what a cmode means. `None` is a cmode no
/// form of the group claims.
pub fn simd_imm_form(cmode: u8, op: bool) -> Option<SimdImmForm> {
    let logical = cmode & 1 == 1; // cmode<0> picks ORR/BIC over MOVI/MVNI
    let shifted = |op_bit: bool| if op_bit { SimdImmOp::Mvni } else { SimdImmOp::Movi };
    let masked = |op_bit: bool| if op_bit { SimdImmOp::Bic } else { SimdImmOp::Orr };
    match cmode >> 1 {
        // cmode 0xx0/0xx1: a 32-bit element, imm8 shifted by 0, 8, 16 or 24.
        0b000..=0b011 => Some(SimdImmForm {
            op: if logical { masked(op) } else { shifted(op) },
            esize: 4,
            shift: (cmode >> 1) * 8,
            msl: false,
        }),
        // cmode 10x0/10x1: a 16-bit element, imm8 shifted by 0 or 8.
        0b100 | 0b101 => Some(SimdImmForm {
            op: if logical { masked(op) } else { shifted(op) },
            esize: 2,
            shift: ((cmode >> 1) & 1) * 8,
            msl: false,
        }),
        // cmode 110x: a 32-bit element with the low bits shifted in as ones.
        0b110 => Some(SimdImmForm {
            op: shifted(op),
            esize: 4,
            shift: if cmode & 1 == 1 { 16 } else { 8 },
            msl: true,
        }),
        // cmode 1110: a byte per lane, or with op set the 64-bit byte mask.
        0b111 if cmode == 0b1110 => Some(SimdImmForm {
            op: SimdImmOp::Movi,
            esize: if op { 8 } else { 1 },
            shift: 0,
            msl: false,
        }),
        // cmode 1111 is the vector FMOV immediate: op picks the lane
        // width (clear for 2s/4s, set for 2d), and imm8 is a float.
        0b111 if cmode == 0b1111 => Some(SimdImmForm {
            op: SimdImmOp::Fmov,
            esize: if op { 8 } else { 4 },
            shift: 0,
            msl: false,
        }),
        _ => None,
    }
}

/// Expand `imm8` into one element of `form`, the way AdvSIMDExpandImm
/// does. The 8-byte element is the byte mask: each bit of imm8 becomes a
/// whole byte of 0x00 or 0xff. Nothing is inverted here: MVNI and BIC
/// invert the expanded immediate themselves, which is where the ARM
/// pseudocode puts it too.
pub fn simd_expand_imm(form: SimdImmForm, imm8: u8) -> u64 {
    // FMOV's imm8 is the scalar VFP float, expanded once and narrowed to
    // the lane: the same eight bits the scalar `fmov s0, #1.0` carries.
    if form.op == SimdImmOp::Fmov {
        let wide = expand_fmov_imm8(imm8);
        return if form.esize == 8 {
            wide
        } else {
            u64::from((f64::from_bits(wide) as f32).to_bits())
        };
    }
    match form.esize {
        1 => u64::from(imm8),
        2 => u64::from((u32::from(imm8) << form.shift) as u16),
        4 => {
            let ones = if form.msl { (1u32 << form.shift) - 1 } else { 0 };
            u64::from((u32::from(imm8) << form.shift) | ones)
        }
        _ => {
            let mut value = 0u64;
            for byte in 0..8 {
                if (imm8 >> byte) & 1 == 1 {
                    value |= 0xffu64 << (byte * 8);
                }
            }
            value
        }
    }
}

/// Repeat `element` (of `esize` bytes) across `bytes` bytes. The result
/// is the value a vector write puts in the register, so the 64-bit forms
/// leave the upper half zero, exactly as the hardware does.
pub fn simd_replicate(element: u64, esize: u8, bytes: u8) -> u128 {
    let mut out: u128 = 0;
    let width = u32::from(esize) * 8;
    let mask: u128 = if width >= 128 { u128::MAX } else { (1u128 << width) - 1 };
    for lane in 0..(bytes / esize) {
        out |= (u128::from(element) & mask) << (u32::from(lane) * width);
    }
    out
}

// --- the integer vector classes ---
//
// Three-same, two-register misc and across-lanes are three encoding
// classes, each with one table row per (U, opcode) pair naming the
// mnemonic and the lane widths it takes. The encoder, the decoder,
// `format` and the executor all read these rows, so a spelling, a word
// and a semantic cannot drift apart.

/// A set of lane widths, one bit per element width: bit 0 is a byte,
/// bit 1 a halfword, bit 2 a word, bit 3 a doubleword.
pub type LaneMask = u8;

const LANE_B: LaneMask = 0b0001;
const LANE_H: LaneMask = 0b0010;
const LANE_S: LaneMask = 0b0100;
const LANE_D: LaneMask = 0b1000;
const LANE_BH: LaneMask = LANE_B | LANE_H;
const LANE_HS: LaneMask = LANE_H | LANE_S;
const LANE_BHS: LaneMask = LANE_BH | LANE_S;
const LANE_BHSD: LaneMask = LANE_BHS | LANE_D;
const LANE_NONE: LaneMask = 0;

/// Whether a lane of `esize` bytes is in the mask.
pub fn lane_allowed(mask: LaneMask, esize: u8) -> bool {
    esize.is_power_of_two() && esize <= 8 && mask & (1 << esize.trailing_zeros()) != 0
}

/// The two-bit size field a lane width encodes as.
pub fn size_field(esize: u8) -> u8 {
    esize.trailing_zeros() as u8
}

/// The lane width in bytes a two-bit size field names.
pub fn size_esize(size: u8) -> u8 {
    1u8 << size
}

/// The eight bitwise three-same operations. They share opcode 00011 and
/// are told apart by U and the size field, which names no lane here: all
/// eight are spelled 8b or 16b whatever their size bits say.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdLogicalOp {
    And,
    Bic,
    Orr,
    Orn,
    Eor,
    Bsl,
    Bit,
    Bif,
}

/// (op, mnemonic, U, size).
pub const SIMD_LOGICAL: &[(SimdLogicalOp, &str, bool, u8)] = &[
    (SimdLogicalOp::And, "and", false, 0b00),
    (SimdLogicalOp::Bic, "bic", false, 0b01),
    (SimdLogicalOp::Orr, "orr", false, 0b10),
    (SimdLogicalOp::Orn, "orn", false, 0b11),
    (SimdLogicalOp::Eor, "eor", true, 0b00),
    (SimdLogicalOp::Bsl, "bsl", true, 0b01),
    (SimdLogicalOp::Bit, "bit", true, 0b10),
    (SimdLogicalOp::Bif, "bif", true, 0b11),
];

pub fn simd_logical_by_bits(u: bool, size: u8) -> Option<SimdLogicalOp> {
    SIMD_LOGICAL
        .iter()
        .find(|(_, _, row_u, row_size)| *row_u == u && *row_size == size)
        .map(|(op, _, _, _)| *op)
}

pub fn simd_logical_by_name(name: &str) -> Option<(SimdLogicalOp, bool, u8)> {
    SIMD_LOGICAL
        .iter()
        .find(|(_, row_name, _, _)| *row_name == name)
        .map(|(op, _, u, size)| (*op, *u, *size))
}

pub fn simd_logical_name(op: SimdLogicalOp) -> &'static str {
    SIMD_LOGICAL
        .iter()
        .find(|(row_op, _, _, _)| *row_op == op)
        .map(|(_, name, _, _)| *name)
        .expect("every logical op has a row")
}

/// The arithmetic and compare half of the three-same class: one row per
/// (U, opcode) pair at bits 15:11.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdSameOp {
    Shadd,
    Uhadd,
    Sqadd,
    Uqadd,
    Srhadd,
    Urhadd,
    Shsub,
    Uhsub,
    Sqsub,
    Uqsub,
    Cmgt,
    Cmhi,
    Cmge,
    Cmhs,
    Smax,
    Umax,
    Smin,
    Umin,
    Sabd,
    Uabd,
    Saba,
    Uaba,
    Add,
    Sub,
    Cmtst,
    Cmeq,
    Mla,
    Mls,
    Mul,
    Pmul,
    Smaxp,
    Umaxp,
    Sminp,
    Uminp,
    Sqdmulh,
    Sqrdmulh,
    Addp,
    Sshl,
    Ushl,
    Srshl,
    Urshl,
    Sqshl,
    Uqshl,
    Sqrshl,
    Uqrshl,
}

pub struct SimdSameRow {
    pub op: SimdSameOp,
    pub name: &'static str,
    pub u: bool,
    /// The 5-bit opcode at bits 15:11.
    pub opcode: u8,
    /// Lane widths the vector form takes. A `d` lane here is always the
    /// 2d arrangement: no three-same form is spelled 1d.
    pub lanes: LaneMask,
    /// Widths the SIMD-scalar form takes (`add d3, d7, d21`).
    pub scalar: LaneMask,
}

const fn row_same(
    op: SimdSameOp,
    name: &'static str,
    u: bool,
    opcode: u8,
    lanes: LaneMask,
    scalar: LaneMask,
) -> SimdSameRow {
    SimdSameRow { op, name, u, opcode, lanes, scalar }
}

/// The three-same table, ordered by opcode with U inside it, the way the
/// group is laid out. Opcodes 01000..01011 are the register shifts,
/// whose second source is a per-lane shift COUNT rather than a value.
pub const SIMD_THREE_SAME: &[SimdSameRow] = &[
    row_same(SimdSameOp::Shadd, "shadd", false, 0x00, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Uhadd, "uhadd", true, 0x00, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Sqadd, "sqadd", false, 0x01, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Uqadd, "uqadd", true, 0x01, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Srhadd, "srhadd", false, 0x02, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Urhadd, "urhadd", true, 0x02, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Shsub, "shsub", false, 0x04, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Uhsub, "uhsub", true, 0x04, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Sqsub, "sqsub", false, 0x05, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Uqsub, "uqsub", true, 0x05, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Cmgt, "cmgt", false, 0x06, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Cmhi, "cmhi", true, 0x06, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Cmge, "cmge", false, 0x07, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Cmhs, "cmhs", true, 0x07, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Sshl, "sshl", false, 0x08, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Ushl, "ushl", true, 0x08, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Sqshl, "sqshl", false, 0x09, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Uqshl, "uqshl", true, 0x09, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Srshl, "srshl", false, 0x0a, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Urshl, "urshl", true, 0x0a, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Sqrshl, "sqrshl", false, 0x0b, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Uqrshl, "uqrshl", true, 0x0b, LANE_BHSD, LANE_BHSD),
    row_same(SimdSameOp::Smax, "smax", false, 0x0c, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Umax, "umax", true, 0x0c, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Smin, "smin", false, 0x0d, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Umin, "umin", true, 0x0d, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Sabd, "sabd", false, 0x0e, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Uabd, "uabd", true, 0x0e, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Saba, "saba", false, 0x0f, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Uaba, "uaba", true, 0x0f, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Add, "add", false, 0x10, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Sub, "sub", true, 0x10, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Cmtst, "cmtst", false, 0x11, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Cmeq, "cmeq", true, 0x11, LANE_BHSD, LANE_D),
    row_same(SimdSameOp::Mla, "mla", false, 0x12, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Mls, "mls", true, 0x12, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Mul, "mul", false, 0x13, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Pmul, "pmul", true, 0x13, LANE_B, LANE_NONE),
    row_same(SimdSameOp::Smaxp, "smaxp", false, 0x14, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Umaxp, "umaxp", true, 0x14, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Sminp, "sminp", false, 0x15, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Uminp, "uminp", true, 0x15, LANE_BHS, LANE_NONE),
    row_same(SimdSameOp::Sqdmulh, "sqdmulh", false, 0x16, LANE_HS, LANE_HS),
    row_same(SimdSameOp::Sqrdmulh, "sqrdmulh", true, 0x16, LANE_HS, LANE_HS),
    row_same(SimdSameOp::Addp, "addp", false, 0x17, LANE_BHSD, LANE_NONE),
];

pub fn simd_same_by_bits(u: bool, opcode: u8) -> Option<&'static SimdSameRow> {
    SIMD_THREE_SAME.iter().find(|row| row.u == u && row.opcode == opcode)
}

pub fn simd_same_by_name(name: &str) -> Option<&'static SimdSameRow> {
    SIMD_THREE_SAME.iter().find(|row| row.name == name)
}

pub fn simd_same_row(op: SimdSameOp) -> &'static SimdSameRow {
    SIMD_THREE_SAME
        .iter()
        .find(|row| row.op == op)
        .expect("every three-same op has a row")
}

/// The two-register misc class, the compares against zero included.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdMiscOp {
    Rev64,
    Rev32,
    Rev16,
    Saddlp,
    Uaddlp,
    Suqadd,
    Usqadd,
    Cls,
    Clz,
    Cnt,
    Mvn,
    Rbit,
    Sadalp,
    Uadalp,
    Sqabs,
    Sqneg,
    Cmgt0,
    Cmge0,
    Cmeq0,
    Cmle0,
    Cmlt0,
    Abs,
    Neg,
    Xtn,
    Sqxtun,
    Shll,
    Sqxtn,
    Uqxtn,
    Urecpe,
    Ursqrte,
}

/// What a two-register misc row's operands look like.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdMiscShape {
    /// `Vd.T, Vn.T`.
    Same,
    /// `Vd.T, Vn.T, #0`: the compares against zero.
    Zero,
    /// `Vd.<T doubled>, Vn.T`: the pairwise widening adds, whose
    /// destination holds half as many lanes of twice the width.
    Widen,
    /// `Vd.T, Vn.<T doubled>`: the narrowing extracts. Q selects the
    /// half of the destination they write, which is what the `2` suffix
    /// on the mnemonic spells; the plain form zeroes bits 127:64.
    Narrow,
    /// `Vd.<T doubled>, Vn.T, #<esize>`: SHLL, which shifts each lane
    /// left by exactly its own width into a lane of twice the width. Q
    /// selects the half of the SOURCE it reads.
    Shll,
}

pub struct SimdMiscRow {
    pub op: SimdMiscOp,
    pub name: &'static str,
    pub u: bool,
    /// The 5-bit opcode at bits 16:12.
    pub opcode: u8,
    /// Source lane widths the vector form takes.
    pub lanes: LaneMask,
    /// Widths the SIMD-scalar form takes.
    pub scalar: LaneMask,
    pub shape: SimdMiscShape,
    /// The size field where the row fixes it instead of it naming the
    /// lane. RBIT is spelled 8b/16b but encodes size 01: reading that
    /// size as a lane width would make it a halfword operation, which it
    /// is not.
    pub size: Option<u8>,
}

#[allow(clippy::too_many_arguments)] // one argument per table column
const fn row_misc(
    op: SimdMiscOp,
    name: &'static str,
    u: bool,
    opcode: u8,
    lanes: LaneMask,
    scalar: LaneMask,
    shape: SimdMiscShape,
    size: Option<u8>,
) -> SimdMiscRow {
    SimdMiscRow { op, name, u, opcode, lanes, scalar, shape, size }
}

pub const SIMD_TWO_MISC: &[SimdMiscRow] = &[
    row_misc(SimdMiscOp::Rev64, "rev64", false, 0x00, LANE_BHS, LANE_NONE, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Rev32, "rev32", true, 0x00, LANE_BH, LANE_NONE, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Rev16, "rev16", false, 0x01, LANE_B, LANE_NONE, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Saddlp, "saddlp", false, 0x02, LANE_BHS, LANE_NONE, SimdMiscShape::Widen, None),
    row_misc(SimdMiscOp::Uaddlp, "uaddlp", true, 0x02, LANE_BHS, LANE_NONE, SimdMiscShape::Widen, None),
    row_misc(SimdMiscOp::Suqadd, "suqadd", false, 0x03, LANE_BHSD, LANE_BHSD, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Usqadd, "usqadd", true, 0x03, LANE_BHSD, LANE_BHSD, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Cls, "cls", false, 0x04, LANE_BHS, LANE_NONE, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Clz, "clz", true, 0x04, LANE_BHS, LANE_NONE, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Cnt, "cnt", false, 0x05, LANE_B, LANE_NONE, SimdMiscShape::Same, Some(0b00)),
    row_misc(SimdMiscOp::Mvn, "mvn", true, 0x05, LANE_B, LANE_NONE, SimdMiscShape::Same, Some(0b00)),
    row_misc(SimdMiscOp::Rbit, "rbit", true, 0x05, LANE_B, LANE_NONE, SimdMiscShape::Same, Some(0b01)),
    row_misc(SimdMiscOp::Sadalp, "sadalp", false, 0x06, LANE_BHS, LANE_NONE, SimdMiscShape::Widen, None),
    row_misc(SimdMiscOp::Uadalp, "uadalp", true, 0x06, LANE_BHS, LANE_NONE, SimdMiscShape::Widen, None),
    row_misc(SimdMiscOp::Sqabs, "sqabs", false, 0x07, LANE_BHSD, LANE_BHSD, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Sqneg, "sqneg", true, 0x07, LANE_BHSD, LANE_BHSD, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Cmgt0, "cmgt", false, 0x08, LANE_BHSD, LANE_D, SimdMiscShape::Zero, None),
    row_misc(SimdMiscOp::Cmge0, "cmge", true, 0x08, LANE_BHSD, LANE_D, SimdMiscShape::Zero, None),
    row_misc(SimdMiscOp::Cmeq0, "cmeq", false, 0x09, LANE_BHSD, LANE_D, SimdMiscShape::Zero, None),
    row_misc(SimdMiscOp::Cmle0, "cmle", true, 0x09, LANE_BHSD, LANE_D, SimdMiscShape::Zero, None),
    row_misc(SimdMiscOp::Cmlt0, "cmlt", false, 0x0a, LANE_BHSD, LANE_D, SimdMiscShape::Zero, None),
    row_misc(SimdMiscOp::Abs, "abs", false, 0x0b, LANE_BHSD, LANE_D, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Neg, "neg", true, 0x0b, LANE_BHSD, LANE_D, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Xtn, "xtn", false, 0x12, LANE_BHS, LANE_NONE, SimdMiscShape::Narrow, None),
    row_misc(SimdMiscOp::Sqxtun, "sqxtun", true, 0x12, LANE_BHS, LANE_BHS, SimdMiscShape::Narrow, None),
    row_misc(SimdMiscOp::Shll, "shll", true, 0x13, LANE_BHS, LANE_NONE, SimdMiscShape::Shll, None),
    row_misc(SimdMiscOp::Sqxtn, "sqxtn", false, 0x14, LANE_BHS, LANE_BHS, SimdMiscShape::Narrow, None),
    row_misc(SimdMiscOp::Uqxtn, "uqxtn", true, 0x14, LANE_BHS, LANE_BHS, SimdMiscShape::Narrow, None),
    row_misc(SimdMiscOp::Urecpe, "urecpe", false, 0x1c, LANE_S, LANE_NONE, SimdMiscShape::Same, None),
    row_misc(SimdMiscOp::Ursqrte, "ursqrte", true, 0x1c, LANE_S, LANE_NONE, SimdMiscShape::Same, None),
];

/// Read a two-register misc row out of the word's fields. The size takes
/// part in the lookup because three rows share (U, opcode) and only the
/// size tells CNT, MVN and RBIT apart.
pub fn simd_misc_by_bits(u: bool, opcode: u8, size: u8) -> Option<&'static SimdMiscRow> {
    SIMD_TWO_MISC.iter().find(|row| {
        row.u == u
            && row.opcode == opcode
            && match row.size {
                Some(fixed) => fixed == size,
                None => lane_allowed(row.lanes, size_esize(size)),
            }
    })
}

/// Read a row by mnemonic and shape: `cmgt` names both a three-same row
/// and a compare-against-zero row, so the caller says which it parsed.
pub fn simd_misc_by_name(name: &str, zero: bool) -> Option<&'static SimdMiscRow> {
    SIMD_TWO_MISC
        .iter()
        .find(|row| row.name == name && (row.shape == SimdMiscShape::Zero) == zero)
}

pub fn simd_misc_row(op: SimdMiscOp) -> &'static SimdMiscRow {
    SIMD_TWO_MISC
        .iter()
        .find(|row| row.op == op)
        .expect("every misc op has a row")
}

/// The across-lanes class: a whole source vector folded into one scalar.
/// `addp d3, v7.2d` is the SIMD-scalar pairwise class, which has the same
/// shape and the same opcode as ADDV and differs only in bit 28.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdAcrossOp {
    Saddlv,
    Uaddlv,
    Smaxv,
    Umaxv,
    Sminv,
    Uminv,
    Addv,
    AddpScalar,
}

pub struct SimdAcrossRow {
    pub op: SimdAcrossOp,
    pub name: &'static str,
    pub u: bool,
    /// The 5-bit opcode at bits 16:12.
    pub opcode: u8,
    /// Source lane widths. An `s` source is always 4s: the group refuses
    /// the 64-bit arrangement of its widest lane, because folding two
    /// lanes into one register is what the pairwise forms are for.
    pub lanes: LaneMask,
    /// The SIMD-scalar pairwise class rather than the vector one.
    pub scalar_class: bool,
    /// The destination is twice the source lane width.
    pub widen: bool,
}

const fn row_across(
    op: SimdAcrossOp,
    name: &'static str,
    u: bool,
    opcode: u8,
    lanes: LaneMask,
    scalar_class: bool,
    widen: bool,
) -> SimdAcrossRow {
    SimdAcrossRow { op, name, u, opcode, lanes, scalar_class, widen }
}

pub const SIMD_ACROSS: &[SimdAcrossRow] = &[
    row_across(SimdAcrossOp::Saddlv, "saddlv", false, 0x03, LANE_BHS, false, true),
    row_across(SimdAcrossOp::Uaddlv, "uaddlv", true, 0x03, LANE_BHS, false, true),
    row_across(SimdAcrossOp::Smaxv, "smaxv", false, 0x0a, LANE_BHS, false, false),
    row_across(SimdAcrossOp::Umaxv, "umaxv", true, 0x0a, LANE_BHS, false, false),
    row_across(SimdAcrossOp::Sminv, "sminv", false, 0x1a, LANE_BHS, false, false),
    row_across(SimdAcrossOp::Uminv, "uminv", true, 0x1a, LANE_BHS, false, false),
    row_across(SimdAcrossOp::Addv, "addv", false, 0x1b, LANE_BHS, false, false),
    row_across(SimdAcrossOp::AddpScalar, "addp", false, 0x1b, LANE_D, true, false),
];

pub fn simd_across_by_bits(
    u: bool,
    opcode: u8,
    scalar_class: bool,
) -> Option<&'static SimdAcrossRow> {
    SIMD_ACROSS
        .iter()
        .find(|row| row.u == u && row.opcode == opcode && row.scalar_class == scalar_class)
}

pub fn simd_across_by_name(name: &str) -> Option<&'static SimdAcrossRow> {
    SIMD_ACROSS.iter().find(|row| row.name == name)
}

pub fn simd_across_row(op: SimdAcrossOp) -> &'static SimdAcrossRow {
    SIMD_ACROSS
        .iter()
        .find(|row| row.op == op)
        .expect("every across op has a row")
}

/// The three-different class: the two sources and the destination are
/// not all the same width. One row per (U, opcode) pair at bits 15:12.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdDiffOp {
    Saddl,
    Uaddl,
    Saddw,
    Uaddw,
    Ssubl,
    Usubl,
    Ssubw,
    Usubw,
    Addhn,
    Raddhn,
    Sabal,
    Uabal,
    Subhn,
    Rsubhn,
    Sabdl,
    Uabdl,
    Smlal,
    Umlal,
    Sqdmlal,
    Smlsl,
    Umlsl,
    Sqdmlsl,
    Smull,
    Umull,
    Sqdmull,
    Pmull,
}

/// Which of the three widths a three-different row spells its operands
/// in. In all three the size field names the NARROW width.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdDiffShape {
    /// `Vd.<2T>, Vn.T, Vm.T`: both sources narrow.
    Long,
    /// `Vd.<2T>, Vn.<2T>, Vm.T`: only the second source is narrow.
    Wide,
    /// `Vd.T, Vn.<2T>, Vm.<2T>`: the high-half narrowing adds.
    Narrow,
}

pub struct SimdDiffRow {
    pub op: SimdDiffOp,
    pub name: &'static str,
    pub u: bool,
    /// The 4-bit opcode at bits 15:12.
    pub opcode: u8,
    /// NARROW lane widths the vector form takes.
    pub lanes: LaneMask,
    /// Narrow widths the SIMD-scalar form takes (`sqdmull s3, h7, h21`).
    pub scalar: LaneMask,
    pub shape: SimdDiffShape,
}

const fn row_diff(
    op: SimdDiffOp,
    name: &'static str,
    u: bool,
    opcode: u8,
    lanes: LaneMask,
    scalar: LaneMask,
    shape: SimdDiffShape,
) -> SimdDiffRow {
    SimdDiffRow { op, name, u, opcode, lanes, scalar, shape }
}

/// The three-different table. The `2` suffix on a mnemonic is the Q bit
/// and nothing else: it names the upper half of the narrow operands (and
/// of the destination, for the narrowing rows), so each row covers both
/// spellings.
pub const SIMD_THREE_DIFF: &[SimdDiffRow] = &[
    row_diff(SimdDiffOp::Saddl, "saddl", false, 0x0, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Uaddl, "uaddl", true, 0x0, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Saddw, "saddw", false, 0x1, LANE_BHS, LANE_NONE, SimdDiffShape::Wide),
    row_diff(SimdDiffOp::Uaddw, "uaddw", true, 0x1, LANE_BHS, LANE_NONE, SimdDiffShape::Wide),
    row_diff(SimdDiffOp::Ssubl, "ssubl", false, 0x2, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Usubl, "usubl", true, 0x2, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Ssubw, "ssubw", false, 0x3, LANE_BHS, LANE_NONE, SimdDiffShape::Wide),
    row_diff(SimdDiffOp::Usubw, "usubw", true, 0x3, LANE_BHS, LANE_NONE, SimdDiffShape::Wide),
    row_diff(SimdDiffOp::Addhn, "addhn", false, 0x4, LANE_BHS, LANE_NONE, SimdDiffShape::Narrow),
    row_diff(SimdDiffOp::Raddhn, "raddhn", true, 0x4, LANE_BHS, LANE_NONE, SimdDiffShape::Narrow),
    row_diff(SimdDiffOp::Sabal, "sabal", false, 0x5, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Uabal, "uabal", true, 0x5, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Subhn, "subhn", false, 0x6, LANE_BHS, LANE_NONE, SimdDiffShape::Narrow),
    row_diff(SimdDiffOp::Rsubhn, "rsubhn", true, 0x6, LANE_BHS, LANE_NONE, SimdDiffShape::Narrow),
    row_diff(SimdDiffOp::Sabdl, "sabdl", false, 0x7, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Uabdl, "uabdl", true, 0x7, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Smlal, "smlal", false, 0x8, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Umlal, "umlal", true, 0x8, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Sqdmlal, "sqdmlal", false, 0x9, LANE_HS, LANE_HS, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Smlsl, "smlsl", false, 0xa, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Umlsl, "umlsl", true, 0xa, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Sqdmlsl, "sqdmlsl", false, 0xb, LANE_HS, LANE_HS, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Smull, "smull", false, 0xc, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Umull, "umull", true, 0xc, LANE_BHS, LANE_NONE, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Sqdmull, "sqdmull", false, 0xd, LANE_HS, LANE_HS, SimdDiffShape::Long),
    row_diff(SimdDiffOp::Pmull, "pmull", false, 0xe, LANE_B, LANE_NONE, SimdDiffShape::Long),
];

pub fn simd_diff_by_bits(u: bool, opcode: u8) -> Option<&'static SimdDiffRow> {
    SIMD_THREE_DIFF.iter().find(|row| row.u == u && row.opcode == opcode)
}

pub fn simd_diff_by_name(name: &str) -> Option<&'static SimdDiffRow> {
    SIMD_THREE_DIFF.iter().find(|row| row.name == name)
}

pub fn simd_diff_row(op: SimdDiffOp) -> &'static SimdDiffRow {
    SIMD_THREE_DIFF
        .iter()
        .find(|row| row.op == op)
        .expect("every three-different op has a row")
}

/// The shift-by-immediate class. One row per (U, opcode) pair at bits
/// 15:11, with the amount packed into immh:immb rather than an operand
/// field of its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdShiftOp {
    Sshr,
    Ushr,
    Ssra,
    Usra,
    Srshr,
    Urshr,
    Srsra,
    Ursra,
    Sri,
    Shl,
    Sli,
    Sqshlu,
    Sqshl,
    Uqshl,
    Shrn,
    Sqshrun,
    Rshrn,
    Sqrshrun,
    Sqshrn,
    Uqshrn,
    Sqrshrn,
    Uqrshrn,
    Sshll,
    Ushll,
}

/// What a shift-by-immediate row's operands look like. As in the
/// three-different class, the size the encoding carries is the NARROW
/// one, which for `Same` is simply the lane width.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdShiftShape {
    /// `Vd.T, Vn.T, #shift`.
    Same,
    /// `Vd.<2T>, Vn.T, #shift`: SSHLL and USHLL, whose `#0` form GAS
    /// spells SXTL and UXTL.
    Long,
    /// `Vd.T, Vn.<2T>, #shift`: the narrowing right shifts.
    Narrow,
}

pub struct SimdShiftRow {
    pub op: SimdShiftOp,
    pub name: &'static str,
    pub u: bool,
    /// The 5-bit opcode at bits 15:11.
    pub opcode: u8,
    /// Narrow lane widths the vector form takes.
    pub lanes: LaneMask,
    /// Narrow widths the SIMD-scalar form takes.
    pub scalar: LaneMask,
    pub shape: SimdShiftShape,
    /// A right shift, which is where immh:immb counts DOWN from twice
    /// the lane width instead of up from it.
    pub right: bool,
}

#[allow(clippy::too_many_arguments)] // one argument per table column
const fn row_shift(
    op: SimdShiftOp,
    name: &'static str,
    u: bool,
    opcode: u8,
    lanes: LaneMask,
    scalar: LaneMask,
    shape: SimdShiftShape,
    right: bool,
) -> SimdShiftRow {
    SimdShiftRow { op, name, u, opcode, lanes, scalar, shape, right }
}

pub const SIMD_SHIFT_IMM: &[SimdShiftRow] = &[
    row_shift(SimdShiftOp::Sshr, "sshr", false, 0x00, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Ushr, "ushr", true, 0x00, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Ssra, "ssra", false, 0x02, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Usra, "usra", true, 0x02, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Srshr, "srshr", false, 0x04, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Urshr, "urshr", true, 0x04, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Srsra, "srsra", false, 0x06, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Ursra, "ursra", true, 0x06, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Sri, "sri", true, 0x08, LANE_BHSD, LANE_D, SimdShiftShape::Same, true),
    row_shift(SimdShiftOp::Shl, "shl", false, 0x0a, LANE_BHSD, LANE_D, SimdShiftShape::Same, false),
    row_shift(SimdShiftOp::Sli, "sli", true, 0x0a, LANE_BHSD, LANE_D, SimdShiftShape::Same, false),
    row_shift(SimdShiftOp::Sqshlu, "sqshlu", true, 0x0c, LANE_BHSD, LANE_BHSD, SimdShiftShape::Same, false),
    row_shift(SimdShiftOp::Sqshl, "sqshl", false, 0x0e, LANE_BHSD, LANE_BHSD, SimdShiftShape::Same, false),
    row_shift(SimdShiftOp::Uqshl, "uqshl", true, 0x0e, LANE_BHSD, LANE_BHSD, SimdShiftShape::Same, false),
    row_shift(SimdShiftOp::Shrn, "shrn", false, 0x10, LANE_BHS, LANE_NONE, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Sqshrun, "sqshrun", true, 0x10, LANE_BHS, LANE_BHS, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Rshrn, "rshrn", false, 0x11, LANE_BHS, LANE_NONE, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Sqrshrun, "sqrshrun", true, 0x11, LANE_BHS, LANE_BHS, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Sqshrn, "sqshrn", false, 0x12, LANE_BHS, LANE_BHS, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Uqshrn, "uqshrn", true, 0x12, LANE_BHS, LANE_BHS, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Sqrshrn, "sqrshrn", false, 0x13, LANE_BHS, LANE_BHS, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Uqrshrn, "uqrshrn", true, 0x13, LANE_BHS, LANE_BHS, SimdShiftShape::Narrow, true),
    row_shift(SimdShiftOp::Sshll, "sshll", false, 0x14, LANE_BHS, LANE_NONE, SimdShiftShape::Long, false),
    row_shift(SimdShiftOp::Ushll, "ushll", true, 0x14, LANE_BHS, LANE_NONE, SimdShiftShape::Long, false),
];

pub fn simd_shift_by_bits(u: bool, opcode: u8) -> Option<&'static SimdShiftRow> {
    SIMD_SHIFT_IMM.iter().find(|row| row.u == u && row.opcode == opcode)
}

pub fn simd_shift_by_name(name: &str) -> Option<&'static SimdShiftRow> {
    SIMD_SHIFT_IMM.iter().find(|row| row.name == name)
}

pub fn simd_shift_row(op: SimdShiftOp) -> &'static SimdShiftRow {
    SIMD_SHIFT_IMM
        .iter()
        .find(|row| row.op == op)
        .expect("every shift-immediate op has a row")
}

/// The lane width `immh` names: the position of its highest set bit.
/// An immh of zero is the modified-immediate group, not a shift, which
/// is what keeps the two classes apart at the same bit pattern.
pub fn shift_imm_esize(immh: u8) -> Option<u8> {
    match immh {
        0b0001 => Some(1),
        0b0010 | 0b0011 => Some(2),
        0b0100..=0b0111 => Some(4),
        0b1000..=0b1111 => Some(8),
        _ => None,
    }
}

/// The shift amount immh:immb carries. A left shift counts UP from the
/// lane width and a right shift counts DOWN from twice it, so `shl #0`
/// on a byte lane and `sshr #8` on one are both immh:immb 8, and
/// `ushr #64` on a 2d lane is immh:immb 64.
pub fn shift_imm_amount(immh: u8, immb: u8, right: bool) -> Option<u8> {
    let bits = shift_imm_esize(immh)? * 8;
    let packed = (immh << 3) | immb;
    if right {
        Some(2 * bits - packed)
    } else {
        Some(packed - bits)
    }
}

/// The immh:immb field an amount packs into, the inverse of
/// `shift_imm_amount`. The caller has already checked the range.
pub fn shift_imm_field(esize: u8, amount: u8, right: bool) -> u8 {
    let bits = esize * 8;
    if right {
        2 * bits - amount
    } else {
        bits + amount
    }
}

/// The permute class: ZIP, UZP and TRN, which shuffle two sources into
/// one destination of the same arrangement. One row per 3-bit opcode at
/// bits 14:12.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdPermuteOp {
    Uzp1,
    Trn1,
    Zip1,
    Uzp2,
    Trn2,
    Zip2,
}

/// (op, mnemonic, opcode at bits 14:12).
pub const SIMD_PERMUTE: &[(SimdPermuteOp, &str, u8)] = &[
    (SimdPermuteOp::Uzp1, "uzp1", 0b001),
    (SimdPermuteOp::Trn1, "trn1", 0b010),
    (SimdPermuteOp::Zip1, "zip1", 0b011),
    (SimdPermuteOp::Uzp2, "uzp2", 0b101),
    (SimdPermuteOp::Trn2, "trn2", 0b110),
    (SimdPermuteOp::Zip2, "zip2", 0b111),
];

pub fn simd_permute_by_bits(opcode: u8) -> Option<SimdPermuteOp> {
    SIMD_PERMUTE.iter().find(|(_, _, code)| *code == opcode).map(|(op, _, _)| *op)
}

pub fn simd_permute_by_name(name: &str) -> Option<(SimdPermuteOp, u8)> {
    SIMD_PERMUTE
        .iter()
        .find(|(_, row_name, _)| *row_name == name)
        .map(|(op, _, code)| (*op, *code))
}

pub fn simd_permute_name(op: SimdPermuteOp) -> &'static str {
    SIMD_PERMUTE
        .iter()
        .find(|(row_op, _, _)| *row_op == op)
        .map(|(_, name, _)| *name)
        .expect("every permute op has a row")
}

/// Which lane arithmetic a by-element row runs. The element-indexed
/// multiplies are the three-same and three-different rows over again
/// with one lane of Vm standing in for the whole second source, so each
/// row names the op whose lane function it borrows rather than carrying
/// a second copy of the arithmetic.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdElemKind {
    /// Lanes of the source's own width: `simd_same_lane`.
    Same(SimdSameOp),
    /// Lanes of twice the source width: `simd_diff_lane`, Long shape.
    Long(SimdDiffOp),
}

/// The by-element rows, keyed the way the other classes are.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdElemOp {
    Mul,
    Mla,
    Mls,
    Sqdmulh,
    Sqrdmulh,
    Smull,
    Umull,
    Smlal,
    Umlal,
    Smlsl,
    Umlsl,
    Sqdmull,
    Sqdmlal,
    Sqdmlsl,
}

pub struct SimdElemRow {
    pub op: SimdElemOp,
    pub kind: SimdElemKind,
    pub name: &'static str,
    pub u: bool,
    /// The 4-bit opcode at bits 15:12.
    pub opcode: u8,
    /// Lane widths of Vn (and of the indexed element), h and s only.
    pub lanes: LaneMask,
    /// Whether the row has a SIMD-scalar form.
    pub scalar: bool,
}

const fn row_elem(
    op: SimdElemOp,
    kind: SimdElemKind,
    name: &'static str,
    u: bool,
    opcode: u8,
    scalar: bool,
) -> SimdElemRow {
    SimdElemRow { op, kind, name, u, opcode, lanes: LANE_HS, scalar }
}

/// The by-element table, ordered by opcode. Every row takes an h or an s
/// element, which is why the lane mask is the same on all of them: the
/// index packs into H:L:M for an h lane (leaving Rm four bits, v0..v15)
/// and into H:L for an s one.
pub const SIMD_BY_ELEMENT: &[SimdElemRow] = &[
    row_elem(SimdElemOp::Mla, SimdElemKind::Same(SimdSameOp::Mla), "mla", true, 0b0000, false),
    row_elem(SimdElemOp::Smlal, SimdElemKind::Long(SimdDiffOp::Smlal), "smlal", false, 0b0010, false),
    row_elem(SimdElemOp::Umlal, SimdElemKind::Long(SimdDiffOp::Umlal), "umlal", true, 0b0010, false),
    row_elem(SimdElemOp::Sqdmlal, SimdElemKind::Long(SimdDiffOp::Sqdmlal), "sqdmlal", false, 0b0011, true),
    row_elem(SimdElemOp::Mls, SimdElemKind::Same(SimdSameOp::Mls), "mls", true, 0b0100, false),
    row_elem(SimdElemOp::Smlsl, SimdElemKind::Long(SimdDiffOp::Smlsl), "smlsl", false, 0b0110, false),
    row_elem(SimdElemOp::Umlsl, SimdElemKind::Long(SimdDiffOp::Umlsl), "umlsl", true, 0b0110, false),
    row_elem(SimdElemOp::Sqdmlsl, SimdElemKind::Long(SimdDiffOp::Sqdmlsl), "sqdmlsl", false, 0b0111, true),
    row_elem(SimdElemOp::Mul, SimdElemKind::Same(SimdSameOp::Mul), "mul", false, 0b1000, false),
    row_elem(SimdElemOp::Smull, SimdElemKind::Long(SimdDiffOp::Smull), "smull", false, 0b1010, false),
    row_elem(SimdElemOp::Umull, SimdElemKind::Long(SimdDiffOp::Umull), "umull", true, 0b1010, false),
    row_elem(SimdElemOp::Sqdmull, SimdElemKind::Long(SimdDiffOp::Sqdmull), "sqdmull", false, 0b1011, true),
    row_elem(SimdElemOp::Sqdmulh, SimdElemKind::Same(SimdSameOp::Sqdmulh), "sqdmulh", false, 0b1100, true),
    row_elem(SimdElemOp::Sqrdmulh, SimdElemKind::Same(SimdSameOp::Sqrdmulh), "sqrdmulh", false, 0b1101, true),
];

pub fn simd_elem_by_bits(u: bool, opcode: u8) -> Option<&'static SimdElemRow> {
    SIMD_BY_ELEMENT.iter().find(|row| row.u == u && row.opcode == opcode)
}

pub fn simd_elem_by_name(name: &str) -> Option<&'static SimdElemRow> {
    SIMD_BY_ELEMENT.iter().find(|row| row.name == name)
}

pub fn simd_elem_row(op: SimdElemOp) -> &'static SimdElemRow {
    SIMD_BY_ELEMENT
        .iter()
        .find(|row| row.op == op)
        .expect("every by-element op has a row")
}

/// The Rm and the element index a by-element word carries, from the
/// four-bit Rm field and the L, M and H bits. An h element spends M as
/// the index's low bit, which is what caps its register at v15; an s
/// element spends M as Rm's high bit instead.
pub fn simd_elem_index(esize: u8, rm4: u8, l: u8, m: u8, h: u8) -> (u8, u8) {
    match esize {
        2 => (rm4, (h << 2) | (l << 1) | m),
        // A d element (the FP by-element rows alone) has two lanes, so H
        // is the whole index and L has to be zero.
        8 => ((m << 4) | rm4, h),
        _ => ((m << 4) | rm4, (h << 1) | l),
    }
}

/// The inverse: the L, M and H bits an element index packs into, beside
/// the four-bit Rm field. The caller has already range-checked both.
pub fn simd_elem_bits(esize: u8, rm: u8, index: u8) -> (u8, u8, u8, u8) {
    match esize {
        2 => (rm & 0xf, (index >> 1) & 1, index & 1, (index >> 2) & 1),
        8 => (rm & 0xf, 0, (rm >> 4) & 1, index & 1),
        _ => (rm & 0xf, index & 1, (rm >> 4) & 1, (index >> 1) & 1),
    }
}

// --- the floating-point vector classes ---
//
// Three-same, two-register misc, across-lanes and by-element again, this
// time over float lanes. They sit in the same encoding groups as the
// integer classes and are told apart by the opcode field, so each keeps
// its own table read by the encoder, the decoder, `format` and the
// executor. Bit 23 is no longer half of a size field here: it is an
// opcode bit (the manual's `a`, spelled `E` on some rows), and bit 22
// alone (`sz`) picks a 4-byte lane from an 8-byte one.

const LANE_SD: LaneMask = LANE_S | LANE_D;

/// The floating-point three-same rows, keyed by (U, a, opcode).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdFpSameOp {
    Fmaxnm,
    Fminnm,
    Fmaxnmp,
    Fminnmp,
    Fmla,
    Fmls,
    Fadd,
    Fsub,
    Faddp,
    Fabd,
    Fmulx,
    Fmul,
    Fcmeq,
    Fcmge,
    Fcmgt,
    Facge,
    Facgt,
    Fmax,
    Fmin,
    Fmaxp,
    Fminp,
    Frecps,
    Frsqrts,
    Fdiv,
}

pub struct SimdFpSameRow {
    pub op: SimdFpSameOp,
    pub name: &'static str,
    pub u: bool,
    /// Bit 23, the manual's `a`: an opcode bit here, not the top half of
    /// a size field the way the integer classes read it.
    pub a: bool,
    /// The 5-bit opcode at bits 15:11, always 0x18..0x1f.
    pub opcode: u8,
    /// Whether the row has a SIMD-scalar form (`fmulx s3, s7, s21`). The
    /// rows without one are the ones scalar FP already spells in its own
    /// class: `fadd s3, s7, s21` is not this encoding.
    pub scalar: bool,
    /// The row folds lane PAIRS of Vn:Vm rather than lane against lane.
    pub pairwise: bool,
}

const fn row_fp_same(
    op: SimdFpSameOp,
    name: &'static str,
    u: bool,
    a: bool,
    opcode: u8,
    scalar: bool,
    pairwise: bool,
) -> SimdFpSameRow {
    SimdFpSameRow { op, name, u, a, opcode, scalar, pairwise }
}

pub const SIMD_FP_THREE_SAME: &[SimdFpSameRow] = &[
    row_fp_same(SimdFpSameOp::Fmaxnm, "fmaxnm", false, false, 0x18, false, false),
    row_fp_same(SimdFpSameOp::Fminnm, "fminnm", false, true, 0x18, false, false),
    row_fp_same(SimdFpSameOp::Fmaxnmp, "fmaxnmp", true, false, 0x18, false, true),
    row_fp_same(SimdFpSameOp::Fminnmp, "fminnmp", true, true, 0x18, false, true),
    row_fp_same(SimdFpSameOp::Fmla, "fmla", false, false, 0x19, false, false),
    row_fp_same(SimdFpSameOp::Fmls, "fmls", false, true, 0x19, false, false),
    row_fp_same(SimdFpSameOp::Fadd, "fadd", false, false, 0x1a, false, false),
    row_fp_same(SimdFpSameOp::Fsub, "fsub", false, true, 0x1a, false, false),
    row_fp_same(SimdFpSameOp::Faddp, "faddp", true, false, 0x1a, false, true),
    row_fp_same(SimdFpSameOp::Fabd, "fabd", true, true, 0x1a, true, false),
    row_fp_same(SimdFpSameOp::Fmulx, "fmulx", false, false, 0x1b, true, false),
    row_fp_same(SimdFpSameOp::Fmul, "fmul", true, false, 0x1b, false, false),
    row_fp_same(SimdFpSameOp::Fcmeq, "fcmeq", false, false, 0x1c, true, false),
    row_fp_same(SimdFpSameOp::Fcmge, "fcmge", true, false, 0x1c, true, false),
    row_fp_same(SimdFpSameOp::Fcmgt, "fcmgt", true, true, 0x1c, true, false),
    row_fp_same(SimdFpSameOp::Facge, "facge", true, false, 0x1d, true, false),
    row_fp_same(SimdFpSameOp::Facgt, "facgt", true, true, 0x1d, true, false),
    row_fp_same(SimdFpSameOp::Fmax, "fmax", false, false, 0x1e, false, false),
    row_fp_same(SimdFpSameOp::Fmin, "fmin", false, true, 0x1e, false, false),
    row_fp_same(SimdFpSameOp::Fmaxp, "fmaxp", true, false, 0x1e, false, true),
    row_fp_same(SimdFpSameOp::Fminp, "fminp", true, true, 0x1e, false, true),
    row_fp_same(SimdFpSameOp::Frecps, "frecps", false, false, 0x1f, true, false),
    row_fp_same(SimdFpSameOp::Frsqrts, "frsqrts", false, true, 0x1f, true, false),
    row_fp_same(SimdFpSameOp::Fdiv, "fdiv", true, false, 0x1f, false, false),
];

pub fn simd_fp_same_by_bits(u: bool, a: bool, opcode: u8) -> Option<&'static SimdFpSameRow> {
    SIMD_FP_THREE_SAME
        .iter()
        .find(|row| row.u == u && row.a == a && row.opcode == opcode)
}

pub fn simd_fp_same_by_name(name: &str) -> Option<&'static SimdFpSameRow> {
    SIMD_FP_THREE_SAME.iter().find(|row| row.name == name)
}

pub fn simd_fp_same_row(op: SimdFpSameOp) -> &'static SimdFpSameRow {
    SIMD_FP_THREE_SAME
        .iter()
        .find(|row| row.op == op)
        .expect("every fp three-same op has a row")
}

/// The floating-point two-register misc rows: the unary arithmetic, the
/// roundings, the compares against zero, and every conversion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdFpMiscOp {
    Fcvtns,
    Fcvtnu,
    Fcvtps,
    Fcvtpu,
    Fcvtms,
    Fcvtmu,
    Fcvtzs,
    Fcvtzu,
    Fcvtas,
    Fcvtau,
    Scvtf,
    Ucvtf,
    Frecpe,
    Frsqrte,
    Frintn,
    Frinta,
    Frintp,
    Frintm,
    Frintx,
    Frintz,
    Frinti,
    Fabs,
    Fneg,
    Fsqrt,
    Frecpx,
    Fcmgt0,
    Fcmge0,
    Fcmeq0,
    Fcmle0,
    Fcmlt0,
    Fcvtn,
    Fcvtxn,
    Fcvtl,
}

/// What a floating-point two-misc row's operands look like.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdFpMiscShape {
    /// `Vd.T, Vn.T`, with a `#fbits` tail for the fixed-point
    /// conversions, which are these same rows in the shift-immediate
    /// encoding rather than a family of their own.
    Same,
    /// `Vd.T, Vn.T, #0.0`: the compares against zero.
    Zero,
    /// `Vd.<half T>, Vn.T`: FCVTN and FCVTXN. `esize` is the WIDE lane
    /// and Q names the half of the destination the result lands in,
    /// which is what the `2` suffix spells.
    Narrow,
    /// `Vd.T, Vn.<half T>`: FCVTL. `esize` is again the wide lane, and Q
    /// names the half of the SOURCE that is read.
    Long,
}

pub struct SimdFpMiscRow {
    pub op: SimdFpMiscOp,
    pub name: &'static str,
    pub u: bool,
    /// Bit 23, as in the three-same table.
    pub a: bool,
    /// The 5-bit opcode at bits 16:12.
    pub opcode: u8,
    /// Lane widths, the WIDE side for the narrowing and lengthening
    /// rows. Only FCVTXN narrows it: it has no half-precision form.
    pub lanes: LaneMask,
    pub shape: SimdFpMiscShape,
    pub vector: bool,
    pub scalar: bool,
    /// The opcode this row wears in the shift-by-immediate encoding,
    /// where it takes a `#fbits` operand. Only the four conversions
    /// between a float and a fixed-point integer have one.
    pub fixed: Option<u8>,
}

#[allow(clippy::too_many_arguments)] // one argument per table column
const fn row_fp_misc(
    op: SimdFpMiscOp,
    name: &'static str,
    u: bool,
    a: bool,
    opcode: u8,
    lanes: LaneMask,
    shape: SimdFpMiscShape,
    vector: bool,
    scalar: bool,
    fixed: Option<u8>,
) -> SimdFpMiscRow {
    SimdFpMiscRow { op, name, u, a, opcode, lanes, shape, vector, scalar, fixed }
}

use SimdFpMiscShape::{Long as FpLong, Narrow as FpNarrow, Same as FpSame, Zero as FpZero};

pub const SIMD_FP_TWO_MISC: &[SimdFpMiscRow] = &[
    row_fp_misc(SimdFpMiscOp::Fcmgt0, "fcmgt", false, true, 0x0c, LANE_SD, FpZero, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcmge0, "fcmge", true, true, 0x0c, LANE_SD, FpZero, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcmeq0, "fcmeq", false, true, 0x0d, LANE_SD, FpZero, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcmle0, "fcmle", true, true, 0x0d, LANE_SD, FpZero, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcmlt0, "fcmlt", false, true, 0x0e, LANE_SD, FpZero, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fabs, "fabs", false, true, 0x0f, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Fneg, "fneg", true, true, 0x0f, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Fcvtn, "fcvtn", false, false, 0x16, LANE_SD, FpNarrow, true, false, None),
    row_fp_misc(SimdFpMiscOp::Fcvtxn, "fcvtxn", true, false, 0x16, LANE_D, FpNarrow, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtl, "fcvtl", false, false, 0x17, LANE_SD, FpLong, true, false, None),
    row_fp_misc(SimdFpMiscOp::Frintn, "frintn", false, false, 0x18, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Frinta, "frinta", true, false, 0x18, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Frintp, "frintp", false, true, 0x18, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Frintm, "frintm", false, false, 0x19, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Frintx, "frintx", true, false, 0x19, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Frintz, "frintz", false, true, 0x19, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Frinti, "frinti", true, true, 0x19, LANE_SD, FpSame, true, false, None),
    row_fp_misc(SimdFpMiscOp::Fcvtns, "fcvtns", false, false, 0x1a, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtnu, "fcvtnu", true, false, 0x1a, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtps, "fcvtps", false, true, 0x1a, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtpu, "fcvtpu", true, true, 0x1a, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtms, "fcvtms", false, false, 0x1b, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtmu, "fcvtmu", true, false, 0x1b, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtzs, "fcvtzs", false, true, 0x1b, LANE_SD, FpSame, true, true, Some(0x1f)),
    row_fp_misc(SimdFpMiscOp::Fcvtzu, "fcvtzu", true, true, 0x1b, LANE_SD, FpSame, true, true, Some(0x1f)),
    row_fp_misc(SimdFpMiscOp::Fcvtas, "fcvtas", false, false, 0x1c, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Fcvtau, "fcvtau", true, false, 0x1c, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Scvtf, "scvtf", false, false, 0x1d, LANE_SD, FpSame, true, true, Some(0x1c)),
    row_fp_misc(SimdFpMiscOp::Ucvtf, "ucvtf", true, false, 0x1d, LANE_SD, FpSame, true, true, Some(0x1c)),
    row_fp_misc(SimdFpMiscOp::Frecpe, "frecpe", false, true, 0x1d, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Frsqrte, "frsqrte", true, true, 0x1d, LANE_SD, FpSame, true, true, None),
    row_fp_misc(SimdFpMiscOp::Frecpx, "frecpx", false, true, 0x1f, LANE_SD, FpSame, false, true, None),
    row_fp_misc(SimdFpMiscOp::Fsqrt, "fsqrt", true, true, 0x1f, LANE_SD, FpSame, true, false, None),
];

pub fn simd_fp_misc_by_bits(u: bool, a: bool, opcode: u8) -> Option<&'static SimdFpMiscRow> {
    SIMD_FP_TWO_MISC
        .iter()
        .find(|row| row.u == u && row.a == a && row.opcode == opcode)
}

/// The same rows read out of the shift-by-immediate encoding, where the
/// four fixed-point conversions sit beside the integer shifts.
pub fn simd_fp_fixed_by_bits(u: bool, opcode: u8) -> Option<&'static SimdFpMiscRow> {
    SIMD_FP_TWO_MISC
        .iter()
        .find(|row| row.u == u && row.fixed == Some(opcode))
}

/// Read a row by mnemonic and shape: `fcmgt` names both a three-same row
/// and a compare-against-zero row, so the caller says which it parsed.
pub fn simd_fp_misc_by_name(name: &str, zero: bool) -> Option<&'static SimdFpMiscRow> {
    SIMD_FP_TWO_MISC
        .iter()
        .find(|row| row.name == name && (row.shape == FpZero) == zero)
}

pub fn simd_fp_misc_row(op: SimdFpMiscOp) -> &'static SimdFpMiscRow {
    SIMD_FP_TWO_MISC
        .iter()
        .find(|row| row.op == op)
        .expect("every fp misc op has a row")
}

/// Which scalar conversion row a floating-point misc row runs. The
/// vector lanes and the general-register forms share one rounding-mode
/// and signedness table rather than carrying a second copy of it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FpCvtRole {
    ToInt(FpToIntOp),
    FromInt(FpFromIntOp),
}

pub fn simd_fp_cvt_role(op: SimdFpMiscOp) -> Option<FpCvtRole> {
    Some(match op {
        SimdFpMiscOp::Fcvtns => FpCvtRole::ToInt(FpToIntOp::Ns),
        SimdFpMiscOp::Fcvtnu => FpCvtRole::ToInt(FpToIntOp::Nu),
        SimdFpMiscOp::Fcvtas => FpCvtRole::ToInt(FpToIntOp::As),
        SimdFpMiscOp::Fcvtau => FpCvtRole::ToInt(FpToIntOp::Au),
        SimdFpMiscOp::Fcvtms => FpCvtRole::ToInt(FpToIntOp::Ms),
        SimdFpMiscOp::Fcvtmu => FpCvtRole::ToInt(FpToIntOp::Mu),
        SimdFpMiscOp::Fcvtps => FpCvtRole::ToInt(FpToIntOp::Ps),
        SimdFpMiscOp::Fcvtpu => FpCvtRole::ToInt(FpToIntOp::Pu),
        SimdFpMiscOp::Fcvtzs => FpCvtRole::ToInt(FpToIntOp::Zs),
        SimdFpMiscOp::Fcvtzu => FpCvtRole::ToInt(FpToIntOp::Zu),
        SimdFpMiscOp::Scvtf => FpCvtRole::FromInt(FpFromIntOp::Scvtf),
        SimdFpMiscOp::Ucvtf => FpCvtRole::FromInt(FpFromIntOp::Ucvtf),
        _ => return None,
    })
}

/// The floating-point across-lanes rows, and the SIMD-scalar pairwise
/// class that shares their encoding and differs only in bit 28.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdFpAcrossOp {
    Fmaxnmv,
    Fminnmv,
    Fmaxv,
    Fminv,
    FmaxnmpScalar,
    FminnmpScalar,
    FaddpScalar,
    FmaxpScalar,
    FminpScalar,
}

pub struct SimdFpAcrossRow {
    pub op: SimdFpAcrossOp,
    pub name: &'static str,
    pub u: bool,
    pub a: bool,
    /// The 5-bit opcode at bits 16:12.
    pub opcode: u8,
    /// The SIMD-scalar pairwise class rather than the vector one.
    pub scalar_class: bool,
}

const fn row_fp_across(
    op: SimdFpAcrossOp,
    name: &'static str,
    u: bool,
    a: bool,
    opcode: u8,
    scalar_class: bool,
) -> SimdFpAcrossRow {
    SimdFpAcrossRow { op, name, u, a, opcode, scalar_class }
}

pub const SIMD_FP_ACROSS: &[SimdFpAcrossRow] = &[
    row_fp_across(SimdFpAcrossOp::Fmaxnmv, "fmaxnmv", true, false, 0x0c, false),
    row_fp_across(SimdFpAcrossOp::Fminnmv, "fminnmv", true, true, 0x0c, false),
    row_fp_across(SimdFpAcrossOp::Fmaxv, "fmaxv", true, false, 0x0f, false),
    row_fp_across(SimdFpAcrossOp::Fminv, "fminv", true, true, 0x0f, false),
    row_fp_across(SimdFpAcrossOp::FmaxnmpScalar, "fmaxnmp", true, false, 0x0c, true),
    row_fp_across(SimdFpAcrossOp::FminnmpScalar, "fminnmp", true, true, 0x0c, true),
    row_fp_across(SimdFpAcrossOp::FaddpScalar, "faddp", true, false, 0x0d, true),
    row_fp_across(SimdFpAcrossOp::FmaxpScalar, "fmaxp", true, false, 0x0f, true),
    row_fp_across(SimdFpAcrossOp::FminpScalar, "fminp", true, true, 0x0f, true),
];

pub fn simd_fp_across_by_bits(
    u: bool,
    a: bool,
    opcode: u8,
    scalar_class: bool,
) -> Option<&'static SimdFpAcrossRow> {
    SIMD_FP_ACROSS.iter().find(|row| {
        row.u == u && row.a == a && row.opcode == opcode && row.scalar_class == scalar_class
    })
}

pub fn simd_fp_across_by_name(name: &str, scalar_class: bool) -> Option<&'static SimdFpAcrossRow> {
    SIMD_FP_ACROSS
        .iter()
        .find(|row| row.name == name && row.scalar_class == scalar_class)
}

pub fn simd_fp_across_row(op: SimdFpAcrossOp) -> &'static SimdFpAcrossRow {
    SIMD_FP_ACROSS
        .iter()
        .find(|row| row.op == op)
        .expect("every fp across op has a row")
}

/// The floating-point by-element rows: one s or d lane of Vm against
/// every lane of Vn, running the three-same lane function.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdFpElemOp {
    Fmla,
    Fmls,
    Fmul,
    Fmulx,
}

pub struct SimdFpElemRow {
    pub op: SimdFpElemOp,
    /// The three-same row whose lane arithmetic this one borrows.
    pub same: SimdFpSameOp,
    pub name: &'static str,
    pub u: bool,
    /// The 4-bit opcode at bits 15:12.
    pub opcode: u8,
}

const fn row_fp_elem(
    op: SimdFpElemOp,
    same: SimdFpSameOp,
    name: &'static str,
    u: bool,
    opcode: u8,
) -> SimdFpElemRow {
    SimdFpElemRow { op, same, name, u, opcode }
}

pub const SIMD_FP_BY_ELEMENT: &[SimdFpElemRow] = &[
    row_fp_elem(SimdFpElemOp::Fmla, SimdFpSameOp::Fmla, "fmla", false, 0b0001),
    row_fp_elem(SimdFpElemOp::Fmls, SimdFpSameOp::Fmls, "fmls", false, 0b0101),
    row_fp_elem(SimdFpElemOp::Fmul, SimdFpSameOp::Fmul, "fmul", false, 0b1001),
    row_fp_elem(SimdFpElemOp::Fmulx, SimdFpSameOp::Fmulx, "fmulx", true, 0b1001),
];

pub fn simd_fp_elem_by_bits(u: bool, opcode: u8) -> Option<&'static SimdFpElemRow> {
    SIMD_FP_BY_ELEMENT.iter().find(|row| row.u == u && row.opcode == opcode)
}

pub fn simd_fp_elem_by_name(name: &str) -> Option<&'static SimdFpElemRow> {
    SIMD_FP_BY_ELEMENT.iter().find(|row| row.name == name)
}

pub fn simd_fp_elem_row(op: SimdFpElemOp) -> &'static SimdFpElemRow {
    SIMD_FP_BY_ELEMENT
        .iter()
        .find(|row| row.op == op)
        .expect("every fp by-element op has a row")
}

/// One IEEE binary16 value widened to binary32. FCVTL's half-precision
/// form is base ARMv8, not FEAT_FP16: nothing here computes in half, the
/// format is only read and written. A subnormal renormalizes and a NaN
/// keeps its sign and the payload bits the wide format has room for.
pub fn f16_to_f32(half: u16) -> f32 {
    let sign = u32::from(half & 0x8000) << 16;
    let exp = u32::from((half >> 10) & 0x1f);
    let frac = u32::from(half & 0x3ff);
    if exp == 0x1f {
        if frac == 0 {
            return f32::from_bits(sign | 0x7F80_0000);
        }
        // FPConvertNaN: the quiet bit is set and the payload moves up.
        return f32::from_bits(sign | 0x7FC0_0000 | ((frac & 0x1ff) << 13));
    }
    if exp == 0 {
        if frac == 0 {
            return f32::from_bits(sign);
        }
        // A half subnormal is a normal single: shift until the implied
        // bit appears and pay for each shift out of the exponent.
        // The leading one moves up to the implied place; the shift it
        // takes comes off an exponent of 2^-14, one step below the least
        // normal half, and the ten bits under it are the fraction.
        let shift = frac.leading_zeros() - 21;
        let exp32 = 127 - 14 - shift;
        let frac32 = (frac << (shift + 13)) & 0x7F_FFFF;
        return f32::from_bits(sign | (exp32 << 23) | frac32);
    }
    f32::from_bits(sign | ((exp + 127 - 15) << 23) | (frac << 13))
}

/// One binary32 narrowed to IEEE binary16, round to nearest even: the
/// inverse of `f16_to_f32`, and FCVTN's half-precision form.
pub fn f32_to_f16(value: f32) -> u16 {
    let bits = value.to_bits();
    let sign = ((bits >> 16) & 0x8000) as u16;
    let exp = ((bits >> 23) & 0xff) as i32;
    let frac = bits & 0x7F_FFFF;
    if exp == 0xff {
        if frac == 0 {
            return sign | 0x7C00;
        }
        // Quiet the NaN and keep the payload bits half precision holds.
        return sign | 0x7E00 | ((frac >> 13) as u16 & 0x1ff);
    }
    let unbiased = exp - 127;
    if unbiased > 15 {
        return sign | 0x7C00;
    }
    if unbiased < -25 {
        return sign;
    }
    // The significand with its implied bit, shifted down to ten fraction
    // bits; what falls off the bottom is the round and sticky part.
    let significand = if exp == 0 { frac } else { frac | 0x80_0000 };
    let shift = if unbiased < -14 { (13 + (-14 - unbiased)) as u32 } else { 13 };
    if shift > 24 {
        return sign;
    }
    let kept = significand >> shift;
    let rest = significand & ((1u32 << shift) - 1);
    let half_ulp = 1u32 << (shift - 1);
    let mut rounded = kept;
    if rest > half_ulp || (rest == half_ulp && kept & 1 == 1) {
        rounded += 1;
    }
    if unbiased < -14 {
        // Subnormal: the exponent field is zero, and a rounding carry
        // walks the value into the smallest normal on its own, because
        // the implied bit lands exactly where the field wants it.
        return sign | rounded as u16;
    }
    // `rounded` still carries the implied one at bit 10, so the biased
    // exponent goes in one step low and the two add up. A carry out of
    // the fraction then bumps the exponent and leaves it zero, which the
    // same addition already does.
    sign | ((((unbiased + 14) as u16) << 10) + rounded as u16)
}

/// The load/store multiple-structures opcodes, as (opcode, the number in
/// the mnemonic, how many registers the brace list names). LD1 and ST1
/// alone reach two, three and four registers without interleaving, so
/// they own four rows and every other family one.
pub const SIMD_STRUCT_MULTIPLE: &[(u8, u8, u8)] = &[
    (0b0000, 4, 4),
    (0b0010, 1, 4),
    (0b0100, 3, 3),
    (0b0110, 1, 3),
    (0b0111, 1, 1),
    (0b1000, 2, 2),
    (0b1010, 1, 2),
];

/// The lane index a single-structure word carries, or None when the
/// combination is unallocated. Q, S and the two-bit size field hold it
/// between them, and how many of those bits are index is what the
/// element width decides: `ld1 {v3.b}[15]` (0x4d401ce3: Q=1, S=1,
/// size=11) spends all four, `ld1 {v3.h}[7]` (0x4d4058e3: Q=1, S=1,
/// size=10) three with size's low bit held clear, `ld1 {v3.s}[3]`
/// (0x4d4090e3: Q=1, S=1, size=00) two, and `ld1 {v3.d}[1]`
/// (0x4d4084e3: Q=1, S=0, size=01) only Q.
pub fn simd_struct_index(esize: u8, q: bool, s: bool, size: u8) -> Option<u8> {
    let q = u8::from(q);
    let s = u8::from(s);
    match esize {
        1 => Some((q << 3) | (s << 2) | size),
        2 => (size & 1 == 0).then_some((q << 2) | (s << 1) | (size >> 1)),
        4 => (size == 0b00).then_some((q << 1) | s),
        8 => (size == 0b01 && s == 0).then_some(q),
        _ => None,
    }
}

/// The inverse: the Q, S and size bits an index packs into. The caller
/// has already range-checked the index against the element width.
pub fn simd_struct_index_bits(esize: u8, index: u8) -> (bool, bool, u8) {
    match esize {
        1 => (index & 8 != 0, index & 4 != 0, index & 3),
        2 => (index & 4 != 0, index & 2 != 0, (index & 1) << 1),
        4 => (index & 2 != 0, index & 1 != 0, 0b00),
        _ => (index & 1 != 0, false, 0b01),
    }
}

/// The total bytes a structure load or store moves, which is also the
/// only amount its immediate post-index form can add to the base: the
/// word carries no immediate field because there is one legal value.
pub fn simd_struct_bytes(shape: SimdStructShape, count: u8, esize: u8, q: bool) -> u64 {
    let per_register = match shape {
        SimdStructShape::Multiple => {
            if q {
                16
            } else {
                8
            }
        }
        _ => u64::from(esize),
    };
    u64::from(count) * per_register
}

/// Which reading of the Advanced SIMD copy group an encoding carries.
/// DUP, INS, UMOV and SMOV share one word shape and differ only in imm4.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimdCopyOp {
    /// DUP Vd.T, Rn: one general register into every lane.
    DupGeneral,
    /// DUP Vd.T, Vn.Ts[index]: one lane into every lane.
    DupElement,
    /// DUP Bd/Hd/Sd/Dd, Vn.Ts[index]: one lane into a scalar register,
    /// everything above it zeroed. GAS prints this one as `mov`.
    DupScalar,
    /// INS Vd.Ts[index], Rn: one general register into one lane, the
    /// other lanes untouched. GAS prints it as `mov`.
    InsGeneral,
    /// INS Vd.Ts[index], Vn.Ts[index2]: lane to lane, also printed `mov`.
    InsElement,
    /// UMOV Rd, Vn.Ts[index]: one lane, zero-extended into the register.
    Umov,
    /// SMOV Rd, Vn.Ts[index]: one lane, sign-extended.
    Smov,
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
}

// ---------------------------------------------------------------------------
// bit-extraction helpers
// ---------------------------------------------------------------------------

/// The short decimal GAS spells a vector FMOV immediate with (`#1.0`,
/// `#-2.5`, `#0.5`). Every VFP 8-bit float is a multiple of 1/128, so
/// seven places is exact and the trailing zeros come off.
fn fmov_imm_text(imm8: u8) -> String {
    let value = f64::from_bits(expand_fmov_imm8(imm8));
    let text = format!("{value:.7}");
    let trimmed = text.trim_end_matches('0');
    if trimmed.ends_with('.') {
        format!("{trimmed}0")
    } else {
        trimmed.to_string()
    }
}

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
// bitmask immediate decoder
// ---------------------------------------------------------------------------

/// Expand the FMOV 8-bit VFP immediate to its IEEE 754 double bit pattern.
/// Per the ARM ARM: sign = b7, exponent = NOT(b6) then b6 replicated eight
/// times then b5:b4, mantissa = b3:b0 at the top of the 52-bit fraction.
/// Every encodable value is (16..31)/16 scaled by a power of two from 2^-3
/// to 2^4, either sign; the assembler brute-forces this table in reverse.
pub fn expand_fmov_imm8(imm8: u8) -> u64 {
    let b7 = ((imm8 >> 7) & 1) as u64;
    let b6 = ((imm8 >> 6) & 1) as u64;
    let b54 = ((imm8 >> 4) & 0b11) as u64;
    let b30 = (imm8 & 0b1111) as u64;
    let rep = if b6 == 1 { 0xFFu64 } else { 0 };
    (b7 << 63) | ((b6 ^ 1) << 62) | (rep << 54) | (b54 << 52) | (b30 << 48)
}

/// Decode the N:immr:imms bitmask immediate encoding used by logical
/// instructions. Returns the 64-bit expanded bitmask.
///
/// ARM64 bitmask immediates encode repeating bit patterns. The element
/// size is determined by the highest bit of `NOT(imms)` when N=0, or
/// is 64 bits when N=1. Within each element, `imms` consecutive bits
/// are set starting at bit 0, then rotated right by `immr`.
pub fn decode_bitmask_imm(n: bool, immr: u8, imms: u8, sf: bool) -> Result<u64, EmuError> {
    let len = if n {
        6 // 64-bit element
    } else {
        // find highest bit of NOT(imms[5:0])
        let not_imms = (!imms) & 0x3F;
        if not_imms == 0 {
            return Err(EmuError::UnknownInstruction(0));
        }
        // highest set bit position (0-indexed)
        let mut len = 5u8;
        while len > 0 && (not_imms & (1 << len)) == 0 {
            len -= 1;
        }
        len
    };

    // reject if !sf and N=1
    if !sf && n {
        return Err(EmuError::UnknownInstruction(0));
    }

    let esize: u32 = 1 << len;
    let mask = esize - 1;

    let s = (imms as u32) & mask;
    let r = (immr as u32) & mask;

    // s == mask is a reserved encoding
    if s == mask {
        return Err(EmuError::UnknownInstruction(0));
    }

    // create element with (s+1) ones
    let ones: u64 = (1u64 << (s + 1)) - 1;

    // rotate right by r within the element
    let element_mask: u64 = if esize == 64 { u64::MAX } else { (1u64 << esize) - 1 };
    let element = if r == 0 {
        ones
    } else {
        ((ones >> r) | (ones << (esize - r))) & element_mask
    };

    // replicate across 64 bits
    let mut result = element;
    let mut width = esize;
    while width < 64 {
        result |= result << width;
        width *= 2;
    }

    if !sf {
        result &= 0xFFFF_FFFF;
    }

    Ok(result)
}

/// Encode a 64-bit value (or 32-bit when `!sf`) as the `(N, immr, imms)`
/// triple that `decode_bitmask_imm` consumes. Returns `None` when the
/// value isn't expressible as an ARM64 logical bitmask immediate; those
/// exclude all-zeros, all-ones, and any pattern that doesn't reduce to
/// a rotated run of ones in a 2/4/8/16/32/64-bit element.
pub fn encode_bitmask_imm(value: u64, sf: bool) -> Option<(bool, u8, u8)> {
    let reg_width: u32 = if sf { 64 } else { 32 };
    // Reject trivial patterns the ARM spec excludes.
    let trimmed = if sf { value } else { value & 0xFFFF_FFFF };
    if !sf && value != trimmed {
        // Upper 32 bits set in a 32-bit instruction: not encodable.
        return None;
    }
    if trimmed == 0 {
        return None;
    }
    if sf && trimmed == u64::MAX {
        return None;
    }
    if !sf && trimmed == 0xFFFF_FFFF {
        return None;
    }

    // Replicate the 32-bit value to 64 bits so the search below can treat
    // everything uniformly; the decoder does the same in reverse.
    let replicated: u64 = if sf {
        trimmed
    } else {
        trimmed | (trimmed << 32)
    };

    for &esize in &[2u32, 4, 8, 16, 32, 64] {
        if esize > reg_width {
            break;
        }
        let mask: u64 = if esize == 64 { u64::MAX } else { (1u64 << esize) - 1 };
        let element = replicated & mask;
        let mut stride: u32 = esize;
        let mut repeats = true;
        while stride < 64 {
            if ((replicated >> stride) & mask) != element {
                repeats = false;
                break;
            }
            stride += esize;
        }
        if !repeats {
            continue;
        }
        if element == 0 || element == mask {
            continue;
        }
        let ones = element.count_ones();
        // Try rotating right by each possible amount; a valid bitmask
        // immediate rotates into a contiguous run of ones in the low bits.
        for r in 0..esize {
            let rotated = if r == 0 {
                element
            } else {
                ((element >> r) | (element << (esize - r))) & mask
            };
            if rotated == (1u64 << ones) - 1 {
                let s_val = ones - 1;
                let n_bit = esize == 64;
                let len: u32 = match esize {
                    2 => 1,
                    4 => 2,
                    8 => 3,
                    16 => 4,
                    32 => 5,
                    64 => 6,
                    _ => unreachable!(),
                };
                let imms: u8 = if n_bit {
                    (s_val as u8) & 0x3F
                } else {
                    let upper_count = 5u32 - len;
                    let upper_bits = if upper_count == 0 {
                        0u8
                    } else {
                        (((1u32 << upper_count) - 1) as u8) << (len + 1)
                    };
                    upper_bits | ((s_val as u8) & ((1u8 << len) - 1))
                };
                // The loop found `r` such that ROR(element, r) == the
                // canonical low run of ones. The decoder reconstructs the
                // element as ROR(canonical, immr), so the encoded rotate is
                // the inverse: immr = (esize - r) mod esize. (For r == 0 the
                // modulo keeps immr == 0.)
                let immr = ((esize - r) % esize) as u8;
                return Some((n_bit, immr, imms));
            }
        }
    }
    None
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
        // scalar FP (and SIMD, which we do not implement)
        0b0111 | 0b1111 => decode_fp_group(instr),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

/// The Advanced SIMD forms this crate assembles, all of which land in the
/// same top-level group as scalar FP. `None` means "not one of these",
/// and the scalar FP decode below carries on.
fn decode_advanced_simd(instr: u32) -> Option<Instruction> {
    let q = bit(instr, 30) == 1;
    let op = bit(instr, 29) == 1;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    // Modified immediate: 0 Q op 0111100000 abc cmode 0 1 defgh Rd.
    if instr & 0x9FF8_0400 == 0x0F00_0400 {
        let cmode = bits(instr, 15, 12) as u8;
        let form = simd_imm_form(cmode, op)?;
        let imm8 = ((bits(instr, 18, 16) << 5) | bits(instr, 9, 5)) as u8;
        // The byte-mask form is the only one that names a d register, and
        // only when Q is clear; every other cmode names an arrangement.
        let arrangement = if form.esize == 8 && !q {
            if form.op == SimdImmOp::Fmov {
                // cmode 1111 with op set is the 2d form and nothing else:
                // there is no scalar FMOV immediate in this group.
                return None;
            }
            None
        } else {
            Some(Arrangement { esize: form.esize, q })
        };
        let bytes = if q { 16 } else { 8 };
        return Some(Instruction::SimdModifiedImm {
            op: form.op,
            arrangement,
            rd,
            value: simd_replicate(simd_expand_imm(form, imm8), form.esize, bytes),
            imm8,
            shift: form.shift,
            msl: form.msl,
        });
    }

    // The bitwise three-same group: 0 Q U 01110 size 1 Rm 000111 Rn Rd,
    // where U and the size field together pick the operation.
    if instr & 0x9F20_FC00 == 0x0E20_1C00 {
        let logical = simd_logical_by_bits(op, bits(instr, 23, 22) as u8)?;
        return Some(Instruction::SimdLogicalReg {
            op: logical,
            q,
            rm: bits(instr, 20, 16) as u8,
            rn,
            rd,
        });
    }

    // Three-different: 0 Q U 01110 size 1 Rm opcode 00 Rn Rd, with the
    // SIMD-scalar class 01 U 11110 size 1 Rm opcode 00 Rn Rd. Bits 11:10
    // are what separate it from three-same, which sets bit 10.
    let scalar_three_diff = instr & 0xDF20_0C00 == 0x5E20_0000;
    if instr & 0x9F20_0C00 == 0x0E20_0000 || scalar_three_diff {
        let size = bits(instr, 23, 22) as u8;
        let row = simd_diff_by_bits(op, bits(instr, 15, 12) as u8)?;
        let esize = size_esize(size);
        let mask = if scalar_three_diff { row.scalar } else { row.lanes };
        if !lane_allowed(mask, esize) {
            return None;
        }
        return Some(Instruction::SimdThreeDiff {
            op: row.op,
            esize,
            upper: q && !scalar_three_diff,
            scalar: scalar_three_diff,
            rm: bits(instr, 20, 16) as u8,
            rn,
            rd,
        });
    }

    // Shift by immediate: 0 Q U 011110 immh immb opcode 1 Rn Rd, with the
    // SIMD-scalar class 01 U 111110 immh immb opcode 1 Rn Rd. An immh of
    // zero is the modified-immediate group handled above, not a shift.
    let scalar_shift = instr & 0xDF80_0400 == 0x5F00_0400;
    if instr & 0x9F80_0400 == 0x0F00_0400 || scalar_shift {
        let immh = bits(instr, 22, 19) as u8;
        let immb = bits(instr, 18, 16) as u8;
        // The four conversions between a float and a fixed-point integer
        // are the FP misc rows again, spelled with a `#fbits` tail; the
        // shift encoding is where the amount fits.
        if let Some(fp) = simd_fp_fixed_by_bits(op, bits(instr, 15, 11) as u8) {
            let esize = shift_imm_esize(immh)?;
            if !lane_allowed(fp.lanes, esize) || (!scalar_shift && esize == 8 && !q) {
                return None;
            }
            return Some(Instruction::SimdFpTwoMisc {
                op: fp.op,
                esize,
                q: q && !scalar_shift,
                scalar: scalar_shift,
                fbits: shift_imm_amount(immh, immb, true)?,
                rn,
                rd,
            });
        }
        let row = simd_shift_by_bits(op, bits(instr, 15, 11) as u8)?;
        let esize = shift_imm_esize(immh)?;
        let mask = if scalar_shift { row.scalar } else { row.lanes };
        if !lane_allowed(mask, esize) {
            return None;
        }
        let shift = shift_imm_amount(immh, immb, row.right)?;
        return Some(Instruction::SimdShiftImm {
            op: row.op,
            esize,
            q,
            scalar: scalar_shift,
            shift,
            rn,
            rd,
        });
    }

    // Three-same (integer): 0 Q U 01110 size 1 Rm opcode 1 Rn Rd, and the
    // SIMD-scalar class 01 U 11110 size 1 Rm opcode 1 Rn Rd beside it.
    // A (U, opcode) pair the table does not carry is a floating-point row:
    // answering None leaves it to the scalar FP decode below and, failing
    // that, to the unknown-instruction error.
    let scalar_three_same = instr & 0xDF20_0400 == 0x5E20_0400;
    if instr & 0x9F20_0400 == 0x0E20_0400 || scalar_three_same {
        // Opcodes 0x18 and up are the float rows, where bit 23 is an
        // opcode bit and bit 22 alone names the lane width.
        if let Some(fp) = simd_fp_same_by_bits(
            op,
            bit(instr, 23) == 1,
            bits(instr, 15, 11) as u8,
        ) {
            let esize = if bit(instr, 22) == 1 { 8 } else { 4 };
            if scalar_three_same && !fp.scalar {
                return None;
            }
            // No float vector form is spelled 1d: one 64-bit lane is the
            // SIMD-scalar form, written with a d register.
            if !scalar_three_same && esize == 8 && !q {
                return None;
            }
            return Some(Instruction::SimdFpThreeSame {
                op: fp.op,
                esize,
                q,
                scalar: scalar_three_same,
                rm: bits(instr, 20, 16) as u8,
                rn,
                rd,
            });
        }
        let size = bits(instr, 23, 22) as u8;
        let row = simd_same_by_bits(op, bits(instr, 15, 11) as u8)?;
        let esize = size_esize(size);
        let mask = if scalar_three_same { row.scalar } else { row.lanes };
        if !lane_allowed(mask, esize) {
            return None;
        }
        return Some(Instruction::SimdThreeSame {
            op: row.op,
            esize,
            q,
            scalar: scalar_three_same,
            rm: bits(instr, 20, 16) as u8,
            rn,
            rd,
        });
    }

    // Two-register misc: 0 Q U 01110 size 10000 opcode 10 Rn Rd, with the
    // SIMD-scalar class 01 U 11110 size 10000 opcode 10 Rn Rd.
    let scalar_two_misc = instr & 0xDF3E_0C00 == 0x5E20_0800;
    if instr & 0x9F3E_0C00 == 0x0E20_0800 || scalar_two_misc {
        if let Some(fp) = simd_fp_misc_by_bits(
            op,
            bit(instr, 23) == 1,
            bits(instr, 16, 12) as u8,
        ) {
            let esize = if bit(instr, 22) == 1 { 8 } else { 4 };
            let plain = matches!(fp.shape, SimdFpMiscShape::Same | SimdFpMiscShape::Zero);
            let form_exists = if scalar_two_misc { fp.scalar } else { fp.vector };
            if !form_exists
                || !lane_allowed(fp.lanes, esize)
                || (plain && !scalar_two_misc && esize == 8 && !q)
            {
                return None;
            }
            return Some(Instruction::SimdFpTwoMisc {
                op: fp.op,
                esize,
                q: q && !scalar_two_misc,
                scalar: scalar_two_misc,
                fbits: 0,
                rn,
                rd,
            });
        }
        let size = bits(instr, 23, 22) as u8;
        let row = simd_misc_by_bits(op, bits(instr, 16, 12) as u8, size)?;
        // A row that fixes its own size field is spelled in byte lanes
        // whatever that field says (RBIT), so the lane width the
        // executor works in comes from the row, not the word.
        let esize = if row.size.is_some() { 1 } else { size_esize(size) };
        let mask = if scalar_two_misc { row.scalar } else { row.lanes };
        if !lane_allowed(mask, esize) {
            return None;
        }
        return Some(Instruction::SimdTwoMisc {
            op: row.op,
            esize,
            q,
            scalar: scalar_two_misc,
            rn,
            rd,
        });
    }

    // Across lanes: 0 Q U 01110 size 11000 opcode 10 Rn Rd, and the
    // SIMD-scalar pairwise class 01 U 11110 size 11000 opcode 10 Rn Rd.
    let scalar_across = instr & 0xDF3E_0C00 == 0x5E30_0800;
    if instr & 0x9F3E_0C00 == 0x0E30_0800 || scalar_across {
        if let Some(fp) = simd_fp_across_by_bits(
            op,
            bit(instr, 23) == 1,
            bits(instr, 16, 12) as u8,
            scalar_across,
        ) {
            let esize = if bit(instr, 22) == 1 { 8 } else { 4 };
            // The vector fold only comes in the 128-bit single
            // arrangement: folding two lanes is what the pairwise class
            // beside it is for.
            if !scalar_across && (esize != 4 || !q) {
                return None;
            }
            return Some(Instruction::SimdFpAcross {
                op: fp.op,
                esize,
                q: q && !scalar_across,
                rn,
                rd,
            });
        }
        let size = bits(instr, 23, 22) as u8;
        let row = simd_across_by_bits(op, bits(instr, 16, 12) as u8, scalar_across)?;
        let esize = size_esize(size);
        if !lane_allowed(row.lanes, esize) {
            return None;
        }
        // The widest lane only ever comes in the 128-bit arrangement:
        // `smaxv s3, v7.2s` would fold a pair, which is ADDP's job.
        if esize == 4 && !q && !scalar_across {
            return None;
        }
        return Some(Instruction::SimdAcross { op: row.op, esize, q, rn, rd });
    }

    // By element: 0 Q U 01111 size L M Rm opcode H 0 Rn Rd, with the
    // SIMD-scalar class 01 U 11111 size L M Rm opcode H 0 Rn Rd. Bit 10
    // clear is what separates it from the shift-by-immediate and
    // modified-immediate groups it shares its top bits with; a (U,
    // opcode) pair the table does not carry is a floating-point row.
    let scalar_by_element = instr & 0xDF00_0400 == 0x5F00_0000;
    if instr & 0x9F00_0400 == 0x0F00_0000 || scalar_by_element {
        if let Some(fp) = simd_fp_elem_by_bits(op, bits(instr, 15, 12) as u8) {
            // Bit 23 clear would be the half-precision form, which is
            // FEAT_FP16 and out of scope; bit 22 picks s from d.
            if bit(instr, 23) == 0 {
                return None;
            }
            let esize = if bit(instr, 22) == 1 { 8 } else { 4 };
            let l = bit(instr, 21) as u8;
            // A d element has two lanes, so H is the whole index.
            if (esize == 8 && l == 1) || (!scalar_by_element && esize == 8 && !q) {
                return None;
            }
            let (rm, index) = simd_elem_index(
                esize,
                bits(instr, 19, 16) as u8,
                l,
                bit(instr, 20) as u8,
                bit(instr, 11) as u8,
            );
            return Some(Instruction::SimdFpByElement {
                op: fp.op,
                esize,
                q: q && !scalar_by_element,
                scalar: scalar_by_element,
                index,
                rm,
                rn,
                rd,
            });
        }
        let row = simd_elem_by_bits(op, bits(instr, 15, 12) as u8)?;
        let esize = size_esize(bits(instr, 23, 22) as u8);
        if !lane_allowed(row.lanes, esize) || (scalar_by_element && !row.scalar) {
            return None;
        }
        let (rm, index) = simd_elem_index(
            esize,
            bits(instr, 19, 16) as u8,
            bit(instr, 21) as u8,
            bit(instr, 20) as u8,
            bit(instr, 11) as u8,
        );
        return Some(Instruction::SimdByElement {
            op: row.op,
            esize,
            q: q && !scalar_by_element,
            scalar: scalar_by_element,
            index,
            rm,
            rn,
            rd,
        });
    }

    // EXT: 0 Q 101110 00 0 Rm 0 imm4 0 Rn Rd. The 8B form concatenates the
    // two LOW halves, 16 bytes in all, so an index of 8 or more is reserved
    // (imm4<3> must be 0 when Q is 0) and refusing it here is what keeps the
    // executor's window inside the 16 bytes it built.
    if instr & 0xBFE0_8400 == 0x2E00_0000 {
        let index = bits(instr, 14, 11) as u8;
        if !q && index >= 8 {
            return None;
        }
        return Some(Instruction::SimdExt {
            q,
            index,
            rm: bits(instr, 20, 16) as u8,
            rn,
            rd,
        });
    }

    // TBL/TBX: 0 Q 001110 000 Rm 0 len op 00 Rn Rd.
    if instr & 0xBFE0_8C00 == 0x0E00_0000 {
        return Some(Instruction::SimdTableLookup {
            extend: bit(instr, 12) == 1,
            q,
            len: bits(instr, 14, 13) as u8 + 1,
            rm: bits(instr, 20, 16) as u8,
            rn,
            rd,
        });
    }

    // Permute: 0 Q 001110 size 0 Rm 0 opcode 10 Rn Rd. Bit 21 clear is
    // what holds it apart from the three-register and misc classes.
    if instr & 0xBF20_8C00 == 0x0E00_0800 {
        let permute = simd_permute_by_bits(bits(instr, 14, 12) as u8)?;
        let esize = size_esize(bits(instr, 23, 22) as u8);
        // No permute is spelled 1d: a single 64-bit lane would shuffle
        // nothing, and GAS refuses the arrangement.
        if esize == 8 && !q {
            return None;
        }
        return Some(Instruction::SimdPermute {
            op: permute,
            esize,
            q,
            rm: bits(instr, 20, 16) as u8,
            rn,
            rd,
        });
    }

    // The copy group: 0 Q op 01110000 imm5 0 imm4 1 Rn Rd for the vector
    // destinations, 01 0 11110000 imm5 0 0000 1 Rn Rd for the scalar DUP.
    let vector_copy = instr & 0x9FE0_8400 == 0x0E00_0400;
    let scalar_copy = instr & 0xFFE0_8400 == 0x5E00_0400;
    if vector_copy || scalar_copy {
        let imm5 = bits(instr, 20, 16) as u8;
        let imm4 = bits(instr, 14, 11) as u8;
        // imm5's lowest set bit names the element width and the bits
        // above it the lane; an imm5 of zero names nothing.
        if imm5 == 0 {
            return None;
        }
        let esize = 1u8 << imm5.trailing_zeros().min(3);
        let index = imm5 >> (esize.trailing_zeros() + 1);
        let simd_op = if scalar_copy {
            if imm4 != 0 {
                return None;
            }
            SimdCopyOp::DupScalar
        } else if op {
            SimdCopyOp::InsElement
        } else {
            match imm4 {
                0b0000 => SimdCopyOp::DupElement,
                0b0001 => SimdCopyOp::DupGeneral,
                0b0011 => SimdCopyOp::InsGeneral,
                0b0101 => SimdCopyOp::Smov,
                0b0111 => SimdCopyOp::Umov,
                _ => return None,
            }
        };
        return Some(Instruction::SimdCopy {
            op: simd_op,
            esize,
            q,
            index,
            index2: imm4 >> esize.trailing_zeros(),
            rn,
            rd,
        });
    }

    // FMOV between an X register and the upper lane: sf 0011110 10 1 01
    // opcode(110 out, 111 in) 000000 Rn Rd, with bits 15:10 clear.
    match instr & 0xFFFF_FC00 {
        0x9EAE_0000 => Some(Instruction::FpMoveLane { to_fp: false, rd, rn }),
        0x9EAF_0000 => Some(Instruction::FpMoveLane { to_fp: true, rd, rn }),
        _ => None,
    }
}

fn decode_fp_group(instr: u32) -> Result<Instruction, EmuError> {
    if let Some(decoded) = decode_advanced_simd(instr) {
        return Ok(decoded);
    }

    // Data-processing (1 source): FMOV (reg), FNEG, FABS, FCVT.
    //   Encoding: 0_0_0_11110_ftype_1_00_000_1_op_000_Rn_Rd  (opcode in bits 20:15)
    // Data-processing (2 source): FADD/FSUB/FMUL/FDIV.
    //   Encoding: 0_0_0_11110_ftype_1_Rm_opcode_10_Rn_Rd
    // FCMP:
    //   Encoding: 0_0_0_11110_ftype_1_Rm_00_1000_Rn_opcode2
    // FCVTZS (float -> Xd/Wd, round toward zero):
    //   Encoding: sf_0_0_11110_ftype_1_11_000_000000_Rn_Rd
    // SCVTF (Xn/Wn -> float):
    //   Encoding: sf_0_0_11110_ftype_1_00_010_000000_Rn_Rd
    // ftype picks the scalar width: 00 = single (S), 01 = double (D),
    // the two views the course uses. Half precision (11) stays unhandled.

    // FP data-processing 3-source (the FMADD family) sits at bits[28:24]
    // = 11111, one above the class every other scalar FP form uses, so it
    // is taken before the guard below rejects it.
    if bits(instr, 28, 24) == 0b11111 && bits(instr, 31, 29) == 0 {
        let ftype = bits(instr, 23, 22);
        if ftype != 0b00 && ftype != 0b01 {
            return Err(EmuError::UnknownInstruction(instr));
        }
        let o1 = bit(instr, 21) as u8;
        let o0 = bit(instr, 15) as u8;
        let Some((_, _, _, op)) = FP_MUL_ADD_OPS
            .iter()
            .find(|(_, a, b, _)| *a == o1 && *b == o0)
        else {
            return Err(EmuError::UnknownInstruction(instr));
        };
        return Ok(Instruction::FpMulAdd {
            op: *op,
            fd: bits(instr, 4, 0) as u8,
            fn_: bits(instr, 9, 5) as u8,
            fm: bits(instr, 20, 16) as u8,
            fa: bits(instr, 14, 10) as u8,
            single: ftype == 0b00,
        });
    }

    let bits_28_24 = bits(instr, 28, 24);
    if bits_28_24 != 0b11110 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let ftype = bits(instr, 23, 22);
    if ftype != 0b00 && ftype != 0b01 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let single = ftype == 0b00;
    let bit21 = bit(instr, 21);

    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;
    let rm = bits(instr, 20, 16) as u8;

    // FP <-> integer conversion, both forms: rmode in 20:19, opcode in
    // 18:16. Bit 21 = 1 is the integer form, whose bits 15:10 are fixed
    // zero; bit 21 = 0 is the fixed-point one, where a 6-bit scale field
    // replaces them and holds 64 minus fbits. The rows come from the
    // shared tables so the encoder and this cannot drift.
    //
    // This is the ONLY branch that may run with bit 21 = 0. The
    // FMOV-immediate test below reads bits 12:10, which a fixed-point
    // scale ending in 100 would satisfy, so every other branch stays
    // behind the gate that follows.
    let fbits = if bit21 == 1 {
        (bits(instr, 15, 10) == 0).then_some(0u8)
    } else {
        Some((64 - bits(instr, 15, 10)) as u8)
    };
    if let Some(fbits) = fbits {
        let rmode = bits(instr, 20, 19) as u8;
        let opcode = bits(instr, 18, 16) as u8;
        let sf = bit(instr, 31) == 1;
        if let Some((_, _, _, op)) = FP_TO_INT_OPS
            .iter()
            .find(|(_, r, o, _)| *r == rmode && *o == opcode)
        {
            return Ok(Instruction::FpToInt { op: *op, rd, fn_: rn, sf, single, fbits });
        }
        if let Some((_, _, _, op)) = FP_FROM_INT_OPS
            .iter()
            .find(|(_, r, o, _)| *r == rmode && *o == opcode)
        {
            return Ok(Instruction::FpFromInt { op: *op, fd: rd, rn, sf, single, fbits });
        }
    }

    if bit21 != 1 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    // FP data-processing 2-source: bits[15:10] = opcode | 10
    if bits(instr, 11, 10) == 0b10 {
        let opcode = bits(instr, 15, 12);
        let Some((_, _, op)) = FP_BINARY_OPS.iter().find(|(_, code, _)| u32::from(*code) == opcode)
        else {
            return Err(EmuError::UnknownInstruction(instr));
        };
        return Ok(Instruction::FpBinary { op: *op, fd: rd, fn_: rn, fm: rm, single });
    }

    // FCSEL: bits 11:10 = 11. The 01 neighbour is FCCMP/FCCMPE, which is
    // out of scope and must keep falling through to the reject at the
    // bottom rather than being folded in here.
    if bits(instr, 11, 10) == 0b11 {
        let cond = Condition::from_u8(bits(instr, 15, 12) as u8)?;
        return Ok(Instruction::FpCondSel { fd: rd, fn_: rn, fm: rm, cond, single });
    }

    // FP data-processing 1-source: opcode in bits 20:15, bits 14:10 = 10000.
    // FMOV keeps its dedicated variant; FABS/FNEG/FSQRT share FpUnary. FCVT's
    // opcode is 0001 followed by dest-type: the ftype names the SOURCE
    // width, so only the cross-width pairs are valid encodings.
    if bits(instr, 14, 10) == 0b10000 {
        let opcode = bits(instr, 20, 15);
        if let Some((_, _, op)) = FP_UNARY_OPS.iter().find(|(_, code, _)| u32::from(*code) == opcode)
        {
            return Ok(Instruction::FpUnary { op: *op, fd: rd, fn_: rn, single });
        }
        match opcode {
            0b000000 => return Ok(Instruction::FpMoveReg { fd: rd, fn_: rn, single }),
            // FCVT Sd, Dn: dest single, source double (narrow).
            0b000100 if !single => {
                return Ok(Instruction::FpCvt { fd: rd, fn_: rn, widen: false })
            }
            // FCVT Dd, Sn: dest double, source single (widen, exact).
            0b000101 if single => {
                return Ok(Instruction::FpCvt { fd: rd, fn_: rn, widen: true })
            }
            _ => {}
        }
    }

    // FMOV (scalar, immediate): imm8 in bits 20:13, bits 12:10 = 100, and
    // the Rn field is zero. Expanded here so the executor writes raw bits;
    // the S form expands to f32 bits (every VFP immediate is exact in f32).
    if bits(instr, 12, 10) == 0b100 && bits(instr, 9, 5) == 0 {
        let imm8 = bits(instr, 20, 13) as u8;
        let imm_bits = if single {
            (f64::from_bits(expand_fmov_imm8(imm8)) as f32).to_bits() as u64
        } else {
            expand_fmov_imm8(imm8)
        };
        return Ok(Instruction::FpMoveImm { fd: rd, imm_bits, single });
    }

    // FCMP: opcode2 = 001000 in bits 15:10, bits 4:0 = 00000, bits 20:16 = Rm.
    // opc bits 4:3 pick the variant: 00 FCMP, 10 FCMPE. The signaling
    // form differs only in how quiet NaNs trap, and the emulator raises
    // no FP exceptions, so both set the same flags.
    if bits(instr, 15, 10) == 0b001000 && matches!(bits(instr, 4, 0), 0b00000 | 0b10000) {
        return Ok(Instruction::FpCompare { fn_: rn, fm: rm, single });
    }

    // FMOV between the register files: rmode 00, opcode 110 (FP -> GP) or
    // 111 (GP -> FP), bits 15:10 zero. Only the matched-width pairs are
    // valid encodings (w<->s when sf=0/ftype=S, x<->d when sf=1/ftype=D).
    let fmov_field = bits(instr, 20, 10);
    if fmov_field == 0b00110_000000 || fmov_field == 0b00111_000000 {
        let sf = bit(instr, 31) == 1;
        if sf == single {
            return Err(EmuError::UnknownInstruction(instr));
        }
        return Ok(Instruction::FpMoveGeneral {
            to_fp: fmov_field == 0b00111_000000,
            sf,
            single,
            rd,
            rn,
        });
    }

    Err(EmuError::UnknownInstruction(instr))
}

// ---------------------------------------------------------------------------
// data processing: immediate group
// ---------------------------------------------------------------------------

fn decode_dp_imm_group(instr: u32) -> Result<Instruction, EmuError> {
    // PC-relative addressing (ADR / ADRP) sits in this group with the fixed
    // field bits[28:24] = 10000. Detect it before the op0 dispatch since its
    // op0 (bits 25:23) overlaps no other dp-immediate subgroup.
    if bits(instr, 28, 24) == 0b10000 {
        return decode_adr(instr);
    }

    let op0 = bits(instr, 25, 23);

    match op0 {
        // add/subtract immediate
        0b010 => decode_add_sub_imm(instr),
        // move wide immediate
        0b101 => decode_move_wide(instr),
        // logical immediate
        0b100 => decode_logical_imm(instr),
        // bitfield (used for LSL/LSR/ASR immediate via aliases)
        0b110 => decode_bitfield(instr),
        // extract (the encoding behind `ror Rd, Rn, #shift`)
        0b111 => decode_extract(instr),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

/// Decode EXTR, which AArch64 uses for `ROR Rd, Rn, #shift`: the ROR
/// alias is an EXTR whose two sources are the same register. Like the
/// shift aliases in `decode_bitfield`, it lowers onto the executor's
/// ORR-with-shifted-register path, since `ORR Rd, ZR, Rn, ROR #shift` is
/// bit-for-bit the same operation. A general EXTR (two different sources)
/// has no equivalent there and stays unknown; the assembler never emits
/// one, and executing a wrong instruction would be worse than refusing.
fn decode_extract(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let n = bit(instr, 22) == 1;
    let rm = bits(instr, 20, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    // op21 and o0 are fixed at zero, N tracks sf, and the 32-bit form's
    // rotate has to fit inside the register.
    if bits(instr, 30, 29) != 0 || bit(instr, 21) != 0 || sf != n || (!sf && imms >= 32) {
        return Err(EmuError::UnknownInstruction(instr));
    }
    if rm != rn {
        return Err(EmuError::UnknownInstruction(instr));
    }

    Ok(Instruction::LogReg {
        op: LogOp::Orr,
        sf,
        rd,
        rn: 31,
        rm: rn,
        shift: ShiftType::ROR,
        amount: imms,
        set_flags: false,
        invert: false,
    })
}

fn decode_adr(instr: u32) -> Result<Instruction, EmuError> {
    // ADR / ADRP: op[31] immlo[30:29] 1_0000 immhi[23:5] Rd[4:0].
    let adrp = bit(instr, 31) == 1;
    let immlo = bits(instr, 30, 29);
    let immhi = bits(instr, 23, 5);
    let imm21 = (immhi << 2) | immlo;
    let mut imm = sign_extend(imm21, 21);
    if adrp {
        // The page form scales the 21-bit immediate by 4 KiB.
        imm <<= 12;
    }
    let rd = bits(instr, 4, 0) as u8;
    Ok(Instruction::Adr { adrp, rd, imm })
}

fn decode_add_sub_imm(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op = bit(instr, 30);    // 0=ADD, 1=SUB
    let s = bit(instr, 29);     // set flags
    let shift = bit(instr, 22) as u8; // 0 or 1 (LSL #0 or LSL #12)
    let imm12 = bits(instr, 21, 10);
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpImm {
        op: dp_op,
        sf,
        rd,
        rn,
        imm: imm12,
        shift: shift * 12,
    })
}

fn decode_move_wide(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let hw = bits(instr, 22, 21) as u8;
    let imm16 = bits(instr, 20, 5) as u16;
    let rd = bits(instr, 4, 0) as u8;

    // 32-bit form cannot use hw >= 2
    if !sf && hw >= 2 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    let op = match opc {
        0b00 => MoveWideOp::Movn,
        0b10 => MoveWideOp::Movz,
        0b11 => MoveWideOp::Movk,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };

    Ok(Instruction::MoveWide {
        op,
        sf,
        rd,
        imm16,
        hw,
    })
}

fn decode_logical_imm(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 22) == 1;
    let immr = bits(instr, 21, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let imm = decode_bitmask_imm(n, immr, imms, sf)
        .map_err(|_| EmuError::UnknownInstruction(instr))?;

    let (op, set_flags) = match opc {
        0b00 => (LogOp::And, false),
        0b01 => (LogOp::Orr, false),
        0b10 => (LogOp::Eor, false),
        0b11 => (LogOp::And, true), // ANDS
        _ => unreachable!(),
    };

    Ok(Instruction::LogImm {
        op,
        sf,
        rd,
        rn,
        imm,
        set_flags,
    })
}

fn decode_bitfield(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 22) == 1;
    let immr = bits(instr, 21, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let reg_size: u8 = if sf { 64 } else { 32 };

    // The 32-bit form requires N == 0 with both fields inside the register
    // (immr/imms < 32); the 64-bit form requires N == 1. Anything else is
    // a reserved encoding: without this check `reg_size - immr` underflows
    // on a crafted word and fabricates a shift instead of rejecting.
    if sf != n || (!sf && (immr >= 32 || imms >= 32)) {
        return Err(EmuError::UnknownInstruction(instr));
    }

    // We represent shift-immediates as ORR Xd, XZR, Xn, <shift> #amount.
    // This reuses the LogReg path in the executor.
    match opc {
        // SBFM: ASR alias when imms == reg_size-1
        0b00 if imms == reg_size - 1 => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::ASR,
            amount: immr,
            set_flags: false,
            invert: false,
        }),
        // UBFM: LSR alias when imms == reg_size-1
        0b10 if imms == reg_size - 1 => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::LSR,
            amount: immr,
            set_flags: false,
            invert: false,
        }),
        // UBFM: LSL alias when imms+1 == immr
        0b10 if immr != 0 && imms + 1 == immr => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::LSL,
            amount: reg_size - immr,
            set_flags: false,
            invert: false,
        }),
        // General SBFM/UBFM: the extract-and-extend forms behind sxtb/sxth/
        // sxtw, uxtb/uxth, and sbfx/ubfx. The shift aliases above are
        // matched first, so only the genuine bitfield moves land here.
        0b00 => Ok(Instruction::Bitfield {
            op: BitfieldOp::Sbfm,
            sf,
            rd,
            rn,
            immr,
            imms,
        }),
        0b10 => Ok(Instruction::Bitfield {
            op: BitfieldOp::Ubfm,
            sf,
            rd,
            rn,
            immr,
            imms,
        }),
        // BFM (bitfield insert), the form behind bfi: unlike SBFM/UBFM it
        // reads Rd and preserves the bits outside the field.
        0b01 => Ok(Instruction::Bitfield {
            op: BitfieldOp::Bfm,
            sf,
            rd,
            rn,
            immr,
            imms,
        }),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

// ---------------------------------------------------------------------------
// branch group
// ---------------------------------------------------------------------------

fn decode_branch_group(instr: u32) -> Result<Instruction, EmuError> {
    // compare-and-branch: x011_010o ... (CBZ when bit 24 = 0, CBNZ = 1)
    if (instr & 0x7E00_0000) == 0x3400_0000 {
        let sf = bit(instr, 31) == 1;
        let nonzero = bit(instr, 24) == 1;
        let imm19 = bits(instr, 23, 5);
        let rt = bits(instr, 4, 0) as u8;
        let offset = sign_extend(imm19, 19) * 4;
        return Ok(Instruction::CompareBranch {
            sf,
            rt,
            nonzero,
            offset,
        });
    }

    // test-bit-and-branch: b5_011_011_o b40_imm14_Rt (TBZ when bit 24 = 0, TBNZ = 1)
    if (instr & 0x7E00_0000) == 0x3600_0000 {
        let b5 = bit(instr, 31) as u8;
        let b40 = bits(instr, 23, 19) as u8;
        let bit_pos = (b5 << 5) | b40;
        let nonzero = bit(instr, 24) == 1;
        let imm14 = bits(instr, 18, 5);
        let rt = bits(instr, 4, 0) as u8;
        let offset = sign_extend(imm14, 14) * 4;
        return Ok(Instruction::TestBranch {
            rt,
            bit_pos,
            nonzero,
            offset,
        });
    }

    // conditional branch: 0101_010o oooo_oooo oooo_oooo ooo0_cccc
    if (instr & 0xFF00_0010) == 0x5400_0000 {
        let imm19 = bits(instr, 23, 5);
        let cond_bits = bits(instr, 3, 0) as u8;
        let offset = sign_extend(imm19, 19) * 4;
        let cond = Condition::from_u8(cond_bits)?;
        return Ok(Instruction::BCond { cond, offset });
    }

    // unconditional branch immediate: x001_01oo oooo_oooo oooo_oooo oooo_oooo
    if (instr & 0x7C00_0000) == 0x1400_0000 {
        let link = bit(instr, 31) == 1;
        let imm26 = bits(instr, 25, 0);
        let offset = sign_extend(imm26, 26) * 4;
        return Ok(Instruction::BrImm { link, offset });
    }

    // unconditional branch register: 1101_011_ 0___1_1111 0000_00nn nnn0_0000
    if (instr & 0xFE1F_FC1F) == 0xD61F_0000 {
        let opc = bits(instr, 24, 21);
        let rn = bits(instr, 9, 5) as u8;
        let op = match opc {
            0b0000 => BrRegOp::Br,
            0b0001 => BrRegOp::Blr,
            0b0010 => BrRegOp::Ret,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        return Ok(Instruction::BrReg { op, rn });
    }

    Err(EmuError::UnknownInstruction(instr))
}

// ---------------------------------------------------------------------------
// load/store group
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SIMD&FP disassembly
// ---------------------------------------------------------------------------

/// The register-name prefix a SIMD&FP access width is spelled with.
fn fp_reg_letter(size: MemSize) -> char {
    match size {
        MemSize::B => 'b',
        MemSize::H => 'h',
        MemSize::W => 's',
        MemSize::X => 'd',
        MemSize::Q => 'q',
    }
}

/// A base register in an address: 31 is SP, never XZR.
fn base_name(rn: u8) -> String {
    if rn >= 31 { "sp".to_string() } else { format!("x{rn}") }
}

/// `#8`, `#-3`, in the decimal objdump prints offsets with.
fn imm_text(offset: i64) -> String {
    format!("#{offset}")
}

/// The address operand of a single-register load/store, GAS spelling.
fn address_text(rn: u8, offset: &LdStOffset, mode: IndexMode) -> String {
    let base = base_name(rn);
    match offset {
        LdStOffset::Immediate(imm) => match mode {
            IndexMode::PreIndex => format!("[{base}, {}]!", imm_text(*imm)),
            IndexMode::PostIndex => format!("[{base}], {}", imm_text(*imm)),
            IndexMode::SignedOffset if *imm == 0 => format!("[{base}]"),
            IndexMode::SignedOffset => format!("[{base}, {}]", imm_text(*imm)),
        },
        LdStOffset::Register {
            rm,
            extend,
            shift_amount,
        } => {
            // UXTW and SXTW take a W index; LSL, UXTX and SXTX take an X.
            let (index, keyword) = match extend {
                ExtendType::Uxtw => (format!("w{rm}"), "uxtw"),
                ExtendType::Sxtw => (format!("w{rm}"), "sxtw"),
                ExtendType::Sxtx => (format!("x{rm}"), "sxtx"),
                ExtendType::Lsl => (format!("x{rm}"), "lsl"),
            };
            match shift_amount {
                // A cleared S bit on an LSL index is the bare `[Xn, Xm]`
                // spelling; every other combination names its keyword.
                None if matches!(extend, ExtendType::Lsl) => format!("[{base}, {index}]"),
                None => format!("[{base}, {index}, {keyword}]"),
                Some(n) => format!("[{base}, {index}, {keyword} #{n}]"),
            }
        }
    }
}

/// GAS text for the SIMD&FP instructions this crate decodes, for the
/// conformance suite that replays the csarm inventory. `None` for
/// everything else: the general disassembly the UI shows is built in the
/// web layer, and this exists to prove an encoding round-trips.
pub fn format(instr: &Instruction) -> Option<String> {
    match instr {
        Instruction::FpLdSt {
            load,
            ft,
            rn,
            offset,
            size,
            mode,
            unscaled,
        } => {
            let mnemonic = match (*load, *unscaled) {
                (true, false) => "ldr",
                (false, false) => "str",
                (true, true) => "ldur",
                (false, true) => "stur",
            };
            let reg = fp_reg_letter(*size);
            Some(format!(
                "{mnemonic} {reg}{ft}, {}",
                address_text(*rn, offset, *mode)
            ))
        }
        Instruction::FpLdStPair {
            op,
            size,
            rt,
            rt2,
            rn,
            imm7,
            mode,
            no_allocate,
        } => {
            let mnemonic = match (op, *no_allocate) {
                (LdStPairOp::Ldp, false) => "ldp",
                (LdStPairOp::Stp, false) => "stp",
                (LdStPairOp::Ldp, true) => "ldnp",
                (LdStPairOp::Stp, true) => "stnp",
            };
            let reg = fp_reg_letter(*size);
            let address = address_text(*rn, &LdStOffset::Immediate(i64::from(*imm7)), *mode);
            Some(format!("{mnemonic} {reg}{rt}, {reg}{rt2}, {address}"))
        }
        Instruction::SimdLdStStructure {
            load,
            structures,
            count,
            esize,
            q,
            shape,
            rt,
            rn,
            post,
        } => {
            let replicate = matches!(shape, SimdStructShape::Replicate);
            let head = if *load { "ld" } else { "st" };
            let tail = if replicate { "r" } else { "" };
            // GAS prints a list of more than one register as a range,
            // and the range wraps past v31 exactly as the list does.
            let element = |t: &str| {
                if *count == 1 {
                    format!("{{v{rt}.{t}}}")
                } else {
                    let last = (u32::from(*rt) + u32::from(*count) - 1) % 32;
                    format!("{{v{rt}.{t}-v{last}.{t}}}")
                }
            };
            let list = match shape {
                SimdStructShape::Lane(index) => {
                    let letter = element_letter(*esize).to_string();
                    format!("{}[{index}]", element(&letter))
                }
                _ => element(Arrangement { esize: *esize, q: *q }.suffix()),
            };
            let address = match post {
                None => format!("[{}]", base_name(*rn)),
                Some(31) => format!(
                    "[{}], #{}",
                    base_name(*rn),
                    simd_struct_bytes(*shape, *count, *esize, *q)
                ),
                Some(rm) => format!("[{}], x{rm}", base_name(*rn)),
            };
            Some(format!("{head}{structures}{tail} {list}, {address}"))
        }
        Instruction::FpLdrLiteral { rt, offset, size } => {
            let reg = fp_reg_letter(*size);
            Some(format!("ldr {reg}{rt}, {}", imm_text(*offset)))
        }
        Instruction::FpMoveLane { to_fp, rd, rn } => Some(if *to_fp {
            format!("fmov v{rd}.d[1], x{rn}")
        } else {
            format!("fmov x{rd}, v{rn}.d[1]")
        }),
        Instruction::SimdModifiedImm { op, arrangement, rd, value, imm8, shift, msl } => {
            // FMOV's immediate is a float, and GAS prints the short
            // decimal the line was written with, not a bit pattern.
            if *op == SimdImmOp::Fmov {
                let a = arrangement.expect("the vector fmov immediate names an arrangement");
                return Some(format!("fmov v{rd}.{}, #{}", a.suffix(), fmov_imm_text(*imm8)));
            }
            let mnemonic = match op {
                SimdImmOp::Movi => "movi",
                SimdImmOp::Mvni => "mvni",
                SimdImmOp::Orr => "orr",
                SimdImmOp::Bic => "bic",
                SimdImmOp::Fmov => unreachable!("handled above"),
            };
            let dest = match arrangement {
                Some(a) => format!("v{rd}.{}", a.suffix()),
                None => format!("d{rd}"),
            };
            // The byte-mask forms print the immediate they expand to;
            // every other form prints imm8 and its shift as written.
            let byte_mask = arrangement.is_none_or(|a| a.esize == 8);
            let imm = if byte_mask { *value as u64 } else { u64::from(*imm8) };
            let suffix = match (byte_mask || *shift == 0, *msl) {
                (true, _) => String::new(),
                (false, false) => format!(", lsl #{shift}"),
                (false, true) => format!(", msl #{shift}"),
            };
            Some(format!("{mnemonic} {dest}, #{imm:#x}{suffix}"))
        }
        Instruction::SimdLogicalReg { op, q, rm, rn, rd } => {
            let t = if *q { "16b" } else { "8b" };
            // GAS prints `orr Vd.T, Vn.T, Vn.T` as the vector `mov`.
            if *op == SimdLogicalOp::Orr && rn == rm {
                return Some(format!("mov v{rd}.{t}, v{rn}.{t}"));
            }
            let mnemonic = simd_logical_name(*op);
            Some(format!("{mnemonic} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdThreeSame { op, esize, q, scalar, rm, rn, rd } => {
            let name = simd_same_row(*op).name;
            if *scalar {
                let l = element_letter(*esize);
                return Some(format!("{name} {l}{rd}, {l}{rn}, {l}{rm}"));
            }
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdTwoMisc { op, esize, q, scalar, rn, rd } => {
            let row = simd_misc_row(*op);
            let zero = if row.shape == SimdMiscShape::Zero { ", #0" } else { "" };
            let narrowing = row.shape == SimdMiscShape::Narrow;
            if *scalar {
                let l = element_letter(*esize);
                // A narrowing extract reads a lane of twice its result.
                let source = if narrowing { element_letter(esize * 2) } else { l };
                return Some(format!("{} {l}{rd}, {source}{rn}{zero}", row.name));
            }
            let narrow = Arrangement { esize: *esize, q: *q }.suffix();
            let wide = Arrangement { esize: esize * 2, q: true }.suffix();
            // The `2` suffix IS the Q bit for the rows that change width:
            // it names the half of the register the narrow side lives in.
            let two = if *q { "2" } else { "" };
            if narrowing {
                return Some(format!("{}{two} v{rd}.{narrow}, v{rn}.{wide}", row.name));
            }
            if row.shape == SimdMiscShape::Shll {
                let amount = u32::from(*esize) * 8;
                return Some(format!("{}{two} v{rd}.{wide}, v{rn}.{narrow}, #{amount}", row.name));
            }
            // The pairwise widening rows halve the lane count and double
            // the width, so the destination is spelled one step up.
            let dest = if row.shape == SimdMiscShape::Widen {
                Arrangement { esize: esize * 2, q: *q }.suffix()
            } else {
                narrow
            };
            Some(format!("{} v{rd}.{dest}, v{rn}.{narrow}{zero}", row.name))
        }
        Instruction::SimdThreeDiff { op, esize, upper, scalar, rm, rn, rd } => {
            let row = simd_diff_row(*op);
            if *scalar {
                let narrow = element_letter(*esize);
                let wide = element_letter(esize * 2);
                return Some(format!("{} {wide}{rd}, {narrow}{rn}, {narrow}{rm}", row.name));
            }
            let two = if *upper { "2" } else { "" };
            let narrow = Arrangement { esize: *esize, q: *upper }.suffix();
            let wide = Arrangement { esize: esize * 2, q: true }.suffix();
            let name = row.name;
            Some(match row.shape {
                SimdDiffShape::Long => {
                    format!("{name}{two} v{rd}.{wide}, v{rn}.{narrow}, v{rm}.{narrow}")
                }
                SimdDiffShape::Wide => {
                    format!("{name}{two} v{rd}.{wide}, v{rn}.{wide}, v{rm}.{narrow}")
                }
                SimdDiffShape::Narrow => {
                    format!("{name}{two} v{rd}.{narrow}, v{rn}.{wide}, v{rm}.{wide}")
                }
            })
        }
        Instruction::SimdShiftImm { op, esize, q, scalar, shift, rn, rd } => {
            let row = simd_shift_row(*op);
            let name = row.name;
            if *scalar {
                let narrow = element_letter(*esize);
                let source = if row.shape == SimdShiftShape::Narrow {
                    element_letter(esize * 2)
                } else {
                    narrow
                };
                return Some(format!("{name} {narrow}{rd}, {source}{rn}, #{shift}"));
            }
            let two = if *q { "2" } else { "" };
            let narrow = Arrangement { esize: *esize, q: *q }.suffix();
            let wide = Arrangement { esize: esize * 2, q: true }.suffix();
            Some(match row.shape {
                SimdShiftShape::Same => {
                    format!("{name} v{rd}.{narrow}, v{rn}.{narrow}, #{shift}")
                }
                // GAS spells the lengthening shift by zero SXTL / UXTL,
                // which is the whole of what those two mnemonics are.
                SimdShiftShape::Long if *shift == 0 => {
                    let alias = if row.u { "uxtl" } else { "sxtl" };
                    format!("{alias}{two} v{rd}.{wide}, v{rn}.{narrow}")
                }
                SimdShiftShape::Long => {
                    format!("{name}{two} v{rd}.{wide}, v{rn}.{narrow}, #{shift}")
                }
                SimdShiftShape::Narrow => {
                    format!("{name}{two} v{rd}.{narrow}, v{rn}.{wide}, #{shift}")
                }
            })
        }
        Instruction::SimdAcross { op, esize, q, rn, rd } => {
            let row = simd_across_row(*op);
            let dest = element_letter(if row.widen { esize * 2 } else { *esize });
            let source = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{} {dest}{rd}, v{rn}.{source}", row.name))
        }
        Instruction::SimdPermute { op, esize, q, rm, rn, rd } => {
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            let name = simd_permute_name(*op);
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdExt { q, index, rm, rn, rd } => {
            let t = if *q { "16b" } else { "8b" };
            Some(format!("ext v{rd}.{t}, v{rn}.{t}, v{rm}.{t}, #{index}"))
        }
        Instruction::SimdTableLookup { extend, q, len, rm, rn, rd } => {
            let name = if *extend { "tbx" } else { "tbl" };
            let t = if *q { "16b" } else { "8b" };
            // GAS prints a table of more than one register as a range,
            // and the range wraps past v31 exactly as the table does.
            let table = if *len == 1 {
                format!("{{v{rn}.16b}}")
            } else {
                let last = (u32::from(*rn) + u32::from(*len) - 1) % 32;
                format!("{{v{rn}.16b-v{last}.16b}}")
            };
            Some(format!("{name} v{rd}.{t}, {table}, v{rm}.{t}"))
        }
        Instruction::SimdByElement { op, esize, q, scalar, index, rm, rn, rd } => {
            let row = simd_elem_row(*op);
            let elem = element_letter(*esize);
            let name = row.name;
            match row.kind {
                SimdElemKind::Same(_) if *scalar => {
                    Some(format!("{name} {elem}{rd}, {elem}{rn}, v{rm}.{elem}[{index}]"))
                }
                SimdElemKind::Same(_) => {
                    let t = Arrangement { esize: *esize, q: *q }.suffix();
                    Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{elem}[{index}]"))
                }
                // The scalar long form writes twice what it reads, the
                // way the three-different scalar rows do.
                SimdElemKind::Long(_) if *scalar => {
                    let wide = element_letter(esize * 2);
                    Some(format!("{name} {wide}{rd}, {elem}{rn}, v{rm}.{elem}[{index}]"))
                }
                SimdElemKind::Long(_) => {
                    let two = if *q { "2" } else { "" };
                    let narrow = Arrangement { esize: *esize, q: *q }.suffix();
                    let wide = Arrangement { esize: esize * 2, q: true }.suffix();
                    Some(format!(
                        "{name}{two} v{rd}.{wide}, v{rn}.{narrow}, v{rm}.{elem}[{index}]"
                    ))
                }
            }
        }
        Instruction::SimdFpThreeSame { op, esize, q, scalar, rm, rn, rd } => {
            let name = simd_fp_same_row(*op).name;
            if *scalar {
                let l = element_letter(*esize);
                return Some(format!("{name} {l}{rd}, {l}{rn}, {l}{rm}"));
            }
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdFpTwoMisc { op, esize, q, scalar, fbits, rn, rd } => {
            let row = simd_fp_misc_row(*op);
            let name = row.name;
            let tail = if row.shape == SimdFpMiscShape::Zero {
                ", #0.0".to_string()
            } else if *fbits != 0 {
                format!(", #{fbits}")
            } else {
                String::new()
            };
            if *scalar {
                let l = element_letter(*esize);
                // A narrowing convert writes half the width it reads.
                if row.shape == SimdFpMiscShape::Narrow {
                    let half = element_letter(*esize / 2);
                    return Some(format!("{name} {half}{rd}, {l}{rn}"));
                }
                return Some(format!("{name} {l}{rd}, {l}{rn}{tail}"));
            }
            // The `2` suffix IS the Q bit on the rows that change width:
            // it names the half of the register the narrow side lives in.
            let two = if *q { "2" } else { "" };
            let wide = Arrangement { esize: *esize, q: true }.suffix();
            let half = Arrangement { esize: *esize / 2, q: *q }.suffix();
            Some(match row.shape {
                SimdFpMiscShape::Narrow => format!("{name}{two} v{rd}.{half}, v{rn}.{wide}"),
                SimdFpMiscShape::Long => format!("{name}{two} v{rd}.{wide}, v{rn}.{half}"),
                _ => {
                    let t = Arrangement { esize: *esize, q: *q }.suffix();
                    format!("{name} v{rd}.{t}, v{rn}.{t}{tail}")
                }
            })
        }
        Instruction::SimdFpAcross { op, esize, q, rn, rd } => {
            let row = simd_fp_across_row(*op);
            // The scalar pairwise class always folds a pair, so its
            // source is 2s or 2d whatever bit 30 says.
            let source = if row.scalar_class {
                Arrangement { esize: *esize, q: *esize == 8 }
            } else {
                Arrangement { esize: *esize, q: *q }
            };
            let dest = element_letter(*esize);
            Some(format!("{} {dest}{rd}, v{rn}.{}", row.name, source.suffix()))
        }
        Instruction::SimdFpByElement { op, esize, q, scalar, index, rm, rn, rd } => {
            let name = simd_fp_elem_row(*op).name;
            let elem = element_letter(*esize);
            if *scalar {
                return Some(format!("{name} {elem}{rd}, {elem}{rn}, v{rm}.{elem}[{index}]"));
            }
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{elem}[{index}]"))
        }
        Instruction::SimdCopy { op, esize, q, index, index2, rn, rd } => {
            let elem = element_letter(*esize);
            let arrangement = Arrangement { esize: *esize, q: *q };
            let gp = |wide: bool, reg: u8| format!("{}{reg}", if wide { 'x' } else { 'w' });
            Some(match op {
                SimdCopyOp::DupGeneral => format!(
                    "dup v{rd}.{}, {}",
                    arrangement.suffix(),
                    gp(*esize == 8, *rn)
                ),
                SimdCopyOp::DupElement => format!(
                    "dup v{rd}.{}, v{rn}.{elem}[{index}]",
                    arrangement.suffix()
                ),
                SimdCopyOp::DupScalar => format!("mov {elem}{rd}, v{rn}.{elem}[{index}]"),
                SimdCopyOp::InsGeneral => {
                    format!("mov v{rd}.{elem}[{index}], {}", gp(*esize == 8, *rn))
                }
                SimdCopyOp::InsElement => {
                    format!("mov v{rd}.{elem}[{index}], v{rn}.{elem}[{index2}]")
                }
                // UMOV of a whole-register-width lane is the general
                // `mov`, which is the spelling GAS prints back for it.
                SimdCopyOp::Umov => {
                    let full = *esize == if *q { 8 } else { 4 };
                    let mnemonic = if full { "mov" } else { "umov" };
                    format!("{mnemonic} {}, v{rn}.{elem}[{index}]", gp(*q, *rd))
                }
                SimdCopyOp::Smov => format!("smov {}, v{rn}.{elem}[{index}]", gp(*q, *rd)),
            })
        }
        _ => None,
    }
}

fn decode_ldst_group(instr: u32) -> Result<Instruction, EmuError> {
    // LDR (literal): opc(31:30) 011 V 00 in bits 29:24. Bit 26 (V) is
    // left in the word and read below, so the SIMD&FP literal forms
    // (0x1C/0x5C/0x9C000000) decode beside the integer ones.
    if (instr & 0x3B00_0000) == 0x1800_0000 {
        return decode_ldr_literal(instr);
    }

    // load/store pair
    if (instr & 0x3A00_0000) == 0x2800_0000 {
        return decode_ldst_pair(instr);
    }

    // the Advanced SIMD structure loads and stores, LD1-LD4 / ST1-ST4:
    // 0 Q 0011 0 x ... , where bit 24 picks whole registers from the
    // single-element shapes. Nothing else in the group claims 0x0C/0x0D.
    if (instr & 0xBE00_0000) == 0x0C00_0000 {
        return decode_simd_ldst_structure(instr)
            .ok_or(EmuError::UnknownInstruction(instr));
    }

    // single register load/store
    decode_ldst_single(instr)
}

/// LD1-LD4 / ST1-ST4 in all three shapes. `None` for an unallocated
/// combination, which the caller turns into an unknown instruction
/// rather than executing something the word does not mean.
fn decode_simd_ldst_structure(instr: u32) -> Option<Instruction> {
    let q = bit(instr, 30) == 1;
    let single = bit(instr, 24) == 1;
    let load = bit(instr, 22) == 1;
    let r = bit(instr, 21) == 1;
    let rm = bits(instr, 20, 16) as u8;
    let size = bits(instr, 11, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rt = bits(instr, 4, 0) as u8;

    // Without writeback the Rm field is RES0, and on the multiple
    // shape bit 21 is too.
    let post = if bit(instr, 23) == 1 {
        Some(rm)
    } else {
        if rm != 0 {
            return None;
        }
        None
    };

    if !single {
        if r {
            return None;
        }
        let opcode = bits(instr, 15, 12) as u8;
        let &(_, structures, count) =
            SIMD_STRUCT_MULTIPLE.iter().find(|row| row.0 == opcode)?;
        let esize = 1u8 << size;
        // A 1D arrangement holds one element, so there is nothing for an
        // interleaving form to interleave: only LD1/ST1 spell it.
        if esize == 8 && !q && structures > 1 {
            return None;
        }
        return Some(Instruction::SimdLdStStructure {
            load,
            structures,
            count,
            esize,
            q,
            shape: SimdStructShape::Multiple,
            rt,
            rn,
            post,
        });
    }

    // Single-structure: opcode<2:1> names the element width (11 being
    // the replicate rows), opcode<0> and R together the family number.
    let opcode = bits(instr, 15, 13) as u8;
    let s = bit(instr, 12) == 1;
    let structures = 1 + (opcode & 1) * 2 + u8::from(r);
    let (esize, shape) = if opcode >> 1 == 0b11 {
        // LD1R-LD4R. S is RES0 here, and there is no store form.
        if s || !load {
            return None;
        }
        (1u8 << size, SimdStructShape::Replicate)
    } else {
        let esize = match opcode >> 1 {
            0b00 => 1,
            0b01 => 2,
            _ if size & 1 == 0 => 4,
            _ => 8,
        };
        (esize, SimdStructShape::Lane(simd_struct_index(esize, q, s, size)?))
    };
    Some(Instruction::SimdLdStStructure {
        load,
        structures,
        count: structures,
        esize,
        q,
        shape,
        rt,
        rn,
        post,
    })
}

fn decode_ldr_literal(instr: u32) -> Result<Instruction, EmuError> {
    // opc:011_V_00. V picks the register file; opc picks the width.
    let opc = bits(instr, 31, 30);
    let imm19 = bits(instr, 23, 5);
    let rt = bits(instr, 4, 0) as u8;
    // imm19 is in instruction units (4 bytes each), signed.
    let offset = sign_extend(imm19, 19) * 4;
    if bit(instr, 26) == 1 {
        let size = match opc {
            0b00 => MemSize::W,
            0b01 => MemSize::X,
            0b10 => MemSize::Q,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        return Ok(Instruction::FpLdrLiteral { rt, offset, size });
    }
    // opc 10 is LDRSW (literal) and 11 is PRFM (literal); neither is
    // implemented, and neither may fall through as a plain LDR.
    if opc > 0b01 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    Ok(Instruction::LdrLiteral { sf: opc == 0b01, rt, offset })
}

fn decode_ldst_pair(instr: u32) -> Result<Instruction, EmuError> {
    let opc = bits(instr, 31, 30);
    let v = bit(instr, 26); // 0 = general registers, 1 = SIMD&FP
    let mode_bits = bits(instr, 24, 23);
    let l = bit(instr, 22); // 0=STP, 1=LDP
    let imm7 = bits(instr, 21, 15);
    let rt2 = bits(instr, 14, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rt = bits(instr, 4, 0) as u8;

    // op2 00 is the no-allocate pair (LDNP/STNP): a plain signed offset
    // with no writeback, differing from LDP/STP only in a cache hint this
    // interpreter has nothing to do with.
    let no_allocate = mode_bits == 0b00;
    let mode = match mode_bits {
        0b00 | 0b10 => IndexMode::SignedOffset,
        0b01 => IndexMode::PostIndex,
        _ => IndexMode::PreIndex,
    };

    let op = if l == 1 { LdStPairOp::Ldp } else { LdStPairOp::Stp };

    if v == 1 {
        // SIMD&FP pair: opc 00 = S, 01 = D, 10 = Q. Without this gate an
        // FP pair falls into the general decode below and runs as a
        // 32-bit GP pair with a halved offset.
        let size = match opc {
            0b00 => MemSize::W,
            0b01 => MemSize::X,
            0b10 => MemSize::Q,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        let signed_imm = sign_extend(imm7, 7) as i16 * size.bytes() as i16;
        return Ok(Instruction::FpLdStPair {
            op,
            size,
            rt,
            rt2,
            rn,
            imm7: signed_imm,
            mode,
            no_allocate,
        });
    }

    // The integer no-allocate pair is out of scope; it must not fall
    // through as an ordinary LDP/STP.
    if no_allocate {
        return Err(EmuError::UnknownInstruction(instr));
    }

    let sf = opc == 0b10; // 10 = 64-bit, 00 = 32-bit

    // imm7 is signed, scaled by access size (4 for 32-bit, 8 for 64-bit)
    let scale = if sf { 8 } else { 4 };
    let signed_imm = sign_extend(imm7, 7) as i16 * scale;

    Ok(Instruction::LdStPair {
        op,
        sf,
        rt,
        rt2,
        rn,
        imm7: signed_imm,
        mode,
    })
}

/// The register-offset operand of a load/store: Rm in bits 20:16, the
/// extend `option` in 15:13 and the scale bit S in 12. The integer and
/// SIMD&FP paths share it because they share the rules.
///
/// The legal option fields are the ones the assembler can write, so the
/// set comes from the shared table. 0b011 is spelled both `lsl` and
/// `uxtx`; the table lists `lsl` first, so a 64-bit index decodes as Lsl
/// the way GAS disassembles it. S=1 means "scale the index by the access
/// size", so the shift is log2 of that width, read off the shared byte
/// count rather than re-spelled as a second size table.
fn decode_ldst_reg_offset(instr: u32, size: MemSize) -> Result<LdStOffset, EmuError> {
    let rm = bits(instr, 20, 16) as u8;
    let option = bits(instr, 15, 13);
    let s = bit(instr, 12) as u8;
    let extend = match LDST_EXTENDS
        .iter()
        .find(|(_, opt, _)| u32::from(*opt) == option)
        .map(|(keyword, _, _)| *keyword)
    {
        Some("uxtw") => ExtendType::Uxtw,
        Some("lsl") => ExtendType::Lsl,
        Some("sxtw") => ExtendType::Sxtw,
        Some("sxtx") => ExtendType::Sxtx,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };
    let shift_amount = if s == 1 {
        Some(size.bytes().trailing_zeros() as u8)
    } else {
        None
    };
    Ok(LdStOffset::Register { rm, extend, shift_amount })
}

/// SIMD&FP LDR/STR (V=1). The width is `opc<1>:size`, not `size` alone:
/// opc<1> set with size 00 is the 128-bit Q form, which the two-bit size
/// field cannot spell on its own. Addressing is the integer set: scaled
/// unsigned offset, the imm9 family (unscaled LDUR/STUR plus pre- and
/// post-index writeback), and the register offset.
fn decode_fp_ldst_single(instr: u32, size_field: u8) -> Result<Instruction, EmuError> {
    let opc_outer = bits(instr, 25, 24);
    let opc_inner = bits(instr, 23, 22);
    let rn = bits(instr, 9, 5) as u8;
    let ft = bits(instr, 4, 0) as u8;
    let load = opc_inner & 0b01 == 1;
    let size = if opc_inner & 0b10 == 0 {
        MemSize::from_size_field(size_field)
    } else if size_field == 0b00 {
        MemSize::Q
    } else {
        // opc<1> set with any other size is unallocated.
        return Err(EmuError::UnknownInstruction(instr));
    };

    match opc_outer {
        0b01 => {
            let imm12 = bits(instr, 21, 10);
            let offset = (imm12 as i64) * (size.bytes() as i64);
            Ok(Instruction::FpLdSt {
                load,
                ft,
                rn,
                offset: LdStOffset::Immediate(offset),
                size,
                mode: IndexMode::SignedOffset,
                unscaled: false,
            })
        }
        0b00 if bit(instr, 21) == 1 => {
            if bits(instr, 11, 10) != 0b10 {
                return Err(EmuError::UnknownInstruction(instr));
            }
            Ok(Instruction::FpLdSt {
                load,
                ft,
                rn,
                offset: decode_ldst_reg_offset(instr, size)?,
                size,
                mode: IndexMode::SignedOffset,
                unscaled: false,
            })
        }
        0b00 => {
            let offset = sign_extend(bits(instr, 20, 12), 9);
            let idx = bits(instr, 11, 10);
            let mode = match idx {
                0b00 => IndexMode::SignedOffset, // unscaled LDUR/STUR
                0b01 => IndexMode::PostIndex,
                0b11 => IndexMode::PreIndex,
                _ => return Err(EmuError::UnknownInstruction(instr)),
            };
            Ok(Instruction::FpLdSt {
                load,
                ft,
                rn,
                offset: LdStOffset::Immediate(offset),
                size,
                mode,
                unscaled: idx == 0b00,
            })
        }
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

fn decode_ldst_single(instr: u32) -> Result<Instruction, EmuError> {
    let size_field = bits(instr, 31, 30) as u8;

    let v = bit(instr, 26);
    if v == 1 {
        return decode_fp_ldst_single(instr, size_field);
    }
    let size = MemSize::from_size_field(size_field);

    let opc = bits(instr, 25, 24);
    let rn = bits(instr, 9, 5) as u8;
    let rt = bits(instr, 4, 0) as u8;

    // unsigned offset: xx11_1001 xxoo_oooo oooo_oonn nnnt_tttt
    if opc == 0b01 && bits(instr, 29, 28) == 0b11 {
        let imm12 = bits(instr, 21, 10);
        let scale = size.bytes();
        let offset = (imm12 as i64) * (scale as i64);
        // bits 23:22 distinguish STR/LDR/LDRS-X/LDRS-W.
        let inner_opc = bits(instr, 23, 22);
        match inner_opc {
            0b00 => {
                return Ok(Instruction::LdSt {
                    op: LdStOp::Str,
                    rt,
                    rn,
                    offset: LdStOffset::Immediate(offset),
                    size,
                    mode: IndexMode::SignedOffset,
                });
            }
            0b01 => {
                return Ok(Instruction::LdSt {
                    op: LdStOp::Ldr,
                    rt,
                    rn,
                    offset: LdStOffset::Immediate(offset),
                    size,
                    mode: IndexMode::SignedOffset,
                });
            }
            0b10 | 0b11 => {
                // LDRSB / LDRSH (size B or H) or LDRSW (size W).
                // size=X is reserved for the sign-extending forms.
                if matches!(size, MemSize::X) {
                    return Err(EmuError::UnknownInstruction(instr));
                }
                let sf = inner_opc == 0b10; // 10 = Xt, 11 = Wt
                return Ok(Instruction::LdrSignExtended {
                    rt,
                    rn,
                    offset: LdStOffset::Immediate(offset),
                    size,
                    mode: IndexMode::SignedOffset,
                    sf,
                });
            }
            _ => unreachable!(),
        }
    }

    // pre/post-index and register offset: xx11_1000 xx0o_oooo oooo_MMnn nnnt_tttt
    if bits(instr, 29, 28) == 0b11 && bit(instr, 24) == 0 {
        let opc = bits(instr, 23, 22);
        let idx_type = bits(instr, 11, 10);

        if idx_type == 0b10 {
            let offset = decode_ldst_reg_offset(instr, size)?;

            // opc 00/01 are STR/LDR; 10/11 are the sign-extending loads
            // (LDRSB/LDRSH/LDRSW with an Xt or Wt target). Keying only on
            // bit 22 misread LDRSB-register as a plain STR/LDR.
            return match opc {
                0b00 | 0b01 => Ok(Instruction::LdSt {
                    op: if opc == 0b01 { LdStOp::Ldr } else { LdStOp::Str },
                    rt,
                    rn,
                    offset,
                    size,
                    mode: IndexMode::SignedOffset,
                }),
                _ => {
                    // size=X is reserved for the sign-extending forms
                    // (prefetch space); LDRSW is size=W with an Xt target.
                    if matches!(size, MemSize::X) {
                        return Err(EmuError::UnknownInstruction(instr));
                    }
                    Ok(Instruction::LdrSignExtended {
                        rt,
                        rn,
                        offset,
                        size,
                        mode: IndexMode::SignedOffset,
                        sf: opc == 0b10,
                    })
                }
            };
        }

        // The sign-extending imm9 forms: LDURS* (idx 00) and LDRS* with
        // pre/post writeback. They must be taken here, before the LdStOp
        // selection below, or they misdecode as a plain LDR/STR of the
        // wrong direction and width.
        if opc >= 0b10 {
            // size=X is reserved in this space (it is the prefetch
            // encoding), the same rule the register-offset arm applies.
            if matches!(size, MemSize::X) {
                return Err(EmuError::UnknownInstruction(instr));
            }
            let mode = match idx_type {
                0b00 => IndexMode::SignedOffset,
                0b01 => IndexMode::PostIndex,
                0b11 => IndexMode::PreIndex,
                _ => return Err(EmuError::UnknownInstruction(instr)),
            };
            return Ok(Instruction::LdrSignExtended {
                rt,
                rn,
                offset: LdStOffset::Immediate(sign_extend(bits(instr, 20, 12), 9)),
                size,
                mode,
                sf: opc == 0b10, // 10 = Xt, 11 = Wt
            });
        }
        let op = if opc == 0b01 { LdStOp::Ldr } else { LdStOp::Str };

        // 9-bit signed immediate family: unscaled offset (the LDUR/STUR
        // encodings GAS emits for negative or unaligned LDR/STR offsets),
        // pre-index, and post-index.
        let imm9 = bits(instr, 20, 12);
        let offset = sign_extend(imm9, 9);

        let mode = match idx_type {
            0b00 => IndexMode::SignedOffset,
            0b01 => IndexMode::PostIndex,
            0b11 => IndexMode::PreIndex,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };

        return Ok(Instruction::LdSt {
            op,
            rt,
            rn,
            offset: LdStOffset::Immediate(offset),
            size,
            mode,
        });
    }

    Err(EmuError::UnknownInstruction(instr))
}

// ---------------------------------------------------------------------------
// data processing: register group
// ---------------------------------------------------------------------------

fn decode_dp_reg_group(instr: u32) -> Result<Instruction, EmuError> {
    // sub-routing based on bits [28] and [24]:
    //   bit28=0, bit24=0 -> logical shifted register (01010)
    //   bit28=0, bit24=1 -> add/sub shifted register (01011)
    //   bit28=1, bit24=0 -> dp2 or conditional select (11010)
    //   bit28=1, bit24=1 -> dp3 / MADD / MUL (11011)
    let b28 = bit(instr, 28);
    let b24 = bit(instr, 24);

    match (b28, b24) {
        (0, 0) => decode_logical_reg(instr),
        (0, 1) => decode_add_sub_reg(instr),
        (1, 1) => decode_dp3(instr),
        (1, 0) => {
            // add/sub with carry vs conditional compare vs conditional
            // select vs dp2, by bits [23:21]
            // add/sub (with carry): bits[23:21] = 000, bits[15:10] = 000000
            // conditional compare:  bits[23:21] = 010
            // conditional select:   bits[23:21] = 100
            // dp2:                  bits[23:21] = 110
            let sub = bits(instr, 23, 21);
            if sub == 0b000 && bits(instr, 15, 10) == 0 {
                decode_add_sub_carry(instr)
            } else if sub == 0b010 {
                decode_cond_compare(instr)
            } else if sub == 0b100 {
                decode_cond_select(instr)
            } else {
                decode_dp2(instr)
            }
        }
        _ => unreachable!(),
    }
}

fn decode_add_sub_reg(instr: u32) -> Result<Instruction, EmuError> {
    // Bit 21 splits the register family: 0 is the shifted form (register
    // 31 reads as XZR), 1 is the extended form (register 31 is SP). The
    // two must not be conflated: executing `add x0, sp, x1` as shifted
    // silently computes with 0.
    if bit(instr, 21) == 1 {
        return decode_add_sub_ext(instr);
    }
    let sf = bit(instr, 31) == 1;
    let op_bit = bit(instr, 30);
    let s = bit(instr, 29);
    let shift = ShiftType::from_u8(bits(instr, 23, 22) as u8);
    let rm = bits(instr, 20, 16) as u8;
    let imm6 = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op_bit, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpReg {
        op: dp_op,
        sf,
        rd,
        rn,
        rm,
        shift,
        amount: imm6,
    })
}

/// ADC/ADCS/SBC/SBCS: sf_op_S_11010000_Rm_000000_Rn_Rd. Bit 30 picks
/// add vs subtract, bit 29 the flag-setting form. The caller has already
/// checked bits [23:21] and the fixed-zero [15:10] field, so every word
/// reaching here is one of the four.
fn decode_add_sub_carry(instr: u32) -> Result<Instruction, EmuError> {
    Ok(Instruction::DpCarry {
        sub: bit(instr, 30) == 1,
        set_flags: bit(instr, 29) == 1,
        sf: bit(instr, 31) == 1,
        rd: bits(instr, 4, 0) as u8,
        rn: bits(instr, 9, 5) as u8,
        rm: bits(instr, 20, 16) as u8,
    })
}

fn decode_add_sub_ext(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op_bit = bit(instr, 30);
    let s = bit(instr, 29);
    // The opt field (23:22) is reserved-zero in this form, and the
    // post-extend shift caps at 4; anything else is not an instruction.
    if bits(instr, 23, 22) != 0 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let rm = bits(instr, 20, 16) as u8;
    let option = bits(instr, 15, 13) as u8;
    let shift = bits(instr, 12, 10) as u8;
    if shift > 4 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op_bit, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpRegExt {
        op: dp_op,
        sf,
        rd,
        rn,
        rm,
        extend: RegExtend::from_option(option),
        shift,
    })
}

fn decode_logical_reg(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 21) == 1; // N bit: inverts rm
    let shift = ShiftType::from_u8(bits(instr, 23, 22) as u8);
    let rm = bits(instr, 20, 16) as u8;
    let imm6 = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let (op, set_flags, invert) = match (opc, n) {
        (0b00, false) => (LogOp::And, false, false),
        (0b00, true) => (LogOp::And, false, true),   // BIC
        (0b01, false) => (LogOp::Orr, false, false),
        (0b01, true) => (LogOp::Orr, false, true),   // ORN/MVN
        (0b10, false) => (LogOp::Eor, false, false),
        (0b10, true) => (LogOp::Eor, false, true),   // EON
        (0b11, false) => (LogOp::And, true, false),   // ANDS
        (0b11, true) => (LogOp::And, true, true),     // BICS
        _ => unreachable!(),
    };

    Ok(Instruction::LogReg {
        op,
        sf,
        rd,
        rn,
        rm,
        shift,
        amount: imm6,
        set_flags,
        invert,
    })
}

/// CCMP / CCMN: sf op S=1 11010010 imm5|Rm cond(4) imm o2=0 Rn o3=0 nzcv.
/// Bit 11 picks the immediate form; bits 10 and 4 are reserved zero.
fn decode_cond_compare(instr: u32) -> Result<Instruction, EmuError> {
    if bit(instr, 29) != 1 || bit(instr, 10) != 0 || bit(instr, 4) != 0 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let field = bits(instr, 20, 16) as u8;
    Ok(Instruction::CondCompare {
        sub: bit(instr, 30) == 1,
        sf: bit(instr, 31) == 1,
        rn: bits(instr, 9, 5) as u8,
        operand: if bit(instr, 11) == 1 {
            CondCmpOperand::Imm(field)
        } else {
            CondCmpOperand::Reg(field)
        },
        cond: Condition::from_u8(bits(instr, 15, 12) as u8)?,
        nzcv: bits(instr, 3, 0) as u8,
    })
}

fn decode_cond_select(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    // Bit 30 is the op field (0 = CSEL/CSINC, 1 = CSINV/CSNEG); bit 10
    // picks within each pair. gcc reaches CSNEG for abs()-shaped code
    // even at -O0.
    let op_bit = bit(instr, 30);
    let op2 = bit(instr, 10);
    let rm = bits(instr, 20, 16) as u8;
    let cond_bits = bits(instr, 15, 12) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let cond = Condition::from_u8(cond_bits)?;

    let op = match (op_bit, op2) {
        (0, 0) => CondSelOp::Csel,
        (0, 1) => CondSelOp::Csinc,
        (1, 0) => CondSelOp::Csinv,
        (1, 1) => CondSelOp::Csneg,
        _ => unreachable!(),
    };

    Ok(Instruction::CondSel {
        op,
        sf,
        rd,
        rn,
        rm,
        cond,
    })
}

fn decode_dp2(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    // Bit 30 set marks the 1-source data-processing group, which shares
    // this decode entry. Its rows come from the shared table, keyed on
    // (opcode, sf) because rev at W width and rev32 at X width collide on
    // opcode 000010. Without this branch a `.word`-crafted rev32 falls
    // through to the 2-source table and runs as udiv.
    if bit(instr, 30) != 0 {
        if bit(instr, 29) != 0 || bits(instr, 20, 16) != 0 {
            return Err(EmuError::UnknownInstruction(instr));
        }
        let opcode = bits(instr, 15, 10) as u8;
        let Some((_, _, _, op)) = DP1_OPS
            .iter()
            .find(|(_, code, needs_sf, _)| *code == opcode && needs_sf.is_none_or(|want| want == sf))
        else {
            return Err(EmuError::UnknownInstruction(instr));
        };
        return Ok(Instruction::DataProc1 {
            op: *op,
            sf,
            rd: bits(instr, 4, 0) as u8,
            rn: bits(instr, 9, 5) as u8,
        });
    }
    let s = bit(instr, 29);
    let opcode = bits(instr, 15, 10);
    let rm = bits(instr, 20, 16) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    if s != 0 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    // LSLV/LSRV/ASRV/RORV share the dp2 space: shift Rn by Rm modulo the
    // register width. The assembler emits these for `lsl x0, x1, x2`, so
    // decode must read them back or the register-form shifts die mid-run.
    if (opcode & !0b11) == 0b001000 {
        return Ok(Instruction::VarShift {
            sf,
            rd,
            rn,
            rm,
            shift: ShiftType::from_u8((opcode & 0b11) as u8),
        });
    }

    let op = match opcode {
        0b000010 => MulDivOp::Udiv,
        0b000011 => MulDivOp::Sdiv,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };

    Ok(Instruction::MulDiv {
        op,
        sf,
        rd,
        rn,
        rm,
    })
}

fn decode_dp3(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op31 = bits(instr, 23, 21);
    let o0 = bit(instr, 15);
    let rm = bits(instr, 20, 16) as u8;
    let ra = bits(instr, 14, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    // MADD / MSUB share op31=000; o0 selects between them.
    if op31 == 0b000 {
        // Keep MUL (MADD with Ra=XZR and o0=0) on the existing MulDiv::Mul
        // path so older tests and the legacy assembler still match it.
        if ra == 31 && o0 == 0 {
            return Ok(Instruction::MulDiv {
                op: MulDivOp::Mul,
                sf,
                rd,
                rn,
                rm,
            });
        }
        let op = if o0 == 0 {
            MulAccumulateOp::Madd
        } else {
            MulAccumulateOp::Msub
        };
        return Ok(Instruction::MulAccumulate {
            op,
            sf,
            rd,
            rn,
            rm,
            ra,
        });
    }

    // SMULL/UMULL are SMADDL/UMADDL with Ra=XZR and stay on their own
    // rows so the disassembly reads the way GAS writes it. SMULH/UMULH
    // keep the `ra == 31` requirement because their Ra field is
    // architecturally fixed; the widening rows do not, since Ra is the
    // accumulator there.
    if sf {
        let op = match (op31, o0, ra == 31) {
            (0b001, 0, true) => Some(MulWideOp::Smull),
            (0b101, 0, true) => Some(MulWideOp::Umull),
            (0b010, 0, true) => Some(MulWideOp::Smulh),
            (0b110, 0, true) => Some(MulWideOp::Umulh),
            (0b001, 0, false) => Some(MulWideOp::Smaddl),
            (0b001, 1, _) => Some(MulWideOp::Smsubl),
            (0b101, 0, false) => Some(MulWideOp::Umaddl),
            (0b101, 1, _) => Some(MulWideOp::Umsubl),
            _ => None,
        };
        if let Some(op) = op {
            return Ok(Instruction::MulWide { op, rd, rn, rm, ra });
        }
    }

    Err(EmuError::UnknownInstruction(instr))
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
        // wait: NOT(0b001111) = 0b110000, highest bit = 5 -> len=5 -> esize=32
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
