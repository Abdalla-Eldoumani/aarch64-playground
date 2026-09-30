//! The integer data-processing groups. The immediate group holds ADR,
//! add and subtract, move wide, logical, bitfield and extract; the
//! register group holds the shifted, extended and carry forms,
//! conditional compare and select, and the one-, two- and three-source
//! operations. The bitmask immediate is here in both directions.

use super::*;

// ---------------------------------------------------------------------------
// bitmask immediate decoder
// ---------------------------------------------------------------------------

/// Decode the N:immr:imms bitmask immediate encoding used by logical
/// instructions. Returns the 64-bit expanded bitmask.
///
/// ARM64 bitmask immediates encode repeating bit patterns. The element
/// size is determined by the highest bit of `NOT(imms)` when N=0, or
/// is 64 bits when N=1. Within each element, `imms` consecutive bits
/// are set starting at bit 0, then rotated right by `immr`.
pub fn decode_bitmask_imm(n: bool, immr: u8, imms: u8, sf: bool) -> Result<u64, EmuError> {
    let len = if n {
        6 // 64-bit element
    } else {
        // find highest bit of NOT(imms[5:0])
        let not_imms = (!imms) & 0x3F;
        if not_imms == 0 {
            return Err(EmuError::UnknownInstruction(0));
        }
        // highest set bit position (0-indexed)
        let mut len = 5u8;
        while len > 0 && (not_imms & (1 << len)) == 0 {
            len -= 1;
        }
        len
    };

    // reject if !sf and N=1
    if !sf && n {
        return Err(EmuError::UnknownInstruction(0));
    }

    let esize: u32 = 1 << len;
    let mask = esize - 1;

    let s = (imms as u32) & mask;
    let r = (immr as u32) & mask;

    // s == mask is a reserved encoding
    if s == mask {
        return Err(EmuError::UnknownInstruction(0));
    }

    // create element with (s+1) ones
    let ones: u64 = (1u64 << (s + 1)) - 1;

    // rotate right by r within the element
    let element_mask: u64 = if esize == 64 { u64::MAX } else { (1u64 << esize) - 1 };
    let element = if r == 0 {
        ones
    } else {
        ((ones >> r) | (ones << (esize - r))) & element_mask
    };

    // replicate across 64 bits
    let mut result = element;
    let mut width = esize;
    while width < 64 {
        result |= result << width;
        width *= 2;
    }

    if !sf {
        result &= 0xFFFF_FFFF;
    }

    Ok(result)
}

/// Encode a 64-bit value (or 32-bit when `!sf`) as the `(N, immr, imms)`
/// triple that `decode_bitmask_imm` consumes. Returns `None` when the
/// value isn't expressible as an ARM64 logical bitmask immediate; those
/// exclude all-zeros, all-ones, and any pattern that doesn't reduce to
/// a rotated run of ones in a 2/4/8/16/32/64-bit element.
pub fn encode_bitmask_imm(value: u64, sf: bool) -> Option<(bool, u8, u8)> {
    let reg_width: u32 = if sf { 64 } else { 32 };
    // Reject trivial patterns the ARM spec excludes.
    let trimmed = if sf { value } else { value & 0xFFFF_FFFF };
    if !sf && value != trimmed {
        // Upper 32 bits set in a 32-bit instruction: not encodable.
        return None;
    }
    if trimmed == 0 {
        return None;
    }
    if sf && trimmed == u64::MAX {
        return None;
    }
    if !sf && trimmed == 0xFFFF_FFFF {
        return None;
    }

    // Replicate the 32-bit value to 64 bits so the search below can treat
    // everything uniformly; the decoder does the same in reverse.
    let replicated: u64 = if sf {
        trimmed
    } else {
        trimmed | (trimmed << 32)
    };

    for &esize in &[2u32, 4, 8, 16, 32, 64] {
        if esize > reg_width {
            break;
        }
        let mask: u64 = if esize == 64 { u64::MAX } else { (1u64 << esize) - 1 };
        let element = replicated & mask;
        let mut stride: u32 = esize;
        let mut repeats = true;
        while stride < 64 {
            if ((replicated >> stride) & mask) != element {
                repeats = false;
                break;
            }
            stride += esize;
        }
        if !repeats {
            continue;
        }
        if element == 0 || element == mask {
            continue;
        }
        let ones = element.count_ones();
        // Try rotating right by each possible amount; a valid bitmask
        // immediate rotates into a contiguous run of ones in the low bits.
        for r in 0..esize {
            let rotated = if r == 0 {
                element
            } else {
                ((element >> r) | (element << (esize - r))) & mask
            };
            if rotated == (1u64 << ones) - 1 {
                let s_val = ones - 1;
                let n_bit = esize == 64;
                let len: u32 = match esize {
                    2 => 1,
                    4 => 2,
                    8 => 3,
                    16 => 4,
                    32 => 5,
                    64 => 6,
                    _ => unreachable!(),
                };
                let imms: u8 = if n_bit {
                    (s_val as u8) & 0x3F
                } else {
                    let upper_count = 5u32 - len;
                    let upper_bits = if upper_count == 0 {
                        0u8
                    } else {
                        (((1u32 << upper_count) - 1) as u8) << (len + 1)
                    };
                    upper_bits | ((s_val as u8) & ((1u8 << len) - 1))
                };
                // The loop found `r` such that ROR(element, r) == the
                // canonical low run of ones. The decoder reconstructs the
                // element as ROR(canonical, immr), so the encoded rotate is
                // the inverse: immr = (esize - r) mod esize. (For r == 0 the
                // modulo keeps immr == 0.)
                let immr = ((esize - r) % esize) as u8;
                return Some((n_bit, immr, imms));
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// data processing: immediate group
// ---------------------------------------------------------------------------

pub(super) fn decode_dp_imm_group(instr: u32) -> Result<Instruction, EmuError> {
    // PC-relative addressing (ADR / ADRP) sits in this group with the fixed
    // field bits[28:24] = 10000. Detect it before the op0 dispatch since its
    // op0 (bits 25:23) overlaps no other dp-immediate subgroup.
    if bits(instr, 28, 24) == 0b10000 {
        return decode_adr(instr);
    }

    let op0 = bits(instr, 25, 23);

    match op0 {
        // add/subtract immediate
        0b010 => decode_add_sub_imm(instr),
        // move wide immediate
        0b101 => decode_move_wide(instr),
        // logical immediate
        0b100 => decode_logical_imm(instr),
        // bitfield (used for LSL/LSR/ASR immediate via aliases)
        0b110 => decode_bitfield(instr),
        // extract (the encoding behind `ror Rd, Rn, #shift`)
        0b111 => decode_extract(instr),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

/// Decode EXTR, which AArch64 uses for `ROR Rd, Rn, #shift`: the ROR
/// alias is an EXTR whose two sources are the same register. Like the
/// shift aliases in `decode_bitfield`, it lowers onto the executor's
/// ORR-with-shifted-register path, since `ORR Rd, ZR, Rn, ROR #shift` is
/// bit-for-bit the same operation. A general EXTR (two different sources)
/// is its own instruction.
fn decode_extract(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let n = bit(instr, 22) == 1;
    let rm = bits(instr, 20, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    // op21 and o0 are fixed at zero, N tracks sf, and the 32-bit form's
    // rotate has to fit inside the register.
    if bits(instr, 30, 29) != 0 || bit(instr, 21) != 0 || sf != n || (!sf && imms >= 32) {
        return Err(EmuError::UnknownInstruction(instr));
    }
    if rm != rn {
        return Ok(Instruction::Extr { sf, rd, rn, rm, lsb: imms });
    }

    Ok(Instruction::LogReg {
        op: LogOp::Orr,
        sf,
        rd,
        rn: 31,
        rm: rn,
        shift: ShiftType::ROR,
        amount: imms,
        set_flags: false,
        invert: false,
    })
}

fn decode_adr(instr: u32) -> Result<Instruction, EmuError> {
    // ADR / ADRP: op[31] immlo[30:29] 1_0000 immhi[23:5] Rd[4:0].
    let adrp = bit(instr, 31) == 1;
    let immlo = bits(instr, 30, 29);
    let immhi = bits(instr, 23, 5);
    let imm21 = (immhi << 2) | immlo;
    let mut imm = sign_extend(imm21, 21);
    if adrp {
        // The page form scales the 21-bit immediate by 4 KiB.
        imm <<= 12;
    }
    let rd = bits(instr, 4, 0) as u8;
    Ok(Instruction::Adr { adrp, rd, imm })
}

fn decode_add_sub_imm(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op = bit(instr, 30);    // 0=ADD, 1=SUB
    let s = bit(instr, 29);     // set flags
    let shift = bit(instr, 22) as u8; // 0 or 1 (LSL #0 or LSL #12)
    let imm12 = bits(instr, 21, 10);
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpImm {
        op: dp_op,
        sf,
        rd,
        rn,
        imm: imm12,
        shift: shift * 12,
    })
}

fn decode_move_wide(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let hw = bits(instr, 22, 21) as u8;
    let imm16 = bits(instr, 20, 5) as u16;
    let rd = bits(instr, 4, 0) as u8;

    // 32-bit form cannot use hw >= 2
    if !sf && hw >= 2 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    let op = match opc {
        0b00 => MoveWideOp::Movn,
        0b10 => MoveWideOp::Movz,
        0b11 => MoveWideOp::Movk,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };

    Ok(Instruction::MoveWide {
        op,
        sf,
        rd,
        imm16,
        hw,
    })
}

fn decode_logical_imm(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 22) == 1;
    let immr = bits(instr, 21, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let imm = decode_bitmask_imm(n, immr, imms, sf)
        .map_err(|_| EmuError::UnknownInstruction(instr))?;

    let (op, set_flags) = match opc {
        0b00 => (LogOp::And, false),
        0b01 => (LogOp::Orr, false),
        0b10 => (LogOp::Eor, false),
        0b11 => (LogOp::And, true), // ANDS
        _ => unreachable!(),
    };

    Ok(Instruction::LogImm {
        op,
        sf,
        rd,
        rn,
        imm,
        set_flags,
    })
}

fn decode_bitfield(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 22) == 1;
    let immr = bits(instr, 21, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let reg_size: u8 = if sf { 64 } else { 32 };

    // The 32-bit form requires N == 0 with both fields inside the register
    // (immr/imms < 32); the 64-bit form requires N == 1. Anything else is
    // a reserved encoding: without this check `reg_size - immr` underflows
    // on a crafted word and fabricates a shift instead of rejecting.
    if sf != n || (!sf && (immr >= 32 || imms >= 32)) {
        return Err(EmuError::UnknownInstruction(instr));
    }

    // We represent shift-immediates as ORR Xd, XZR, Xn, <shift> #amount.
    // This reuses the LogReg path in the executor.
    match opc {
        // SBFM: ASR alias when imms == reg_size-1
        0b00 if imms == reg_size - 1 => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::ASR,
            amount: immr,
            set_flags: false,
            invert: false,
        }),
        // UBFM: LSR alias when imms == reg_size-1
        0b10 if imms == reg_size - 1 => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::LSR,
            amount: immr,
            set_flags: false,
            invert: false,
        }),
        // UBFM: LSL alias when imms+1 == immr
        0b10 if immr != 0 && imms + 1 == immr => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::LSL,
            amount: reg_size - immr,
            set_flags: false,
            invert: false,
        }),
        // General SBFM/UBFM: the extract-and-extend forms behind sxtb/sxth/
        // sxtw, uxtb/uxth, and sbfx/ubfx. The shift aliases above are
        // matched first, so only the genuine bitfield moves land here.
        0b00 => Ok(Instruction::Bitfield {
            op: BitfieldOp::Sbfm,
            sf,
            rd,
            rn,
            immr,
            imms,
        }),
        0b10 => Ok(Instruction::Bitfield {
            op: BitfieldOp::Ubfm,
            sf,
            rd,
            rn,
            immr,
            imms,
        }),
        // BFM (bitfield insert), the form behind bfi: unlike SBFM/UBFM it
        // reads Rd and preserves the bits outside the field.
        0b01 => Ok(Instruction::Bitfield {
            op: BitfieldOp::Bfm,
            sf,
            rd,
            rn,
            immr,
            imms,
        }),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

// ---------------------------------------------------------------------------
// data processing: register group
// ---------------------------------------------------------------------------

pub(super) fn decode_dp_reg_group(instr: u32) -> Result<Instruction, EmuError> {
    // sub-routing based on bits [28] and [24]:
    //   bit28=0, bit24=0 -> logical shifted register (01010)
    //   bit28=0, bit24=1 -> add/sub shifted register (01011)
    //   bit28=1, bit24=0 -> dp2 or conditional select (11010)
    //   bit28=1, bit24=1 -> dp3 / MADD / MUL (11011)
    let b28 = bit(instr, 28);
    let b24 = bit(instr, 24);

    match (b28, b24) {
        (0, 0) => decode_logical_reg(instr),
        (0, 1) => decode_add_sub_reg(instr),
        (1, 1) => decode_dp3(instr),
        (1, 0) => {
            // add/sub with carry vs conditional compare vs conditional
            // select vs dp2, by bits [23:21]
            // add/sub (with carry): bits[23:21] = 000, bits[15:10] = 000000
            // conditional compare:  bits[23:21] = 010
            // conditional select:   bits[23:21] = 100
            // dp2:                  bits[23:21] = 110
            let sub = bits(instr, 23, 21);
            if sub == 0b000 && bits(instr, 15, 10) == 0 {
                decode_add_sub_carry(instr)
            } else if sub == 0b010 {
                decode_cond_compare(instr)
            } else if sub == 0b100 {
                decode_cond_select(instr)
            } else {
                decode_dp2(instr)
            }
        }
        _ => unreachable!(),
    }
}

fn decode_add_sub_reg(instr: u32) -> Result<Instruction, EmuError> {
    // Bit 21 splits the register family: 0 is the shifted form (register
    // 31 reads as XZR), 1 is the extended form (register 31 is SP). The
    // two must not be conflated: executing `add x0, sp, x1` as shifted
    // silently computes with 0.
    if bit(instr, 21) == 1 {
        return decode_add_sub_ext(instr);
    }
    let sf = bit(instr, 31) == 1;
    let op_bit = bit(instr, 30);
    let s = bit(instr, 29);
    let shift = ShiftType::from_u8(bits(instr, 23, 22) as u8);
    let rm = bits(instr, 20, 16) as u8;
    let imm6 = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op_bit, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpReg {
        op: dp_op,
        sf,
        rd,
        rn,
        rm,
        shift,
        amount: imm6,
    })
}

/// ADC/ADCS/SBC/SBCS: sf_op_S_11010000_Rm_000000_Rn_Rd. Bit 30 picks
/// add vs subtract, bit 29 the flag-setting form. The caller has already
/// checked bits [23:21] and the fixed-zero [15:10] field, so every word
/// reaching here is one of the four.
fn decode_add_sub_carry(instr: u32) -> Result<Instruction, EmuError> {
    Ok(Instruction::DpCarry {
        sub: bit(instr, 30) == 1,
        set_flags: bit(instr, 29) == 1,
        sf: bit(instr, 31) == 1,
        rd: bits(instr, 4, 0) as u8,
        rn: bits(instr, 9, 5) as u8,
        rm: bits(instr, 20, 16) as u8,
    })
}

fn decode_add_sub_ext(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op_bit = bit(instr, 30);
    let s = bit(instr, 29);
    // The opt field (23:22) is reserved-zero in this form, and the
    // post-extend shift caps at 4; anything else is not an instruction.
    if bits(instr, 23, 22) != 0 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let rm = bits(instr, 20, 16) as u8;
    let option = bits(instr, 15, 13) as u8;
    let shift = bits(instr, 12, 10) as u8;
    if shift > 4 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op_bit, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpRegExt {
        op: dp_op,
        sf,
        rd,
        rn,
        rm,
        extend: RegExtend::from_option(option),
        shift,
    })
}

fn decode_logical_reg(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 21) == 1; // N bit: inverts rm
    let shift = ShiftType::from_u8(bits(instr, 23, 22) as u8);
    let rm = bits(instr, 20, 16) as u8;
    let imm6 = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let (op, set_flags, invert) = match (opc, n) {
        (0b00, false) => (LogOp::And, false, false),
        (0b00, true) => (LogOp::And, false, true),   // BIC
        (0b01, false) => (LogOp::Orr, false, false),
        (0b01, true) => (LogOp::Orr, false, true),   // ORN/MVN
        (0b10, false) => (LogOp::Eor, false, false),
        (0b10, true) => (LogOp::Eor, false, true),   // EON
        (0b11, false) => (LogOp::And, true, false),   // ANDS
        (0b11, true) => (LogOp::And, true, true),     // BICS
        _ => unreachable!(),
    };

    Ok(Instruction::LogReg {
        op,
        sf,
        rd,
        rn,
        rm,
        shift,
        amount: imm6,
        set_flags,
        invert,
    })
}

/// CCMP / CCMN: sf op S=1 11010010 imm5|Rm cond(4) imm o2=0 Rn o3=0 nzcv.
/// Bit 11 picks the immediate form; bits 10 and 4 are reserved zero.
fn decode_cond_compare(instr: u32) -> Result<Instruction, EmuError> {
    if bit(instr, 29) != 1 || bit(instr, 10) != 0 || bit(instr, 4) != 0 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let field = bits(instr, 20, 16) as u8;
    Ok(Instruction::CondCompare {
        sub: bit(instr, 30) == 1,
        sf: bit(instr, 31) == 1,
        rn: bits(instr, 9, 5) as u8,
        operand: if bit(instr, 11) == 1 {
            CondCmpOperand::Imm(field)
        } else {
            CondCmpOperand::Reg(field)
        },
        cond: Condition::from_u8(bits(instr, 15, 12) as u8)?,
        nzcv: bits(instr, 3, 0) as u8,
    })
}

fn decode_cond_select(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    // Bit 30 is the op field (0 = CSEL/CSINC, 1 = CSINV/CSNEG); bit 10
    // picks within each pair. gcc reaches CSNEG for abs()-shaped code
    // even at -O0.
    let op_bit = bit(instr, 30);
    let op2 = bit(instr, 10);
    let rm = bits(instr, 20, 16) as u8;
    let cond_bits = bits(instr, 15, 12) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let cond = Condition::from_u8(cond_bits)?;

    let op = match (op_bit, op2) {
        (0, 0) => CondSelOp::Csel,
        (0, 1) => CondSelOp::Csinc,
        (1, 0) => CondSelOp::Csinv,
        (1, 1) => CondSelOp::Csneg,
        _ => unreachable!(),
    };

    Ok(Instruction::CondSel {
        op,
        sf,
        rd,
        rn,
        rm,
        cond,
    })
}

fn decode_dp2(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    // Bit 30 set marks the 1-source data-processing group, which shares
    // this decode entry. Its rows come from the shared table, keyed on
    // (opcode, sf) because rev at W width and rev32 at X width collide on
    // opcode 000010. Without this branch a `.word`-crafted rev32 falls
    // through to the 2-source table and runs as udiv.
    if bit(instr, 30) != 0 {
        if bit(instr, 29) != 0 || bits(instr, 20, 16) != 0 {
            return Err(EmuError::UnknownInstruction(instr));
        }
        let opcode = bits(instr, 15, 10) as u8;
        let Some((_, _, _, op)) = DP1_OPS
            .iter()
            .find(|(_, code, needs_sf, _)| *code == opcode && needs_sf.is_none_or(|want| want == sf))
        else {
            return Err(EmuError::UnknownInstruction(instr));
        };
        return Ok(Instruction::DataProc1 {
            op: *op,
            sf,
            rd: bits(instr, 4, 0) as u8,
            rn: bits(instr, 9, 5) as u8,
        });
    }
    let s = bit(instr, 29);
    let opcode = bits(instr, 15, 10);
    let rm = bits(instr, 20, 16) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    if s != 0 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    // LSLV/LSRV/ASRV/RORV share the dp2 space: shift Rn by Rm modulo the
    // register width. The assembler emits these for `lsl x0, x1, x2`, so
    // decode must read them back or the register-form shifts die mid-run.
    if (opcode & !0b11) == 0b001000 {
        return Ok(Instruction::VarShift {
            sf,
            rd,
            rn,
            rm,
            shift: ShiftType::from_u8((opcode & 0b11) as u8),
        });
    }

    let op = match opcode {
        0b000010 => MulDivOp::Udiv,
        0b000011 => MulDivOp::Sdiv,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };

    Ok(Instruction::MulDiv {
        op,
        sf,
        rd,
        rn,
        rm,
    })
}

fn decode_dp3(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op31 = bits(instr, 23, 21);
    let o0 = bit(instr, 15);
    let rm = bits(instr, 20, 16) as u8;
    let ra = bits(instr, 14, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    // MADD / MSUB share op31=000; o0 selects between them.
    if op31 == 0b000 {
        // Keep MUL (MADD with Ra=XZR and o0=0) on the existing MulDiv::Mul
        // path so older tests and the legacy assembler still match it.
        if ra == 31 && o0 == 0 {
            return Ok(Instruction::MulDiv {
                op: MulDivOp::Mul,
                sf,
                rd,
                rn,
                rm,
            });
        }
        let op = if o0 == 0 {
            MulAccumulateOp::Madd
        } else {
            MulAccumulateOp::Msub
        };
        return Ok(Instruction::MulAccumulate {
            op,
            sf,
            rd,
            rn,
            rm,
            ra,
        });
    }

    // SMULL/UMULL are SMADDL/UMADDL with Ra=XZR and stay on their own
    // rows so the disassembly reads the way GAS writes it. SMULH/UMULH
    // keep the `ra == 31` requirement because their Ra field is
    // architecturally fixed; the widening rows do not, since Ra is the
    // accumulator there.
    if sf {
        let op = match (op31, o0, ra == 31) {
            (0b001, 0, true) => Some(MulWideOp::Smull),
            (0b101, 0, true) => Some(MulWideOp::Umull),
            (0b010, 0, true) => Some(MulWideOp::Smulh),
            (0b110, 0, true) => Some(MulWideOp::Umulh),
            (0b001, 0, false) => Some(MulWideOp::Smaddl),
            (0b001, 1, _) => Some(MulWideOp::Smsubl),
            (0b101, 0, false) => Some(MulWideOp::Umaddl),
            (0b101, 1, _) => Some(MulWideOp::Umsubl),
            _ => None,
        };
        if let Some(op) = op {
            return Ok(Instruction::MulWide { op, rd, rn, rm, ra });
        }
    }

    Err(EmuError::UnknownInstruction(instr))
}
