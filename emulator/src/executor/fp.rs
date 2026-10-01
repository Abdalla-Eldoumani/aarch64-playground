//! Scalar floating point: the `FpOperand` trait that lets the S and D
//! forms share one body, the NaN helpers (`default_nan_bits_if_new` is
//! the one home of the default-NaN rule), and the scalar arithmetic,
//! fused multiply-add and conversion instructions.

use super::*;

/// What the float rules need of a float, so the S and D paths run the
/// same body instead of two copies whose NaN rules could drift. The
/// scalar FP instructions and the vector lanes share every one of them.
pub(super) trait FpOperand:
    Copy
    + PartialOrd
    + std::ops::Add<Output = Self>
    + std::ops::Sub<Output = Self>
    + std::ops::Mul<Output = Self>
    + std::ops::Div<Output = Self>
    + std::ops::Neg<Output = Self>
{
    /// The AArch64 default NaN's bit pattern. `default_nan_bits_if_new`
    /// rebuilds the value from these bits rather than from a float
    /// constant, because the optimizer is free to treat one NaN as
    /// interchangeable with another and hand back the host's own.
    const DEFAULT_NAN_BITS: u64;
    const ZERO: Self;
    const TWO: Self;
    const THREE: Self;
    const ONE_POINT_FIVE: Self;
    const INFINITY: Self;
    const NEG_INFINITY: Self;
    /// The width in bytes, so a generic body can name its own lane mask.
    const BYTES: u8;
    fn is_nan(self) -> bool;
    /// A NaN whose mantissa's high bit is CLEAR, which is the signalling
    /// kind an operation has to quiet as it propagates it.
    fn is_signalling(self) -> bool;
    fn quieted(self) -> Self;
    fn is_infinite(self) -> bool;
    fn is_sign_negative(self) -> bool;
    fn from_lane(bits: u64) -> Self;
    fn to_bits(self) -> u64;
    fn abs(self) -> Self;
    fn sqrt(self) -> Self;
    fn mul_add(self, mul: Self, add: Self) -> Self;
    fn round_ties_even(self) -> Self;
    fn round(self) -> Self;
    fn floor(self) -> Self;
    fn ceil(self) -> Self;
    fn trunc(self) -> Self;
}

impl FpOperand for f32 {
    const DEFAULT_NAN_BITS: u64 = 0x7FC0_0000;
    const ZERO: Self = 0.0;
    const TWO: Self = 2.0;
    const THREE: Self = 3.0;
    const ONE_POINT_FIVE: Self = 1.5;
    const INFINITY: Self = f32::INFINITY;
    const NEG_INFINITY: Self = f32::NEG_INFINITY;
    const BYTES: u8 = 4;
    fn is_nan(self) -> bool {
        f32::is_nan(self)
    }
    fn is_signalling(self) -> bool {
        f32::is_nan(self) && f32::to_bits(self) & 0x0040_0000 == 0
    }
    fn quieted(self) -> Self {
        f32::from_bits(f32::to_bits(self) | 0x0040_0000)
    }
    fn is_infinite(self) -> bool {
        f32::is_infinite(self)
    }
    fn is_sign_negative(self) -> bool {
        f32::is_sign_negative(self)
    }
    fn from_lane(bits: u64) -> Self {
        f32::from_bits(bits as u32)
    }
    fn to_bits(self) -> u64 {
        u64::from(f32::to_bits(self))
    }
    fn abs(self) -> Self {
        f32::abs(self)
    }
    fn sqrt(self) -> Self {
        f32::sqrt(self)
    }
    fn mul_add(self, mul: Self, add: Self) -> Self {
        f32::mul_add(self, mul, add)
    }
    fn round_ties_even(self) -> Self {
        f32::round_ties_even(self)
    }
    fn round(self) -> Self {
        f32::round(self)
    }
    fn floor(self) -> Self {
        f32::floor(self)
    }
    fn ceil(self) -> Self {
        f32::ceil(self)
    }
    fn trunc(self) -> Self {
        f32::trunc(self)
    }
}

impl FpOperand for f64 {
    const DEFAULT_NAN_BITS: u64 = 0x7FF8_0000_0000_0000;
    const ZERO: Self = 0.0;
    const TWO: Self = 2.0;
    const THREE: Self = 3.0;
    const ONE_POINT_FIVE: Self = 1.5;
    const INFINITY: Self = f64::INFINITY;
    const NEG_INFINITY: Self = f64::NEG_INFINITY;
    const BYTES: u8 = 8;
    fn is_nan(self) -> bool {
        f64::is_nan(self)
    }
    fn is_signalling(self) -> bool {
        f64::is_nan(self) && f64::to_bits(self) & 0x0008_0000_0000_0000 == 0
    }
    fn quieted(self) -> Self {
        f64::from_bits(f64::to_bits(self) | 0x0008_0000_0000_0000)
    }
    fn is_infinite(self) -> bool {
        f64::is_infinite(self)
    }
    fn is_sign_negative(self) -> bool {
        f64::is_sign_negative(self)
    }
    fn from_lane(bits: u64) -> Self {
        f64::from_bits(bits)
    }
    fn to_bits(self) -> u64 {
        f64::to_bits(self)
    }
    fn abs(self) -> Self {
        f64::abs(self)
    }
    fn sqrt(self) -> Self {
        f64::sqrt(self)
    }
    fn mul_add(self, mul: Self, add: Self) -> Self {
        f64::mul_add(self, mul, add)
    }
    fn round_ties_even(self) -> Self {
        f64::round_ties_even(self)
    }
    fn round(self) -> Self {
        f64::round(self)
    }
    fn floor(self) -> Self {
        f64::floor(self)
    }
    fn ceil(self) -> Self {
        f64::ceil(self)
    }
    fn trunc(self) -> Self {
        f64::trunc(self)
    }
}

/// ARM's FPMax with FPCR.AH = 0, the state this emulator models: a NaN
/// operand makes the result NaN, and negative zero compares LESS than
/// positive zero whichever operand it arrives in. Rust's `max` does
/// neither, since it returns the number when one side is NaN and its
/// signed-zero answer is documented as unspecified, so both rules are
/// written out here rather than delegated.
pub(super) fn fp_max<T: FpOperand>(a: T, b: T) -> T {
    if let Some(nan) = fp_process_nans(&[a, b]) {
        return nan;
    }
    if a == T::ZERO && b == T::ZERO {
        return if a.is_sign_negative() { b } else { a };
    }
    if a > b { a } else { b }
}

pub(super) fn fp_min<T: FpOperand>(a: T, b: T) -> T {
    if let Some(nan) = fp_process_nans(&[a, b]) {
        return nan;
    }
    if a == T::ZERO && b == T::ZERO {
        return if a.is_sign_negative() { a } else { b };
    }
    if a < b { a } else { b }
}

/// FMAXNM / FMINNM are IEEE maxNum / minNum: a QUIET NaN operand is
/// treated as missing, which the pseudocode does by standing an infinity
/// in its place before running FPMax. A signalling one is not missing:
/// it falls through and propagates, quieted, like any other operand,
/// and two quiet NaNs leave nothing to stand in for either. The
/// signed-zero rule is FMAX's, so the numeric case delegates rather than
/// restating it.
pub(super) fn fp_max_num<T: FpOperand>(a: T, b: T) -> T {
    let quiet = |v: T| v.is_nan() && !v.is_signalling();
    match (quiet(a), quiet(b)) {
        (true, false) => fp_max(T::NEG_INFINITY, b),
        (false, true) => fp_max(a, T::NEG_INFINITY),
        _ => fp_max(a, b),
    }
}

pub(super) fn fp_min_num<T: FpOperand>(a: T, b: T) -> T {
    let quiet = |v: T| v.is_nan() && !v.is_signalling();
    match (quiet(a), quiet(b)) {
        (true, false) => fp_min(T::INFINITY, b),
        (false, true) => fp_min(a, T::INFINITY),
        _ => fp_min(a, b),
    }
}

/// Replace a NaN this operation GENERATED with the AArch64 default NaN
/// (0x7FF8000000000000 for D, 0x7FC00000 for S), which is positive. An
/// invalid operation on x86-64 answers with that host's own "indefinite"
/// QNaN instead, whose sign bit is set, so `sqrt(-4.0)` and `0.0 / 0.0`
/// reach the register file as `-nan` where the course servers print
/// `nan`. A NaN that arrived in an OPERAND is left exactly as it is:
/// FPCR.DN is clear here, so a quiet NaN propagates with its own sign and
/// payload.
///
/// The rule is answered as BITS, the form it is really about: nothing
/// stops the optimizer from handing back a different NaN when the answer
/// is only "a NaN", and on an x86-64 host that is the sign-set one this
/// rule exists to replace.
pub(super) fn default_nan_bits_if_new<T: FpOperand>(result: T, sources: &[T]) -> u64 {
    if result.is_nan() && !sources.iter().any(|s| s.is_nan()) {
        T::DEFAULT_NAN_BITS
    } else {
        result.to_bits()
    }
}

pub(super) fn exec_fp_binary(
    op: FpBinOp,
    fd: u8,
    fn_: u8,
    fm: u8,
    single: bool,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    // Single precision must compute IN f32: rounding each operation to
    // single is what the hardware does, and computing in f64 then
    // narrowing would double-round.
    if single {
        let a = regs.read_fpr_f32(fn_);
        let b = regs.read_fpr_f32(fm);
        let arith = |value: f32| f32::from_lane(fp_arith(value, &[a, b]));
        let result = match op {
            FpBinOp::Fadd => arith(a + b),
            FpBinOp::Fsub => arith(a - b),
            FpBinOp::Fmul => arith(a * b),
            FpBinOp::Fdiv => arith(a / b),
            // The sign flips on the PRODUCT, which is what makes
            // fnmul of +0.0 and 3.0 a -0.0 that (-a) * b never produces.
            // FPNeg runs after FPMul, so the product is normalized first.
            FpBinOp::Fnmul => -arith(a * b),
            FpBinOp::Fmax => fp_max(a, b),
            FpBinOp::Fmin => fp_min(a, b),
            FpBinOp::Fmaxnm => fp_max_num(a, b),
            FpBinOp::Fminnm => fp_min_num(a, b),
        };
        regs.write_fpr_f32(fd, result);
    } else {
        let a = regs.read_fpr_f64(fn_);
        let b = regs.read_fpr_f64(fm);
        let arith = |value: f64| f64::from_lane(fp_arith(value, &[a, b]));
        let result = match op {
            FpBinOp::Fadd => arith(a + b),
            FpBinOp::Fsub => arith(a - b),
            FpBinOp::Fmul => arith(a * b),
            FpBinOp::Fdiv => arith(a / b),
            FpBinOp::Fnmul => -arith(a * b),
            FpBinOp::Fmax => fp_max(a, b),
            FpBinOp::Fmin => fp_min(a, b),
            FpBinOp::Fmaxnm => fp_max_num(a, b),
            FpBinOp::Fminnm => fp_min_num(a, b),
        };
        regs.write_fpr_f64(fd, result);
    }
    Ok(ExecResult::Advance)
}

/// FMADD / FMSUB / FNMADD / FNMSUB. Fused: one rounding, not two, which
/// is why this goes through `mul_add` and not `a * b + c`. Single
/// precision computes IN f32, the same rule `exec_fp_binary` follows.
pub(super) fn exec_fp_mul_add(
    op: FpMulAddOp, fd: u8, fn_: u8, fm: u8, fa: u8, single: bool,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    // The ARM pseudocode negates the product's first source and the
    // addend, never the result, which is what makes the sign of an
    // exactly cancelling FNMADD a positive zero.
    let (neg_n, neg_a) = match op {
        FpMulAddOp::Fmadd => (false, false),
        FpMulAddOp::Fmsub => (true, false),
        FpMulAddOp::Fnmadd => (true, true),
        FpMulAddOp::Fnmsub => (false, true),
    };
    if single {
        let n = regs.read_fpr_f32(fn_);
        let m = regs.read_fpr_f32(fm);
        let a = regs.read_fpr_f32(fa);
        let n = if neg_n { -n } else { n };
        let a = if neg_a { -a } else { a };
        regs.write_fpr_f32(fd, f32::from_lane(fp_fused(n, m, a)));
    } else {
        let n = regs.read_fpr_f64(fn_);
        let m = regs.read_fpr_f64(fm);
        let a = regs.read_fpr_f64(fa);
        let n = if neg_n { -n } else { n };
        let a = if neg_a { -a } else { a };
        regs.write_fpr_f64(fd, f64::from_lane(fp_fused(n, m, a)));
    }
    Ok(ExecResult::Advance)
}

/// FCVT{N,A,M,P,Z}{S,U}. Read at the instruction's width, scale by
/// 2^fbits for the fixed-point form, round by the named mode, then
/// saturate at the destination width. Widening f32 to f64 is exact, so
/// one f64 path serves both source widths. No NZCV write: none of these
/// touches the flags.
pub(super) fn exec_fp_to_int(
    op: FpToIntOp, rd: u8, fn_: u8, sf: bool, single: bool, fbits: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let value = if single {
        regs.read_fpr_f32(fn_) as f64
    } else {
        regs.read_fpr_f64(fn_)
    };
    regs.write_gpr(rd, sf, fp_to_int(op, value, fbits, sf));
    Ok(ExecResult::Advance)
}

/// The rounding mode and the saturation rails of one FCVT, shared by
/// `exec_fp_to_int` above and the vector lanes (`fp_to_int_lane` in
/// simd_fp.rs): `wide` is a 64-bit destination, `fbits` the fixed-point
/// scale.
pub(super) fn fp_to_int(op: FpToIntOp, value: f64, fbits: u8, wide: bool) -> u64 {
    let mut value = value;
    let sf = wide;
    if fbits != 0 {
        // powi, not a shift: fbits reaches 64 and the exponent form is
        // exact for every value the field can hold.
        value *= 2f64.powi(i32::from(fbits));
    }
    let rounded = match op {
        FpToIntOp::Ns | FpToIntOp::Nu => value.round_ties_even(),
        FpToIntOp::As | FpToIntOp::Au => value.round(),
        FpToIntOp::Ms | FpToIntOp::Mu => value.floor(),
        FpToIntOp::Ps | FpToIntOp::Pu => value.ceil(),
        FpToIntOp::Zs | FpToIntOp::Zu => value.trunc(),
    };
    let signed = matches!(
        op,
        FpToIntOp::Ns | FpToIntOp::As | FpToIntOp::Ms | FpToIntOp::Ps | FpToIntOp::Zs
    );
    let result: u64 = if signed {
        let v = if rounded.is_nan() {
            0i64
        } else if sf {
            // Same boundary rule as the unsigned arm: i64::MAX as f64 rounds
            // UP to 2^63, so >= is correct.
            if rounded >= i64::MAX as f64 { i64::MAX }
            else if rounded <= i64::MIN as f64 { i64::MIN }
            else { rounded as i64 }
        } else if rounded >= i32::MAX as f64 { i32::MAX as i64 }
        else if rounded <= i32::MIN as f64 { i32::MIN as i64 }
        else { rounded as i32 as i64 };
        v as u64
    } else if rounded.is_nan() || rounded <= 0.0 {
        // Negatives saturate to zero, not to the wrapped bit pattern.
        0
    } else if sf {
        // u64::MAX as f64 rounds UP to 2^64, so >= is the correct
        // boundary; < it, the cast is exact.
        if rounded >= u64::MAX as f64 { u64::MAX } else { rounded as u64 }
    } else if rounded >= u32::MAX as f64 {
        u64::from(u32::MAX)
    } else {
        rounded as u32 as u64
    };
    result
}

/// SCVTF / UCVTF. The only difference is how the source register's bits
/// are read.
pub(super) fn exec_fp_from_int(
    op: FpFromIntOp, fd: u8, rn: u8, sf: bool, single: bool, fbits: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let raw = regs.read_gpr(rn, sf);
    // Straight to the destination width: a 64-bit integer rounded to a
    // double and then to a single can land on a tie the integer never
    // had. Scaling by a power of two afterwards is exact.
    let signed = if sf { raw as i64 } else { (raw as u32 as i32) as i64 };
    let unsigned = if sf { raw } else { raw & 0xFFFF_FFFF };
    let scale = i32::from(fbits);
    if single {
        let value = match op {
            FpFromIntOp::Scvtf => signed as f32,
            FpFromIntOp::Ucvtf => unsigned as f32,
        };
        regs.write_fpr_f32(fd, value / 2f32.powi(scale));
    } else {
        let value = match op {
            FpFromIntOp::Scvtf => signed as f64,
            FpFromIntOp::Ucvtf => unsigned as f64,
        };
        regs.write_fpr_f64(fd, value / 2f64.powi(scale));
    }
    Ok(ExecResult::Advance)
}
