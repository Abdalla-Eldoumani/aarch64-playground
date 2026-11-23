//! Pre-assembly structural lint. Runs BEFORE assembling and produces
//! warnings (never hard errors) with a line number and a one-line remedy:
//!
//!   * Frame balance per function: an epilogue that pops bytes the
//!     prologue never pushed, a frame still held at `ret`, and a
//!     prologue pair offset that is not 16-byte aligned. These are the
//!     shapes behind silent stack corruption. Leaf functions that never
//!     touch sp are naturally exempt (they produce no stack deltas).
//!   * m4 macro hygiene: the places GNU m4's text-level rules bite.
//!     m4 substitutes whole-name tokens ANYWHERE (inside `"` strings
//!     and `'` char literals included), treats `NAME(` as a macro call
//!     that consumes the parenthesized text, and treats `#` as a
//!     comment-start after which nothing expands. The playground's m4
//!     follows the same rules (verified against the course toolchain),
//!     so each of those spots gets a loud warning naming what the
//!     rewrite does, because it is almost never what the author meant.
//!
//! Everything here is heuristic and fails open: an offset that cannot be
//! folded to a constant, or any write to sp the tracker does not model,
//! simply disables analysis for that function. A function without exactly
//! one `ret`, or with a second path the walk cannot follow, keeps only the
//! check that each push is a multiple of 16. Prefer a missed warning to a
//! false one.

use std::collections::{HashMap, HashSet};

use super::expr::evaluate;
use super::lexer::lex;
use super::m4;
use super::pipeline::is_branch_mnemonic;

/// One pre-assembly warning: advisory, line-anchored, with the remedy in
/// the message. Never blocks assembling.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LintWarning {
    pub line: usize,
    pub message: String,
}

/// Lint a source file. Returns an empty list when the m4 pass fails:
/// the assemble that follows will surface that error properly.
pub fn lint(source: &str) -> Vec<LintWarning> {
    let Ok(expanded) = m4::expand(source) else {
        return Vec::new();
    };
    let mut warnings = Vec::new();
    frame_balance(&expanded, &mut warnings);
    // The frame walk counts m4's output lines, which a macro body spanning
    // lines pushes past the editor's.
    for w in &mut warnings {
        w.line = expanded.line_map.get(w.line.wrapping_sub(1)).copied().unwrap_or(w.line);
    }
    macro_hygiene(source, &expanded, &mut warnings);
    warnings.sort_by_key(|w| w.line);
    warnings
}

// ---------------------------------------------------------------------------
// m4 macro hygiene
// ---------------------------------------------------------------------------

/// Registers and mnemonics a macro name must not shadow. A name missing
/// from this list costs one warning, never a wrong one.
fn is_reserved_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    // `pc` is a deliberate lint-only extra on top of the shared alias table:
    // the lint warns about macro names shadowing things students think of as
    // registers, and `pc` is one even though no encoder accepts it.
    if lower == "pc" || crate::registers::reg_alias(&lower).is_some() {
        return true;
    }
    if let Some(rest) = lower.strip_prefix('x').or_else(|| lower.strip_prefix('w')) {
        if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
            if let Ok(n) = rest.parse::<u32>() {
                return n <= 30;
            }
        }
    }
    // The SIMD&FP file: v0-v31 and the b/h/s/d/q scalar views of it.
    for prefix in ['v', 'b', 'h', 's', 'd', 'q'] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                if let Ok(n) = rest.parse::<u32>() {
                    return n <= 31;
                }
            }
        }
    }
    matches!(
        lower.as_str(),
        "mov" | "add" | "sub" | "mul" | "udiv" | "sdiv" | "and" | "orr" | "eor"
            | "ldr" | "str" | "ldp" | "stp" | "ldrb" | "strb" | "ldrh" | "strh"
            | "cmp" | "cmn" | "tst" | "b" | "bl" | "br" | "blr" | "ret" | "svc"
            | "cbz" | "cbnz" | "tbz" | "tbnz" | "adr" | "adrp" | "movz" | "movk"
            | "movn" | "lsl" | "lsr" | "asr" | "neg" | "mvn" | "madd" | "msub"
            | "sxtb" | "sxth" | "sxtw" | "uxtb" | "uxth" | "csel" | "cset"
    )
}

/// Caps on the macro warnings one lint keeps: real programs stay far below
/// them, but every use of a macro can get its own warning quoting the body.
const MAX_HYGIENE_WARNINGS: usize = 1000;
const MAX_HYGIENE_BYTES: usize = 256 * 1024;

/// The macro warnings kept under the caps, and how many were left out.
struct Hygiene<'a> {
    warnings: &'a mut Vec<LintWarning>,
    kept: usize,
    bytes: usize,
    left_out: usize,
    /// Lowest line among the warnings left out, where the closing line goes.
    from_line: usize,
}

impl Hygiene<'_> {
    /// Past either cap a warning is only counted, so its message, which
    /// can quote a long body, is never built.
    fn push(&mut self, line: usize, message: std::fmt::Arguments<'_>) {
        if self.left_out == 0 && self.kept < MAX_HYGIENE_WARNINGS {
            let message = std::fmt::format(message);
            if self.bytes + message.len() <= MAX_HYGIENE_BYTES {
                self.kept += 1;
                self.bytes += message.len();
                self.warnings.push(LintWarning { line, message });
                return;
            }
        }
        // Define sites are pushed before the source walk, so not in line order.
        if self.left_out == 0 || line < self.from_line {
            self.from_line = line;
        }
        self.left_out += 1;
    }
}

fn macro_hygiene(source: &str, expanded: &m4::Expanded, warnings: &mut Vec<LintWarning>) {
    if expanded.defines.is_empty() {
        return;
    }
    let mut hygiene = Hygiene { warnings, kept: 0, bytes: 0, left_out: 0, from_line: 0 };
    // One warning per define SITE, quoting that site's own body. The
    // collapsed `defines` map holds only the last body a redefined macro
    // ever had, so a windowed alias would be reported against the wrong
    // register.
    for (line, name, body) in &expanded.define_events {
        let Some(body) = body else { continue };
        // The course's own canonical aliases: `define(fp, x29)` and
        // `define(lr, x30)` restate what GAS already predefines, so they
        // change nothing anywhere. Never warn on those.
        let canonical = (name == "fp" && body.trim().eq_ignore_ascii_case("x29"))
            || (name == "lr" && body.trim().eq_ignore_ascii_case("x30"));
        if !canonical && is_reserved_name(name) {
            hygiene.push(
                *line,
                format_args!(
                    "the macro name `{name}` is also a register or instruction \
                     name: every later use of `{name}` becomes `{body}`; \
                     rename the macro (for example `{name}_r`)"
                ),
            );
        }
    }
    // Walk the ORIGINAL source so the string/char literals are the ones
    // the student wrote (expansion leaves them alone by design).
    for (idx, raw) in source.lines().enumerate() {
        let line = idx + 1;
        scan_line_for_hygiene(raw, line, expanded, &mut hygiene);
    }
    let n = hygiene.left_out;
    if n > 0 {
        hygiene.warnings.push(LintWarning {
            line: hygiene.from_line,
            message: format!(
                "{n} more macro warning{} not shown, from this line on: the lint shows \
                 at most {MAX_HYGIENE_WARNINGS} of them, or {} KiB of text. The usual \
                 cause is a macro whose name appears many times in strings or after a \
                 `#`, or whose body is very long: rename the macro, or make it an \
                 equate (`name = value`)",
                if n == 1 { "" } else { "s" },
                MAX_HYGIENE_BYTES / 1024
            ),
        });
    }
}

fn scan_line_for_hygiene(
    raw: &str,
    line: usize,
    expanded: &m4::Expanded,
    hygiene: &mut Hygiene<'_>,
) {
    // Ignore the define lines themselves and comment-only content.
    let trimmed = raw.trim_start();
    if trimmed.starts_with("define") || trimmed.starts_with("//") || trimmed.starts_with(';') {
        return;
    }
    let code = strip_line_comment(raw);
    let bytes = code.as_bytes();
    let mut i = 0;
    let mut in_string = false;
    let mut in_char = false;
    let mut after_hash = false;
    while i < bytes.len() {
        let b = bytes[i];
        match b {
            b'\\' if (in_string || in_char) && i + 1 < bytes.len() => {
                // Skip only escaped delimiters and backslashes, which
                // would break the quote tracking. An escaped LETTER
                // stays in the scan: m4 knows nothing of GAS escapes,
                // so the `n` in `"\n"` is an ordinary identifier to it
                // and must be eligible for the warning below.
                if matches!(bytes[i + 1], b'"' | b'\'' | b'\\') {
                    i += 2;
                    continue;
                }
                i += 1;
                continue;
            }
            b'"' if !in_char => in_string = !in_string,
            b'\'' if !in_string => in_char = !in_char,
            b'#' if !in_string && !in_char => after_hash = true,
            _ => {}
        }
        if b.is_ascii_alphabetic() || b == b'_' {
            let start = i;
            while i < bytes.len()
                && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_')
            {
                i += 1;
            }
            let ident = &code[start..i];
            // The body in effect HERE, not the last one in the file: a
            // per-function alias rebound further down must not put a
            // register the student never wrote into this warning.
            if let Some(body) = expanded.define_body_at(ident, line) {
                if in_string || in_char {
                    hygiene.push(
                        line,
                        format_args!(
                            "`{ident}` is defined as a macro ({body}) and also \
                             appears in this {}. m4 replaces it here exactly \
                             as the university servers do, so the program \
                             prints `{body}` instead; rename the macro (for \
                             example `{ident}_r`)",
                            if in_string { "string" } else { "character literal" }
                        ),
                    );
                } else if after_hash {
                    hygiene.push(
                        line,
                        format_args!(
                            "m4 treats `#` as a comment start, here and on the \
                             university servers, so `{ident}` will NOT expand \
                             and the assembler will reject the line. Use an \
                             equate (`{ident} = {body}`) instead of a define, \
                             or drop the `#`"
                        ),
                    );
                } else if i < bytes.len() && bytes[i] == b'(' && !body.contains('$') {
                    // A body that reads `$1` is meant to be called this way.
                    hygiene.push(
                        line,
                        format_args!(
                            "`{ident}(` reads as an m4 macro CALL on the \
                             university servers, which consumes the text in the \
                             parentheses. Put a space before `(`, or rename the \
                             macro"
                        ),
                    );
                }
            }
            continue;
        }
        i += 1;
    }
}

/// Strip `//` and `;` comments outside literals so hygiene never fires on
/// commented-out code.
fn strip_line_comment(line: &str) -> &str {
    let bytes = line.as_bytes();
    let mut in_string = false;
    let mut in_char = false;
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        match b {
            b'\\' if (in_string || in_char) && i + 1 < bytes.len() => {
                i += 2;
                continue;
            }
            b'"' if !in_char => in_string = !in_string,
            b'\'' if !in_string => in_char = !in_char,
            b'/' if !in_string && !in_char && i + 1 < bytes.len() && bytes[i + 1] == b'/' => {
                return &line[..i];
            }
            b';' if !in_string && !in_char => return &line[..i],
            _ => {}
        }
        i += 1;
    }
    line
}

// ---------------------------------------------------------------------------
// frame balance
// ---------------------------------------------------------------------------

pub(crate) struct FunctionSegment {
    pub(crate) name: String,
    /// (line, instruction text) pairs, labels stripped.
    lines: Vec<(usize, String)>,
}

fn frame_balance(expanded: &m4::Expanded, warnings: &mut Vec<LintWarning>) {
    let symbols = fold_assignments(expanded);
    let segments = split_functions(&expanded.text);
    for segment in &segments {
        analyze_segment(segment, &symbols, warnings);
    }
}

/// Fold `name = expr` assignments to constants where possible. Iterates so
/// chains resolve; anything symbolic (label-relative) stays absent and the
/// functions using it are skipped.
fn fold_assignments(expanded: &m4::Expanded) -> HashMap<String, i64> {
    let mut out: HashMap<String, i64> = HashMap::new();
    // Eight rounds: the lint fails open, so an unresolved chain past this
    // just skips the function.
    for _ in 0..8 {
        let mut changed = false;
        for (name, body) in &expanded.assignments {
            if out.contains_key(name) {
                continue;
            }
            let Ok(tokens) = lex(body, 1) else { continue };
            if let Ok(v) = evaluate(&tokens, &|n| out.get(n).copied(), 0, 1) {
                out.insert(name.clone(), v);
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }
    out
}

/// Split the expanded `.text` into function segments. A function starts at
/// a label that is `.global`, a `bl` target, or the first label seen;
/// other labels (loop targets) stay inside the current segment.
pub(crate) fn split_functions(text: &str) -> Vec<FunctionSegment> {
    let mut globals: HashSet<String> = HashSet::new();
    let mut bl_targets: HashSet<String> = HashSet::new();
    for line in text.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix(".global").or_else(|| t.strip_prefix(".globl")) {
            globals.insert(rest.trim().to_string());
        }
        // A call can share its line with a label: `again: bl helper`.
        let t = t.rsplit_once(':').map_or(t, |(_, call)| call.trim());
        let lower = t.to_ascii_lowercase();
        if let Some(rest) = lower.strip_prefix("bl ").or_else(|| lower.strip_prefix("bl\t")) {
            bl_targets.insert(rest.trim().to_string());
        }
    }

    let mut segments: Vec<FunctionSegment> = Vec::new();
    let mut in_text = true; // parser default section is .text
    let mut seen_function = false;
    for (idx, raw) in text.lines().enumerate() {
        let line_no = idx + 1;
        let mut rest = raw.trim();
        if rest.is_empty() {
            continue;
        }
        if rest.starts_with('.') {
            let lower = rest.to_ascii_lowercase();
            // Its own prefix chain, not the parser's DIRECTIVES table:
            // `.section` always leaves .text here, even `.section .text`,
            // and the function segments this lint reports depend on that.
            if lower.starts_with(".text") {
                in_text = true;
            } else if lower.starts_with(".data")
                || lower.starts_with(".bss")
                || lower.starts_with(".rodata")
                || lower.starts_with(".section")
            {
                in_text = false;
            }
            continue;
        }
        if !in_text {
            continue;
        }
        // Peel leading labels; a function-start label opens a new segment.
        while let Some(colon) = rest.find(':') {
            let candidate = rest[..colon].trim();
            if candidate.is_empty()
                || !candidate
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.')
            {
                break;
            }
            let is_function = globals.contains(candidate)
                || bl_targets.contains(&candidate.to_ascii_lowercase())
                || !seen_function;
            if is_function {
                segments.push(FunctionSegment {
                    name: candidate.to_string(),
                    lines: Vec::new(),
                });
                seen_function = true;
            }
            rest = rest[colon + 1..].trim();
        }
        if rest.is_empty() {
            continue;
        }
        if let Some(segment) = segments.last_mut() {
            segment.lines.push((line_no, rest.to_ascii_lowercase()));
        }
    }
    segments
}

/// An instruction's text with runs of blanks as one space and none just
/// inside its brackets or before a comma, the way the shapes below are
/// written.
fn compact(text: &str) -> String {
    text.split_whitespace().fold(String::new(), |mut out, word| {
        if !out.is_empty() && !out.ends_with('[') && !word.starts_with([']', ',']) {
            out.push(' ');
        }
        out.push_str(word);
        out
    })
}

/// Evaluate an offset operand (after `#` stripping) against the folded
/// assignment constants. None means "cannot fold" and disables analysis.
fn fold_offset(text: &str, symbols: &HashMap<String, i64>) -> Option<i64> {
    let body = text.trim().trim_start_matches('#').trim();
    let tokens = lex(body, 1).ok()?;
    evaluate(&tokens, &|n| symbols.get(n).copied(), 0, 1).ok()
}

fn analyze_segment(
    segment: &FunctionSegment,
    symbols: &HashMap<String, i64>,
    warnings: &mut Vec<LintWarning>,
) {
    // The walk reads top to bottom, so the balance warnings need one exit:
    // a function with other than one `ret` gets none. A push off 16 is
    // wrong on every path, so it is checked everywhere, `_start` included.
    let ret_count = segment
        .lines
        .iter()
        .filter(|(_, text)| text == "ret" || text.starts_with("ret "))
        .count();
    let mut balance = ret_count == 1;

    let name = &segment.name;
    let mut delta: i64 = 0;
    // The depths conditional branches left at. A `b` leaving at a depth
    // other than all of them means the lines after it start a path at a
    // depth the walk cannot see (space given back once on each of two
    // exits), so the balance warnings stop there.
    let mut forks = Vec::new();
    for (line, text) in &segment.lines {
        let line = *line;
        match text.split_whitespace().next().unwrap_or("") {
            "b" => balance &= forks.iter().all(|&depth| depth == delta),
            "bl" => {}
            op if is_branch_mnemonic(op) => forks.push(delta),
            _ => {}
        }
        if text == "ret" || text.starts_with("ret ") {
            if !balance {
                continue;
            }
            if delta < 0 {
                warnings.push(LintWarning {
                    line,
                    message: format!(
                        "`{name}` still holds {} bytes of stack at this ret. \
                         Restore it first, for example `ldp x29, x30, [sp], {}` \
                         (or `add sp, sp, {}`)",
                        -delta, -delta, -delta
                    ),
                });
            }
            return;
        }
        let Some(effect) = stack_effect(text, symbols) else {
            if writes_sp_unmodeled(text) {
                // An sp write the tracker does not model (mov sp, x29,
                // register-amount adjust, ...): stop analyzing rather
                // than risk a wrong warning.
                return;
            }
            continue;
        };
        if let StackEffect::Push { bytes, line_offset_misaligned } = effect {
            if line_offset_misaligned {
                warnings.push(LintWarning {
                    line,
                    message: format!(
                        "this pushes {bytes} bytes, which is not a multiple of \
                         16. sp must stay 16-byte aligned, so round the frame \
                         up (`stp x29, x30, [sp, -16]!`, `sub sp, sp, 32`, ...)"
                    ),
                });
                return;
            }
            delta -= bytes;
        }
        if let StackEffect::Pop { bytes } = effect {
            delta += bytes;
            if balance && delta > 0 {
                warnings.push(LintWarning {
                    line,
                    message: format!(
                        "this pops {bytes} bytes that `{name}` never pushed. \
                         Add `stp x29, x30, [sp, -16]!` at the top of `{name}`, \
                         or remove the `ldp`"
                    ),
                });
                return;
            }
        }
    }
}

enum StackEffect {
    Push { bytes: i64, line_offset_misaligned: bool },
    Pop { bytes: i64 },
}

/// Classify one instruction's effect on sp, or None when it has none (or
/// cannot be folded, and the caller then checks for unmodeled sp writes).
fn stack_effect(text: &str, symbols: &HashMap<String, i64>) -> Option<StackEffect> {
    let compact = compact(text);
    // Pre-indexed push: `stp a, b, [sp, N]!` or `str a, [sp, N]!`.
    if (compact.starts_with("stp ") || compact.starts_with("str "))
        && compact.contains("[sp,")
        && compact.ends_with("]!")
    {
        let open = compact.find("[sp,")?;
        let inner = &compact[open + 4..compact.len() - 2];
        let n = fold_offset(inner, symbols)?;
        if n < 0 {
            return Some(StackEffect::Push {
                bytes: -n,
                line_offset_misaligned: (-n) % 16 != 0,
            });
        }
        return None;
    }
    // Post-indexed pop: `ldp a, b, [sp], N` or `ldr a, [sp], N`.
    if (compact.starts_with("ldp ") || compact.starts_with("ldr ")) && compact.contains("[sp],") {
        let after = compact.rfind("[sp],")? + 5;
        let n = fold_offset(&compact[after..], symbols)?;
        if n > 0 {
            return Some(StackEffect::Pop { bytes: n });
        }
        return None;
    }
    // Explicit adjustment: `sub sp, sp, N` / `add sp, sp, N`. A frame
    // that is not a multiple of 16 faults at the next SP-based access on
    // Linux (SA0), so the advisory fires here, at assemble time, before
    // the runtime wall does.
    if let Some(rest) = compact.strip_prefix("sub sp, sp,") {
        let n = fold_offset(rest, symbols)?;
        return Some(StackEffect::Push { bytes: n, line_offset_misaligned: n % 16 != 0 });
    }
    if let Some(rest) = compact.strip_prefix("add sp, sp,") {
        let n = fold_offset(rest, symbols)?;
        return Some(StackEffect::Pop { bytes: n });
    }
    None
}

/// Does this instruction write sp in a way `stack_effect` does not model?
fn writes_sp_unmodeled(text: &str) -> bool {
    let compact = compact(text);
    if compact.starts_with("mov sp,") {
        return true;
    }
    // add/sub sp with a register amount, or any other sp destination.
    if (compact.starts_with("add sp,") || compact.starts_with("sub sp,"))
        && !compact.starts_with("add sp, sp,")
        && !compact.starts_with("sub sp, sp,")
    {
        return true;
    }
    if compact.starts_with("add sp, sp,") || compact.starts_with("sub sp, sp,") {
        // Folding failed in stack_effect (register amount / symbolic).
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lint_lines(source: &str) -> Vec<(usize, String)> {
        lint(source)
            .into_iter()
            .map(|w| (w.line, w.message))
            .collect()
    }

    #[test]
    fn a_clean_prologue_epilogue_pair_produces_no_warnings() {
        let src = ".text\n\
                   .global main\n\
                   main:\n\
                   stp x29, x30, [sp, -16]!\n\
                   mov x29, sp\n\
                   mov x0, 0\n\
                   ldp x29, x30, [sp], 16\n\
                   ret\n";
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn an_epilogue_with_no_prologue_warns_at_the_ldp() {
        // An epilogue with no prologue: the balance tracker must fire at
        // the `ldp`.
        let src = ".text\n\
                   .global main\n\
                   main:\n\
                   mov x0, 0\n\
                   ldp x29, x30, [sp], 16\n\
                   ret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 5);
        assert!(w[0].1.contains("never pushed"), "{}", w[0].1);
        assert!(w[0].1.contains("stp x29, x30"), "{}", w[0].1);
    }

    #[test]
    fn a_leaked_frame_warns_at_the_ret() {
        let src = ".text\n\
                   .global main\n\
                   main:\n\
                   stp x29, x30, [sp, -16]!\n\
                   mov x29, sp\n\
                   mov x0, 0\n\
                   ret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 7);
        assert!(w[0].1.contains("16 bytes"), "{}", w[0].1);
    }

    #[test]
    fn a_frame_warning_below_a_multi_line_macro_lands_on_its_editor_line() {
        // The macro's second line pushes every output line below it down
        // by one; the warning still marks the `ldp` the student wrote.
        let src = "define(two, `mov x0, 1\n  mov x1, 2')\n.text\nmain:\ntwo\nldp x29, x30, [sp], 16\nret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 6, "{w:?}");
    }

    #[test]
    fn an_argument_macro_is_meant_to_be_called_and_an_alias_is_not() {
        // A body that reads `$1` wants its arguments; a register alias
        // right before `(` still loses the text in the parentheses.
        let src = "define(sq, `mul $1, $1, $1')\ndefine(t_r, x19)\n.text\nmain:\nsq(x0)\nmov t_r(1), 2\nret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 6);
        assert!(w[0].1.contains("`t_r(`"), "{}", w[0].1);
    }

    #[test]
    fn a_misaligned_prologue_offset_warns() {
        let src = ".text\nmain:\nstp x29, x30, [sp, -24]!\nldp x29, x30, [sp], 24\nret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert!(w[0].1.contains("multiple of 16"), "{}", w[0].1);
    }

    #[test]
    fn equate_backed_frames_fold_and_balance() {
        let src = "alloc = -(16 + 16) & -16\n\
                   dealloc = -alloc\n\
                   .text\n\
                   main:\n\
                   stp x29, x30, [sp, alloc]!\n\
                   mov x29, sp\n\
                   ldp x29, x30, [sp], dealloc\n\
                   ret\n";
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn leaf_functions_are_exempt() {
        let src = ".text\n.global main\nmain:\nbl helper\nret\nhelper:\nmov x0, 1\nret\n";
        // main has no frame at all (a slip, but not THIS lint's slip) and
        // helper is a leaf; neither may warn.
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn multi_ret_functions_get_no_balance_warning() {
        let src = ".text\nmain:\nstp x29, x30, [sp, -16]!\ncbz x0, out\nldp x29, x30, [sp], 16\nret\nout:\nldp x29, x30, [sp], 16\nret\n";
        // Two epilogues, two rets: flow-insensitive tracking would lie.
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn unfoldable_or_unmodeled_sp_writes_disable_the_function() {
        let src = ".text\nmain:\nsub sp, sp, x1\nret\n";
        assert_eq!(lint(src), Vec::new());
        let src = ".text\nmain:\nstp x29, x30, [sp, -16]!\nmov sp, x29\nret\n";
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn per_function_analysis_is_independent() {
        let src = ".text\n\
                   .global main\n\
                   main:\n\
                   stp x29, x30, [sp, -16]!\n\
                   bl helper\n\
                   ldp x29, x30, [sp], 16\n\
                   ret\n\
                   helper:\n\
                   ldp x29, x30, [sp], 16\n\
                   ret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 9);
        assert!(w[0].1.contains("helper"), "{}", w[0].1);
    }

    #[test]
    fn a_call_on_a_labelled_line_still_starts_a_function() {
        // `again: bl helper` is the only call, so helper is a function only
        // if the scan reads past the label; its 24-byte push then warns.
        let src = ".text\n\
                   .global main\n\
                   main:\n\
                   stp x29, x30, [sp, -16]!\n\
                   again: bl helper\n\
                   ldp x29, x30, [sp], 16\n\
                   ret\n\
                   helper:\n\
                   stp x29, x30, [sp, -24]!\n\
                   ldp x29, x30, [sp], 24\n\
                   ret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 9);
        assert!(w[0].1.contains("pushes 24 bytes"), "{}", w[0].1);
    }

    #[test]
    fn space_freed_once_on_each_of_two_paths_is_not_freed_twice() {
        // Each path out of the `cbz` gives back the 16 bytes the `sub`
        // took, once; read top to bottom, the two `add`s look like two.
        let src = ".text\n\
                   .global main\n\
                   main:\n\
                   stp x29, x30, [sp, -32]!\n\
                   mov x29, sp\n\
                   sub sp, sp, 16\n\
                   cbz x0, none\n\
                   add sp, sp, 16\n\
                   b done\n\
                   none:\n\
                   add sp, sp, 16\n\
                   done:\n\
                   ldp x29, x30, [sp], 32\n\
                   ret\n";
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn spaces_inside_the_brackets_change_no_push_or_pop() {
        // GNU as reads `[ sp, -16 ]!` as `[sp, -16]!` and `[ sp ], 16` as
        // `[sp], 16`.
        let frame = |push: &str, pop: &str| {
            format!(".text\n.global main\nmain:\nstp x29, x30, {push}\nmov x29, sp\nldp x29, x30, {pop}\nret\n")
        };
        assert_eq!(lint(&frame("[ sp, -16 ]!", "[sp], 16")), Vec::new());
        assert_eq!(lint(&frame("[sp, -16]!", "[ sp ], 16")), Vec::new());
        let w = lint_lines(&frame("[ sp, -40 ]!", "[sp], 40"));
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 4);
        assert!(w[0].1.contains("pushes 40 bytes"), "{}", w[0].1);
    }

    #[test]
    fn a_push_off_16_warns_in_a_start_that_never_returns() {
        // `_start` ends with the exit system call, so it has no `ret` for the
        // balance walk to end at; a 24-byte push is off 16 on every path.
        let src = "_start:\n\
                   stp x29, x30, [sp, -24]!\n\
                   mov x29, sp\n\
                   ldp x29, x30, [sp], 24\n\
                   mov x8, 93\n\
                   svc 0\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 2);
        assert!(w[0].1.contains("pushes 24 bytes"), "{}", w[0].1);
    }

    #[test]
    fn space_given_back_twice_on_one_path_still_warns() {
        // No branch between them: the second `add` gives back what nothing
        // took, the double deallocation the lint is for.
        let src = ".text\n.global main\nmain:\nsub sp, sp, 16\nadd sp, sp, 32\nret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 5);
        assert!(w[0].1.contains("never pushed"), "{}", w[0].1);
    }

    #[test]
    fn a_retry_loop_that_gives_its_space_back_on_both_exits_is_balanced() {
        // dsav's read_int: the loop takes 16 bytes for scanf, the success path
        // gives them back and jumps to the end, the failure path gives them
        // back and either loops or falls through to the end.
        let src = ".text\n.global read_int\nread_int:\n\
                   stp x29, x30, [sp, -32]!\nmov x29, sp\nstr x19, [sp, 16]\n\
                   retry:\nsub sp, sp, 16\nmov x1, sp\nbl scanf\ncmp w0, 1\nb.ne no_value\n\
                   ldr w19, [sp]\nadd sp, sp, 16\nmov w0, w19\nb done\n\
                   no_value:\nadd sp, sp, 16\ncmp w0, 0\nb.lt eof\nbl complain\nb retry\n\
                   eof:\nmov w0, 0\n\
                   done:\nldr x19, [sp, 16]\nldp x29, x30, [sp], 32\nret\n";
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn a_push_off_16_warns_whatever_way_the_function_ends() {
        // A tail call, two `ret`s, and a call that never returns: the
        // balance walk reads none of them, the push check reads all three.
        let ends = ["ldp x29, x30, [sp], 24\nb helper", "cbz x0, early\nldp x29, x30, [sp], 24\nret\nearly:\nldp x29, x30, [sp], 24\nret", "bl exit"];
        for end in ends {
            let src = format!(".text\n.global main\nmain:\nstp x29, x30, [sp, -24]!\nmov x29, sp\n{end}\n.global helper\nhelper:\nret\n");
            let w = lint_lines(&src);
            assert_eq!(w.len(), 1, "{end}: {w:?}");
            assert_eq!(w[0].0, 4, "{end}");
            assert!(w[0].1.contains("pushes 24 bytes"), "{end}: {}", w[0].1);
            // The same shapes with a 16-byte push are quiet.
            assert_eq!(lint(&src.replace("24", "16")), Vec::new(), "{end}");
        }
    }

    #[test]
    fn seventeen_push_and_pop_spellings_read_as_the_crate_encodes_them() {
        // Seventeen spellings GNU as 2.42 takes for these operands (blanks,
        // tabs, `#`, hex, upper case, a blank before a comma): the lint's
        // reading must be the sp change of the word the crate assembles from
        // each. Not every spelling: `[sp, -16] !`, a blank before the `!`,
        // still reads as no push.
        let spellings = [
            "stp x29, x30, [sp, -16]!",
            "stp x29, x30, [ sp, -16 ]!",
            "stp\tx29,\tx30,\t[sp,\t-16]!",
            "stp x29, x30, [sp, #-16]!",
            "stp x29, x30, [sp, #-0x10]!",
            "STP X29, X30, [SP, #-16]!",
            "stp x29, x30, [sp , -16]!",
            "stp x29, x30, [sp,-16]!",
            "ldp x29, x30, [sp], 16",
            "ldp x29, x30, [ sp ], 16",
            "ldp x29, x30, [sp], #0x10",
            "LDP X29, X30, [SP], #16",
            "ldp x29, x30, [sp] , 16",
            "sub sp, sp, 32",
            "sub sp, sp, #0x20",
            "SUB SP, SP, #32",
            "add\tsp,\tsp,\t32",
        ];
        for s in spellings {
            let source = format!(".text\n.global main\nmain:\n{s}\nret\n");
            let image = crate::frontend::pipeline::assemble_hosted(&source, &crate::cpu::Cpu::new().host).expect(s);
            let at = image.writes.iter().find(|(base, _)| *base == image.text_base).expect(s);
            let word = u32::from_le_bytes(at.1[..4].try_into().unwrap());
            let encoded = match crate::decoder::decode(word).expect(s) {
                crate::decoder::Instruction::LdStPair { imm7, .. } => i64::from(imm7),
                crate::decoder::Instruction::DpImm { op, imm, shift, .. } => {
                    let n = i64::from(imm) << shift;
                    if op == crate::decoder::DpOp::Sub { -n } else { n }
                }
                other => panic!("{s}: {other:?}"),
            };
            let read = match stack_effect(&s.to_ascii_lowercase(), &HashMap::new()) {
                Some(StackEffect::Push { bytes, .. }) => -bytes,
                Some(StackEffect::Pop { bytes }) => bytes,
                None => 0,
            };
            assert_eq!(read, encoded, "{s}");
        }
    }

    #[test]
    fn space_freed_on_two_paths_with_a_test_between_is_not_freed_twice() {
        // The first path tests again after giving its space back and before
        // its `b`, so the last conditional branch left at the `b`'s depth;
        // an earlier one left 16 bytes deeper.
        let src = ".text
.global main
main:
                   stp x29, x30, [sp, -32]!
mov x29, sp
sub sp, sp, 16
cmp w0, 1
b.eq none
                   add sp, sp, 16
mov w1, 2
cmp w0, 3
b.ne done
mov w1, 3
b done
                   none:
add sp, sp, 16
mov w1, 1
                   done:
mov w0, 0
ldp x29, x30, [sp], 32
ret
";
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn a_loop_and_an_if_else_keep_their_balance_warnings() {
        // Every branch here leaves at the frame's own depth, so the walk still
        // follows one path: a missing epilogue and a double deallocation are
        // both found.
        let body = "stp x29, x30, [sp, -16]!
mov x29, sp
mov w19, 0
b test
                    top:
cmp w19, 5
b.lt small
mov w0, 1
b next
                    small:
mov w0, 0
next:
add w19, w19, 1
                    test:
cmp w19, 10
b.lt top
";
        let w = lint_lines(&format!(".text
.global main
main:
{body}ret
"));
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 20);
        assert!(w[0].1.contains("still holds 16 bytes"), "{}", w[0].1);
        let w = lint_lines(&format!(".text
.global main
main:
{body}add sp, sp, 16
ldp x29, x30, [sp], 16
ret
"));
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 21);
        assert!(w[0].1.contains("never pushed"), "{}", w[0].1);
    }

    #[test]
    fn macro_name_inside_a_string_warns_with_the_server_behavior() {
        let src = "define(register, w19)\n\
                   .data\n\
                   msg: .string \"register count:\"\n\
                   .text\n\
                   main:\n\
                   mov register, 1\n\
                   ret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 3);
        assert!(w[0].1.contains("university servers"), "{}", w[0].1);
        assert!(w[0].1.contains("w19"), "{}", w[0].1);
    }

    #[test]
    fn macro_name_after_a_hash_warns_about_m4_comments() {
        let src = "define(size, 40)\n\
                   .text\n\
                   main:\n\
                   mov x0, #size\n\
                   ret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 4);
        assert!(w[0].1.contains("comment"), "{}", w[0].1);
        assert!(w[0].1.contains("equate"), "{}", w[0].1);
    }

    #[test]
    fn hygiene_warnings_stop_at_a_cap_with_one_line_counting_the_rest() {
        // m4 copies the text after `#` as it is, so none of its own caps sees
        // these uses, and each one would be a warning quoting the whole body.
        let long = "x".repeat(1024);
        let huge = "x".repeat(300 * 1024);
        let shapes = [
            (long.as_str(), "#", "", 1_000),
            (long.as_str(), "#", "", 2_000),
            (long.as_str(), "#", "", 4_000),
            ("1", "#", "", 4_000),
            ("1", ".string \"", "\"", 4_000),
            (huge.as_str(), "#", "", 1),
        ];
        let mut over = Vec::new();
        for (body, lead, tail, uses) in shapes {
            let src = format!("define(a, {body})\n.text\nmain:\n{lead}{}{tail}\nret\n", " a".repeat(uses));
            let started = std::time::Instant::now();
            let w = lint(&src);
            assert!(
                started.elapsed() < std::time::Duration::from_secs(5),
                "{uses} uses took {:?}",
                started.elapsed()
            );
            let kept = w.len().saturating_sub(1);
            let bytes: usize = w[..kept].iter().map(|w| w.message.len()).sum();
            let closing = w.last().map_or("", |w| w.message.as_str());
            let counted = closing.starts_with(&format!("{} more macro warning", uses - kept));
            if kept > 1_000 || bytes > 256 * 1024 || !counted || w.last().map(|w| w.line) != Some(4) {
                over.push((body.len(), uses, w.len(), bytes + closing.len()));
            }
        }
        assert!(over.is_empty(), "(body bytes, uses, warnings, message bytes) {over:?}");
    }

    #[test]
    fn hygiene_closing_line_sits_at_the_lowest_line_left_out() {
        // Define sites are checked before the source walk, so the first
        // warning left out (line 12) sits below ten others left out after it.
        let src = format!(
            "define(x0, a)\n{}define(x1, {})\n",
            ".string \"x0\"\n".repeat(10),
            "y".repeat(300 * 1024)
        );
        let w = lint(&src);
        let closing = w.iter().find(|w| w.message.contains("more macro warning")).expect("a closing line");
        assert_eq!((closing.line, closing.message.starts_with("11 more")), (2, true), "{w:?}");
    }

    #[test]
    fn macro_shadowing_a_register_warns_at_its_define() {
        let src = "define(x0, x19)\n.text\nmain:\nret\n";
        let w = lint_lines(src);
        assert_eq!(w.len(), 1, "{w:?}");
        assert_eq!(w[0].0, 1);
        assert!(w[0].1.contains("register or instruction"), "{}", w[0].1);
    }

    #[test]
    fn word_boundaries_do_not_false_positive_in_strings() {
        // `register_r` in a string is NOT the macro `register` (GNU m4
        // matches whole longest-run names only).
        let src = "define(register, w19)\n\
                   .data\n\
                   msg: .string \"register_r holds it\"\n\
                   .text\n\
                   main:\n\
                   mov register, 1\n\
                   ret\n";
        assert_eq!(lint(src), Vec::new());
    }

    #[test]
    fn commented_out_code_never_fires_hygiene() {
        let src = "define(size, 40)\n\
                   .text\n\
                   main:\n\
                   // mov x0, #size\n\
                   mov x0, size\n\
                   ret\n";
        assert_eq!(lint(src), Vec::new());
    }

    /// Lint `source` and count the define events its body lookups read.
    fn events_read_linting(source: &str) -> usize {
        m4::EVENTS_READ.with(|n| n.set(0));
        lint(source);
        m4::EVENTS_READ.with(|n| n.get())
    }

    #[test]
    fn names_undefined_by_expansion_cost_the_macro_check_little_per_use() {
        // A macro that undefines `x` 10,000 times, called 32 times in GNU
        // m4's order, makes 320,000 events; 10,000 uses of `x` in strings
        // follow, and the program builds. Walking every event above each
        // use reads 3.2 billion.
        let uses = 10_000;
        let src = format!(
            "define(x, w19)dnl\ndefine(`u', `undefine({}`x')')dnl\n{}\t.data\n{}\t.text\n\t.global main\nmain:\tmov\tx0, 0\n\tret\n",
            "`x',".repeat(9_999),
            "u\n".repeat(32),
            "\t.ascii \"x x x x x x x x x x\"\n".repeat(uses / 10),
        );
        let read = events_read_linting(&src);
        assert!(read < 100 * uses, "the macro check read {read} define events for {uses} uses");
    }

    #[test]
    fn names_undefined_in_the_source_cost_the_macro_check_little_per_use() {
        // One line undefines `x` 40,000 times, a line pass event each; 40,000
        // uses follow. Walking every event above each use reads 1.6 billion.
        let uses = 40_000;
        let src = format!(
            "define(x, w19)\nundefine({}x)\n{}\t.text\n\t.global main\nmain:\tmov\tx0, 0\n\tret\n",
            "x,".repeat(39_999),
            "\tx x x x x x x x x x\n".repeat(uses / 10),
        );
        let read = events_read_linting(&src);
        assert!(read < 100 * uses, "the macro check read {read} define events for {uses} uses");
    }

    #[test]
    fn a_broken_m4_pass_produces_no_warnings() {
        // The assemble surfaces the m4 error; lint must stay quiet.
        assert_eq!(lint("ifdef(FOO, x)\n"), Vec::new());
    }

    #[test]
    fn every_reg_alias_is_a_reserved_name() {
        // The lint's reserved set is the shared alias table plus `pc`; walk
        // both so a row added to the table cannot go unwarned here.
        for (alias, _, _) in crate::registers::REG_ALIASES {
            assert!(is_reserved_name(alias), "`{alias}` must be reserved");
            assert!(
                is_reserved_name(&alias.to_ascii_lowercase()),
                "`{alias}` must be reserved in lowercase too"
            );
        }
        assert!(is_reserved_name("pc"), "`pc` is the lint-only extra");
    }
}
