//! The C library calls, Linux syscalls and in-memory files a CPSC 355
//! program uses, run by the emulator itself. The linker asks "what address
//! does `bl printf` go to?" and the executor asks "did this BL land on one
//! of those addresses? then run that function".
//!
//! Those addresses start at `cpu::HOST_STUB_BASE` (`0xFFFF_0000`), 16 bytes
//! apart, a range that never overlaps .text/.data/.bss/.rodata or the stack.

use crate::cpu::{HOST_STUB_BASE, HOST_STUB_COUNT, HOST_STUB_STRIDE};
use crate::errors::EmuError;

pub mod callback;
pub mod ctype;
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
    /// Run a function of the program (a qsort comparator): the stub has
    /// set its arguments and the link register, and the CPU goes there.
    Call(u64),
}

/// The exit status C hands around: `exit(int)`, `return` from `int main`,
/// and the Linux exit syscalls all take a 32-bit value in w0. Reading x0 at
/// full width made `exit(-1)` report 4294967295 while `return -1` reported
/// -1. One reader keeps every exit route on the sign-extended int.
pub fn exit_status(regs: &crate::registers::RegisterFile) -> i64 {
    regs.read_gpr(0, false) as i32 as i64
}

/// Where a stub's result comes back: the one caller-saved register the
/// clobber after the call leaves alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Returns {
    /// An int, a size or a pointer.
    X0,
    /// A double.
    D0,
    /// C's `void`.
    Nothing,
}

/// One stub: the name `bl` spells, the function, where its result comes
/// back, the call card it records (`CALL_PRINTF`, `CALL_SCANF`, or 0 for
/// none), and whether a program calls it by name, which the runtime's own
/// two entries are not.
#[derive(Debug, Clone, Copy)]
pub struct Stub {
    pub name: &'static str,
    pub func: HostFn,
    pub returns: Returns,
    pub card: u8,
    pub callable: bool,
}

const fn x0(name: &'static str, func: HostFn) -> Stub {
    Stub { name, func, returns: Returns::X0, card: 0, callable: true }
}

const fn d0(name: &'static str, func: HostFn) -> Stub {
    Stub { returns: Returns::D0, ..x0(name, func) }
}

const fn void(name: &'static str, func: HostFn) -> Stub {
    Stub { returns: Returns::Nothing, ..x0(name, func) }
}

/// Every stub, in slot order: a stub's address is `HOST_STUB_BASE` plus its
/// row times `HOST_STUB_STRIDE`, so a new stub goes last and no other
/// address moves. The linker seeds every name as a symbol.
pub const STUBS: &[Stub] = &[
    // Slot 0 does nothing, so every stub a program calls has a nonzero
    // address.
    Stub { callable: false, ..x0("__host_noop", noop) },
    Stub { card: CALL_PRINTF, ..x0("printf", printf::printf) },
    Stub { card: CALL_SCANF, ..x0("scanf", scanf::scanf) },
    x0("puts", libc::puts),
    x0("putchar", libc::putchar),
    x0("getchar", libc::getchar),
    x0("sprintf", printf::sprintf),
    x0("snprintf", printf::snprintf),
    x0("strlen", libc::strlen),
    x0("strcmp", libc::strcmp),
    x0("strncmp", libc::strncmp),
    x0("strcpy", libc::strcpy),
    x0("strncpy", libc::strncpy),
    x0("strcat", libc::strcat),
    x0("strchr", libc::strchr),
    x0("strstr", libc::strstr),
    x0("strtok", libc::strtok),
    x0("memset", libc::memset),
    x0("memcpy", libc::memcpy),
    x0("memmove", libc::memmove),
    x0("memcmp", libc::memcmp),
    x0("exit", libc::exit),
    d0("atof", libc::atof),
    x0("atoi", libc::atoi),
    x0("strtol", libc::strtol),
    x0("abs", libc::abs),
    x0("labs", libc::labs),
    x0("rand", libc::rand),
    void("srand", libc::srand),
    x0("time", libc::time),
    x0("malloc", heap::malloc),
    x0("calloc", heap::calloc),
    x0("realloc", heap::realloc),
    void("free", heap::free),
    x0("usleep", libc::usleep),
    x0("fflush", libc::fflush),
    // The C-locale character classes and case conversions, both ways a
    // program reaches them: the functions, and the three tables the
    // __ctype_*_loc pointers address.
    x0("isdigit", ctype::isdigit),
    x0("isalpha", ctype::isalpha),
    x0("isspace", ctype::isspace),
    x0("toupper", ctype::toupper),
    x0("tolower", ctype::tolower),
    x0("__ctype_b_loc", ctype::ctype_b_loc),
    x0("__ctype_toupper_loc", ctype::ctype_toupper_loc),
    x0("__ctype_tolower_loc", ctype::ctype_tolower_loc),
    // FILE*-level stdio over the VFS; the handle scheme lives in stdio.rs.
    x0("fopen", stdio::fopen),
    x0("fprintf", stdio::fprintf),
    x0("fgets", stdio::fgets),
    x0("fputs", stdio::fputs),
    x0("fclose", stdio::fclose),
    // What optimized code calls in place of putchar, getchar and fputs:
    // glibc's inline putchar is putc(c, stdout).
    x0("putc", stdio::putc),
    x0("fputc", stdio::putc),
    x0("getc", stdio::getc),
    x0("fwrite", stdio::fwrite),
    // The two calls that run the program's own comparator.
    void("qsort", callback::qsort),
    x0("bsearch", callback::bsearch),
    // The libm subset: double in d0 (and d1 for the two-argument forms),
    // double out in d0.
    d0("sqrt", math::sqrt),
    d0("pow", math::pow),
    d0("sin", math::sin),
    d0("cos", math::cos),
    d0("tan", math::tan),
    d0("log", math::log),
    d0("log10", math::log10),
    d0("exp", math::exp),
    d0("floor", math::floor),
    d0("fabs", math::fabs),
    d0("fmod", math::fmod),
    void("sincos", math::sincos),
    // Where a `ret` from main lands: the loader puts this address in lr,
    // and it halts with w0 as the exit status.
    Stub { callable: false, ..x0("__main_return", libc::main_return) },
    // The name gcc -S writes for scanf.
    Stub { card: CALL_SCANF, ..x0("__isoc99_scanf", scanf::scanf) },
    x0("atol", libc::atol),
];

/// The rows through `__isoc99_scanf`, which make a program hosted wherever
/// `bl <name>` appears in its source (`bl putsx` too). A later row counts
/// only a whole `bl <name>` in the code the assembler reads, outside every
/// comment, whose name the source does not define, so a stub added after a
/// program was written never moves it off the bare-metal path (lib.rs
/// `detect_hosted_mode`).
pub const ROWS_DETECTED_ANYWHERE: usize = 69;

const _: () = assert!(
    matches!(STUBS[ROWS_DETECTED_ANYWHERE - 1].name.as_bytes(), b"__isoc99_scanf"),
    "ROWS_DETECTED_ANYWHERE ends at __isoc99_scanf"
);

const _: () = assert!(STUBS.len() as u64 <= HOST_STUB_COUNT, "host stub table full");

/// The `__main_return` stub's address, read off `STUBS` while compiling.
pub const MAIN_RETURN_ADDR: u64 = {
    let mut row = 0;
    while !matches!(STUBS[row].name.as_bytes(), b"__main_return") {
        row += 1;
    }
    HOST_STUB_BASE + row as u64 * HOST_STUB_STRIDE
};

/// Context passed to each host stub. Split out so stubs can borrow what
/// they need without holding a `&mut Cpu` (which would conflict with the
/// dispatcher's mutable borrow of the table).
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
    /// strtok's saved cursor: glibc keeps it in a static inside libc,
    /// and it is the one piece of libc state a program can observe
    /// without passing it in. On the `Cpu` and in every snapshot, so
    /// stepping back into the middle of a tokenizing loop resumes at the
    /// token it was really on. Zero is glibc's NULL start.
    pub strtok_save: &'a mut u64,
    /// qsort and bsearch calls waiting on a comparator. On the `Cpu` and
    /// in every snapshot, like `strtok_save`.
    pub callbacks: &'a mut crate::hosted::callback::CallbackState,
    /// What printf or scanf does, conversion by conversion, for the call
    /// card; `None` for every other stub.
    pub call: Option<&'a mut CallRecord>,
}

/// `CallRecord::kind`: which call the record is of (0: none).
pub const CALL_PRINTF: u8 = 1;
pub const CALL_SCANF: u8 = 2;

/// `Conversion::code`, what went wrong there: the call stopped the program
/// at this conversion (printf's %s with no string at its address), the
/// input did not fit it, or the input ended before it (scanf). The web
/// words them.
pub const CALL_OK: u8 = 0;
pub const CALL_STOPPED: u8 = 1;
pub const CALL_NO_MATCH: u8 = 2;
pub const CALL_NO_INPUT: u8 = 3;

/// `Conversion::source` of a conversion that read no argument (`%%`).
pub const ARG_NONE: i64 = -1;
/// `Conversion::source` of d0, and of the first 8-byte stack slot above sp.
pub const ARG_FP: i64 = 32;
pub const ARG_STACK: i64 = 64;

/// A record keeps this many conversions and this many bytes of the format
/// and of the text, and counts the rest, so a hostile format cannot grow it.
pub const MAX_CALL_ROWS: usize = 32;
pub const MAX_CALL_BYTES: usize = 256;

/// One conversion as the call ran it.
#[derive(Clone, Copy, Default)]
pub struct Conversion {
    /// Byte offsets in the format, from the `%` to just past its letter.
    pub fmt_start: usize,
    pub fmt_end: usize,
    /// Where its argument came from: xN as N, dN as `ARG_FP` + N, the stack
    /// as `ARG_STACK` + its 8-byte slot above sp, or `ARG_NONE`.
    pub source: i64,
    /// The argument: printf's value (a double's bits), scanf's pointer.
    pub arg: u64,
    /// scanf: the first 8 bytes it stored at `arg`, little-endian, and how
    /// many bytes it stored in all. printf's %s: how many bytes it read
    /// from `arg` (`CallRecord::strings` keeps them).
    pub stored: u64,
    pub size: u64,
    /// Byte offsets in the call's text: what this conversion printed, or
    /// the input it read.
    pub text_start: usize,
    pub text_end: usize,
    pub code: u8,
}

/// A printf or scanf call, conversion by conversion: numbers and the
/// program's own bytes, which the web words as the call card. The stub
/// fills it; the `Cpu` stamps it and keeps the last one (`Cpu::last_call`).
#[derive(Clone, Default)]
pub struct CallRecord {
    /// `CALL_PRINTF` or `CALL_SCANF`, 0 for no call.
    pub kind: u8,
    /// The stub read its format and began recording.
    pub began: bool,
    /// The step that ran the call, and the branch that made it: a `bl`, or
    /// a tail call's `b`.
    pub step: u64,
    pub call_pc: u64,
    /// x0 as the call left it, and whether the call stopped the program.
    pub result: u64,
    pub failed: bool,
    /// The format's first `MAX_CALL_BYTES`, and its whole length.
    pub fmt: Vec<u8>,
    pub fmt_len: usize,
    /// What printf printed or scanf read, kept and whole as the format is.
    pub text: Vec<u8>,
    pub text_len: usize,
    /// The first `MAX_CALL_BYTES` each kept printf %s read, one row after
    /// another: a padded or cut row's text may not hold them.
    pub strings: Vec<u8>,
    /// The first `MAX_CALL_ROWS` conversions, and how many there were.
    pub rows: Vec<Conversion>,
    pub conversions: usize,
}

impl CallRecord {
    /// Start over for a call whose format is `fmt`.
    pub(crate) fn begin(&mut self, fmt: &[u8]) {
        self.began = true;
        self.fmt.clear();
        self.fmt.extend_from_slice(&fmt[..fmt.len().min(MAX_CALL_BYTES)]);
        self.fmt_len = fmt.len();
        self.set_text(&[]);
        self.strings.clear();
        self.rows.clear();
        self.conversions = 0;
    }

    pub(crate) fn set_text(&mut self, text: &[u8]) {
        self.text.clear();
        self.text.extend_from_slice(&text[..text.len().min(MAX_CALL_BYTES)]);
        self.text_len = text.len();
    }

    pub(crate) fn push(&mut self, row: Conversion) {
        self.conversions += 1;
        if self.rows.len() < MAX_CALL_ROWS {
            self.rows.push(row);
        }
    }

    /// printf's %s being formatted read `bytes`.
    pub(crate) fn read_string(&mut self, bytes: &[u8]) {
        if let Some(row) = self.current() {
            row.size = bytes.len() as u64;
            self.strings.extend_from_slice(&bytes[..bytes.len().min(MAX_CALL_BYTES)]);
        }
    }

    /// The conversion pushed last, when it was kept.
    pub(crate) fn current(&mut self) -> Option<&mut Conversion> {
        if self.rows.len() == self.conversions { self.rows.last_mut() } else { None }
    }
}

/// AAPCS64 vararg cursor, shared by printf and scanf: both walk the same
/// convention (ints in the next GP register through x7, doubles through
/// d7, then a SHARED stack spill at the caller's SP advancing 8 bytes per
/// arg). A bare register counter would read x8 (a live scratch register)
/// for the 8th pointer instead of `[sp]`.
pub(crate) struct VarargWalker {
    /// Next GP register index. <= 7 means read xN; > 7 means spill.
    pub(crate) gp_idx: u8,
    /// Next SIMD register index. <= 7 means read dN; > 7 means spill.
    pub(crate) fp_idx: u8,
    /// Bytes above SP-at-call-site for the next spilled arg. Shared
    /// between int and float spills per AAPCS64.
    pub(crate) stack_off: u64,
    /// The last argument read, as (`Conversion::source`, its bits).
    pub(crate) last: (i64, u64),
}

impl VarargWalker {
    pub(crate) fn new(first_gp: u8) -> Self {
        VarargWalker { gp_idx: first_gp, fp_idx: 0, stack_off: 0, last: (ARG_NONE, 0) }
    }

    pub(crate) fn next_int(&mut self, ctx: &mut HostContext<'_>) -> u64 {
        let v = if self.gp_idx <= 7 {
            let v = ctx.regs.read_gpr(self.gp_idx, true);
            self.last.0 = self.gp_idx.into();
            self.gp_idx = self.gp_idx.saturating_add(1);
            v
        } else {
            self.next_spill(ctx)
        };
        self.last.1 = v;
        v
    }

    pub(crate) fn next_double(&mut self, ctx: &mut HostContext<'_>) -> f64 {
        let bits = if self.fp_idx <= 7 {
            let v = ctx.regs.read_fpr_bits(self.fp_idx);
            self.last.0 = ARG_FP + i64::from(self.fp_idx);
            self.fp_idx = self.fp_idx.saturating_add(1);
            v
        } else {
            self.next_spill(ctx)
        };
        self.last.1 = bits;
        f64::from_bits(bits)
    }

    fn next_spill(&mut self, ctx: &mut HostContext<'_>) -> u64 {
        let addr = ctx.regs.read_sp().wrapping_add(self.stack_off);
        self.last.0 = ARG_STACK + (self.stack_off / 8) as i64;
        self.stack_off = self.stack_off.wrapping_add(8);
        ctx.mem.read_u64(addr).unwrap_or(0)
    }
}

/// Table of host stubs, indexed by symbolic name and addressable via a
/// stable 64-bit address in the `HOST_STUB_BASE` range. The linker reads
/// `lookup(name)` to resolve `bl printf`; the executor reads `stub_at`
/// when a BL lands on a stub address.
#[derive(Debug, Default)]
pub struct HostTable {
    entries: Vec<Stub>,
}

impl HostTable {
    /// Every stub in `STUBS`, each at its slot.
    pub fn new() -> Self {
        HostTable { entries: STUBS.to_vec() }
    }

    /// Add a stub after the others, answering in x0 with no call card.
    /// Returns its synthetic entry address.
    pub fn register(&mut self, name: &'static str, func: HostFn) -> u64 {
        let idx = self.entries.len() as u64;
        assert!(idx < HOST_STUB_COUNT, "host stub table full");
        self.entries.push(x0(name, func));
        HOST_STUB_BASE + idx * HOST_STUB_STRIDE
    }

    /// Address of a named stub, if registered.
    pub fn lookup(&self, name: &str) -> Option<u64> {
        self.entries
            .iter()
            .position(|stub| stub.name == name)
            .map(|i| HOST_STUB_BASE + (i as u64) * HOST_STUB_STRIDE)
    }

    /// Whether an address falls inside the host-stub range.
    pub fn contains_address(&self, address: u64) -> bool {
        let end = HOST_STUB_BASE + (self.entries.len() as u64) * HOST_STUB_STRIDE;
        address >= HOST_STUB_BASE
            && address < end
            && (address - HOST_STUB_BASE).is_multiple_of(HOST_STUB_STRIDE)
    }

    /// The stub at `address`, or `None` when no entry lives there.
    pub fn stub_at(&self, address: u64) -> Option<Stub> {
        if !self.contains_address(address) {
            return None;
        }
        let idx = ((address - HOST_STUB_BASE) / HOST_STUB_STRIDE) as usize;
        self.entries.get(idx).copied()
    }

    /// Name of the stub at `address`, or `None` when no entry lives there.
    /// The stepping UI needs the reverse of `lookup`: a pc parked on a
    /// synthetic address has to be reported as "inside printf" rather than
    /// as an instruction the student wrote.
    pub fn name_for_address(&self, address: u64) -> Option<&str> {
        self.stub_at(address).map(|stub| stub.name)
    }

    /// Names of every registered stub, useful for the UI's register-alias
    /// resolver and for debugging.
    pub fn names(&self) -> impl Iterator<Item = &str> {
        self.entries.iter().map(|stub| stub.name)
    }
}

fn noop(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    Ok(HostOutcome::Continue)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::Host;

    #[test]
    fn default_table_contains_noop_at_base_address() {
        let t = HostTable::new();
        assert_eq!(t.lookup("__host_noop"), Some(HOST_STUB_BASE));
        assert_eq!(t.lookup("__main_return"), Some(MAIN_RETURN_ADDR));
    }

    #[test]
    fn register_assigns_sequential_addresses() {
        let mut t = HostTable::new();
        let a = t.register("alpha", noop);
        let b = t.register("beta", noop);
        let first = HOST_STUB_BASE + STUBS.len() as u64 * HOST_STUB_STRIDE;
        assert_eq!(a, first);
        assert_eq!(b, first + HOST_STUB_STRIDE);
    }

    #[test]
    fn contains_address_respects_stride() {
        let t = HostTable::new();
        assert!(t.contains_address(HOST_STUB_BASE));
        // One byte into a slot is not a valid entry point.
        assert!(!t.contains_address(HOST_STUB_BASE + 1));
        assert!(!t.contains_address(HOST_STUB_BASE + STUBS.len() as u64 * HOST_STUB_STRIDE));
    }

    #[test]
    fn a_registered_stub_runs_from_its_row() {
        let mut t = HostTable::new();
        fn set_x0(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
            ctx.regs.write_gpr(0, true, 123);
            Ok(HostOutcome::Continue)
        }
        let addr = t.register("set_x0", set_x0);
        let mut h = Host::new();
        let stub = t.stub_at(addr).expect("a registered address");
        let outcome = (stub.func)(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(h.regs.read_gpr(0, true), 123);
    }

    #[test]
    fn stub_at_returns_none_for_unregistered_address() {
        let t = HostTable::new();
        // Address past the end of the table.
        assert!(t.stub_at(HOST_STUB_BASE + HOST_STUB_STRIDE * 99).is_none());
        // Address in a completely different range.
        assert!(t.stub_at(0x0040_0000).is_none());
    }

    #[test]
    fn names_iterator_reports_all_registered_entries() {
        let mut t = HostTable::new();
        t.register("alpha", noop);
        let names: Vec<&str> = t.names().collect();
        assert_eq!(names.len(), STUBS.len() + 1);
        assert_eq!(names[..2], ["__host_noop", "printf"]);
        assert_eq!(names.last(), Some(&"alpha"));
    }
}
