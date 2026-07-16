//! Section-aware assembler front end. The pipeline runs in this order:
//!
//!   m4 expansion -> lexer -> parser -> encoder -> linker.
//!
//! Populated incrementally across phase A. The legacy single-pass assembler
//! in `crate::assembler` still handles every call for now; this module takes
//! over once the new pipeline reaches feature parity with it.

pub mod expr;
pub mod lexer;
pub mod linker;
pub mod lint;
pub mod m4;
pub mod parser;
pub mod pipeline;
pub mod sections;
