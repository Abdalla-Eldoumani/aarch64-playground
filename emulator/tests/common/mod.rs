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
    "ext", "fabd", "fabs", "facge", "facgt", "fadd", "faddp", "fcmeq",
    "fcmge", "fcmgt", "fcmle", "fcmlt", "fcvtas", "fcvtau", "fcvtl",
    "fcvtl2", "fcvtms", "fcvtmu", "fcvtn", "fcvtn2", "fcvtns", "fcvtnu",
    "fcvtps", "fcvtpu", "fcvtxn", "fcvtxn2", "fcvtzs", "fcvtzu", "fdiv",
    "fmax", "fmaxnm", "fmaxnmp", "fmaxnmv", "fmaxp", "fmaxv", "fmin",
    "fminnm", "fminnmp", "fminnmv", "fminp", "fminv", "fmla", "fmls",
    "fmov", "fmul", "fmulx", "fneg", "frecpe", "frecps", "frecpx", "frinta",
    "frinti", "frintm", "frintn", "frintp", "frintx", "frintz", "frsqrte",
    "frsqrts", "fsqrt", "fsub", "ld1", "ld1r", "ld2", "ld2r", "ld3", "ld3r",
    "ld4", "ld4r", "scvtf", "st1", "st2", "st3", "st4", "tbl", "tbx",
    "trn1", "trn2", "ucvtf", "uzp1", "uzp2", "zip1", "zip2",
];

/// The exceptions to `NOT_YET`: spellings whose mnemonic is queued but
/// which this crate does assemble, because one form of the family landed
/// on its own. The two SCVTF rows are the SIMD-scalar convert gcc emits
/// after `ldr s31, [...]`, which the FP-from-integer encoder has carried
/// since before any of this; the two FMOV rows move a general register to
/// and from the upper lane, which landed with the rest of the lane moves
/// while the vector FMOV immediate stays queued. All four are held to
/// their inventory word like an implemented line, rather than excused.
pub const ALREADY_SUPPORTED: &[&str] = &[
    "scvtf s3, s7",
    "scvtf d3, d7",
    "fmov v3.d[1], x7",
    "fmov x3, v7.d[1]",
];

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
        !self.queued_form()
            && (!NOT_YET.contains(&self.mnemonic())
                || ALREADY_SUPPORTED.contains(&self.spelling.as_str()))
    }

    /// The mirror of `ALREADY_SUPPORTED`: a form of a LANDED mnemonic
    /// that is still queued. Every multiply in the inventory also has a
    /// by-element form (`mul v3.4h, v7.4h, v15.h[7]`), an encoding class
    /// of its own that lands with the rest of the element-indexed
    /// multiplies; their three-same and three-different forms landed
    /// first. A lane index in the LAST operand is what marks one.
    pub fn queued_form(&self) -> bool {
        matches!(
            self.mnemonic().trim_end_matches('2'),
            "mul" | "mla" | "mls" | "sqdmulh" | "sqrdmulh"
                | "smull" | "umull" | "smlal" | "umlal" | "smlsl" | "umlsl"
                | "sqdmull" | "sqdmlal" | "sqdmlsl"
        ) && self.spelling.rsplit(',').next().is_some_and(|last| last.contains('['))
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
