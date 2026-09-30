//! The instruction encoder: one line of assembly in, one 32-bit word out.
//! `assemble` runs it over bare-metal source; the hosted pipeline calls
//! `encode_line_absolute` for each ordinary instruction. This file holds
//! the entry points, `SUPPORTED_MNEMONICS`, the `encode_line` dispatch,
//! and the error builders every encoder shares. Operand parsing and the
//! encoders, by instruction class, live in the child modules below; each
//! starts with `use super::*`, so the imports here serve them too.

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
mod load_store;
mod branch;

use operands::*;
use arith::*;
use bitwise::*;
use fp::*;
use simd::*;
use simd_integer::*;
use simd_float::*;
use load_store::*;
use branch::*;

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
    assemble_expanded(&crate::frontend::parser::name_local_labels(&expanded.text)?)
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
    fn numeric_local_labels_work_without_sections_too() {
        let source = "mov x0, 3\nmov x1, 0\n1: add x1, x1, 2\nsubs x0, x0, 1\nb.ne 1b\ncbz x0, 1f\nmov x1, 99\n1: svc 0\n";
        let code = assemble(source).unwrap();
        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(100).unwrap();
        assert_eq!(cpu.regs.read_gpr(1, true), 6);
        assert!(cpu.is_halted());
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
}
