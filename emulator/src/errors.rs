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
                write!(
                    f,
                    "unknown instruction 0x{word:08x}: execution probably branched \
                     into data rather than code. Check the branch that got here, \
                     and the return address if this followed a ret"
                )
            }
            Self::MemoryFault { address, access } => {
                let kind = match access {
                    MemAccess::Read => "read",
                    MemAccess::Write => "write",
                };
                write!(
                    f,
                    "memory fault: the program tried to {kind} 0x{address:016x}, which \
                     no section covers. The base register is holding a value that is \
                     not an address, usually because a `mov` was written where \
                     `ldr xN, =label` was meant"
                )
            }
            Self::UnalignedAccess { address, required } => {
                write!(
                    f,
                    "unaligned access at 0x{address:016x}: this instruction needs an \
                     address that is a multiple of {required}. Check the offset added \
                     to the base register"
                )
            }
            Self::StackOverflow => write!(
                f,
                "stack overflow: sp has moved more than 8 MiB below the stack base. \
                 Check the recursion's base case first, then check that every prologue \
                 has a matching epilogue with the same size, and that sp was never \
                 loaded from a register that had not been set up"
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
                write!(
                    f,
                    "the arguments need {bytes} bytes, more than the 4 KiB the \
                     playground reserves for argv. Shorten the args box above the \
                     editor, or pass fewer arguments"
                )
            }
            Self::NullPointerAccess { address, access } => {
                let kind = match access {
                    MemAccess::Read => "read from",
                    MemAccess::Write => "write to",
                };
                write!(
                    f,
                    "stopped: tried to {kind} address 0x{address:x}, which is not part of \
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
                        "stopped: sp is 0x{sp:x} at this call, which is not a multiple of \
                         16. AAPCS64 requires sp on a 16-byte boundary at every bl, and on \
                         Linux the routine you called faults the first time it touches the \
                         stack (a bus error on the servers). Round the frame up: \
                         `sub sp, sp, 32` instead of `sub sp, sp, 24`, or the course idiom \
                         `alloc = -(16 + locals) & -16`"
                    )
                } else {
                    write!(
                        f,
                        "stopped: sp is 0x{sp:x}, which is not a multiple of 16. On Linux \
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
