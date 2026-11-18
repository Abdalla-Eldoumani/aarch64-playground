//! m4 preprocessing for CPSC 355 source. Supports a narrow subset:
//!
//!   * define(NAME, BODY) and undefine(NAME): whole-token substitution of
//!     NAME on the lines below it. Use for register aliases
//!     (`define(score1_r, w19)`), not for numeric values.
//!   * Macros with arguments: `NAME(a, b)` puts `a` and `b` where the body
//!     says `$1` and `$2`. A define may quote its body (`define(sq,
//!     `mul $1, $1, $1')`), which keeps the commas and may span lines.
//!   * NAME = EXPRESSION lines pass through untouched, so the parser can
//!     evaluate them where they sit: in `msg_len = . - msg - 1`, `.` is
//!     the address of that line, not of wherever msg_len is used.
//!   * Expansion repeats until nothing changes, capped at 32 rounds so a
//!     loop fails with an error instead of hanging.
//!   * Comments are stripped first, so comment text never expands; a line
//!     that uses m4 quotes keeps its comments, as GNU m4 reads them.
//!   * Every output line maps back to the source line that produced it;
//!     they stay equal until a define or a macro body spans lines.
//!   * `dnl` deletes through the newline where the playground refused it
//!     before: on a line of its own, or after a define, undefine, divert
//!     or changecom call. Elsewhere it is an ordinary name (a `dnl:` label
//!     runs as it did).
//!   * `divert(-1)` throws the output away until `divert` or `divert(0)`;
//!     only define, undefine and dnl lines and m4 comments may sit in
//!     between. A numbered diversion is refused.
//!   * `changecom` turns comments off, and `changecom(`//')` moves the
//!     opener; a comment still ends at the line's end.
//!   * On a line whose source holds a backtick, `` `text' `` is written as
//!     `text`, unexpanded, and a quoted argument loses its quotes. The quote
//!     closes on its line. Other lines read a backtick as plain text, as
//!     they always have.
//!
//! Anything else (ifdef, ifelse, forloop, changequote, include) fails with
//! an "unsupported m4 construct" error at its line, unless the program
//! defined that name itself. So do divert, changecom and dnl where they
//! would run once the program has undefined them, and dnl once it has
//! defined it. In a program that uses dnl, divert, changecom or quotes,
//! so do divert, changecom, changequote or dnl as a define's unquoted name on
//! a line with quotes, and a comment whose text GNU m4 carries past its
//! line; any other program keeps the output it had.

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
    /// Expanded source, line for line what GNU m4 writes: a `define()`
    /// becomes one empty line even when its quoted body spans several, so
    /// a later error names the line of this text the server's gcc names.
    /// `name = expr` assignments stay intact so the parser can turn them
    /// into symbol assignments at their original offset.
    pub text: String,
    /// `line_map[i]` is the 1-based original source line that produced the
    /// 1-based expanded line `i + 1`: how the parser and the lint get back
    /// to editor lines once a define or a macro body spans lines.
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
    /// body)` with `None` for an undefine. `defines` keeps only a name's
    /// LAST body, so a warning about `define(size, w19)` would quote a later
    /// `w21`; anything reporting against a line reads `define_body_at`.
    pub define_events: Vec<(usize, String, Option<String>)>,
    /// Names whose bindings are windowed (redefined or undefined) rather
    /// than file-wide. For every other name `defines` is exact everywhere.
    pub windowed: std::collections::HashSet<String>,
    /// Every `changecom` in source order: its 1-based line and the comment
    /// opener from there on (None: comments off).
    comment_events: Vec<(usize, Option<String>)>,
    /// The 1-based source lines m4 read with quotes, in order.
    quote_lines: Vec<usize>,
}

impl Expanded {
    /// The `define()` body in effect for `name` at 1-based source `line`. A
    /// name defined once and never undefined binds across the whole file; a
    /// redefined or undefined name binds only over its own stretch.
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

    /// What opens an m4 comment at 1-based source `line`: `#` until a
    /// `changecom` moves or ends it.
    pub fn comment_at(&self, line: usize) -> Option<&str> {
        self.comment_events
            .iter()
            .rev()
            .find(|(at, _)| *at <= line)
            .map_or(Some("#"), |(_, opener)| opener.as_deref())
    }

    /// Whether m4 read quotes on 1-based source `line`: only a line whose
    /// text outside comments holds a backtick does.
    pub fn reads_quotes(&self, line: usize) -> bool {
        self.quote_lines.binary_search(&line).is_ok()
    }
}

/// Expand an m4 source file. Errors carry 1-based original line numbers.
pub fn expand(source: &str) -> Result<Expanded, EmuError> {
    let original = source;
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
    // Each kept line with its 0-based source line: a define spanning lines
    // keeps only its first, as GNU m4 writes one line for the whole call.
    // The flag marks a line whose newline a `dnl` took, so its text opens
    // the next line.
    let mut stripped: Vec<(usize, &str, bool)> = Vec::new();
    // Whether the program uses a form the playground refused before: a dnl,
    // divert or changecom that acts, m4 quotes, or its own ifdef, ifelse or
    // forloop. Only such a program has its comments checked below.
    let mut new_forms = false;
    let mut unquoted_name: Option<(usize, String)> = None;
    // Every define/undefine in source order: (line index, name, body;
    // None body = undefine). Order is what makes sequential redefinition
    // work below.
    let mut define_events: Vec<(usize, String, Option<String>)> = Vec::new();
    let lines: Vec<&str> = source.lines().collect();
    // Lines still inside a define that started above.
    let mut skip = 0;
    for (idx, raw) in lines.iter().enumerate() {
        let line_num = idx + 1;
        if skip > 0 {
            skip -= 1;
            continue;
        }
        let without_comment = strip_comment(raw);
        let trimmed = without_comment.trim();
        // undefine parses before the backtick gate: GNU m4 requires its
        // argument quoted (`undefine(`name')`), so the quote is legal here.
        if let Some((names, (text, joins))) = parse_undefine(trimmed) {
            for name in names {
                define_events.push((idx, name, None));
            }
            stripped.push((idx, text, joins));
            continue;
        }
        // The other place a quote is legal: a define's arguments, where a
        // quoted body keeps its commas and may run over several lines.
        if raw.contains('`') && is_attempted_define(raw.trim_start()) {
            let (name, body, used, (text, joins)) = parse_quoted_define(&lines[idx..], line_num)?;
            // On a line with quotes, GNU m4 runs these builtins among a
            // define's arguments before the define sees them, unless quoted;
            // refused below once the program uses the new forms.
            let quoted = raw[raw.find('(').map_or(0, |i| i + 1)..].trim_start().starts_with('`');
            if !quoted && without_comment.contains('`') && ["divert", "changecom", "changequote", "dnl"].contains(&name.as_str()) {
                unquoted_name.get_or_insert((line_num, name.clone()));
            }
            define_events.push((idx, name, Some(body)));
            stripped.push((idx, text, joins));
            skip = used - 1;
            continue;
        }
        // A `dnl` line: GNU m4 deletes it, newline and all.
        if let Some((text, true)) = after_call(without_comment) {
            stripped.push((idx, text, true));
            continue;
        }
        // A program's own macro of that name runs, as GNU m4 runs it.
        let own_macro = |kw: &str| {
            define_events
                .iter()
                .rev()
                .find(|(_, name, _)| name == kw)
                .is_some_and(|(_, _, body)| body.is_some())
        };
        if let Some(kw) = detect_unsupported(trimmed) {
            if !own_macro(kw) {
                return Err(unsupported(line_num, kw));
            }
            // The playground refused these before, a program's own included.
            new_forms |= kw.starts_with("if") || kw == "forloop";
        }
        if let Some((name, body, (text, joins))) = parse_define(trimmed) {
            define_events.push((idx, name, Some(body)));
            stripped.push((idx, text, joins));
            continue;
        }
        // The line got past both define gates (the keyword and the paren)
        // but failed to parse: it is a broken define, not an instruction.
        // Passing it through blames the student for an unknown mnemonic
        // spelled `DEFINE(FP,`.
        if is_attempted_define(trimmed) {
            return Err(EmuError::PreprocError {
                line: line_num,
                message: format!(
                    "malformed m4 define: {}. Write it as `define(NAME, body)`",
                    diagnose_define(trimmed, raw.trim())
                ),
            });
        }
        // A line that uses m4 quotes keeps its comments, as GNU m4 reads it:
        // the `//` in changecom(`//') is quoted text. The assembler strips
        // them after m4. Every such line was refused before.
        let kept = if without_comment.contains('`') { *raw } else { without_comment };
        if let Some((name, body)) = parse_assignment(trimmed) {
            assignments.insert(name, body);
            // Keep the assignment line intact so the parser can produce
            // a symbol-assignment item at this exact section offset. The
            // expression body may reference `.` or labels whose meaning
            // depends on where the assignment appears in the source.
            stripped.push((idx, kept, false));
            continue;
        }
        stripped.push((idx, kept, false));
    }

    // Find the names defined more than once or undefined, such as
    // per-function aliases (`define(size, w19)` ... `define(size, w21)`).
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

    // Pass 2: substitute `define()` aliases only; `name = expr` lines stay
    // verbatim for the parser. GNU m4 is sequential: a define binds only
    // the text below it, so a use above it stays unexpanded and fails to
    // assemble, as on the course servers. `current` picks each binding up
    // (and drops it on undefine) as the walk reaches its line.
    let mut events = define_events.iter().peekable();
    let mut out: Vec<String> = Vec::with_capacity(stripped.len());
    let mut line_map: Vec<usize> = Vec::with_capacity(stripped.len());
    let mut total: usize = 0;
    // The output line being built: a line whose newline a `dnl` took
    // leaves its text here for the next line to continue.
    let mut carry = String::new();
    // Under `divert(-1)`, GNU m4 throws its output away.
    let mut discard = false;
    let mut comment_events: Vec<(usize, Option<String>)> = Vec::new();
    let mut quote_lines: Vec<usize> = Vec::new();
    // The lines as written, collected only once a program uses divert(-1):
    // GNU m4 reads the comments the passes above drop.
    let mut written: Vec<&str> = Vec::new();
    for (k, (idx, line, joins)) in stripped.iter().enumerate() {
        let (idx, line_num) = (*idx, idx + 1);
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
        // GNU m4 drops a builtin for good once a define or undefine names
        // it; where the playground would run it, it refuses instead. A
        // divert or changecom the program defines is its own macro here.
        let touched = |name: &str| define_events.iter().any(|(at, n, _)| *at <= idx && n == name);
        let comment = comment_events.last().map_or(Some("#"), |(_, opener)| opener.as_deref());
        let quoted = line.contains('`');
        if quoted {
            quote_lines.push(line_num);
        }
        let joins = if let Some((name, args, (text, joins))) = builtin_call(line, &current) {
            if touched(name) {
                return Err(unsupported(line_num, &format!("{name} once the program undefines it")));
            }
            new_forms = true;
            // A numbered diversion goes to the end of GNU m4's output, and a
            // comment that ends anywhere but the line's end can span lines:
            // the line-for-line expansion here can follow neither, nor a name
            // GNU m4 would expand between the parentheses, nor a comment
            // there that hides the `)`. A comma means more than one
            // argument. Taking off quotes never lengthens the text, so
            // `args.len()` caps it.
            let arg = unquote(c_blanks(args), None, args.len()).unwrap_or_default();
            let supported = !args.contains(',')
                && !reads_on(args, comment)
                && if name == "divert" {
                    // GNU m4 reads the number as strtol does: blanks, a sign,
                    // then digits only; anything else leaves the diversion as
                    // it is. Past nine digits it wraps into another diversion.
                    let n = c_blanks(&arg);
                    let (minus, digits) = match n.strip_prefix('-') {
                        Some(digits) => (true, digits),
                        None => (false, n.strip_prefix('+').unwrap_or(n)),
                    };
                    let number = digits.trim_start_matches('0');
                    let numeric = arg.is_empty() || (!digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()));
                    if numeric {
                        discard = minus && !number.is_empty();
                    }
                    !numeric || number.is_empty() || (minus && number.len() < 10)
                } else {
                    comment_events.push((line_num, Some(arg).filter(|c| !c.is_empty())));
                    true
                };
            if !supported {
                return Err(unsupported(line_num, line.trim()));
            }
            if !discard {
                carry.push_str(text);
            }
            joins
        } else if discard {
            // GNU m4 reads the text it throws away, comments the playground
            // drops first included: a backtick there opens a quote, and a
            // `divert` ends the discard. The lines read alike here are blank
            // ones, define, undefine and dnl lines (pass 1 left them blank)
            // with no such comment before a `dnl`, and comments m4 itself
            // opens. An m4 quote's `'` hides a comment from strip_comment, so
            // any `//` or `;` counts, on every line a quoted define spans.
            if written.is_empty() {
                written.extend(original.lines());
            }
            let end = stripped.get(k + 1).map_or(lines.len(), |next| next.0);
            let blank = line.trim().is_empty()
                && (idx..end).all(|j| {
                    let raw = lines[j];
                    written[j] == raw && (*joins || !(raw.contains("//") || raw.contains(';')))
                });
            if !blank && !comment.is_some_and(|c| written[idx].trim_start().starts_with(c)) {
                return Err(unsupported(line_num, "text or a comment under divert(-1)"));
            }
            *joins
        } else {
            // Only a line whose own source holds a backtick reads m4 quotes:
            // the playground refused every such line before, so no program
            // that ran changes.
            let quotes = if quoted { Quotes::Keep } else { Quotes::Plain };
            let text = expand_recursively(line, &current, line_num, Gnu { comment, quotes })?;
            // Most lines start an empty carry: move the text in, not a copy.
            if carry.is_empty() {
                carry = text;
            } else {
                carry.push_str(&text);
            }
            *joins
        };
        if joins && touched("dnl") {
            return Err(unsupported(line_num, "dnl once the program defines or undefines it"));
        }
        new_forms |= joins || quoted;
        if discard || joins {
            continue;
        }
        let expanded = std::mem::take(&mut carry);
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
        // A macro body that spans lines gives one source line several;
        // each of them maps back to the line that called the macro.
        for _ in 0..=expanded.bytes().filter(|&c| c == b'\n').count() {
            line_map.push(line_num);
        }
        out.push(expanded);
    }

    let expanded = Expanded {
        text: out.join("\n"),
        line_map,
        defines,
        assignments,
        define_events: define_events
            .into_iter()
            .map(|(idx, name, body)| (idx + 1, name, body))
            .collect(),
        windowed,
        comment_events,
        quote_lines,
    };
    // GNU m4 reads the comments the passes above drop. In a program that
    // relies on a form the playground refused before, a comment whose text
    // GNU m4 carries past its own line is refused; others keep today's output.
    if new_forms {
        if let Some((line, name)) = unquoted_name {
            return Err(unsupported(line, &format!("define({name}) with the name unquoted")));
        }
        if written.is_empty() {
            written.extend(original.lines());
        }
        for (idx, (w, raw)) in written.iter().zip(&lines).enumerate() {
            let line = idx + 1;
            // A line a block comment touches is read from its `/*`, or whole.
            let start = if w != raw { w.find("/*").unwrap_or(0) } else if let Some(at) = comment_start(raw) { at } else { continue };
            // GNU m4's own comment, opened earlier on the line, covers it.
            if expanded.comment_at(line).is_some_and(|o| w[..start].contains(o)) {
                continue;
            }
            if let Some(token) = escapes(&w[start..], &expanded, line) {
                return Err(unsupported(line, &format!("{token} in a comment")));
            }
        }
    }
    Ok(expanded)
}

/// Where a `//` or `;` comment starts on a line, outside double-quoted
/// strings. A `'` opens nothing here: it may close an m4 quote.
fn comment_start(line: &str) -> Option<usize> {
    let b = line.as_bytes();
    let mut in_string = false;
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'\\' if in_string => i += 1,
            b'"' => in_string = !in_string,
            b';' if !in_string => return Some(i),
            b'/' if !in_string && b.get(i + 1) == Some(&b'/') => return Some(i),
            _ => {}
        }
        i += 1;
    }
    None
}

/// GNU m4 1.4.19's builtin macros, as its `dumpdef` lists them.
const GNU_BUILTINS: &str = "__file__ __gnu__ __line__ __program__ __unix__ builtin changecom changequote \
    debugfile debugmode decr define defn divert divnum dnl dumpdef errprint esyscmd eval format ifdef ifelse \
    include incr index indir len m4exit m4wrap maketemp mkstemp patsubst popdef pushdef regexp shift sinclude \
    substr syscmd sysval traceoff traceon translit undefine undivert";

/// The first thing in comment text that GNU m4 carries past the comment's
/// line (each checked against GNU m4 1.4.19): an unclosed quote; dnl,
/// changecom or m4exit; a builtin or macro called with `(`; or a macro whose
/// body spans lines. GNU m4's own comment opener ends the search.
fn escapes<'a>(text: &'a str, expanded: &Expanded, line: usize) -> Option<&'a str> {
    let b = text.as_bytes();
    let opener = expanded.comment_at(line);
    let mut i = 0;
    while i < b.len() {
        if opener.is_some_and(|o| b[i..].starts_with(o.as_bytes())) {
            return None;
        }
        if b[i] == b'`' {
            match quote_end(&b[i..]) {
                Some(n) => i += n,
                None => return Some("`"),
            }
            continue;
        }
        if !is_id_start_byte(b[i]) {
            i += 1;
            continue;
        }
        let start = i;
        while i < b.len() && is_id_continue_byte(b[i]) {
            i += 1;
        }
        let name = &text[start..i];
        let body = expanded.define_body_at(name, line);
        if b.get(i) == Some(&b'(') && (body.is_some() || GNU_BUILTINS.split(' ').any(|n| n == name)) {
            return Some(&text[start..=i]);
        }
        if matches!(name, "dnl" | "changecom" | "m4exit") || body.is_some_and(|body| body.contains('\n')) {
            return Some(name);
        }
    }
    None
}

fn expand_recursively(
    line: &str,
    defines: &HashMap<String, String>,
    line_num: usize,
    gnu: Gnu<'_>,
) -> Result<String, EmuError> {
    let mut current = line.to_string();
    let mut rounds = 0;
    loop {
        let next = substitute_bounded(&current, defines, line_num, gnu)?;
        if next == current {
            break;
        }
        // A line still changing one pass after MAX_RECURSION rounds has a
        // cycle and will never settle.
        if rounds == MAX_RECURSION {
            return Err(EmuError::PreprocError {
                line: line_num,
                message: format!("m4 recursion exceeded {MAX_RECURSION} rounds"),
            });
        }
        rounds += 1;
        current = next;
    }
    // GNU m4 writes a quoted string without its outer quotes, and never
    // reads it again.
    match gnu.quotes {
        Quotes::Keep => substitute_bounded(&current, defines, line_num, Gnu { quotes: Quotes::Strip, ..gnu }),
        _ => Ok(current),
    }
}

/// One expansion round with the per-line byte cap checked while the line
/// is built. Measuring the finished line would let a chain that multiplies
/// every round allocate gigabytes first, which aborts wasm instead of
/// giving an error. The cap never drops below the input's length, so a long
/// line that does not grow still passes.
fn substitute_bounded(
    line: &str,
    defines: &HashMap<String, String>,
    line_num: usize,
    gnu: Gnu<'_>,
) -> Result<String, EmuError> {
    let limit = MAX_EXPANDED_LINE_BYTES.max(line.len());
    substitute_once_gnu(line, defines, limit, gnu).map_err(|stop| EmuError::PreprocError {
        line: line_num,
        message: match stop {
            Stop::Cap => format!(
                "m4 expansion grew this line past {MAX_EXPANDED_LINE_BYTES} bytes; \
                 a define() chain is expanding without settling"
            ),
            Stop::Unclosed => "a macro's arguments run past the end of the line: the \
                               playground's m4 needs the closing `)` on the same line"
                .to_string(),
            Stop::Quote => "an m4 quote runs past the end of the line: the playground's \
                            m4 needs its closing quote on the same line"
                .to_string(),
        },
    })
}

/// Why a substitution round stopped short.
pub(crate) enum Stop {
    /// The line outgrew its byte cap.
    Cap,
    /// A macro call's argument list has no `)` on its line.
    Unclosed,
    /// A quoted string has no closing quote on its line.
    Quote,
}

/// How GNU m4 reads a line, which the `.req` pass does not share.
#[derive(Clone, Copy)]
struct Gnu<'a> {
    /// What opens a comment that runs to the line's end: `#` until a
    /// `changecom`, None once comments are off.
    comment: Option<&'a str>,
    quotes: Quotes,
}

/// What a backtick means on a line.
#[derive(Clone, Copy, PartialEq)]
enum Quotes {
    /// Plain text: the line's own source holds none.
    Plain,
    /// It opens a quoted string, copied whole and never expanded.
    Keep,
    /// The same, less its outer quotes: GNU m4's output, and an argument
    /// as GNU m4 collects it.
    Strip,
}

/// One token-boundary substitution pass over a line, refusing to build
/// more than `limit` bytes. `None` means the cap was reached; the caller
/// owns the message. String and char literals are copied verbatim: this
/// is the parser's `.req` alias pass, and GAS never rewrites literals
/// (docs/instruction-reference.md pins that). The m4 expander calls
/// `substitute_once_gnu` instead, which follows GNU m4's text-level rules.
pub(crate) fn substitute_once(
    line: &str,
    defines: &HashMap<String, String>,
    limit: usize,
) -> Option<String> {
    substitute_pass(line, defines, limit, None).ok()
}

/// GNU m4's view of a line: double quotes, single quotes, and backslashes
/// are plain punctuation (m4's own quotes are backtick/quote), so macro
/// names expand INSIDE string and char literals: `define(seconds, x22)`
/// rewrites `.string "%d seconds"` into `"%d x22"`, and the `n` in a
/// `"\n"` below `define(n, w19)` becomes `"\w19"`. A `#` starts an m4
/// comment: the rest of the line is copied verbatim, unexpanded. All
/// three behaviors verified against GNU m4 on the course toolchain. A
/// name with `(` right after it takes arguments, as in GNU m4. m4's own
/// quotes (backtick, then `'`) are read as `gnu.quotes` says.
fn substitute_once_gnu(
    line: &str,
    defines: &HashMap<String, String>,
    limit: usize,
    gnu: Gnu<'_>,
) -> Result<String, Stop> {
    substitute_pass(line, defines, limit, Some(gnu))
}

/// Text outside an identifier is copied as a byte slice of the input, never
/// through `as char`, which re-encodes a byte >= 0x80 as two UTF-8 bytes:
/// one pasted accented letter then doubled every round and expansion never
/// settled. Slices start and end on ASCII bytes or the line end, so
/// slicing stays UTF-8 safe while the scan walks raw bytes. `gnu` is None
/// for the `.req` pass.
fn substitute_pass(
    line: &str,
    defines: &HashMap<String, String>,
    limit: usize,
    gnu: Option<Gnu<'_>>,
) -> Result<String, Stop> {
    let respect_literals = gnu.is_none();
    let quotes = gnu.map_or(Quotes::Plain, |g| g.quotes);
    let comment = gnu.and_then(|g| g.comment);
    let comment_start = comment.and_then(|m| m.bytes().next());
    let bytes = line.as_bytes();
    let mut out = String::with_capacity(line.len());
    let mut i = 0;
    while i < bytes.len() {
        if out.len() > limit {
            return Err(Stop::Cap);
        }
        let b = bytes[i];
        if quotes != Quotes::Plain && b == b'`' {
            let end = i + quote_end(&bytes[i..]).ok_or(Stop::Quote)?;
            let strip = (quotes == Quotes::Strip) as usize;
            out.push_str(&line[i + strip..end - strip]);
            i = end;
            continue;
        }
        if comment_start == Some(b) && comment.is_some_and(|c| bytes[i..].starts_with(c.as_bytes())) {
            // GNU m4 comment: everything from `#` (or the opener a
            // `changecom` set) to the end of the line passes through
            // unexpanded, which is why the course style writes bare
            // immediates (`mov x0, 5`, never `#alloc`). A macro body can
            // put several lines into one.
            let end = line[i..].find('\n').map_or(line.len(), |n| i + n);
            out.push_str(&line[i..end]);
            i = end;
            continue;
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
                // GNU m4 takes arguments whenever `(` follows the name
                // directly, whether or not the body uses them.
                Some(body) if !respect_literals => {
                    let quoted = quotes != Quotes::Plain;
                    let mut args: Vec<String> = Vec::new();
                    if bytes.get(i) == Some(&b'(') {
                        let close = closing_paren(&line[i..], quoted).ok_or(Stop::Unclosed)?;
                        for arg in split_args(&line[i + 1..i + close], quoted) {
                            args.push(if quoted { unquote(arg, comment, limit)? } else { arg.to_string() });
                        }
                        i += close + 1;
                    }
                    fill_args(body, ident, &args, &mut out, limit)?;
                }
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
            if c == b'"'
                || c == b'\''
                || c == b'`'
                || comment_start == Some(c)
                || is_id_start_byte(c)
            {
                break;
            }
            i += 1;
        }
        out.push_str(&line[start..i]);
    }
    Ok(out)
}

/// Where the m4 quote that `b` opens with a backtick ends: just past its
/// matching `'`, counting the pairs nested inside. None when it never closes.
pub(super) fn quote_end(b: &[u8]) -> Option<usize> {
    let mut depth = 0usize;
    for (i, &c) in b.iter().enumerate() {
        match c {
            b'`' => depth += 1,
            b'\'' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i + 1);
                }
            }
            _ => {}
        }
    }
    None
}

/// `text` less one level of m4 quotes, as GNU m4 collects an argument.
fn unquote(text: &str, comment: Option<&str>, limit: usize) -> Result<String, Stop> {
    substitute_pass(text, &HashMap::new(), limit, Some(Gnu { comment, quotes: Quotes::Strip }))
}

/// Where the `)` closing the `(` that `s` starts with sits, if on this line.
/// With `quoted`, a parenthesis inside m4 quotes does not count.
fn closing_paren(s: &str, quoted: bool) -> Option<usize> {
    let b = s.as_bytes();
    let mut depth = 0usize;
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'`' if quoted => {
                i += quote_end(&b[i..])?;
                continue;
            }
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            b'\n' => return None,
            _ => {}
        }
        i += 1;
    }
    None
}

/// A call's arguments: split at the commas outside nested parentheses (and,
/// with `quoted`, outside m4 quotes), each without its leading whitespace.
/// `f()` has one, empty, argument.
fn split_args(inside: &str, quoted: bool) -> Vec<&str> {
    let b = inside.as_bytes();
    let mut args = Vec::new();
    let (mut depth, mut start, mut i) = (0usize, 0, 0);
    while i < b.len() {
        match b[i] {
            // `closing_paren` already found each quote here closed.
            b'`' if quoted => {
                i += quote_end(&b[i..]).unwrap_or(b.len() - i);
                continue;
            }
            b'(' => depth += 1,
            b')' => depth -= 1,
            b',' if depth == 0 => {
                args.push(inside[start..i].trim_start());
                start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    args.push(inside[start..].trim_start());
    args
}

/// A macro body with a call's arguments put in, as GNU m4 does it: `$1`,
/// `$2` and on (`$10` is the tenth), `$0` the name, `$#` how many, `$*` and
/// `$@` all of them joined by commas. An argument not given is empty.
fn fill_args(body: &str, name: &str, args: &[String], out: &mut String, limit: usize) -> Result<(), Stop> {
    let b = body.as_bytes();
    let mut i = 0;
    while i < b.len() {
        if out.len() > limit {
            return Err(Stop::Cap);
        }
        let start = i;
        i += 1;
        if b[start] == b'$' && i < b.len() {
            let digits = b[i..].iter().take_while(|c| c.is_ascii_digit()).count();
            if digits > 0 {
                let n: usize = body[i..i + digits].parse().unwrap_or(usize::MAX);
                out.push_str(if n == 0 { name } else { args.get(n - 1).map_or("", String::as_str) });
                i += digits;
                continue;
            }
            let whole = match b[i] {
                b'#' => Some(args.len().to_string()),
                b'*' | b'@' => Some(args.join(",")),
                _ => None,
            };
            if let Some(text) = whole {
                out.push_str(&text);
                i += 1;
                continue;
            }
        }
        while i < b.len() && b[i] != b'$' {
            i += 1;
        }
        out.push_str(&body[start..i]);
    }
    Ok(())
}

/// Blank `/* ... */` comments across the whole source, keeping their
/// newlines so line numbers match the editor. A `/*` inside a literal or a
/// `//` comment (left for `strip_comment`) never opens a block. Literal
/// state resets at each newline because assembly literals are single-line,
/// so one stray quote cannot swallow the rest of the file.
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
    // An unclosed block swallows everything after it while keeping the
    // line count intact, so the build reports SUCCESS on a program
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
    if after_call(after).is_none() {
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

/// What a line leaves after a builtin call: the text to write, and whether
/// a `dnl` took the line's newline.
type Leaves<'a> = (&'a str, bool);

/// What a call to a builtin leaves of its line, given the text after its
/// closing `)`: nothing, or GNU m4's `dnl`, which deletes through the
/// newline, so the blanks before it open the next line. None for any other
/// text.
fn after_call(tail: &str) -> Option<Leaves<'_>> {
    let rest = tail.trim_start();
    if rest.is_empty() {
        return Some(("", false));
    }
    let after = rest.strip_prefix("dnl")?;
    // The line forms the playground refused before: `dnl:` is a label.
    matches!(after.bytes().next(), None | Some(b' ' | b'\t')).then_some((&tail[..tail.len() - rest.len()], true))
}

/// A line that is one call to GNU m4's `divert` or `changecom`, bare or
/// with its arguments, and `dnl` after it if any: which one, the text
/// between its parentheses (empty when bare) and what the line leaves
/// (`after_call`). None for any other line, and when the program defined
/// the name itself, so its own macro runs as before.
fn builtin_call<'a>(
    line: &'a str,
    defines: &HashMap<String, String>,
) -> Option<(&'static str, &'a str, Leaves<'a>)> {
    let line = line.trim_start();
    let name = if line.starts_with("divert") {
        "divert"
    } else if line.starts_with("changecom") {
        "changecom"
    } else {
        return None;
    };
    let rest = &line[name.len()..];
    if rest.bytes().next().is_some_and(is_id_continue_byte) || defines.contains_key(name) {
        return None;
    }
    if !rest.starts_with('(') {
        return Some((name, "", after_call(rest)?));
    }
    let close = closing_paren(rest, true)?;
    Some((name, &rest[1..close], after_call(&rest[close + 1..])?))
}

/// The blanks C's isspace knows, which GNU m4 skips before an argument.
fn c_blanks(s: &str) -> &str {
    s.trim_start_matches(|c: char| c.is_ascii_whitespace() || c == '\x0b')
}

/// Whether GNU m4 would read a builtin's arguments past their own text: a
/// name outside quotes it may expand, or a comment that hides the `)`.
fn reads_on(args: &str, comment: Option<&str>) -> bool {
    let b = args.as_bytes();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'`' {
            i += quote_end(&b[i..]).unwrap_or(b.len() - i);
            continue;
        }
        if is_id_start_byte(b[i]) || comment.is_some_and(|c| b[i..].starts_with(c.as_bytes())) {
            return true;
        }
        i += 1;
    }
    false
}

/// The refusal of a construct the playground's m4 does not take.
#[cold]
fn unsupported(line: usize, what: &str) -> EmuError {
    EmuError::PreprocError { line, message: format!("unsupported m4 construct: {what}") }
}

fn parse_define(trimmed: &str) -> Option<(String, String, Leaves<'_>)> {
    // Tolerate `define (...)` with whitespace; bare "define" alone is not
    // a define so require the opening paren.
    let rest = trimmed.strip_prefix("define")?;
    let rest = rest.trim_start();
    let inside_plus = rest.strip_prefix('(')?;
    let (inside, after) = split_outer_parens(inside_plus)?;
    let tail = after_call(after)?;
    let (name, body) = split_top_level_comma(inside)?;
    // GNU m4 ignores arguments past the body, with a warning.
    let body = split_top_level_comma(body).map_or(body, |(body, _)| body);
    let name = name.trim().to_string();
    let body = body.trim().to_string();
    if name.is_empty() || !is_valid_ident(&name) {
        return None;
    }
    Some((name, body, tail))
}

/// A define whose arguments carry m4 quotes, read as GNU m4 reads them: a
/// quoted piece keeps its commas, parentheses and line breaks and loses one
/// level of quotes, unquoted leading whitespace is dropped, and arguments
/// past the body are ignored (GNU m4 warns and carries on). `lines` starts
/// at the define; the result is the name, the body with its comments
/// stripped, how many lines the call spans, and what the line after the
/// `)` leaves (`after_call`).
fn parse_quoted_define<'a>(
    lines: &[&'a str],
    line_num: usize,
) -> Result<(String, String, usize, Leaves<'a>), EmuError> {
    let bad = |why: &str| EmuError::PreprocError {
        line: line_num,
        message: format!("malformed m4 define: {why}. Write it as `define(NAME, body)`"),
    };
    let first = lines[0].trim_start();
    let first = &first[first.find('(').unwrap_or(0) + 1..];
    let mut args: Vec<String> = vec![String::new()];
    let (mut quotes, mut parens, mut leading) = (0usize, 0usize, true);
    for (used, line) in lines.iter().enumerate() {
        let text = if used == 0 { first } else { line };
        if used > 0 && (quotes > 0 || !leading) {
            args.last_mut().expect("args starts with one entry").push('\n');
        }
        for (i, c) in text.char_indices() {
            let arg = args.last_mut().expect("args starts with one entry");
            match c {
                '`' => {
                    if quotes > 0 {
                        arg.push(c);
                    }
                    quotes += 1;
                    leading = false;
                }
                '\'' if quotes > 0 => {
                    quotes -= 1;
                    if quotes > 0 {
                        arg.push(c);
                    }
                }
                _ if quotes > 0 => arg.push(c),
                _ if leading && c.is_whitespace() => {}
                ')' if parens == 0 => {
                    let Some(tail) = after_call(strip_comment(&text[i + 1..])) else {
                        return Err(bad("unexpected text after the closing `)`"));
                    };
                    let [name, body, ..] = args.as_slice() else {
                        return Err(bad("the comma between the name and the body is missing"));
                    };
                    if !is_valid_ident(name.trim_end()) {
                        return Err(bad(&format!("`{}` is not a valid macro name", name.trim_end())));
                    }
                    // Comments leave here, as they leave every other line.
                    let mut kept = String::with_capacity(body.len());
                    for (j, part) in body.split('\n').enumerate() {
                        if j > 0 {
                            kept.push('\n');
                        }
                        kept.push_str(strip_comment(part));
                    }
                    return Ok((name.trim_end().to_string(), kept, used + 1, tail));
                }
                ',' if parens == 0 => {
                    args.push(String::new());
                    leading = true;
                }
                _ => {
                    parens = match c {
                        '(' => parens + 1,
                        ')' => parens - 1,
                        _ => parens,
                    };
                    arg.push(c);
                    leading = false;
                }
            }
        }
    }
    Err(bad("the closing `)` is missing"))
}

/// `undefine(`name')` (the GNU-required quoted form) or `undefine(name)`,
/// with one or more comma-separated names, and what the line after the `)`
/// leaves (`after_call`). Returns None when the line is not an undefine
/// call at all.
fn parse_undefine(trimmed: &str) -> Option<(Vec<String>, Leaves<'_>)> {
    let rest = trimmed.strip_prefix("undefine")?;
    let rest = rest.trim_start();
    let inside_plus = rest.strip_prefix('(')?;
    // No paren tracker here: the m4 close-quote apostrophe would read as
    // an unterminated char literal to it. Undefine arguments are bare
    // (possibly quoted) names, so the last ')' is the call's close.
    let close = inside_plus.rfind(')')?;
    let tail = after_call(&inside_plus[close + 1..])?;
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
    Some((names, tail))
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
    for kw in &["ifdef", "ifelse", "forloop", "changequote", "include"] {
        if let Some(after) = line.strip_prefix(kw) {
            if after.trim_start().starts_with('(') {
                return Some(kw);
            }
        }
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
    use crate::test_support::rejects;

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
        // A length test on the finished string would build the full
        // expansion first. One round can multiply its input by the body
        // length: this line is 200_000 bytes of a 4 KiB body, roughly
        // 800 MB, and the 10^11-byte cases students reach by accident
        // would need ~100 GB, an allocation abort on wasm32, not an error
        // message.
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
        // the parens cuts the line off and the error would claim the
        // closing `)` is missing while it sits right there in the editor.
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
        // the course servers). A whole-file binding would make programs
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
        // escape below it is rewritten: m4 knows nothing of GAS
        // escapes, so the `n` in `\n` is an ordinary identifier.
        let r = exp(".string \"b\\n\"\ndefine(n, w19)\n.string \"c\\n\"\n");
        assert_eq!(r.text, ".string \"b\\n\"\n\n.string \"c\\w19\"");
    }

    #[test]
    fn hash_starts_an_m4_comment_that_passes_through_verbatim() {
        // GNU m4 copies `#` to end of line unexpanded: the reason the
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
        // bytes, so every non-ASCII byte doubles per round and expansion
        // never reaches a fixed point. One accented char must round-trip.
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
        // An unclosed block swallows the rest of the file while keeping
        // line numbers aligned, so assemble would report SUCCESS on a
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
        rejects(expand("ifelse(1, 2, yes, no)\n"), "unsupported m4 construct: ifelse");
    }

    #[test]
    fn forloop_is_rejected() {
        rejects(expand("forloop(i, 0, 5, foo)\n"), "unsupported m4 construct: forloop");
    }

    #[test]
    fn changequote_is_rejected_unless_the_program_defines_it() {
        // Read as text, the quotes it names reach the assembler as data.
        rejects(expand("changequote([,])\n"), "unsupported m4 construct: changequote");
        // A program's own changequote macro runs, as it did before and as
        // GNU m4 1.4.19 runs it.
        assert_eq!(exp("define(`changequote', nop)\nchangequote([,])\n").text, "\nnop");
    }

    #[test]
    fn include_is_rejected_unless_the_program_defines_it() {
        // GNU m4 reads the named file in at that line; the playground's m4
        // reads no other file, so an include line gets m4's refusal, not
        // the assembler's unknown mnemonic.
        rejects(expand("include(`helpers.s')\nmov x0, 1\n"), "unsupported m4 construct: include");
        // GNU m4 1.4.19 runs a program's own include macro too.
        assert_eq!(exp("define(include, nop)\ninclude(x)\n").text, "\nnop");
    }

    /// The text and line map, for comparing with GNU m4's output.
    fn text_and_map(src: &str) -> (String, Vec<usize>) {
        let r = exp(src);
        (r.text, r.line_map)
    }

    /// GNU m4's output (its last newline dropped) and the source line of
    /// each of its lines.
    fn gnu(text: &str, map: &[usize]) -> (String, Vec<usize>) {
        (text.to_string(), map.to_vec())
    }

    #[test]
    fn dnl_deletes_through_the_newline_like_gnu_m4() {
        // GNU m4 1.4.19's output for each source: a `dnl` line, and a define,
        // undefine or quoted define followed by `dnl`, write no line, and
        // the blanks before `dnl` start the next line.
        assert_eq!(text_and_map("define(fp, x29)dnl\nmov x0, fp\n"), gnu("mov x0, x29", &[2]));
        assert_eq!(text_and_map("dnl a whole-line comment\nmov x0, 1\n"), gnu("mov x0, 1", &[2]));
        assert_eq!(text_and_map("  dnl indented\nmov x0, 1\n"), gnu("  mov x0, 1", &[2]));
        assert_eq!(text_and_map("define(`fp', `x29')dnl\nmov x0, fp\n"), gnu("mov x0, x29", &[2]));
        assert_eq!(
            text_and_map("define(`two', `add x0, x0, 1\n  add x0, x0, 2')dnl\ntwo\nmov x1, 3\n"),
            gnu("add x0, x0, 1\n  add x0, x0, 2\nmov x1, 3", &[3, 3, 4])
        );
        assert_eq!(
            text_and_map("define(fp, x29)\nundefine(`fp')dnl\nmov x0, fp\n"),
            gnu("\nmov x0, fp", &[1, 3])
        );
        assert_eq!(
            text_and_map("define(fp, x29) dnl trailing words\nmov x0, fp\n"),
            gnu(" mov x0, x29", &[2])
        );
    }

    #[test]
    fn divert_minus_one_discards_until_divert_like_gnu_m4() {
        // GNU m4 1.4.19: the lines under `divert(-1)` (any negative number)
        // write nothing, defines among them still bind, and the `divert` or
        // `divert(0)` that ends them writes an empty line, or none with `dnl`.
        assert_eq!(
            text_and_map("divert(-1)\ndefine(fp, x29)\ndivert\nmov x0, fp\n"),
            gnu("\nmov x0, x29", &[3, 4])
        );
        assert_eq!(
            text_and_map("divert(-1)\ndefine(fp, x29)\ndivert(0)dnl\nmov x0, fp\n"),
            gnu("mov x0, x29", &[4])
        );
        assert_eq!(
            text_and_map("divert(-1)\ndefine(fp, x29)\ndivert(0)dnl back to fp, lr\nmov x0, fp\n"),
            gnu("mov x0, x29", &[4])
        );
        assert_eq!(
            text_and_map("divert(-1)\ndefine(fp, x29)\ndivert(0)\nmov x0, fp\n"),
            gnu("\nmov x0, x29", &[3, 4])
        );
        assert_eq!(text_and_map("divert(-2)\ndefine(a, x1)\ndivert\nmov x0, a\n"), gnu("\nmov x0, x1", &[3, 4]));
        // GNU m4 writes a numbered diversion at the end of its output; the
        // playground refuses one.
        rejects(expand("divert(1)\nmov x0, 1\ndivert\nmov x1, 2\n"), "unsupported m4 construct: divert(1)");
        // A program's own `divert` macro runs as it did, and a longer name
        // is not `divert`.
        assert_eq!(exp("define(divert, nop)\ndivert\n").text, "\nnop");
        assert_eq!(exp("divertdnl\n").text, "divertdnl");
    }

    #[test]
    fn divert_reads_its_number_like_gnu_m4() {
        // GNU m4 1.4.19 reads the number as strtol does: blanks, a sign and
        // digits with nothing after them. `-0` is diversion 0, and anything
        // else, a blank before the `)` included, leaves the diversion as is.
        let kept = gnu("\nmov x0, 1\n\nmov x1, 2", &[1, 2, 3, 4]);
        assert_eq!(text_and_map("divert(-0)\nmov x0, 1\ndivert\nmov x1, 2\n"), kept);
        assert_eq!(text_and_map("divert(-1 )\nmov x0, 1\ndivert\nmov x1, 2\n"), kept);
        for arg in ["-00", "+0", "-", "--1"] {
            let src = format!("divert({arg})\nmov x0, 1\n");
            assert_eq!(text_and_map(&src), gnu("\nmov x0, 1", &[1, 2]), "{arg}");
        }
        for arg in ["` -1'", "-0001", "-999999999"] {
            let src = format!("divert({arg})\ndefine(a, x1)\ndivert\nmov x0, a\n");
            assert_eq!(text_and_map(&src), gnu("\nmov x0, x1", &[3, 4]), "{arg}");
        }
        assert_eq!(
            text_and_map("divert(-1)\ndivert(-1 )\ndefine(a, x1)\ndivert\nmov x0, a\n"),
            gnu("\nmov x0, x1", &[4, 5])
        );
        // GNU m4 expands a name there, reads a comment there on past the
        // `)`, and wraps a number past nine digits into another diversion;
        // the playground refuses each.
        rejects(expand("define(off, -1)\ndivert(off)\n"), "unsupported m4 construct: divert(off)");
        rejects(expand("divert(x)\nmov x0, 1\n"), "unsupported m4 construct: divert(x)");
        rejects(expand("divert(1x)\nmov x0, 1\n"), "unsupported m4 construct: divert(1x)");
        rejects(expand("divert(#)\nmov x0, 1\nmov x1, 2)\n"), "unsupported m4 construct: divert(#)");
        rejects(expand("divert(-4294967295)\n"), "unsupported m4 construct: divert(-4294967295)");
        rejects(expand("divert(4294967296)\n"), "unsupported m4 construct: divert(4294967296)");
        rejects(expand("divert(+1)\n"), "unsupported m4 construct: divert(+1)");
    }

    #[test]
    fn text_under_divert_minus_one_is_refused() {
        // GNU m4 reads every line it throws away: a backtick there opens a
        // quote, and a `divert` mid-line, even in a `//` or `/* */` comment,
        // ends the discard. The playground reads only define, undefine and
        // dnl lines there, and comments its m4 knows, and refuses the rest.
        for src in [
            "divert(-1)\ndefine(fp, x29)\nstray text\ndivert\nmov x0, fp\n",
            "divert(-1)\nThis file`s helpers\ndivert\nmov x0, 1\n",
            "divert(-1)\nuse divert to switch\ndefine(a, x19)\ndivert\nmov x0, a\n",
            "divert(-1)\n// use divert to switch\ndefine(a, x19)\ndivert\nmov x0, a\n",
            "divert(-1)\n// don`t\ndefine(a, x19)\ndivert\nmov x0, a\n",
            "divert(-1)\ndefine(a, x19) // the counter\ndivert\nmov x0, a\n",
            "divert(-1)\ndefine(a, `x19') // use divert to switch\ndivert\nmov x0, a\n",
            "divert(-1)\ndefine(a, `x19') // don`t\ndivert\nmov x0, a\n",
            "divert(-1)\ndefine(`two', `add x0, x0, 1\n  add x0, x0, 2') // use divert to switch\ndivert\nmov x0, 1\n",
            "divert(-1)\ndefine(`two', `add x0, x0, 1\n  add x0, x0, 2') // don`t\ndivert\nmov x0, 1\n",
            "divert(-1)\n/* switch back with divert */\ndefine(a, x19)\ndivert\nmov x0, a\n",
            "divert(-1)\n/* aliases\n   for the frame */\ndefine(a, x19)\ndivert\nmov x0, a\n",
        ] {
            rejects(expand(src), "unsupported m4 construct: text or a comment under divert(-1)");
        }
        // What it does read there comes out as GNU m4 1.4.19 writes it.
        assert_eq!(
            text_and_map("divert(-1)\n\n  \ndefine(a, x19)\nundefine(`a')\ndefine(`b', `x20')\ndivert\nmov x0, b\n"),
            gnu("\nmov x0, x20", &[7, 8])
        );
        assert_eq!(text_and_map("divert(-1)\n# aliases\ndefine(a, x19)\ndivert\nmov x0, a\n"), gnu("\nmov x0, x19", &[4, 5]));
        assert_eq!(
            text_and_map("divert(-1)\ndnl aliases; a semicolon\ndefine(a, x19)dnl ; x\ndivert\nmov x0, a\n"),
            gnu("\nmov x0, x19", &[4, 5])
        );
        assert_eq!(
            text_and_map("divert(-1)\ndefine(a, `x19')dnl // use divert to switch\ndivert\nmov x0, a\n"),
            gnu("\nmov x0, x19", &[3, 4])
        );
        assert_eq!(
            text_and_map("divert(-1)\ndefine(`two', `add x0, x0, 1\n  add x0, x0, 2')\ndivert\nmov x0, 1\n"),
            gnu("\nmov x0, 1", &[4, 5])
        );
        assert_eq!(text_and_map("divert( -1)\ndefine(a, x1)\ndivert\nmov x0, a\n"), gnu("\nmov x0, x1", &[3, 4]));
        assert_eq!(
            text_and_map("changecom(`//')\ndivert(-1)\n// don`t divert\ndefine(a, x19)\ndivert\nmov x0, a\n"),
            gnu("\n\nmov x0, x19", &[1, 5, 6])
        );
    }

    #[test]
    fn a_builtin_the_program_defines_or_undefines_is_refused_where_it_would_run() {
        // GNU m4 1.4.19 runs a program's own `dnl` macro, and writes divert
        // and changecom as text once a quoted undefine removed them. The
        // playground refuses each where it would have run the builtin, an
        // unquoted undefine (after which GNU m4 keeps divert) included; a
        // program's own divert or changecom macro runs.
        let dnl = "unsupported m4 construct: dnl once the program defines or undefines it";
        rejects(expand("define(`dnl', `mov x0, 7')\ndnl\nmov x1, 2\n"), dnl);
        rejects(expand("define(`dnl', `mov x0, 7')\ndefine(a, x1)dnl\nmov a, 2\n"), dnl);
        rejects(expand("define(`dnl', `divert')\ndivert(-1)\ndefine(a, x1)dnl\nmov a, 2\n"), dnl);
        rejects(expand("undefine(`dnl')\ndefine(a, x1)dnl\nmov a, 2\n"), dnl);
        let divert = "unsupported m4 construct: divert once the program undefines it";
        rejects(expand("undefine(`divert')\ndivert(-1)\nmov x0, 1\n"), divert);
        rejects(expand("undefine(divert)\ndivert(-1)\nmov x0, 1\ndivert\nmov x1, 2\n"), divert);
        rejects(expand("define(`divert', `nop')\nundefine(`divert')\ndivert(-1)\nmov x0, 1\n"), divert);
        rejects(
            expand("undefine(`changecom')\nchangecom\ndefine(n, 4)\nmov x0, #n\n"),
            "unsupported m4 construct: changecom once the program undefines it",
        );
        // Without such a use the program builds as it does today, and a
        // quoted define of divert runs as GNU m4 runs it.
        assert_eq!(exp("undefine(`divert')\ndefine(dnl, x19)\nmov dnl, 1\n").text, "\n\nmov x19, 1");
        assert_eq!(exp("define(`divert', `nop')\ndivert(-1)\n").text, "\nnop");
    }

    #[test]
    fn an_unquoted_builtin_name_in_a_quoted_define_is_refused() {
        // On a line with quotes, GNU m4 1.4.19 runs an unquoted divert,
        // changecom, changequote or dnl among a define's arguments before
        // the define sees it; the playground refuses that in a program that
        // uses dnl, divert, changecom or quotes. Quoted, the name is the
        // program's own macro.
        for name in ["divert", "changecom", "changequote", "dnl"] {
            let refusal = format!("unsupported m4 construct: define({name}) with the name unquoted");
            rejects(expand(&format!("define({name}, `x')\nmov x0, `a'\n")), &refusal);
        }
        assert_eq!(exp("define( `divert', `nop')\ndivert(-1)\n").text, "\nnop");
        // Any other program builds as it does today: a quoted define is no
        // new form, nor is a backtick only in a comment.
        assert_eq!(exp("define(dnl, `x19')\nmov dnl, 1\n").text, "\nmov x19, 1");
        assert_eq!(exp("define(divert, nop) // it`s\ndivert\n").text, "\nnop");
    }

    #[test]
    fn a_comment_gnu_m4_reads_past_its_line_is_refused_once_a_program_uses_the_new_forms() {
        // GNU m4 1.4.19 reads `//`, `;` and `/* */` comments as text, and
        // each comment below acts past its own line there. A program that
        // uses dnl, divert, changecom or quotes is refused at that comment.
        let new = "define(n, 4)dnl\ndefine(`two', `add x0, x0, 1\n  add x0, x0, 2')dnl\n";
        for (comment, token) in [
            ("// don`t", "`"),
            ("// dnl here", "dnl"),
            ("; dnl here", "dnl"),
            ("/* dnl here */", "dnl"),
            ("// changecom here", "changecom"),
            ("// m4exit here", "m4exit"),
            ("// divert(-1) here", "divert("),
            ("// undefine(`n') here", "undefine("),
            ("// len(abc here", "len("),
            ("// n(1 here", "n("),
            ("// two adds", "two"),
        ] {
            let refusal = format!("unsupported m4 construct: {token} in a comment");
            rejects(expand(&format!("{new}mov x0, 1 {comment}\nmov x1, 2\n")), &refusal);
        }
        // What stays on its line in GNU m4 builds.
        for comment in ["// use `n' here", "// n is the count", "// printf(fmt here", "// divert here", "// see # dnl here"] {
            assert!(expand(&format!("{new}mov x0, 1 {comment}\nmov x1, 2\n")).is_ok(), "{comment}");
        }
        // A program without those forms keeps today's output; a quoted
        // define, which the playground took before, is none of them.
        assert_eq!(exp("define(n, 4)\nmov x0, 1 // dnl here\nmov x1, 2\n").text, "\nmov x0, 1 \nmov x1, 2");
        let quoted_define = "define(`two', `add x0, x0, 1\n  add x0, x0, 2')\ntwo // two adds, dnl\n";
        assert_eq!(exp(quoted_define).text, "\nadd x0, x0, 1\n  add x0, x0, 2 ");
    }

    #[test]
    fn what_gnu_m4_reads_in_a_define_name_or_past_a_quoted_hash_is_refused_in_a_new_form_program() {
        // GNU m4 1.4.19 runs a builtin named unquoted as define's first
        // argument, quotes or not on the line: dnl stops at the end of the
        // file, divert writes `mov , 2` and divnum `mov 0, 2`.
        for name in ["dnl", "divert", "divnum"] {
            let src = format!("define({name}, w0)\nchangecom(`//')\nmov {name}, 2\n");
            let refusal = format!("unsupported m4 construct: define({name}) with the name unquoted");
            rejects(expand(&src), &refusal);
        }
        // A program without the new forms keeps today's output.
        assert_eq!(exp("define(divert, w0)\nmov divert, 2\n").text, "\nmov w0, 2");
        // A quoted `#` opens no comment, so GNU m4 reads the `//` comment
        // after it, and its dnl takes the next line.
        rejects(expand("define(a, w0)dnl\nmov a, `#'3 // dnl\nmov w0, 5\n"), "unsupported m4 construct: dnl in a comment");
        // A one-line macro in a comment expands there to what it names: a
        // macro that spans lines, or dnl.
        let multi = "define(`two', `mov w1, 1\n  mov w0, 4')dnl\ndefine(`one', `two')dnl\nmov w0, 3 // one\n";
        rejects(expand(multi), "unsupported m4 construct: one in a comment");
        rejects(expand("define(`nl', `dnl')dnl\nmov w0, 3 // nl\nmov w0, 5\n"), "unsupported m4 construct: nl in a comment");
    }

    #[test]
    fn changecom_moves_or_ends_the_comment_like_gnu_m4() {
        // GNU m4 1.4.19: once `#` opens no comment, the name after it
        // expands; after changecom(`@') an `@` opens one instead.
        for (first, opener) in [("changecom", None), ("changecom()", None), ("changecom(`//')", Some("//"))] {
            let src = format!("{first}\ndefine(n, 4)\nmov x0, #n\n");
            assert_eq!(text_and_map(&src), gnu("\n\nmov x0, #4", &[1, 2, 3]), "{first}");
            assert_eq!(exp(&src).comment_at(3), opener, "{first}");
        }
        assert_eq!(exp("changecom(`@')\ndefine(n, 4)\nmov x0, #n @ n\n").text, "\n\nmov x0, #4 @ n");
        assert_eq!(exp("mov x0, 1\n").comment_at(1), Some("#"));
        // GNU m4 ends a comment at any string it is given; the playground's
        // end at the line's end.
        rejects(expand("changecom(`@', `!')\n"), "unsupported m4 construct: changecom(`@', `!')");
        // GNU m4 expands a name in the parentheses (`@` here), and a `#`
        // there opens a comment that hides the `)`; the playground refuses
        // both.
        rejects(expand("define(c, @)\nchangecom(c)\n"), "unsupported m4 construct: changecom(c)");
        rejects(expand("changecom(#)\nmov x1, 2)\n"), "unsupported m4 construct: changecom(#)");
    }

    #[test]
    fn dnl_as_a_label_keeps_todays_output() {
        // GNU m4 deletes from each `dnl` here (`main:\n  b.ge   ret`), so
        // gcc refuses the program; it runs here today, so it stays as is.
        let src = "main:\n  b.ge dnl\ndnl:\n  ret\n";
        assert_eq!(exp(src).text, "main:\n  b.ge dnl\ndnl:\n  ret");
    }

    #[test]
    fn a_quoted_string_loses_one_level_of_quotes_like_gnu_m4() {
        // GNU m4 1.4.19: quoted text is written without its outer quotes and
        // never expanded, a quoted argument is collected without them (and
        // its body is read again), and a comment keeps its quotes.
        let fp = "define(fp, x29)\n";
        let after = |line: &str| exp(&format!("{fp}{line}\n")).text;
        assert_eq!(after("mov x0, `fp'"), "\nmov x0, fp");
        assert_eq!(after("mov x0, ``fp''"), "\nmov x0, `fp'");
        assert_eq!(after("mov x0, fp`'x"), "\nmov x0, x29x");
        assert_eq!(after(".string \"`fp' is fp\""), "\n.string \"fp is x29\"");
        assert_eq!(after("mov x0, 1 # `fp' fp"), "\nmov x0, 1 # `fp' fp");
        assert_eq!(after("define(q, `$1')\nmov x0, q(`fp')"), "\n\nmov x0, x29");
        assert_eq!(exp("define(f, `[$1|$2]')\nf(`a,b', c)\n").text, "\n[a,b|c]");
        assert_eq!(exp("define(f, `[$1]')\nf(`)')\n").text, "\n[)]");
        // GNU m4 reads on to a closing quote on a later line; the playground
        // needs it on the same line, as it does a macro's `)`.
        rejects(expand("mov x0, `fp\nmov x1, 2'\n"), "closing quote on the same line");
    }

    #[test]
    fn lines_with_no_quote_of_their_own_keep_todays_output() {
        // GNU m4 strips the quotes a define's body still holds (`a b c`) and
        // reads quotes inside `//` comments; both run here today as below,
        // so they stay.
        assert_eq!(exp("define(x, `a `b' c')\nx\n").text, "\na `b' c");
        assert_eq!(exp("mov x0, 1 // don`t\n").text, "mov x0, 1 ");
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
    fn a_define_may_quote_its_name_and_body() {
        let r = exp("define(`fp', `x29')\nmov x0, fp\n");
        assert_eq!(r.text, "\nmov x0, x29");
    }

    #[test]
    fn a_macro_takes_its_arguments_like_gnu_m4() {
        // The shapes of the csarm run: the count, each argument without
        // its leading blanks, all of them joined, the tenth, and the
        // arguments of a macro whose body never uses them.
        let src = "define(show, `$# [$1] [$2] [$*]')\n\
                   show(a, b,c)\nshow( pad , y )\nshow\nshow(f(1, 2), z)\n\
                   define(tenth, `[$10]')\ntenth(1,2,3,4,5,6,7,8,9,ten)\n\
                   define(two, first, second)\ntwo\ndefine(plain, x21)\nplain(ignored)\n";
        let lines: Vec<String> = exp(src).text.lines().map(str::to_string).collect();
        assert_eq!(lines[1], "3 [a] [b] [a,b,c]");
        assert_eq!(lines[2], "2 [pad ] [y ] [pad ,y ]");
        assert_eq!(lines[3], "0 [] [] []");
        assert_eq!(lines[4], "2 [f(1, 2)] [z] [f(1, 2),z]");
        assert_eq!(lines[6], "[ten]");
        assert_eq!(lines[8], "first");
        assert_eq!(lines[10], "x21");
    }

    #[test]
    fn a_body_spanning_lines_maps_each_line_to_its_call() {
        let src = "define(t_r, x19)\n\
                   define(tri_open, `add     $1, $2, 1   // comments leave\n\
                   \x20       lsr     $1, $1, 1')\n\
                   mov x0, 1\n\
                   tri_open(t_r, x20)\n";
        let r = exp(src);
        // The define over lines 2 and 3 writes one empty line, as GNU m4's does.
        assert_eq!(
            r.text,
            "\n\nmov x0, 1\nadd     x19, x20, 1   \n        lsr     x19, x19, 1"
        );
        assert_eq!(r.line_map, vec![1, 2, 4, 5, 5]);
    }

    #[test]
    fn macro_arguments_close_on_their_own_line() {
        rejects(
            expand("define(sq, `mul $1, $1, $1')\nsq(x0,\n"),
            "closing `)` on the same line",
        );
        rejects(expand("define(sq, `mul $1\n"), "closing `)` is missing");
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
        let err = expand("mov x0, 1\nmov x1, 2\nforloop(i, 0, 5, foo)\n").unwrap_err();
        match err {
            EmuError::PreprocError { line, message } => {
                assert_eq!(line, 3, "the error points at the forloop line");
                assert!(message.contains("forloop"), "message was: {message}");
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
