use std::collections::HashMap;

use crate::decoder::{
    MemSize, DP1_OPS, FP_BINARY_OPS, FP_FROM_INT_OPS, FP_MUL_ADD_OPS, FP_TO_INT_OPS,
    FP_UNARY_OPS, LDST_EXTENDS,
};
use crate::errors::EmuError;
use crate::registers::{reg_alias, Condition, CONDITIONS};

/// Assemble ARM64 source text into a vector of 32-bit instruction words.
///
/// Runs m4 expansion first so `define(fp, x29)` and `name = expr` aliases
/// from cpsc 355 source expand before the single-pass encoder sees them.
/// The expansion is line-aligned with the input, so encoder errors still
/// carry the original (pre-expansion) line number. Expression-level
/// numeric substitutions in operands are the hosted pipeline's job;
/// `frontend::pipeline::lower_operands` folds them before this encoder
/// sees the line.
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
            // GAS rejects a redefined label; a last-wins insert sends
            // branches to whichever copy comes later.
            if labels.contains_key(&name) {
                return asm_err(
                    *line_num,
                    &format!(
                        "label `{name}` is already defined. Give each label a \
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
/// instruction share a line (`loop: subs x0, x0, 1`). Recognizing a label
/// only when it is the WHOLE line sends the same-line idiom to
/// `encode_line` with `loop:` read as the mnemonic. The legacy
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
    // arithmetic with carry (register only)
    "ADC", "ADCS", "SBC", "SBCS",
    // compare (aliases) and the conditional compares
    "CMP", "CMN", "CCMP", "CCMN",
    // logical
    "AND", "ANDS", "ORR", "EOR", "BIC", "ORN", "EON", "MVN", "TST",
    // shifts and rotate
    "LSL", "LSR", "ASR", "ROR",
    // sign / zero extension
    "SXTB", "SXTH", "SXTW", "UXTB", "UXTH", "UXTW",
    // bitfield extract / insert
    "UBFX", "SBFX", "BFI", "BFXIL", "UBFIZ", "SBFIZ",
    // bit and byte reversal, leading-bit counts
    "CLZ", "CLS", "RBIT", "REV", "REV16", "REV32",
    // multiply / divide
    "MUL", "UDIV", "SDIV", "MADD", "MSUB", "MNEG", "NEG", "NEGS",
    "SMULL", "UMULL", "SMULH", "UMULH",
    "SMADDL", "SMSUBL", "UMADDL", "UMSUBL", "SMNEGL", "UMNEGL",
    // memory
    "LDR", "STR", "LDRB", "STRB", "LDRH", "STRH", "LDRSB", "LDRSH", "LDRSW",
    // the unscaled and no-allocate spellings (SIMD&FP registers only)
    "LDUR", "STUR", "LDNP", "STNP",
    // floating-point
    "FADD", "FSUB", "FMUL", "FDIV", "FNMUL", "FMOV", "FNEG", "FABS", "FSQRT", "FCMP", "FCMPE",
    "FMAX", "FMIN", "FMAXNM", "FMINNM", "FCSEL",
    "FMADD", "FMSUB", "FNMADD", "FNMSUB",
    "FCVT", "SCVTF", "UCVTF", "FCVTZS", "FCVTNS", "FCVTNU", "LDP", "STP",
    // the rest of the float-to-integer rounding modes
    "FCVTZU", "FCVTAS", "FCVTAU", "FCVTMS", "FCVTMU", "FCVTPS", "FCVTPU",
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
    "CSEL", "CSINC", "CSINV", "CSNEG", "CSET", "CSETM", "CINC", "CINV", "CNEG",
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

        // -- arithmetic with carry (register only) --
        "ADC" => encode_carry(&ops, false, false, line_num),
        "ADCS" => encode_carry(&ops, false, true, line_num),
        "SBC" => encode_carry(&ops, true, false, line_num),
        "SBCS" => encode_carry(&ops, true, true, line_num),

        // -- compare (aliases) --
        "CMP" => encode_cmp(&ops, 1, line_num),
        "CMN" => encode_cmp(&ops, 0, line_num),
        "CCMP" => encode_cond_compare(&ops, 1, "ccmp", line_num),
        "CCMN" => encode_cond_compare(&ops, 0, "ccmn", line_num),

        // -- logical --
        "AND" => encode_log_dispatch(&ops, 0b00, line_num),
        "ANDS" => encode_log_dispatch(&ops, 0b11, line_num),
        "ORR" => encode_log_dispatch(&ops, 0b01, line_num),
        "EOR" => encode_log_dispatch(&ops, 0b10, line_num),
        "BIC" => encode_bic(&ops, line_num),
        "ORN" => encode_log_reg(&ops, 0b01, true, line_num),
        "EON" => encode_log_reg(&ops, 0b10, true, line_num),
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
        "UXTW" => encode_extend_word(&ops, line_num),

        // -- bitfield extract / insert (SBFM / UBFM / BFM aliases) --
        "UBFX" => encode_bitfield_alias(&ops, "UBFX", 0b10, BitfieldForm::Extract, line_num),
        "SBFX" => encode_bitfield_alias(&ops, "SBFX", 0b00, BitfieldForm::Extract, line_num),
        "BFI"  => encode_bitfield_alias(&ops, "BFI",  0b01, BitfieldForm::Insert,  line_num),
        "BFXIL" => encode_bitfield_alias(&ops, "BFXIL", 0b01, BitfieldForm::Extract, line_num),
        "UBFIZ" => encode_bitfield_alias(&ops, "UBFIZ", 0b10, BitfieldForm::Insert,  line_num),
        "SBFIZ" => encode_bitfield_alias(&ops, "SBFIZ", 0b00, BitfieldForm::Insert,  line_num),

        // -- bit and byte reversal, leading-bit counts --
        "CLZ" => encode_dp1(&ops, "clz", line_num),
        "CLS" => encode_dp1(&ops, "cls", line_num),
        "RBIT" => encode_dp1(&ops, "rbit", line_num),
        "REV" => encode_dp1(&ops, "rev", line_num),
        "REV16" => encode_dp1(&ops, "rev16", line_num),
        "REV32" => encode_dp1(&ops, "rev32", line_num),

        // -- multiply / divide --
        "MUL" => encode_mul_div(&ops, 0, line_num),
        "UDIV" => encode_mul_div(&ops, 1, line_num),
        "SDIV" => encode_mul_div(&ops, 2, line_num),
        "MADD" => encode_mul_accumulate(&ops, false, line_num),
        "MSUB" => encode_mul_accumulate(&ops, true, line_num),
        "MNEG" => encode_mneg(&ops, line_num),
        "SMULL" => encode_mul_wide(&ops, 0b001, true, 0, false, line_num),
        "UMULL" => encode_mul_wide(&ops, 0b101, true, 0, false, line_num),
        "SMULH" => encode_mul_wide(&ops, 0b010, false, 0, false, line_num),
        "UMULH" => encode_mul_wide(&ops, 0b110, false, 0, false, line_num),
        "SMADDL" => encode_mul_wide(&ops, 0b001, true, 0, true, line_num),
        "SMSUBL" => encode_mul_wide(&ops, 0b001, true, 1, true, line_num),
        "UMADDL" => encode_mul_wide(&ops, 0b101, true, 0, true, line_num),
        "UMSUBL" => encode_mul_wide(&ops, 0b101, true, 1, true, line_num),
        "SMNEGL" => encode_mneg_wide(&ops, 0b001, line_num),
        "UMNEGL" => encode_mneg_wide(&ops, 0b101, line_num),
        "NEG" => encode_neg(&ops, false, line_num),
        "NEGS" => encode_neg(&ops, true, line_num),

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
        "LDUR" => encode_ldur_stur(&ops, 1, line_num),
        "STUR" => encode_ldur_stur(&ops, 0, line_num),

        // -- floating-point --
        "FADD" => encode_fp_binary(&ops, "fadd", line_num),
        "FSUB" => encode_fp_binary(&ops, "fsub", line_num),
        "FMUL" => encode_fp_binary(&ops, "fmul", line_num),
        "FDIV" => encode_fp_binary(&ops, "fdiv", line_num),
        "FNMUL" => encode_fp_binary(&ops, "fnmul", line_num),
        "FMAX" => encode_fp_binary(&ops, "fmax", line_num),
        "FMIN" => encode_fp_binary(&ops, "fmin", line_num),
        "FMAXNM" => encode_fp_binary(&ops, "fmaxnm", line_num),
        "FMINNM" => encode_fp_binary(&ops, "fminnm", line_num),
        "FCSEL" => encode_fcsel(&ops, line_num),
        "FMADD" => encode_fp_mul_add(&ops, "fmadd", line_num),
        "FMSUB" => encode_fp_mul_add(&ops, "fmsub", line_num),
        "FNMADD" => encode_fp_mul_add(&ops, "fnmadd", line_num),
        "FNMSUB" => encode_fp_mul_add(&ops, "fnmsub", line_num),
        "FMOV" => encode_fmov(&ops, line_num),
        "FNEG" => encode_fp_unary(&ops, "fneg", line_num),
        "FABS" => encode_fp_unary(&ops, "fabs", line_num),
        "FSQRT" => encode_fp_unary(&ops, "fsqrt", line_num),
        "FCMP" => encode_fcmp(&ops, false, line_num),
        "FCMPE" => encode_fcmp(&ops, true, line_num),
        "FCVT" => encode_fcvt(&ops, line_num),
        "SCVTF" => encode_fp_cvt_from_int(&ops, "scvtf", line_num),
        "UCVTF" => encode_fp_cvt_from_int(&ops, "ucvtf", line_num),
        "FCVTZS" => encode_fp_cvt_int(&ops, "fcvtzs", line_num),
        "FCVTNS" => encode_fp_cvt_int(&ops, "fcvtns", line_num),
        "FCVTNU" => encode_fp_cvt_int(&ops, "fcvtnu", line_num),
        "FCVTZU" => encode_fp_cvt_int(&ops, "fcvtzu", line_num),
        "FCVTAS" => encode_fp_cvt_int(&ops, "fcvtas", line_num),
        "FCVTAU" => encode_fp_cvt_int(&ops, "fcvtau", line_num),
        "FCVTMS" => encode_fp_cvt_int(&ops, "fcvtms", line_num),
        "FCVTMU" => encode_fp_cvt_int(&ops, "fcvtmu", line_num),
        "FCVTPS" => encode_fp_cvt_int(&ops, "fcvtps", line_num),
        "FCVTPU" => encode_fp_cvt_int(&ops, "fcvtpu", line_num),
        "LDP" => encode_ldst_pair(&ops, 1, line_num),
        "STP" => encode_ldst_pair(&ops, 0, line_num),
        "LDNP" => encode_ldst_pair_no_allocate(&ops, 1, line_num),
        "STNP" => encode_ldst_pair_no_allocate(&ops, 0, line_num),

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
        "CSEL" => encode_cond_sel(&ops, 0, 0, line_num),
        "CSINC" => encode_cond_sel(&ops, 0, 1, line_num),
        "CSINV" => encode_cond_sel(&ops, 1, 0, line_num),
        "CSNEG" => encode_cond_sel(&ops, 1, 1, line_num),
        "CSET"  => encode_cond_sel_alias(&ops, "CSET",  0, 1, false, line_num),
        "CSETM" => encode_cond_sel_alias(&ops, "CSETM", 1, 0, false, line_num),
        "CINC"  => encode_cond_sel_alias(&ops, "CINC",  0, 1, true,  line_num),
        "CINV"  => encode_cond_sel_alias(&ops, "CINV",  1, 0, true,  line_num),
        "CNEG"  => encode_cond_sel_alias(&ops, "CNEG",  1, 1, true,  line_num),

        // -- system --
        "NOP" => Ok(crate::decoder::NOP_WORD),
        "SVC" => encode_svc(&ops, line_num),

        _ => asm_err(line_num, &format!("unknown mnemonic `{mn}`: {UNKNOWN_MNEMONIC_HINT}")),
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
    // sp/xzr/wzr/fp/lr come from the shared alias table in registers.rs so
    // the encoder and the operand recognizers cannot disagree about the set.
    if let Some((num, sf)) = reg_alias(&s) {
        return Ok((num, sf));
    }
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
        return asm_err(
            line_num,
            &format!(
                "`{s}` is not a register: the general-purpose registers are x0 through \
                 x30 (or w0 through w30), plus xzr/wzr and sp"
            ),
        );
    }
    Ok((num, sf))
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
            .map_err(|_| {
                asm_error(
                    line_num,
                    &format!(
                        "`{s}` is not a valid hex number: hex literals are 0x followed \
                         by hex digits"
                    ),
                )
            })?
    } else if let Some(bin) = s.strip_prefix("0b").or_else(|| s.strip_prefix("0B")) {
        // Binary immediates (`#0b101010`) are a documented course form; the
        // lexer already accepts them, so the legacy encoder must too.
        u64::from_str_radix(bin, 2)
            .map_err(|_| {
                asm_error(
                    line_num,
                    &format!(
                        "`{s}` is not a valid binary number: binary literals are 0b \
                         followed by 0s and 1s"
                    ),
                )
            })?
    } else {
        s.parse()
            .map_err(|_| {
                asm_error(
                    line_num,
                    &format!(
                        "`{s}` is not a number the assembler can read here: write \
                         decimal as 42, hex as 0x2a, binary as 0b101010, and a \
                         character as 'a'"
                    ),
                )
            })?
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
            // Two digits exactly here, unlike the lexer's greedy GAS walk:
            // this path only sees legacy bare-metal source, where no course
            // file writes a one- or three-digit escape.
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
        None => asm_err(
            line_num,
            &format!(
                "unknown condition code `{s}`: the codes are {}",
                condition_code_list()
            ),
        ),
    }
}

/// The condition spellings, read off `CONDITIONS` rather than written out,
/// so a row added to the table cannot leave the message behind.
fn condition_code_list() -> String {
    let names: Vec<String> = CONDITIONS
        .iter()
        .map(|(primary, aliases, _)| {
            std::iter::once(*primary)
                .chain(aliases.iter().copied())
                .map(str::to_lowercase)
                .collect::<Vec<_>>()
                .join("/")
        })
        .collect();
    match names.split_last() {
        Some((last, rest)) => format!("{}, and {last}", rest.join(", ")),
        None => String::new(),
    }
}

/// The condition operand of the instructions GAS lets carry `nv`.
/// `CONDITIONS` leaves NV out because no conditional branch spells it
/// (GAS refuses `bnv`), but `ccmp`, `ccmn` and `fcsel` all take it, and
/// the hardware runs condition 1111 as always, exactly like AL.
fn parse_condition_allowing_nv(s: &str, line_num: usize) -> Result<u8, EmuError> {
    if s.trim().eq_ignore_ascii_case("NV") {
        return Ok(0b1111);
    }
    parse_condition(s, line_num)
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

/// The tail every unknown-mnemonic complaint carries. A name the
/// dispatch has no arm for is either a typo or an instruction the
/// playground does not implement, and the student cannot tell which.
const UNKNOWN_MNEMONIC_HINT: &str =
    "check the spelling, or look it up in the instruction reference to see \
     whether the playground implements it";

/// The tail every missing-label complaint carries. A label line that lost
/// its `:` reads as an instruction here, so it is indistinguishable from a
/// misspelling without saying both.
const NO_SUCH_LABEL_HINT: &str =
    "check the spelling, and check that the label line ends with a `:`";

/// A selector the dispatch cannot produce reached an encoder. No source
/// text can cause it, so the message asks for a bug report rather than
/// naming the selector.
const INTERNAL_ASSEMBLER_BUG: &str =
    "the playground hit an internal assembler error on this line. This is a \
     bug: press 'copy diagnostic bundle' and open an issue with what it copies";

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
        // Last resort, and the one GAS reaches for: any constant that is a
        // valid repeating bitmask pattern lowers to `ORR Rd, ZR, #imm`.
        // Without it `mov x0, 0x5555555555555555` (a mask a student
        // writes by hand) is refused even though one instruction covers
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
/// `option` field order. Not the load/store set: that one is
/// `decoder::LDST_EXTENDS`, a five-row table that also carries the Rm width
/// rule. This table has no width column on purpose (see
/// `parse_extend_modifier`), so the two stay separate.
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
    // parse_register collapses SP and XZR to index 31, but the hardware
    // separates them by encoding: the shifted form (bit 21 = 0) reads
    // register 31 as XZR, and only the EXTENDED form (bit 21 = 1) reaches
    // SP. Route SP operands to the extended encoding (emitting shifted
    // for `add x0, sp, x1` computes with 0) and reject the
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

/// Encode `ADC/ADCS/SBC/SBCS Rd, Rn, Rm`: sf_op_S_11010000_Rm_000000_Rn_Rd.
/// The family carries the NZCV carry bit into the adder, which is how
/// multi-precision arithmetic chains one word to the next. It is
/// register-only (A64 has no add-with-carry immediate), so an immediate
/// third operand is named rather than reported as "expected a register".
fn encode_carry(ops: &[&str], sub: bool, set_flags: bool, ln: usize) -> Result<u32, EmuError> {
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
enum BitfieldForm {
    /// UBFX / SBFX / BFXIL: immr = lsb, imms = lsb + width - 1.
    Extract,
    /// UBFIZ / SBFIZ / BFI: immr = (size - lsb) % size, imms = width - 1.
    Insert,
}

/// Encode one bitfield alias onto SBFM/UBFM/BFM. `opc` is the ARM opc
/// field (00 = SBFM, 10 = UBFM, 01 = BFM) and `form` picks which of the
/// two immr/imms formulas the alias uses. N tracks sf, as it does for
/// every valid bitfield encoding.
fn encode_bitfield_alias(
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

/// Encode `MVN Rd, Rm` (and `MVN Rd, Rm, LSL #k`) as `ORN Rd, ZR, Rm`.
/// Delegating rather than spelling the word inline is what gives the
/// shifted form for free, the same way BIC gets it from `encode_log_reg`.
fn encode_mvn(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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

/// Encode `UXTW Xd, Wn` the way GAS does: as `ORR Wd, WZR, Wn`, the
/// 32-bit MOV, whose W-width write clears the top half for free. It is
/// NOT lowered to UBFM here; binutils disassembles that word as `ubfx`
/// and never as `uxtw`. The `uxtw` in `EXTEND_KEYWORDS` and
/// `decoder::LDST_EXTENDS` is the unrelated addressing keyword and stays
/// exactly as it is.
fn encode_extend_word(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
        _ => asm_err(ln, INTERNAL_ASSEMBLER_BUG),
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

/// CCMP / CCMN Rn, Rm|#imm5, #nzcv, cond. The second operand's shape
/// picks the register or the immediate form, the same way
/// `encode_log_dispatch` reads it. GAS lets these carry AL and NV.
fn encode_cond_compare(
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

/// CLZ / CLS / RBIT / REV / REV16 / REV32 Rd, Rn. `name` keys into
/// `DP1_OPS` together with the destination width, because `rev` at W
/// width and `rev32` at X width share one opcode.
fn encode_dp1(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
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

fn encode_mul_wide(
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
fn encode_mneg_wide(ops: &[&str], op31: u32, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "SMNEGL/UMNEGL require 3 operands: Xd, Wn, Wm");
    }
    encode_mul_wide(&[ops[0], ops[1], ops[2], "XZR"], op31, true, 1, true, ln)
}

/// Encode `MNEG Rd, Rn, Rm` as `MSUB Rd, Rn, Rm, ZR`. The zero register
/// matches the destination's width the same way `encode_neg` picks it,
/// so a W destination gets WZR and an X one XZR.
fn encode_mneg(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "MNEG requires 3 operands");
    }
    reject_sp_operands(ops, ln, "MNEG")?;
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    encode_mul_accumulate(&[ops[0], ops[1], ops[2], zr], true, ln)
}

fn encode_neg(ops: &[&str], set_flags: bool, ln: usize) -> Result<u32, EmuError> {
    // NEG Xd, Xm -> SUB Xd, XZR, Xm; NEGS is the SUBS form and sets NZCV.
    if ops.len() != 2 {
        return asm_err(ln, "NEG/NEGS requires 2 operands");
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    let new_ops = [ops[0], zr, ops[1]];
    encode_dp(&new_ops, 1, if set_flags { 1 } else { 0 }, ln)
}

/// The width a `b`/`h`/`s`/`d`/`q` register name spells. The SIMD&FP
/// register file is 128 bits wide and these five are its low
/// 8/16/32/64/128-bit views of the same 32 entries.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FpWidth {
    B,
    H,
    S,
    D,
    Q,
}

impl FpWidth {
    fn from_prefix(c: char) -> Option<Self> {
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
    fn letter(self) -> char {
        match self {
            FpWidth::B => 'b',
            FpWidth::H => 'h',
            FpWidth::S => 's',
            FpWidth::D => 'd',
            FpWidth::Q => 'q',
        }
    }

    /// Access width in bytes; also the unsigned-offset scale.
    fn bytes(self) -> u64 {
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
    fn scale_shift(self) -> u32 {
        self.bytes().trailing_zeros()
    }

    /// The `size` field (bits 31:30) of a SIMD&FP load/store. Q shares
    /// size 00 with B and is told apart by `opc_high`.
    fn size_field(self) -> u32 {
        match self {
            FpWidth::B | FpWidth::Q => 0b00,
            FpWidth::H => 0b01,
            FpWidth::S => 0b10,
            FpWidth::D => 0b11,
        }
    }

    /// The high bit of `opc` (bit 23) in a SIMD&FP load/store: set only
    /// for the 128-bit Q form, which the two-bit size field cannot spell.
    fn opc_high(self) -> u32 {
        if matches!(self, FpWidth::Q) { 1 } else { 0 }
    }

    /// The `opc` field (bits 31:30) of a SIMD&FP load/store PAIR: 00 for
    /// S, 01 for D, 10 for Q. B and H have no pair form.
    fn pair_opc(self) -> Option<u32> {
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
struct FpReg {
    idx: u8,
    width: FpWidth,
}

fn parse_fp_register(s: &str, ln: usize) -> Result<FpReg, EmuError> {
    // Accept b0..b31, h0..h31, s0..s31, d0..d31 and q0..q31: the five
    // views of one 128-bit register file.
    let s = s.trim();
    let first = s.chars().next().ok_or_else(|| asm_error(ln, "empty register"))?;
    let Some(width) = FpWidth::from_prefix(first) else {
        return asm_err(ln, &format!("expected a B, H, S, D or Q register, got: {s}"));
    };
    let idx: u8 = s[1..]
        .parse()
        .map_err(|_| asm_error(ln, &format!("bad FP register: {s}")))?;
    if idx > 31 {
        return asm_err(
            ln,
            &format!(
                "`{s}` is not a floating-point register: the fp registers are \
                 b0, h0, s0, d0 and q0 through 31"
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
fn require_same_fp_width(name: &str, widths: &[FpWidth], ln: usize) -> Result<FpWidth, EmuError> {
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
fn encode_fp_mul_add(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
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
fn encode_fcsel(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_fp_binary(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
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

fn encode_fmov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fmov requires 2 operands");
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
fn encode_fp_unary(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
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
fn encode_fcvt(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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

fn encode_fcmp(ops: &[&str], signaling: bool, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "fcmp/fcmpe requires 2 operands");
    }
    let FpReg { idx: fn_, width: wn } = parse_fp_register(ops[0], ln)?;
    let FpReg { idx: fm, width: wm } = parse_fp_register(ops[1], ln)?;
    let width = require_same_fp_width("fcmp", &[wn, wm], ln)?;
    // FCMP Fn, Fm: 0_0_0_11110_ftype_1_Rm_00_1000_Rn_0_0000; FCMPE sets
    // opc bit 4. The emulator raises no FP exceptions, so the two set the
    // same flags either way.
    let opc: u32 = if signaling { 0b10000 } else { 0 };
    Ok(0x1E20_2000 | fp_ftype(width, ln)? | ((fm as u32) << 16) | ((fn_ as u32) << 5) | opc)
}

/// SCVTF / UCVTF Fd, Rn, plus SCVTF's SIMD-scalar spelling. `name` keys
/// into `FP_FROM_INT_OPS`, the same table the decoder reads back.
fn encode_fp_cvt_from_int(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
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
    // The source is either a general register (the usual course form) or
    // an FP register already holding the integer bits (gcc emits
    // `ldr s31, [...]` then `scvtf s30, s31`): the SIMD-scalar encoding,
    // which exists for SCVTF only.
    if let Ok(FpReg { idx: fn_, width: wn }) = parse_fp_register(ops[1], ln) {
        if name != "scvtf" {
            return asm_err(
                ln,
                &format!("{name} takes a general-register source ({name} fd, xn / {name} fd, wn)"),
            );
        }
        if ops.len() == 3 {
            return asm_err(ln, "the fixed-point form takes a general-register source");
        }
        let width = require_same_fp_width(name, &[wd, wn], ln)?;
        let sz: u32 = if width == FpWidth::D { 1 << 22 } else { 0 };
        return Ok(0x5E21_D800 | sz | ((fn_ as u32) << 5) | (fd as u32));
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
fn encode_fp_cvt_int(ops: &[&str], name: &str, ln: usize) -> Result<u32, EmuError> {
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
                // Unreachable from the dispatch: LDRSB/LDRSH/LDRSW come in
                // as 00/01/10 and no sign-extending load has a 64-bit
                // access size. Named explicitly so the shared MemSize
                // mapping, which does answer for 11, cannot silently
                // scale by 8, and as an error, not a panic, because on
                // wasm a panic costs the whole worker.
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
        /// on mere presence turns `lsl #0` into an 8x offset and rescales
        /// wrong amounts.
        shift_amount: Option<i64>,
    },
}

fn looks_like_register(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    let lower = s.to_ascii_lowercase();
    if reg_alias(&lower).is_some() {
        return true;
    }
    // Deliberately looser than `parse_register`: this only has to tell a
    // register-offset address apart from an immediate one, so an
    // out-of-range index like `x99` still reads as a register and reaches
    // `parse_register` for the real complaint.
    // The SIMD&FP names ride the same test: a `q` operand is a register,
    // and an address that names one has to reach `parse_register` for the
    // real complaint instead of being silently read as an immediate.
    for prefix in ["x", "w", "b", "h", "s", "d", "q"] {
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

// ---------------------------------------------------------------------------
// address operand tokens
// ---------------------------------------------------------------------------

/// What one token of an address operand is. The four structural kinds
/// stand alone; a word is classified by what it opens with, which is all
/// the shape match below needs to tell `[x0, x1]` from `[x0, #8]`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TokKind {
    LBracket,
    RBracket,
    Comma,
    Bang,
    /// A word that reads as a register name (`x0`, `w29`, `sp`).
    Reg,
    /// A word that opens like a number or a character literal.
    Imm,
    /// Any other word: an extend/shift keyword, a label, a typo.
    Keyword,
}

/// One token, as a kind plus the byte span it covers. The span rather
/// than the text on purpose: the shape match reads `kind`, and every
/// leaf parse still runs on the original source slice, so
/// `parse_register` and `parse_immediate` report exactly what the writer
/// typed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Tok {
    kind: TokKind,
    start: usize,
    end: usize,
}

/// One comma-separated piece of an operand, as byte offsets into the
/// source. Both views are needed: the token shape decides the form, the
/// raw text feeds the leaf parsers.
#[derive(Debug, Clone, Copy)]
struct Seg {
    lo: usize,
    hi: usize,
}

impl Seg {
    fn text<'a>(&self, src: &'a str) -> &'a str {
        &src[self.lo..self.hi]
    }

    /// The tokens lying inside this segment. Segment boundaries always
    /// fall on token boundaries (a comma edge or a bracket edge), so
    /// this never splits a token in half.
    fn toks<'a>(&self, toks: &'a [Tok]) -> &'a [Tok] {
        let lo = toks.partition_point(|t| t.start < self.lo);
        let hi = toks.partition_point(|t| t.end <= self.hi).max(lo);
        &toks[lo..hi]
    }
}

fn structural_kind(c: char) -> Option<TokKind> {
    match c {
        '[' => Some(TokKind::LBracket),
        ']' => Some(TokKind::RBracket),
        ',' => Some(TokKind::Comma),
        '!' => Some(TokKind::Bang),
        _ => None,
    }
}

/// Which kind of word this is. The register test is the loose
/// `looks_like_register`, not `parse_register`: `x99` has to read as a
/// register so it reaches `parse_register` for the real complaint
/// instead of being silently taken for an offset.
fn classify_word(word: &str) -> TokKind {
    if looks_like_register(word) {
        TokKind::Reg
    } else if word.starts_with(|c: char| matches!(c, '#' | '-' | '\'') || c.is_ascii_digit()) {
        TokKind::Imm
    } else {
        TokKind::Keyword
    }
}

/// Split an address operand into tokens. Total by construction: nothing
/// is rejected here, so tokenizing introduces no rejection of its own.
/// Whitespace separates words and is
/// otherwise dropped; the segment slices keep it, because the leaf
/// parsers trim for themselves.
fn tokenize_address(s: &str) -> Vec<Tok> {
    let mut toks: Vec<Tok> = Vec::new();
    let mut chars = s.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if c.is_whitespace() {
            continue;
        }
        if let Some(kind) = structural_kind(c) {
            toks.push(Tok { kind, start: i, end: i + c.len_utf8() });
            continue;
        }
        let mut end = i + c.len_utf8();
        while let Some(&(j, next)) = chars.peek() {
            if next.is_whitespace() || structural_kind(next).is_some() {
                break;
            }
            end = j + next.len_utf8();
            chars.next();
        }
        toks.push(Tok { kind: classify_word(&s[i..end]), start: i, end });
    }
    toks
}

/// The comma-separated segments of `src[lo..hi)`, at most `limit` of
/// them. Mirrors `str::splitn`: the last segment keeps any commas past
/// the limit, and no segment is trimmed.
fn comma_segments(toks: &[Tok], lo: usize, hi: usize, limit: usize) -> Vec<Seg> {
    let mut segments: Vec<Seg> = Vec::new();
    let mut start = lo;
    for tok in toks {
        if tok.kind != TokKind::Comma || tok.start < lo || tok.end > hi {
            continue;
        }
        if segments.len() + 1 >= limit {
            break;
        }
        segments.push(Seg { lo: start, hi: tok.start });
        start = tok.end;
    }
    segments.push(Seg { lo: start, hi });
    segments
}

/// `[Xn, (Wm|Xm) (, LSL|UXTW|SXTW|SXTX|UXTX #<amount>)?]`, reached once
/// the shape match has seen an index register in the offset segment.
fn parse_reg_offset(src: &str, parts: &[Seg], ln: usize) -> Result<AddressingMode, EmuError> {
    // `parts` is the comma split of the bracket group; index 0 is the
    // base, 1 the index register, 2 the optional extend/shift.
    let (rn, _) = parse_register(parts[0].text(src), ln)?;
    let (rm, rm_is_x) = parse_register(parts[1].text(src), ln)?;
    // No explicit extend / shift: LSL for Xm. A bare W index is a GAS
    // error (an extend must say how the 32 bits widen), and accepting it
    // here with an implicit UXTW assembled programs the course servers
    // reject.
    if parts.len() == 2 {
        if !rm_is_x {
            return asm_err(
                ln,
                "a W index register needs an extend keyword: write [Xn, Wm, uxtw] or [Xn, Wm, sxtw]",
            );
        }
        return Ok(AddressingMode::RegOffset {
            rn,
            rm,
            option: 0b011,
            shift_amount: None,
        });
    }
    // The keyword is taken off the raw text rather than off the first
    // token: `split_extend_keyword` reads it as everything up to the
    // first whitespace, punctuation included, so `lsl,` is one bad
    // keyword and is reported as one. Slicing at the token boundary
    // instead would rename that complaint.
    let modifier = parts[2].text(src).trim();
    let (keyword, shift_str) = split_extend_keyword(modifier);
    let keyword_lower = keyword.to_ascii_lowercase();
    let Some((_, option, needs_x)) = LDST_EXTENDS
        .iter()
        .find(|(kw, _, _)| *kw == keyword_lower.as_str())
    else {
        return asm_err(ln, &format!("bad extend/shift keyword: {keyword}"));
    };
    let (option, needs_x) = (*option, *needs_x);
    // Require the extend keyword to match the Rm width ARM-spec rules:
    // UXTW/SXTW only make sense with Wm; LSL/UXTX/SXTX with Xm. The table's
    // third column is that rule.
    if !needs_x && rm_is_x {
        return asm_err(ln, "UXTW/SXTW require a W index register");
    }
    if needs_x && !rm_is_x {
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

/// Parse a load/store address operand.
///
/// The operand is tokenized first and the form is chosen by matching on
/// the token shape: where the brackets, the commas and the writeback `!`
/// fall, and whether the offset segment names a register. The parser it
/// replaced discriminated by string shape instead, which makes the order
/// of the tests load-bearing: a form checked too late is not rejected, it
/// is re-read as a different form, because whatever the register test
/// turns away goes straight to `parse_immediate`. That produces a wrong
/// encoding, not an error.
///
/// Every leaf parse still runs on the raw source slice of its segment,
/// so the rejections read exactly as they did before.
fn parse_addressing_mode(s: &str, ln: usize) -> Result<AddressingMode, EmuError> {
    let s = s.trim();
    let toks = tokenize_address(s);

    // `[Xn, #imm]!` -> pre-index. Checked first because a trailing `!`
    // is the one thing that can follow the bracket group and still not
    // be an offset.
    if toks.last().is_some_and(|t| t.kind == TokKind::Bang) {
        let n = toks.len();
        if n < 3 || toks[0].kind != TokKind::LBracket || toks[n - 2].kind != TokKind::RBracket {
            return asm_err(ln, "expected [Xn, #imm]!");
        }
        let parts = comma_segments(&toks, toks[0].end, toks[n - 2].start, 2);
        let (rn, _) = parse_register(parts[0].text(s), ln)?;
        let offset = if parts.len() > 1 {
            Some(parse_immediate(parts[1].text(s), ln)?)
        } else {
            Some(0)
        };
        return Ok(AddressingMode::Immediate {
            rn,
            offset,
            mode: IndexMode::PreIndex,
        });
    }

    if !toks.first().is_some_and(|t| t.kind == TokKind::LBracket) {
        return asm_err(ln, "expected [ for addressing mode");
    }
    let Some(close) = toks.iter().position(|t| t.kind == TokKind::RBracket) else {
        return asm_err(ln, "invalid addressing mode");
    };
    let (inner_lo, inner_hi) = (toks[0].end, toks[close].start);

    // `[Xn], #imm` -> post-index. GAS requires the comma, and so do we:
    // `[x0] #8` would slide through as post-index and assemble a
    // spelling the servers reject.
    if let Some(first_after) = toks.get(close + 1) {
        let (rn, _) = parse_register(s[inner_lo..inner_hi].trim(), ln)?;
        if first_after.kind != TokKind::Comma {
            return asm_err(ln, "post-index needs a comma: [Xn], #imm");
        }
        let from = first_after.end;
        let offset = parse_immediate(s[from..].trim(), ln)?;
        return Ok(AddressingMode::Immediate {
            rn,
            offset: Some(offset),
            mode: IndexMode::PostIndex,
        });
    }

    // `[Xn]`, `[Xn, #imm]`, `[Xn, Xm, ...]`. The offset segment decides:
    // one register token and nothing else is the register-offset form.
    // Everything else (a `#imm`, a bare number, a `d1`, an empty
    // piece) is the immediate form and reports through
    // `parse_immediate`, which is where those complaints came from
    // before and still do.
    let parts = comma_segments(&toks, inner_lo, inner_hi, 3);
    let offset_is_register = parts.len() >= 2
        && matches!(parts[1].toks(&toks), [tok] if tok.kind == TokKind::Reg);
    if offset_is_register {
        return parse_reg_offset(s, &parts, ln);
    }
    let (rn, _) = parse_register(parts[0].text(s), ln)?;
    if parts.len() > 1 {
        // A plain splitn DROPS anything past the second comma, so
        // `[x0, #8, #9]` encodes as `[x0, #8]` with no message.
        if parts.len() > 2 {
            return asm_err(
                ln,
                "unexpected third operand in the address: the immediate form is [Xn, #imm]",
            );
        }
        let offset = parse_immediate(parts[1].text(s), ln)?;
        return Ok(AddressingMode::Immediate {
            rn,
            offset: Some(offset),
            mode: IndexMode::Unsigned,
        });
    }
    Ok(AddressingMode::Immediate {
        rn,
        offset: None,
        mode: IndexMode::Unsigned,
    })
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
fn encode_ldur_stur(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 2 {
        return asm_err(ln, "LDUR/STUR requires at least 2 operands");
    }
    encode_ldst_fp(ops, load, true, ln)
}

#[allow(clippy::identity_op)] // zero fields kept to document the full encoding layout
fn encode_ldst_pair(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
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

    let scale: i64 = if sf { 8 } else { 4 };
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
fn encode_ldst_pair_no_allocate(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 3 {
        return asm_err(ln, "LDNP/STNP requires at least 3 operands");
    }
    encode_ldst_pair_fp_inner(ops, load, true, ln)
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
            .ok_or_else(|| asm_error(ln, &format!("no label named `{target}` in this program: {NO_SUCH_LABEL_HINT}")))?
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
            .ok_or_else(|| asm_error(ln, &format!("no label named `{target}` in this program: {NO_SUCH_LABEL_HINT}")))?;
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
            .ok_or_else(|| asm_error(ln, &format!("no label named `{target}` in this program: {NO_SUCH_LABEL_HINT}")))?;
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
                "{mnemonic} target is out of reach ({} bytes away; this branch reaches \
                 {} bytes each way). Branch to a nearer label, or load the address and \
                 use br",
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
            .ok_or_else(|| asm_error(ln, &format!("no label named `{target}` in this program: {NO_SUCH_LABEL_HINT}")))?;
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

fn encode_cond_sel(ops: &[&str], op_bit: u8, op2: u8, ln: usize) -> Result<u32, EmuError> {
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
fn encode_cond_sel_alias(
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
    fn bic_and_mvn_refuse_an_immediate_source() {
        // Both are register-only aliases; the shifted-register arity fix
        // must not have opened a door to an immediate GAS would refuse.
        assert!(assemble("BIC X0, X1, #1").is_err());
        assert!(assemble("MVN X0, #1").is_err());
        assert!(assemble("BIC X0, X1, X2, LSL #1").is_ok());
        assert!(assemble("MVN X0, X1, LSL #2").is_ok());
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
    fn scvtf_converts_integer_bits_already_in_the_fp_register() {
        use crate::cpu::Cpu;
        use crate::decoder::{decode, Instruction};
        let labels = HashMap::new();
        let s_form = encode_line("scvtf s30, s31", 0, &labels, 1).unwrap();
        assert_eq!(s_form, 0x5E21_DBFE);
        assert!(matches!(
            decode(s_form).unwrap(),
            Instruction::FpScvtfFp { fd: 30, fn_: 31, single: true }
        ));
        let d_form = encode_line("scvtf d1, d2", 0, &labels, 1).unwrap();
        assert!(matches!(
            decode(d_form).unwrap(),
            Instruction::FpScvtfFp { fd: 1, fn_: 2, single: false }
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
    fn widening_multiplies_encode_as_the_arm_arm_words_and_round_trip() {
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
    fn carry_ops_encode_as_the_arm_arm_words_and_round_trip() {
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
        // GAS lets a label share a line with an instruction; an encoder
        // that recognizes a label only on its own line reads `loop:` as
        // the mnemonic. The same-line form
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
        // `mov x0, #-1` as MOVN x0, #0 (0x92800000). Trying MOVN for
        // negative literals only rejects the positive hex form.
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
        // A dropped third operand leaves hw = 0: `movk x0, #0xDEAD, #16`
        // then destroys the low halfword the movz just placed.
        let err = assemble("MOVK X0, #0xDEAD, #16").unwrap_err();
        assert!(err.to_string().contains("lsl"), "was: {err}");
        assert!(assemble("MOVK X0, #0xDEAD, LSR #16").is_err());
        assert!(assemble("MOVZ X0, #1, FOO #16").is_err());
        assert!(assemble("MOVZ X0, #1, LSL #16, LSL #32").is_err());
        assert!(assemble("MOVK X0, #0xDEAD, LSL #16").is_ok());
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
        assert!(assemble("LDR W0, [X1, X2, LSL #3]").is_err());
        assert!(assemble("LDR X0, [X1, W2, SXTW #7]").is_err());
        // SXTW with the canonical amount still scales.
        assert!(assemble("LDR X0, [X1, W2, SXTW #3]").is_ok());
        assert!(assemble("LDR X0, [X1, W2, SXTW #0]").is_ok());
    }

    #[test]
    fn mixed_width_pairs_are_rejected() {
        // GAS rejects these; accepting them stores the wrong width and
        // both registers reload garbage.
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
        // A literal-blind comment stripper cuts the line at the `;`,
        // leaving a dangling quote and an invalid-immediate error.
        let code = assemble("MOV W1, ';'").unwrap();
        let reference = assemble("MOV W1, #59").unwrap();
        assert_eq!(code, reference);
        // A real trailing comment still strips.
        let commented = assemble("MOV W1, #59 ; the separator").unwrap();
        assert_eq!(commented, reference);
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
        assert!(assemble("LDRSW W0, [X1, #0]").is_err());
        assert!(assemble("LDRSW X0, [X1, #0]").is_ok());
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
        let err = encode_line("ucvtf s0, s1", 0, &labels, 1).unwrap_err().to_string();
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

    // -- register names the encoder turns away --

    #[test]
    fn a_register_number_past_the_file_names_the_register_file() {
        // The web layer picks its register teaching block off this wording,
        // so a reworded message there silently stops explaining itself.
        let labels: HashMap<String, u64> = HashMap::new();
        let msg = match encode_line("ldr x1, [x99, #8]", 0, &labels, 1) {
            Err(EmuError::AssemblyError { message, .. }) => message,
            other => panic!("expected an assembly error, got {other:?}"),
        };
        assert!(msg.contains("is not a register"), "message was: {msg}");
        assert!(msg.contains("x0 through x30"), "message was: {msg}");

        let msg = match encode_line("fadd d0, d1, d99", 0, &labels, 1) {
            Err(EmuError::AssemblyError { message, .. }) => message,
            other => panic!("expected an assembly error, got {other:?}"),
        };
        assert!(
            msg.contains("is not a floating-point register"),
            "message was: {msg}"
        );
    }

    // -- the supported-mnemonic list --

    #[test]
    fn supported_mnemonics_all_reach_an_arm() {
        // Probe the dispatch at the layer it lives on: hand `encode_line` the
        // bare mnemonic with no operands at all. What comes back does not
        // matter (an operand-count complaint, or an encoding for the forms
        // that take no operands) because only the fallthrough produces
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
    fn every_dispatch_arm_is_listed_in_supported_mnemonics() {
        // The direction `supported_mnemonics_all_reach_an_arm` cannot cover:
        // that one proves every listed name reaches an arm, this one proves
        // every arm is listed, so the assembler cannot quietly accept a
        // mnemonic the public reference has no obligation to document. A
        // match has no runtime list of its own patterns, so read them off
        // this file's own text.
        let source = include_str!("assembler.rs");
        let start = source
            .find("match mn.as_str() {")
            .expect("the dispatch match must be findable");
        let region = &source[start..];
        let end = region
            .find("\n        _ => asm_err(")
            .expect("the dispatch's fallthrough arm must be findable");
        let region = &region[..end];

        let mut arms: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
        for line in region.lines() {
            // Arm patterns are string literals, alternatives separated by
            // `|`: `"MOV" => ...` and `"A" | "B" => ...`.
            let Some((head, _)) = line.split_once("=>") else {
                continue;
            };
            let head = head.trim();
            if !head.starts_with('"') {
                continue;
            }
            for piece in head.split('|') {
                let piece = piece.trim();
                let name = piece
                    .strip_prefix('"')
                    .and_then(|rest| rest.strip_suffix('"'))
                    .filter(|name| !name.contains('"'))
                    .unwrap_or_else(|| panic!("could not read the arm pattern in: {line}"));
                assert!(arms.insert(name.to_string()), "`{name}` has two arms");
            }
        }
        assert!(
            arms.len() > 50,
            "the scan found only {} arms, so it is reading the wrong region",
            arms.len()
        );

        // Conditional branches never reach the match: they are peeled off
        // ahead of it, both spellings of every primary and alias.
        for (primary, aliases, _) in CONDITIONS {
            for cc in std::iter::once(primary).chain(aliases.iter()) {
                arms.insert(format!("B.{cc}"));
                arms.insert(format!("B{cc}"));
            }
        }

        let listed: std::collections::BTreeSet<String> =
            SUPPORTED_MNEMONICS.iter().map(|m| (*m).to_string()).collect();
        assert_eq!(
            arms, listed,
            "the dispatch and SUPPORTED_MNEMONICS disagree: an arm with no \
             entry is a mnemonic no document has to mention, an entry with \
             no arm is a promise the assembler does not keep"
        );
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

    // -- the load/store extend table --

    #[test]
    fn ldst_extends_table_round_trips_and_holds_the_width_rule() {
        use crate::decoder::{ExtendType, Instruction, LdStOffset};
        for (keyword, option, needs_x) in LDST_EXTENDS {
            let (right, wrong) = if *needs_x { ("x2", "w2") } else { ("w2", "x2") };
            let src = format!("ldr x0, [x1, {right}, {keyword}]");
            let word = assemble(&src).unwrap()[0];
            // Option 0b011 has two spellings and decodes as the first one
            // the table lists, so `uxtx` comes back as Lsl.
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
            let bad = format!("ldr x0, [x1, {wrong}, {keyword}]");
            assert!(
                assemble(&bad).is_err(),
                "`{bad}` must be refused: the width rule is the table's third column"
            );
        }
    }

    // -- the address operand tokenizer --

    /// Render a token stream as `kind:text` so a mismatch reads as the
    /// spelling it came from rather than as a span arithmetic puzzle.
    fn tokens_of(src: &str) -> Vec<String> {
        tokenize_address(src)
            .iter()
            .map(|t| format!("{:?}:{}", t.kind, &src[t.start..t.end]))
            .collect()
    }

    #[test]
    fn tokenizer_classifies_the_operand_words() {
        // The three word kinds are the whole grammar: a register name, a
        // number-ish word, and anything else. Whitespace and casing move
        // the spans, never the kinds, which is why the shape match can
        // be spelled once and cover every spelling.
        for spelling in ["[x0, w2, sxtw #2]", "[x0,w2,sxtw #2]", "[ X0 , W2 , SXTW #2 ]"] {
            assert_eq!(
                tokens_of(spelling)
                    .iter()
                    .map(|t| t.split(':').next().unwrap().to_string())
                    .collect::<Vec<_>>(),
                vec![
                    "LBracket", "Reg", "Comma", "Reg", "Comma", "Keyword", "Imm", "RBracket"
                ],
                "{spelling}"
            );
        }
        assert_eq!(
            tokens_of("[sp, #-8]!"),
            vec!["LBracket:[", "Reg:sp", "Comma:,", "Imm:#-8", "RBracket:]", "Bang:!"]
        );
        // A SIMD&FP name reads as a register too, so `[x0, d1]` reaches
        // `parse_register` for the real complaint instead of falling onto
        // the immediate path.
        assert_eq!(tokens_of("d1"), vec!["Reg:d1"]);
        assert_eq!(tokens_of("q31"), vec!["Reg:q31"]);
        assert_eq!(tokens_of("lsl"), vec!["Keyword:lsl"]);
        assert_eq!(tokens_of("x99"), vec!["Reg:x99"]);
        assert_eq!(tokens_of("0x10"), vec!["Imm:0x10"]);
        assert_eq!(tokens_of("'a'"), vec!["Imm:'a'"]);
        assert_eq!(tokens_of(""), Vec::<String>::new());
    }

    #[test]
    fn comma_segments_match_splitn() {
        // The segments are what the leaf parsers receive: untrimmed, with
        // the limit's overflow left on the last piece. Drift here is a
        // silently different parse.
        for (src, limit) in [("x0, x1, lsl #3, junk", 3), ("x0, #8", 2), ("x0", 3), ("", 2)] {
            let toks = tokenize_address(src);
            let got: Vec<&str> = comma_segments(&toks, 0, src.len(), limit)
                .iter()
                .map(|seg| seg.text(src))
                .collect();
            let want: Vec<&str> = src.splitn(limit, ',').collect();
            assert_eq!(got, want, "`{src}` split {limit} ways");
        }
    }

    // -- the register-alias table --

    #[test]
    fn reg_aliases_resolve_and_read_as_registers() {
        // Both directions of the table in one walk: the encoder resolves
        // every row to the number and width it names, in any casing, and
        // the addressing-mode recognizer agrees that the row is a register
        // (the discrimination `[x0, sp]` vs `[x0, #8]` rides on that).
        for (alias, num, sf) in crate::registers::REG_ALIASES {
            for spelling in [alias.to_string(), alias.to_ascii_lowercase()] {
                assert_eq!(
                    parse_register(&spelling, 1).unwrap(),
                    (*num, *sf),
                    "`{spelling}` resolved wrong"
                );
                assert!(
                    looks_like_register(&spelling),
                    "`{spelling}` must read as a register"
                );
            }
        }
    }

    #[test]
    fn looks_like_register_still_takes_an_out_of_range_index() {
        // It is the addressing-mode discriminator, not a validator: `x99`
        // has to reach `parse_register` to be told it is out of range,
        // rather than being silently read as an immediate offset.
        assert!(looks_like_register("x99"));
        assert!(parse_register("x99", 1).is_err());
        assert!(!looks_like_register("pc"));
        assert!(!looks_like_register("lsl"));
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
