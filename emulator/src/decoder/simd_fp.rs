//! The Advanced SIMD floating-point classes: the three-same, two-register
//! misc, across-lanes and by-element tables, and the half-precision
//! conversions FCVTN and FCVTL use.

use super::*;

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
