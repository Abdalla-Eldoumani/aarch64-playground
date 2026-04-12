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
    /// Execution should halt (SVC).
    Halted,
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
        Instruction::Nop => Ok(ExecResult::Advance),
        Instruction::Svc { .. } => Ok(ExecResult::Halted),
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
        LdStOffset::Register { rm, shift_amount } => {
            let idx = regs.read_gpr(*rm, true);
            (idx << (*shift_amount as u64)) as i64
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
    fn svc_halts() {
        let (mut regs, mut mem) = fresh();
        let result = execute(&Instruction::Svc { imm16: 0 }, &mut regs, &mut mem).unwrap();
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
}
