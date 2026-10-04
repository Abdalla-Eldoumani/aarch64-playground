//! The branch group: B and BL, B.cond, CBZ and CBNZ, TBZ and TBNZ, and
//! the branches through a register (BR, BLR, RET).

use super::*;

// ---------------------------------------------------------------------------
// branch group
// ---------------------------------------------------------------------------

pub(super) fn decode_branch_group(instr: u32) -> Result<Instruction, EmuError> {
    // compare-and-branch: x011_010o ... (CBZ when bit 24 = 0, CBNZ = 1)
    if (instr & 0x7E00_0000) == 0x3400_0000 {
        let sf = bit(instr, 31) == 1;
        let nonzero = bit(instr, 24) == 1;
        let imm19 = bits(instr, 23, 5);
        let rt = bits(instr, 4, 0) as u8;
        let offset = sign_extend(imm19, 19) * 4;
        return Ok(Instruction::CompareBranch {
            sf,
            rt,
            nonzero,
            offset,
        });
    }

    // test-bit-and-branch: b5_011_011_o b40_imm14_Rt (TBZ when bit 24 = 0, TBNZ = 1)
    if (instr & 0x7E00_0000) == 0x3600_0000 {
        let b5 = bit(instr, 31) as u8;
        let b40 = bits(instr, 23, 19) as u8;
        let bit_pos = (b5 << 5) | b40;
        let nonzero = bit(instr, 24) == 1;
        let imm14 = bits(instr, 18, 5);
        let rt = bits(instr, 4, 0) as u8;
        let offset = sign_extend(imm14, 14) * 4;
        return Ok(Instruction::TestBranch {
            rt,
            bit_pos,
            nonzero,
            offset,
        });
    }

    // conditional branch: 0101_010o oooo_oooo oooo_oooo ooo0_cccc
    if (instr & 0xFF00_0010) == 0x5400_0000 {
        let imm19 = bits(instr, 23, 5);
        let cond_bits = bits(instr, 3, 0) as u8;
        let offset = sign_extend(imm19, 19) * 4;
        let cond = Condition::from_u8(cond_bits)?;
        return Ok(Instruction::BCond { cond, offset });
    }

    // unconditional branch immediate: x001_01oo oooo_oooo oooo_oooo oooo_oooo
    if (instr & 0x7C00_0000) == 0x1400_0000 {
        let link = bit(instr, 31) == 1;
        let imm26 = bits(instr, 25, 0);
        let offset = sign_extend(imm26, 26) * 4;
        return Ok(Instruction::BrImm { link, offset });
    }

    // unconditional branch register: 1101_011_ 0___1_1111 0000_00nn nnn0_0000
    if (instr & 0xFE1F_FC1F) == 0xD61F_0000 {
        let opc = bits(instr, 24, 21);
        let rn = bits(instr, 9, 5) as u8;
        let op = match opc {
            0b0000 => BrRegOp::Br,
            0b0001 => BrRegOp::Blr,
            0b0010 => BrRegOp::Ret,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        return Ok(Instruction::BrReg { op, rn });
    }

    Err(EmuError::UnknownInstruction(instr))
}
