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
        Instruction::SimdLdStStructure {
            load, structures, count, esize, q, shape, rt, rn, post,
        } => exec_simd_ldst_structure(
            *load, *structures, *count, *esize, *q, *shape, *rt, *rn, *post, regs, mem,
        ),
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
        Instruction::FpMoveLane { to_fp, rd, rn } => {
            // The upper 64-bit lane alone: writing it leaves the low half
            // in place, which is how a 128-bit value gets built in two
            // moves. Reading it takes the high half, not the low one.
            if *to_fp {
                let v = regs.read_gpr(*rn, true);
                regs.write_fpr_lane(*rd, 8, 1, v);
            } else {
                regs.write_gpr(*rd, true, regs.read_fpr_lane(*rn, 8, 1));
            }
            Ok(ExecResult::Advance)
        }
        Instruction::SimdModifiedImm { op, arrangement, rd, value, .. } => {
            // A 64-bit destination zeroes the upper half; the scalar
            // `movi d3` form is a 64-bit one under another name.
            let wide = arrangement.is_some_and(|a| a.q);
            let mask: u128 = if wide { u128::MAX } else { u128::from(u64::MAX) };
            let result = match op {
                // FMOV's expanded float is already replicated across the
                // destination, so it moves exactly like MOVI's pattern.
                SimdImmOp::Movi | SimdImmOp::Fmov => *value,
                SimdImmOp::Mvni => !*value,
                SimdImmOp::Orr => regs.read_fpr_q(*rd) | *value,
                SimdImmOp::Bic => regs.read_fpr_q(*rd) & !*value,
            };
            regs.write_fpr_q(*rd, result & mask);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdLogicalReg { op, q, rm, rn, rd } => {
            let n = regs.read_fpr_q(*rn);
            let m = regs.read_fpr_q(*rm);
            let d = regs.read_fpr_q(*rd);
            // BSL, BIT and BIF pick each bit from one of two sources
            // under a mask, so all three read the destination: BSL uses
            // it as the mask, the other two as one of the sources with
            // the second operand as the mask.
            let result = match op {
                SimdLogicalOp::And => n & m,
                SimdLogicalOp::Bic => n & !m,
                SimdLogicalOp::Orr => n | m,
                SimdLogicalOp::Orn => n | !m,
                SimdLogicalOp::Eor => n ^ m,
                SimdLogicalOp::Bsl => (n & d) | (m & !d),
                SimdLogicalOp::Bit => (n & m) | (d & !m),
                SimdLogicalOp::Bif => (n & !m) | (d & m),
            };
            let mask: u128 = if *q { u128::MAX } else { u128::from(u64::MAX) };
            regs.write_fpr_q(*rd, result & mask);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdThreeSame { op, esize, q, scalar, rm, rn, rd } => {
            exec_simd_three_same(*op, *esize, *q, *scalar, *rm, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdTwoMisc { op, esize, q, scalar, rn, rd } => {
            exec_simd_two_misc(*op, *esize, *q, *scalar, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdThreeDiff { op, esize, upper, scalar, rm, rn, rd } => {
            exec_simd_three_diff(*op, *esize, *upper, *scalar, *rm, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdShiftImm { op, esize, q, scalar, shift, rn, rd } => {
            exec_simd_shift_imm(*op, *esize, *q, *scalar, *shift, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdAcross { op, esize, q, rn, rd } => {
            exec_simd_across(*op, *esize, *q, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdCopy { op, esize, q, index, index2, rn, rd } => {
            exec_simd_copy(*op, *esize, *q, *index, *index2, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdPermute { op, esize, q, rm, rn, rd } => {
            exec_simd_permute(*op, *esize, *q, *rm, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdExt { q, index, rm, rn, rd } => {
            exec_simd_ext(*q, *index, *rm, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdTableLookup { extend, q, len, rm, rn, rd } => {
            exec_simd_table_lookup(*extend, *q, *len, *rm, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdFpThreeSame { op, esize, q, scalar, rm, rn, rd } => {
            exec_simd_fp_three_same(*op, *esize, *q, *scalar, *rm, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdFpTwoMisc { op, esize, q, scalar, fbits, rn, rd } => {
            exec_simd_fp_two_misc(*op, *esize, *q, *scalar, *fbits, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdFpAcross { op, esize, q, rn, rd } => {
            exec_simd_fp_across(*op, *esize, *q, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdFpByElement { op, esize, q, scalar, index, rm, rn, rd } => {
            exec_simd_fp_by_element(*op, *esize, *q, *scalar, *index, *rm, *rn, *rd, regs);
            Ok(ExecResult::Advance)
        }
        Instruction::SimdByElement { op, esize, q, scalar, index, rm, rn, rd } => {
            exec_simd_by_element(*op, *esize, *q, *scalar, *index, *rm, *rn, *rd, regs);
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

/// One element of `esize` bytes, zero-extended.
fn read_element(mem: &Memory, addr: u64, esize: u8) -> Result<u64, EmuError> {
    Ok(match esize {
        1 => u64::from(mem.read_u8(addr)?),
        2 => u64::from(mem.read_u16(addr)?),
        4 => u64::from(mem.read_u32(addr)?),
        _ => mem.read_u64(addr)?,
    })
}

fn write_element(mem: &mut Memory, addr: u64, esize: u8, value: u64) -> Result<(), EmuError> {
    match esize {
        1 => mem.write_u8(addr, value as u8),
        2 => mem.write_u16(addr, value as u16),
        4 => mem.write_u32(addr, value as u32),
        _ => mem.write_u64(addr, value),
    }
}

/// LD1-LD4 / ST1-ST4 in all three shapes.
///
/// The bytes are consumed in address order and the register list is
/// walked in step with them, which is what makes a load de-interleave
/// and a store interleave: `ld2 {v3.8b, v4.8b}` puts the byte at +0 in
/// v3 lane 0 and the byte at +1 in v4 lane 0, so v3 ends up holding
/// every even byte and v4 every odd one. LD1/ST1 with more than one
/// register is the degenerate case: one structure per element, so each
/// register is simply filled in turn. A 64-bit arrangement zeroes bits
/// 127:64 of every destination, like any other write below the full
/// width; the single-lane shape is the one that does not, because it
/// writes one lane and leaves the register around it alone.
#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
fn exec_simd_ldst_structure(
    load: bool, structures: u8, count: u8, esize: u8, q: bool,
    shape: SimdStructShape, rt: u8, rn: u8, post: Option<u8>,
    regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let total = simd_struct_bytes(shape, count, esize, q);
    let access = if load {
        crate::errors::MemAccess::Read
    } else {
        crate::errors::MemAccess::Write
    };
    check_guest_address(base, access)?;
    check_guest_address(base.wrapping_add(total - 1), access)?;

    // The register list wraps past v31, so every index goes through here.
    let reg_at = |step: u32| ((u32::from(rt) + step) % 32) as u8;

    match shape {
        SimdStructShape::Multiple => {
            let lanes = if q { 16u32 } else { 8 } / u32::from(esize);
            // A load writes every lane, so zeroing first is all the
            // upper-half rule needs.
            if load && !q {
                for step in 0..u32::from(count) {
                    regs.write_fpr_q(reg_at(step), 0);
                }
            }
            let repeats = u32::from(count / structures);
            let mut offset = 0u64;
            for repeat in 0..repeats {
                for lane in 0..lanes {
                    for slot in 0..u32::from(structures) {
                        let reg = reg_at(repeat * u32::from(structures) + slot);
                        let addr = base.wrapping_add(offset);
                        if load {
                            let value = read_element(mem, addr, esize)?;
                            regs.write_fpr_lane(reg, esize, lane as u8, value);
                        } else {
                            let value = regs.read_fpr_lane(reg, esize, lane as u8);
                            write_element(mem, addr, esize, value)?;
                        }
                        offset += u64::from(esize);
                    }
                }
            }
        }
        SimdStructShape::Lane(index) => {
            for slot in 0..u32::from(count) {
                let reg = reg_at(slot);
                let addr = base.wrapping_add(u64::from(slot) * u64::from(esize));
                if load {
                    let value = read_element(mem, addr, esize)?;
                    regs.write_fpr_lane(reg, esize, index, value);
                } else {
                    let value = regs.read_fpr_lane(reg, esize, index);
                    write_element(mem, addr, esize, value)?;
                }
            }
        }
        SimdStructShape::Replicate => {
            let lanes = if q { 16u32 } else { 8 } / u32::from(esize);
            for slot in 0..u32::from(count) {
                let addr = base.wrapping_add(u64::from(slot) * u64::from(esize));
                let value = u128::from(read_element(mem, addr, esize)?);
                let mut filled = 0u128;
                for lane in 0..lanes {
                    filled |= value << (lane * u32::from(esize) * 8);
                }
                // Writing the whole register is what zeroes the upper
                // half of a 64-bit arrangement.
                regs.write_fpr_q(reg_at(slot), filled);
            }
        }
    }

    if let Some(rm) = post {
        // Rm 31 is the immediate form: the total bytes moved, which the
        // word does not spell because there is only one legal value.
        let step = if rm == 31 { total } else { regs.read_gpr(rm, true) };
        regs.write_gpr_or_sp(rn, true, base.wrapping_add(step));
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

/// What the float rules need of a float, so the S and D paths run the
/// same body instead of two copies whose NaN rules could drift. The
/// scalar FP instructions and the vector lanes share every one of them.
trait FpOperand:
    Copy
    + PartialOrd
    + std::ops::Add<Output = Self>
    + std::ops::Sub<Output = Self>
    + std::ops::Mul<Output = Self>
    + std::ops::Div<Output = Self>
    + std::ops::Neg<Output = Self>
{
    /// The AArch64 default NaN's bit pattern. `default_nan_if_new`
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
fn fp_max<T: FpOperand>(a: T, b: T) -> T {
    if let Some(nan) = fp_process_nans(&[a, b]) {
        return nan;
    }
    if a == T::ZERO && b == T::ZERO {
        return if a.is_sign_negative() { b } else { a };
    }
    if a > b { a } else { b }
}

fn fp_min<T: FpOperand>(a: T, b: T) -> T {
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
/// in its place before running FPMax. A signalling one is not missing -
/// it falls through and propagates, quieted, like any other operand -
/// and two quiet NaNs leave nothing to stand in for either. The
/// signed-zero rule is FMAX's, so the numeric case delegates rather than
/// restating it.
fn fp_max_num<T: FpOperand>(a: T, b: T) -> T {
    let quiet = |v: T| v.is_nan() && !v.is_signalling();
    match (quiet(a), quiet(b)) {
        (true, false) => fp_max(T::NEG_INFINITY, b),
        (false, true) => fp_max(a, T::NEG_INFINITY),
        _ => fp_max(a, b),
    }
}

fn fp_min_num<T: FpOperand>(a: T, b: T) -> T {
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
fn default_nan_if_new<T: FpOperand>(result: T, sources: &[T]) -> T {
    T::from_lane(default_nan_bits_if_new(result, sources))
}

/// The same rule answered as BITS, which is the form it is really about
/// and the one every lane goes through. It cannot be expressed on the
/// value alone: nothing stops the optimizer from handing back a
/// different NaN when the answer is only "a NaN", and on an x86-64 host
/// that is the sign-set one this rule exists to replace.
fn default_nan_bits_if_new<T: FpOperand>(result: T, sources: &[T]) -> u64 {
    if result.is_nan() && !sources.iter().any(|s| s.is_nan()) {
        T::DEFAULT_NAN_BITS
    } else {
        result.to_bits()
    }
}

/// The Advanced SIMD copy group. DUP and the two lane-out forms write a
/// whole destination, so they zero everything they do not set; INS writes
/// one lane and leaves the rest of the register exactly as it was.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
fn exec_simd_copy(
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
// masked back to `esize` bytes before it is stored, and the arithmetic
// that gets there is explicitly wrapping or saturating. The three places
// a wider intermediate is right are the ones the instruction defines that
// way - the halving adds compute in one extra bit, the saturating forms
// have to see the overflow they clamp, and the doubling multiplies take
// the high half of a double-width product - and each says so at its arm.

/// All-ones over `esize` bytes: the mask a lane result is stored under,
/// and the value a lane compare writes when it holds.
fn lane_mask(esize: u8) -> u64 {
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
fn read_lanes(value: u128, esize: u8, bytes: u8) -> Vec<u64> {
    let width = u32::from(esize) * 8;
    let mask = lane_mask(esize);
    (0..bytes / esize)
        .map(|lane| ((value >> (u32::from(lane) * width)) as u64) & mask)
        .collect()
}

/// Pack lanes back into a register value. Everything above the lanes is
/// zero, which is the write rule for both the 64-bit arrangements and
/// the SIMD-scalar forms.
fn pack_lanes(lanes: &[u64], esize: u8) -> u128 {
    let width = u32::from(esize) * 8;
    let mask = u128::from(lane_mask(esize));
    lanes
        .iter()
        .enumerate()
        .fold(0u128, |acc, (i, lane)| acc | ((u128::from(*lane) & mask) << (i as u32 * width)))
}

/// The half of a 128-bit source a widening or `2` form reads: the low
/// lanes for the plain spelling, the high ones for the `2` suffix.
fn read_half_lanes(value: u128, esize: u8, upper: bool) -> Vec<u64> {
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
fn write_half(regs: &mut RegisterFile, rd: u8, upper: bool, packed: u128) {
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
fn recip_estimate(a: u32) -> u32 {
    let a = a * 2 + 1;
    let b = (1u32 << 19) / a;
    b.div_ceil(2)
}

/// ARM's RecipSqrtEstimate, the same table for URSQRTE. The search for
/// `b` is the pseudocode's own loop, kept literal rather than solved: it
/// is what pins the boundary cases the capture checks.
fn recip_sqrt_estimate(a: u32) -> u32 {
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
fn exec_simd_three_same(
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

fn exec_simd_two_misc(
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
fn exec_simd_three_diff(
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
fn exec_simd_shift_imm(
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

fn exec_simd_across(
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
fn exec_simd_permute(
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
fn exec_simd_ext(q: bool, index: u8, rm: u8, rn: u8, rd: u8, regs: &mut RegisterFile) {
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
fn exec_simd_table_lookup(
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
fn exec_simd_by_element(
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

// ---------------------------------------------------------------------------
// the floating-point lane engine
// ---------------------------------------------------------------------------
//
// Every rule here is per LANE: the scalar FP paths above and these run
// the same helpers, so the two cannot disagree about a NaN, a rounding
// mode or a saturation rail.
//
//   - `fp_process_nans` is the operand rule: a NaN that ARRIVED in a lane
//     comes back out of that lane quieted, sign and payload intact
//     (FPCR.DN is clear). A signalling operand wins over a quiet one, and
//     within a kind the earlier operand wins.
//   - `default_nan_if_new` is the other half: a NaN this operation MADE
//     becomes the positive AArch64 default NaN.
//   - FMAX and FMIN propagate an operand NaN; FMAXNM and FMINNM stand
//     an infinity in a QUIET NaN's place and return the other operand,
//     but leave a signalling one for FMAX to propagate.
//   - FCMEQ/FCMGE/FCMGT/FCMLE/FCMLT and FACGE/FACGT write a lane of all
//     ones or all zeros, and every one of them is false against a NaN.
//   - FCVTZS/FCVTZU saturate at the LANE's integer rails and answer zero
//     for a NaN, exactly as the general-register forms do.

/// ARM's FPProcessNaNs over as many operands as the form has. `None`
/// means no operand was a NaN and the arithmetic runs.
fn fp_process_nans<T: FpOperand>(sources: &[T]) -> Option<T> {
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
        SimdFpSameOp::Fmla => fp_arith(a.mul_add(b, d), &[d, a, b]),
        SimdFpSameOp::Fmls => fp_arith((-a).mul_add(b, d), &[d, -a, b]),
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
fn fp_arith<T: FpOperand>(result: T, sources: &[T]) -> u64 {
    match fp_process_nans(sources) {
        Some(nan) => nan.to_bits(),
        None => default_nan_bits_if_new(result, sources),
    }
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
fn fp_narrow_lane(odd: bool, wide: u8, bits: u64) -> u64 {
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

fn fp_widen_lane(wide: u8, bits: u64) -> u64 {
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
fn exec_simd_fp_three_same(
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
fn exec_simd_fp_two_misc(
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

fn exec_simd_fp_across(
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
fn exec_simd_fp_by_element(
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
    let value = if single {
        regs.read_fpr_f32(fn_) as f64
    } else {
        regs.read_fpr_f64(fn_)
    };
    regs.write_gpr(rd, sf, fp_to_int(op, value, fbits, sf));
    Ok(ExecResult::Advance)
}

/// The rounding mode and the saturation rails of one FCVT, shared by the
/// general-register forms above and the vector lanes below: `wide` is a
/// 64-bit destination, `fbits` the fixed-point scale.
fn fp_to_int(op: FpToIntOp, value: f64, fbits: u8, wide: bool) -> u64 {
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
