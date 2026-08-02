//! Hosted-runtime dispatch: libc stubs, syscalls, and the virtual FS that
//! turn the bare-metal interpreter into a "plausibly Linux" environment
//! for cpsc 355 programs. Organized so the assembler/linker can ask
//! "what address should a `bl printf` resolve to?" and the executor can
//! ask "was this BL to a host address? if so, run the stub".
//!
//! Stub entries live at synthetic addresses starting at
//! `cpu::HOST_STUB_BASE` (`0xFFFF_0000`), 16 bytes apart. The address
//! range never overlaps .text/.data/.bss/.rodata or the stack, so there's
//! no way for a well-formed program to collide with it accidentally.

use crate::cpu::{HOST_STUB_BASE, HOST_STUB_COUNT, HOST_STUB_STRIDE};
use crate::errors::EmuError;

pub mod heap;
pub mod libc;
pub mod math;
pub mod printf;
pub mod scanf;
pub mod stdio;
pub mod syscalls;

/// A host-function entry point. Takes a `HostContext` exposing stdout /
/// stderr / stdin / VFS plus register access, and returns the outcome so
/// the caller knows whether to advance normally or stall.
pub type HostFn = fn(&mut HostContext<'_>) -> Result<HostOutcome, EmuError>;

/// Outcome of a host-function call. Most stubs return `Continue`; read /
/// scanf return `NeedInput` when stdin runs dry, and `exit` returns
/// `Exited(code)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostOutcome {
    /// Normal return; the executor sets `pc = lr` and continues.
    Continue,
    /// Stalled waiting for input. Caller must NOT advance PC; the stub
    /// will be re-entered on the next step when stdin is ready.
    NeedInput,
    /// nanosleep asked to pause for this many nanoseconds. The CPU
    /// advances its virtual clock, credits the pacing budgets, and
    /// surfaces the pause so the runner can wait in real time (or skip
    /// straight past it in a batch run).
    Sleep(u64),
    /// Program asked to exit.
    Exited(i64),
}

/// Context passed to each host stub. Split out so stubs can borrow what
/// they need without holding a `&mut Cpu` (which would conflict with the
/// dispatcher's mutable borrow of the table).
/// The exit status C hands around: `exit(int)`, `return` from `int main`,
/// and the Linux exit syscalls all take a 32-bit value in w0. Reading x0 at
/// full width made `exit(-1)` report 4294967295 while `return -1` reported
/// -1. One reader keeps every exit route on the sign-extended int.
pub fn exit_status(regs: &crate::registers::RegisterFile) -> i64 {
    regs.read_gpr(0, false) as i32 as i64
}

pub struct HostContext<'a> {
    pub regs: &'a mut crate::registers::RegisterFile,
    pub mem: &'a mut crate::memory::Memory,
    pub stdout: &'a mut Vec<u8>,
    pub stderr: &'a mut Vec<u8>,
    pub stdin: &'a mut Vec<u8>,
    /// True once the caller has signalled end-of-input (ctrl-d, or a
    /// terminal `< file` redirect): an empty stdin then means EOF, not
    /// "pause and wait for more".
    pub stdin_closed: bool,
    pub vfs: &'a mut std::collections::HashMap<String, Vec<u8>>,
    pub open_files: &'a mut std::collections::HashMap<u32, crate::cpu::OpenFile>,
    pub next_fd: &'a mut u32,
    /// State for the rand/srand stubs. Lives on the `Cpu` (and in every
    /// snapshot) so draws are deterministic and replay-stable.
    pub rand_state: &'a mut crate::hosted::libc::RandState,
    /// Terminal and timing state for the interactive syscalls (raw
    /// mode, fd 0 O_NONBLOCK, the virtual clock). Lives on the `Cpu`
    /// and in every snapshot, like `rand_state`.
    pub term: &'a mut crate::cpu::TermState,
    /// malloc/free allocator state. Lives on the `Cpu` and in every
    /// snapshot, like `rand_state`.
    pub heap: &'a mut crate::hosted::heap::HeapState,
}

/// AAPCS64 vararg cursor, shared by printf and scanf: both walk the same
/// convention (ints in the next GP register through x7, doubles through
/// d7, then a SHARED stack spill at the caller's SP advancing 8 bytes per
/// arg). scanf once walked a bare register counter instead, so its 8th
/// pointer read x8 -- a live scratch register -- rather than `[sp]`.
pub(crate) struct VarargWalker {
    /// Next GP register index. <= 7 means read xN; > 7 means spill.
    pub(crate) gp_idx: u8,
    /// Next SIMD register index. <= 7 means read dN; > 7 means spill.
    pub(crate) fp_idx: u8,
    /// Bytes above SP-at-call-site for the next spilled arg. Shared
    /// between int and float spills per AAPCS64.
    pub(crate) stack_off: u64,
}

impl VarargWalker {
    pub(crate) fn next_int(&mut self, ctx: &mut HostContext<'_>) -> u64 {
        if self.gp_idx <= 7 {
            let v = ctx.regs.read_gpr(self.gp_idx, true);
            self.gp_idx = self.gp_idx.saturating_add(1);
            v
        } else {
            let sp = ctx.regs.read_sp();
            let addr = sp.wrapping_add(self.stack_off);
            self.stack_off = self.stack_off.wrapping_add(8);
            ctx.mem.read_u64(addr).unwrap_or(0)
        }
    }

    pub(crate) fn next_double(&mut self, ctx: &mut HostContext<'_>) -> f64 {
        if self.fp_idx <= 7 {
            let v = ctx.regs.read_fpr_f64(self.fp_idx);
            self.fp_idx = self.fp_idx.saturating_add(1);
            v
        } else {
            let sp = ctx.regs.read_sp();
            let addr = sp.wrapping_add(self.stack_off);
            self.stack_off = self.stack_off.wrapping_add(8);
            ctx.mem.read_u64(addr).map(f64::from_bits).unwrap_or(0.0)
        }
    }
}

/// Table of host stubs, indexed by symbolic name and addressable via a
/// stable 64-bit address in the `HOST_STUB_BASE` range. The linker reads
/// `lookup(name)` to resolve `bl printf`; the executor calls `dispatch`
/// when a BL lands on a stub address.
#[derive(Debug, Default)]
pub struct HostTable {
    entries: Vec<(String, HostFn)>,
}

impl HostTable {
    pub fn new() -> Self {
        let mut table = HostTable::default();
        // Reserve slot 0 for a no-op so we can prove dispatch in isolation
        // and so later stubs get non-zero addresses.
        table.register("__host_noop", noop);
        table
    }

    /// Register a named stub. Returns its synthetic entry address.
    pub fn register(&mut self, name: &str, func: HostFn) -> u64 {
        let idx = self.entries.len() as u64;
        assert!(idx < HOST_STUB_COUNT, "host stub table full");
        self.entries.push((name.to_string(), func));
        HOST_STUB_BASE + idx * HOST_STUB_STRIDE
    }

    /// Address of a named stub, if registered.
    pub fn lookup(&self, name: &str) -> Option<u64> {
        self.entries
            .iter()
            .position(|(n, _)| n == name)
            .map(|i| HOST_STUB_BASE + (i as u64) * HOST_STUB_STRIDE)
    }

    /// Whether an address falls inside the host-stub range.
    pub fn contains_address(&self, address: u64) -> bool {
        let end = HOST_STUB_BASE + (self.entries.len() as u64) * HOST_STUB_STRIDE;
        address >= HOST_STUB_BASE
            && address < end
            && (address - HOST_STUB_BASE).is_multiple_of(HOST_STUB_STRIDE)
    }

    /// Dispatch to the stub at `address`. Returns `None` when the address
    /// is outside the table (so the caller can fall through to normal
    /// instruction fetch) or misaligned.
    pub fn dispatch(
        &self,
        address: u64,
        ctx: &mut HostContext<'_>,
    ) -> Option<Result<HostOutcome, EmuError>> {
        if !self.contains_address(address) {
            return None;
        }
        let idx = ((address - HOST_STUB_BASE) / HOST_STUB_STRIDE) as usize;
        let (_, func) = &self.entries[idx];
        Some(func(ctx))
    }

    /// Names of every registered stub, useful for the UI's register-alias
    /// resolver and for debugging.
    pub fn names(&self) -> impl Iterator<Item = &str> {
        self.entries.iter().map(|(n, _)| n.as_str())
    }
}

fn noop(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    Ok(HostOutcome::Continue)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::Memory;
    use crate::registers::RegisterFile;
    use std::collections::HashMap;

    #[allow(clippy::too_many_arguments)] // one borrow per Cpu field the host context carries
    fn fresh_ctx<'a>(
        regs: &'a mut RegisterFile,
        mem: &'a mut Memory,
        stdout: &'a mut Vec<u8>,
        stderr: &'a mut Vec<u8>,
        stdin: &'a mut Vec<u8>,
        vfs: &'a mut HashMap<String, Vec<u8>>,
        open_files: &'a mut HashMap<u32, crate::cpu::OpenFile>,
        next_fd: &'a mut u32,
        rand_state: &'a mut crate::hosted::libc::RandState,
        term: &'a mut crate::cpu::TermState,
        heap: &'a mut crate::hosted::heap::HeapState,
    ) -> HostContext<'a> {
        HostContext {
            regs,
            mem,
            stdout,
            stderr,
            stdin,
            stdin_closed: false,
            vfs,
            open_files,
            next_fd,
            rand_state,
            term,
            heap,
        }
    }

    #[test]
    fn default_table_contains_noop_at_base_address() {
        let t = HostTable::new();
        assert_eq!(t.lookup("__host_noop"), Some(HOST_STUB_BASE));
    }

    #[test]
    fn register_assigns_sequential_addresses() {
        let mut t = HostTable::new();
        let a = t.register("alpha", noop);
        let b = t.register("beta", noop);
        assert_eq!(a, HOST_STUB_BASE + HOST_STUB_STRIDE);
        assert_eq!(b, HOST_STUB_BASE + 2 * HOST_STUB_STRIDE);
    }

    #[test]
    fn contains_address_respects_stride() {
        let t = HostTable::new();
        assert!(t.contains_address(HOST_STUB_BASE));
        // One byte into a slot is not a valid entry point.
        assert!(!t.contains_address(HOST_STUB_BASE + 1));
        assert!(!t.contains_address(HOST_STUB_BASE + HOST_STUB_STRIDE));
    }

    #[test]
    fn dispatch_runs_stub_and_reports_continue() {
        let mut t = HostTable::new();
        fn set_x0(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
            ctx.regs.write_gpr(0, true, 123);
            Ok(HostOutcome::Continue)
        }
        let addr = t.register("set_x0", set_x0);
        let mut regs = RegisterFile::new();
        let mut mem = Memory::new();
        let mut out = Vec::new();
        let mut err = Vec::new();
        let mut inp = Vec::new();
        let mut vfs = HashMap::new();
        let mut open = HashMap::new();
        let mut next = 3u32;
        let mut rand_state = crate::hosted::libc::RandState::default();
        let mut term = crate::cpu::TermState::default();
        let mut heap = crate::hosted::heap::HeapState::default();
        let mut ctx = fresh_ctx(
            &mut regs, &mut mem, &mut out, &mut err, &mut inp, &mut vfs, &mut open, &mut next,
            &mut rand_state, &mut term, &mut heap,
        );
        let outcome = t.dispatch(addr, &mut ctx).unwrap().unwrap();
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(regs.read_gpr(0, true), 123);
    }

    #[test]
    fn dispatch_returns_none_for_unregistered_address() {
        let t = HostTable::new();
        let mut regs = RegisterFile::new();
        let mut mem = Memory::new();
        let mut out = Vec::new();
        let mut err = Vec::new();
        let mut inp = Vec::new();
        let mut vfs = HashMap::new();
        let mut open = HashMap::new();
        let mut next = 3u32;
        let mut rand_state = crate::hosted::libc::RandState::default();
        let mut term = crate::cpu::TermState::default();
        let mut heap = crate::hosted::heap::HeapState::default();
        let mut ctx = fresh_ctx(
            &mut regs, &mut mem, &mut out, &mut err, &mut inp, &mut vfs, &mut open, &mut next,
            &mut rand_state, &mut term, &mut heap,
        );
        // Address past the end of the table.
        assert!(t
            .dispatch(HOST_STUB_BASE + HOST_STUB_STRIDE * 99, &mut ctx)
            .is_none());
        // Address in a completely different range.
        assert!(t.dispatch(0x0040_0000, &mut ctx).is_none());
    }

    #[test]
    fn names_iterator_reports_all_registered_entries() {
        let mut t = HostTable::new();
        t.register("printf", noop);
        t.register("scanf", noop);
        let names: Vec<&str> = t.names().collect();
        assert_eq!(names, vec!["__host_noop", "printf", "scanf"]);
    }
}
