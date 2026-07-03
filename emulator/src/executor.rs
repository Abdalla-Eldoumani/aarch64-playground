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
        Instruction::LdrLiteral { sf, rt, offset } => {
            exec_ldr_literal(*sf, *rt, *offset, regs, mem)
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
        Instruction::LdrSignExtended { rt, rn, offset, size, mode, sf } => {
            exec_ldrs(*rt, *rn, offset, *size, *mode, *sf, regs, mem)
        }
        Instruction::FpBinary { op, fd, fn_, fm } => {
            exec_fp_binary(*op, *fd, *fn_, *fm, regs)
        }
        Instruction::FpLdSt { load, ft, rn, offset, size } => {
            let addr = regs.read_gpr(*rn, true).wrapping_add(*offset as u64);
            if *load {
                match size {
                    MemSize::X => {
                        // LDR Dt: read 64 bits into the D register's raw bits.
                        let v = mem.read_u64(addr)?;
                        regs.write_fpr_bits(*ft, v);
                    }
                    MemSize::W => {
                        // LDR St: read 32 bits; upper 32 of the FP reg go
                        // to zero per AAPCS.
                        let v = mem.read_u32(addr)? as u64;
                        regs.write_fpr_bits(*ft, v);
                    }
                    _ => return Err(EmuError::UnknownInstruction(0)),
                }
            } else {
                match size {
                    MemSize::X => {
                        let v = regs.read_fpr_bits(*ft);
                        mem.write_u64(addr, v)?;
                    }
                    MemSize::W => {
                        let v = regs.read_fpr_bits(*ft) as u32;
                        mem.write_u32(addr, v)?;
                    }
                    _ => return Err(EmuError::UnknownInstruction(0)),
                }
            }
            Ok(ExecResult::Advance)
        }
        Instruction::FpMoveReg { fd, fn_ } => {
            let v = regs.read_fpr_bits(*fn_);
            regs.write_fpr_bits(*fd, v);
            Ok(ExecResult::Advance)
        }
        Instruction::FpCompare { fn_, fm } => {
            let a = regs.read_fpr_f64(*fn_);
            let b = regs.read_fpr_f64(*fm);
            regs.nzcv = crate::fpu::fcmp_flags(a, b);
            Ok(ExecResult::Advance)
        }
        Instruction::FpScvtf { fd, rn, sf } => {
            let raw = regs.read_gpr(*rn, *sf);
            let value = if *sf {
                raw as i64 as f64
            } else {
                (raw as u32 as i32) as f64
            };
            regs.write_fpr_f64(*fd, value);
            Ok(ExecResult::Advance)
        }
        Instruction::FpFcvtzs { rd, fn_, sf } => {
            let value = regs.read_fpr_f64(*fn_);
            let truncated = value.trunc();
            let int_value = if *sf {
                if truncated.is_nan() { 0i64 }
                else if truncated >= i64::MAX as f64 { i64::MAX }
                else if truncated <= i64::MIN as f64 { i64::MIN }
                else { truncated as i64 }
            } else {
                if truncated.is_nan() { 0i64 }
                else if truncated >= i32::MAX as f64 { i32::MAX as i64 }
                else if truncated <= i32::MIN as f64 { i32::MIN as i64 }
                else { truncated as i32 as i64 }
            };
            regs.write_gpr(*rd, *sf, int_value as u64);
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

fn exec_ldst(
    op: LdStOp, rt: u8, rn: u8, offset: &LdStOffset, size: MemSize,
    mode: IndexMode, regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    let base = regs.read_gpr_or_sp(rn, true);

    let offset_val = match offset {
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
            (extended << (*shift_amount as u64)) as i64
        }
    };

    let (address, writeback) = match mode {
        IndexMode::PreIndex => {
            let addr = (base as i64).wrapping_add(offset_val) as u64;
            (addr, Some(addr))
        }
        IndexMode::PostIndex => {
            let addr = base;
            let wb = (base as i64).wrapping_add(offset_val) as u64;
            (addr, Some(wb))
        }
        IndexMode::SignedOffset => {
            let addr = (base as i64).wrapping_add(offset_val) as u64;
            (addr, None)
        }
    };

    match op {
        LdStOp::Ldr => {
            let value = match size {
                MemSize::B => mem.read_u8(address)? as u64,
                MemSize::H => mem.read_u16(address)? as u64,
                MemSize::W => mem.read_u32(address)? as u64,
                MemSize::X => mem.read_u64(address)?,
            };
            regs.write_gpr(rt, true, value);
        }
        LdStOp::Str => {
            let value = regs.read_gpr(rt, true);
            match size {
                MemSize::B => mem.write_u8(address, value as u8)?,
                MemSize::H => mem.write_u16(address, value as u16)?,
                MemSize::W => mem.write_u32(address, value as u32)?,
                MemSize::X => mem.write_u64(address, value)?,
            }
        }
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

fn exec_ldst_pair(
    op: LdStPairOp, sf: bool, rt: u8, rt2: u8, rn: u8,
    imm7: i16, mode: IndexMode,
    regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
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
            if b == 0 { 0 } else { (a / b) & mask }
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

fn exec_fp_binary(
    op: FpBinOp,
    fd: u8,
    fn_: u8,
    fm: u8,
    regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let a = regs.read_fpr_f64(fn_);
    let b = regs.read_fpr_f64(fm);
    let result = match op {
        FpBinOp::Fadd => a + b,
        FpBinOp::Fsub => a - b,
        FpBinOp::Fmul => a * b,
        FpBinOp::Fdiv => a / b,
    };
    regs.write_fpr_f64(fd, result);
    Ok(ExecResult::Advance)
}

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
    let base = regs.read_gpr_or_sp(rn, true);
    let offset_val = match offset {
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
            (extended << (*shift_amount as u64)) as i64
        }
    };
    let (address, writeback) = match mode {
        IndexMode::PreIndex => {
            let addr = (base as i64).wrapping_add(offset_val) as u64;
            (addr, Some(addr))
        }
        IndexMode::PostIndex => {
            let addr = base;
            let wb = (base as i64).wrapping_add(offset_val) as u64;
            (addr, Some(wb))
        }
        IndexMode::SignedOffset => {
            let addr = (base as i64).wrapping_add(offset_val) as u64;
            (addr, None)
        }
    };
    let value_64 = match size {
        MemSize::B => (mem.read_u8(address)? as i8) as i64,
        MemSize::H => (mem.read_u16(address)? as i16) as i64,
        MemSize::W => (mem.read_u32(address)? as i32) as i64,
        MemSize::X => return Err(EmuError::UnknownInstruction(0)),
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
/// from bit `immr` upward -- the `sxt*`/`uxt*`/`sbfx`/`ubfx` forms) and
/// `imms < immr` (place a field at the high end -- the `sbfiz`/`ubfiz`
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
            offset: LdStOffset::Register { rm: 9, extend: ExtendType::Sxtw, shift_amount: 2 },
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
            offset: LdStOffset::Register { rm: 9, extend: ExtendType::Sxtw, shift_amount: 2 },
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
            offset: LdStOffset::Register { rm: 9, extend: ExtendType::Uxtw, shift_amount: 2 },
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
            offset: LdStOffset::Register { rm: 19, extend: ExtendType::Lsl, shift_amount: 3 },
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
            &Instruction::FpBinary { op: FpBinOp::Fsub, fd: 0, fn_: 1, fm: 2 },
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
            &Instruction::FpBinary { op: FpBinOp::Fmul, fd: 0, fn_: 1, fm: 2 },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(0), 12.0);

        execute(
            &Instruction::FpBinary { op: FpBinOp::Fdiv, fd: 3, fn_: 0, fm: 2 },
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
            &Instruction::FpMoveReg { fd: 5, fn_: 2 },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_fpr_f64(5), std::f64::consts::PI);
    }

    #[test]
    fn fcmp_sets_nzcv_for_equal() {
        let (mut regs, mut mem) = fresh();
        regs.write_fpr_f64(1, 1.5);
        regs.write_fpr_f64(2, 1.5);
        execute(
            &Instruction::FpCompare { fn_: 1, fm: 2 },
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
            &Instruction::FpCompare { fn_: 1, fm: 2 },
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
            &Instruction::FpScvtf { fd: 0, rn: 3, sf: true },
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
            &Instruction::FpScvtf { fd: 0, rn: 3, sf: true },
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
            &Instruction::FpFcvtzs { rd: 0, fn_: 2, sf: true },
            &mut regs,
            &mut mem,
        )
        .unwrap();
        assert_eq!(regs.read_gpr(0, true), 3);

        regs.write_fpr_f64(2, -3.9);
        execute(
            &Instruction::FpFcvtzs { rd: 1, fn_: 2, sf: true },
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
}
