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

/// Hard ceiling on a single expanded line. Course lines are tens of bytes;
/// anything approaching this is a define() chain growing geometrically,
/// which the round guard alone cannot stop (a doubling chain settles within
/// 32 rounds while the text explodes). Fails loudly instead of exhausting
/// the wasm heap.
pub(crate) const MAX_EXPANDED_LINE_BYTES: usize = 64 * 1024;

/// Cap on the TOTAL expanded output. The per-line cap bounds one line, but a
/// ~60 KiB macro body referenced across thousands of lines could still sum to
/// gigabytes and trap the instance. 8 MiB is far above any real course
/// program (source itself is capped at 1 MiB upstream).
pub(crate) const MAX_EXPANDED_TOTAL_BYTES: usize = 8 * 1024 * 1024;

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
    /// Every `define()`/`undefine()` in source order: `(1-based line, name,
    /// body)` with `None` for an undefine. `defines` collapses a name that
    /// is redefined onto its LAST body, which is the wrong answer for
    /// anything that reports a binding against a source line -- a warning
    /// about `define(size, w19)` quoted `w21` because a later stretch of
    /// the file rebound the name. Readers that care about a line walk
    /// these instead, through `define_body_at`.
    pub define_events: Vec<(usize, String, Option<String>)>,
    /// Names whose bindings are windowed (redefined or undefined) rather
    /// than file-wide. For every other name `defines` is exact everywhere.
    pub windowed: std::collections::HashSet<String>,
}

impl Expanded {
    /// The `define()` body in effect for `name` at 1-based source `line`,
    /// mirroring expansion's own rule: a name defined once and never
    /// undefined binds across the whole file (so forward references work),
    /// while a redefined or undefined name binds only over its own window.
    pub fn define_body_at(&self, name: &str, line: usize) -> Option<&str> {
        if !self.windowed.contains(name) {
            return self.defines.get(name).map(String::as_str);
        }
        let mut body: Option<&str> = None;
        for (at, event_name, event_body) in &self.define_events {
            if *at > line {
                break;
            }
            if event_name == name {
                body = event_body.as_deref();
            }
        }
        body
    }
}

/// Expand an m4 source file. Errors carry 1-based original line numbers.
pub fn expand(source: &str) -> Result<Expanded, EmuError> {
    // Pass 0: blank C-style block comments. Course assignment headers wrap
    // multi-line prose (even #include lines) in /* ... */, which the
    // per-line comment stripping below cannot see.
    let source = strip_block_comments(source)?;
    let source = source.as_str();
    // Pass 1: collect `define()` aliases for substitution, record `name =
    // expr` assignments separately (they stay inline so the parser can
    // pin them to a section offset), and strip comments. Walking the
    // whole file first is what makes forward references work across
    // later substitution.
    let mut assignments: HashMap<String, String> = HashMap::new();
    let mut stripped: Vec<String> = Vec::new();
    // Every define/undefine in source order: (line index, name, body;
    // None body = undefine). Order is what makes sequential redefinition
    // work below.
    let mut define_events: Vec<(usize, String, Option<String>)> = Vec::new();
    for (idx, raw) in source.lines().enumerate() {
        let line_num = idx + 1;
        let without_comment = strip_comment(raw);
        let trimmed = without_comment.trim();
        // undefine parses before the backtick gate: GNU m4 requires its
        // argument quoted (`undefine(`name')`), so the quote is legal
        // exactly here and nowhere else.
        if let Some(names) = parse_undefine(trimmed) {
            for name in names {
                define_events.push((idx, name, None));
            }
            stripped.push(String::new());
            continue;
        }
        if let Some(kw) = detect_unsupported(trimmed) {
            return Err(EmuError::PreprocError {
                line: line_num,
                message: format!("unsupported m4 construct: {kw}"),
            });
        }
        if let Some((name, body)) = parse_define(trimmed) {
            define_events.push((idx, name, Some(body)));
            stripped.push(String::new());
            continue;
        }
        // The line got past both define gates (the keyword and the paren)
        // but failed to parse: it is a broken define, not an instruction.
        // Passing it through blamed the student for an unknown mnemonic
        // spelled DEFINE(FP,.
        if is_attempted_define(trimmed) {
            return Err(EmuError::PreprocError {
                line: line_num,
                message: format!(
                    "malformed m4 define: {}. Write it as `define(NAME, body)`",
                    diagnose_define(trimmed, raw.trim())
                ),
            });
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

    // Classify the names. A name defined once and never undefined
    // substitutes across the whole file, so forward references keep
    // working (the playground's long-standing convenience). A name that
    // is redefined or undefined follows GNU m4's sequential windows
    // instead: per-function register aliases like `define(size, w19)` ...
    // `undefine(`size')` ... `define(size, w21)` must take each body only
    // over its own stretch of the file.
    let mut define_count: HashMap<&str, usize> = HashMap::new();
    let mut undefined_names: std::collections::HashSet<&str> =
        std::collections::HashSet::new();
    for (_, name, body) in &define_events {
        if body.is_some() {
            *define_count.entry(name.as_str()).or_insert(0) += 1;
        } else {
            undefined_names.insert(name.as_str());
        }
    }
    // Last body per name: the whole-file map for static names, and what
    // the UI's register-alias labels read.
    let mut defines: HashMap<String, String> = HashMap::new();
    for (_, name, body) in &define_events {
        if let Some(b) = body {
            defines.insert(name.clone(), b.clone());
        }
    }
    // `windowed` still marks the redefined/undefined names for the lint
    // and UI layers, which report per-line bindings through
    // `define_body_at`; substitution itself is sequential for every name.
    let mut windowed: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (name, count) in define_count {
        if count != 1 || undefined_names.contains(name) {
            windowed.insert(name.to_string());
        }
    }
    let mut current: HashMap<String, String> = HashMap::new();

    // Pass 2: substitute `define()` aliases only. Assignment aliases are
    // left untouched so the parser sees `name = expr` verbatim. GNU m4 is
    // strictly sequential -- a define binds only the text below it, and a
    // forward reference stays unexpanded (and then fails to assemble,
    // exactly as it does on the course servers) -- so `current` starts
    // empty and picks every binding up (and drops it on undefine) as the
    // walk passes its line. The whole-file map used to serve forward
    // references here; no real program used them, and honoring them made
    // code work in the playground that the servers reject.
    let mut events = define_events.iter().peekable();
    let mut out: Vec<String> = Vec::with_capacity(stripped.len());
    let mut line_map: Vec<usize> = Vec::with_capacity(stripped.len());
    let mut total: usize = 0;
    for (idx, line) in stripped.iter().enumerate() {
        let line_num = idx + 1;
        while let Some((event_idx, name, body)) = events.peek() {
            if *event_idx > idx {
                break;
            }
            match body {
                Some(b) => {
                    current.insert(name.clone(), b.clone());
                }
                None => {
                    current.remove(name.as_str());
                }
            }
            events.next();
        }
        let expanded = expand_recursively(line, &current, line_num)?;
        total = total.saturating_add(expanded.len());
        if total > MAX_EXPANDED_TOTAL_BYTES {
            return Err(EmuError::PreprocError {
                line: line_num,
                message: format!(
                    "m4 expansion grew the whole source past {} MiB. A macro body \
                     repeated across many lines can blow up the output; shrink the \
                     macro or the number of references",
                    MAX_EXPANDED_TOTAL_BYTES / (1024 * 1024)
                ),
            });
        }
        out.push(expanded);
        line_map.push(line_num);
    }

    Ok(Expanded {
        text: out.join("\n"),
        line_map,
        defines,
        assignments,
        define_events: define_events
            .into_iter()
            .map(|(idx, name, body)| (idx + 1, name, body))
            .collect(),
        windowed,
    })
}

fn expand_recursively(
    line: &str,
    defines: &HashMap<String, String>,
    line_num: usize,
) -> Result<String, EmuError> {
    let mut current = line.to_string();
    for _ in 0..MAX_RECURSION {
        let next = substitute_bounded(&current, defines, line_num)?;
        if next == current {
            return Ok(current);
        }
        current = next;
    }
    // One more pass: if it still changes after MAX_RECURSION rounds, the
    // substitution has a cycle and will never settle.
    let next = substitute_bounded(&current, defines, line_num)?;
    if next != current {
        return Err(EmuError::PreprocError {
            line: line_num,
            message: format!("m4 recursion exceeded {MAX_RECURSION} rounds"),
        });
    }
    Ok(current)
}

/// One expansion round with the per-line byte cap applied DURING the
/// substitution. Materializing the whole result and measuring it
/// afterwards let a chain that multiplies its input every round allocate
/// the full expansion first: a body that reaches 10^11 bytes needs ~100 GB
/// before the cap can fire, which on wasm32 is an allocation abort, not an
/// error message. The ceiling never drops below the input, so a line that
/// is already long but does not grow still passes.
fn substitute_bounded(
    line: &str,
    defines: &HashMap<String, String>,
    line_num: usize,
) -> Result<String, EmuError> {
    let limit = MAX_EXPANDED_LINE_BYTES.max(line.len());
    substitute_once_gnu(line, defines, limit).ok_or_else(|| EmuError::PreprocError {
        line: line_num,
        message: format!(
            "m4 expansion grew this line past {MAX_EXPANDED_LINE_BYTES} bytes; \
             a define() chain is expanding without settling"
        ),
    })
}

/// One token-boundary substitution pass over a line, refusing to build
/// more than `limit` bytes. `None` means the cap was reached; the caller
/// owns the message. String and char literals are copied verbatim -- this
/// is the parser's `.req` alias pass, and GAS never rewrites literals
/// (docs/instruction-reference.md pins that). The m4 expander calls
/// `substitute_once_gnu` instead, which follows GNU m4's text-level rules.
pub(crate) fn substitute_once(
    line: &str,
    defines: &HashMap<String, String>,
    limit: usize,
) -> Option<String> {
    substitute_pass(line, defines, limit, true)
}

/// GNU m4's view of a line: double quotes, single quotes, and backslashes
/// are plain punctuation (m4's own quotes are backtick/quote), so macro
/// names expand INSIDE string and char literals -- `define(seconds, x22)`
/// rewrites `.string "%d seconds"` into `"%d x22"`, and the `n` in a
/// `"\n"` below `define(n, w19)` becomes `"\w19"`. A `#` starts an m4
/// comment: the rest of the line is copied verbatim, unexpanded. All
/// three behaviors verified against GNU m4 on the course toolchain.
pub(crate) fn substitute_once_gnu(
    line: &str,
    defines: &HashMap<String, String>,
    limit: usize,
) -> Option<String> {
    substitute_pass(line, defines, limit, false)
}

/// Everything outside an identifier is copied as a byte-exact slice of the
/// input, never widened through `as char`: widening a byte >= 0x80 (a
/// latin-1 promotion) re-encodes it as two UTF-8 bytes, so a single pasted
/// NBSP or accented letter doubled every round and expansion could never
/// reach its fixed point. Slice boundaries here always sit on ASCII bytes
/// (quotes, identifier edges, `#`) or the end of the line, so the slicing
/// is UTF-8 safe even while the scan itself walks raw bytes.
fn substitute_pass(
    line: &str,
    defines: &HashMap<String, String>,
    limit: usize,
    respect_literals: bool,
) -> Option<String> {
    let bytes = line.as_bytes();
    let mut out = String::with_capacity(line.len());
    let mut i = 0;
    while i < bytes.len() {
        if out.len() > limit {
            return None;
        }
        let b = bytes[i];
        if !respect_literals && b == b'#' {
            // GNU m4 comment: everything from `#` to the end of the line
            // passes through unexpanded, which is why the course style
            // writes bare immediates (`mov x0, 5`, never `#alloc`).
            out.push_str(&line[i..]);
            break;
        }
        if respect_literals && (b == b'"' || b == b'\'') {
            // Copy a string or char literal verbatim, including the
            // delimiters and any backslash-escaped bytes.
            let quote = b;
            let start = i;
            i += 1;
            while i < bytes.len() {
                let c = bytes[i];
                if c == b'\\' && i + 1 < bytes.len() {
                    i += 2;
                    continue;
                }
                i += 1;
                if c == quote {
                    break;
                }
            }
            out.push_str(&line[start..i]);
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
        // Copy the run up to the next boundary verbatim.
        let start = i;
        i += 1;
        while i < bytes.len() {
            let c = bytes[i];
            if c == b'"' || c == b'\'' || c == b'#' || is_id_start_byte(c) {
                break;
            }
            i += 1;
        }
        out.push_str(&line[start..i]);
    }
    Some(out)
}

/// Blank C-style `/* ... */` block comments across the whole source,
/// keeping every newline inside them so line numbers stay aligned with
/// the editor. String and char literals are respected; `//` line comments
/// are copied through untouched (the per-line `strip_comment` below owns
/// them), so a `/*` inside one never opens a block. Literal state resets
/// at each newline because both literal forms are single-line in
/// assembly, which keeps a stray quote from poisoning the rest of the
/// file.
fn strip_block_comments(source: &str) -> Result<String, EmuError> {
    if !source.contains("/*") {
        return Ok(source.to_string());
    }
    let bytes = source.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let mut in_string = false;
    let mut in_char = false;
    let mut in_block = false;
    let mut line = 1usize;
    let mut block_open_line = 0usize;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'\n' {
            in_string = false;
            in_char = false;
            out.push(b'\n');
            i += 1;
            line += 1;
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
                block_open_line = line;
                i += 2;
                continue;
            }
            _ => {}
        }
        out.push(b);
        i += 1;
    }
    // An unclosed block swallowed everything after it while keeping the
    // line count intact, so the build reported SUCCESS on a program
    // reduced to nothing. gcc/as reject with the opening line; so do we.
    if in_block {
        return Err(EmuError::PreprocError {
            line: block_open_line,
            message: "unterminated /* comment: no closing */ before the end of the file".into(),
        });
    }
    // Only ASCII spans were removed, so the bytes are still valid UTF-8.
    Ok(String::from_utf8(out)
        .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned()))
}

/// Shared by the legacy assembler's preprocess and the pipeline's
/// `strip_leading_labels`: a `;` or `//` inside a string or character
/// literal is content, not a comment opener.
pub(crate) fn strip_comment(line: &str) -> &str {
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

/// The same two gates `parse_define` opens with: the keyword and an
/// opening paren. A line that passes both is an attempted define even when
/// the rest is malformed.
fn is_attempted_define(trimmed: &str) -> bool {
    trimmed
        .strip_prefix("define")
        .map(str::trim_start)
        .is_some_and(|rest| rest.starts_with('('))
}

/// Name what is wrong with an attempted define. Only called after
/// `parse_define` returned None, so some branch below always fires.
/// `trimmed` is the comment-stripped line the parse actually saw; `raw`
/// is the line as written, needed to tell a truncating comment apart from
/// a genuinely unbalanced paren.
fn diagnose_define(trimmed: &str, raw: &str) -> String {
    let rest = trimmed
        .strip_prefix("define")
        .map(str::trim_start)
        .unwrap_or("");
    let Some(inside_plus) = rest.strip_prefix('(') else {
        return "expected `(` after define".to_string();
    };
    let Some((inside, after)) = split_outer_parens(inside_plus) else {
        // Comments are stripped before defines are parsed, so a `;` or
        // `//` INSIDE the body cuts the line off ahead of its real closing
        // paren. Reporting a missing `)` there names a character that is
        // sitting right there in the editor.
        if let Some(marker) = comment_inside_define_body(raw) {
            return format!(
                "the `{marker}` comment inside the body ends the line before the \
                 closing `)`. Move the comment after the `)`"
            );
        }
        return "the closing `)` is missing".to_string();
    };
    if !after.trim().is_empty() {
        return format!("unexpected text after the closing `)`: `{}`", after.trim());
    }
    let Some((name, _body)) = split_top_level_comma(inside) else {
        return "the comma between the name and the body is missing".to_string();
    };
    let name = name.trim();
    if name.is_empty() {
        return "the macro name is empty".to_string();
    }
    format!(
        "`{name}` is not a valid macro name (letters, digits and _ only, \
         not starting with a digit)"
    )
}

/// Which line-comment marker sits INSIDE a `define(...)` body, if that is
/// what broke the parse. `None` when the raw line is malformed for some
/// other reason, so the caller falls back to the structural diagnosis.
fn comment_inside_define_body(raw: &str) -> Option<&'static str> {
    let raw = raw.trim();
    // The line as written IS a well-formed define; only the comment strip
    // made it look otherwise.
    parse_define(raw)?;
    let kept = strip_comment(raw).len();
    if kept == raw.len() {
        return None;
    }
    if raw[kept..].starts_with("//") {
        Some("//")
    } else {
        Some(";")
    }
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

/// `undefine(`name')` (the GNU-required quoted form) or `undefine(name)`,
/// with one or more comma-separated names. Returns None when the line is
/// not an undefine call at all.
fn parse_undefine(trimmed: &str) -> Option<Vec<String>> {
    let rest = trimmed.strip_prefix("undefine")?;
    let rest = rest.trim_start();
    let inside_plus = rest.strip_prefix('(')?;
    // No paren tracker here: the m4 close-quote apostrophe would read as
    // an unterminated char literal to it. Undefine arguments are bare
    // (possibly quoted) names, so the last ')' is the call's close.
    let close = inside_plus.rfind(')')?;
    if !inside_plus[close + 1..].trim().is_empty() {
        return None;
    }
    let inside = &inside_plus[..close];
    let mut names = Vec::new();
    for part in inside.split(',') {
        let part = part.trim();
        let part = part.strip_prefix('`').unwrap_or(part);
        let part = part.strip_suffix('\'').unwrap_or(part);
        let part = part.trim();
        if part.is_empty() || !is_valid_ident(part) {
            return None;
        }
        names.push(part.to_string());
    }
    Some(names)
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

    #[test]
    fn aggregate_expansion_is_bounded() {
        // A 1 KiB macro body referenced 10000 times expands to ~10 MiB,
        // over the 8 MiB total cap. Each line is under the per-line cap, so
        // only the aggregate guard stops it.
        let body = "x".repeat(1024);
        let mut src = format!("define(big, {body})
");
        for _ in 0..10_000 {
            src.push_str("big
");
        }
        let err = expand(&src).unwrap_err();
        assert!(err.to_string().contains("MiB"), "was: {err}");
    }

    #[test]
    fn the_line_cap_fires_before_the_expansion_is_materialized() {
        // The cap used to be a length test on the finished string, so the
        // full expansion had to be built first. One round can multiply its
        // input by the body length: this line is 200_000 bytes of a
        // 4 KiB body, roughly 800 MB, and the 10^11-byte cases students
        // reach by accident would need ~100 GB -- an allocation abort on
        // wasm32, not an error message.
        let body = "z".repeat(4096);
        let refs = "big ".repeat(200_000);
        let src = format!("define(big, {body})\n{refs}\n");
        let started = std::time::Instant::now();
        let err = expand(&src).unwrap_err();
        assert!(err.to_string().contains("expansion"), "was: {err}");
        // Bailing during the walk touches ~64 KiB; building the whole
        // string first cannot come close to this bound.
        assert!(
            started.elapsed() < std::time::Duration::from_secs(2),
            "the cap has to fire before the allocation, took {:?}",
            started.elapsed()
        );
    }

    #[test]
    fn substitute_once_refuses_to_build_past_its_limit() {
        // The contract the guard above rests on, pinned directly: the
        // limit bounds what gets BUILT, so the caller never pays for the
        // expansion it is about to reject.
        let mut defines = HashMap::new();
        defines.insert("big".to_string(), "z".repeat(1024));
        let line = "big ".repeat(1000);
        assert!(substitute_once(&line, &defines, 4096).is_none());
        // Under the limit it still expands normally.
        assert_eq!(
            substitute_once("big", &defines, 4096),
            Some("z".repeat(1024))
        );
    }

    #[test]
    fn a_comment_inside_a_define_body_is_named_as_the_cause() {
        // Comments are stripped before defines are parsed, so `;` inside
        // the parens cut the line off and the error claimed the closing
        // `)` was missing while it sat right there in the editor.
        for (src, marker) in [
            ("define(NL, 10 ; newline)\n", ";"),
            ("define(NL, 10 // newline)\n", "//"),
        ] {
            let err = expand(src).unwrap_err().to_string();
            assert!(
                err.contains(&format!("`{marker}` comment inside the body")),
                "message was: {err}"
            );
            assert!(
                !err.contains("closing `)` is missing"),
                "message was: {err}"
            );
        }
        // A genuinely unbalanced define still gets the structural message.
        let err = expand("define(NL, 10\n").unwrap_err().to_string();
        assert!(err.contains("closing `)` is missing"), "message was: {err}");
    }

    #[test]
    fn define_events_keep_each_windowed_binding() {
        // `defines` collapses a redefined name onto its LAST body, which
        // is the wrong answer for anything that reports against a line.
        let src = "define(size, w19)\n\
                   mov size, 1\n\
                   undefine(`size')\n\
                   define(size, w21)\n\
                   mov size, 2\n";
        let r = exp(src);
        assert_eq!(r.defines.get("size").map(String::as_str), Some("w21"));
        assert!(r.windowed.contains("size"));
        assert_eq!(r.define_body_at("size", 2), Some("w19"));
        assert_eq!(r.define_body_at("size", 3), None, "past its undefine");
        assert_eq!(r.define_body_at("size", 5), Some("w21"));
        // A name defined once still binds across the whole file, so a use
        // above its define line keeps resolving.
        let r = exp("mov total, 1\ndefine(total, w20)\n");
        assert_eq!(r.define_body_at("total", 1), Some("w20"));
    }

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
    fn forward_reference_stays_unexpanded_like_gnu_m4() {
        // GNU m4 binds sequentially: a use above the define keeps the
        // bare name (and then fails to assemble, exactly as it does on
        // the course servers). The whole-file convenience made programs
        // work here that the servers reject.
        let r = exp("mov x0, fp\ndefine(fp, x29)\nmov x1, fp\n");
        assert_eq!(r.text, "mov x0, fp\n\nmov x1, x29");
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
        assert!(!r.defines.contains_key("alloc"));
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
    fn substitutes_inside_char_literal_like_gnu_m4() {
        // m4's own quotes are backtick/quote; a GAS char literal's `'` is
        // plain punctuation to it, so the name inside expands (verified
        // against GNU m4 on the course toolchain).
        let r = exp("define(A, X)\nmov w0, 'A'\n");
        assert_eq!(r.text, "\nmov w0, 'X'");
    }

    #[test]
    fn substitutes_inside_string_literal_like_gnu_m4() {
        // Double quotes mean nothing to m4 either: the server rewrites
        // the format string, so the playground must print the same bytes.
        let r = exp("define(name, WOOD)\n.string \"name is fire\"\n");
        assert_eq!(r.text, "\n.string \"WOOD is fire\"");
    }

    #[test]
    fn string_above_the_define_keeps_its_text() {
        // Sequential binding is what keeps the week-8 shape intact: the
        // `\n` in a string ABOVE define(n, w19) stays, while the same
        // escape below it is rewritten -- m4 knows nothing of GAS
        // escapes, so the `n` in `\n` is an ordinary identifier.
        let r = exp(".string \"b\\n\"\ndefine(n, w19)\n.string \"c\\n\"\n");
        assert_eq!(r.text, ".string \"b\\n\"\n\n.string \"c\\w19\"");
    }

    #[test]
    fn hash_starts_an_m4_comment_that_passes_through_verbatim() {
        // GNU m4 copies `#` to end of line unexpanded -- the reason the
        // course style writes bare immediates, never `#alloc`.
        let r = exp("define(alloc, 16)\nsub sp, sp, alloc\nsub sp, sp, #alloc\n");
        assert_eq!(r.text, "\nsub sp, sp, 16\nsub sp, sp, #alloc");
    }

    #[test]
    fn unknown_identifier_passes_through() {
        let r = exp("mov x0, xyzzy\n");
        assert_eq!(r.text, "mov x0, xyzzy");
    }

    #[test]
    fn non_ascii_in_string_literal_round_trips_verbatim() {
        // Widening bytes >= 0x80 through `as char` re-encodes them as two
        // bytes, so every non-ASCII byte doubled per round and expansion
        // never reached a fixed point. One accented char must round-trip.
        let r = exp(".string \"caf\u{e9}\"\n");
        assert_eq!(r.text, ".string \"caf\u{e9}\"");
    }

    #[test]
    fn non_ascii_outside_literals_round_trips_verbatim() {
        // An invisible NBSP pasted from a PDF must not detonate expansion;
        // the lexer owns rejecting it with a useful message.
        let r = exp("mov x0, 1\u{a0}\n");
        assert_eq!(r.text, "mov x0, 1\u{a0}");
    }

    #[test]
    fn define_substitutes_on_a_line_with_non_ascii_string_text() {
        // The guard against the latin-1 widening bug now walks the
        // SUBSTITUTING path through a literal: the accented bytes must
        // round-trip while the name beside them expands.
        let r = exp("define(fp, x29)\nmov x0, fp\n.string \"r\u{e9}sum\u{e9} fp\"\n");
        assert_eq!(r.text, "\nmov x0, x29\n.string \"r\u{e9}sum\u{e9} x29\"");
    }

    #[test]
    fn unterminated_block_comment_fails_naming_its_opening_line() {
        // The unclosed block used to swallow the rest of the file while
        // keeping line numbers aligned, so assemble reported SUCCESS on a
        // program reduced to nothing (or missing its ret).
        let err = expand("main:\n    mov x0, 1\n/*  mov x1, 2\n    ret\n").unwrap_err();
        match err {
            EmuError::PreprocError { line, message } => {
                assert_eq!(line, 3);
                assert!(message.contains("unterminated"), "message was: {message}");
            }
            other => panic!("expected PreprocError, got {other:?}"),
        }
    }

    #[test]
    fn closed_block_comments_still_blank_correctly() {
        let r = exp("/* header\nspanning lines */\nmov x0, 1\n");
        assert_eq!(r.text, "\n\nmov x0, 1");
    }

    #[test]
    fn runaway_define_growth_is_capped_by_line_length() {
        // A doubling chain stays under the 32-round recursion guard while
        // growing the line geometrically; the byte cap must stop it.
        let mut src = String::new();
        for i in 0..20 {
            src.push_str(&format!("define(g{i}, g{} g{})\n", i + 1, i + 1));
        }
        src.push_str("define(g20, x)\ng0\n");
        let err = expand(&src).unwrap_err();
        match err {
            EmuError::PreprocError { message, .. } => {
                assert!(message.contains("expansion"), "message was: {message}");
            }
            other => panic!("expected PreprocError, got {other:?}"),
        }
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
    fn redefined_names_follow_sequential_windows() {
        // Per-function register aliases, GNU style: the same name bound to
        // different registers in different stretches of the file must
        // substitute each body only over its own window.
        let src = "define(size, w19)\n\
                   mov size, 1\n\
                   undefine(`size')\n\
                   define(size, w21)\n\
                   mov size, 2\n";
        let r = exp(src);
        let lines: Vec<&str> = r.text.lines().collect();
        assert_eq!(lines[1], "mov w19, 1");
        assert_eq!(lines[4], "mov w21, 2");
    }

    #[test]
    fn undefined_names_stop_substituting() {
        let src = "define(tmp, w9)\nmov tmp, 1\nundefine(`tmp')\nmov tmp, 2\n";
        let r = exp(src);
        let lines: Vec<&str> = r.text.lines().collect();
        assert_eq!(lines[1], "mov w9, 1");
        assert_eq!(lines[3], "mov tmp, 2", "past its undefine the name is literal");
    }

    #[test]
    fn unquoted_undefine_is_accepted_too() {
        let src = "define(tmp, w9)\nundefine(tmp)\nmov tmp, 2\n";
        let r = exp(src);
        assert!(r.text.contains("mov tmp, 2"));
    }

    #[test]
    fn single_define_binds_sequentially_too() {
        // No whole-file exception for once-defined names: GNU m4 leaves
        // the use above the define alone.
        let src = "mov total, 1\ndefine(total, w20)\n";
        let r = exp(src);
        assert!(r.text.starts_with("mov total, 1"));
    }

    #[test]
    fn backtick_outside_undefine_still_errors() {
        let err = expand("define(`fp', x29)\n").unwrap_err();
        assert!(err.to_string().contains("backtick"));
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

    #[test]
    fn define_substitutes_every_use_on_one_line() {
        let r = exp("define(i_r, w20)\nadd i_r, i_r, 1\n");
        assert_eq!(r.text, "\nadd w20, w20, 1");
    }

    #[test]
    fn two_aliases_substitute_on_the_same_line() {
        let r = exp("define(fp, x29)\ndefine(lr, x30)\nstp fp, lr, [sp, -16]!\n");
        assert_eq!(r.text, "\n\nstp x29, x30, [sp, -16]!");
    }

    #[test]
    fn define_in_the_middle_keeps_lines_aligned() {
        let r = exp("mov x0, 1\ndefine(t_r, x9)\nmov t_r, 2\n");
        assert_eq!(r.text, "mov x0, 1\n\nmov x9, 2");
        assert_eq!(r.text.lines().count(), 3);
        assert_eq!(r.line_map, vec![1, 2, 3]);
    }

    #[test]
    fn chained_defines_stop_at_the_binding_in_effect() {
        // A -> B is bound at the use, B -> x5 only below it: GNU m4
        // expands A to B and stops, because B has no binding yet at that
        // line. The chain completes only when both defines sit above.
        let r = exp("define(A, B)\nmov x0, A\ndefine(B, x5)\nmov x1, A\n");
        assert_eq!(r.text, "\nmov x0, B\n\nmov x1, x5");
    }

    #[test]
    fn source_without_macros_passes_through_unchanged() {
        let src = "mov x0, 3\nadd x1, x0, 4\nsvc 0";
        let r = exp(src);
        assert_eq!(r.text, src);
        assert!(r.defines.is_empty());
        assert!(r.assignments.is_empty());
        assert_eq!(r.line_map, vec![1, 2, 3]);
    }

    #[test]
    fn unsupported_construct_error_carries_its_line_number() {
        let err = expand("mov x0, 1\nmov x1, 2\ndnl skip the rest\n").unwrap_err();
        match err {
            EmuError::PreprocError { line, message } => {
                assert_eq!(line, 3, "the error points at the dnl line");
                assert!(message.contains("dnl"), "message was: {message}");
            }
            other => panic!("expected PreprocError, got {other:?}"),
        }
    }

    #[test]
    fn block_comment_lines_blank_but_keep_line_count() {
        let r = exp("mov x0, 1/* header\nprose */\nmov x1, 2\n");
        assert_eq!(r.text, "mov x0, 1\n\nmov x1, 2");
        assert_eq!(r.line_map, vec![1, 2, 3]);
    }
}
