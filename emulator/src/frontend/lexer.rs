//! Token stream for cpsc 355 assembly. Runs after m4 expansion, so it does
//! not see `define(...)` or the assignment form -- those are gone by now.
//!
//! The lexer classifies at the cheapest possible level. It does not know
//! which identifiers are mnemonics or registers (the parser decides that
//! when it has context). It does handle the two tricky numeric forms the
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
            let value = parse_int(text).ok_or_else(|| {
                lex_err(line, &format!("invalid integer literal `{text}`"))
            })?;
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
        return Err(lex_err(line, &format!("unexpected character `{}`", b as char)));
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
    // `parse_int` does the per-prefix validation. Note b'a'..=b'f' already
    // covers b'b', and b'A'..=b'F' covers b'B', so the hex ranges include
    // the binary-prefix letters.
    matches!(b,
        b'0'..=b'9' | b'a'..=b'f' | b'A'..=b'F' | b'x' | b'X' | b'_'
    )
}

fn is_float_body(b: u8) -> bool {
    matches!(b, b'0'..=b'9' | b'.' | b'e' | b'E' | b'+' | b'-')
}

fn parse_int(text: &str) -> Option<i64> {
    // Strip internal underscores, per the brief's tolerance for readability.
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
    // Leading-zero octal a la GAS. "0" alone is decimal zero.
    if s.len() > 1 && s.starts_with('0') && s.bytes().all(|b| (b'0'..=b'7').contains(&b)) {
        return u64::from_str_radix(&s[1..], 8).ok().map(|v| v as i64);
    }
    s.parse::<i64>().ok()
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
        b'0' => Ok((0, 2)),
        b'\\' => Ok((b'\\' as u32, 2)),
        b'"' => Ok((b'"' as u32, 2)),
        b'\'' => Ok((b'\'' as u32, 2)),
        b'x' | b'X' => {
            if bytes.len() < 4 {
                return Err(lex_err(line, "incomplete \\xNN escape"));
            }
            let hex = std::str::from_utf8(&bytes[2..4])
                .map_err(|_| lex_err(line, "invalid \\xNN escape"))?;
            let value = u32::from_str_radix(hex, 16)
                .map_err(|_| lex_err(line, "invalid \\xNN escape"))?;
            Ok((value, 4))
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
    fn string_literal_with_hex_escape() {
        let t = lex("\"\\x48i\"", 1).unwrap();
        assert_eq!(kinds(&t), vec![TokenKind::StringLit(b"Hi".to_vec())]);
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
        // [x12, w9, SXTW 2] -- the SXTW is just an identifier here.
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
