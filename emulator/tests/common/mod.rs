//! Shared reading of the csarm SIMD fixtures.
//!
//! `simd-inventory.txt` is the spelling/word ground truth and
//! `simd-behaviour.txt` the per-line state delta; `simd.rs` and
//! `simd_behaviour.rs` both need the same view of which mnemonics this
//! crate has landed, so the reading lives here once.

#![allow(dead_code)] // each suite reads a different part of this module

/// Mnemonics in the inventory that the crate does not assemble yet. Their
/// lines must be refused, so the list fails the moment one starts working.
/// Every family has landed, so it is empty; it stays for any family that
/// is taken back out.
pub const NOT_YET: &[&str] = &[];

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
