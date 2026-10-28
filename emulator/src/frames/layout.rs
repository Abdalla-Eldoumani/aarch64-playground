//! The static frame layout: for each function, the stack slots its code
//! reaches through x29, worked out once per assemble from the decoded words
//! (so m4 and the equates are already resolved) and named from the operand
//! text the student wrote (`a_s` in `str w9, [fp, a_s]`). The view places
//! the slots under each activation's frame record.

use std::collections::HashMap;

use crate::decoder::{self, BrRegOp, DpOp, IndexMode, Instruction as I, LdStOffset, LdStOp, LdStPairOp, MemSize};
use crate::frontend::lexer::{lex, TokenKind};
use crate::frontend::lint::split_functions;
use crate::frontend::m4;
use crate::frontend::pipeline::LinkedImage;
use crate::memory::Memory;

/// Most slots, array bases and element accesses one function records, so
/// a hostile program cannot grow the layout without bound.
pub const MAX_SLOTS: usize = 256;

/// Every function's slots, with the names they use listed once.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FrameLayout {
    /// The program's own identifiers the layout uses, indexed by the
    /// `name` fields below.
    pub names: Vec<String>,
    /// In address order.
    pub functions: Vec<FunctionLayout>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct FunctionLayout {
    pub entry: u64,
    /// The next function's entry, or the end of the program's code.
    pub end: u64,
    pub name: Option<u32>,
    /// What its `stp x29, x30, [sp, -N]!` pushes, 0 without one.
    pub frame_bytes: u64,
    /// It stores x29 and x30 to the stack, so an activation that has not
    /// done so yet is just entered rather than a leaf.
    pub makes_record: bool,
    /// It opens with the course's frame (`stp x29, x30, [sp, -N]!`, then
    /// `mov x29, sp`) and changes sp and x29 nowhere else but in an
    /// `ldp x29, x30, [sp], M`: the functions the frame check reads.
    pub course_frame: bool,
    /// By offset.
    pub slots: Vec<Slot>,
    pub arrays: Vec<ArrayBase>,
    /// Each x29 offset written as a name, once per name and offset: the
    /// frame check's slots. Unlike `slots`, two names at one offset stay
    /// two entries.
    pub named: Vec<NamedSlot>,
    /// The register-offset accesses through an array base: the pc and the
    /// index of its base in `arrays`.
    elements: Vec<(u64, usize)>,
}

/// A load or store target at a fixed offset from the frame record.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Slot {
    /// Bytes from x29.
    pub offset: i64,
    pub width: u8,
    pub float: bool,
    /// The name written as the offset, or for `[x9, field]` with x9 an
    /// array base, the base's name.
    pub name: Option<u32>,
    /// `field` in that second form.
    pub field: Option<u32>,
}

/// An access through x29 at an offset the program wrote as a name (`a_s`
/// in `str w9, [fp, a_s]`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NamedSlot {
    pub offset: i64,
    /// The widest access to it.
    pub width: u8,
    pub name: u32,
    /// The first access at that width.
    pub pc: u64,
    /// Some access writes it.
    pub stored: bool,
}

/// A register set by `add xN, x29, base` and indexed by a register
/// (`[x9, w10, sxtw 2]`): an array of `width`-byte elements at `offset`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ArrayBase {
    pub offset: i64,
    pub width: u8,
    pub name: Option<u32>,
}

impl FrameLayout {
    pub fn function_at(&self, pc: u64) -> Option<&FunctionLayout> {
        let i = self.functions.partition_point(|f| f.entry <= pc).checked_sub(1)?;
        let f = &self.functions[i];
        (pc < f.end).then_some(f)
    }

    /// Whether the function entered at `entry` pushes a frame record.
    pub fn makes_record(&self, entry: u64) -> bool {
        self.function_at(entry).is_some_and(|f| f.makes_record)
    }

    /// The layout as the flat numbers the wasm hands the web, a missing
    /// name as -1: the function count, then per function its entry, end,
    /// name, frame bytes, whether it makes a record (1 or 0), and its slot
    /// and array counts, followed by each slot (offset, width, float 1 or
    /// 0, name, field) and each array (offset, width, name).
    pub fn numbers(&self) -> Vec<f64> {
        let id = |name: Option<u32>| name.map_or(-1.0, f64::from);
        let mut out = vec![self.functions.len() as f64];
        for f in &self.functions {
            out.extend([
                f.entry as f64,
                f.end as f64,
                id(f.name),
                f.frame_bytes as f64,
                f64::from(u8::from(f.makes_record)),
                f.slots.len() as f64,
                f.arrays.len() as f64,
            ]);
            for s in &f.slots {
                out.extend([s.offset as f64, f64::from(s.width), f64::from(u8::from(s.float)), id(s.name), id(s.field)]);
            }
            for a in &f.arrays {
                out.extend([a.offset as f64, f64::from(a.width), id(a.name)]);
            }
        }
        out
    }

    /// The element of an array base that a write at `fp_offset` from x29
    /// reached, with the array's name, when the instruction at `pc`
    /// indexes one.
    pub fn element(&self, pc: u64, fp_offset: i64) -> Option<(i64, Option<u32>)> {
        let f = self.function_at(pc)?;
        let &(_, i) = f.elements.iter().find(|(at, _)| *at == pc)?;
        let array = f.arrays[i];
        let from_base = fp_offset.checked_sub(array.offset).filter(|d| *d >= 0)?;
        Some((from_base / i64::from(array.width), array.name))
    }
}

/// The layout of the program `image` holds, assembled from `source` and
/// loaded into `mem`.
pub fn frame_layout(source: &str, image: &LinkedImage, mem: &Memory) -> FrameLayout {
    let in_text = |at: &&u64| (image.text_base..image.text_end).contains(*at);
    // Function starts as the lint reads them (a `.global` label, a `bl`
    // target, or the first label), in source order, which is address
    // order inside .text; then main, wherever it falls.
    let mut starts: Vec<(u64, String)> = Vec::new();
    if let Ok(expanded) = m4::expand(source) {
        for segment in split_functions(&expanded.text) {
            if let Some(&at) = image.symbols.get(&segment.name).filter(in_text) {
                if starts.last().is_none_or(|last| last.0 < at) {
                    starts.push((at, segment.name));
                }
            }
        }
    }
    if let Some(&main) = image.symbols.get("main").filter(in_text) {
        let at = starts.partition_point(|s| s.0 < main);
        if starts.get(at).is_none_or(|s| s.0 != main) {
            starts.insert(at, (main, "main".to_string()));
        }
    }
    let scan = Scan { mem, lines: &image.line_map, symbols: &image.symbols, source: source.lines().collect() };
    let mut names = Vec::new();
    let functions = (0..starts.len())
        .map(|i| {
            let end = starts.get(i + 1).map_or(image.text_end, |next| next.0);
            let (entry, name) = &starts[i];
            let name = Some(add_name(&mut names, name.clone()));
            scan.function(*entry, end, name, &mut names)
        })
        .collect();
    FrameLayout { names, functions }
}

/// Put `name` in the table and return its index. A name used twice is
/// listed twice: the table goes to the web once per assemble, and building
/// it without a lookup keeps the wasm small.
fn add_name(names: &mut Vec<String>, name: String) -> u32 {
    names.push(name);
    (names.len() - 1) as u32
}

struct Scan<'a> {
    mem: &'a Memory,
    /// `(pc, editor line)` in address order, as the linker emits it.
    lines: &'a [(u64, u32)],
    /// Labels at their addresses and equates at their values.
    symbols: &'a HashMap<String, u64>,
    source: Vec<&'a str>,
}

/// The editor line of the instruction at `pc` in the linker's line map, 0
/// for none.
pub fn line_at(lines: &[(u64, u32)], pc: u64) -> u32 {
    match lines.get(lines.partition_point(|&(at, _)| at < pc)) {
        Some(&(at, line)) if at == pc => line,
        _ => 0,
    }
}

impl Scan<'_> {
    fn text(&self, pc: u64) -> &str {
        let line = line_at(self.lines, pc) as usize;
        line.checked_sub(1).and_then(|l| self.source.get(l)).copied().unwrap_or("")
    }

    /// One function's words in address order. Flow-insensitive: a register
    /// is an array base from its `add xN, x29, ..` to the next instruction
    /// that writes it.
    fn function(&self, entry: u64, end: u64, name: Option<u32>, names: &mut Vec<String>) -> FunctionLayout {
        let mut f = FunctionLayout { entry, end, name, ..FunctionLayout::default() };
        let mut bases: [Option<(i64, Option<u32>)>; 31] = [None; 31];
        let (mut opens, mut sets_fp, mut strays) = (false, false, false);
        let mut pc = entry;
        while pc < end {
            let at = pc;
            pc += 4;
            let Ok(instr) = self.mem.read_u32(at).and_then(decoder::decode) else { continue };
            let text = self.text(at);
            let overwritten = written(&instr);
            match at - entry {
                0 => {
                    opens = matches!(instr, I::LdStPair { op: LdStPairOp::Stp, rt: 29, rt2: 30, rn: 31, imm7, mode: IndexMode::PreIndex, .. } if imm7 < 0)
                }
                4 => sets_fp = instr == I::DpImm { op: DpOp::Add, sf: true, rd: 29, rn: 31, imm: 0, shift: 0 },
                _ => {
                    strays |= ((overwritten >> 29) & 1 != 0 || moves_sp(&instr))
                        && !matches!(instr, I::LdStPair { op: LdStPairOp::Ldp, rt: 29, rt2: 30, rn: 31, mode: IndexMode::PostIndex, .. })
                }
            }
            let base = |rn: u8| bases.get(usize::from(rn)).copied().flatten();
            if f.slots.len() + f.arrays.len() + f.elements.len() < MAX_SLOTS {
                if let Some((rn, off, size, float, pair)) = fixed_access(&instr) {
                    let width = size.bytes() as u8;
                    let written_name = offset_name(text);
                    // A label written there is an address, not an offset.
                    if let Some(name) = written_name.as_deref().filter(|n| rn == 29 && self.symbols.get(*n).is_none_or(|&v| v as i64 == off)) {
                        let stored = matches!(
                            instr,
                            I::LdSt { op: LdStOp::Str, .. }
                                | I::FpLdSt { load: false, .. }
                                | I::LdStPair { op: LdStPairOp::Stp, .. }
                                | I::FpLdStPair { op: LdStPairOp::Stp, .. }
                        );
                        add_named(&mut f.named, names, NamedSlot { offset: off, width, name: 0, pc: at, stored }, name);
                    }
                    // Through x29 the written offset names the slot; through
                    // an array base it names a field of the array's.
                    let placed = match (rn, base(rn)) {
                        (29, _) => Some((off, None, false)),
                        (_, Some((offset, base_name))) => Some((offset + off, base_name, true)),
                        _ => None,
                    };
                    if let Some((offset, base_name, through_base)) = placed {
                        if !has_slot(&f.slots, offset) {
                            let written = written_name.map(|n| add_name(names, n));
                            let (name, field) = if through_base { (base_name, written) } else { (written, None) };
                            insert_slot(&mut f.slots, Slot { offset, width, float, name, field });
                        }
                        let second = offset + i64::from(width);
                        if pair && !has_slot(&f.slots, second) {
                            insert_slot(&mut f.slots, Slot { offset: second, width, float, name: None, field: None });
                        }
                    }
                }
                if let Some((Some((offset, name)), size)) = indexed_access(&instr).map(|(rn, size)| (base(rn), size)) {
                    let width = size.bytes() as u8;
                    let i = match f.arrays.iter().position(|a| a.offset == offset && a.width == width) {
                        Some(i) => i,
                        None => {
                            f.arrays.push(ArrayBase { offset, width, name });
                            f.arrays.len() - 1
                        }
                    };
                    f.elements.push((at, i));
                }
            }
            if let I::LdStPair { op: LdStPairOp::Stp, rt: 29, rt2: 30, rn: 31, imm7, mode, .. } = instr {
                f.makes_record = true;
                if mode == IndexMode::PreIndex && imm7 < 0 {
                    f.frame_bytes = imm7.unsigned_abs().into();
                }
            }
            for (r, base) in bases.iter_mut().enumerate() {
                if (overwritten >> r) & 1 != 0 {
                    *base = None;
                }
            }
            if let I::DpImm { op: DpOp::Add, sf: true, rd, rn: 29, imm, shift } = instr {
                if let Some(slot) = bases.get_mut(usize::from(rd)) {
                    *slot = Some((i64::from(imm) << shift, last_operand_name(text).map(|n| add_name(names, n))));
                }
            }
        }
        f.course_frame = opens && sets_fp && !strays;
        f
    }
}

/// Note `access`, an x29 access written as `name`, in the entry the name
/// already has at that offset, or as a new one (whose `name` index is set
/// here).
fn add_named(named: &mut Vec<NamedSlot>, names: &mut Vec<String>, access: NamedSlot, name: &str) {
    if let Some(s) = named.iter_mut().find(|s| s.offset == access.offset && names[s.name as usize] == name) {
        if s.width < access.width {
            (s.width, s.pc) = (access.width, access.pc);
        }
        s.stored |= access.stored;
    } else if named.len() < MAX_SLOTS {
        named.push(NamedSlot { name: add_name(names, name.to_string()), ..access });
    }
}

/// Whether an instruction changes sp: an add, sub or logical immediate into
/// it, or a base written back to it.
fn moves_sp(instr: &I) -> bool {
    let to_sp = |rn: u8, mode: IndexMode| rn == 31 && mode != IndexMode::SignedOffset;
    match *instr {
        I::DpImm { op: DpOp::Add | DpOp::Sub, rd: 31, .. }
        | I::DpRegExt { op: DpOp::Add | DpOp::Sub, rd: 31, .. }
        | I::LogImm { rd: 31, set_flags: false, .. } => true,
        I::LdSt { rn, mode, .. }
        | I::LdrSignExtended { rn, mode, .. }
        | I::FpLdSt { rn, mode, .. }
        | I::LdStPair { rn, mode, .. }
        | I::FpLdStPair { rn, mode, .. } => to_sp(rn, mode),
        _ => false,
    }
}

fn has_slot(slots: &[Slot], offset: i64) -> bool {
    slots.binary_search_by_key(&offset, |s| s.offset).is_ok()
}

/// Insert keeping `slots` in offset order.
fn insert_slot(slots: &mut Vec<Slot>, slot: Slot) {
    let at = slots.partition_point(|s| s.offset < slot.offset);
    slots.insert(at, slot);
}

/// A load or store at a fixed offset with no writeback: the base
/// register, the offset, the width, whether it moves an FP register, and
/// whether it is a pair.
fn fixed_access(instr: &I) -> Option<(u8, i64, MemSize, bool, bool)> {
    let signed = IndexMode::SignedOffset;
    match *instr {
        I::LdSt { rn, offset: LdStOffset::Immediate(off), size, mode, .. }
        | I::LdrSignExtended { rn, offset: LdStOffset::Immediate(off), size, mode, .. }
            if mode == signed =>
        {
            Some((rn, off, size, false, false))
        }
        I::FpLdSt { rn, offset: LdStOffset::Immediate(off), size, mode, .. } if mode == signed => {
            Some((rn, off, size, true, false))
        }
        I::LdStPair { rn, imm7, sf, mode, .. } if mode == signed => {
            Some((rn, imm7.into(), if sf { MemSize::X } else { MemSize::W }, false, true))
        }
        I::FpLdStPair { rn, imm7, size, mode, .. } if mode == signed => Some((rn, imm7.into(), size, true, true)),
        _ => None,
    }
}

/// A load or store indexed by a register: the base register and the width.
fn indexed_access(instr: &I) -> Option<(u8, MemSize)> {
    match *instr {
        I::LdSt { rn, offset: LdStOffset::Register { .. }, size, .. }
        | I::LdrSignExtended { rn, offset: LdStOffset::Register { .. }, size, .. }
        | I::FpLdSt { rn, offset: LdStOffset::Register { .. }, size, .. } => Some((rn, size)),
        _ => None,
    }
}

/// The general registers an instruction overwrites, bit N for xN, as far
/// as base tracking needs: results, loads, writeback, and what a call may
/// change.
fn written(instr: &I) -> u32 {
    let bit = |r: u8| if r < 31 { 1u32 << r } else { 0 };
    let writeback = |rn: u8, mode: IndexMode| if mode == IndexMode::SignedOffset { 0 } else { bit(rn) };
    match *instr {
        I::DpImm { rd, .. }
        | I::DpReg { rd, .. }
        | I::MoveWide { rd, .. }
        | I::LogImm { rd, .. }
        | I::LogReg { rd, .. } => bit(rd),
        I::LdSt { op: LdStOp::Ldr, rt, rn, mode, .. } | I::LdrSignExtended { rt, rn, mode, .. } => {
            bit(rt) | writeback(rn, mode)
        }
        I::LdSt { rn, mode, .. } | I::FpLdSt { rn, mode, .. } | I::FpLdStPair { rn, mode, .. } => writeback(rn, mode),
        I::LdStPair { op: LdStPairOp::Stp, rn, mode, .. } => writeback(rn, mode),
        I::LdStPair { rt, rt2, rn, mode, .. } => bit(rt) | bit(rt2) | writeback(rn, mode),
        // x0 to x18
        I::BrImm { link: true, .. } | I::BrReg { op: BrRegOp::Blr, .. } => 0x7_FFFF,
        _ => 0,
    }
}

/// The tokens of the instruction on a source line, its comment dropped.
fn tokens(text: &str) -> Vec<TokenKind> {
    lex(m4::strip_comment(text), 1).map(|t| t.into_iter().map(|t| t.kind).collect()).unwrap_or_default()
}

/// The name written as a memory operand's offset: `a_s` in
/// `str w9, [fp, a_s]`. A number or an expression names nothing.
fn offset_name(text: &str) -> Option<String> {
    let t = tokens(text);
    let open = t.iter().position(|k| *k == TokenKind::LBracket)?;
    match &t[open + 1..] {
        [_, TokenKind::Comma, TokenKind::Ident(name), TokenKind::RBracket, ..]
        | [_, TokenKind::Comma, TokenKind::Hash, TokenKind::Ident(name), TokenKind::RBracket, ..] => {
            Some(name.clone())
        }
        _ => None,
    }
}

/// The name written as an instruction's last operand: `arr_s` in
/// `add x9, fp, arr_s`.
fn last_operand_name(text: &str) -> Option<String> {
    let t = tokens(text);
    let comma = t.iter().rposition(|k| *k == TokenKind::Comma)?;
    match &t[comma + 1..] {
        [TokenKind::Ident(name)] | [TokenKind::Hash, TokenKind::Ident(name)] => Some(name.clone()),
        _ => None,
    }
}
