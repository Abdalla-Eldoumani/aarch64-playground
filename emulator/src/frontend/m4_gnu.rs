//! GNU m4 1.4.19's own order, for the programs the line-at-a-time pass in
//! `m4` cannot read: m4 runs over the source with its comments still in
//! it, as on the course servers, and `m4::expand` strips the comments from
//! what it writes. `m4::expand` decides which programs come here.
//!
//! The scanner is GNU m4's input engine: names, nested `' quotes, `#`
//! comments (or `changecom`'s) copied unexpanded, macro calls whose
//! arguments run across lines, and every expansion read again as input.
//! It runs `define`, `undefine`, `dnl`, `divert` (-1 and 0), `divnum` and
//! `changecom`; each other GNU builtin is refused by name.

use std::borrow::Cow;
use std::collections::HashMap;
use std::rc::Rc;

use super::m4::{MAX_EXPANDED_LINE_BYTES, MAX_EXPANDED_TOTAL_BYTES, MAX_EXPANSION_WORK_BYTES};
use crate::errors::EmuError;

/// Macro calls nested inside one another's arguments. Each level is a
/// stack frame here, so the cap keeps the wasm stack from running out.
const MAX_ARGUMENT_NESTING: usize = 32;

/// Expansions begun and not yet read to their end. A macro whose body
/// calls it again before the body ends leaves one more each time.
const MAX_OPEN_EXPANSIONS: usize = 1024;

/// What one macro call costs the work budget beyond the text it builds,
/// so a macro that expands to itself (GNU m4 never finishes one) stops in
/// bounded time even when its text is one byte or none.
const CALL_WORK_BYTES: usize = 1024;

const LQUOTE: &[u8] = b"`";
const RQUOTE: &[u8] = b"'";

/// GNU m4 1.4.19's builtins (no changeword), each with whether m4 calls it
/// only when `(` follows the name.
const BUILTINS: &[(&str, bool)] = &[
    ("__file__", false),
    ("__line__", false),
    ("__program__", false),
    ("builtin", true),
    ("changecom", false),
    ("changequote", false),
    ("debugfile", false),
    ("debugmode", false),
    ("decr", true),
    ("define", true),
    ("defn", true),
    ("divert", false),
    ("divnum", false),
    ("dnl", false),
    ("dumpdef", false),
    ("errprint", true),
    ("esyscmd", true),
    ("eval", true),
    ("format", true),
    ("ifdef", true),
    ("ifelse", true),
    ("include", true),
    ("incr", true),
    ("index", true),
    ("indir", true),
    ("len", true),
    ("m4exit", false),
    ("m4wrap", true),
    ("maketemp", true),
    ("mkstemp", true),
    ("patsubst", true),
    ("popdef", true),
    ("pushdef", true),
    ("regexp", true),
    ("shift", true),
    ("sinclude", true),
    ("substr", true),
    ("syscmd", true),
    ("sysval", false),
    ("traceoff", false),
    ("traceon", false),
    ("translit", true),
    ("undefine", true),
    ("undivert", false),
];

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
    // GNU m4 drops a NUL from some tokens and ends others at it.
    // shortcut: a NUL is refused, not modelled; revisit if a program needs one.
    if let Some(at) = source.find('\0') {
        return Err(refuse(
            source[..at].matches('\n').count() + 1,
            "the source holds a NUL byte (character 0), which m4 cannot read: delete it",
        ));
    }
    let mut m4 = Scanner::new(source.as_bytes());
    while let Some(token) = m4.next_token()? {
        m4.expand_token(None, token)?;
    }
    let mut lines = m4.lines;
    let ends_open = m4.out.last().is_some_and(|&b| b != b'\n');
    // An empty token can start a line nothing is written to.
    lines.truncate(m4.out.iter().filter(|&&b| b == b'\n').count() + usize::from(ends_open));
    let text = String::from_utf8(m4.out).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned());
    Ok(Scan { text, lines, events: m4.events })
}

#[derive(Clone)]
enum Macro {
    User(Rc<[u8]>),
    Builtin { name: &'static str, blind: bool },
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Word,
    Str,
    Open,
    Comma,
    Close,
    Simple,
}

struct Token {
    kind: Kind,
    text: Cow<'static, [u8]>,
    line: usize,
}

/// Every byte value, for one-byte tokens to borrow from.
static BYTES: [u8; 256] = {
    let mut all = [0u8; 256];
    let mut i = 0;
    while i < 256 {
        all[i] = i as u8;
        i += 1;
    }
    all
};

/// Text m4 reads before the rest of the file: an expansion, or characters
/// a delimiter match gave back. Its bytes count as `line`, the line m4 was
/// on when it pushed them.
struct Block {
    text: Vec<u8>,
    at: usize,
    line: usize,
}

struct Scanner<'a> {
    file: &'a [u8],
    at: usize,
    file_line: usize,
    /// The next file byte starts a line.
    file_line_start: bool,
    blocks: Vec<Block>,
    /// The line of the byte read last: GNU m4's current line.
    line: usize,
    macros: HashMap<Vec<u8>, Macro>,
    comment_open: Rc<[u8]>,
    comment_close: Rc<[u8]>,
    diversion: i64,
    out: Vec<u8>,
    out_line_start: bool,
    out_line: usize,
    out_line_bytes: usize,
    /// The per-line cap, never below the longest source line.
    line_cap: usize,
    lines: Vec<usize>,
    events: Vec<(usize, String, Option<String>)>,
    nesting: usize,
    work: usize,
}

impl<'a> Scanner<'a> {
    fn new(file: &'a [u8]) -> Self {
        let mut macros = HashMap::new();
        for &(name, blind) in BUILTINS {
            macros.insert(name.as_bytes().to_vec(), Macro::Builtin { name, blind });
        }
        for name in ["__gnu__", "__unix__"] {
            macros.insert(name.as_bytes().to_vec(), Macro::User(Rc::from(&b""[..])));
        }
        let longest = file.split(|&b| b == b'\n').map(<[u8]>::len).max().unwrap_or(0);
        Scanner {
            file,
            at: 0,
            file_line: 1,
            file_line_start: false,
            blocks: Vec::new(),
            line: 1,
            macros,
            comment_open: Rc::from(&b"#"[..]),
            comment_close: Rc::from(&b"\n"[..]),
            diversion: 0,
            out: Vec::with_capacity(file.len()),
            out_line_start: true,
            out_line: 0,
            out_line_bytes: 0,
            line_cap: MAX_EXPANDED_LINE_BYTES.max(longest),
            lines: Vec::new(),
            events: Vec::new(),
            nesting: 0,
            work: 0,
        }
    }

    fn next_char(&mut self) -> Option<u8> {
        while let Some(block) = self.blocks.last_mut() {
            if let Some(&c) = block.text.get(block.at) {
                block.at += 1;
                self.line = block.line;
                return Some(c);
            }
            self.blocks.pop();
        }
        let &c = self.file.get(self.at)?;
        self.at += 1;
        if self.file_line_start {
            self.file_line_start = false;
            self.file_line += 1;
        }
        self.file_line_start = c == b'\n';
        self.line = self.file_line;
        Some(c)
    }

    fn peek_char(&mut self) -> Option<u8> {
        while let Some(block) = self.blocks.last() {
            if let Some(&c) = block.text.get(block.at) {
                return Some(c);
            }
            self.blocks.pop();
        }
        self.file.get(self.at).copied()
    }

    /// Put `text` ahead of the rest of the input, as read on `line`.
    fn push(&mut self, text: Vec<u8>, line: usize) -> Result<(), EmuError> {
        if text.is_empty() {
            return Ok(());
        }
        self.spend(text.len(), line)?;
        // A block read to its end is finished, so it does not count as open.
        while self.blocks.last().is_some_and(|b| b.at == b.text.len()) {
            self.blocks.pop();
        }
        if self.blocks.len() >= MAX_OPEN_EXPANSIONS {
            return Err(refuse(
                line,
                format!(
                    "m4 expansions nest more than {MAX_OPEN_EXPANSIONS} deep: a macro whose body \
                     uses the macro again before the body ends never finishes, in GNU m4 either"
                ),
            ));
        }
        self.blocks.push(Block { text, at: 0, line });
        Ok(())
    }

    fn spend(&mut self, bytes: usize, line: usize) -> Result<(), EmuError> {
        self.check_room(bytes, line)?;
        self.work += bytes;
        Ok(())
    }

    /// Whether `bytes` more still fit the work budget.
    fn check_room(&self, bytes: usize, line: usize) -> Result<(), EmuError> {
        if self.work.saturating_add(bytes) > MAX_EXPANSION_WORK_BYTES {
            return Err(refuse(
                line,
                format!(
                    "m4 expansion built more than {} MiB of text, counting {CALL_WORK_BYTES} bytes \
                     for each macro call, which is as far as the playground's m4 goes. The usual \
                     cause is a macro whose expansion uses the macro again, which GNU m4 never \
                     finishes: give the macro a body that does not name it",
                    MAX_EXPANSION_WORK_BYTES / (1024 * 1024)
                ),
            ));
        }
        Ok(())
    }

    /// GNU m4's MATCH: `c`, already read, and the input after it start
    /// with `delim`. Characters read past `c` go back when the match fails
    /// or `consume` is false.
    fn matches(&mut self, c: u8, delim: &[u8], consume: bool) -> Result<bool, EmuError> {
        if delim.first() != Some(&c) {
            return Ok(false);
        }
        let rest = &delim[1..];
        if rest.is_empty() {
            return Ok(true);
        }
        // GNU m4 peeks here even when `c` was only peeked, not read, so a
        // peek compares `c` twice; doing the same keeps its answers.
        if self.peek_char() != Some(rest[0]) {
            return Ok(false);
        }
        if rest.len() == 1 {
            if consume {
                self.next_char();
            }
            return Ok(true);
        }
        self.next_char();
        let mut n = 1;
        while self.peek_char() == Some(rest[n]) {
            self.next_char();
            n += 1;
            if n == rest.len() {
                if consume {
                    return Ok(true);
                }
                break;
            }
        }
        let line = self.line;
        self.push(rest[..n].to_vec(), line)?;
        Ok(n == rest.len())
    }

    fn next_token(&mut self) -> Result<Option<Token>, EmuError> {
        let Some(c) = self.peek_char() else {
            return Ok(None);
        };
        self.next_char();
        let line = self.line;
        let open = Rc::clone(&self.comment_open);
        if self.matches(c, &open, true)? {
            let close = Rc::clone(&self.comment_close);
            let mut text = open.to_vec();
            loop {
                let Some(c) = self.next_char() else {
                    return Err(refuse(
                        line,
                        "this m4 comment runs to the end of the file: GNU m4 on the course \
                         servers stops with `end of file in comment`. A `#` comment ends at a \
                         newline, so end the file with one; a comment `changecom` set needs \
                         its closing string",
                    ));
                };
                if self.matches(c, &close, true)? {
                    text.extend_from_slice(&close);
                    break;
                }
                text.push(c);
            }
            return Ok(Some(Token { kind: Kind::Str, text: Cow::Owned(text), line }));
        }
        if c.is_ascii_alphabetic() || c == b'_' {
            let mut text = vec![c];
            while let Some(c) = self.peek_char().filter(|c| c.is_ascii_alphanumeric() || *c == b'_') {
                text.push(c);
                self.next_char();
            }
            return Ok(Some(Token { kind: Kind::Word, text: Cow::Owned(text), line }));
        }
        if !self.matches(c, LQUOTE, true)? {
            let kind = match c {
                b'(' => Kind::Open,
                b',' => Kind::Comma,
                b')' => Kind::Close,
                _ => Kind::Simple,
            };
            // Most tokens are one byte: borrow it rather than allocate.
            return Ok(Some(Token { kind, text: Cow::Borrowed(std::slice::from_ref(&BYTES[usize::from(c)])), line }));
        }
        let mut depth = 1;
        let mut text = Vec::new();
        loop {
            let Some(c) = self.next_char() else {
                return Err(refuse(
                    line,
                    "this backtick opens an m4 quote that no `'` closes before the end of the \
                     file: GNU m4 on the course servers stops with `end of file in string`. \
                     m4 reads a backtick anywhere, in a comment or a string too: close the \
                     quote, or write a plain quote instead",
                ));
            };
            if self.matches(c, RQUOTE, true)? {
                depth -= 1;
                if depth == 0 {
                    break;
                }
                text.extend_from_slice(RQUOTE);
            } else if self.matches(c, LQUOTE, true)? {
                depth += 1;
                text.extend_from_slice(LQUOTE);
            } else {
                text.push(c);
            }
        }
        Ok(Some(Token { kind: Kind::Str, text: Cow::Owned(text), line }))
    }

    /// GNU m4's peek_token: is the next token a `(`?
    fn open_paren_next(&mut self) -> Result<bool, EmuError> {
        let Some(c) = self.peek_char() else {
            return Ok(false);
        };
        let open = Rc::clone(&self.comment_open);
        if self.matches(c, &open, false)? || c.is_ascii_alphabetic() || c == b'_' {
            return Ok(false);
        }
        Ok(c == b'(' && !self.matches(c, LQUOTE, false)?)
    }

    /// Write a token, into a macro argument being collected when `arg` is
    /// set, else to the output.
    fn ship(&mut self, arg: Option<&mut Vec<u8>>, text: &[u8], line: usize) -> Result<(), EmuError> {
        if let Some(arg) = arg {
            arg.extend_from_slice(text);
            return Ok(());
        }
        if self.diversion < 0 {
            return Ok(());
        }
        if self.out_line_start {
            self.out_line_start = false;
            self.out_line = line;
            self.out_line_bytes = 0;
            self.lines.push(line);
        }
        for &c in text {
            if self.out_line_start {
                self.out_line_start = false;
                self.out_line += 1;
                self.out_line_bytes = 0;
                self.lines.push(self.out_line);
            }
            self.out.push(c);
            self.out_line_start = c == b'\n';
            self.out_line_bytes += usize::from(c != b'\n');
            if self.out_line_bytes > self.line_cap {
                return Err(refuse(
                    line,
                    format!(
                        "m4 expansion grew this line past {MAX_EXPANDED_LINE_BYTES} bytes; a \
                         macro is expanding without settling"
                    ),
                ));
            }
        }
        if self.out.len() > MAX_EXPANDED_TOTAL_BYTES {
            return Err(refuse(
                line,
                format!(
                    "m4 expansion grew the whole source past {} MiB. A macro body repeated \
                     across many lines can blow up the output; shrink the macro or the number \
                     of references",
                    MAX_EXPANDED_TOTAL_BYTES / (1024 * 1024)
                ),
            ));
        }
        Ok(())
    }

    fn expand_token(&mut self, arg: Option<&mut Vec<u8>>, token: Token) -> Result<(), EmuError> {
        if token.kind == Kind::Word {
            if let Some(found) = self.macros.get(token.text.as_ref()).cloned() {
                let blind = matches!(found, Macro::Builtin { blind: true, .. });
                if !blind || self.open_paren_next()? {
                    return self.expand_macro(token.text.into_owned(), found, token.line);
                }
            }
        }
        self.ship(arg, &token.text, token.line)
    }

    /// Call a macro m4 read on `line`: collect its arguments, run it, and
    /// put what it expands to ahead of the input, to be read again.
    fn expand_macro(&mut self, name: Vec<u8>, found: Macro, line: usize) -> Result<(), EmuError> {
        if let Macro::Builtin { name, .. } = found {
            if !matches!(name, "define" | "undefine" | "dnl" | "divert" | "divnum" | "changecom") {
                return Err(unsupported(line, name));
            }
        }
        if self.nesting >= MAX_ARGUMENT_NESTING {
            return Err(refuse(
                line,
                format!(
                    "m4 macro calls nest more than {MAX_ARGUMENT_NESTING} deep inside one \
                     another's arguments: call them one after another instead"
                ),
            ));
        }
        self.spend(CALL_WORK_BYTES, line)?;
        self.nesting += 1;
        let mut args = vec![name];
        if self.open_paren_next()? {
            self.next_token()?;
            loop {
                let (more, arg) = self.collect_argument()?;
                args.push(arg);
                if !more {
                    break;
                }
            }
        }
        self.nesting -= 1;
        let expansion = match found {
            Macro::User(body) => self.substitute(&body, &args, line)?,
            Macro::Builtin { name, .. } => self.builtin(name, &args, line)?,
        };
        self.push(expansion, line)
    }

    /// One argument, macros in it expanded: whether a comma ends it (more
    /// follow) or the closing paren, and its text.
    fn collect_argument(&mut self) -> Result<(bool, Vec<u8>), EmuError> {
        let line = self.line;
        let unclosed = || {
            refuse(
                line,
                "this macro call's arguments run to the end of the file: no `)` closes its \
                 `(`. GNU m4 on the course servers stops with `end of file in argument list`. \
                 Close the call, or quote a `(` that is text",
            )
        };
        let mut token = loop {
            match self.next_token()? {
                None => return Err(unclosed()),
                // GNU m4 skips C's isspace: space, \t, \n, \v, \f and \r.
                Some(t) if t.kind == Kind::Simple && matches!(t.text[0], b' ' | b'\t'..=b'\r') => {}
                Some(t) => break t,
            }
        };
        let mut text = Vec::new();
        let mut depth = 0usize;
        loop {
            match token.kind {
                Kind::Comma | Kind::Close if depth == 0 => return Ok((token.kind == Kind::Comma, text)),
                Kind::Open => depth += 1,
                Kind::Close => depth -= 1,
                _ => {}
            }
            self.expand_token(Some(&mut text), token)?;
            token = self.next_token()?.ok_or_else(unclosed)?;
        }
    }

    /// A user macro's body with the call's arguments put in, as GNU m4
    /// does: `$0` the name, `$1` on (`$10` the tenth), `$#` the count, `$*`
    /// all of them joined by commas and `$@` the same, each quoted.
    fn substitute(&mut self, body: &[u8], args: &[Vec<u8>], line: usize) -> Result<Vec<u8>, EmuError> {
        let mut out = Vec::with_capacity(body.len());
        let mut i = 0;
        while i < body.len() {
            // The budget is checked while the text grows, not after.
            self.check_room(out.len(), line)?;
            let c = body[i];
            i += 1;
            if c != b'$' || i == body.len() {
                out.push(c);
                continue;
            }
            match body[i] {
                b'0'..=b'9' => {
                    let mut n = 0usize;
                    while let Some(d) = body.get(i).filter(|d| d.is_ascii_digit()) {
                        n = n.saturating_mul(10).saturating_add(usize::from(d - b'0'));
                        i += 1;
                    }
                    if let Some(arg) = args.get(n) {
                        out.extend_from_slice(arg);
                    }
                }
                b'#' => {
                    out.extend_from_slice((args.len() - 1).to_string().as_bytes());
                    i += 1;
                }
                b'*' | b'@' => {
                    let quoted = body[i] == b'@';
                    for (k, arg) in args[1..].iter().enumerate() {
                        if k > 0 {
                            out.push(b',');
                        }
                        if quoted {
                            out.extend_from_slice(LQUOTE);
                        }
                        out.extend_from_slice(arg);
                        if quoted {
                            out.extend_from_slice(RQUOTE);
                        }
                        self.check_room(out.len(), line)?;
                    }
                    i += 1;
                }
                _ => out.push(b'$'),
            }
        }
        Ok(out)
    }

    fn builtin(&mut self, name: &str, args: &[Vec<u8>], line: usize) -> Result<Vec<u8>, EmuError> {
        match name {
            "define" => {
                if let Some(macro_name) = args.get(1) {
                    let body: Rc<[u8]> = Rc::from(args.get(2).map_or(&[][..], Vec::as_slice));
                    self.events.push((line, lossy(macro_name), Some(lossy(&body))));
                    self.macros.insert(macro_name.clone(), Macro::User(body));
                }
            }
            "undefine" => {
                for macro_name in &args[1..] {
                    self.macros.remove(macro_name);
                    self.events.push((line, lossy(macro_name), None));
                }
            }
            "dnl" => while self.next_char().is_some_and(|c| c != b'\n') {},
            "divert" => {
                let number = match args.get(1) {
                    None => Some(0),
                    Some(arg) => diversion_number(arg),
                };
                match number {
                    Some(n) if n <= 0 => self.diversion = n,
                    _ => {
                        let arg = args.get(1).map_or(String::new(), |a| lossy(a));
                        return Err(unsupported(line, &format!("divert({arg})")));
                    }
                }
            }
            "divnum" => return Ok(self.diversion.to_string().into_bytes()),
            "changecom" => {
                let (open, close): (&[u8], &[u8]) = match (args.get(1), args.get(2)) {
                    (None, _) => (b"", b""),
                    (Some(open), Some(close)) if open.is_empty() || !close.is_empty() => (open, close),
                    (Some(open), _) => (open, b"\n"),
                };
                self.comment_open = Rc::from(open);
                self.comment_close = Rc::from(close);
            }
            _ => unreachable!("expand_macro refuses the builtins not run here"),
        }
        Ok(Vec::new())
    }
}

/// `divert`'s argument as GNU m4 reads a number: empty is 0, else an
/// optional sign and digits. `None` for anything else.
fn diversion_number(arg: &[u8]) -> Option<i64> {
    if arg.is_empty() {
        return Some(0);
    }
    let digits = arg.strip_prefix(b"-").or_else(|| arg.strip_prefix(b"+")).unwrap_or(arg);
    if digits.is_empty() || digits.len() > 9 || !digits.iter().all(u8::is_ascii_digit) {
        return None;
    }
    std::str::from_utf8(arg).ok()?.parse().ok()
}

fn lossy(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

fn refuse(line: usize, message: impl Into<String>) -> EmuError {
    EmuError::PreprocError { line, message: message.into() }
}

/// A builtin GNU m4 has and the playground does not run.
fn unsupported(line: usize, what: &str) -> EmuError {
    refuse(line, format!("unsupported m4 construct: {what}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::rejects;
    use std::time::{Duration, Instant};

    /// Each wall stops a program GNU m4 never finishes, in bounded time.
    fn stops(source: &str, fragment: &str) {
        let started = Instant::now();
        rejects(scan(source), fragment);
        assert!(started.elapsed() < Duration::from_secs(10), "took {:?}", started.elapsed());
    }

    #[test]
    fn a_macro_that_expands_to_itself_stops_at_the_work_budget() {
        stops("define(`r', `r')r\n", "m4 expansion built more than");
        stops("define(`r', `r()')r\n", "m4 expansion built more than");
    }

    #[test]
    fn a_macro_that_uses_itself_before_its_body_ends_stops_at_the_open_expansions() {
        stops("define(`r', `r r')r\n", "m4 expansions nest more than 1024 deep");
    }

    #[test]
    fn a_macro_that_writes_and_uses_itself_stops_at_the_line_cap() {
        // Enough text a call that the line fills before the work budget runs out.
        stops("define(`r', `mov x0, 1 r')r\n", "grew this line past");
    }

    #[test]
    fn calls_nested_in_arguments_stop_at_the_nesting_cap() {
        let nested = |n: usize| format!("define(`f', `$1')dnl\n{}x{}\n", "f(".repeat(n), ")".repeat(n));
        assert_eq!(scan(&nested(MAX_ARGUMENT_NESTING)).map(|s| s.text), Ok("x\n".to_string()));
        stops(&nested(MAX_ARGUMENT_NESTING + 1), "nest more than 32 deep");
    }

    #[test]
    fn the_output_caps_hold_at_three_sizes() {
        let body = "x".repeat(1024);
        for lines in [9_000, 18_000, 36_000] {
            stops(&format!("define(`b', `{body}')dnl\n{}", "b\n".repeat(lines)), "past 8 MiB");
        }
        for uses in [100, 200, 400] {
            stops(&format!("define(`b', `{body}')dnl\n{}\n", "b ".repeat(uses)), "grew this line past");
        }
        // A long line that does not grow passes the line cap.
        let long = "y".repeat(MAX_EXPANDED_LINE_BYTES * 2);
        assert_eq!(scan(&format!("{long}\n")).map(|s| s.text.len()), Ok(long.len() + 1));
    }

    #[test]
    fn text_read_again_under_divert_stops_at_the_work_budget_at_three_sizes() {
        // divert(-1) throws the text away, so no output cap fires first, and
        // a body of one-byte tokens is the slowest text to read again.
        for body in [1024, 4096, 16384] {
            let uses = MAX_EXPANSION_WORK_BYTES / (body + CALL_WORK_BYTES) + 10;
            let src = format!("divert(-1)define(`b', `{}')\n{}", "+".repeat(body), "b\n".repeat(uses));
            stops(&src, "m4 expansion built more than");
        }
    }

    #[test]
    fn a_comment_start_that_keeps_almost_matching_stops_at_the_work_budget() {
        // Each failed match gives back what it read, so each byte is read again.
        let start = format!("{}b", "+".repeat(1000));
        stops(&format!("changecom(`{start}')dnl\n{}\n", "+".repeat(200_000)), "m4 expansion built more than");
    }

    #[test]
    fn a_nul_byte_is_refused_at_its_line() {
        match scan("mov x0, 1\nmov x1, \0\n") {
            Err(EmuError::PreprocError { line, message }) => {
                assert_eq!(line, 2);
                assert!(message.contains("NUL"), "message was: {message}");
            }
            other => panic!("expected a refusal, got {other:?}"),
        }
    }
}
