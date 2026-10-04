//! The branches: compare and branch, test bit and branch, B and BL, the
//! branches through a register, and B.cond.

use super::*;

pub(super) fn exec_compare_branch(
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

pub(super) fn exec_test_branch(
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

pub(super) fn exec_br_imm(
    link: bool, offset: i64, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    let pc = regs.read_pc();
    if link {
        regs.write_gpr(30, true, pc + 4); // X30 = return address
    }
    regs.write_pc((pc as i64 + offset) as u64);
    Ok(ExecResult::Branched)
}

pub(super) fn exec_br_reg(
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

pub(super) fn exec_bcond(
    cond: Condition, offset: i64, regs: &mut RegisterFile,
) -> Result<ExecResult, EmuError> {
    if regs.condition_holds(cond) {
        let pc = regs.read_pc();
        regs.write_pc((pc as i64 + offset) as u64);
        Ok(ExecResult::Branched)
    } else {
        Ok(ExecResult::Advance)
    }
}
