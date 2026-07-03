//! m4 preprocessing for cpsc 355 source. Supports a narrow subset:
//!
//!   * define(NAME, BODY) -- whole-token substitution of NAME with BODY
//!     anywhere it appears later in the source. Use for register aliases
//!     (`define(score1_r, w19)`), not for numeric values.
//!   * NAME = EXPRESSION at top level. Recorded separately and left in the
//!     expanded output as-is so the parser can produce a symbol-assignment
//!     item whose body is evaluated at that exact point in the section.
//!     This matters for `msg_len = . - msg - 1` where `.` means "the byte
//!     offset at the line of the assignment", not "wherever msg_len is
//!     eventually used".
//!   * Recursive expansion to a fixed point, bounded at 32 rounds so loops
//!     fail loudly instead of hanging.
//!   * // and ; line comments stripped before substitution, so comment text
//!     never participates.
//!   * Source map tracking: expand() returns a line map so later errors
//!     point at the original source line the student wrote, even for lines
//!     that were substituted or emptied.
//!
//! Anything else (ifdef, ifelse, forloop, dnl, backtick quoting) fails with
//! an "unsupported m4 construct" error at the offending line. The tutorial
//! corpus sticks to the subset above.

use std::collections::HashMap;

use crate::errors::EmuError;

const MAX_RECURSION: usize = 32;

/// Result of m4 expansion.
#[derive(Debug, Default, Clone)]
pub struct Expanded {
    /// Expanded source. `define()` lines become empty so line numbers stay
    /// aligned; `name = expr` assignments stay intact so the parser can
    /// turn them into symbol assignments at their original offset.
    pub text: String,
    /// `line_map[i]` is the 1-based original source line that produced the
    /// 1-based expanded line `i + 1`. Identity for this pass since output
    /// stays aligned; surfaced so later stages can still ask the question.
    pub line_map: Vec<usize>,
    /// `define()` aliases. The UI reads this to label physical registers
    /// with the names the student wrote (define(score1_r, w19) surfaces as
    /// a `score1_r` tag next to w19 in the register panel).
    pub defines: HashMap<String, String>,
    /// `name = expr` aliases. Recorded for debugging and for the UI's
    /// symbol browser; the parser re-discovers these from the expanded
    /// text so it can pin each one to the right section/offset.
    pub assignments: HashMap<String, String>,
}

/// Expand an m4 source file. Errors carry 1-based original line numbers.
pub fn expand(source: &str) -> Result<Expanded, EmuError> {
    // Pass 0: blank C-style block comments. Course assignment headers wrap
    // multi-line prose (even #include lines) in /* ... */, which the
    // per-line comment stripping below cannot see.
    let source = strip_block_comments(source);
    let source = source.as_str();
    // Pass 1: collect `define()` aliases for substitution, record `name =
    // expr` assignments separately (they stay inline so the parser can
    // pin them to a section offset), and strip comments. Walking the
    // whole file first is what makes forward references work across
    // later substitution.
    let mut defines: HashMap<String, String> = HashMap::new();
    let mut assignments: HashMap<String, String> = HashMap::new();
    let mut stripped: Vec<String> = Vec::new();
    for (idx, raw) in source.lines().enumerate() {
        let line_num = idx + 1;
        let without_comment = strip_comment(raw);
        let trimmed = without_comment.trim();
        if let Some(kw) = detect_unsupported(trimmed) {
            return Err(EmuError::PreprocError {
                line: line_num,
                message: format!("unsupported m4 construct: {kw}"),
            });
        }
        if let Some((name, body)) = parse_define(trimmed) {
            defines.insert(name, body);
            stripped.push(String::new());
            continue;
        }
        if let Some((name, body)) = parse_assignment(trimmed) {
            assignments.insert(name, body);
            // Keep the assignment line intact so the parser can produce
            // a symbol-assignment item at this exact section offset. The
            // expression body may reference `.` or labels whose meaning
            // depends on where the assignment appears in the source.
            stripped.push(without_comment.to_string());
            continue;
        }
        stripped.push(without_comment.to_string());
    }

    // Pass 2: substitute `define()` aliases only. Assignment aliases are
    // left untouched so the parser sees `name = expr` verbatim.
    let mut out: Vec<String> = Vec::with_capacity(stripped.len());
    let mut line_map: Vec<usize> = Vec::with_capacity(stripped.len());
    for (idx, line) in stripped.iter().enumerate() {
        let line_num = idx + 1;
        out.push(expand_recursively(line, &defines, line_num)?);
        line_map.push(line_num);
    }

    Ok(Expanded {
        text: out.join("\n"),
        line_map,
        defines,
        assignments,
    })
}

fn expand_recursively(
    line: &str,
    defines: &HashMap<String, String>,
    line_num: usize,
) -> Result<String, EmuError> {
    let mut current = line.to_string();
    for _ in 0..MAX_RECURSION {
        let next = substitute_once(&current, defines);
        if next == current {
            return Ok(current);
        }
        current = next;
    }
    // One more pass: if it still changes after MAX_RECURSION rounds, the
    // substitution has a cycle and will never settle.
    let next = substitute_once(&current, defines);
    if next != current {
        return Err(EmuError::PreprocError {
            line: line_num,
            message: format!("m4 recursion exceeded {MAX_RECURSION} rounds"),
        });
    }
    Ok(current)
}

/// One token-boundary substitution pass over a line. String and char
/// literals are copied verbatim. Shared with the parser's `.req` alias
/// pass, which substitutes register aliases the same way defines expand.
pub(crate) fn substitute_once(line: &str, defines: &HashMap<String, String>) -> String {
    let bytes = line.as_bytes();
    let mut out = String::with_capacity(line.len());
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'"' || b == b'\'' {
            // Copy a string or char literal verbatim, including the
            // delimiters and any backslash-escaped bytes.
            let quote = b;
            out.push(b as char);
            i += 1;
            while i < bytes.len() {
                let c = bytes[i];
                if c == b'\\' && i + 1 < bytes.len() {
                    out.push(c as char);
                    out.push(bytes[i + 1] as char);
                    i += 2;
                    continue;
                }
                out.push(c as char);
                i += 1;
                if c == quote {
                    break;
                }
            }
            continue;
        }
        if is_id_start_byte(b) {
            let start = i;
            i += 1;
            while i < bytes.len() && is_id_continue_byte(bytes[i]) {
                i += 1;
            }
            let ident = &line[start..i];
            match defines.get(ident) {
                Some(body) => out.push_str(body),
                None => out.push_str(ident),
            }
            continue;
        }
        out.push(b as char);
        i += 1;
    }
    out
}

/// Blank C-style `/* ... */` block comments across the whole source,
/// keeping every newline inside them so line numbers stay aligned with
/// the editor. String and char literals are respected; `//` line comments
/// are copied through untouched (the per-line `strip_comment` below owns
/// them), so a `/*` inside one never opens a block. Literal state resets
/// at each newline because both literal forms are single-line in
/// assembly, which keeps a stray quote from poisoning the rest of the
/// file.
fn strip_block_comments(source: &str) -> String {
    if !source.contains("/*") {
        return source.to_string();
    }
    let bytes = source.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let mut in_string = false;
    let mut in_char = false;
    let mut in_block = false;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'\n' {
            in_string = false;
            in_char = false;
            out.push(b'\n');
            i += 1;
            continue;
        }
        if in_block {
            if b == b'*' && i + 1 < bytes.len() && bytes[i + 1] == b'/' {
                in_block = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }
        if (in_string || in_char) && b == b'\\' && i + 1 < bytes.len() {
            out.push(b);
            out.push(bytes[i + 1]);
            i += 2;
            continue;
        }
        match b {
            b'"' if !in_char => in_string = !in_string,
            b'\'' if !in_string => in_char = !in_char,
            b'/' if !in_string && !in_char && i + 1 < bytes.len() && bytes[i + 1] == b'/' => {
                // Copy the `//` comment through to the end of the line.
                while i < bytes.len() && bytes[i] != b'\n' {
                    out.push(bytes[i]);
                    i += 1;
                }
                continue;
            }
            b'/' if !in_string && !in_char && i + 1 < bytes.len() && bytes[i + 1] == b'*' => {
                in_block = true;
                i += 2;
                continue;
            }
            _ => {}
        }
        out.push(b);
        i += 1;
    }
    // Only ASCII spans were removed, so the bytes are still valid UTF-8.
    String::from_utf8(out).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned())
}

fn strip_comment(line: &str) -> &str {
    let bytes = line.as_bytes();
    let mut in_string = false;
    let mut in_char = false;
    let mut escape = false;
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if escape {
            escape = false;
            i += 1;
            continue;
        }
        if b == b'\\' && (in_string || in_char) {
            escape = true;
            i += 1;
            continue;
        }
        if in_string {
            if b == b'"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if in_char {
            if b == b'\'' {
                in_char = false;
            }
            i += 1;
            continue;
        }
        match b {
            b'"' => in_string = true,
            b'\'' => in_char = true,
            b'/' if i + 1 < bytes.len() && bytes[i + 1] == b'/' => {
                return &line[..i];
            }
            b';' => return &line[..i],
            _ => {}
        }
        i += 1;
    }
    line
}

fn parse_define(trimmed: &str) -> Option<(String, String)> {
    // Tolerate `define (...)` with whitespace; bare "define" alone is not
    // a define so require the opening paren.
    let rest = trimmed.strip_prefix("define")?;
    let rest = rest.trim_start();
    let inside_plus = rest.strip_prefix('(')?;
    let (inside, after) = split_outer_parens(inside_plus)?;
    if !after.trim().is_empty() {
        return None;
    }
    let (name, body) = split_top_level_comma(inside)?;
    let name = name.trim().to_string();
    let body = body.trim().to_string();
    if name.is_empty() || !is_valid_ident(&name) {
        return None;
    }
    Some((name, body))
}

fn parse_assignment(trimmed: &str) -> Option<(String, String)> {
    if trimmed.ends_with(':') {
        return None;
    }
    if trimmed.starts_with('.') {
        return None;
    }
    let (ident, rest) = take_ident(trimmed)?;
    let rest = rest.trim_start();
    let rest = rest.strip_prefix('=')?;
    if rest.starts_with('=') {
        return None;
    }
    let body = rest.trim().to_string();
    if body.is_empty() {
        return None;
    }
    Some((ident.to_string(), body))
}

fn split_outer_parens(s: &str) -> Option<(&str, &str)> {
    // `s` starts one character after an opening '(', so depth starts at 1.
    let mut depth: usize = 1;
    let bytes = s.as_bytes();
    let mut in_string = false;
    let mut in_char = false;
    let mut escape = false;
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if escape {
            escape = false;
            i += 1;
            continue;
        }
        if b == b'\\' && (in_string || in_char) {
            escape = true;
            i += 1;
            continue;
        }
        if in_string {
            if b == b'"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if in_char {
            if b == b'\'' {
                in_char = false;
            }
            i += 1;
            continue;
        }
        match b {
            b'"' => in_string = true,
            b'\'' => in_char = true,
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some((&s[..i], &s[i + 1..]));
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

fn split_top_level_comma(s: &str) -> Option<(&str, &str)> {
    let mut depth: usize = 0;
    let bytes = s.as_bytes();
    let mut in_string = false;
    let mut in_char = false;
    let mut escape = false;
    for (i, &b) in bytes.iter().enumerate() {
        if escape {
            escape = false;
            continue;
        }
        if b == b'\\' && (in_string || in_char) {
            escape = true;
            continue;
        }
        if in_string {
            if b == b'"' {
                in_string = false;
            }
            continue;
        }
        if in_char {
            if b == b'\'' {
                in_char = false;
            }
            continue;
        }
        match b {
            b'"' => in_string = true,
            b'\'' => in_char = true,
            b'(' => depth += 1,
            b')' => depth = depth.saturating_sub(1),
            b',' if depth == 0 => {
                return Some((&s[..i], &s[i + 1..]));
            }
            _ => {}
        }
    }
    None
}

fn take_ident(s: &str) -> Option<(&str, &str)> {
    let mut chars = s.char_indices();
    let (_, first) = chars.next()?;
    if !is_id_start_char(first) {
        return None;
    }
    let mut end = first.len_utf8();
    for (i, c) in chars {
        if is_id_continue_char(c) {
            end = i + c.len_utf8();
        } else {
            break;
        }
    }
    Some((&s[..end], &s[end..]))
}

fn detect_unsupported(line: &str) -> Option<&'static str> {
    // Backtick is m4 open-quote; never legal in this subset.
    if line.contains('`') {
        return Some("backtick-quoted string");
    }
    for kw in &["ifdef", "ifelse", "forloop"] {
        if let Some(after) = line.strip_prefix(kw) {
            if after.trim_start().starts_with('(') {
                return Some(kw);
            }
        }
    }
    if line == "dnl" || line.starts_with("dnl ") || line.starts_with("dnl\t") {
        return Some("dnl");
    }
    None
}

fn is_valid_ident(s: &str) -> bool {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) if is_id_start_char(c) => {}
        _ => return false,
    }
    chars.all(is_id_continue_char)
}

#[inline]
fn is_id_start_byte(b: u8) -> bool {
    matches!(b, b'A'..=b'Z' | b'a'..=b'z' | b'_')
}

#[inline]
fn is_id_continue_byte(b: u8) -> bool {
    matches!(b, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'_')
}

#[inline]
fn is_id_start_char(c: char) -> bool {
    matches!(c, 'A'..='Z' | 'a'..='z' | '_')
}

#[inline]
fn is_id_continue_char(c: char) -> bool {
    matches!(c, 'A'..='Z' | 'a'..='z' | '0'..='9' | '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn exp(src: &str) -> Expanded {
        expand(src).expect("expansion should succeed")
    }

    #[test]
    fn define_substitutes_bare_identifier() {
        let r = exp("define(fp, x29)\nmov x0, fp\n");
        assert_eq!(r.text, "\nmov x0, x29");
        assert_eq!(r.defines.get("fp").map(String::as_str), Some("x29"));
    }

    #[test]
    fn define_respects_token_boundary_suffix() {
        let r = exp("define(fp, x29)\nmov x0, fpreg\n");
        assert_eq!(r.text, "\nmov x0, fpreg");
    }

    #[test]
    fn define_respects_token_boundary_prefix() {
        let r = exp("define(fp, x29)\nmov x0, xxfp\n");
        assert_eq!(r.text, "\nmov x0, xxfp");
    }

    #[test]
    fn recursive_expansion_reaches_fixed_point() {
        let r = exp("define(A, B)\ndefine(B, C)\nmov x0, A\n");
        assert_eq!(r.text, "\n\nmov x0, C");
    }

    #[test]
    fn forward_reference_expands_when_alias_defined_later() {
        let r = exp("mov x0, fp\ndefine(fp, x29)\n");
        assert_eq!(r.text, "mov x0, x29\n");
    }

    #[test]
    fn assignment_form_registers_alias_with_body_text() {
        // Assignment-form aliases are recorded separately and the source
        // line stays intact so the parser can pin each one to a section
        // offset (for `.` to mean the right thing).
        let r = exp("alloc = -(16 + 16) & -16\nstp fp, lr, [sp, alloc]!\n");
        assert_eq!(
            r.assignments.get("alloc").map(String::as_str),
            Some("-(16 + 16) & -16")
        );
        assert!(r.text.contains("alloc = -(16 + 16) & -16"));
        assert!(r.text.contains("[sp, alloc]!"));
    }

    #[test]
    fn assignment_form_keeps_line_in_output_and_omits_from_defines() {
        let r = exp("alloc = 32\nmov x0, 1\n");
        assert!(r.defines.get("alloc").is_none());
        assert_eq!(r.assignments.get("alloc").map(String::as_str), Some("32"));
        assert!(r.text.contains("alloc = 32"));
    }

    #[test]
    fn strips_double_slash_comment_before_substitution() {
        let r = exp("define(fp, x29)\nmov x0, fp // frame pointer\n");
        assert_eq!(r.text.trim_end(), "\nmov x0, x29");
    }

    #[test]
    fn strips_semicolon_comment_before_substitution() {
        let r = exp("define(fp, x29)\nmov x0, fp ; trailing\n");
        assert_eq!(r.text.trim_end(), "\nmov x0, x29");
    }

    #[test]
    fn does_not_strip_semicolon_inside_string_literal() {
        let r = exp(".string \"hello; world\"\n");
        assert_eq!(r.text, ".string \"hello; world\"");
    }

    #[test]
    fn does_not_substitute_inside_char_literal() {
        let r = exp("define(A, X)\nmov w0, 'A'\n");
        assert_eq!(r.text, "\nmov w0, 'A'");
    }

    #[test]
    fn does_not_substitute_inside_string_literal() {
        let r = exp("define(name, WOOD)\n.string \"name is fire\"\n");
        assert_eq!(r.text, "\n.string \"name is fire\"");
    }

    #[test]
    fn unknown_identifier_passes_through() {
        let r = exp("mov x0, xyzzy\n");
        assert_eq!(r.text, "mov x0, xyzzy");
    }

    #[test]
    fn ifdef_is_rejected_as_unsupported() {
        let err = expand("ifdef(FOO, stuff)\n").unwrap_err();
        match err {
            EmuError::PreprocError { line, message } => {
                assert_eq!(line, 1);
                assert!(
                    message.contains("unsupported m4 construct"),
                    "message was: {message}"
                );
                assert!(message.contains("ifdef"), "message was: {message}");
            }
            other => panic!("expected PreprocError, got {other:?}"),
        }
    }

    #[test]
    fn ifelse_is_rejected() {
        assert!(expand("ifelse(1, 2, yes, no)\n").is_err());
    }

    #[test]
    fn forloop_is_rejected() {
        assert!(expand("forloop(i, 0, 5, foo)\n").is_err());
    }

    #[test]
    fn dnl_is_rejected() {
        assert!(expand("dnl skip to end of line\n").is_err());
    }

    #[test]
    fn backtick_is_rejected() {
        assert!(expand("mov x0, `foo'\n").is_err());
    }

    #[test]
    fn alternating_define_caught_at_recursion_limit() {
        // A -> B, B -> A alternates without settling; the guard must fire.
        let err = expand("define(A, B)\ndefine(B, A)\nmov x0, A\n").unwrap_err();
        match err {
            EmuError::PreprocError { message, .. } => {
                assert!(
                    message.contains("m4 recursion"),
                    "message was: {message}"
                );
            }
            other => panic!("expected recursion error, got {other:?}"),
        }
    }

    #[test]
    fn line_map_aligns_with_input() {
        let r = exp("define(fp, x29)\nmov x0, fp\nmov x1, fp\n");
        assert_eq!(r.line_map, vec![1, 2, 3]);
    }

    #[test]
    fn define_line_emits_empty_output_line() {
        let r = exp("define(fp, x29)\n");
        assert_eq!(r.text, "");
        assert_eq!(r.line_map, vec![1]);
    }

    #[test]
    fn label_is_not_treated_as_assignment() {
        let r = exp("foo:\nmov x0, #1\n");
        assert!(r.defines.is_empty(), "defines: {:?}", r.defines);
    }

    #[test]
    fn directive_line_is_not_treated_as_assignment() {
        // `.size foo, . - foo` contains no '=' at identifier-equals shape,
        // but even if it did, lines starting with '.' are directives, not
        // symbol assignments.
        let r = exp(".size foo, . - foo\n");
        assert!(r.defines.is_empty());
    }

    #[test]
    fn multiple_aliases_on_one_register_all_recorded() {
        let r = exp("define(fp, x29)\ndefine(frame, x29)\n");
        assert_eq!(r.defines.get("fp").map(String::as_str), Some("x29"));
        assert_eq!(r.defines.get("frame").map(String::as_str), Some("x29"));
    }

    #[test]
    fn escaped_backslash_in_string_preserved() {
        let r = exp(".string \"a\\nb\"\n");
        assert_eq!(r.text, ".string \"a\\nb\"");
    }

    #[test]
    fn blank_source_gives_empty_output() {
        let r = exp("");
        assert_eq!(r.text, "");
        assert!(r.line_map.is_empty());
    }

    #[test]
    fn nested_parens_in_define_body_preserved() {
        let r = exp("define(sum, (a + b))\nmov x0, sum\n");
        assert_eq!(r.text, "\nmov x0, (a + b)");
    }

    #[test]
    fn define_with_whitespace_between_name_and_paren_not_required() {
        // The corpus writes `define(fp, x29)` with no space, but we accept
        // `define (fp, x29)` too since GAS's m4 does.
        let r = exp("define (fp, x29)\nmov x0, fp\n");
        assert_eq!(r.text, "\nmov x0, x29");
    }
}
