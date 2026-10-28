//! The shadow call stack behind the stack frames view: one record per call
//! the program is inside, pushed when a `bl` or `blr` enters the program's
//! own code and popped by the `ret` that comes back. Only calls, returns and
//! a store that lands on a caller's frame record touch it, so a run pays
//! next to nothing for it on any other step; the frame chain and the view
//! are worked out once per snapshot (`frame_view`).
//!
//! Every value here is a number (an address, a step, a register mask); the
//! web words them, because every string in the crate ships in the wasm.

pub mod check;
pub mod layout;

use crate::cpu::{Cpu, STACK_BASE, STACK_FLOOR};
use crate::memory::Memory;
use layout::FrameLayout;

/// Most activations recorded. The C corpus recurses 7,945 deep; past this
/// the tracker counts calls without recording them.
pub const MAX_ACTIVATIONS: usize = 16_384;

/// Most activations a view draws: main, then the innermost 63.
pub const MAX_DRAWN: usize = 64;

/// How far below the top a `ret` looks for the call it returns from. The
/// bound keeps a loop of bad returns from scanning a deep stack every step.
///
/// shortcut: a return that skips more than 64 calls counts as unexpected
/// and leaves them on the stack; search deeper if a course program ever
/// unwinds that far in one `ret`.
const UNWIND_SEARCH: usize = 64;

/// `Activation::flags`: it called out with `bl` or `blr` before it had
/// stored x30 anywhere, so that call's return address replaced its own.
pub const LR_UNSAVED: u8 = 1;
/// `Activation::flags`: qsort or bsearch entered it to compare two
/// elements; no call the program wrote did.
pub const RUNTIME_CALL: u8 = 2;
/// `Activation::flags`: it has stored x30 (a `str` or `stp` of x30).
pub const LR_STORED: u8 = 4;

/// `Frame::state`: the frame record is pushed and fp points at it.
pub const COMPLETE: u8 = 0;
/// Just entered: nothing pushed yet.
pub const ENTERED: u8 = 1;
/// The record is pushed but fp is not set to it yet.
pub const RESERVED: u8 = 2;
/// A function that never pushes a frame of its own.
pub const LEAF: u8 = 3;
/// sp and fp match none of the shapes above.
pub const NONSTANDARD: u8 = 4;
/// A caller that called out without a frame record.
pub const NO_RECORD: u8 = 5;

/// The latest write that changed one slot of a caller's frame record.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Hit {
    /// The step that wrote it; 0 for none.
    pub step: u64,
    /// The instruction that wrote it, or the `bl` of the library call
    /// that did.
    pub pc: u64,
    /// Where the write started, from x29 at the time: with the layout it
    /// names the array element a write through an array base reached.
    pub fp_offset: i64,
}

/// One call the program is inside, as the call left the machine.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Activation {
    /// The address the call entered.
    pub entry: u64,
    /// The `bl` or `blr`, the qsort or bsearch stub for a comparator, 0
    /// for the program's first function.
    pub call_pc: u64,
    pub ret_addr: u64,
    pub sp_entry: u64,
    pub fp_entry: u64,
    /// x19 to x28 at entry, which the call must hand back unchanged.
    pub saved: [u64; 10],
    /// Where its frame record sat when it last called out, 0 for none.
    pub record: u64,
    /// One more than the index of the nearest caller with a frame record,
    /// 0 for none: a chain through every record above this activation.
    watch: usize,
    pub flags: u8,
    /// The return address of the latest `bl` or `blr` it made, 0 before
    /// its first.
    pub last_ret: u64,
    /// The latest writes that changed its saved fp and its saved lr.
    pub fp_hit: Hit,
    pub lr_hit: Hit,
}

/// A `ret` that went to no caller's return address, and the call it
/// returned from as that call stood at the `ret`: a later return can pop
/// the call before a snapshot shows the event.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct BadReturn {
    /// 0 when no return has gone astray.
    pub step: u64,
    pub pc: u64,
    pub target: u64,
    /// The call's place in the call stack, 0 for main.
    pub index: u64,
    pub entry: u64,
    pub ret_addr: u64,
    pub flags: u8,
    pub last_ret: u64,
    pub lr_hit: Hit,
}

/// The calls the program is inside, main first.
#[derive(Debug, Clone, Default)]
pub struct CallStack {
    acts: Vec<Activation>,
    /// Calls past `MAX_ACTIVATIONS` not yet returned from.
    uncounted: u64,
    bad_return: BadReturn,
}

/// What one step changed in the call stack, for its step-back frame: the
/// small fields as they were, each activation it removed (innermost
/// first), and the old record, flags and last call, or the old hits, of
/// each one it changed in place.
#[derive(Debug, Default)]
pub struct FrameUndo {
    len: usize,
    uncounted: u64,
    /// The bad return a step replaced; copied only then, since it is wide
    /// and almost no step touches it.
    bad_return: Option<BadReturn>,
    removed: Vec<Activation>,
    marked: Vec<(usize, u64, u8, u64)>,
    hit: Vec<(usize, Hit, Hit)>,
}

/// How the innermost activation's frame stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Shape {
    /// sp and fp as the call left them.
    Bare,
    /// A record holding the caller's fp and this call's lr sits at sp; fp
    /// still holds the caller's.
    Reserved,
    /// fp points at that record.
    Complete,
    Nonstandard,
}

fn shape(a: &Activation, sp: u64, fp: u64, mem: &Memory) -> Shape {
    // One 16-byte read: the saved fp, then the saved lr above it.
    let record = u128::from(a.fp_entry) | u128::from(a.ret_addr) << 64;
    let holds_record = |at: u64| mem.read_u128(at).ok() == Some(record);
    if sp == a.sp_entry && fp == a.fp_entry {
        Shape::Bare
    } else if fp != a.fp_entry && fp < a.sp_entry && holds_record(fp) {
        Shape::Complete
    } else if sp < a.sp_entry && fp == a.fp_entry && holds_record(sp) {
        Shape::Reserved
    } else {
        Shape::Nonstandard
    }
}

/// x19 to x28 out of a register snapshot.
fn callee_saved(regs: &[u64; 32]) -> [u64; 10] {
    let mut out = [0; 10];
    out.copy_from_slice(&regs[19..29]);
    out
}

impl CallStack {
    pub fn activations(&self) -> &[Activation] {
        &self.acts
    }

    /// Calls made past `MAX_ACTIVATIONS` that have not returned.
    pub fn uncounted(&self) -> u64 {
        self.uncounted
    }

    pub fn bad_return(&self) -> BadReturn {
        self.bad_return
    }

    /// How many calls deep the program is, counted or not.
    pub fn depth(&self) -> u64 {
        self.acts.len() as u64 + self.uncounted
    }

    pub(crate) fn clear(&mut self) {
        self.acts.clear();
        self.uncounted = 0;
        self.bad_return = BadReturn::default();
    }

    /// A fresh program: its first function, entered at `entry` with the
    /// registers the loader left.
    pub(crate) fn start(&mut self, entry: u64, regs: &[u64; 32]) {
        self.clear();
        self.acts.push(Activation {
            entry,
            ret_addr: regs[30],
            sp_entry: regs[31],
            fp_entry: regs[29],
            saved: callee_saved(regs),
            ..Activation::default()
        });
    }

    /// Open `log` for the step about to run.
    pub(crate) fn record_undo(&self, log: &mut FrameUndo) {
        log.len = self.acts.len();
        log.uncounted = self.uncounted;
        log.bad_return = None;
        log.removed.clear();
        log.marked.clear();
        log.hit.clear();
    }

    /// Put back what the step `log` recorded changed. A step either pushed
    /// one activation or removed some, never both.
    pub(crate) fn undo(&mut self, log: FrameUndo) {
        self.acts.truncate(log.len - log.removed.len());
        self.acts.extend(log.removed.into_iter().rev());
        for (i, record, flags, last_ret) in log.marked.into_iter().rev() {
            if let Some(a) = self.acts.get_mut(i) {
                (a.record, a.flags, a.last_ret) = (record, flags, last_ret);
            }
        }
        for (i, fp_hit, lr_hit) in log.hit.into_iter().rev() {
            if let Some(a) = self.acts.get_mut(i) {
                (a.fp_hit, a.lr_hit) = (fp_hit, lr_hit);
            }
        }
        self.uncounted = log.uncounted;
        if let Some(bad) = log.bad_return {
            self.bad_return = bad;
        }
    }

    /// A `bl` or `blr` at `pc` just sent the program to `target`. The
    /// caller's frame is settled, so note where its record sits, the call's
    /// return address, and whether lr went out unsaved; then push the
    /// callee when `target` is the program's own code (a library call is
    /// not pushed).
    pub(crate) fn on_call(
        &mut self,
        pc: u64,
        target: u64,
        into_program: bool,
        regs: &[u64; 32],
        mem: &Memory,
        log: Option<&mut FrameUndo>,
    ) {
        let (sp, fp) = (regs[31], regs[29]);
        // Past the cap the real caller is one the stack never recorded.
        let top = self.acts.len().wrapping_sub(1);
        if let (0, Some(caller)) = (self.uncounted, self.acts.last_mut()) {
            let record = match shape(caller, sp, fp, mem) {
                Shape::Complete => fp,
                Shape::Reserved => sp,
                _ => 0,
            };
            // What the call did, not the frame's shape: a function that
            // saved lr without setting fp still saved it.
            let flags = if caller.flags & LR_STORED == 0 { caller.flags | LR_UNSAVED } else { caller.flags };
            let last_ret = pc.wrapping_add(4);
            if (record, flags, last_ret) != (caller.record, caller.flags, caller.last_ret) {
                if let Some(log) = log {
                    log.marked.push((top, caller.record, caller.flags, caller.last_ret));
                }
                (caller.record, caller.flags, caller.last_ret) = (record, flags, last_ret);
            }
        }
        if into_program {
            self.push(Activation {
                entry: target,
                call_pc: pc,
                ret_addr: pc.wrapping_add(4),
                sp_entry: sp,
                fp_entry: fp,
                saved: callee_saved(regs),
                ..Activation::default()
            });
        }
    }

    /// The innermost call just stored x30: a call it makes from here goes
    /// out with lr saved.
    pub(crate) fn on_lr_store(&mut self, log: Option<&mut FrameUndo>) {
        let top = self.acts.len().wrapping_sub(1);
        // Past the cap the store is an unrecorded call's.
        if let (0, Some(a)) = (self.uncounted, self.acts.last_mut()) {
            if a.flags & LR_STORED == 0 {
                if let Some(log) = log {
                    log.marked.push((top, a.record, a.flags, a.last_ret));
                }
                a.flags |= LR_STORED;
            }
        }
    }

    /// qsort or bsearch at `stub_pc` just sent the program to its
    /// comparator at `target`, with lr set to come back to the stub.
    pub(crate) fn on_runtime_call(&mut self, stub_pc: u64, target: u64, regs: &[u64; 32]) {
        self.push(Activation {
            entry: target,
            call_pc: stub_pc,
            ret_addr: regs[30],
            sp_entry: regs[31],
            fp_entry: regs[29],
            saved: callee_saved(regs),
            flags: RUNTIME_CALL,
            ..Activation::default()
        });
    }

    fn push(&mut self, mut a: Activation) {
        if self.acts.len() >= MAX_ACTIVATIONS {
            self.uncounted += 1;
            return;
        }
        if let Some(caller) = self.acts.last() {
            a.watch = if caller.record != 0 { self.acts.len() } else { caller.watch };
        }
        self.acts.push(a);
    }

    /// A `ret` (or `br x30`) at `pc`, step `step`, just sent the program to
    /// `target`. Pops the call it returns from (unwinding any it skipped);
    /// a return to no caller is recorded and leaves the stack alone.
    /// Returns the callee-saved registers the returning call left changed
    /// (bit N for xN); main's are its own to keep.
    pub(crate) fn on_return(
        &mut self,
        pc: u64,
        target: u64,
        step: u64,
        regs: &[u64; 32],
        mut log: Option<&mut FrameUndo>,
    ) -> u32 {
        if self.uncounted > 0 {
            self.uncounted -= 1;
            return 0;
        }
        if self.acts.last().is_some_and(|a| a.ret_addr == target) {
            let Some(top) = self.acts.pop() else { return 0 };
            if let Some(log) = log {
                log.removed.push(top);
            }
            if top.call_pc == 0 {
                return 0;
            }
            let now = callee_saved(regs);
            return (0..10)
                .filter(|&j| now[j] != top.saved[j])
                .fold(0, |mask, j| mask | 1 << (19 + j));
        }
        let floor = self.acts.len().saturating_sub(UNWIND_SEARCH);
        if let Some(at) = self.acts[floor..].iter().rposition(|a| a.ret_addr == target) {
            for a in self.acts.drain(floor + at..).rev() {
                if let Some(log) = log.as_deref_mut() {
                    log.removed.push(a);
                }
            }
            return 0;
        }
        if let Some(log) = log {
            log.bad_return = Some(self.bad_return);
        }
        let call = self.acts.last().copied().unwrap_or_default();
        self.bad_return = BadReturn {
            step,
            pc,
            target,
            index: self.acts.len().saturating_sub(1) as u64,
            entry: call.entry,
            ret_addr: call.ret_addr,
            flags: call.flags,
            last_ret: call.last_ret,
            lr_hit: call.lr_hit,
        };
        0
    }

    /// The step's writes (`writes`, from `Memory::step_writes`) against
    /// every caller's frame record. A write that left a saved fp or lr
    /// holding something else is recorded on the record's owner, with the
    /// step and what `writer` returns: the writing pc and x29.
    ///
    /// shortcut: the search takes the records to fall with depth, as they
    /// do whenever a call leaves fp at or above sp; a call made with fp
    /// below sp can put a record out of that order, and a write to it goes
    /// unnamed. Scan every record if such a program ever needs naming.
    pub(crate) fn watch_writes(
        &mut self,
        writes: &[(u64, usize)],
        step: u64,
        mem: &Memory,
        writer: impl FnOnce() -> (u64, u64),
        mut log: Option<&mut FrameUndo>,
    ) {
        let Some(top) = self.acts.last() else { return };
        // Past the cap the recorded top is itself a caller.
        let nearest = if self.uncounted > 0 && top.record != 0 { self.acts.len() } else { top.watch };
        let Some(nearest) = nearest.checked_sub(1) else { return };
        // The nearest record is the lowest: a write that ends below it
        // reaches none, which is almost every write.
        let floor = self.acts[nearest].record;
        if writes.iter().all(|&(addr, len)| addr.saturating_add(len as u64) <= floor) {
            return;
        }
        let (pc, fp) = writer();
        for &(addr, len) in writes {
            let end = addr.saturating_add(len as u64);
            // An activation's record, or else the nearest above it: these
            // fall with depth, so the ones reaching past `addr` come first.
            let record_from = |a: &Activation| match (a.record, a.watch) {
                (0, 0) => u64::MAX,
                (0, w) => self.acts[w - 1].record,
                (r, _) => r,
            };
            let reaching = self.acts[..=nearest].partition_point(|a| record_from(a).saturating_add(16) > addr);
            let mut at = reaching.checked_sub(1).and_then(|i| match self.acts[i].record {
                0 => self.acts[i].watch.checked_sub(1),
                _ => Some(i),
            });
            // Up the chain from the lowest record reaching past `addr` to
            // the first that starts at or past `end`.
            while let Some(i) = at {
                let a = &mut self.acts[i];
                if a.record >= end {
                    break;
                }
                let lands = |slot: u64| addr < slot.saturating_add(8) && end > slot;
                let old = (a.fp_hit, a.lr_hit);
                let hit = Hit { step, pc, fp_offset: addr.wrapping_sub(fp) as i64 };
                if lands(a.record) && mem.read_u64(a.record).ok() != Some(a.fp_entry) {
                    a.fp_hit = hit;
                }
                let lr_slot = a.record.wrapping_add(8);
                if lands(lr_slot) && mem.read_u64(lr_slot).ok() != Some(a.ret_addr) {
                    a.lr_hit = hit;
                }
                if (a.fp_hit, a.lr_hit) != old {
                    if let Some(log) = log.as_deref_mut() {
                        log.hit.push((i, old.0, old.1));
                    }
                }
                at = a.watch.checked_sub(1);
            }
        }
    }
}

/// One activation as a snapshot draws it.
#[derive(Debug, Clone, PartialEq)]
pub struct Frame {
    /// Its place in the call stack, 0 for main.
    pub index: usize,
    pub activation: Activation,
    /// The bytes it owns run from here up to `activation.sp_entry`: from
    /// its callee's entry sp, or the current sp for the innermost.
    pub lo: u64,
    /// Where its frame record sits now, 0 for none.
    pub record: u64,
    /// `COMPLETE` .. `NO_RECORD`.
    pub state: u8,
    /// The array element each hit wrote, and the array's name, when the
    /// writer went through an array base.
    pub fp_hit_element: Option<(i64, Option<u32>)>,
    pub lr_hit_element: Option<(i64, Option<u32>)>,
}

/// What one snapshot shows of the call stack.
#[derive(Debug, Clone, PartialEq)]
pub struct FrameView {
    /// Steps taken so far, the clock `Hit::step` and `BadReturn::step` read.
    pub step: u64,
    pub uncounted: u64,
    /// Activations between main and the innermost `MAX_DRAWN - 1`.
    pub hidden: usize,
    /// The function every hidden activation entered, 0 when they differ.
    pub hidden_entry: u64,
    /// The x29 chain in memory holds exactly the records the call stack
    /// expects, innermost first.
    pub chain_ok: bool,
    pub bad_return: BadReturn,
    pub frames: Vec<Frame>,
    /// Registers holding what a returning call left in a callee-saved
    /// register: (register, the `ret` that left it).
    pub leftovers: Vec<(u8, u64)>,
}

/// The call stack as the program stands, for one snapshot. The chain walk
/// and the hidden-run check grow with depth, which is why this runs per
/// snapshot and never per step.
pub fn frame_view(cpu: &Cpu, layout: &FrameLayout) -> FrameView {
    let stack = cpu.call_stack();
    let acts = stack.activations();
    let regs = cpu.regs.snapshot();
    let (sp, fp) = (regs[31], regs[29]);
    let n = acts.len();
    let hidden = n.saturating_sub(MAX_DRAWN);
    let first_shown = 1 + hidden;
    let hidden_run = acts.get(1..first_shown).unwrap_or_default();
    let hidden_entry = match hidden_run.first() {
        Some(a) if hidden_run.iter().all(|b| b.entry == a.entry) => a.entry,
        _ => 0,
    };
    let shown = (0..n.min(1)).chain(first_shown..n);
    let frames: Vec<Frame> = shown
        .map(|i| {
            let a = acts[i];
            let innermost = i + 1 == n && stack.uncounted == 0;
            let (record, state) = if innermost {
                match shape(&a, sp, fp, &cpu.mem) {
                    Shape::Complete => (fp, COMPLETE),
                    Shape::Reserved => (sp, RESERVED),
                    Shape::Bare if layout.makes_record(a.entry) => (0, ENTERED),
                    Shape::Bare => (0, LEAF),
                    Shape::Nonstandard => (0, NONSTANDARD),
                }
            } else if a.record != 0 {
                (a.record, COMPLETE)
            } else {
                (0, NO_RECORD)
            };
            // shortcut: past the cap the frames below the last recorded one
            // are unknown, so it is drawn down to its own record; record
            // their entry sp when the cap view needs the exact split.
            let lo = match acts.get(i + 1) {
                Some(callee) => callee.sp_entry,
                None if innermost => sp,
                None => if record != 0 { record } else { a.sp_entry },
            };
            let in_stack = |at: u64| (STACK_FLOOR..=STACK_BASE).contains(&at);
            let (lo, state) = if lo <= a.sp_entry && in_stack(lo) && in_stack(a.sp_entry) {
                (lo, state)
            } else {
                (a.sp_entry, NONSTANDARD)
            };
            let element = |hit: Hit| (hit.step != 0).then(|| layout.element(hit.pc, hit.fp_offset)).flatten();
            Frame {
                index: i,
                activation: a,
                lo,
                record,
                state,
                fp_hit_element: element(a.fp_hit),
                lr_hit_element: element(a.lr_hit),
            }
        })
        .collect();
    FrameView {
        step: cpu.steps_taken(),
        uncounted: stack.uncounted,
        hidden,
        hidden_entry,
        chain_ok: chain_matches(stack, &regs, &cpu.mem),
        bad_return: stack.bad_return,
        frames,
        leftovers: cpu.regs.callee_leftovers(),
    }
}

/// Walk the frame records from x29 (each one's saved fp leads to the next)
/// and compare the saved lrs with the return addresses of the activations
/// that have a record. The walk stops at any fp that is not above the one
/// before it, leaves the live stack, or is misaligned, so a corrupted
/// chain can neither loop nor run long: it is never longer than the call
/// stack it is checked against.
fn chain_matches(stack: &CallStack, regs: &[u64; 32], mem: &Memory) -> bool {
    if stack.uncounted > 0 {
        return false;
    }
    let (sp, fp) = (regs[31], regs[29]);
    let mut expected = Vec::new();
    for (k, a) in stack.acts.iter().rev().enumerate() {
        let has_record = if k == 0 { shape(a, sp, fp, mem) == Shape::Complete } else { a.record != 0 };
        if has_record {
            expected.push(a.ret_addr);
        }
    }
    // The chain ends at the 0 the program's first function found in x29.
    let (mut at, mut k) = (fp, 0);
    while at != 0 {
        if k == expected.len() || at < sp || at >= STACK_BASE || !at.is_multiple_of(8) {
            return false;
        }
        let (Ok(saved_fp), Ok(saved_lr)) = (mem.read_u64(at), mem.read_u64(at.wrapping_add(8))) else {
            return false;
        };
        if saved_lr != expected[k] || (saved_fp != 0 && saved_fp <= at) {
            return false;
        }
        (at, k) = (saved_fp, k + 1);
    }
    k == expected.len()
}

/// The view as the flat numbers the wasm hands the web: a header, a row per
/// drawn frame, then a pair per leftover. Every value fits an f64 exactly
/// below 2^53, which covers every address a course program reaches.
///
/// shortcut: a garbage 64-bit value (a return to 0xdeadbeefdeadbeef) loses
/// its low bits; send such words as two halves if the web ever prints one.
pub fn view_numbers(v: &FrameView) -> Vec<f64> {
    let mut out = vec![
        v.step as f64,
        v.uncounted as f64,
        v.hidden as f64,
        v.hidden_entry as f64,
        f64::from(u8::from(v.chain_ok)),
        v.bad_return.step as f64,
        v.bad_return.pc as f64,
        v.bad_return.target as f64,
        v.frames.len() as f64,
        v.leftovers.len() as f64,
        v.bad_return.index as f64,
        v.bad_return.entry as f64,
        v.bad_return.ret_addr as f64,
        f64::from(v.bad_return.flags),
        v.bad_return.last_ret as f64,
        v.bad_return.lr_hit.step as f64,
        v.bad_return.lr_hit.pc as f64,
    ];
    let element = |e: Option<(i64, Option<u32>)>| match e {
        Some((index, name)) => [index as f64, name.map_or(-1.0, f64::from)],
        None => [-1.0, -1.0],
    };
    for f in &v.frames {
        let a = &f.activation;
        out.extend([
            f.index as f64,
            a.entry as f64,
            a.call_pc as f64,
            a.ret_addr as f64,
            a.sp_entry as f64,
            f.lo as f64,
            a.fp_entry as f64,
            f.record as f64,
            f64::from(f.state),
            f64::from(a.flags),
            a.fp_hit.step as f64,
            a.fp_hit.pc as f64,
        ]);
        out.extend(element(f.fp_hit_element));
        out.extend([a.lr_hit.step as f64, a.lr_hit.pc as f64]);
        out.extend(element(f.lr_hit_element));
        out.push(a.last_ret as f64);
    }
    for &(register, ret_pc) in &v.leftovers {
        out.extend([f64::from(register), ret_pc as f64]);
    }
    out
}
