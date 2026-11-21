//! The ring of saved CPU states behind step-back.
//!
//! Each `Snapshot` holds what undoing one instruction needs: registers,
//! memory, the halt and exit flags, the virtual files and open
//! descriptors, and the stdin queue with its echo state. The stdout and stderr buffers are not rolled back
//! (erasing output the student already saw confuses more than it helps),
//! but the counters beside them are, so the host can take back exactly what
//! an undone step printed. The output-flood budget is never restored.
//!
//! The ring keeps at most `capacity` frames and drops the oldest past that.
//!
//! A frame is taken on every step, so it holds the four large parts,
//! registers, memory, the heap and the call stack, only as undo logs of
//! what its step changed in them. A named save, which has to outlive any number of
//! later steps, holds them whole.

use std::collections::{HashMap, VecDeque};

use crate::cpu::{OpenFile, StdinSegment};
use crate::frames::{CallStack, FrameUndo};
use crate::hosted::CallRecord;
use crate::hosted::heap::{HeapState, HeapUndo};
use crate::memory::{MemUndo, Memory};
use crate::registers::{RegUndo, RegisterFile};

/// One step-back frame: the state before a step, with registers, memory
/// and the heap as logs of what the step changed.
pub type StepFrame = Snapshot<RegUndo, MemUndo, HeapUndo, FrameUndo>;

/// One named save: the whole state.
pub type SavedState = Snapshot<RegisterFile, Memory, HeapState, CallStack>;

/// Everything `Cpu::step_back` or a named save needs to restore, with
/// registers, memory, the heap and the call stack in the forms `R`, `M`,
/// `H` and `F` (see the module note).
#[derive(Clone, Default)]
pub struct Snapshot<R, M, H, F> {
    pub regs: R,
    pub mem: M,
    pub halted: bool,
    pub blocked: bool,
    pub exit_code: Option<i64>,
    pub stdin: Vec<u8>,
    /// The stdin queue's per-push echo state, restored with the bytes so
    /// stepping back before a read un-echoes the line and re-running
    /// echoes it exactly once again.
    pub stdin_segments: VecDeque<StdinSegment>,
    pub stdin_closed: bool,
    pub vfs: HashMap<String, Vec<u8>>,
    pub open_files: HashMap<u32, OpenFile>,
    pub next_fd: u32,
    /// PRNG state behind the rand/srand stubs. Restored with the rest of
    /// the machine so step-back and replay reproduce the same draws.
    pub rand_state: crate::hosted::libc::RandState,
    /// Terminal and virtual-clock state behind the interactive
    /// syscalls, restored for the same replay-stability reason.
    pub term: crate::cpu::TermState,
    /// malloc/free allocator state, restored so a stepped-back program
    /// re-allocates the same addresses.
    pub heap: H,
    /// strtok's saved cursor, restored so a stepped-back tokenizing loop
    /// hands out the same token again.
    pub strtok_save: u64,
    /// qsort/bsearch calls in flight, restored so a stepped-back sort
    /// resumes from the same comparison.
    pub callbacks: crate::hosted::callback::CallbackState,
    /// Display counters: bytes appended to stdout / stderr up to this
    /// frame. The buffers themselves stay where they are (see the module
    /// note); these let the host trim its own transcript instead.
    pub stdout_seen: u64,
    pub stderr_seen: u64,
    /// The step budget spent before the step. Step-back puts it back, a
    /// bulk charge or sleep refund included; a named restore leaves the
    /// budget alone (`Cpu::load_state`).
    pub steps_total: u64,
    /// Steps taken, one each whatever they cost the budget: the count the
    /// web shows, so step-back and a named restore both put it back.
    pub steps_taken: u64,
    /// The calls the program is inside, behind the stack frames view.
    pub frames: F,
    /// Where the program's own last instruction before the step was
    /// (`Cpu::last_program_pc`).
    pub last_program_pc: u64,
    /// The last printf or scanf call, behind the call card: a named save
    /// holds it, a step-back frame only when its step replaced it.
    pub call: Option<CallRecord>,
}

/// A memory log past this is a bulk step's: it counts against the ring's
/// budget, and is given back rather than reused when its frame comes round,
/// so the ring keeps a bulk step's buffers only while it holds that step.
/// Smaller logs go uncounted, which spares every other step the sums; 128
/// of them hold at most a quarter of the budget `Cpu` gives the ring.
const BULK_LOG_BYTES: usize = 64 * 1024;

/// What a frame's memory log counts against the ring's budget.
fn counted(held: usize) -> usize {
    if held > BULK_LOG_BYTES { held } else { 0 }
}

/// Fixed-capacity ring of snapshots. Oldest frame falls off when the
/// buffer is full, or when the frames' memory logs together pass the
/// ring's budget; newest frame is popped on `step_back`. A full ring
/// hands its oldest frame back to be refilled in place (`push_slot`).
/// Frames are boxed so that costs a pointer move, not a frame copy, and a
/// frame's log buffers are reused instead of allocated on every step.
pub struct SnapshotRing {
    frames: VecDeque<Box<StepFrame>>,
    capacity: usize,
    /// The most the frames' bulk memory logs may hold together, and what
    /// they hold. A log is counted once its step is over and stays as it
    /// was until its frame leaves.
    budget: usize,
    held: usize,
    /// Named save states: keyed checkpoints the user explicitly stashed.
    /// Separate from the ring because these persist across step-back;
    /// the ring holds only the sliding-window pre-step history.
    named: HashMap<String, SavedState>,
}

impl SnapshotRing {
    pub fn new(capacity: usize, budget: usize) -> Self {
        Self {
            frames: VecDeque::with_capacity(capacity),
            capacity,
            budget,
            held: 0,
            named: HashMap::new(),
        }
    }

    #[cfg(test)]
    pub fn push(&mut self, snap: StepFrame) {
        let held = snap.mem.held;
        *self.push_slot() = snap;
        self.close_newest(held);
    }

    pub fn pop(&mut self) -> Option<Box<StepFrame>> {
        let frame = self.frames.pop_back()?;
        self.held -= counted(frame.mem.held);
        Some(frame)
    }

    /// The slot for a new newest frame, for the caller to fill: the oldest
    /// frame once the ring is full, a blank one before that. A bulk memory
    /// log is given back rather than reused (`BULK_LOG_BYTES`).
    pub fn push_slot(&mut self) -> &mut StepFrame {
        let slot = if self.frames.len() == self.capacity {
            self.frames.pop_front().map(|mut frame| {
                if frame.mem.held > BULK_LOG_BYTES {
                    self.held -= frame.mem.held;
                    frame.mem = MemUndo::default();
                }
                frame
            })
        } else {
            None
        };
        self.frames.push_back(slot.unwrap_or_default());
        let newest = self.frames.len() - 1;
        &mut self.frames[newest]
    }

    /// Count the newest frame's memory log, which holds `held` bytes now
    /// its step is over, when it is a bulk one; then drop the oldest frames
    /// until the bulk logs fit the budget. A frame over it on its own goes
    /// too, and the history starts again after its step, as after a step
    /// the ring did not record.
    pub fn close_newest(&mut self, held: usize) {
        if held > BULK_LOG_BYTES {
            self.held += held;
            while self.held > self.budget {
                let Some(frame) = self.frames.pop_front() else { break };
                self.held -= counted(frame.mem.held);
            }
        }
    }

    /// The frame pushed last, which the running step's undo logs belong to.
    pub fn newest_mut(&mut self) -> Option<&mut StepFrame> {
        self.frames.back_mut().map(|frame| &mut **frame)
    }

    pub fn len(&self) -> usize {
        self.frames.len()
    }

    pub fn is_empty(&self) -> bool {
        self.frames.is_empty()
    }

    pub fn clear(&mut self) {
        self.frames.clear();
        self.held = 0;
        // Named saves survive `reset()` intentionally so a student can
        // stash a checkpoint, reassemble, then restore it.
    }

    pub fn save_named(&mut self, name: impl Into<String>, snap: SavedState) {
        self.named.insert(name.into(), snap);
    }

    pub fn load_named(&self, name: &str) -> Option<SavedState> {
        self.named.get(name).cloned()
    }

    pub fn remove_named(&mut self, name: &str) -> bool {
        self.named.remove(name).is_some()
    }

    pub fn named_keys(&self) -> Vec<String> {
        let mut out: Vec<String> = self.named.keys().cloned().collect();
        out.sort();
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A blank snapshot of either form: a step-back frame where the ring
    /// takes it, a named save where `save_named` does.
    fn empty_snap<R: Default, M: Default, H: Default, F: Default>() -> Snapshot<R, M, H, F> {
        Snapshot {
            regs: R::default(),
            mem: M::default(),
            halted: false,
            blocked: false,
            exit_code: None,
            stdin: Vec::new(),
            stdin_segments: VecDeque::new(),
            stdin_closed: false,
            vfs: HashMap::new(),
            open_files: HashMap::new(),
            next_fd: 3,
            rand_state: crate::hosted::libc::RandState::default(),
            term: crate::cpu::TermState::default(),
            heap: H::default(),
            strtok_save: 0,
            callbacks: Default::default(),
            stdout_seen: 0,
            stderr_seen: 0,
            steps_total: 0,
            steps_taken: 0,
            frames: F::default(),
            last_program_pc: 0,
            call: None,
        }
    }

    #[test]
    fn push_and_pop_lifo() {
        // A frame's registers are a log, so `next_fd` tells frames apart.
        let mut ring = SnapshotRing::new(4, usize::MAX);
        let mut a = empty_snap();
        a.next_fd = 1;
        let mut b = empty_snap();
        b.next_fd = 2;
        ring.push(a);
        ring.push(b);
        assert_eq!(ring.len(), 2);
        let top = ring.pop().unwrap();
        assert_eq!(top.next_fd, 2);
        let next = ring.pop().unwrap();
        assert_eq!(next.next_fd, 1);
        assert!(ring.is_empty());
    }

    #[test]
    fn push_past_capacity_drops_oldest() {
        let mut ring = SnapshotRing::new(2, usize::MAX);
        for i in 0..5u32 {
            let mut s = empty_snap();
            s.next_fd = i;
            ring.push(s);
        }
        assert_eq!(ring.len(), 2);
        assert_eq!(ring.pop().unwrap().next_fd, 4);
        assert_eq!(ring.pop().unwrap().next_fd, 3);
    }

    #[test]
    fn clear_empties_the_ring() {
        let mut ring = SnapshotRing::new(4, usize::MAX);
        ring.push(empty_snap());
        ring.clear();
        assert!(ring.is_empty());
        assert!(ring.pop().is_none());
    }

    #[test]
    fn popped_frame_preserves_registers_and_memory() {
        // A frame holds registers and memory as logs of what its step
        // overwrote, so the round trip goes through a step's writes.
        let mut ring = SnapshotRing::new(2, usize::MAX);
        let mut regs = RegisterFile::new();
        regs.write_gpr(5, true, 0xABCD);
        regs.write_sp(0x8000_0000);
        let mut mem = Memory::new();
        mem.write_u32(0x1000, 0xDEAD_BEEF).unwrap();
        let mut s: StepFrame = empty_snap();
        regs.record_undo(&mut s.regs);
        mem.record_undo(&mut s.mem);
        regs.write_gpr(5, true, 1);
        regs.write_sp(0x7FFF_FFF0);
        mem.write_u32(0x1000, 0x1234_5678).unwrap();
        regs.finish_undo(&mut s.regs);
        mem.finish_undo(&mut s.mem);
        ring.push(s);
        let restored = ring.pop().unwrap();
        regs.undo(restored.regs);
        mem.undo(restored.mem);
        assert_eq!(regs.read_gpr(5, true), 0xABCD);
        assert_eq!(regs.read_sp(), 0x8000_0000);
        assert_eq!(mem.read_u32(0x1000).unwrap(), 0xDEAD_BEEF);
    }

    /// A frame whose step wrote `bytes` bytes, told apart by `next_fd`.
    fn wrote(mem: &mut Memory, bytes: usize, fd: u32) -> StepFrame {
        let mut s: StepFrame = empty_snap();
        s.next_fd = fd;
        mem.record_undo(&mut s.mem);
        mem.write_bytes(0x1000, &vec![fd as u8; bytes]).unwrap();
        mem.finish_undo(&mut s.mem);
        s
    }

    const BULK: usize = 2 * BULK_LOG_BYTES;

    #[test]
    fn past_the_budget_the_oldest_frames_go() {
        let mut mem = Memory::new();
        let one = wrote(&mut mem, BULK, 0).mem.held;
        let mut ring = SnapshotRing::new(8, 3 * one);
        for fd in 1..=5 {
            ring.push(wrote(&mut mem, BULK, fd));
        }
        assert_eq!(ring.len(), 3, "three bulk frames fit the budget");
        assert_eq!(ring.held, 3 * one);
        // The newest frames stay, so stepping back goes through them in order.
        assert_eq!(ring.pop().unwrap().next_fd, 5);
        assert_eq!(ring.held, 2 * one);
        ring.push(wrote(&mut mem, 16, 6));
        assert_eq!((ring.len(), ring.held), (3, 2 * one), "a small frame is not counted");
        // A frame over the budget on its own ends the history.
        ring.push(wrote(&mut mem, 4 * BULK, 7));
        assert!(ring.is_empty());
        assert_eq!(ring.held, 0);
        ring.push(wrote(&mut mem, 16, 8));
        assert_eq!(ring.pop().unwrap().next_fd, 8, "the history starts again");
    }

    #[test]
    fn a_full_ring_counts_what_its_bulk_frames_hold() {
        let mut mem = Memory::new();
        let mut ring = SnapshotRing::new(2, usize::MAX);
        for fd in 0..5 {
            ring.push(wrote(&mut mem, if fd % 2 == 0 { BULK } else { 16 }, fd));
        }
        let left: usize = ring.frames.iter().map(|frame| counted(frame.mem.held)).sum();
        assert_eq!(ring.held, left);
        assert!(left > BULK, "the newest frame is a bulk one");
        ring.clear();
        assert_eq!(ring.held, 0);
    }

    #[test]
    fn a_recycled_frame_gives_back_a_bulk_steps_log() {
        let mut mem = Memory::new();
        let mut ring = SnapshotRing::new(1, usize::MAX);
        ring.push(wrote(&mut mem, BULK, 0));
        assert!(ring.held > BULK);
        // The frame comes round again for a step that writes one byte.
        let slot = ring.push_slot();
        mem.record_undo(&mut slot.mem);
        mem.write_u8(0x1000, 2).unwrap();
        let held = mem.finish_undo(&mut slot.mem).expect("a log was open");
        assert!(held < BULK_LOG_BYTES, "the log starts over small: {held}");
        ring.close_newest(held);
        assert_eq!(ring.held, 0);
    }

    #[test]
    fn named_saves_survive_clear() {
        let mut ring = SnapshotRing::new(2, usize::MAX);
        let mut s: SavedState = empty_snap();
        s.regs.write_gpr(0, true, 7);
        ring.save_named("checkpoint", s);
        ring.push(empty_snap());
        ring.clear();
        assert!(ring.is_empty());
        let restored = ring.load_named("checkpoint").expect("named save survives clear");
        assert_eq!(restored.regs.read_gpr(0, true), 7);
        assert!(ring.load_named("missing").is_none());
    }

    #[test]
    fn save_named_overwrites_and_keys_stay_sorted() {
        let mut ring = SnapshotRing::new(2, usize::MAX);
        ring.save_named("beta", empty_snap());
        ring.save_named("alpha", empty_snap());
        let mut newer: SavedState = empty_snap();
        newer.regs.write_gpr(0, true, 2);
        ring.save_named("beta", newer);
        assert_eq!(ring.named_keys(), vec!["alpha".to_string(), "beta".to_string()]);
        assert_eq!(ring.load_named("beta").unwrap().regs.read_gpr(0, true), 2);
    }

    #[test]
    fn remove_named_reports_whether_an_entry_existed() {
        let mut ring = SnapshotRing::new(2, usize::MAX);
        ring.save_named("slot", empty_snap());
        assert!(ring.remove_named("slot"));
        assert!(!ring.remove_named("slot"));
        assert!(ring.named_keys().is_empty());
    }
}
