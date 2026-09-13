use crate::decoder::*;
use crate::errors::EmuError;
use crate::memory::Memory;
use crate::registers::{apply_shift, Condition, NzcvFlags, RegisterFile, ShiftType};

/// Result of executing a single instruction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecResult {
    /// PC was not explicitly set; caller should advance by 4.
    Advance,
    /// PC was explicitly set to a new value (branch).
    Branched,
    /// Execution should halt (bare-metal SVC with imm16 != 0).
    Halted,
    /// Linux supervisor call: `svc #0` with the syscall number in `x8`.
    /// Caller dispatches to `hosted::syscalls` and advances PC by 4 on
    /// return, since the "return from svc" semantics don't touch LR.
    Syscall,
}

// ---------------------------------------------------------------------------
// flag helpers
// ---------------------------------------------------------------------------

/// Compute NZCV for an addition: result = a + b.
fn add_flags(a: u64, b: u64, result: u64, sf: bool) -> NzcvFlags {
    let (sign_bit, mask) = if sf {
        (63u8, u64::MAX)
    } else {
        (31, 0xFFFF_FFFF)
    };
    let ra = a & mask;
    let rb = b & mask;
    let rr = result & mask;

    NzcvFlags {
        n: (rr >> sign_bit) & 1 == 1,
        z: rr == 0,
        c: if sf {
            // unsigned overflow: result < either operand
            rr < ra
        } else {
            (ra as u32).checked_add(rb as u32).is_none()
        },
        v: {
            // signed overflow: operands same sign, result different sign
            let sa = (ra >> sign_bit) & 1;
            let sb = (rb >> sign_bit) & 1;
            let sr = (rr >> sign_bit) & 1;
            sa == sb && sa != sr
        },
    }
}

/// Compute NZCV for a subtraction: result = a - b.
fn sub_flags(a: u64, b: u64, result: u64, sf: bool) -> NzcvFlags {
    let (sign_bit, mask) = if sf {
        (63u8, u64::MAX)
    } else {
        (31, 0xFFFF_FFFF)
    };
    let ra = a & mask;
    let rb = b & mask;
    let rr = result & mask;

    NzcvFlags {
        n: (rr >> sign_bit) & 1 == 1,
        z: rr == 0,
        // ARM64 carry for SUB is "not borrow": C=1 when a >= b (unsigned)
        c: ra >= rb,
        v: {
            let sa = (ra >> sign_bit) & 1;
            let sb = (rb >> sign_bit) & 1;
            let sr = (rr >> sign_bit) & 1;
            sa != sb && sa != sr
        },
    }
}

/// The ARM `AddWithCarry` primitive: result = a + b + carry_in at the
/// register width, with the NZCV the architecture derives from it.
///
/// ADC/ADCS/SBC/SBCS cannot reuse `add_flags`/`sub_flags`: those assume a
/// carry-in of 0 and 1 respectively, so with the other carry-in the borrow
/// chain differs and C comes out wrong. Carrying the sum in a u128 keeps the
/// carry-out visible at both widths without a special case per width.
fn add_with_carry(a: u64, b: u64, carry_in: bool, sf: bool) -> (u64, NzcvFlags) {
    let (sign_bit, mask) = if sf {
        (63u8, u64::MAX)
    } else {
        (31, 0xFFFF_FFFF)
    };
    let ra = a & mask;
    let rb = b & mask;
    let carry = u128::from(carry_in);

    let usum = u128::from(ra) + u128::from(rb) + carry;
    let result = (usum as u64) & mask;

    // Signed overflow: the same operand-sign test the add path uses, which
    // holds for any carry-in because the carry only ever shifts the result
    // by one.
    let sa = (ra >> sign_bit) & 1;
    let sb = (rb >> sign_bit) & 1;
    let sr = (result >> sign_bit) & 1;

    let flags = NzcvFlags {
        n: sr == 1,
        z: result == 0,
        // C is the carry OUT of the register width: the exact sum did not
        // fit in 32/64 bits.
        c: usum > u128::from(mask),
        v: sa == sb && sa != sr,
    };
    (result, flags)
}

/// Compute N and Z flags for logical operations (C and V cleared).
fn logic_flags(result: u64, sf: bool) -> NzcvFlags {
    let sign_bit = if sf { 63u8 } else { 31 };
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
    let rr = result & mask;
    NzcvFlags {
        n: (rr >> sign_bit) & 1 == 1,
        z: rr == 0,
        c: false,
        v: false,
    }
}

// ---------------------------------------------------------------------------
// main execute function
// ---------------------------------------------------------------------------

/// Execute a decoded instruction, updating registers and memory.
pub fn execute(
    instr: &Instruction,
    regs: &mut RegisterFile,
    mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    match instr {
        Instruction::DpImm { op, sf, rd, rn, imm, shift } => {
            exec_dp_imm(*op, *sf, *rd, *rn, *imm, *shift, regs)
        }
        Instruction::DpReg { op, sf, rd, rn, rm, shift, amount } => {
            exec_dp_reg(*op, *sf, *rd, *rn, *rm, *shift, *amount, regs)
        }
        Instruction::DpRegExt { op, sf, rd, rn, rm, extend, shift } => {
            exec_dp_ext(*op, *sf, *rd, *rn, *rm, *extend, *shift, regs)
        }
        Instruction::DpCarry { sub, set_flags, sf, rd, rn, rm } => {
            exec_dp_carry(*sub, *set_flags, *sf, *rd, *rn, *rm, regs)
        }
        Instruction::CondCompare { sub, sf, rn, operand, cond, nzcv } => {
            if regs.nzcv.check(*cond) {
                let a = regs.read_gpr(*rn, *sf);
                let b = match operand {
                    CondCmpOperand::Reg(rm) => regs.read_gpr(*rm, *sf),
                    CondCmpOperand::Imm(imm) => u64::from(*imm),
                };
                regs.nzcv = if *sub {
                    sub_flags(a, b, a.wrapping_sub(b), *sf)
                } else {
                    add_flags(a, b, a.wrapping_add(b), *sf)
                };
            } else {
                // The false path WRITES the literal; it does not leave the
                // old flags in place. That difference is invisible in
                // every short-circuit idiom and visible only when the
                // literal forces a condition the compare would not.
                regs.nzcv = NzcvFlags::unpack(*nzcv);
            }
            Ok(ExecResult::Advance)
        }
        Instruction::DataProc1 { op, sf, rd, rn } => exec_dp1(*op, *sf, *rd, *rn, regs),
        Instruction::VarShift { sf, rd, rn, rm, shift } => {
            // Shift amount is Rm modulo the register width (apply_shift
            // owns the modulo); truncating to u8 first keeps the low bits
            // that matter.
            let amount = regs.read_gpr(*rm, *sf) as u8;
            let result = apply_shift(regs.read_gpr(*rn, *sf), *shift, amount, *sf);
            regs.write_gpr(*rd, *sf, result);
            Ok(ExecResult::Advance)
        }
        Instruction::MoveWide { op, sf, rd, imm16, hw } => {
            exec_move_wide(*op, *sf, *rd, *imm16, *hw, regs)
        }
        Instruction::LogImm { op, sf, rd, rn, imm, set_flags } => {
            exec_log_imm(*op, *sf, *rd, *rn, *imm, *set_flags, regs)
        }
        Instruction::LogReg { op, sf, rd, rn, rm, shift, amount, set_flags, invert } => {
            exec_log_reg(*op, *sf, *rd, *rn, *rm, *shift, *amount, *set_flags, *invert, regs)
        }
        Instruction::LdSt { op, rt, rn, offset, size, mode } => {
            exec_ldst(*op, *rt, *rn, offset, *size, *mode, regs, mem)
        }
        Instruction::LdStPair { op, sf, rt, rt2, rn, imm7, mode } => {
            exec_ldst_pair(*op, *sf, *rt, *rt2, *rn, *imm7, *mode, regs, mem)
        }
        Instruction::FpLdStPair { op, size, rt, rt2, rn, imm7, mode, .. } => {
            exec_fp_ldst_pair(*op, *size, *rt, *rt2, *rn, *imm7, *mode, regs, mem)
        }
        Instruction::LdrLiteral { sf, rt, offset } => {
            exec_ldr_literal(*sf, *rt, *offset, regs, mem)
        }
        Instruction::FpLdrLiteral { rt, offset, size } => {
            exec_fp_ldr_literal(*rt, *offset, *size, regs, mem)
        }
        Instruction::CompareBranch { sf, rt, nonzero, offset } => {
            exec_compare_branch(*sf, *rt, *nonzero, *offset, regs)
        }
        Instruction::TestBranch { rt, bit_pos, nonzero, offset } => {
            exec_test_branch(*rt, *bit_pos, *nonzero, *offset, regs)
        }
        Instruction::BrImm { link, offset } => {
            exec_br_imm(*link, *offset, regs)
        }
        Instruction::BrReg { op, rn } => {
            exec_br_reg(*op, *rn, regs)
        }
        Instruction::BCond { cond, offset } => {
            exec_bcond(*cond, *offset, regs)
        }
        Instruction::CondSel { op, sf, rd, rn, rm, cond } => {
            exec_cond_sel(*op, *sf, *rd, *rn, *rm, *cond, regs)
        }
        Instruction::MulDiv { op, sf, rd, rn, rm } => {
            exec_mul_div(*op, *sf, *rd, *rn, *rm, regs)
        }
        Instruction::MulAccumulate { op, sf, rd, rn, rm, ra } => {
            exec_mul_accumulate(*op, *sf, *rd, *rn, *rm, *ra, regs)
        }
        Instruction::MulWide { op, rd, rn, rm, ra } => {
            exec_mul_wide(*op, *rd, *rn, *rm, *ra, regs)
        }
        Instruction::LdrSignExtended { rt, rn, offset, size, mode, sf } => {
            exec_ldrs(*rt, *rn, offset, *size, *mode, *sf, regs, mem)
        }
        Instruction::FpBinary { op, fd, fn_, fm, single } => {
            exec_fp_binary(*op, *fd, *fn_, *fm, *single, regs)
        }
        Instruction::FpLdSt { load, ft, rn, offset, size, mode, .. } => {
            exec_fp_ldst(*load, *ft, *rn, offset, *size, *mode, regs, mem)
        }
        Instruction::FpMoveImm { fd, imm_bits, single } => {
            // The decoder already expanded the immediate to the right
            // width's bit pattern; an S write leaves the upper 32 zero.
            let _ = single;
            regs.write_fpr_bits(*fd, *imm_bits);
            Ok(ExecResult::Advance)
        }
        Instruction::FpMoveReg { fd, fn_, single } => {
            let v = regs.read_fpr_bits(*fn_);
            let v = if *single { v & 0xFFFF_FFFF } else { v };
            regs.write_fpr_bits(*fd, v);
            Ok(ExecResult::Advance)
        }
        Instruction::FpCondSel { fd, fn_, fm, cond, single } => {
            // Bits, not values: the chosen source may be a NaN or a
            // signed zero, and neither survives a compare-and-rebuild.
            let src = if regs.nzcv.check(*cond) { *fn_ } else { *fm };
            let v = regs.read_fpr_bits(src);
            regs.write_fpr_bits(*fd, if *single { v & 0xFFFF_FFFF } else { v });
            Ok(ExecResult::Advance)
        }
        Instruction::FpScvtfFp { fd, fn_, single } => {
            // The integer bits already sit in Fn; convert at the
            // register's own width. S results are an f32 pattern in the
            // low 32 bits with the upper half zeroed, like every S write.
            let bits = regs.read_fpr_bits(*fn_);
            let out = if *single {
                u64::from(((bits as u32 as i32) as f32).to_bits())
            } else {
                ((bits as i64) as f64).to_bits()
            };
            regs.write_fpr_bits(*fd, out);
            Ok(ExecResult::Advance)
        }
        Instruction::FpMoveGeneral { to_fp, sf, single, rd, rn } => {
            // Raw bits either direction; the S forms move the low 32 bits
            // and (into the FP file) zero the upper half.
            if *to_fp {
                let v = regs.read_gpr(*rn, *sf);
                let v = if *single { v & 0xFFFF_FFFF } else { v };
                regs.write_fpr_bits(*rd, v);
            } else {
                let v = regs.read_fpr_bits(*rn);
                let v = if *single { v & 0xFFFF_FFFF } else { v };
                regs.write_gpr(*rd, *sf, v);
            }
            Ok(ExecResult::Advance)
        }
        Instruction::FpUnary { op, fd, fn_, single } => {
            if *single {
                let v = regs.read_fpr_f32(*fn_);
                let result = match op {
                    FpUnaryOp::Fneg => -v,
                    FpUnaryOp::Fabs => v.abs(),
                    // IEEE: a negative operand yields NaN, never a trap.
                    FpUnaryOp::Fsqrt => default_nan_if_new(v.sqrt(), &[v]),
                };
                regs.write_fpr_f32(*fd, result);
            } else {
                let v = regs.read_fpr_f64(*fn_);
                let result = match op {
                    FpUnaryOp::Fneg => -v,
                    FpUnaryOp::Fabs => v.abs(),
                    FpUnaryOp::Fsqrt => default_nan_if_new(v.sqrt(), &[v]),
                };
                regs.write_fpr_f64(*fd, result);
            }
            Ok(ExecResult::Advance)
        }
        Instruction::FpCompare { fn_, fm, single } => {
            // Widening f32 -> f64 is exact, so the single compare can
            // share the double flag logic (NaN stays NaN, order holds).
            let (a, b) = if *single {
                (regs.read_fpr_f32(*fn_) as f64, regs.read_fpr_f32(*fm) as f64)
            } else {
                (regs.read_fpr_f64(*fn_), regs.read_fpr_f64(*fm))
            };
            regs.nzcv = crate::fpu::fcmp_flags(a, b);
            Ok(ExecResult::Advance)
        }
        Instruction::FpToInt { op, rd, fn_, sf, single, fbits } => {
            exec_fp_to_int(*op, *rd, *fn_, *sf, *single, *fbits, regs)
        }
        Instruction::FpFromInt { op, fd, rn, sf, single, fbits } => {
            exec_fp_from_int(*op, *fd, *rn, *sf, *single, *fbits, regs)
        }
        Instruction::FpMulAdd { op, fd, fn_, fm, fa, single } => {
            exec_fp_mul_add(*op, *fd, *fn_, *fm, *fa, *single, regs)
        }
        Instruction::FpCvt { fd, fn_, widen } => {
            if *widen {
                // FCVT Dd, Sn: every f32 is exactly representable as f64.
                let v = regs.read_fpr_f32(*fn_);
                regs.write_fpr_f64(*fd, v as f64);
            } else {
                // FCVT Sd, Dn: rounds to the nearest single.
                let v = regs.read_fpr_f64(*fn_);
                regs.write_fpr_f32(*fd, v as f32);
            }
            Ok(ExecResult::Advance)
        }
        Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
            exec_bitfield(*op, *sf, *rd, *rn, *immr, *imms, regs)
        }
        Instruction::Adr { adrp, rd, imm } => {
            let pc = regs.read_pc();
            let base = if *adrp { pc & !0xFFF } else { pc };
            let addr = (base as i64).wrapping_add(*imm) as u64;
            regs.write_gpr(*rd, true, addr);
            Ok(ExecResult::Advance)
        }
        Instruction::Nop => Ok(ExecResult::Advance),
        Instruction::Svc { imm16 } => {
            // svc #0 is a Linux supervisor call; imm16 != 0 keeps the
            // bare-metal halt semantics the original examples depend on.
            if *imm16 == 0 {
                Ok(ExecResult::Syscall)
            } else {
                Ok(ExecResult::Halted)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// instruction implementations
// ---------------------------------------------------------------------------

fn exec_dp_imm(
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
fn exec_dp_reg(
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

fn exec_dp_carry(
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

    let (result, flags) = add_with_carry(operand1, operand2, regs.nzcv.c, sf);
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
fn exec_dp_ext(
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

fn exec_move_wide(
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

fn exec_log_imm(
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
fn exec_log_reg(
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

/// The first page is never mapped on Linux; a guest access there is a
/// null or garbage base register, not memory the program owns. Memory
/// auto-maps on write, so without this a store through a zeroed base
/// silently succeeds and the program runs to a wrong answer that the
/// course servers kill with SIGSEGV.
const NULL_PAGE_LIMIT: u64 = 4096;

fn check_guest_address(addr: u64, access: crate::errors::MemAccess) -> Result<(), EmuError> {
    if addr < NULL_PAGE_LIMIT {
        return Err(EmuError::NullPointerAccess { address: addr, access });
    }
    Ok(())
}

/// AArch64 checks SP itself, never the effective address: SCTLR_EL1.SA0
/// is set on Linux, so any load or store using SP as the base faults
/// when SP is off the 16-byte boundary: `ldr w0, [sp, 4]` from an
/// aligned SP is legal, `ldr w0, [sp]` from an SP off by 8 is not.
/// Runs before the offset math and any writeback, like the ARM
/// pseudocode's CheckSPAlignment(). `rn >= 31` mirrors the
/// `read_gpr_or_sp` convention.
fn check_sp_alignment(rn: u8, regs: &RegisterFile) -> Result<(), EmuError> {
    if rn >= 31 {
        let sp = regs.read_sp();
        if !sp.is_multiple_of(16) {
            return Err(EmuError::SpAlignmentFault { sp, at_call: false });
        }
    }
    Ok(())
}

/// The byte displacement a load/store's offset operand contributes. The
/// register form's extend rules are the same for the integer file and the
/// SIMD&FP file, so every load/store path reads them from here.
fn resolve_ldst_offset(offset: &LdStOffset, regs: &RegisterFile) -> i64 {
    match offset {
        LdStOffset::Immediate(imm) => *imm,
        LdStOffset::Register {
            rm,
            extend,
            shift_amount,
        } => {
            let raw = regs.read_gpr(*rm, true);
            let extended = match extend {
                ExtendType::Lsl | ExtendType::Sxtx => raw,
                ExtendType::Uxtw => raw & 0xFFFF_FFFF,
                ExtendType::Sxtw => (raw as i32) as i64 as u64,
            };
            (extended << u64::from(shift_amount.unwrap_or(0))) as i64
        }
    }
}

/// The accessed address and the writeback value (None when the base is
/// left alone) an index mode produces from a base and a displacement.
fn apply_index_mode(base: u64, offset_val: i64, mode: IndexMode) -> (u64, Option<u64>) {
    let moved = (base as i64).wrapping_add(offset_val) as u64;
    match mode {
        IndexMode::PreIndex => (moved, Some(moved)),
        IndexMode::PostIndex => (base, Some(moved)),
        IndexMode::SignedOffset => (moved, None),
    }
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
fn exec_ldst(
    op: LdStOp, rt: u8, rn: u8, offset: &LdStOffset, size: MemSize,
    mode: IndexMode, regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let offset_val = resolve_ldst_offset(offset, regs);
    let (address, writeback) = apply_index_mode(base, offset_val, mode);

    match op {
        LdStOp::Ldr => {
            check_guest_address(address, crate::errors::MemAccess::Read)?;
            let value = match size {
                MemSize::B => mem.read_u8(address)? as u64,
                MemSize::H => mem.read_u16(address)? as u64,
                MemSize::W => mem.read_u32(address)? as u64,
                MemSize::X => mem.read_u64(address)?,
                // Q is a SIMD&FP width; the integer decode never spells it.
                MemSize::Q => return Err(EmuError::UnknownInstruction(0)),
            };
            regs.write_gpr(rt, true, value);
        }
        LdStOp::Str => {
            check_guest_address(address, crate::errors::MemAccess::Write)?;
            let value = regs.read_gpr(rt, true);
            match size {
                MemSize::B => mem.write_u8(address, value as u8)?,
                MemSize::H => mem.write_u16(address, value as u16)?,
                MemSize::W => mem.write_u32(address, value as u32)?,
                MemSize::X => mem.write_u64(address, value)?,
                // Q is a SIMD&FP width; the integer decode never spells it.
                MemSize::Q => return Err(EmuError::UnknownInstruction(0)),
            }
        }
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
fn exec_ldst_pair(
    op: LdStPairOp, sf: bool, rt: u8, rt2: u8, rn: u8,
    imm7: i16, mode: IndexMode,
    regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);

    let (address, writeback) = match mode {
        IndexMode::PreIndex => {
            let addr = (base as i64 + imm7 as i64) as u64;
            (addr, Some(addr))
        }
        IndexMode::PostIndex => {
            let wb = (base as i64 + imm7 as i64) as u64;
            (base, Some(wb))
        }
        IndexMode::SignedOffset => {
            let addr = (base as i64 + imm7 as i64) as u64;
            (addr, None)
        }
    };

    let pair_size: u64 = if sf { 8 } else { 4 };
    let access = match op {
        LdStPairOp::Ldp => crate::errors::MemAccess::Read,
        LdStPairOp::Stp => crate::errors::MemAccess::Write,
    };
    check_guest_address(address, access)?;
    check_guest_address(address.wrapping_add(pair_size), access)?;

    match op {
        LdStPairOp::Ldp => {
            let v1 = if sf {
                mem.read_u64(address)?
            } else {
                mem.read_u32(address)? as u64
            };
            let v2 = if sf {
                mem.read_u64(address + pair_size)?
            } else {
                mem.read_u32(address + pair_size)? as u64
            };
            regs.write_gpr(rt, sf, v1);
            regs.write_gpr(rt2, sf, v2);
        }
        LdStPairOp::Stp => {
            let v1 = regs.read_gpr(rt, sf);
            let v2 = regs.read_gpr(rt2, sf);
            if sf {
                mem.write_u64(address, v1)?;
                mem.write_u64(address + pair_size, v2)?;
            } else {
                mem.write_u32(address, v1 as u32)?;
                mem.write_u32(address + pair_size, v2 as u32)?;
            }
        }
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

/// SIMD&FP LDR/STR at every width the register file has a view for.
/// Base register 31 means SP here, exactly as in the integer load/store
/// path: FP spills sit on the stack. A load writes the scalar view and
/// zeroes every bit above it; a B or H store writes only the low byte or
/// halfword of the register.
#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
fn exec_fp_ldst(
    load: bool, ft: u8, rn: u8, offset: &LdStOffset, size: MemSize,
    mode: IndexMode, regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let offset_val = resolve_ldst_offset(offset, regs);
    let (address, writeback) = apply_index_mode(base, offset_val, mode);
    check_guest_address(
        address,
        if load {
            crate::errors::MemAccess::Read
        } else {
            crate::errors::MemAccess::Write
        },
    )?;

    if load {
        match size {
            MemSize::B => {
                let v = u64::from(mem.read_u8(address)?);
                regs.write_fpr_scalar(ft, 1, v);
            }
            MemSize::H => {
                let v = u64::from(mem.read_u16(address)?);
                regs.write_fpr_scalar(ft, 2, v);
            }
            MemSize::W => {
                let v = u64::from(mem.read_u32(address)?);
                regs.write_fpr_scalar(ft, 4, v);
            }
            MemSize::X => {
                let v = mem.read_u64(address)?;
                regs.write_fpr_scalar(ft, 8, v);
            }
            MemSize::Q => {
                let v = mem.read_u128(address)?;
                regs.write_fpr_q(ft, v);
            }
        }
    } else {
        match size {
            MemSize::B => mem.write_u8(address, regs.read_fpr_bits(ft) as u8)?,
            MemSize::H => mem.write_u16(address, regs.read_fpr_bits(ft) as u16)?,
            MemSize::W => mem.write_u32(address, regs.read_fpr_bits(ft) as u32)?,
            MemSize::X => mem.write_u64(address, regs.read_fpr_bits(ft))?,
            MemSize::Q => mem.write_u128(address, regs.read_fpr_q(ft))?,
        }
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
fn exec_fp_ldst_pair(
    op: LdStPairOp, size: MemSize, rt: u8, rt2: u8, rn: u8,
    imm7: i16, mode: IndexMode,
    regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let (address, writeback) = apply_index_mode(base, imm7 as i64, mode);

    let pair_size = u64::from(size.bytes());
    let access = match op {
        LdStPairOp::Ldp => crate::errors::MemAccess::Read,
        LdStPairOp::Stp => crate::errors::MemAccess::Write,
    };
    check_guest_address(address, access)?;
    check_guest_address(address.wrapping_add(pair_size), access)?;
    let second = address.wrapping_add(pair_size);

    match op {
        LdStPairOp::Ldp => match size {
            // Each element is a scalar destination, so the bits above the
            // loaded width go to zero, like the single-register load.
            MemSize::W => {
                regs.write_fpr_scalar(rt, 4, u64::from(mem.read_u32(address)?));
                regs.write_fpr_scalar(rt2, 4, u64::from(mem.read_u32(second)?));
            }
            MemSize::X => {
                regs.write_fpr_scalar(rt, 8, mem.read_u64(address)?);
                regs.write_fpr_scalar(rt2, 8, mem.read_u64(second)?);
            }
            MemSize::Q => {
                regs.write_fpr_q(rt, mem.read_u128(address)?);
                regs.write_fpr_q(rt2, mem.read_u128(second)?);
            }
            // opc 11 is unallocated, so the decoder never builds a B or H
            // pair.
            MemSize::B | MemSize::H => return Err(EmuError::UnknownInstruction(0)),
        },
        LdStPairOp::Stp => match size {
            MemSize::W => {
                mem.write_u32(address, regs.read_fpr_bits(rt) as u32)?;
                mem.write_u32(second, regs.read_fpr_bits(rt2) as u32)?;
            }
            MemSize::X => {
                mem.write_u64(address, regs.read_fpr_bits(rt))?;
                mem.write_u64(second, regs.read_fpr_bits(rt2))?;
            }
            MemSize::Q => {
                mem.write_u128(address, regs.read_fpr_q(rt))?;
                mem.write_u128(second, regs.read_fpr_q(rt2))?;
            }
            MemSize::B | MemSize::H => return Err(EmuError::UnknownInstruction(0)),
        },
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

fn exec_ldr_literal(
    sf: bool,
    rt: u8,
    offset: i64,
    regs: &mut RegisterFile,
    mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    let pc = regs.read_pc();
    let target = (pc as i64).wrapping_add(offset) as u64;
    if sf {
        let value = mem.read_u64(target)?;
        regs.write_gpr(rt, true, value);
    } else {
        let value = mem.read_u32(target)? as u64;
        regs.write_gpr(rt, false, value);
    }
    Ok(ExecResult::Advance)
}

/// LDR (literal) of a SIMD&FP register: the PC-relative load the linker
/// never emits (the hosted pipeline lowers `ldr s0, label` to two words)
/// but gcc output can carry.
fn exec_fp_ldr_literal(
    rt: u8,
    offset: i64,
    size: MemSize,
    regs: &mut RegisterFile,
    mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    let target = (regs.read_pc() as i64).wrapping_add(offset) as u64;
    check_guest_address(target, crate::errors::MemAccess::Read)?;
    match size {
        MemSize::W => regs.write_fpr_scalar(rt, 4, u64::from(mem.read_u32(target)?)),
        MemSize::X => regs.write_fpr_scalar(rt, 8, mem.read_u64(target)?),
        MemSize::Q => regs.write_fpr_q(rt, mem.read_u128(target)?),
        // opc 11 is unallocated, so the decoder never builds these.
        MemSize::B | MemSize::H => return Err(EmuError::UnknownInstruction(0)),
    }
    Ok(ExecResult::Advance)
}

fn exec_compare_branch(
    sf: bool,
    rt: u8,
    nonzero: bool,
    offset: i64,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let value = regs.read_gpr(rt, sf);
    let take = if nonzero { value != 0 } else { value == 0 };
    if take {
        let pc = regs.read_pc();
        regs.write_pc((pc as i64).wrapping_add(offset) as u64);
        Ok(ExecResult::Branched)
    } else {
        Ok(ExecResult::Advance)
    }
}

fn exec_test_branch(
    rt: u8,
    bit_pos: u8,
    nonzero: bool,
    offset: i64,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    // The architecture always reads the full 64-bit register for tbz/tbnz
    // even for the W-register form, since bit_pos is already constrained
    // by the encoding (b5 is 0 when sf is 0).
    let value = regs.read_gpr(rt, true);
    let bit_set = (value >> bit_pos) & 1 == 1;
    let take = if nonzero { bit_set } else { !bit_set };
    if take {
        let pc = regs.read_pc();
        regs.write_pc((pc as i64).wrapping_add(offset) as u64);
        Ok(ExecResult::Branched)
    } else {
        Ok(ExecResult::Advance)
    }
}

fn exec_br_imm(
    link: bool, offset: i64, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let pc = regs.read_pc();
    if link {
        regs.write_gpr(30, true, pc + 4); // X30 = return address
    }
    regs.write_pc((pc as i64 + offset) as u64);
    Ok(ExecResult::Branched)
}

fn exec_br_reg(
    op: BrRegOp, rn: u8, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let target = regs.read_gpr(rn, true);
    let pc = regs.read_pc();

    match op {
        BrRegOp::Br => {
            regs.write_pc(target);
        }
        BrRegOp::Blr => {
            regs.write_gpr(30, true, pc + 4);
            regs.write_pc(target);
        }
        BrRegOp::Ret => {
            regs.write_pc(target);
        }
    }

    Ok(ExecResult::Branched)
}

fn exec_bcond(
    cond: Condition, offset: i64, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    if regs.nzcv.check(cond) {
        let pc = regs.read_pc();
        regs.write_pc((pc as i64 + offset) as u64);
        Ok(ExecResult::Branched)
    } else {
        Ok(ExecResult::Advance)
    }
}

fn exec_cond_sel(
    op: CondSelOp, sf: bool, rd: u8, rn: u8, rm: u8,
    cond: Condition, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let taken = regs.nzcv.check(cond);
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

fn exec_mul_div(
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

/// What `fp_max` and its siblings need of a float, so the S and D paths
/// run the same body instead of two copies whose NaN rules could drift.
trait FpOperand: Copy + PartialOrd {
    const NAN: Self;
    const ZERO: Self;
    fn is_nan(self) -> bool;
    fn is_sign_negative(self) -> bool;
}

impl FpOperand for f32 {
    const NAN: Self = f32::NAN;
    const ZERO: Self = 0.0;
    fn is_nan(self) -> bool {
        f32::is_nan(self)
    }
    fn is_sign_negative(self) -> bool {
        f32::is_sign_negative(self)
    }
}

impl FpOperand for f64 {
    const NAN: Self = f64::NAN;
    const ZERO: Self = 0.0;
    fn is_nan(self) -> bool {
        f64::is_nan(self)
    }
    fn is_sign_negative(self) -> bool {
        f64::is_sign_negative(self)
    }
}

/// ARM's FPMax with FPCR.AH = 0, the state this emulator models: a NaN
/// operand makes the result NaN, and negative zero compares LESS than
/// positive zero whichever operand it arrives in. Rust's `max` does
/// neither, since it returns the number when one side is NaN and its
/// signed-zero answer is documented as unspecified, so both rules are
/// written out here rather than delegated.
fn fp_max<T: FpOperand>(a: T, b: T) -> T {
    if a.is_nan() || b.is_nan() {
        return T::NAN;
    }
    if a == T::ZERO && b == T::ZERO {
        return if a.is_sign_negative() { b } else { a };
    }
    if a > b { a } else { b }
}

fn fp_min<T: FpOperand>(a: T, b: T) -> T {
    if a.is_nan() || b.is_nan() {
        return T::NAN;
    }
    if a == T::ZERO && b == T::ZERO {
        return if a.is_sign_negative() { a } else { b };
    }
    if a < b { a } else { b }
}

/// FMAXNM / FMINNM are IEEE maxNum / minNum: a quiet NaN operand is
/// ignored and the number wins. The signed-zero rule is FMAX's, so the
/// numeric case delegates rather than restating it.
fn fp_max_num<T: FpOperand>(a: T, b: T) -> T {
    if a.is_nan() {
        return b;
    }
    if b.is_nan() {
        return a;
    }
    fp_max(a, b)
}

fn fp_min_num<T: FpOperand>(a: T, b: T) -> T {
    if a.is_nan() {
        return b;
    }
    if b.is_nan() {
        return a;
    }
    fp_min(a, b)
}

/// Replace a NaN this operation GENERATED with the AArch64 default NaN
/// (0x7FF8000000000000 for D, 0x7FC00000 for S), which is positive. An
/// invalid operation on x86-64 answers with that host's own "indefinite"
/// QNaN instead, whose sign bit is set, so `sqrt(-4.0)` and `0.0 / 0.0`
/// reach the register file as `-nan` where the course servers print
/// `nan`. A NaN that arrived in an OPERAND is left exactly as it is:
/// FPCR.DN is clear here, so a quiet NaN propagates with its own sign and
/// payload.
fn default_nan_if_new<T: FpOperand>(result: T, sources: &[T]) -> T {
    if result.is_nan() && !sources.iter().any(|s| s.is_nan()) {
        T::NAN
    } else {
        result
    }
}

fn exec_fp_binary(
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
        let result = match op {
            FpBinOp::Fadd => default_nan_if_new(a + b, &[a, b]),
            FpBinOp::Fsub => default_nan_if_new(a - b, &[a, b]),
            FpBinOp::Fmul => default_nan_if_new(a * b, &[a, b]),
            FpBinOp::Fdiv => default_nan_if_new(a / b, &[a, b]),
            // The sign flips on the PRODUCT, which is what makes
            // fnmul of +0.0 and 3.0 a -0.0 that (-a) * b never produces.
            // FPNeg runs after FPMul, so the product is normalized first.
            FpBinOp::Fnmul => -default_nan_if_new(a * b, &[a, b]),
            FpBinOp::Fmax => fp_max(a, b),
            FpBinOp::Fmin => fp_min(a, b),
            FpBinOp::Fmaxnm => fp_max_num(a, b),
            FpBinOp::Fminnm => fp_min_num(a, b),
        };
        regs.write_fpr_f32(fd, result);
    } else {
        let a = regs.read_fpr_f64(fn_);
        let b = regs.read_fpr_f64(fm);
        let result = match op {
            FpBinOp::Fadd => default_nan_if_new(a + b, &[a, b]),
            FpBinOp::Fsub => default_nan_if_new(a - b, &[a, b]),
            FpBinOp::Fmul => default_nan_if_new(a * b, &[a, b]),
            FpBinOp::Fdiv => default_nan_if_new(a / b, &[a, b]),
            FpBinOp::Fnmul => -default_nan_if_new(a * b, &[a, b]),
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
fn exec_fp_mul_add(
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
        regs.write_fpr_f32(fd, default_nan_if_new(n.mul_add(m, a), &[n, m, a]));
    } else {
        let n = regs.read_fpr_f64(fn_);
        let m = regs.read_fpr_f64(fm);
        let a = regs.read_fpr_f64(fa);
        let n = if neg_n { -n } else { n };
        let a = if neg_a { -a } else { a };
        regs.write_fpr_f64(fd, default_nan_if_new(n.mul_add(m, a), &[n, m, a]));
    }
    Ok(ExecResult::Advance)
}

/// FCVT{N,A,M,P,Z}{S,U}. Read at the instruction's width, scale by
/// 2^fbits for the fixed-point form, round by the named mode, then
/// saturate at the destination width. Widening f32 to f64 is exact, so
/// one f64 path serves both source widths. No NZCV write: none of these
/// touches the flags.
fn exec_fp_to_int(
    op: FpToIntOp, rd: u8, fn_: u8, sf: bool, single: bool, fbits: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let mut value = if single {
        regs.read_fpr_f32(fn_) as f64
    } else {
        regs.read_fpr_f64(fn_)
    };
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
    regs.write_gpr(rd, sf, result);
    Ok(ExecResult::Advance)
}

/// SCVTF / UCVTF. The only difference is how the source register's bits
/// are read.
fn exec_fp_from_int(
    op: FpFromIntOp, fd: u8, rn: u8, sf: bool, single: bool, fbits: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let raw = regs.read_gpr(rn, sf);
    let mut value = match op {
        FpFromIntOp::Scvtf => {
            let i = if sf { raw as i64 } else { (raw as u32 as i32) as i64 };
            i as f64
        }
        FpFromIntOp::Ucvtf => {
            let u = if sf { raw } else { raw & 0xFFFF_FFFF };
            u as f64
        }
    };
    if fbits != 0 {
        value /= 2f64.powi(i32::from(fbits));
    }
    if single {
        regs.write_fpr_f32(fd, value as f32);
    } else {
        regs.write_fpr_f64(fd, value);
    }
    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
fn exec_ldrs(
    rt: u8,
    rn: u8,
    offset: &LdStOffset,
    size: MemSize,
    mode: IndexMode,
    sf: bool,
    regs: &mut RegisterFile,
    mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    // Compute the effective address using the same offset math as exec_ldst.
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let offset_val = resolve_ldst_offset(offset, regs);
    let (address, writeback) = apply_index_mode(base, offset_val, mode);
    check_guest_address(address, crate::errors::MemAccess::Read)?;
    let value_64 = match size {
        MemSize::B => (mem.read_u8(address)? as i8) as i64,
        MemSize::H => (mem.read_u16(address)? as i16) as i64,
        MemSize::W => (mem.read_u32(address)? as i32) as i64,
        // X is reserved in the sign-extending space and Q is SIMD&FP only.
        MemSize::X | MemSize::Q => return Err(EmuError::UnknownInstruction(0)),
    };
    if sf {
        regs.write_gpr(rt, true, value_64 as u64);
    } else {
        // Write low 32 bits; write_gpr with sf=false zeros upper bits.
        regs.write_gpr(rt, false, (value_64 as u32) as u64);
    }
    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }
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
fn exec_bitfield(
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

fn exec_mul_accumulate(
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
fn exec_dp1(
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

fn exec_mul_wide(
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

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::registers::{Condition, ShiftType};

    fn fresh() -> (RegisterFile, Memory) {
        (RegisterFile::new(), Memory::new())
    }

    // -- MOV family --

    #[test]
    fn movz_x0_42() {
        let (mut regs, mut mem) = fresh();
        let instr = Instruction::MoveWide {
            op: MoveWideOp::Movz, sf: true, rd: 0, imm16: 42, hw: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 42);
    }

    #[test]
    fn movk_preserves_other_bits() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 0x0000_0000_0000_FFFF);
        let instr = Instruction::MoveWide {
            op: MoveWideOp::Movk, sf: true, rd: 1, imm16: 0xABCD, hw: 1,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(1, true), 0x0000_0000_ABCD_FFFF);
    }

    #[test]
    fn movn_inverts() {
        let (mut regs, mut mem) = fresh();
        let instr = Instruction::MoveWide {
            op: MoveWideOp::Movn, sf: false, rd: 2, imm16: 0, hw: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(2, true), 0xFFFF_FFFF);
    }

    // -- ADD/SUB --

    #[test]
    fn add_imm_basic() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 100);
        let instr = Instruction::DpImm {
            op: DpOp::Add, sf: true, rd: 0, rn: 1, imm: 50, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 150);
    }

    #[test]
    fn subs_sets_zero_flag() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 10);
        let instr = Instruction::DpImm {
            op: DpOp::Subs, sf: true, rd: 31, rn: 1, imm: 10, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert!(regs.nzcv.z);
        assert!(!regs.nzcv.n);
    }

    #[test]
    fn subs_sets_negative_flag() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 5);
        let instr = Instruction::DpImm {
            op: DpOp::Subs, sf: true, rd: 0, rn: 1, imm: 10, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert!(regs.nzcv.n);
        assert!(!regs.nzcv.z);
    }

    #[test]
    fn adds_carry_32bit() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, 0xFFFF_FFFF);
        let instr = Instruction::DpImm {
            op: DpOp::Adds, sf: false, rd: 0, rn: 1, imm: 1, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, false), 0);
        assert!(regs.nzcv.c);
        assert!(regs.nzcv.z);
    }

    #[test]
    fn sub_reg_with_shift() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 100);
        regs.write_gpr(2, true, 5);
        let instr = Instruction::DpReg {
            op: DpOp::Sub, sf: true, rd: 0, rn: 1, rm: 2,
            shift: ShiftType::LSL, amount: 2,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 80); // 100 - 5*4
    }

    // -- logical --

    #[test]
    fn and_imm() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 0xFF);
        let instr = Instruction::LogImm {
            op: LogOp::And, sf: true, rd: 0, rn: 1, imm: 0x0F, set_flags: false,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0x0F);
    }

    #[test]
    fn orr_reg_as_mov() {
        // MOV X0, X1 is ORR X0, XZR, X1
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 0xDEAD);
        let instr = Instruction::LogReg {
            op: LogOp::Orr, sf: true, rd: 0, rn: 31, rm: 1,
            shift: ShiftType::LSL, amount: 0, set_flags: false, invert: false,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0xDEAD);
    }

    #[test]
    fn mvn_inverts_register() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, 0x0000_00FF);
        let instr = Instruction::LogReg {
            op: LogOp::Orr, sf: false, rd: 0, rn: 31, rm: 1,
            shift: ShiftType::LSL, amount: 0, set_flags: false, invert: true,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0xFFFF_FF00);
    }

    #[test]
    fn bic_clears_masked_bits() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, 0b1111_1111);
        regs.write_gpr(2, false, 0b0000_1111);
        let instr = Instruction::LogReg {
            op: LogOp::And, sf: false, rd: 0, rn: 1, rm: 2,
            shift: ShiftType::LSL, amount: 0, set_flags: false, invert: true,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0b1111_0000);
    }

    #[test]
    fn ubfx_extracts_mid_field() {
        // Extract bits [7:4] of 0xAB: field is 0xA.
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, 0xAB);
        let instr = Instruction::Bitfield {
            op: BitfieldOp::Ubfm, sf: false, rd: 0, rn: 1, immr: 4, imms: 7,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0xA);
    }

    #[test]
    fn bfi_inserts_and_keeps_surroundings() {
        // Insert 0xC at bits [11:8] of 0xFFFF: only that nibble changes.
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, false, 0xFFFF);
        regs.write_gpr(1, false, 0xC);
        // bfi w0, w1, #8, #4 -> BFM immr = 24, imms = 3.
        let instr = Instruction::Bitfield {
            op: BitfieldOp::Bfm, sf: false, rd: 0, rn: 1, immr: 24, imms: 3,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0xFCFF);
    }

    #[test]
    fn bfi_at_lsb_zero_keeps_upper_bits() {
        // immr = 0 takes the s >= r arm (BFXIL shape): low byte replaced.
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, true, 0xABCD_1234);
        regs.write_gpr(1, true, 0x77);
        let instr = Instruction::Bitfield {
            op: BitfieldOp::Bfm, sf: true, rd: 0, rn: 1, immr: 0, imms: 7,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0xABCD_1277);
    }

    #[test]
    fn fneg_flips_sign_both_ways() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 2.5);
        let instr = Instruction::FpUnary { op: FpUnaryOp::Fneg, fd: 0, fn_: 1, single: false };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_f64(0), -2.5);
        // Negating the result lands back on the original value.
        let back = Instruction::FpUnary { op: FpUnaryOp::Fneg, fd: 0, fn_: 0, single: false };
        execute(&back, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_f64(0), 2.5);
    }

    #[test]
    fn fabs_clears_sign_and_keeps_positive() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, -0.75);
        let instr = Instruction::FpUnary { op: FpUnaryOp::Fabs, fd: 0, fn_: 1, single: false };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_f64(0), 0.75);
        // Already-positive values pass through unchanged.
        let again = Instruction::FpUnary { op: FpUnaryOp::Fabs, fd: 0, fn_: 0, single: false };
        execute(&again, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_f64(0), 0.75);
    }

    #[test]
    fn fsqrt_takes_the_root_of_a_positive_value() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 9.0);
        let instr = Instruction::FpUnary { op: FpUnaryOp::Fsqrt, fd: 0, fn_: 1, single: false };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_f64(0), 3.0);
        // Zero has a root, and it is zero.
        regs.write_fpr_f64(1, 0.0);
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_f64(0), 0.0);
    }

    #[test]
    fn fsqrt_of_a_negative_is_nan() {
        // IEEE says the root of a negative is NaN; nothing traps.
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, -4.0);
        let instr = Instruction::FpUnary { op: FpUnaryOp::Fsqrt, fd: 0, fn_: 1, single: false };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert!(regs.read_fpr_f64(0).is_nan());
    }

    #[test]
    fn an_invalid_operation_writes_the_positive_default_nan() {
        // AArch64 generates the DEFAULT NaN for an invalid operation and it
        // is positive, which is what the servers print as `nan` rather than
        // `-nan`. x86-64 answers the same operations with its own
        // "indefinite" QNaN, whose sign bit is set.
        let (mut regs, mut mem) = fresh();
        let d_default = 0x7FF8_0000_0000_0000u64;
        let s_default = 0x7FC0_0000u64;

        regs.write_fpr_f64(1, -4.0);
        let sqrt_d = Instruction::FpUnary { op: FpUnaryOp::Fsqrt, fd: 0, fn_: 1, single: false };
        execute(&sqrt_d, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_bits(0), d_default, "fsqrt d");

        regs.write_fpr_f32(1, -4.0);
        let sqrt_s = Instruction::FpUnary { op: FpUnaryOp::Fsqrt, fd: 0, fn_: 1, single: true };
        execute(&sqrt_s, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_bits(0), s_default, "fsqrt s");

        for (op, a, b, what) in [
            (FpBinOp::Fdiv, 0.0f64, 0.0f64, "0/0"),
            (FpBinOp::Fsub, f64::INFINITY, f64::INFINITY, "inf - inf"),
            (FpBinOp::Fmul, 0.0f64, f64::INFINITY, "0 * inf"),
            (FpBinOp::Fadd, f64::INFINITY, f64::NEG_INFINITY, "inf + -inf"),
        ] {
            regs.write_fpr_f64(1, a);
            regs.write_fpr_f64(2, b);
            let instr = Instruction::FpBinary { op, fd: 0, fn_: 1, fm: 2, single: false };
            execute(&instr, &mut regs, &mut mem).unwrap();
            assert_eq!(regs.read_fpr_bits(0), d_default, "{what}");

            regs.write_fpr_f32(1, a as f32);
            regs.write_fpr_f32(2, b as f32);
            let instr = Instruction::FpBinary { op, fd: 0, fn_: 1, fm: 2, single: true };
            execute(&instr, &mut regs, &mut mem).unwrap();
            assert_eq!(regs.read_fpr_bits(0), s_default, "{what} single");
        }

        // An operand NaN is NOT regenerated: it propagates with the sign and
        // payload it arrived with, which is what FPCR.DN = 0 means.
        let carried = 0xFFF8_0000_0000_00FFu64;
        regs.write_fpr_bits(1, carried);
        regs.write_fpr_f64(2, 1.0);
        let add = Instruction::FpBinary {
            op: FpBinOp::Fadd, fd: 0, fn_: 1, fm: 2, single: false,
        };
        execute(&add, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_bits(0), carried, "an operand NaN propagates");
    }

    #[test]
    fn a_fused_multiply_add_of_an_invalid_product_writes_the_default_nan() {
        // 0 * inf + 1 is invalid at the product, and the fused path must
        // answer with the same positive default NaN the binary ops do.
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 0.0);
        regs.write_fpr_f64(2, f64::INFINITY);
        regs.write_fpr_f64(3, 1.0);
        let instr = Instruction::FpMulAdd {
            op: FpMulAddOp::Fmadd, fd: 0, fn_: 1, fm: 2, fa: 3, single: false,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_bits(0), 0x7FF8_0000_0000_0000u64, "fmadd d");

        regs.write_fpr_f32(1, 0.0);
        regs.write_fpr_f32(2, f32::INFINITY);
        regs.write_fpr_f32(3, 1.0);
        let instr = Instruction::FpMulAdd {
            op: FpMulAddOp::Fmadd, fd: 0, fn_: 1, fm: 2, fa: 3, single: true,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_bits(0), 0x7FC0_0000u64, "fmadd s");
    }

    #[test]
    fn fsqrt_single_computes_in_f32() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f32(1, 2.0);
        let instr = Instruction::FpUnary { op: FpUnaryOp::Fsqrt, fd: 0, fn_: 1, single: true };
        execute(&instr, &mut regs, &mut mem).unwrap();
        // The f32 root of 2 rounds in single precision, so the double view of
        // the register is the f32 value widened, not the f64 root of 2.
        assert_eq!(regs.read_fpr_f32(0), 2.0f32.sqrt());
        assert_eq!(regs.read_fpr_bits(0), 2.0f32.sqrt().to_bits() as u64);
    }

    // -- memory --

    #[test]
    fn str_ldr_roundtrip() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, true, 0xCAFE_BABE);
        regs.write_sp(0x8000_0000);

        // STR X0, [SP, #0]
        let str_instr = Instruction::LdSt {
            op: LdStOp::Str, rt: 0, rn: 31,
            offset: LdStOffset::Immediate(0), size: MemSize::X,
            mode: IndexMode::SignedOffset,
        };
        execute(&str_instr, &mut regs, &mut mem).unwrap();

        // LDR X1, [SP, #0]
        let ldr_instr = Instruction::LdSt {
            op: LdStOp::Ldr, rt: 1, rn: 31,
            offset: LdStOffset::Immediate(0), size: MemSize::X,
            mode: IndexMode::SignedOffset,
        };
        execute(&ldr_instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(1, true), 0xCAFE_BABE);
    }

    #[test]
    fn str_pre_index_updates_base() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, true, 42);
        regs.write_sp(0x8000_0010);

        let instr = Instruction::LdSt {
            op: LdStOp::Str, rt: 0, rn: 31,
            offset: LdStOffset::Immediate(-16), size: MemSize::X,
            mode: IndexMode::PreIndex,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_sp(), 0x8000_0000);
        assert_eq!(mem.read_u64(0x8000_0000).unwrap(), 42);
    }

    #[test]
    fn ldr_post_index_updates_base() {
        let (mut regs, mut mem) = fresh();
        mem.write_u64(0x8000_0000, 99).unwrap();
        regs.write_sp(0x8000_0000);

        let instr = Instruction::LdSt {
            op: LdStOp::Ldr, rt: 0, rn: 31,
            offset: LdStOffset::Immediate(16), size: MemSize::X,
            mode: IndexMode::PostIndex,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 99);
        assert_eq!(regs.read_sp(), 0x8000_0010);
    }

    #[test]
    fn stp_ldp_pair() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, true, 0xAAAA);
        regs.write_gpr(1, true, 0xBBBB);
        regs.write_sp(0x8000_0000);

        let stp = Instruction::LdStPair {
            op: LdStPairOp::Stp, sf: true, rt: 0, rt2: 1, rn: 31,
            imm7: -16, mode: IndexMode::PreIndex,
        };
        execute(&stp, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_sp(), 0x7FFF_FFF0);

        // clear and reload
        regs.write_gpr(0, true, 0);
        regs.write_gpr(1, true, 0);

        let ldp = Instruction::LdStPair {
            op: LdStPairOp::Ldp, sf: true, rt: 2, rt2: 3, rn: 31,
            imm7: 0, mode: IndexMode::SignedOffset,
        };
        execute(&ldp, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(2, true), 0xAAAA);
        assert_eq!(regs.read_gpr(3, true), 0xBBBB);
    }

    // -- branches --

    #[test]
    fn b_forward() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x400000);
        let instr = Instruction::BrImm { link: false, offset: 8 };
        let result = execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(result, ExecResult::Branched);
        assert_eq!(regs.read_pc(), 0x400008);
    }

    #[test]
    fn bl_saves_return_address() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x400000);
        let instr = Instruction::BrImm { link: true, offset: 100 };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_pc(), 0x400064);
        assert_eq!(regs.read_gpr(30, true), 0x400004); // return addr
    }

    #[test]
    fn ret_to_lr() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(30, true, 0x400100);
        let instr = Instruction::BrReg { op: BrRegOp::Ret, rn: 30 };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_pc(), 0x400100);
    }

    #[test]
    fn bcond_taken() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x400000);
        regs.nzcv.z = true;
        let instr = Instruction::BCond { cond: Condition::EQ, offset: 20 };
        let result = execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(result, ExecResult::Branched);
        assert_eq!(regs.read_pc(), 0x400014);
    }

    #[test]
    fn bcond_not_taken() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x400000);
        regs.nzcv.z = false;
        let instr = Instruction::BCond { cond: Condition::EQ, offset: 20 };
        let result = execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(result, ExecResult::Advance);
    }

    // -- conditional select --

    #[test]
    fn csel_taken() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 10);
        regs.write_gpr(2, true, 20);
        regs.nzcv.z = true;
        let instr = Instruction::CondSel {
            op: CondSelOp::Csel, sf: true, rd: 0, rn: 1, rm: 2, cond: Condition::EQ,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 10);
    }

    #[test]
    fn csinc_not_taken() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 10);
        regs.write_gpr(2, true, 20);
        regs.nzcv.z = false;
        let instr = Instruction::CondSel {
            op: CondSelOp::Csinc, sf: true, rd: 0, rn: 1, rm: 2, cond: Condition::EQ,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 21);
    }

    // -- mul/div --

    #[test]
    fn mul_basic() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 7);
        regs.write_gpr(2, true, 6);
        let instr = Instruction::MulDiv {
            op: MulDivOp::Mul, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 42);
    }

    #[test]
    fn udiv_basic() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 100);
        regs.write_gpr(2, true, 7);
        let instr = Instruction::MulDiv {
            op: MulDivOp::Udiv, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 14);
    }

    #[test]
    fn div_by_zero_returns_zero() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 42);
        regs.write_gpr(2, true, 0);
        let instr = Instruction::MulDiv {
            op: MulDivOp::Udiv, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
    }

    #[test]
    fn sdiv_negative() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, (-100i64) as u64);
        regs.write_gpr(2, true, 7);
        let instr = Instruction::MulDiv {
            op: MulDivOp::Sdiv, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true) as i64, -14);
    }

    // -- NOP and SVC --

    #[test]
    fn nop_does_nothing() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, true, 42);
        execute(&Instruction::Nop, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 42);
    }

    #[test]
    fn svc_zero_returns_syscall() {
        // `svc #0` is now a Linux supervisor call; the Cpu layer decides
        // halt vs dispatch based on x8.
        let (mut regs, mut mem) = fresh();
        let result = execute(&Instruction::Svc { imm16: 0 }, &mut regs, &mut mem).unwrap();
        assert_eq!(result, ExecResult::Syscall);
    }

    #[test]
    fn svc_nonzero_imm_halts() {
        // Non-zero imm16 preserves the bare-metal halt semantics.
        let (mut regs, mut mem) = fresh();
        let result = execute(&Instruction::Svc { imm16: 1 }, &mut regs, &mut mem).unwrap();
        assert_eq!(result, ExecResult::Halted);
    }

    // -- flag edge cases --

    #[test]
    fn overflow_flag_on_signed_add() {
        let (mut regs, mut mem) = fresh();
        // i64::MAX + 1 should overflow
        regs.write_gpr(1, true, i64::MAX as u64);
        let instr = Instruction::DpImm {
            op: DpOp::Adds, sf: true, rd: 0, rn: 1, imm: 1, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert!(regs.nzcv.v, "signed overflow expected");
        assert!(regs.nzcv.n, "result is negative");
    }

    #[test]
    fn carry_flag_on_unsigned_sub() {
        let (mut regs, mut mem) = fresh();
        // 10 - 5: no borrow, so C=1
        regs.write_gpr(1, true, 10);
        let instr = Instruction::DpImm {
            op: DpOp::Subs, sf: true, rd: 0, rn: 1, imm: 5, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert!(regs.nzcv.c, "no borrow, carry should be set");

        // 5 - 10: borrow, so C=0
        regs.write_gpr(1, true, 5);
        let instr2 = Instruction::DpImm {
            op: DpOp::Subs, sf: true, rd: 0, rn: 1, imm: 10, shift: 0,
        };
        execute(&instr2, &mut regs, &mut mem).unwrap();
        assert!(!regs.nzcv.c, "borrow, carry should be clear");
    }

    // -- byte load/store --

    #[test]
    fn strb_ldrb() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, true, 0xFF42);
        regs.write_sp(0x1000);

        let str_instr = Instruction::LdSt {
            op: LdStOp::Str, rt: 0, rn: 31,
            offset: LdStOffset::Immediate(0), size: MemSize::B,
            mode: IndexMode::SignedOffset,
        };
        execute(&str_instr, &mut regs, &mut mem).unwrap();

        let ldr_instr = Instruction::LdSt {
            op: LdStOp::Ldr, rt: 1, rn: 31,
            offset: LdStOffset::Immediate(0), size: MemSize::B,
            mode: IndexMode::SignedOffset,
        };
        execute(&ldr_instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(1, true), 0x42); // only low byte
    }

    // -- extended-register addressing --

    fn write_word_at(mem: &mut Memory, addr: u64, value: u32) {
        mem.write_u32(addr, value).unwrap();
    }

    #[test]
    fn ldr_extended_sxtw_scales_signed_index_by_four_for_words() {
        // Equivalent to `ldr w0, [x12, w9, SXTW 2]` with x12 = base,
        // w9 = 3 -> address = base + 12.
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_0000_u64;
        regs.write_gpr(12, true, base);
        regs.write_gpr(9, false, 3); // W register write
        write_word_at(&mut mem, base + 12, 0xAABB_CCDD);

        let ldr = Instruction::LdSt {
            op: LdStOp::Ldr, rt: 0, rn: 12,
            offset: LdStOffset::Register { rm: 9, extend: ExtendType::Sxtw, shift_amount: Some(2) },
            size: MemSize::W,
            mode: IndexMode::SignedOffset,
        };
        execute(&ldr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, false), 0xAABB_CCDD);
    }

    #[test]
    fn ldr_extended_sxtw_handles_negative_index() {
        // w9 = -1 should sign-extend and subtract 4*|-1| = 4 from base.
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_1000_u64;
        regs.write_gpr(12, true, base);
        regs.write_gpr(9, false, 0xFFFF_FFFF); // W = -1
        write_word_at(&mut mem, base - 4, 0xCAFEBABE);

        let ldr = Instruction::LdSt {
            op: LdStOp::Ldr, rt: 0, rn: 12,
            offset: LdStOffset::Register { rm: 9, extend: ExtendType::Sxtw, shift_amount: Some(2) },
            size: MemSize::W,
            mode: IndexMode::SignedOffset,
        };
        execute(&ldr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, false), 0xCAFEBABE);
    }

    #[test]
    fn ldr_extended_uxtw_zero_extends_index() {
        // w9 set to a value with the top bit set; UXTW should not sign-extend.
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_0000_u64;
        regs.write_gpr(12, true, base);
        regs.write_gpr(9, false, 2); // simple positive
        write_word_at(&mut mem, base + 8, 0x11223344);

        let ldr = Instruction::LdSt {
            op: LdStOp::Ldr, rt: 0, rn: 12,
            offset: LdStOffset::Register { rm: 9, extend: ExtendType::Uxtw, shift_amount: Some(2) },
            size: MemSize::W,
            mode: IndexMode::SignedOffset,
        };
        execute(&ldr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, false), 0x11223344);
    }

    #[test]
    fn ldr_extended_lsl_uses_full_64_bit_index() {
        // argv walker pattern: [argv_r, i_r, SXTW 3] for 8-byte pointer array.
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_0000_u64;
        regs.write_gpr(21, true, base); // argv_r
        regs.write_gpr(19, true, 5); // i_r as 64-bit
        mem.write_u64(base + 40, 0xDEAD_BEEF_CAFE_BABE).unwrap();

        let ldr = Instruction::LdSt {
            op: LdStOp::Ldr, rt: 0, rn: 21,
            offset: LdStOffset::Register { rm: 19, extend: ExtendType::Lsl, shift_amount: Some(3) },
            size: MemSize::X,
            mode: IndexMode::SignedOffset,
        };
        execute(&ldr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0xDEAD_BEEF_CAFE_BABE);
    }

    // -- compare-and-branch, test-bit-and-branch --

    #[test]
    fn cbz_branches_when_register_zero() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.write_gpr(3, false, 0);
        let cbz = Instruction::CompareBranch {
            sf: false,
            rt: 3,
            nonzero: false,
            offset: 16,
        };
        let r = execute(&cbz, &mut regs, &mut mem).unwrap();
        assert_eq!(r, ExecResult::Branched);
        assert_eq!(regs.read_pc(), 0x0040_0010);
    }

    #[test]
    fn cbz_does_not_branch_when_register_nonzero() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.write_gpr(3, false, 7);
        let cbz = Instruction::CompareBranch {
            sf: false,
            rt: 3,
            nonzero: false,
            offset: 16,
        };
        let r = execute(&cbz, &mut regs, &mut mem).unwrap();
        assert_eq!(r, ExecResult::Advance);
        assert_eq!(regs.read_pc(), 0x0040_0000);
    }

    #[test]
    fn cbnz_branches_when_register_nonzero() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.write_gpr(5, true, 42);
        let cbnz = Instruction::CompareBranch {
            sf: true,
            rt: 5,
            nonzero: true,
            offset: -4,
        };
        let r = execute(&cbnz, &mut regs, &mut mem).unwrap();
        assert_eq!(r, ExecResult::Branched);
        assert_eq!(regs.read_pc(), 0x0040_0000 - 4);
    }

    #[test]
    fn tbz_bit_zero_branches_when_clear() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.write_gpr(1, true, 0b1110); // bit 0 clear
        let tbz = Instruction::TestBranch {
            rt: 1,
            bit_pos: 0,
            nonzero: false,
            offset: 12,
        };
        let r = execute(&tbz, &mut regs, &mut mem).unwrap();
        assert_eq!(r, ExecResult::Branched);
        assert_eq!(regs.read_pc(), 0x0040_000C);
    }

    #[test]
    fn tbnz_high_bit_branches_when_set() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.write_gpr(2, true, 1u64 << 63);
        let tbnz = Instruction::TestBranch {
            rt: 2,
            bit_pos: 63,
            nonzero: true,
            offset: 8,
        };
        let r = execute(&tbnz, &mut regs, &mut mem).unwrap();
        assert_eq!(r, ExecResult::Branched);
        assert_eq!(regs.read_pc(), 0x0040_0008);
    }

    #[test]
    fn tbnz_does_not_branch_when_bit_clear() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.write_gpr(2, true, 0);
        let tbnz = Instruction::TestBranch {
            rt: 2,
            bit_pos: 0,
            nonzero: true,
            offset: 8,
        };
        let r = execute(&tbnz, &mut regs, &mut mem).unwrap();
        assert_eq!(r, ExecResult::Advance);
        assert_eq!(regs.read_pc(), 0x0040_0000);
    }

    // -- multiply-accumulate --

    #[test]
    fn madd_adds_product_to_accumulator() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 3);
        regs.write_gpr(2, true, 4);
        regs.write_gpr(3, true, 10);
        let madd = Instruction::MulAccumulate {
            op: MulAccumulateOp::Madd,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 2,
            ra: 3,
        };
        execute(&madd, &mut regs, &mut mem).unwrap();
        // 10 + 3*4 = 22
        assert_eq!(regs.read_gpr(0, true), 22);
    }

    #[test]
    fn msub_as_remainder_idiom() {
        // Course idiom: sdiv q, a, b; msub r, q, b, a gives a mod b.
        // Here: a=17, b=5 -> q=3, r=17 - 3*5 = 2.
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 3);  // q
        regs.write_gpr(2, true, 5);  // b
        regs.write_gpr(3, true, 17); // a
        let msub = Instruction::MulAccumulate {
            op: MulAccumulateOp::Msub,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 2,
            ra: 3,
        };
        execute(&msub, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 2);
    }

    // -- sign-extending loads --

    #[test]
    fn ldrsb_xt_sign_extends_negative_byte_to_64_bits() {
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_0000_u64;
        regs.write_gpr(1, true, base);
        mem.write_u8(base + 4, 0xFF).unwrap(); // -1 as signed byte

        let ldrsb = Instruction::LdrSignExtended {
            rt: 0,
            rn: 1,
            offset: LdStOffset::Immediate(4),
            size: MemSize::B,
            mode: IndexMode::SignedOffset,
            sf: true,
        };
        execute(&ldrsb, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), u64::MAX); // all ones = -1 in Xt
    }

    #[test]
    fn ldrsb_wt_sign_extends_within_32_bits() {
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_0000_u64;
        regs.write_gpr(1, true, base);
        mem.write_u8(base + 2, 0x80).unwrap(); // -128 as signed byte

        let ldrsb = Instruction::LdrSignExtended {
            rt: 0,
            rn: 1,
            offset: LdStOffset::Immediate(2),
            size: MemSize::B,
            mode: IndexMode::SignedOffset,
            sf: false,
        };
        execute(&ldrsb, &mut regs, &mut mem).unwrap();
        // Wt gets 0xFFFFFF80; read_gpr(.., false) returns low 32 bits.
        assert_eq!(regs.read_gpr(0, false), 0xFFFF_FF80);
    }

    #[test]
    fn ldrsh_positive_halfword_no_upper_bits_set() {
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_0000_u64;
        regs.write_gpr(1, true, base);
        mem.write_u16(base, 0x007F).unwrap();

        let ldrsh = Instruction::LdrSignExtended {
            rt: 0,
            rn: 1,
            offset: LdStOffset::Immediate(0),
            size: MemSize::H,
            mode: IndexMode::SignedOffset,
            sf: true,
        };
        execute(&ldrsh, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0x7F);
    }

    #[test]
    fn ldrsw_sign_extends_word_to_xt() {
        let (mut regs, mut mem) = fresh();
        let base = 0x0060_0000_u64;
        regs.write_gpr(1, true, base);
        mem.write_u32(base, 0xFFFF_FFFE).unwrap(); // -2 as signed word

        let ldrsw = Instruction::LdrSignExtended {
            rt: 0,
            rn: 1,
            offset: LdStOffset::Immediate(0),
            size: MemSize::W,
            mode: IndexMode::SignedOffset,
            sf: true,
        };
        execute(&ldrsw, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), !1u64); // -2
    }

    // -- floating-point --

    #[test]
    fn fadd_sum_lands_in_destination() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 1.5);
        regs.write_fpr_f64(2, 2.5);
        let fadd = Instruction::FpBinary {
            op: FpBinOp::Fadd,
            fd: 0,
            fn_: 1,
            fm: 2,
            single: false,
        };
        execute(&fadd, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_fpr_f64(0), 4.0);
    }

    #[test]
    fn fsub_correct() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 5.0);
        regs.write_fpr_f64(2, 2.0);
        execute(
            &Instruction::FpBinary { op: FpBinOp::Fsub, fd: 0, fn_: 1, fm: 2, single: false },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(0), 3.0);
    }

    #[test]
    fn fmul_and_fdiv_work() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 3.0);
        regs.write_fpr_f64(2, 4.0);
        execute(
            &Instruction::FpBinary { op: FpBinOp::Fmul, fd: 0, fn_: 1, fm: 2, single: false },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(0), 12.0);

        execute(
            &Instruction::FpBinary { op: FpBinOp::Fdiv, fd: 3, fn_: 0, fm: 2, single: false },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(3), 3.0);
    }

    #[test]
    fn fmov_reg_to_reg_copies_bits() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(2, std::f64::consts::PI);
        execute(
            &Instruction::FpMoveReg { fd: 5, fn_: 2, single: false },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(5), std::f64::consts::PI);
    }

    // -- single precision (S view) --

    #[test]
    fn fadd_single_rounds_in_f32_not_f64() {
        // 16777216 is the last exactly-representable integer in f32:
        // adding 1.0 rounds back to 16777216 in single precision, while a
        // compute-in-double-then-narrow path would produce 16777218 after
        // the final rounding of 16777217. This pins true f32 arithmetic.
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f32(1, 16_777_216.0);
        regs.write_fpr_f32(2, 1.0);
        execute(
            &Instruction::FpBinary { op: FpBinOp::Fadd, fd: 0, fn_: 1, fm: 2, single: true },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f32(0), 16_777_216.0);
    }

    #[test]
    fn single_writes_zero_the_upper_bits() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_bits(1, 0xFFFF_FFFF_FFFF_FFFF);
        regs.write_fpr_f32(2, 2.0);
        regs.write_fpr_bits(0, 0xAAAA_BBBB_CCCC_DDDD);
        execute(
            &Instruction::FpBinary { op: FpBinOp::Fmul, fd: 0, fn_: 2, fm: 2, single: true },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_bits(0), (4.0f32).to_bits() as u64);
    }

    #[test]
    fn fcvt_widens_exactly_and_narrows_with_rounding() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f32(1, 2.5);
        execute(&Instruction::FpCvt { fd: 0, fn_: 1, widen: true }, &mut regs, &mut mem)
            .unwrap();
        assert_eq!(regs.read_fpr_f64(0), 2.5);

        regs.write_fpr_f64(3, 0.1);
        execute(&Instruction::FpCvt { fd: 4, fn_: 3, widen: false }, &mut regs, &mut mem)
            .unwrap();
        assert_eq!(regs.read_fpr_f32(4), 0.1f32);
        // The narrow really is the f32 rounding of the f64, not bit noise.
        assert_eq!(regs.read_fpr_bits(4), (0.1f32).to_bits() as u64);
    }

    #[test]
    fn scvtf_single_converts_int_to_f32() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, (-7i32) as u32 as u64);
        execute(
            &Instruction::FpFromInt {
                op: FpFromIntOp::Scvtf, fd: 0, rn: 1, sf: false, single: true, fbits: 0,
            },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f32(0), -7.0);
        assert_eq!(regs.read_fpr_bits(0), (-7.0f32).to_bits() as u64);
    }

    #[test]
    fn fcvtzs_single_truncates_toward_zero() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f32(1, -2.7);
        execute(
            &Instruction::FpToInt {
                op: FpToIntOp::Zs, rd: 0, fn_: 1, sf: false, single: true, fbits: 0,
            },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_gpr(0, false) as u32 as i32, -2);
    }

    #[test]
    fn fcmp_single_orders_and_flags_nan_unordered() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f32(1, 1.0);
        regs.write_fpr_f32(2, 2.0);
        execute(
            &Instruction::FpCompare { fn_: 1, fm: 2, single: true },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert!(regs.nzcv.n); // 1.0 < 2.0
        regs.write_fpr_f32(3, f32::NAN);
        execute(
            &Instruction::FpCompare { fn_: 1, fm: 3, single: true },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        // Unordered: C and V set.
        assert!(regs.nzcv.c && regs.nzcv.v);
    }

    #[test]
    fn fcmp_sets_nzcv_for_equal() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 1.5);
        regs.write_fpr_f64(2, 1.5);
        execute(
            &Instruction::FpCompare { fn_: 1, fm: 2, single: false },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert!(!regs.nzcv.n);
        assert!(regs.nzcv.z);
        assert!(regs.nzcv.c);
        assert!(!regs.nzcv.v);
    }

    #[test]
    fn fcmp_sets_nzcv_for_less_than() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 1.0);
        regs.write_fpr_f64(2, 2.0);
        execute(
            &Instruction::FpCompare { fn_: 1, fm: 2, single: false },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert!(regs.nzcv.n);
        assert!(!regs.nzcv.z);
        assert!(!regs.nzcv.c);
        assert!(!regs.nzcv.v);
    }

    #[test]
    fn scvtf_converts_x_register_to_double() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(3, true, 42);
        execute(
            &Instruction::FpFromInt {
                op: FpFromIntOp::Scvtf, fd: 0, rn: 3, sf: true, single: false, fbits: 0,
            },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(0), 42.0);
    }

    #[test]
    fn scvtf_handles_negative_int() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(3, true, (-7i64) as u64);
        execute(
            &Instruction::FpFromInt {
                op: FpFromIntOp::Scvtf, fd: 0, rn: 3, sf: true, single: false, fbits: 0,
            },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(0), -7.0);
    }

    #[test]
    fn fcvtzs_truncates_toward_zero() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(2, 3.9);
        execute(
            &Instruction::FpToInt {
                op: FpToIntOp::Zs, rd: 0, fn_: 2, sf: true, single: false, fbits: 0,
            },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_gpr(0, true), 3);

        regs.write_fpr_f64(2, -3.9);
        execute(
            &Instruction::FpToInt {
                op: FpToIntOp::Zs, rd: 1, fn_: 2, sf: true, single: false, fbits: 0,
            },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_gpr(1, true) as i64, -3);
    }

    // -- bitfield extract-and-extend --

    #[test]
    fn sxtb_sign_extends_negative_byte_to_x() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 0x80); // byte 0x80 = -128
        let sxtb = Instruction::Bitfield {
            op: BitfieldOp::Sbfm, sf: true, rd: 0, rn: 1, immr: 0, imms: 7,
        };
        execute(&sxtb, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true) as i64, -128);
    }

    #[test]
    fn uxtb_zero_extends_byte() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 0xFF80);
        let uxtb = Instruction::Bitfield {
            op: BitfieldOp::Ubfm, sf: true, rd: 0, rn: 1, immr: 0, imms: 7,
        };
        execute(&uxtb, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0x80);
    }

    #[test]
    fn sxtw_sign_extends_word() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 0xFFFF_FFFF); // word -1
        let sxtw = Instruction::Bitfield {
            op: BitfieldOp::Sbfm, sf: true, rd: 0, rn: 1, immr: 0, imms: 31,
        };
        execute(&sxtw, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true) as i64, -1);
    }

    #[test]
    fn sxth_w_form_keeps_result_in_32_bits() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 0x8000); // halfword -32768
        let sxth = Instruction::Bitfield {
            op: BitfieldOp::Sbfm, sf: false, rd: 0, rn: 1, immr: 0, imms: 15,
        };
        execute(&sxth, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, false), 0xFFFF_8000);
    }

    // -- ADR / ADRP --

    #[test]
    fn adrp_masks_pc_to_page_then_adds_offset() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0ABC);
        // imm already shifted by the decoder; +1 page = 0x1000.
        let adrp = Instruction::Adr { adrp: true, rd: 0, imm: 0x1000 };
        execute(&adrp, &mut regs, &mut mem).unwrap();
        // (0x0040_0ABC & !0xFFF) + 0x1000 = 0x0040_0000 + 0x1000 = 0x0040_1000.
        assert_eq!(regs.read_gpr(0, true), 0x0040_1000);
    }

    #[test]
    fn adr_is_byte_relative_to_pc() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0010);
        let adr = Instruction::Adr { adrp: false, rd: 3, imm: 8 };
        execute(&adr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(3, true), 0x0040_0018);
    }

    #[test]
    fn msub_w_register_truncates_to_32_bits() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, 0x10000);
        regs.write_gpr(2, false, 0x10000);
        regs.write_gpr(3, false, 0);
        let msub = Instruction::MulAccumulate {
            op: MulAccumulateOp::Msub,
            sf: false,
            rd: 0,
            rn: 1,
            rm: 2,
            ra: 3,
        };
        execute(&msub, &mut regs, &mut mem).unwrap();
        // 0 - (0x10000 * 0x10000) wraps in 32 bits to 0.
        assert_eq!(regs.read_gpr(0, false), 0);
    }

    // -- flag boundaries --

    #[test]
    fn subs_signed_overflow_at_i64_min() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, i64::MIN as u64);
        let instr = Instruction::DpImm {
            op: DpOp::Subs, sf: true, rd: 0, rn: 1, imm: 1, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        // i64::MIN - 1 wraps to i64::MAX: v set, n clear, c set (no borrow).
        assert!(regs.nzcv.v);
        assert!(!regs.nzcv.n);
        assert!(regs.nzcv.c);
        assert_eq!(regs.read_gpr(0, true), i64::MAX as u64);
    }

    #[test]
    fn subs_32bit_signed_overflow_at_i32_min() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, 0x8000_0000);
        let instr = Instruction::DpImm {
            op: DpOp::Subs, sf: false, rd: 0, rn: 1, imm: 1, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert!(regs.nzcv.v);
        assert!(!regs.nzcv.n);
        assert!(regs.nzcv.c);
        assert_eq!(regs.read_gpr(0, false), 0x7FFF_FFFF);
    }

    #[test]
    fn adds_carry_64bit_wraps_to_zero() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, u64::MAX);
        let instr = Instruction::DpImm {
            op: DpOp::Adds, sf: true, rd: 0, rn: 1, imm: 1, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
        assert!(regs.nzcv.c);
        assert!(regs.nzcv.z);
        assert!(!regs.nzcv.v);
    }

    // -- rd = 31: XZR for flag-setting ops, SP otherwise --

    #[test]
    fn subs_rd_31_discards_result_without_touching_sp() {
        let (mut regs, mut mem) = fresh();
        regs.write_sp(0x8000_0000);
        regs.write_gpr(1, true, 3);
        let instr = Instruction::DpImm {
            op: DpOp::Subs, sf: true, rd: 31, rn: 1, imm: 5, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert!(regs.nzcv.n, "3 - 5 is negative");
        assert!(!regs.nzcv.c, "borrow clears carry");
        assert_eq!(regs.read_sp(), 0x8000_0000, "cmp must not write sp");
        assert_eq!(regs.read_gpr(31, true), 0, "xzr stays zero");
    }

    #[test]
    fn add_imm_rd_31_writes_sp() {
        let (mut regs, mut mem) = fresh();
        regs.write_sp(0x8000_0000);
        // add sp, sp, #16: the non-flag-setting form treats rd = 31 as SP.
        let instr = Instruction::DpImm {
            op: DpOp::Add, sf: true, rd: 31, rn: 31, imm: 16, shift: 0,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_sp(), 0x8000_0010);
    }

    // -- conditional select edges --

    #[test]
    fn csel_not_taken_picks_second_source() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, 10);
        regs.write_gpr(2, true, 20);
        regs.nzcv.z = false;
        let instr = Instruction::CondSel {
            op: CondSelOp::Csel, sf: true, rd: 0, rn: 1, rm: 2, cond: Condition::EQ,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 20);
    }

    #[test]
    fn cset_idiom_via_csinc_with_zr_sources() {
        // cset x0, eq lowers to csinc x0, xzr, xzr, ne.
        let (mut regs, mut mem) = fresh();
        let instr = Instruction::CondSel {
            op: CondSelOp::Csinc, sf: true, rd: 0, rn: 31, rm: 31, cond: Condition::NE,
        };
        // z set -> eq holds -> ne not taken -> xzr + 1 = 1.
        regs.nzcv.z = true;
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 1);
        // z clear -> ne taken -> xzr = 0.
        regs.nzcv.z = false;
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
    }

    #[test]
    fn csinc_32bit_increment_wraps_to_zero() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(2, false, 0xFFFF_FFFF);
        regs.nzcv.z = false;
        let instr = Instruction::CondSel {
            op: CondSelOp::Csinc, sf: false, rd: 0, rn: 1, rm: 2, cond: Condition::EQ,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
    }

    // -- division edges --

    #[test]
    fn sdiv_by_zero_returns_zero() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, (-9i64) as u64);
        regs.write_gpr(2, true, 0);
        let instr = Instruction::MulDiv {
            op: MulDivOp::Sdiv, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
    }

    #[test]
    fn sdiv_min_by_minus_one_wraps_to_min() {
        // The one signed quotient that overflows; wrapping_div keeps it at
        // i64::MIN instead of panicking.
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, true, i64::MIN as u64);
        regs.write_gpr(2, true, (-1i64) as u64);
        let instr = Instruction::MulDiv {
            op: MulDivOp::Sdiv, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), i64::MIN as u64);
    }

    #[test]
    fn madd_32bit_masks_the_result() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(1, false, 0x8000_0000);
        regs.write_gpr(2, false, 2);
        regs.write_gpr(3, false, 5);
        let instr = Instruction::MulAccumulate {
            op: MulAccumulateOp::Madd, sf: false, rd: 0, rn: 1, rm: 2, ra: 3,
        };
        execute(&instr, &mut regs, &mut mem).unwrap();
        // 5 + 0x8000_0000 * 2 = 0x1_0000_0005, masked to 32 bits = 5.
        assert_eq!(regs.read_gpr(0, true), 5);
    }

    // -- ldp/stp writeback --

    #[test]
    fn ldp_post_index_reads_then_advances_base() {
        let (mut regs, mut mem) = fresh();
        mem.write_u64(0x8000_0000, 0x1111).unwrap();
        mem.write_u64(0x8000_0008, 0x2222).unwrap();
        regs.write_sp(0x8000_0000);
        let ldp = Instruction::LdStPair {
            op: LdStPairOp::Ldp, sf: true, rt: 0, rt2: 1, rn: 31,
            imm7: 16, mode: IndexMode::PostIndex,
        };
        execute(&ldp, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0x1111);
        assert_eq!(regs.read_gpr(1, true), 0x2222);
        assert_eq!(regs.read_sp(), 0x8000_0010, "post-index writes back after the access");
    }

    #[test]
    fn stp_32bit_pair_packs_adjacent_words() {
        let (mut regs, mut mem) = fresh();
        regs.write_gpr(0, false, 0xAAAA_0001);
        regs.write_gpr(1, false, 0xBBBB_0002);
        regs.write_gpr(2, true, 0x0070_0000);
        let stp = Instruction::LdStPair {
            op: LdStPairOp::Stp, sf: false, rt: 0, rt2: 1, rn: 2,
            imm7: 0, mode: IndexMode::SignedOffset,
        };
        execute(&stp, &mut regs, &mut mem).unwrap();
        assert_eq!(mem.read_u32(0x0070_0000).unwrap(), 0xAAAA_0001);
        assert_eq!(mem.read_u32(0x0070_0004).unwrap(), 0xBBBB_0002);
    }

    // -- add/sub with carry --

    #[test]
    fn adc_adds_the_carry_the_previous_adds_produced() {
        let (mut regs, mut mem) = fresh();
        // Low half: 0xFFFF_FFFF_FFFF_FFFF + 1 wraps and sets C.
        regs.write_gpr(1, true, u64::MAX);
        regs.write_gpr(2, true, 1);
        let adds = Instruction::DpReg {
            op: DpOp::Adds, sf: true, rd: 0, rn: 1, rm: 2,
            shift: ShiftType::LSL, amount: 0,
        };
        execute(&adds, &mut regs, &mut mem).unwrap();
        assert!(regs.nzcv.c);

        // High half: 1 + 2 + C = 4.
        regs.write_gpr(3, true, 1);
        regs.write_gpr(4, true, 2);
        let adc = Instruction::DpCarry {
            sub: false, set_flags: false, sf: true, rd: 5, rn: 3, rm: 4,
        };
        execute(&adc, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(5, true), 4);
    }

    #[test]
    fn adc_without_carry_leaves_the_sum_alone() {
        let (mut regs, mut mem) = fresh();
        regs.nzcv.c = false;
        regs.write_gpr(1, true, 40);
        regs.write_gpr(2, true, 2);
        let adc = Instruction::DpCarry {
            sub: false, set_flags: false, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&adc, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 42);
    }

    #[test]
    fn adc_does_not_touch_the_flags() {
        let (mut regs, mut mem) = fresh();
        regs.nzcv = NzcvFlags { n: true, z: true, c: true, v: true };
        regs.write_gpr(1, true, 1);
        regs.write_gpr(2, true, 1);
        let adc = Instruction::DpCarry {
            sub: false, set_flags: false, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&adc, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 3);
        assert_eq!(regs.nzcv, NzcvFlags { n: true, z: true, c: true, v: true });
    }

    #[test]
    fn adcs_sets_carry_and_zero_on_a_64_bit_wrap() {
        let (mut regs, mut mem) = fresh();
        regs.nzcv.c = false;
        regs.write_gpr(1, true, u64::MAX);
        regs.write_gpr(2, true, 1);
        let adcs = Instruction::DpCarry {
            sub: false, set_flags: true, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&adcs, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
        assert!(regs.nzcv.c);
        assert!(regs.nzcv.z);
        assert!(!regs.nzcv.n);
    }

    #[test]
    fn adcs_carry_in_alone_can_wrap_the_width() {
        // 0xFFFF_FFFF_FFFF_FFFF + 0 + 1: the carry-in is the whole overflow,
        // which the add path's flags could not express.
        let (mut regs, mut mem) = fresh();
        regs.nzcv.c = true;
        regs.write_gpr(1, true, u64::MAX);
        regs.write_gpr(2, true, 0);
        let adcs = Instruction::DpCarry {
            sub: false, set_flags: true, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&adcs, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
        assert!(regs.nzcv.c);
        assert!(regs.nzcv.z);
    }

    #[test]
    fn sbcs_with_carry_set_matches_subs() {
        // With C=1 there is no borrow, so SBCS is SUBS bit for bit, in
        // the result and all four flags.
        for (a, b) in [(10u64, 3u64), (3, 10), (0, 0), (i64::MIN as u64, 1), (u64::MAX, 1)] {
            let (mut regs, mut mem) = fresh();
            regs.write_gpr(1, true, a);
            regs.write_gpr(2, true, b);
            let subs = Instruction::DpReg {
                op: DpOp::Subs, sf: true, rd: 0, rn: 1, rm: 2,
                shift: ShiftType::LSL, amount: 0,
            };
            execute(&subs, &mut regs, &mut mem).unwrap();
            let expected_result = regs.read_gpr(0, true);
            let expected_flags = regs.nzcv;

            let (mut regs, mut mem) = fresh();
            regs.nzcv.c = true;
            regs.write_gpr(1, true, a);
            regs.write_gpr(2, true, b);
            let sbcs = Instruction::DpCarry {
                sub: true, set_flags: true, sf: true, rd: 0, rn: 1, rm: 2,
            };
            execute(&sbcs, &mut regs, &mut mem).unwrap();
            assert_eq!(regs.read_gpr(0, true), expected_result, "result for {a} - {b}");
            assert_eq!(regs.nzcv, expected_flags, "flags for {a} - {b}");
        }
    }

    #[test]
    fn sbcs_with_carry_clear_subtracts_the_borrow() {
        // 5 - 3 - (1 - 0) = 1, and the subtraction did not borrow, so C = 1.
        let (mut regs, mut mem) = fresh();
        regs.nzcv.c = false;
        regs.write_gpr(1, true, 5);
        regs.write_gpr(2, true, 3);
        let sbcs = Instruction::DpCarry {
            sub: true, set_flags: true, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&sbcs, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 1);
        assert!(regs.nzcv.c);
        assert!(!regs.nzcv.z);
        assert!(!regs.nzcv.n);
        assert!(!regs.nzcv.v);
    }

    #[test]
    fn sbcs_borrows_out_of_zero_and_clears_carry() {
        // 0 - 0 - 1 = -1: the borrow leaves the width, so C = 0.
        let (mut regs, mut mem) = fresh();
        regs.nzcv.c = false;
        regs.write_gpr(1, true, 0);
        regs.write_gpr(2, true, 0);
        let sbcs = Instruction::DpCarry {
            sub: true, set_flags: true, sf: true, rd: 0, rn: 1, rm: 2,
        };
        execute(&sbcs, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), u64::MAX);
        assert!(!regs.nzcv.c);
        assert!(regs.nzcv.n);
    }

    #[test]
    fn adcs_w_form_wraps_and_zero_extends_at_32_bits() {
        let (mut regs, mut mem) = fresh();
        // Rd holds a full 64-bit value first, so a missing zero-extend on
        // the W write would survive into the assertion.
        regs.write_gpr(0, true, u64::MAX);
        regs.nzcv.c = false;
        regs.write_gpr(1, false, 0xFFFF_FFFF);
        regs.write_gpr(2, false, 1);
        let adcs = Instruction::DpCarry {
            sub: false, set_flags: true, sf: false, rd: 0, rn: 1, rm: 2,
        };
        execute(&adcs, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0);
        assert!(regs.nzcv.z);
        assert!(regs.nzcv.c);
        assert!(!regs.nzcv.n);
    }

    #[test]
    fn sbc_w_form_borrows_inside_32_bits() {
        // 0 - 0 - 1 at 32 bits is 0xFFFF_FFFF, zero-extended into Xd, not
        // the 64-bit all-ones a width-blind NOT would produce.
        let (mut regs, mut mem) = fresh();
        regs.nzcv.c = false;
        regs.write_gpr(1, false, 0);
        regs.write_gpr(2, false, 0);
        let sbc = Instruction::DpCarry {
            sub: true, set_flags: false, sf: false, rd: 0, rn: 1, rm: 2,
        };
        execute(&sbc, &mut regs, &mut mem).unwrap();
        assert_eq!(regs.read_gpr(0, true), 0xFFFF_FFFF);
    }

    // -- b.cond on the signed boundary --

    #[test]
    fn bcond_lt_taken_when_n_differs_from_v() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.nzcv = NzcvFlags { n: true, z: false, c: false, v: false };
        let instr = Instruction::BCond { cond: Condition::LT, offset: 8 };
        let result = execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(result, ExecResult::Branched);
        assert_eq!(regs.read_pc(), 0x0040_0008);
    }

    #[test]
    fn bcond_ge_not_taken_when_n_differs_from_v() {
        let (mut regs, mut mem) = fresh();
        regs.write_pc(0x0040_0000);
        regs.nzcv = NzcvFlags { n: true, z: false, c: false, v: false };
        let instr = Instruction::BCond { cond: Condition::GE, offset: 8 };
        let result = execute(&instr, &mut regs, &mut mem).unwrap();
        assert_eq!(result, ExecResult::Advance);
        assert_eq!(regs.read_pc(), 0x0040_0000);
    }
}
