//! Bitwise encoders: the logical operations, shifts and rotates, the
//! bitfield moves and their extend aliases, and bit and byte reversal.

use super::*;

pub(super) fn encode_log_reg(ops: &[&str], opc: u8, n: bool, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 && ops.len() != 4 {
        return asm_err(
            ln,
            "this logical op takes 3 operands, or 4 with a shift modifier (and x0, x1, x2, lsr #4)",
        );
    }
    reject_sp_operands(ops, ln, "a logical op")?;
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    // N inverts Rm: AND+N is BIC, ORR+N is ORN (the MVN encoder sets it inline).
    let n_bit = if n { 1u32 } else { 0 };
    let (shift_bits, shift_amt) = if ops.len() == 4 {
        parse_shift_modifier(ops[3], if sf { 64 } else { 32 }, true, ln)?
    } else {
        (0, 0)
    };

    Ok((sf_bit << 31) | ((opc as u32) << 29) | (0b01010 << 24) | (shift_bits << 22)
        | (n_bit << 21) | ((rm as u32) << 16) | ((shift_amt as u32) << 10)
        | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `BIC Xd, Xn, Xm` (bit clear: `Xd = Xn & ~Xm`). AND-shifted-register
/// with the N bit set; AArch64 has no BIC-immediate, so a `#imm` third
/// operand gets a plain-language error instead of a register-parse failure.
pub(super) fn encode_bic(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // The vector BIC takes either an immediate or a third register, and
    // unlike the general-register one it does have an immediate form.
    if ops.first().is_some_and(|o| parse_vec_operand(o).is_some()) {
        return encode_vector_logical(ops, SimdImmOp::Bic, ln);
    }
    if ops.len() != 3 && ops.len() != 4 {
        return asm_err(
            ln,
            "BIC takes 3 operands, or 4 with a shift modifier (bic x0, x1, x2, lsl #1)",
        );
    }
    let op3 = ops[2].trim();
    if op3.starts_with('#') || op3.starts_with('\'') || op3.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '-')
    {
        return asm_err(ln, "BIC takes a register, not an immediate; use AND with the inverted mask");
    }
    encode_log_reg(ops, 0b00, true, ln)
}

/// The two field layouts every SBFM/UBFM/BFM alias uses. `Extract` is the
/// `Rd, Rn, #lsb, #width` reading UBFX/SBFX/BFXIL share; `Insert` is the
/// one UBFIZ/SBFIZ/BFI share. Splitting them out is what lets six aliases
/// be six dispatch arms instead of six copies of the same validation.
pub(super) enum BitfieldForm {
    /// UBFX / SBFX / BFXIL: immr = lsb, imms = lsb + width - 1.
    Extract,
    /// UBFIZ / SBFIZ / BFI: immr = (size - lsb) % size, imms = width - 1.
    Insert,
}

/// Encode one bitfield alias onto SBFM/UBFM/BFM. `opc` is the ARM opc
/// field (00 = SBFM, 10 = UBFM, 01 = BFM) and `form` picks which of the
/// two immr/imms formulas the alias uses. N tracks sf, as it does for
/// every valid bitfield encoding.
pub(super) fn encode_bitfield_alias(
    ops: &[&str], name: &str, opc: u32, form: BitfieldForm, ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, &format!("{name} requires 4 operands: Rd, Rn, #lsb, #width"));
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let lsb = parse_immediate(ops[2], ln)?;
    let width = parse_immediate(ops[3], ln)?;
    let reg_size: i64 = if sf { 64 } else { 32 };

    if width < 1 {
        return asm_err(ln, &format!("{name} width must be at least 1"));
    }
    if lsb < 0 || lsb >= reg_size {
        return asm_err(ln, &format!("{name} lsb is out of range for the register width"));
    }
    if lsb + width > reg_size {
        return asm_err(ln, &format!("{name} field runs past the top of the register"));
    }

    let (immr, imms) = match form {
        BitfieldForm::Extract => (lsb as u32, (lsb + width - 1) as u32),
        BitfieldForm::Insert => (((reg_size - lsb) % reg_size) as u32, (width - 1) as u32),
    };
    let sf_bit = if sf { 1u32 } else { 0 };
    let n_bit = sf_bit; // N matches sf for the valid SBFM/UBFM/BFM encodings
    Ok((sf_bit << 31) | (opc << 29) | (0b100110 << 23) | (n_bit << 22)
        | (immr << 16) | (imms << 10) | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `ROR Rd, Rn, #shift` and `ROR Rd, Rn, Rm`. The immediate form is
/// the EXTR alias GAS emits (an EXTR whose two sources are both Rn); the
/// register form is RORV, which shares the dp2 variable-shift space with
/// LSLV/LSRV/ASRV.
pub(super) fn encode_ror(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "ROR requires 3 operands: Rd, Rn, #shift or Rm");
    }
    reject_sp_operands(ops, ln, "ROR")?;
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    let op3 = ops[2].trim();

    if op3.starts_with('#') || op3.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        let reg_size: i64 = if sf { 64 } else { 32 };
        let amount = parse_immediate(op3, ln)?;
        if !(0..reg_size).contains(&amount) {
            return asm_err(
                ln,
                &format!(
                    "rotate amount {amount} is out of range for a {reg_size}-bit register \
                     (valid: 0-{})",
                    reg_size - 1
                ),
            );
        }
        // EXTR Rd, Rn, Rn, #amount. N tracks sf, as it does for every
        // other extract/bitfield encoding.
        return Ok((sf_bit << 31) | (0b00100111 << 23) | (sf_bit << 22)
            | ((rn as u32) << 16) | ((amount as u32) << 10) | ((rn as u32) << 5) | (rd as u32));
    }

    // RORV: the dp2 variable-shift form, opcode 001011.
    let (rm, _) = parse_register(op3, ln)?;
    Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
        | (0b001011 << 10) | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `EXTR Rd, Rn, Rm, #lsb`: bits lsb and up of the pair Rn:Rm.
/// ROR by an immediate is the same word with Rn repeated.
pub(super) fn encode_extr(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, "EXTR requires 4 operands: Rd, Rn, Rm, #lsb");
    }
    reject_sp_operands(ops, ln, "EXTR")?;
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, sf_n) = parse_register(ops[1], ln)?;
    let (rm, sf_m) = parse_register(ops[2], ln)?;
    if sf_n != sf || sf_m != sf {
        return asm_err(ln, "EXTR takes three registers of the same width");
    }
    let reg_size: i64 = if sf { 64 } else { 32 };
    let lsb = parse_immediate(ops[3], ln)?;
    if !(0..reg_size).contains(&lsb) {
        return asm_err(ln, &format!("EXTR takes an lsb from 0 to {} here, not {lsb}", reg_size - 1));
    }
    let sf_bit = u32::from(sf);
    Ok((sf_bit << 31) | (0b00100111 << 23) | (sf_bit << 22)
        | ((rm as u32) << 16) | ((lsb as u32) << 10) | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `MVN Rd, Rm` (and `MVN Rd, Rm, LSL #k`) as `ORN Rd, ZR, Rm`.
/// Delegating rather than spelling the word inline is what gives the
/// shifted form for free, the same way BIC gets it from `encode_log_reg`.
pub(super) fn encode_mvn(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(
            ln,
            "MVN takes 2 operands, or 3 with a shift modifier (mvn x0, x1, lsl #2)",
        );
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    if ops.len() == 3 {
        return encode_log_reg(&[ops[0], zr, ops[1], ops[2]], 0b01, true, ln);
    }
    encode_log_reg(&[ops[0], zr, ops[1]], 0b01, true, ln)
}

/// Dispatch `AND/ANDS/ORR/EOR` between the register-register form and the
/// bitmask-immediate form based on the third operand's shape. `opc`
/// follows the ARM encoding's opc field: 00=AND, 01=ORR, 10=EOR, 11=ANDS.
pub(super) fn encode_log_dispatch(ops: &[&str], opc: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() == 3 {
        let op3 = ops[2].trim();
        if op3.starts_with('#')
            || op3.starts_with('\'')
            || op3.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '-')
        {
            let (rd, sf) = parse_register(ops[0], ln)?;
            let (rn, _) = parse_register(ops[1], ln)?;
            let value = parse_immediate(op3, ln)? as u64;
            return encode_log_imm_fields(rn, rd, value, sf, opc as u32, ln);
        }
    }
    encode_log_reg(ops, opc, false, ln)
}

pub(super) fn encode_tst(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // TST Xn, Xm/imm -> ANDS XZR, Xn, Xm/imm.
    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(
            ln,
            "TST takes 2 operands, or 3 with a shift modifier (tst x0, x1, lsl #2)",
        );
    }
    let (rn, sf) = parse_register(ops[0], ln)?;
    if ops.len() == 3 {
        let zr = if sf { "XZR" } else { "WZR" };
        let new_ops = [zr, ops[0], ops[1], ops[2]];
        return encode_log_reg(&new_ops, 0b11, false, ln);
    }
    let op2 = ops[1].trim();
    // Immediate form: emit ANDS-immediate with Rd=ZR.
    if op2.starts_with('#') || op2.starts_with('\'') || op2.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '-')
    {
        let value = parse_immediate(op2, ln)? as u64;
        return encode_log_imm_fields(rn, 31, value, sf, 0b11, ln);
    }
    let zr = if sf { "XZR" } else { "WZR" };
    let new_ops = [zr, ops[0], ops[1]];
    encode_log_reg(&new_ops, 0b11, false, ln)
}

/// Emit a logical immediate encoding: `AND/ORR/EOR/ANDS Rd, Rn, #imm`.
/// `opc` is 00=AND, 01=ORR, 10=EOR, 11=ANDS. The value must be a valid
/// ARM64 bitmask immediate per `decode_bitmask_imm`; arbitrary constants
/// (e.g. `#3` in 32-bit mode) round-trip, pathological ones (all zeros /
/// all ones / non-replicating patterns) are rejected loudly.
pub(super) fn encode_log_imm_fields(
    rn: u8,
    rd: u8,
    value: u64,
    sf: bool,
    opc: u32,
    ln: usize,
) -> Result<u32, EmuError> {
    // GAS truncates a negative or inverted logical immediate to the operand
    // width (`and w0, w1, #~1` is `#0xfffffffe`); without the mask the
    // sign-extended 64-bit value can never be a valid 32-bit pattern and
    // the error quoted a number the student never wrote.
    let value = if sf { value } else { value & 0xFFFF_FFFF };
    let (n_bit, immr, imms) = crate::decoder::encode_bitmask_imm(value, sf)
        .ok_or_else(|| {
            asm_error(
                ln,
                &format!(
                    "{value:#x} is not a valid bitmask immediate (AND/ORR/EOR take only \
                     repeating-bit patterns; load the constant with mov/ldr = first)"
                ),
            )
        })?;
    let sf_bit: u32 = if sf { 1 } else { 0 };
    let n_enc: u32 = if n_bit { 1 } else { 0 };
    Ok((sf_bit << 31)
        | (opc << 29)
        | (0b100100 << 23)
        | (n_enc << 22)
        | ((immr as u32) << 16)
        | ((imms as u32) << 10)
        | ((rn as u32) << 5)
        | (rd as u32))
}

pub(super) fn encode_shift(ops: &[&str], shift_type: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "shift requires 3 operands");
    }
    reject_sp_operands(ops, ln, "a shift")?;
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let op3 = ops[2].trim();
    let sf_bit = if sf { 1u32 } else { 0 };
    let reg_size: u8 = if sf { 64 } else { 32 };

    // immediate form via UBFM/SBFM
    if op3.starts_with('#') || op3.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        // Validate the full-width value BEFORE narrowing: `as u8` wraps
        // mod 256, and the UBFM field math below wraps again, so an
        // out-of-range amount assembles into a different instruction
        // (`lsl x0, x1, #64` becomes `lsr x0, x1, #3`). GAS
        // rejects anything outside the register width.
        let raw = parse_immediate(op3, ln)?;
        if !(0..reg_size as i64).contains(&raw) {
            return asm_err(
                ln,
                &format!(
                    "shift amount {raw} is out of range for a {reg_size}-bit register (valid: 0-{})",
                    reg_size - 1
                ),
            );
        }
        let amt = raw as u8;
        let (opc, immr, imms) = match shift_type {
            0 => {
                // LSL: UBFM Xd, Xn, #(reg_size - amt), #(reg_size - 1 - amt)
                (0b10, (reg_size.wrapping_sub(amt)) % reg_size, reg_size - 1 - amt)
            }
            1 => {
                // LSR: UBFM Xd, Xn, #amt, #(reg_size - 1)
                (0b10, amt, reg_size - 1)
            }
            2 => {
                // ASR: SBFM Xd, Xn, #amt, #(reg_size - 1)
                (0b00, amt, reg_size - 1)
            }
            // The dispatch passes only 0/1/2; anything else is a crate
            // bug, and on wasm a panic costs the whole worker where an
            // error is one calm halt.
            _ => {
                return asm_err(ln, INTERNAL_ASSEMBLER_BUG);
            }
        };

        let n_bit = if sf { 1u32 } else { 0 };
        return Ok((sf_bit << 31) | ((opc as u32) << 29) | (0b100110 << 23)
            | (n_bit << 22) | ((immr as u32) << 16) | ((imms as u32) << 10)
            | ((rn as u32) << 5) | (rd as u32));
    }

    // register form: variable shifts go through LSLV/LSRV/ASRV (dp2 instrs).
    // LSLV layout: sf_0_S=0_11010110_Rm_0010_00_Rn_Rd
    let (rm, _) = parse_register(op3, ln)?;
    let opcode: u32 = match shift_type {
        0 => 0b001000, // LSLV
        1 => 0b001001, // LSRV
        2 => 0b001010, // ASRV
        _ => {
            return asm_err(ln, INTERNAL_ASSEMBLER_BUG);
        }
    };
    Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
        | (opcode << 10) | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `sxtb`/`sxth`/`sxtw`/`uxtb`/`uxth Rd, Wn`. These are SBFM/UBFM
/// aliases with `immr = 0` and `imms` fixed per width (7/15/31). The
/// destination width picks the 64- vs 32-bit form (and the N bit, which
/// tracks `sf` for these encodings).
#[allow(clippy::identity_op)] // zero fields kept to document the full encoding layout
pub(super) fn encode_extend(ops: &[&str], signed: bool, imms: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "sign/zero extend requires 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let opc: u32 = if signed { 0b00 } else { 0b10 }; // SBFM vs UBFM
    let sf_bit = if sf { 1u32 } else { 0 };
    let n_bit = if sf { 1u32 } else { 0 };
    Ok((sf_bit << 31)
        | (opc << 29)
        | (0b100110 << 23)
        | (n_bit << 22)
        | (0 << 16) // immr = 0
        | ((imms as u32) << 10)
        | ((rn as u32) << 5)
        | (rd as u32))
}

/// Encode `UXTW Xd, Wn` the way GAS does: as `ORR Wd, WZR, Wn`, the
/// 32-bit MOV, whose W-width write clears the top half for free. It is
/// NOT lowered to UBFM here; binutils disassembles that word as `ubfx`
/// and never as `uxtw`. The `uxtw` in `EXTEND_KEYWORDS` and
/// `decoder::LDST_EXTENDS` is the unrelated addressing keyword and stays
/// exactly as it is.
pub(super) fn encode_extend_word(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "UXTW requires 2 operands: UXTW Xd, Wn");
    }
    reject_sp_operands(ops, ln, "UXTW")?;
    let (rd, _) = parse_register(ops[0], ln)?;
    let (rn, rn_x) = parse_register(ops[1], ln)?;
    if rn_x {
        return asm_err(
            ln,
            "UXTW takes a W source (uxtw xd, wn); from an X source the value is already 64 bits",
        );
    }
    Ok(0x2A00_0000 | ((rn as u32) << 16) | (0b11111 << 5) | (rd as u32))
}

/// CLZ / CLS / RBIT / REV / REV16 / REV32 Rd, Rn. `name` keys into
/// `DP1_OPS` together with the destination width, because `rev` at W
/// width and `rev32` at X width share one opcode.
pub(super) fn encode_dp1(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, &format!("{name} requires 2 operands: {name} rd, rn"));
    }
    reject_sp_operands(ops, ln, name)?;
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, rn_sf) = parse_register(ops[1], ln)?;
    if sf != rn_sf {
        return asm_err(ln, &format!("{name} needs both registers at the same width"));
    }
    let Some((_, opcode, _, _)) = DP1_OPS
        .iter()
        .find(|(mn, _, needs_sf, _)| *mn == name && needs_sf.is_none_or(|want| want == sf))
    else {
        // rev32 is the only row without a counterpart at the other width,
        // so a missing row is always rev32.
        return asm_err(
            ln,
            &format!(
                "{name} has no {} form: the 32-bit byte-swap is rev wd, wn",
                if sf { "X" } else { "W" }
            ),
        );
    };
    let sf_bit = if sf { 1u32 } else { 0 };
    // sf_1_S=0_11010110_00000_opcode(6)_Rn_Rd
    Ok((sf_bit << 31)
        | (0b1011010110 << 21)
        | (u32::from(*opcode) << 10)
        | ((rn as u32) << 5)
        | (rd as u32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::rejects;
    use crate::cpu::Cpu;

    #[test]
    fn bic_and_mvn_refuse_an_immediate_source() {
        // Both are register-only aliases; the shifted-register arity fix
        // must not have opened a door to an immediate GAS would refuse.
        rejects(assemble("BIC X0, X1, #1"), "use AND with the inverted mask");
        rejects(assemble("MVN X0, #1"), "expected a register here, got `#1`");
        assert!(assemble("BIC X0, X1, X2, LSL #1").is_ok());
        assert!(assemble("MVN X0, X1, LSL #2").is_ok());
    }

    #[test]
    fn data_processing_one_source_widths_do_not_collide() {
        use crate::cpu::Cpu;
        use crate::decoder::{decode, Dp1Op, Instruction};
        let labels = HashMap::new();
        for (src, want, op, sf) in [
            ("clz x0, x1", 0xDAC0_1020u32, Dp1Op::Clz, true),
            ("clz w0, w1", 0x5AC0_1020, Dp1Op::Clz, false),
            ("cls x0, x1", 0xDAC0_1420, Dp1Op::Cls, true),
            ("cls w0, w1", 0x5AC0_1420, Dp1Op::Cls, false),
            ("rbit x0, x1", 0xDAC0_0020, Dp1Op::Rbit, true),
            ("rbit w0, w1", 0x5AC0_0020, Dp1Op::Rbit, false),
            ("rev x0, x1", 0xDAC0_0C20, Dp1Op::Rev, true),
            ("rev w0, w1", 0x5AC0_0820, Dp1Op::Rev, false),
            ("rev16 x0, x1", 0xDAC0_0420, Dp1Op::Rev16, true),
            ("rev16 w0, w1", 0x5AC0_0420, Dp1Op::Rev16, false),
            ("rev32 x0, x1", 0xDAC0_0820, Dp1Op::Rev32, true),
        ] {
            let word = encode_line(src, 0, &labels, 1).unwrap();
            assert_eq!(word, want, "{src}");
            // rev at W width and rev32 at X width share opcode 000010, so
            // the decode direction has to be pinned too.
            match decode(word).unwrap() {
                Instruction::DataProc1 { op: got, sf: got_sf, rd: 0, rn: 1 } => {
                    assert_eq!((got, got_sf), (op, sf), "{src}");
                }
                other => panic!("{src} decoded to {other:?}"),
            }
        }
        let err = encode_line("rev32 w0, w1", 0, &labels, 1).unwrap_err().to_string();
        assert!(err.contains("no W form"), "{err}");
        let source = r#"
            MOVZ X1, #0xCDEF
            MOVK X1, #0x89AB, LSL #16
            MOVK X1, #0x4567, LSL #32
            MOVK X1, #0x0123, LSL #48
            MOVZ W2, #0x4567
            MOVK W2, #0x0123, LSL #16
            REV X3, X1
            REV32 X4, X1
            REV16 X5, X1
            REV W6, W2
            REV16 W7, W2
            RBIT X8, X1
            RBIT W9, W2
            CLZ X10, X1
            CLZ W11, W2
            CLS X12, X1
            CLS W13, W2
            MOV X14, XZR
            CLZ X15, X14
            CLZ W16, W14
            CLS X17, X14
            CLS W18, W14
            MOV X19, #-1
            CLS X20, X19
            CLS W21, W19
            MOVZ X22, #0xFF
            REV X23, X22
            REV16 X24, X22
            REV32 X25, X22
            REV W26, W22
            REV16 W27, W22
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        let x = |r: u8| cpu.regs.read_gpr(r, true);
        let w = |r: u8| cpu.regs.read_gpr(r, false);
        // The collision, on one input: rev walks all eight bytes, rev32
        // only the four inside each word.
        assert_eq!(x(3), 0xEFCD_AB89_6745_2301);
        assert_eq!(x(4), 0x6745_2301_EFCD_AB89);
        assert_eq!(x(5), 0x2301_6745_AB89_EFCD);
        assert_eq!(w(6), 0x6745_2301);
        assert_eq!(w(7), 0x2301_6745);
        assert_eq!(x(8), 0xF7B3_D591_E6A2_C480);
        assert_eq!(w(9), 0xE6A2_C480);
        assert_eq!(x(10), 7);
        assert_eq!(w(11), 7);
        assert_eq!(x(12), 6);
        assert_eq!(w(13), 6);
        // Zero is the boundary a shared 64-bit body gets wrong at W width.
        assert_eq!(x(15), 64);
        assert_eq!(w(16), 32);
        // CLS of 0 and of -1 both answer width minus one, never the width.
        assert_eq!(x(17), 63);
        assert_eq!(w(18), 31);
        assert_eq!(x(20), 63);
        assert_eq!(w(21), 31);
        // 0xFF is the input where the three byte reversals disagree.
        assert_eq!(x(23), 0xFF00_0000_0000_0000);
        assert_eq!(x(24), 0x0000_0000_0000_FF00);
        assert_eq!(x(25), 0x0000_0000_FF00_0000);
        assert_eq!(w(26), 0xFF00_0000);
        assert_eq!(w(27), 0x0000_FF00);
    }

    #[test]
    fn out_of_range_shift_amounts_are_rejected_not_rewritten() {
        // Each of these assembles into a DIFFERENT instruction through
        // u8 wrap plus field overflow; GAS rejects all.
        for src in [
            "LSL X0, X1, #64",
            "LSL W0, W1, #32",
            "LSL X0, X1, #65",
            "LSR X0, X1, #64",
            "LSR W0, W1, #32",
            "ASR X0, X1, #300",
            "LSL X0, X1, #256",
            "LSL X0, X1, #-1",
        ] {
            let err = assemble(src).unwrap_err();
            assert!(
                err.to_string().contains("out of range"),
                "{src} was: {err}"
            );
        }
        // The boundaries stay legal.
        assert!(assemble("LSL X0, X1, #63").is_ok());
        assert!(assemble("LSR W0, W1, #31").is_ok());
        assert!(assemble("ASR X0, X1, #0").is_ok());
    }

    #[test]
    fn register_form_shifts_assemble_and_execute() {
        // Both directions have to agree: an encoder-only LSLV assembles
        // fine and then dies mid-run with a raw hex word.
        let source = r#"
            MOV X1, #5
            MOV X2, #3
            LSL X3, X1, X2
            LSR X4, X3, X2
            MOV X5, #-16
            MOV X6, #2
            ASR X7, X5, X6
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_gpr(3, true), 40);
        assert_eq!(cpu.regs.read_gpr(4, true), 5);
        assert_eq!(cpu.regs.read_gpr(7, true) as i64, -4);
    }

    #[test]
    fn logical_immediates_mask_to_the_register_width() {
        // GAS accepts `and w0, w1, #-2` as #0xfffffffe (31 ones, one zero);
        // 0x0A7D_F820 read off the A64 logical-immediate tables: sf=0,
        // opc=00, N=0, immr=31, imms=61, verified against gcc output.
        let w = assemble("AND W0, W1, #-2").unwrap()[0];
        assert_eq!(w, assemble("AND W0, W1, #0xFFFFFFFE").unwrap()[0]);
        // The evaluator's ~1 spelling arrives here as -2 as well.
        let x = assemble("AND X0, X1, #-2").unwrap()[0];
        assert_eq!(x, 0x927F_F820);
        // A genuinely invalid pattern names the remedy.
        let err = assemble("AND W0, W1, #0x12345").unwrap_err();
        assert!(err.to_string().contains("mov"), "was: {err}");
    }

    // -- sign / zero extension --

    #[test]
    fn assemble_sxtb_round_trips_as_sbfm() {
        let code = assemble("SXTB X0, W1").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
                assert_eq!(op, crate::decoder::BitfieldOp::Sbfm);
                assert!(sf);
                assert_eq!(rd, 0);
                assert_eq!(rn, 1);
                assert_eq!(immr, 0);
                assert_eq!(imms, 7);
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn assemble_uxth_round_trips_as_ubfm() {
        let code = assemble("UXTH W3, W2").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::Bitfield { op, sf, imms, .. } => {
                assert_eq!(op, crate::decoder::BitfieldOp::Ubfm);
                assert!(!sf);
                assert_eq!(imms, 15);
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn uxtw_zero_extends_a_word_into_an_x_register() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("uxtw x0, w0", 0x2A00_03E0u32),
            ("uxtw x2, w1", 0x2A01_03E2),
            // GAS narrows the X destination to the W form, so both
            // spellings assemble to the same word.
            ("uxtw w0, w0", 0x2A00_03E0),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let err = encode_line("uxtw x0, x0", 0, &labels, 1).unwrap_err().to_string();
        assert!(err.contains("W source"), "{err}");
        let source = r#"
            MOV X1, #-1
            UXTW X2, W1
            SXTW X3, W1
            MOVZ X4, #0xDEF0
            MOVK X4, #0x9ABC, LSL #16
            MOVK X4, #0x5678, LSL #32
            MOVK X4, #0x1234, LSL #48
            UXTW X5, W4
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(30).unwrap();
        // -1 is the only value that separates uxtw from sxtw and from a copy
        assert_eq!(cpu.regs.read_gpr(2, true), 0x0000_0000_FFFF_FFFF);
        assert_eq!(cpu.regs.read_gpr(3, true), 0xFFFF_FFFF_FFFF_FFFF);
        assert_eq!(cpu.regs.read_gpr(5, true), 0x0000_0000_9ABC_DEF0);
    }

    #[test]
    fn assemble_all_extends_distinct() {
        let mnemonics = ["SXTB", "SXTH", "SXTW", "UXTB", "UXTH"];
        let mut words = Vec::new();
        for mn in mnemonics {
            words.push(assemble(&format!("{mn} X0, W1")).unwrap()[0]);
        }
        for i in 0..words.len() {
            for j in (i + 1)..words.len() {
                assert_ne!(words[i], words[j], "{} vs {}", mnemonics[i], mnemonics[j]);
            }
        }
    }

    // -- binary immediates --

    #[test]
    fn assemble_tst_single_bit_immediate_round_trips() {
        // `tst w0, #2` is a valid single-bit bitmask immediate; the encoder
        // must produce a word whose logical immediate decodes back to 2.
        let code = assemble("TST W0, #2").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::LogImm { imm, set_flags, .. } => {
                assert!(set_flags);
                assert_eq!(imm, 2);
            }
            other => panic!("expected LogImm, got {other:?}"),
        }
    }

    // -- bit clear --

    #[test]
    fn assemble_bic_round_trips() {
        let code = assemble("BIC X0, X1, X2").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::LogReg { op, sf, rd, rn, rm, set_flags, invert, .. } => {
                assert_eq!(op, crate::decoder::LogOp::And);
                assert!(sf);
                assert_eq!((rd, rn, rm), (0, 1, 2));
                assert!(!set_flags);
                assert!(invert);
            }
            other => panic!("expected LogReg, got {other:?}"),
        }
    }

    #[test]
    fn assemble_bic_lowercase_w_form() {
        let code = assemble("bic w19, w20, w21").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::LogReg { sf, invert, .. } => {
                assert!(!sf);
                assert!(invert);
            }
            other => panic!("expected LogReg, got {other:?}"),
        }
    }

    #[test]
    fn orn_and_eon_invert_the_second_source() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("orn x0, x1, x2", 0xAA22_0020u32),
            ("orn w0, w1, w2", 0x2A22_0020),
            ("orn w0, w1, w2, lsl #3", 0x2A22_0C20),
            ("orn x0, xzr, x2", 0xAA22_03E0),
            ("eon x0, x1, x2", 0xCA22_0020),
            ("eon w0, w1, w2", 0x4A22_0020),
            ("eon x0, x1, x2, asr #4", 0xCAA2_1020),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let source = r#"
            MOVZ X1, #0x0F0F
            MOVK X1, #0x0F0F, LSL #16
            MOVK X1, #0x0F0F, LSL #32
            MOVK X1, #0x0F0F, LSL #48
            MOVZ X2, #0x00FF
            MOVK X2, #0x00FF, LSL #16
            MOVK X2, #0x00FF, LSL #32
            MOVK X2, #0x00FF, LSL #48
            ORN X3, X1, X2
            EON X4, X1, X2
            MVN X5, X2
            ORN X6, XZR, X2
            MOVZ X8, #0xF000, LSL #48
            EON X7, X1, X8, ASR #4
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        // The words csarm printed for the same two inputs.
        assert_eq!(cpu.regs.read_gpr(3, true), 0xFF0F_FF0F_FF0F_FF0F);
        // eon is XNOR, which is what catches an opc swap with orn
        assert_eq!(cpu.regs.read_gpr(4, true), 0xF00F_F00F_F00F_F00F);
        // the alias identity: mvn Xd, Xm IS orn Xd, XZR, Xm
        assert_eq!(cpu.regs.read_gpr(5, true), 0xFF00_FF00_FF00_FF00);
        assert_eq!(cpu.regs.read_gpr(6, true), cpu.regs.read_gpr(5, true));
        // asr on a negative source: the sign fills, so the shifted operand
        // is 0xFF00_0000_0000_0000 before the inversion.
        assert_eq!(cpu.regs.read_gpr(7, true), 0x0FF0_F0F0_F0F0_F0F0);
    }

    #[test]
    fn shifted_bic_and_mvn_assemble_like_gas() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("bic x0, x1, x2", 0x8A22_0020u32),
            ("bic x0, x1, x2, lsl #1", 0x8A22_0420),
            ("bic w0, w1, w2, lsr #5", 0x0A62_1420),
            ("mvn x0, x1", 0xAA21_03E0),
            ("mvn x0, x1, lsl #2", 0xAA21_0BE0),
            ("mvn w0, w1, ror #7", 0x2AE1_1FE0),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let source = r#"
            MOVZ X1, #0x0F0F
            MOVK X1, #0x0F0F, LSL #16
            MOVK X1, #0x0F0F, LSL #32
            MOVK X1, #0x0F0F, LSL #48
            MOVZ X2, #0x00FF
            MOVK X2, #0x00FF, LSL #16
            MOVK X2, #0x00FF, LSL #32
            MOVK X2, #0x00FF, LSL #48
            BIC X3, X1, X2, LSL #1
            MVN X4, X2, LSL #2
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        assert_eq!(cpu.regs.read_gpr(3, true), 0x0E01_0E01_0E01_0E01);
        assert_eq!(cpu.regs.read_gpr(4, true), 0xFC03_FC03_FC03_FC03);
    }

    #[test]
    fn assemble_bic_rejects_immediate() {
        rejects(assemble("BIC X0, X1, #0xF0"), "use AND with the inverted mask");
        rejects(assemble("BIC W0, W1, 15"), "use AND with the inverted mask");
    }

    #[test]
    fn assemble_bic_distinct_from_and() {
        // The N bit must actually land in the word, or BIC silently
        // degenerates to AND.
        let bic = assemble("BIC X0, X1, X2").unwrap()[0];
        let and = assemble("AND X0, X1, X2").unwrap()[0];
        assert_ne!(bic, and);
    }

    // -- bitfield extract --

    #[test]
    fn assemble_ubfx_round_trips() {
        // ubfx w19, w20, #4, #4 pulls the second nibble: UBFM immr=4, imms=7.
        let code = assemble("UBFX W19, W20, #4, #4").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
                assert_eq!(op, crate::decoder::BitfieldOp::Ubfm);
                assert!(!sf);
                assert_eq!((rd, rn), (19, 20));
                assert_eq!((immr, imms), (4, 7));
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn assemble_ubfx_x_form_lowercase_no_hash() {
        // Course style: lowercase, immediates without `#`.
        let code = assemble("ubfx x0, x1, 8, 16").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::Bitfield { sf, immr, imms, .. } => {
                assert!(sf);
                assert_eq!((immr, imms), (8, 23));
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn assemble_ubfx_rejects_out_of_range_fields() {
        // Field runs past the register top.
        rejects(assemble("UBFX W0, W1, #28, #8"), "UBFX field runs past the top of the register");
        // Zero width.
        rejects(assemble("UBFX X0, X1, #4, #0"), "UBFX width must be at least 1");
        // lsb outside the register.
        rejects(assemble("UBFX W0, W1, #32, #1"), "UBFX lsb is out of range");
    }

    // -- bitfield insert --

    #[test]
    fn assemble_bfi_round_trips() {
        // bfi w19, w20, #8, #4: BFM with immr = 32-8 = 24, imms = 3.
        let code = assemble("BFI W19, W20, #8, #4").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
                assert_eq!(op, crate::decoder::BitfieldOp::Bfm);
                assert!(!sf);
                assert_eq!((rd, rn), (19, 20));
                assert_eq!((immr, imms), (24, 3));
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn assemble_bfi_lsb_zero_x_form() {
        // lsb 0 wraps immr to 0: bfi x0, x1, 0, 16 -> immr = 0, imms = 15.
        let code = assemble("bfi x0, x1, 0, 16").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::Bitfield { op, sf, immr, imms, .. } => {
                assert_eq!(op, crate::decoder::BitfieldOp::Bfm);
                assert!(sf);
                assert_eq!((immr, imms), (0, 15));
            }
            other => panic!("expected Bitfield, got {other:?}"),
        }
    }

    #[test]
    fn bfxil_keeps_the_destination_bits_ubfx_would_clear() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("bfxil x0, x1, #8, #8", 0xB348_3C20u32),
            ("bfxil w0, w1, #4, #4", 0x3304_1C20),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        // Same immr/imms, same source, same field: the only difference is
        // whether the destination's other 56 bits survive.
        let source = r#"
            MOV X0, #-1
            MOVZ X1, #0xAB00
            BFXIL X0, X1, #8, #8
            MOV X2, #-1
            UBFX X2, X1, #8, #8
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_gpr(0, true), 0xFFFF_FFFF_FFFF_FFAB);
        assert_eq!(cpu.regs.read_gpr(2, true), 0x0000_0000_0000_00AB);
    }

    #[test]
    fn bitfield_insert_zero_aliases_shift_then_mask() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("ubfiz x0, x1, #2, #32", 0xD37E_7C20u32),
            ("sbfiz x0, x1, #2, #30", 0x937E_7420),
            ("ubfiz x0, x1, #4, #2", 0xD37C_0420),
            ("sbfiz x2, x1, #4, #2", 0x937C_0422),
            ("ubfiz w0, w1, #4, #8", 0x531C_1C20),
            ("sbfiz w0, w1, #4, #8", 0x131C_1C20),
            ("ubfiz x0, x1, #4, #60", 0xD37C_EC20),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let source = r#"
            MOVZ X1, #0xFFFF
            MOVK X1, #0xFFFF, LSL #16
            MOVK X1, #0xDEAD, LSL #32
            UBFIZ X2, X1, #2, #32
            SBFIZ X3, X1, #2, #30
            MOV X5, #2
            SBFIZ X6, X5, #4, #2
            UBFIZ X7, X5, #4, #2
            UBFIZ X8, X5, #4, #60
            LSL X9, X5, #4
            MOV W10, #0xFF
            UBFIZ W11, W10, #4, #8
            SBFIZ W12, W10, #4, #8
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        // low 32 bits taken, shifted left 2, everything above zeroed
        assert_eq!(cpu.regs.read_gpr(2, true), 0x0000_0003_FFFF_FFFC);
        assert_eq!(cpu.regs.read_gpr(3, true), 0xFFFF_FFFF_FFFF_FFFC);
        // field 0b10: the top bit is set, so sbfiz fills upward and ubfiz does not
        assert_eq!(cpu.regs.read_gpr(6, true), 0xFFFF_FFFF_FFFF_FFE0);
        assert_eq!(cpu.regs.read_gpr(7, true), 0x0000_0000_0000_0020);
        // #4, #60 collapses onto the LSL alias; it must still be a plain shift
        assert_eq!(cpu.regs.read_gpr(8, true), cpu.regs.read_gpr(9, true));
        // at W width the sign fill stops at bit 31
        assert_eq!(cpu.regs.read_gpr(11, false), 0x0000_0FF0);
        assert_eq!(cpu.regs.read_gpr(12, false), 0xFFFF_FFF0);
    }

    #[test]
    fn assemble_bfi_rejects_out_of_range_fields() {
        rejects(assemble("BFI W0, W1, #30, #4"), "BFI field runs past the top of the register");
        rejects(assemble("BFI X0, X1, #0, #0"), "BFI width must be at least 1");
        rejects(assemble("BFI W0, W1, #32, #1"), "BFI lsb is out of range");
    }
}
