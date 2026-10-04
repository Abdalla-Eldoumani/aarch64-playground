//! The floating-point lane engine: the per-lane NaN, rounding and
//! saturation rules the vector and scalar forms share, and the vector
//! floating-point instructions.

use super::*;

// ---------------------------------------------------------------------------
// the floating-point lane engine
// ---------------------------------------------------------------------------
//
// The scalar forms in fp.rs run these same per-lane helpers, so a vector
// and a scalar instruction cannot disagree about a NaN, a rounding mode or
// a saturation rail. With FPCR.DN clear, a NaN that arrives in a lane
// leaves it quieted with its payload (`fp_process_nans`), and only a NaN
// the operation makes becomes the default NaN (`default_nan_bits_if_new`).

/// ARM's FPProcessNaNs over as many operands as the form has. `None`
/// means no operand was a NaN and the arithmetic runs.
pub(super) fn fp_process_nans<T: FpOperand>(sources: &[T]) -> Option<T> {
    sources
        .iter()
        .find(|s| s.is_signalling())
        .or_else(|| sources.iter().find(|s| s.is_nan()))
        .map(|s| s.quieted())
}

/// FMULX: the product, except that an infinity against a zero answers
/// exactly 2.0 with the sign of the product, where FMUL answers with the
/// invalid-operation NaN.
fn fp_mulx<T: FpOperand>(a: T, b: T) -> u64 {
    if let Some(nan) = fp_process_nans(&[a, b]) {
        return nan.to_bits();
    }
    if (a.is_infinite() && b == T::ZERO) || (a == T::ZERO && b.is_infinite()) {
        let negative = a.is_sign_negative() != b.is_sign_negative();
        return if negative { (-T::TWO).to_bits() } else { T::TWO.to_bits() };
    }
    default_nan_bits_if_new(a * b, &[a, b])
}

/// FRECPS, the Newton-Raphson step for a reciprocal: 2.0 - a*b with one
/// rounding over the whole expression, and an exact 2.0 where an
/// infinity meets a zero.
fn fp_recps<T: FpOperand>(a: T, b: T) -> u64 {
    // The pseudocode negates the first operand BEFORE it looks for a NaN
    // to propagate, so the answer carries the flipped sign.
    if let Some(nan) = fp_process_nans(&[-a, b]) {
        return nan.to_bits();
    }
    if (a.is_infinite() && b == T::ZERO) || (a == T::ZERO && b.is_infinite()) {
        return T::TWO.to_bits();
    }
    default_nan_bits_if_new((-a).mul_add(b, T::TWO), &[a, b])
}

/// FRSQRTS, the step for a reciprocal square root: (3.0 - a*b) / 2. The
/// halving is exact, so the fused multiply-add is still the only
/// rounding; an infinity against a zero answers 1.5.
fn fp_rsqrts<T: FpOperand>(a: T, b: T) -> u64 {
    if let Some(nan) = fp_process_nans(&[-a, b]) {
        return nan.to_bits();
    }
    if (a.is_infinite() && b == T::ZERO) || (a == T::ZERO && b.is_infinite()) {
        return T::ONE_POINT_FIVE.to_bits();
    }
    default_nan_bits_if_new((-a).mul_add(b, T::THREE) / T::TWO, &[a, b])
}

/// One lane of a floating-point three-same operation, answered as the
/// lane's bits so the compares can write all ones.
fn simd_fp_same_lane<T: FpOperand>(op: SimdFpSameOp, a: T, b: T, d: T) -> u64 {
    let mask = lane_mask(T::BYTES);
    let flag = |yes: bool| if yes { mask } else { 0 };
    let value = match op {
        // A NaN makes every compare false, and none of them propagates.
        SimdFpSameOp::Fcmeq => return flag(a == b),
        SimdFpSameOp::Fcmge => return flag(a >= b),
        SimdFpSameOp::Fcmgt => return flag(a > b),
        SimdFpSameOp::Facge => return flag(a.abs() >= b.abs()),
        SimdFpSameOp::Facgt => return flag(a.abs() > b.abs()),
        SimdFpSameOp::Fadd | SimdFpSameOp::Faddp => fp_arith(a + b, &[a, b]),
        SimdFpSameOp::Fsub => fp_arith(a - b, &[a, b]),
        SimdFpSameOp::Fmul => fp_arith(a * b, &[a, b]),
        SimdFpSameOp::Fdiv => fp_arith(a / b, &[a, b]),
        // FMLA and FMLS are FUSED: one rounding over the product and the
        // sum together. FMLS negates the first product operand, never the
        // result, and the destination lane is the addend and the FIRST
        // operand the NaN rule looks at.
        SimdFpSameOp::Fmla => fp_fused(a, b, d),
        SimdFpSameOp::Fmls => fp_fused(-a, b, d),
        SimdFpSameOp::Fmulx => fp_mulx(a, b),
        SimdFpSameOp::Fmax | SimdFpSameOp::Fmaxp => fp_max(a, b).to_bits(),
        SimdFpSameOp::Fmin | SimdFpSameOp::Fminp => fp_min(a, b).to_bits(),
        SimdFpSameOp::Fmaxnm | SimdFpSameOp::Fmaxnmp => fp_max_num(a, b).to_bits(),
        SimdFpSameOp::Fminnm | SimdFpSameOp::Fminnmp => fp_min_num(a, b).to_bits(),
        // FABD is FPAbs(FPSub(a, b)), and FPAbs is a bit clear: it
        // strips the sign off a propagated NaN too.
        SimdFpSameOp::Fabd => fp_arith(a - b, &[a, b]) & !fp_sign_bit(T::BYTES),
        SimdFpSameOp::Frecps => fp_recps(a, b),
        SimdFpSameOp::Frsqrts => fp_rsqrts(a, b),
    };
    value & mask
}

/// The two NaN rules applied in order, answered as the lane's bits: an
/// operand NaN comes back quieted, and failing that a NaN this operation
/// made becomes the default one.
pub(super) fn fp_arith<T: FpOperand>(result: T, sources: &[T]) -> u64 {
    match fp_process_nans(sources) {
        Some(nan) => nan.to_bits(),
        None => default_nan_bits_if_new(result, sources),
    }
}

/// The flags FCMP sets for Fn against Fm, or against +0.0 when `fm` is
/// None. Widening f32 to f64 is exact, so the single compare shares the
/// double flag logic (NaN stays NaN, order holds).
pub(super) fn fp_compare_flags(regs: &RegisterFile, fn_: u8, fm: Option<u8>, single: bool) -> NzcvFlags {
    let read = |r: u8| if single { f64::from(regs.read_fpr_f32(r)) } else { regs.read_fpr_f64(r) };
    crate::fpu::fcmp_flags(read(fn_), fm.map_or(0.0, read))
}

/// n * m + a with one rounding, and FPMulAdd's NaN rules: the addend is
/// the first operand they look at, and a quiet NaN addend still gives the
/// default NaN when the product is infinity times zero.
pub(super) fn fp_fused<T: FpOperand>(n: T, m: T, a: T) -> u64 {
    let inf_times_zero =
        (n.is_infinite() && m == T::ZERO) || (n == T::ZERO && m.is_infinite());
    if a.is_nan() && !a.is_signalling() && inf_times_zero {
        return T::DEFAULT_NAN_BITS;
    }
    fp_arith(n.mul_add(m, a), &[a, n, m])
}

/// The sign bit of a lane of `bytes`, which FABS clears and FNEG flips.
fn fp_sign_bit(bytes: u8) -> u64 {
    1u64 << (u32::from(bytes) * 8 - 1)
}

/// The three-same lane function at the width the encoding names.
fn fp_same_lane(op: SimdFpSameOp, esize: u8, a: u64, b: u64, d: u64) -> u64 {
    if esize == 4 {
        simd_fp_same_lane::<f32>(op, f32::from_lane(a), f32::from_lane(b), f32::from_lane(d))
    } else {
        simd_fp_same_lane::<f64>(op, f64::from_lane(a), f64::from_lane(b), f64::from_lane(d))
    }
}

/// FPRecipEstimate: the leading bits of a reciprocal, taken from the same
/// integer table URECPE reads, with the exponent reflected around the
/// format's bias. Written over the raw bits so one body serves both
/// widths, exactly as the pseudocode does.
fn fp_recip_estimate_bits(bits: u64, esize: u8) -> u64 {
    let (frac_bits, exp_bits) = fp_layout(esize);
    let bias = (1i32 << (exp_bits - 1)) - 1;
    let sign = bits & (1u64 << (frac_bits + exp_bits));
    let exp_field = ((bits >> frac_bits) & ((1u64 << exp_bits) - 1)) as i32;
    let frac_field = bits & ((1u64 << frac_bits) - 1);
    if exp_field == (1 << exp_bits) - 1 {
        // Infinity answers a zero of the same sign; a NaN never reaches
        // here, the caller has already processed it.
        return sign;
    }
    if exp_field == 0 && frac_field == 0 {
        return sign | fp_infinity_bits(esize);
    }
    // Anything below 2^-(bias+1) has no representable reciprocal at all,
    // and round-to-nearest turns that overflow into an infinity. In bits
    // that is a subnormal with both its top fraction bits clear.
    if exp_field == 0 && frac_field < (1u64 << (frac_bits - 2)) {
        return sign | fp_infinity_bits(esize);
    }
    let mut exp = exp_field;
    let mut fraction = frac_field << (52 - frac_bits);
    if exp == 0 {
        // A subnormal renormalizes by hand: shift the leading one up to
        // the implied place and pay for the shift out of the exponent.
        if fraction >> 51 == 0 {
            exp = -1;
            fraction = (fraction << 2) & ((1u64 << 52) - 1);
        } else {
            fraction = (fraction << 1) & ((1u64 << 52) - 1);
        }
    }
    let scaled = 0x100u32 | ((fraction >> 44) & 0xff) as u32;
    let mut result_exp = (2 * bias - 1) - exp;
    let estimate = recip_estimate(scaled);
    let mut fraction = u64::from(estimate & 0xff) << 44;
    if result_exp == 0 {
        fraction = (1u64 << 51) | (fraction >> 1);
    } else if result_exp == -1 {
        fraction = (1u64 << 50) | (fraction >> 2);
        result_exp = 0;
    }
    let exp_mask = (1u64 << exp_bits) - 1;
    sign | (((result_exp as u64) & exp_mask) << frac_bits) | (fraction >> (52 - frac_bits))
}

/// FPRSqrtEstimate, the same shape over the reciprocal-square-root table.
/// A negative operand has no answer at all, which is the one estimate
/// that reaches the default NaN.
fn fp_rsqrt_estimate_bits(bits: u64, esize: u8) -> u64 {
    let (frac_bits, exp_bits) = fp_layout(esize);
    let bias = (1i32 << (exp_bits - 1)) - 1;
    let sign = bits & (1u64 << (frac_bits + exp_bits));
    let exp_field = ((bits >> frac_bits) & ((1u64 << exp_bits) - 1)) as i32;
    let frac_field = bits & ((1u64 << frac_bits) - 1);
    if exp_field == 0 && frac_field == 0 {
        return sign | fp_infinity_bits(esize);
    }
    if sign != 0 {
        return fp_default_nan_bits(esize);
    }
    if exp_field == (1 << exp_bits) - 1 {
        return 0;
    }
    let mut exp = exp_field;
    let mut fraction = frac_field << (52 - frac_bits);
    if exp == 0 {
        while fraction >> 51 == 0 {
            fraction = (fraction << 1) & ((1u64 << 52) - 1);
            exp -= 1;
        }
        fraction = (fraction << 1) & ((1u64 << 52) - 1);
    }
    let scaled = if exp & 1 == 0 {
        0x100u32 | ((fraction >> 44) & 0xff) as u32
    } else {
        0x80u32 | ((fraction >> 45) & 0x7f) as u32
    };
    let result_exp = (3 * bias - 1 - exp).div_euclid(2);
    let estimate = recip_sqrt_estimate(scaled);
    let exp_mask = (1u64 << exp_bits) - 1;
    let fraction = u64::from(estimate & 0xff) << 44;
    (((result_exp as u64) & exp_mask) << frac_bits) | (fraction >> (52 - frac_bits))
}

/// FRECPX: the sign and a mantissa of zeros over the exponent's
/// complement, which is the exact power of two a reciprocal would land
/// on. A zero or subnormal answers the largest exponent instead.
fn fp_recpx_bits(bits: u64, esize: u8) -> u64 {
    let (frac_bits, exp_bits) = fp_layout(esize);
    let exp_mask = (1u64 << exp_bits) - 1;
    let sign = bits & (1u64 << (frac_bits + exp_bits));
    let exp = (bits >> frac_bits) & exp_mask;
    // A zero or a denormal answers the largest exponent short of the
    // one infinities and NaNs claim, which is what the pseudocode's
    // `max_exp = Ones() - 1` says.
    let out = if exp == 0 { exp_mask - 1 } else { !exp & exp_mask };
    sign | (out << frac_bits)
}

/// (fraction bits, exponent bits) of a lane width.
fn fp_layout(esize: u8) -> (u32, u32) {
    if esize == 4 {
        (23, 8)
    } else {
        (52, 11)
    }
}

fn fp_infinity_bits(esize: u8) -> u64 {
    if esize == 4 { 0x7F80_0000 } else { 0x7FF0_0000_0000_0000 }
}

fn fp_default_nan_bits(esize: u8) -> u64 {
    if esize == 4 { f32::DEFAULT_NAN_BITS } else { f64::DEFAULT_NAN_BITS }
}

/// One lane of a floating-point two-register misc operation that keeps
/// its width: the unary arithmetic, the roundings and the compares
/// against zero. The conversions are not lane-to-lane in one format and
/// go through their own helpers.
fn simd_fp_misc_lane<T: FpOperand>(op: SimdFpMiscOp, a: T) -> u64 {
    let mask = lane_mask(T::BYTES);
    let flag = |yes: bool| if yes { mask } else { 0 };
    match op {
        SimdFpMiscOp::Fcmgt0 => return flag(a > T::ZERO),
        SimdFpMiscOp::Fcmge0 => return flag(a >= T::ZERO),
        SimdFpMiscOp::Fcmeq0 => return flag(a == T::ZERO),
        SimdFpMiscOp::Fcmle0 => return flag(a <= T::ZERO),
        SimdFpMiscOp::Fcmlt0 => return flag(a < T::ZERO),
        // FABS and FNEG are bit operations and touch a NaN the same way
        // they touch a number: the sign bit, and nothing else.
        SimdFpMiscOp::Fabs => return a.abs().to_bits() & mask,
        SimdFpMiscOp::Fneg => return (-a).to_bits() & mask,
        _ => {}
    }
    if let Some(nan) = fp_process_nans(&[a]) {
        return nan.to_bits() & mask;
    }
    let value = match op {
        SimdFpMiscOp::Fsqrt => default_nan_bits_if_new(a.sqrt(), &[a]),
        SimdFpMiscOp::Frecpe => fp_recip_estimate_bits(a.to_bits(), T::BYTES),
        SimdFpMiscOp::Frsqrte => fp_rsqrt_estimate_bits(a.to_bits(), T::BYTES),
        SimdFpMiscOp::Frecpx => fp_recpx_bits(a.to_bits(), T::BYTES),
        // The rounding modes the mnemonics name; FRINTI and FRINTX both
        // follow FPCR.RMode, which is round-to-nearest-even here.
        SimdFpMiscOp::Frintn | SimdFpMiscOp::Frinti | SimdFpMiscOp::Frintx => {
            a.round_ties_even().to_bits()
        }
        SimdFpMiscOp::Frinta => a.round().to_bits(),
        SimdFpMiscOp::Frintm => a.floor().to_bits(),
        SimdFpMiscOp::Frintp => a.ceil().to_bits(),
        SimdFpMiscOp::Frintz => a.trunc().to_bits(),
        _ => unreachable!("the conversions have their own helpers"),
    };
    value & mask
}

/// The two-misc lane function at the width the encoding names.
fn fp_misc_lane(op: SimdFpMiscOp, esize: u8, a: u64) -> u64 {
    if esize == 4 {
        simd_fp_misc_lane::<f32>(op, f32::from_lane(a))
    } else {
        simd_fp_misc_lane::<f64>(op, f64::from_lane(a))
    }
}

/// SCVTF / UCVTF over one lane: the integer is exact in f64 at either
/// width, and dividing by a power of two is exact, so the single
/// rounding is the one the destination format makes.
fn fp_from_int_lane(signed: bool, esize: u8, bits: u64, fbits: u8) -> u64 {
    let value = if esize == 4 {
        if signed { f64::from(bits as u32 as i32) } else { f64::from(bits as u32) }
    } else if signed {
        bits as i64 as f64
    } else {
        bits as f64
    };
    let scaled = if fbits == 0 { value } else { value / 2f64.powi(i32::from(fbits)) };
    if esize == 4 {
        u64::from((scaled as f32).to_bits())
    } else {
        scaled.to_bits()
    }
}

/// FCVT{N,A,M,P,Z}{S,U} over one lane, saturating at the LANE's rails.
fn fp_to_int_lane(op: FpToIntOp, esize: u8, bits: u64, fbits: u8) -> u64 {
    let value = if esize == 4 { f64::from(f32::from_bits(bits as u32)) } else { f64::from_bits(bits) };
    fp_to_int(op, value, fbits, esize == 8)
}

/// FCVTN's and FCVTL's lane conversions, and FCVTXN's round-to-odd
/// narrowing beside them. `wide` is the wider of the two lane widths.
pub(super) fn fp_narrow_lane(odd: bool, wide: u8, bits: u64) -> u64 {
    if wide == 4 {
        return u64::from(f32_to_f16(f32::from_bits(bits as u32)));
    }
    let value = f64::from_bits(bits);
    if value.is_nan() {
        // FPConvertNaN moves the payload down and sets the quiet bit.
        let sign = ((bits >> 32) & 0x8000_0000) as u32;
        return u64::from(sign | 0x7FC0_0000 | ((bits >> 29) as u32 & 0x3F_FFFF));
    }
    if odd {
        return u64::from(f64_to_f32_round_odd(value).to_bits());
    }
    u64::from((value as f32).to_bits())
}

pub(super) fn fp_widen_lane(wide: u8, bits: u64) -> u64 {
    if wide == 4 {
        return u64::from(f16_to_f32(bits as u16).to_bits());
    }
    let narrow = bits as u32;
    if f32::from_bits(narrow).is_nan() {
        let sign = u64::from(narrow & 0x8000_0000) << 32;
        return sign | 0x7FF8_0000_0000_0000 | (u64::from(narrow & 0x3F_FFFF) << 29);
    }
    f64::from(f32::from_bits(narrow)).to_bits()
}

/// FCVTXN's rounding: toward zero, except that an inexact result takes
/// the neighbour with an ODD significand, so a later widening can tell
/// the two halves of a tie apart. Rust rounds to nearest even, so the
/// answer is that neighbour when the nearest one is even and inexact.
fn f64_to_f32_round_odd(value: f64) -> f32 {
    let nearest = value as f32;
    if f64::from(nearest) == value || nearest.to_bits() & 1 == 1 {
        return nearest;
    }
    // The exact value sits strictly between `nearest` and one of its
    // neighbours, and both neighbours have an odd significand.
    let key = fp_order_key(nearest);
    let moved = if f64::from(nearest) < value { key + 1 } else { key - 1 };
    fp_from_order_key(moved)
}

/// A total order over f32 bit patterns, so stepping one representable
/// value works across zero and across the sign.
fn fp_order_key(value: f32) -> u32 {
    let bits = value.to_bits();
    if bits >> 31 == 1 { !bits } else { bits | 0x8000_0000 }
}

fn fp_from_order_key(key: u32) -> f32 {
    f32::from_bits(if key & 0x8000_0000 != 0 { key & 0x7FFF_FFFF } else { !key })
}

#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_fp_three_same(
    op: SimdFpSameOp,
    esize: u8,
    q: bool,
    scalar: bool,
    rm: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let bytes = if scalar { esize } else if q { 16 } else { 8 };
    let n = read_lanes(regs.read_fpr_q(rn), esize, bytes);
    let m = read_lanes(regs.read_fpr_q(rm), esize, bytes);
    let d = read_lanes(regs.read_fpr_q(rd), esize, bytes);
    let out: Vec<u64> = if simd_fp_same_row(op).pairwise {
        // Vn's lanes then Vm's, folded two at a time, so the low half of
        // the destination comes from Vn and the high half from Vm.
        let concat: Vec<u64> = n.iter().chain(m.iter()).copied().collect();
        (0..concat.len() / 2)
            .map(|i| fp_same_lane(op, esize, concat[i * 2], concat[i * 2 + 1], 0))
            .collect()
    } else {
        (0..n.len()).map(|i| fp_same_lane(op, esize, n[i], m[i], d[i])).collect()
    };
    regs.write_fpr_q(rd, pack_lanes(&out, esize));
}

#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_fp_two_misc(
    op: SimdFpMiscOp,
    esize: u8,
    q: bool,
    scalar: bool,
    fbits: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let row = simd_fp_misc_row(op);
    let source = regs.read_fpr_q(rn);
    match row.shape {
        // FCVTN and FCVTXN write lanes of half the width they read, into
        // the half of the destination Q names; FCVTL reads that half.
        SimdFpMiscShape::Narrow => {
            let odd = op == SimdFpMiscOp::Fcvtxn;
            if scalar {
                let value = fp_narrow_lane(odd, esize, read_lanes(source, esize, esize)[0]);
                regs.write_fpr_scalar(rd, esize / 2, value);
                return;
            }
            let lanes = read_lanes(source, esize, 16);
            let out: Vec<u64> =
                lanes.iter().map(|bits| fp_narrow_lane(odd, esize, *bits)).collect();
            write_half(regs, rd, q, pack_lanes(&out, esize / 2));
        }
        SimdFpMiscShape::Long => {
            let lanes = read_half_lanes(source, esize / 2, q);
            let out: Vec<u64> = lanes.iter().map(|bits| fp_widen_lane(esize, *bits)).collect();
            regs.write_fpr_q(rd, pack_lanes(&out, esize));
        }
        _ => {
            let bytes = if scalar { esize } else if q { 16 } else { 8 };
            let lanes = read_lanes(source, esize, bytes);
            let out: Vec<u64> = lanes
                .iter()
                .map(|bits| match simd_fp_cvt_role(op) {
                    Some(FpCvtRole::ToInt(to_int)) => fp_to_int_lane(to_int, esize, *bits, fbits),
                    Some(FpCvtRole::FromInt(from_int)) => {
                        fp_from_int_lane(from_int == FpFromIntOp::Scvtf, esize, *bits, fbits)
                    }
                    None => fp_misc_lane(op, esize, *bits),
                })
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, esize));
        }
    }
}

pub(super) fn exec_simd_fp_across(
    op: SimdFpAcrossOp,
    esize: u8,
    q: bool,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let row = simd_fp_across_row(op);
    // The scalar pairwise class always reads exactly two lanes; the
    // vector fold reads the whole 128-bit arrangement.
    let bytes = if row.scalar_class { esize * 2 } else if q { 16 } else { 8 };
    let lanes = read_lanes(regs.read_fpr_q(rn), esize, bytes);
    let same = match op {
        SimdFpAcrossOp::Fmaxv | SimdFpAcrossOp::FmaxpScalar => SimdFpSameOp::Fmax,
        SimdFpAcrossOp::Fminv | SimdFpAcrossOp::FminpScalar => SimdFpSameOp::Fmin,
        SimdFpAcrossOp::Fmaxnmv | SimdFpAcrossOp::FmaxnmpScalar => SimdFpSameOp::Fmaxnm,
        SimdFpAcrossOp::Fminnmv | SimdFpAcrossOp::FminnmpScalar => SimdFpSameOp::Fminnm,
        SimdFpAcrossOp::FaddpScalar => SimdFpSameOp::Fadd,
    };
    regs.write_fpr_scalar(rd, esize, fp_reduce(same, esize, &lanes));
}

/// The fold ARM's `Reduce` describes: halve, fold each half, then fold
/// the two answers, with the LOW half as the first operand. It is a tree
/// rather than a running total, and which NaN comes out depends on it.
fn fp_reduce(op: SimdFpSameOp, esize: u8, lanes: &[u64]) -> u64 {
    if lanes.len() == 1 {
        return lanes[0];
    }
    let half = lanes.len() / 2;
    let lo = fp_reduce(op, esize, &lanes[..half]);
    let hi = fp_reduce(op, esize, &lanes[half..]);
    fp_same_lane(op, esize, lo, hi, 0)
}

/// The floating-point by-element multiplies: one lane of Vm stands in for
/// the whole second source, so the arithmetic is the three-same lane
/// function unchanged with that lane broadcast.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_fp_by_element(
    op: SimdFpElemOp,
    esize: u8,
    q: bool,
    scalar: bool,
    index: u8,
    rm: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let same = simd_fp_elem_row(op).same;
    let element = read_lanes(regs.read_fpr_q(rm), esize, 16)[usize::from(index)];
    let bytes = if scalar { esize } else if q { 16 } else { 8 };
    let n = read_lanes(regs.read_fpr_q(rn), esize, bytes);
    let d = read_lanes(regs.read_fpr_q(rd), esize, bytes);
    let out: Vec<u64> = (0..n.len())
        .map(|i| fp_same_lane(same, esize, n[i], element, d[i]))
        .collect();
    regs.write_fpr_q(rd, pack_lanes(&out, esize));
}
