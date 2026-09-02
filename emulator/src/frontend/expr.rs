//! Constant-expression evaluator used by the parser and the linker. Shape
//! of the grammar, lowest precedence first:
//!
//! ```text
//! or    := xor ('|' xor)*
//! xor   := and ('^' and)*
//! and   := shift ('&' shift)*
//! shift := add (('<<' | '>>') add)*
//! add   := mul (('+' | '-') mul)*
//! mul   := unary (('*' | '/' | '%') unary)*
//! unary := ('-' | '~' | '+') unary | primary
//! primary := IntLit | CharLit | Ident | '.' | '(' or ')'
//! ```
//!
//! `.` resolves to the caller-supplied current address. Symbols resolve via
//! the caller-supplied closure; returning `None` produces an
//! undefined-symbol error, which the linker catches when it needs a second
//! pass for forward references.
//!
//! Arithmetic is i64 with wrapping semantics on `+`, `-`, `*`. Division and
//! remainder by zero error out. Shift amounts must be in 0..64. Encountering
//! a `FloatLit` in an expression is an error: floats only appear in data
//! directives like `.double`, never in integer offsets.

use super::lexer::{Token, TokenKind};
use crate::errors::EmuError;

/// Nesting ceiling for parentheses and stacked unary operators. The
/// grammar recurses ~8 stack frames per level, and a wasm stack overflow
/// is unrecoverable (the trap skips wasm-bindgen's borrow-guard Drop and
/// every later call fails on the stuck borrow flag), so depth is counted
/// and refused long before the stack is at risk. Real course expressions
/// nest two or three levels.
const MAX_EXPR_DEPTH: usize = 128;

/// Evaluate a token slice as an integer expression.
pub fn evaluate<F>(
    tokens: &[Token],
    resolve: &F,
    here: i64,
    line: usize,
) -> Result<i64, EmuError>
where
    F: Fn(&str) -> Option<i64>,
{
    let mut p = Parser {
        toks: tokens,
        pos: 0,
        resolve,
        here,
        line,
        depth: 0,
    };
    let result = p.parse_or()?;
    if p.pos != tokens.len() {
        return Err(err(
            p.current_line(),
            "unexpected tokens after expression",
        ));
    }
    Ok(result)
}

struct Parser<'a, F: Fn(&str) -> Option<i64>> {
    toks: &'a [Token],
    pos: usize,
    resolve: &'a F,
    here: i64,
    line: usize,
    depth: usize,
}

impl<'a, F: Fn(&str) -> Option<i64>> Parser<'a, F> {
    fn peek(&self) -> Option<&TokenKind> {
        self.toks.get(self.pos).map(|t| &t.kind)
    }

    fn advance(&mut self) {
        self.pos += 1;
    }

    fn current_line(&self) -> usize {
        self.toks
            .get(self.pos)
            .map(|t| t.line)
            .unwrap_or(self.line)
    }

    fn parse_or(&mut self) -> Result<i64, EmuError> {
        let mut left = self.parse_xor()?;
        while matches!(self.peek(), Some(TokenKind::Pipe)) {
            self.advance();
            let right = self.parse_xor()?;
            left |= right;
        }
        Ok(left)
    }

    fn parse_xor(&mut self) -> Result<i64, EmuError> {
        let mut left = self.parse_and()?;
        while matches!(self.peek(), Some(TokenKind::Caret)) {
            self.advance();
            let right = self.parse_and()?;
            left ^= right;
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<i64, EmuError> {
        let mut left = self.parse_shift()?;
        while matches!(self.peek(), Some(TokenKind::Amp)) {
            self.advance();
            let right = self.parse_shift()?;
            left &= right;
        }
        Ok(left)
    }

    fn parse_shift(&mut self) -> Result<i64, EmuError> {
        let mut left = self.parse_add()?;
        loop {
            match self.peek() {
                Some(TokenKind::LShift) => {
                    self.advance();
                    let right = self.parse_add()?;
                    if !(0..64).contains(&right) {
                        return Err(err(self.line, "shift amount out of range"));
                    }
                    left = (left as u64).wrapping_shl(right as u32) as i64;
                }
                Some(TokenKind::RShift) => {
                    self.advance();
                    let right = self.parse_add()?;
                    if !(0..64).contains(&right) {
                        return Err(err(self.line, "shift amount out of range"));
                    }
                    // Arithmetic shift: preserves sign, matching asr semantics.
                    left = left.wrapping_shr(right as u32);
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_add(&mut self) -> Result<i64, EmuError> {
        let mut left = self.parse_mul()?;
        loop {
            match self.peek() {
                Some(TokenKind::Plus) => {
                    self.advance();
                    let right = self.parse_mul()?;
                    left = left.wrapping_add(right);
                }
                Some(TokenKind::Minus) => {
                    self.advance();
                    let right = self.parse_mul()?;
                    left = left.wrapping_sub(right);
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_mul(&mut self) -> Result<i64, EmuError> {
        let mut left = self.parse_unary()?;
        loop {
            match self.peek() {
                Some(TokenKind::Star) => {
                    self.advance();
                    let right = self.parse_unary()?;
                    left = left.wrapping_mul(right);
                }
                Some(TokenKind::Slash) => {
                    self.advance();
                    let right = self.parse_unary()?;
                    if right == 0 {
                        return Err(err(self.line, "division by zero in expression"));
                    }
                    left = left.wrapping_div(right);
                }
                Some(TokenKind::Percent) => {
                    self.advance();
                    let right = self.parse_unary()?;
                    if right == 0 {
                        return Err(err(self.line, "modulo by zero in expression"));
                    }
                    left = left.wrapping_rem(right);
                }
                _ => break,
            }
        }
        Ok(left)
    }

    /// Count one level of nesting, refusing past the ceiling. Callers
    /// decrement on the way back out; an error aborts the whole parse so
    /// no unwinding bookkeeping is needed.
    fn enter_nested(&mut self) -> Result<(), EmuError> {
        self.depth += 1;
        if self.depth > MAX_EXPR_DEPTH {
            return Err(err(
                self.current_line(),
                &format!(
                    "expression nests too deeply (more than {MAX_EXPR_DEPTH} \
                     levels of parentheses or unary operators)"
                ),
            ));
        }
        Ok(())
    }

    fn parse_unary(&mut self) -> Result<i64, EmuError> {
        match self.peek() {
            Some(TokenKind::Minus) => {
                self.enter_nested()?;
                self.advance();
                let inner = self.parse_unary()?;
                self.depth -= 1;
                Ok(inner.wrapping_neg())
            }
            Some(TokenKind::Tilde) => {
                self.enter_nested()?;
                self.advance();
                let inner = self.parse_unary()?;
                self.depth -= 1;
                Ok(!inner)
            }
            Some(TokenKind::Plus) => {
                self.enter_nested()?;
                self.advance();
                let inner = self.parse_unary()?;
                self.depth -= 1;
                Ok(inner)
            }
            _ => self.parse_primary(),
        }
    }

    fn parse_primary(&mut self) -> Result<i64, EmuError> {
        let tok = self
            .toks
            .get(self.pos)
            .ok_or_else(|| err(self.line, "expected an expression, found end of input"))?;
        let line = tok.line;
        match &tok.kind {
            TokenKind::IntLit(v) => {
                self.advance();
                Ok(*v)
            }
            TokenKind::CharLit(v) => {
                self.advance();
                Ok(*v as i64)
            }
            TokenKind::FloatLit(_) => Err(err(
                line,
                "float literal in integer expression (use it inside .double)",
            )),
            TokenKind::Dot => {
                self.advance();
                Ok(self.here)
            }
            // Dotted local labels (`.L2`, GCC jump-table entries) resolve
            // exactly like plain identifiers; they lex as DirectiveIdent
            // because of the leading dot.
            TokenKind::Ident(name) | TokenKind::DirectiveIdent(name) => {
                let resolved = (self.resolve)(name).ok_or_else(|| {
                    err(
                        line,
                        &format!(
                            "`{name}` is not defined anywhere in this program: check \
                             the spelling against the label or the `name = value` \
                             line that defines it. m4 substitution is whole-token \
                             and case-sensitive"
                        ),
                    )
                })?;
                self.advance();
                Ok(resolved)
            }
            TokenKind::LParen => {
                self.enter_nested()?;
                self.advance();
                let inner = self.parse_or()?;
                self.depth -= 1;
                match self.peek() {
                    Some(TokenKind::RParen) => {
                        self.advance();
                        Ok(inner)
                    }
                    _ => Err(err(line, "expected closing paren")),
                }
            }
            other => Err(err(
                line,
                &format!(
                    "unexpected {} in this expression{}",
                    crate::frontend::lexer::describe(other),
                    match other {
                        TokenKind::Hash =>
                            ". Values in data directives are written without the #",
                        TokenKind::StringLit(_) =>
                            ". Text belongs in .string or .asciz, not a numeric directive",
                        _ => "",
                    }
                ),
            )),
        }
    }
}

fn err(line: usize, message: &str) -> EmuError {
    EmuError::ParseError {
        line,
        message: message.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::lexer::lex;
    use std::collections::HashMap;

    fn nothing(_: &str) -> Option<i64> {
        None
    }

    fn run(src: &str) -> Result<i64, EmuError> {
        let t = lex(src, 1).unwrap();
        evaluate(&t, &nothing, 0, 1)
    }

    fn run_with(src: &str, syms: &HashMap<&str, i64>, here: i64) -> Result<i64, EmuError> {
        let t = lex(src, 1).unwrap();
        let map: HashMap<String, i64> =
            syms.iter().map(|(k, v)| ((*k).to_string(), *v)).collect();
        evaluate(&t, &|n| map.get(n).copied(), here, 1)
    }

    #[test]
    fn simple_addition() {
        assert_eq!(run("2 + 3").unwrap(), 5);
    }

    #[test]
    fn deep_paren_nesting_is_refused_by_the_depth_counter() {
        // Never test the raw overflow: a real stack overflow aborts the
        // whole test process. The counter must fire far below it.
        let src = format!("{}1{}", "(".repeat(2000), ")".repeat(2000));
        let msg = run(&src).unwrap_err().to_string();
        assert!(msg.contains("nests too deeply"), "message was: {msg}");
    }

    #[test]
    fn deep_unary_nesting_is_refused_by_the_depth_counter() {
        let src = format!("{}1", "~".repeat(2000));
        let msg = run(&src).unwrap_err().to_string();
        assert!(msg.contains("nests too deeply"), "message was: {msg}");
    }

    #[test]
    fn nesting_at_the_ceiling_still_evaluates() {
        let src = format!("{}1{}", "(".repeat(128), ")".repeat(128));
        assert_eq!(run(&src).unwrap(), 1);
        let src = format!("{}1{}", "(".repeat(129), ")".repeat(129));
        assert!(run(&src).is_err());
    }

    #[test]
    fn depth_counts_nesting_not_sequential_groups() {
        // 200 sibling groups never exceed depth 1; only true nesting
        // should trip the ceiling.
        let src = std::iter::repeat_n("(1)", 200)
            .collect::<Vec<_>>()
            .join(" + ");
        assert_eq!(run(&src).unwrap(), 200);
    }

    #[test]
    fn precedence_multiplicative_over_additive() {
        assert_eq!(run("1 + 2 * 3").unwrap(), 7);
        assert_eq!(run("2 * 3 + 1").unwrap(), 7);
    }

    #[test]
    fn parens_override_precedence() {
        assert_eq!(run("(1 + 2) * 3").unwrap(), 9);
    }

    #[test]
    fn unary_minus_negates() {
        assert_eq!(run("-5").unwrap(), -5);
    }

    #[test]
    fn unary_tilde_inverts() {
        assert_eq!(run("~0").unwrap(), -1);
    }

    #[test]
    fn double_unary_minus_is_positive() {
        assert_eq!(run("- -5").unwrap(), 5);
    }

    #[test]
    fn alloc_expression_from_corpus() {
        // The canonical test: `alloc = -(16 + 16) & -16` must evaluate to -32.
        assert_eq!(run("-(16 + 16) & -16").unwrap(), -32);
    }

    #[test]
    fn shifts() {
        assert_eq!(run("1 << 4").unwrap(), 16);
        assert_eq!(run("16 >> 2").unwrap(), 4);
    }

    #[test]
    fn bit_ops() {
        assert_eq!(run("7 & 5").unwrap(), 5);
        assert_eq!(run("7 | 8").unwrap(), 15);
        assert_eq!(run("7 ^ 5").unwrap(), 2);
    }

    #[test]
    fn division() {
        assert_eq!(run("10 / 3").unwrap(), 3);
    }

    #[test]
    fn division_by_zero_errors() {
        assert!(run("1 / 0").is_err());
    }

    #[test]
    fn modulo() {
        assert_eq!(run("10 % 3").unwrap(), 1);
    }

    #[test]
    fn modulo_by_zero_errors() {
        assert!(run("1 % 0").is_err());
    }

    #[test]
    fn left_associativity_on_subtraction() {
        // (10 - 3) - 2 = 5, not 10 - (3 - 2) = 9.
        assert_eq!(run("10 - 3 - 2").unwrap(), 5);
    }

    #[test]
    fn current_address_dot() {
        let t = lex(".", 1).unwrap();
        let v = evaluate(&t, &nothing, 0x0040_0000, 1).unwrap();
        assert_eq!(v, 0x0040_0000);
    }

    #[test]
    fn current_address_in_label_math() {
        // msg_len = . - msg - 1 with . at 0x20 and msg at 0x10.
        let mut syms = HashMap::new();
        syms.insert("msg", 0x10);
        assert_eq!(run_with(". - msg - 1", &syms, 0x20).unwrap(), 0x0f);
    }

    #[test]
    fn symbol_lookup() {
        let mut syms = HashMap::new();
        syms.insert("foo", 42);
        assert_eq!(run_with("foo", &syms, 0).unwrap(), 42);
    }

    #[test]
    fn symbol_arithmetic() {
        let mut syms = HashMap::new();
        syms.insert("foo", 42);
        assert_eq!(run_with("foo + 1", &syms, 0).unwrap(), 43);
    }

    #[test]
    fn unknown_symbol_errors_with_name() {
        match run("bar") {
            Err(EmuError::ParseError { message, .. }) => {
                assert!(message.contains("bar"), "message was: {message}");
            }
            other => panic!("expected ParseError, got {other:?}"),
        }
    }

    #[test]
    fn char_literal_acts_as_integer() {
        assert_eq!(run("'A' + 1").unwrap(), 66);
    }

    #[test]
    fn float_in_integer_expression_errors() {
        assert!(run("0r1.5 + 1").is_err());
    }

    #[test]
    fn empty_expression_errors() {
        let v: Vec<Token> = Vec::new();
        assert!(evaluate(&v, &nothing, 0, 1).is_err());
    }

    #[test]
    fn trailing_tokens_error() {
        assert!(run("1 + 2 3").is_err());
    }

    #[test]
    fn unclosed_paren_errors() {
        assert!(run("(1 + 2").is_err());
    }

    #[test]
    fn shift_precedence_below_bitwise_and_above_additive() {
        // 1 + 2 << 1 = (1 + 2) << 1 = 6 (shifts lower than additive).
        assert_eq!(run("1 + 2 << 1").unwrap(), 6);
        // 1 << 2 & 3 = (1 << 2) & 3 = 4 & 3 = 0 (and lower than shifts).
        assert_eq!(run("1 << 2 & 3").unwrap(), 0);
    }

    #[test]
    fn shift_amount_out_of_range_errors() {
        assert!(run("1 << 64").is_err());
        assert!(run("1 << -1").is_err());
    }

    #[test]
    fn hex_and_bitops_combined() {
        assert_eq!(run("0xff & 0x0f").unwrap(), 0x0f);
    }

    #[test]
    fn large_addition_wraps() {
        // Wrapping arithmetic should not panic near i64::MAX.
        let v = run("0x7fffffffffffffff + 1").unwrap();
        assert_eq!(v, i64::MIN);
    }
}
