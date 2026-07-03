use std::collections::{HashMap, HashSet};

use crate::decoder;
use crate::errors::{EmuError, MemAccess};
use crate::executor::{self, ExecResult};
use crate::frontend::sections::{Item, Program};
use crate::hosted::{HostContext, HostOutcome, HostTable};
use crate::memory::Memory;
use crate::registers::RegisterFile;
use crate::snapshot::{Snapshot, SnapshotRing};

/// Size of the step-back snapshot ring. Each frame captures the full
/// RegisterFile plus cloned page buffers, so memory scales roughly with
/// `capacity * pages_mapped * 4 KiB`. 128 frames holds a few MiB at
/// realistic working-set sizes.
const SNAPSHOT_CAPACITY: usize = 128;

/// Base address where assembled code is loaded.
pub const CODE_BASE: u64 = 0x0040_0000;

/// Read-only data section base.
pub const RODATA_BASE: u64 = 0x0050_0000;

/// Initialized read-write data section base.
pub const DATA_BASE: u64 = 0x0060_0000;

/// Uninitialized data section base (zero-filled).
pub const BSS_BASE: u64 = 0x0070_0000;

/// Initial stack pointer (grows downward).
pub const STACK_BASE: u64 = 0x8000_0000;

/// Base address of the synthetic host-function stubs. `BL` targets inside
/// this range are intercepted by the executor and dispatched to a Rust
/// implementation (printf, scanf, etc.) instead of being executed as real
/// instructions. 256 slots of 16 bytes gives room for every libc symbol
/// the corpus references and leaves space for future additions.
pub const HOST_STUB_BASE: u64 = 0xFFFF_0000;
pub const HOST_STUB_STRIDE: u64 = 16;
pub const HOST_STUB_COUNT: u64 = 256;

/// Cumulative executed-instruction ceiling (the runaway-loop wall). Once a
/// loaded program has executed this many steps -- counted across every
/// `step` and the inner `run_until_break` loop, persistent until the next
/// load/reset -- the run aborts calmly instead of hanging the tab. ~10M
/// sits far above any real cpsc 355 program's step count, yet an infinite
/// loop reaches it in well under a second of wall time per run chunk.
pub const MAX_TOTAL_STEPS: u64 = 10_000_000;

/// Calm, plain-language abort surfaced through the result `error` field
/// when a store would allocate past `memory::MAX_MAPPED_PAGES`.
pub const MEMORY_CAP_MESSAGE: &str = "stopped -- program tried to use too much memory";

/// Calm, plain-language abort surfaced when the cumulative step ceiling is
/// hit. Built dynamically so the count always matches `MAX_TOTAL_STEPS`.
pub fn step_ceiling_message() -> String {
    format!("stopped after {MAX_TOTAL_STEPS} steps -- possible infinite loop")
}

/// What happened during a single step, beyond the "did it advance or halt"
/// dichotomy. Runtime I/O (scanf, read syscall) introduces a third state
/// where the CPU is paused waiting for stdin data to arrive.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StepOutcome {
    /// Instruction completed; run loop should step again.
    Advance,
    /// SVC executed or host `exit` stub was called; CPU is halted.
    Halted,
    /// A hosted read/scanf ran short on stdin; caller should pause the run
    /// loop until more input arrives, then step again.
    WaitingForInput,
    /// `exit(status)` was called. The CPU is halted and the status is
    /// available via `Cpu::exit_code()`.
    Exited(i64),
}

/// Result of a single step.
#[derive(Debug, Clone)]
pub struct StepResult {
    pub pc: u64,
    pub halted: bool,
    pub error: Option<String>,
    /// Structured outcome kept alongside the legacy fields. Callers that
    /// only care about halt/advance keep reading `halted`; callers that
    /// need to drive the hosted run loop look at this instead.
    pub outcome: StepOutcome,
}

/// Identity of an open virtual-filesystem file descriptor.
#[derive(Debug, Clone)]
pub struct OpenFile {
    pub path: String,
    pub offset: u64,
    pub writable: bool,
}

/// Result of a run (multiple steps).
#[derive(Debug, Clone)]
pub struct RunResult {
    pub pc: u64,
    pub halted: bool,
    pub steps_executed: u32,
    pub hit_breakpoint: bool,
    pub error: Option<String>,
}

/// Top-level CPU wrapping register file, memory, breakpoints, and the
/// hosted-runtime state (stdout/stderr/stdin buffers, virtual filesystem,
/// exit status) that phase B's libc stubs and syscall dispatcher populate.
pub struct Cpu {
    pub regs: RegisterFile,
    pub mem: Memory,
    breakpoints: HashSet<u64>,
    changed_regs: Vec<u8>,
    halted: bool,
    /// Bytes printf/puts/write(1) have emitted since the last `clear_console`.
    pub stdout: Vec<u8>,
    /// Bytes emitted by write(2).
    pub stderr: Vec<u8>,
    /// Bytes pushed by the frontend; scanf/read(0) drain them.
    pub stdin: Vec<u8>,
    /// True when the last step stalled in scanf/read with an empty stdin;
    /// cleared automatically when more stdin arrives.
    pub blocked: bool,
    /// Populated when `exit(status)` runs, so the UI can show the value.
    pub exit_code: Option<i64>,
    /// Path to content map for the virtual filesystem the openat/read/write
    /// syscall family pokes at.
    pub vfs: HashMap<String, Vec<u8>>,
    /// Open file descriptors keyed by fd number. fds 0/1/2 stay reserved
    /// for stdin/stdout/stderr; user opens begin at 3.
    pub open_files: HashMap<u32, OpenFile>,
    /// Next fd number to hand out from `openat`.
    pub next_fd: u32,
    /// Table of hosted libc / syscall stubs reachable by `bl` into the
    /// synthetic 0xFFFF_0000 range. Populated by `Cpu::new` with the
    /// default suite of stubs; the linker reads `host.lookup(name)` to
    /// resolve external calls.
    pub host: HostTable,
    /// Ring of pre-step snapshots powering `step_back`. Holds the last
    /// `SNAPSHOT_CAPACITY` frames of CPU state (registers + memory +
    /// VFS + stdin; stdout/stderr are intentionally left alone so the
    /// student doesn't see already-printed output vanish).
    snapshots: SnapshotRing,
    /// Resolved label -> absolute address from the most recent linker
    /// pass. Empty until `load_linked_image*` runs. Drives
    /// `gdb b <label>` and any other label-based debugger feature.
    pub symbols: HashMap<String, u64>,
    /// PCs of successfully-executed instructions since the last
    /// `take_pc_trace()` drain. Powers run-mode hotspot heat-map
    /// granularity: without this trace the JS side only sees the
    /// final PC of each run chunk and the heat map looks "thin" on
    /// long loops. Populated by `step()` and the inner loop of
    /// `run_until_break()`.
    pub pc_trace: Vec<u64>,
    /// Cumulative count of executed steps since the last load/reset. Drives
    /// the `MAX_TOTAL_STEPS` runaway-loop wall; persistent across repeated
    /// `run_until_break` calls so chunked running still reaches the ceiling.
    steps_total: u64,
    /// Set when a bound (step ceiling or memory cap) aborts the run. The
    /// run/step result carries it through `error` while `halted` stays true,
    /// so the UI shows a calm message instead of a silent stop or a raw
    /// fault. Cleared on load/reset.
    pub abort_message: Option<String>,
}

impl Cpu {
    /// Create a fresh CPU with default memory layout.
    pub fn new() -> Self {
        let mut cpu = Self {
            regs: RegisterFile::new(),
            mem: Memory::new(),
            breakpoints: HashSet::new(),
            changed_regs: Vec::new(),
            halted: false,
            stdout: Vec::new(),
            stderr: Vec::new(),
            stdin: Vec::new(),
            blocked: false,
            exit_code: None,
            vfs: HashMap::new(),
            open_files: HashMap::new(),
            next_fd: 3,
            host: HostTable::new(),
            snapshots: SnapshotRing::new(SNAPSHOT_CAPACITY),
            symbols: HashMap::new(),
            pc_trace: Vec::new(),
            steps_total: 0,
            abort_message: None,
        };
        // Pre-register the libc + hosted-printf/scanf stubs the cpsc 355
        // corpus reaches for. Doing it here means the frontend linker can
        // resolve `bl printf` / `bl scanf` / ... with no extra wiring on
        // the JS or integration-test side.
        cpu.host.register("printf", crate::hosted::printf::printf);
        cpu.host.register("scanf", crate::hosted::scanf::scanf);
        cpu.host.register("puts", crate::hosted::libc::puts);
        cpu.host.register("putchar", crate::hosted::libc::putchar);
        cpu.host.register("getchar", crate::hosted::libc::getchar);
        cpu.host.register("strlen", crate::hosted::libc::strlen);
        cpu.host.register("strcmp", crate::hosted::libc::strcmp);
        cpu.host.register("strcpy", crate::hosted::libc::strcpy);
        cpu.host.register("memset", crate::hosted::libc::memset);
        cpu.host.register("memcpy", crate::hosted::libc::memcpy);
        cpu.host.register("exit", crate::hosted::libc::exit);
        cpu.host.register("atof", crate::hosted::libc::atof);
        cpu.host.register("atoi", crate::hosted::libc::atoi);
        // Sentinel used when a hosted program's `main` returns. Loader
        // stashes this address in LR so `ret` from main halts cleanly
        // with x0 as the exit code.
        cpu.host.register("__main_return", crate::hosted::libc::main_return);
        cpu.regs.write_sp(STACK_BASE);
        cpu.regs.write_pc(CODE_BASE);

        // pre-map stack pages so initial pushes don't need auto-map
        for i in 0..4 {
            cpu.mem.map_page(STACK_BASE - (i + 1) * 4096);
        }
        // pre-map a few code pages up front to avoid per-page allocations
        // during `load_program` (on wasm32, mid-call page allocs were tripping
        // a dlmalloc invariant and trapping mid-assemble)
        for i in 0..4 {
            cpu.mem.map_page(CODE_BASE + i * 4096);
        }
        // pre-map one page of each data section for the same reason. cpsc 355
        // programs routinely write here during assemble_and_load; doing it
        // once here keeps the dlmalloc gotcha from biting.
        cpu.mem.map_page(RODATA_BASE);
        cpu.mem.map_page(DATA_BASE);
        cpu.mem.map_page(BSS_BASE);
        cpu
    }

    /// Load encoded instructions into memory at CODE_BASE and reset PC.
    pub fn load_program(&mut self, code: &[u32]) {
        let mut addr = CODE_BASE;
        for &word in code {
            // auto-maps pages on write
            self.mem.write_u32(addr, word).expect("code write should not fail on aligned addresses");
            addr += 4;
        }
        self.regs.write_pc(CODE_BASE);
        self.halted = false;
        // A freshly loaded program starts a fresh runaway budget.
        self.steps_total = 0;
        self.abort_message = None;
    }

    /// Load a `LinkedImage` from `frontend::pipeline`. Writes each (addr,
    /// bytes) pair to memory, sets PC to the image's entry point, and
    /// clears the halt flag. Used for hosted cpsc 355 source. Equivalent
    /// to calling `load_linked_image_with_args(image, &[])`.
    pub fn load_linked_image(
        &mut self,
        image: &crate::frontend::pipeline::LinkedImage,
    ) -> Result<(), EmuError> {
        self.load_linked_image_with_args(image, &[])
    }

    /// Load a hosted image and additionally write argc/argv at
    /// `argv::ARGV_BASE` so the program's `main(int argc, char **argv)`
    /// sees the supplied arguments. Empty slice gives identical behavior
    /// to `load_linked_image` (`w0 = 0, x1 = 0` on entry).
    pub fn load_linked_image_with_args(
        &mut self,
        image: &crate::frontend::pipeline::LinkedImage,
        args: &[&str],
    ) -> Result<(), EmuError> {
        // A fresh program starts a fresh runaway budget and clears any
        // prior bounds-abort message.
        self.steps_total = 0;
        self.abort_message = None;
        for (addr, bytes) in &image.writes {
            self.mem.write_bytes(*addr, bytes)?;
        }
        self.regs.write_pc(image.entry_point);
        // Stash the `__main_return` sentinel in LR so a hosted program
        // that returns out of `main` halts cleanly instead of jumping to
        // PC = 0. The sentinel is always registered by `Cpu::new`.
        if let Some(ret_addr) = self.host.lookup("__main_return") {
            self.regs.write_gpr(30, true, ret_addr);
        }
        crate::argv::setup_argv(&mut self.regs, &mut self.mem, args)?;
        self.halted = false;
        // Refresh the symbol table from the linker so debugger
        // surfaces (`gdb b <label>`, future symbolic features) can
        // resolve names without going through the frontend again.
        self.symbols = image.symbols.clone();
        Ok(())
    }

    /// Resolve a label name to its absolute address using the symbol
    /// table captured during the most recent `load_linked_image*`
    /// call. Returns `None` for unknown names or when no image has
    /// been loaded yet.
    pub fn resolve_label(&self, name: &str) -> Option<u64> {
        self.symbols.get(name).copied()
    }

    /// Load a parsed program's sections into memory at their configured
    /// base addresses. Data items (`.byte` / `.word` / `.string` / ...)
    /// land at the running offset inside each section. `Reserve` advances
    /// the offset without writing anything; the page is already zeroed
    /// because `Memory` pages are allocated zero-filled. `AlignToBytes`
    /// rounds the offset up. `Instruction` items are counted as 4 bytes
    /// so later `Bytes` items in the same section land at the right spot;
    /// the linker in phase A.7 takes over the actual instruction encoding.
    /// PC resets to CODE_BASE. Labels resolved via `Program::symbols` stay
    /// the caller's concern.
    pub fn load_sections(&mut self, program: &Program) -> Result<(), EmuError> {
        for section in &program.sections {
            let base = section.kind.default_base();
            let mut offset: u64 = 0;
            for item in &section.items {
                match item {
                    Item::Bytes(bytes) => {
                        self.mem.write_bytes(base + offset, bytes)?;
                        offset += bytes.len() as u64;
                    }
                    Item::Reserve(n) => {
                        offset += *n;
                    }
                    Item::AlignToBytes(n) => {
                        if *n > 0 {
                            let rem = offset % n;
                            if rem != 0 {
                                offset += n - rem;
                            }
                        }
                    }
                    Item::Label(_) => {}
                    Item::SymbolAssignment { .. } => {}
                    Item::Instruction { .. } => {
                        offset += 4;
                    }
                    Item::DataExprs { exprs, width, .. } => {
                        // Symbol-bearing data slots need the linker's
                        // symbol table; this legacy loader has none, so
                        // hold the layout and leave the page's zeros.
                        // Real programs reach these through
                        // `assemble_hosted` + `load_linked_image`.
                        offset += (exprs.len() * width) as u64;
                    }
                }
            }
        }
        self.regs.write_pc(CODE_BASE);
        self.halted = false;
        Ok(())
    }

    /// Build the calm memory-cap halt result and record the abort, so a
    /// page-cap write fault reports identically no matter which path raised
    /// it -- the executor, a hosted libc stub, or a syscall. Sets `halted`
    /// and `abort_message`; the caller returns the result through `step`.
    fn memory_cap_halt(&mut self) -> StepResult {
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

    /// Execute one instruction at the current PC.
    pub fn step(&mut self) -> Result<StepResult, EmuError> {
        if self.halted {
            let outcome = match self.exit_code {
                Some(code) => StepOutcome::Exited(code),
                None => StepOutcome::Halted,
            };
            return Ok(StepResult {
                pc: self.regs.read_pc(),
                halted: true,
                error: None,
                outcome,
            });
        }

        if self.blocked {
            // stdin arrived while we were paused? Caller is responsible for
            // clearing `blocked` via `push_stdin`; if they step without
            // feeding input we stay in the waiting state.
            return Ok(StepResult {
                pc: self.regs.read_pc(),
                halted: false,
                error: None,
                outcome: StepOutcome::WaitingForInput,
            });
        }

        // Runaway-loop wall: once the cumulative instruction budget is
        // spent, halt calmly instead of executing another instruction.
        // Checked here so single-stepping a loop is bounded the same way run
        // mode is; surfaced through `error` while `halted` stays true.
        if self.steps_total >= MAX_TOTAL_STEPS {
            self.halted = true;
            let msg = step_ceiling_message();
            self.abort_message = Some(msg.clone());
            return Ok(StepResult {
                pc: self.regs.read_pc(),
                halted: true,
                error: Some(msg),
                outcome: StepOutcome::Halted,
            });
        }

        let pc = self.regs.read_pc();

        // Snapshot CPU state before we touch anything so `step_back` can
        // restore the exact pre-step state. Stdout/stderr are intentionally
        // excluded from the snapshot (rolling back already-seen output is
        // more confusing than leaving it in place).
        self.snapshots.push(Snapshot {
            regs: self.regs.clone(),
            mem: self.mem.clone(),
            halted: self.halted,
            blocked: self.blocked,
            exit_code: self.exit_code,
            stdin: self.stdin.clone(),
            vfs: self.vfs.clone(),
            open_files: self.open_files.clone(),
            next_fd: self.next_fd,
        });

        // Count this executed step against the cumulative ceiling. Done
        // before the host-stub dispatch so synthetic libc calls count too.
        self.steps_total += 1;

        // If PC landed on a host-stub address (reached via `bl printf` or
        // similar), dispatch to Rust instead of fetching an instruction,
        // then return to the caller via LR.
        if self.host.contains_address(pc) {
            // A page-cap write fault inside a hosted libc routine (e.g. a
            // buffer-filling scanf when the program has already neared the
            // cap) gets the same calm halt as a write in normal code, never
            // a raw fault.
            return match self.dispatch_host_stub(pc) {
                Err(EmuError::MemoryFault { access: MemAccess::Write, .. }) => {
                    Ok(self.memory_cap_halt())
                }
                other => other,
            };
        }

        let snapshot = self.regs.snapshot();
        let word = self.mem.read_u32(pc)?;
        let instr = decoder::decode(word)?;
        let result = match executor::execute(&instr, &mut self.regs, &mut self.mem) {
            Ok(r) => r,
            Err(EmuError::MemoryFault { access: MemAccess::Write, .. }) => {
                // A store tried to map a page past MAX_MAPPED_PAGES. Convert
                // the allocation-cap fault into the same calm halt as the
                // step ceiling rather than propagating a raw memory fault.
                // (Stores are the only writer that faults, so a write fault
                // here is unambiguously the cap.)
                return Ok(self.memory_cap_halt());
            }
            Err(e) => return Err(e),
        };

        // advance PC if the instruction didn't branch
        if result == ExecResult::Advance {
            self.regs.write_pc(pc + 4);
        }

        if result == ExecResult::Halted {
            self.halted = true;
        }

        if result == ExecResult::Syscall {
            // `svc #0` with x8 == 0 keeps the legacy "halt" behavior so a
            // program that traps to stop without setting up the hosted
            // syscall ABI (x8 left zero) still halts cleanly. Non-zero x8
            // dispatches through the hosted syscall table.
            let syscall_num = self.regs.read_gpr(8, true);
            if syscall_num == 0 {
                self.halted = true;
            } else {
                // A page-cap write fault inside a syscall (e.g. read filling
                // a buffer when the program has already neared the cap) gets
                // the same calm halt as a write in normal code, never a raw
                // fault.
                match self.dispatch_syscall(syscall_num) {
                    Ok(()) => {}
                    Err(EmuError::MemoryFault { access: MemAccess::Write, .. }) => {
                        return Ok(self.memory_cap_halt());
                    }
                    Err(e) => return Err(e),
                }
                // After a syscall returns normally, PC moves past the svc.
                if !self.blocked {
                    self.regs.write_pc(pc + 4);
                }
            }
        }

        // detect which registers changed
        let current = self.regs.snapshot();
        self.changed_regs.clear();
        for i in 0..32 {
            if snapshot[i] != current[i] {
                self.changed_regs.push(i as u8);
            }
        }

        let outcome = if self.blocked {
            StepOutcome::WaitingForInput
        } else if let Some(code) = self.exit_code {
            self.halted = true;
            StepOutcome::Exited(code)
        } else if self.halted {
            StepOutcome::Halted
        } else {
            StepOutcome::Advance
        };

        // Record the executed PC for the hotspot heat map. We push the
        // PC the instruction lived at (captured at function entry as
        // `pc`), not the post-execution PC -- the heat map is "what
        // got executed", not "what's next".
        self.pc_trace.push(pc);

        Ok(StepResult {
            pc: self.regs.read_pc(),
            halted: self.halted,
            error: None,
            outcome,
        })
    }

    /// Drain the PC trace accumulated since the last call. The frontend
    /// converts each PC to a source line and bumps `lineCounts` for
    /// the hotspot heat map. Without this drain the trace grows
    /// unbounded across long runs.
    pub fn take_pc_trace(&mut self) -> Vec<u64> {
        std::mem::take(&mut self.pc_trace)
    }

    /// Push bytes onto the stdin buffer. Clears the `blocked` flag so a
    /// paused scanf/read can resume on the next step.
    pub fn push_stdin(&mut self, bytes: &[u8]) {
        self.stdin.extend_from_slice(bytes);
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

    /// Current exit code, if `exit` ran.
    pub fn exit_code(&self) -> Option<i64> {
        self.exit_code
    }

    /// Whether the CPU is paused waiting for stdin.
    pub fn is_blocked(&self) -> bool {
        self.blocked
    }

    /// Register a virtual file the VFS-backed syscalls can read from.
    pub fn upload_vfs_file(&mut self, path: String, data: Vec<u8>) {
        self.vfs.insert(path, data);
    }

    /// Dispatch a Linux syscall (`svc #0` with x8 != 0). Applies the
    /// appropriate outcome to `blocked`/`exit_code` and leaves PC for the
    /// caller to advance.
    fn dispatch_syscall(&mut self, number: u64) -> Result<(), EmuError> {
        let mut ctx = HostContext {
            regs: &mut self.regs,
            mem: &mut self.mem,
            stdout: &mut self.stdout,
            stderr: &mut self.stderr,
            stdin: &mut self.stdin,
            vfs: &mut self.vfs,
            open_files: &mut self.open_files,
            next_fd: &mut self.next_fd,
        };
        let outcome = crate::hosted::syscalls::dispatch(number, &mut ctx)?;
        match outcome {
            HostOutcome::Continue => {}
            HostOutcome::NeedInput => self.blocked = true,
            HostOutcome::Exited(code) => {
                self.exit_code = Some(code);
                self.halted = true;
            }
        }
        Ok(())
    }

    /// Dispatch a host-stub entry point at `pc`. Splits the mutable borrow
    /// of `self` so the stub can touch registers, memory, and console
    /// buffers without racing the `HostTable` itself (which is only read).
    fn dispatch_host_stub(&mut self, pc: u64) -> Result<StepResult, EmuError> {
        // Snapshot registers so the change highlighter still works across a
        // host call.
        let snapshot = self.regs.snapshot();
        // The table is read-only during dispatch; split the borrow by
        // temporarily taking the entries, dispatching, then restoring.
        let table = std::mem::take(&mut self.host);
        let mut ctx = HostContext {
            regs: &mut self.regs,
            mem: &mut self.mem,
            stdout: &mut self.stdout,
            stderr: &mut self.stderr,
            stdin: &mut self.stdin,
            vfs: &mut self.vfs,
            open_files: &mut self.open_files,
            next_fd: &mut self.next_fd,
        };
        let outcome = table
            .dispatch(pc, &mut ctx)
            .expect("dispatch_host_stub called with non-host pc");
        self.host = table;
        let host_outcome = outcome?;

        match host_outcome {
            HostOutcome::Continue => {
                // Return to caller: pc = lr.
                let lr = self.regs.read_gpr(30, true);
                self.regs.write_pc(lr);
            }
            HostOutcome::NeedInput => {
                // Stay at the stub address so re-entry dispatches the same
                // function when stdin arrives.
                self.blocked = true;
            }
            HostOutcome::Exited(code) => {
                self.exit_code = Some(code);
                self.halted = true;
            }
        }

        let current = self.regs.snapshot();
        self.changed_regs.clear();
        for i in 0..32 {
            if snapshot[i] != current[i] {
                self.changed_regs.push(i as u8);
            }
        }

        let result_outcome = match host_outcome {
            HostOutcome::Continue => StepOutcome::Advance,
            HostOutcome::NeedInput => StepOutcome::WaitingForInput,
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

            self.step()?;
            steps += 1;
        }

        Ok(RunResult {
            pc: self.regs.read_pc(),
            halted: self.halted,
            steps_executed: steps,
            hit_breakpoint: false,
            // Surface a bounds abort (step ceiling / memory cap) through
            // `error` so the UI shows the calm message; `None` on a normal
            // halt, a breakpoint, or a max_steps stop.
            error: self.abort_message.clone(),
        })
    }

    /// Set a breakpoint at an address.
    pub fn set_breakpoint(&mut self, addr: u64) {
        self.breakpoints.insert(addr);
    }

    /// Clear a breakpoint.
    pub fn clear_breakpoint(&mut self, addr: u64) {
        self.breakpoints.remove(&addr);
    }

    /// Clear all breakpoints.
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
        self.changed_regs.clear();
        self.halted = false;
        self.steps_total = 0;
        self.abort_message = None;
        self.stdout.clear();
        self.stderr.clear();
        self.stdin.clear();
        self.blocked = false;
        self.exit_code = None;
        self.vfs.clear();
        self.open_files.clear();
        self.next_fd = 3;
        // Intentionally NOT resetting `self.host`: `Cpu::new` pre-registers
        // the libc + hosted-printf/scanf stubs, and the frontend linker
        // needs them to resolve `bl printf` / `bl scanf` after a reset
        // plus re-assemble. Clearing the table would leave those calls
        // unresolved.
        self.snapshots.clear();
        self.pc_trace.clear();
        // Drain dirty so the next snapshot doesn't surface fake writes
        // from the page-mapping work above.
        let _ = self.mem.take_dirty();
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
            vfs: self.vfs.clone(),
            open_files: self.open_files.clone(),
            next_fd: self.next_fd,
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
        self.vfs = snap.vfs;
        self.open_files = snap.open_files;
        self.next_fd = snap.next_fd;
        self.changed_regs.clear();
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
        self.vfs = snap.vfs;
        self.open_files = snap.open_files;
        self.next_fd = snap.next_fd;
        self.changed_regs.clear();
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

    /// Whether the CPU has halted (SVC executed).
    pub fn is_halted(&self) -> bool {
        self.halted
    }
}

impl Default for Cpu {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // hand-encode a few instructions for integration tests

    fn encode_movz(rd: u8, imm16: u16, hw: u8) -> u32 {
        // MOVZ Xd, #imm16, LSL #(hw*16)
        // 1_10_100101_hw_imm16_rd
        0xD280_0000 | ((hw as u32) << 21) | ((imm16 as u32) << 5) | (rd as u32)
    }

    fn encode_add_imm(rd: u8, rn: u8, imm12: u16) -> u32 {
        // ADD Xd, Xn, #imm12
        // 1_0_0_10001_00_imm12_rn_rd
        0x9100_0000 | ((imm12 as u32) << 10) | ((rn as u32) << 5) | (rd as u32)
    }

    fn encode_subs_imm(rd: u8, rn: u8, imm12: u16) -> u32 {
        // SUBS Xd, Xn, #imm12
        // 1_1_1_10001_00_imm12_rn_rd
        0xF100_0000 | ((imm12 as u32) << 10) | ((rn as u32) << 5) | (rd as u32)
    }

    fn encode_b_cond(cond: u8, offset_instr: i32) -> u32 {
        // B.cond offset (in instructions, will be *4)
        let imm19 = ((offset_instr as u32) & 0x7FFFF) << 5;
        0x5400_0000 | imm19 | (cond as u32)
    }

    fn encode_svc(imm16: u16) -> u32 {
        0xD400_0001 | ((imm16 as u32) << 5)
    }

    #[test]
    fn simple_mov_and_add() {
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(0, 10, 0),   // MOV X0, #10
            encode_movz(1, 20, 0),   // MOV X1, #20
            encode_add_imm(2, 0, 0), // ADD X2, X0, #0 (copy)
            encode_svc(0),           // halt
        ];
        cpu.load_program(&code);

        // step through all four
        for _ in 0..4 {
            cpu.step().unwrap();
        }

        assert_eq!(cpu.regs.read_gpr(0, true), 10);
        assert_eq!(cpu.regs.read_gpr(1, true), 20);
        assert_eq!(cpu.regs.read_gpr(2, true), 10);
        assert!(cpu.is_halted());
    }

    #[test]
    fn countdown_loop() {
        // X0 = 5; while (X0 != 0) { X0 -= 1; } halt
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(0, 5, 0),         // MOV X0, #5
            encode_subs_imm(0, 0, 1),     // loop: SUBS X0, X0, #1
            encode_b_cond(0b0001, -1),     // B.NE loop (offset -1 instruction = -4 bytes)
            encode_svc(0),                 // halt
        ];
        cpu.load_program(&code);

        let result = cpu.run_until_break(100).unwrap();
        assert!(result.halted);
        assert_eq!(cpu.regs.read_gpr(0, true), 0);
    }

    #[test]
    fn changed_regs_tracked() {
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(5, 42, 0),
            encode_svc(0),
        ];
        cpu.load_program(&code);

        cpu.step().unwrap();
        assert!(cpu.changed_registers().contains(&5));
    }

    #[test]
    fn breakpoint_stops_execution() {
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(0, 1, 0),
            encode_movz(1, 2, 0),
            encode_movz(2, 3, 0),
            encode_svc(0),
        ];
        cpu.load_program(&code);

        // break at the third instruction
        cpu.set_breakpoint(CODE_BASE + 8);
        let result = cpu.run_until_break(100).unwrap();

        assert!(result.hit_breakpoint);
        assert!(!result.halted);
        assert_eq!(cpu.regs.read_pc(), CODE_BASE + 8);
        // first two instructions executed
        assert_eq!(cpu.regs.read_gpr(0, true), 1);
        assert_eq!(cpu.regs.read_gpr(1, true), 2);
        // third not yet
        assert_eq!(cpu.regs.read_gpr(2, true), 0);
    }

    #[test]
    fn reset_clears_state() {
        let mut cpu = Cpu::new();
        cpu.regs.write_gpr(0, true, 999);
        cpu.reset();
        assert_eq!(cpu.regs.read_gpr(0, true), 0);
        assert_eq!(cpu.regs.read_sp(), STACK_BASE);
        assert_eq!(cpu.regs.read_pc(), CODE_BASE);
    }

    #[test]
    fn load_sections_writes_data_bytes_at_data_base() {
        use crate::frontend::parser::parse;
        let mut cpu = Cpu::new();
        let prog = parse(".data\n.word 0xdeadbeef\n").unwrap();
        cpu.load_sections(&prog).unwrap();
        let bytes = cpu.mem.read_bytes(DATA_BASE, 4).unwrap();
        assert_eq!(bytes, vec![0xef, 0xbe, 0xad, 0xde]);
    }

    #[test]
    fn load_sections_places_rodata_at_rodata_base() {
        use crate::frontend::parser::parse;
        let mut cpu = Cpu::new();
        let prog = parse(".section .rodata\n.string \"hi\"\n").unwrap();
        cpu.load_sections(&prog).unwrap();
        let bytes = cpu.mem.read_bytes(RODATA_BASE, 3).unwrap();
        assert_eq!(bytes, b"hi\0");
    }

    #[test]
    fn load_sections_reserve_leaves_zeros_in_bss() {
        use crate::frontend::parser::parse;
        let mut cpu = Cpu::new();
        // .skip 40 plus a .byte after so we verify the reserve's length.
        let prog = parse(".bss\n.skip 40\n.byte 0xff\n").unwrap();
        cpu.load_sections(&prog).unwrap();
        // First 40 bytes should still be zero; byte 40 should be 0xff.
        let head = cpu.mem.read_bytes(BSS_BASE, 40).unwrap();
        assert!(head.iter().all(|&b| b == 0));
        let marker = cpu.mem.read_bytes(BSS_BASE + 40, 1).unwrap();
        assert_eq!(marker, vec![0xff]);
    }

    #[test]
    fn load_sections_respects_alignment() {
        use crate::frontend::parser::parse;
        let mut cpu = Cpu::new();
        // After a single byte, .balign 4 should skip 3 bytes before the next word.
        let prog = parse(".data\n.byte 0xaa\n.balign 4\n.word 0x11223344\n").unwrap();
        cpu.load_sections(&prog).unwrap();
        let head = cpu.mem.read_bytes(DATA_BASE, 8).unwrap();
        assert_eq!(head[0], 0xaa);
        // padding bytes stay zero; the next word lands at offset 4.
        assert_eq!(&head[4..8], &[0x44, 0x33, 0x22, 0x11]);
    }

    #[test]
    fn load_sections_empty_program_is_safe() {
        use crate::frontend::parser::parse;
        let mut cpu = Cpu::new();
        let prog = parse("").unwrap();
        cpu.load_sections(&prog).unwrap();
        assert_eq!(cpu.regs.read_pc(), CODE_BASE);
    }

    #[test]
    fn legacy_load_program_still_works() {
        // The bare-metal examples go through load_program, not load_sections.
        // Make sure it still resets PC and writes the right bytes.
        let mut cpu = Cpu::new();
        let code = vec![encode_movz(0, 5, 0), encode_svc(0)];
        cpu.load_program(&code);
        assert_eq!(cpu.regs.read_pc(), CODE_BASE);
        cpu.step().unwrap();
        assert_eq!(cpu.regs.read_gpr(0, true), 5);
    }

    #[test]
    fn reset_re_maps_section_pages() {
        // After reset, a write to each section base should succeed without
        // auto-mapping logic breaking the dlmalloc invariant.
        let mut cpu = Cpu::new();
        cpu.reset();
        cpu.mem.write_u32(DATA_BASE, 0x1234_5678).unwrap();
        cpu.mem.write_u32(RODATA_BASE, 0x9abc_def0).unwrap();
        cpu.mem.write_u32(BSS_BASE, 0xcafe_babe).unwrap();
    }

    // -- step outcome and hosted state --

    #[test]
    fn step_outcome_advance_on_normal_instruction() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 5, 0)]);
        let r = cpu.step().unwrap();
        assert_eq!(r.outcome, StepOutcome::Advance);
    }

    #[test]
    fn step_outcome_halted_on_svc() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_svc(0)]);
        let r = cpu.step().unwrap();
        assert_eq!(r.outcome, StepOutcome::Halted);
        assert!(r.halted);
    }

    #[test]
    fn step_outcome_waiting_for_input_when_blocked() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 1, 0)]);
        cpu.blocked = true;
        let r = cpu.step().unwrap();
        assert_eq!(r.outcome, StepOutcome::WaitingForInput);
        // PC stayed put.
        assert_eq!(r.pc, CODE_BASE);
    }

    #[test]
    fn push_stdin_clears_blocked() {
        let mut cpu = Cpu::new();
        cpu.blocked = true;
        cpu.push_stdin(b"hello\n");
        assert!(!cpu.blocked);
        assert_eq!(cpu.stdin, b"hello\n");
    }

    #[test]
    fn step_outcome_exited_when_exit_code_set() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 5, 0), encode_svc(0)]);
        // Simulate an exit() stub setting the code before the halting SVC.
        cpu.exit_code = Some(42);
        // First step: advance past the mov, but outcome reflects the pending exit.
        let r = cpu.step().unwrap();
        assert_eq!(r.outcome, StepOutcome::Exited(42));
        assert!(r.halted);
    }

    #[test]
    fn reset_clears_hosted_state() {
        let mut cpu = Cpu::new();
        cpu.stdout.extend_from_slice(b"stale");
        cpu.stderr.extend_from_slice(b"err");
        cpu.stdin.extend_from_slice(b"input");
        cpu.blocked = true;
        cpu.exit_code = Some(7);
        cpu.vfs.insert("a.txt".into(), b"data".to_vec());
        cpu.open_files
            .insert(3, OpenFile { path: "a.txt".into(), offset: 0, writable: false });
        cpu.next_fd = 42;
        cpu.reset();
        assert!(cpu.stdout.is_empty());
        assert!(cpu.stderr.is_empty());
        assert!(cpu.stdin.is_empty());
        assert!(!cpu.blocked);
        assert!(cpu.exit_code.is_none());
        assert!(cpu.vfs.is_empty());
        assert!(cpu.open_files.is_empty());
        assert_eq!(cpu.next_fd, 3);
    }

    #[test]
    fn run_until_break_pauses_on_blocked() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 1, 0), encode_svc(0)]);
        cpu.blocked = true;
        // Even with max_steps=100, the loop should bail immediately.
        let r = cpu.run_until_break(100).unwrap();
        assert_eq!(r.steps_executed, 0);
        assert!(!r.halted);
    }

    #[test]
    fn pc_landing_on_host_stub_dispatches_and_returns_to_lr() {
        // BL can't reach 0xFFFF_0000 from CODE_BASE in a single imm26 hop,
        // so in real code a BLR via a literal-pool load takes us there.
        // For the dispatch test we set PC/LR directly and step, which is
        // exactly the state the CPU lands in after the real sequence.
        use crate::hosted::{HostContext, HostOutcome};
        use crate::cpu::HOST_STUB_BASE;

        fn writes_x0_seven(ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
            ctx.regs.write_gpr(0, true, 7);
            Ok(HostOutcome::Continue)
        }
        let mut cpu = Cpu::new();
        let stub_addr = cpu.host.register("test_stub", writes_x0_seven);
        cpu.load_program(&[encode_svc(0)]); // halt after the stub returns
        cpu.regs.write_gpr(30, true, CODE_BASE);
        cpu.regs.write_pc(stub_addr);
        let r = cpu.step().unwrap();
        assert_eq!(r.outcome, StepOutcome::Advance);
        assert_eq!(cpu.regs.read_gpr(0, true), 7);
        assert_eq!(cpu.regs.read_pc(), CODE_BASE);
        // One more step: the halting SVC runs.
        let r = cpu.step().unwrap();
        assert!(r.halted);
        // Sanity: address is aligned to the stub stride above the base.
        assert!(stub_addr >= HOST_STUB_BASE);
        assert_eq!((stub_addr - HOST_STUB_BASE) % 16, 0);
    }

    #[test]
    fn host_stub_returning_exited_halts_cpu_and_sets_code() {
        use crate::hosted::{HostContext, HostOutcome};
        fn exit_stub(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
            Ok(HostOutcome::Exited(99))
        }
        let mut cpu = Cpu::new();
        let stub_addr = cpu.host.register("exit", exit_stub);
        cpu.regs.write_pc(stub_addr);
        cpu.regs.write_gpr(30, true, CODE_BASE);
        let r = cpu.step().unwrap();
        assert_eq!(r.outcome, StepOutcome::Exited(99));
        assert_eq!(cpu.exit_code(), Some(99));
        assert!(cpu.is_halted());
    }

    #[test]
    fn host_stub_returning_need_input_blocks_cpu() {
        use crate::hosted::{HostContext, HostOutcome};
        fn scanf_like(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
            Ok(HostOutcome::NeedInput)
        }
        let mut cpu = Cpu::new();
        let stub_addr = cpu.host.register("scanf", scanf_like);
        cpu.regs.write_pc(stub_addr);
        cpu.regs.write_gpr(30, true, CODE_BASE);
        let r = cpu.step().unwrap();
        assert_eq!(r.outcome, StepOutcome::WaitingForInput);
        assert!(cpu.is_blocked());
        // PC stays at the stub so re-entry re-dispatches once stdin is fed.
        assert_eq!(cpu.regs.read_pc(), stub_addr);
    }

    #[test]
    fn clear_console_does_not_reset_cpu_state() {
        let mut cpu = Cpu::new();
        cpu.regs.write_gpr(0, true, 99);
        cpu.stdout.extend_from_slice(b"hello");
        cpu.clear_console();
        assert!(cpu.stdout.is_empty());
        // The rest of the CPU state is untouched.
        assert_eq!(cpu.regs.read_gpr(0, true), 99);
    }

    // -- runaway-loop / step-ceiling bounds --

    #[test]
    fn steps_total_increments_once_per_step() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[
            encode_movz(0, 1, 0),
            encode_movz(1, 2, 0),
            encode_movz(2, 3, 0),
            encode_svc(0),
        ]);
        cpu.step().unwrap();
        cpu.step().unwrap();
        cpu.step().unwrap();
        assert_eq!(cpu.steps_total, 3);
    }

    #[test]
    fn step_ceiling_aborts_calmly_with_message() {
        let mut cpu = Cpu::new();
        // b . (branch to self): an unconditional infinite loop.
        cpu.load_program(&[0x1400_0000]);
        // Fast-forward the cumulative budget to the wall so the exact
        // boundary is exercised without running ten million steps.
        cpu.steps_total = MAX_TOTAL_STEPS - 1;
        let first = cpu.run_until_break(100).unwrap();
        assert!(first.halted, "the run should halt at the ceiling");
        assert_eq!(first.error, Some(step_ceiling_message()));
        assert_eq!(cpu.abort_message, Some(step_ceiling_message()));
        // The wall holds across repeated runs: still halted, no more steps.
        let again = cpu.run_until_break(100).unwrap();
        assert!(again.halted);
        assert_eq!(again.steps_executed, 0);
        assert_eq!(again.error, Some(step_ceiling_message()));
    }

    #[test]
    fn step_ceiling_also_bounds_single_stepping() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[0x1400_0000]); // b .
        cpu.steps_total = MAX_TOTAL_STEPS;
        // A single step at the wall halts calmly rather than executing.
        let r = cpu.step().unwrap();
        assert!(r.halted);
        assert_eq!(r.error, Some(step_ceiling_message()));
        assert_eq!(r.outcome, StepOutcome::Halted);
    }

    #[test]
    fn load_program_resets_the_step_budget() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[0x1400_0000]);
        cpu.steps_total = MAX_TOTAL_STEPS;
        cpu.abort_message = Some("stale".to_string());
        // Reloading a program starts a fresh budget and clears the message.
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        assert_eq!(cpu.steps_total, 0);
        assert!(cpu.abort_message.is_none());
        let r = cpu.run_until_break(10).unwrap();
        assert!(r.halted);
        assert!(r.error.is_none());
        assert_eq!(cpu.regs.read_gpr(0, true), 7);
    }

    #[test]
    fn reset_clears_the_step_budget_and_abort_message() {
        let mut cpu = Cpu::new();
        cpu.steps_total = 12_345;
        cpu.abort_message = Some("stale".to_string());
        cpu.reset();
        assert_eq!(cpu.steps_total, 0);
        assert!(cpu.abort_message.is_none());
    }

    // -- memory cap hit inside the hosted write paths --

    #[test]
    fn host_stub_write_past_page_cap_aborts_calmly() {
        use crate::hosted::{HostContext, HostOutcome};
        use crate::memory::MAX_MAPPED_PAGES;
        // A libc-style stub that writes into a fresh, unmapped page. At the
        // page cap that write raises a Write MemoryFault, exactly as a real
        // buffer-filling routine (scanf/read) would near the cap.
        fn writes_fresh_page(
            ctx: &mut HostContext<'_>,
        ) -> Result<HostOutcome, crate::errors::EmuError> {
            ctx.mem.write_u32(0x2000_0000, 0)?;
            Ok(HostOutcome::Continue)
        }
        let mut cpu = Cpu::new();
        // Fill the page budget so the stub's write would map one page too many.
        let baseline = cpu.mem.mapped_page_count();
        for i in 0..(MAX_MAPPED_PAGES - baseline) {
            cpu.mem.map_page(0x1000_0000 + (i as u64) * 4096);
        }
        let stub_addr = cpu.host.register("cap_writer", writes_fresh_page);
        cpu.regs.write_pc(stub_addr);
        cpu.regs.write_gpr(30, true, CODE_BASE);
        let r = cpu.step().unwrap();
        assert!(r.halted, "a cap hit in a libc stub must halt");
        assert_eq!(
            r.error.as_deref(),
            Some(MEMORY_CAP_MESSAGE),
            "a libc-path cap hit must carry the calm memory-cap message"
        );
        assert_eq!(cpu.abort_message.as_deref(), Some(MEMORY_CAP_MESSAGE));
        assert_eq!(r.outcome, StepOutcome::Halted);
    }

    #[test]
    fn syscall_write_past_page_cap_aborts_calmly() {
        use crate::memory::MAX_MAPPED_PAGES;
        let mut cpu = Cpu::new();
        // `svc #0` with x8 = read(63) dispatches the read syscall, which
        // copies stdin into the buffer pointed at by x1.
        cpu.load_program(&[encode_svc(0)]);
        cpu.push_stdin(b"data");
        // Fill the page budget so the read's buffer write maps one page too many.
        let baseline = cpu.mem.mapped_page_count();
        for i in 0..(MAX_MAPPED_PAGES - baseline) {
            cpu.mem.map_page(0x1000_0000 + (i as u64) * 4096);
        }
        cpu.regs.write_gpr(8, true, 63); // SYS_READ
        cpu.regs.write_gpr(0, true, 0); // fd 0 (stdin)
        cpu.regs.write_gpr(1, true, 0x2000_0000); // unmapped buffer at the cap
        cpu.regs.write_gpr(2, true, 4); // count
        let r = cpu.step().unwrap();
        assert!(r.halted, "a cap hit in a syscall must halt");
        assert_eq!(
            r.error.as_deref(),
            Some(MEMORY_CAP_MESSAGE),
            "a syscall-path cap hit must carry the calm memory-cap message"
        );
        assert_eq!(cpu.abort_message.as_deref(), Some(MEMORY_CAP_MESSAGE));
    }
}
