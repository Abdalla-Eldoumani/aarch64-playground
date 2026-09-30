//! Advanced SIMD integer lane families (three-same, two-register
//! miscellaneous, three-different, shift by immediate, by-element), and
//! the operand check that tells a vector line from a general-register one.

use super::*;

// ---------------------------------------------------------------------------
// advanced simd: the integer lane families
// ---------------------------------------------------------------------------

/// A b/h/s/d register operand as the SIMD-scalar forms spell their
/// operands, answered as (register, lane bytes). `q` is not one of them:
/// no integer lane form names the whole 128 bits without an arrangement.
pub(super) fn simd_scalar_operand(s: &str) -> Option<(u8, u8)> {
    let text = s.trim();
    let esize = match FpWidth::from_prefix(text.chars().next()?)? {
        FpWidth::B => 1,
        FpWidth::H => 2,
        FpWidth::S => 4,
        FpWidth::D => 8,
        FpWidth::Q => return None,
    };
    let idx: u8 = text[1..].parse().ok()?;
    if idx > 31 {
        return None;
    }
    Some((idx, esize))
}

/// Whether a line can only be the integer vector reading of its
/// mnemonic. ADD, SUB, MUL, AND, EOR, ORN, MVN, NEG, CLS, CLZ, RBIT,
/// REV16 and REV32 each name a general-register instruction as well, and
/// only the operands tell the two apart: a first operand naming an
/// arrangement (`v3.16b`) or a b/h/s/d register can be nothing else. The
/// sniff sits ahead of the dispatch so those arms stay one line each.
pub(super) fn is_simd_integer_line(mn: &str, ops: &[&str]) -> bool {
    // ORR, BIC and MOV keep their own sniffs: those have to reach the
    // vector immediates and the lane moves, which are other classes.
    if matches!(mn, "ORR" | "BIC" | "MOV") {
        return false;
    }
    let (name, _) = simd_integer_name(mn);
    let known = simd_logical_by_name(&name).is_some()
        || simd_same_by_name(&name).is_some()
        || simd_misc_by_name(&name, false).is_some()
        || simd_misc_by_name(&name, true).is_some()
        || simd_across_by_name(&name).is_some()
        || simd_diff_by_name(&name).is_some()
        || simd_shift_by_name(&name).is_some()
        || is_extend_long_alias(&name);
    known
        && ops
            .first()
            .is_some_and(|op| parse_vec_operand(op).is_some() || simd_scalar_operand(op).is_some())
}

/// Whether a vector instruction's last operand is an immediate. GAS
/// takes it with or without `#`, and gcc writes vector shifts without
/// one (`shl v0.4s, v1.4s, 3`).
pub(super) fn simd_immediate(op: &str) -> bool {
    let op = op.trim();
    op.starts_with('#') || op.starts_with(|c: char| c.is_ascii_digit())
}

/// SXTL and UXTL: how GAS spells the lengthening shift by #0, and how it
/// prints that word back.
fn is_extend_long_alias(name: &str) -> bool {
    matches!(name, "sxtl" | "uxtl")
}

/// The table key for a mnemonic, and whether it carried the `2` suffix.
/// GAS takes `not` for the vector MVN and prints MVN back, so the two
/// spellings share one row. A trailing `2` is only a suffix on a
/// mnemonic whose class has an upper-half form: `rev32` keeps its name.
fn simd_integer_name(mn: &str) -> (String, bool) {
    let lower = mn.to_ascii_lowercase();
    if lower == "not" {
        return ("mvn".to_string(), false);
    }
    if let Some(base) = lower.strip_suffix('2') {
        if simd_takes_upper_half(base) {
            return (base.to_string(), true);
        }
    }
    (lower, false)
}

/// Whether a mnemonic has a `2` spelling at all: the rows whose narrow
/// operands can sit in the upper half of their register.
fn simd_takes_upper_half(name: &str) -> bool {
    is_extend_long_alias(name)
        || simd_diff_by_name(name).is_some()
        || simd_misc_by_name(name, false)
            .is_some_and(|row| matches!(row.shape, SimdMiscShape::Narrow | SimdMiscShape::Shll))
        || simd_shift_by_name(name).is_some_and(|row| row.shape != SimdShiftShape::Same)
}

/// The common header of the three classes: the top byte, U, and the size
/// field. `low` carries bits 21:0, which is where the classes differ.
pub(super) fn simd_class_word(scalar: bool, q: bool, u: bool, size: u8, low: u32) -> u32 {
    let base = if scalar { 0x5E00_0000 } else { 0x0E00_0000 | ((q as u32) << 30) };
    base | ((u as u32) << 29) | (u32::from(size) << 22) | low
}

/// The Advanced SIMD integer families. One entry point, because the
/// operands rather than the mnemonic decide which class a line is in:
/// `cmgt v3.8b, v7.8b, v21.8b` is three-same and `cmgt v3.8b, v7.8b, #0`
/// two-register misc, and `addp` is three-same with three operands and
/// the SIMD-scalar pairwise form with two.
pub(super) fn encode_simd_integer(mn: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let (name, upper) = simd_integer_name(mn);
    if let Some((op, _, _)) = simd_logical_by_name(&name) {
        return encode_simd_logical_reg(ops, op, ln);
    }
    match ops.len() {
        // A lane in the last operand is the by-element class, an
        // encoding of its own that every one of these mnemonics also
        // has a whole-register form of.
        3 if simd_elem_by_name(&name).is_some()
            && parse_vec_operand(ops[2]).is_some_and(|reg| reg.lane.is_some()) =>
        {
            encode_simd_by_element(&name, ops, upper, ln)
        }
        // A third operand that is a number is one of three different
        // things: the compare against zero, SHLL's fixed shift by the lane
        // width, or a shift by immediate.
        3 if simd_immediate(ops[2]) => {
            if simd_misc_by_name(&name, true).is_some() {
                encode_simd_two_misc(&name, ops, true, upper, ln)
            } else if let Some(row) = simd_shift_by_name(&name) {
                encode_simd_shift_imm(row, ops, upper, Some(ops[2]), ln)
            } else {
                encode_simd_two_misc(&name, ops, false, upper, ln)
            }
        }
        3 if simd_diff_by_name(&name).is_some() => encode_simd_three_diff(&name, ops, upper, ln),
        3 => encode_simd_three_same(&name, ops, ln),
        2 if is_extend_long_alias(&name) => {
            let long = if name == "sxtl" { "sshll" } else { "ushll" };
            let row = simd_shift_by_name(long).expect("the lengthening shift has a row");
            encode_simd_shift_imm(row, ops, upper, None, ln)
        }
        2 if simd_across_by_name(&name).is_some() => encode_simd_across(&name, ops, ln),
        2 => encode_simd_two_misc(&name, ops, false, upper, ln),
        _ => asm_err(
            ln,
            &format!(
                "`{}` is a vector instruction here, and takes 2 or 3 operands \
                 ({} v0.8b, v1.8b) or their b/h/s/d scalar forms",
                mn.to_ascii_lowercase(),
                mn.to_ascii_lowercase()
            ),
        ),
    }
}

/// Three-same: `Vd.T, Vn.T, Vm.T`, with the SIMD-scalar `Fd, Fn, Fm`
/// beside it. Every operand has the same shape, which is what names the
/// size field.
fn encode_simd_three_same(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let Some(row) = simd_same_by_name(name) else {
        return asm_err(ln, &format!("`{name}` does not take three operands"));
    };
    if let Some((rd, esize)) = simd_scalar_operand(ops[0]) {
        let Some((rn, en)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        let Some((rm, em)) = simd_scalar_operand(ops[2]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[2].trim()));
        };
        if en != esize || em != esize || !lane_allowed(row.scalar, esize) {
            return asm_err(
                ln,
                &format!("{name} has no scalar form of this width; its operands all take one"),
            );
        }
        let low = (1 << 21)
            | (u32::from(rm) << 16)
            | (u32::from(row.opcode) << 11)
            | (1 << 10)
            | (u32::from(rn) << 5)
            | u32::from(rd);
        return Ok(simd_class_word(true, false, row.u, size_field(esize), low));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    let m = parse_vec_arrangement(ops[2], ln)?;
    if n.esize != d.esize || m.esize != d.esize || n.q != d.q || m.q != d.q {
        return asm_err(ln, &format!("{name} takes three operands of the same arrangement"));
    }
    // No three-same form is spelled 1d: a single 64-bit lane is the
    // SIMD-scalar form, written with a d register.
    if !lane_allowed(row.lanes, d.esize) || (d.esize == 8 && !d.q) {
        return asm_err(ln, &format!("{name} does not take the {} arrangement", arrangement_name(&d)));
    }
    let low = (1 << 21)
        | (u32::from(m.idx) << 16)
        | (u32::from(row.opcode) << 11)
        | (1 << 10)
        | (u32::from(n.idx) << 5)
        | u32::from(d.idx);
    Ok(simd_class_word(false, d.q, row.u, size_field(d.esize), low))
}

/// Two-register misc: `Vd.T, Vn.T`, the compares against zero
/// (`Vd.T, Vn.T, #0`), and the pairwise widening adds, whose destination
/// holds half as many lanes of twice the width.
fn encode_simd_two_misc(
    name: &str,
    ops: &[&str],
    zero: bool,
    upper: bool,
    ln: usize,
) -> Result<u32, EmuError> {
    let Some(row) = simd_misc_by_name(name, zero) else {
        return asm_err(
            ln,
            &format!("`{name}` has no form with these operands"),
        );
    };
    if zero && ops[2].trim().trim_start_matches('#').trim() != "0" {
        return asm_err(ln, &format!("{name} compares against #0, nothing else"));
    }
    let narrowing = row.shape == SimdMiscShape::Narrow;
    let shll = row.shape == SimdMiscShape::Shll;
    if shll != (ops.len() == 3 && !zero) {
        return asm_err(
            ln,
            &format!("{name} takes {} operands", if shll { 3 } else { 2 }),
        );
    }
    if let Some((rd, esize)) = simd_scalar_operand(ops[0]) {
        let Some((rn, en)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        // A narrowing extract reads a lane of twice what it writes.
        let expected = if narrowing { esize * 2 } else { esize };
        if en != expected || upper || !lane_allowed(row.scalar, esize) {
            return asm_err(
                ln,
                &format!("{name} has no scalar form of this width; both operands take one"),
            );
        }
        let low = (1 << 21)
            | (u32::from(row.opcode) << 12)
            | (1 << 11)
            | (u32::from(rn) << 5)
            | u32::from(rd);
        return Ok(simd_class_word(true, false, row.u, size_field(esize), low));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    // The narrow side is the one the size field names, and Q is which
    // half of the register it sits in: exactly what the `2` suffix says.
    let (narrow, wide) = match row.shape {
        SimdMiscShape::Narrow => (&d, &n),
        SimdMiscShape::Shll => (&n, &d),
        _ => (&n, &n),
    };
    if narrowing || shll {
        if wide.esize != narrow.esize * 2 || !wide.q || narrow.q != upper {
            return asm_err(
                ln,
                &format!(
                    "{name} writes lanes of {} the source's width, and the `2` suffix \
                     is what names the upper half",
                    if narrowing { "half" } else { "twice" }
                ),
            );
        }
        if shll {
            let want = u32::from(narrow.esize) * 8;
            let amount = parse_immediate(ops[2], ln)?;
            if amount != i64::from(want) {
                return asm_err(ln, &format!("{name} shifts by exactly #{want} for this arrangement"));
            }
        }
    } else {
        let widen = row.shape == SimdMiscShape::Widen;
        let dest_esize = if widen { n.esize * 2 } else { n.esize };
        if d.esize != dest_esize || d.q != n.q {
            return asm_err(
                ln,
                &format!(
                    "{name} writes {} lanes for a {} source",
                    if widen { "twice as wide" } else { "matching" },
                    arrangement_name(&n)
                ),
            );
        }
        if !widen && n.esize == 8 && !n.q {
            return asm_err(ln, &format!("{name} does not take the {} arrangement", arrangement_name(&n)));
        }
    }
    if !lane_allowed(row.lanes, narrow.esize) {
        return asm_err(ln, &format!("{name} does not take the {} arrangement", arrangement_name(&n)));
    }
    // A row that fixes its own size field says so: RBIT is spelled in
    // byte lanes but encodes size 01.
    let size = row.size.unwrap_or_else(|| size_field(narrow.esize));
    let low = (1 << 21)
        | (u32::from(row.opcode) << 12)
        | (1 << 11)
        | (u32::from(n.idx) << 5)
        | u32::from(d.idx);
    Ok(simd_class_word(false, narrow.q, row.u, size, low))
}

/// Three-different: `Vd.<2T>, Vn.T, Vm.T` and the wide and narrowing
/// shapes beside it, with the SIMD-scalar `Fd, Fn, Fm` of the doubling
/// multiplies. The size field names the NARROW width and Q is the `2`
/// suffix, which selects the upper half of whichever operands are narrow.
fn encode_simd_three_diff(name: &str, ops: &[&str], upper: bool, ln: usize) -> Result<u32, EmuError> {
    let row = simd_diff_by_name(name).expect("the caller checked the table");
    if let Some((rd, dest_esize)) = simd_scalar_operand(ops[0]) {
        let Some((rn, en)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        let Some((rm, em)) = simd_scalar_operand(ops[2]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[2].trim()));
        };
        if upper || em != en || dest_esize != en * 2 || !lane_allowed(row.scalar, en) {
            return asm_err(
                ln,
                &format!("{name} has no scalar form of this width; it writes twice what it reads"),
            );
        }
        let low = (1 << 21)
            | (u32::from(rm) << 16)
            | (u32::from(row.opcode) << 12)
            | (u32::from(rn) << 5)
            | u32::from(rd);
        return Ok(simd_class_word(true, false, row.u, size_field(en), low));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    let m = parse_vec_arrangement(ops[2], ln)?;
    // Which operands are narrow is the shape; the narrow ones carry Q.
    let (narrow, wide): (&VecReg, &VecReg) = match row.shape {
        SimdDiffShape::Long => (&n, &d),
        SimdDiffShape::Wide => (&m, &d),
        SimdDiffShape::Narrow => (&d, &n),
    };
    let shaped = match row.shape {
        SimdDiffShape::Long => n.esize == m.esize && n.q == m.q && d.q,
        SimdDiffShape::Wide => n.esize == d.esize && n.q == d.q && d.q,
        SimdDiffShape::Narrow => n.esize == m.esize && n.q == m.q && n.q,
    };
    if !shaped || wide.esize != narrow.esize * 2 || narrow.q != upper {
        return asm_err(
            ln,
            &format!(
                "{name} pairs a {} arrangement with lanes of twice that width, and the \
                 `2` suffix is what names the upper half of the narrow operands",
                arrangement_name(narrow)
            ),
        );
    }
    if !lane_allowed(row.lanes, narrow.esize) {
        return asm_err(ln, &format!("{name} does not take the {} arrangement", arrangement_name(narrow)));
    }
    let low = (1 << 21)
        | (u32::from(m.idx) << 16)
        | (u32::from(row.opcode) << 12)
        | (u32::from(n.idx) << 5)
        | u32::from(d.idx);
    Ok(simd_class_word(false, narrow.q, row.u, size_field(narrow.esize), low))
}

/// The class header of the shift-by-immediate group. It sits one bit
/// above the three-register classes (bits 28:24 are 01111, not 01110)
/// and has no size field: immh:immb carries both the lane width and the
/// amount, which is why `simd_class_word` cannot serve it.
fn simd_shift_word(scalar: bool, q: bool, u: bool, low: u32) -> u32 {
    let base = if scalar { 0x5F00_0000 } else { 0x0F00_0000 | ((q as u32) << 30) };
    base | ((u as u32) << 29) | low
}

/// Shift by immediate: `Vd.T, Vn.T, #shift`, the lengthening
/// `Vd.<2T>, Vn.T, #shift` and the narrowing `Vd.T, Vn.<2T>, #shift`,
/// with the SIMD-scalar forms beside them. `amount` is None for the SXTL
/// and UXTL spellings, which are the lengthening shift by zero.
fn encode_simd_shift_imm(
    row: &SimdShiftRow,
    ops: &[&str],
    upper: bool,
    amount: Option<&str>,
    ln: usize,
) -> Result<u32, EmuError> {
    let name = row.name;
    let shift = match amount {
        None => 0i64,
        Some(text) => parse_immediate(text, ln)?,
    };
    let (esize, q, scalar, rn, rd) = if let Some((rd, dest)) = simd_scalar_operand(ops[0]) {
        let Some((rn, src)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        let expected = if row.shape == SimdShiftShape::Narrow { dest * 2 } else { dest };
        if upper || src != expected || !lane_allowed(row.scalar, dest) {
            return asm_err(
                ln,
                &format!("{name} has no scalar form of this width"),
            );
        }
        (dest, false, true, rn, rd)
    } else {
        let d = parse_vec_arrangement(ops[0], ln)?;
        let n = parse_vec_arrangement(ops[1], ln)?;
        let (narrow, wide): (&VecReg, &VecReg) = match row.shape {
            SimdShiftShape::Same => (&d, &d),
            SimdShiftShape::Long => (&n, &d),
            SimdShiftShape::Narrow => (&d, &n),
        };
        let shaped = match row.shape {
            SimdShiftShape::Same => {
                // No shift is spelled 1d: a single 64-bit lane is the
                // SIMD-scalar form, written with a d register.
                let one_d = d.esize == 8 && !d.q;
                d.esize == n.esize && d.q == n.q && !upper && !one_d
            }
            _ => wide.esize == narrow.esize * 2 && wide.q && narrow.q == upper,
        };
        if !shaped {
            return asm_err(
                ln,
                &format!("{name} does not take these arrangements together"),
            );
        }
        (narrow.esize, narrow.q, false, n.idx, d.idx)
    };
    if !lane_allowed(row.lanes, esize) {
        return asm_err(ln, &format!("{name} does not take a {}-bit lane", u32::from(esize) * 8));
    }
    // A left shift can clear the lane and a right shift can fill it with
    // the sign, so the two ranges are off by one from each other.
    let bits = i64::from(u32::from(esize) * 8);
    let ok = if row.right { shift >= 1 && shift <= bits } else { shift >= 0 && shift < bits };
    if !ok {
        return asm_err(
            ln,
            &format!(
                "{name} shifts by {} for a {bits}-bit lane, not #{shift}",
                if row.right { format!("1 to {bits}") } else { format!("0 to {}", bits - 1) }
            ),
        );
    }
    let field = shift_imm_field(esize, shift as u8, row.right);
    let low = (u32::from(field) << 16)
        | (u32::from(row.opcode) << 11)
        | (1 << 10)
        | (u32::from(rn) << 5)
        | u32::from(rd);
    Ok(simd_shift_word(scalar, q, row.u, low))
}

/// The class header of the by-element group. Like the shift group it
/// sits at bits 28:24 = 01111, and bit 10 clear is what tells the two
/// apart. `l`, `m` and `h` are the three index bits.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
pub(super) fn simd_elem_word(
    scalar: bool,
    q: bool,
    u: bool,
    esize: u8,
    rm4: u8,
    l: u8,
    m: u8,
    h: u8,
    opcode: u8,
    rn: u8,
    rd: u8,
) -> u32 {
    let base = if scalar { 0x5F00_0000 } else { 0x0F00_0000 | ((q as u32) << 30) };
    base | ((u as u32) << 29)
        | (u32::from(size_field(esize)) << 22)
        | (u32::from(l) << 21)
        | (u32::from(m) << 20)
        | (u32::from(rm4) << 16)
        | (u32::from(opcode) << 12)
        | (u32::from(h) << 11)
        | (u32::from(rn) << 5)
        | u32::from(rd)
}

/// The by-element multiplies: `Vd, Vn, Vm.Ts[index]`. A lane in the LAST
/// operand is the only thing that separates these from the three-same
/// and three-different rows they share a mnemonic with.
fn encode_simd_by_element(
    name: &str,
    ops: &[&str],
    upper: bool,
    ln: usize,
) -> Result<u32, EmuError> {
    let row = simd_elem_by_name(name).expect("the caller checked the table");
    let (m, index) = parse_vec_lane(ops[2], ln)?;
    let esize = m.esize;
    if !lane_allowed(row.lanes, esize) {
        return asm_err(
            ln,
            &format!("{name} indexes an h or an s element, not {}", element_letter(esize)),
        );
    }
    // An h element spends the M bit as the index's low bit, which leaves
    // Rm four bits wide: v16 and up have nowhere to go.
    if esize == 2 && m.idx > 15 {
        return asm_err(
            ln,
            &format!("{name} reads an h element out of v0..v15; the index needs the bit v{} would use", m.idx),
        );
    }
    let long = matches!(row.kind, SimdElemKind::Long(_));
    let (rm4, l, mbit, h) = simd_elem_bits(esize, m.idx, index);
    if let Some((rd, dest)) = simd_scalar_operand(ops[0]) {
        let Some((rn, src)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        let expected = if long { esize * 2 } else { esize };
        if !row.scalar || upper || src != esize || dest != expected {
            return asm_err(ln, &format!("{name} has no scalar form of this width"));
        }
        return Ok(simd_elem_word(true, false, row.u, esize, rm4, l, mbit, h, row.opcode, rn, rd));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    // The long rows write lanes of twice the source width and spell the
    // upper half of the source with the `2` suffix; the rest keep one
    // arrangement throughout and have no `2` spelling at all.
    let shaped = if long {
        n.esize == esize && d.esize == esize * 2 && d.q && n.q == upper
    } else {
        !upper && n.esize == esize && d.esize == esize && n.q == d.q
    };
    if !shaped {
        return asm_err(
            ln,
            &format!("{name} does not take these arrangements with a {} element", element_letter(esize)),
        );
    }
    let q = if long { upper } else { d.q };
    Ok(simd_elem_word(false, q, row.u, esize, rm4, l, mbit, h, row.opcode, n.idx, d.idx))
}
