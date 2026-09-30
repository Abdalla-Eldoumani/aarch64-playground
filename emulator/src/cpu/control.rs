//! What a host drives between steps: running to a breakpoint, the
//! breakpoints, reset, named saves and step-back, and the queries for
//! changed registers and a halt.

use super::*;

impl Cpu {
    /// Run until breakpoint, halt, error, or max_steps reached.
    pub fn run_until_break(&mut self, max_steps: u32) -> Result<RunResult, EmuError> {
        let mut steps: u32 = 0;

        while steps < max_steps && !self.halted && !self.blocked {
            let pc = self.regs.read_pc();

            // check breakpoint before executing (but not on the very first step
            // so we can resume past a breakpoint)
            if steps > 0 && self.breakpoints.contains(&pc) {
                return Ok(RunResult {
                    pc,
                    halted: false,
                    steps_executed: steps,
                    hit_breakpoint: true,
                    error: None,
                });
            }

            let result = self.step()?;
            steps += 1;
            // A nanosleep hands control back so a real-time runner can
            // honor the pause (it reads the duration with
            // `take_pending_sleep_ns`). Breaking on the OUTCOME rather
            // than on the pending flag means a runner that ignores the
            // pause still makes progress on the next call.
            if matches!(result.outcome, StepOutcome::Sleeping(_)) {
                break;
            }
        }

        let pc = self.regs.read_pc();
        // Both backends drive a run as a series of max_steps chunks, and the
        // first-step resume exemption above would silently skip a breakpoint
        // sitting exactly on a chunk boundary. If the budget (not a halt or
        // a stall) ended this call while PC rests on a breakpoint, report the
        // hit now, before the next chunk's first step would step past it.
        let at_cap = steps >= max_steps && !self.halted && !self.blocked;
        Ok(RunResult {
            pc,
            halted: self.halted,
            steps_executed: steps,
            hit_breakpoint: at_cap && self.breakpoints.contains(&pc),
            // Surface a bounds abort (step ceiling / memory cap) through
            // `error` so the UI shows the calm message. Gated on `halted` so
            // a run resumed from a restored save never re-reports the abort
            // that an earlier, pre-restore run recorded.
            error: if self.halted {
                self.abort_message.clone()
            } else {
                None
            },
        })
    }

    /// Raise (or lower) the runaway-loop wall for this machine. Native
    /// harnesses only: the C corpus has legitimate programs that spend
    /// more than the browser budget, and they deserve a bigger wall, not
    /// a weaker one for everyone. The wasm surface never exposes this.
    pub fn set_max_total_steps(&mut self, ceiling: u64) {
        self.max_total_steps = ceiling;
    }

    /// Setting the same address twice is one breakpoint: the set both
    /// dedupes and makes clearing idempotent, so UI toggles cannot drift.
    pub fn set_breakpoint(&mut self, addr: u64) {
        self.breakpoints.insert(addr);
    }

    pub fn clear_breakpoint(&mut self, addr: u64) {
        self.breakpoints.remove(&addr);
    }

    pub fn clear_all_breakpoints(&mut self) {
        self.breakpoints.clear();
    }

    /// Reset to initial state, keeping breakpoints. Clears the hosted
    /// runtime state (stdout / stderr / stdin / vfs / open files / exit
    /// code / blocked flag) in place so the dlmalloc gotcha doesn't fire.
    pub fn reset(&mut self) {
        self.regs = RegisterFile::new();
        self.regs.write_sp(STACK_BASE);
        self.regs.write_pc(CODE_BASE);
        self.mem.clear();
        for i in 0..4 {
            self.mem.map_page(STACK_BASE - (i + 1) * 4096);
        }
        for i in 0..4 {
            self.mem.map_page(CODE_BASE + i * 4096);
        }
        self.mem.map_page(RODATA_BASE);
        self.mem.map_page(DATA_BASE);
        self.mem.map_page(BSS_BASE);
        crate::hosted::stdio::write_stdio_globals(&mut self.mem)
            .expect("the stdio globals page is freshly mapped");
        self.changed_regs.clear();
        self.changed_fprs.clear();
        self.halted = false;
        self.steps_total = 0;
        self.output_total = 0;
        self.abort_message = None;
        self.stdout.clear();
        self.stderr.clear();
        self.stdout_seen = 0;
        self.stderr_seen = 0;
        self.stdin.clear();
        self.stdin_segments.clear();
        self.stdin_closed = false;
        self.blocked = false;
        self.exit_code = None;
        self.vfs.clear();
        self.open_files.clear();
        self.next_fd = 3;
        self.rand_state = crate::hosted::libc::RandState::default();
        self.term = TermState::default();
        self.heap = crate::hosted::heap::HeapState::default();
        self.strtok_save = 0;
        self.callbacks = Default::default();
        self.snapshots_paused = false;
        self.pending_sleep_ns = None;
        self.refund_steps_total = 0;
        self.refund_output_total = 0;
        self.clobber_notes.clear();
        self.clobber_noted = 0;
        // Intentionally NOT resetting `self.host`: `Cpu::new` pre-registers
        // the libc + hosted-printf/scanf stubs, and the frontend linker
        // needs them to resolve `bl printf` / `bl scanf` after a reset
        // plus re-assemble. Clearing the table would leave those calls
        // unresolved.
        self.snapshots.clear();
        // Drain dirty so the next snapshot doesn't surface fake writes
        // from the page-mapping work above.
        let _ = self.mem.take_dirty();
    }

    /// First address past the loaded program's last instruction, if a
    /// program is loaded. See the fall-through guard in `step`.
    pub fn text_end(&self) -> Option<u64> {
        self.text_end
    }

    /// Whether the CPU has at least one recorded snapshot; i.e. whether
    /// `step_back` would succeed.
    pub fn can_step_back(&self) -> bool {
        !self.snapshots.is_empty()
    }

    /// Capture the current CPU state under `name`. Overwrites any
    /// existing save under the same name. Named saves survive reset
    /// intentionally so a student can checkpoint, re-assemble, then
    /// restore.
    pub fn save_state(&mut self, name: impl Into<String>) {
        let snap = Snapshot {
            regs: self.regs.clone(),
            mem: self.mem.clone(),
            halted: self.halted,
            blocked: self.blocked,
            exit_code: self.exit_code,
            stdin: self.stdin.clone(),
            stdin_segments: self.stdin_segments.clone(),
            stdin_closed: self.stdin_closed,
            vfs: self.vfs.clone(),
            open_files: self.open_files.clone(),
            next_fd: self.next_fd,
            rand_state: self.rand_state,
            term: self.term,
            heap: self.heap.clone(),
            strtok_save: self.strtok_save,
            callbacks: self.callbacks.clone(),
            stdout_seen: self.stdout_seen,
            stderr_seen: self.stderr_seen,
        };
        self.snapshots.save_named(name, snap);
    }

    /// Restore a previously saved state by name. Returns `true` when a
    /// save existed and was applied.
    pub fn load_state(&mut self, name: &str) -> bool {
        let Some(snap) = self.snapshots.load_named(name) else {
            return false;
        };
        self.regs = snap.regs;
        self.mem = snap.mem;
        self.halted = snap.halted;
        self.blocked = snap.blocked;
        self.exit_code = snap.exit_code;
        self.stdin = snap.stdin;
        self.stdin_segments = snap.stdin_segments;
        self.stdin_closed = snap.stdin_closed;
        self.vfs = snap.vfs;
        self.open_files = snap.open_files;
        self.next_fd = snap.next_fd;
        self.rand_state = snap.rand_state;
        self.term = snap.term;
        self.heap = snap.heap;
        self.strtok_save = snap.strtok_save;
        self.callbacks = snap.callbacks;
        // Display counters follow the machine; the output-flood budget
        // deliberately does not, for the same reason the step budget
        // survives a restore.
        self.stdout_seen = snap.stdout_seen;
        self.stderr_seen = snap.stderr_seen;
        self.pending_sleep_ns = None;
        self.changed_regs.clear();
        self.changed_fprs.clear();
        // The ring still holds frames recorded AFTER this save was taken,
        // so every one of them lies in the restored machine's future:
        // stepping back into one would move the program FORWARD past the
        // restore point. A restore ends the history, the same way an
        // unrecorded stretch does. Named saves survive `clear()`.
        self.snapshots.clear();
        // The abort message describes a run the restored state never took;
        // left in place it would resurface on the next run's result. The
        // step budget stays deliberately (see MAX_TOTAL_STEPS): clearing it
        // here would let a save/restore loop hop past the runaway wall.
        self.abort_message = None;
        true
    }

    /// Delete a named save. Returns `true` when a save existed.
    pub fn delete_state(&mut self, name: &str) -> bool {
        self.snapshots.remove_named(name)
    }

    /// Sorted list of every save-state name currently held.
    pub fn state_names(&self) -> Vec<String> {
        self.snapshots.named_keys()
    }

    /// Restore the CPU to the state it was in before the most recent
    /// step. Returns a `StepOutcome` reflecting the restored state so
    /// the caller can react (e.g. flip out of the waiting-for-input
    /// mode if the restored state pre-dates the scanf stall).
    pub fn step_back(&mut self) -> StepOutcome {
        let Some(snap) = self.snapshots.pop() else {
            return if self.halted {
                match self.exit_code {
                    Some(code) => StepOutcome::Exited(code),
                    None => StepOutcome::Halted,
                }
            } else if self.blocked {
                StepOutcome::WaitingForInput
            } else {
                StepOutcome::Advance
            };
        };
        self.regs = snap.regs;
        self.mem = snap.mem;
        self.halted = snap.halted;
        self.blocked = snap.blocked;
        self.exit_code = snap.exit_code;
        self.stdin = snap.stdin;
        self.stdin_segments = snap.stdin_segments;
        self.stdin_closed = snap.stdin_closed;
        self.vfs = snap.vfs;
        self.open_files = snap.open_files;
        self.next_fd = snap.next_fd;
        self.rand_state = snap.rand_state;
        self.term = snap.term;
        self.heap = snap.heap;
        self.strtok_save = snap.strtok_save;
        self.callbacks = snap.callbacks;
        // What the frame printed is now un-printed as far as the display
        // is concerned, so a host can trim its transcript back. The
        // output-flood budget below is untouched on purpose.
        self.stdout_seen = snap.stdout_seen;
        self.stderr_seen = snap.stderr_seen;
        self.pending_sleep_ns = None;
        self.changed_regs.clear();
        self.changed_fprs.clear();
        // Un-count the step this frame undoes and drop any abort recorded
        // after it; otherwise a step taken right after backing off the step
        // ceiling would re-halt reporting a runaway loop for an instruction
        // that never executed. Bounded: each backward step refunds exactly
        // one forward step, and the ring holds at most its capacity.
        self.steps_total = self.steps_total.saturating_sub(1);
        self.abort_message = None;
        if self.halted {
            match self.exit_code {
                Some(code) => StepOutcome::Exited(code),
                None => StepOutcome::Halted,
            }
        } else if self.blocked {
            StepOutcome::WaitingForInput
        } else {
            StepOutcome::Advance
        }
    }

    /// Indices of registers that changed during the last step.
    pub fn changed_registers(&self) -> &[u8] {
        &self.changed_regs
    }

    /// Indices of FP registers (v0-v31, any bit of the 128) that changed
    /// during the last step.
    pub fn changed_fp_registers(&self) -> &[u8] {
        &self.changed_fprs
    }

    /// Whether the CPU has halted (SVC executed).
    pub fn is_halted(&self) -> bool {
        self.halted
    }
}
