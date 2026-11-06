//! The playground's own frame check, read from the static layout: in each
//! function on the course's frame pattern, named slots that overlap, are
//! stored outside the frame, sit on the saved fp or lr, or hold 8 bytes off a
//! multiple of 8, and a frame size that leaves sp off a multiple of 16. GNU
//! as reports none of these. Advisory only: numbers and the program's own
//! names, worded by the web.

use super::layout::{frame_layout, line_at, FrameLayout, NamedSlot};
use crate::frontend::pipeline::assemble_hosted;
use crate::hosted::HostTable;
use crate::memory::Memory;

/// `Finding::rule`: two named slots share bytes.
pub const OVERLAP: u8 = 0;
/// A slot the function stores to reaches below x29 or past the end of the
/// frame.
pub const OUTSIDE: u8 = 1;
/// A slot shares bytes with the saved fp or lr (x29 + 0 to 15).
pub const ON_RECORD: u8 = 2;
/// An 8-byte slot at an offset that is not a multiple of 8.
pub const UNALIGNED: u8 = 3;
/// The frame's size leaves sp off a multiple of 16.
pub const ODD_FRAME: u8 = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Finding {
    pub rule: u8,
    /// The editor line: the slot's access (an overlap's higher slot), or
    /// the frame push.
    pub line: u32,
    /// The function's name in the layout's name table.
    pub function: Option<u32>,
    pub frame_bytes: u64,
    /// The slot the rule is about; an overlap's lower slot.
    pub first: Option<NamedSlot>,
    /// An overlap's higher slot.
    pub second: Option<NamedSlot>,
}

#[derive(Debug, Default, PartialEq)]
pub struct FrameCheck {
    /// Functions on the pattern.
    pub checked: u32,
    /// Functions off it, which the check leaves alone.
    pub skipped: u32,
    pub findings: Vec<Finding>,
}

/// Check every function of `layout` that is on the pattern; `lines` is the
/// linker's line map.
pub fn check(layout: &FrameLayout, lines: &[(u64, u32)]) -> FrameCheck {
    let mut out = FrameCheck::default();
    for f in &layout.functions {
        if !f.course_frame {
            out.skipped += 1;
            continue;
        }
        out.checked += 1;
        let frame = f.frame_bytes as i64;
        let mut add = |rule, pc, first, second| {
            out.findings.push(Finding { rule, line: line_at(lines, pc), function: f.name, frame_bytes: f.frame_bytes, first, second })
        };
        if frame % 16 != 0 {
            add(ODD_FRAME, f.entry, None, None);
        }
        // In the order the code first reaches each slot. A pairwise scan
        // over at most MAX_SLOTS beats sorting by offset: the sort cost
        // about 1 kB of wasm.
        for (i, &s) in f.named.iter().enumerate() {
            let end = s.offset + i64::from(s.width);
            // One overlap per slot, with a slot that starts below it (or at
            // it, listed first) and reaches into it, so a crowded frame
            // gives one mark a slot.
            let below = f.named.iter().enumerate().find(|&(j, b)| (b.offset, j) < (s.offset, i) && b.offset + i64::from(b.width) > s.offset);
            if let Some((_, &below)) = below {
                add(OVERLAP, s.pc, Some(below), Some(s));
            }
            if s.offset < 16 && end > 0 {
                add(ON_RECORD, s.pc, Some(s), None);
            }
            // Only a store: a read just above the frame is how an argument
            // passed on the stack arrives.
            if s.stored && (s.offset < 0 || end > frame) {
                add(OUTSIDE, s.pc, Some(s), None);
            }
            if s.width == 8 && s.offset % 8 != 0 {
                add(UNALIGNED, s.pc, Some(s), None);
            }
        }
    }
    out
}

/// The check of `source` assembled as `assemble_and_load` would, loaded
/// into a memory of its own so it touches no machine and needs no
/// assemble first, with the layout's name table. Empty when the program
/// does not assemble or is bare metal, which has no layout.
pub fn check_source(source: &str, host: &HostTable) -> (FrameCheck, Vec<String>) {
    let Some(image) = crate::detect_hosted_mode(source).then(|| assemble_hosted(source, host).ok()).flatten() else {
        return Default::default();
    };
    let mut mem = Memory::new();
    for (at, bytes) in &image.writes {
        if mem.write_bytes(*at, bytes).is_err() {
            return Default::default();
        }
    }
    let layout = frame_layout(source, &image, &mem);
    (check(&layout, &image.line_map), layout.names)
}
