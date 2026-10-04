//! The integer data-processing instructions: add and subtract in every
//! form, move wide, logical, conditional select, multiply and divide,
//! the bitfield moves, and the one-source bit and byte reversals.

use super::*;

// ---------------------------------------------------------------------------
// instruction implementations
// ---------------------------------------------------------------------------

pub(super) fn exec_dp_imm(
    op: DpOp, sf: bool, rd: u8, rn: u8, imm: u32, shift: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let operand1 = regs.read_gpr_or_sp(rn, sf);
    let operand2 = (imm as u64) << shift;
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };

    let (result, flags) = match op {
        DpOp::Add | DpOp::Adds => {
            let r = operand1.wrapping_add(operand2) & mask;
            (r, add_flags(operand1, operand2, r, sf))
        }
        DpOp::Sub | DpOp::Subs => {
            let r = operand1.wrapping_sub(operand2) & mask;
            (r, sub_flags(operand1, operand2, r, sf))
        }
    };

    let sets_flags = matches!(op, DpOp::Adds | DpOp::Subs);

    if sets_flags {
        regs.nzcv = flags;
        // ADDS/SUBS write to GPR (rd=31 is XZR, e.g. CMP)
        regs.write_gpr(rd, sf, result);
    } else {
        // ADD/SUB rd=31 means SP
        regs.write_gpr_or_sp(rd, sf, result);
    }

    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_dp_reg(
    op: DpOp, sf: bool, rd: u8, rn: u8, rm: u8,
    shift: ShiftType, amount: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let operand1 = regs.read_gpr(rn, sf);
    let operand2 = apply_shift(regs.read_gpr(rm, sf), shift, amount, sf);
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };

    let (result, flags) = match op {
        DpOp::Add | DpOp::Adds => {
            let r = operand1.wrapping_add(operand2) & mask;
            (r, add_flags(operand1, operand2, r, sf))
        }
        DpOp::Sub | DpOp::Subs => {
            let r = operand1.wrapping_sub(operand2) & mask;
            (r, sub_flags(operand1, operand2, r, sf))
        }
    };

    let sets_flags = matches!(op, DpOp::Adds | DpOp::Subs);
    if sets_flags {
        regs.nzcv = flags;
    }
    regs.write_gpr(rd, sf, result);

    Ok(ExecResult::Advance)
}

pub(super) fn exec_dp_carry(
    sub: bool, set_flags: bool, sf: bool, rd: u8, rn: u8, rm: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    // Register 31 is ZR in all three positions: this family has no SP form.
    let operand1 = regs.read_gpr(rn, sf);
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
    // SBC is the same adder with Rm inverted: Rn + NOT(Rm) + C, which is
    // Rn - Rm - (1 - C). Inverting at the register width keeps the W form's
    // NOT inside 32 bits.
    let operand2 = if sub {
        !regs.read_gpr(rm, sf) & mask
    } else {
        regs.read_gpr(rm, sf)
    };

    let (result, flags) = add_with_carry(operand1, operand2, regs.carry_flag(), sf);
    if set_flags {
        regs.nzcv = flags;
    }
    regs.write_gpr(rd, sf, result);

    Ok(ExecResult::Advance)
}

/// Extend Rm's value per the extended-register option field. Widths
/// narrower than the register zero- or sign-extend the low bits.
fn extend_reg(value: u64, extend: RegExtend) -> u64 {
    match extend {
        RegExtend::Uxtb => value & 0xFF,
        RegExtend::Uxth => value & 0xFFFF,
        RegExtend::Uxtw => value & 0xFFFF_FFFF,
        RegExtend::Uxtx => value,
        RegExtend::Sxtb => value as u8 as i8 as i64 as u64,
        RegExtend::Sxth => value as u16 as i16 as i64 as u64,
        RegExtend::Sxtw => value as u32 as i32 as i64 as u64,
        RegExtend::Sxtx => value,
    }
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_dp_ext(
    op: DpOp, sf: bool, rd: u8, rn: u8, rm: u8,
    extend: RegExtend, shift: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
    // Register 31 means SP for Rn (and for Rd in the non-flag-setting
    // ops), and reaching SP is this form's whole purpose. Rm = 31 is XZR.
    let operand1 = regs.read_gpr_or_sp(rn, sf);
    let operand2 = (extend_reg(regs.read_gpr(rm, sf), extend) << shift) & mask;

    let (result, flags) = match op {
        DpOp::Add | DpOp::Adds => {
            let r = operand1.wrapping_add(operand2) & mask;
            (r, add_flags(operand1, operand2, r, sf))
        }
        DpOp::Sub | DpOp::Subs => {
            let r = operand1.wrapping_sub(operand2) & mask;
            (r, sub_flags(operand1, operand2, r, sf))
        }
    };

    if matches!(op, DpOp::Adds | DpOp::Subs) {
        regs.nzcv = flags;
        // The flag-setting forms keep Rd = 31 as XZR (CMP/CMN discard).
        regs.write_gpr(rd, sf, result);
    } else {
        regs.write_gpr_or_sp(rd, sf, result);
    }

    Ok(ExecResult::Advance)
}

pub(super) fn exec_move_wide(
    op: MoveWideOp, sf: bool, rd: u8, imm16: u16, hw: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let shift = (hw as u64) * 16;
    let value = (imm16 as u64) << shift;

    let result = match op {
        MoveWideOp::Movz => value,
        MoveWideOp::Movn => {
            let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
            !value & mask
        }
        MoveWideOp::Movk => {
            let old = regs.read_gpr(rd, sf);
            let clear_mask = !(0xFFFF_u64 << shift);
            (old & clear_mask) | value
        }
    };

    regs.write_gpr(rd, sf, result);
    Ok(ExecResult::Advance)
}

pub(super) fn exec_log_imm(
    op: LogOp, sf: bool, rd: u8, rn: u8, imm: u64, set_flags: bool,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let operand1 = regs.read_gpr(rn, sf);

    let result = match op {
        LogOp::And => operand1 & imm,
        LogOp::Orr => operand1 | imm,
        LogOp::Eor => operand1 ^ imm,
    };

    let result = if sf { result } else { result & 0xFFFF_FFFF };

    if set_flags {
        regs.nzcv = logic_flags(result, sf);
        regs.write_gpr(rd, sf, result); // ANDS: rd=31 is XZR (TST alias)
    } else {
        regs.write_gpr_or_sp(rd, sf, result); // AND/ORR/EOR imm: rd=31 is SP
    }

    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_log_reg(
    op: LogOp, sf: bool, rd: u8, rn: u8, rm: u8,
    shift: ShiftType, amount: u8, set_flags: bool, invert: bool,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let operand1 = regs.read_gpr(rn, sf);
    let mut operand2 = apply_shift(regs.read_gpr(rm, sf), shift, amount, sf);
    if invert {
        operand2 = if sf { !operand2 } else { !operand2 & 0xFFFF_FFFF };
    }

    let result = match op {
        LogOp::And => operand1 & operand2,
        LogOp::Orr => operand1 | operand2,
        LogOp::Eor => operand1 ^ operand2,
    };

    let result = if sf { result } else { result & 0xFFFF_FFFF };

    if set_flags {
        regs.nzcv = logic_flags(result, sf);
    }
    regs.write_gpr(rd, sf, result);

    Ok(ExecResult::Advance)
}

pub(super) fn exec_cond_sel(
    op: CondSelOp, sf: bool, rd: u8, rn: u8, rm: u8,
    cond: Condition, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let taken = regs.condition_holds(cond);
    let val_n = regs.read_gpr(rn, sf);
    let val_m = regs.read_gpr(rm, sf);

    let result = match op {
        CondSelOp::Csel => {
            if taken { val_n } else { val_m }
        }
        CondSelOp::Csinc => {
            if taken {
                val_n
            } else {
                let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
                val_m.wrapping_add(1) & mask
            }
        }
        CondSelOp::Csinv => {
            if taken {
                val_n
            } else {
                let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
                !val_m & mask
            }
        }
        CondSelOp::Csneg => {
            if taken {
                val_n
            } else {
                let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
                val_m.wrapping_neg() & mask
            }
        }
    };

    regs.write_gpr(rd, sf, result);
    Ok(ExecResult::Advance)
}

pub(super) fn exec_mul_div(
    op: MulDivOp, sf: bool, rd: u8, rn: u8, rm: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let a = regs.read_gpr(rn, sf);
    let b = regs.read_gpr(rm, sf);
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };

    let result = match op {
        MulDivOp::Mul => a.wrapping_mul(b) & mask,
        MulDivOp::Udiv => {
            a.checked_div(b).map_or(0, |q| q & mask)
        }
        MulDivOp::Sdiv => {
            if b == 0 {
                0
            } else if sf {
                ((a as i64).wrapping_div(b as i64) as u64) & mask
            } else {
                ((a as i32).wrapping_div(b as i32) as u32 as u64) & mask
            }
        }
    };

    regs.write_gpr(rd, sf, result);
    Ok(ExecResult::Advance)
}

/// Sign-extend the low `top_bit + 1` bits of `value` to a full 64-bit
/// value. `top_bit` is the index of the field's sign bit.
fn sign_extend_from(value: u64, top_bit: u32) -> u64 {
    if top_bit >= 63 {
        return value;
    }
    let shift = 63 - top_bit;
    (((value << shift) as i64) >> shift) as u64
}

/// SBFM / UBFM extract-and-extend. Mirrors the ARM bitfield-move algorithm
/// for the two cases the course reaches: `imms >= immr` (extract a field
/// from bit `immr` upward: the `sxt*`/`uxt*`/`sbfx`/`ubfx` forms) and
/// `imms < immr` (place a field at the high end: the `sbfiz`/`ubfiz`
/// forms). The LSL/LSR/ASR aliases never reach here; the decoder keeps them
/// on the shifted-register path.
pub(super) fn exec_bitfield(
    op: BitfieldOp, sf: bool, rd: u8, rn: u8, immr: u8, imms: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let datasize: u32 = if sf { 64 } else { 32 };
    let src = regs.read_gpr(rn, sf);
    let r = (immr as u32) % datasize;
    let s = (imms as u32) % datasize;
    let mask_for = |width: u32| -> u64 {
        if width >= 64 {
            u64::MAX
        } else {
            (1u64 << width) - 1
        }
    };

    let result = if s >= r {
        // Extract bits [s:r] (width = s - r + 1) down to bit 0.
        let width = s - r + 1;
        let field = (src >> r) & mask_for(width);
        match op {
            BitfieldOp::Ubfm => field,
            BitfieldOp::Sbfm => sign_extend_from(field, width - 1),
            // BFM in this arm is BFXIL: field lands at bit 0, the
            // destination's upper bits survive.
            BitfieldOp::Bfm => (regs.read_gpr(rd, sf) & !mask_for(width)) | field,
        }
    } else {
        // Place bits [s:0] (width = s + 1) starting at bit (datasize - r).
        let width = s + 1;
        let field = src & mask_for(width);
        let shift = datasize - r;
        let placed = field << shift;
        match op {
            BitfieldOp::Ubfm => placed,
            BitfieldOp::Sbfm => sign_extend_from(placed, shift + s),
            // BFM in this arm is BFI: the field lands at the insert
            // position and every other destination bit survives.
            BitfieldOp::Bfm => {
                (regs.read_gpr(rd, sf) & !(mask_for(width) << shift)) | placed
            }
        }
    };

    regs.write_gpr(rd, sf, result);
    Ok(ExecResult::Advance)
}

pub(super) fn exec_mul_accumulate(
    op: MulAccumulateOp, sf: bool, rd: u8, rn: u8, rm: u8, ra: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let a = regs.read_gpr(rn, sf);
    let b = regs.read_gpr(rm, sf);
    let c = regs.read_gpr(ra, sf);
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
    let product = a.wrapping_mul(b);
    let result = match op {
        MulAccumulateOp::Madd => c.wrapping_add(product) & mask,
        MulAccumulateOp::Msub => c.wrapping_sub(product) & mask,
    };
    regs.write_gpr(rd, sf, result);
    Ok(ExecResult::Advance)
}

/// CLZ/CLS/RBIT/REV/REV16/REV32. Every row is width-aware: a shared
/// 64-bit body answers 32 too high for CLZ at W width and reverses the
/// wrong span for the byte swaps. No flags.
pub(super) fn exec_dp1(
    op: Dp1Op, sf: bool, rd: u8, rn: u8, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let v = regs.read_gpr(rn, sf);
    let result = if sf {
        match op {
            Dp1Op::Rbit => v.reverse_bits(),
            Dp1Op::Rev16 => ((v & 0x00FF_00FF_00FF_00FF) << 8) | ((v >> 8) & 0x00FF_00FF_00FF_00FF),
            Dp1Op::Rev32 => {
                let lo = u64::from((v as u32).swap_bytes());
                let hi = u64::from(((v >> 32) as u32).swap_bytes());
                (hi << 32) | lo
            }
            Dp1Op::Rev => v.swap_bytes(),
            Dp1Op::Clz => u64::from(v.leading_zeros()),
            // ARM's count-leading-sign-bits: the run of bits equal to the
            // top one, minus the top one itself, so 0 and -1 both answer
            // 63 at X width rather than 64.
            Dp1Op::Cls => u64::from(
                (v as i64).leading_zeros().max((!(v as i64)).leading_zeros()) - 1,
            ),
        }
    } else {
        let w = v as u32;
        u64::from(match op {
            Dp1Op::Rbit => w.reverse_bits(),
            Dp1Op::Rev16 => ((w & 0x00FF_00FF) << 8) | ((w >> 8) & 0x00FF_00FF),
            // Rev32 has no W form; the decoder cannot produce it here.
            Dp1Op::Rev32 | Dp1Op::Rev => w.swap_bytes(),
            Dp1Op::Clz => w.leading_zeros(),
            Dp1Op::Cls => (w as i32).leading_zeros().max((!(w as i32)).leading_zeros()) - 1,
        })
    };
    regs.write_gpr(rd, sf, result);
    Ok(ExecResult::Advance)
}

pub(super) fn exec_mul_wide(
    op: MulWideOp, rd: u8, rn: u8, rm: u8, ra: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let result = match op {
        // 32x32 cannot overflow 64 bits, so the plain product is exact.
        MulWideOp::Smull => {
            let a = i64::from(regs.read_gpr(rn, false) as u32 as i32);
            let b = i64::from(regs.read_gpr(rm, false) as u32 as i32);
            (a * b) as u64
        }
        MulWideOp::Umull => {
            let a = regs.read_gpr(rn, false) & 0xFFFF_FFFF;
            let b = regs.read_gpr(rm, false) & 0xFFFF_FFFF;
            a * b
        }
        MulWideOp::Smulh => {
            let a = i128::from(regs.read_gpr(rn, true) as i64);
            let b = i128::from(regs.read_gpr(rm, true) as i64);
            ((a * b) >> 64) as u64
        }
        MulWideOp::Umulh => {
            let a = u128::from(regs.read_gpr(rn, true));
            let b = u128::from(regs.read_gpr(rm, true));
            ((a * b) >> 64) as u64
        }
        // The accumulator is a full 64-bit register even though both
        // sources are 32-bit, so it is read at X width and never masked.
        MulWideOp::Smaddl => {
            let a = i64::from(regs.read_gpr(rn, false) as u32 as i32);
            let b = i64::from(regs.read_gpr(rm, false) as u32 as i32);
            (regs.read_gpr(ra, true) as i64).wrapping_add(a * b) as u64
        }
        MulWideOp::Smsubl => {
            let a = i64::from(regs.read_gpr(rn, false) as u32 as i32);
            let b = i64::from(regs.read_gpr(rm, false) as u32 as i32);
            (regs.read_gpr(ra, true) as i64).wrapping_sub(a * b) as u64
        }
        MulWideOp::Umaddl => {
            let a = regs.read_gpr(rn, false) & 0xFFFF_FFFF;
            let b = regs.read_gpr(rm, false) & 0xFFFF_FFFF;
            regs.read_gpr(ra, true).wrapping_add(a * b)
        }
        MulWideOp::Umsubl => {
            let a = regs.read_gpr(rn, false) & 0xFFFF_FFFF;
            let b = regs.read_gpr(rm, false) & 0xFFFF_FFFF;
            regs.read_gpr(ra, true).wrapping_sub(a * b)
        }
    };
    regs.write_gpr(rd, true, result);
    Ok(ExecResult::Advance)
}
