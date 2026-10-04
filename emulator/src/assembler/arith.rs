//! Integer arithmetic encoders: MOV and the wide moves, ADD/SUB with
//! their carry, compare and negate forms, multiply and divide, and the
//! conditional compares and selects.

use super::*;

#[allow(clippy::identity_op)] // zero fields kept to document the full encoding layout
pub(super) fn encode_mov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "MOV requires 2 operands");
    }
    // The vector spellings GAS prints for INS, UMOV, DUP and ORR. Only
    // those name an arrangement or a lane, so one operand carrying either
    // is what marks the line.
    if ops.iter().any(|o| parse_vec_operand(o).is_some()) {
        return encode_simd_mov(ops, ln);
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let op2 = ops[1].trim();

    // MOV Xd, #imm -> MOVZ or MOVN
    if op2.starts_with('#')
        || op2.starts_with('-')
        || op2.starts_with('\'')
        || op2.chars().next().is_some_and(|c| c.is_ascii_digit())
    {
        let imm = parse_immediate(op2, ln)?;
        if (0..=0xFFFF).contains(&imm) {
            return encode_movzk(&[ops[0], op2], 0b10, ln); // MOVZ
        }
        // The bits the register ends up holding: a negative X immediate is
        // its own two's complement (gcc writes the double -4.0 as
        // `mov x2, -4607182418800017408`, MOVZ #0xc010, LSL #48), and a
        // negative W one its low 32 bits.
        let pattern = match imm {
            _ if sf || imm > 0 => Some(imm as u64),
            _ if imm >= i64::from(i32::MIN) => Some(u64::from(imm as u32)),
            _ => None,
        };
        if let Some(u) = pattern {
            // Try to encode as a single MOVZ with a shifted 16-bit field
            // (e.g. 0x10000000 -> MOVZ Xd, #0x1000, LSL #16).
            let limit: u64 = if sf { 4 } else { 2 };
            for hw in 0..limit {
                let shift = hw * 16;
                let mask: u64 = 0xFFFF << shift;
                if u & !mask == 0 {
                    let val = (u >> shift) as i64;
                    let sf_bit = if sf { 1u32 } else { 0 };
                    return Ok((sf_bit << 31) | (0b10 << 29) | (0b100101 << 23)
                        | ((hw as u32) << 21) | ((val as u32 & 0xFFFF) << 5) | (rd as u32));
                }
            }
        }
        // MOVN: encode any value whose width-masked inverse fits a single
        // 16-bit shifted halfword. GAS encodes `mov w0, #0xffffffff` and
        // `mov x0, #-1` this way. Trying MOVN for negative literals only,
        // and only unshifted, rejects the positive hex form and shifted
        // inverses like 0xffff0000.
        {
            let width_mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };
            let inv = !(imm as u64) & width_mask;
            let limit: u64 = if sf { 4 } else { 2 };
            for hw in 0..limit {
                let shift = hw * 16;
                if inv & !(0xFFFF_u64 << shift) == 0 {
                    let val = ((inv >> shift) as u32) & 0xFFFF;
                    let sf_bit = if sf { 1u32 } else { 0 };
                    return Ok((sf_bit << 31) | (0b00 << 29) | (0b100101 << 23)
                        | ((hw as u32) << 21) | (val << 5) | (rd as u32));
                }
            }
        }
        // Last resort, as in GAS: a repeating bitmask pattern lowers to
        // `ORR Rd, ZR, #imm`, so a hand-written mask like
        // `mov x0, 0x5555555555555555` is one instruction. MOVZ/MOVN go
        // first so small constants keep the encoding GAS picks for them.
        if let Ok(word) = encode_log_imm_fields(31, rd, imm as u64, sf, 0b01, ln) {
            return Ok(word);
        }
        return asm_err(ln, "immediate out of range for MOV (needs MOVZ+MOVK)");
    }

    // MOV involving SP is the ADD-immediate alias: MOV Xd, SP -> ADD Xd, SP, #0
    // and MOV SP, Xn -> ADD SP, Xn, #0. parse_register collapses SP and XZR
    // to index 31, so this has to be detected textually.
    let dst_is_sp = ops[0].trim().eq_ignore_ascii_case("SP");
    let src_is_sp = op2.eq_ignore_ascii_case("SP");
    if dst_is_sp || src_is_sp {
        return encode_dp(&[ops[0], op2, "#0"], 0, 0, ln);
    }

    // MOV Xd, Xn -> ORR Xd, XZR, Xn
    let (rm, _) = parse_register(op2, ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    // ORR <Xd>, XZR, <Xm>
    Ok((sf_bit << 31) | (0b01 << 29) | (0b01010 << 24) | ((rm as u32) << 16)
        | (0b11111 << 5) | (rd as u32))
}

pub(super) fn encode_movzk(ops: &[&str], opc: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 2 {
        return asm_err(ln, "MOVZ/MOVK/MOVN requires at least 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let imm = parse_immediate(ops[1], ln)? as u64;

    if imm > 0xFFFF {
        return asm_err(ln, "immediate exceeds 16 bits");
    }

    if ops.len() > 3 {
        return asm_err(ln, "MOVZ/MOVK/MOVN takes at most 3 operands");
    }
    let mut hw: u8 = 0;
    if ops.len() > 2 {
        // parse LSL #16 / LSL #32 / LSL #48
        let shift_str = ops[2].trim().to_uppercase();
        if let Some(rest) = shift_str.strip_prefix("LSL") {
            let amt = parse_immediate(rest.trim(), ln)?;
            hw = match amt {
                0 => 0,
                16 => 1,
                32 => 2,
                48 => 3,
                _ => return asm_err(ln, "MOVZ/MOVK shift must be 0, 16, 32, or 48"),
            };
        } else {
            // Dropping a non-LSL third operand leaves hw = 0, so
            // `movk x0, #0xdead, #16` overwrites the LOW halfword with no
            // message. GAS rejects anything that is not spelled lsl.
            return asm_err(
                ln,
                &format!(
                    "expected `lsl #0|#16|#32|#48` as the third operand of \
                     MOVZ/MOVK/MOVN, got `{}`",
                    ops[2].trim()
                ),
            );
        }
    }

    let sf_bit = if sf { 1u32 } else { 0 };
    Ok((sf_bit << 31) | ((opc as u32) << 29) | (0b100101 << 23)
        | ((hw as u32) << 21) | ((imm as u32) << 5) | (rd as u32))
}

pub(super) fn encode_dp(ops: &[&str], op_bit: u8, s_bit: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 && ops.len() != 4 {
        return asm_err(
            ln,
            "ADD/SUB takes 3 operands, or 4 with a shift modifier (add x0, x1, x2, lsl #3)",
        );
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let op3 = ops[2].trim();
    let sf_bit = if sf { 1u32 } else { 0 };

    // Does operand 3 name an immediate rather than a register? A leading
    // `-` counts: GAS accepts `sub sp, sp, -16` and re-spells it as an add,
    // and refusing it here reports "expected a register here".
    let op3_is_imm = op3.starts_with('#')
        || op3.starts_with('\'')
        || op3.starts_with('-')
        || op3.chars().next().is_some_and(|c| c.is_ascii_digit());

    // `add x0, x1, w2, sxtw #2` is the EXTENDED register form, whose last
    // operand is an extend keyword rather than a shift. It has to be
    // recognized before parse_shift_modifier, which only speaks
    // lsl/lsr/asr/ror and reports "expected a shift modifier" for the
    // widening index every array subscript in the course uses.
    let extend = if ops.len() == 4 && !op3_is_imm {
        parse_extend_modifier(ops[3])
    } else {
        None
    };

    // The optional shifted-register modifier. Only the register form takes
    // lsl/lsr/asr; the immediate form's own `lsl #12` is handled below,
    // because that is how AArch64 reaches immediates above 4095.
    let (shift_bits, shift_amt) = if ops.len() == 4 && !op3_is_imm && extend.is_none() {
        parse_shift_modifier(ops[3], if sf { 64 } else { 32 }, false, ln)?
    } else {
        (0, 0)
    };

    // immediate form
    if op3_is_imm {
        let raw = parse_immediate(op3, ln)?;
        let explicit_lsl12 = ops.len() == 4;
        if explicit_lsl12 {
            parse_lsl12(ops[3], ln)?;
        }
        // A negative immediate is the opposite operation, which is what the
        // course toolchain emits: `sub x0, x1, -16` assembles as an add.
        // ADDS/SUBS stay exact: the hardware computes x - (-n) as x + n,
        // carry included.
        let (op_bit, magnitude) = if raw < 0 {
            (1 - op_bit, raw.unsigned_abs())
        } else {
            (op_bit, raw as u64)
        };
        // Bit 22 shifts the 12-bit field left by 12. GAS reaches for it
        // silently on an exact multiple of 4096, so `sub sp, sp, 4096` (a
        // valid course prologue) encodes instead of being refused.
        let (imm12, shift12) = if explicit_lsl12 {
            if magnitude > 4095 {
                return asm_err(ln, "with lsl #12 the immediate must be 0-4095");
            }
            (magnitude, true)
        } else if magnitude <= 4095 {
            (magnitude, false)
        } else if magnitude % 4096 == 0 && (magnitude >> 12) <= 4095 {
            (magnitude >> 12, true)
        } else {
            return asm_err(
                ln,
                "immediate out of range: 0-4095, or a multiple of 4096 up to 16773120 (which encodes as lsl #12)",
            );
        };
        return Ok((sf_bit << 31) | ((op_bit as u32) << 30) | ((s_bit as u32) << 29)
            | (0b10001 << 24) | ((shift12 as u32) << 22) | ((imm12 as u32) << 10)
            | ((rn as u32) << 5) | (rd as u32));
    }

    // register form
    let (rm, _) = parse_register(op3, ln)?;
    // parse_register folds SP and XZR into 31, but only the EXTENDED form
    // (bit 21 = 1) reads 31 as SP; the shifted form reads XZR, so
    // `add x0, sp, x1` would compute with 0. Route SP to the extended
    // encoding and reject what no encoding covers, as GAS does.
    let rd_is_sp = is_sp_name(ops[0]);
    let rn_is_sp = is_sp_name(ops[1]);
    if is_sp_name(op3) {
        return asm_err(
            ln,
            "sp cannot be the last operand here; copy it out first (mov xN, sp)",
        );
    }
    if rd_is_sp && s_bit == 1 {
        return asm_err(
            ln,
            "the flag-setting form cannot write sp; drop the s (add/sub) or use another destination",
        );
    }
    // Extended-register form with an explicit keyword. This is the same
    // encoding the sp path below emits, just with the extend and shift the
    // student wrote instead of the implied UXTX/UXTW #0.
    if let Some((option, amount_text)) = extend {
        let amount_text = amount_text.trim();
        let amount = if amount_text.is_empty() {
            0
        } else {
            parse_immediate(amount_text, ln)?
        };
        if !(0..=4).contains(&amount) {
            return asm_err(
                ln,
                &format!("an extended-register shift is 0 to 4, got {amount}"),
            );
        }
        return Ok((sf_bit << 31) | ((op_bit as u32) << 30) | ((s_bit as u32) << 29)
            | (0b01011 << 24) | (1 << 21) | ((rm as u32) << 16)
            | (option << 13) | ((amount as u32) << 10) | ((rn as u32) << 5) | (rd as u32));
    }
    if rd_is_sp || rn_is_sp {
        if ops.len() == 4 {
            // The extended-register (SP-capable) encoding carries its own
            // narrow extend+shift fields; combining SP with a plain shift
            // modifier has no encoding here.
            return asm_err(
                ln,
                "a shift modifier cannot be combined with sp; compute the shift into a scratch register first",
            );
        }
        // Extended-register form, LSL #0: option = UXTX for X, UXTW for W,
        // the alias GAS emits for `add x0, sp, x1`.
        let option: u32 = if sf { 0b011 } else { 0b010 };
        return Ok((sf_bit << 31) | ((op_bit as u32) << 30) | ((s_bit as u32) << 29)
            | (0b01011 << 24) | (1 << 21) | ((rm as u32) << 16)
            | (option << 13) | ((rn as u32) << 5) | (rd as u32));
    }
    Ok((sf_bit << 31) | ((op_bit as u32) << 30) | ((s_bit as u32) << 29)
        | (0b01011 << 24) | (shift_bits << 22) | ((rm as u32) << 16)
        | ((shift_amt as u32) << 10) | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `ADC/ADCS/SBC/SBCS Rd, Rn, Rm`: sf_op_S_11010000_Rm_000000_Rn_Rd.
/// The family carries the NZCV carry bit into the adder, which is how
/// multi-precision arithmetic chains one word to the next. It is
/// register-only (A64 has no add-with-carry immediate), so an immediate
/// third operand is named rather than reported as "expected a register".
pub(super) fn encode_carry(ops: &[&str], sub: bool, set_flags: bool, ln: usize) -> Result<u32, EmuError> {
    let name = match (sub, set_flags) {
        (false, false) => "ADC",
        (false, true) => "ADCS",
        (true, false) => "SBC",
        (true, true) => "SBCS",
    };
    if ops.len() != 3 {
        return asm_err(ln, &format!("{name} requires 3 operands: Rd, Rn, Rm"));
    }
    // The immediate spellings encode_dp accepts, refused here by name: this
    // family has no immediate encoding at all, and `expected a register
    // here` would leave a student hunting for a typo that is not there.
    let op3 = ops[2].trim();
    if op3.starts_with('#')
        || op3.starts_with('\'')
        || op3.starts_with('-')
        || op3.chars().next().is_some_and(|c| c.is_ascii_digit())
    {
        return asm_err(
            ln,
            &format!("{name} takes three registers; there is no immediate form"),
        );
    }
    reject_sp_operands(ops, ln, name)?;

    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, rn_sf) = parse_register(ops[1], ln)?;
    let (rm, rm_sf) = parse_register(op3, ln)?;
    // One sf bit covers all three operands, so a mixed-width line has no
    // encoding: it would silently assemble as whatever the destination said.
    if rn_sf != sf || rm_sf != sf {
        let width = if sf { "X" } else { "W" };
        return asm_err(
            ln,
            &format!("{name} needs all three registers the same width (all {width} registers here)"),
        );
    }
    let sf_bit = if sf { 1u32 } else { 0 };

    Ok((sf_bit << 31) | ((sub as u32) << 30) | ((set_flags as u32) << 29)
        | (0b11010000 << 21) | ((rm as u32) << 16) | ((rn as u32) << 5) | (rd as u32))
}

/// Refuse `sp` anywhere in an instruction whose encoding has no room for
/// it. `parse_register` collapses SP and XZR to index 31, so a stray `sp`
/// in a logical, shift, multiply or divide silently computes with ZERO,
/// a wrong answer with no diagnostic. The add/sub path already routes SP
/// to the extended encoding; these forms have no such encoding, and GAS
/// rejects them outright ("expected an integer or zero register").
pub(super) fn reject_sp_operands(ops: &[&str], ln: usize, mnemonic: &str) -> Result<(), EmuError> {
    for (i, op) in ops.iter().enumerate() {
        if is_sp_name(op) {
            return asm_err(
                ln,
                &format!(
                    "{mnemonic} cannot take sp (operand {}); copy it out first with `mov xN, sp`",
                    i + 1
                ),
            );
        }
    }
    Ok(())
}

/// Parse the `lsl #12` an add/sub immediate may carry. It is the only
/// modifier that form accepts, and only at exactly 12.
fn parse_lsl12(operand: &str, ln: usize) -> Result<(), EmuError> {
    let t = operand.trim();
    if t.len() < 3 || !t[..3].eq_ignore_ascii_case("lsl") {
        return asm_err(ln, "an add/sub immediate takes only `lsl #12`");
    }
    let amt = parse_immediate(t[3..].trim().trim_start_matches('#').trim(), ln)?;
    if amt != 12 {
        return asm_err(ln, "an add/sub immediate shift must be exactly `lsl #12`");
    }
    Ok(())
}

/// Whether an operand as written names the stack pointer. Needed wherever
/// index 31's meaning depends on the chosen encoding, since parse_register
/// cannot carry the distinction.
fn is_sp_name(operand: &str) -> bool {
    let t = operand.trim();
    t.eq_ignore_ascii_case("sp") || t.eq_ignore_ascii_case("wsp")
}

pub(super) fn encode_cmp(ops: &[&str], op_bit: u8, ln: usize) -> Result<u32, EmuError> {
    // CMP Xn, op2 -> SUBS XZR, Xn, op2
    // CMN Xn, op2 -> ADDS XZR, Xn, op2
    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(
            ln,
            "CMP/CMN takes 2 operands, or 3 with a shift modifier (cmp x1, x2, lsl #2)",
        );
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    if ops.len() == 3 {
        let new_ops = [zr, ops[0], ops[1], ops[2]];
        return encode_dp(&new_ops, op_bit, 1, ln);
    }
    // A negative comparison immediate has no direct encoding; GAS flips
    // the alias instead (`cmp w1, -1` assembles as `cmn w1, 1`), and
    // sentinel tests like top == -1 rely on that. Flip the same way, going
    // through parse_immediate so `#-0x10` and `#-0b10000` flip exactly
    // like `#-16` (a bare parse::<i64> reads decimal only).
    let imm_body = ops[1].trim();
    if imm_body.starts_with('#')
        || imm_body.starts_with('\'')
        || imm_body.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '-')
    {
        if let Ok(v) = parse_immediate(imm_body, ln) {
            if v < 0 {
                if let Some(positive) = v.checked_neg() {
                    let flipped = positive.to_string();
                    let new_ops = [zr, ops[0], flipped.as_str()];
                    return encode_dp(&new_ops, 1 - op_bit, 1, ln);
                }
            }
        }
    }
    let new_ops = [zr, ops[0], ops[1]];
    encode_dp(&new_ops, op_bit, 1, ln)
}

pub(super) fn encode_mul_div(ops: &[&str], variant: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "MUL/UDIV/SDIV requires 3 operands");
    }
    reject_sp_operands(ops, ln, "MUL/UDIV/SDIV")?;
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    match variant {
        0 => {
            // MUL -> MADD Xd, Xn, Xm, XZR
            Ok((sf_bit << 31) | (0b0011011000 << 21) | ((rm as u32) << 16)
                | (0b11111 << 10) | ((rn as u32) << 5) | (rd as u32))
        }
        1 => {
            // UDIV
            Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
                | (0b000010 << 10) | ((rn as u32) << 5) | (rd as u32))
        }
        2 => {
            // SDIV
            Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
                | (0b000011 << 10) | ((rn as u32) << 5) | (rd as u32))
        }
        _ => asm_err(ln, INTERNAL_ASSEMBLER_BUG),
    }
}

pub(super) fn encode_mul_accumulate(ops: &[&str], subtract: bool, ln: usize) -> Result<u32, EmuError> {
    // MADD Xd, Xn, Xm, Xa  (Rd = Ra + Rn*Rm)
    // MSUB Xd, Xn, Xm, Xa  (Rd = Ra - Rn*Rm)
    if ops.len() != 4 {
        return asm_err(ln, "MADD/MSUB requires 4 operands");
    }
    reject_sp_operands(ops, ln, "MADD/MSUB")?;
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let (ra, _) = parse_register(ops[3], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    let o0 = if subtract { 1u32 } else { 0 };
    Ok((sf_bit << 31)
        | (0b0011011000 << 21)
        | ((rm as u32) << 16)
        | (o0 << 15)
        | ((ra as u32) << 10)
        | ((rn as u32) << 5)
        | (rd as u32))
}

/// CCMP / CCMN Rn, Rm|#imm5, #nzcv, cond. The second operand's shape
/// picks the register or the immediate form, the same way
/// `encode_log_dispatch` reads it. GAS lets these carry AL and NV.
pub(super) fn encode_cond_compare(
    ops: &[&str], op_bit: u32, name: &str, ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(
            ln,
            &format!("{name} requires 4 operands: Rn, Rm or #imm5, #nzcv, cond"),
        );
    }
    let (rn, sf) = parse_register(ops[0], ln)?;
    let nzcv = parse_immediate(ops[2], ln)?;
    if !(0..=15).contains(&nzcv) {
        return asm_err(
            ln,
            &format!("{name} nzcv must be 0 to 15 (the four flag bits, N Z C V)"),
        );
    }
    let cond = parse_condition_allowing_nv(ops[3], ln)?;
    let op2 = ops[1].trim();
    let (field, imm_flag) = if op2.starts_with('#')
        || op2.starts_with('\'')
        || op2.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '-')
    {
        let imm = parse_immediate(op2, ln)?;
        if !(0..=31).contains(&imm) {
            return asm_err(
                ln,
                &format!("{name} takes an unsigned 5-bit immediate (0 to 31)"),
            );
        }
        (imm as u32, 1u32)
    } else {
        (u32::from(parse_register(op2, ln)?.0), 0)
    };
    let sf_bit = if sf { 1u32 } else { 0 };
    // sf_op_S=1_11010010_imm5|Rm_cond(4)_imm_o2=0_Rn_o3=0_nzcv(4)
    Ok((sf_bit << 31)
        | (op_bit << 30)
        | (1 << 29)
        | (0b11010010 << 21)
        | (field << 16)
        | ((cond as u32) << 12)
        | (imm_flag << 11)
        | ((rn as u32) << 5)
        | (nzcv as u32))
}

pub(super) fn encode_mul_wide(
    ops: &[&str], op31: u32, widening: bool, o0: u32, accumulates: bool, ln: usize,
) -> Result<u32, EmuError> {
    // SMULL/UMULL Xd, Wn, Wm  (the SMADDL/UMADDL alias with Ra=XZR)
    // SMULH/UMULH Xd, Xn, Xm  (the top 64 bits of the 128-bit product)
    // SMADDL/SMSUBL/UMADDL/UMSUBL Xd, Wn, Wm, Xa (the accumulate forms)
    let names = if accumulates {
        "SMADDL/SMSUBL/UMADDL/UMSUBL"
    } else {
        "SMULL/UMULL/SMULH/UMULH"
    };
    if ops.len() != if accumulates { 4 } else { 3 } {
        return asm_err(
            ln,
            &if accumulates {
                format!("{names} require 4 operands: Xd, Wn, Wm, Xa")
            } else {
                format!("{names} require 3 operands")
            },
        );
    }
    reject_sp_operands(ops, ln, names)?;
    let (rd, rd_x) = parse_register(ops[0], ln)?;
    let (rn, rn_x) = parse_register(ops[1], ln)?;
    let (rm, rm_x) = parse_register(ops[2], ln)?;
    if !rd_x {
        return asm_err(ln, "the destination must be an X register (the product is 64-bit)");
    }
    if widening && (rn_x || rm_x) {
        return asm_err(ln, "SMULL/UMULL take W source registers (32 x 32 -> 64)");
    }
    if !widening && (!rn_x || !rm_x) {
        return asm_err(ln, "SMULH/UMULH take X source registers");
    }
    let ra = if accumulates {
        let (ra, ra_x) = parse_register(ops[3], ln)?;
        if !ra_x {
            return asm_err(ln, "the accumulator must be an X register (the product is 64-bit)");
        }
        ra
    } else {
        31
    };
    Ok((1 << 31)
        | (0b11011 << 24)
        | (op31 << 21)
        | ((rm as u32) << 16)
        | (o0 << 15)
        | ((ra as u32) << 10)
        | ((rn as u32) << 5)
        | (rd as u32))
}

/// SMNEGL / UMNEGL Xd, Wn, Wm: the `Ra = XZR` subtract forms, the same
/// shape `encode_mneg` uses against MSUB.
pub(super) fn encode_mneg_wide(ops: &[&str], op31: u32, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "SMNEGL/UMNEGL require 3 operands: Xd, Wn, Wm");
    }
    encode_mul_wide(&[ops[0], ops[1], ops[2], "XZR"], op31, true, 1, true, ln)
}

/// Encode `MNEG Rd, Rn, Rm` as `MSUB Rd, Rn, Rm, ZR`. The zero register
/// matches the destination's width the same way `encode_neg` picks it,
/// so a W destination gets WZR and an X one XZR.
pub(super) fn encode_mneg(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "MNEG requires 3 operands");
    }
    reject_sp_operands(ops, ln, "MNEG")?;
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    encode_mul_accumulate(&[ops[0], ops[1], ops[2], zr], true, ln)
}

pub(super) fn encode_neg(ops: &[&str], set_flags: bool, ln: usize) -> Result<u32, EmuError> {
    // NEG Xd, Xm{, shift #n} -> SUB Xd, XZR, Xm{, shift #n}; NEGS is the
    // SUBS form and sets NZCV. gcc writes the shifted one for `-(x << 1)`.
    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(ln, "NEG/NEGS takes 2 operands, or 3 with a shift (neg w0, w1, lsl 2)");
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    let mut new_ops = vec![ops[0], zr];
    new_ops.extend_from_slice(&ops[1..]);
    encode_dp(&new_ops, 1, if set_flags { 1 } else { 0 }, ln)
}

pub(super) fn encode_cond_sel(ops: &[&str], op_bit: u8, op2: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, "CSEL/CSINC/CSINV/CSNEG requires 4 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let cond = parse_condition(ops[3], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    Ok((sf_bit << 31) | (0b0011010100 << 21) | ((op_bit as u32) << 30) | ((rm as u32) << 16)
        | ((cond as u32) << 12) | ((op2 as u32) << 10)
        | ((rn as u32) << 5) | (rd as u32))
}

/// The encoded condition for a `cset`-family alias: the INVERSE of the
/// spelled one. GAS rejects `AL` and `NV` here because neither has an
/// invertible spelling, so an always-true alias would assemble to
/// something the course toolchain refuses. `hint` is the alias-specific
/// tail of the message; CSET points at `mov Xd, 1`, the others have no
/// one-line replacement.
fn invert_condition_bits(
    spelled: &str, name: &str, hint: &str, ln: usize,
) -> Result<u8, EmuError> {
    let upper = spelled.trim().to_uppercase();
    if upper == "AL" || upper == "NV" {
        return asm_err(
            ln,
            &format!("{name} cannot use the AL or NV condition (there is nothing to invert{hint})"),
        );
    }
    Ok(Condition::from_u8(parse_condition(spelled, ln)?)?.invert() as u8)
}

/// The `cset` family: conditional-select aliases whose sources are fixed
/// and whose condition field holds the INVERSE of the spelled one.
/// `duplicate_rn` is the three-operand shape (CINC/CINV/CNEG), which
/// reads the same register in both source slots; the two-operand shape
/// (CSET/CSETM) reads ZR in both. Field layout is the one
/// `encode_cond_sel` uses.
pub(super) fn encode_cond_sel_alias(
    ops: &[&str], name: &str, op_bit: u8, op2: u8, duplicate_rn: bool, ln: usize,
) -> Result<u32, EmuError> {
    let want = if duplicate_rn { 3 } else { 2 };
    if ops.len() != want {
        return asm_err(ln, &format!("{name} requires {want} operands"));
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, cond_text) = if duplicate_rn {
        (parse_register(ops[1], ln)?.0, ops[2])
    } else {
        (31u8, ops[1])
    };
    let hint = if name == "CSET" { "; use `mov Xd, 1`" } else { "" };
    let inv_cond = invert_condition_bits(cond_text, name, hint, ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    Ok((sf_bit << 31) | ((op_bit as u32) << 30) | (0b0011010100 << 21)
        | ((rn as u32) << 16) | ((inv_cond as u32) << 12) | ((op2 as u32) << 10)
        | ((rn as u32) << 5) | (rd as u32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::rejects;
    use crate::cpu::Cpu;

    #[test]
    fn negative_cmp_immediate_flips_to_cmn() {
        // The sentinel-test shape: an index initialized to -1 compared
        // against -1. GAS assembles `cmp w, -1` as `cmn w, 1`.
        let source = r#"
            MOV W1, #-1
            CMP W1, #-1
            B.EQ matched
            MOV X0, #0
            SVC #0
        matched:
            MOV X0, #1
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_gpr(0, true), 1, "cmp w1, -1 matches w1 = -1");
        // And the flip works the other way: cmn with a negative
        // immediate compares against the positive value.
        let source = r#"
            MOV W1, #5
            CMN W1, #-5
            B.EQ matched
            MOV X0, #0
            SVC #0
        matched:
            MOV X0, #1
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_gpr(0, true), 1, "cmn w1, -5 acts as cmp w1, 5");
    }

    #[test]
    fn assemble_cmp_cset() {
        let source = r#"
            MOV X0, #10
            MOV X1, #10
            CMP X0, X1
            CSET X2, EQ
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(2, true), 1);
    }

    #[test]
    fn csinv_and_csneg_select_or_transform_like_the_hardware() {
        use crate::cpu::Cpu;
        let source = r#"
            MOV X1, #7
            MOV X2, #5
            CMP X1, X1
            CSINV X3, X1, X2, EQ
            CSINV X4, X1, X2, NE
            CSNEG X5, X1, X2, NE
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();
        assert_eq!(cpu.regs.read_gpr(3, true), 7, "taken picks rn");
        assert_eq!(cpu.regs.read_gpr(4, true), !5u64, "not taken inverts rm");
        assert_eq!(cpu.regs.read_gpr(5, true) as i64, -5, "not taken negates rm");
    }

    #[test]
    fn cset_rejects_al_like_gas() {
        let labels = HashMap::new();
        for src in ["cset x0, al", "cset x0, nv"] {
            let msg = encode_line(src, 0, &labels, 3).unwrap_err().to_string();
            assert!(msg.contains("AL or NV"), "{src}: {msg}");
        }
        // The raw CSINC form keeps taking AL, exactly as GAS does.
        encode_line("csinc x0, xzr, xzr, al", 0, &labels, 3).unwrap();
    }

    #[test]
    fn cset_family_aliases_encode_the_inverted_condition() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("cinc x0, x1, eq", 0x9A81_1420u32),
            ("cinc w0, w1, eq", 0x1A81_1420),
            ("cinc x0, x1, ge", 0x9A81_B420),
            ("cinv x0, x1, eq", 0xDA81_1020),
            ("cinv w0, w1, eq", 0x5A81_1020),
            ("cneg x0, x1, eq", 0xDA81_1420),
            ("cneg w0, w1, eq", 0x5A81_1420),
            ("cneg x0, x1, lt", 0xDA81_A420),
            ("csetm x0, eq", 0xDA9F_13E0),
            ("csetm w0, eq", 0x5A9F_13E0),
            ("cset w0, eq", 0x1A9F_17E0),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        for src in ["cinc x0, x1, al", "csetm w0, al", "cneg x0, x1, nv", "cinv x0, x1, nv"] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains("AL or NV"), "{src}: {err}");
        }
        let source = r#"
            MOV W1, #5
            MOV X6, #7
            CMP W1, #5
            CINC W2, W1, EQ
            CINV W4, W1, EQ
            CNEG X7, X6, EQ
            CSETM W9, EQ
            CMP W1, #4
            CINC W3, W1, EQ
            CINV W5, W1, EQ
            CNEG X8, X6, EQ
            CSETM W10, EQ
            CSETM X11, EQ
            MOV X14, #-1
            CMP X14, #0
            CNEG X15, X6, LT
            CINC X16, X6, GE
            MOV X17, #1
            CMP X17, #0
            CINC X18, X6, GE
            MOV W12, #-1
            CMP W1, #5
            CINC W13, W12, EQ
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        // The false rows are the whole test: forgetting the inversion
        // swaps every pair below and each half looks plausible alone.
        assert_eq!(cpu.regs.read_gpr(2, false), 6);
        assert_eq!(cpu.regs.read_gpr(3, false), 5);
        assert_eq!(cpu.regs.read_gpr(4, false), 0xFFFF_FFFA);
        assert_eq!(cpu.regs.read_gpr(5, false), 5);
        assert_eq!(cpu.regs.read_gpr(7, true) as i64, -7);
        assert_eq!(cpu.regs.read_gpr(8, true), 7);
        assert_eq!(cpu.regs.read_gpr(9, false), 0xFFFF_FFFF);
        assert_eq!(cpu.regs.read_gpr(10, false), 0);
        assert_eq!(cpu.regs.read_gpr(11, true), 0);
        // a non-EQ condition, so the inversion is not a low-bit flip of zero
        assert_eq!(cpu.regs.read_gpr(15, true) as i64, -7);
        assert_eq!(cpu.regs.read_gpr(16, true), 7);
        assert_eq!(cpu.regs.read_gpr(18, true), 8);
        // the W width masks: cinc of 0xFFFFFFFF wraps to 0, not to 2^32
        assert_eq!(cpu.regs.read_gpr(13, false), 0);
    }

    #[test]
    fn negs_sets_the_flags_where_neg_does_not() {
        use crate::cpu::Cpu;
        let source = r#"
            MOV X1, #1
            NEGS X0, X1
            CSET X2, MI
            NEG X3, X1
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();
        assert_eq!(cpu.regs.read_gpr(0, true) as i64, -1);
        assert_eq!(cpu.regs.read_gpr(2, true), 1, "negs set N");
        assert_eq!(cpu.regs.read_gpr(3, true) as i64, -1);
        // The two spellings differ only in the S bit (SUB vs SUBS).
        let labels = HashMap::new();
        let neg = encode_line("neg x0, x1", 0, &labels, 1).unwrap();
        let negs = encode_line("negs x0, x1", 0, &labels, 1).unwrap();
        assert_eq!(neg | (1 << 29), negs);
    }

    #[test]
    fn mneg_is_msub_against_the_zero_register() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("mneg x0, x1, x2", 0x9B02_FC20u32),
            ("mneg w0, w1, w2", 0x1B02_FC20),
            ("msub x0, x1, x2, xzr", 0x9B02_FC20),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let source = r#"
            MOV X1, #7
            MOV X2, #6
            MNEG X3, X1, X2
            MOVN W4, #2
            MOV W5, #5
            MNEG W6, W4, W5
            MOV X7, #1
            MOVK X7, #0x8000, LSL #48
            MNEG X8, X7, X7
            MSUB X9, X7, X7, XZR
            MOVZ W10, #0x4000, LSL #16
            MOV W11, #4
            MNEG W12, W10, W11
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        assert_eq!(cpu.regs.read_gpr(3, true) as i64, -42);
        // two negatives: the W path must mask to 32 bits, not sign-leak
        assert_eq!(cpu.regs.read_gpr(6, false), 15);
        // wraps, never saturates, and is byte-identical to the MSUB it aliases
        assert_eq!(cpu.regs.read_gpr(8, true), 0xFFFF_FFFF_FFFF_FFFF);
        assert_eq!(cpu.regs.read_gpr(9, true), cpu.regs.read_gpr(8, true));
        // 0x4000_0000 * 4 is 2^32, so the W result is zero, not a saturation
        assert_eq!(cpu.regs.read_gpr(12, false), 0);
    }

    #[test]
    fn widening_multiplies_encode_as_the_arm_manual_words_and_round_trip() {
        use crate::decoder::{decode, Instruction, MulWideOp};
        let labels = HashMap::new();
        let cases = [
            ("smull x0, w1, w2", 0x9B22_7C20, MulWideOp::Smull),
            ("umull x0, w1, w2", 0x9BA2_7C20, MulWideOp::Umull),
            ("smulh x0, x1, x2", 0x9B42_7C20, MulWideOp::Smulh),
            ("umulh x0, x1, x2", 0x9BC2_7C20, MulWideOp::Umulh),
        ];
        for (src, want, op) in cases {
            let word = encode_line(src, 0, &labels, 1).unwrap();
            assert_eq!(word, want, "{src}");
            match decode(word).unwrap() {
                Instruction::MulWide { op: got, rd: 0, rn: 1, rm: 2, ra: 31 } => {
                    assert_eq!(got, op, "{src}");
                }
                other => panic!("{src} decoded to {other:?}"),
            }
        }
    }

    #[test]
    fn widening_multiplies_reject_wrong_register_widths() {
        let labels = HashMap::new();
        for src in ["smull w0, w1, w2", "smull x0, x1, x2", "umulh x0, w1, w2"] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains("register"), "{src}: {err}");
        }
    }

    #[test]
    fn widening_multiplies_compute_signed_and_high_halves() {
        use crate::cpu::Cpu;
        // smull: (-3) * 5 = -15 across the width boundary; umulh: the high
        // 64 bits of (2^63 + 1) squared.
        let source = r#"
            MOVN W1, #2
            MOV W2, #5
            SMULL X3, W1, W2
            MOV X4, #1
            MOVK X4, #0x8000, LSL #48
            UMULH X5, X4, X4
            SMULH X6, X4, X4
            UMULL X7, W1, W2
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_gpr(3, true) as i64, -15);
        // x4 = 0x8000_0000_0000_0001; x4*x4 = 2^126 + 2^64 + 1, so the
        // unsigned high half is 2^62 + 1.
        assert_eq!(cpu.regs.read_gpr(5, true), (1u64 << 62) + 1);
        // Signed, x4 is -(2^63 - 1); the signed high half of its square
        // (2^126 - 2^64 + 1) is 2^62 - 1.
        assert_eq!(cpu.regs.read_gpr(6, true), (1u64 << 62) - 1);
        // umull treats w1 (0xFFFF_FFFD) as unsigned.
        assert_eq!(cpu.regs.read_gpr(7, true), 0xFFFF_FFFDu64 * 5);
    }

    #[test]
    fn conditional_compare_writes_flags_or_the_literal() {
        use crate::cpu::Cpu;
        use crate::decoder::{decode, CondCmpOperand, Instruction};
        let labels = HashMap::new();
        for (src, want) in [
            ("ccmp x0, x1, #0, eq", 0xFA41_0000u32),
            ("ccmp w0, #31, #4, ne", 0x7A5F_1804),
            ("ccmn x0, x1, #15, lt", 0xBA41_B00F),
            ("ccmn w0, #1, #4, ne", 0x3A41_1804),
            ("ccmp w0, w1, #0, eq", 0x7A41_0000),
            ("ccmp x0, #31, #0, eq", 0xFA5F_0800),
            ("ccmn x0, #0, #0, eq", 0xBA40_0800),
            ("ccmp w0, #0, #15, eq", 0x7A40_080F),
            // GAS takes AL and NV here, and gives them different words.
            ("ccmp x0, x1, #15, al", 0xFA41_E00F),
            ("ccmn x0, x1, #15, al", 0xBA41_E00F),
            ("ccmp w0, #31, #4, al", 0x7A5F_E804),
            ("ccmp x0, x1, #0, nv", 0xFA41_F000),
            ("ccmn x0, x1, #0, nv", 0xBA41_F000),
            ("ccmp w0, #31, #4, nv", 0x7A5F_F804),
            ("ccmn w0, #1, #4, nv", 0x3A41_F804),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        match decode(0xFA41_0000).unwrap() {
            Instruction::CondCompare {
                sub: true, sf: true, rn: 0, operand, cond, nzcv: 0,
            } => {
                assert_eq!(operand, CondCmpOperand::Reg(1));
                assert_eq!(cond, Condition::EQ);
            }
            other => panic!("expected a register CondCompare, got {other:?}"),
        }
        match decode(0x7A5F_1804).unwrap() {
            Instruction::CondCompare { sub: true, sf: false, rn: 0, operand, nzcv: 4, .. } => {
                assert_eq!(operand, CondCmpOperand::Imm(31));
            }
            other => panic!("expected an immediate CondCompare, got {other:?}"),
        }
        for (src, needle) in [
            ("ccmp x0, x1, #16, eq", "nzcv must be 0 to 15"),
            ("ccmp x0, #32, #0, eq", "unsigned 5-bit immediate"),
        ] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains(needle), "{src}: {err}");
        }
        // The short-circuit idiom gcc builds `a == 1 && b == 2` out of,
        // in all three outcomes.
        let source = r#"
            MOV W0, #1
            MOV W1, #2
            CMP W0, #1
            CCMP W1, #2, #0, EQ
            CSET W2, EQ
            MOV W3, #9
            CMP W3, #1
            CCMP W1, #2, #0, EQ
            CSET W4, EQ
            CMP W3, #1
            CCMP W1, #29, #4, EQ
            CSET W5, EQ
            MOV W6, #7
            MOV W7, #7
            CMP W6, W7
            CCMP W6, W7, #0, EQ
            CSET W8, EQ
            MOV W9, #-3
            CMP W6, W7
            CCMN W9, #3, #0, EQ
            CSET W10, EQ
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        assert_eq!(cpu.regs.read_gpr(2, false), 1, "the taken path compares");
        assert_eq!(cpu.regs.read_gpr(4, false), 0, "literal 0 leaves Z clear");
        // The trap: an implementation that leaves NZCV alone on the false
        // path answers 0 here and still passes the two rows above.
        assert_eq!(cpu.regs.read_gpr(5, false), 1, "literal 4 forces Z although 2 != 29");
        assert_eq!(cpu.regs.read_gpr(8, false), 1, "the register form");
        assert_eq!(cpu.regs.read_gpr(10, false), 1, "ccmn adds instead");
        // -3 + 3 is zero with a carry out, so the last flags are N=0 Z=1
        // C=1 V=0.
        assert_eq!(cpu.regs.nzcv.pack(), 0b0110);
    }

    #[test]
    fn widening_multiply_accumulate_uses_the_full_64_bit_accumulator() {
        use crate::cpu::Cpu;
        use crate::decoder::{decode, Instruction, MulWideOp};
        let labels = HashMap::new();
        for (src, want, op, ra) in [
            ("smaddl x0, w1, w2, x3", 0x9B22_0C20u32, MulWideOp::Smaddl, 3u8),
            ("smsubl x0, w1, w2, x3", 0x9B22_8C20, MulWideOp::Smsubl, 3),
            ("umaddl x0, w1, w2, x3", 0x9BA2_0C20, MulWideOp::Umaddl, 3),
            ("umsubl x0, w1, w2, x3", 0x9BA2_8C20, MulWideOp::Umsubl, 3),
            ("smnegl x0, w1, w2", 0x9B22_FC20, MulWideOp::Smsubl, 31),
            ("umnegl x0, w1, w2", 0x9BA2_FC20, MulWideOp::Umsubl, 31),
        ] {
            let word = encode_line(src, 0, &labels, 1).unwrap();
            assert_eq!(word, want, "{src}");
            match decode(word).unwrap() {
                Instruction::MulWide { op: got, rd: 0, rn: 1, rm: 2, ra: got_ra } => {
                    assert_eq!((got, got_ra), (op, ra), "{src}");
                }
                other => panic!("{src} decoded to {other:?}"),
            }
        }
        for src in ["smaddl x0, x1, x2, x3", "smaddl w0, w1, w2, w3", "smaddl x0, w1, w2, w3"] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains("register"), "{src}: {err}");
        }
        let source = r#"
            MOV W1, #-3
            MOV W2, #5
            MOV X3, #100
            SMADDL X4, W1, W2, X3
            SMSUBL X5, W1, W2, X3
            UMADDL X6, W1, W2, X3
            UMSUBL X7, W1, W2, X3
            SMNEGL X8, W1, W2
            UMNEGL X9, W1, W2
            SMULL X10, W1, W2
            SMADDL X11, W1, W2, XZR
            SMSUBL X12, W1, W2, XZR
            MOVZ X13, #1
            MOVK X13, #1, LSL #32
            MOV W14, #2
            MOV W15, #3
            SMADDL X16, W14, W15, X13
            UMADDL X17, W14, W15, X13
            SMSUBL X18, W14, W15, X13
            MOVZ W19, #0xFFFF
            MOVK W19, #0x7FFF, LSL #16
            SMADDL X20, W19, W19, XZR
            MOVZ W21, #0x8000, LSL #16
            SMADDL X22, W21, W21, XZR
            MOV W23, #-1
            UMADDL X24, W23, W23, XZR
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        let x = |r: u8| cpu.regs.read_gpr(r, true);
        assert_eq!(x(4) as i64, 85);
        assert_eq!(x(5) as i64, 115);
        // The signed and unsigned pairs diverge on -3, so neither can be
        // the other's path in disguise.
        assert_eq!(x(6), 0x0000_0005_0000_0055);
        assert_eq!(x(7), 0xFFFF_FFFB_0000_0073);
        assert_eq!(x(8) as i64, 15);
        assert_eq!(x(9), 0xFFFF_FFFB_0000_000F);
        // The aliases against their canonical zero-accumulator forms.
        assert_eq!(x(10) as i64, -15);
        assert_eq!(x(11) as i64, -15);
        assert_eq!(x(12) as i64, 15);
        // The accumulator is 64-bit even though the sources are 32: a
        // truncating one answers 7 here instead of 0x1_0000_0007.
        assert_eq!(x(16), 0x0000_0001_0000_0007);
        assert_eq!(x(17), 0x0000_0001_0000_0007);
        assert_eq!(x(18), 0x0000_0000_FFFF_FFFB);
        assert_eq!(x(20), 0x3FFF_FFFF_0000_0001);
        assert_eq!(x(22), 0x4000_0000_0000_0000);
        assert_eq!(x(24), 0xFFFF_FFFE_0000_0001);
    }

    #[test]
    fn carry_ops_encode_as_the_arm_manual_words_and_round_trip() {
        use crate::decoder::{decode, Instruction};
        let labels = HashMap::new();
        let cases = [
            (
                "adc x0, x1, x2",
                0x9A02_0020u32,
                Instruction::DpCarry {
                    sub: false, set_flags: false, sf: true, rd: 0, rn: 1, rm: 2,
                },
            ),
            (
                "adcs w3, w4, w5",
                0x3A05_0083,
                Instruction::DpCarry {
                    sub: false, set_flags: true, sf: false, rd: 3, rn: 4, rm: 5,
                },
            ),
            (
                "sbc x9, x10, x11",
                0xDA0B_0149,
                Instruction::DpCarry {
                    sub: true, set_flags: false, sf: true, rd: 9, rn: 10, rm: 11,
                },
            ),
            (
                "sbcs w0, w1, w2",
                0x7A02_0020,
                Instruction::DpCarry {
                    sub: true, set_flags: true, sf: false, rd: 0, rn: 1, rm: 2,
                },
            ),
            (
                "adc x0, x1, xzr",
                0x9A1F_0020,
                Instruction::DpCarry {
                    sub: false, set_flags: false, sf: true, rd: 0, rn: 1, rm: 31,
                },
            ),
        ];
        for (src, want, decoded) in cases {
            let word = encode_line(src, 0, &labels, 1).unwrap();
            assert_eq!(word, want, "{src}");
            assert_eq!(decode(word).unwrap(), decoded, "{src}");
        }
    }

    #[test]
    fn carry_ops_reject_an_immediate_third_operand() {
        let labels = HashMap::new();
        for (src, name) in [
            ("adc x0, x1, #1", "ADC"),
            ("adcs w0, w1, #1", "ADCS"),
            ("sbc x0, x1, 5", "SBC"),
            ("sbcs x0, x1, -1", "SBCS"),
        ] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(
                err.contains(&format!("{name} takes three registers")),
                "{src}: {err}",
            );
            assert!(err.contains("no immediate form"), "{src}: {err}");
        }
    }

    #[test]
    fn carry_ops_reject_mixed_register_widths() {
        let labels = HashMap::new();
        for src in ["adc x0, w1, x2", "adcs w0, w1, x2", "sbc x0, x1, w2"] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains("same width"), "{src}: {err}");
        }
    }

    #[test]
    fn assemble_mul() {
        let source = r#"
            MOV X0, #7
            MOV X1, #6
            MUL X2, X0, X1
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();

        assert_eq!(cpu.regs.read_gpr(2, true), 42);
    }

    #[test]
    fn sp_register_operands_use_the_extended_encoding() {
        // GAS byte-matches: only the extended form (bit 21) reaches SP.
        assert_eq!(assemble("ADD X0, SP, X1").unwrap()[0], 0x8B21_63E0);
        assert_eq!(assemble("SUB SP, SP, X2").unwrap()[0], 0xCB22_63FF);
        assert_eq!(assemble("CMP SP, X1").unwrap()[0], 0xEB21_63FF);
        // Register 31 written as XZR stays the shifted form (reads zero).
        assert_eq!(assemble("ADD X0, XZR, X1").unwrap()[0], 0x8B01_03E0);
    }

    #[test]
    fn sp_in_unencodable_positions_is_rejected() {
        // No encoding lets SP be Rm, and the flag-setting forms cannot
        // write SP; GAS rejects both.
        let err = assemble("ADD X0, X1, SP").unwrap_err();
        assert!(err.to_string().contains("sp"), "was: {err}");
        let err = assemble("CMP X0, SP").unwrap_err();
        assert!(err.to_string().contains("sp"), "was: {err}");
    }

    #[test]
    fn sp_register_arithmetic_executes_with_sp_semantics() {
        // Read as the shifted form, `add x0, sp, x1` takes rn=31 as XZR:
        // x0 becomes 16 and the frame maths collapses.
        let source = r#"
            MOV X2, SP
            MOV X1, #16
            ADD X0, SP, X1
            SUB SP, SP, X1
            MOV X3, SP
            ADD SP, SP, X1
            MOV X4, SP
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        let sp0 = cpu.regs.read_gpr(2, true);
        assert_eq!(cpu.regs.read_gpr(0, true), sp0 + 16);
        assert_eq!(cpu.regs.read_gpr(3, true), sp0 - 16);
        assert_eq!(cpu.regs.read_gpr(4, true), sp0);
    }

    #[test]
    fn shifted_register_dp_forms_match_gas_bytes() {
        // Expected words derived by hand from the A64 encoding tables
        // (and cross-checked against GAS output), never recomputed
        // through the encoder under test.
        assert_eq!(assemble("ADD X0, X1, X2, LSL #3").unwrap()[0], 0x8B02_0C20);
        // The course deck spells it without the # and uppercased.
        assert_eq!(assemble("add w19, w0, w1, LSL 3").unwrap()[0], 0x0B01_0C13);
        assert_eq!(assemble("SUB X0, X1, X2, ASR #4").unwrap()[0], 0xCB82_1020);
        assert_eq!(assemble("AND W0, W1, W2, LSR #4").unwrap()[0], 0x0A42_1020);
        assert_eq!(assemble("ORR X0, X1, X2, ROR #8").unwrap()[0], 0xAAC2_2020);
        assert_eq!(assemble("CMP X1, X2, LSL #2").unwrap()[0], 0xEB02_083F);
        assert_eq!(assemble("TST X0, X1, LSL #2").unwrap()[0], 0xEA01_081F);
        // ROR stays rejected where the hardware reserves it.
        let err = assemble("ADD X0, X1, X2, ROR #3").unwrap_err();
        assert!(err.to_string().contains("ROR"), "was: {err}");
        // Out-of-width amounts and junk modifiers get named.
        rejects(assemble("ADD W0, W1, W2, LSL #32"), "valid: 0-31");
        let err = assemble("ADD X0, X1, X2, FOO #3").unwrap_err();
        assert!(err.to_string().contains("shift modifier"), "was: {err}");
    }

    #[test]
    fn cmp_flips_negative_hex_and_binary_immediates() {
        // cmp w1, #-16 == cmn w1, #16 in every base GAS accepts.
        let dec = assemble("CMP W1, #-16").unwrap()[0];
        assert_eq!(dec, assemble("CMP W1, #-0x10").unwrap()[0]);
        assert_eq!(dec, assemble("CMP W1, #-0b10000").unwrap()[0]);
        assert_eq!(dec, assemble("CMN W1, #16").unwrap()[0]);
    }

    #[test]
    fn mov_encodes_positive_all_ones_as_movn() {
        // GAS encodes `mov w0, #0xffffffff` as MOVN w0, #0 (0x12800000) and
        // `mov x0, #-1` as MOVN x0, #0 (0x92800000). Trying MOVN for
        // negative literals only rejects the positive hex form.
        assert_eq!(assemble("mov w0, #0xffffffff").unwrap()[0], 0x1280_0000);
        assert_eq!(assemble("mov x0, #-1").unwrap()[0], 0x9280_0000);
        // 0xfffffffe fits MOVN but not MOVZ (both halves nonzero): the
        // inverse is 0x1, so MOVN w0, #1 (0x12800020). (0xffff0000 would
        // reach the MOVZ-shifted path first, so it is not a MOVN case.)
        assert_eq!(assemble("mov w0, #0xfffffffe").unwrap()[0], 0x1280_0020);
        // a value that fits neither MOVZ nor MOVN still needs movz+movk.
        rejects(assemble("mov w0, #0x12345678"), "needs MOVZ+MOVK");
    }

    #[test]
    fn movk_with_a_non_lsl_shift_is_rejected() {
        // A dropped third operand leaves hw = 0: `movk x0, #0xDEAD, #16`
        // then destroys the low halfword the movz just placed.
        let err = assemble("MOVK X0, #0xDEAD, #16").unwrap_err();
        assert!(err.to_string().contains("lsl"), "was: {err}");
        rejects(assemble("MOVK X0, #0xDEAD, LSR #16"), "got `LSR #16`");
        rejects(assemble("MOVZ X0, #1, FOO #16"), "got `FOO #16`");
        rejects(assemble("MOVZ X0, #1, LSL #16, LSL #32"), "at most 3 operands");
        assert!(assemble("MOVK X0, #0xDEAD, LSL #16").is_ok());
    }

    // -- msub / madd --

    #[test]
    fn assemble_msub_general_form() {
        // `msub w11, w11, w10, w9`: encode then confirm it round-trips through
        // the decoder as MulAccumulate::Msub with the expected registers.
        let code = assemble("MSUB W11, W11, W10, W9").unwrap();
        assert_eq!(code.len(), 1);
        let decoded = crate::decoder::decode(code[0]).unwrap();
        match decoded {
            crate::decoder::Instruction::MulAccumulate { op, sf, rd, rn, rm, ra } => {
                assert_eq!(op, crate::decoder::MulAccumulateOp::Msub);
                assert!(!sf);
                assert_eq!(rd, 11);
                assert_eq!(rn, 11);
                assert_eq!(rm, 10);
                assert_eq!(ra, 9);
            }
            other => panic!("expected MulAccumulate, got {other:?}"),
        }
    }

    #[test]
    fn assemble_madd_general_form() {
        let code = assemble("MADD X0, X1, X2, X3").unwrap();
        let decoded = crate::decoder::decode(code[0]).unwrap();
        match decoded {
            crate::decoder::Instruction::MulAccumulate { op, ra, .. } => {
                assert_eq!(op, crate::decoder::MulAccumulateOp::Madd);
                assert_eq!(ra, 3);
            }
            other => panic!("expected MulAccumulate, got {other:?}"),
        }
    }
}
