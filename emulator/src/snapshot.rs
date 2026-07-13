//! Snapshot ring buffer that powers step-back.
//!
//! Each `Snapshot` captures the CPU state that's needed to undo one
//! instruction: registers, memory (all mapped pages), the halt/exit
//! flags, the VFS/open-files tables, and the stdin buffer. Stdout and
//! stderr are intentionally NOT rolled back -- clearing output that the
//! student already saw is more confusing than keeping it.
//!
//! The ring stores at most `capacity` snapshots. Pushing past capacity
//! drops the oldest frame (so step-back always reaches the newest `N`
//! instructions).

use std::collections::{HashMap, VecDeque};

use crate::cpu::OpenFile;
use crate::memory::Memory;
use crate::registers::RegisterFile;

/// Everything `Cpu::step_back` needs to restore.
#[derive(Clone)]
pub struct Snapshot {
    pub regs: RegisterFile,
    pub mem: Memory,
    pub halted: bool,
    pub blocked: bool,
    pub exit_code: Option<i64>,
    pub stdin: Vec<u8>,
    pub vfs: HashMap<String, Vec<u8>>,
    pub open_files: HashMap<u32, OpenFile>,
    pub next_fd: u32,
    /// PRNG state behind the rand/srand stubs. Restored with the rest of
    /// the machine so step-back and replay reproduce the same draws.
    pub rand_state: u64,
}

/// Fixed-capacity ring of snapshots. Oldest frame falls off when the
/// buffer is full; newest frame is popped on `step_back`.
pub struct SnapshotRing {
    frames: VecDeque<Snapshot>,
    capacity: usize,
    /// Named save states: keyed checkpoints the user explicitly stashed.
    /// Separate from the ring because these persist across step-back;
    /// the ring holds only the sliding-window pre-step history.
    named: HashMap<String, Snapshot>,
}

impl SnapshotRing {
    pub fn new(capacity: usize) -> Self {
        Self {
            frames: VecDeque::with_capacity(capacity),
            capacity,
            named: HashMap::new(),
        }
    }

    pub fn push(&mut self, snap: Snapshot) {
        if self.frames.len() == self.capacity {
            self.frames.pop_front();
        }
        self.frames.push_back(snap);
    }

    pub fn pop(&mut self) -> Option<Snapshot> {
        self.frames.pop_back()
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

    pub fn save_named(&mut self, name: impl Into<String>, snap: Snapshot) {
        self.named.insert(name.into(), snap);
    }

    pub fn load_named(&self, name: &str) -> Option<Snapshot> {
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

    fn empty_snap() -> Snapshot {
        Snapshot {
            regs: RegisterFile::new(),
            mem: Memory::new(),
            halted: false,
            blocked: false,
            exit_code: None,
            stdin: Vec::new(),
            vfs: HashMap::new(),
            open_files: HashMap::new(),
            next_fd: 3,
            rand_state: 1,
        }
    }

    #[test]
    fn push_and_pop_lifo() {
        let mut ring = SnapshotRing::new(4);
        let mut a = empty_snap();
        a.regs.write_gpr(0, true, 1);
        let mut b = empty_snap();
        b.regs.write_gpr(0, true, 2);
        ring.push(a);
        ring.push(b);
        assert_eq!(ring.len(), 2);
        let top = ring.pop().unwrap();
        assert_eq!(top.regs.read_gpr(0, true), 2);
        let next = ring.pop().unwrap();
        assert_eq!(next.regs.read_gpr(0, true), 1);
        assert!(ring.is_empty());
    }

    #[test]
    fn push_past_capacity_drops_oldest() {
        let mut ring = SnapshotRing::new(2);
        for i in 0..5u64 {
            let mut s = empty_snap();
            s.regs.write_gpr(0, true, i);
            ring.push(s);
        }
        assert_eq!(ring.len(), 2);
        assert_eq!(ring.pop().unwrap().regs.read_gpr(0, true), 4);
        assert_eq!(ring.pop().unwrap().regs.read_gpr(0, true), 3);
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
        let mut ring = SnapshotRing::new(2);
        let mut s = empty_snap();
        s.regs.write_gpr(5, true, 0xABCD);
        s.regs.write_sp(0x8000_0000);
        s.mem.write_u32(0x1000, 0xDEAD_BEEF).unwrap();
        ring.push(s);
        let restored = ring.pop().unwrap();
        assert_eq!(restored.regs.read_gpr(5, true), 0xABCD);
        assert_eq!(restored.regs.read_sp(), 0x8000_0000);
        assert_eq!(restored.mem.read_u32(0x1000).unwrap(), 0xDEAD_BEEF);
    }

    #[test]
    fn named_saves_survive_clear() {
        let mut ring = SnapshotRing::new(2);
        let mut s = empty_snap();
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
        let mut newer = empty_snap();
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
