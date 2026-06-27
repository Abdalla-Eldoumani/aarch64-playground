//! Section-aware parser. Runs after m4 expansion and lexing. Produces a
//! `Program` with sections, labels, globals, aliases, and source map.
//!
//! Instruction encoding is deferred to the linker in phase A.7: we hold
//! each instruction as a raw token slice and its original line number,
//! because the token stream contains enough information to encode once
//! the symbol table (labels, section base addresses) is final.
//!
//! Data directive expressions evaluate immediately with an empty resolver
//! for now. Label-typed forward references in data slots are a phase A.7
//! concern; the corpus does not use them.

use super::expr::evaluate;
use super::lexer::{lex, Token, TokenKind};
use super::m4::expand;
use super::sections::{Item, Program, SectionKind, SymbolValue};
use crate::errors::EmuError;

/// Parse a cpsc 355 source string end to end: m4 expansion, lexing, then
/// statement-per-line dispatch into `Program`.
pub fn parse(source: &str) -> Result<Program, EmuError> {
    let expanded = expand(source)?;
    let tokens = lex(&expanded.text, 1)?;
    let mut prog = Program::new();
    prog.aliases = expanded.defines;
    prog.source_map = expanded.line_map;
    prog.expanded_source = expanded.text.clone();
    // Always initialize .text even if nothing goes into it; existing callers
    // expect a section to be present.
    prog.section_or_insert(SectionKind::Text);
    let mut current = SectionKind::Text;
    for line_tokens in group_by_line(&tokens) {
        parse_line(line_tokens, &mut prog, &mut current)?;
    }
    Ok(prog)
}

fn group_by_line(tokens: &[Token]) -> Vec<&[Token]> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut current_line = tokens.first().map(|t| t.line);
    for (i, tok) in tokens.iter().enumerate() {
        if Some(tok.line) != current_line {
            out.push(&tokens[start..i]);
            start = i;
            current_line = Some(tok.line);
        }
    }
    if start < tokens.len() {
        out.push(&tokens[start..]);
    }
    out
}

fn parse_line(
    line_tokens: &[Token],
    prog: &mut Program,
    current: &mut SectionKind,
) -> Result<(), EmuError> {
    if line_tokens.is_empty() {
        return Ok(());
    }
    let first = &line_tokens[0];
    match &first.kind {
        // GCC emits local labels that start with a dot (`.L2:`, `.Ltext0:`).
        // Treat any dotted-name token followed by `:` as a label; leave the
        // directive path for the real-directive case without a colon.
        TokenKind::DirectiveIdent(name)
            if line_tokens
                .get(1)
                .is_some_and(|t| matches!(t.kind, TokenKind::Colon)) =>
        {
            let label = name.clone();
            let section = prog.section_or_insert(*current);
            section.items.push(Item::Label(label.clone()));
            prog.symbols.insert(
                label,
                SymbolValue::Address {
                    section: *current,
                    offset: 0,
                },
            );
            let rest = &line_tokens[2..];
            parse_line(rest, prog, current)
        }
        TokenKind::DirectiveIdent(name) => {
            parse_directive(name, &line_tokens[1..], prog, current, first.line)
        }
        TokenKind::Ident(name)
            if line_tokens
                .get(1)
                .is_some_and(|t| matches!(t.kind, TokenKind::Colon)) =>
        {
            // Label definition, possibly followed by an instruction on the
            // same line. Emit the label, then recurse on the remainder.
            let label = name.clone();
            let section = prog.section_or_insert(*current);
            section.items.push(Item::Label(label.clone()));
            prog.symbols.insert(
                label,
                SymbolValue::Address {
                    section: *current,
                    offset: 0,
                },
            );
            let rest = &line_tokens[2..];
            parse_line(rest, prog, current)
        }
        TokenKind::Ident(name)
            if line_tokens
                .get(1)
                .is_some_and(|t| matches!(t.kind, TokenKind::Equals))
                && !line_tokens
                    .get(2)
                    .is_some_and(|t| matches!(t.kind, TokenKind::Equals)) =>
        {
            // `name = expr`. Record as a symbol-assignment item so Pass 1a
            // can evaluate the body at this exact section offset. We keep
            // the body as raw text (via the tokens' textual form) and let
            // the linker lex+evaluate it, so `.` and label references pick
            // up the right meaning.
            let body_tokens = &line_tokens[2..];
            let body = stringify_tokens_space(body_tokens);
            let section = prog.section_or_insert(*current);
            section.items.push(Item::SymbolAssignment {
                name: name.clone(),
                body,
                original_line: first.line,
            });
            Ok(())
        }
        TokenKind::Ident(_) => {
            // Instruction line: hand the whole slice to the linker later.
            let line = first.line;
            let section = prog.section_or_insert(*current);
            section.items.push(Item::Instruction {
                tokens: line_tokens.to_vec(),
                original_line: line,
            });
            Ok(())
        }
        _ => Err(err(
            first.line,
            "unexpected token at start of line",
        )),
    }
}

fn parse_directive(
    name: &str,
    rest: &[Token],
    prog: &mut Program,
    current: &mut SectionKind,
    line: usize,
) -> Result<(), EmuError> {
    match name {
        ".text" => {
            require_no_args(rest, line, name)?;
            *current = SectionKind::Text;
            prog.section_or_insert(SectionKind::Text);
            Ok(())
        }
        ".data" => {
            require_no_args(rest, line, name)?;
            *current = SectionKind::Data;
            prog.section_or_insert(SectionKind::Data);
            Ok(())
        }
        ".bss" => {
            require_no_args(rest, line, name)?;
            *current = SectionKind::Bss;
            prog.section_or_insert(SectionKind::Bss);
            Ok(())
        }
        ".rodata" => {
            require_no_args(rest, line, name)?;
            *current = SectionKind::Rodata;
            prog.section_or_insert(SectionKind::Rodata);
            Ok(())
        }
        ".section" => {
            let kind = parse_section_name(rest, line)?;
            *current = kind;
            prog.section_or_insert(kind);
            Ok(())
        }
        ".global" | ".globl" => {
            let name = require_single_ident(rest, line, ".global")?;
            prog.globals.insert(name);
            Ok(())
        }
        ".type" | ".size" => {
            // Decorative, not useful to the emulator. Consume and move on.
            Ok(())
        }
        ".balign" => {
            let value = eval_const(rest, line)?;
            if value <= 0 {
                return Err(err(line, ".balign needs a positive byte count"));
            }
            prog.section_or_insert(*current)
                .items
                .push(Item::AlignToBytes(value as u64));
            Ok(())
        }
        ".align" => {
            // On AArch64 GAS, `.align N` is power-of-two: align to 2^N bytes.
            let n = eval_const(rest, line)?;
            if !(0..=32).contains(&n) {
                return Err(err(line, ".align exponent out of range"));
            }
            let bytes = 1u64 << n;
            prog.section_or_insert(*current)
                .items
                .push(Item::AlignToBytes(bytes));
            Ok(())
        }
        ".skip" | ".zero" => {
            let n = eval_const(rest, line)?;
            if n < 0 {
                return Err(err(line, ".skip needs a non-negative byte count"));
            }
            prog.section_or_insert(*current)
                .items
                .push(Item::Reserve(n as u64));
            Ok(())
        }
        ".string" | ".asciz" => {
            let mut bytes = parse_string_arg(rest, line)?;
            bytes.push(0);
            prog.section_or_insert(*current)
                .items
                .push(Item::Bytes(bytes));
            Ok(())
        }
        ".ascii" => {
            let bytes = parse_string_arg(rest, line)?;
            prog.section_or_insert(*current)
                .items
                .push(Item::Bytes(bytes));
            Ok(())
        }
        ".byte" => emit_int_list(rest, prog, *current, line, 1),
        ".hword" | ".short" => emit_int_list(rest, prog, *current, line, 2),
        ".word" => emit_int_list(rest, prog, *current, line, 4),
        ".quad" => emit_int_list(rest, prog, *current, line, 8),
        ".double" => emit_float_list(rest, prog, *current, line, true),
        ".float" => emit_float_list(rest, prog, *current, line, false),
        other => Err(err(line, &format!("unknown directive `{other}`"))),
    }
}

fn require_no_args(rest: &[Token], line: usize, name: &str) -> Result<(), EmuError> {
    if !rest.is_empty() {
        return Err(err(line, &format!("{name} takes no arguments")));
    }
    Ok(())
}

fn parse_section_name(rest: &[Token], line: usize) -> Result<SectionKind, EmuError> {
    let tok = rest
        .first()
        .ok_or_else(|| err(line, ".section needs a name"))?;
    let name = match &tok.kind {
        TokenKind::DirectiveIdent(n) => n.as_str(),
        TokenKind::Ident(n) => n.as_str(),
        _ => return Err(err(line, ".section needs a name")),
    };
    match name.trim_start_matches('.') {
        "text" => Ok(SectionKind::Text),
        "data" => Ok(SectionKind::Data),
        "rodata" => Ok(SectionKind::Rodata),
        "bss" => Ok(SectionKind::Bss),
        other => Err(err(line, &format!("unsupported section `{other}`"))),
    }
}

fn require_single_ident(rest: &[Token], line: usize, name: &str) -> Result<String, EmuError> {
    match rest {
        [Token {
            kind: TokenKind::Ident(n),
            ..
        }] => Ok(n.clone()),
        _ => Err(err(line, &format!("{name} expects a single identifier"))),
    }
}

fn parse_string_arg(rest: &[Token], line: usize) -> Result<Vec<u8>, EmuError> {
    match rest {
        [Token {
            kind: TokenKind::StringLit(bytes),
            ..
        }] => Ok(bytes.clone()),
        _ => Err(err(line, "expected a single string literal")),
    }
}

fn emit_int_list(
    rest: &[Token],
    prog: &mut Program,
    current: SectionKind,
    line: usize,
    width: usize,
) -> Result<(), EmuError> {
    let exprs = split_comma_groups(rest);
    let mut out = Vec::with_capacity(exprs.len() * width);
    for expr in exprs {
        let value = evaluate(expr, &|_| None, 0, line)?;
        append_le(&mut out, value, width);
    }
    prog.section_or_insert(current)
        .items
        .push(Item::Bytes(out));
    Ok(())
}

fn emit_float_list(
    rest: &[Token],
    prog: &mut Program,
    current: SectionKind,
    line: usize,
    is_double: bool,
) -> Result<(), EmuError> {
    let exprs = split_comma_groups(rest);
    let mut out = Vec::new();
    for expr in exprs {
        let value = single_float(expr, line)?;
        if is_double {
            out.extend_from_slice(&value.to_bits().to_le_bytes());
        } else {
            out.extend_from_slice(&(value as f32).to_bits().to_le_bytes());
        }
    }
    prog.section_or_insert(current)
        .items
        .push(Item::Bytes(out));
    Ok(())
}

fn single_float(tokens: &[Token], line: usize) -> Result<f64, EmuError> {
    // Accept either a plain `0r...` float literal, or a `-0r...` negated
    // literal. The corpus uses both forms.
    match tokens {
        [Token {
            kind: TokenKind::FloatLit(v),
            ..
        }] => Ok(*v),
        [Token {
            kind: TokenKind::Minus,
            ..
        }, Token {
            kind: TokenKind::FloatLit(v),
            ..
        }] => Ok(-*v),
        [Token {
            kind: TokenKind::IntLit(v),
            ..
        }] => Ok(*v as f64),
        [Token {
            kind: TokenKind::Minus,
            ..
        }, Token {
            kind: TokenKind::IntLit(v),
            ..
        }] => Ok(-(*v as f64)),
        _ => Err(err(
            line,
            "expected a float literal (0r...) or integer for .double/.float",
        )),
    }
}

fn split_comma_groups(tokens: &[Token]) -> Vec<&[Token]> {
    let mut out = Vec::new();
    let mut start = 0;
    for (i, tok) in tokens.iter().enumerate() {
        if matches!(tok.kind, TokenKind::Comma) {
            out.push(&tokens[start..i]);
            start = i + 1;
        }
    }
    if start < tokens.len() {
        out.push(&tokens[start..]);
    }
    out
}

fn eval_const(tokens: &[Token], line: usize) -> Result<i64, EmuError> {
    evaluate(tokens, &|_| None, 0, line)
}

fn append_le(out: &mut Vec<u8>, value: i64, width: usize) {
    let bytes = value.to_le_bytes();
    out.extend_from_slice(&bytes[..width]);
}

fn err(line: usize, message: &str) -> EmuError {
    EmuError::ParseError {
        line,
        message: message.to_string(),
    }
}

/// Render a token slice as source text, space-separated. Good enough for
/// round-tripping an expression body into the linker for later evaluation;
/// the lexer is the authoritative parser, so whitespace is just a separator.
fn stringify_tokens_space(tokens: &[Token]) -> String {
    let mut out = String::new();
    for t in tokens {
        match &t.kind {
            TokenKind::Ident(s) => out.push_str(s),
            TokenKind::DirectiveIdent(s) => out.push_str(s),
            TokenKind::IntLit(v) => out.push_str(&format!("{v}")),
            TokenKind::FloatLit(v) => out.push_str(&format!("{v}")),
            TokenKind::CharLit(v) => out.push_str(&format!("{v}")),
            TokenKind::StringLit(_) => out.push_str("\"...\""),
            TokenKind::Comma => out.push(','),
            TokenKind::Colon => out.push(':'),
            TokenKind::Plus => out.push('+'),
            TokenKind::Minus => out.push('-'),
            TokenKind::Star => out.push('*'),
            TokenKind::Slash => out.push('/'),
            TokenKind::Percent => out.push('%'),
            TokenKind::Amp => out.push('&'),
            TokenKind::Pipe => out.push('|'),
            TokenKind::Caret => out.push('^'),
            TokenKind::Tilde => out.push('~'),
            TokenKind::Bang => out.push('!'),
            TokenKind::LShift => out.push_str("<<"),
            TokenKind::RShift => out.push_str(">>"),
            TokenKind::LParen => out.push('('),
            TokenKind::RParen => out.push(')'),
            TokenKind::LBracket => out.push('['),
            TokenKind::RBracket => out.push(']'),
            TokenKind::LBrace => out.push('{'),
            TokenKind::RBrace => out.push('}'),
            TokenKind::Dot => out.push('.'),
            TokenKind::Hash => out.push('#'),
            TokenKind::Equals => out.push('='),
        }
        out.push(' ');
    }
    out.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_ok(src: &str) -> Program {
        parse(src).expect("parse should succeed")
    }

    fn section_bytes(prog: &Program, kind: SectionKind) -> Vec<u8> {
        let mut out = Vec::new();
        if let Some(sec) = prog.section(kind) {
            for item in &sec.items {
                if let Item::Bytes(b) = item {
                    out.extend_from_slice(b);
                }
            }
        }
        out
    }

    #[test]
    fn empty_source_still_has_text_section() {
        let p = parse_ok("");
        assert!(p.section(SectionKind::Text).is_some());
    }

    #[test]
    fn text_section_holds_instruction_tokens() {
        let p = parse_ok(".text\nmov x0, #1\n");
        let text = p.section(SectionKind::Text).unwrap();
        let instr_count = text
            .items
            .iter()
            .filter(|i| matches!(i, Item::Instruction { .. }))
            .count();
        assert_eq!(instr_count, 1);
    }

    #[test]
    fn data_section_holds_string_bytes_with_null_terminator() {
        let p = parse_ok(".data\n.string \"Hi\\n\"\n");
        assert_eq!(section_bytes(&p, SectionKind::Data), b"Hi\n\0");
    }

    #[test]
    fn asciz_matches_string() {
        let p = parse_ok(".data\n.asciz \"Hi\"\n");
        assert_eq!(section_bytes(&p, SectionKind::Data), b"Hi\0");
    }

    #[test]
    fn ascii_omits_null_terminator() {
        let p = parse_ok(".data\n.ascii \"Hi\"\n");
        assert_eq!(section_bytes(&p, SectionKind::Data), b"Hi");
    }

    #[test]
    fn byte_directive_little_endian_single_byte() {
        let p = parse_ok(".data\n.byte 1, 2, 3\n");
        assert_eq!(section_bytes(&p, SectionKind::Data), vec![1, 2, 3]);
    }

    #[test]
    fn hword_is_two_bytes_little_endian() {
        let p = parse_ok(".data\n.hword 0x1234\n");
        assert_eq!(section_bytes(&p, SectionKind::Data), vec![0x34, 0x12]);
    }

    #[test]
    fn word_is_four_bytes_little_endian() {
        let p = parse_ok(".data\n.word 0x12345678\n");
        assert_eq!(
            section_bytes(&p, SectionKind::Data),
            vec![0x78, 0x56, 0x34, 0x12]
        );
    }

    #[test]
    fn quad_is_eight_bytes_little_endian() {
        let p = parse_ok(".data\n.quad 0xdeadbeefcafebabe\n");
        assert_eq!(
            section_bytes(&p, SectionKind::Data),
            vec![0xbe, 0xba, 0xfe, 0xca, 0xef, 0xbe, 0xad, 0xde]
        );
    }

    #[test]
    fn double_emits_ieee_bits_little_endian() {
        let p = parse_ok(".data\n.double 0r3.14159265358979\n");
        let bytes = section_bytes(&p, SectionKind::Data);
        assert_eq!(bytes.len(), 8);
        let mut arr = [0u8; 8];
        arr.copy_from_slice(&bytes);
        let v = f64::from_bits(u64::from_le_bytes(arr));
        assert!((v - std::f64::consts::PI).abs() < 1e-14);
    }

    #[test]
    fn negative_double_literal() {
        let p = parse_ok(".data\n.double -0r1.5\n");
        let bytes = section_bytes(&p, SectionKind::Data);
        let mut arr = [0u8; 8];
        arr.copy_from_slice(&bytes);
        let v = f64::from_bits(u64::from_le_bytes(arr));
        assert_eq!(v, -1.5);
    }

    #[test]
    fn skip_reserves_zeroed_bytes() {
        let p = parse_ok(".bss\narr: .skip 40\n");
        let bss = p.section(SectionKind::Bss).unwrap();
        let reserve = bss
            .items
            .iter()
            .find_map(|i| if let Item::Reserve(n) = i { Some(*n) } else { None });
        assert_eq!(reserve, Some(40));
    }

    #[test]
    fn zero_directive_matches_skip() {
        let p = parse_ok(".bss\n.zero 16\n");
        let bss = p.section(SectionKind::Bss).unwrap();
        assert!(bss
            .items
            .iter()
            .any(|i| matches!(i, Item::Reserve(16))));
    }

    #[test]
    fn balign_passes_byte_count_through() {
        let p = parse_ok(".text\n.balign 4\n");
        let text = p.section(SectionKind::Text).unwrap();
        assert!(text
            .items
            .iter()
            .any(|i| matches!(i, Item::AlignToBytes(4))));
    }

    #[test]
    fn align_converts_to_power_of_two() {
        // .align 4 on AArch64 GAS means 2^4 = 16 bytes.
        let p = parse_ok(".text\n.align 4\n");
        let text = p.section(SectionKind::Text).unwrap();
        assert!(text
            .items
            .iter()
            .any(|i| matches!(i, Item::AlignToBytes(16))));
    }

    #[test]
    fn global_records_name() {
        let p = parse_ok(".global main\n");
        assert!(p.globals.contains("main"));
    }

    #[test]
    fn globl_equivalent() {
        let p = parse_ok(".globl main\n");
        assert!(p.globals.contains("main"));
    }

    #[test]
    fn type_and_size_are_accepted_silently() {
        let p = parse_ok(".type foo, %function\n.size foo, . - foo\n");
        // No error, no side effects we care about.
        assert!(p.globals.is_empty());
    }

    #[test]
    fn section_rodata_switches_current_section() {
        let p = parse_ok(".section .rodata\n.string \"x\"\n");
        assert_eq!(section_bytes(&p, SectionKind::Rodata), b"x\0");
    }

    #[test]
    fn bare_rodata_directive_switches_current_section() {
        // The plain `.rodata` switcher must work the same as `.data` /
        // `.bss`, not only the `.section .rodata` named form.
        let p = parse_ok(".rodata\nro: .word 100\n.text\nmov x0, #1\n");
        assert_eq!(section_bytes(&p, SectionKind::Rodata), vec![100, 0, 0, 0]);
        let text = p.section(SectionKind::Text).unwrap();
        assert!(text
            .items
            .iter()
            .any(|i| matches!(i, Item::Instruction { .. })));
    }

    #[test]
    fn label_captured_with_current_section() {
        let p = parse_ok(".text\nmain:\nmov x0, #1\n");
        match p.symbols.get("main") {
            Some(SymbolValue::Address { section, .. }) => {
                assert_eq!(*section, SectionKind::Text);
            }
            other => panic!("expected address symbol, got {other:?}"),
        }
        // Label item precedes instruction item in the .text section.
        let text = p.section(SectionKind::Text).unwrap();
        assert!(matches!(text.items[0], Item::Label(ref n) if n == "main"));
        assert!(matches!(text.items[1], Item::Instruction { .. }));
    }

    #[test]
    fn label_with_instruction_on_same_line() {
        let p = parse_ok("main: mov x0, #1\n");
        let text = p.section(SectionKind::Text).unwrap();
        assert!(matches!(text.items[0], Item::Label(_)));
        assert!(matches!(text.items[1], Item::Instruction { .. }));
    }

    #[test]
    fn section_switch_between_data_and_text() {
        let p = parse_ok(".text\nmov x0, #1\n.data\n.word 42\n.text\nmov x1, #2\n");
        let text = p.section(SectionKind::Text).unwrap();
        let instr_count = text
            .items
            .iter()
            .filter(|i| matches!(i, Item::Instruction { .. }))
            .count();
        assert_eq!(instr_count, 2, "both instructions should land in .text");
        let data = p.section(SectionKind::Data).unwrap();
        assert_eq!(
            data.items
                .iter()
                .filter(|i| matches!(i, Item::Bytes(_)))
                .count(),
            1
        );
    }

    #[test]
    fn unknown_directive_errors() {
        assert!(parse(".nosuch 1\n").is_err());
    }

    #[test]
    fn aliases_from_m4_propagate_to_program() {
        let p = parse_ok("define(fp, x29)\n.text\nmov x0, fp\n");
        assert_eq!(p.aliases.get("fp").map(String::as_str), Some("x29"));
        // And `fp` in the instruction line should have been expanded to x29.
        let text = p.section(SectionKind::Text).unwrap();
        if let Item::Instruction { tokens, .. } = &text.items[0] {
            let idents: Vec<&str> = tokens
                .iter()
                .filter_map(|t| match &t.kind {
                    TokenKind::Ident(n) => Some(n.as_str()),
                    _ => None,
                })
                .collect();
            assert!(idents.contains(&"x29"), "tokens: {idents:?}");
        } else {
            panic!("expected an instruction item");
        }
    }

    #[test]
    fn default_section_is_text_when_no_section_directive_given() {
        let p = parse_ok("mov x0, #1\n");
        let text = p.section(SectionKind::Text).unwrap();
        assert!(text
            .items
            .iter()
            .any(|i| matches!(i, Item::Instruction { .. })));
    }

    #[test]
    fn byte_list_handles_signed_wrap() {
        // -1 should encode as 0xFF in a .byte slot.
        let p = parse_ok(".data\n.byte -1\n");
        assert_eq!(section_bytes(&p, SectionKind::Data), vec![0xff]);
    }

    #[test]
    fn word_list_with_expression() {
        let p = parse_ok(".data\n.word 2 * 3 + 4\n");
        assert_eq!(
            section_bytes(&p, SectionKind::Data),
            vec![10, 0, 0, 0]
        );
    }

    #[test]
    fn float_literal_in_float_directive() {
        let p = parse_ok(".data\n.float 0r1.5\n");
        let bytes = section_bytes(&p, SectionKind::Data);
        assert_eq!(bytes.len(), 4);
        let mut arr = [0u8; 4];
        arr.copy_from_slice(&bytes);
        let v = f32::from_bits(u32::from_le_bytes(arr));
        assert_eq!(v, 1.5_f32);
    }

    #[test]
    fn balign_requires_positive_argument() {
        assert!(parse(".text\n.balign 0\n").is_err());
        assert!(parse(".text\n.balign -4\n").is_err());
    }

    #[test]
    fn skip_rejects_negative_count() {
        assert!(parse(".bss\n.skip -1\n").is_err());
    }

    // -- source-map correctness --

    #[test]
    fn error_on_word_expression_reports_original_line() {
        // Three preceding lines produce no tokens; the error is on line 4 of
        // the source, and that's the line number we want surfaced.
        let src = "define(fp, x29)\n.data\nfoo: .word 1\n.word 0xgarbage\n";
        match parse(src) {
            Err(crate::errors::EmuError::ParseError { line, .. }) => {
                assert_eq!(line, 4);
            }
            other => panic!("expected ParseError at line 4, got {other:?}"),
        }
    }

    #[test]
    fn error_in_preprocessor_reports_original_line() {
        let src = "define(fp, x29)\nmov x0, fp\nifdef(FOO, bar)\n";
        match parse(src) {
            Err(crate::errors::EmuError::PreprocError { line, .. }) => {
                assert_eq!(line, 3);
            }
            other => panic!("expected PreprocError at line 3, got {other:?}"),
        }
    }
}
