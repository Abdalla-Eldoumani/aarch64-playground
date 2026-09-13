//! Shared reading of the csarm SIMD fixtures.
//!
//! `simd-inventory.txt` is the spelling/word ground truth and
//! `simd-behaviour.txt` the per-line state delta; `simd.rs` and
//! `simd_behaviour.rs` both need the same view of which mnemonics this
//! crate has landed, so the split lives here rather than twice.

#![allow(dead_code)] // each suite reads a different part of this module

/// Mnemonics the inventory carries that the crate does NOT assemble yet.
/// Every line whose mnemonic is on this list must be REJECTED, so the
/// list flips red the moment a family lands and stops being a claim
/// nobody checks. Removing a name is how a family is declared done.
pub const NOT_YET: &[&str] = &[
    "abs", "add", "addhn", "addhn2", "addp", "addv", "and", "bic", "bif",
    "bit", "bsl", "cls", "clz", "cmeq", "cmge", "cmgt", "cmhi", "cmhs",
    "cmle", "cmlt", "cmtst", "cnt", "dup", "eor", "ext", "fabd", "fabs",
    "facge", "facgt", "fadd", "faddp", "fcmeq", "fcmge", "fcmgt", "fcmle",
    "fcmlt", "fcvtas", "fcvtau", "fcvtl", "fcvtl2", "fcvtms", "fcvtmu",
    "fcvtn", "fcvtn2", "fcvtns", "fcvtnu", "fcvtps", "fcvtpu", "fcvtxn",
    "fcvtxn2", "fcvtzs", "fcvtzu", "fdiv", "fmax", "fmaxnm", "fmaxnmp",
    "fmaxnmv", "fmaxp", "fmaxv", "fmin", "fminnm", "fminnmp", "fminnmv",
    "fminp", "fminv", "fmla", "fmls", "fmov", "fmul", "fmulx", "fneg",
    "frecpe", "frecps", "frecpx", "frinta", "frinti", "frintm", "frintn",
    "frintp", "frintx", "frintz", "frsqrte", "frsqrts", "fsqrt", "fsub",
    "ins", "ld1", "ld1r", "ld2", "ld2r", "ld3", "ld3r", "ld4", "ld4r",
    "mla", "mls", "mov", "movi", "mul", "mvn", "mvni", "neg", "not", "orn",
    "orr", "pmul", "pmull", "pmull2", "raddhn", "raddhn2", "rbit", "rev16",
    "rev32", "rev64", "rshrn", "rshrn2", "rsubhn", "rsubhn2", "saba",
    "sabal", "sabal2", "sabd", "sabdl", "sabdl2", "sadalp", "saddl",
    "saddl2", "saddlp", "saddlv", "saddw", "saddw2", "scvtf", "shadd",
    "shl", "shll", "shll2", "shrn", "shrn2", "shsub", "sli", "smax",
    "smaxp", "smaxv", "smin", "sminp", "sminv", "smlal", "smlal2", "smlsl",
    "smlsl2", "smov", "smull", "smull2", "sqabs", "sqadd", "sqdmlal",
    "sqdmlal2", "sqdmlsl", "sqdmlsl2", "sqdmulh", "sqdmull", "sqdmull2",
    "sqneg", "sqrdmulh", "sqrshl", "sqrshrn", "sqrshrn2", "sqrshrun",
    "sqrshrun2", "sqshl", "sqshlu", "sqshrn", "sqshrn2", "sqshrun",
    "sqshrun2", "sqsub", "sqxtn", "sqxtn2", "sqxtun", "sqxtun2", "srhadd",
    "sri", "srshl", "srshr", "srsra", "sshl", "sshll", "sshll2", "sshr",
    "ssra", "ssubl", "ssubl2", "ssubw", "ssubw2", "st1", "st2", "st3",
    "st4", "sub", "subhn", "subhn2", "suqadd", "sxtl", "sxtl2", "tbl",
    "tbx", "trn1", "trn2", "uaba", "uabal", "uabal2", "uabd", "uabdl",
    "uabdl2", "uadalp", "uaddl", "uaddl2", "uaddlp", "uaddlv", "uaddw",
    "uaddw2", "ucvtf", "uhadd", "uhsub", "umax", "umaxp", "umaxv", "umin",
    "uminp", "uminv", "umlal", "umlal2", "umlsl", "umlsl2", "umov",
    "umull", "umull2", "uqadd", "uqrshl", "uqrshrn", "uqrshrn2", "uqshl",
    "uqshrn", "uqshrn2", "uqsub", "uqxtn", "uqxtn2", "urecpe", "urhadd",
    "urshl", "urshr", "ursqrte", "ursra", "ushl", "ushll", "ushll2",
    "ushr", "usqadd", "usra", "usubl", "usubl2", "usubw", "usubw2", "uxtl",
    "uxtl2", "uzp1", "uzp2", "xtn", "xtn2", "zip1", "zip2",
];

/// The exceptions to `NOT_YET`: spellings whose mnemonic is queued but
/// which this crate already assembles, because a scalar form of it landed
/// earlier for another reason. Both rows here are the SIMD-scalar SCVTF
/// gcc emits after `ldr s31, [...]`, which the FP-from-integer encoder has
/// carried since before any of this. They are held to their inventory word
/// like an implemented line, rather than being excused.
pub const ALREADY_SUPPORTED: &[&str] = &["scvtf s3, s7", "scvtf d3, d7"];

/// One line of `simd-inventory.txt`.
pub struct InventoryLine {
    /// 0-based index among the non-comment lines: the key
    /// `simd-behaviour.txt` rows use.
    pub index: usize,
    pub spelling: String,
    pub word: u32,
    /// How GAS prints the word back, when that differs from `spelling`.
    pub printed: String,
}

impl InventoryLine {
    pub fn mnemonic(&self) -> &str {
        self.spelling.split_whitespace().next().unwrap_or("")
    }

    /// Whether this crate is expected to assemble the line today.
    pub fn implemented(&self) -> bool {
        !NOT_YET.contains(&self.mnemonic())
            || ALREADY_SUPPORTED.contains(&self.spelling.as_str())
    }
}

/// Every inventory line, comments dropped, in file order.
pub fn inventory() -> Vec<InventoryLine> {
    let text = include_str!("../simd-inventory.txt");
    let mut out = Vec::new();
    for line in text.lines() {
        let line = line.trim_end();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut fields = line.split(" => ");
        let spelling = fields.next().expect("a spelling").to_string();
        let word_text = fields
            .next()
            .unwrap_or_else(|| panic!("inventory line has no word: {line}"));
        let word = u32::from_str_radix(word_text.trim_start_matches("0x"), 16)
            .unwrap_or_else(|_| panic!("inventory line has a bad word: {line}"));
        let printed = fields.next().unwrap_or(&spelling).to_string();
        out.push(InventoryLine {
            index: out.len(),
            spelling,
            word,
            printed,
        });
    }
    out
}
