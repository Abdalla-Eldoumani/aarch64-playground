//! Section-aware parser. Runs after m4 expansion and lexing. Produces a
//! `Program` with sections, labels, globals, and aliases.
//!
//! Instruction encoding is deferred to the linker: we hold each instruction
//! as a raw token slice and its original line number, because the token
//! stream contains enough information to encode once the symbol table
//! (labels, section base addresses) is final.
//!
//! Data directive expressions evaluate eagerly with an empty resolver; a
//! slot that names a label defers, holding its raw tokens for the linker to
//! fold once the symbol table is final (GCC jump tables rely on this).

use std::collections::HashMap;

use super::expr::evaluate;
use super::lexer::{lex, Token, TokenKind};
use super::m4::expand;
use super::sections::{Item, Program, SectionKind, SymbolValue};
use crate::errors::EmuError;

/// Parse a cpsc 355 source string end to end: m4 expansion, the `.req`
/// register-alias pass, lexing, then statement-per-line dispatch into
/// `Program`.
pub fn parse(source: &str) -> Result<Program, EmuError> {
    let expanded = expand(source)?;
    let (text, req_aliases) = apply_req_aliases(&expanded.text)?;
    let mut prog = Program::new();
    prog.aliases = expanded.defines;
    prog.aliases.extend(req_aliases);
    prog.expanded_source = text.clone();
    let tokens = lex(&text, 1)?;
    // Always initialize .text even if nothing goes into it; existing callers
    // expect a section to be present.
    prog.section_or_insert(SectionKind::Text);
    let mut current = SectionKind::Text;
    for line_tokens in group_by_line(&tokens) {
        parse_line(line_tokens, &mut prog, &mut current)?;
    }
    Ok(prog)
}

/// Apply GAS `name .req register` aliases textually, after m4 and before
/// lexing. Course assignment files alias both general and FP registers
/// this way (`fp .req x29`, `sum .req d19`). A definition takes effect on
/// the lines after it; the definition line itself is blanked, not removed,
/// so line numbers stay aligned with the editor. m4 has already stripped
/// comments, so a whitespace split sees exactly the definition's three
/// words. Substitution is the same token-boundary, string-literal-safe
/// walk m4 defines use, so an alias works anywhere a register can appear
/// and never rewrites `.string` text. The alias target is taken as
/// written; a target that is not a register surfaces as the normal
/// unknown-register error at the first use site.
///
/// Expansion is bounded exactly the way m4's is. This pass runs on
/// already-expanded text and used to have no ceiling at all, so a chain of
/// aliases each naming the one before it materialized gigabytes before the
/// assembler ever saw a line.
fn apply_req_aliases(text: &str) -> Result<(String, HashMap<String, String>), EmuError> {
    // Fast path: nothing to do for the overwhelmingly common case.
    if !text.contains(".req") {
        return Ok((text.to_string(), HashMap::new()));
    }
    let mut aliases: HashMap<String, String> = HashMap::new();
    let mut out = String::with_capacity(text.len());
    let mut first = true;
    let mut total: usize = 0;
    for (idx, line) in text.lines().enumerate() {
        let line_num = idx + 1;
        if !first {
            out.push('\n');
        }
        first = false;
        let mut parts = line.split_whitespace();
        if let (Some(name), Some(req), Some(target), None) =
            (parts.next(), parts.next(), parts.next(), parts.next())
        {
            if req.eq_ignore_ascii_case(".req") && is_plain_ident_text(name) {
                // Resolve alias-to-alias at definition time so later
                // substitution is a single lookup.
                let resolved = aliases.get(target).cloned().unwrap_or_else(|| target.to_string());
                aliases.insert(name.to_string(), resolved);
                // Blank the definition; keep the line for the line map.
                continue;
            }
        }
        if aliases.is_empty() {
            out.push_str(line);
            total = total.saturating_add(line.len());
        } else {
            // The ceiling never drops below the input, so a long line that
            // holds no alias still passes through.
            let limit = super::m4::MAX_EXPANDED_LINE_BYTES.max(line.len());
            let expanded = super::m4::substitute_once(line, &aliases, limit).ok_or_else(|| {
                EmuError::PreprocError {
                    line: line_num,
                    message: format!(
                        "`.req` alias expansion grew this line past {} bytes; \
                         an alias chain is expanding without settling",
                        super::m4::MAX_EXPANDED_LINE_BYTES
                    ),
                }
            })?;
            total = total.saturating_add(expanded.len());
            out.push_str(&expanded);
        }
        // Per-line is not enough on its own: a short alias body repeated
        // across thousands of lines still sums into the gigabytes.
        if total > super::m4::MAX_EXPANDED_TOTAL_BYTES {
            return Err(EmuError::PreprocError {
                line: line_num,
                message: format!(
                    "`.req` alias expansion grew the whole source past {} MiB. \
                     Shrink the alias body or the number of references",
                    super::m4::MAX_EXPANDED_TOTAL_BYTES / (1024 * 1024)
                ),
            });
        }
    }
    Ok((out, aliases))
}

/// A `.req` alias name: identifier shaped, no dots (dotted names are GCC
/// local labels and directives, never alias names).
fn is_plain_ident_text(s: &str) -> bool {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
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
    // Labels can stack on one line (`a: b: c: ret`). Peeling them by
    // recursion cost a stack frame per label, and a long enough line
    // overflowed the wasm stack -- an unrecoverable trap that skips
    // wasm-bindgen's borrow-guard Drop and wedges every later call. Peel
    // them in a loop, so the depth is a loop counter instead.
    let mut line_tokens = line_tokens;
    loop {
    if line_tokens.is_empty() {
        return Ok(());
    }
    let first = &line_tokens[0];
    return match &first.kind {
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
            section.items.push(Item::Label {
                name: label.clone(),
                original_line: first.line,
            });
            prog.symbols.insert(
                label,
                SymbolValue::Address {
                    section: *current,
                    offset: 0,
                },
            );
            line_tokens = &line_tokens[2..];
            continue;
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
            // same line. Emit the label, then go round with the remainder.
            let label = name.clone();
            let section = prog.section_or_insert(*current);
            section.items.push(Item::Label {
                name: label.clone(),
                original_line: first.line,
            });
            prog.symbols.insert(
                label,
                SymbolValue::Address {
                    section: *current,
                    offset: 0,
                },
            );
            line_tokens = &line_tokens[2..];
            continue;
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
        // `#` starts a comment in x86/MIPS/ARM32 assembly but not here;
        // name the habit and the fix rather than a bare "unexpected token".
        TokenKind::Hash => Err(err(
            first.line,
            "`#` is not a comment character here. Write comments with `//` or `;`",
        )),
        other => Err(err(
            first.line,
            &format!(
                "unexpected {} at the start of a line. A line starts with a label, \
                 an instruction, or a directive",
                crate::frontend::lexer::describe(other)
            ),
        )),
    };
    }
}

/// Every directive spelling `parse_directive` recognizes, aliases included.
/// Recognized is not the same as accepted: `.equ`/`.set` are listed because
/// the parser answers them with the teaching message that points at
/// `NAME = expression`, which is a real answer rather than "unknown
/// directive". `detect_hosted_mode` in lib.rs decides from this list which
/// programs take the hosted path, and `every_directive_reaches_an_arm`
/// proves no entry falls through to the unknown-directive arm.
pub const DIRECTIVES: &[&str] = &[
    // sections
    ".text", ".data", ".bss", ".rodata", ".section",
    // symbol attributes
    ".global", ".globl", ".type", ".size",
    // alignment and reservation
    ".balign", ".align", ".skip", ".zero", ".space",
    // strings
    ".string", ".asciz", ".ascii",
    // integers
    ".byte", ".hword", ".short", ".word", ".quad", ".dword",
    // floats
    ".double", ".float",
    // recognized, answered with the "write NAME = expression" message
    ".equ", ".set",
];

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
        ".skip" | ".zero" | ".space" => {
            // GAS: `.skip size[, fill]` and `.space size[, fill]` reserve
            // `size` bytes holding the low byte of `fill` (default 0);
            // `.zero size` takes the size alone. A nonzero fill only means
            // something in a data section; in .bss GAS ignores it and
            // zero-fills.
            let groups = split_comma_groups(rest);
            if groups.len() > 2 || groups.iter().any(|g| g.is_empty()) {
                return Err(err(
                    line,
                    "expected `.space size` or `.space size, fill`",
                ));
            }
            if name == ".zero" && groups.len() == 2 {
                return Err(err(
                    line,
                    "`.zero` takes a size only. Use `.space size, fill` to fill with a byte",
                ));
            }
            let count = groups[0];
            let fill = match groups.get(1) {
                Some(g) => (eval_const(g, line)? & 0xFF) as u8,
                None => 0,
            };
            // A count naming an equate (`.skip STACKSIZE * 4`) resolves
            // in the linker's layout walk; constants resolve right here.
            let symbolic = count
                .iter()
                .any(|t| matches!(t.kind, TokenKind::Ident(_) | TokenKind::Dot));
            if symbolic {
                if fill != 0 {
                    return Err(err(
                        line,
                        "a symbolic size cannot take a nonzero fill. \
                         Write the size as a plain constant",
                    ));
                }
                prog.section_or_insert(*current).items.push(Item::ReserveExpr {
                    tokens: count.to_vec(),
                    original_line: line,
                });
                return Ok(());
            }
            let n = eval_const(count, line)?;
            if n < 0 {
                return Err(err(line, ".skip needs a non-negative byte count"));
            }
            if fill != 0 && !matches!(*current, SectionKind::Bss) {
                // Refuse before materializing: the filled bytes are
                // allocated here, ahead of the linker's 1 MiB window
                // check, and on wasm32 a giant Vec is an allocation
                // abort rather than an error message.
                if n as u64 > 1024 * 1024 {
                    return Err(err(
                        line,
                        "the fill would outgrow the section's 1 MiB window. \
                         Shrink the size",
                    ));
                }
                prog.section_or_insert(*current)
                    .items
                    .push(Item::Bytes(vec![fill; n as usize]));
            } else {
                prog.section_or_insert(*current)
                    .items
                    .push(Item::Reserve(n as u64));
            }
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
        // `.dword` is the spelling course files write for 8-byte values;
        // `.quad` is the GAS name GCC output carries. Same emission.
        ".quad" | ".dword" => emit_int_list(rest, prog, *current, line, 8),
        ".double" => emit_float_list(rest, prog, *current, line, true),
        ".float" => emit_float_list(rest, prog, *current, line, false),
        // Constants are supported, just not under these spellings; say so
        // instead of calling the directive unknown.
        ".equ" | ".set" => Err(err(
            line,
            "`.equ`/`.set` are not supported; write `NAME = expression` instead \
             (for example `SIZE = 40`)",
        )),
        other => Err(err(
            line,
            &format!(
                "unknown directive `{other}`: the directives the playground \
                 recognizes are {}",
                directive_list()
            ),
        )),
    }
}

/// The directive spellings, read off `DIRECTIVES` rather than written out,
/// so a directive added to the match cannot leave the message behind.
fn directive_list() -> String {
    match DIRECTIVES.split_last() {
        Some((last, rest)) => format!("{}, and {last}", rest.join(", ")),
        None => String::new(),
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
    // Catch a doubled/leading/trailing comma here, where the directive is
    // known, instead of letting the evaluator (or the linker, for deferred
    // symbol lists) report a baffling "end of input" for a file that ends
    // nowhere near this line.
    reject_empty_groups(&exprs, rest, line)?;
    // A value that names a symbol or `.` cannot be computed here: label
    // addresses exist only after the linker places every section. Course
    // pointer tables (`.dword label_january, ...`) are the motivating
    // case, and dotted local labels (`.quad .L2`, GCC jump tables) lex as
    // DirectiveIdent. Defer the whole list so slot addressing stays
    // contiguous; pure-constant lists keep the immediate Bytes path and
    // its parse-time error reporting.
    let needs_link_resolution = exprs.iter().any(|group| {
        group.iter().any(|t| {
            matches!(
                t.kind,
                TokenKind::Ident(_) | TokenKind::DirectiveIdent(_) | TokenKind::Dot
            )
        })
    });
    if needs_link_resolution {
        prog.section_or_insert(current).items.push(Item::DataExprs {
            exprs: exprs.iter().map(|g| g.to_vec()).collect(),
            width,
            original_line: line,
        });
        return Ok(());
    }
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

/// Reject the empty slots a doubled, leading, or trailing comma leaves in
/// a data-directive value list, naming the fix. GAS rejects all three.
fn reject_empty_groups(
    exprs: &[&[Token]],
    rest: &[Token],
    line: usize,
) -> Result<(), EmuError> {
    if exprs.iter().any(|g| g.is_empty())
        || (!rest.is_empty() && matches!(rest[rest.len() - 1].kind, TokenKind::Comma))
    {
        return Err(err(
            line,
            "empty value in this list: remove the extra comma",
        ));
    }
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
    reject_empty_groups(&exprs, rest, line)?;
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
            "expected a number for .double/.float, like 3.14, -2.5, 0r1.5e10, or an integer",
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

    #[test]
    fn req_alias_expansion_is_bounded_per_line_and_in_total() {
        // The alias pass runs on already-m4-expanded text and had no
        // ceiling at all, so a long target repeated across a line (or
        // across many lines) materialized gigabytes before the assembler
        // ever saw a mnemonic.
        let target = "a".repeat(1024);
        let refs = "wide ".repeat(1000);
        let err = parse(&format!("wide .req {target}\n{refs}\n"))
            .expect_err("a 1 MB line must be refused")
            .to_string();
        assert!(err.contains(".req"), "message was: {err}");
        assert!(err.contains("past"), "message was: {err}");

        // Each line here stays under the per-line cap; only their sum is
        // over the aggregate one.
        let target = "a".repeat(128);
        let line = "wide ".repeat(64);
        let mut src = format!("wide .req {target}\n");
        for _ in 0..2000 {
            src.push_str(&line);
            src.push('\n');
        }
        let err = parse(&src)
            .expect_err("the aggregate must be refused too")
            .to_string();
        assert!(err.contains(".req"), "message was: {err}");
        assert!(err.contains("MiB"), "message was: {err}");
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
    fn dword_is_the_course_spelling_of_quad() {
        let p = parse_ok(".data\n.dword 0x1122334455667788\n");
        assert_eq!(
            section_bytes(&p, SectionKind::Data),
            vec![0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11]
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
    fn space_matches_skip() {
        let p = parse_ok(".bss\nbuf: .space 8\n");
        let bss = p.section(SectionKind::Bss).unwrap();
        assert!(bss.items.iter().any(|i| matches!(i, Item::Reserve(8))));
    }

    #[test]
    fn space_with_fill_emits_bytes() {
        let p = parse_ok(".data\ntbl: .space 4, 7\n");
        let data = p.section(SectionKind::Data).unwrap();
        let bytes = data
            .items
            .iter()
            .find_map(|i| if let Item::Bytes(b) = i { Some(b.clone()) } else { None });
        assert_eq!(bytes, Some(vec![7, 7, 7, 7]));
    }

    #[test]
    fn space_fill_in_bss_still_zeroes() {
        // GAS ignores a fill in .bss and zero-fills the reservation.
        let p = parse_ok(".bss\nbuf: .space 4, 7\n");
        let bss = p.section(SectionKind::Bss).unwrap();
        assert!(bss.items.iter().any(|i| matches!(i, Item::Reserve(4))));
    }

    #[test]
    fn zero_rejects_a_fill_operand() {
        let e = parse(".data\n.zero 8, 1\n").unwrap_err();
        assert!(e.to_string().contains(".zero"), "got: {e}");
    }

    #[test]
    fn space_rejects_a_third_operand() {
        let e = parse(".data\n.space 8, 1, 2\n").unwrap_err();
        assert!(e.to_string().contains(".space size"), "got: {e}");
    }

    #[test]
    fn space_fill_refuses_a_window_sized_allocation() {
        let e = parse(".data\n.space 1048577, 1\n").unwrap_err();
        assert!(e.to_string().contains("1 MiB"), "got: {e}");
    }

    #[test]
    fn space_symbolic_size_with_fill_names_the_fix() {
        let e = parse("SZ = 8\n.data\n.space SZ, 1\n").unwrap_err();
        assert!(e.to_string().contains("plain constant"), "got: {e}");
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

    // -- .req register aliases --

    #[test]
    fn req_alias_substitutes_into_instructions() {
        let p = parse_ok("counter .req w19\n.text\nmov counter, 6\n");
        let text = p.section(SectionKind::Text).unwrap();
        let instr_text: Vec<String> = text
            .items
            .iter()
            .filter_map(|i| match i {
                Item::Instruction { original_line, .. } => Some(
                    p.expanded_source
                        .lines()
                        .nth(original_line - 1)
                        .unwrap_or("")
                        .to_string(),
                ),
                _ => None,
            })
            .collect();
        assert_eq!(instr_text, vec!["mov w19, 6".to_string()]);
        assert_eq!(p.aliases.get("counter").map(String::as_str), Some("w19"));
    }

    #[test]
    fn req_alias_definition_line_is_blanked_in_place() {
        // The definition occupies line 1; the instruction stays on line 3.
        let p = parse_ok("fp2 .req x29\n.text\nmov fp2, sp\n");
        assert_eq!(p.expanded_source.lines().next(), Some(""));
        let text = p.section(SectionKind::Text).unwrap();
        match text.items.iter().find(|i| matches!(i, Item::Instruction { .. })) {
            Some(Item::Instruction { original_line, .. }) => assert_eq!(*original_line, 3),
            other => panic!("expected an instruction, got {other:?}"),
        }
    }

    #[test]
    fn req_alias_with_trailing_comment_and_fp_registers() {
        // Course files alias FP registers and annotate the definitions.
        let p = parse_ok("sum .req d19   // running total\n.text\nfmov sum, d0\n");
        assert_eq!(p.aliases.get("sum").map(String::as_str), Some("d19"));
        let line3 = p.expanded_source.lines().nth(2).unwrap_or("");
        assert_eq!(line3.trim(), "fmov d19, d0");
    }

    #[test]
    fn req_alias_never_rewrites_string_literals() {
        // The alias name inside a `.string` must survive untouched.
        let p = parse_ok(
            "counter .req w19\n.data\nmsg: .string \"counter = %d\"\n.text\nmov counter, 1\n",
        );
        assert_eq!(
            section_bytes(&p, SectionKind::Data),
            b"counter = %d\0".to_vec()
        );
    }

    #[test]
    fn req_alias_use_before_definition_stays_unresolved() {
        // GAS resolves .req top-down; a use above the definition is not
        // an alias yet, so the ident survives for the encoder to reject.
        let p = parse_ok(".text\nmov counter, 1\ncounter .req w19\n");
        let line2 = p.expanded_source.lines().nth(1).unwrap_or("");
        assert_eq!(line2.trim(), "mov counter, 1");
    }

    // -- deferred data expressions (label pointer tables) --

    #[test]
    fn dword_label_list_defers_to_link_time() {
        let p = parse_ok(".data\ntable: .dword alpha, beta\n.text\nalpha: nop\nbeta: nop\n");
        let data = p.section(SectionKind::Data).unwrap();
        match data
            .items
            .iter()
            .find(|i| matches!(i, Item::DataExprs { .. }))
        {
            Some(Item::DataExprs { exprs, width, .. }) => {
                assert_eq!(*width, 8);
                assert_eq!(exprs.len(), 2);
            }
            other => panic!("expected a deferred data item, got {other:?}"),
        }
    }

    #[test]
    fn constant_expression_lists_still_emit_bytes_at_parse_time() {
        let p = parse_ok(".data\n.word 1 + 2, 7\n");
        assert_eq!(
            section_bytes(&p, SectionKind::Data),
            vec![3, 0, 0, 0, 7, 0, 0, 0]
        );
        let data = p.section(SectionKind::Data).unwrap();
        assert!(!data
            .items
            .iter()
            .any(|i| matches!(i, Item::DataExprs { .. })));
    }

    #[test]
    fn mixed_constant_and_label_list_defers_the_whole_list() {
        // Deferring the full list keeps the slots contiguous in one item;
        // the constant re-evaluates trivially at link time.
        let p = parse_ok(".data\n.dword 0, marker, 2\n.text\nmarker: nop\n");
        let data = p.section(SectionKind::Data).unwrap();
        match data
            .items
            .iter()
            .find(|i| matches!(i, Item::DataExprs { .. }))
        {
            Some(Item::DataExprs { exprs, .. }) => assert_eq!(exprs.len(), 3),
            other => panic!("expected a deferred data item, got {other:?}"),
        }
    }

    #[test]
    fn symbolic_skip_size_defers_to_link_time() {
        // The assignment stack-buffer shape: an equate names the element
        // count and the reserve multiplies it out.
        let p = parse_ok("STACKSIZE = 5\n.bss\nstack: .skip STACKSIZE * 4\n");
        let bss = p.section(SectionKind::Bss).unwrap();
        assert!(bss
            .items
            .iter()
            .any(|i| matches!(i, Item::ReserveExpr { .. })));
    }

    #[test]
    fn constant_skip_still_reserves_at_parse_time() {
        let p = parse_ok(".bss\n.skip 12 * 2\n");
        let bss = p.section(SectionKind::Bss).unwrap();
        assert!(bss.items.iter().any(|i| matches!(i, Item::Reserve(24))));
    }

    #[test]
    fn current_address_in_data_slot_defers_to_link_time() {
        // `.` in a data value means the slot's own address, which only the
        // linker knows; parse-time evaluation against 0 would bake in the
        // wrong value.
        let p = parse_ok(".data\nhere_mark: .dword .\n");
        let data = p.section(SectionKind::Data).unwrap();
        assert!(data
            .items
            .iter()
            .any(|i| matches!(i, Item::DataExprs { .. })));
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
        assert!(matches!(text.items[0], Item::Label { ref name, .. } if name == "main"));
        assert!(matches!(text.items[1], Item::Instruction { .. }));
    }

    #[test]
    fn label_with_instruction_on_same_line() {
        let p = parse_ok("main: mov x0, #1\n");
        let text = p.section(SectionKind::Text).unwrap();
        assert!(matches!(text.items[0], Item::Label { .. }));
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
    #[allow(clippy::approx_constant)] // 3.14 is the literal source text, not an approximation of pi
    fn plain_decimal_float_in_data_directives() {
        // The real toolchain takes `.double 3.14` and `.float -2.5`
        // without any radix prefix; the playground must too.
        let p = parse_ok(".data\n.double 3.14\n");
        let bytes = section_bytes(&p, SectionKind::Data);
        assert_eq!(bytes.len(), 8);
        let mut arr = [0u8; 8];
        arr.copy_from_slice(&bytes);
        assert_eq!(f64::from_bits(u64::from_le_bytes(arr)), 3.14);

        let p = parse_ok(".data\n.float -2.5\n");
        let bytes = section_bytes(&p, SectionKind::Data);
        let mut arr = [0u8; 4];
        arr.copy_from_slice(&bytes);
        assert_eq!(f32::from_bits(u32::from_le_bytes(arr)), -2.5_f32);
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

    #[test]
    fn every_directive_reaches_an_arm() {
        // Feed each listed spelling a plausible operand and check what comes
        // back is never the unknown-directive fallthrough. What else it says
        // does not matter: `.equ`/`.set` answer with the teaching message,
        // which is the point of listing them. So this fails on exactly one
        // thing -- a name in DIRECTIVES the match no longer has an arm for.
        //
        // First pin that the probe reaches the fallthrough at all, so a
        // directive that died earlier could not pass the walk vacuously.
        let unknown = parse(".nosuchthing 1\n").unwrap_err().to_string();
        assert!(
            unknown.contains("unknown directive"),
            "the probe must reach the fallthrough, got: {unknown}"
        );
        for name in DIRECTIVES {
            let operand = match *name {
                ".section" => " .rodata",
                ".global" | ".globl" | ".type" | ".size" => " main",
                ".balign" | ".align" | ".skip" | ".zero" | ".space" => " 4",
                ".string" | ".asciz" | ".ascii" => " \"hi\"",
                ".byte" | ".hword" | ".short" | ".word" | ".quad" | ".dword" => " 1",
                ".double" | ".float" => " 1.0",
                ".equ" | ".set" => " SIZE, 40",
                _ => "",
            };
            if let Err(e) = parse(&format!("{name}{operand}\n")) {
                let message = e.to_string();
                assert!(
                    !message.contains("unknown directive"),
                    "`{name}` is listed in DIRECTIVES but falls through the \
                     match: {message}"
                );
            }
        }
    }
}
