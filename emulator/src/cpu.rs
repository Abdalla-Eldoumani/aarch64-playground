use std::collections::{HashMap, HashSet, VecDeque};

use crate::decoder;
use crate::errors::{EmuError, MemAccess};
use crate::executor::{self, ExecResult};
use crate::frontend::sections::{Item, Program};
use crate::hosted::{HostContext, HostOutcome, HostTable};
use crate::memory::Memory;
use crate::registers::RegisterFile;
use crate::snapshot::{Snapshot, SnapshotRing};

/// Size of the step-back snapshot ring. Each frame captures the full
/// RegisterFile plus a copy-on-write view of the mapped pages, so memory
/// scales with the pages the program rewrites while the frame is alive,
/// not with the whole address space. 128 frames holds a few MiB at
/// realistic working-set sizes.
const SNAPSHOT_CAPACITY: usize = 128;

/// Budget for the state a snapshot frame copies WHOLE: the virtual
/// filesystem, the queued stdin, and the open-file paths. Pages are
/// shared copy-on-write and cost nothing to snapshot, but these are real
/// copies taken on every step, so a program holding megabytes of them
/// paid that price per instruction (100k steps with a 1 MiB virtual file
/// took 51 s against 73 ms with none). Past the budget the ring stops
/// recording -- the same trade raw-mode terminal programs already make.
/// A course program's files and typed input are a few hundred bytes, so
/// step-back stays available for the programs students step through.
pub const MAX_SNAPSHOT_SIDE_BYTES: usize = 4096;

/// Base address where assembled code is loaded.
pub const CODE_BASE: u64 = 0x0040_0000;

/// Read-only data section base.
pub const RODATA_BASE: u64 = 0x0050_0000;

/// Initialized read-write data section base.
pub const DATA_BASE: u64 = 0x0060_0000;

/// Uninitialized data section base (zero-filled).
pub const BSS_BASE: u64 = 0x0070_0000;

/// Address space each section owns. The bases above sit exactly one window
/// apart, so the linker bounds every section to it: a data block or `.skip`
/// that outgrew its window would land on the next section's addresses.
pub const SECTION_WINDOW: u64 = 1024 * 1024;

/// Initial stack pointer (grows downward).
pub const STACK_BASE: u64 = 0x8000_0000;

/// Lowest address sp may legally reach: 8 MiB of stack, matching
/// `ulimit -s` on the course servers so a deep-but-legal recursion that
/// runs there runs here. Only unbounded recursion (or a garbage sp) gets
/// past it, and that deserves a stack-overflow message, not the
/// memory-cap one -- which is why this floor stays well under
/// `memory::MAX_MAPPED_PAGES` in page terms.
pub const STACK_FLOOR: u64 = STACK_BASE - 8 * 1024 * 1024;

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
pub const MEMORY_CAP_MESSAGE: &str = "stopped: the program asked for more memory than \
     the playground gives it (8 MiB of stack and 16 MiB of heap). Check for a loop that \
     stores past the end of an array, a malloc inside a loop with no free, or a frame \
     size computed from a value that was never initialized";

// The ceiling is reported in millions because ten million printed in
// full is a digit string a student has to count. This keeps the division
// exact, so raising the ceiling to a value that is not a whole number of
// millions fails the build instead of silently truncating the count.
const _: () = assert!(MAX_TOTAL_STEPS % 1_000_000 == 0);

/// Calm, plain-language abort surfaced when the cumulative step ceiling is
/// hit. Built dynamically so the count always matches `MAX_TOTAL_STEPS`.
pub fn step_ceiling_message() -> String {
    format!(
        "stopped after {} million steps, which is the playground's ceiling. The usual \
         cause is a loop whose exit condition never becomes true: check that the \
         counter is actually changing, and that the branch condition is the one you \
         meant (b.le against b.lt, b.ne against b.eq)",
        MAX_TOTAL_STEPS / 1_000_000
    )
}

/// Cumulative stdout+stderr ceiling (the output-flood wall). The step and
/// page walls do not cover printing: one printf is one step, and the host
/// buffers live outside guest pages, so a print in a tight loop -- or one
/// crafted wide-format call -- could grow the console without bound. The
/// counter survives the UI draining the buffers, so it measures what the
/// program produced, not what happens to be queued. 4 MiB dwarfs any real
/// course program's output.
pub const MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;

/// Map a Write fault into the calm page-cap message. Stores are the only
/// writer that faults (memory.rs's cap check is the sole producer), so a
/// Write fault anywhere -- executing code, a host stub, or loading an
/// image whose sections need pages the budget no longer covers -- always
/// means the cap, never a raw internal fault worth showing a student.
fn map_write_fault(e: EmuError) -> EmuError {
    match e {
        EmuError::MemoryFault { access: MemAccess::Write, .. } => EmuError::RuntimeError {
            message: MEMORY_CAP_MESSAGE.to_string(),
        },
        other => other,
    }
}

/// Calm, plain-language abort surfaced when the output ceiling is hit.
pub fn output_ceiling_message() -> String {
    format!(
        "stopped: the program printed more than {} MiB of output; check for a print \
         inside a loop that never ends",
        MAX_OUTPUT_BYTES / (1024 * 1024)
    )
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
    /// nanosleep asked for a pause of this many nanoseconds. The virtual
    /// clock has already advanced; a real-time runner waits it out, a
    /// batch runner just steps again.
    Sleeping(u64),
    /// `exit(status)` was called. The CPU is halted and the status is
    /// available via `Cpu::exit_code()`.
    Exited(i64),
}

/// Terminal and timing state behind the interactive syscalls: ioctl's
/// termios raw mode, fcntl's O_NONBLOCK on fd 0, and the virtual
/// monotonic clock that nanosleep advances and clock_gettime reads.
/// The clock is virtual (never the host's wall clock) so step-back and
/// replay stay deterministic; it rides in every snapshot like
/// `rand_state`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TermState {
    /// Virtual monotonic clock, in nanoseconds since load.
    pub virtual_ns: u64,
    /// fd 0 carries O_NONBLOCK: an empty read returns -EAGAIN instead
    /// of pausing the machine for input.
    pub stdin_nonblock: bool,
    /// A TCSETS that cleared ICANON put the terminal in raw mode. The
    /// UI reads this as "this program is a terminal program" and hands
    /// it the terminal pane.
    pub raw_mode: bool,
}

/// Pacing credit for sleeping programs: each nanosecond a program asks
/// nanosleep to pause refunds step and output budget at these rates
/// (one step per microsecond slept, one output byte per ten
/// microseconds). A paced game therefore runs indefinitely -- its
/// budgets refill in real time while the tab sits idle -- yet a
/// CPU-bound runaway still hits the walls, because refunds only come
/// from real pauses the runner actually honors.
pub const SLEEP_STEP_REFUND_NS_PER_STEP: u64 = 1_000;
pub const SLEEP_OUTPUT_REFUND_NS_PER_BYTE: u64 = 10_000;

/// A single nanosleep is clamped to this many nanoseconds (2 seconds)
/// so one call cannot mint minutes of budget or park the runner on an
/// hour-long timeout.
pub const MAX_SLEEP_NS: u64 = 2_000_000_000;

/// Lifetime cap on refunded steps per loaded program (~2 hours of a
/// paced game). Without it, a batch runner that skips sleeps would let
/// a never-exiting paced loop mint budget forever; with it, even that
/// worst case is bounded at MAX_TOTAL_STEPS + this, a few seconds of
/// CPU, before the step wall halts it calmly.
pub const MAX_REFUND_STEPS: u64 = 200_000_000;

/// Lifetime cap on output bytes the sleep refund may credit back. The
/// step refund has its own cap; the output refund had none, so the step
/// cap alone let a paced program earn back 20 MB and quietly raised the
/// 4 MiB output wall to 23 MiB. Capping it here states the real ceiling:
/// a program may print MAX_OUTPUT_BYTES, plus this much more if it paced
/// itself with real sleeps to earn it.
pub const MAX_REFUND_OUTPUT_BYTES: usize = MAX_OUTPUT_BYTES;

/// Bytes of guest memory one host stub may move per step it is charged
/// for. `memset`, `memcpy` and `read` do a whole buffer's work inside a
/// single instruction, so without a charge a loop of whole-buffer fills
/// picks its own workload per step and the runaway wall never sees it
/// (3608 steps moved 24.6 MB). 16 bytes is what a real `stp` writes, so
/// bulk work costs about what the same loop written out in assembly
/// would: a 4 KiB clear is 256 steps against a 10M budget, while the
/// lifetime ceiling on bulk bytes lands at MAX_TOTAL_STEPS * 16.
pub const BULK_BYTES_PER_STEP: u64 = 16;

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

/// One push worth of queued stdin, in arrival order. `Cpu::stdin` holds
/// the bytes reads actually pull from; this record says how long the run
/// was, whether a student typed it at a prompt, and whether its
/// cooked-tty echo has gone out yet.
///
/// A real terminal in cooked mode prints what you type, which is why the
/// terminal pane's transcript reads "Enter score 1: 10" while the console
/// panel -- where the bytes arrive through an input box rather than a
/// keyboard -- used to read "Enter score 1: " with the answer nowhere in
/// sight. The echo is the emulator's job because only the emulator knows
/// WHEN a read consumed the line.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct StdinSegment {
    /// The run's bytes, kept whole so the echo prints the line the
    /// student submitted rather than whatever is left of it.
    pub bytes: Vec<u8>,
    /// How many of `bytes` reads have already taken.
    pub consumed: usize,
    /// The run arrived through `push_stdin_interactive` -- typed at a
    /// prompt, so a cooked tty would have echoed it.
    pub interactive: bool,
    /// The echo has already been written to stdout. Snapshotted, so
    /// stepping back before the read restores the un-echoed state.
    pub echoed: bool,
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
    /// FP registers (d0-d31) the last step wrote, tracked alongside the
    /// integer set so the UI's d-register view can flash writes.
    changed_fprs: Vec<u8>,
    halted: bool,
    /// Bytes printf/puts/write(1) have emitted since the last `clear_console`.
    pub stdout: Vec<u8>,
    /// Bytes emitted by write(2).
    pub stderr: Vec<u8>,
    /// Bytes pushed by the frontend; scanf/read(0) drain them.
    pub stdin: Vec<u8>,
    /// Run-length record of the pushes that filled `stdin`, oldest first,
    /// carrying the cooked-tty echo state. Only a prefix of `stdin` need
    /// be described: bytes past the last segment (a test poking the field
    /// directly) count as plain, never-echoed input.
    pub stdin_segments: VecDeque<StdinSegment>,
    /// True once the caller signalled end-of-input; getchar/read/scanf
    /// answer EOF instead of blocking when stdin is empty.
    pub stdin_closed: bool,
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
    /// State for the rand/srand host stubs. Starts at 1 (C's unseeded
    /// default) and rides in every snapshot so step-back replays draws.
    pub rand_state: crate::hosted::libc::RandState,
    /// Terminal and timing state for the interactive syscalls (raw
    /// mode, fd 0 O_NONBLOCK, the virtual clock). Snapshotted with the
    /// rest of the machine.
    pub term: TermState,
    /// malloc/free allocator state, snapshotted with the rest of the
    /// machine so step-back restores the heap exactly.
    pub heap: crate::hosted::heap::HeapState,
    /// strtok's saved cursor, the static glibc hides inside libc.
    /// Snapshotted for the same reason the heap is: a stepped-back
    /// tokenizing loop has to hand out the same token again. Zero is
    /// glibc's NULL start, where `strtok(NULL, ...)` faults.
    pub strtok_save: u64,
    /// Host-requested pause of the step-back snapshot ring. The web sets
    /// it for live terminal sessions, where per-step clones cost far more
    /// than the steps and stepping back mid-session has no meaning.
    /// Transient runner state: not part of any snapshot, cleared on
    /// load/reset.
    pub snapshots_paused: bool,
    /// Set when the last dispatched instruction was a nanosleep; the
    /// run loop breaks so the runner can honor the pause, and the
    /// runner consumes it via `take_pending_sleep_ns`.
    pub pending_sleep_ns: Option<u64>,
    /// Steps refunded by sleeping so far, capped at MAX_REFUND_STEPS
    /// per loaded program.
    refund_steps_total: u64,
    /// Output bytes refunded by sleeping so far, capped at
    /// MAX_REFUND_OUTPUT_BYTES per loaded program.
    refund_output_total: usize,
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
    /// Cumulative count of executed steps since the last load/reset. Drives
    /// the `MAX_TOTAL_STEPS` runaway-loop wall; persistent across repeated
    /// `run_until_break` calls so chunked running still reaches the ceiling.
    steps_total: u64,
    /// The runaway-loop wall itself, `MAX_TOTAL_STEPS` unless a native
    /// harness raises it (the C corpus has legitimate programs the browser
    /// budget was never sized for). The wasm surface never touches this,
    /// so the tab's ceiling stays exactly the const.
    max_total_steps: u64,
    /// Cumulative stdout+stderr bytes since the last load/reset. Drives the
    /// `MAX_OUTPUT_BYTES` wall; survives the UI draining the buffers.
    output_total: usize,
    /// Bytes ever appended to `stdout` / `stderr`, echo included. DISPLAY
    /// state, not budget: a snapshot carries them and step-back restores
    /// them, so the web can drop exactly the characters a rolled-back step
    /// printed. `output_total` above is the wall and is never restored --
    /// undoing a step must not refund the flood budget.
    stdout_seen: u64,
    stderr_seen: u64,
    /// Set when a bound (step ceiling or memory cap) aborts the run. The
    /// run/step result carries it through `error` while `halted` stays true,
    /// so the UI shows a calm message instead of a silent stop or a raw
    /// fault. Cleared on load/reset.
    pub abort_message: Option<String>,
    /// First address past the loaded program's last instruction. A fetch
    /// landing exactly here means execution fell off the end (a main with
    /// no ret), which deserves its own message -- without the guard the
    /// zero-filled page decoded as `unknown instruction: 0x00000000` and
    /// the teaching layer guessed at causes that never happened.
    text_end: Option<u64>,
    /// The loaded image's host-call trampolines: base address plus the stub
    /// each 8-byte slot jumps to (see `LinkedImage`). A pc in this range is
    /// executing the two words that route a `bl printf` to the runtime, not
    /// a line of the student's program, and `host_call_name` says so.
    /// Zero and empty for a program with no hosted calls.
    pub trampoline_base: u64,
    pub trampoline_names: Vec<String>,
}

impl Cpu {
    /// Create a fresh CPU with default memory layout.
    pub fn new() -> Self {
        let mut cpu = Self {
            regs: RegisterFile::new(),
            mem: Memory::new(),
            breakpoints: HashSet::new(),
            changed_regs: Vec::new(),
            changed_fprs: Vec::new(),
            halted: false,
            stdout: Vec::new(),
            stderr: Vec::new(),
            stdin: Vec::new(),
            stdin_segments: VecDeque::new(),
            stdin_closed: false,
            blocked: false,
            exit_code: None,
            vfs: HashMap::new(),
            open_files: HashMap::new(),
            next_fd: 3,
            rand_state: crate::hosted::libc::RandState::default(),
            term: TermState::default(),
            heap: crate::hosted::heap::HeapState::default(),
            strtok_save: 0,
            snapshots_paused: false,
            pending_sleep_ns: None,
            refund_steps_total: 0,
            refund_output_total: 0,
            host: HostTable::new(),
            snapshots: SnapshotRing::new(SNAPSHOT_CAPACITY),
            symbols: HashMap::new(),
            steps_total: 0,
            max_total_steps: MAX_TOTAL_STEPS,
            output_total: 0,
            stdout_seen: 0,
            stderr_seen: 0,
            abort_message: None,
            text_end: None,
            trampoline_base: 0,
            trampoline_names: Vec::new(),
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
        cpu.host.register("sprintf", crate::hosted::printf::sprintf);
        cpu.host.register("snprintf", crate::hosted::printf::snprintf);
        cpu.host.register("strlen", crate::hosted::libc::strlen);
        cpu.host.register("strcmp", crate::hosted::libc::strcmp);
        cpu.host.register("strncmp", crate::hosted::libc::strncmp);
        cpu.host.register("strcpy", crate::hosted::libc::strcpy);
        cpu.host.register("strncpy", crate::hosted::libc::strncpy);
        cpu.host.register("strcat", crate::hosted::libc::strcat);
        cpu.host.register("strchr", crate::hosted::libc::strchr);
        cpu.host.register("strstr", crate::hosted::libc::strstr);
        cpu.host.register("strtok", crate::hosted::libc::strtok);
        cpu.host.register("memset", crate::hosted::libc::memset);
        cpu.host.register("memcpy", crate::hosted::libc::memcpy);
        cpu.host.register("memmove", crate::hosted::libc::memmove);
        cpu.host.register("memcmp", crate::hosted::libc::memcmp);
        cpu.host.register("exit", crate::hosted::libc::exit);
        cpu.host.register("atof", crate::hosted::libc::atof);
        cpu.host.register("atoi", crate::hosted::libc::atoi);
        cpu.host.register("strtol", crate::hosted::libc::strtol);
        cpu.host.register("abs", crate::hosted::libc::abs);
        cpu.host.register("labs", crate::hosted::libc::labs);
        cpu.host.register("rand", crate::hosted::libc::rand);
        cpu.host.register("srand", crate::hosted::libc::srand);
        cpu.host.register("time", crate::hosted::libc::time);
        cpu.host.register("malloc", crate::hosted::heap::malloc);
        cpu.host.register("calloc", crate::hosted::heap::calloc);
        cpu.host.register("realloc", crate::hosted::heap::realloc);
        cpu.host.register("free", crate::hosted::heap::free);
        cpu.host.register("usleep", crate::hosted::libc::usleep);
        cpu.host.register("fflush", crate::hosted::libc::fflush);
        // The C-locale character classes and case conversions, both ways
        // a program reaches them: the functions, and the three tables the
        // __ctype_*_loc pointers address.
        cpu.host.register("isdigit", crate::hosted::ctype::isdigit);
        cpu.host.register("isalpha", crate::hosted::ctype::isalpha);
        cpu.host.register("isspace", crate::hosted::ctype::isspace);
        cpu.host.register("toupper", crate::hosted::ctype::toupper);
        cpu.host.register("tolower", crate::hosted::ctype::tolower);
        cpu.host
            .register("__ctype_b_loc", crate::hosted::ctype::ctype_b_loc);
        cpu.host
            .register("__ctype_toupper_loc", crate::hosted::ctype::ctype_toupper_loc);
        cpu.host
            .register("__ctype_tolower_loc", crate::hosted::ctype::ctype_tolower_loc);
        // FILE*-level stdio over the VFS; the handle scheme lives in
        // hosted/stdio.rs.
        cpu.host.register("fopen", crate::hosted::stdio::fopen);
        cpu.host.register("fprintf", crate::hosted::stdio::fprintf);
        cpu.host.register("fgets", crate::hosted::stdio::fgets);
        cpu.host.register("fputs", crate::hosted::stdio::fputs);
        cpu.host.register("fclose", crate::hosted::stdio::fclose);
        // The libm subset: double in d0 (and d1 for the two-argument
        // forms), double out in d0.
        cpu.host.register("sqrt", crate::hosted::math::sqrt);
        cpu.host.register("pow", crate::hosted::math::pow);
        cpu.host.register("sin", crate::hosted::math::sin);
        cpu.host.register("cos", crate::hosted::math::cos);
        cpu.host.register("tan", crate::hosted::math::tan);
        cpu.host.register("log", crate::hosted::math::log);
        cpu.host.register("log10", crate::hosted::math::log10);
        cpu.host.register("exp", crate::hosted::math::exp);
        cpu.host.register("floor", crate::hosted::math::floor);
        cpu.host.register("fabs", crate::hosted::math::fabs);
        cpu.host.register("fmod", crate::hosted::math::fmod);
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
        // The words the `stdin`/`stdout`/`stderr` symbols address. Part of
        // the machine's fixed layout, so the constructor, `reset`, and the
        // loader all leave the same three handles behind.
        crate::hosted::stdio::write_stdio_globals(&mut cpu.mem)
            .expect("the stdio globals page is freshly mapped");
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
        self.output_total = 0;
        self.abort_message = None;
        self.term = TermState::default();
        self.pending_sleep_ns = None;
        self.refund_steps_total = 0;
        self.refund_output_total = 0;
        self.snapshots_paused = false;
        self.text_end = Some(CODE_BASE + (code.len() as u64) * 4);
        // The bare-metal path has no host calls; drop any trampolines a
        // previously loaded hosted image left behind.
        self.trampoline_base = 0;
        self.trampoline_names.clear();
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
    /// sees the supplied arguments. `args` is argv[1..]; the loader
    /// prepends `argv::DEFAULT_ARGV0`, so an empty slice still means
    /// argc = 1 with argv[0] set, the Linux invariant.
    pub fn load_linked_image_with_args(
        &mut self,
        image: &crate::frontend::pipeline::LinkedImage,
        args: &[&str],
    ) -> Result<(), EmuError> {
        // A fresh program starts a fresh runaway budget and clears any
        // prior bounds-abort message.
        self.steps_total = 0;
        self.output_total = 0;
        self.abort_message = None;
        self.stdin_closed = false;
        self.term = TermState::default();
        // A fresh program tokenizes from scratch; a cursor into the last
        // program's memory would hand its first strtok(NULL) a stale
        // address that now means something else.
        self.strtok_save = 0;
        self.pending_sleep_ns = None;
        self.refund_steps_total = 0;
        self.refund_output_total = 0;
        self.snapshots_paused = false;
        for (addr, bytes) in &image.writes {
            self.mem.write_bytes(*addr, bytes).map_err(map_write_fault)?;
        }
        self.regs.write_pc(image.entry_point);
        // Stash the `__main_return` sentinel in LR so a hosted program
        // that returns out of `main` halts cleanly instead of jumping to
        // PC = 0. The sentinel is always registered by `Cpu::new`.
        if let Some(ret_addr) = self.host.lookup("__main_return") {
            self.regs.write_gpr(30, true, ret_addr);
        }
        crate::argv::setup_argv(&mut self.regs, &mut self.mem, args).map_err(map_write_fault)?;
        crate::hosted::stdio::write_stdio_globals(&mut self.mem).map_err(map_write_fault)?;
        self.halted = false;
        // Refresh the symbol table from the linker so debugger
        // surfaces (`gdb b <label>`, future symbolic features) can
        // resolve names without going through the frontend again.
        self.symbols = image.symbols.clone();
        self.text_end = Some(image.text_end);
        self.trampoline_base = image.trampoline_base;
        self.trampoline_names = image.trampoline_names.clone();
        Ok(())
    }

    /// Name of the host function the pc is currently inside, or `None` when
    /// the pc is an instruction the student wrote. Two ranges answer: the
    /// synthetic stub address (the runtime is executing printf itself) and
    /// the image's trampoline slots (the `LDR X16; BR X16` pair a `bl`
    /// arrives at). Both words of a slot report the same name, so all three
    /// steps a hosted call takes are legible as one external call.
    pub fn host_call_name(&self, pc: u64) -> Option<&str> {
        if let Some(name) = self.host.name_for_address(pc) {
            // `__main_return` is the loader's return sentinel, not a call the
            // program made -- the same exemption the SP-alignment check
            // makes. Naming it would report an external call for the one step
            // between main's `ret` and the halt.
            if name == "__main_return" {
                return None;
            }
            return Some(name);
        }
        let span = (self.trampoline_names.len() as u64) * 8;
        if pc >= self.trampoline_base
            && pc < self.trampoline_base + span
            && pc.is_multiple_of(4)
        {
            let slot = ((pc - self.trampoline_base) / 8) as usize;
            return self.trampoline_names.get(slot).map(String::as_str);
        }
        None
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
                    Item::Label { .. } => {}
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
                    Item::ReserveExpr { .. } => {
                        // Same story: sizing needs the symbol table this
                        // loader does not have. The linker path resolves
                        // it; here the reserve contributes no bytes.
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

    /// Add whatever a host stub or syscall just printed to the cumulative
    /// output counter; true means the `MAX_OUTPUT_BYTES` wall is breached.
    /// The arguments are `stdout.len()` and `stderr.len()` captured before
    /// the call, so UI drains between steps never reset the accounting.
    /// The two display counters ride along here because this is the one
    /// place bytes reach the drainable buffers -- input echo included,
    /// since the echo is appended before this runs.
    fn charge_output(&mut self, out_before: usize, err_before: usize) -> bool {
        let out_new = self.stdout.len().saturating_sub(out_before);
        let err_new = self.stderr.len().saturating_sub(err_before);
        self.stdout_seen = self.stdout_seen.saturating_add(out_new as u64);
        self.stderr_seen = self.stderr_seen.saturating_add(err_new as u64);
        self.output_total += out_new + err_new;
        self.output_total > MAX_OUTPUT_BYTES
    }

    /// Echo the cooked-tty lines a read just consumed. `before` is
    /// `stdin.len()` captured ahead of the dispatch, so the difference is
    /// exactly what the read took.
    ///
    /// The rule is whole-segment-at-first-touch: the moment a read takes
    /// the FIRST byte of an interactive run, the run's whole text goes to
    /// stdout. A submitted line then lands as one typed line ("Enter score
    /// 1: 10\n"), and the trailing "\n" a later scanf skips does not print
    /// itself a second time. Raw mode echoes nothing -- a termios program
    /// paints its own screen and would fight the echo for the cursor.
    fn echo_consumed_stdin(&mut self, before: usize) {
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

    /// Whether the state a snapshot frame copies WHOLE -- virtual files,
    /// queued stdin, open-file paths -- has outgrown the ring's budget.
    /// Guest pages are shared copy-on-write, so they cost nothing to
    /// snapshot, but these are real copies on every step: 100k steps with
    /// a 1 MiB virtual file took 51 s against 73 ms with none.
    fn snapshot_side_bytes_exceeded(&self) -> bool {
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
    fn charge_bulk_work(&mut self, before: u64) {
        let moved = self.mem.bytes_written().saturating_sub(before);
        self.steps_total = self
            .steps_total
            .saturating_add(moved / BULK_BYTES_PER_STEP);
    }

    /// Build the calm output-ceiling halt, mirroring `memory_cap_halt`.
    fn output_cap_halt(&mut self) -> StepResult {
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

    /// Convert a propagated runtime error -- a fetch fault, an undecodable
    /// word, an executor fault, or a failed host stub / syscall -- into the
    /// same calm halt the bounds use. Without this boundary the CPU stayed
    /// live at the faulting PC: Step re-derived the identical error forever,
    /// Run re-issued chunks against the wedged machine at full speed, and
    /// `is_halted()` disagreed with the step payload. PC is left unadvanced
    /// so the fault resolves to the line that raised it.
    fn runtime_error_halt(&mut self, e: EmuError) -> StepResult {
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
    fn check_runaway_walls(&mut self) -> Option<StepResult> {
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
        // store path silently mapped page after page downward until the
        // memory cap fired blaming "too much memory" -- the wrong cause.
        if self.regs.read_sp() < STACK_FLOOR {
            return Some(self.runtime_error_halt(EmuError::StackOverflow));
        }

        None
    }

    /// Snapshot CPU state before we touch anything so `step_back` can
    /// restore the exact pre-step state. Stdout/stderr are intentionally
    /// excluded from the snapshot (rolling back already-seen output is
    /// more confusing than leaving it in place). Raw-mode terminal
    /// programs skip the ring entirely: a paced game executes millions
    /// of steps, each clone costs far more than the step itself, and
    /// stepping back into the middle of a live game has no meaning.
    /// A host can also pause the ring explicitly (the web pauses it
    /// while a program is driven live in the terminal pane, where the
    /// same cost argument applies to cooked-mode menus), and the ring
    /// stops on its own once the side state it copies whole outgrows
    /// `MAX_SNAPSHOT_SIDE_BYTES`.
    fn capture_step_snapshot(&mut self) {
        if self.term.raw_mode || self.snapshots_paused || self.snapshot_side_bytes_exceeded() {
            // Not recording this step. Drop the frames recorded BEFORE
            // this stretch too: keeping them lets one `step_back` leap
            // over every unrecorded step into a state many instructions
            // old while the step counter drops by one. An unrecorded
            // stretch ends the history rather than hiding a hole in it.
            self.snapshots.clear();
        } else {
            self.snapshots.push(Snapshot {
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
                stdout_seen: self.stdout_seen,
                stderr_seen: self.stderr_seen,
            });
        }
    }

    /// Detect which registers changed, against the integer and FP files as
    /// they stood before the instruction ran. The UI flashes both sets.
    fn record_changed_registers(&mut self, gpr_before: &[u64; 32], fpr_before: &[u64; 32]) {
        let current = self.regs.snapshot();
        self.changed_regs.clear();
        for i in 0..32 {
            if gpr_before[i] != current[i] {
                self.changed_regs.push(i as u8);
            }
        }
        let fpr_current = self.regs.snapshot_fpr();
        self.changed_fprs.clear();
        for i in 0..32 {
            if fpr_before[i] != fpr_current[i] {
                self.changed_fprs.push(i as u8);
            }
        }
    }

    /// How the cycle ended, in the order the states shadow one another:
    /// a paused read outranks an exit status, which outranks a plain halt,
    /// which outranks a pending sleep. Sets `halted` for the exit case, so
    /// the flag and the outcome agree in the result the caller builds.
    fn classify_outcome(&mut self) -> StepOutcome {
        if self.blocked {
            StepOutcome::WaitingForInput
        } else if let Some(code) = self.exit_code {
            self.halted = true;
            StepOutcome::Exited(code)
        } else if self.halted {
            StepOutcome::Halted
        } else if let Some(ns) = self.pending_sleep_ns {
            StepOutcome::Sleeping(ns)
        } else {
            StepOutcome::Advance
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

        // The pending pause belongs to the step that asked for it. Left
        // set, it made every later step report `Sleeping` again and
        // pre-empted the next `run_until_break` into executing nothing --
        // a permanent stall for any driver that did not remember to call
        // `take_pending_sleep_ns`.
        self.pending_sleep_ns = None;

        if let Some(halt) = self.check_runaway_walls() {
            return Ok(halt);
        }

        let pc = self.regs.read_pc();

        self.capture_step_snapshot();

        // Count this executed step against the cumulative ceiling. Done
        // before the host-stub dispatch so synthetic libc calls count too.
        self.steps_total += 1;

        // If PC landed on a host-stub address (reached via `bl printf` or
        // similar), dispatch to Rust instead of fetching an instruction,
        // then return to the caller via LR.
        if self.host.contains_address(pc) {
            // AAPCS64's public-interface rule, enforced where glibc would
            // fault: SP must be 16-aligned at every call into the runtime.
            // On the servers a misaligned frame dies inside printf's first
            // stack access; the stubs here are Rust and mostly skip guest
            // stack reads, so the boundary check is what reproduces the
            // bus error. `__main_return` is the loader's return sentinel,
            // not a call -- faulting there would blame the wrong line on
            // an unbalanced epilogue, which has its own diagnosis.
            let sp = self.regs.read_sp();
            if !sp.is_multiple_of(16) && self.host.lookup("__main_return") != Some(pc) {
                return Ok(self.runtime_error_halt(EmuError::SpAlignmentFault {
                    sp,
                    at_call: true,
                }));
            }
            // A page-cap write fault inside a hosted libc routine (e.g. a
            // buffer-filling scanf when the program has already neared the
            // cap) gets the same calm halt as a write in normal code, never
            // a raw fault. Any other stub failure halts calmly too.
            let out_before = self.stdout.len();
            let err_before = self.stderr.len();
            let moved = self.mem.bytes_written();
            let queued = self.stdin.len();
            let dispatched = self.dispatch_host_stub(pc);
            // Echo before the charge so echoed bytes count against the
            // output wall and the display counters like any other output.
            self.echo_consumed_stdin(queued);
            self.charge_bulk_work(moved);
            if self.charge_output(out_before, err_before) {
                return Ok(self.output_cap_halt());
            }
            return match dispatched {
                Err(EmuError::MemoryFault { access: MemAccess::Write, .. }) => {
                    Ok(self.memory_cap_halt())
                }
                Err(e) => Ok(self.runtime_error_halt(e)),
                other => other,
            };
        }

        // Fell off the end of the program: the previous instruction was the
        // image's last and nothing branched. Name the real cause instead of
        // decoding the padding that happens to live here.
        if self.text_end == Some(pc) {
            self.halted = true;
            let msg = "execution ran past the last instruction of the program. \
                       main needs a `ret` (with an epilogue if it pushed one) or an \
                       exit call as its final step"
                .to_string();
            self.abort_message = Some(msg.clone());
            return Ok(StepResult {
                pc,
                halted: true,
                error: Some(msg),
                outcome: StepOutcome::Halted,
            });
        }

        let snapshot = self.regs.snapshot();
        let fpr_snapshot = self.regs.snapshot_fpr();
        let word = match self.mem.read_u32(pc) {
            Ok(w) => w,
            Err(e) => return Ok(self.runtime_error_halt(e)),
        };
        let instr = match decoder::decode(word) {
            Ok(i) => i,
            Err(e) => return Ok(self.runtime_error_halt(e)),
        };
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
            Err(e) => return Ok(self.runtime_error_halt(e)),
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
                let out_before = self.stdout.len();
                let err_before = self.stderr.len();
                let moved = self.mem.bytes_written();
                let queued = self.stdin.len();
                let dispatched = self.dispatch_syscall(syscall_num);
                self.echo_consumed_stdin(queued);
                self.charge_bulk_work(moved);
                if self.charge_output(out_before, err_before) {
                    return Ok(self.output_cap_halt());
                }
                match dispatched {
                    Ok(()) => {}
                    Err(EmuError::MemoryFault { access: MemAccess::Write, .. }) => {
                        return Ok(self.memory_cap_halt());
                    }
                    Err(e) => return Ok(self.runtime_error_halt(e)),
                }
                // After a syscall returns normally, PC moves past the svc.
                if !self.blocked {
                    self.regs.write_pc(pc + 4);
                }
            }
        }

        self.record_changed_registers(&snapshot, &fpr_snapshot);

        let outcome = self.classify_outcome();

        Ok(StepResult {
            pc: self.regs.read_pc(),
            halted: self.halted,
            error: None,
            outcome,
        })
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
    /// segment -- it queues nothing, and a segment per empty push would
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
    fn dispatch_syscall(&mut self, number: u64) -> Result<(), EmuError> {
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
        };
        let outcome = crate::hosted::syscalls::dispatch(number, &mut ctx)?;
        match outcome {
            HostOutcome::Continue => {}
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
    fn apply_sleep(&mut self, ns: u64) {
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
    fn dispatch_host_stub(&mut self, pc: u64) -> Result<StepResult, EmuError> {
        // Snapshot registers so the change highlighter still works across a
        // host call.
        let snapshot = self.regs.snapshot();
        let fpr_snapshot = self.regs.snapshot_fpr();
        // The table is read-only during dispatch; split the borrow by
        // temporarily taking the entries, dispatching, then restoring.
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
            HostOutcome::Sleep(ns) => {
                // No libc stub sleeps today, but keep the arm honest: a
                // sleeping stub returns to its caller like Continue.
                self.apply_sleep(ns);
                let lr = self.regs.read_gpr(30, true);
                self.regs.write_pc(lr);
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
        let fpr_current = self.regs.snapshot_fpr();
        self.changed_fprs.clear();
        for i in 0..32 {
            if fpr_snapshot[i] != fpr_current[i] {
                self.changed_fprs.push(i as u8);
            }
        }

        let result_outcome = match host_outcome {
            HostOutcome::Continue => StepOutcome::Advance,
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
        self.snapshots_paused = false;
        self.pending_sleep_ns = None;
        self.refund_steps_total = 0;
        self.refund_output_total = 0;
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
        // stepping back into one moved the program FORWARD past the
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

    /// Indices of FP registers (d0-d31) that changed during the last step.
    pub fn changed_fp_registers(&self) -> &[u8] {
        &self.changed_fprs
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
    fn changed_fp_regs_tracked() {
        // movz x5, 42 (integer step: fp set stays empty), then fmov d0, #1.5.
        // The VFP8 immediate for 1.5 is 0x78 and the IEEE-754 double bits are
        // 0x3FF8000000000000 -- both independent literals from the ARM ARM,
        // never recomputed through the code under test.
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(5, 42, 0),
            0x1E60_1000u32 | (0x78 << 13), // fmov d0, #1.5
            encode_svc(0),
        ];
        cpu.load_program(&code);

        cpu.step().unwrap();
        assert!(cpu.changed_fp_registers().is_empty());
        cpu.step().unwrap();
        assert!(cpu.changed_fp_registers().contains(&0));
        assert_eq!(cpu.regs.read_fpr_bits(0), 0x3FF8_0000_0000_0000);
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

    #[test]
    fn reset_returns_the_page_budget_to_baseline() {
        // A program that exhausts MAX_MAPPED_PAGES must not leave the
        // budget spent: reset gives the pages back, so the next program
        // starts from the same baseline as a fresh tab.
        let mut cpu = Cpu::new();
        let baseline = cpu.mem.mapped_page_count();
        let mut addr = 0x0100_0000u64;
        while cpu.mem.write_u8(addr, 1).is_ok() {
            addr += 4096;
        }
        assert!(cpu.mem.mapped_page_count() >= crate::memory::MAX_MAPPED_PAGES);
        cpu.reset();
        assert_eq!(cpu.mem.mapped_page_count(), baseline);
        // And the budget is genuinely usable again.
        cpu.mem.write_u8(0x0100_0000, 1).unwrap();
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
    fn output_ceiling_halts_calmly() {
        // The step and page walls never covered printing; a write syscall
        // crossing MAX_OUTPUT_BYTES must halt with the calm message.
        let mut cpu = Cpu::new();
        cpu.load_program(&[
            encode_movz(8, 64, 0),   // x8 = write
            encode_movz(0, 1, 0),    // x0 = stdout
            encode_movz(1, 0x60, 1), // x1 = DATA_BASE (0x0060_0000)
            encode_movz(2, 16, 0),   // x2 = 16 bytes
            encode_svc(0),
        ]);
        for i in 0..16 {
            cpu.mem.write_u8(0x0060_0000 + i, b'x').unwrap();
        }
        cpu.output_total = MAX_OUTPUT_BYTES - 8;
        let r = cpu.run_until_break(100).unwrap();
        assert!(r.halted);
        assert_eq!(r.error, Some(output_ceiling_message()));
        assert_eq!(cpu.abort_message, Some(output_ceiling_message()));
    }

    #[test]
    fn output_accounting_survives_console_drains() {
        // The wall measures what the program produced, not what happens to
        // be queued: draining stdout between steps must not reset it.
        let mut cpu = Cpu::new();
        cpu.load_program(&[
            encode_movz(8, 64, 0),
            encode_movz(0, 1, 0),
            encode_movz(1, 0x60, 1),
            encode_movz(2, 16, 0),
            encode_svc(0),
        ]);
        for i in 0..16 {
            cpu.mem.write_u8(0x0060_0000 + i, b'x').unwrap();
        }
        cpu.output_total = MAX_OUTPUT_BYTES - 8;
        for _ in 0..4 {
            cpu.step().unwrap();
            let _ = cpu.take_stdout(); // UI heartbeat drain
        }
        let r = cpu.step().unwrap(); // the svc that crosses the wall
        assert!(r.halted);
        assert_eq!(r.error, Some(output_ceiling_message()));
    }

    #[test]
    fn step_back_restores_the_display_counters_but_never_the_output_budget() {
        // Two counters over the same bytes, on purpose. The display pair
        // rolls back so a host can unprint an undone step; the flood
        // budget does not, or a step/step-back loop would print forever.
        let mut cpu = Cpu::new();
        cpu.load_program(&[
            encode_movz(8, 64, 0),   // x8 = write
            encode_movz(0, 1, 0),    // x0 = stdout
            encode_movz(1, 0x60, 1), // x1 = DATA_BASE (0x0060_0000)
            encode_movz(2, 16, 0),   // x2 = 16 bytes
            encode_svc(0),
        ]);
        for i in 0..16 {
            cpu.mem.write_u8(0x0060_0000 + i, b'x').unwrap();
        }
        for _ in 0..5 {
            cpu.step().unwrap();
        }
        assert_eq!(cpu.stdout_seen(), 16);
        assert_eq!(cpu.output_total, 16);

        cpu.step_back(); // undo the svc that wrote
        assert_eq!(cpu.stdout_seen(), 0, "the display counter follows the frame");
        assert_eq!(cpu.output_total, 16, "the wall keeps counting the original");
        assert_eq!(cpu.stdout.len(), 16, "the buffer is not rolled back");
    }

    #[test]
    fn an_interactive_push_echoes_where_a_plain_push_stays_silent() {
        // The queue is the same either way; only the echo differs. Hand
        // the read syscall one typed line and one redirected line and
        // watch which one reaches stdout.
        let read_program = [
            encode_movz(8, 63, 0),   // x8 = read
            encode_movz(0, 0, 0),    // x0 = stdin
            encode_movz(1, 0x60, 1), // x1 = DATA_BASE
            encode_movz(2, 4, 0),    // x2 = 4 bytes
            encode_svc(0),
        ];

        let mut typed = Cpu::new();
        typed.load_program(&read_program);
        typed.push_stdin_interactive(b"ab\n");
        for _ in 0..5 {
            typed.step().unwrap();
        }
        assert_eq!(typed.stdout, b"ab\n");
        assert!(typed.stdin.is_empty(), "the read drained the line");

        let mut redirected = Cpu::new();
        redirected.load_program(&read_program);
        redirected.push_stdin(b"ab\n");
        for _ in 0..5 {
            redirected.step().unwrap();
        }
        assert!(redirected.stdout.is_empty());
    }

    #[test]
    fn unsupported_syscall_halts_calmly_instead_of_wedging() {
        // The wedge this guards: the error used to propagate raw with
        // `halted` left false and PC unmoved, so Run re-issued chunks
        // against the same fault at full speed and froze the tab, and
        // every Step reproduced the identical error forever.
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(8, 172, 0), encode_svc(0)]);
        cpu.step().unwrap(); // mov x8, 172 (getpid -- not implemented)
        let r = cpu.step().unwrap(); // svc 0
        assert!(r.halted);
        assert!(r.error.as_deref().unwrap_or("").contains("172"));
        assert!(cpu.is_halted());
        assert!(cpu.abort_message.is_some());
        // A further step must not re-execute anything.
        let pc_before = cpu.regs.read_pc();
        let again = cpu.step().unwrap();
        assert_eq!(again.outcome, StepOutcome::Halted);
        assert_eq!(cpu.regs.read_pc(), pc_before);
    }

    #[test]
    fn exit_group_terminates_like_exit() {
        // glibc's exit() issues exit_group (94) on AArch64 Linux; the
        // course machine accepts it, so the playground must too.
        let mut cpu = Cpu::new();
        cpu.load_program(&[
            encode_movz(0, 7, 0),
            encode_movz(8, 94, 0),
            encode_svc(0),
        ]);
        let r = cpu.run_until_break(10).unwrap();
        assert!(r.halted);
        assert_eq!(r.error, None);
        assert_eq!(cpu.exit_code(), Some(7));
    }

    #[test]
    fn undecodable_word_halts_calmly_with_the_message_preserved() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[0x0000_0000]);
        let r = cpu.step().unwrap();
        assert!(r.halted);
        assert!(
            r.error.as_deref().unwrap_or("").contains("unknown instruction"),
            "error was: {:?}",
            r.error
        );
        assert!(cpu.is_halted());
    }

    #[test]
    fn runtime_fault_during_run_keeps_the_executed_step_count() {
        // Three good instructions then a read fault; the run result must
        // report the steps that DID execute, halted, and the message.
        let mut cpu = Cpu::new();
        cpu.load_program(&[
            encode_movz(0, 1, 0),
            encode_movz(1, 2, 0),
            encode_movz(2, 3, 0),
            0xF940_0020, // ldr x0, [x1] -- x1 = 2, unmapped/unaligned
        ]);
        let r = cpu.run_until_break(100).unwrap();
        assert!(r.halted);
        assert_eq!(r.steps_executed, 4);
        assert!(r.error.is_some());
        assert_eq!(cpu.regs.read_gpr(2, true), 3);
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
    fn the_strtok_cursor_rides_in_snapshots_and_clears_on_reset() {
        // strtok's cursor is the one piece of libc state a program can
        // observe without holding it: if step-back left it where the
        // undone call put it, replaying the call would hand out the
        // NEXT token instead of the same one.
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 1, 0), encode_movz(0, 2, 0)]);
        cpu.strtok_save = 0x0050_0004;
        cpu.save_state("mid-parse");
        cpu.step().unwrap();
        cpu.strtok_save = 0x0050_0009;
        cpu.step_back();
        assert_eq!(cpu.strtok_save, 0x0050_0004);
        cpu.strtok_save = 0x0050_000E;
        assert!(cpu.load_state("mid-parse"));
        assert_eq!(cpu.strtok_save, 0x0050_0004);
        cpu.reset();
        assert_eq!(cpu.strtok_save, 0);
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
    fn step_back_replays_the_same_rand_draw() {
        // rand's state rides in the snapshot: undoing a draw and stepping
        // again must produce the identical value, or replay diverges.
        let mut cpu = Cpu::new();
        let stub_addr = cpu.host.lookup("rand").expect("rand pre-registered");
        cpu.load_program(&[encode_svc(0)]);
        // First draw.
        cpu.regs.write_gpr(30, true, CODE_BASE);
        cpu.regs.write_pc(stub_addr);
        cpu.step().unwrap();
        let first = cpu.regs.read_gpr(0, true);
        // Second draw.
        cpu.regs.write_gpr(30, true, CODE_BASE);
        cpu.regs.write_pc(stub_addr);
        cpu.step().unwrap();
        let second = cpu.regs.read_gpr(0, true);
        assert_ne!(first, second, "consecutive draws differ");
        // Undo the second draw and take it again: same value.
        cpu.step_back();
        cpu.step().unwrap();
        assert_eq!(cpu.regs.read_gpr(0, true), second);
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
    fn breakpoint_on_a_chunk_boundary_is_reported_not_skipped() {
        // Both backends drive runs in fixed-size chunks; a breakpoint whose
        // first arrival lands exactly on a chunk boundary must be reported
        // by the ending chunk, because the next chunk's first-step resume
        // exemption would otherwise run straight through it.
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(0, 1, 0),
            encode_movz(1, 2, 0),
            encode_movz(2, 3, 0),
            encode_movz(3, 4, 0),
            encode_svc(0),
        ];
        cpu.load_program(&code);
        cpu.set_breakpoint(CODE_BASE + 8); // the third instruction

        // Chunk of exactly 2 steps: the loop stops at the cap with PC
        // resting on the breakpoint that has not yet been reported.
        let chunk = cpu.run_until_break(2).unwrap();
        assert_eq!(chunk.pc, CODE_BASE + 8);
        assert!(chunk.hit_breakpoint, "the boundary chunk must report the hit");
        assert_eq!(cpu.regs.read_gpr(2, true), 0, "the breakpoint line must not execute");

        // A true resume steps past it and runs to the halt.
        let resumed = cpu.run_until_break(100).unwrap();
        assert!(resumed.halted);
        assert_eq!(cpu.regs.read_gpr(2, true), 3);
    }

    #[test]
    fn restore_paths_clear_a_stale_abort_message() {
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        cpu.save_state("checkpoint");
        cpu.step().unwrap();

        // A recorded abort must not survive into a restored save...
        cpu.abort_message = Some("stale abort".to_string());
        assert!(cpu.load_state("checkpoint"));
        assert!(cpu.abort_message.is_none());
        let r = cpu.run_until_break(10).unwrap();
        assert!(r.halted);
        assert!(r.error.is_none(), "a clean run after restore reports no error");

        // ...nor past a backward step, which also refunds the step budget.
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        cpu.step().unwrap();
        let spent = cpu.steps_total;
        cpu.abort_message = Some("stale abort".to_string());
        cpu.step_back();
        assert!(cpu.abort_message.is_none());
        assert_eq!(cpu.steps_total, spent - 1);
    }

    #[test]
    fn restoring_a_save_drops_the_step_back_history() {
        // The ring still held frames recorded after the save, so they sat
        // in the restored machine's FUTURE: one step back off a restore
        // landed two instructions past the restore point.
        let mut cpu = Cpu::new();
        cpu.load_program(&[
            encode_movz(0, 1, 0),
            encode_movz(1, 2, 0),
            encode_movz(2, 3, 0),
            encode_movz(3, 4, 0),
            encode_svc(0),
        ]);
        cpu.step().unwrap();
        cpu.save_state("checkpoint");
        let restore_pc = cpu.regs.read_pc();
        cpu.step().unwrap();
        cpu.step().unwrap();
        cpu.step().unwrap();

        assert!(cpu.load_state("checkpoint"));
        assert_eq!(cpu.regs.read_pc(), restore_pc);
        assert!(!cpu.can_step_back(), "a restore ends the recorded history");
        cpu.step_back();
        assert_eq!(
            cpu.regs.read_pc(),
            restore_pc,
            "step_back must never move the machine forward"
        );
        assert_eq!(cpu.regs.read_gpr(3, true), 0, "no future write survives");
    }

    #[test]
    fn an_ignored_sleep_never_stalls_the_machine() {
        use crate::hosted::{HostContext, HostOutcome};
        fn sleeper(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
            Ok(HostOutcome::Sleep(1_000_000))
        }
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        let stub = cpu.host.register("sleeper", sleeper);
        cpu.regs.write_pc(stub);
        cpu.regs.write_gpr(30, true, CODE_BASE);

        let first = cpu.run_until_break(10).unwrap();
        assert_eq!(first.steps_executed, 1, "the run hands back at the pause");
        assert!(!first.halted);

        // The runner never asks for the pause -- a native embedder, or any
        // driver that forgets `take_pending_sleep_ns`. Both later calls
        // used to execute zero steps forever.
        let second = cpu.run_until_break(10).unwrap();
        assert!(
            second.steps_executed > 0,
            "a forgotten pause must not wedge the run loop"
        );
        assert!(second.halted);
        assert_eq!(cpu.regs.read_gpr(0, true), 7);
    }

    #[test]
    fn only_the_sleeping_step_reports_sleeping() {
        use crate::hosted::{HostContext, HostOutcome};
        fn sleeper(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
            Ok(HostOutcome::Sleep(1_000_000))
        }
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        let stub = cpu.host.register("sleeper", sleeper);
        cpu.regs.write_pc(stub);
        cpu.regs.write_gpr(30, true, CODE_BASE);

        let slept = cpu.step().unwrap();
        assert_eq!(slept.outcome, StepOutcome::Sleeping(1_000_000));
        // The pause is still readable right after the step that asked for
        // it, and the next step clears it: it describes one instruction,
        // not the rest of the program.
        let next = cpu.step().unwrap();
        assert_eq!(next.outcome, StepOutcome::Advance);
        assert_eq!(cpu.take_pending_sleep_ns(), None);
    }

    #[test]
    fn bulk_stub_work_is_charged_against_the_step_budget() {
        use crate::hosted::{HostContext, HostOutcome};
        // A whole-page fill inside ONE instruction, the shape of `memset`
        // over an already-mapped buffer. Unpriced, a loop of these picks
        // its own workload per step and the runaway wall never sees it.
        fn fills_a_page(ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
            for i in 0..4096u64 {
                ctx.mem.write_u8(0x1000_0000 + i, 0xAB)?;
            }
            Ok(HostOutcome::Continue)
        }
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        let stub = cpu.host.register("filler", fills_a_page);
        cpu.regs.write_pc(stub);
        cpu.regs.write_gpr(30, true, CODE_BASE);

        cpu.step().unwrap();
        assert_eq!(
            cpu.steps_total,
            1 + 4096 / BULK_BYTES_PER_STEP,
            "the bytes moved must be charged on top of the step itself"
        );

        // An ordinary instruction still costs exactly one step.
        let before = cpu.steps_total;
        cpu.step().unwrap();
        assert_eq!(cpu.steps_total, before + 1);
    }

    #[test]
    fn the_sleep_output_refund_stops_at_its_lifetime_cap() {
        // Refunded output had no cap of its own, so the step refund's cap
        // was the only limit and the documented 4 MiB output wall was
        // really 23 MiB. The lifetime cap states the true ceiling:
        // MAX_OUTPUT_BYTES, plus at most MAX_REFUND_OUTPUT_BYTES earned
        // back by real pauses.
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_svc(0)]);
        let start = MAX_OUTPUT_BYTES * 3;
        cpu.output_total = start;
        let per_sleep = (MAX_SLEEP_NS / SLEEP_OUTPUT_REFUND_NS_PER_BYTE) as usize;
        for _ in 0..(MAX_REFUND_OUTPUT_BYTES / per_sleep + 20) {
            cpu.apply_sleep(MAX_SLEEP_NS);
        }
        assert_eq!(
            start - cpu.output_total,
            MAX_REFUND_OUTPUT_BYTES,
            "the output refund must stop at its lifetime cap"
        );
        // A fresh program starts the refund budget over.
        cpu.load_program(&[encode_svc(0)]);
        cpu.output_total = start;
        cpu.apply_sleep(MAX_SLEEP_NS);
        assert_eq!(start - cpu.output_total, per_sleep);
    }

    #[test]
    fn a_halted_run_still_reports_its_own_abort() {
        // The stale-message gate must not swallow a genuine abort raised by
        // the run itself.
        let mut cpu = Cpu::new();
        cpu.load_program(&[0x1400_0000]); // b .
        cpu.steps_total = MAX_TOTAL_STEPS - 1;
        let r = cpu.run_until_break(10).unwrap();
        assert!(r.halted);
        assert_eq!(r.error, Some(step_ceiling_message()));
    }

    #[test]
    fn a_runaway_sp_halts_with_the_stack_overflow_cause() {
        // Never run real deep recursion here (slow in debug); park sp past
        // the floor directly and take one step.
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        cpu.regs.write_sp(STACK_FLOOR - 16);
        let r = cpu.step().unwrap();
        assert!(r.halted);
        let msg = r.error.unwrap_or_default();
        assert!(msg.contains("stack overflow"), "was: {msg}");
        assert!(msg.contains("recursion"), "was: {msg}");
        assert!(cpu.is_halted());

        // A normal frame nowhere near the floor is untouched.
        let mut cpu = Cpu::new();
        cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
        cpu.regs.write_sp(STACK_BASE - 4096);
        let r = cpu.step().unwrap();
        assert!(r.error.is_none());
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
