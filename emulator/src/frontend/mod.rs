//! Section-aware assembler front end. The pipeline runs in this order:
//!
//!   m4 expansion -> lexer -> parser -> encoder -> linker.
//!
//! This front end handles hosted CPSC 355 source (sections, libc, syscalls).
//! The legacy single-pass `crate::assembler` still handles bare-metal source;
//! `detect_hosted_mode` in lib.rs routes each program to the right path, and
//! the linker reuses `assembler::encode_line_absolute` for ordinary instructions.

pub mod expr;
pub mod lexer;
pub mod linker;
pub mod lint;
pub mod m4;
pub mod parser;
pub mod pipeline;
pub mod sections;
