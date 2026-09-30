use crate::decoder::*;
use crate::errors::EmuError;
use crate::memory::Memory;
use crate::registers::{apply_shift, Condition, NzcvFlags, RegisterFile, ShiftType};

mod branch;
mod data_processing;
mod fp;
mod load_store;
mod simd;
mod simd_fp;

use branch::*;
use data_processing::*;
use fp::*;
use load_store::*;
use simd::*;
use simd_fp::*;

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
            let flags = if regs.condition_holds(*cond) {
                let a = regs.read_gpr(*rn, *sf);
                let b = match operand {
                    CondCmpOperand::Reg(rm) => regs.read_gpr(*rm, *sf),
                    CondCmpOperand::Imm(imm) => u64::from(*imm),
                };
                if *sub {
                    sub_flags(a, b, a.wrapping_sub(b), *sf)
                } else {
                    add_flags(a, b, a.wrapping_add(b), *sf)
                }
            } else {
                // The false path WRITES the literal; it does not leave the
                // old flags in place. That difference is invisible in
                // every short-circuit idiom and visible only when the
                // literal forces a condition the compare would not.
                NzcvFlags::unpack(*nzcv)
            };
            regs.set_nzcv(flags);
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
        Instruction::Extr { sf, rd, rn, rm, lsb } => {
            let width = if *sf { 64 } else { 32 };
            let pair = (u128::from(regs.read_gpr(*rn, *sf)) << width) | u128::from(regs.read_gpr(*rm, *sf));
            regs.write_gpr(*rd, *sf, (pair >> lsb) as u64);
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
            let src = if regs.condition_holds(*cond) { *fn_ } else { *fm };
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
                    FpUnaryOp::Fsqrt => f32::from_lane(fp_arith(v.sqrt(), &[v])),
                };
                regs.write_fpr_f32(*fd, result);
            } else {
                let v = regs.read_fpr_f64(*fn_);
                let result = match op {
                    FpUnaryOp::Fneg => -v,
                    FpUnaryOp::Fabs => v.abs(),
                    FpUnaryOp::Fsqrt => f64::from_lane(fp_arith(v.sqrt(), &[v])),
                };
                regs.write_fpr_f64(*fd, result);
            }
            Ok(ExecResult::Advance)
        }
        Instruction::FpCompare { fn_, fm, single } => {
            let flags = fp_compare_flags(regs, *fn_, Some(*fm), *single);
            regs.set_nzcv(flags);
            Ok(ExecResult::Advance)
        }
        Instruction::FpCompareZero { fn_, single } => {
            let flags = fp_compare_flags(regs, *fn_, None, *single);
            regs.set_nzcv(flags);
            Ok(ExecResult::Advance)
        }
        Instruction::FpCondCompare { fn_, fm, nzcv, cond, single } => {
            // As CCMP, the false path writes the literal.
            let flags = if regs.condition_holds(*cond) {
                fp_compare_flags(regs, *fn_, Some(*fm), *single)
            } else {
                NzcvFlags::unpack(*nzcv)
            };
            regs.set_nzcv(flags);
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
            // The lane conversions, which carry a NaN's sign and payload
            // across the widths the way FPConvert does.
            if *widen {
                // FCVT Dd, Sn: every f32 is exactly representable as f64.
                let bits = u64::from(regs.read_fpr_f32(*fn_).to_bits());
                regs.write_fpr_f64(*fd, f64::from_bits(fp_widen_lane(8, bits)));
            } else {
                // FCVT Sd, Dn: rounds to the nearest single.
                let bits = regs.read_fpr_f64(*fn_).to_bits();
                regs.write_fpr_f32(*fd, f32::from_bits(fp_narrow_lane(false, 8, bits) as u32));
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
        // The first line is what the servers' shell prints for SIGTRAP.
        Instruction::Brk { imm16 } => Err(EmuError::RuntimeError {
            message: format!(
                "Trace/breakpoint trap\n`brk #{imm16}` stops the program here, as it does on \
                 the servers. gcc plants one where it proved the code can only fault, such \
                 as a use of a pointer that is NULL on this path"
            ),
        }),
    }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests;
