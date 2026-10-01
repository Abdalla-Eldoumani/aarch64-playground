//! The runaway walls and the calm halts they end in: the step, stack,
//! output, memory and snapshot budgets, and the halt every runtime
//! error becomes.

use super::*;

impl Cpu {
    /// Build the calm memory-cap halt result and record the abort, so a
    /// page-cap write fault reports identically no matter which path raised
    /// it: the executor, a hosted libc stub, or a syscall. Sets `halted`
    /// and `abort_message`; the caller returns the result through `step`.
    pub(super) fn memory_cap_halt(&mut self) -> StepResult {
        self.halted = true;
        let msg = MEMORY_CAP_MESSAGE.to_string();
        self.abort_message = Some(msg.clone());
        StepResult {
            pc: self.regs.read_pc(),
            halted: true,
            error: Some(msg),
            outcome: StepOutcome::Halted,
        }
    }

    /// Add whatever a host stub or syscall just printed to the cumulative
    /// output counter; true means the `MAX_OUTPUT_BYTES` wall is breached.
    /// The arguments are `stdout.len()` and `stderr.len()` captured before
    /// the call, so UI drains between steps never reset the accounting.
    /// The two display counters ride along here because this is the one
    /// place bytes reach the drainable buffers, input echo included,
    /// since the echo is appended before this runs.
    pub(super) fn charge_output(&mut self, out_before: usize, err_before: usize) -> bool {
        let out_new = self.stdout.len().saturating_sub(out_before);
        let err_new = self.stderr.len().saturating_sub(err_before);
        self.stdout_seen = self.stdout_seen.saturating_add(out_new as u64);
        self.stderr_seen = self.stderr_seen.saturating_add(err_new as u64);
        self.output_total += out_new + err_new;
        self.output_total > MAX_OUTPUT_BYTES
    }

    /// Whether the state a snapshot frame copies WHOLE (virtual files,
    /// queued stdin, open-file paths) has outgrown the ring's budget.
    /// Registers, memory and the heap go in as undo logs of what a step
    /// changed, but these are real copies on every step: 100k steps with
    /// a 1 MiB virtual file took 51 s against 73 ms with none.
    pub(super) fn snapshot_side_bytes_exceeded(&self) -> bool {
        let mut bytes = self.stdin.len();
        for (path, data) in &self.vfs {
            bytes += path.len() + data.len();
            if bytes > MAX_SNAPSHOT_SIDE_BYTES {
                return true;
            }
        }
        bytes += self
            .open_files
            .values()
            .map(|f| f.path.len())
            .sum::<usize>();
        bytes > MAX_SNAPSHOT_SIDE_BYTES
    }

    /// Charge the step budget for bulk guest memory a host stub or a
    /// syscall just moved. One `bl memset` is one step but can write the
    /// whole address space, so the runaway wall needs the work counted in
    /// proportion to the bytes, not to the call. `before` is
    /// `mem.bytes_written()` captured ahead of the dispatch.
    pub(super) fn charge_bulk_work(&mut self, before: u64) {
        let moved = self.mem.bytes_written().saturating_sub(before);
        self.steps_total = self
            .steps_total
            .saturating_add(moved / BULK_BYTES_PER_STEP);
    }

    /// Build the calm output-ceiling halt, mirroring `memory_cap_halt`.
    pub(super) fn output_cap_halt(&mut self) -> StepResult {
        self.halted = true;
        let msg = output_ceiling_message();
        self.abort_message = Some(msg.clone());
        StepResult {
            pc: self.regs.read_pc(),
            halted: true,
            error: Some(msg),
            outcome: StepOutcome::Halted,
        }
    }

    /// Convert a propagated runtime error (a fetch fault, an undecodable
    /// word, an executor fault, or a failed host stub / syscall) into the
    /// same calm halt the bounds use. Without this boundary the CPU stays
    /// live at the faulting PC: Step re-derives the identical error forever
    /// and Run re-issues chunks against the wedged machine at full speed.
    /// PC is left unadvanced
    /// so the fault resolves to the line that raised it.
    pub(super) fn runtime_error_halt(&mut self, e: EmuError) -> StepResult {
        self.halted = true;
        let msg = e.to_string();
        self.abort_message = Some(msg.clone());
        StepResult {
            pc: self.regs.read_pc(),
            halted: true,
            error: Some(msg),
            outcome: StepOutcome::Halted,
        }
    }

    /// The two walls a step meets before it executes anything: the
    /// cumulative instruction budget and the stack floor. `Some` is the
    /// calm halt `step` hands back; `None` means the cycle may proceed.
    pub(super) fn check_runaway_walls(&mut self) -> Option<StepResult> {
        // Runaway-loop wall: once the cumulative instruction budget is
        // spent, halt calmly instead of executing another instruction.
        // Checked here so single-stepping a loop is bounded the same way run
        // mode is; surfaced through `error` while `halted` stays true.
        if self.steps_total >= self.max_total_steps {
            self.halted = true;
            let msg = step_ceiling_message();
            self.abort_message = Some(msg.clone());
            return Some(StepResult {
                pc: self.regs.read_pc(),
                halted: true,
                error: Some(msg),
                outcome: StepOutcome::Halted,
            });
        }

        // Stack wall: sp far below the base is runaway recursion (or a
        // frame pointer that was never set up). Without this check the
        // store path maps page after page downward until the memory cap
        // fires, blaming memory instead of the recursion.
        if self.regs.read_sp() < STACK_FLOOR {
            return Some(self.runtime_error_halt(EmuError::StackOverflow));
        }

        None
    }
}
