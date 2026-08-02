use std::fmt;

/// How a faulting memory access was attempted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemAccess {
    Read,
    Write,
}

/// Every fallible operation in the emulator returns this.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EmuError {
    /// Instruction word does not match any known encoding.
    UnknownInstruction(u32),
    /// Read or write to an unmapped address.
    MemoryFault {
        address: u64,
        access: MemAccess,
    },
    /// Access requires natural alignment that the address does not satisfy.
    UnalignedAccess {
        address: u64,
        required: u8,
    },
    /// SP moved below the stack floor (`cpu::STACK_FLOOR`).
    StackOverflow,
    /// The assembler could not parse the source.
    AssemblyError {
        line: usize,
        message: String,
    },
    /// m4 preprocessing failed (unsupported construct, recursion loop, ...).
    /// `line` is the 1-based line in the original (pre-expansion) source.
    PreprocError {
        line: usize,
        message: String,
    },
    /// Lexer or parser found bad source. `line` is the original line.
    ParseError {
        line: usize,
        message: String,
    },
    /// Linker could not resolve a reference or back-patch an offset.
    /// `line` is the original source line when one is available.
    LinkError {
        line: usize,
        message: String,
    },
    /// Combined argv pointer-table + string pool would exceed the 4 KiB
    /// page reserved at `ARGV_BASE`.
    ArgvTooLarge { bytes: usize },
    /// A load or store landed in the first page (address < 4096), which
    /// Linux never maps: the base register holds a small number instead
    /// of an address. Memory auto-maps on write here, so without this
    /// the store would silently succeed and the program would run to a
    /// wrong answer that the course servers kill with SIGSEGV.
    NullPointerAccess {
        address: u64,
        access: MemAccess,
    },
    /// An SP-based load or store ran while SP was off the 16-byte
    /// boundary, or a libc call was made with SP misaligned. Linux sets
    /// SCTLR_EL1.SA0, so the course servers kill this with a bus error;
    /// `at_call` distinguishes the call-boundary wording.
    SpAlignmentFault {
        sp: u64,
        at_call: bool,
    },
    /// A runtime failure inside the hosted runtime (a libc stub or a
    /// syscall), already worded for the student. The editor line is
    /// resolved at the wasm boundary through the line map, so this
    /// variant carries no line of its own.
    RuntimeError { message: String },
}

impl fmt::Display for EmuError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownInstruction(word) => {
                write!(f, "unknown instruction: 0x{word:08x}")
            }
            Self::MemoryFault { address, access } => {
                let kind = match access {
                    MemAccess::Read => "read",
                    MemAccess::Write => "write",
                };
                write!(f, "memory fault: {kind} at 0x{address:016x}")
            }
            Self::UnalignedAccess { address, required } => {
                write!(
                    f,
                    "unaligned access at 0x{address:016x} (requires {required}-byte alignment)"
                )
            }
            Self::StackOverflow => write!(
                f,
                "stack overflow: sp has moved more than 1 MiB below the stack base -- usually recursion with no base case, a prologue that repeats without its epilogue, or sp loaded from a register that was never set up"
            ),
            Self::AssemblyError { line, message } => {
                write!(f, "assembly error at line {line}: {message}")
            }
            Self::PreprocError { line, message } => {
                write!(f, "preprocess error at line {line}: {message}")
            }
            Self::ParseError { line, message } => {
                write!(f, "parse error at line {line}: {message}")
            }
            Self::LinkError { line, message } => {
                write!(f, "link error at line {line}: {message}")
            }
            Self::ArgvTooLarge { bytes } => {
                write!(f, "argv layout would need {bytes} bytes, exceeds the 4096-byte argv page")
            }
            Self::NullPointerAccess { address, access } => {
                let kind = match access {
                    MemAccess::Read => "read from",
                    MemAccess::Write => "write to",
                };
                write!(
                    f,
                    "stopped -- tried to {kind} address 0x{address:x}, which is not part of \
                     any program section (the servers kill this with a segmentation fault). \
                     A base register is holding a small number instead of an address: check \
                     for a `mov` where you meant `ldr xN, =label`, or an m4 alias that \
                     reuses a register a pointer is already living in (`define(i_r, w19)` \
                     after `ldr x19, =arr` overwrites the pointer)"
                )
            }
            Self::SpAlignmentFault { sp, at_call } => {
                if *at_call {
                    write!(
                        f,
                        "stopped -- sp is 0x{sp:x} at this call, which is not a multiple of \
                         16. AAPCS64 requires sp on a 16-byte boundary at every bl, and on \
                         Linux the routine you called faults the first time it touches the \
                         stack (a bus error on the servers). Round the frame up: \
                         `sub sp, sp, 32` instead of `sub sp, sp, 24`, or the course idiom \
                         `alloc = -(16 + locals) & -16`"
                    )
                } else {
                    write!(
                        f,
                        "stopped -- sp is 0x{sp:x}, which is not a multiple of 16. On Linux \
                         every load or store through sp faults when sp is off the 16-byte \
                         boundary (a bus error on the servers); the line that broke it is \
                         above this one. Round the frame up: `sub sp, sp, 32` instead of \
                         `sub sp, sp, 24`, or the course idiom \
                         `alloc = -(16 + locals) & -16`"
                    )
                }
            }
            Self::RuntimeError { message } => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for EmuError {}
