//! Advanced SIMD floating-point lane families (three-same, two-register
//! miscellaneous, across-lanes, by-element, the vector FMOV immediate),
//! and the operand check that tells them from the scalar FP forms.

use super::*;

// ---------------------------------------------------------------------------
// advanced simd: the floating-point lane families
// ---------------------------------------------------------------------------

/// The table key for a float mnemonic, and whether it carried the `2`
/// suffix. Only the three width-changing conversions have one.
fn simd_float_name(mn: &str) -> (String, bool) {
    let lower = mn.to_ascii_lowercase();
    if let Some(base) = lower.strip_suffix('2') {
        if matches!(base, "fcvtn" | "fcvtl" | "fcvtxn") {
            return (base.to_string(), true);
        }
    }
    (lower, false)
}

fn simd_float_known(name: &str) -> bool {
    simd_fp_same_by_name(name).is_some()
        || simd_fp_misc_by_name(name, false).is_some()
        || simd_fp_misc_by_name(name, true).is_some()
        || simd_fp_across_by_name(name, false).is_some()
        || simd_fp_across_by_name(name, true).is_some()
        || simd_fp_elem_by_name(name).is_some()
}

/// Whether the mnemonic has a SIMD-scalar form at all. The rows that do
/// not are exactly the ones scalar FP already spells in its own class,
/// which is what keeps `fadd s3, s7, s21` out of here.
fn simd_float_has_scalar_form(name: &str) -> bool {
    simd_fp_same_by_name(name).is_some_and(|row| row.scalar)
        || simd_fp_misc_by_name(name, false).is_some_and(|row| row.scalar)
        || simd_fp_misc_by_name(name, true).is_some_and(|row| row.scalar)
}

/// Whether a line can only be the float vector reading of its mnemonic.
/// A vector operand settles it outright; otherwise the SIMD-scalar forms
/// are the ones whose first two operands are both b/h/s/d registers,
/// which is what tells `fcvtzs s3, s7` from `fcvtzs w3, s7` and
/// `scvtf s3, s7` from `scvtf s3, w7`.
pub(super) fn is_simd_float_line(mn: &str, ops: &[&str]) -> bool {
    let (name, _) = simd_float_name(mn);
    if !simd_float_known(&name) {
        return false;
    }
    if ops.iter().any(|op| parse_vec_operand(op).is_some()) {
        return true;
    }
    simd_float_has_scalar_form(&name)
        && ops.len() >= 2
        && simd_scalar_operand(ops[0]).is_some()
        && simd_scalar_operand(ops[1]).is_some()
}

/// The header of the float classes: the top byte, U, the `a` opcode bit
/// at 23, and `sz` at 22 where the integer classes keep a size field.
fn simd_fp_class_word(scalar: bool, q: bool, u: bool, a: bool, esize: u8, low: u32) -> u32 {
    let base = if scalar { 0x5E00_0000 } else { 0x0E00_0000 | ((q as u32) << 30) };
    base | ((u as u32) << 29) | ((a as u32) << 23) | (((esize == 8) as u32) << 22) | low
}

/// The Advanced SIMD floating-point families. One entry point, because
/// the operands rather than the mnemonic decide the class: `fcmgt` with
/// three registers is three-same and with `#0.0` two-register misc, and
/// `fmaxp` takes three operands as three-same and two as the SIMD-scalar
/// pairwise fold.
pub(super) fn encode_simd_float(mn: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let (name, upper) = simd_float_name(mn);
    if ops.len() == 3
        && simd_fp_elem_by_name(&name).is_some()
        && parse_vec_operand(ops[2]).is_some_and(|reg| reg.lane.is_some())
    {
        return encode_simd_fp_by_element(&name, ops, ln);
    }
    match ops.len() {
        // A third operand that is a number is either the compare against
        // zero or the fixed-point conversion's fraction width.
        3 if simd_immediate(ops[2]) => {
            let zero = simd_fp_misc_by_name(&name, true).is_some();
            encode_simd_fp_two_misc(&name, ops, zero, upper, ln)
        }
        3 => encode_simd_fp_three_same(&name, ops, ln),
        2 if simd_fp_across_by_name(&name, false).is_some()
            || simd_fp_across_by_name(&name, true).is_some() =>
        {
            encode_simd_fp_across(&name, ops, ln)
        }
        2 => encode_simd_fp_two_misc(&name, ops, false, upper, ln),
        _ => asm_err(
            ln,
            &format!(
                "`{}` is a vector instruction here, and takes 2 or 3 operands \
                 ({} v0.2s, v1.2s) or their s/d scalar forms",
                mn.to_ascii_lowercase(),
                mn.to_ascii_lowercase()
            ),
        ),
    }
}

/// Float three-same: `Vd.T, Vn.T, Vm.T` over 2s, 4s or 2d, with the
/// SIMD-scalar `Fd, Fn, Fm` beside the rows that have one.
fn encode_simd_fp_three_same(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let Some(row) = simd_fp_same_by_name(name) else {
        return asm_err(ln, &format!("`{name}` does not take three operands"));
    };
    let low_bits = |rm: u8, rn: u8, rd: u8| {
        (1 << 21)
            | (u32::from(rm) << 16)
            | (u32::from(row.opcode) << 11)
            | (1 << 10)
            | (u32::from(rn) << 5)
            | u32::from(rd)
    };
    if let Some((rd, esize)) = simd_scalar_operand(ops[0]) {
        let Some((rn, en)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        let Some((rm, em)) = simd_scalar_operand(ops[2]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[2].trim()));
        };
        if !row.scalar || en != esize || em != esize || (esize != 4 && esize != 8) {
            return asm_err(
                ln,
                &format!("{name} has no scalar form of this width; its operands all take one"),
            );
        }
        return Ok(simd_fp_class_word(true, false, row.u, row.a, esize, low_bits(rm, rn, rd)));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    let m = parse_vec_arrangement(ops[2], ln)?;
    if n.esize != d.esize || m.esize != d.esize || n.q != d.q || m.q != d.q {
        return asm_err(ln, &format!("{name} takes three operands of the same arrangement"));
    }
    // Float lanes are 2s, 4s or 2d: a single 64-bit lane is the
    // SIMD-scalar form, written with a d register.
    if (d.esize != 4 && d.esize != 8) || (d.esize == 8 && !d.q) {
        return asm_err(
            ln,
            &format!("{name} does not take the {} arrangement", arrangement_name(&d)),
        );
    }
    Ok(simd_fp_class_word(
        false,
        d.q,
        row.u,
        row.a,
        d.esize,
        low_bits(m.idx, n.idx, d.idx),
    ))
}

/// Float two-register misc: `Vd.T, Vn.T`, the compares against `#0.0`,
/// the `#fbits` fixed-point conversions, and the width-changing FCVTN /
/// FCVTL / FCVTXN, whose `2` suffix is the Q bit.
fn encode_simd_fp_two_misc(
    name: &str,
    ops: &[&str],
    zero: bool,
    upper: bool,
    ln: usize,
) -> Result<u32, EmuError> {
    let Some(row) = simd_fp_misc_by_name(name, zero) else {
        return asm_err(ln, &format!("`{name}` has no form with these operands"));
    };
    if zero {
        let text = ops[2].trim().trim_start_matches('#').trim();
        if text.parse::<f64>().is_ok_and(|value| value != 0.0) || text.parse::<f64>().is_err() {
            return asm_err(ln, &format!("{name} compares against #0.0, nothing else"));
        }
    }
    // A third operand that is not `#0.0` is the fraction width, and only
    // the four conversions between a float and a fixed-point integer
    // have a form that takes one.
    let fbits = match (zero, ops.len()) {
        (true, 3) => None,
        (false, 2) => None,
        (false, 3) if row.fixed.is_some() => Some(ops[2]),
        _ => return asm_err(ln, &format!("{name} takes {} operands", if zero { 3 } else { 2 })),
    };
    let narrow = row.shape == SimdFpMiscShape::Narrow;
    if let Some((rd, dest)) = simd_scalar_operand(ops[0]) {
        let Some((rn, src)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        // A scalar rounding is an FP 1-source word (the FNEG class), not a
        // SIMD-scalar one.
        if let Some((opcode, _)) = crate::decoder::FP_ROUND_OPS.iter().find(|(_, op)| *op == row.op) {
            if dest != src || (dest != 4 && dest != 8) || fbits.is_some() {
                return asm_err(ln, &format!("{name} takes two s or two d registers"));
            }
            let ftype = u32::from(dest == 8);
            return Ok(0x1E20_4000 | (ftype << 22) | (u32::from(*opcode) << 15)
                | (u32::from(rn) << 5) | u32::from(rd));
        }
        // A narrowing convert reads a lane of twice what it writes.
        let esize = src;
        if !row.scalar
            || upper
            || dest != if narrow { esize / 2 } else { esize }
            || !lane_allowed(row.lanes, esize)
        {
            return asm_err(
                ln,
                &format!("{name} has no scalar form of this width; both operands take one"),
            );
        }
        return simd_fp_misc_finish(row, true, false, esize, rn, rd, fbits, ln);
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    // The `2` suffix IS the Q bit on the width-changing rows: it names
    // the half of the register the narrow side lives in.
    let (esize, q) = match row.shape {
        SimdFpMiscShape::Narrow => {
            if !n.q || d.esize != n.esize / 2 || d.q != upper {
                return asm_err(
                    ln,
                    &format!(
                        "{name} writes lanes of half the source's width, and the `2` \
                         suffix is what names the upper half of the destination"
                    ),
                );
            }
            (n.esize, upper)
        }
        SimdFpMiscShape::Long => {
            if !d.q || n.esize != d.esize / 2 || n.q != upper {
                return asm_err(
                    ln,
                    &format!(
                        "{name} writes lanes of twice the source's width, and the `2` \
                         suffix is what names the upper half of the source"
                    ),
                );
            }
            (d.esize, upper)
        }
        _ => {
            if upper || d.esize != n.esize || d.q != n.q || (d.esize == 8 && !d.q) {
                return asm_err(
                    ln,
                    &format!("{name} does not take the {} arrangement", arrangement_name(&n)),
                );
            }
            (d.esize, d.q)
        }
    };
    if !row.vector || !lane_allowed(row.lanes, esize) {
        return asm_err(
            ln,
            &format!("{name} does not take the {} arrangement", arrangement_name(&n)),
        );
    }
    simd_fp_misc_finish(row, false, q, esize, n.idx, d.idx, fbits, ln)
}

/// The word a float two-misc row makes, in whichever of its two
/// encodings the line spelled: the plain one, or the shift-immediate
/// class the `#fbits` conversions live in.
#[allow(clippy::too_many_arguments)] // one argument per encoding field
fn simd_fp_misc_finish(
    row: &SimdFpMiscRow,
    scalar: bool,
    q: bool,
    esize: u8,
    rn: u8,
    rd: u8,
    fbits: Option<&str>,
    ln: usize,
) -> Result<u32, EmuError> {
    let Some(text) = fbits else {
        let low = (1 << 21)
            | (u32::from(row.opcode) << 12)
            | (1 << 11)
            | (u32::from(rn) << 5)
            | u32::from(rd);
        return Ok(simd_fp_class_word(scalar, q, row.u, row.a, esize, low));
    };
    let opcode = row.fixed.expect("the caller checked the row has a fixed-point form");
    let amount = parse_immediate(text, ln)?;
    let bits = i64::from(esize) * 8;
    if amount < 1 || amount > bits {
        return asm_err(
            ln,
            &format!("{} takes a fraction width of 1 to {bits} for this lane", row.name),
        );
    }
    let field = u32::from(shift_imm_field(esize, amount as u8, true));
    let base = if scalar { 0x5F00_0000 } else { 0x0F00_0000 | ((q as u32) << 30) };
    Ok(base
        | ((row.u as u32) << 29)
        | (field << 16)
        | (u32::from(opcode) << 11)
        | (1 << 10)
        | (u32::from(rn) << 5)
        | u32::from(rd))
}

/// The float across-lanes fold (`fmaxv s3, v7.4s`) and the SIMD-scalar
/// pairwise class beside it (`faddp s3, v7.2s`), which shares the
/// encoding and differs only in bit 28.
fn encode_simd_fp_across(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let row = simd_fp_across_by_name(name, false)
        .or_else(|| simd_fp_across_by_name(name, true))
        .expect("the caller checked the table");
    let Some((rd, dest)) = simd_scalar_operand(ops[0]) else {
        return asm_err(ln, &format!("{name} writes one s or d register"));
    };
    let n = parse_vec_arrangement(ops[1], ln)?;
    if dest != n.esize || (n.esize != 4 && n.esize != 8) {
        return asm_err(
            ln,
            &format!("{name} folds a {} source into a matching register", arrangement_name(&n)),
        );
    }
    // The pairwise class folds exactly two lanes; the vector fold only
    // comes in the 128-bit single arrangement.
    let shaped = if row.scalar_class {
        (n.esize == 4 && !n.q) || (n.esize == 8 && n.q)
    } else {
        n.esize == 4 && n.q
    };
    if !shaped {
        return asm_err(
            ln,
            &format!("{name} does not take the {} arrangement", arrangement_name(&n)),
        );
    }
    let low = (1 << 21)
        | (1 << 20)
        | (u32::from(row.opcode) << 12)
        | (1 << 11)
        | (u32::from(n.idx) << 5)
        | u32::from(rd);
    Ok(simd_fp_class_word(row.scalar_class, n.q, row.u, row.a, n.esize, low))
}

/// The float by-element multiplies: `Vd.T, Vn.T, Vm.Ts[index]` and the
/// SIMD-scalar `Fd, Fn, Vm.Ts[index]`. An s element packs its index into
/// H:L and a d element, which has only two lanes, into H alone.
fn encode_simd_fp_by_element(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let row = simd_fp_elem_by_name(name).expect("the caller checked the table");
    let (m, index) = parse_vec_lane(ops[2], ln)?;
    let esize = m.esize;
    if esize != 4 && esize != 8 {
        return asm_err(
            ln,
            &format!("{name} indexes an s or a d element, not {}", element_letter(esize)),
        );
    }
    let (rm4, l, mbit, h) = simd_elem_bits(esize, m.idx, index);
    if let Some((rd, dest)) = simd_scalar_operand(ops[0]) {
        let Some((rn, src)) = simd_scalar_operand(ops[1]) else {
            return asm_err(ln, &format!("`{}` is not a scalar register", ops[1].trim()));
        };
        if dest != esize || src != esize {
            return asm_err(ln, &format!("{name} has no scalar form of this width"));
        }
        return Ok(simd_elem_word(true, false, row.u, esize, rm4, l, mbit, h, row.opcode, rn, rd));
    }
    let d = parse_vec_arrangement(ops[0], ln)?;
    let n = parse_vec_arrangement(ops[1], ln)?;
    if d.esize != esize || n.esize != esize || d.q != n.q || (esize == 8 && !d.q) {
        return asm_err(
            ln,
            &format!(
                "{name} does not take these arrangements with a {} element",
                element_letter(esize)
            ),
        );
    }
    Ok(simd_elem_word(false, d.q, row.u, esize, rm4, l, mbit, h, row.opcode, n.idx, d.idx))
}

/// FMOV (vector, immediate): cmode 1111, whose imm8 is the same 8-bit
/// VFP float the scalar `fmov s0, #1.0` carries, replicated across the
/// arrangement's lanes. `op` picks the 64-bit lane, so 2d is the only
/// arrangement it comes in.
pub(super) fn encode_simd_fmov_imm(d: &VecReg, literal: &str, ln: usize) -> Result<u32, EmuError> {
    if (d.esize != 4 && d.esize != 8) || (d.esize == 8 && !d.q) {
        return asm_err(ln, "the vector fmov immediate takes 2s, 4s or 2d");
    }
    let value: f64 = literal
        .parse()
        .map_err(|_| asm_error(ln, &format!("cannot parse '{literal}' as an FMOV float immediate")))?;
    let Some(imm8) = (0u16..=255)
        .map(|c| c as u8)
        .find(|&c| crate::decoder::expand_fmov_imm8(c) == value.to_bits())
    else {
        return asm_err(
            ln,
            &format!(
                "{literal} does not fit the FMOV 8-bit float immediate; \
                 build the vector from a .float or .double instead"
            ),
        );
    };
    Ok(0x0F00_0400
        | ((d.q as u32) << 30)
        | (((d.esize == 8) as u32) << 29)
        | ((u32::from(imm8) >> 5) << 16)
        | (0b1111 << 12)
        | ((u32::from(imm8) & 0x1f) << 5)
        | u32::from(d.idx))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scvtf_converts_integer_bits_already_in_the_fp_register() {
        use crate::cpu::Cpu;
        use crate::decoder::{decode, Instruction, SimdFpMiscOp};
        let labels = HashMap::new();
        let s_form = encode_line("scvtf s30, s31", 0, &labels, 1).unwrap();
        assert_eq!(s_form, 0x5E21_DBFE);
        assert!(matches!(
            decode(s_form).unwrap(),
            Instruction::SimdFpTwoMisc {
                op: SimdFpMiscOp::Scvtf,
                esize: 4,
                scalar: true,
                fbits: 0,
                rn: 31,
                rd: 30,
                ..
            }
        ));
        let d_form = encode_line("scvtf d1, d2", 0, &labels, 1).unwrap();
        assert!(matches!(
            decode(d_form).unwrap(),
            Instruction::SimdFpTwoMisc {
                op: SimdFpMiscOp::Scvtf,
                esize: 8,
                scalar: true,
                fbits: 0,
                rn: 2,
                rd: 1,
                ..
            }
        ));

        // 7 as integer bits in s31 becomes 7.0f32 in s30.
        let source = r#"
            MOV W0, #7
            FMOV S31, W0
            SCVTF S30, S31
            FMOV W1, S30
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();
        assert_eq!(cpu.regs.read_gpr(1, true), u64::from(7.0f32.to_bits()));
    }
}
