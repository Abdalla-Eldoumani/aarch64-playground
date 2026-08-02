//! Pre-assembly structural lint. Runs BEFORE assembling and produces
//! warnings (never hard errors) with a line number and a one-line remedy:
//!
//!   * Frame balance per function: an epilogue that pops bytes the
//!     prologue never pushed, a frame still held at `ret`, and a
//!     prologue pair offset that is not 16-byte aligned. These are the
//!     shapes behind silent stack corruption -- the single most common
//!     first-week failure. Leaf functions that never touch sp are
//!     naturally exempt (they produce no stack deltas).
//!   * m4 macro hygiene: the places GNU m4's text-level rules bite.
//!     m4 substitutes whole-name tokens ANYWHERE -- inside `"` strings
//!     and `'` char literals included -- treats `NAME(` as a macro call
//!     that consumes the parenthesized text, and treats `#` as a
//!     comment-start after which nothing expands. The playground's m4
//!     follows the same rules (verified against the course toolchain),
//!     so each of those spots gets a loud warning naming what the
//!     rewrite does, because it is almost never what the author meant.
//!
//! Everything here is heuristic and fails open: an offset that cannot be
//! folded to a constant, a function with several `ret`s, or any write to
//! sp the tracker does not model simply disables analysis for that
//! function. A missed warning is fine; a false one teaches distrust.

use std::collections::{HashMap, HashSet};

use super::expr::evaluate;
use super::lexer::lex;
use super::m4;

/// One pre-assembly warning: advisory, line-anchored, with the remedy in
/// the message. Never blocks assembling.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LintWarning {
    pub line: usize,
    pub message: String,
}

/// Lint a source file. Returns an empty list when the m4 pass fails --
/// the assemble that follows will surface that error properly.
pub fn lint(source: &str) -> Vec<LintWarning> {
    let Ok(expanded) = m4::expand(source) else {
        return Vec::new();
    };
    let mut warnings = Vec::new();
    macro_hygiene(source, &expanded, &mut warnings);
    frame_balance(&expanded, &mut warnings);
    warnings.sort_by_key(|w| w.line);
    warnings
}

// ---------------------------------------------------------------------------
// m4 macro hygiene
// ---------------------------------------------------------------------------

/// Registers and mnemonics a macro name must not shadow. Compact by
/// design: the cost of a miss is one fewer warning, never a wrong one.
fn is_reserved_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    if matches!(lower.as_str(), "sp" | "fp" | "lr" | "xzr" | "wzr" | "pc") {
        return true;
    }
    if let Some(rest) = lower.strip_prefix('x').or_else(|| lower.strip_prefix('w')) {
        if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
            if let Ok(n) = rest.parse::<u32>() {
                return n <= 30;
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

fn macro_hygiene(source: &str, expanded: &m4::Expanded, warnings: &mut Vec<LintWarning>) {
    if expanded.defines.is_empty() {
        return;
    }
    // One warning per define SITE, quoting that site's own body. Walking
    // the collapsed `defines` map instead named the last body a redefined
    // macro ever had, on whichever line a text scan happened to find
    // first -- so a windowed alias was reported against the wrong
    // register entirely.
    for (line, name, body) in &expanded.define_events {
        let Some(body) = body else { continue };
        // The course's own canonical aliases: `define(fp, x29)` and
        // `define(lr, x30)` restate what GAS already predefines, so they
        // change nothing anywhere. Never warn on those.
        let canonical = (name == "fp" && body.trim().eq_ignore_ascii_case("x29"))
            || (name == "lr" && body.trim().eq_ignore_ascii_case("x30"));
        if !canonical && is_reserved_name(name) {
            warnings.push(LintWarning {
                line: *line,
                message: format!(
                    "the macro name `{name}` is also a register or instruction \
                     name -- every later use of `{name}` becomes `{body}`; \
                     rename the macro (for example `{name}_r`)"
                ),
            });
        }
    }
    // Walk the ORIGINAL source so the string/char literals are the ones
    // the student wrote (expansion leaves them alone by design).
    for (idx, raw) in source.lines().enumerate() {
        let line = idx + 1;
        scan_line_for_hygiene(raw, line, expanded, warnings);
    }
}

fn scan_line_for_hygiene(
    raw: &str,
    line: usize,
    expanded: &m4::Expanded,
    warnings: &mut Vec<LintWarning>,
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
                    warnings.push(LintWarning {
                        line,
                        message: format!(
                            "`{ident}` is defined as a macro ({body}) and also \
                             appears in this {} -- m4 replaces it here exactly \
                             as the university servers do, so the program \
                             prints `{body}` instead; rename the macro (for \
                             example `{ident}_r`)",
                            if in_string { "string" } else { "character literal" }
                        ),
                    });
                } else if after_hash {
                    warnings.push(LintWarning {
                        line,
                        message: format!(
                            "m4 treats `#` as a comment start, here and on the \
                             university servers, so `{ident}` will NOT expand \
                             and the assembler will reject the line -- use an \
                             equate (`{ident} = {body}`) instead of a define, \
                             or drop the `#`"
                        ),
                    });
                } else if i < bytes.len() && bytes[i] == b'(' {
                    warnings.push(LintWarning {
                        line,
                        message: format!(
                            "`{ident}(` reads as an m4 macro CALL on the \
                             university servers, which consumes the text in the \
                             parentheses -- put a space before `(` or rename the \
                             macro"
                        ),
                    });
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

struct FunctionSegment {
    name: String,
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
fn split_functions(text: &str) -> Vec<FunctionSegment> {
    let mut globals: HashSet<String> = HashSet::new();
    let mut bl_targets: HashSet<String> = HashSet::new();
    for line in text.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix(".global").or_else(|| t.strip_prefix(".globl")) {
            globals.insert(rest.trim().to_string());
        }
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
    // Flow-insensitive tracking is only sound over one entry and one
    // exit; a function with several `ret`s (early returns, multiple
    // epilogues) is skipped rather than guessed at.
    let ret_count = segment
        .lines
        .iter()
        .filter(|(_, text)| text == "ret" || text.starts_with("ret "))
        .count();
    if ret_count != 1 {
        return;
    }

    let name = &segment.name;
    let mut delta: i64 = 0;
    for (line, text) in &segment.lines {
        let line = *line;
        if text == "ret" || text.starts_with("ret ") {
            if delta < 0 {
                warnings.push(LintWarning {
                    line,
                    message: format!(
                        "`{name}` still holds {} bytes of stack at this ret -- \
                         restore it first, for example `ldp x29, x30, [sp], {}` \
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
                         16 -- sp must stay 16-byte aligned, so round the frame \
                         up (`stp x29, x30, [sp, -16]!`, `sub sp, sp, 32`, ...)"
                    ),
                });
                return;
            }
            delta -= bytes;
        }
        if let StackEffect::Pop { bytes } = effect {
            delta += bytes;
            if delta > 0 {
                warnings.push(LintWarning {
                    line,
                    message: format!(
                        "this pops {bytes} bytes that `{name}` never pushed -- \
                         add `stp x29, x30, [sp, -16]!` at the top of `{name}`, \
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
/// cannot be folded -- the caller then checks for unmodeled sp writes).
fn stack_effect(text: &str, symbols: &HashMap<String, i64>) -> Option<StackEffect> {
    let compact: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
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
    let compact: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
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
        // The A1 live repro: the single most common first-week slip.
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
    fn multi_ret_functions_are_skipped() {
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

    #[test]
    fn a_broken_m4_pass_produces_no_warnings() {
        // The assemble surfaces the m4 error; lint must stay quiet.
        assert_eq!(lint("ifdef(FOO, x)\n"), Vec::new());
    }
}
