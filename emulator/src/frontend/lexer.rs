//! Token stream for cpsc 355 assembly. Runs after m4 expansion, so it does
//! not see `define(...)` or the assignment form: those are gone by now.
//!
//! The lexer classifies at the cheapest possible level. It does not know
//! which identifiers are mnemonics or registers (the parser decides that
//! when it has context). It does handle the three tricky numeric forms the
//! course uses: hex `0x...`, binary `0b...`, and GAS-radix doubles `0r...`.
//! String and char literals resolve their escapes here so later stages
//! never have to look at a `\n`.

use crate::errors::EmuError;

/// A single token with its source location.
#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub line: usize,
    pub col: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    /// Bare identifier: mnemonic, register, or symbol reference.
    Ident(String),
    /// Directive identifier: leading dot followed by ident, e.g. `.data`.
    DirectiveIdent(String),
    /// Integer literal, already sign-less (unary minus is a separate token).
    IntLit(i64),
    /// IEEE 754 double, from `0r...` GAS radix syntax.
    FloatLit(f64),
    /// Char literal as its Unicode scalar value. `'A'` yields 65.
    CharLit(u32),
    /// String literal with escapes already resolved into raw bytes.
    StringLit(Vec<u8>),
    Comma,
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Amp,
    Pipe,
    Caret,
    Tilde,
    Bang,
    LShift,
    RShift,
    LParen,
    RParen,
    LBracket,
    RBracket,
    LBrace,
    RBrace,
    /// Standalone `.` meaning "current address". `.name` with no gap lexes
    /// as `DirectiveIdent` instead.
    Dot,
    Colon,
    Equals,
    /// `#` immediate prefix.
    Hash,
}

/// Render one token the way it reads in source, for error messages. The
/// derived Debug form shows compiler internals (`StringLit([104, 105])`),
/// which no student-facing error should carry.
pub fn describe(kind: &TokenKind) -> String {
    match kind {
        TokenKind::Ident(s) | TokenKind::DirectiveIdent(s) => format!("`{s}`"),
        TokenKind::IntLit(v) => format!("`{v}`"),
        TokenKind::FloatLit(v) => format!("`{v}`"),
        TokenKind::CharLit(v) => match char::from_u32(*v) {
            Some(c) => format!("a character literal ('{c}')"),
            None => "a character literal".to_string(),
        },
        TokenKind::StringLit(_) => "a string literal".to_string(),
        TokenKind::Comma => "`,`".to_string(),
        TokenKind::Plus => "`+`".to_string(),
        TokenKind::Minus => "`-`".to_string(),
        TokenKind::Star => "`*`".to_string(),
        TokenKind::Slash => "`/`".to_string(),
        TokenKind::Percent => "`%`".to_string(),
        TokenKind::Amp => "`&`".to_string(),
        TokenKind::Pipe => "`|`".to_string(),
        TokenKind::Caret => "`^`".to_string(),
        TokenKind::Tilde => "`~`".to_string(),
        TokenKind::Bang => "`!`".to_string(),
        TokenKind::LShift => "`<<`".to_string(),
        TokenKind::RShift => "`>>`".to_string(),
        TokenKind::LParen => "`(`".to_string(),
        TokenKind::RParen => "`)`".to_string(),
        TokenKind::LBracket => "`[`".to_string(),
        TokenKind::RBracket => "`]`".to_string(),
        TokenKind::LBrace => "`{`".to_string(),
        TokenKind::RBrace => "`}`".to_string(),
        TokenKind::Dot => "`.`".to_string(),
        TokenKind::Colon => "`:`".to_string(),
        TokenKind::Equals => "`=`".to_string(),
        TokenKind::Hash => "`#`".to_string(),
    }
}

/// Lex a source string. `starting_line` is the 1-based line number of the
/// first line of `source`, letting callers pass a single line from a larger
/// file and still get correct error line numbers.
pub fn lex(source: &str, starting_line: usize) -> Result<Vec<Token>, EmuError> {
    let bytes = source.as_bytes();
    let mut tokens = Vec::new();
    let mut line = starting_line;
    let mut line_start: usize = 0;
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        // Whitespace and newlines.
        if b == b'\n' {
            line += 1;
            i += 1;
            line_start = i;
            continue;
        }
        if b == b'\r' || b == b' ' || b == b'\t' {
            i += 1;
            continue;
        }
        let col = i - line_start + 1;
        // Single-char tokens.
        let single: Option<TokenKind> = match b {
            b',' => Some(TokenKind::Comma),
            b'+' => Some(TokenKind::Plus),
            b'-' => Some(TokenKind::Minus),
            b'*' => Some(TokenKind::Star),
            b'/' => Some(TokenKind::Slash),
            b'%' => Some(TokenKind::Percent),
            b'&' => Some(TokenKind::Amp),
            b'|' => Some(TokenKind::Pipe),
            b'^' => Some(TokenKind::Caret),
            b'~' => Some(TokenKind::Tilde),
            b'!' => Some(TokenKind::Bang),
            b'(' => Some(TokenKind::LParen),
            b')' => Some(TokenKind::RParen),
            b'[' => Some(TokenKind::LBracket),
            b']' => Some(TokenKind::RBracket),
            b'{' => Some(TokenKind::LBrace),
            b'}' => Some(TokenKind::RBrace),
            b':' => Some(TokenKind::Colon),
            b'=' => Some(TokenKind::Equals),
            b'#' => Some(TokenKind::Hash),
            _ => None,
        };
        if let Some(kind) = single {
            tokens.push(Token { kind, line, col });
            i += 1;
            continue;
        }
        // Two-char shift operators.
        if b == b'<' {
            if i + 1 < bytes.len() && bytes[i + 1] == b'<' {
                tokens.push(Token {
                    kind: TokenKind::LShift,
                    line,
                    col,
                });
                i += 2;
                continue;
            }
            return Err(lex_err(line, "unexpected '<' (did you mean '<<'?)"));
        }
        if b == b'>' {
            if i + 1 < bytes.len() && bytes[i + 1] == b'>' {
                tokens.push(Token {
                    kind: TokenKind::RShift,
                    line,
                    col,
                });
                i += 2;
                continue;
            }
            return Err(lex_err(line, "unexpected '>' (did you mean '>>'?)"));
        }
        // Dot: standalone or directive identifier.
        if b == b'.' {
            if i + 1 < bytes.len() && is_id_start(bytes[i + 1]) {
                let start = i;
                i += 1;
                while i < bytes.len() && is_id_continue(bytes[i]) {
                    i += 1;
                }
                let text = &source[start..i];
                tokens.push(Token {
                    kind: TokenKind::DirectiveIdent(text.to_string()),
                    line,
                    col,
                });
                continue;
            }
            tokens.push(Token {
                kind: TokenKind::Dot,
                line,
                col,
            });
            i += 1;
            continue;
        }
        // Numeric literal: integer (decimal/hex/binary/octal) or GAS float.
        if b.is_ascii_digit() {
            let start = i;
            // Check for `0r` float radix prefix.
            if b == b'0' && i + 1 < bytes.len() && (bytes[i + 1] == b'r' || bytes[i + 1] == b'R') {
                i += 2;
                let float_start = i;
                while i < bytes.len() && is_float_body(bytes[i]) {
                    i += 1;
                }
                let text = &source[float_start..i];
                let value: f64 = text.parse().map_err(|_| {
                    lex_err(line, &format!("invalid 0r float literal `{text}`"))
                })?;
                tokens.push(Token {
                    kind: TokenKind::FloatLit(value),
                    line,
                    col,
                });
                continue;
            }
            // Otherwise it's an integer in some base.
            while i < bytes.len() && is_int_body(bytes[i]) {
                i += 1;
            }
            let text = &source[start..i];
            // A plain decimal run followed by `.digit` is a float literal
            // the way the real assembler reads it (`.double 3.14`); the
            // lone `.` current-address symbol never has digits on both
            // sides, so this stays unambiguous.
            let plain_decimal = text.bytes().all(|c| c.is_ascii_digit());
            if plain_decimal
                && i + 1 < bytes.len()
                && bytes[i] == b'.'
                && bytes[i + 1].is_ascii_digit()
            {
                i += 1;
                while i < bytes.len() && bytes[i].is_ascii_digit() {
                    i += 1;
                }
                // Optional exponent; the sign belongs to the float only
                // right after the `e`, never as a trailing operator.
                if i < bytes.len() && (bytes[i] == b'e' || bytes[i] == b'E') {
                    let mut j = i + 1;
                    if j < bytes.len() && (bytes[j] == b'+' || bytes[j] == b'-') {
                        j += 1;
                    }
                    if j < bytes.len() && bytes[j].is_ascii_digit() {
                        i = j;
                        while i < bytes.len() && bytes[i].is_ascii_digit() {
                            i += 1;
                        }
                    }
                }
                let text = &source[start..i];
                let value: f64 = text.parse().map_err(|_| {
                    lex_err(line, &format!("invalid float literal `{text}`"))
                })?;
                tokens.push(Token {
                    kind: TokenKind::FloatLit(value),
                    line,
                    col,
                });
                continue;
            }
            // `1e5` / `1e-3`: an integer-looking run that is really an
            // exponent float (`is_int_body`'s hex range swallows the `e`).
            // GAS reads these as floats in .double/.float lists; extend
            // across a sign directly after the e/E and hand the text to
            // the float path instead of calling it a bad integer.
            let mut text = text;
            let exponential = {
                let b = text.as_bytes();
                b.iter()
                    .position(|&c| c == b'e' || c == b'E')
                    .is_some_and(|p| {
                        p > 0
                            && b[..p].iter().all(u8::is_ascii_digit)
                            && b[p + 1..].iter().all(u8::is_ascii_digit)
                    })
            };
            if exponential {
                if i < bytes.len()
                    && (bytes[i] == b'+' || bytes[i] == b'-')
                    && text.as_bytes().last().is_some_and(|&c| c == b'e' || c == b'E')
                    && i + 1 < bytes.len()
                    && bytes[i + 1].is_ascii_digit()
                {
                    i += 1;
                    while i < bytes.len() && bytes[i].is_ascii_digit() {
                        i += 1;
                    }
                    text = &source[start..i];
                }
                if let Ok(value) = text.parse::<f64>() {
                    tokens.push(Token {
                        kind: TokenKind::FloatLit(value),
                        line,
                        col,
                    });
                    continue;
                }
            }
            let value = parse_int(text).ok_or_else(|| lex_err(line, &integer_error(text)))?;
            tokens.push(Token {
                kind: TokenKind::IntLit(value),
                line,
                col,
            });
            continue;
        }
        // Char literal.
        if b == b'\'' {
            let (value, consumed) = parse_char_literal(&source[i..], line)?;
            tokens.push(Token {
                kind: TokenKind::CharLit(value),
                line,
                col,
            });
            i += consumed;
            continue;
        }
        // String literal.
        if b == b'"' {
            let (bytes_out, consumed) = parse_string_literal(&source[i..], line)?;
            tokens.push(Token {
                kind: TokenKind::StringLit(bytes_out),
                line,
                col,
            });
            i += consumed;
            continue;
        }
        // Identifier.
        if is_id_start(b) {
            let start = i;
            i += 1;
            while i < bytes.len() && is_id_continue(bytes[i]) {
                i += 1;
            }
            let text = &source[start..i];
            tokens.push(Token {
                kind: TokenKind::Ident(text.to_string()),
                line,
                col,
            });
            continue;
        }
        // `@ident` attributes (`.type foo, @function`). We don't use the
        // attribute, but it shows up in unmodified GCC output so the lexer
        // accepts it as a bare identifier the parser can then ignore.
        if b == b'@' && i + 1 < bytes.len() && is_id_start(bytes[i + 1]) {
            let start = i;
            i += 1;
            while i < bytes.len() && is_id_continue(bytes[i]) {
                i += 1;
            }
            let text = &source[start..i];
            tokens.push(Token {
                kind: TokenKind::Ident(text.to_string()),
                line,
                col,
            });
            continue;
        }
        if b >= 0x80 {
            // A non-ASCII byte outside a string literal is almost always a
            // paste artifact (NBSP, curly quote, em dash). Name the real
            // character, not its first byte latin-1-widened, and say where
            // it came from so the student knows to retype the line.
            let c = source[i..].chars().next().unwrap_or('\u{fffd}');
            let name = match c {
                '\u{a0}' => " (non-breaking space)",
                '\u{2018}' | '\u{2019}' => " (curly single quote)",
                '\u{201c}' | '\u{201d}' => " (curly double quote)",
                '\u{2013}' => " (en dash)",
                '\u{2014}' => " (em dash)",
                '\u{200b}' => " (zero-width space)",
                '\u{feff}' => " (byte-order mark)",
                _ => "",
            };
            return Err(lex_err(
                line,
                &format!(
                    "column {col}: non-ASCII character U+{:04X}{name}. Retype this line; \
                     pasting from a PDF or web page often inserts invisible characters",
                    c as u32
                ),
            ));
        }
        return Err(lex_err(
            line,
            &format!(
                "unexpected character `{}` here: a line starts with a label, a \
                 directive, or a mnemonic, and comments start with // or ;",
                b as char
            ),
        ));
    }
    Ok(tokens)
}

fn lex_err(line: usize, message: &str) -> EmuError {
    EmuError::ParseError {
        line,
        message: message.to_string(),
    }
}

fn is_id_start(b: u8) -> bool {
    matches!(b, b'A'..=b'Z' | b'a'..=b'z' | b'_')
}

fn is_id_continue(b: u8) -> bool {
    matches!(b, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'_')
}

fn is_int_body(b: u8) -> bool {
    // Accept characters valid across decimal, hex, binary, and octal forms.
    // `parse_int` does the per-prefix validation. b'a'..=b'f' already covers
    // b'b' and b'A'..=b'F' covers b'B', so the hex ranges include the
    // binary-prefix letters.
    matches!(b,
        b'0'..=b'9' | b'a'..=b'f' | b'A'..=b'F' | b'x' | b'X' | b'_'
    )
}

fn is_float_body(b: u8) -> bool {
    matches!(b, b'0'..=b'9' | b'.' | b'e' | b'E' | b'+' | b'-')
}

fn parse_int(text: &str) -> Option<i64> {
    // Strip internal underscores: `0x0040_0000` is the course spelling.
    let clean: String = text.chars().filter(|c| *c != '_').collect();
    let s = clean.as_str();
    // Hex/binary parse as u64 first so values with the top bit set
    // (`0xdeadbeefcafebabe`) round-trip into a negative i64 instead of
    // failing the signed parse.
    if let Some(rest) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        return u64::from_str_radix(rest, 16).ok().map(|v| v as i64);
    }
    if let Some(rest) = s.strip_prefix("0b").or_else(|| s.strip_prefix("0B")) {
        return u64::from_str_radix(rest, 2).ok().map(|v| v as i64);
    }
    // Leading-zero octal a la GAS. "0" alone is decimal zero. A digit
    // outside 0-7 makes the whole literal invalid rather than decimal:
    // GAS reads `018` as the octal `01` and then rejects the stray `8`,
    // so falling through to decimal would answer 18 for a literal GAS
    // refuses, while `017` already means 15 here: the radix would change
    // between two adjacent-looking numbers.
    if s.len() > 1 && s.starts_with('0') {
        if !s.bytes().all(|b| (b'0'..=b'7').contains(&b)) {
            return None;
        }
        return u64::from_str_radix(&s[1..], 8).ok().map(|v| v as i64);
    }
    s.parse::<i64>().ok()
}

/// Message for an integer literal the lexer cannot read. A leading zero
/// means octal, so `018` is not decimal 18: naming the rule saves the
/// student from reading it as a typo in the emulator.
fn integer_error(text: &str) -> String {
    let clean: String = text.chars().filter(|c| *c != '_').collect();
    let radix_prefixed = ["0x", "0X", "0b", "0B"]
        .iter()
        .any(|p| clean.starts_with(p));
    if clean.len() > 1 && clean.starts_with('0') && !radix_prefixed {
        return format!(
            "invalid integer literal `{text}`: a leading zero means octal, so only the \
             digits 0-7 are allowed. Drop the zero for decimal, or write 0x for hex"
        );
    }
    format!("invalid integer literal `{text}`")
}

fn parse_char_literal(s: &str, line: usize) -> Result<(u32, usize), EmuError> {
    // s starts with the opening quote.
    let bytes = s.as_bytes();
    if bytes.len() < 3 {
        return Err(lex_err(line, "unterminated char literal"));
    }
    let i = 1;
    let (value, end) = if bytes[i] == b'\\' {
        if i + 1 >= bytes.len() {
            return Err(lex_err(line, "unterminated char literal"));
        }
        let (v, used) = decode_escape(&bytes[i..], line)?;
        (v, i + used)
    } else {
        (bytes[i] as u32, i + 1)
    };
    if end >= bytes.len() || bytes[end] != b'\'' {
        return Err(lex_err(line, "expected closing single-quote in char literal"));
    }
    Ok((value, end + 1))
}

fn parse_string_literal(s: &str, line: usize) -> Result<(Vec<u8>, usize), EmuError> {
    // s starts with the opening quote. Like the real assembler, a string
    // may not span lines: a raw newline before the closing quote is an
    // unterminated literal, reported at the line where the quote opened
    // (write \n for a newline byte). Without this stop, a stray quote
    // later in the file would silently swallow the lines in between and
    // the student would get a baffling error far from the real mistake.
    let bytes = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 1;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'"' {
            return Ok((out, i + 1));
        }
        if b == b'\n' || b == b'\r' {
            return Err(lex_err(
                line,
                "unterminated string literal: no closing \" before the end of the line (write \\n for a newline)",
            ));
        }
        if b == b'\\' {
            let (v, used) = decode_escape(&bytes[i..], line)?;
            out.push(v as u8);
            i += used;
            continue;
        }
        out.push(b);
        i += 1;
    }
    Err(lex_err(
        line,
        "unterminated string literal: no closing \" before the end of the line (write \\n for a newline)",
    ))
}

fn decode_escape(bytes: &[u8], line: usize) -> Result<(u32, usize), EmuError> {
    // bytes[0] is the backslash.
    if bytes.len() < 2 {
        return Err(lex_err(line, "dangling backslash in literal"));
    }
    let next = bytes[1];
    match next {
        b'n' => Ok((b'\n' as u32, 2)),
        b't' => Ok((b'\t' as u32, 2)),
        b'r' => Ok((b'\r' as u32, 2)),
        d @ b'0'..=b'7' => {
            // GAS octal escape: backslash + 1 to 3 octal digits, value mod
            // 256. `\0` alone is still NUL; `\012` is a newline; `\101`
            // is 'A'.
            let mut val = u32::from(d - b'0');
            let mut consumed = 2; // backslash + first digit
            while consumed < 4
                && consumed < bytes.len()
                && (b'0'..=b'7').contains(&bytes[consumed])
            {
                val = val * 8 + u32::from(bytes[consumed] - b'0');
                consumed += 1;
            }
            Ok((val & 0xFF, consumed))
        }
        b'\\' => Ok((b'\\' as u32, 2)),
        b'"' => Ok((b'"' as u32, 2)),
        b'\'' => Ok((b'\'' as u32, 2)),
        b'x' | b'X' => {
            // GAS consumes as many hex digits as follow the `x` and keeps
            // the low byte: `"\xA"` is one newline and `"\x123"` is 0x23.
            // A fixed two-digit window would reject the first and split the
            // second into 0x12 plus a literal '3'. Masking each round is the
            // same as masking at the end, since the low byte of a base-16
            // accumulation only ever depends on itself.
            let mut value: u32 = 0;
            let mut consumed = 2;
            while consumed < bytes.len() && bytes[consumed].is_ascii_hexdigit() {
                let digit = match bytes[consumed] {
                    d @ b'0'..=b'9' => u32::from(d - b'0'),
                    d @ b'a'..=b'f' => u32::from(d - b'a') + 10,
                    d => u32::from(d - b'A') + 10,
                };
                value = ((value << 4) | digit) & 0xFF;
                consumed += 1;
            }
            Ok((value, consumed))
        }
        other => Err(lex_err(
            line,
            &format!("unknown escape \\{}", other as char),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(tokens: &[Token]) -> Vec<TokenKind> {
        tokens.iter().map(|t| t.kind.clone()).collect()
    }

    #[test]
    fn empty_source_gives_no_tokens() {
        assert!(lex("", 1).unwrap().is_empty());
    }

    #[test]
    fn whitespace_only_gives_no_tokens() {
        assert!(lex("   \t \n \r\n ", 1).unwrap().is_empty());
    }

    #[test]
    fn simple_instruction_tokens() {
        let t = lex("mov x0, #42", 1).unwrap();
        assert_eq!(
            kinds(&t),
            vec![
                TokenKind::Ident("mov".into()),
                TokenKind::Ident("x0".into()),
                TokenKind::Comma,
                TokenKind::Hash,
                TokenKind::IntLit(42),
            ]
        );
    }

    #[test]
    fn hex_literal() {
        let t = lex("0x1f", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::IntLit(31)]);
    }

    #[test]
    fn hex_literal_uppercase_prefix_and_digits() {
        let t = lex("0XFF", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::IntLit(255)]);
    }

    #[test]
    fn binary_literal() {
        let t = lex("0b101010", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::IntLit(42)]);
    }

    #[test]
    fn octal_leading_zero() {
        let t = lex("01101", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::IntLit(0o1101)]);
    }

    #[test]
    fn underscores_in_integer_stripped() {
        let t = lex("0x0040_0000", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::IntLit(0x0040_0000)]);
    }

    #[test]
    fn float_radix_r_prefix() {
        let t = lex("0r3.14159265358979", 1).unwrap();
        match t[0].kind {
            TokenKind::FloatLit(v) => assert!((v - std::f64::consts::PI).abs() < 1e-14),
            ref other => panic!("expected FloatLit, got {other:?}"),
        }
    }

    #[test]
    #[allow(clippy::approx_constant)] // 3.14 is the literal source text, not an approximation of pi
    fn plain_decimal_float_lexes_like_the_real_assembler() {
        // `.double 3.14` works in the real toolchain with no 0r prefix.
        let t = lex("3.14", 1).unwrap();
        match t[0].kind {
            TokenKind::FloatLit(v) => assert_eq!(v, 3.14),
            ref other => panic!("expected FloatLit, got {other:?}"),
        }
        // Exponent forms, signed and unsigned.
        let t = lex("1.5e3", 1).unwrap();
        assert!(matches!(t[0].kind, TokenKind::FloatLit(v) if v == 1500.0));
        let t = lex("2.5e-2", 1).unwrap();
        assert!(matches!(t[0].kind, TokenKind::FloatLit(v) if v == 0.025));
    }

    #[test]
    fn float_lexing_never_eats_expression_operators() {
        // `2.5-1` must lex as float minus int, not one malformed float,
        // and the current-address `.` keeps working next to numbers.
        let t = lex("2.5-1", 1).unwrap();
        let ks = kinds(&t);
        assert_eq!(
            ks,
            vec![
                TokenKind::FloatLit(2.5),
                TokenKind::Minus,
                TokenKind::IntLit(1)
            ]
        );
        let t = lex(". - msg - 1", 1).unwrap();
        assert!(matches!(t[0].kind, TokenKind::Dot));
    }

    #[test]
    fn char_literal_plain() {
        let t = lex("'A'", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::CharLit(65)]);
    }

    #[test]
    fn char_literal_escapes() {
        let cases = [
            ("'\\n'", 10),
            ("'\\t'", 9),
            ("'\\r'", 13),
            ("'\\0'", 0),
            ("'\\\\'", b'\\' as u32),
            ("'\\''", b'\'' as u32),
            ("'\\x41'", 0x41),
        ];
        for (src, expected) in cases {
            let t = lex(src, 1).unwrap();
            assert_eq!(kinds(&t), vec![TokenKind::CharLit(expected)], "src: {src}");
        }
    }

    #[test]
    fn string_literal_with_newline_escape() {
        let t = lex("\"Hello\\n\"", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::StringLit(b"Hello\n".to_vec())]);
    }

    #[test]
    fn string_literal_with_octal_escape() {
        // GAS octal: backslash + up to 3 octal digits (value mod 256).
        // \101 = 'A', \0 = NUL, \11 = tab.
        assert_eq!(kinds(&lex(r#""\101""#, 1).unwrap()), vec![TokenKind::StringLit(b"A".to_vec())]);
        assert_eq!(kinds(&lex(r#""a\0b""#, 1).unwrap()), vec![TokenKind::StringLit(vec![b'a', 0, b'b'])]);
        assert_eq!(kinds(&lex(r#""\11""#, 1).unwrap()), vec![TokenKind::StringLit(vec![9u8])]);
    }

    #[test]
    fn string_literal_with_hex_escape() {
        let t = lex("\"\\x48i\"", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::StringLit(b"Hi".to_vec())]);
    }

    #[test]
    fn hex_escape_takes_every_digit_that_follows_like_gas() {
        // GAS on `.ascii "\xA" / "\x123" / "\x41"` emits 0a 23 41: it
        // consumes as many hex digits as follow and keeps the low byte.
        // A fixed two-digit window makes `"\xA"` a hard error and splits
        // `"\x123"` into 0x12 plus a literal '3'.
        assert_eq!(
            kinds(&lex(r#""\xA""#, 1).unwrap()),
            vec![TokenKind::StringLit(vec![0x0A])]
        );
        assert_eq!(
            kinds(&lex(r#""\x123""#, 1).unwrap()),
            vec![TokenKind::StringLit(vec![0x23])]
        );
        assert_eq!(
            kinds(&lex(r#""\x1234""#, 1).unwrap()),
            vec![TokenKind::StringLit(vec![0x34])]
        );
        // Digits stop at the first non-hex byte, so a following letter
        // outside a-f stays a literal character.
        assert_eq!(
            kinds(&lex(r#""\x41z""#, 1).unwrap()),
            vec![TokenKind::StringLit(b"Az".to_vec())]
        );
    }

    #[test]
    fn leading_zero_integers_stay_octal_or_fail() {
        // `.word 017` is 15 on the course toolchain and `.word 018` is a
        // hard error there ("junk at end of line"). Falling through to
        // decimal answers 18 for the second, so two adjacent-looking
        // literals use different radixes.
        assert_eq!(kinds(&lex("017", 1).unwrap()), vec![TokenKind::IntLit(15)]);
        let err = lex("018", 1).unwrap_err().to_string();
        assert!(err.contains("octal"), "message was: {err}");
        assert!(err.contains("018"), "message was: {err}");
        // The radix prefixes and a lone zero are untouched.
        assert_eq!(kinds(&lex("0", 1).unwrap()), vec![TokenKind::IntLit(0)]);
        assert_eq!(kinds(&lex("0x18", 1).unwrap()), vec![TokenKind::IntLit(0x18)]);
        assert_eq!(kinds(&lex("0b11", 1).unwrap()), vec![TokenKind::IntLit(3)]);
    }

    #[test]
    fn unterminated_string_errors() {
        let err = lex("\"not closed", 1).unwrap_err();
        assert!(err.to_string().contains("unterminated string literal"));
    }

    #[test]
    fn string_may_not_span_lines() {
        // A stray quote on a later line must NOT terminate this string;
        // the error names the problem and blames the opening line.
        let err = lex("\"broken", 5).unwrap_err();
        match err {
            crate::errors::EmuError::ParseError { line, message } => {
                assert_eq!(line, 5);
                assert!(message.contains("unterminated string literal"));
                assert!(message.contains("end of the line"));
            }
            other => panic!("expected ParseError, got {other:?}"),
        }
    }

    #[test]
    fn unknown_escape_errors() {
        assert!(lex("'\\q'", 1).is_err());
    }

    #[test]
    fn shift_left_and_right() {
        let t = lex("1 << 4 >> 1", 1).unwrap();
        assert_eq!(
            kinds(&t),
            vec![
                TokenKind::IntLit(1),
                TokenKind::LShift,
                TokenKind::IntLit(4),
                TokenKind::RShift,
                TokenKind::IntLit(1),
            ]
        );
    }

    #[test]
    fn directive_ident_with_tight_dot() {
        let t = lex(".data", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::DirectiveIdent(".data".into())]);
    }

    #[test]
    fn standalone_dot_is_current_address() {
        let t = lex("msg_len = . - msg", 1).unwrap();
        assert_eq!(
            kinds(&t),
            vec![
                TokenKind::Ident("msg_len".into()),
                TokenKind::Equals,
                TokenKind::Dot,
                TokenKind::Minus,
                TokenKind::Ident("msg".into()),
            ]
        );
    }

    #[test]
    fn tight_dot_minus_is_dot_then_minus() {
        // `.-foo` lexes as Dot, Minus, Ident. The dot is standalone because
        // `-` is not an identifier-start character.
        let t = lex(".-foo", 1).unwrap();
        assert_eq!(
            kinds(&t),
            vec![
                TokenKind::Dot,
                TokenKind::Minus,
                TokenKind::Ident("foo".into()),
            ]
        );
    }

    #[test]
    fn addressing_mode_tokens() {
        let t = lex("[sp, #-16]!", 1).unwrap();
        assert_eq!(
            kinds(&t),
            vec![
                TokenKind::LBracket,
                TokenKind::Ident("sp".into()),
                TokenKind::Comma,
                TokenKind::Hash,
                TokenKind::Minus,
                TokenKind::IntLit(16),
                TokenKind::RBracket,
                TokenKind::Bang,
            ]
        );
    }

    #[test]
    fn extended_register_tokens() {
        // [x12, w9, SXTW 2]: the SXTW is just an identifier here.
        let t = lex("[x12, w9, SXTW 2]", 1).unwrap();
        assert_eq!(
            kinds(&t),
            vec![
                TokenKind::LBracket,
                TokenKind::Ident("x12".into()),
                TokenKind::Comma,
                TokenKind::Ident("w9".into()),
                TokenKind::Comma,
                TokenKind::Ident("SXTW".into()),
                TokenKind::IntLit(2),
                TokenKind::RBracket,
            ]
        );
    }

    #[test]
    fn line_and_column_tracking() {
        let t = lex("mov x0, x1\n  mov x2, x3", 1).unwrap();
        // "mov" at line 1 col 1, "x0" at line 1 col 5
        assert_eq!(t[0].line, 1);
        assert_eq!(t[0].col, 1);
        assert_eq!(t[1].line, 1);
        assert_eq!(t[1].col, 5);
        // "mov" on line 2 at col 3 (after two leading spaces)
        assert_eq!(t[4].line, 2);
        assert_eq!(t[4].col, 3);
    }

    #[test]
    fn starting_line_offset_applied() {
        let t = lex("mov x0, x1", 7).unwrap();
        assert_eq!(t[0].line, 7);
    }

    #[test]
    fn unknown_char_errors() {
        assert!(lex("$", 1).is_err());
    }

    #[test]
    fn non_ascii_char_is_named_with_its_code_point() {
        // A pasted NBSP is invisible in the editor; the error must name it
        // rather than echoing an unprintable byte.
        let err = lex("mov x0,\u{a0}1", 3).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("U+00A0"), "message was: {msg}");
        assert!(msg.contains("non-breaking space"), "message was: {msg}");
        assert!(msg.contains("line 3"), "message was: {msg}");
    }

    #[test]
    fn curly_quote_is_named_with_its_code_point() {
        let err = lex("mov x0, \u{2019}a\u{2019}", 1).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("U+2019"), "message was: {msg}");
        assert!(msg.contains("curly single quote"), "message was: {msg}");
    }

    #[test]
    fn single_lt_without_match_errors() {
        assert!(lex("<", 1).is_err());
    }

    #[test]
    fn identifier_with_underscores_and_digits() {
        let t = lex("score1_s", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::Ident("score1_s".into())]);
    }

    #[test]
    fn backslash_backslash_in_string_is_one_backslash() {
        let t = lex("\"a\\\\b\"", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::StringLit(b"a\\b".to_vec())]);
    }
}
