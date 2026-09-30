//! What the program sees of the operating system: the stdin queue and
//! its echo, stdout and stderr, uploaded files, syscall and library-call
//! dispatch, sleeps, and the caller-saved clobber after a library call.

use super::*;

impl Cpu {
    /// Echo the cooked-tty lines a read just consumed. `before` is
    /// `stdin.len()` captured ahead of the dispatch, so the difference is
    /// exactly what the read took.
    ///
    /// The rule is whole-segment-at-first-touch: the moment a read takes
    /// the FIRST byte of an interactive run, the run's whole text goes to
    /// stdout. A submitted line then lands as one typed line ("Enter score
    /// 1: 10\n"), and the trailing "\n" a later scanf skips does not print
    /// itself a second time. Raw mode echoes nothing: a termios program
    /// paints its own screen and would fight the echo for the cursor.
    pub(super) fn echo_consumed_stdin(&mut self, before: usize) {
        let mut left = before.saturating_sub(self.stdin.len());
        while left > 0 {
            let Some(segment) = self.stdin_segments.front_mut() else {
                // Bytes nobody recorded a push for: plain input, no echo.
                return;
            };
            let available = segment.bytes.len().saturating_sub(segment.consumed);
            if available == 0 {
                self.stdin_segments.pop_front();
                continue;
            }
            let first_touch = segment.consumed == 0;
            if first_touch && segment.interactive && !segment.echoed && !self.term.raw_mode {
                segment.echoed = true;
                self.stdout.extend_from_slice(&segment.bytes);
            }
            let taken = available.min(left);
            segment.consumed += taken;
            left -= taken;
            if segment.consumed == segment.bytes.len() {
                self.stdin_segments.pop_front();
            }
        }
    }

    /// A libc routine read through an address no section covers. On the
    /// servers the program dies with a segmentation fault, and when x0 holds
    /// that address the usual cause is an `ldr x0, =fmt` left out before
    /// `bl printf`, so the message says so. Any other bad pointer keeps the
    /// plain memory-fault text.
    pub(super) fn libc_read_fault(&self, pc: u64, address: u64) -> EmuError {
        match self.host_call_name(pc) {
            Some(call) if self.regs.read_gpr(0, true) == address => EmuError::RuntimeError {
                message: format!(
                    "Segmentation fault\n{call} reads memory at x0, but x0 holds 0x{address:x}, \
                     not an address: put `ldr x0, =fmt` right before `bl {call}`, where fmt is \
                     the label on the string it needs"
                ),
            },
            _ => EmuError::MemoryFault { address, access: MemAccess::Read },
        }
    }

    /// One note per register a library call overwrote that the step used
    /// while it still held the call's leftovers. `pc` and `lr` are from
    /// before the step, so a library function reading a stale argument
    /// names its own `bl` as the reader.
    pub(super) fn note_clobbered_reads(&mut self, pc: u64, lr: u64) {
        let reads = self.regs.take_clobbered_reads();
        if reads.is_empty() {
            return;
        }
        let (read_by, read_pc) = if self.host.lookup("__main_return") == Some(pc) {
            (READ_BY_MAIN_RETURN, pc)
        } else if self.host.contains_address(pc) {
            (READ_BY_CALL, lr.wrapping_sub(4))
        } else {
            (READ_BY_INSTRUCTION, pc)
        };
        let mut read = u64::from(reads.x) | (u64::from(reads.d) << 32);
        if read_by == READ_BY_INSTRUCTION {
            read = self.drop_passive_reads(pc, read);
        }
        for code in 0..64u8 {
            if (read >> code) & 1 == 0 {
                continue;
            }
            let origin = self.regs.clobber_origin(code);
            let noted = 1u64 << origin.register;
            if self.clobber_noted & noted != 0 {
                continue;
            }
            self.clobber_noted |= noted;
            // A copied value is noted at the copy: that is the read the
            // program wrote, of the register the call overwrote.
            let row = if origin.copied_at != 0 {
                [origin.register.into(), READ_BY_INSTRUCTION, origin.call_pc, origin.copied_at]
            } else {
                // Every address the loader hands out fits in 32 bits.
                [origin.register.into(), read_by, origin.call_pc, read_pc as u32]
            };
            self.clobber_notes.extend_from_slice(&row);
        }
    }

    /// Take out of `read` what the instruction at `pc` read without using
    /// the value: the data of a store (memory is not tracked, so a register
    /// saved and restored around a call earns nothing), and the source of a
    /// register copy, whose leftovers move on to the destination instead.
    fn drop_passive_reads(&mut self, pc: u64, read: u64) -> u64 {
        let Some(instr) = self.mem.read_u32(pc).ok().and_then(|w| decoder::decode(w).ok()) else {
            return read;
        };
        match passive_read(&instr) {
            PassiveRead::Stored(data) => read & !data,
            PassiveRead::Copied { from, to } if (read >> from) & 1 != 0 => {
                self.regs.carry_clobber(from, to, pc as u32);
                read & !(1u64 << from)
            }
            _ => read,
        }
    }

    /// The notes recorded since the last take, four words each: the
    /// register (`xN` is N, the flags 31, `dN` is 32 + N), what read it
    /// (`READ_BY_*`), the `bl` of the call that overwrote it, and the pc
    /// that read it (a reading library call's `bl`).
    pub fn take_clobber_notes(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.clobber_notes)
    }

    /// What a real library call leaves behind, applied as the call returns
    /// (see `RegisterFile::clobber_caller_saved`).
    fn clobber_after_call(&mut self, stub_pc: u64) {
        let lr = self.regs.read_gpr(30, true);
        // The call's reads of its arguments are noted against the calls
        // that left them, before this one replaces every origin.
        self.note_clobbered_reads(stub_pc, lr);
        let name = self.host.name_for_address(stub_pc).unwrap_or_default();
        let in_d0 = RETURNS_IN_D0.contains(&name);
        let in_x0 = !in_d0 && !RETURNS_NOTHING.contains(&name);
        self.regs.clobber_caller_saved(in_x0, in_d0, lr.wrapping_sub(4));
    }

    /// Push bytes onto the stdin buffer. Clears the `blocked` flag so a
    /// paused scanf/read can resume on the next step. Nothing echoes:
    /// this is the redirect-a-file path (a fixture, a scripted terminal
    /// drive, the exercise checker), and a redirect prints nothing.
    pub fn push_stdin(&mut self, bytes: &[u8]) {
        self.queue_stdin(bytes, false);
    }

    /// Push bytes a student typed at a prompt. Same queue, but the run is
    /// marked interactive: the first read that touches it echoes the whole
    /// line to stdout, the way a cooked-mode terminal echoes a keystroke.
    pub fn push_stdin_interactive(&mut self, bytes: &[u8]) {
        self.queue_stdin(bytes, true);
    }

    /// Shared tail of the two push entry points. An empty push records no
    /// segment: it queues nothing, and a segment per empty push would
    /// grow the list (and every snapshot frame) without bound.
    fn queue_stdin(&mut self, bytes: &[u8], interactive: bool) {
        self.stdin.extend_from_slice(bytes);
        if !bytes.is_empty() {
            self.stdin_segments.push_back(StdinSegment {
                bytes: bytes.to_vec(),
                consumed: 0,
                interactive,
                echoed: false,
            });
        }
        self.blocked = false;
    }

    /// Signal end-of-input (ctrl-d / a redirected file fully queued).
    /// A blocked read resumes and sees EOF; the canonical
    /// read-until-EOF loop can finally terminate.
    pub fn close_stdin(&mut self) {
        self.stdin_closed = true;
        self.blocked = false;
    }

    /// Drain accumulated stdout as a byte vector, clearing the buffer.
    pub fn take_stdout(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.stdout)
    }

    /// Drain accumulated stderr as a byte vector, clearing the buffer.
    pub fn take_stderr(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.stderr)
    }

    /// Bytes ever appended to stdout, echoed input included. Restored by
    /// step-back and by a named load, so a host that tracks how much of
    /// each stream it has displayed can unprint what a rolled-back step
    /// wrote. Never a budget: the output wall keeps its own total.
    pub fn stdout_seen(&self) -> u64 {
        self.stdout_seen
    }

    /// Bytes ever appended to stderr. See `stdout_seen`.
    pub fn stderr_seen(&self) -> u64 {
        self.stderr_seen
    }

    /// Current exit code, if `exit` ran.
    pub fn exit_code(&self) -> Option<i64> {
        self.exit_code
    }

    /// Whether the CPU is paused waiting for stdin.
    pub fn is_blocked(&self) -> bool {
        self.blocked
    }

    /// Register a virtual file the VFS-backed syscalls can read from.
    /// Enforces the same walls as the syscall path (per-file, whole-VFS,
    /// file count) so an upload cannot bypass what `write` refuses; the
    /// web layer pre-checks with matching caps, so a `false` here means a
    /// caller skipped its own guard. Returns whether the file was stored.
    pub fn upload_vfs_file(&mut self, path: String, data: Vec<u8>) -> bool {
        use crate::hosted::syscalls::{
            MAX_VFS_FILES, MAX_VFS_FILE_BYTES, MAX_VFS_TOTAL_BYTES,
        };
        if data.len() > MAX_VFS_FILE_BYTES {
            return false;
        }
        let replaced = self.vfs.get(&path).map_or(0, Vec::len);
        let total: usize = self.vfs.values().map(Vec::len).sum();
        if total - replaced + data.len() > MAX_VFS_TOTAL_BYTES {
            return false;
        }
        if !self.vfs.contains_key(&path) && self.vfs.len() >= MAX_VFS_FILES {
            return false;
        }
        self.vfs.insert(path, data);
        true
    }

    /// Dispatch a Linux syscall (`svc #0` with x8 != 0). Applies the
    /// appropriate outcome to `blocked`/`exit_code` and leaves PC for the
    /// caller to advance.
    pub(super) fn dispatch_syscall(&mut self, number: u64) -> Result<(), EmuError> {
        let mut ctx = HostContext {
            regs: &mut self.regs,
            mem: &mut self.mem,
            stdout: &mut self.stdout,
            stderr: &mut self.stderr,
            stdin: &mut self.stdin,
            stdin_closed: self.stdin_closed,
            vfs: &mut self.vfs,
            open_files: &mut self.open_files,
            next_fd: &mut self.next_fd,
            rand_state: &mut self.rand_state,
            term: &mut self.term,
            heap: &mut self.heap,
            strtok_save: &mut self.strtok_save,
            callbacks: &mut self.callbacks,
        };
        let outcome = crate::hosted::syscalls::dispatch(number, &mut ctx)?;
        match outcome {
            // No syscall calls into the program, so Call never arrives here.
            HostOutcome::Continue | HostOutcome::Call(_) => {}
            HostOutcome::NeedInput => self.blocked = true,
            HostOutcome::Sleep(ns) => self.apply_sleep(ns),
            HostOutcome::Exited(code) => {
                self.exit_code = Some(code);
                self.halted = true;
            }
        }
        Ok(())
    }

    /// Honor a nanosleep: advance the virtual clock, credit the pacing
    /// budgets (a sleeping program earns back steps and output bytes at
    /// the documented real-time rates), and flag the pause so the run
    /// loop hands control back to the runner.
    pub(super) fn apply_sleep(&mut self, ns: u64) {
        let ns = ns.min(MAX_SLEEP_NS);
        self.term.virtual_ns = self.term.virtual_ns.saturating_add(ns);
        // Refunds stop at the lifetime cap so a runner that skips the
        // real pauses (a batch fixture run) cannot mint budget forever.
        let step_refund = (ns / SLEEP_STEP_REFUND_NS_PER_STEP)
            .min(MAX_REFUND_STEPS.saturating_sub(self.refund_steps_total));
        self.refund_steps_total += step_refund;
        self.steps_total = self.steps_total.saturating_sub(step_refund);
        if step_refund > 0 {
            let byte_refund = ((ns / SLEEP_OUTPUT_REFUND_NS_PER_BYTE) as usize)
                .min(MAX_REFUND_OUTPUT_BYTES.saturating_sub(self.refund_output_total));
            self.refund_output_total += byte_refund;
            self.output_total = self.output_total.saturating_sub(byte_refund);
        }
        self.pending_sleep_ns = Some(ns);
    }

    /// Consume the pause the last nanosleep requested, if any. The
    /// runner calls this once per run result and waits the returned
    /// duration in real time; batch runners simply ignore it.
    pub fn take_pending_sleep_ns(&mut self) -> Option<u64> {
        self.pending_sleep_ns.take()
    }

    /// Dispatch a host-stub entry point at `pc`. Splits the mutable borrow
    /// of `self` so the stub can touch registers, memory, and console
    /// buffers without racing the `HostTable` itself (which is only read).
    pub(super) fn dispatch_host_stub(&mut self, pc: u64) -> Result<StepResult, EmuError> {
        // Snapshot registers so the change highlighter still works across a
        // host call.
        let snapshot = self.regs.snapshot();
        let fpr_snapshot = self.regs.snapshot_fpr();
        // The table is read-only during dispatch; split the borrow by
        // temporarily taking the entries, dispatching, then restoring.
        // qsort's comparator returns to the stub it was called from.
        self.callbacks.stub_pc = pc;
        let table = std::mem::take(&mut self.host);
        let mut ctx = HostContext {
            regs: &mut self.regs,
            mem: &mut self.mem,
            stdout: &mut self.stdout,
            stderr: &mut self.stderr,
            stdin: &mut self.stdin,
            stdin_closed: self.stdin_closed,
            vfs: &mut self.vfs,
            open_files: &mut self.open_files,
            next_fd: &mut self.next_fd,
            rand_state: &mut self.rand_state,
            term: &mut self.term,
            heap: &mut self.heap,
            strtok_save: &mut self.strtok_save,
            callbacks: &mut self.callbacks,
        };
        let outcome = table
            .dispatch(pc, &mut ctx)
            .expect("dispatch_host_stub called with non-host pc");
        self.host = table;
        let host_outcome = outcome?;

        match host_outcome {
            HostOutcome::Continue => {
                self.clobber_after_call(pc);
                // Return to caller: pc = lr.
                let lr = self.regs.read_gpr(30, true);
                self.regs.write_pc(lr);
            }
            HostOutcome::NeedInput => {
                // Stay at the stub address so re-entry dispatches the same
                // function when stdin arrives.
                self.blocked = true;
            }
            HostOutcome::Sleep(ns) => {
                // No libc stub returns Sleep, but the arm stays correct: a
                // sleeping stub returns to its caller like Continue.
                self.apply_sleep(ns);
                self.clobber_after_call(pc);
                let lr = self.regs.read_gpr(30, true);
                self.regs.write_pc(lr);
            }
            HostOutcome::Exited(code) => {
                self.exit_code = Some(code);
                self.halted = true;
            }
            // Into the program's comparator, arguments and link register
            // already set: the call is not over, so nothing is clobbered.
            HostOutcome::Call(target) => self.regs.write_pc(target),
        }

        let current = self.regs.snapshot();
        self.changed_regs.clear();
        for i in 0..32 {
            if snapshot[i] != current[i] {
                self.changed_regs.push(i as u8);
            }
        }
        let fpr_current = self.regs.snapshot_fpr();
        self.changed_fprs.clear();
        for i in 0..32 {
            if fpr_snapshot[i] != fpr_current[i] {
                self.changed_fprs.push(i as u8);
            }
        }

        let result_outcome = match host_outcome {
            HostOutcome::Continue | HostOutcome::Call(_) => StepOutcome::Advance,
            HostOutcome::NeedInput => StepOutcome::WaitingForInput,
            HostOutcome::Sleep(ns) => StepOutcome::Sleeping(ns.min(MAX_SLEEP_NS)),
            HostOutcome::Exited(code) => StepOutcome::Exited(code),
        };

        Ok(StepResult {
            pc: self.regs.read_pc(),
            halted: self.halted,
            error: None,
            outcome: result_outcome,
        })
    }

    /// Clear accumulated stdout and stderr without resetting the rest of
    /// the CPU (so the user's "clear console" button can wipe scrollback
    /// without restarting the program).
    pub fn clear_console(&mut self) {
        self.stdout.clear();
        self.stderr.clear();
    }
}
