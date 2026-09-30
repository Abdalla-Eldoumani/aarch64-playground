//! Advanced SIMD operands (arrangements, lanes, register lists) and the
//! encoders outside the lane-arithmetic families: vector immediates,
//! lane moves, permutes, table lookups, structure loads and stores, the
//! integer across-lanes reductions, the vector logical forms, and the
//! vector spellings of MOV, ORR and FMOV.

use super::*;

// ---------------------------------------------------------------------------
// advanced simd operands
// ---------------------------------------------------------------------------

/// The eight arrangement suffixes, each as (spelling, lane bytes, Q).
const ARRANGEMENTS: &[(&str, u8, bool)] = &[
    ("8b", 1, false),
    ("16b", 1, true),
    ("4h", 2, false),
    ("8h", 2, true),
    ("2s", 4, false),
    ("4s", 4, true),
    ("1d", 8, false),
    ("2d", 8, true),
];

/// A `v` register operand the way source spells it: either a whole
/// register under an arrangement (`v3.16b`) or one lane of it
/// (`v3.b[15]`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct VecReg {
    pub(super) idx: u8,
    /// Lane width in bytes: 1, 2, 4 or 8.
    pub(super) esize: u8,
    /// The 128-bit arrangement. Meaningless on a lane reference, where
    /// the element's own width is all the encoding carries.
    pub(super) q: bool,
    /// The lane a `[n]` names, or None for a plain arrangement.
    pub(super) lane: Option<u8>,
}

impl VecReg {
    /// The imm5 field of the copy group: the lowest set bit names the
    /// element width and the bits above it the lane.
    fn imm5(self) -> u32 {
        let shift = self.esize.trailing_zeros();
        (u32::from(self.lane.unwrap_or(0)) << (shift + 1)) | (1 << shift)
    }
}

/// The lane width a `b`/`h`/`s`/`d` element letter names.
fn element_bytes(letter: &str) -> Option<u8> {
    match letter {
        "b" => Some(1),
        "h" => Some(2),
        "s" => Some(4),
        "d" => Some(8),
        _ => None,
    }
}

/// Read a vector operand, or None when the text is not one. The callers
/// sniff with this before committing to a SIMD encoding, so a spelling
/// that is not a vector operand has to answer None rather than an error.
pub(super) fn parse_vec_operand(s: &str) -> Option<VecReg> {
    let text = s.trim().to_ascii_lowercase();
    let (head, tail) = text.split_once('.')?;
    let idx: u8 = head.strip_prefix('v')?.parse().ok()?;
    if idx > 31 {
        return None;
    }
    if let Some((letter, rest)) = tail.split_once('[') {
        let esize = element_bytes(letter)?;
        let lane: u8 = rest.strip_suffix(']')?.trim().parse().ok()?;
        if u32::from(lane) >= 16 / u32::from(esize) {
            return None;
        }
        return Some(VecReg { idx, esize, q: true, lane: Some(lane) });
    }
    let (_, esize, q) = ARRANGEMENTS.iter().find(|(name, _, _)| *name == tail)?;
    Some(VecReg { idx, esize: *esize, q: *q, lane: None })
}

/// The same, with a diagnosis instead of None: for operands that can only
/// be vectors by the time we get here.
fn parse_vec_reg(s: &str, ln: usize) -> Result<VecReg, EmuError> {
    parse_vec_operand(s).ok_or_else(|| {
        asm_error(
            ln,
            &format!(
                "`{}` is not a vector operand: write a register and an arrangement \
                 (v3.16b, v3.4h, v3.2s, v3.2d) or one lane of one (v3.b[15])",
                s.trim()
            ),
        )
    })
}

/// A vector operand that names a whole register, not a lane.
pub(super) fn parse_vec_arrangement(s: &str, ln: usize) -> Result<VecReg, EmuError> {
    let reg = parse_vec_reg(s, ln)?;
    if reg.lane.is_some() {
        return asm_err(ln, &format!("`{}` names one lane; this operand takes a whole register", s.trim()));
    }
    Ok(reg)
}

/// A vector operand that names one lane.
pub(super) fn parse_vec_lane(s: &str, ln: usize) -> Result<(VecReg, u8), EmuError> {
    let reg = parse_vec_reg(s, ln)?;
    match reg.lane {
        Some(lane) => Ok((reg, lane)),
        None => asm_err(
            ln,
            &format!("`{}` names a whole register; this operand takes one lane (v3.b[15])", s.trim()),
        ),
    }
}

/// The `lsl #8` / `msl #16` tail of a vector immediate, as (bits, msl).
fn parse_vec_imm_shift(s: &str, ln: usize) -> Result<(u8, bool), EmuError> {
    let text = s.trim().to_ascii_lowercase();
    let (keyword, amount) = text
        .split_once(char::is_whitespace)
        .ok_or_else(|| asm_error(ln, &format!("`{}` is not a shift: write `lsl #8`", s.trim())))?;
    let msl = match keyword {
        "lsl" => false,
        "msl" => true,
        _ => return asm_err(ln, &format!("`{keyword}` is not a vector immediate shift: use lsl or msl")),
    };
    let amount = amount.trim().trim_start_matches('#').trim();
    let bits: u8 = amount
        .parse()
        .map_err(|_| asm_error(ln, &format!("`{amount}` is not a shift amount")))?;
    Ok((bits, msl))
}

// ---------------------------------------------------------------------------
// advanced simd encoders
// ---------------------------------------------------------------------------

/// MOVI / MVNI, and the ORR and BIC that take an immediate instead of a
/// third register. The destination's arrangement picks the element width,
/// the optional `lsl`/`msl` tail picks the shift, and `simd_imm_form`,
/// the same table the decoder reads, turns the three into a cmode, so
/// the two directions cannot drift apart.
pub(super) fn encode_simd_mod_imm(ops: &[&str], op: SimdImmOp, ln: usize) -> Result<u32, EmuError> {
    let name = match op {
        SimdImmOp::Movi => "movi",
        SimdImmOp::Mvni => "mvni",
        SimdImmOp::Orr => "orr",
        SimdImmOp::Bic => "bic",
        // FMOV's immediate is a float, so it is encoded by the fmov arm.
        SimdImmOp::Fmov => "fmov",
    };
    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(
            ln,
            &format!("{name} takes a vector, an immediate, and an optional shift ({name} v0.4s, #1, lsl #8)"),
        );
    }
    // `movi d3, #imm` is the one form that names a scalar register: a
    // 64-bit destination whose immediate is the byte mask.
    let scalar_d = parse_vec_operand(ops[0]).is_none();
    let dest = if scalar_d {
        let reg = parse_fp_register(ops[0], ln)?;
        if reg.width != FpWidth::D || op != SimdImmOp::Movi {
            return asm_err(ln, &format!("{name} takes a vector destination (v0.4s) or, for movi, a d register"));
        }
        VecReg { idx: reg.idx, esize: 8, q: false, lane: None }
    } else {
        parse_vec_arrangement(ops[0], ln)?
    };
    if dest.esize == 8 && !dest.q && !scalar_d {
        return asm_err(ln, &format!("{name} has no 1d form: use the d register spelling"));
    }
    let value = parse_immediate(ops[1], ln)? as u64;
    let (shift, msl) = match ops.len() {
        3 => parse_vec_imm_shift(ops[2], ln)?,
        _ => (0, false),
    };

    // The 64-bit element is a per-byte mask, so it carries its own imm8;
    // every other width takes imm8 straight from the operand.
    let imm8 = if dest.esize == 8 {
        let mut imm8 = 0u8;
        for byte in 0..8 {
            match (value >> (byte * 8)) & 0xff {
                0x00 => {}
                0xff => imm8 |= 1 << byte,
                _ => return asm_err(
                    ln,
                    &format!(
                        "{name} of a 64-bit element takes an immediate whose every byte is \
                         0x00 or 0xff, and {value:#x} has one that is neither"
                    ),
                ),
            }
        }
        imm8
    } else {
        // gcc writes a byte with its top bit set sign-extended to 64 bits
        // (0xffffffffffffffe0 for 0xe0), and GAS takes it as that byte.
        if !(-128..=255).contains(&(value as i64)) {
            return asm_err(
                ln,
                &format!(
                    "immediate value out of range -128 to 255 at operand 2 -- `{}'\n{name} \
                     puts one byte in each element, so the value must fit in 8 bits: -128 to 255",
                    gas_echo(name, &ops.join(","))
                ),
            );
        }
        value as u8
    };

    // The op bit is not simply "is this the inverting mnemonic": the
    // 64-bit MOVI sets it too. Search the shared table for the pair that
    // spells this mnemonic, element width and shift, and there is exactly
    // one of them or none at all.
    let wanted = SimdImmForm { op, esize: dest.esize, shift, msl };
    let pair = (0u8..16)
        .flat_map(|c| [(c, false), (c, true)])
        .find(|(c, op_bit)| simd_imm_form(*c, *op_bit) == Some(wanted));
    let Some((cmode, op_bit)) = pair else {
        return asm_err(
            ln,
            &format!("{name} has no form with a {}-bit element and that shift", u32::from(dest.esize) * 8),
        );
    };
    Ok(((dest.q as u32) << 30)
        | ((op_bit as u32) << 29)
        | (0x0F << 24)
        | ((u32::from(imm8) >> 5) << 16)
        | (u32::from(cmode) << 12)
        | (1 << 10)
        | ((u32::from(imm8) & 0x1F) << 5)
        | u32::from(dest.idx))
}

/// The copy group's word: 0 Q op 01110000 imm5 0 imm4 1 Rn Rd for a
/// vector destination, 01 0 11110000 imm5 0 0000 1 Rn Rd for the scalar
/// DUP the assembler also spells `mov b3, v7.b[15]`.
fn simd_copy_word(q: bool, op: bool, scalar: bool, imm5: u32, imm4: u32, rn: u8, rd: u8) -> u32 {
    let head = if scalar { 0x5E00_0000 } else { ((q as u32) << 30) | (0x0E << 24) };
    head | ((op as u32) << 29) | (imm5 << 16) | (imm4 << 11) | (1 << 10)
        | (u32::from(rn) << 5)
        | u32::from(rd)
}

/// DUP, all three shapes: a general register into every lane, one lane
/// into every lane, and one lane into a scalar register.
pub(super) fn encode_simd_dup(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "dup takes 2 operands: dup v0.4s, w1 or dup v0.4s, v1.s[2]");
    }
    // `dup b3, v7.b[15]` (which GAS prints as `mov`): a scalar
    // destination, so the element width comes from the source lane.
    if parse_vec_operand(ops[0]).is_none() {
        let dest = parse_fp_register(ops[0], ln)?;
        let (src, _) = parse_vec_lane(ops[1], ln)?;
        if u64::from(src.esize) != dest.width.bytes() {
            return asm_err(
                ln,
                &format!(
                    "dup into {}{} needs a {} lane",
                    dest.width.letter(),
                    dest.idx,
                    dest.width.letter()
                ),
            );
        }
        return Ok(simd_copy_word(false, false, true, src.imm5(), 0b0000, src.idx, dest.idx));
    }
    let dest = parse_vec_arrangement(ops[0], ln)?;
    if parse_vec_operand(ops[1]).is_some() {
        let (src, _) = parse_vec_lane(ops[1], ln)?;
        if src.esize != dest.esize {
            return asm_err(ln, "dup copies a lane into lanes of the same width");
        }
        return Ok(simd_copy_word(dest.q, false, false, src.imm5(), 0b0000, src.idx, dest.idx));
    }
    let (rn, sf) = parse_register(ops[1], ln)?;
    if sf != (dest.esize == 8) {
        return asm_err(
            ln,
            "dup fills 2d lanes from an x register and every narrower arrangement from a w register",
        );
    }
    Ok(simd_copy_word(dest.q, false, false, dest.imm5(), 0b0001, rn, dest.idx))
}

/// INS, both shapes: a general register into one lane, and one lane into
/// another. Both write a single lane of a 128-bit destination, so Q is
/// always set.
pub(super) fn encode_simd_ins(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "ins takes 2 operands: ins v0.s[1], w2 or ins v0.s[1], v3.s[0]");
    }
    let (dest, _) = parse_vec_lane(ops[0], ln)?;
    if parse_vec_operand(ops[1]).is_some() {
        let (src, lane) = parse_vec_lane(ops[1], ln)?;
        if src.esize != dest.esize {
            return asm_err(ln, "ins copies a lane into a lane of the same width");
        }
        let imm4 = u32::from(lane) << src.esize.trailing_zeros();
        return Ok(simd_copy_word(true, true, false, dest.imm5(), imm4, src.idx, dest.idx));
    }
    let (rn, sf) = parse_register(ops[1], ln)?;
    if sf != (dest.esize == 8) {
        return asm_err(
            ln,
            "ins writes a d lane from an x register and every narrower lane from a w register",
        );
    }
    Ok(simd_copy_word(true, false, false, dest.imm5(), 0b0011, rn, dest.idx))
}

/// UMOV and SMOV: one lane out into a general register, zero-extended or
/// sign-extended. The destination's width is the Q bit, and the pairs the
/// architecture allows differ between the two.
pub(super) fn encode_simd_lane_out(ops: &[&str], signed: bool, ln: usize) -> Result<u32, EmuError> {
    let name = if signed { "smov" } else { "umov" };
    if ops.len() != 2 {
        return asm_err(ln, &format!("{name} takes 2 operands: {name} w0, v1.b[3]"));
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (src, _) = parse_vec_lane(ops[1], ln)?;
    // UMOV reads a lane no wider than its destination and, being the
    // plain `mov` at the full width, only b/h/s into w and d into x.
    // SMOV has to leave room for the sign, so its widest lane is one
    // step below the destination.
    let allowed = if signed {
        if sf { src.esize <= 4 } else { src.esize <= 2 }
    } else if sf {
        src.esize == 8
    } else {
        src.esize <= 4
    };
    if !allowed {
        return asm_err(
            ln,
            &format!(
                "{name} cannot move a {}-bit lane into {}",
                u32::from(src.esize) * 8,
                if sf { "an x register" } else { "a w register" }
            ),
        );
    }
    let imm4 = if signed { 0b0101 } else { 0b0111 };
    Ok(simd_copy_word(sf, false, false, src.imm5(), imm4, src.idx, rd))
}

/// ZIP/UZP/TRN: `Vd.T, Vn.T, Vm.T`, one arrangement throughout.
pub(super) fn encode_simd_permute(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let Some((_, opcode)) = simd_permute_by_name(name) else {
        return asm_err(ln, &format!("`{name}` is not a permute"));
    };
    if ops.len() != 3 {
        return asm_err(ln, &format!("{name} takes three operands of one arrangement"));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    let m = parse_vec_arrangement(ops[2], ln)?;
    // No permute is spelled 1d: shuffling one 64-bit lane moves nothing.
    if n.esize != d.esize || m.esize != d.esize || n.q != d.q || m.q != d.q || (d.esize == 8 && !d.q)
    {
        return asm_err(ln, &format!("{name} takes three operands of the same arrangement"));
    }
    Ok(0x0E00_0000
        | ((d.q as u32) << 30)
        | (u32::from(size_field(d.esize)) << 22)
        | (u32::from(m.idx) << 16)
        | (u32::from(opcode) << 12)
        | (1 << 11)
        | (u32::from(n.idx) << 5)
        | u32::from(d.idx))
}

/// EXT: `Vd.T, Vn.T, Vm.T, #index`, byte lanes only. The window starts
/// `index` bytes into Vn:Vm, so it has to stay inside the concatenation.
pub(super) fn encode_simd_ext(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, "ext takes three 8b or 16b operands and a byte position (ext v0.8b, v1.8b, v2.8b, #3)");
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    let m = parse_vec_arrangement(ops[2], ln)?;
    if d.esize != 1 || n.esize != 1 || m.esize != 1 || n.q != d.q || m.q != d.q {
        return asm_err(ln, "ext takes three operands, all 8b or all 16b");
    }
    let bytes = i64::from(if d.q { 16 } else { 8 });
    let index = parse_immediate(ops[3], ln)?;
    if index < 0 || index >= bytes {
        return asm_err(ln, &format!("ext starts 0 to {} bytes into the pair, not #{index}", bytes - 1));
    }
    Ok(0x2E00_0000
        | ((d.q as u32) << 30)
        | (u32::from(m.idx) << 16)
        | ((index as u32) << 11)
        | (u32::from(n.idx) << 5)
        | u32::from(d.idx))
}

/// `{v7.16b}`, `{v7.16b, v8.16b}` or `{v7.16b-v10.16b}`: one to four
/// consecutive registers in braces, wrapping past v31. TBL's table and
/// the structure loads' register list are the same syntax, so they read
/// it here rather than twice. `suffix` is appended to every element
/// before it is parsed, which is how the single-structure forms hand it
/// the `[15]` that sits outside their braces. Answers the first
/// register (with the arrangement every element has to share) and how
/// many there are.
fn parse_vec_list(s: &str, suffix: &str, ln: usize) -> Result<(VecReg, u8), EmuError> {
    let text = s.trim();
    let inner = text
        .strip_prefix('{')
        .and_then(|body| body.strip_suffix('}'))
        .ok_or_else(|| {
            asm_error(ln, "a register list is a brace list of 1 to 4 registers ({v0.16b-v3.16b})")
        })?;
    let element = |part: &str| parse_vec_reg(&format!("{}{suffix}", part.trim()), ln);
    let registers: Vec<VecReg> = if let Some((first, last)) = inner.split_once('-') {
        let first = element(first)?;
        let last = element(last)?;
        if (last.esize, last.q, last.lane) != (first.esize, first.q, first.lane) {
            return asm_err(ln, "every register in a list carries the same arrangement");
        }
        let len = (u32::from(last.idx) + 32 - u32::from(first.idx)) % 32 + 1;
        (0..len)
            .map(|step| VecReg { idx: ((u32::from(first.idx) + step) % 32) as u8, ..first })
            .collect()
    } else {
        inner.split(',').map(element).collect::<Result<Vec<VecReg>, EmuError>>()?
    };
    if registers.is_empty() || registers.len() > 4 {
        return asm_err(ln, "a register list holds 1 to 4 registers");
    }
    let head = registers[0];
    if registers.iter().any(|reg| (reg.esize, reg.q, reg.lane) != (head.esize, head.q, head.lane)) {
        return asm_err(ln, "every register in a list carries the same arrangement");
    }
    if registers
        .windows(2)
        .any(|pair| (u32::from(pair[0].idx) + 1) % 32 != u32::from(pair[1].idx))
    {
        return asm_err(ln, "a register list's registers are consecutive, wrapping past v31");
    }
    Ok((head, registers.len() as u8))
}

/// TBL and TBX: `Vd.T, {table}, Vm.T`. The table is always 16b whatever
/// the destination is; TBX differs only in bit 12.
pub(super) fn encode_simd_table(extend: bool, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let name = if extend { "tbx" } else { "tbl" };
    if ops.len() != 3 {
        return asm_err(ln, &format!("{name} takes a destination, a brace list of 1 to 4 table registers, and an index vector"));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let m = parse_vec_arrangement(ops[2], ln)?;
    if d.esize != 1 || m.esize != 1 || m.q != d.q {
        return asm_err(ln, &format!("{name} takes 8b or 16b for both the destination and the index vector"));
    }
    let (table, len) = parse_vec_list(ops[1], "", ln)?;
    if table.lane.is_some() {
        return asm_err(ln, "a lookup table holds whole registers, not lanes");
    }
    if table.esize != 1 || !table.q {
        return asm_err(ln, "every register in a lookup table is spelled 16b");
    }
    let rn = table.idx;
    Ok(0x0E00_0000
        | ((d.q as u32) << 30)
        | (u32::from(m.idx) << 16)
        | (u32::from(len - 1) << 13)
        | ((extend as u32) << 12)
        | (u32::from(rn) << 5)
        | u32::from(d.idx))
}

/// LD1-LD4 / ST1-ST4: `{list}, [Xn]` with an optional post-index tail.
/// `name` is the lowercase mnemonic, whose digit is the interleave
/// factor and whose `r` suffix is the replicate form; everything else
/// about the word falls out of the shape of the register list. The
/// index packing of the single-structure forms comes from
/// `decoder::simd_struct_index_bits`, the same rule the decoder reads
/// the other way, so the two cannot drift.
pub(super) fn encode_simd_structure(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let load = name.starts_with("ld");
    let replicate = name.ends_with('r');
    let structures = name.as_bytes()[2] - b'0';

    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(
            ln,
            &format!(
                "{name} takes a brace list of registers, an address, and an optional \
                 post-index amount"
            ),
        );
    }

    // The single-structure forms put their lane index after the closing
    // brace (`{v3.b, v4.b}[15]`), so it is split off here and handed to
    // the list parser as a suffix on every element.
    let text = ops[0].trim();
    let (list_text, suffix) = match text.rfind('}') {
        Some(close) => {
            let (body, rest) = text.split_at(close + 1);
            (body.to_string(), rest.trim().to_string())
        }
        None => (text.to_string(), String::new()),
    };
    let (first, count) = parse_vec_list(&list_text, &suffix, ln)?;
    // A lane inside the braces is not a spelling GAS has: the index sits
    // after the closing brace and applies to the whole list, so
    // `{v3.b[3]}` has to be turned away rather than read as `{v3.b}[3]`.
    if suffix.is_empty() && first.lane.is_some() {
        return asm_err(
            ln,
            &format!("{name} spells the lane index after the list: `{{v3.b}}[3]`, not inside it"),
        );
    }

    // LD1 and ST1 are the only families whose list can hold more
    // registers than the mnemonic's digit: there is nothing to
    // interleave, so the registers are simply filled in turn.
    let many = structures == 1 && !replicate && first.lane.is_none();
    if !many && count != structures {
        return asm_err(
            ln,
            &format!(
                "{name} names {structures} register{} in its list",
                if structures == 1 { "" } else { "s" }
            ),
        );
    }

    let shape = if replicate {
        if first.lane.is_some() {
            return asm_err(ln, &format!("{name} replicates whole registers, not one lane"));
        }
        SimdStructShape::Replicate
    } else if let Some(index) = first.lane {
        SimdStructShape::Lane(index)
    } else {
        // A 1d register holds one element, so there is nothing for an
        // interleaving form to interleave.
        if first.esize == 8 && !first.q && structures > 1 {
            return asm_err(
                ln,
                &format!("{name} has no 1d form: only ld1 and st1 reach a one-element list"),
            );
        }
        SimdStructShape::Multiple
    };
    let esize = first.esize;
    let total = simd_struct_bytes(shape, count, esize, first.q);

    let address = ops[1].trim();
    let inner = address
        .strip_prefix('[')
        .and_then(|body| body.strip_suffix(']'))
        .ok_or_else(|| {
            asm_error(ln, &format!("{name} takes a bare address with no offset, `[x7]`"))
        })?;
    let (rn, base_is_64) = parse_register(inner, ln)?;
    if !base_is_64 {
        return asm_err(ln, &format!("{name}'s base register is a 64-bit register"));
    }

    let post = match ops.get(2) {
        None => None,
        // A register spelling is the register form; anything else is
        // read as the immediate. The sniff is on the spelling rather
        // than on a leading `#` because the hosted frontend folds a
        // constant expression down to a bare number before we see it.
        Some(tail) => match parse_register(tail.trim(), ln) {
            Ok((rm, true)) if rm != 31 => Some(rm),
            Ok(_) => {
                return asm_err(ln, &format!("{name}'s post-index register is x0 through x30"))
            }
            Err(_) => {
                let amount = parse_immediate(tail, ln)?;
                if amount < 0 || amount as u64 != total {
                    return asm_err(
                        ln,
                        &format!(
                            "{name} post-indexes by the bytes it moves, so this form \
                             writes back #{total}"
                        ),
                    );
                }
                // The immediate form spends Rm on the marker 31 rather
                // than on the amount, which is fixed by the shape.
                Some(31u8)
            }
        },
    };
    let rm = u32::from(post.unwrap_or(0));
    let writeback = u32::from(post.is_some());

    if let SimdStructShape::Multiple = shape {
        let &(opcode, _, _) = SIMD_STRUCT_MULTIPLE
            .iter()
            .find(|row| row.1 == structures && row.2 == count)
            .ok_or_else(|| asm_error(ln, &format!("{name} takes 1 to 4 registers")))?;
        return Ok(0x0C00_0000
            | ((first.q as u32) << 30)
            | (writeback << 23)
            | ((load as u32) << 22)
            | (rm << 16)
            | (u32::from(opcode) << 12)
            | (esize.trailing_zeros() << 10)
            | (u32::from(rn) << 5)
            | u32::from(first.idx));
    }

    let (q, s, size) = match shape {
        SimdStructShape::Lane(index) => simd_struct_index_bits(esize, index),
        _ => (first.q, false, esize.trailing_zeros() as u8),
    };
    // opcode<2:1> names the element width, 11 being the replicate rows;
    // opcode<0> and R carry the family number between them.
    let width_bits = match shape {
        SimdStructShape::Replicate => 0b11,
        _ => match esize {
            1 => 0b00,
            2 => 0b01,
            _ => 0b10,
        },
    };
    let opcode = (width_bits << 1) | ((structures - 1) >> 1);
    Ok(0x0D00_0000
        | ((q as u32) << 30)
        | (writeback << 23)
        | ((load as u32) << 22)
        | (u32::from((structures - 1) & 1) << 21)
        | (rm << 16)
        | (u32::from(opcode) << 13)
        | ((s as u32) << 12)
        | (u32::from(size) << 10)
        | (u32::from(rn) << 5)
        | u32::from(first.idx))
}

/// Across lanes: `Fd, Vn.T`, the whole source folded into one scalar.
/// `addp d3, v7.2d` is the SIMD-scalar pairwise class, same shape.
pub(super) fn encode_simd_across(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let row = simd_across_by_name(name).expect("the caller checked the table");
    let Some((rd, dest_esize)) = simd_scalar_operand(ops[0]) else {
        return asm_err(ln, &format!("{name} writes one b, h, s or d register"));
    };
    let n = parse_vec_arrangement(ops[1], ln)?;
    let expected = if row.widen { n.esize * 2 } else { n.esize };
    if dest_esize != expected {
        return asm_err(
            ln,
            &format!(
                "{name} folds a {} source into a {} register",
                arrangement_name(&n),
                element_letter(expected)
            ),
        );
    }
    // The group never folds a 64-bit arrangement of its wider lanes:
    // that would leave one or two elements, which is what the pairwise
    // forms are for.
    if !lane_allowed(row.lanes, n.esize) || (n.esize >= 4 && !n.q) {
        return asm_err(ln, &format!("{name} does not take the {} arrangement", arrangement_name(&n)));
    }
    let low = (1 << 21)
        | (1 << 20)
        | (u32::from(row.opcode) << 12)
        | (1 << 11)
        | (u32::from(n.idx) << 5)
        | u32::from(rd);
    Ok(simd_class_word(row.scalar_class, n.q, row.u, size_field(n.esize), low))
}

/// The arrangement suffix a parsed operand was written with, for a
/// diagnostic that quotes back what the line said.
pub(super) fn arrangement_name(reg: &VecReg) -> &'static str {
    ARRANGEMENTS
        .iter()
        .find(|(_, esize, q)| *esize == reg.esize && *q == reg.q)
        .map(|(name, _, _)| *name)
        .unwrap_or("vector")
}

/// The bitwise three-same group: AND, BIC, ORR, ORN, EOR, BSL, BIT and
/// BIF. The size field is the op selector here, not an element width, so
/// all eight take the byte arrangements alone.
pub(super) fn encode_simd_logical_reg(ops: &[&str], op: SimdLogicalOp, ln: usize) -> Result<u32, EmuError> {
    let name = simd_logical_name(op);
    let (_, u, size) = simd_logical_by_name(name).expect("every logical op has a row");
    if ops.len() != 3 {
        return asm_err(ln, &format!("the vector {name} takes 3 operands: {name} v0.16b, v1.16b, v2.16b"));
    }
    let rd = parse_vec_arrangement(ops[0], ln)?;
    let rn = parse_vec_arrangement(ops[1], ln)?;
    let rm = parse_vec_arrangement(ops[2], ln)?;
    if rd.esize != 1 || rn.esize != 1 || rm.esize != 1 || rn.q != rd.q || rm.q != rd.q {
        return asm_err(
            ln,
            &format!("the vector {name} takes three matching 8b or 16b operands"),
        );
    }
    let low = (1 << 21)
        | (u32::from(rm.idx) << 16)
        | (0b000111 << 10)
        | (u32::from(rn.idx) << 5)
        | u32::from(rd.idx);
    Ok(simd_class_word(false, rd.q, u, size, low))
}

/// The two vector readings of ORR and BIC: a modified immediate
/// (`orr v0.4s, #1, lsl #8`) and three registers (`orr v0.16b, v1.16b,
/// v2.16b`). Reached only when the first operand names an arrangement.
pub(super) fn encode_vector_logical(ops: &[&str], op: SimdImmOp, ln: usize) -> Result<u32, EmuError> {
    let second = ops.get(1).map(|s| s.trim()).unwrap_or("");
    if second.starts_with('#') || second.starts_with(|c: char| c.is_ascii_digit()) {
        return encode_simd_mod_imm(ops, op, ln);
    }
    let logical = if op == SimdImmOp::Bic { SimdLogicalOp::Bic } else { SimdLogicalOp::Orr };
    encode_simd_logical_reg(ops, logical, ln)
}

/// ORR: the general-register and bitmask-immediate forms, plus the two
/// vector ones. A first operand that names an arrangement is what tells
/// them apart.
pub(super) fn encode_orr(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.first().is_some_and(|o| parse_vec_operand(o).is_some()) {
        return encode_vector_logical(ops, SimdImmOp::Orr, ln);
    }
    encode_log_dispatch(ops, 0b01, ln)
}

/// FMOV between an x register and the UPPER 64-bit lane of a vector
/// register. It is the only FMOV that names a lane, and the only one
/// that leaves half of its destination alone.
pub(super) fn encode_fmov_lane(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let to_fp = parse_vec_operand(ops[0]).is_some();
    let (lane_text, gp_text) = if to_fp { (ops[0], ops[1]) } else { (ops[1], ops[0]) };
    let (lane_reg, lane) = parse_vec_lane(lane_text, ln)?;
    if lane_reg.esize != 8 || lane != 1 {
        return asm_err(
            ln,
            "fmov moves a general register to or from the upper 64-bit lane alone (v0.d[1])",
        );
    }
    let (gp, sf) = parse_register(gp_text, ln)?;
    if !sf {
        return asm_err(ln, "fmov pairs v0.d[1] with an x register");
    }
    // sf 0011110 10 1 01 opcode 000000 Rn Rd, opcode 111 in and 110 out.
    let opcode: u32 = if to_fp { 0b111 } else { 0b110 };
    let (rd, rn) = if to_fp { (lane_reg.idx, gp) } else { (gp, lane_reg.idx) };
    Ok(0x9EA8_0000 | (opcode << 16) | (u32::from(rn) << 5) | u32::from(rd))
}

/// The vector spellings of `mov`, each an alias for one of the encoders
/// above: lane to lane and register to lane are INS, lane out is UMOV,
/// lane into a scalar is DUP, and whole register to whole register is
/// ORR with the source named twice.
pub(super) fn encode_simd_mov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "the vector mov takes 2 operands");
    }
    let dest = parse_vec_operand(ops[0]);
    match dest {
        Some(d) if d.lane.is_some() => encode_simd_ins(ops, ln),
        Some(_) => encode_simd_logical_reg(&[ops[0], ops[1], ops[1]], SimdLogicalOp::Orr, ln),
        // A lane source with a non-vector destination: a general
        // register takes UMOV, a b/h/s/d scalar takes DUP.
        None if parse_register(ops[0], ln).is_ok() => encode_simd_lane_out(ops, false, ln),
        None => encode_simd_dup(ops, ln),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -- brace register lists --

    #[test]
    fn a_lane_inside_the_braces_is_refused() {
        // The list parser reads a whole vector operand per element, so a
        // lane spelling would parse; GAS has no such form. TBL's table is
        // whole registers, and the structure loads put the index AFTER
        // the closing brace, where it applies to the list as a whole.
        let labels: HashMap<String, u64> = HashMap::new();
        for (src, needle) in [
            ("tbl v0.8b, {v1.b[3]}, v2.8b", "whole registers, not lanes"),
            ("tbx v0.8b, {v1.b[0]-v2.b[0]}, v2.8b", "whole registers, not lanes"),
            ("ld1 {v3.b[3]}, [x7]", "after the list"),
            ("ld2 {v3.b[3], v4.b[3]}, [x7]", "after the list"),
        ] {
            let msg = match encode_line(src, 0, &labels, 1) {
                Err(EmuError::AssemblyError { message, .. }) => message,
                other => panic!("`{src}` must be refused, got {other:?}"),
            };
            assert!(msg.contains(needle), "`{src}`: message was: {msg}");
        }
        // The spellings they are confused with still assemble, to the
        // words csarm produced.
        for (src, want) in [
            ("tbl v0.8b, {v1.16b}, v2.8b", 0x0E02_0020u32),
            ("ld1 {v3.b}[3], [x7]", 0x0D40_0CE3),
            ("ld2 {v3.b, v4.b}[3], [x7]", 0x0D60_0CE3),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
    }
}
