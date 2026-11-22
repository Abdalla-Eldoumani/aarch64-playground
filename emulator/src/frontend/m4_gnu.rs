//! GNU m4 1.4.19's own order, for the programs the line-at-a-time pass in
//! `m4` cannot read: m4 runs over the source with its comments still in
//! it, as on the course servers, and `m4::expand` strips the comments from
//! what it writes. `m4::expand` decides which programs come here.
//!
//! For now the scanner writes its input unchanged.

use crate::errors::EmuError;

/// What GNU m4 wrote for a program.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Scan {
    /// GNU m4's output byte for byte, comments still in it.
    pub text: String,
    /// For each output line, the source line `m4 -s` gives it: the line of
    /// the token that starts it (an expansion's tokens take the line of
    /// the call), or the line above plus one inside a token that spans lines.
    pub lines: Vec<usize>,
    /// Every `define` and `undefine` in the order m4 ran them: (source
    /// line, name, body), with `None` for an undefine.
    pub events: Vec<(usize, String, Option<String>)>,
}

/// Run GNU m4's order over a source file. Errors carry 1-based source lines.
pub fn scan(source: &str) -> Result<Scan, EmuError> {
    Ok(Scan { text: source.to_string(), lines: (1..=source.lines().count()).collect(), events: Vec::new() })
}
