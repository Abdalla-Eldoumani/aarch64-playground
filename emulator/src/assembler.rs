use std::collections::HashMap;

use crate::errors::EmuError;
use crate::registers::CONDITIONS;

/// Assemble ARM64 source text into a vector of 32-bit instruction words.
///
/// Runs m4 expansion first so `define(fp, x29)` and `name = expr` aliases
/// from cpsc 355 source expand before the single-pass encoder sees them.
/// The expansion is line-aligned with the input, so encoder errors still
/// carry the original (pre-expansion) line number. Expression-level
/// numeric substitutions in operands still need the full new pipeline --
/// that integration lands once the linker can encode from token slices.
pub fn assemble(source: &str) -> Result<Vec<u32>, EmuError> {
    let expanded = crate::frontend::m4::expand(source)?;
    assemble_expanded(&expanded.text)
}

/// Pre-m4 entry point used by tests that want to exercise the raw encoder
/// without feeding the source through expansion.
pub fn assemble_expanded(source: &str) -> Result<Vec<u32>, EmuError> {
    let lines = preprocess(source);

    // pass 1: collect labels
    let mut labels: HashMap<String, u64> = HashMap::new();
    let mut instr_count: u64 = 0;
    for (line_num, line) in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let (label, rest) = split_label(trimmed);
        if let Some(label) = label {
            let name = label.to_lowercase();
            if name.is_empty() {
                return asm_err(*line_num, "empty label");
            }
            // GAS rejects a redefined label; a silent last-wins insert sent
            // branches to whichever copy came later.
            if labels.contains_key(&name) {
                return asm_err(
                    *line_num,
                    &format!(
                        "label `{name}` is already defined -- give each label a \
                         unique name (labels are file-wide, not per-function)"
                    ),
                );
            }
            labels.insert(name, instr_count * 4);
        }
        // A same-line `label: instr` still carries an instruction.
        if !rest.is_empty() {
            instr_count += 1;
        }
    }

    // pass 2: encode instructions
    let mut code: Vec<u32> = Vec::new();
    let mut pc: u64 = 0;
    for (line_num, line) in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let (_label, rest) = split_label(trimmed);
        if rest.is_empty() {
            continue;
        }
        let word = encode_line(rest, pc, &labels, *line_num)?;
        code.push(word);
        pc += 4;
    }

    Ok(code)
}

/// Split a leading `name:` label off a line. GAS lets a label and an
/// instruction share a line (`loop: subs x0, x0, 1`); the two-pass encoder
/// only recognized a label when it was the WHOLE line, so the same-line
/// idiom reached `encode_line` with `loop:` read as the mnemonic. The legacy
/// (non-hosted) grammar has no other leading-colon construct, so a leading
/// identifier immediately followed by `:` is unambiguously a label.
fn split_label(trimmed: &str) -> (Option<&str>, &str) {
    if let Some(colon) = trimmed.find(':') {
        let head = trimmed[..colon].trim_end();
        if !head.is_empty()
            && head
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '.' || c == '$')
        {
            return (Some(head), trimmed[colon + 1..].trim_start());
        }
    }
    (None, trimmed)
}

// ---------------------------------------------------------------------------
// preprocessing
// ---------------------------------------------------------------------------

fn preprocess(source: &str) -> Vec<(usize, String)> {
    source
        .lines()
        .enumerate()
        .map(|(i, line)| {
            // strip comments; literal-aware, so `mov w1, ';'` survives
            let without_comment = crate::frontend::m4::strip_comment(line);
            (i + 1, without_comment.trim().to_string())
        })
        .collect()
}

// ---------------------------------------------------------------------------
// line encoding
// ---------------------------------------------------------------------------

/// Public entry point for encoding a single assembly line against an
/// absolute-address symbol table. Used by the hosted pipeline (see
/// `frontend::pipeline`) which walks `.text` instructions one at a time.
pub fn encode_line_absolute(
    line: &str,
    pc: u64,
    labels: &HashMap<String, u64>,
    line_num: usize,
) -> Result<u32, EmuError> {
    encode_line(line, pc, labels, line_num)
}

/// Every mnemonic `encode_line`'s dispatch accepts, spelled the way the arms
/// spell it (the uppercase form the dispatch matches on, both halves of each
/// `B.<cc>` / `B<cc>` alias pair). It lives beside the match so the two are
/// read and edited together: the reference drift guard
/// (`tests/reference_consistency.rs`) checks the public instruction reference
/// against this list, and `supported_mnemonics_all_reach_an_arm` proves every
/// entry still lands on an arm instead of the unknown-mnemonic fallthrough.
/// Adding an arm without adding it here leaves a mnemonic no document has to
/// mention; listing one with no arm fails the unit test.
pub const SUPPORTED_MNEMONICS: &[&str] = &[
    // moves
    "MOV", "MOVZ", "MOVK", "MOVN",
    // arithmetic immediate / register
    "ADD", "ADDS", "SUB", "SUBS",
    // compare (aliases)
    "CMP", "CMN",
    // logical
    "AND", "ANDS", "ORR", "EOR", "BIC", "MVN", "TST",
    // shifts and rotate
    "LSL", "LSR", "ASR", "ROR",
    // sign / zero extension
    "SXTB", "SXTH", "SXTW", "UXTB", "UXTH",
    // bitfield extract / insert
    "UBFX", "SBFX", "BFI",
    // multiply / divide
    "MUL", "UDIV", "SDIV", "MADD", "MSUB", "NEG",
    // memory
    "LDR", "STR", "LDRB", "STRB", "LDRH", "STRH", "LDRSB", "LDRSH", "LDRSW",
    // floating-point
    "FADD", "FSUB", "FMUL", "FDIV", "FMOV", "FNEG", "FABS", "FSQRT", "FCMP",
    "FCVT", "SCVTF", "FCVTZS", "LDP", "STP",
    // pc-relative address formation
    "ADR", "ADRP",
    // branches
    "B", "BL", "BR", "BLR", "RET",
    // conditional branches (both spellings of each condition)
    "B.EQ", "BEQ",
    "B.NE", "BNE",
    "B.HS", "B.CS", "BHS", "BCS",
    "B.LO", "B.CC", "BLO", "BCC",
    "B.MI", "BMI",
    "B.PL", "BPL",
    "B.VS", "BVS",
    "B.VC", "BVC",
    "B.HI", "BHI",
    "B.LS", "BLS",
    "B.GE", "BGE",
    "B.LT", "BLT",
    "B.GT", "BGT",
    "B.LE", "BLE",
    "B.AL", "BAL",
    // compare/test and branch
    "CBZ", "CBNZ", "TBZ", "TBNZ",
    // conditional select
    "CSEL", "CSINC", "CSET",
    // system
    "NOP", "SVC",
];

fn encode_line(
    line: &str,
    pc: u64,
    labels: &HashMap<String, u64>,
    line_num: usize,
) -> Result<u32, EmuError> {
    let (mnemonic, operands) = split_mnemonic(line);
    let mn = mnemonic.to_uppercase();
    let ops: Vec<&str> = if operands.is_empty() {
        vec![]
    } else {
        split_operands(operands)
    };

    // Conditional branches take both spellings of every condition
    // (`B.NE` and `BNE`); the set comes from the shared condition table
    // rather than a hand-written arm per condition.
    if let Some(cond) = bcond_condition(&mn) {
        return encode_bcond(&ops, cond, pc, labels, line_num);
    }

    match mn.as_str() {
        // -- moves --
        "MOV" => encode_mov(&ops, line_num),
        "MOVZ" => encode_movzk(&ops, 0b10, line_num),
        "MOVK" => encode_movzk(&ops, 0b11, line_num),
        "MOVN" => encode_movzk(&ops, 0b00, line_num),

        // -- arithmetic immediate / register --
        "ADD" => encode_dp(&ops, 0, 0, line_num),
        "ADDS" => encode_dp(&ops, 0, 1, line_num),
        "SUB" => encode_dp(&ops, 1, 0, line_num),
        "SUBS" => encode_dp(&ops, 1, 1, line_num),

        // -- compare (aliases) --
        "CMP" => encode_cmp(&ops, 1, line_num),
        "CMN" => encode_cmp(&ops, 0, line_num),

        // -- logical --
        "AND" => encode_log_dispatch(&ops, 0b00, line_num),
        "ANDS" => encode_log_dispatch(&ops, 0b11, line_num),
        "ORR" => encode_log_dispatch(&ops, 0b01, line_num),
        "EOR" => encode_log_dispatch(&ops, 0b10, line_num),
        "BIC" => encode_bic(&ops, line_num),
        "MVN" => encode_mvn(&ops, line_num),
        "TST" => encode_tst(&ops, line_num),

        // -- shifts (immediate forms via UBFM/SBFM, rotate via EXTR) --
        "LSL" => encode_shift(&ops, 0, line_num),
        "LSR" => encode_shift(&ops, 1, line_num),
        "ASR" => encode_shift(&ops, 2, line_num),
        "ROR" => encode_ror(&ops, line_num),

        // -- sign / zero extension (SBFM / UBFM extract-and-extend aliases) --
        "SXTB" => encode_extend(&ops, true, 7, line_num),
        "SXTH" => encode_extend(&ops, true, 15, line_num),
        "SXTW" => encode_extend(&ops, true, 31, line_num),
        "UXTB" => encode_extend(&ops, false, 7, line_num),
        "UXTH" => encode_extend(&ops, false, 15, line_num),

        // -- bitfield extract / insert (SBFM / UBFM / BFM aliases) --
        "UBFX" => encode_bfx(&ops, false, line_num),
        "SBFX" => encode_bfx(&ops, true, line_num),
        "BFI" => encode_bfi(&ops, line_num),

        // -- multiply / divide --
        "MUL" => encode_mul_div(&ops, 0, line_num),
        "UDIV" => encode_mul_div(&ops, 1, line_num),
        "SDIV" => encode_mul_div(&ops, 2, line_num),
        "MADD" => encode_mul_accumulate(&ops, false, line_num),
        "MSUB" => encode_mul_accumulate(&ops, true, line_num),
        "NEG" => encode_neg(&ops, line_num),

        // -- memory --
        "LDR" => encode_ldst(&ops, 1, 0b11, line_num),
        "STR" => encode_ldst(&ops, 0, 0b11, line_num),
        "LDRB" => encode_ldst(&ops, 1, 0b00, line_num),
        "STRB" => encode_ldst(&ops, 0, 0b00, line_num),
        "LDRH" => encode_ldst(&ops, 1, 0b01, line_num),
        "STRH" => encode_ldst(&ops, 0, 0b01, line_num),
        "LDRSB" => encode_ldrs(&ops, 0b00, line_num),
        "LDRSH" => encode_ldrs(&ops, 0b01, line_num),
        "LDRSW" => encode_ldrs(&ops, 0b10, line_num),

        // -- floating-point --
        "FADD" => encode_fp_binary(&ops, 0b0010, "fadd", line_num),
        "FSUB" => encode_fp_binary(&ops, 0b0011, "fsub", line_num),
        "FMUL" => encode_fp_binary(&ops, 0b0000, "fmul", line_num),
        "FDIV" => encode_fp_binary(&ops, 0b0001, "fdiv", line_num),
        "FMOV" => encode_fmov(&ops, line_num),
        "FNEG" => encode_fp_unary(&ops, 0b000010, "fneg", line_num),
        "FABS" => encode_fp_unary(&ops, 0b000001, "fabs", line_num),
        "FSQRT" => encode_fp_unary(&ops, 0b000011, "fsqrt", line_num),
        "FCMP" => encode_fcmp(&ops, line_num),
        "FCVT" => encode_fcvt(&ops, line_num),
        "SCVTF" => encode_scvtf(&ops, line_num),
        "FCVTZS" => encode_fcvtzs(&ops, line_num),
        "LDP" => encode_ldst_pair(&ops, 1, line_num),
        "STP" => encode_ldst_pair(&ops, 0, line_num),

        // -- pc-relative address formation --
        "ADR" => encode_adr(&ops, false, pc, labels, line_num),
        "ADRP" => encode_adr(&ops, true, pc, labels, line_num),

        // -- branches --
        "B" => encode_branch_imm(&ops, false, pc, labels, line_num),
        "BL" => encode_branch_imm(&ops, true, pc, labels, line_num),
        "BR" => encode_branch_reg(&ops, 0b0000, line_num),
        "BLR" => encode_branch_reg(&ops, 0b0001, line_num),
        "RET" => encode_ret(&ops, line_num),

        // -- compare/test and branch --
        "CBZ" => encode_compare_branch(&ops, false, pc, labels, line_num),
        "CBNZ" => encode_compare_branch(&ops, true, pc, labels, line_num),
        "TBZ" => encode_test_branch(&ops, false, pc, labels, line_num),
        "TBNZ" => encode_test_branch(&ops, true, pc, labels, line_num),

        // -- conditional select --
        "CSEL" => encode_cond_sel(&ops, 0, line_num),
        "CSINC" => encode_cond_sel(&ops, 1, line_num),
        "CSET" => encode_cset(&ops, line_num),

        // -- system --
        "NOP" => Ok(0xD503_201F),
        "SVC" => encode_svc(&ops, line_num),

        _ => asm_err(line_num, &format!("unknown mnemonic: {mn}")),
    }
}

// ---------------------------------------------------------------------------
// operand parsing helpers
// ---------------------------------------------------------------------------

fn split_mnemonic(line: &str) -> (&str, &str) {
    let line = line.trim();
    if let Some(pos) = line.find(|c: char| c.is_whitespace()) {
        let mn = &line[..pos];
        let rest = line[pos..].trim();
        (mn, rest)
    } else {
        (line, "")
    }
}

fn split_operands(s: &str) -> Vec<&str> {
    // split on commas but keep bracket groups together
    let mut result = Vec::new();
    let mut depth = 0;
    let mut start = 0;
    for (i, c) in s.char_indices() {
        match c {
            '[' => depth += 1,
            ']' => depth -= 1,
            ',' if depth == 0 => {
                result.push(s[start..i].trim());
                start = i + 1;
            }
            _ => {}
        }
    }
    let last = s[start..].trim();
    if !last.is_empty() {
        result.push(last);
    }
    result
}

fn parse_register(s: &str, line_num: usize) -> Result<(u8, bool), EmuError> {
    let original = s.trim();
    let s = original.to_uppercase();
    match s.as_str() {
        "SP" => Ok((31, true)), // sf=true for SP
        "XZR" => Ok((31, true)),
        "WZR" => Ok((31, false)),
        // Real GNU as predefines the frame-pointer and link-register
        // aliases, so course prologues written with bare fp/lr assemble
        // without a define(fp, x29) line.
        "FP" => Ok((29, true)),
        "LR" => Ok((30, true)),
        _ => {
            let (prefix, sf) = if let Some(rest) = s.strip_prefix('X') {
                (rest, true)
            } else if let Some(rest) = s.strip_prefix('W') {
                (rest, false)
            } else {
                return asm_err(
                    line_num,
                    &format!("expected a register here, got `{original}`"),
                );
            };
            let num: u8 = prefix
                .parse()
                .map_err(|_| asm_error(line_num, &format!("invalid register: {s}")))?;
            if num > 30 {
                return asm_err(line_num, &format!("register index out of range: {s}"));
            }
            Ok((num, sf))
        }
    }
}

fn parse_immediate(s: &str, line_num: usize) -> Result<i64, EmuError> {
    let s = s.trim();
    let s = s.strip_prefix('#').unwrap_or(s);
    let s = s.trim();

    // Single-quoted char literal: 'A' -> 65, '\n' -> 10, '\xFF' -> 255.
    if let Some(body) = s.strip_prefix('\'').and_then(|b| b.strip_suffix('\'')) {
        return parse_char_body(body, line_num);
    }

    let negative = s.starts_with('-');
    let s = if negative { &s[1..] } else { s };

    let val: u64 = if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u64::from_str_radix(hex, 16)
            .map_err(|_| asm_error(line_num, &format!("invalid hex immediate: {s}")))?
    } else if let Some(bin) = s.strip_prefix("0b").or_else(|| s.strip_prefix("0B")) {
        // Binary immediates (`#0b101010`) are a documented course form; the
        // lexer already accepts them, so the legacy encoder must too.
        u64::from_str_radix(bin, 2)
            .map_err(|_| asm_error(line_num, &format!("invalid binary immediate: {s}")))?
    } else {
        s.parse()
            .map_err(|_| asm_error(line_num, &format!("invalid immediate: {s}")))?
    };

    Ok(if negative { -(val as i64) } else { val as i64 })
}

fn parse_char_body(body: &str, line_num: usize) -> Result<i64, EmuError> {
    let bytes = body.as_bytes();
    if bytes.is_empty() {
        return Err(asm_error(line_num, "empty char literal"));
    }
    if bytes[0] != b'\\' {
        // Plain character; the lexer-level corpus stays single-byte ASCII.
        if bytes.len() != 1 {
            return Err(asm_error(line_num, "char literal must be one character"));
        }
        return Ok(bytes[0] as i64);
    }
    if bytes.len() < 2 {
        return Err(asm_error(line_num, "dangling backslash in char literal"));
    }
    let value = match bytes[1] {
        b'n' => b'\n' as i64,
        b't' => b'\t' as i64,
        b'r' => b'\r' as i64,
        b'0' => 0,
        b'\\' => b'\\' as i64,
        b'"' => b'"' as i64,
        b'\'' => b'\'' as i64,
        b'x' | b'X' => {
            if bytes.len() != 4 {
                return Err(asm_error(line_num, "\\xNN char literal needs two hex digits"));
            }
            let hex = std::str::from_utf8(&bytes[2..4])
                .map_err(|_| asm_error(line_num, "invalid hex in char literal"))?;
            i64::from_str_radix(hex, 16)
                .map_err(|_| asm_error(line_num, "invalid hex in char literal"))?
        }
        other => {
            return Err(asm_error(
                line_num,
                &format!("unknown escape in char literal: \\{}", other as char),
            ));
        }
    };
    if bytes[0] == b'\\' && !matches!(bytes[1], b'x' | b'X') && bytes.len() != 2 {
        return Err(asm_error(line_num, "trailing characters after escape in char literal"));
    }
    Ok(value)
}

fn parse_condition(s: &str, line_num: usize) -> Result<u8, EmuError> {
    match condition_bits(&s.trim().to_uppercase()) {
        Some(bits) => Ok(bits),
        None => asm_err(line_num, &format!("unknown condition: {s}")),
    }
}

/// Look an uppercase condition spelling up in the shared table.
fn condition_bits(name: &str) -> Option<u8> {
    CONDITIONS.iter().find_map(|(primary, aliases, bits)| {
        (*primary == name || aliases.contains(&name)).then_some(*bits)
    })
}

/// The condition bits of a conditional-branch mnemonic (`B.<cc>` or `B<cc>`,
/// uppercase), or None for anything else. The bare form matches only when
/// the whole tail is a condition spelling, so `BL`, `BLR` and `BIC` never
/// strip to one.
fn bcond_condition(mn: &str) -> Option<u8> {
    if let Some(tail) = mn.strip_prefix("B.") {
        return condition_bits(tail);
    }
    condition_bits(mn.strip_prefix('B')?)
}

fn asm_err<T>(line_num: usize, msg: &str) -> Result<T, EmuError> {
    Err(asm_error(line_num, msg))
}

fn asm_error(line_num: usize, msg: &str) -> EmuError {
    EmuError::AssemblyError {
        line: line_num,
        message: msg.to_string(),
    }
}

// ---------------------------------------------------------------------------
// instruction encoders
// ---------------------------------------------------------------------------

#[allow(clippy::identity_op)] // zero fields kept to document the full encoding layout
fn encode_mov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "MOV requires 2 operands");
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
        if imm > 0 {
            // Try to encode as a single MOVZ with a shifted 16-bit field
            // (e.g. 0x10000000 -> MOVZ Xd, #0x1000, LSL #16).
            let u = imm as u64;
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
        // `mov x0, #-1` this way; the old path only tried MOVN for negative
        // literals and only unshifted, so the positive hex form (and shifted
        // inverses like 0xffff0000) were wrongly rejected.
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
        // Last resort, and the one GAS reaches for: any constant that is a
        // valid repeating bitmask pattern lowers to `ORR Rd, ZR, #imm`.
        // Without it `mov x0, 0x5555555555555555` -- a mask a student
        // writes by hand -- was refused even though one instruction covers
        // it. MOVZ/MOVN stay ahead of it so the common small constants keep
        // the encoding GAS picks for them.
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

fn encode_movzk(ops: &[&str], opc: u8, ln: usize) -> Result<u32, EmuError> {
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
            // Silently dropping a non-LSL third operand left hw = 0, so
            // `movk x0, #0xdead, #16` overwrote the LOW halfword with no
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

/// Parse a trailing shift-modifier operand: `lsl #3`, or the course
/// spelling `LSL 3`. `allow_ror` admits ROR for the logical ops; ADD/SUB
/// reserve that encoding.
fn parse_shift_modifier(
    op: &str,
    reg_size: u8,
    allow_ror: bool,
    ln: usize,
) -> Result<(u32, u8), EmuError> {
    let t = op.trim();
    let upper = t.to_uppercase();
    let (shift_bits, rest) = if let Some(r) = upper.strip_prefix("LSL") {
        (0b00u32, r)
    } else if let Some(r) = upper.strip_prefix("LSR") {
        (0b01, r)
    } else if let Some(r) = upper.strip_prefix("ASR") {
        (0b10, r)
    } else if let Some(r) = upper.strip_prefix("ROR") {
        if !allow_ror {
            return asm_err(ln, "ROR is not a valid shift for ADD/SUB/CMP/CMN");
        }
        (0b11, r)
    } else {
        return asm_err(
            ln,
            &format!("expected a shift modifier like `lsl #3` as the last operand, got `{t}`"),
        );
    };
    let amt = parse_immediate(rest.trim(), ln)?;
    if !(0..reg_size as i64).contains(&amt) {
        return asm_err(
            ln,
            &format!(
                "shift amount {amt} is out of range for a {reg_size}-bit register (valid: 0-{})",
                reg_size - 1
            ),
        );
    }
    Ok((shift_bits, amt as u8))
}

/// The eight extend keywords ADD/SUB's extended-register form accepts, in
/// `option` field order.
const EXTEND_KEYWORDS: [(&str, u32); 8] = [
    ("UXTB", 0b000),
    ("UXTH", 0b001),
    ("UXTW", 0b010),
    ("UXTX", 0b011),
    ("SXTB", 0b100),
    ("SXTH", 0b101),
    ("SXTW", 0b110),
    ("SXTX", 0b111),
];

/// Split a trailing extend modifier into its `option` field and the text
/// of its optional shift amount: `sxtw #2`, `uxtb`, or the course spelling
/// `SXTW 2`. `None` means the operand is not an extend keyword at all, so
/// the caller falls back to the shift-modifier path. The index register's
/// width is deliberately not checked here: GAS assembles `add x0, x1, x2,
/// sxtw` to the same word as the `w2` spelling, so refusing it would
/// reject source the course toolchain accepts.
fn parse_extend_modifier(op: &str) -> Option<(u32, &str)> {
    let t = op.trim();
    let upper = t.to_ascii_uppercase();
    for (keyword, option) in EXTEND_KEYWORDS {
        let Some(rest) = upper.strip_prefix(keyword) else {
            continue;
        };
        if rest.is_empty() || rest.starts_with([' ', '\t', '#']) {
            return Some((option, &t[keyword.len()..]));
        }
    }
    None
}

fn encode_dp(ops: &[&str], op_bit: u8, s_bit: u8, ln: usize) -> Result<u32, EmuError> {
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
    // and refusing it here reported "expected a register here".
    let op3_is_imm = op3.starts_with('#')
        || op3.starts_with('\'')
        || op3.starts_with('-')
        || op3.chars().next().is_some_and(|c| c.is_ascii_digit());

    // `add x0, x1, w2, sxtw #2` is the EXTENDED register form, whose last
    // operand is an extend keyword rather than a shift. It has to be
    // recognized before parse_shift_modifier, which only speaks
    // lsl/lsr/asr/ror and reported "expected a shift modifier" for the
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
        // ADDS/SUBS stay exact -- the hardware computes x - (-n) as x + n,
        // carry included.
        let (op_bit, magnitude) = if raw < 0 {
            (1 - op_bit, raw.unsigned_abs())
        } else {
            (op_bit, raw as u64)
        };
        // Bit 22 shifts the 12-bit field left by 12. GAS reaches for it
        // silently on an exact multiple of 4096, so `sub sp, sp, 4096` -- a
        // valid course prologue -- encodes instead of being refused.
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
    // parse_register collapses SP and XZR to index 31, but the hardware
    // separates them by encoding: the shifted form (bit 21 = 0) reads
    // register 31 as XZR, and only the EXTENDED form (bit 21 = 1) reaches
    // SP. Route SP operands to the extended encoding -- emitting shifted
    // for `add x0, sp, x1` silently computed with 0 -- and reject the
    // placements no encoding covers, exactly as GAS does.
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

/// Refuse `sp` anywhere in an instruction whose encoding has no room for
/// it. `parse_register` collapses SP and XZR to index 31, so a stray `sp`
/// in a logical, shift, multiply or divide silently computed with ZERO --
/// a wrong answer with no diagnostic. The add/sub path already routes SP
/// to the extended encoding; these forms have no such encoding, and GAS
/// rejects them outright ("expected an integer or zero register").
fn reject_sp_operands(ops: &[&str], ln: usize, mnemonic: &str) -> Result<(), EmuError> {
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

fn encode_cmp(ops: &[&str], op_bit: u8, ln: usize) -> Result<u32, EmuError> {
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
    // like `#-16` (a bare parse::<i64> only understood decimal).
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

fn encode_log_reg(ops: &[&str], opc: u8, n: bool, ln: usize) -> Result<u32, EmuError> {
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
fn encode_bic(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "BIC requires 3 operands");
    }
    let op3 = ops[2].trim();
    if op3.starts_with('#') || op3.starts_with('\'') || op3.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '-')
    {
        return asm_err(ln, "BIC takes a register, not an immediate; use AND with the inverted mask");
    }
    encode_log_reg(ops, 0b00, true, ln)
}

/// Encode `UBFX/SBFX Rd, Rn, #lsb, #width` (bitfield extract), the
/// course's pull-a-field-out instructions. Both lower onto a bitfield move
/// with `immr = lsb`, `imms = lsb + width - 1`; UBFX zero-extends the
/// field (UBFM) and SBFX sign-extends it (SBFM). The executor's existing
/// `Bitfield` path does the extract-and-extend for either.
fn encode_bfx(ops: &[&str], signed: bool, ln: usize) -> Result<u32, EmuError> {
    let name = if signed { "SBFX" } else { "UBFX" };
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

    let immr = lsb as u32;
    let imms = (lsb + width - 1) as u32;
    let sf_bit = if sf { 1u32 } else { 0 };
    let n_bit = sf_bit; // N matches sf for the valid SBFM/UBFM encodings
    let opc: u32 = if signed { 0b00 } else { 0b10 };
    Ok((sf_bit << 31) | (opc << 29) | (0b100110 << 23) | (n_bit << 22)
        | (immr << 16) | (imms << 10) | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `ROR Rd, Rn, #shift` and `ROR Rd, Rn, Rm`. The immediate form is
/// the EXTR alias GAS emits (an EXTR whose two sources are both Rn); the
/// register form is RORV, which shares the dp2 variable-shift space with
/// LSLV/LSRV/ASRV.
fn encode_ror(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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

/// Encode `BFI Rd, Rn, #lsb, #width` (bitfield insert): drop the low
/// `width` bits of Rn into Rd starting at `lsb`, leaving Rd's other bits
/// alone. Lowers onto BFM with `immr = (reg_size - lsb) % reg_size`,
/// `imms = width - 1`.
fn encode_bfi(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, "BFI requires 4 operands: Rd, Rn, #lsb, #width");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let lsb = parse_immediate(ops[2], ln)?;
    let width = parse_immediate(ops[3], ln)?;
    let reg_size: i64 = if sf { 64 } else { 32 };

    if width < 1 {
        return asm_err(ln, "BFI width must be at least 1");
    }
    if lsb < 0 || lsb >= reg_size {
        return asm_err(ln, "BFI lsb is out of range for the register width");
    }
    if lsb + width > reg_size {
        return asm_err(ln, "BFI field runs past the top of the register");
    }

    let immr = ((reg_size - lsb) % reg_size) as u32;
    let imms = (width - 1) as u32;
    let sf_bit = if sf { 1u32 } else { 0 };
    let n_bit = sf_bit;
    Ok((sf_bit << 31) | (0b01 << 29) | (0b100110 << 23) | (n_bit << 22)
        | (immr << 16) | (imms << 10) | ((rn as u32) << 5) | (rd as u32))
}

fn encode_mvn(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // MVN Xd, Xm -> ORN Xd, XZR, Xm
    if ops.len() != 2 {
        return asm_err(ln, "MVN requires 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rm, _) = parse_register(ops[1], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    // ORN = opc=01, N=1
    Ok((sf_bit << 31) | (0b01 << 29) | (0b01010 << 24) | (1 << 21)
        | ((rm as u32) << 16) | (0b11111 << 5) | (rd as u32))
}

/// Dispatch `AND/ANDS/ORR/EOR` between the register-register form and the
/// bitmask-immediate form based on the third operand's shape. `opc`
/// follows the ARM encoding's opc field: 00=AND, 01=ORR, 10=EOR, 11=ANDS.
fn encode_log_dispatch(ops: &[&str], opc: u8, ln: usize) -> Result<u32, EmuError> {
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

fn encode_tst(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_log_imm_fields(
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

fn encode_shift(ops: &[&str], shift_type: u8, ln: usize) -> Result<u32, EmuError> {
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
        // out-of-range amount used to assemble silently into a different
        // instruction (`lsl x0, x1, #64` became `lsr x0, x1, #3`). GAS
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
            _ => unreachable!(),
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
        _ => unreachable!(),
    };
    Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
        | (opcode << 10) | ((rn as u32) << 5) | (rd as u32))
}

/// Encode `sxtb`/`sxth`/`sxtw`/`uxtb`/`uxth Rd, Wn`. These are SBFM/UBFM
/// aliases with `immr = 0` and `imms` fixed per width (7/15/31). The
/// destination width picks the 64- vs 32-bit form (and the N bit, which
/// tracks `sf` for these encodings).
#[allow(clippy::identity_op)] // zero fields kept to document the full encoding layout
fn encode_extend(ops: &[&str], signed: bool, imms: u8, ln: usize) -> Result<u32, EmuError> {
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

fn encode_mul_div(ops: &[&str], variant: u8, ln: usize) -> Result<u32, EmuError> {
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
        _ => unreachable!(),
    }
}

fn encode_mul_accumulate(ops: &[&str], subtract: bool, ln: usize) -> Result<u32, EmuError> {
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

fn encode_neg(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // NEG Xd, Xm -> SUB Xd, XZR, Xm
    if ops.len() != 2 {
        return asm_err(ln, "NEG requires 2 operands");
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    let new_ops = [ops[0], zr, ops[1]];
    encode_dp(&new_ops, 1, 0, ln)
}

fn parse_fp_register(s: &str, ln: usize) -> Result<(u8, char), EmuError> {
    // Accept D0..D31 or S0..S31 (returns width ('D' or 'S') too).
    let s = s.trim();
    let first = s.chars().next().ok_or_else(|| asm_error(ln, "empty register"))?;
    let prefix = first.to_ascii_uppercase();
    if prefix != 'D' && prefix != 'S' {
        return asm_err(ln, &format!("expected D or S register, got: {s}"));
    }
    let idx: u8 = s[1..]
        .parse()
        .map_err(|_| asm_error(ln, &format!("bad FP register: {s}")))?;
    if idx > 31 {
        return asm_err(ln, &format!("FP register index out of range: {idx}"));
    }
    Ok((idx, prefix))
}

/// The ftype field (bits 23:22) for a scalar FP width: 0b01 for D, 0b00
/// for S. Every scalar FP base opcode below is written in its S (ftype=00)
/// form and this adds the D bit back.
fn fp_ftype(width: char) -> u32 {
    if width == 'D' { 0x0040_0000 } else { 0 }
}

/// All operands of one FP instruction must share a width; mixing S and D
/// silently computing in the wrong precision would be far worse than an
/// error, so name the mnemonic and both widths.
fn require_same_fp_width(name: &str, widths: &[char], ln: usize) -> Result<char, EmuError> {
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

fn encode_fp_binary(ops: &[&str], opcode: u32, name: &str, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, &format!("{name} requires 3 operands: {name} fd, fn, fm"));
    }
    let (fd, wd) = parse_fp_register(ops[0], ln)?;
    let (fn_, wn) = parse_fp_register(ops[1], ln)?;
    let (fm, wm) = parse_fp_register(ops[2], ln)?;
    let width = require_same_fp_width(name, &[wd, wn, wm], ln)?;
    // 2-source: 0_0_0_11110_ftype_1_Rm_opcode_10_Rn_Rd
    Ok(0x1E20_0800
        | fp_ftype(width)
        | ((fm as u32) << 16)
        | ((opcode & 0xF) << 12)
        | ((fn_ as u32) << 5)
        | (fd as u32))
}

fn encode_fmov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fmov requires 2 operands");
    }
    let (fd, wd) = parse_fp_register(ops[0], ln)?;

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
            let fallback = if wd == 'D' { ".double" } else { ".float" };
            return asm_err(
                ln,
                &format!(
                    "{op2} does not fit the FMOV 8-bit float immediate; load it from a {fallback} instead"
                ),
            );
        };
        // FMOV Fd, #imm: 0_0_0_11110_ftype_1_imm8_100_00000_Rd
        return Ok(0x1E20_1000 | fp_ftype(wd) | ((imm8 as u32) << 13) | (fd as u32));
    }

    let (fn_, wn) = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width("fmov", &[wd, wn], ln)?;
    // FMOV Fd, Fn: 0_0_0_11110_ftype_1_00000_010000_Rn_Rd
    Ok(0x1E20_4000 | fp_ftype(width) | ((fn_ as u32) << 5) | (fd as u32))
}

/// Encode an FP data-processing 1-source op (`FNEG` / `FABS` / `FSQRT`
/// `Fd, Fn`).
/// `opcode` fills bits 20:15 of the 1-source layout:
/// 0_0_0_11110_ftype_1_opcode_10000_Rn_Rd.
fn encode_fp_unary(ops: &[&str], opcode: u32, name: &str, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, &format!("{name} requires 2 operands: {name} fd, fn"));
    }
    let (fd, wd) = parse_fp_register(ops[0], ln)?;
    let (fn_, wn) = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width(name, &[wd, wn], ln)?;
    Ok(0x1E20_4000 | fp_ftype(width) | (opcode << 15) | ((fn_ as u32) << 5) | (fd as u32))
}

/// FCVT converts between the S and D views: `fcvt d0, s1` widens (exact),
/// `fcvt s0, d1` narrows (rounds). The ftype field names the SOURCE width
/// and the opcode's low bits name the destination width.
fn encode_fcvt(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fcvt requires 2 operands: fcvt fd, fn");
    }
    let (fd, wd) = parse_fp_register(ops[0], ln)?;
    let (fn_, wn) = parse_fp_register(ops[1], ln)?;
    if wd == wn {
        return asm_err(
            ln,
            "fcvt converts between widths: one operand must be an S register and the other a D register (use fmov to copy at the same width)",
        );
    }
    // 1-source with opcode 0b0001‖dest-type; ftype = source width.
    let opcode: u32 = if wd == 'D' { 0b000101 } else { 0b000100 };
    Ok(0x1E20_4000 | fp_ftype(wn) | (opcode << 15) | ((fn_ as u32) << 5) | (fd as u32))
}

fn encode_fcmp(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fcmp requires 2 operands");
    }
    let (fn_, wn) = parse_fp_register(ops[0], ln)?;
    let (fm, wm) = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width("fcmp", &[wn, wm], ln)?;
    // FCMP Fn, Fm: 0_0_0_11110_ftype_1_Rm_00_1000_Rn_0_0000
    Ok(0x1E20_2000 | fp_ftype(width) | ((fm as u32) << 16) | ((fn_ as u32) << 5))
}

fn encode_scvtf(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "scvtf requires 2 operands: scvtf fd, rn");
    }
    let (fd, wd) = parse_fp_register(ops[0], ln)?;
    let (rn, sf) = parse_register(ops[1], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    // SCVTF Fd, Rn: sf_0_0_11110_ftype_1_00_010_000000_Rn_Rd
    Ok((sf_bit << 31) | 0x1E22_0000 | fp_ftype(wd) | ((rn as u32) << 5) | (fd as u32))
}

fn encode_fcvtzs(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fcvtzs requires 2 operands: fcvtzs rd, fn");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (fn_, wn) = parse_fp_register(ops[1], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    // FCVTZS Rd, Fn: sf_0_0_11110_ftype_1_11_000_000000_Rn_Rd
    Ok((sf_bit << 31) | 0x1E38_0000 | fp_ftype(wn) | ((fn_ as u32) << 5) | (rd as u32))
}

fn encode_ldrs(ops: &[&str], size: u8, ln: usize) -> Result<u32, EmuError> {
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
    let (name, unsigned_load, extend) = match size {
        0b00 => ("ldrsb", "ldrb", "sxtb"),
        0b01 => ("ldrsh", "ldrh", "sxth"),
        _ => ("ldrsw", "ldr", "sxtw"),
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
            let scale: u64 = match size {
                0b00 => 1,
                0b01 => 2,
                0b10 => 4,
                _ => unreachable!(),
            };
            // Two distinct rejections, named separately: one message that
            // asserted "must be positive and aligned" blamed alignment for
            // ldrsb, whose scale of 1 makes alignment impossible to violate.
            if offset_val < 0 {
                return asm_err(
                    ln,
                    &format!(
                        "{name} takes only a non-negative offset here; load unsigned and \
                         sign-extend instead ({unsigned_load} then {extend}), or index from a \
                         lower base address"
                    ),
                );
            }
            if !(offset_val as u64).is_multiple_of(scale) {
                return asm_err(
                    ln,
                    &format!("the {name} offset {offset_val} must be a multiple of {scale}"),
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
        AddressingMode::Immediate { .. } => asm_err(
            ln,
            &format!(
                "{name} has no pre/post-index form here; adjust the base with add/sub and use \
                 the plain [xN, offset] form"
            ),
        ),
        AddressingMode::RegOffset {
            rn,
            rm,
            option,
            shift_amount,
        } => {
            // LDRSB/LDRSH/LDRSW register offset -- the array-indexing form
            // (`ldrsb w0, [x1, x2]`). Same S-bit rule as plain LDR/STR:
            // the only legal written amounts are 0 and log2(access bytes).
            let s_bit: u32 = match shift_amount {
                None | Some(0) => 0,
                Some(a) if a == size as i64 => 1,
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

fn encode_ldst(ops: &[&str], load: u8, size: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 2 {
        return asm_err(ln, "LDR/STR requires at least 2 operands");
    }
    // FP LDR/STR: the target is a D/S register. Dispatch to the SIMD&FP
    // encoding; this path only handles the plain integer form.
    if let Some(first_char) = ops[0].trim().chars().next() {
        let upper = first_char.to_ascii_uppercase();
        if matches!(upper, 'D' | 'S') && size == 0b11 {
            return encode_ldst_fp(ops, load, ln);
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
            // unsigned offset encoding
            let scale = match size {
                0b00 => 1u64,
                0b01 => 2,
                0b10 => 4,
                0b11 => 8,
                _ => unreachable!(),
            };
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
            // only legal written amounts are 0 and log2(access bytes) --
            // exactly what GAS enforces. `size` is that log2.
            let s_bit: u32 = match shift_amount {
                None | Some(0) => 0,
                Some(a) if a == size as i64 => 1,
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

#[derive(Debug)]
enum IndexMode {
    Unsigned,
    PreIndex,
    PostIndex,
}

/// Parsed LDR/STR address. Register-offset form (`[xN, wM, SXTW #2]`)
/// comes back as `RegOffset`; everything else stays `Immediate` so the
/// existing call sites keep working.
#[derive(Debug)]
enum AddressingMode {
    Immediate {
        rn: u8,
        offset: Option<i64>,
        mode: IndexMode,
    },
    /// `[Xn, (Wm|Xm) (, LSL|UXTW|SXTW|SXTX|UXTX #<amount>)?]`.
    RegOffset {
        rn: u8,
        rm: u8,
        /// ARM-spec 3-bit option encoding: 010=UXTW, 011=LSL/UXTX,
        /// 110=SXTW, 111=SXTX.
        option: u8,
        /// The written `#<amount>`, if any. The encoder decides the S
        /// (scale) bit from the VALUE against the access size; riding it
        /// on mere presence turned `lsl #0` into an 8x offset and
        /// silently rescaled wrong amounts.
        shift_amount: Option<i64>,
    },
}

fn looks_like_register(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    let lower = s.to_ascii_lowercase();
    if matches!(lower.as_str(), "sp" | "xzr" | "wzr" | "fp" | "lr") {
        return true;
    }
    for prefix in ["x", "w"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            if rest == "zr" {
                return true;
            }
            if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
    }
    false
}

fn parse_reg_offset_tail(parts: &[&str], ln: usize) -> Result<AddressingMode, EmuError> {
    // `parts` has been pre-split on commas; index 0 is the base, the
    // rest describe the offset.
    let (rn, _) = parse_register(parts[0], ln)?;
    let (rm, rm_is_x) = parse_register(parts[1], ln)?;
    // No explicit extend / shift: default LSL for Xm, UXTW for Wm.
    if parts.len() == 2 {
        let option = if rm_is_x { 0b011 } else { 0b010 };
        return Ok(AddressingMode::RegOffset {
            rn,
            rm,
            option,
            shift_amount: None,
        });
    }
    let modifier = parts[2].trim();
    let (keyword, shift_str) = split_extend_keyword(modifier);
    let keyword_lower = keyword.to_ascii_lowercase();
    let option = match keyword_lower.as_str() {
        "lsl" => 0b011,
        "uxtw" => 0b010,
        "sxtw" => 0b110,
        "sxtx" => 0b111,
        "uxtx" => 0b011,
        _ => return asm_err(ln, &format!("bad extend/shift keyword: {keyword}")),
    };
    // Require the extend keyword to match the Rm width ARM-spec rules:
    // UXTW/SXTW only make sense with Wm; LSL/UXTX/SXTX with Xm.
    if matches!(keyword_lower.as_str(), "uxtw" | "sxtw") && rm_is_x {
        return asm_err(ln, "UXTW/SXTW require a W index register");
    }
    if matches!(keyword_lower.as_str(), "lsl" | "uxtx" | "sxtx") && !rm_is_x {
        return asm_err(ln, "LSL/UXTX/SXTX require an X index register");
    }
    let shift_amount = if shift_str.trim().is_empty() {
        None
    } else {
        Some(parse_immediate(shift_str, ln)?)
    };
    Ok(AddressingMode::RegOffset {
        rn,
        rm,
        option,
        shift_amount,
    })
}

fn split_extend_keyword(s: &str) -> (&str, &str) {
    // Keyword then optional `#imm`. The keyword is the first whitespace-
    // delimited token; anything after is the shift amount.
    let s = s.trim();
    match s.find(|c: char| c.is_whitespace()) {
        Some(p) => (&s[..p], &s[p..]),
        None => (s, ""),
    }
}

fn parse_addressing_mode(s: &str, ln: usize) -> Result<AddressingMode, EmuError> {
    let s = s.trim();

    // [Xn, #imm]! -> pre-index
    if s.ends_with('!') {
        let inner = s.strip_suffix('!').unwrap().trim();
        let inner = inner.strip_prefix('[')
            .and_then(|s| s.strip_suffix(']'))
            .ok_or_else(|| asm_error(ln, "expected [Xn, #imm]!"))?;
        let parts: Vec<&str> = inner.splitn(2, ',').collect();
        let (rn, _) = parse_register(parts[0], ln)?;
        let offset = if parts.len() > 1 {
            Some(parse_immediate(parts[1], ln)?)
        } else {
            Some(0)
        };
        return Ok(AddressingMode::Immediate {
            rn,
            offset,
            mode: IndexMode::PreIndex,
        });
    }

    // check if it starts with [
    if !s.starts_with('[') {
        return asm_err(ln, "expected [ for addressing mode");
    }

    // [Xn], #imm -> post-index
    if let Some(bracket_end) = s.find(']') {
        let inside = &s[1..bracket_end];
        let after = s[bracket_end + 1..].trim();

        if !after.is_empty() {
            // post-index
            let (rn, _) = parse_register(inside.trim(), ln)?;
            let offset_str = after.strip_prefix(',').unwrap_or(after).trim();
            let offset = parse_immediate(offset_str, ln)?;
            return Ok(AddressingMode::Immediate {
                rn,
                offset: Some(offset),
                mode: IndexMode::PostIndex,
            });
        }

        // [Xn] or [Xn, ...]
        let parts: Vec<&str> = inside.splitn(3, ',').collect();
        if parts.len() >= 2 && looks_like_register(parts[1]) {
            return parse_reg_offset_tail(&parts, ln);
        }
        let (rn, _) = parse_register(parts[0], ln)?;
        if parts.len() > 1 {
            let offset = parse_immediate(parts[1], ln)?;
            return Ok(AddressingMode::Immediate {
                rn,
                offset: Some(offset),
                mode: IndexMode::Unsigned,
            });
        }
        return Ok(AddressingMode::Immediate {
            rn,
            offset: None,
            mode: IndexMode::Unsigned,
        });
    }

    asm_err(ln, "invalid addressing mode")
}

fn encode_ldst_fp(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    // SIMD&FP LDR/STR (immediate, unsigned offset):
    //   size[31:30] | 111 | V=1 | 01 | opc[23:22] | imm12 | Rn | Rt
    // D uses size=0b11, opc=01 (load) or 00 (store); S uses size=0b10,
    // same opc selection. Access scale is 8 for D, 4 for S.
    let (rt, width) = parse_fp_register(ops[0], ln)?;
    let addr_str: String = ops[1..].join(",");
    let am = parse_addressing_mode(addr_str.trim(), ln)?;
    let (size, scale) = match width {
        'D' => (0b11u32, 8u64),
        'S' => (0b10u32, 4u64),
        _ => return asm_err(ln, "unsupported FP LDR/STR width"),
    };
    let opc: u32 = if load == 1 { 0b01 } else { 0b00 };
    // The imm9 family shared by the unscaled-offset and writeback forms:
    //   size | 1111 | 00 | opc | 0 | imm9 | idx | Rn | Rt
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
            if offset_val < 0 || !(offset_val as u64).is_multiple_of(scale) {
                // Same GAS conversion as the integer path: negative or
                // unaligned offsets ride the unscaled encoding.
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
            let offset_val = offset.unwrap_or(0);
            let idx = if matches!(mode, IndexMode::PreIndex) { 0b11 } else { 0b01 };
            imm9_form(offset_val, idx, rn)
        }
        AddressingMode::RegOffset { .. } => {
            asm_err(ln, "FP LDR/STR register-offset not yet supported by the assembler")
        }
    }
}

#[allow(clippy::identity_op)] // zero fields kept to document the full encoding layout
fn encode_ldst_pair(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 3 {
        return asm_err(ln, "LDP/STP requires at least 3 operands");
    }
    let (rt, sf) = parse_register(ops[0], ln)?;
    let (rt2, sf2) = parse_register(ops[1], ln)?;
    // GAS rejects a mixed-width pair; accepting one took the width (and
    // the address scale) from the first register only, so both slots
    // reloaded garbage with no message.
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

    let scale: i64 = if sf { 8 } else { 4 };
    if offset_val % scale != 0 {
        return asm_err(ln, "pair offset must be aligned to register size");
    }
    // Range-check the full-width quotient BEFORE narrowing: an `as i8`
    // cast wraps mod 256, so an out-of-range offset whose wrapped value
    // landed back in [-64, 63] used to encode a silently wrong frame
    // offset (a 20x20 table's -1616 moved SP up by 432).
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

    let opc: u32 = if sf { 0b10 } else { 0b00 };
    let mode_bits: u32 = match mode {
        IndexMode::PostIndex => 0b01,
        IndexMode::Unsigned => 0b10,
        IndexMode::PreIndex => 0b11,
    };

    Ok((opc << 30) | (0b101 << 27) | (0 << 26) | (mode_bits << 23)
        | ((load as u32) << 22) | (imm7_enc << 15)
        | ((rt2 as u32) << 10) | ((rn as u32) << 5) | (rt as u32))
}

/// Encode `adr Rd, label` (byte-relative) or `adrp Rd, label` (page-
/// relative). The label resolves against the absolute symbol table; for
/// `adrp` the displacement is computed between the 4 KiB page of the
/// instruction and the page of the target, then encoded as the 21-bit
/// immediate the decoder shifts back left by 12.
fn encode_adr(
    ops: &[&str], adrp: bool, pc: u64, labels: &HashMap<String, u64>, ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "ADR/ADRP requires 2 operands");
    }
    let (rd, _) = parse_register(ops[0], ln)?;
    let target = ops[1].trim();
    let target_addr = if target.starts_with('#')
        || target.starts_with('-')
        || target.chars().next().is_some_and(|c| c.is_ascii_digit())
    {
        parse_immediate(target, ln)? as u64
    } else {
        *labels
            .get(target)
            .or_else(|| labels.get(&target.to_lowercase()))
            .ok_or_else(|| asm_error(ln, &format!("undefined label: {target}")))?
    };

    let imm: i64 = if adrp {
        let pc_page = (pc & !0xFFF) as i64;
        let target_page = (target_addr & !0xFFF) as i64;
        (target_page - pc_page) >> 12
    } else {
        target_addr as i64 - pc as i64
    };
    if !(-(1 << 20)..(1 << 20)).contains(&imm) {
        return asm_err(ln, "ADR/ADRP target out of +/-1MiB (or +/-4GiB page) range");
    }
    let imm21 = (imm as u32) & 0x1F_FFFF;
    let immlo = imm21 & 0x3;
    let immhi = (imm21 >> 2) & 0x7_FFFF;
    let op = if adrp { 1u32 } else { 0 };
    Ok((op << 31) | (immlo << 29) | (0b10000 << 24) | (immhi << 5) | (rd as u32))
}

fn encode_branch_imm(
    ops: &[&str], link: bool, pc: u64, labels: &HashMap<String, u64>, ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 1 {
        return asm_err(ln, "B/BL requires 1 operand");
    }
    let target = ops[0].trim();

    let offset_bytes = if target.starts_with('#') || target.starts_with('-') || target.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        parse_immediate(target, ln)?
    } else {
        // Labels in the cpsc 355 corpus are lowercase; the frontend
        // pipeline preserves case so GCC-emitted `.L2` works. Try both.
        let addr = labels
            .get(target)
            .or_else(|| labels.get(&target.to_lowercase()))
            .ok_or_else(|| asm_error(ln, &format!("undefined label: {target}")))?;
        *addr as i64 - pc as i64
    };

    if offset_bytes % 4 != 0 {
        return asm_err(ln, "branch offset must be 4-byte aligned");
    }
    check_branch_reach(offset_bytes / 4, 26, if link { "bl" } else { "b" }, ln)?;
    let imm26 = ((offset_bytes / 4) as u32) & 0x3FF_FFFF;

    let op = if link { 1u32 } else { 0 };
    Ok((op << 31) | (0b00101 << 26) | imm26)
}

fn encode_bcond(
    ops: &[&str], cond: u8, pc: u64, labels: &HashMap<String, u64>, ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 1 {
        return asm_err(ln, "B.cond requires 1 operand");
    }
    let target = ops[0].trim();

    let offset_bytes = if target.starts_with('#') || target.starts_with('-') || target.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        parse_immediate(target, ln)?
    } else {
        // Labels in the cpsc 355 corpus are lowercase; the frontend
        // pipeline preserves case so GCC-emitted `.L2` works. Try both.
        let addr = labels
            .get(target)
            .or_else(|| labels.get(&target.to_lowercase()))
            .ok_or_else(|| asm_error(ln, &format!("undefined label: {target}")))?;
        *addr as i64 - pc as i64
    };

    if offset_bytes % 4 != 0 {
        return asm_err(ln, "branch offset must be 4-byte aligned");
    }
    check_branch_reach(offset_bytes / 4, 19, "b.cond", ln)?;
    let imm19 = ((offset_bytes / 4) as u32) & 0x7FFFF;

    Ok(0x5400_0000 | (imm19 << 5) | (cond as u32))
}

/// Encode `CBZ / CBNZ Rt, label`. Reaches +/-1 MiB from the call site.
fn encode_compare_branch(
    ops: &[&str],
    nonzero: bool,
    pc: u64,
    labels: &HashMap<String, u64>,
    ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "CBZ/CBNZ requires 2 operands");
    }
    let (rt, sf) = parse_register(ops[0], ln)?;
    let target = ops[1].trim();
    let offset_bytes = resolve_branch_target(target, pc, labels, ln)?;
    if offset_bytes % 4 != 0 {
        return asm_err(ln, "branch offset must be 4-byte aligned");
    }
    check_branch_reach(offset_bytes / 4, 19, "cbz/cbnz", ln)?;
    let imm19 = ((offset_bytes / 4) as u32) & 0x7_FFFF;
    let sf_bit: u32 = if sf { 1 } else { 0 };
    let op_bit: u32 = if nonzero { 1 } else { 0 };
    Ok((sf_bit << 31)
        | (0b011010 << 25)
        | (op_bit << 24)
        | (imm19 << 5)
        | (rt as u32))
}

/// Encode `TBZ / TBNZ Rt, #bit, label`. Reaches +/-32 KiB from the call
/// site. `bit` selects which bit of `Rt` is tested: 0..63 for X, 0..31
/// for W.
fn encode_test_branch(
    ops: &[&str],
    nonzero: bool,
    pc: u64,
    labels: &HashMap<String, u64>,
    ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "TBZ/TBNZ requires 3 operands");
    }
    let (rt, sf) = parse_register(ops[0], ln)?;
    let bit = parse_immediate(ops[1], ln)?;
    if bit < 0 || bit > if sf { 63 } else { 31 } {
        return asm_err(ln, "TBZ/TBNZ bit index out of range");
    }
    let target = ops[2].trim();
    let offset_bytes = resolve_branch_target(target, pc, labels, ln)?;
    if offset_bytes % 4 != 0 {
        return asm_err(ln, "branch offset must be 4-byte aligned");
    }
    check_branch_reach(offset_bytes / 4, 14, "tbz/tbnz", ln)?;
    let imm14 = ((offset_bytes / 4) as u32) & 0x3FFF;
    let b5 = ((bit as u32) >> 5) & 1;
    let b40 = (bit as u32) & 0x1F;
    let op_bit: u32 = if nonzero { 1 } else { 0 };
    Ok((b5 << 31)
        | (0b011011 << 25)
        | (op_bit << 24)
        | (b40 << 19)
        | (imm14 << 5)
        | (rt as u32))
}

/// Range-check a branch displacement (in instructions) against the
/// encoding's signed immediate width BEFORE masking: masking alone wraps
/// an out-of-reach target into a silent branch to the wrong place. GAS
/// reports "branch out of range" for all of these.
fn check_branch_reach(
    offset_instrs: i64,
    imm_bits: u32,
    mnemonic: &str,
    ln: usize,
) -> Result<(), EmuError> {
    let lo = -(1i64 << (imm_bits - 1));
    let hi = (1i64 << (imm_bits - 1)) - 1;
    if !(lo..=hi).contains(&offset_instrs) {
        return Err(EmuError::AssemblyError {
            line: ln,
            message: format!(
                "{mnemonic} target is out of reach ({} bytes away; this branch reaches {} bytes each way) -- branch to a nearer label, or load the address and use br",
                offset_instrs * 4,
                hi * 4
            ),
        });
    }
    Ok(())
}

fn resolve_branch_target(
    target: &str,
    pc: u64,
    labels: &HashMap<String, u64>,
    ln: usize,
) -> Result<i64, EmuError> {
    if target.starts_with('#')
        || target.starts_with('-')
        || target.chars().next().is_some_and(|c| c.is_ascii_digit())
    {
        parse_immediate(target, ln)
    } else {
        let addr = labels
            .get(target)
            .or_else(|| labels.get(&target.to_lowercase()))
            .ok_or_else(|| asm_error(ln, &format!("undefined label: {target}")))?;
        Ok(*addr as i64 - pc as i64)
    }
}

fn encode_branch_reg(ops: &[&str], opc: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 1 {
        return asm_err(ln, "BR/BLR requires 1 operand");
    }
    let (rn, _) = parse_register(ops[0], ln)?;
    Ok(0xD61F_0000 | ((opc as u32) << 21) | ((rn as u32) << 5))
}

fn encode_ret(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let rn = if ops.is_empty() || ops[0].is_empty() {
        30 // default: X30
    } else {
        parse_register(ops[0], ln)?.0
    };
    // RET = BR variant with opc=0b0010
    Ok(0xD61F_0000 | (0b0010 << 21) | ((rn as u32) << 5))
}

fn encode_cond_sel(ops: &[&str], op2: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, "CSEL/CSINC requires 4 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let cond = parse_condition(ops[3], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    Ok((sf_bit << 31) | (0b0011010100 << 21) | ((rm as u32) << 16)
        | ((cond as u32) << 12) | ((op2 as u32) << 10)
        | ((rn as u32) << 5) | (rd as u32))
}

fn encode_cset(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // CSET Xd, cond -> CSINC Xd, XZR, XZR, invert(cond)
    if ops.len() != 2 {
        return asm_err(ln, "CSET requires 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let cond = parse_condition(ops[1], ln)?;
    // GAS rejects `cset al`: the alias encodes the INVERTED condition, and
    // AL has no invertible spelling. Accepting it would silently produce an
    // always-1 CSINC the server toolchain refuses to assemble.
    if cond == 0b1110 {
        return asm_err(ln, "CSET cannot use the AL condition (there is nothing to invert; use `mov Xd, 1`)");
    }
    let inv_cond = cond ^ 1; // invert low bit
    let sf_bit = if sf { 1u32 } else { 0 };

    Ok((sf_bit << 31) | (0b0011010100 << 21) | (0b11111 << 16)
        | ((inv_cond as u32) << 12) | (1 << 10)
        | (0b11111 << 5) | (rd as u32))
}

fn encode_svc(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let imm = if ops.is_empty() || ops[0].is_empty() {
        0
    } else {
        parse_immediate(ops[0], ln)? as u16
    };
    Ok(0xD400_0001 | ((imm as u32) << 5))
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cpu::Cpu;

    #[test]
    fn assemble_mov_add_halt() {
        let source = r#"
            MOV X0, #10
            MOV X1, #20
            ADD X2, X0, X1
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        assert_eq!(code.len(), 4);

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();

        assert_eq!(cpu.regs.read_gpr(0, true), 10);
        assert_eq!(cpu.regs.read_gpr(1, true), 20);
        assert_eq!(cpu.regs.read_gpr(2, true), 30);
        assert!(cpu.is_halted());
    }

    #[test]
    fn assemble_labels_and_branches() {
        let source = r#"
            MOV X0, #5
        loop:
            SUBS X0, X0, #1
            B.NE loop
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(100).unwrap();

        assert_eq!(cpu.regs.read_gpr(0, true), 0);
        assert!(cpu.is_halted());
    }

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
    fn cset_rejects_al_like_gas() {
        let labels = HashMap::new();
        let err = encode_line("cset x0, al", 0, &labels, 3).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("AL"), "was: {msg}");
        // The raw CSINC form keeps taking AL, exactly as GAS does.
        encode_line("csinc x0, xzr, xzr, al", 0, &labels, 3).unwrap();
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
    fn assemble_factorial() {
        let source = r#"
            MOV X0, #5       // n = 5
            MOV X1, #1       // result = 1
        loop:
            MUL X1, X1, X0   // result *= n
            SUBS X0, X0, #1  // n--
            B.GT loop
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(100).unwrap();

        assert_eq!(cpu.regs.read_gpr(1, true), 120); // 5! = 120
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
    fn out_of_range_shift_amounts_are_rejected_not_rewritten() {
        // Each of these used to assemble silently into a DIFFERENT
        // instruction through u8 wrap + field overflow; GAS rejects all.
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
        // The LSLV/LSRV/ASRV encoders existed but the decoder could not
        // read them back: `lsl x0, x1, x2` assembled fine then died
        // mid-run with a raw hex word.
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
        // `add x0, sp, x1` read rn=31 as XZR before the extended form
        // existed: x0 became 16 and the frame maths silently collapsed.
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
    fn pair_offset_out_of_range_is_rejected_not_wrapped() {
        // -1616 / 8 = -202, which wraps to +54 through an i8 cast; the
        // encoder must reject it, naming the reachable range.
        let err = assemble("STP X29, X30, [SP, #-1616]!").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("-1616"), "message was: {msg}");
        assert!(msg.contains("[-512, 504]"), "message was: {msg}");

        // +1536 / 8 = 192 wraps to -64: also silently in range before.
        assert!(assemble("STP X0, X1, [SP, #1536]").is_err());

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
    fn ldrs_offset_rejections_name_the_actual_cause() {
        // A negative offset must not be blamed on alignment (ldrsb has
        // scale 1; alignment cannot apply).
        let err = assemble("LDRSB W0, [X1, #-1]").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("ldrsb"), "was: {msg}");
        assert!(msg.contains("sxtb"), "was: {msg}");
        assert!(!msg.contains("align"), "was: {msg}");
        // A misaligned positive offset names the offset and the multiple.
        let err = assemble("LDRSH W0, [X1, #3]").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("multiple of 2"), "was: {msg}");
        // Zero stays accepted.
        assert!(assemble("LDRSB W0, [X1]").is_ok());
        assert!(assemble("LDRSB W0, [X1, #0]").is_ok());
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
        assert!(assemble("ADD W0, W1, W2, LSL #32").is_err());
        let err = assemble("ADD X0, X1, X2, FOO #3").unwrap_err();
        assert!(err.to_string().contains("shift modifier"), "was: {err}");
    }

    #[test]
    fn bare_fp_and_lr_are_predefined_like_gas() {
        // stp fp, lr, [sp, #-16]! == stp x29, x30, [sp, #-16]!
        assert_eq!(
            assemble("STP FP, LR, [SP, #-16]!").unwrap()[0],
            assemble("STP X29, X30, [SP, #-16]!").unwrap()[0]
        );
        assert_eq!(
            assemble("MOV FP, SP").unwrap()[0],
            assemble("MOV X29, SP").unwrap()[0]
        );
        assert_eq!(
            assemble("LDR X0, [FP, #8]").unwrap()[0],
            assemble("LDR X0, [X29, #8]").unwrap()[0]
        );
        // The fallback echoes the token as typed.
        let err = assemble("mov foo, #1").unwrap_err();
        assert!(err.to_string().contains("`foo`"), "was: {err}");
    }

    #[test]
    fn logical_immediates_mask_to_the_register_width() {
        // GAS accepts `and w0, w1, #-2` as #0xfffffffe (31 ones, one zero);
        // 0x0A7D_F820 read off the A64 logical-immediate tables: sf=0,
        // opc=00, N=0, immr=63&31->31? -- verified against gcc output.
        let w = assemble("AND W0, W1, #-2").unwrap()[0];
        assert_eq!(w, assemble("AND W0, W1, #0xFFFFFFFE").unwrap()[0]);
        // The evaluator's ~1 spelling arrives here as -2 as well.
        let x = assemble("AND X0, X1, #-2").unwrap()[0];
        assert_eq!(x, 0x927F_F820);
        // A genuinely invalid pattern names the remedy.
        let err = assemble("AND W0, W1, #0x12345").unwrap_err();
        assert!(err.to_string().contains("mov"), "was: {err}");
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
    fn same_line_label_and_instruction_assemble() {
        // GAS lets a label share a line with an instruction; the two-pass
        // encoder used to read `loop:` as the mnemonic. The same-line form
        // must assemble identically to the own-line form and resolve the
        // branch target correctly.
        let same = assemble("mov x0, 5
loop: subs x0, x0, 1
b.ne loop
svc 0").unwrap();
        let own = assemble("mov x0, 5
loop:
subs x0, x0, 1
b.ne loop
svc 0").unwrap();
        assert_eq!(same, own);
        assert_eq!(same.len(), 4);
    }

    #[test]
    fn mov_encodes_positive_all_ones_as_movn() {
        // GAS encodes `mov w0, #0xffffffff` as MOVN w0, #0 (0x12800000) and
        // `mov x0, #-1` as MOVN x0, #0 (0x92800000). The old path only tried
        // MOVN for negative literals, rejecting the positive hex form.
        assert_eq!(assemble("mov w0, #0xffffffff").unwrap()[0], 0x1280_0000);
        assert_eq!(assemble("mov x0, #-1").unwrap()[0], 0x9280_0000);
        // 0xfffffffe fits MOVN but not MOVZ (both halves nonzero): the
        // inverse is 0x1, so MOVN w0, #1 (0x12800020). (0xffff0000 would
        // reach the MOVZ-shifted path first, so it is not a MOVN case.)
        assert_eq!(assemble("mov w0, #0xfffffffe").unwrap()[0], 0x1280_0020);
        // a value that fits neither MOVZ nor MOVN still needs movz+movk.
        assert!(assemble("mov w0, #0x12345678").is_err());
    }

    #[test]
    fn movk_with_a_non_lsl_shift_is_rejected() {
        // A dropped third operand left hw = 0: `movk x0, #0xDEAD, #16`
        // destroyed the low halfword the movz just placed, silently.
        let err = assemble("MOVK X0, #0xDEAD, #16").unwrap_err();
        assert!(err.to_string().contains("lsl"), "was: {err}");
        assert!(assemble("MOVK X0, #0xDEAD, LSR #16").is_err());
        assert!(assemble("MOVZ X0, #1, FOO #16").is_err());
        assert!(assemble("MOVZ X0, #1, LSL #16, LSL #32").is_err());
        assert!(assemble("MOVK X0, #0xDEAD, LSL #16").is_ok());
    }

    #[test]
    fn register_offset_scale_follows_the_written_amount() {
        // The S bit used to ride on the mere PRESENCE of an amount, so
        // `lsl #0` scaled by 8 and every wrong amount silently rescaled.
        assert_eq!(assemble("LDR X0, [X1, X2]").unwrap()[0], 0xF862_6820);
        assert_eq!(assemble("LDR X0, [X1, X2, LSL #0]").unwrap()[0], 0xF862_6820);
        assert_eq!(assemble("LDR X0, [X1, X2, LSL #3]").unwrap()[0], 0xF862_7820);
        assert_eq!(assemble("LDR W0, [X1, X2, LSL #2]").unwrap()[0], 0xB862_7820);
        // Non-canonical amounts are GAS hard errors, never a rescale.
        let err = assemble("LDR X0, [X1, X2, LSL #2]").unwrap_err();
        assert!(err.to_string().contains("#0 or #3"), "was: {err}");
        assert!(assemble("LDR W0, [X1, X2, LSL #3]").is_err());
        assert!(assemble("LDR X0, [X1, W2, SXTW #7]").is_err());
        // SXTW with the canonical amount still scales.
        assert!(assemble("LDR X0, [X1, W2, SXTW #3]").is_ok());
        assert!(assemble("LDR X0, [X1, W2, SXTW #0]").is_ok());
    }

    #[test]
    fn mixed_width_pairs_are_rejected() {
        // GAS rejects these; accepting them stored the wrong width and
        // both registers reloaded garbage.
        let err = assemble("STP X0, W1, [SP, #0]").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("same width"), "was: {msg}");
        assert!(assemble("STP W0, X1, [SP, #0]").is_err());
        assert!(assemble("LDP X0, W1, [SP, #0]").is_err());
        assert!(assemble("LDP W2, W3, [SP], #16").is_ok());
    }

    #[test]
    fn pair_offset_boundaries_encode() {
        assert!(assemble("STP X0, X1, [SP, #-512]").is_ok());
        assert!(assemble("STP X0, X1, [SP, #504]").is_ok());
        assert!(assemble("STP W0, W1, [SP, #-256]").is_ok());
        assert!(assemble("STP W0, W1, [SP, #252]").is_ok());
        assert!(assemble("STP X0, X1, [SP, #-520]").is_err());
        assert!(assemble("STP X0, X1, [SP, #512]").is_err());
    }

    #[test]
    fn assemble_bl_ret() {
        let source = r#"
            MOV X0, #10
            BL double
            SVC #0
        double:
            ADD X0, X0, X0
            RET
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(0, true), 20);
    }

    #[test]
    fn assemble_comments_stripped() {
        let source = r#"
            // this is a comment
            MOV X0, #1   // inline comment
            SVC #0       ; another style
        "#;
        let code = assemble(source).unwrap();
        assert_eq!(code.len(), 2);
    }

    #[test]
    fn assemble_error_on_unknown() {
        let result = assemble("FOOBAR X0, X1");
        assert!(result.is_err());
    }

    // -- msub / madd / char literals --

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

    #[test]
    fn char_literal_in_immediate() {
        // `mov w19, 'A'` should encode as `mov w19, #65`.
        let code = assemble("MOV W19, 'A'").unwrap();
        let reference = assemble("MOV W19, #65").unwrap();
        assert_eq!(code, reference);
    }

    #[test]
    fn char_literal_escape_sequence() {
        let code = assemble("MOV W0, '\\n'").unwrap();
        let reference = assemble("MOV W0, #10").unwrap();
        assert_eq!(code, reference);
    }

    #[test]
    fn char_literal_hex_escape() {
        let code = assemble("MOV W0, '\\x41'").unwrap();
        let reference = assemble("MOV W0, #65").unwrap();
        assert_eq!(code, reference);
    }

    #[test]
    fn char_literal_semicolon_is_not_a_comment() {
        // The comment stripper once cut the line at the `;`, leaving a
        // dangling quote and an invalid-immediate error.
        let code = assemble("MOV W1, ';'").unwrap();
        let reference = assemble("MOV W1, #59").unwrap();
        assert_eq!(code, reference);
        // A real trailing comment still strips.
        let commented = assemble("MOV W1, #59 ; the separator").unwrap();
        assert_eq!(commented, reference);
    }

    // -- sign-extending loads --

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
        assert!(assemble("LDRSW W0, [X1, #0]").is_err());
        assert!(assemble("LDRSW X0, [X1, #0]").is_ok());
    }

    // -- floating-point --

    #[test]
    fn assemble_fadd_round_trips() {
        let code = assemble("FADD D0, D1, D2").unwrap();
        let decoded = crate::decoder::decode(code[0]).unwrap();
        match decoded {
            crate::decoder::Instruction::FpBinary { op, fd, fn_, fm, single: false } => {
                assert_eq!(op, crate::decoder::FpBinOp::Fadd);
                assert_eq!(fd, 0);
                assert_eq!(fn_, 1);
                assert_eq!(fm, 2);
            }
            other => panic!("expected FpBinary, got {other:?}"),
        }
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
    fn assemble_fneg_round_trips() {
        let code = assemble("fneg d16, d16").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::FpUnary { op, fd, fn_, single: false } => {
                assert_eq!(op, crate::decoder::FpUnaryOp::Fneg);
                assert_eq!((fd, fn_), (16, 16));
            }
            other => panic!("expected FpUnary, got {other:?}"),
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
    fn assemble_fabs_round_trips() {
        let code = assemble("fabs d10, d11").unwrap();
        match crate::decoder::decode(code[0]).unwrap() {
            crate::decoder::Instruction::FpUnary { op, fd, fn_, single: false } => {
                assert_eq!(op, crate::decoder::FpUnaryOp::Fabs);
                assert_eq!((fd, fn_), (10, 11));
            }
            other => panic!("expected FpUnary, got {other:?}"),
        }
    }

    #[test]
    fn assemble_fsqrt_round_trips_both_widths() {
        for (src, single) in [("fsqrt d9, d8", false), ("fsqrt s9, s8", true)] {
            let code = assemble(src).unwrap();
            match crate::decoder::decode(code[0]).unwrap() {
                crate::decoder::Instruction::FpUnary { op, fd, fn_, single: got } => {
                    assert_eq!(op, crate::decoder::FpUnaryOp::Fsqrt);
                    assert_eq!((fd, fn_), (9, 8));
                    assert_eq!(got, single, "{src}: wrong width");
                }
                other => panic!("expected FpUnary, got {other:?}"),
            }
        }
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
        assert!(assemble("fmov d0, 0.1").is_err());
        assert!(assemble("fmov d0, 100.0").is_err());
        assert!(assemble("fmov d0, 0.0").is_err());
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
        assert!(assemble("fmov s0, d1").is_err());
        assert!(assemble("fcmp s0, d1").is_err());
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
    fn assemble_scvtf_and_fcvtzs_single_round_trip() {
        // scvtf s0, w1 pinned against the real assembler.
        let scvtf = assemble("scvtf s0, w1").unwrap();
        assert_eq!(scvtf[0], 0x1E22_0020);
        match crate::decoder::decode(scvtf[0]).unwrap() {
            crate::decoder::Instruction::FpScvtf { fd, rn, sf: false, single: true } => {
                assert_eq!((fd, rn), (0, 1));
            }
            other => panic!("expected single FpScvtf, got {other:?}"),
        }
        let fcvtzs = assemble("fcvtzs w0, s1").unwrap();
        match crate::decoder::decode(fcvtzs[0]).unwrap() {
            crate::decoder::Instruction::FpFcvtzs { rd, fn_, sf: false, single: true } => {
                assert_eq!((rd, fn_), (0, 1));
            }
            other => panic!("expected single FpFcvtzs, got {other:?}"),
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
                | crate::decoder::Instruction::FpScvtf { single: false, .. }
                | crate::decoder::Instruction::FpFcvtzs { single: false, .. } => {}
                other => panic!("unexpected decode for `{src}`: {other:?}"),
            }
        }
    }

    // -- m4 expansion integrated with the encoder --

    #[test]
    fn assemble_expands_m4_register_aliases() {
        // `define(fp, x29)` should make `fp` an alias for `x29` before the
        // encoder sees the line.
        let with_alias = assemble("define(fp, x29)\nADD fp, fp, #1\n").unwrap();
        let without_alias = assemble("ADD X29, X29, #1").unwrap();
        assert_eq!(with_alias, without_alias);
    }

    #[test]
    fn assemble_expands_multiple_aliases() {
        let program = "define(fp, x29)\ndefine(lr, x30)\nMOV fp, lr\n";
        let code = assemble(program).unwrap();
        let reference = assemble("MOV X29, X30").unwrap();
        assert_eq!(code, reference);
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

    // -- ADR / ADRP --

    #[test]
    fn assemble_adrp_then_add_lo12_reaches_label() {
        // adrp computes the page; the decoded byte displacement reflects the
        // label's page minus the instruction's page.
        let mut labels = HashMap::new();
        labels.insert("sym".to_string(), 0x0060_1234u64);
        let pc = 0x0040_0000u64;
        let word = encode_line_absolute("ADRP X0, sym", pc, &labels, 1).unwrap();
        match crate::decoder::decode(word).unwrap() {
            crate::decoder::Instruction::Adr { adrp, rd, imm } => {
                assert!(adrp);
                assert_eq!(rd, 0);
                // (0x0060_1000 - 0x0040_0000) = 0x20_1000.
                assert_eq!(imm, 0x20_1000);
            }
            other => panic!("expected Adr, got {other:?}"),
        }
    }

    // -- binary immediates --

    #[test]
    fn assemble_binary_immediate_matches_decimal() {
        let bin = assemble("MOV W0, #0b101010").unwrap();
        let dec = assemble("MOV W0, #42").unwrap();
        assert_eq!(bin, dec);
    }

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
    fn assemble_bic_rejects_immediate() {
        assert!(assemble("BIC X0, X1, #0xF0").is_err());
        assert!(assemble("BIC W0, W1, 15").is_err());
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
        assert!(assemble("UBFX W0, W1, #28, #8").is_err());
        // Zero width.
        assert!(assemble("UBFX X0, X1, #4, #0").is_err());
        // lsb outside the register.
        assert!(assemble("UBFX W0, W1, #32, #1").is_err());
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
    fn assemble_bfi_rejects_out_of_range_fields() {
        assert!(assemble("BFI W0, W1, #30, #4").is_err());
        assert!(assemble("BFI X0, X1, #0, #0").is_err());
        assert!(assemble("BFI W0, W1, #32, #1").is_err());
    }

    #[test]
    fn assemble_rejects_m4_construct_and_reports_line() {
        let err = assemble("define(fp, x29)\nifdef(FOO, bar)\n").unwrap_err();
        match err {
            crate::errors::EmuError::PreprocError { line, .. } => {
                assert_eq!(line, 2);
            }
            other => panic!("expected PreprocError at line 2, got {other:?}"),
        }
    }

    // -- the supported-mnemonic list --

    #[test]
    fn supported_mnemonics_all_reach_an_arm() {
        // Probe the dispatch at the layer it lives on: hand `encode_line` the
        // bare mnemonic with no operands at all. What comes back does not
        // matter -- an operand-count complaint, or an encoding for the forms
        // that take no operands -- because only the fallthrough produces
        // "unknown mnemonic". So this fails on exactly one thing: an entry
        // here that the match no longer has an arm for.
        let labels: HashMap<String, u64> = HashMap::new();
        for mnemonic in SUPPORTED_MNEMONICS {
            let message = match encode_line(mnemonic, 0, &labels, 1) {
                Ok(_) => continue,
                Err(EmuError::AssemblyError { message, .. }) => message,
                Err(other) => {
                    panic!("`{mnemonic}` failed with a non-assembly error: {other:?}")
                }
            };
            assert!(
                !message.starts_with("unknown mnemonic"),
                "`{mnemonic}` is listed in SUPPORTED_MNEMONICS but falls through \
                 the dispatch: {message}",
            );
        }
    }

    #[test]
    fn supported_mnemonics_has_no_duplicates() {
        // A duplicate would let a real arm hide behind a repeated name and
        // still keep the count looking right.
        let mut seen = std::collections::HashSet::new();
        for mnemonic in SUPPORTED_MNEMONICS {
            assert!(seen.insert(*mnemonic), "`{mnemonic}` is listed twice");
        }
    }

    #[test]
    fn supported_mnemonics_bcond_block_matches_the_condition_table() {
        // The const cannot derive from the table at compile time, so this
        // pins the two to each other: every spelling the table implies is
        // listed, and nothing else in the const looks like a bcond.
        let mut expected = std::collections::BTreeSet::new();
        for (primary, aliases, _) in CONDITIONS {
            expected.insert(format!("B.{primary}"));
            expected.insert(format!("B{primary}"));
            for alias in *aliases {
                expected.insert(format!("B.{alias}"));
                expected.insert(format!("B{alias}"));
            }
        }
        let listed: std::collections::BTreeSet<String> = SUPPORTED_MNEMONICS
            .iter()
            .filter(|m| bcond_condition(m).is_some())
            .map(|m| m.to_string())
            .collect();
        assert_eq!(
            listed, expected,
            "SUPPORTED_MNEMONICS' conditional-branch block disagrees with the condition table"
        );
    }

    #[test]
    fn bcond_lookup_never_claims_a_non_branch() {
        for mn in ["B", "BL", "BLR", "BR", "BIC", "BFI", "BAD"] {
            assert!(
                bcond_condition(mn).is_none(),
                "`{mn}` must not parse as a conditional branch"
            );
        }
    }

    #[test]
    fn b_al_assembles_as_the_always_branch() {
        let labels = HashMap::from([("target".to_string(), 8u64)]);
        for spelling in ["b.al target", "bal target", "B.AL target"] {
            let word = encode_line(spelling, 0, &labels, 1).unwrap();
            assert_eq!(word, 0x5400_004E, "{spelling}");
        }
    }
}
