//! Load and store encoders: single registers (general and SIMD&FP,
//! scaled, unscaled, and sign-extending) and register pairs.

use super::*;

pub(super) fn encode_ldrs(ops: &[&str], size: u8, ln: usize) -> Result<u32, EmuError> {
    // LDRSB / LDRSH / LDRSW in unsigned-offset form. The target register
    // width picks between opc=10 (Xt) and opc=11 (Wt). LDRSW only exists
    // with an Xt target, so reject W there.
    if ops.len() < 2 {
        return asm_err(ln, "LDRS* requires at least 2 operands");
    }
    let (rt, target_is_x) = parse_register(ops[0], ln)?;
    if size == 0b10 && !target_is_x {
        return asm_err(ln, "LDRSW needs an X register as the destination");
    }
    let addr_str: String = ops[1..].join(",");
    let am = parse_addressing_mode(addr_str.trim(), ln)?;
    let name = match size {
        0b00 => "ldrsb",
        0b01 => "ldrsh",
        _ => "ldrsw",
    };
    // opc=10 for Xt target, opc=11 for Wt target.
    let inner_opc: u32 = if target_is_x { 0b10 } else { 0b11 };
    match am {
        AddressingMode::Immediate {
            rn,
            offset,
            mode: IndexMode::Unsigned,
        } => {
            let offset_val = offset.unwrap_or(0);
            if size == 0b11 {
                // Unreachable (no sign-extending load is 64-bit), but named
                // so the shared MemSize mapping cannot scale by 8, and an
                // error rather than a panic because on wasm a panic kills
                // the whole worker.
                return asm_err(ln, "internal: LDRS* never carries the 64-bit size field");
            }
            let scale = u64::from(MemSize::from_size_field(size).bytes());
            if offset_val < 0 || !(offset_val as u64).is_multiple_of(scale) {
                // Same conversion the plain loads take: GAS silently emits
                // the unscaled LDURS* encoding for a negative or unaligned
                // offset rather than refusing it.
                if (-256..=255).contains(&offset_val) {
                    return Ok(((size as u32) << 30)
                        | (0b111000 << 24)
                        | (inner_opc << 22)
                        | (((offset_val as u32) & 0x1FF) << 12)
                        | ((rn as u32) << 5)
                        | (rt as u32));
                }
                return asm_err(
                    ln,
                    &format!(
                        "the {name} offset {offset_val} must be scaled and non-negative, or \
                         within [-256, 255] for the unscaled form"
                    ),
                );
            }
            let imm12 = (offset_val as u64 / scale) as u32;
            if imm12 > 4095 {
                return asm_err(
                    ln,
                    &format!("the {name} offset {offset_val} is out of range (0-{})", 4095 * scale),
                );
            }
            Ok(((size as u32) << 30)
                | (0b111001 << 24)
                | (inner_opc << 22)
                | (imm12 << 10)
                | ((rn as u32) << 5)
                | (rt as u32))
        }
        AddressingMode::Immediate { rn, offset, mode } => {
            let offset_val = offset.unwrap_or(0);
            if !(-256..=255).contains(&offset_val) {
                return asm_err(ln, "pre/post-index offset must be in [-256, 255]");
            }
            let idx = if matches!(mode, IndexMode::PreIndex) { 0b11u32 } else { 0b01 };
            Ok(((size as u32) << 30)
                | (0b111000 << 24)
                | (inner_opc << 22)
                | (((offset_val as u32) & 0x1FF) << 12)
                | (idx << 10)
                | ((rn as u32) << 5)
                | (rt as u32))
        }
        AddressingMode::RegOffset {
            rn,
            rm,
            option,
            shift_amount,
        } => {
            // LDRSB/LDRSH/LDRSW register offset: the array-indexing form
            // (`ldrsb w0, [x1, x2]`). Same S-bit rule as plain LDR/STR:
            // the only legal written amounts are 0 and log2(access bytes).
            let s_bit: u32 = match shift_amount {
                None => 0,
                Some(a) if a == size as i64 => 1,
                Some(0) => 0,
                Some(a) => {
                    return asm_err(
                        ln,
                        &format!(
                            "{name} can only scale its index register by #0 or #{size}, got #{a}"
                        ),
                    );
                }
            };
            Ok(((size as u32) << 30)
                | (0b111000 << 24)
                | (inner_opc << 22)
                | (1 << 21)
                | ((rm as u32) << 16)
                | ((option as u32) << 13)
                | (s_bit << 12)
                | (0b10 << 10)
                | ((rn as u32) << 5)
                | (rt as u32))
        }
    }
}

pub(super) fn encode_ldst(ops: &[&str], load: u8, size: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 2 {
        return asm_err(ln, "LDR/STR requires at least 2 operands");
    }
    // FP LDR/STR: the target is a b/h/s/d/q register. Dispatch to the
    // SIMD&FP encoding; this path only handles the plain integer form.
    // Only bare LDR/STR carry an FP target; LDRB and friends pin `size`
    // themselves and stay integer.
    if let Some(first_char) = ops[0].trim().chars().next() {
        if FpWidth::from_prefix(first_char).is_some() && size == 0b11 {
            return encode_ldst_fp(ops, load, false, ln);
        }
    }
    let (rt, target_is_x) = parse_register(ops[0], ln)?;

    // LDR/STR (plain, not byte/halfword) implicitly picks 32- or 64-bit
    // based on whether the target register is W or X. Byte/halfword
    // variants come in with size already pinned (0b00 / 0b01) so leave
    // those alone.
    let size = if size == 0b11 && !target_is_x { 0b10 } else { size };

    // parse addressing mode from remaining operands
    let addr_str: String = ops[1..].join(",");
    let addr_str = addr_str.trim();

    let am = parse_addressing_mode(addr_str, ln)?;

    match am {
        AddressingMode::Immediate {
            rn,
            offset,
            mode: IndexMode::Unsigned,
        } => {
            let offset_val = offset.unwrap_or(0);
            // Unsigned offset encoding: the immediate is scaled by the
            // access width, which the shared MemSize mapping names. `size`
            // has already been narrowed above for a W target.
            let scale = u64::from(MemSize::from_size_field(size).bytes());
            if offset_val < 0 || !(offset_val as u64).is_multiple_of(scale) {
                // Negative or unaligned offsets have no scaled form; GAS
                // silently emits the unscaled LDUR/STUR encoding instead
                // (struct fields at odd offsets, negative frame slots).
                // Same conversion here, same [-256, 255] reach.
                if (-256..=255).contains(&offset_val) {
                    let imm9 = (offset_val as u32) & 0x1FF;
                    return Ok(((size as u32) << 30)
                        | (0b111000 << 24)
                        | ((load as u32) << 22)
                        | (imm9 << 12)
                        | ((rn as u32) << 5)
                        | (rt as u32));
                }
                return asm_err(
                    ln,
                    "offset must be scaled and positive, or within [-256, 255] for the unscaled form",
                );
            }
            let imm12 = (offset_val as u64 / scale) as u32;
            if imm12 > 4095 {
                return asm_err(ln, "offset out of range");
            }
            Ok(((size as u32) << 30) | (0b111001 << 24) | ((load as u32) << 22)
                | (imm12 << 10) | ((rn as u32) << 5) | (rt as u32))
        }
        AddressingMode::Immediate { rn, offset, mode } => {
            let offset_val = offset.unwrap_or(0);
            if !(-256..=255).contains(&offset_val) {
                return asm_err(ln, "pre/post-index offset must be in [-256, 255]");
            }
            let imm9 = (offset_val as u32) & 0x1FF;
            let idx = if matches!(mode, IndexMode::PreIndex) { 0b11u32 } else { 0b01 };
            Ok(((size as u32) << 30) | (0b111000 << 24) | ((load as u32) << 22)
                | (imm9 << 12) | (idx << 10) | ((rn as u32) << 5) | (rt as u32))
        }
        AddressingMode::RegOffset {
            rn,
            rm,
            option,
            shift_amount,
        } => {
            // LDR/STR register. Encoding:
            //   size | 111 0 00 | V=0 | load(2b) | 1 | Rm | option(3) | S | 10 | Rn | Rt
            // The S bit means "scale the index by the access size", so the
            // only legal written amounts are 0 and log2(access bytes),
            // exactly what GAS enforces. `size` is that log2, so a byte
            // access that writes `#0` sets S: GAS keeps the spelling apart.
            let s_bit: u32 = match shift_amount {
                None => 0,
                Some(a) if a == size as i64 => 1,
                Some(0) => 0,
                Some(a) => {
                    return asm_err(
                        ln,
                        &format!(
                            "a {}-bit access can only scale its index register by #0 or #{}, got #{}",
                            8u32 << size,
                            size,
                            a
                        ),
                    );
                }
            };
            Ok(((size as u32) << 30)
                | (0b111000 << 24)
                | ((load as u32) << 22)
                | (1 << 21)
                | ((rm as u32) << 16)
                | ((option as u32) << 13)
                | (s_bit << 12)
                | (0b10 << 10)
                | ((rn as u32) << 5)
                | (rt as u32))
        }
    }
}

/// SIMD&FP LDR/STR at all five widths.
///
/// Unsigned offset:  size | 111 | V=1 | 01 | opc | imm12 | Rn | Rt
/// imm9 family:      size | 111 | V=1 | 00 | opc | 0 | imm9 | idx | Rn | Rt
/// Register offset:  size | 111 | V=1 | 00 | opc | 1 | Rm | option | S | 10 | Rn | Rt
///
/// `opc` is `opc_high:load`, so the Q form (opc_high 1, size 00) is what
/// tells a 128-bit access from the byte one they share a size field with.
/// `unscaled` is set by LDUR/STUR, which spell the imm9 offset form
/// outright and take no other addressing mode.
fn encode_ldst_fp(ops: &[&str], load: u8, unscaled: bool, ln: usize) -> Result<u32, EmuError> {
    let FpReg { idx: rt, width } = parse_fp_register(ops[0], ln)?;
    let addr_str: String = ops[1..].join(",");
    let am = parse_addressing_mode(addr_str.trim(), ln)?;
    let size = width.size_field();
    let scale = width.bytes();
    let opc: u32 = (width.opc_high() << 1) | u32::from(load);
    let mnemonic = if unscaled {
        if load == 1 { "LDUR" } else { "STUR" }
    } else if load == 1 {
        "LDR"
    } else {
        "STR"
    };
    // The imm9 family shared by the unscaled-offset and writeback forms.
    let imm9_form = |offset_val: i64, idx: u32, rn: u8| -> Result<u32, EmuError> {
        if !(-256..=255).contains(&offset_val) {
            return asm_err(ln, "FP offset must be in [-256, 255] for this form");
        }
        let imm9 = (offset_val as u32) & 0x1FF;
        Ok((size << 30)
            | (0b1111 << 26)
            | (opc << 22)
            | (imm9 << 12)
            | (idx << 10)
            | ((rn as u32) << 5)
            | (rt as u32))
    };
    match am {
        AddressingMode::Immediate {
            rn,
            offset,
            mode: IndexMode::Unsigned,
        } => {
            let offset_val = offset.unwrap_or(0);
            if unscaled || offset_val < 0 || !(offset_val as u64).is_multiple_of(scale) {
                // Same GAS conversion as the integer path: negative or
                // unaligned offsets ride the unscaled encoding, and
                // LDUR/STUR ask for it by name.
                return imm9_form(offset_val, 0b00, rn);
            }
            let imm12 = (offset_val as u64 / scale) as u32;
            if imm12 > 4095 {
                return asm_err(ln, "FP offset out of range");
            }
            Ok((size << 30)
                | (0b1111 << 26)
                | (0b01 << 24)
                | (opc << 22)
                | (imm12 << 10)
                | ((rn as u32) << 5)
                | (rt as u32))
        }
        AddressingMode::Immediate { rn, offset, mode } => {
            if unscaled {
                return asm_err(
                    ln,
                    &format!("{mnemonic} takes a plain [Xn, #imm] address, with no writeback"),
                );
            }
            let offset_val = offset.unwrap_or(0);
            let idx = if matches!(mode, IndexMode::PreIndex) { 0b11 } else { 0b01 };
            imm9_form(offset_val, idx, rn)
        }
        AddressingMode::RegOffset {
            rn,
            rm,
            option,
            shift_amount,
        } => {
            if unscaled {
                return asm_err(
                    ln,
                    &format!("{mnemonic} takes a plain [Xn, #imm] address, not a register offset"),
                );
            }
            // S means "scale the index by the access size". The only
            // amount that may be written is log2 of the access width, and
            // a written #0 sets S for a byte access, where the two spell
            // the same shift: GAS keeps the distinction in the word.
            let shift = i64::from(width.scale_shift());
            let s_bit: u32 = match shift_amount {
                None => 0,
                Some(a) if a == shift => 1,
                Some(0) => 0,
                Some(a) => {
                    return asm_err(
                        ln,
                        &format!(
                            "this {}-byte access can only scale its index register by #0 or #{shift}, got #{a}",
                            width.bytes()
                        ),
                    );
                }
            };
            Ok((size << 30)
                | (0b1111 << 26)
                | (opc << 22)
                | (1 << 21)
                | ((rm as u32) << 16)
                | ((option as u32) << 13)
                | (s_bit << 12)
                | (0b10 << 10)
                | ((rn as u32) << 5)
                | (rt as u32))
        }
    }
}

/// LDUR/STUR of a SIMD&FP register: the unscaled signed-offset form
/// spelled out. The integer LDUR/STUR are not in `SUPPORTED_MNEMONICS`,
/// so a general-register operand is turned away by `parse_fp_register`.
pub(super) fn encode_ldur_stur(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 2 {
        return asm_err(ln, "LDUR/STUR requires at least 2 operands");
    }
    encode_ldst_fp(ops, load, true, ln)
}

#[allow(clippy::identity_op)] // zero fields kept to document the full encoding layout
/// LDP/STP, and with `signed_words` LDPSW: two words from memory, each
/// sign-extended into an X register (gcc's load of an int pair).
pub(super) fn encode_ldst_pair(ops: &[&str], load: u8, signed_words: bool, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 3 {
        return asm_err(ln, "LDP/STP requires at least 3 operands");
    }
    // An FP first operand (d8, s0, q1) routes the pair through the
    // SIMD&FP class, the same sniff encode_ldst does for single
    // registers. The digit check keeps `sp` on the general path.
    let first = ops[0].trim();
    if let Some(c) = first.chars().next() {
        if FpWidth::from_prefix(c).is_some()
            && first.len() >= 2
            && first[1..].chars().all(|d| d.is_ascii_digit())
        {
            return encode_ldst_pair_fp(ops, load, ln);
        }
    }
    let (rt, sf) = parse_register(ops[0], ln)?;
    let (rt2, sf2) = parse_register(ops[1], ln)?;
    // GAS rejects a mixed-width pair; accepting one takes the width (and
    // the address scale) from the first register only, so both slots
    // reload garbage with no message.
    if sf != sf2 {
        return asm_err(
            ln,
            &format!(
                "ldp/stp needs both registers the same width: `{}` is {}-bit but `{}` is {}-bit",
                ops[0].trim(),
                if sf { 64 } else { 32 },
                ops[1].trim(),
                if sf2 { 64 } else { 32 }
            ),
        );
    }

    let addr_str: String = ops[2..].join(",");
    let am = parse_addressing_mode(addr_str.trim(), ln)?;
    let (rn, offset_val, mode) = match am {
        AddressingMode::Immediate { rn, offset, mode } => (rn, offset.unwrap_or(0), mode),
        AddressingMode::RegOffset { .. } => {
            return asm_err(ln, "LDP/STP does not accept a register offset");
        }
    };

    if signed_words && !sf {
        return asm_err(ln, "LDPSW loads into X registers: ldpsw x1, x2, [x0]");
    }
    let scale: i64 = if sf && !signed_words { 8 } else { 4 };
    if offset_val % scale != 0 {
        return asm_err(ln, "pair offset must be aligned to register size");
    }
    // Range-check the full-width quotient BEFORE narrowing: an `as i8`
    // cast wraps mod 256, so an out-of-range offset whose wrapped value
    // lands back in [-64, 63] encodes a wrong frame offset (a 20x20
    // table's -1616 moves SP up by 432).
    let quotient = offset_val / scale;
    if !(-64..=63).contains(&quotient) {
        return asm_err(
            ln,
            &format!(
                "pair offset {offset_val} is out of range: stp/ldp reaches [{}, {}] \
                 for this register width; for a larger frame, push the pair first \
                 (stp x29, x30, [sp, -16]!) and move sp separately (sub sp, sp, #N)",
                -64 * scale,
                63 * scale
            ),
        );
    }
    let imm7_enc = (quotient as u32) & 0x7F;

    let opc: u32 = if signed_words { 0b01 } else if sf { 0b10 } else { 0b00 };
    let mode_bits: u32 = match mode {
        IndexMode::PostIndex => 0b01,
        IndexMode::Unsigned => 0b10,
        IndexMode::PreIndex => 0b11,
    };

    Ok((opc << 30) | (0b101 << 27) | (0 << 26) | (mode_bits << 23)
        | ((load as u32) << 22) | (imm7_enc << 15)
        | ((rt2 as u32) << 10) | ((rn as u32) << 5) | (rt as u32))
}

/// LDP/STP/LDNP/STNP of the FP file: V=1, opc 00 for S pairs (scale 4),
/// 01 for D pairs (scale 8), 10 for Q pairs (scale 16). Same addressing
/// modes and imm7 range as the general form; a callee-saved
/// `stp d8, d9, [sp, -16]!` prologue is correct AAPCS64 and lands here.
/// `no_allocate` is the LDNP/STNP op2 (00), a plain signed offset whose
/// only difference is a cache hint, so it takes no writeback index.
fn encode_ldst_pair_fp_inner(
    ops: &[&str], load: u8, no_allocate: bool, ln: usize,
) -> Result<u32, EmuError> {
    let FpReg { idx: rt, width: wt } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: rt2, width: wt2 } = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width("ldp/stp", &[wt, wt2], ln)?;
    let Some(opc) = width.pair_opc() else {
        return asm_err(
            ln,
            &format!(
                "there is no {}-register pair form: ldp/stp take s, d or q registers",
                width.letter()
            ),
        );
    };

    let addr_str: String = ops[2..].join(",");
    let am = parse_addressing_mode(addr_str.trim(), ln)?;
    let (rn, offset_val, mode) = match am {
        AddressingMode::Immediate { rn, offset, mode } => (rn, offset.unwrap_or(0), mode),
        AddressingMode::RegOffset { .. } => {
            return asm_err(ln, "LDP/STP does not accept a register offset");
        }
    };
    if no_allocate && !matches!(mode, IndexMode::Unsigned) {
        return asm_err(
            ln,
            "LDNP/STNP take a plain [Xn, #imm] address, with no writeback",
        );
    }

    let scale = width.bytes() as i64;
    if offset_val % scale != 0 {
        return asm_err(ln, "pair offset must be aligned to register size");
    }
    let quotient = offset_val / scale;
    if !(-64..=63).contains(&quotient) {
        return asm_err(
            ln,
            &format!(
                "pair offset {offset_val} is out of range: stp/ldp reaches [{}, {}] \
                 for this register width",
                -64 * scale,
                63 * scale
            ),
        );
    }
    let imm7_enc = (quotient as u32) & 0x7F;

    let mode_bits: u32 = if no_allocate {
        0b00
    } else {
        match mode {
            IndexMode::PostIndex => 0b01,
            IndexMode::Unsigned => 0b10,
            IndexMode::PreIndex => 0b11,
        }
    };

    Ok((opc << 30) | (0b101 << 27) | (1 << 26) | (mode_bits << 23)
        | ((load as u32) << 22) | (imm7_enc << 15)
        | ((rt2 as u32) << 10) | ((rn as u32) << 5) | (rt as u32))
}

fn encode_ldst_pair_fp(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    encode_ldst_pair_fp_inner(ops, load, false, ln)
}

/// LDNP/STNP, the no-allocate pair. SIMD&FP only here: the general-
/// register spelling is not in `SUPPORTED_MNEMONICS`, so a `x0` operand
/// is turned away by `parse_fp_register`.
pub(super) fn encode_ldst_pair_no_allocate(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 3 {
        return asm_err(ln, "LDNP/STNP requires at least 3 operands");
    }
    encode_ldst_pair_fp_inner(ops, load, true, ln)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::rejects;
    use crate::cpu::Cpu;

    #[test]
    fn unaligned_signed_offset_rides_the_unscaled_encoding() {
        // The struct-field shape: a 64-bit access at an offset that is
        // not a multiple of 8 has no scaled unsigned form. GAS silently
        // emits LDUR/STUR; the assembler must do the same conversion.
        let source = r#"
            MOV X0, #0x1122
            MOVK X0, #0x3344, LSL #16
            SUB SP, SP, #32
            STR X0, [SP, #20]
            LDR X1, [SP, #20]
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_gpr(1, true), 0x3344_1122);
        assert!(cpu.is_halted());
    }

    #[test]
    fn negative_signed_offset_rides_the_unscaled_encoding() {
        let source = r#"
            MOV X0, #77
            STR X0, [SP, #-8]
            LDR X1, [SP, #-8]
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_gpr(1, true), 77);
    }

    #[test]
    fn unscaled_offset_out_of_reach_still_errors() {
        // -257 is below the imm9 window and must not silently wrap.
        let err = assemble("LDR X1, [SP, #-257]\nSVC #0\n").unwrap_err();
        let msg = format!("{err}");
        assert!(msg.contains("[-256, 255]"), "explains the reach: {msg}");
    }

    #[test]
    fn fp_negative_offset_and_writeback_assemble_and_execute() {
        // FP spill discipline: push d0 with pre-index writeback, read it
        // back at a negative offset, pop with post-index writeback.
        let source = r#"
            MOV X0, #3
            SCVTF D0, X0
            STR D0, [SP, #-16]!
            LDR D1, [SP]
            ADD X2, SP, #16
            STR D1, [X2, #-16]
            LDR D2, [SP], #16
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        let sp_before = cpu.regs.read_sp();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_fpr_f64(1), 3.0);
        assert_eq!(cpu.regs.read_fpr_f64(2), 3.0);
        // Writeback pushed then popped: SP is back where it started.
        assert_eq!(cpu.regs.read_sp(), sp_before);
        assert!(cpu.is_halted());
    }

    #[test]
    fn fp_load_uses_sp_as_base_not_xzr() {
        // Register 31 in a memory base means SP. A d-register load
        // relative to SP must read the stack, not address zero.
        let source = r#"
            MOV X0, #9
            SCVTF D0, X0
            SUB SP, SP, #16
            STR D0, [SP, #8]
            LDR D3, [SP, #8]
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        assert_eq!(cpu.regs.read_fpr_f64(3), 9.0);
    }

    #[test]
    fn assemble_str_ldr() {
        let source = r#"
            MOV X0, #42
            STR X0, [SP, #-16]!
            MOV X0, #0
            LDR X1, [SP], #16
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(1, true), 42);
    }

    #[test]
    fn fp_pairs_encode_as_the_gas_words_and_round_trip() {
        use crate::decoder::{decode, Instruction, LdStPairOp, MemSize};
        let labels = HashMap::new();
        // The canonical callee-saved prologue word, byte-matched to GAS.
        let word = encode_line("stp d8, d9, [sp, -16]!", 0, &labels, 1).unwrap();
        assert_eq!(word, 0x6DBF_27E8);
        match decode(word).unwrap() {
            Instruction::FpLdStPair { op, size, rt, rt2, rn, imm7, .. } => {
                assert_eq!(op, LdStPairOp::Stp);
                assert_eq!(size, MemSize::X);
                assert_eq!((rt, rt2, rn, imm7), (8, 9, 31, -16));
            }
            other => panic!("decoded to {other:?} (the V=1 pair once ran as a GP pair)"),
        }
        for src in [
            "ldp d8, d9, [sp], 16",
            "stp s0, s1, [sp, 8]",
            "ldp s2, s3, [x0]",
            "stp d0, d1, [x1, 32]",
        ] {
            let word = encode_line(src, 0, &labels, 1).unwrap();
            assert!(
                matches!(decode(word).unwrap(), Instruction::FpLdStPair { .. }),
                "{src}"
            );
        }
    }

    #[test]
    fn fp_pairs_reject_mixed_widths_and_carry_the_q_form() {
        use crate::decoder::{decode, Instruction, MemSize};
        let labels = HashMap::new();
        let err = encode_line("stp d0, s1, [sp, -16]!", 0, &labels, 1)
            .unwrap_err()
            .to_string();
        assert!(err.contains("all S or all D"), "{err}");
        // A Q-register pair word (opc=10, V=1) is a real 16-byte pair.
        assert!(matches!(
            decode(0xAD00_07E0).unwrap(),
            Instruction::FpLdStPair { size: MemSize::Q, .. }
        ));
        assert_eq!(
            encode_line("stp q0, q1, [sp]", 0, &labels, 1).unwrap(),
            0xAD00_07E0
        );
    }

    #[test]
    fn fp_pair_prologue_saves_and_restores_callee_saved_doubles() {
        use crate::cpu::Cpu;
        let source = r#"
            MOV X0, #0x4045
            LSL X0, X0, #48
            FMOV D8, X0
            MOV X1, #0x4050
            LSL X1, X1, #48
            FMOV D9, X1
            STP D8, D9, [SP, #-16]!
            FMOV D8, XZR
            FMOV D9, XZR
            LDP D8, D9, [SP], #16
            FMOV X2, D8
            FMOV X3, D9
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(30).unwrap();
        assert_eq!(cpu.regs.read_gpr(2, true), 0x4045u64 << 48, "d8 restored");
        assert_eq!(cpu.regs.read_gpr(3, true), 0x4050u64 << 48, "d9 restored");
        assert_eq!(cpu.regs.read_sp(), crate::cpu::STACK_BASE, "sp balanced");
    }

    #[test]
    fn assemble_stp_ldp() {
        let source = r#"
            MOV X0, #100
            MOV X1, #200
            STP X0, X1, [SP, #-16]!
            MOV X0, #0
            MOV X1, #0
            LDP X2, X3, [SP], #16
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(2, true), 100);
        assert_eq!(cpu.regs.read_gpr(3, true), 200);
    }

    #[test]
    fn pair_offset_out_of_range_is_rejected_not_wrapped() {
        // -1616 / 8 = -202, which wraps to +54 through an i8 cast; the
        // encoder must reject it, naming the reachable range.
        let err = assemble("STP X29, X30, [SP, #-1616]!").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("-1616"), "message was: {msg}");
        assert!(msg.contains("[-512, 504]"), "message was: {msg}");

        // +1536 / 8 = 192 wraps to -64: also silently in range before.
        rejects(assemble("STP X0, X1, [SP, #1536]"), "reaches [-512, 504]");

        // W pairs scale by 4, halving the reach: 768 / 4 = 192 wraps too.
        let err = assemble("STP W0, W1, [SP, #768]").unwrap_err();
        assert!(err.to_string().contains("[-256, 252]"), "was: {err}");
    }

    #[test]
    fn ldrs_register_offset_matches_gas_bytes() {
        // The array-indexing form the course loops use. Expected words
        // hand-derived from the A64 tables and checked against GAS.
        assert_eq!(assemble("LDRSB W0, [X1, X2]").unwrap()[0], 0x38E2_6820);
        assert_eq!(assemble("LDRSW X3, [X1, X2, LSL #2]").unwrap()[0], 0xB8A2_7823);
        assert_eq!(assemble("LDRSH X0, [X1, W2, SXTW]").unwrap()[0], 0x78A2_C820);
        // A wrong scale names the instruction and the legal amounts.
        let err = assemble("LDRSH W0, [X1, X2, LSL #3]").unwrap_err();
        assert!(err.to_string().contains("ldrsh"), "was: {err}");
    }

    #[test]
    fn ldrs_negative_and_unaligned_offsets_ride_the_unscaled_form() {
        // A negative or misaligned offset takes the unscaled (LDURS*)
        // encoding rather than being refused, exactly as GAS does.
        assert_eq!(assemble("LDRSB W0, [X1, #-1]").unwrap()[0], 0x38DF_F020);
        assert_eq!(assemble("LDRSH W0, [X1, #3]").unwrap()[0], 0x78C0_3020);
        // Past the unscaled reach the message names the range, and does
        // not blame alignment (ldrsb has scale 1; alignment cannot apply).
        let err = assemble("LDRSH W0, [X1, #-257]").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("ldrsh"), "was: {msg}");
        assert!(msg.contains("[-256, 255]"), "was: {msg}");
        assert!(!msg.contains("align"), "was: {msg}");
        // Zero stays accepted.
        assert!(assemble("LDRSB W0, [X1]").is_ok());
        assert!(assemble("LDRSB W0, [X1, #0]").is_ok());
    }

    #[test]
    fn register_offset_scale_follows_the_written_amount() {
        // Riding the S bit on the mere PRESENCE of an amount scales
        // `lsl #0` by 8 and rescales every wrong amount.
        assert_eq!(assemble("LDR X0, [X1, X2]").unwrap()[0], 0xF862_6820);
        assert_eq!(assemble("LDR X0, [X1, X2, LSL #0]").unwrap()[0], 0xF862_6820);
        assert_eq!(assemble("LDR X0, [X1, X2, LSL #3]").unwrap()[0], 0xF862_7820);
        assert_eq!(assemble("LDR W0, [X1, X2, LSL #2]").unwrap()[0], 0xB862_7820);
        // Non-canonical amounts are GAS hard errors, never a rescale.
        let err = assemble("LDR X0, [X1, X2, LSL #2]").unwrap_err();
        assert!(err.to_string().contains("#0 or #3"), "was: {err}");
        rejects(assemble("LDR W0, [X1, X2, LSL #3]"), "by #0 or #2, got #3");
        rejects(assemble("LDR X0, [X1, W2, SXTW #7]"), "by #0 or #3, got #7");
        // SXTW with the canonical amount still scales.
        assert!(assemble("LDR X0, [X1, W2, SXTW #3]").is_ok());
        assert!(assemble("LDR X0, [X1, W2, SXTW #0]").is_ok());
    }

    #[test]
    fn a_byte_access_that_writes_its_zero_scale_sets_s() {
        // For a byte, #0 is also log2 of the size, and GNU as sets S for it
        // (words captured on csarm). Leaving the amount out keeps S clear.
        assert_eq!(assemble("ldrb w1, [x0, x2, lsl #0]").unwrap()[0], 0x3862_7801);
        assert_eq!(assemble("ldrb w1, [x0, w2, uxtw #0]").unwrap()[0], 0x3862_5801);
        assert_eq!(assemble("strb w1, [x0, w2, sxtw #0]").unwrap()[0], 0x3822_d801);
        assert_eq!(assemble("ldrsb w1, [x0, w2, uxtw #0]").unwrap()[0], 0x38e2_5801);
        assert_eq!(assemble("ldrsb x1, [x0, x2, sxtx #0]").unwrap()[0], 0x38a2_f801);
        assert_eq!(assemble("ldrb w1, [x0, w2, uxtw]").unwrap()[0], 0x3862_4801);
        assert_eq!(assemble("ldrb w1, [x0, x2]").unwrap()[0], 0x3862_6801);
        // Wider accesses keep S clear for #0.
        assert_eq!(assemble("ldrh w1, [x0, w2, uxtw #0]").unwrap()[0], 0x7862_4801);
        assert_eq!(assemble("ldr x1, [x0, x2, sxtx #0]").unwrap()[0], 0xf862_e801);
    }

    #[test]
    fn an_address_refuses_uxtx_and_a_bare_lsl_like_gnu_as() {
        rejects(assemble("ldr w1, [x0, x2, uxtx]"), "write lsl");
        rejects(assemble("ldr x1, [x0, x2, uxtx #3]"), "write lsl");
        rejects(assemble("ldr q1, [x0, x2, uxtx #4]"), "write lsl");
        rejects(assemble("ldrb w1, [x0, x2, lsl]"), "lsl needs its amount");
        rejects(assemble("str x1, [x0, x2, LSL]"), "lsl needs its amount");
        // An extend may still leave its amount out.
        assert_eq!(assemble("ldr x1, [x0, x2, sxtx]").unwrap()[0], 0xf862_e801);
        assert_eq!(assemble("ldr w1, [x0, w2, sxtw]").unwrap()[0], 0xb862_c801);
    }

    #[test]
    fn mixed_width_pairs_are_rejected() {
        // GAS rejects these; accepting them stores the wrong width and
        // both registers reload garbage.
        let err = assemble("STP X0, W1, [SP, #0]").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("same width"), "was: {msg}");
        rejects(assemble("STP W0, X1, [SP, #0]"), "same width");
        rejects(assemble("LDP X0, W1, [SP, #0]"), "same width");
        assert!(assemble("LDP W2, W3, [SP], #16").is_ok());
    }

    #[test]
    fn pair_offset_boundaries_encode() {
        // imm7 holds the offset over the register size, so the ends of the
        // range are imm7 = -64 (0b1000000) and +63. Words worked by hand:
        // opc | 101 0 010 0 | imm7 << 15 | Rt2 << 10 | Rn(sp) << 5 | Rt.
        let word = |src: &str| assemble(src).unwrap()[0];
        assert_eq!(word("STP X0, X1, [SP, #-512]"), 0xA920_07E0);
        assert_eq!(word("STP X0, X1, [SP, #504]"), 0xA91F_87E0);
        assert_eq!(word("STP W0, W1, [SP, #-256]"), 0x2920_07E0);
        assert_eq!(word("STP W0, W1, [SP, #252]"), 0x291F_87E0);
        for past in ["STP X0, X1, [SP, #-520]", "STP X0, X1, [SP, #512]"] {
            let msg = assemble(past).unwrap_err().to_string();
            assert!(msg.contains("[-512, 504]"), "{past}: {msg}");
        }
    }

    // -- sign-extending loads --

    #[test]
    fn sign_extending_loads_take_the_imm9_writeback_forms() {
        let labels = HashMap::new();
        for (src, want) in [
            ("ldrsw x0, [x1], #4", 0xB880_4420u32),
            ("ldrsw x0, [x1, #-4]!", 0xB89F_CC20),
            ("ldrsw x0, [x1, #-4]", 0xB89F_C020),
            ("ldrsw x0, [x1], #255", 0xB88F_F420),
            ("ldrsw x0, [x1, #-256]!", 0xB890_0C20),
            ("ldrsb x0, [x1], #1", 0x3880_1420),
            ("ldrsb w0, [x1], #1", 0x38C0_1420),
            ("ldrsb x0, [x1, #1]!", 0x3880_1C20),
            ("ldrsb w0, [x1, #-1]!", 0x38DF_FC20),
            ("ldrsb x0, [x1, #-1]", 0x389F_F020),
            ("ldrsb w0, [x1, #-1]", 0x38DF_F020),
            ("ldrsh x0, [x1], #2", 0x7880_2420),
            ("ldrsh w0, [x1, #2]!", 0x78C0_2C20),
            ("ldrsh x0, [x1, #2]!", 0x7880_2C20),
            ("ldrsh w0, [x1], #2", 0x78C0_2420),
            ("ldrsh x0, [x1, #-2]", 0x789F_E020),
            ("ldrsh w0, [x1, #-2]", 0x78DF_E020),
        ] {
            let word = encode_line(src, 0, &labels, 1).unwrap();
            assert_eq!(word, want, "{src}");
            // The word has to survive the round trip as a sign-extending
            // load, not as a plain LDR/STR of the wrong width.
            match crate::decoder::decode(word).unwrap() {
                crate::decoder::Instruction::LdrSignExtended { .. } => {}
                other => panic!("{src} decoded to {other:?}"),
            }
        }
        for src in ["ldrsw x0, [x1], #256", "ldrsw x0, [x1, #-257]!"] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains("[-256, 255]"), "{src}: {err}");
        }
        let err = encode_line("ldrsw x0, [x1, #-257]", 0, &labels, 1).unwrap_err().to_string();
        assert!(err.contains("[-256, 255]"), "{err}");
    }

    #[test]
    fn assemble_ldrsb_xt_round_trips() {
        let code = assemble("LDRSB X0, [X1, #4]").unwrap();
        let decoded = crate::decoder::decode(code[0]).unwrap();
        match decoded {
            crate::decoder::Instruction::LdrSignExtended { rt, rn, size, sf, .. } => {
                assert_eq!(rt, 0);
                assert_eq!(rn, 1);
                assert_eq!(size, crate::decoder::MemSize::B);
                assert!(sf);
            }
            other => panic!("expected LdrSignExtended, got {other:?}"),
        }
    }

    #[test]
    fn assemble_ldrsb_wt_has_sf_false() {
        let code = assemble("LDRSB W0, [X1, #0]").unwrap();
        let decoded = crate::decoder::decode(code[0]).unwrap();
        match decoded {
            crate::decoder::Instruction::LdrSignExtended { sf, .. } => assert!(!sf),
            other => panic!("expected LdrSignExtended, got {other:?}"),
        }
    }

    #[test]
    fn assemble_ldrsh_round_trips() {
        let code = assemble("LDRSH X3, [X4, #8]").unwrap();
        let decoded = crate::decoder::decode(code[0]).unwrap();
        match decoded {
            crate::decoder::Instruction::LdrSignExtended { size, .. } => {
                assert_eq!(size, crate::decoder::MemSize::H);
            }
            other => panic!("expected LdrSignExtended, got {other:?}"),
        }
    }

    #[test]
    fn assemble_ldrsw_requires_x_target() {
        rejects(assemble("LDRSW W0, [X1, #0]"), "LDRSW needs an X register");
        assert!(assemble("LDRSW X0, [X1, #0]").is_ok());
    }

    // -- the load/store extend table --

    #[test]
    fn ldst_extends_table_round_trips_and_holds_the_width_rule() {
        use crate::decoder::{ExtendType, Instruction, LdStOffset};
        for (keyword, option, needs_x) in LDST_EXTENDS {
            let (right, wrong) = if *needs_x { ("x2", "w2") } else { ("w2", "x2") };
            let src = format!("ldr x0, [x1, {right}, {keyword} #0]");
            // Option 0b011 has two names, and GNU as takes only `lsl` in
            // an address.
            if *keyword == "uxtx" {
                rejects(assemble(&src), "write lsl");
                continue;
            }
            let word = assemble(&src).unwrap()[0];
            let expected = match *keyword {
                "uxtw" => ExtendType::Uxtw,
                "sxtw" => ExtendType::Sxtw,
                "sxtx" => ExtendType::Sxtx,
                _ => ExtendType::Lsl,
            };
            match crate::decoder::decode(word).unwrap() {
                Instruction::LdSt {
                    offset: LdStOffset::Register { rm, extend, .. },
                    ..
                } => {
                    assert_eq!(rm, 2, "{src}");
                    assert_eq!(extend, expected, "{src}");
                }
                other => panic!("{src}: expected a register-offset LdSt, got {other:?}"),
            }
            assert_eq!(
                (word >> 13) & 0b111,
                u32::from(*option),
                "{src}: wrong option field"
            );
            // The width rule is the table's third column, and the refusal
            // names the extend it broke.
            let bad = format!("ldr x0, [x1, {wrong}, {keyword}]");
            rejects(assemble(&bad), &keyword.to_uppercase());
        }
    }
}
