//! The Advanced SIMD integer classes: operand shapes, lane-width masks,
//! the operation tables the encoder, decoder, `format` and executor all
//! read, the copy group, and `decode_advanced_simd` for every vector form.

use super::*;

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
pub(super) const LANE_S: LaneMask = 0b0100;
pub(super) const LANE_D: LaneMask = 0b1000;
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

/// The Advanced SIMD forms this crate assembles, all of which land in the
/// same top-level group as scalar FP. `None` means "not one of these",
/// and `decode_fp_group` (fp.rs), which called this first, carries on.
pub(super) fn decode_advanced_simd(instr: u32) -> Option<Instruction> {
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
    // answering None leaves it to the scalar FP decode in fp.rs and,
    // failing that, to the unknown-instruction error.
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
