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
    /// Register index out of range (> 31).
    InvalidRegister(u8),
    /// Access requires natural alignment that the address does not satisfy.
    UnalignedAccess {
        address: u64,
        required: u8,
    },
    /// SP moved below the stack limit.
    StackOverflow,
    /// SVC or explicit halt executed.
    ExecutionHalted,
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
            Self::InvalidRegister(idx) => {
                write!(f, "invalid register index: {idx}")
            }
            Self::UnalignedAccess { address, required } => {
                write!(
                    f,
                    "unaligned access at 0x{address:016x} (requires {required}-byte alignment)"
                )
            }
            Self::StackOverflow => write!(f, "stack overflow"),
            Self::ExecutionHalted => write!(f, "execution halted"),
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
        }
    }
}

impl std::error::Error for EmuError {}
