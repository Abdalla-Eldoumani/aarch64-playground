//! The Advanced SIMD integer lane families: the lane helpers, then
//! three-same, two-register misc, three-different, shift by immediate,
//! across-lanes, permute, table lookup, by-element and the copy group.

use super::*;

/// The Advanced SIMD copy group. DUP and the two lane-out forms write a
/// whole destination, so they zero everything they do not set; INS writes
/// one lane and leaves the rest of the register exactly as it was.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_copy(
    op: SimdCopyOp,
    esize: u8,
    q: bool,
    index: u8,
    index2: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let bytes = if q { 16 } else { 8 };
    match op {
        SimdCopyOp::DupGeneral => {
            let element = regs.read_gpr(rn, esize == 8);
            regs.write_fpr_q(rd, simd_replicate(element, esize, bytes));
        }
        SimdCopyOp::DupElement => {
            let element = regs.read_fpr_lane(rn, esize, index);
            regs.write_fpr_q(rd, simd_replicate(element, esize, bytes));
        }
        SimdCopyOp::DupScalar => {
            let element = regs.read_fpr_lane(rn, esize, index);
            regs.write_fpr_scalar(rd, esize, element);
        }
        SimdCopyOp::InsGeneral => {
            let value = regs.read_gpr(rn, esize == 8);
            regs.write_fpr_lane(rd, esize, index, value);
        }
        SimdCopyOp::InsElement => {
            let value = regs.read_fpr_lane(rn, esize, index2);
            regs.write_fpr_lane(rd, esize, index, value);
        }
        SimdCopyOp::Umov => {
            let value = regs.read_fpr_lane(rn, esize, index);
            regs.write_gpr(rd, q, value);
        }
        SimdCopyOp::Smov => {
            let value = regs.read_fpr_lane(rn, esize, index);
            let spare = 64 - u32::from(esize) * 8;
            regs.write_gpr(rd, q, (((value << spare) as i64) >> spare) as u64);
        }
    }
}

// ---------------------------------------------------------------------------
// advanced simd: the integer lane families
// ---------------------------------------------------------------------------
//
// Every lane operation below works at the lane's OWN width: the value is
// masked back to `esize` bytes before it is stored, and the arithmetic is
// explicitly wrapping or saturating. A wider intermediate appears only
// where the instruction defines one (the halving adds, the saturating
// forms, the doubling multiplies), and each such arm says so.

/// All-ones over `esize` bytes: the mask a lane result is stored under,
/// and the value a lane compare writes when it holds.
pub(super) fn lane_mask(esize: u8) -> u64 {
    match esize {
        1 => 0xff,
        2 => 0xffff,
        4 => 0xffff_ffff,
        _ => u64::MAX,
    }
}

/// One lane read as a signed value.
fn lane_signed(value: u64, esize: u8) -> i64 {
    let spare = 64 - u32::from(esize) * 8;
    ((value << spare) as i64) >> spare
}

/// Clamp to the signed range of `esize` bytes, then store as the lane's
/// bit pattern. The argument is i128 because the caller has already gone
/// past the lane's width: that overflow is the thing being clamped.
fn sat_signed(value: i128, esize: u8) -> u64 {
    let bits = u32::from(esize) * 8;
    let high = (1i128 << (bits - 1)) - 1;
    let low = -(1i128 << (bits - 1));
    (value.clamp(low, high) as u64) & lane_mask(esize)
}

/// Clamp to the unsigned range of `esize` bytes.
fn sat_unsigned(value: i128, esize: u8) -> u64 {
    let high = (1i128 << (u32::from(esize) * 8)) - 1;
    value.clamp(0, high) as u64
}

/// The lanes of a register, low lane first. `bytes` is how much of the
/// register the arrangement covers: 8, 16, or the width of one lane for
/// a SIMD-scalar form.
pub(super) fn read_lanes(value: u128, esize: u8, bytes: u8) -> Vec<u64> {
    let width = u32::from(esize) * 8;
    let mask = lane_mask(esize);
    (0..bytes / esize)
        .map(|lane| ((value >> (u32::from(lane) * width)) as u64) & mask)
        .collect()
}

/// Pack lanes back into a register value. Everything above the lanes is
/// zero, which is the write rule for both the 64-bit arrangements and
/// the SIMD-scalar forms.
pub(super) fn pack_lanes(lanes: &[u64], esize: u8) -> u128 {
    let width = u32::from(esize) * 8;
    let mask = u128::from(lane_mask(esize));
    lanes
        .iter()
        .enumerate()
        .fold(0u128, |acc, (i, lane)| acc | ((u128::from(*lane) & mask) << (i as u32 * width)))
}

/// The half of a 128-bit source a widening or `2` form reads: the low
/// lanes for the plain spelling, the high ones for the `2` suffix.
pub(super) fn read_half_lanes(value: u128, esize: u8, upper: bool) -> Vec<u64> {
    let lanes = read_lanes(value, esize, 16);
    let half = lanes.len() / 2;
    if upper {
        lanes[half..].to_vec()
    } else {
        lanes[..half].to_vec()
    }
}

/// Write a 64-bit-wide result. The plain form fills the low half and
/// zeroes bits 127:64; the `2` form fills the high half and leaves the
/// low one exactly as it was, which is the whole point of the suffix.
pub(super) fn write_half(regs: &mut RegisterFile, rd: u8, upper: bool, packed: u128) {
    if upper {
        let low = regs.read_fpr_q(rd) & u128::from(u64::MAX);
        regs.write_fpr_q(rd, low | (packed << 64));
    } else {
        regs.write_fpr_q(rd, packed);
    }
}

/// Carry-less (polynomial) multiply of two bytes: PMUL's lane operation.
fn poly_mul(a: u64, b: u64) -> u64 {
    (0..8).fold(0u64, |acc, bit| if (b >> bit) & 1 == 1 { acc ^ (a << bit) } else { acc })
}

/// Bits of one byte in reverse order: RBIT's lane operation.
fn reverse_byte(byte: u64) -> u64 {
    u64::from((byte as u8).reverse_bits())
}

/// Leading sign bits of a lane, the sign bit itself excluded, which is
/// what CLS counts.
fn count_leading_sign_bits(value: u64, esize: u8) -> u64 {
    let bits = u32::from(esize) * 8;
    let below = (1u64 << (bits - 1)) - 1;
    let differing = ((value >> 1) ^ value) & below;
    if differing == 0 {
        u64::from(bits - 1)
    } else {
        u64::from(differing.leading_zeros() - (64 - (bits - 1)))
    }
}

fn count_leading_zeros(value: u64, esize: u8) -> u64 {
    let bits = u32::from(esize) * 8;
    if value == 0 {
        u64::from(bits)
    } else {
        u64::from(value.leading_zeros() - (64 - bits))
    }
}

/// ARM's RecipEstimate over the nine leading bits of a fixed-point
/// operand: the estimate table URECPE reads.
pub(super) fn recip_estimate(a: u32) -> u32 {
    let a = a * 2 + 1;
    let b = (1u32 << 19) / a;
    b.div_ceil(2)
}

/// ARM's RecipSqrtEstimate, the same table for URSQRTE. The search for
/// `b` is the pseudocode's own loop, kept literal rather than solved: it
/// is what pins the boundary cases the capture checks.
pub(super) fn recip_sqrt_estimate(a: u32) -> u32 {
    let a = if a < 256 { a * 2 + 1 } else { (((a >> 1) << 1) + 1) * 2 };
    let mut b = 512u32;
    while u64::from(a) * u64::from(b + 1) * u64::from(b + 1) < (1u64 << 28) {
        b += 1;
    }
    b.div_ceil(2)
}

/// URECPE: an operand below 0.5 has no representable reciprocal in the
/// fixed-point format, so the estimate saturates to all ones.
fn unsigned_recip_estimate(operand: u32) -> u32 {
    if operand >> 31 == 0 {
        u32::MAX
    } else {
        (recip_estimate(operand >> 23) & 0x1ff) << 23
    }
}

/// URSQRTE: the same, with the cut at 0.25.
fn unsigned_rsqrt_estimate(operand: u32) -> u32 {
    if operand >> 30 == 0 {
        u32::MAX
    } else {
        (recip_sqrt_estimate(operand >> 23) & 0x1ff) << 23
    }
}

/// One lane of a three-same operation. `d` is the destination lane,
/// which only the accumulating rows (MLA, MLS, SABA, UABA) read.
fn simd_same_lane(op: SimdSameOp, a: u64, b: u64, d: u64, esize: u8) -> u64 {
    let mask = lane_mask(esize);
    let sa = lane_signed(a, esize);
    let sb = lane_signed(b, esize);
    let bits = u32::from(esize) * 8;
    // The absolute difference the SABD/SABA and UABD/UABA rows share.
    let sdiff = (i128::from(sa) - i128::from(sb)).unsigned_abs() as u64;
    let udiff = a.abs_diff(b);
    match op {
        SimdSameOp::Add => a.wrapping_add(b) & mask,
        SimdSameOp::Sub => a.wrapping_sub(b) & mask,
        SimdSameOp::Mul => a.wrapping_mul(b) & mask,
        SimdSameOp::Mla => d.wrapping_add(a.wrapping_mul(b)) & mask,
        SimdSameOp::Mls => d.wrapping_sub(a.wrapping_mul(b)) & mask,
        SimdSameOp::Pmul => poly_mul(a, b) & mask,
        SimdSameOp::Cmeq => if a == b { mask } else { 0 },
        SimdSameOp::Cmtst => if a & b != 0 { mask } else { 0 },
        SimdSameOp::Cmgt => if sa > sb { mask } else { 0 },
        SimdSameOp::Cmge => if sa >= sb { mask } else { 0 },
        SimdSameOp::Cmhi => if a > b { mask } else { 0 },
        SimdSameOp::Cmhs => if a >= b { mask } else { 0 },
        SimdSameOp::Smax | SimdSameOp::Smaxp => if sa >= sb { a } else { b },
        SimdSameOp::Smin | SimdSameOp::Sminp => if sa <= sb { a } else { b },
        SimdSameOp::Umax | SimdSameOp::Umaxp => a.max(b),
        SimdSameOp::Umin | SimdSameOp::Uminp => a.min(b),
        SimdSameOp::Sabd => sdiff & mask,
        SimdSameOp::Uabd => udiff & mask,
        SimdSameOp::Saba => d.wrapping_add(sdiff) & mask,
        SimdSameOp::Uaba => d.wrapping_add(udiff) & mask,
        // The halving adds and subtracts are defined in one extra bit:
        // the sum is formed at esize+1 and the result is its bits
        // esize:1, so the carry out is never lost.
        SimdSameOp::Shadd => ((i128::from(sa) + i128::from(sb)) >> 1) as u64 & mask,
        SimdSameOp::Uhadd => ((i128::from(a) + i128::from(b)) >> 1) as u64 & mask,
        SimdSameOp::Srhadd => ((i128::from(sa) + i128::from(sb) + 1) >> 1) as u64 & mask,
        SimdSameOp::Urhadd => ((i128::from(a) + i128::from(b) + 1) >> 1) as u64 & mask,
        SimdSameOp::Shsub => ((i128::from(sa) - i128::from(sb)) >> 1) as u64 & mask,
        SimdSameOp::Uhsub => ((i128::from(a) - i128::from(b)) >> 1) as u64 & mask,
        // The saturating rows have to see the overflow to clamp it.
        SimdSameOp::Sqadd => sat_signed(i128::from(sa) + i128::from(sb), esize),
        SimdSameOp::Uqadd => sat_unsigned(i128::from(a) + i128::from(b), esize),
        SimdSameOp::Sqsub => sat_signed(i128::from(sa) - i128::from(sb), esize),
        SimdSameOp::Uqsub => sat_unsigned(i128::from(a) - i128::from(b), esize),
        // The doubling multiplies form a double-width product on
        // purpose and keep its high half: the only pair that saturates
        // is the two minimum values, whose doubled product is one past
        // the top of the lane.
        SimdSameOp::Sqdmulh => {
            sat_signed((2 * i128::from(sa) * i128::from(sb)) >> bits, esize)
        }
        SimdSameOp::Sqrdmulh => {
            let product = 2 * i128::from(sa) * i128::from(sb) + (1i128 << (bits - 1));
            sat_signed(product >> bits, esize)
        }
        SimdSameOp::Addp => a.wrapping_add(b) & mask,
        // The register shifts read a shift COUNT out of the second
        // source rather than a value, so they have their own lane rule.
        SimdSameOp::Sshl
        | SimdSameOp::Ushl
        | SimdSameOp::Srshl
        | SimdSameOp::Urshl
        | SimdSameOp::Sqshl
        | SimdSameOp::Uqshl
        | SimdSameOp::Sqrshl
        | SimdSameOp::Uqrshl => simd_shift_reg_lane(op, a, b, esize),
    }
}

/// One lane of a register shift. The count is the SIGNED low byte of the
/// second source's lane: positive shifts left, negative right. The
/// rounding rows add half an ulp of the discarded bits before shifting,
/// and the saturating rows clamp a left shift that leaves the lane.
fn simd_shift_reg_lane(op: SimdSameOp, a: u64, count: u64, esize: u8) -> u64 {
    let bits = u32::from(esize) * 8;
    let mask = lane_mask(esize);
    let shift = (count & 0xff) as u8 as i8;
    let signed = matches!(
        op,
        SimdSameOp::Sshl | SimdSameOp::Srshl | SimdSameOp::Sqshl | SimdSameOp::Sqrshl
    );
    let rounding = matches!(
        op,
        SimdSameOp::Srshl | SimdSameOp::Urshl | SimdSameOp::Sqrshl | SimdSameOp::Uqrshl
    );
    let saturating = matches!(
        op,
        SimdSameOp::Sqshl | SimdSameOp::Uqshl | SimdSameOp::Sqrshl | SimdSameOp::Uqrshl
    );
    // The shift is defined on the unbounded integer the lane holds, so
    // the intermediate is i128: that width is the instruction's, not a
    // convenience, and the truncation or clamp back to the lane is the
    // last step rather than a side effect of the arithmetic.
    let element = if signed {
        i128::from(lane_signed(a, esize))
    } else {
        i128::from(a)
    };
    let saturate = |value: i128| {
        if signed {
            sat_signed(value, esize)
        } else {
            sat_unsigned(value, esize)
        }
    };
    if shift >= 0 {
        let s = u32::from(shift as u8);
        if s >= bits {
            // Every bit the lane held has left it: the truncating rows
            // answer zero and the saturating ones the extreme the sign
            // of the operand asks for.
            if !saturating || element == 0 {
                return 0;
            }
            return saturate(if element > 0 { i128::MAX / 2 } else { i128::MIN / 2 });
        }
        let value = element << s;
        if saturating {
            saturate(value)
        } else {
            (value as u64) & mask
        }
    } else {
        // A right shift past the lane empties it whatever the count, so
        // the count is capped where the answer stops changing rather
        // than left to run the rounding constant off the intermediate.
        let k = u32::from(shift.unsigned_abs()).min(bits + 1);
        let base = if rounding { element + (1i128 << (k - 1)) } else { element };
        let value = base >> k;
        if saturating {
            saturate(value)
        } else {
            (value as u64) & mask
        }
    }
}

/// Whether a three-same row reads its two sources as one concatenated
/// vector and folds neighbouring pairs, rather than lane against lane.
fn is_pairwise(op: SimdSameOp) -> bool {
    matches!(
        op,
        SimdSameOp::Addp
            | SimdSameOp::Smaxp
            | SimdSameOp::Sminp
            | SimdSameOp::Umaxp
            | SimdSameOp::Uminp
    )
}

#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_three_same(
    op: SimdSameOp,
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
    let out: Vec<u64> = if is_pairwise(op) {
        // Vn's lanes then Vm's, folded two at a time, so the low half of
        // the destination comes from Vn and the high half from Vm.
        let concat: Vec<u64> = n.iter().chain(m.iter()).copied().collect();
        (0..concat.len() / 2)
            .map(|i| simd_same_lane(op, concat[i * 2], concat[i * 2 + 1], 0, esize))
            .collect()
    } else {
        (0..n.len())
            .map(|i| simd_same_lane(op, n[i], m[i], d[i], esize))
            .collect()
    };
    regs.write_fpr_q(rd, pack_lanes(&out, esize));
}

/// One lane of a two-register misc operation. `d` is the destination
/// lane, which the two saturating accumulate rows read.
fn simd_misc_lane(op: SimdMiscOp, a: u64, d: u64, esize: u8) -> u64 {
    let mask = lane_mask(esize);
    let sa = lane_signed(a, esize);
    match op {
        SimdMiscOp::Cnt => u64::from(a.count_ones()),
        SimdMiscOp::Mvn => !a & mask,
        SimdMiscOp::Rbit => reverse_byte(a),
        SimdMiscOp::Cls => count_leading_sign_bits(a, esize),
        SimdMiscOp::Clz => count_leading_zeros(a, esize),
        // ABS and NEG wrap at the lane's own width, so the minimum value
        // is its own absolute value; their saturating twins clamp it.
        SimdMiscOp::Abs => sa.wrapping_abs() as u64 & mask,
        SimdMiscOp::Neg => 0u64.wrapping_sub(a) & mask,
        SimdMiscOp::Sqabs => sat_signed(i128::from(sa).abs(), esize),
        SimdMiscOp::Sqneg => sat_signed(-i128::from(sa), esize),
        // SUQADD accumulates an unsigned operand into a signed
        // destination and saturates as a signed value; USQADD is the
        // other way round.
        SimdMiscOp::Suqadd => {
            sat_signed(i128::from(lane_signed(d, esize)) + i128::from(a), esize)
        }
        SimdMiscOp::Usqadd => sat_unsigned(i128::from(d) + i128::from(sa), esize),
        SimdMiscOp::Cmgt0 => if sa > 0 { mask } else { 0 },
        SimdMiscOp::Cmge0 => if sa >= 0 { mask } else { 0 },
        SimdMiscOp::Cmeq0 => if sa == 0 { mask } else { 0 },
        SimdMiscOp::Cmle0 => if sa <= 0 { mask } else { 0 },
        SimdMiscOp::Cmlt0 => if sa < 0 { mask } else { 0 },
        SimdMiscOp::Urecpe => u64::from(unsigned_recip_estimate(a as u32)),
        SimdMiscOp::Ursqrte => u64::from(unsigned_rsqrt_estimate(a as u32)),
        // The element-reversal and pairwise-widening rows are not lane
        // to lane, so `exec_simd_two_misc` handles them itself.
        SimdMiscOp::Rev64
        | SimdMiscOp::Rev32
        | SimdMiscOp::Rev16
        | SimdMiscOp::Saddlp
        | SimdMiscOp::Uaddlp
        | SimdMiscOp::Sadalp
        | SimdMiscOp::Uadalp
        | SimdMiscOp::Xtn
        | SimdMiscOp::Sqxtn
        | SimdMiscOp::Uqxtn
        | SimdMiscOp::Sqxtun
        | SimdMiscOp::Shll => unreachable!("handled by shape, not lane by lane"),
    }
}

/// One lane of a narrowing extract. The source is twice `esize` wide, so
/// the value can be past what the result lane holds: that overflow is
/// exactly what the three saturating rows clamp and XTN discards.
fn simd_narrow_lane(op: SimdMiscOp, a: u64, esize: u8) -> u64 {
    let wide = esize * 2;
    let signed = i128::from(lane_signed(a, wide));
    match op {
        SimdMiscOp::Xtn => a & lane_mask(esize),
        SimdMiscOp::Sqxtn => sat_signed(signed, esize),
        SimdMiscOp::Uqxtn => sat_unsigned(i128::from(a), esize),
        // SQXTUN reads the source SIGNED and saturates it into an
        // UNSIGNED lane, so a negative source clamps at zero.
        SimdMiscOp::Sqxtun => sat_unsigned(signed, esize),
        _ => unreachable!("only the narrowing extracts reach this"),
    }
}

pub(super) fn exec_simd_two_misc(
    op: SimdMiscOp,
    esize: u8,
    q: bool,
    scalar: bool,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let bytes = if scalar { esize } else if q { 16 } else { 8 };
    let source = read_lanes(regs.read_fpr_q(rn), esize, bytes);
    match op {
        // The REV rows reverse the ORDER of elements inside a container
        // of 64, 32 or 16 bits; the elements themselves are untouched.
        SimdMiscOp::Rev64 | SimdMiscOp::Rev32 | SimdMiscOp::Rev16 => {
            let container: u8 = match op {
                SimdMiscOp::Rev64 => 8,
                SimdMiscOp::Rev32 => 4,
                _ => 2,
            };
            let out: Vec<u64> = source
                .chunks(usize::from(container / esize))
                .flat_map(|chunk| chunk.iter().rev().copied())
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, esize));
        }
        // The pairwise widening adds fold neighbouring lanes into one of
        // twice the width; the ADALP pair accumulates into what the
        // destination already holds.
        SimdMiscOp::Saddlp | SimdMiscOp::Uaddlp | SimdMiscOp::Sadalp | SimdMiscOp::Uadalp => {
            let signed = matches!(op, SimdMiscOp::Saddlp | SimdMiscOp::Sadalp);
            let accumulate = matches!(op, SimdMiscOp::Sadalp | SimdMiscOp::Uadalp);
            let wide = esize * 2;
            let wide_mask = lane_mask(wide);
            let held = read_lanes(regs.read_fpr_q(rd), wide, bytes);
            let out: Vec<u64> = (0..source.len() / 2)
                .map(|i| {
                    let (a, b) = (source[i * 2], source[i * 2 + 1]);
                    let sum = if signed {
                        (lane_signed(a, esize).wrapping_add(lane_signed(b, esize))) as u64
                    } else {
                        a.wrapping_add(b)
                    };
                    let sum = sum & wide_mask;
                    if accumulate {
                        held[i].wrapping_add(sum) & wide_mask
                    } else {
                        sum
                    }
                })
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, wide));
        }
        // The narrowing extracts read lanes of twice the result's width
        // and, in the `2` form, write the upper half of the destination
        // rather than zeroing everything above the result.
        SimdMiscOp::Xtn | SimdMiscOp::Sqxtn | SimdMiscOp::Uqxtn | SimdMiscOp::Sqxtun => {
            let wide = esize * 2;
            let read = if scalar { wide } else { 16 };
            let lanes = read_lanes(regs.read_fpr_q(rn), wide, read);
            let out: Vec<u64> = lanes.iter().map(|v| simd_narrow_lane(op, *v, esize)).collect();
            if scalar {
                regs.write_fpr_scalar(rd, esize, out[0]);
            } else {
                write_half(regs, rd, q, pack_lanes(&out, esize));
            }
        }
        // SHLL shifts each lane left by exactly its own width into a
        // lane of twice that, so the result is the source in the top
        // half of every widened lane and zeros below it.
        SimdMiscOp::Shll => {
            let wide = esize * 2;
            let width = u32::from(esize) * 8;
            let lanes = read_half_lanes(regs.read_fpr_q(rn), esize, q);
            let out: Vec<u64> = lanes.iter().map(|v| (v << width) & lane_mask(wide)).collect();
            regs.write_fpr_q(rd, pack_lanes(&out, wide));
        }
        _ => {
            let held = read_lanes(regs.read_fpr_q(rd), esize, bytes);
            let out: Vec<u64> = source
                .iter()
                .enumerate()
                .map(|(i, lane)| simd_misc_lane(op, *lane, held[i], esize))
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, esize));
        }
    }
}

/// One lane of a three-different operation, computed at the WIDE width.
/// Both `a` and `b` arrive already at the width the instruction reads
/// them in: the widening rows extend their narrow operands first (which
/// is what "long" means), and the narrowing rows are handed two wide
/// lanes and keep the top half of the answer. `d` is the destination
/// lane, which the accumulating rows read.
fn simd_diff_lane(op: SimdDiffOp, a: i128, b: i128, d: u64, esize: u8) -> u64 {
    let wide = esize * 2;
    let wide_mask = lane_mask(wide);
    let narrow_mask = lane_mask(esize);
    let bits = u32::from(esize) * 8;
    let half_ulp = 1u64 << (bits - 1);
    match op {
        SimdDiffOp::Saddl | SimdDiffOp::Uaddl | SimdDiffOp::Saddw | SimdDiffOp::Uaddw => {
            (a + b) as u64 & wide_mask
        }
        SimdDiffOp::Ssubl | SimdDiffOp::Usubl | SimdDiffOp::Ssubw | SimdDiffOp::Usubw => {
            (a - b) as u64 & wide_mask
        }
        SimdDiffOp::Sabdl | SimdDiffOp::Uabdl => (a - b).unsigned_abs() as u64 & wide_mask,
        SimdDiffOp::Sabal | SimdDiffOp::Uabal => {
            d.wrapping_add((a - b).unsigned_abs() as u64) & wide_mask
        }
        SimdDiffOp::Smull | SimdDiffOp::Umull => (a * b) as u64 & wide_mask,
        SimdDiffOp::Smlal | SimdDiffOp::Umlal => d.wrapping_add((a * b) as u64) & wide_mask,
        SimdDiffOp::Smlsl | SimdDiffOp::Umlsl => d.wrapping_sub((a * b) as u64) & wide_mask,
        // PMUL's carry-less product of two bytes fills the wide lane.
        SimdDiffOp::Pmull => poly_mul(a as u64, b as u64) & wide_mask,
        // The doubling multiplies saturate their product at the wide
        // width; the accumulating pair then saturate the sum as well, so
        // a product already at the limit cannot wrap on the way in.
        SimdDiffOp::Sqdmull => sat_signed(2 * a * b, wide),
        SimdDiffOp::Sqdmlal | SimdDiffOp::Sqdmlsl => {
            let product = i128::from(lane_signed(sat_signed(2 * a * b, wide), wide));
            let held = i128::from(lane_signed(d, wide));
            let sum = if op == SimdDiffOp::Sqdmlal { held + product } else { held - product };
            sat_signed(sum, wide)
        }
        // The high-half narrowing adds form the sum at the SOURCE width
        // and keep its top half; the rounding pair add half an ulp of
        // that half first, which is the bit just below what is kept.
        SimdDiffOp::Addhn | SimdDiffOp::Raddhn => {
            let sum = (a + b) as u64;
            let sum = if op == SimdDiffOp::Raddhn { sum.wrapping_add(half_ulp) } else { sum };
            ((sum & wide_mask) >> bits) & narrow_mask
        }
        SimdDiffOp::Subhn | SimdDiffOp::Rsubhn => {
            let diff = (a - b) as u64;
            let diff = if op == SimdDiffOp::Rsubhn { diff.wrapping_add(half_ulp) } else { diff };
            ((diff & wide_mask) >> bits) & narrow_mask
        }
    }
}

/// How a three-different row extends its narrow operands. The S/U pair
/// of every widening row differ in nothing else; the narrowing rows
/// extend nothing, because both their operands already arrive wide.
fn simd_diff_signed(op: SimdDiffOp) -> bool {
    matches!(
        op,
        SimdDiffOp::Saddl
            | SimdDiffOp::Saddw
            | SimdDiffOp::Ssubl
            | SimdDiffOp::Ssubw
            | SimdDiffOp::Sabal
            | SimdDiffOp::Sabdl
            | SimdDiffOp::Smlal
            | SimdDiffOp::Smlsl
            | SimdDiffOp::Smull
            | SimdDiffOp::Sqdmlal
            | SimdDiffOp::Sqdmlsl
            | SimdDiffOp::Sqdmull
    )
}

#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_three_diff(
    op: SimdDiffOp,
    esize: u8,
    upper: bool,
    scalar: bool,
    rm: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let row = simd_diff_row(op);
    let wide = esize * 2;
    let signed = simd_diff_signed(op);
    let extend = |lane: u64| -> i128 {
        if signed {
            i128::from(lane_signed(lane, esize))
        } else {
            i128::from(lane)
        }
    };
    if scalar {
        let n = read_lanes(regs.read_fpr_q(rn), esize, esize)[0];
        let m = read_lanes(regs.read_fpr_q(rm), esize, esize)[0];
        let d = read_lanes(regs.read_fpr_q(rd), wide, wide)[0];
        let out = simd_diff_lane(op, extend(n), extend(m), d, esize);
        regs.write_fpr_scalar(rd, wide, out);
        return;
    }
    match row.shape {
        SimdDiffShape::Long => {
            let n = read_half_lanes(regs.read_fpr_q(rn), esize, upper);
            let m = read_half_lanes(regs.read_fpr_q(rm), esize, upper);
            let held = read_lanes(regs.read_fpr_q(rd), wide, 16);
            let out: Vec<u64> = (0..n.len())
                .map(|i| simd_diff_lane(op, extend(n[i]), extend(m[i]), held[i], esize))
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, wide));
        }
        SimdDiffShape::Wide => {
            let n = read_lanes(regs.read_fpr_q(rn), wide, 16);
            let m = read_half_lanes(regs.read_fpr_q(rm), esize, upper);
            let held = read_lanes(regs.read_fpr_q(rd), wide, 16);
            let out: Vec<u64> = (0..m.len())
                .map(|i| simd_diff_lane(op, i128::from(n[i]), extend(m[i]), held[i], esize))
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, wide));
        }
        SimdDiffShape::Narrow => {
            let n = read_lanes(regs.read_fpr_q(rn), wide, 16);
            let m = read_lanes(regs.read_fpr_q(rm), wide, 16);
            let out: Vec<u64> = (0..n.len())
                .map(|i| simd_diff_lane(op, i128::from(n[i]), i128::from(m[i]), 0, esize))
                .collect();
            write_half(regs, rd, upper, pack_lanes(&out, esize));
        }
    }
}

/// One lane of a shift by immediate at the lane's own width. `d` is the
/// destination lane, which the accumulating and inserting rows read.
fn simd_shift_same_lane(op: SimdShiftOp, a: u64, d: u64, shift: u8, esize: u8) -> u64 {
    let mask = lane_mask(esize);
    let s = u32::from(shift);
    // A right shift of the whole lane width is a legal encoding
    // (`ushr v3.2d, v7.2d, #64`), so the arithmetic runs in 128 bits
    // where shifting a lane entirely away is defined rather than UB.
    let signed = i128::from(lane_signed(a, esize));
    let unsigned = i128::from(a);
    let asr = (signed >> s) as u64;
    let lsr = (unsigned >> s) as u64;
    let round = |value: i128| ((value + (1i128 << (s - 1))) >> s) as u64;
    match op {
        SimdShiftOp::Shl => (a << s) & mask,
        SimdShiftOp::Sshr => asr & mask,
        SimdShiftOp::Ushr => lsr & mask,
        SimdShiftOp::Ssra => d.wrapping_add(asr) & mask,
        SimdShiftOp::Usra => d.wrapping_add(lsr) & mask,
        SimdShiftOp::Srshr => round(signed) & mask,
        SimdShiftOp::Urshr => round(unsigned) & mask,
        SimdShiftOp::Srsra => d.wrapping_add(round(signed)) & mask,
        SimdShiftOp::Ursra => d.wrapping_add(round(unsigned)) & mask,
        // SLI keeps the destination's low `shift` bits and SRI its high
        // ones: the bits the shift would have left undefined.
        SimdShiftOp::Sli => ((a << s) | (d & ((1u64 << s) - 1))) & mask,
        SimdShiftOp::Sri => {
            let kept = (u128::from(mask) & !(u128::from(mask) >> s)) as u64;
            (((u128::from(a) >> s) as u64) | (d & kept)) & mask
        }
        SimdShiftOp::Sqshl => sat_signed(signed << s, esize),
        SimdShiftOp::Uqshl => sat_unsigned(unsigned << s, esize),
        // SQSHLU reads the lane SIGNED and saturates it into an UNSIGNED
        // one, so a negative lane clamps at zero however far it shifts.
        SimdShiftOp::Sqshlu => sat_unsigned(signed << s, esize),
        _ => unreachable!("the lengthening and narrowing shifts have their own lane rules"),
    }
}

/// One lane of a narrowing right shift: the source is twice `esize`
/// wide, and what will not fit in the result lane is where every one of
/// these saturates.
fn simd_shift_narrow_lane(op: SimdShiftOp, a: u64, shift: u8, esize: u8) -> u64 {
    let wide = esize * 2;
    let s = u32::from(shift);
    let signed = i128::from(lane_signed(a, wide));
    let unsigned = i128::from(a);
    let half_ulp = 1i128 << (s - 1);
    match op {
        SimdShiftOp::Shrn => ((unsigned >> s) as u64) & lane_mask(esize),
        SimdShiftOp::Rshrn => (((unsigned + half_ulp) >> s) as u64) & lane_mask(esize),
        SimdShiftOp::Sqshrn => sat_signed(signed >> s, esize),
        SimdShiftOp::Sqrshrn => sat_signed((signed + half_ulp) >> s, esize),
        SimdShiftOp::Uqshrn => sat_unsigned(unsigned >> s, esize),
        SimdShiftOp::Uqrshrn => sat_unsigned((unsigned + half_ulp) >> s, esize),
        // The UN pair read the source signed and answer an unsigned
        // lane, so a negative source clamps at zero.
        SimdShiftOp::Sqshrun => sat_unsigned(signed >> s, esize),
        SimdShiftOp::Sqrshrun => sat_unsigned((signed + half_ulp) >> s, esize),
        _ => unreachable!("only the narrowing shifts reach this"),
    }
}

#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_shift_imm(
    op: SimdShiftOp,
    esize: u8,
    q: bool,
    scalar: bool,
    shift: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let row = simd_shift_row(op);
    let wide = esize * 2;
    match row.shape {
        SimdShiftShape::Same => {
            let bytes = if scalar {
                esize
            } else if q {
                16
            } else {
                8
            };
            let source = read_lanes(regs.read_fpr_q(rn), esize, bytes);
            let held = read_lanes(regs.read_fpr_q(rd), esize, bytes);
            let out: Vec<u64> = (0..source.len())
                .map(|i| simd_shift_same_lane(op, source[i], held[i], shift, esize))
                .collect();
            if scalar {
                regs.write_fpr_scalar(rd, esize, out[0]);
            } else {
                regs.write_fpr_q(rd, pack_lanes(&out, esize));
            }
        }
        // SSHLL and USHLL extend each lane to twice its width and then
        // shift, so nothing can leave the result lane.
        SimdShiftShape::Long => {
            let signed = op == SimdShiftOp::Sshll;
            let lanes = read_half_lanes(regs.read_fpr_q(rn), esize, q);
            let out: Vec<u64> = lanes
                .iter()
                .map(|lane| {
                    let extended = if signed { lane_signed(*lane, esize) as u64 } else { *lane };
                    (extended << shift) & lane_mask(wide)
                })
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, wide));
        }
        SimdShiftShape::Narrow => {
            let read = if scalar { wide } else { 16 };
            let lanes = read_lanes(regs.read_fpr_q(rn), wide, read);
            let out: Vec<u64> = lanes
                .iter()
                .map(|lane| simd_shift_narrow_lane(op, *lane, shift, esize))
                .collect();
            if scalar {
                regs.write_fpr_scalar(rd, esize, out[0]);
            } else {
                write_half(regs, rd, q, pack_lanes(&out, esize));
            }
        }
    }
}

pub(super) fn exec_simd_across(
    op: SimdAcrossOp,
    esize: u8,
    q: bool,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let bytes = if q { 16 } else { 8 };
    let lanes = read_lanes(regs.read_fpr_q(rn), esize, bytes);
    let signed = |value: &u64| i128::from(lane_signed(*value, esize));
    let (width, value) = match op {
        // The widening sums add at twice the lane width before they
        // fold, so nothing is lost on the way to the destination.
        SimdAcrossOp::Saddlv => {
            let sum = lanes.iter().map(signed).sum::<i128>();
            (esize * 2, sum as u64 & lane_mask(esize * 2))
        }
        SimdAcrossOp::Uaddlv => {
            let sum = lanes.iter().map(|v| i128::from(*v)).sum::<i128>();
            (esize * 2, sum as u64 & lane_mask(esize * 2))
        }
        SimdAcrossOp::Addv => {
            let sum = lanes.iter().fold(0u64, |acc, v| acc.wrapping_add(*v));
            (esize, sum & lane_mask(esize))
        }
        SimdAcrossOp::Smaxv => {
            let best = lanes.iter().max_by_key(|v| lane_signed(**v, esize)).copied();
            (esize, best.unwrap_or(0))
        }
        SimdAcrossOp::Sminv => {
            let best = lanes.iter().min_by_key(|v| lane_signed(**v, esize)).copied();
            (esize, best.unwrap_or(0))
        }
        SimdAcrossOp::Umaxv => (esize, lanes.iter().copied().max().unwrap_or(0)),
        SimdAcrossOp::Uminv => (esize, lanes.iter().copied().min().unwrap_or(0)),
        // The SIMD-scalar pairwise ADDP folds the two lanes it has.
        SimdAcrossOp::AddpScalar => {
            let sum = lanes.iter().fold(0u64, |acc, v| acc.wrapping_add(*v));
            (esize, sum & lane_mask(esize))
        }
    };
    regs.write_fpr_scalar(rd, width, value);
}

/// ZIP/UZP/TRN: one destination lane per rule, read out of the two
/// sources laid end to end. Nothing here is arithmetic, so the lanes
/// move as bit patterns whatever their width.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_permute(
    op: SimdPermuteOp,
    esize: u8,
    q: bool,
    rm: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let bytes = if q { 16 } else { 8 };
    let n = read_lanes(regs.read_fpr_q(rn), esize, bytes);
    let m = read_lanes(regs.read_fpr_q(rm), esize, bytes);
    let count = n.len();
    let half = count / 2;
    let pairs: Vec<u64> = n.iter().chain(m.iter()).copied().collect();
    let out: Vec<u64> = (0..count)
        .map(|i| match op {
            // The ZIPs interleave one half of each source.
            SimdPermuteOp::Zip1 => {
                if i % 2 == 0 { n[i / 2] } else { m[i / 2] }
            }
            SimdPermuteOp::Zip2 => {
                if i % 2 == 0 { n[half + i / 2] } else { m[half + i / 2] }
            }
            // The UZPs take every other lane of the two concatenated.
            SimdPermuteOp::Uzp1 => pairs[i * 2],
            SimdPermuteOp::Uzp2 => pairs[i * 2 + 1],
            // The TRNs take the even (or odd) lanes of both.
            SimdPermuteOp::Trn1 => {
                if i % 2 == 0 { n[i] } else { m[i - 1] }
            }
            SimdPermuteOp::Trn2 => {
                if i % 2 == 0 { n[i + 1] } else { m[i] }
            }
        })
        .collect();
    regs.write_fpr_q(rd, pack_lanes(&out, esize));
}

/// EXT: a byte window into Vn:Vm starting `index` bytes in. The 8b form
/// concatenates the low halves, so its window can only reach 15 bytes.
pub(super) fn exec_simd_ext(q: bool, index: u8, rm: u8, rn: u8, rd: u8, regs: &mut RegisterFile) {
    let bytes = if q { 16usize } else { 8 };
    let n = regs.read_fpr_q(rn).to_le_bytes();
    let m = regs.read_fpr_q(rm).to_le_bytes();
    let source: Vec<u8> = n[..bytes].iter().chain(m[..bytes].iter()).copied().collect();
    let mut out = [0u8; 16];
    for (i, slot) in out[..bytes].iter_mut().enumerate() {
        *slot = source[usize::from(index) + i];
    }
    regs.write_fpr_q(rd, u128::from_le_bytes(out));
}

/// TBL and TBX: every byte of Vm indexes a byte table made of `len`
/// registers from Vn on, wrapping past v31. An index past the table
/// answers zero for TBL and leaves the destination byte for TBX.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_table_lookup(
    extend: bool,
    q: bool,
    len: u8,
    rm: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let bytes = if q { 16usize } else { 8 };
    let mut table: Vec<u8> = Vec::with_capacity(usize::from(len) * 16);
    for step in 0..u32::from(len) {
        let reg = ((u32::from(rn) + step) % 32) as u8;
        table.extend_from_slice(&regs.read_fpr_q(reg).to_le_bytes());
    }
    let indices = regs.read_fpr_q(rm).to_le_bytes();
    let held = regs.read_fpr_q(rd).to_le_bytes();
    let mut out = [0u8; 16];
    for (i, slot) in out[..bytes].iter_mut().enumerate() {
        *slot = match table.get(usize::from(indices[i])) {
            Some(byte) => *byte,
            None if extend => held[i],
            None => 0,
        };
    }
    regs.write_fpr_q(rd, u128::from_le_bytes(out));
}

/// The by-element multiplies. One lane of Vm stands in for the whole
/// second source, so the arithmetic is the three-same and
/// three-different lane functions unchanged, with that lane broadcast.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn exec_simd_by_element(
    op: SimdElemOp,
    esize: u8,
    q: bool,
    scalar: bool,
    index: u8,
    rm: u8,
    rn: u8,
    rd: u8,
    regs: &mut RegisterFile,
) {
    let row = simd_elem_row(op);
    let element = read_lanes(regs.read_fpr_q(rm), esize, 16)[usize::from(index)];
    match row.kind {
        SimdElemKind::Same(same) => {
            let bytes = if scalar { esize } else if q { 16 } else { 8 };
            let n = read_lanes(regs.read_fpr_q(rn), esize, bytes);
            let d = read_lanes(regs.read_fpr_q(rd), esize, bytes);
            let out: Vec<u64> = (0..n.len())
                .map(|i| simd_same_lane(same, n[i], element, d[i], esize))
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, esize));
        }
        SimdElemKind::Long(diff) => {
            let wide = esize * 2;
            let signed = simd_diff_signed(diff);
            let extend = |lane: u64| -> i128 {
                if signed {
                    i128::from(lane_signed(lane, esize))
                } else {
                    i128::from(lane)
                }
            };
            if scalar {
                let n = read_lanes(regs.read_fpr_q(rn), esize, esize)[0];
                let d = read_lanes(regs.read_fpr_q(rd), wide, wide)[0];
                let out = simd_diff_lane(diff, extend(n), extend(element), d, esize);
                regs.write_fpr_scalar(rd, wide, out);
                return;
            }
            // Q is the `2` suffix here, exactly as in the three-different
            // class: it names the half of Vn the narrow lanes come from.
            let n = read_half_lanes(regs.read_fpr_q(rn), esize, q);
            let held = read_lanes(regs.read_fpr_q(rd), wide, 16);
            let out: Vec<u64> = (0..n.len())
                .map(|i| simd_diff_lane(diff, extend(n[i]), extend(element), held[i], esize))
                .collect();
            regs.write_fpr_q(rd, pack_lanes(&out, wide));
        }
    }
}
