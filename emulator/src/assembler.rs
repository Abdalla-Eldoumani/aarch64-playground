use std::collections::HashMap;

use crate::decoder::{
    element_letter, lane_allowed, shift_imm_field, simd_across_by_name, simd_diff_by_name,
    simd_elem_bits, simd_elem_by_name, simd_imm_form, simd_logical_by_name, simd_logical_name,
    simd_fp_across_by_name, simd_fp_elem_by_name, simd_fp_misc_by_name, simd_fp_same_by_name,
    simd_misc_by_name, simd_permute_by_name, simd_same_by_name,
    simd_shift_by_name, simd_struct_bytes, simd_struct_index_bits, size_field, MemSize,
    SimdDiffShape, SimdElemKind, SimdFpMiscRow, SimdFpMiscShape, SimdImmForm, SimdImmOp,
    SimdLogicalOp, SimdMiscShape, SimdShiftRow, SimdShiftShape, SimdStructShape, DP1_OPS,
    FP_BINARY_OPS, FP_FROM_INT_OPS, FP_MUL_ADD_OPS,
    FP_TO_INT_OPS, FP_UNARY_OPS, LDST_EXTENDS, SIMD_STRUCT_MULTIPLE,
};
use crate::errors::EmuError;
use crate::registers::{reg_alias, Condition, CONDITIONS};

mod operands;
mod arith;

use operands::*;
use arith::*;

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
    // shifts, rotate, and the funnel shift
    "LSL", "LSR", "ASR", "ROR", "EXTR",
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
    "FCCMP", "FCCMPE",
    "FMAX", "FMIN", "FMAXNM", "FMINNM", "FCSEL",
    "FMADD", "FMSUB", "FNMADD", "FNMSUB",
    "FCVT", "SCVTF", "UCVTF", "FCVTZS", "FCVTNS", "FCVTNU", "LDP", "STP", "LDPSW",
    // advanced simd: the vector immediates and the lane moves (the vector
    // forms of MOV, ORR, BIC and FMOV ride their existing arms)
    "MOVI", "MVNI", "DUP", "INS", "UMOV", "SMOV",
    // advanced simd: the integer lane families (the vector forms of ADD,
    // SUB, MUL, AND, EOR, ORN, MVN, NEG, CLS, CLZ, RBIT, REV16 and REV32
    // ride their existing arms)
    "MLA", "MLS", "PMUL", "BSL", "BIT", "BIF",
    "CMEQ", "CMGE", "CMGT", "CMHI", "CMHS", "CMTST", "CMLE", "CMLT",
    "SQADD", "UQADD", "SQSUB", "UQSUB", "SUQADD", "USQADD", "SQABS", "SQNEG",
    "SHADD", "UHADD", "SRHADD", "URHADD", "SHSUB", "UHSUB",
    "SQDMULH", "SQRDMULH",
    "SMAX", "SMIN", "UMAX", "UMIN", "SMAXP", "SMINP", "UMAXP", "UMINP",
    "SMAXV", "SMINV", "UMAXV", "UMINV", "ADDV", "SADDLV", "UADDLV", "ADDP",
    "SADDLP", "UADDLP", "SADALP", "UADALP",
    "SABD", "UABD", "SABA", "UABA",
    "ABS", "NOT", "CNT", "REV64", "URECPE", "URSQRTE",
    // advanced simd: the widening, narrowing and doubling three-different
    // families (SMULL and UMULL already ride their general-register arms)
    "SADDL", "SADDL2", "UADDL", "UADDL2", "SSUBL", "SSUBL2", "USUBL", "USUBL2",
    "SMULL2", "UMULL2", "SMLAL", "SMLAL2", "UMLAL", "UMLAL2", "SMLSL", "SMLSL2",
    "UMLSL", "UMLSL2", "SABDL", "SABDL2", "UABDL", "UABDL2", "SABAL", "SABAL2",
    "UABAL", "UABAL2", "SADDW", "SADDW2", "UADDW", "UADDW2", "SSUBW", "SSUBW2",
    "USUBW", "USUBW2", "ADDHN", "ADDHN2", "RADDHN", "RADDHN2", "SUBHN", "SUBHN2",
    "RSUBHN", "RSUBHN2", "SQDMULL", "SQDMULL2", "SQDMLAL", "SQDMLAL2", "SQDMLSL",
    "SQDMLSL2", "PMULL", "PMULL2",
    // advanced simd: the narrowing extracts and the lengthening shift
    "XTN", "XTN2", "SQXTN", "SQXTN2", "UQXTN", "UQXTN2", "SQXTUN", "SQXTUN2", "SHLL",
    "SHLL2",
    // advanced simd: shift by immediate (SXTL and UXTL are its #0 aliases)
    "SHL", "SSHR", "USHR", "SSRA", "USRA", "SRSHR", "URSHR", "SRSRA", "URSRA", "SLI",
    "SRI", "SQSHL", "UQSHL", "SQSHLU", "SSHLL", "SSHLL2", "USHLL", "USHLL2", "SXTL",
    "SXTL2", "UXTL", "UXTL2", "SHRN", "SHRN2", "RSHRN", "RSHRN2", "SQSHRN", "SQSHRN2",
    "UQSHRN", "UQSHRN2", "SQRSHRN", "SQRSHRN2", "UQRSHRN", "UQRSHRN2", "SQSHRUN",
    "SQSHRUN2", "SQRSHRUN", "SQRSHRUN2",
    // advanced simd: shift by register (SQSHL and UQSHL are listed above)
    "SSHL", "USHL", "SRSHL", "URSHL", "SQRSHL", "UQRSHL",
    // advanced simd: the permutes and the table lookups (the by-element
    // multiplies are spellings of mnemonics already listed above)
    "EXT", "TBL", "TBX", "ZIP1", "ZIP2", "UZP1", "UZP2", "TRN1", "TRN2",
    // advanced simd: the structure loads and stores, including the
    // single-lane and replicate shapes
    "LD1", "LD2", "LD3", "LD4", "ST1", "ST2", "ST3", "ST4",
    "LD1R", "LD2R", "LD3R", "LD4R",
    // the rest of the float-to-integer rounding modes
    "FCVTZU", "FCVTAS", "FCVTAU", "FCVTMS", "FCVTMU", "FCVTPS", "FCVTPU",
    // advanced simd: the floating-point lane families (the vector forms of
    // FADD, FSUB, FMUL, FDIV, FMAX, FMIN, FMAXNM, FMINNM, FABS, FNEG,
    // FSQRT, FMOV, SCVTF, UCVTF and every FCVT rounding mode ride their
    // existing arms)
    "FMLA", "FMLS", "FMULX", "FABD", "FRECPS", "FRSQRTS",
    "FADDP", "FMAXP", "FMINP", "FMAXNMP", "FMINNMP",
    "FMAXV", "FMINV", "FMAXNMV", "FMINNMV",
    "FCMEQ", "FCMGE", "FCMGT", "FCMLE", "FCMLT", "FACGE", "FACGT",
    "FRECPE", "FRSQRTE", "FRECPX",
    "FRINTA", "FRINTI", "FRINTM", "FRINTN", "FRINTP", "FRINTX", "FRINTZ",
    "FCVTN", "FCVTN2", "FCVTL", "FCVTL2", "FCVTXN", "FCVTXN2",
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
    "NOP", "SVC", "BRK",
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

    // A dozen integer vector mnemonics are also general-register ones,
    // and only the operands separate the two readings, so the sniff
    // stands ahead of the dispatch rather than inside a dozen arms.
    if is_simd_integer_line(&mn, &ops) {
        return encode_simd_integer(&mn, &ops, line_num);
    }

    // The float mnemonics are the same story one class over: two dozen of
    // them name a scalar FP instruction as well, and only the operands
    // say which reading a line is.
    if is_simd_float_line(&mn, &ops) {
        return encode_simd_float(&mn, &ops, line_num);
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
        "ORR" => encode_orr(&ops, line_num),
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
        "EXTR" => encode_extr(&ops, line_num),

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
        "FCCMP" => encode_fccmp(&ops, false, line_num),
        "FCCMPE" => encode_fccmp(&ops, true, line_num),
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
        "LDP" => encode_ldst_pair(&ops, 1, false, line_num),
        "STP" => encode_ldst_pair(&ops, 0, false, line_num),
        "LDPSW" => encode_ldst_pair(&ops, 1, true, line_num),
        "LDNP" => encode_ldst_pair_no_allocate(&ops, 1, line_num),
        "STNP" => encode_ldst_pair_no_allocate(&ops, 0, line_num),

        // -- advanced simd: the integer lane families --
        "MLA" | "MLS" | "PMUL" | "BSL" | "BIT" | "BIF" => encode_simd_integer(&mn, &ops, line_num),
        "CMEQ" | "CMGE" | "CMGT" | "CMHI" | "CMHS" | "CMTST" | "CMLE" | "CMLT" => encode_simd_integer(&mn, &ops, line_num),
        "SQADD" | "UQADD" | "SQSUB" | "UQSUB" | "SUQADD" | "USQADD" | "SQABS" | "SQNEG" => encode_simd_integer(&mn, &ops, line_num),
        "SHADD" | "UHADD" | "SRHADD" | "URHADD" | "SHSUB" | "UHSUB" => encode_simd_integer(&mn, &ops, line_num),
        "SQDMULH" | "SQRDMULH" => encode_simd_integer(&mn, &ops, line_num),
        "SMAX" | "SMIN" | "UMAX" | "UMIN" | "SMAXP" | "SMINP" | "UMAXP" | "UMINP" => encode_simd_integer(&mn, &ops, line_num),
        "SMAXV" | "SMINV" | "UMAXV" | "UMINV" | "ADDV" | "SADDLV" | "UADDLV" | "ADDP" => encode_simd_integer(&mn, &ops, line_num),
        "SADDLP" | "UADDLP" | "SADALP" | "UADALP" => encode_simd_integer(&mn, &ops, line_num),
        "SABD" | "UABD" | "SABA" | "UABA" => encode_simd_integer(&mn, &ops, line_num),
        "ABS" | "NOT" | "CNT" | "REV64" | "URECPE" | "URSQRTE" => encode_simd_integer(&mn, &ops, line_num),
        "SADDL" | "SADDL2" | "UADDL" | "UADDL2" | "SSUBL" | "SSUBL2" | "USUBL" | "USUBL2" => encode_simd_integer(&mn, &ops, line_num),
        "SMULL2" | "UMULL2" | "SMLAL" | "SMLAL2" | "UMLAL" | "UMLAL2" | "SMLSL" | "SMLSL2" => encode_simd_integer(&mn, &ops, line_num),
        "UMLSL" | "UMLSL2" | "SABDL" | "SABDL2" | "UABDL" | "UABDL2" | "SABAL" | "SABAL2" => encode_simd_integer(&mn, &ops, line_num),
        "UABAL" | "UABAL2" | "SADDW" | "SADDW2" | "UADDW" | "UADDW2" | "SSUBW" | "SSUBW2" => encode_simd_integer(&mn, &ops, line_num),
        "USUBW" | "USUBW2" | "ADDHN" | "ADDHN2" | "RADDHN" | "RADDHN2" | "SUBHN" | "SUBHN2" => encode_simd_integer(&mn, &ops, line_num),
        "RSUBHN" | "RSUBHN2" | "SQDMULL" | "SQDMULL2" | "SQDMLAL" | "SQDMLAL2" | "SQDMLSL" => encode_simd_integer(&mn, &ops, line_num),
        "SQDMLSL2" | "PMULL" | "PMULL2" => encode_simd_integer(&mn, &ops, line_num),
        "XTN" | "XTN2" | "SQXTN" | "SQXTN2" | "UQXTN" | "UQXTN2" | "SQXTUN" | "SQXTUN2" => encode_simd_integer(&mn, &ops, line_num),
        "SHLL" | "SHLL2" => encode_simd_integer(&mn, &ops, line_num),
        "SHL" | "SSHR" | "USHR" | "SSRA" | "USRA" | "SRSHR" | "URSHR" | "SRSRA" | "URSRA" => encode_simd_integer(&mn, &ops, line_num),
        "SLI" | "SRI" | "SQSHL" | "UQSHL" | "SQSHLU" | "SSHLL" | "SSHLL2" | "USHLL" => encode_simd_integer(&mn, &ops, line_num),
        "USHLL2" | "SXTL" | "SXTL2" | "UXTL" | "UXTL2" | "SHRN" | "SHRN2" | "RSHRN" => encode_simd_integer(&mn, &ops, line_num),
        "RSHRN2" | "SQSHRN" | "SQSHRN2" | "UQSHRN" | "UQSHRN2" | "SQRSHRN" | "SQRSHRN2" => encode_simd_integer(&mn, &ops, line_num),
        "UQRSHRN" | "UQRSHRN2" | "SQSHRUN" | "SQSHRUN2" | "SQRSHRUN" | "SQRSHRUN2" => encode_simd_integer(&mn, &ops, line_num),
        "SSHL" | "USHL" | "SRSHL" | "URSHL" | "SQRSHL" | "UQRSHL" => encode_simd_integer(&mn, &ops, line_num),

        // -- advanced simd: the floating-point lane families --
        "FMLA" | "FMLS" | "FMULX" | "FABD" | "FRECPS" | "FRSQRTS" => encode_simd_float(&mn, &ops, line_num),
        "FADDP" | "FMAXP" | "FMINP" | "FMAXNMP" | "FMINNMP" => encode_simd_float(&mn, &ops, line_num),
        "FMAXV" | "FMINV" | "FMAXNMV" | "FMINNMV" => encode_simd_float(&mn, &ops, line_num),
        "FCMEQ" | "FCMGE" | "FCMGT" | "FCMLE" | "FCMLT" | "FACGE" | "FACGT" => encode_simd_float(&mn, &ops, line_num),
        "FRECPE" | "FRSQRTE" | "FRECPX" => encode_simd_float(&mn, &ops, line_num),
        "FRINTA" | "FRINTI" | "FRINTM" | "FRINTN" | "FRINTP" | "FRINTX" | "FRINTZ" => encode_simd_float(&mn, &ops, line_num),
        "FCVTN" | "FCVTN2" | "FCVTL" | "FCVTL2" | "FCVTXN" | "FCVTXN2" => encode_simd_float(&mn, &ops, line_num),

        // -- advanced simd: the vector immediates and the lane moves --
        "MOVI" => encode_simd_mod_imm(&ops, SimdImmOp::Movi, line_num),
        "MVNI" => encode_simd_mod_imm(&ops, SimdImmOp::Mvni, line_num),
        "DUP" => encode_simd_dup(&ops, line_num),
        "INS" => encode_simd_ins(&ops, line_num),
        "UMOV" => encode_simd_lane_out(&ops, false, line_num),
        "SMOV" => encode_simd_lane_out(&ops, true, line_num),

        // -- advanced simd: the permutes and the table lookups --
        "EXT" => encode_simd_ext(&ops, line_num),
        "TBL" => encode_simd_table(false, &ops, line_num),
        "TBX" => encode_simd_table(true, &ops, line_num),
        "ZIP1" | "ZIP2" | "UZP1" | "UZP2" | "TRN1" | "TRN2" => {
            encode_simd_permute(&mn.to_ascii_lowercase(), &ops, line_num)
        }

        // -- advanced simd: the structure loads and stores --
        // One line, like every other arm: `every_dispatch_arm_is_listed_in_supported_mnemonics`
        // reads the patterns off this file's text and only sees the line the `=>` is on.
        "LD1" | "LD2" | "LD3" | "LD4" | "ST1" | "ST2" | "ST3" | "ST4" | "LD1R" | "LD2R" | "LD3R" | "LD4R" => {
            encode_simd_structure(&mn.to_ascii_lowercase(), &ops, line_num)
        }

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
        "BRK" => encode_brk(&ops, line_num),

        _ => Err(unknown_mnemonic(mnemonic, operands, line_num)),
    }
}

/// The tail every unknown-mnemonic complaint carries. A name the
/// dispatch has no arm for is either a typo or an instruction the
/// playground does not implement, and the student cannot tell which.
const UNKNOWN_MNEMONIC_HINT: &str =
    "check the spelling, or look it up in the instruction reference to see \
     whether the playground implements it";

/// GAS's complaint about a mnemonic it does not know. GAS lowercases the
/// name and echoes the line with the spaces after its commas squeezed out;
/// the first line repeats it exactly so it reads the same here as on the
/// course servers. The nearest supported spellings are the web explainer's
/// to add: the name table would cost the wasm about 2 KB compressed, and
/// nothing else in it needs one.
fn unknown_mnemonic(mnemonic: &str, operands: &str, ln: usize) -> EmuError {
    let mnemonic = mnemonic.to_ascii_lowercase();
    let squeezed: Vec<&str> = operands.split(',').map(str::trim).collect();
    let echo = if operands.is_empty() {
        mnemonic.clone()
    } else {
        format!("{mnemonic} {}", squeezed.join(","))
    };
    asm_error(ln, &format!("unknown mnemonic `{mnemonic}' -- `{echo}'\n{UNKNOWN_MNEMONIC_HINT}"))
}

/// A branch, address, literal-pool constant, or data slot naming a label
/// nothing defines. GAS leaves such a name for ld, which fails the link
/// with the first line below. A label line that lost its `:` reads as an
/// instruction, so the guidance names both causes.
pub(crate) fn undefined_label(ln: usize, target: &str) -> EmuError {
    asm_error(
        ln,
        &format!(
            "undefined reference to `{target}'\nno line defines `{target}:`: check the \
             spelling, and check that the label line ends with a `:`"
        ),
    )
}

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

/// Encode `EXTR Rd, Rn, Rm, #lsb`: bits lsb and up of the pair Rn:Rm.
/// ROR by an immediate is the same word with Rn repeated.
fn encode_extr(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
struct VecReg {
    idx: u8,
    /// Lane width in bytes: 1, 2, 4 or 8.
    esize: u8,
    /// The 128-bit arrangement. Meaningless on a lane reference, where
    /// the element's own width is all the encoding carries.
    q: bool,
    /// The lane a `[n]` names, or None for a plain arrangement.
    lane: Option<u8>,
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
fn parse_vec_operand(s: &str) -> Option<VecReg> {
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
fn parse_vec_arrangement(s: &str, ln: usize) -> Result<VecReg, EmuError> {
    let reg = parse_vec_reg(s, ln)?;
    if reg.lane.is_some() {
        return asm_err(ln, &format!("`{}` names one lane; this operand takes a whole register", s.trim()));
    }
    Ok(reg)
}

/// A vector operand that names one lane.
fn parse_vec_lane(s: &str, ln: usize) -> Result<(VecReg, u8), EmuError> {
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
fn encode_simd_mod_imm(ops: &[&str], op: SimdImmOp, ln: usize) -> Result<u32, EmuError> {
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
            return asm_err(ln, &format!("{name} takes an 8-bit immediate (-128 to 255), got {value:#x}"));
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
fn encode_simd_dup(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_ins(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_lane_out(ops: &[&str], signed: bool, ln: usize) -> Result<u32, EmuError> {
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

// ---------------------------------------------------------------------------
// advanced simd: the integer lane families
// ---------------------------------------------------------------------------

/// A b/h/s/d register operand as the SIMD-scalar forms spell their
/// operands, answered as (register, lane bytes). `q` is not one of them:
/// no integer lane form names the whole 128 bits without an arrangement.
fn simd_scalar_operand(s: &str) -> Option<(u8, u8)> {
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
fn is_simd_integer_line(mn: &str, ops: &[&str]) -> bool {
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
fn simd_immediate(op: &str) -> bool {
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
fn simd_class_word(scalar: bool, q: bool, u: bool, size: u8, low: u32) -> u32 {
    let base = if scalar { 0x5E00_0000 } else { 0x0E00_0000 | ((q as u32) << 30) };
    base | ((u as u32) << 29) | (u32::from(size) << 22) | low
}

/// The Advanced SIMD integer families. One entry point, because the
/// operands rather than the mnemonic decide which class a line is in:
/// `cmgt v3.8b, v7.8b, v21.8b` is three-same and `cmgt v3.8b, v7.8b, #0`
/// two-register misc, and `addp` is three-same with three operands and
/// the SIMD-scalar pairwise form with two.
fn encode_simd_integer(mn: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn simd_elem_word(
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
fn is_simd_float_line(mn: &str, ops: &[&str]) -> bool {
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
fn encode_simd_float(mn: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_fmov_imm(d: &VecReg, literal: &str, ln: usize) -> Result<u32, EmuError> {
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

/// ZIP/UZP/TRN: `Vd.T, Vn.T, Vm.T`, one arrangement throughout.
fn encode_simd_permute(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_ext(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_table(extend: bool, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_structure(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_across(name: &str, ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn arrangement_name(reg: &VecReg) -> &'static str {
    ARRANGEMENTS
        .iter()
        .find(|(_, esize, q)| *esize == reg.esize && *q == reg.q)
        .map(|(name, _, _)| *name)
        .unwrap_or("vector")
}

/// The bitwise three-same group: AND, BIC, ORR, ORN, EOR, BSL, BIT and
/// BIF. The size field is the op selector here, not an element width, so
/// all eight take the byte arrangements alone.
fn encode_simd_logical_reg(ops: &[&str], op: SimdLogicalOp, ln: usize) -> Result<u32, EmuError> {
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
fn encode_vector_logical(ops: &[&str], op: SimdImmOp, ln: usize) -> Result<u32, EmuError> {
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
fn encode_orr(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.first().is_some_and(|o| parse_vec_operand(o).is_some()) {
        return encode_vector_logical(ops, SimdImmOp::Orr, ln);
    }
    encode_log_dispatch(ops, 0b01, ln)
}

/// FMOV between an x register and the UPPER 64-bit lane of a vector
/// register. It is the only FMOV that names a lane, and the only one
/// that leaves half of its destination alone.
fn encode_fmov_lane(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
fn encode_simd_mov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
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
    // `fcmp d0, #0.0` names no second register: opc bit 3 set, Rm zero.
    let (fm, zero) = if matches!(ops[1].trim().trim_start_matches('#'), "0" | "0.0") {
        (0, 0b01000)
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
fn encode_fccmp(ops: &[&str], signaling: bool, ln: usize) -> Result<u32, EmuError> {
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
/// LDP/STP, and with `signed_words` LDPSW: two words from memory, each
/// sign-extended into an X register (gcc's load of an int pair).
fn encode_ldst_pair(ops: &[&str], load: u8, signed_words: bool, ln: usize) -> Result<u32, EmuError> {
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
            .ok_or_else(|| undefined_label(ln, target))?
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
            .ok_or_else(|| undefined_label(ln, target))?;
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
            .ok_or_else(|| undefined_label(ln, target))?;
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
            .ok_or_else(|| undefined_label(ln, target))?;
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

fn encode_svc(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let imm = if ops.is_empty() || ops[0].is_empty() {
        0
    } else {
        parse_immediate(ops[0], ln)? as u16
    };
    Ok(0xD400_0001 | ((imm as u32) << 5))
}

/// `brk #imm16`, the breakpoint trap gcc plants on a path that can only fault.
fn encode_brk(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let [op] = ops else {
        return asm_err(ln, "BRK takes one immediate: brk #1000");
    };
    let imm = parse_immediate(op, ln)?;
    if !(0..=0xFFFF).contains(&imm) {
        return asm_err(ln, "BRK takes an immediate from 0 to 65535");
    }
    Ok(0xD420_0000 | ((imm as u32) << 5))
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::rejects;
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
        rejects(assemble("BIC X0, X1, #1"), "use AND with the inverted mask");
        rejects(assemble("MVN X0, #1"), "expected a register here, got `#1`");
        assert!(assemble("BIC X0, X1, X2, LSL #1").is_ok());
        assert!(assemble("MVN X0, X1, LSL #2").is_ok());
    }

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
        rejects(result, "unknown mnemonic `foobar'");
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

    // -- the supported-mnemonic list --

    #[test]
    fn supported_mnemonics_all_reach_an_arm() {
        // Hand `encode_line` each bare mnemonic with no operands. Only the
        // fallthrough answers "unknown mnemonic", so this fails on exactly
        // one thing: a listed name the match has no arm for.
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
        // The other direction: every arm is listed, so the assembler cannot
        // quietly accept a mnemonic the public reference need not document.
        // A match cannot list its own patterns at runtime, so read them off
        // this file's text.
        let source = include_str!("assembler.rs");
        let start = source
            .find("match mn.as_str() {")
            .expect("the dispatch match must be findable");
        let region = &source[start..];
        let end = region
            .find("\n        _ => Err(unknown_mnemonic(")
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
            // The width rule is the table's third column, and the refusal
            // names the extend it broke.
            let bad = format!("ldr x0, [x1, {wrong}, {keyword}]");
            rejects(assemble(&bad), &keyword.to_uppercase());
        }
    }

    // -- the register-alias table --

    #[test]
    fn b_al_assembles_as_the_always_branch() {
        let labels = HashMap::from([("target".to_string(), 8u64)]);
        for spelling in ["b.al target", "bal target", "B.AL target"] {
            let word = encode_line(spelling, 0, &labels, 1).unwrap();
            assert_eq!(word, 0x5400_004E, "{spelling}");
        }
    }
}
