//! Data types representing a parsed program: sections, items, symbols, and
//! the full `Program` the parser produces and the linker consumes.
//!
//! Sections are addressed at fixed base addresses (see
//! `SectionKind::default_base`). Overlap would be a bug; leaving big gaps between
//! them makes off-by-N memory bugs obvious in the panel.

use std::collections::{HashMap, HashSet};

use super::lexer::Token;

/// Which section an item lives in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SectionKind {
    Text,
    Data,
    Rodata,
    Bss,
}

impl SectionKind {
    /// Default base address for this section. The fixed per-section layout
    /// used by `Cpu::load_sections`.
    pub fn default_base(self) -> u64 {
        match self {
            SectionKind::Text => 0x0040_0000,
            SectionKind::Rodata => 0x0050_0000,
            SectionKind::Data => 0x0060_0000,
            SectionKind::Bss => 0x0070_0000,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            SectionKind::Text => ".text",
            SectionKind::Rodata => ".rodata",
            SectionKind::Data => ".data",
            SectionKind::Bss => ".bss",
        }
    }
}

/// A section and its accumulated items, in source order.
#[derive(Debug, Clone)]
pub struct Section {
    pub kind: SectionKind,
    pub items: Vec<Item>,
}

impl Section {
    pub fn new(kind: SectionKind) -> Self {
        Section {
            kind,
            items: Vec::new(),
        }
    }
}

/// One thing a section contains. The linker walks these in order to compute
/// final offsets, emit bytes, and resolve references. Instructions are
/// stored as raw token slices because their encoding depends on the symbol
/// table the linker builds; holding unresolved tokens keeps parsing
/// forward-reference-friendly.
#[derive(Debug, Clone)]
pub enum Item {
    /// Raw bytes. Emitted by `.byte`, `.hword`/`.short`, `.word`, `.quad`,
    /// `.double`, `.float`, `.string`, `.asciz`, `.ascii`.
    Bytes(Vec<u8>),
    /// Reserve N zero-initialized bytes. Emitted by `.skip`/`.zero`, and by
    /// the BSS path (no initial data, just a size).
    Reserve(u64),
    /// Realign the offset to a byte boundary. `.balign N` sets `N`;
    /// `.align N` converts to `2^N` for us. Padding bytes are zero.
    AlignToBytes(u64),
    /// A label fixed at the current offset, captured during parsing.
    Label(String),
    /// `name = expr` assignment encountered inline in a section. The body
    /// is evaluated at this point in the section's byte walk so `.` means
    /// the address where the assignment appears, not where the symbol is
    /// eventually used.
    SymbolAssignment {
        name: String,
        body: String,
        original_line: usize,
    },
    /// Raw token slice for an instruction line, encoded later by the linker.
    Instruction {
        tokens: Vec<Token>,
        original_line: usize,
    },
    /// Integer data slots whose expressions reference symbols or `.`, one
    /// token group per comma-separated value. Course pointer tables
    /// (`array_months: .dword label_january, label_february, ...`) name
    /// labels whose addresses only exist once the linker has placed every
    /// section, so the parser defers these for link-time evaluation
    /// instead of valuing them against an empty symbol table. `width` is
    /// the slot size in bytes; the item occupies `exprs.len() * width`.
    DataExprs {
        exprs: Vec<Vec<Token>>,
        width: usize,
        original_line: usize,
    },
}

/// Resolved or pending value for a named symbol.
#[derive(Debug, Clone)]
pub enum SymbolValue {
    /// `name = expr` where `expr` only referenced already-known constants.
    Constant(i64),
    /// `name = expr` containing a label-typed forward reference; the linker
    /// comes back to this after addresses settle.
    Pending {
        tokens: Vec<Token>,
        original_line: usize,
    },
    /// A label defined inside `section` at a byte offset from its base.
    Address { section: SectionKind, offset: u64 },
}

/// Output of the parser: sections (with items), symbols (labels and
/// assignments), aliases from m4 (so the UI can show register labels),
/// globals (names flagged with `.global`/`.globl`), and the m4 source map
/// so later errors point at the right pre-expansion line.
#[derive(Debug, Clone)]
pub struct Program {
    pub sections: Vec<Section>,
    pub symbols: HashMap<String, SymbolValue>,
    pub aliases: HashMap<String, String>,
    pub globals: HashSet<String>,
    pub source_map: Vec<usize>,
    /// Post-m4-expansion source text, kept so the linker can reconstruct
    /// each instruction's original line for the legacy encoder.
    pub expanded_source: String,
}

impl Program {
    pub fn new() -> Self {
        Program {
            sections: Vec::new(),
            symbols: HashMap::new(),
            aliases: HashMap::new(),
            globals: HashSet::new(),
            source_map: Vec::new(),
            expanded_source: String::new(),
        }
    }

    pub fn section(&self, kind: SectionKind) -> Option<&Section> {
        self.sections.iter().find(|s| s.kind == kind)
    }

    pub fn section_or_insert(&mut self, kind: SectionKind) -> &mut Section {
        if let Some(i) = self.sections.iter().position(|s| s.kind == kind) {
            return &mut self.sections[i];
        }
        self.sections.push(Section::new(kind));
        let last = self.sections.len() - 1;
        &mut self.sections[last]
    }
}

impl Default for Program {
    fn default() -> Self {
        Program::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn section_base_addresses_are_stable() {
        assert_eq!(SectionKind::Text.default_base(), 0x0040_0000);
        assert_eq!(SectionKind::Rodata.default_base(), 0x0050_0000);
        assert_eq!(SectionKind::Data.default_base(), 0x0060_0000);
        assert_eq!(SectionKind::Bss.default_base(), 0x0070_0000);
    }

    #[test]
    fn section_or_insert_is_idempotent() {
        let mut p = Program::new();
        p.section_or_insert(SectionKind::Text);
        p.section_or_insert(SectionKind::Text);
        assert_eq!(p.sections.len(), 1);
    }

    #[test]
    fn different_kinds_get_their_own_sections() {
        let mut p = Program::new();
        p.section_or_insert(SectionKind::Text);
        p.section_or_insert(SectionKind::Data);
        p.section_or_insert(SectionKind::Bss);
        assert_eq!(p.sections.len(), 3);
    }
}
