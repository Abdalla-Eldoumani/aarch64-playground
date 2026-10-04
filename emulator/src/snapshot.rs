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
//! A frame is taken on every step, so it holds the three large parts,
//! registers, memory and the heap, only as undo logs of what its step
//! changed in them. A named save, which has to outlive any number of
//! later steps, holds them whole.

use std::collections::{HashMap, VecDeque};

use crate::cpu::{OpenFile, StdinSegment};
use crate::hosted::heap::{HeapState, HeapUndo};
use crate::memory::{MemUndo, Memory};
use crate::registers::{RegUndo, RegisterFile};

/// One step-back frame: the state before a step, with registers, memory
/// and the heap as logs of what the step changed.
pub type StepFrame = Snapshot<RegUndo, MemUndo, HeapUndo>;

/// One named save: the whole state.
pub type SavedState = Snapshot<RegisterFile, Memory, HeapState>;

/// Everything `Cpu::step_back` or a named save needs to restore, with
/// registers, memory and the heap in the forms `R`, `M` and `H` (see the
/// module note).
#[derive(Clone, Default)]
pub struct Snapshot<R, M, H> {
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
}

/// Fixed-capacity ring of snapshots. Oldest frame falls off when the
/// buffer is full; newest frame is popped on `step_back`. A full ring
/// hands its oldest frame back to be refilled in place (`push_slot`).
/// Frames are boxed so that costs a pointer move, not a frame copy, and a
/// frame's log buffers are reused instead of allocated on every step.
pub struct SnapshotRing {
    frames: VecDeque<Box<StepFrame>>,
    capacity: usize,
    /// Named save states: keyed checkpoints the user explicitly stashed.
    /// Separate from the ring because these persist across step-back;
    /// the ring holds only the sliding-window pre-step history.
    named: HashMap<String, SavedState>,
}

impl SnapshotRing {
    pub fn new(capacity: usize) -> Self {
        Self {
            frames: VecDeque::with_capacity(capacity),
            capacity,
            named: HashMap::new(),
        }
    }

    #[cfg(test)]
    pub fn push(&mut self, snap: StepFrame) {
        *self.push_slot() = snap;
    }

    pub fn pop(&mut self) -> Option<Box<StepFrame>> {
        self.frames.pop_back()
    }

    /// The slot for a new newest frame, for the caller to fill: the oldest
    /// frame once the ring is full, a blank one before that.
    pub fn push_slot(&mut self) -> &mut StepFrame {
        let slot = if self.frames.len() == self.capacity {
            self.frames.pop_front()
        } else {
            None
        };
        self.frames.push_back(slot.unwrap_or_default());
        let newest = self.frames.len() - 1;
        &mut self.frames[newest]
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
    fn empty_snap<R: Default, M: Default, H: Default>() -> Snapshot<R, M, H> {
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
        }
    }

    #[test]
    fn push_and_pop_lifo() {
        // A frame's registers are a log, so `next_fd` tells frames apart.
        let mut ring = SnapshotRing::new(4);
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
        let mut ring = SnapshotRing::new(2);
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
        let mut ring = SnapshotRing::new(4);
        ring.push(empty_snap());
        ring.clear();
        assert!(ring.is_empty());
        assert!(ring.pop().is_none());
    }

    #[test]
    fn popped_frame_preserves_registers_and_memory() {
        // A frame holds registers and memory as logs of what its step
        // overwrote, so the round trip goes through a step's writes.
        let mut ring = SnapshotRing::new(2);
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

    #[test]
    fn named_saves_survive_clear() {
        let mut ring = SnapshotRing::new(2);
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
        let mut ring = SnapshotRing::new(2);
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
        let mut ring = SnapshotRing::new(2);
        ring.save_named("slot", empty_snap());
        assert!(ring.remove_named("slot"));
        assert!(!ring.remove_named("slot"));
        assert!(ring.named_keys().is_empty());
    }
}
