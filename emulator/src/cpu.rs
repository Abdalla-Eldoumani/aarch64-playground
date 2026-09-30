use std::collections::{HashMap, HashSet, VecDeque};

use crate::decoder;
use crate::errors::{EmuError, MemAccess};
use crate::executor::{self, ExecResult};
use crate::frontend::sections::{align_padding, Item, Program};
use crate::hosted::{HostContext, HostOutcome, HostTable, RETURNS_IN_D0, RETURNS_NOTHING};
use crate::memory::Memory;
use crate::registers::RegisterFile;
use crate::snapshot::{Snapshot, SnapshotRing};

mod bounds;
mod control;
mod loader;
mod system;

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
/// recording, the same trade raw-mode terminal programs already make.
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
/// memory-cap one, which is why this floor stays well under
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
/// loaded program has executed this many steps (counted across every
/// `step` and the inner `run_until_break` loop, persistent until the next
/// load/reset), the run aborts calmly instead of hanging the tab. ~10M
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
/// buffers live outside guest pages, so a print in a tight loop (or one
/// crafted wide-format call) could grow the console without bound. The
/// counter survives the UI draining the buffers, so it measures what the
/// program produced, not what happens to be queued. 4 MiB dwarfs any real
/// course program's output.
pub const MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;

/// Map a Write fault into the calm page-cap message. Stores are the only
/// writer that faults (memory.rs's cap check is the sole producer), so a
/// Write fault anywhere (executing code, a host stub, or loading an
/// image whose sections need pages the budget no longer covers) always
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
/// microseconds). A paced game therefore runs indefinitely (its
/// budgets refill in real time while the tab sits idle), yet a
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

/// Lifetime cap on output bytes the sleep refund may credit back.
/// Without a cap of its own, the step cap alone lets a paced program earn
/// back 20 MB, raising the 4 MiB output wall to 23 MiB. Capping it here
/// states the real ceiling: a program may print MAX_OUTPUT_BYTES, plus
/// this much more if it paced itself with real sleeps to earn it.
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
/// terminal pane's transcript reads "Enter score 1: 10". In the console
/// panel the bytes arrive through an input box rather than a keyboard, so
/// without the echo the transcript reads "Enter score 1: " with the answer
/// nowhere in sight. The echo is the emulator's job because only the
/// emulator knows WHEN a read consumed the line.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct StdinSegment {
    /// The run's bytes, kept whole so the echo prints the line the
    /// student submitted rather than whatever is left of it.
    pub bytes: Vec<u8>,
    /// How many of `bytes` reads have already taken.
    pub consumed: usize,
    /// The run arrived through `push_stdin_interactive`: typed at a
    /// prompt, so a cooked tty would have echoed it.
    pub interactive: bool,
    /// The echo has already been written to stdout. Snapshotted, so
    /// stepping back before the read restores the un-echoed state.
    pub echoed: bool,
}

/// What read a register a library call had overwritten, the second word
/// of a clobber note row (see `Cpu::take_clobber_notes`): an instruction,
/// a library call taking it as an argument, or main's return handing it
/// back as the exit status.
pub const READ_BY_INSTRUCTION: u32 = 0;
pub const READ_BY_CALL: u32 = 1;
pub const READ_BY_MAIN_RETURN: u32 = 2;

/// A read an instruction makes without using the value, in the clobber
/// notes' register numbering (`xN` N, `dN` 32 + N).
#[derive(Debug, PartialEq)]
enum PassiveRead {
    /// Registers a store writes to memory, as a bit set.
    Stored(u64),
    /// A register copied into another.
    Copied { from: u8, to: u8 },
    Used,
}

/// What `instr` reads only to store or copy, if anything.
fn passive_read(instr: &decoder::Instruction) -> PassiveRead {
    use decoder::{Instruction as I, LdStOffset, LdStOp, LdStPairOp, LogOp};
    // x31 is xzr or sp here, never a tracked register.
    let x = |r: u8| if r < 31 { 1u64 << r } else { 0 };
    let d = |r: u8| 1u64 << (32 + r);
    match instr {
        // A register that also forms the address is used, not stored.
        I::LdSt { op: LdStOp::Str, rt, rn, offset, .. } => {
            let rm = match offset {
                LdStOffset::Register { rm, .. } => *rm,
                LdStOffset::Immediate(_) => 31,
            };
            PassiveRead::Stored(x(*rt) & !x(*rn) & !x(rm))
        }
        I::LdStPair { op: LdStPairOp::Stp, rt, rt2, rn, .. } => {
            PassiveRead::Stored((x(*rt) | x(*rt2)) & !x(*rn))
        }
        I::FpLdSt { load: false, ft, .. } => PassiveRead::Stored(d(*ft)),
        I::FpLdStPair { op: LdStPairOp::Stp, rt, rt2, .. } => PassiveRead::Stored(d(*rt) | d(*rt2)),
        // `mov` is `orr` from the zero register with no shift.
        I::LogReg { op: LogOp::Orr, rd, rn: 31, rm, amount: 0, set_flags: false, invert: false, .. }
            if *rd < 31 && *rm < 31 =>
        {
            PassiveRead::Copied { from: *rm, to: *rd }
        }
        I::FpMoveReg { fd, fn_, .. } => PassiveRead::Copied { from: 32 + fn_, to: 32 + fd },
        I::FpMoveGeneral { to_fp: true, rd, rn, .. } if *rn < 31 => {
            PassiveRead::Copied { from: *rn, to: 32 + rd }
        }
        I::FpMoveGeneral { to_fp: false, rd, rn, .. } if *rd < 31 => {
            PassiveRead::Copied { from: 32 + rn, to: *rd }
        }
        _ => PassiveRead::Used,
    }
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
/// exit status) that the libc stubs and the syscall dispatcher populate.
pub struct Cpu {
    pub regs: RegisterFile,
    pub mem: Memory,
    breakpoints: HashSet<u64>,
    changed_regs: Vec<u8>,
    /// FP registers (v0-v31, any bit of the 128) the last step wrote,
    /// tracked alongside the integer set so the UI's view can flash writes.
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
    /// qsort and bsearch calls part-way through, waiting on the program's
    /// comparator. Snapshotted so step-back can rewind into a sort.
    pub callbacks: crate::hosted::callback::CallbackState,
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
    /// printed. `output_total` above is the wall and is never restored:
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
    /// no ret), which deserves its own message; without the guard the
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
    /// Note rows not yet taken by the host, and the registers already
    /// noted (bit N for register N as the rows number them): one note per
    /// register per run. Not snapshotted, like the console buffers the
    /// notes sit beside.
    clobber_notes: Vec<u32>,
    clobber_noted: u64,
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
            callbacks: Default::default(),
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
            clobber_notes: Vec::new(),
            clobber_noted: 0,
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
        // What optimized code calls in place of putchar, getchar and
        // fputs: glibc's inline putchar is putc(c, stdout).
        cpu.host.register("putc", crate::hosted::stdio::putc);
        cpu.host.register("fputc", crate::hosted::stdio::putc);
        cpu.host.register("getc", crate::hosted::stdio::getc);
        cpu.host.register("fwrite", crate::hosted::stdio::fwrite);
        // The two calls that run the program's own comparator.
        cpu.host.register("qsort", crate::hosted::callback::qsort);
        cpu.host.register("bsearch", crate::hosted::callback::bsearch);
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
        cpu.host.register("sincos", crate::hosted::math::sincos);
        // Sentinel used when a hosted program's `main` returns. Loader
        // stashes this address in LR so `ret` from main halts cleanly
        // with x0 as the exit code.
        cpu.host.register("__main_return", crate::hosted::libc::main_return);
        cpu.regs.write_sp(STACK_BASE);
        cpu.regs.write_pc(CODE_BASE);

        // pre-map stack pages so initial pushes don't need auto-map.
        // Four pages each: enough for the loader's first writes, so the
        // wasm32 dlmalloc gotcha below never fires mid-call.
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
                callbacks: self.callbacks.clone(),
                stdout_seen: self.stdout_seen,
                stderr_seen: self.stderr_seen,
            });
        }
    }

    /// Detect which registers changed, against the integer and FP files as
    /// they stood before the instruction ran. The UI flashes both sets.
    fn record_changed_registers(&mut self, gpr_before: &[u64; 32], fpr_before: &[u128; 32]) {
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
        let pc = self.regs.read_pc();
        let lr = self.regs.read_gpr(30, true);
        // Reads made between steps (the register panel, the lr above) are
        // not the program's.
        self.regs.take_clobbered_reads();
        let result = self.execute_step();
        self.note_clobbered_reads(pc, lr);
        result
    }

    fn execute_step(&mut self) -> Result<StepResult, EmuError> {
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
        // set, it makes every later step report `Sleeping` again and
        // pre-empts the next `run_until_break` into executing nothing, a
        // permanent stall for a driver that never calls
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
            // SP must be 16-aligned at every library call. On the servers a
            // misaligned frame dies at printf's first stack access, which
            // these Rust stubs mostly skip, so the check lives here instead.
            // `__main_return` is not a call: faulting there would blame the
            // wrong line for an unbalanced epilogue, which has its own
            // diagnosis.
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
                Err(EmuError::MemoryFault { address, access: MemAccess::Read }) => {
                    let e = self.libc_read_fault(pc, address);
                    Ok(self.runtime_error_halt(e))
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
}

impl Default for Cpu {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests;
