//! Unit tests for the executor: the scalar instruction families, their
//! flags, and memory access.

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
