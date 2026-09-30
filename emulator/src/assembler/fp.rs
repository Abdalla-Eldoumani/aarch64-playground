//! Scalar floating-point encoders, and the b/h/s/d/q register operand
//! they share with the SIMD&FP loads and stores: arithmetic, fused
//! multiply-add, FMOV, compares, conditional select, and the conversions
//! between widths and to and from integers.

use super::*;

/// The width a `b`/`h`/`s`/`d`/`q` register name spells. The SIMD&FP
/// register file is 128 bits wide and these five are its low
/// 8/16/32/64/128-bit views of the same 32 entries.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum FpWidth {
    B,
    H,
    S,
    D,
    Q,
}

impl FpWidth {
    pub(super) fn from_prefix(c: char) -> Option<Self> {
        match c.to_ascii_uppercase() {
            'B' => Some(FpWidth::B),
            'H' => Some(FpWidth::H),
            'S' => Some(FpWidth::S),
            'D' => Some(FpWidth::D),
            'Q' => Some(FpWidth::Q),
            _ => None,
        }
    }

    /// The register-name prefix, lowercase, as GAS spells it.
    pub(super) fn letter(self) -> char {
        match self {
            FpWidth::B => 'b',
            FpWidth::H => 'h',
            FpWidth::S => 's',
            FpWidth::D => 'd',
            FpWidth::Q => 'q',
        }
    }

    /// Access width in bytes; also the unsigned-offset scale.
    pub(super) fn bytes(self) -> u64 {
        match self {
            FpWidth::B => 1,
            FpWidth::H => 2,
            FpWidth::S => 4,
            FpWidth::D => 8,
            FpWidth::Q => 16,
        }
    }

    /// log2 of the access width: the one index-register scale amount a
    /// register-offset address may write, and what the S bit means.
    pub(super) fn scale_shift(self) -> u32 {
        self.bytes().trailing_zeros()
    }

    /// The `size` field (bits 31:30) of a SIMD&FP load/store. Q shares
    /// size 00 with B and is told apart by `opc_high`.
    pub(super) fn size_field(self) -> u32 {
        match self {
            FpWidth::B | FpWidth::Q => 0b00,
            FpWidth::H => 0b01,
            FpWidth::S => 0b10,
            FpWidth::D => 0b11,
        }
    }

    /// The high bit of `opc` (bit 23) in a SIMD&FP load/store: set only
    /// for the 128-bit Q form, which the two-bit size field cannot spell.
    pub(super) fn opc_high(self) -> u32 {
        if matches!(self, FpWidth::Q) { 1 } else { 0 }
    }

    /// The `opc` field (bits 31:30) of a SIMD&FP load/store PAIR: 00 for
    /// S, 01 for D, 10 for Q. B and H have no pair form.
    pub(super) fn pair_opc(self) -> Option<u32> {
        match self {
            FpWidth::S => Some(0b00),
            FpWidth::D => Some(0b01),
            FpWidth::Q => Some(0b10),
            FpWidth::B | FpWidth::H => None,
        }
    }
}

/// A parsed SIMD&FP register operand: which register, and which view of
/// it the spelling named.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct FpReg {
    pub(super) idx: u8,
    pub(super) width: FpWidth,
}

pub(super) fn parse_fp_register(s: &str, ln: usize) -> Result<FpReg, EmuError> {
    // Accept b0..b31, h0..h31, s0..s31, d0..d31 and q0..q31: the five
    // views of one 128-bit register file.
    let s = s.trim();
    let first = s.chars().next().ok_or_else(|| asm_error(ln, "empty register"))?;
    let Some(width) = FpWidth::from_prefix(first) else {
        return asm_err(
            ln,
            &format!(
                "expected a b, h, s, d or q register, or a v one with an \
                 arrangement (v3.16b), got: {s}"
            ),
        );
    };
    let idx: u8 = s[1..]
        .parse()
        .map_err(|_| asm_error(ln, &format!("bad FP register: {s}")))?;
    if idx > 31 {
        return asm_err(
            ln,
            &format!(
                "`{s}` is not a floating-point register: the SIMD&FP file runs 0 to 31, \
                 named b, h, s, d or q for its 8-, 16-, 32-, 64- and 128-bit views and \
                 v with an arrangement for the vector one"
            ),
        );
    }
    Ok(FpReg { idx, width })
}

/// The ftype field (bits 23:22) for a scalar FP width: 0b01 for D, 0b00
/// for S. Every scalar FP base opcode below is written in its S (ftype=00)
/// form and this adds the D bit back. B, H and Q have no ftype in that
/// space: scalar FP arithmetic is S and D only, and quietly encoding a
/// `q` operand as an S would compute the wrong answer.
fn fp_ftype(width: FpWidth, ln: usize) -> Result<u32, EmuError> {
    match width {
        FpWidth::S => Ok(0),
        FpWidth::D => Ok(0x0040_0000),
        other => asm_err(
            ln,
            &format!(
                "a {} register has no scalar floating-point form here: this \
                 instruction takes s or d registers",
                other.letter()
            ),
        ),
    }
}

/// All operands of one FP instruction must share a width; mixing S and D
/// silently computing in the wrong precision would be far worse than an
/// error, so name the mnemonic and both widths.
pub(super) fn require_same_fp_width(name: &str, widths: &[FpWidth], ln: usize) -> Result<FpWidth, EmuError> {
    let first = widths[0];
    if widths.iter().any(|w| *w != first) {
        return asm_err(
            ln,
            &format!(
                "{name} needs all S or all D registers (use fcvt to convert between widths)"
            ),
        );
    }
    Ok(first)
}

/// FMADD / FMSUB / FNMADD / FNMSUB Fd, Fn, Fm, Fa. `name` keys into
/// `FP_MUL_ADD_OPS`. The accumulator is the LAST operand and lands in
/// bits 14:10, which is what makes the operand order worth its own test.
pub(super) fn encode_fp_mul_add(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
    let Some((_, o1, o0, _)) = FP_MUL_ADD_OPS.iter().find(|(mn, _, _, _)| *mn == name) else {
        return asm_err(ln, &format!("unknown mnemonic `{name}`: {UNKNOWN_MNEMONIC_HINT}"));
    };
    if ops.len() != 4 {
        return asm_err(ln, &format!("{name} requires 4 operands: {name} fd, fn, fm, fa"));
    }
    let FpReg { idx: fd, width: wd } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln)?;
    let FpReg { idx: fm, width: wm } = parse_fp_register(ops[2], ln)?;
    let FpReg { idx: fa, width: wa } = parse_fp_register(ops[3], ln)?;
    let width = require_same_fp_width(name, &[wd, wn, wm, wa], ln)?;
    // 3-source: 0_0_0_11111_ftype_o1_Rm_o0_Ra_Rn_Rd
    Ok(0x1F00_0000
        | fp_ftype(width, ln)?
        | (u32::from(*o1) << 21)
        | ((fm as u32) << 16)
        | (u32::from(*o0) << 15)
        | ((fa as u32) << 10)
        | ((fn_ as u32) << 5)
        | (fd as u32))
}

/// FCSEL Fd, Fn, Fm, cond: the integer CSEL for the FP file. Bits 11:10
/// are 11, which is disjoint from the 2-source guard (10), FCMP (00) and
/// FCCMP (01), so the four classes share the encoding space cleanly.
pub(super) fn encode_fcsel(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, "fcsel requires 4 operands: fcsel fd, fn, fm, cond");
    }
    let FpReg { idx: fd, width: wd } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln)?;
    let FpReg { idx: fm, width: wm } = parse_fp_register(ops[2], ln)?;
    let width = require_same_fp_width("fcsel", &[wd, wn, wm], ln)?;
    let cond = parse_condition_allowing_nv(ops[3], ln)?;
    Ok(0x1E20_0C00
        | fp_ftype(width, ln)?
        | ((fm as u32) << 16)
        | ((cond as u32) << 12)
        | ((fn_ as u32) << 5)
        | (fd as u32))
}

/// `name` is both the display name in the diagnostics and the key into
/// `FP_BINARY_OPS`, so the dispatch arm names the operation once and the
/// opcode comes from the shared row rather than a number spelled beside it.
pub(super) fn encode_fp_binary(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
    let Some((_, opcode, _)) = FP_BINARY_OPS.iter().find(|(mn, _, _)| *mn == name) else {
        return asm_err(ln, &format!("unknown mnemonic `{name}`: {UNKNOWN_MNEMONIC_HINT}"));
    };
    let opcode = u32::from(*opcode);
    if ops.len() != 3 {
        return asm_err(ln, &format!("{name} requires 3 operands: {name} fd, fn, fm"));
    }
    let FpReg { idx: fd, width: wd } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln)?;
    let FpReg { idx: fm, width: wm } = parse_fp_register(ops[2], ln)?;
    let width = require_same_fp_width(name, &[wd, wn, wm], ln)?;
    // 2-source: 0_0_0_11110_ftype_1_Rm_opcode_10_Rn_Rd
    Ok(0x1E20_0800
        | fp_ftype(width, ln)?
        | ((fm as u32) << 16)
        | ((opcode & 0xF) << 12)
        | ((fn_ as u32) << 5)
        | (fd as u32))
}

pub(super) fn encode_fmov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fmov requires 2 operands");
    }
    // An arrangement in the destination and a float in the source is the
    // vector immediate; a lane anywhere else is the upper-lane move.
    if let Some(d) = parse_vec_operand(ops[0]).filter(|reg| reg.lane.is_none()) {
        let source = ops[1].trim();
        let literal = source.strip_prefix('#').unwrap_or(source);
        if literal
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_digit() || c == '-' || c == '+' || c == '.')
        {
            return encode_simd_fmov_imm(&d, literal, ln);
        }
    }
    if ops.iter().any(|o| parse_vec_operand(o).is_some()) {
        return encode_fmov_lane(ops, ln);
    }
    // General destination is the FP -> GP direction: `fmov x0, d0`,
    // `fmov w0, s0`. Raw bits move; no conversion.
    if let Ok((rd, sf)) = parse_register(ops[0], ln) {
        if ops[0].trim().eq_ignore_ascii_case("sp") {
            return asm_err(ln, "fmov cannot target sp");
        }
        let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln).map_err(|_| {
            asm_error(
                ln,
                &format!("fmov with a general destination takes an FP source, got: {}", ops[1]),
            )
        })?;
        return encode_fmov_general(rd, sf, wn, fn_, false, ln);
    }
    let FpReg { idx: fd, width: wd } = parse_fp_register(ops[0], ln)?;

    // Immediate form: `fmov d9, 9.0` / `fmov s0, 0.5` (course style, `#`
    // optional). The operand is anything that reads as a float literal
    // rather than a register. Only the 8-bit VFP immediates encode;
    // everything else points the student at the data-section fallback.
    let op2 = ops[1].trim();
    let imm_text = op2.strip_prefix('#').unwrap_or(op2);
    if !imm_text.is_empty()
        && imm_text
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_digit() || c == '-' || c == '+' || c == '.')
    {
        let value: f64 = imm_text.parse().map_err(|_| {
            asm_error(ln, &format!("cannot parse '{op2}' as an FMOV float immediate"))
        })?;
        // 256 candidates; exact bit match is the correctness test. Every
        // VFP immediate is exact in f32, so one f64 table serves S too.
        let imm8 = (0u16..=255)
            .map(|c| c as u8)
            .find(|&c| crate::decoder::expand_fmov_imm8(c) == value.to_bits());
        let Some(imm8) = imm8 else {
            let fallback = if wd == FpWidth::D { ".double" } else { ".float" };
            return asm_err(
                ln,
                &format!(
                    "{op2} does not fit the FMOV 8-bit float immediate; load it from a {fallback} instead"
                ),
            );
        };
        // FMOV Fd, #imm: 0_0_0_11110_ftype_1_imm8_100_00000_Rd
        return Ok(0x1E20_1000 | fp_ftype(wd, ln)? | ((imm8 as u32) << 13) | (fd as u32));
    }

    // General source is the GP -> FP direction: `fmov d0, x0`, `fmov s0, w0`.
    if let Ok((rn, sf)) = parse_register(ops[1], ln) {
        if ops[1].trim().eq_ignore_ascii_case("sp") {
            return asm_err(ln, "fmov cannot read sp");
        }
        return encode_fmov_general(rn, sf, wd, fd, true, ln);
    }

    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width("fmov", &[wd, wn], ln)?;
    // FMOV Fd, Fn: 0_0_0_11110_ftype_1_00000_010000_Rn_Rd
    Ok(0x1E20_4000 | fp_ftype(width, ln)? | ((fn_ as u32) << 5) | (fd as u32))
}

/// FMOV between the register files, either direction: raw bits, no
/// conversion. Only the matched-width pairs encode (`w<->s`, `x<->d`);
/// the layout is sf_0011110_ftype_1_00_opcode_000000_Rn_Rd with opcode
/// 111 for GP -> FP and 110 for FP -> GP.
fn encode_fmov_general(
    gp: u8,
    gp_is_x: bool,
    fp_width: FpWidth,
    fp: u8,
    to_fp: bool,
    ln: usize,
) -> Result<u32, EmuError> {
    let widths_match = (gp_is_x && fp_width == FpWidth::D)
        || (!gp_is_x && fp_width == FpWidth::S);
    if !widths_match {
        return asm_err(
            ln,
            "fmov pairs w with s and x with d (use fcvt to change the value's width)",
        );
    }
    let sf_bit = if gp_is_x { 1u32 } else { 0 };
    let opcode: u32 = if to_fp { 0b111 } else { 0b110 };
    let (rd, rn) = if to_fp { (fp, gp) } else { (gp, fp) };
    Ok((sf_bit << 31)
        | 0x1E20_0000
        | fp_ftype(fp_width, ln)?
        | (opcode << 16)
        | ((rn as u32) << 5)
        | (rd as u32))
}

/// Encode an FP data-processing 1-source op (`FNEG` / `FABS` / `FSQRT`
/// `Fd, Fn`). The row's opcode fills bits 20:15 of the 1-source layout:
/// 0_0_0_11110_ftype_1_opcode_10000_Rn_Rd.
/// Same shape as `encode_fp_binary`: `name` doubles as the display name and
/// the key into `FP_UNARY_OPS`.
pub(super) fn encode_fp_unary(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
    let Some((_, opcode, _)) = FP_UNARY_OPS.iter().find(|(mn, _, _)| *mn == name) else {
        return asm_err(ln, &format!("unknown mnemonic `{name}`: {UNKNOWN_MNEMONIC_HINT}"));
    };
    let opcode = u32::from(*opcode);
    if ops.len() != 2 {
        return asm_err(ln, &format!("{name} requires 2 operands: {name} fd, fn"));
    }
    let FpReg { idx: fd, width: wd } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width(name, &[wd, wn], ln)?;
    Ok(0x1E20_4000 | fp_ftype(width, ln)? | (opcode << 15) | ((fn_ as u32) << 5) | (fd as u32))
}

/// FCVT converts between the S and D views: `fcvt d0, s1` widens (exact),
/// `fcvt s0, d1` narrows (rounds). The ftype field names the SOURCE width
/// and the opcode's low bits name the destination width.
pub(super) fn encode_fcvt(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fcvt requires 2 operands: fcvt fd, fn");
    }
    let FpReg { idx: fd, width: wd } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln)?;
    if wd == wn {
        return asm_err(
            ln,
            "fcvt converts between widths: one operand must be an S register and the other a D register (use fmov to copy at the same width)",
        );
    }
    // 1-source with opcode 0b0001 followed by dest-type; ftype = source width.
    let opcode: u32 = if wd == FpWidth::D { 0b000101 } else { 0b000100 };
    Ok(0x1E20_4000 | fp_ftype(wn, ln)? | (opcode << 15) | ((fn_ as u32) << 5) | (fd as u32))
}

pub(super) fn encode_fcmp(ops: &[&str], signaling: bool, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fcmp/fcmpe requires 2 operands");
    }
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[0], ln)?;
    // `fcmp d0, #0.0` names no second register: opc bit 3 set, Rm zero.
    // GAS takes any spelling whose bits are zero (`0.00`, `0e0`, the hex
    // pattern `0x0`), so -0.0, with its sign bit set, is refused.
    let imm = ops[1].trim().trim_start_matches('#');
    let bits = match imm.strip_prefix("0x") {
        Some(hex) => u64::from_str_radix(hex, 16).ok(),
        None => imm.parse::<f64>().ok().map(f64::to_bits),
    };
    let (fm, zero) = if bits == Some(0) {
        (0, 0b01000)
    } else if imm.starts_with(|c: char| c.is_ascii_digit() || matches!(c, '-' | '+' | '.')) {
        let name = if signaling { "fcmpe" } else { "fcmp" };
        return asm_err(
            ln,
            &format!(
                "immediate zero expected at operand 2 -- `{}'\n{name} compares with a register \
                 or with zero only: put {imm} in another register with fmov and compare with that",
                gas_echo(name, &ops.join(","))
            ),
        );
    } else {
        let FpReg { idx, width: wm } = parse_fp_register(ops[1], ln)?;
        require_same_fp_width("fcmp", &[wn, wm], ln)?;
        (idx, 0)
    };
    // FCMP Fn, Fm: 0_0_0_11110_ftype_1_Rm_00_1000_Rn_0_0000; FCMPE sets
    // opc bit 4. The emulator raises no FP exceptions, so the two set the
    // same flags either way.
    let opc: u32 = if signaling { 0b10000 } else { 0 };
    Ok(0x1E20_2000 | fp_ftype(wn, ln)? | ((fm as u32) << 16) | ((fn_ as u32) << 5) | opc | zero)
}

/// FCCMP / FCCMPE Fn, Fm, #nzcv, cond: FCMP when cond holds, the literal
/// flags otherwise, as CCMP. Bits 11:10 are 01, FCSEL's neighbour.
pub(super) fn encode_fccmp(ops: &[&str], signaling: bool, ln: usize) -> Result<u32, EmuError> {
    let name = if signaling { "fccmpe" } else { "fccmp" };
    if ops.len() != 4 {
        return asm_err(ln, &format!("{name} requires 4 operands: {name} fn, fm, #nzcv, cond"));
    }
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: fm, width: wm } = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width(name, &[wn, wm], ln)?;
    let nzcv = parse_immediate(ops[2], ln)?;
    if !(0..=15).contains(&nzcv) {
        return asm_err(ln, &format!("{name} nzcv must be 0 to 15 (the four flag bits, N Z C V)"));
    }
    let cond = parse_condition_allowing_nv(ops[3], ln)?;
    Ok(0x1E20_0400
        | fp_ftype(width, ln)?
        | ((fm as u32) << 16)
        | ((cond as u32) << 12)
        | ((fn_ as u32) << 5)
        | ((signaling as u32) << 4)
        | (nzcv as u32))
}

/// SCVTF / UCVTF Fd, Rn, plus SCVTF's SIMD-scalar spelling. `name` keys
/// into `FP_FROM_INT_OPS`, the same table the decoder reads back.
pub(super) fn encode_fp_cvt_from_int(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
    let Some((_, rmode, opcode, _)) = FP_FROM_INT_OPS.iter().find(|(mn, _, _, _)| *mn == name)
    else {
        return asm_err(ln, &format!("unknown mnemonic `{name}`: {UNKNOWN_MNEMONIC_HINT}"));
    };
    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(
            ln,
            &format!("{name} requires 2 operands, or 3 with a fixed-point scale ({name} fd, rn, #fbits)"),
        );
    }
    let FpReg { idx: fd, width: wd } = parse_fp_register(ops[0], ln)?;
    // The source is a general register. An s or d source is the vector
    // family's SIMD-scalar form (the integer bits already sit in the FP
    // file, as they do after gcc's `ldr s31, [...]`), which the sniff
    // ahead of the dispatch has already routed away from here.
    if parse_fp_register(ops[1], ln).is_ok() {
        return asm_err(
            ln,
            &format!("{name} takes a general-register source ({name} fd, xn / {name} fd, wn)"),
        );
    }
    let (rn, sf) = parse_register(ops[1], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    let scale = fixed_point_scale(ops.get(2), sf, name, ln)?;
    // sf_0_0_11110_ftype_bit21_rmode_opcode_scale(6)_Rn_Rd, the same class
    // the float-to-integer direction uses. Bit 21 is 1 for the plain
    // integer form and 0 for the fixed-point one, whose scale field
    // replaces the zeros.
    Ok((sf_bit << 31)
        | 0x1E00_0000
        | fp_ftype(wd, ln)?
        | (if scale.is_some() { 0 } else { 1 << 21 })
        | (u32::from(*rmode) << 19)
        | (u32::from(*opcode) << 16)
        | (scale.unwrap_or(0) << 10)
        | ((rn as u32) << 5)
        | (fd as u32))
}

/// The `#fbits` operand shared by both directions of the conversion
/// class. `None` means the plain integer form; `Some(scale)` is the
/// field, which the architecture stores as 64 minus fbits. fbits runs
/// 1 to 32 against a W register and 1 to 64 against an X one, because
/// the fraction has to fit inside the integer operand.
fn fixed_point_scale(
    operand: Option<&&str>, sf: bool, name: &str, ln: usize,
) -> Result<Option<u32>, EmuError> {
    let Some(text) = operand else {
        return Ok(None);
    };
    let fbits = parse_immediate(text, ln)?;
    let max = if sf { 64 } else { 32 };
    if !(1..=max).contains(&fbits) {
        return asm_err(
            ln,
            &format!(
                "{name} takes a fixed-point scale of 1 to {max} for a {} register",
                if sf { "64-bit" } else { "32-bit" }
            ),
        );
    }
    Ok(Some(64 - fbits as u32))
}

/// FCVT{N,Z}{S,U} Rd, Fn. `name` is the key into `FP_TO_INT_OPS`, so the
/// dispatch arm names the operation once and the rmode/opcode pair comes
/// from the row the decoder reads back.
pub(super) fn encode_fp_cvt_int(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
    let Some((_, rmode, opcode, _)) = FP_TO_INT_OPS.iter().find(|(mn, _, _, _)| *mn == name)
    else {
        return asm_err(ln, &format!("unknown mnemonic `{name}`: {UNKNOWN_MNEMONIC_HINT}"));
    };
    if ops.len() != 2 && ops.len() != 3 {
        return asm_err(
            ln,
            &format!("{name} requires 2 operands, or 3 with a fixed-point scale ({name} rd, fn, #fbits)"),
        );
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[1], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    let scale = fixed_point_scale(ops.get(2), sf, name, ln)?;
    // sf_0_0_11110_ftype_bit21_rmode_opcode_scale(6)_Rn_Rd. Bit 21 is what
    // separates the integer form from the fixed-point one.
    Ok((sf_bit << 31)
        | 0x1E00_0000
        | fp_ftype(wn, ln)?
        | (if scale.is_some() { 0 } else { 1 << 21 })
        | (u32::from(*rmode) << 19)
        | (u32::from(*opcode) << 16)
        | (scale.unwrap_or(0) << 10)
        | ((fn_ as u32) << 5)
        | (rd as u32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::rejects;

    #[test]
    fn fcmpe_encodes_beside_fcmp_and_sets_the_same_flags() {
        use crate::cpu::Cpu;
        use crate::decoder::{decode, Instruction};
        let labels = HashMap::new();
        let plain = encode_line("fcmp d0, d1", 0, &labels, 1).unwrap();
        let signaling = encode_line("fcmpe d0, d1", 0, &labels, 1).unwrap();
        assert_eq!(plain | 0b10000, signaling);
        assert!(matches!(decode(signaling).unwrap(), Instruction::FpCompare { .. }));

        let source = r#"
            FMOV D0, #2.0
            FMOV D1, #5.0
            FCMPE D0, D1
            CSET X2, LT
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();
        assert_eq!(cpu.regs.read_gpr(2, true), 1, "2.0 < 5.0 through fcmpe");
    }

    #[test]
    fn fmov_general_forms_encode_and_round_trip() {
        use crate::decoder::{decode, Instruction};
        let labels = HashMap::new();
        let cases = [
            ("fmov s0, w1", 0x1E27_0020, true, false),
            ("fmov w1, s0", 0x1E26_0001, false, false),
            ("fmov d2, x3", 0x9E67_0062, true, true),
            ("fmov x3, d2", 0x9E66_0043, false, true),
        ];
        for (src, want, to_fp, is_double) in cases {
            let word = encode_line(src, 0, &labels, 1).unwrap();
            assert_eq!(word, want, "{src}");
            match decode(word).unwrap() {
                Instruction::FpMoveGeneral { to_fp: t, sf, single, .. } => {
                    assert_eq!(t, to_fp, "{src} direction");
                    assert_eq!(sf, is_double, "{src} sf");
                    assert_eq!(single, !is_double, "{src} width");
                }
                other => panic!("{src} decoded to {other:?}"),
            }
        }
    }

    #[test]
    fn fmov_general_rejects_mismatched_widths_and_sp() {
        let labels = HashMap::new();
        for src in ["fmov d0, w1", "fmov w1, d0", "fmov x1, s0", "fmov s0, x1"] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains("fcvt"), "{src}: {err}");
        }
        let err = encode_line("fmov sp, d0", 0, &labels, 1).unwrap_err().to_string();
        assert!(err.contains("sp"), "{err}");
    }

    #[test]
    fn fmov_moves_raw_bits_between_the_files() {
        use crate::cpu::Cpu;
        let source = r#"
            MOV X0, #0x4045
            LSL X0, X0, #48
            FMOV D1, X0
            FMOV X2, D1
            MOV W3, #0x3F80
            LSL W3, W3, #16
            FMOV S4, W3
            FMOV W5, S4
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();
        // 0x4045_0000_0000_0000 is 42.0 as an f64; the bits survive the
        // round trip and the D view reads as the float.
        assert_eq!(cpu.regs.read_gpr(2, true), 0x4045u64 << 48);
        assert_eq!(cpu.regs.read_fpr_f64(1), 42.0);
        // 0x3F80_0000 is 1.0f32; the S round trip stays 32-bit clean.
        assert_eq!(cpu.regs.read_gpr(5, true), 0x3F80_0000);
        assert_eq!(cpu.regs.read_fpr_bits(4), 0x3F80_0000);
    }

    // -- floating-point --

    #[test]
    fn fp_op_tables_round_trip_at_both_widths() {
        // One walk over both shared row tables, so no row goes without a
        // round trip.
        for (mnemonic, _, expected) in crate::decoder::FP_BINARY_OPS {
            for (letter, single) in [('d', false), ('s', true)] {
                let src = format!("{mnemonic} {letter}0, {letter}1, {letter}2");
                let word = assemble(&src).unwrap()[0];
                match crate::decoder::decode(word).unwrap() {
                    crate::decoder::Instruction::FpBinary { op, fd, fn_, fm, single: got } => {
                        assert_eq!(op, *expected, "{src}");
                        assert_eq!((fd, fn_, fm), (0, 1, 2), "{src}");
                        assert_eq!(got, single, "{src}: wrong width");
                    }
                    other => panic!("{src}: expected FpBinary, got {other:?}"),
                }
            }
        }
        for (mnemonic, _, expected) in crate::decoder::FP_UNARY_OPS {
            for (letter, single) in [('d', false), ('s', true)] {
                let src = format!("{mnemonic} {letter}9, {letter}8");
                let word = assemble(&src).unwrap()[0];
                match crate::decoder::decode(word).unwrap() {
                    crate::decoder::Instruction::FpUnary { op, fd, fn_, single: got } => {
                        assert_eq!(op, *expected, "{src}");
                        assert_eq!((fd, fn_), (9, 8), "{src}");
                        assert_eq!(got, single, "{src}: wrong width");
                    }
                    other => panic!("{src}: expected FpUnary, got {other:?}"),
                }
            }
        }
    }

    #[test]
    fn fnmul_negates_after_the_multiply_including_zero() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("fnmul d0, d1, d2", 0x1E62_8820u32),
            ("fnmul s0, s1, s2", 0x1E22_8820),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let source = r#"
            FMOV D1, 2.0
            FMOV D2, 3.0
            FNMUL D3, D1, D2
            FMOV D4, -2.0
            FNMUL D5, D4, D2
            FMOV D6, XZR
            FNMUL D8, D6, D2
            FMOV D9, -3.0
            FNMUL D10, D6, D9
            FMOV S11, 2.0
            FMOV S12, 3.0
            FNMUL S13, S11, S12
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        assert_eq!(cpu.regs.read_fpr_bits(3), 0xC018_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(5), 0x4018_0000_0000_0000);
        // The sign of a zero is the only thing that separates -(a*b) from
        // (-a)*b, so assert BITS, not the value.
        assert_eq!(cpu.regs.read_fpr_bits(8), 0x8000_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(10), 0x0000_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(13), 0xC0C0_0000);
    }

    #[test]
    fn fp_max_and_min_split_on_nan_and_signed_zero() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("fmax d0, d1, d2", 0x1E62_4820u32),
            ("fmin d0, d1, d2", 0x1E62_5820),
            ("fmaxnm d0, d1, d2", 0x1E62_6820),
            ("fminnm d0, d1, d2", 0x1E62_7820),
            ("fmax s0, s1, s2", 0x1E22_4820),
            ("fmin s0, s1, s2", 0x1E22_5820),
            ("fmaxnm s0, s1, s2", 0x1E22_6820),
            ("fminnm s0, s1, s2", 0x1E22_7820),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let source = r#"
            FMOV D1, 3.0
            FMOV D2, 5.0
            FMAX D3, D1, D2
            FMIN D4, D1, D2
            FMOV D20, 4.0
            FNEG D20, D20
            FSQRT D0, D20
            FMAX D5, D0, D2
            FMAXNM D6, D0, D2
            FMIN D7, D0, D2
            FMINNM D8, D0, D2
            FMAXNM D9, D2, D0
            FMINNM D10, D2, D0
            FMOV D11, XZR
            FNEG D12, D11
            FMAX D13, D11, D12
            FMIN D14, D11, D12
            FMAX D15, D12, D11
            FMIN D16, D12, D11
            FMAXNM D17, D11, D12
            FMINNM D18, D11, D12
            FMOV S21, 4.0
            FNEG S21, S21
            FSQRT S22, S21
            FMOV S23, 5.0
            FMAX S24, S22, S23
            FMAXNM S25, S22, S23
            FMIN S26, S22, S23
            FMINNM S27, S22, S23
            FMOV S28, WZR
            FNEG S29, S28
            FMAX S30, S28, S29
            FMIN S31, S28, S29
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        let bits = |r: u8| cpu.regs.read_fpr_bits(r);
        assert_eq!(bits(3), 0x4014_0000_0000_0000, "fmax of 3 and 5");
        assert_eq!(bits(4), 0x4008_0000_0000_0000, "fmin of 3 and 5");
        // The split: FMAX propagates the NaN, FMAXNM ignores it and takes
        // the number, in either operand order.
        assert_eq!(bits(5), 0x7FF8_0000_0000_0000);
        assert_eq!(bits(6), 0x4014_0000_0000_0000);
        assert_eq!(bits(7), 0x7FF8_0000_0000_0000);
        assert_eq!(bits(8), 0x4014_0000_0000_0000);
        assert_eq!(bits(9), 0x4014_0000_0000_0000);
        assert_eq!(bits(10), 0x4014_0000_0000_0000);
        // Negative zero compares less than positive zero, and the operand
        // order does not decide it: bits, never values, say so.
        assert_eq!(bits(13), 0x0000_0000_0000_0000);
        assert_eq!(bits(14), 0x8000_0000_0000_0000);
        assert_eq!(bits(15), 0x0000_0000_0000_0000);
        assert_eq!(bits(16), 0x8000_0000_0000_0000);
        assert_eq!(bits(17), 0x0000_0000_0000_0000);
        assert_eq!(bits(18), 0x8000_0000_0000_0000);
        // The S repeat: a 64-bit NaN here would mean the f64 arm ran.
        assert_eq!(bits(24), 0x7FC0_0000);
        assert_eq!(bits(25), 0x40A0_0000);
        assert_eq!(bits(26), 0x7FC0_0000);
        assert_eq!(bits(27), 0x40A0_0000);
        assert_eq!(bits(30), 0x0000_0000);
        assert_eq!(bits(31), 0x8000_0000);
    }

    #[test]
    fn fcsel_picks_the_first_source_when_the_condition_holds() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("fcsel d0, d1, d2, eq", 0x1E62_0C20u32),
            ("fcsel s0, s1, s2, ne", 0x1E22_1C20),
            ("fcsel d0, d1, d2, lt", 0x1E62_BC20),
            // GAS accepts AL and NV here, unlike cinc and its siblings.
            ("fcsel d0, d1, d2, al", 0x1E62_EC20),
            ("fcsel d0, d1, d2, nv", 0x1E62_FC20),
            ("fcsel s0, s1, s2, al", 0x1E22_EC20),
            ("fcsel s0, s1, s2, nv", 0x1E22_FC20),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let err = encode_line("fcsel d0, d1, s2, eq", 0, &labels, 1).unwrap_err().to_string();
        assert!(err.contains("all S or all D"), "{err}");
        let source = r#"
            FMOV D1, 1.5
            FMOV D2, 2.5
            MOV W0, #5
            CMP W0, #5
            FCSEL D3, D1, D2, EQ
            CMP W0, #4
            FCSEL D4, D1, D2, EQ
            CMP W0, #9
            FCSEL D5, D1, D2, LT
            CMP W0, #1
            FCSEL D6, D1, D2, LT
            FCSEL D13, D1, D2, AL
            FCSEL D14, D1, D2, NV
            MOVZ X2, #0x7FF8, LSL #48
            FMOV D8, X2
            CMP W0, #5
            FCSEL D9, D8, D2, EQ
            FMOV D10, XZR
            FNEG D11, D10
            FCSEL D12, D11, D2, EQ
            MOVZ X1, #0x3FC0, LSL #16
            MOVK X1, #0x5678, LSL #32
            MOVK X1, #0x1234, LSL #48
            FMOV D20, X1
            FMOV D21, XZR
            CMP W0, #1
            FCSEL S22, S20, S21, NE
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        let bits = |r: u8| cpu.regs.read_fpr_bits(r);
        assert_eq!(bits(3), 0x3FF8_0000_0000_0000, "eq holds: the first source");
        assert_eq!(bits(4), 0x4004_0000_0000_0000, "eq fails: the second");
        assert_eq!(bits(5), 0x3FF8_0000_0000_0000);
        assert_eq!(bits(6), 0x4004_0000_0000_0000);
        // AL and NV both run as always, so they take the first source
        // even with the flags left NE by the compare above.
        assert_eq!(bits(13), 0x3FF8_0000_0000_0000);
        assert_eq!(bits(14), 0x3FF8_0000_0000_0000);
        // The chosen source is copied, never compared: a NaN and a
        // negative zero arrive with their bits intact.
        assert_eq!(bits(9), 0x7FF8_0000_0000_0000);
        assert_eq!(bits(12), 0x8000_0000_0000_0000);
        // The S form keeps the low 32 bits only. The source carries a
        // nonzero upper half on purpose: a 64-bit copy answers
        // 0x1234_5678_3FC0_0000 here.
        assert_eq!(bits(22), 0x3FC0_0000);
    }

    #[test]
    fn fused_multiply_add_takes_the_accumulator_last() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("fmadd d0, d1, d2, d3", 0x1F42_0C20u32),
            ("fmsub d0, d1, d2, d3", 0x1F42_8C20),
            ("fnmadd d0, d1, d2, d3", 0x1F62_0C20),
            ("fnmsub d0, d1, d2, d3", 0x1F62_8C20),
            ("fmadd s0, s1, s2, s3", 0x1F02_0C20),
            ("fmsub s0, s1, s2, s3", 0x1F02_8C20),
            ("fnmadd s0, s1, s2, s3", 0x1F22_0C20),
            ("fnmsub s0, s1, s2, s3", 0x1F22_8C20),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        let source = r#"
            FMOV D1, 3.0
            FMOV D2, 4.0
            FMOV D3, 10.0
            FMADD D4, D1, D2, D3
            FMSUB D5, D1, D2, D3
            FNMADD D6, D1, D2, D3
            FNMSUB D7, D1, D2, D3
            FMOV D8, 2.0
            FMOV D9, 3.0
            FMOV D10, -6.0
            FMOV D11, 6.0
            FMADD D12, D8, D9, D10
            FMSUB D13, D8, D9, D11
            FNMADD D14, D8, D9, D10
            FNMSUB D15, D8, D9, D11
            FMOV S16, 3.0
            FMOV S17, 4.0
            FMOV S18, 10.0
            FMADD S19, S16, S17, S18
            FNMADD S20, S16, S17, S18
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        // d3 + d1*d2 = 22, NOT d1 + d2*d3 = 43 and NOT (d1+d2)*d3 = 70.
        assert_eq!(cpu.regs.read_fpr_bits(4), 0x4036_0000_0000_0000);
        // The sharp pair: Ra - Rn*Rm is -2, Rn*Rm - Ra is +2, and both
        // are plausible readings of "fmsub".
        assert_eq!(cpu.regs.read_fpr_bits(5), 0xC000_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(6), 0xC036_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(7), 0x4000_0000_0000_0000);
        // An exactly cancelling product is +0.0 on the hardware for all
        // four, including the two that negate the accumulator.
        for fd in [12u8, 13, 14, 15] {
            assert_eq!(cpu.regs.read_fpr_bits(fd), 0, "d{fd}");
        }
        assert_eq!(cpu.regs.read_fpr_bits(19), 0x41B0_0000);
        assert_eq!(cpu.regs.read_fpr_bits(20), 0xC1B0_0000);
    }

    #[test]
    fn fused_multiply_add_rounds_once() {
        use crate::cpu::Cpu;
        // csarm's fp_fusion probe: x = 1 + 2^-52, c = -(1 + 2^-51).
        // Fused, x*x + c is 2^-104 exactly; rounding the product first
        // gives +0.0. Any implementation spelled `n * m + a` prints the
        // second answer.
        let source = r#"
            MOVZ X0, #1
            MOVK X0, #0x3FF0, LSL #48
            FMOV D1, X0
            MOVZ X2, #2
            MOVK X2, #0xBFF0, LSL #48
            FMOV D3, X2
            FMADD D4, D1, D1, D3
            FMUL D5, D1, D1
            FADD D6, D5, D3
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        assert_eq!(cpu.regs.read_fpr_bits(4), 0x3970_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(6), 0x0000_0000_0000_0000);
    }

    #[test]
    fn assemble_all_fp_binaries_distinct() {
        let ops = ["FADD", "FSUB", "FMUL", "FDIV"];
        let mut words = Vec::new();
        for mn in ops {
            let src = format!("{mn} D0, D1, D2");
            words.push(assemble(&src).unwrap()[0]);
        }
        for i in 0..words.len() {
            for j in (i + 1)..words.len() {
                assert_ne!(words[i], words[j]);
            }
        }
    }

    #[test]
    fn assemble_fneg_distinct_from_fmov_and_fabs() {
        let fneg = assemble("FNEG D0, D1").unwrap()[0];
        let fmov = assemble("FMOV D0, D1").unwrap()[0];
        let fabs = assemble("FABS D0, D1").unwrap()[0];
        assert_ne!(fneg, fmov);
        assert_ne!(fabs, fmov);
        assert_ne!(fabs, fneg);
    }

    #[test]
    fn assemble_fsqrt_matches_the_word_gas_emits() {
        // aarch64-linux-gnu-as: fsqrt d0, d1 / fsqrt s0, s1.
        assert_eq!(assemble("fsqrt d0, d1").unwrap()[0], 0x1E61_C020);
        assert_eq!(assemble("fsqrt s0, s1").unwrap()[0], 0x1E21_C020);
    }

    #[test]
    fn assemble_fsqrt_distinct_from_the_other_fp_unaries() {
        let fsqrt = assemble("FSQRT D0, D1").unwrap()[0];
        let fneg = assemble("FNEG D0, D1").unwrap()[0];
        let fabs = assemble("FABS D0, D1").unwrap()[0];
        assert_ne!(fsqrt, fneg);
        assert_ne!(fsqrt, fabs);
    }

    #[test]
    fn assemble_fsqrt_rejects_mixed_widths() {
        let err = assemble("fsqrt d0, s1").unwrap_err().to_string();
        assert!(err.contains("fsqrt"), "the message should name fsqrt, got: {err}");
    }

    #[test]
    fn assemble_fmov_immediate_round_trips_course_values() {
        // The values course programs write: fmov dN, 1.0 / 2.0 / 5.0 / 9.0.
        let cases = [
            ("fmov d8, 1.0", 1.0f64),
            ("fmov d9, 2.0", 2.0),
            ("fmov d10, 5.0", 5.0),
            ("fmov d11, 9.0", 9.0),
            ("FMOV D0, #-1.0", -1.0),
            ("fmov d1, 0.5", 0.5),
        ];
        for (src, expected) in cases {
            let code = assemble(src).unwrap();
            match crate::decoder::decode(code[0]).unwrap() {
                crate::decoder::Instruction::FpMoveImm { imm_bits, single: false, .. } => {
                    assert_eq!(
                        f64::from_bits(imm_bits),
                        expected,
                        "wrong expansion for {src}"
                    );
                }
                other => panic!("expected FpMoveImm for {src}, got {other:?}"),
            }
        }
    }

    #[test]
    fn assemble_fmov_immediate_rejects_unencodable_values() {
        // 0.1 has no exact 8-bit float form; 100.0 is out of the 2^4 range;
        // 0.0 encodes as integer zero moves, not an FMOV immediate.
        rejects(assemble("fmov d0, 0.1"), "0.1 does not fit the FMOV 8-bit float immediate");
        rejects(assemble("fmov d0, 100.0"), "100.0 does not fit");
        rejects(assemble("fmov d0, 0.0"), "0.0 does not fit");
    }

    // -- single precision (S registers) --

    #[test]
    fn assemble_fadd_single_round_trips() {
        let code = assemble("fadd s1, s2, s3").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::FpBinary { op, fd, fn_, fm, single: true } => {
                assert_eq!(op, crate::decoder::FpBinOp::Fadd);
                assert_eq!((fd, fn_, fm), (1, 2, 3));
            }
            other => panic!("expected single FpBinary, got {other:?}"),
        }
        // Pin the exact word against the real assembler's output.
        assert_eq!(code[0], 0x1E23_2841);
    }

    #[test]
    fn assemble_rejects_mixed_fp_widths_with_a_clear_error() {
        let err = assemble("fadd s0, d1, s2").unwrap_err().to_string();
        assert!(err.contains("all S or all D"), "got: {err}");
        assert!(err.contains("fcvt"), "should point at fcvt: {err}");
        rejects(assemble("fmov s0, d1"), "use fcvt to convert between widths");
        rejects(assemble("fcmp s0, d1"), "use fcvt to convert between widths");
    }

    #[test]
    fn assemble_fcvt_widen_and_narrow() {
        // Words pinned against the real assembler: fcvt d0, s1 / fcvt s0, d1.
        let widen = assemble("fcvt d0, s1").unwrap();
        assert_eq!(widen[0], 0x1E22_C020);
        match crate::decoder::decode(widen[0]).unwrap() {
            crate::decoder::Instruction::FpCvt { fd, fn_, widen: true } => {
                assert_eq!((fd, fn_), (0, 1));
            }
            other => panic!("expected widening FpCvt, got {other:?}"),
        }
        let narrow = assemble("fcvt s0, d1").unwrap();
        assert_eq!(narrow[0], 0x1E62_4020);
        match crate::decoder::decode(narrow[0]).unwrap() {
            crate::decoder::Instruction::FpCvt { fd, fn_, widen: false } => {
                assert_eq!((fd, fn_), (0, 1));
            }
            other => panic!("expected narrowing FpCvt, got {other:?}"),
        }
    }

    #[test]
    fn assemble_fcvt_same_width_is_an_error_naming_the_fix() {
        let err = assemble("fcvt d0, d1").unwrap_err().to_string();
        assert!(err.contains("converts between widths"), "got: {err}");
        assert!(err.contains("fmov"), "should point at fmov: {err}");
    }

    #[test]
    fn fp_to_int_rounding_modes_encode_and_round_ties_to_even() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("fcvtns w0, d0", 0x1E60_0000u32),
            ("fcvtns x0, d0", 0x9E60_0000),
            ("fcvtns w0, s0", 0x1E20_0000),
            ("fcvtns x0, s0", 0x9E20_0000),
            ("fcvtnu w0, d0", 0x1E61_0000),
            ("fcvtnu x0, d0", 0x9E61_0000),
            ("fcvtnu w0, s0", 0x1E21_0000),
            ("fcvtzs w0, d0", 0x1E78_0000),
            ("fcvtzs x0, s0", 0x9E38_0000),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        // 2.5 and 3.5 separate ties-to-even from ties-away; -1.5 separates
        // it from truncation, and -2.5 from the unsigned saturation.
        let source = r#"
            FMOV D0, 2.5
            FCVTNS W1, D0
            FCVTZS W2, D0
            FMOV D3, -2.5
            FCVTNS W4, D3
            FCVTNU W5, D3
            FMOV D6, 3.5
            FCVTNS W7, D6
            FCVTZS W8, D6
            FCVTNU W9, D6
            FMOV D10, -1.5
            FCVTNS W11, D10
            FCVTZS W12, D10
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        assert_eq!(cpu.regs.read_gpr(1, false), 2);
        assert_eq!(cpu.regs.read_gpr(2, false), 2);
        assert_eq!(cpu.regs.read_gpr(4, false) as i32, -2);
        // a negative source saturates to zero, never to a wrapped pattern
        assert_eq!(cpu.regs.read_gpr(5, false), 0);
        assert_eq!(cpu.regs.read_gpr(7, false), 4);
        assert_eq!(cpu.regs.read_gpr(8, false), 3);
        assert_eq!(cpu.regs.read_gpr(9, false), 4);
        assert_eq!(cpu.regs.read_gpr(11, false) as i32, -2);
        assert_eq!(cpu.regs.read_gpr(12, false) as i32, -1);
    }

    #[test]
    fn fp_to_int_covers_every_rounding_mode() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("fcvtzu w0, d0", 0x1E79_0000u32),
            ("fcvtzu x0, s0", 0x9E39_0000),
            ("fcvtas w0, d0", 0x1E64_0000),
            ("fcvtas x0, s0", 0x9E24_0000),
            ("fcvtau w0, d0", 0x1E65_0000),
            ("fcvtms w0, d0", 0x1E70_0000),
            ("fcvtmu w0, d0", 0x1E71_0000),
            ("fcvtps w0, d0", 0x1E68_0000),
            ("fcvtpu w0, d0", 0x1E69_0000),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        // -0.5 is the value where the five modes disagree most, and it is
        // the one a copy-pasted arm gets wrong quietly: nearest gives 0,
        // ties-away and floor give -1, ceiling and truncate give 0.
        let source = r#"
            FMOV D0, 2.5
            FMOV D1, -2.5
            FMOV D2, 3.5
            FMOV D3, -0.5
            FMOV D4, -1.5
            FCVTNS W0, D0
            FCVTAS W1, D0
            FCVTMS W2, D0
            FCVTPS W3, D0
            FCVTZS W4, D0
            FCVTNS W5, D1
            FCVTAS W6, D1
            FCVTMS W7, D1
            FCVTPS W8, D1
            FCVTZS W9, D1
            FCVTNS W10, D2
            FCVTAS W11, D2
            FCVTMS W12, D2
            FCVTPS W13, D2
            FCVTZS W14, D2
            FCVTNS W15, D3
            FCVTAS W16, D3
            FCVTMS W17, D3
            FCVTPS W18, D3
            FCVTZS W19, D3
            FCVTNU W20, D0
            FCVTAU W21, D0
            FCVTMU W22, D0
            FCVTPU W23, D0
            FCVTZU W24, D0
            FCVTZU W25, D4
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        // Rows recorded on the course server, one per (value, mode) pair.
        //   value    ns   as   ms   ps   zs
        //    2.5      2    3    2    3    2
        //   -2.5     -2   -3   -3   -2   -2
        //    3.5      4    4    3    4    3
        //   -0.5      0   -1   -1    0    0
        let signed = [
            2i32, 3, 2, 3, 2, -2, -3, -3, -2, -2, 4, 4, 3, 4, 3, 0, -1, -1, 0, 0,
        ];
        for (reg, want) in signed.iter().enumerate() {
            assert_eq!(cpu.regs.read_gpr(reg as u8, false) as i32, *want, "w{reg}");
        }
        // The unsigned modes round the same way on a positive value.
        for (reg, want) in [(20u8, 2u64), (21, 3), (22, 2), (23, 3), (24, 2)] {
            assert_eq!(cpu.regs.read_gpr(reg, false), want, "w{reg}");
        }
        // A negative source saturates to zero rather than wrapping.
        assert_eq!(cpu.regs.read_gpr(25, false), 0);
    }

    #[test]
    fn ucvtf_reads_the_source_as_unsigned() {
        use crate::cpu::Cpu;
        let labels = HashMap::new();
        for (src, want) in [
            ("scvtf d0, x0", 0x9E62_0000u32),
            ("scvtf s0, w0", 0x1E22_0000),
            ("ucvtf d0, x0", 0x9E63_0000),
            ("ucvtf d0, w0", 0x1E63_0000),
            ("ucvtf s0, w0", 0x1E23_0000),
            ("ucvtf s0, x0", 0x9E23_0000),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        // Two FP registers is no longer this class at all: it is the
        // SIMD-scalar UCVTF, whose source is an integer already sitting
        // in the FP file.
        assert_eq!(encode_line("ucvtf s0, s1", 0, &labels, 1).unwrap(), 0x7E21_D820);
        let err = encode_line("ucvtf s0, q1", 0, &labels, 1).unwrap_err().to_string();
        assert!(err.contains("general-register source"), "{err}");
        let source = r#"
            MOV X0, #-1
            SCVTF D0, X0
            UCVTF D1, X0
            MOV W2, #-1
            SCVTF D2, W2
            UCVTF D3, W2
            UCVTF S4, W2
            UCVTF S5, X0
            MOVZ X6, #0x8000, LSL #48
            UCVTF D7, X6
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(40).unwrap();
        // -1 is the value at which signed and unsigned diverge maximally,
        // and it catches a copy of the SCVTF arm.
        assert_eq!(cpu.regs.read_fpr_bits(0), 0xBFF0_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(1), 0x43F0_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(2), 0xBFF0_0000_0000_0000);
        assert_eq!(cpu.regs.read_fpr_bits(3), 0x41EF_FFFF_FFE0_0000);
        // the S results round: 2^32 - 1 and 2^64 - 1 are not representable
        assert_eq!(cpu.regs.read_fpr_bits(4), 0x4F80_0000);
        assert_eq!(cpu.regs.read_fpr_bits(5), 0x5F80_0000);
        assert_eq!(cpu.regs.read_fpr_bits(7), 0x43E0_0000_0000_0000);
    }

    #[test]
    fn fixed_point_conversions_scale_by_two_to_the_fbits() {
        use crate::cpu::Cpu;
        use crate::decoder::{decode, FpFromIntOp, FpToIntOp, Instruction};
        let labels = HashMap::new();
        for (src, want) in [
            ("fcvtzs x1, s15, #2", 0x9E18_F9E1u32),
            ("fcvtzs w1, d0, #3", 0x1E58_F401),
            ("fcvtzu w1, d0, #3", 0x1E59_F401),
            ("scvtf d0, x1, #4", 0x9E42_F020),
            ("fcvtzs w0, d0, #32", 0x1E58_8000),
            ("fcvtzs x0, d0, #64", 0x9E58_0000),
            ("fcvtzs x0, d0, #2", 0x9E58_F800),
            ("fcvtzu x0, d0, #2", 0x9E59_F800),
            ("fcvtzu w0, s0, #5", 0x1E19_EC00),
            ("scvtf d0, w0, #2", 0x1E42_F800),
            ("ucvtf d0, x0, #4", 0x9E43_F000),
            ("ucvtf s0, w0, #6", 0x1E03_E800),
        ] {
            assert_eq!(encode_line(src, 0, &labels, 1).unwrap(), want, "{src}");
        }
        // The two forms must not collapse onto each other: the same
        // mnemonic decodes with fbits 3 here and fbits 0 below.
        match decode(0x1E58_F401).unwrap() {
            Instruction::FpToInt {
                op: FpToIntOp::Zs, rd: 1, fn_: 0, sf: false, single: false, fbits: 3,
            } => {}
            other => panic!("expected a fixed-point FpToInt, got {other:?}"),
        }
        match decode(0x1E78_0001).unwrap() {
            Instruction::FpToInt { fbits: 0, .. } => {}
            other => panic!("expected the integer FpToInt, got {other:?}"),
        }
        match decode(0x9E42_F020).unwrap() {
            Instruction::FpFromInt {
                op: FpFromIntOp::Scvtf, fd: 0, rn: 1, sf: true, single: false, fbits: 4,
            } => {}
            other => panic!("expected a fixed-point FpFromInt, got {other:?}"),
        }
        for src in ["fcvtzs w0, d0, #33", "fcvtzs x0, d0, #0", "fcvtzs x0, d0, #65"] {
            let err = encode_line(src, 0, &labels, 1).unwrap_err().to_string();
            assert!(err.contains("fixed-point scale"), "{src}: {err}");
        }
        let source = r#"
            FMOV D0, 1.5
            FCVTZS W1, D0, #2
            FCVTZS W2, D0
            FCVTZS W3, D0, #3
            FMOV D4, -1.5
            FCVTZS W5, D4, #2
            FCVTZU W6, D0, #2
            FCVTZU W7, D4, #2
            FCVTZS X8, D0, #2
            FMOV S9, 1.5
            FCVTZS X10, S9, #2
            FMOV D11, 0.5
            FCVTZS W12, D11, #32
            FCVTZS X13, D11, #64
            MOV X14, #6
            SCVTF D15, X14, #2
            SCVTF D16, X14
            MOV X17, #24
            SCVTF D18, X17, #4
            MOV X19, #-1
            UCVTF D20, X19, #4
            MOV W21, #-6
            SCVTF D22, W21, #2
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(60).unwrap();
        assert_eq!(cpu.regs.read_gpr(1, false), 6, "1.5 * 4, truncated");
        assert_eq!(cpu.regs.read_gpr(2, false), 1, "the integer form is unchanged");
        assert_eq!(cpu.regs.read_gpr(3, false), 12);
        assert_eq!(cpu.regs.read_gpr(5, false) as i32, -6);
        assert_eq!(cpu.regs.read_gpr(6, false), 6);
        assert_eq!(cpu.regs.read_gpr(7, false), 0, "negatives still saturate");
        assert_eq!(cpu.regs.read_gpr(8, true), 6);
        assert_eq!(cpu.regs.read_gpr(10, true), 6, "the S source form gcc emits");
        // The scale can push a small value past the destination width.
        assert_eq!(cpu.regs.read_gpr(12, false) as i32, i32::MAX);
        assert_eq!(cpu.regs.read_gpr(13, true) as i64, i64::MAX);
        assert_eq!(cpu.regs.read_fpr_bits(15), 0x3FF8_0000_0000_0000, "6 / 4");
        assert_eq!(cpu.regs.read_fpr_bits(16), 0x4018_0000_0000_0000, "6 with no scale");
        assert_eq!(cpu.regs.read_fpr_bits(18), 0x3FF8_0000_0000_0000, "24 / 16");
        assert_eq!(cpu.regs.read_fpr_bits(20), 0x43B0_0000_0000_0000, "(2^64 - 1) / 16");
        assert_eq!(cpu.regs.read_fpr_bits(22), 0xBFF8_0000_0000_0000, "-6 / 4");
    }

    #[test]
    fn assemble_scvtf_and_fcvtzs_single_round_trip() {
        // scvtf s0, w1 pinned against the real assembler.
        let scvtf = assemble("scvtf s0, w1").unwrap();
        assert_eq!(scvtf[0], 0x1E22_0020);
        match crate::decoder::decode(scvtf[0]).unwrap() {
            crate::decoder::Instruction::FpFromInt {
                op: crate::decoder::FpFromIntOp::Scvtf, fd, rn, sf: false, single: true,
                fbits: 0,
            } => {
                assert_eq!((fd, rn), (0, 1));
            }
            other => panic!("expected single FpFromInt, got {other:?}"),
        }
        let fcvtzs = assemble("fcvtzs w0, s1").unwrap();
        match crate::decoder::decode(fcvtzs[0]).unwrap() {
            crate::decoder::Instruction::FpToInt {
                op: crate::decoder::FpToIntOp::Zs, rd, fn_, sf: false, single: true,
                fbits: 0,
            } => {
                assert_eq!((rd, fn_), (0, 1));
            }
            other => panic!("expected single FpToInt, got {other:?}"),
        }
    }

    #[test]
    fn assemble_fmov_single_immediate_expands_to_f32_bits() {
        let code = assemble("fmov s2, 0.5").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::FpMoveImm { fd, imm_bits, single: true } => {
                assert_eq!(fd, 2);
                assert_eq!(imm_bits, (0.5f32).to_bits() as u64);
            }
            other => panic!("expected single FpMoveImm, got {other:?}"),
        }
    }

    #[test]
    fn assemble_fcmp_single_round_trips() {
        let code = assemble("fcmp s8, s9").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::FpCompare { fn_, fm, single: true } => {
                assert_eq!((fn_, fm), (8, 9));
            }
            other => panic!("expected single FpCompare, got {other:?}"),
        }
    }

    #[test]
    fn assemble_fmov_reg_reg() {
        let code = assemble("FMOV D3, D5").unwrap();
        let decoded = crate::decoder::decode(code[0]).unwrap();
        match decoded {
            crate::decoder::Instruction::FpMoveReg { fd, fn_, single: false } => {
                assert_eq!(fd, 3);
                assert_eq!(fn_, 5);
            }
            other => panic!("expected FpMoveReg, got {other:?}"),
        }
    }

    #[test]
    fn assemble_fcmp_and_scvtf_and_fcvtzs() {
        let cases = ["FCMP D0, D1", "SCVTF D0, X3", "FCVTZS X0, D3"];
        for src in cases {
            let code = assemble(src).unwrap();
            let decoded = crate::decoder::decode(code[0]).unwrap();
            match decoded {
                crate::decoder::Instruction::FpCompare { single: false, .. }
                | crate::decoder::Instruction::FpFromInt { single: false, .. }
                | crate::decoder::Instruction::FpToInt { single: false, .. } => {}
                other => panic!("unexpected decode for `{src}`: {other:?}"),
            }
        }
    }
}
