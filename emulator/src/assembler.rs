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
mod bitwise;
mod fp;
mod simd;
mod simd_integer;
mod simd_float;

use operands::*;
use arith::*;
use bitwise::*;
use fp::*;
use simd::*;
use simd_integer::*;
use simd_float::*;

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

    // -- bitfield insert --

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
