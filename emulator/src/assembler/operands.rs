//! Operand parsing shared by the encoders: the mnemonic and operand
//! split, general registers, immediates and character literals,
//! condition codes, the shift and extend modifiers, and the
//! `[base, offset]` address grammar of the loads and stores.

use super::*;

// ---------------------------------------------------------------------------
// operand parsing helpers
// ---------------------------------------------------------------------------

pub(super) fn split_mnemonic(line: &str) -> (&str, &str) {
    let line = line.trim();
    if let Some(pos) = line.find(|c: char| c.is_whitespace()) {
        let mn = &line[..pos];
        let rest = line[pos..].trim();
        (mn, rest)
    } else {
        (line, "")
    }
}

pub(super) fn split_operands(s: &str) -> Vec<&str> {
    // split on commas but keep bracket groups together. A brace group is
    // one operand too: TBL's register list holds commas of its own.
    let mut result = Vec::new();
    let mut depth = 0;
    let mut start = 0;
    for (i, c) in s.char_indices() {
        match c {
            '[' | '{' => depth += 1,
            ']' | '}' => depth -= 1,
            ',' if depth == 0 => {
                result.push(s[start..i].trim());
                start = i + 1;
            }
            _ => {}
        }
    }
    let last = s[start..].trim();
    if !last.is_empty() {
        result.push(last);
    }
    result
}

pub(super) fn parse_register(s: &str, line_num: usize) -> Result<(u8, bool), EmuError> {
    let original = s.trim();
    let s = original.to_uppercase();
    // sp/xzr/wzr/fp/lr come from the shared alias table in registers.rs so
    // the encoder and the operand recognizers cannot disagree about the set.
    if let Some((num, sf)) = reg_alias(&s) {
        return Ok((num, sf));
    }
    let (prefix, sf) = if let Some(rest) = s.strip_prefix('X') {
        (rest, true)
    } else if let Some(rest) = s.strip_prefix('W') {
        (rest, false)
    } else {
        return asm_err(
            line_num,
            &format!("expected a register here, got `{original}`"),
        );
    };
    let num: u8 = prefix
        .parse()
        .map_err(|_| asm_error(line_num, &format!("invalid register: {s}")))?;
    if num > 30 {
        return asm_err(
            line_num,
            &format!(
                "`{s}` is not a register: the general-purpose registers are x0 through \
                 x30 (or w0 through w30), plus xzr/wzr and sp"
            ),
        );
    }
    Ok((num, sf))
}

pub(super) fn parse_immediate(s: &str, line_num: usize) -> Result<i64, EmuError> {
    let s = s.trim();
    let s = s.strip_prefix('#').unwrap_or(s);
    let s = s.trim();

    // Single-quoted char literal: 'A' -> 65, '\n' -> 10, '\0' -> 48.
    if let Some(body) = s.strip_prefix('\'').and_then(|b| b.strip_suffix('\'')) {
        return parse_char_body(body, line_num);
    }

    let negative = s.starts_with('-');
    let s = if negative { &s[1..] } else { s };

    let val: u64 = if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u64::from_str_radix(hex, 16)
            .map_err(|_| {
                asm_error(
                    line_num,
                    &format!(
                        "`{s}` is not a valid hex number: hex literals are 0x followed \
                         by hex digits"
                    ),
                )
            })?
    } else if let Some(bin) = s.strip_prefix("0b").or_else(|| s.strip_prefix("0B")) {
        // Binary immediates (`#0b101010`) are a documented course form; the
        // lexer already accepts them, so the legacy encoder must too.
        u64::from_str_radix(bin, 2)
            .map_err(|_| {
                asm_error(
                    line_num,
                    &format!(
                        "`{s}` is not a valid binary number: binary literals are 0b \
                         followed by 0s and 1s"
                    ),
                )
            })?
    } else if s.len() > 1 && s.starts_with('0') && s.bytes().all(|b| b.is_ascii_digit()) {
        // GAS reads a leading zero as octal (`052` is 42) in an instruction
        // as in a data directive, so both go through the lexer's one rule.
        crate::frontend::lexer::parse_int(s)
            .map(|v| v as u64)
            .ok_or_else(|| asm_error(line_num, &crate::frontend::lexer::integer_error(s)))?
    } else {
        s.parse()
            .map_err(|_| {
                asm_error(
                    line_num,
                    &format!(
                        "`{s}` is not a number the assembler can read here: write \
                         decimal as 42, hex as 0x2a, binary as 0b101010, and a \
                         character as 'a'"
                    ),
                )
            })?
    };

    // Wrapping, because -9223372036854775808 (LONG_MIN, which gcc writes
    // out in decimal) has no positive i64 to negate.
    Ok(if negative { (val as i64).wrapping_neg() } else { val as i64 })
}

// Every instruction's char operand lands here, hosted programs included,
// so it keeps the lexer's GAS rule: one byte, or a backslash and one byte
// (`'\0'` is 48, `'\v'` is a v).
fn parse_char_body(body: &str, line_num: usize) -> Result<i64, EmuError> {
    use crate::frontend::lexer::{control_escape, CHAR_ESCAPE_TOO_LONG};
    match body.as_bytes() {
        [] => Err(asm_error(line_num, "empty char literal")),
        [b'\\'] => Err(asm_error(line_num, "dangling backslash in char literal")),
        [b'\\', letter] => Ok(i64::from(control_escape(*letter))),
        [b'\\', ..] => Err(asm_error(line_num, CHAR_ESCAPE_TOO_LONG)),
        [byte] => Ok(i64::from(*byte)),
        _ => Err(asm_error(line_num, "char literal must be one character")),
    }
}

pub(super) fn parse_condition(s: &str, line_num: usize) -> Result<u8, EmuError> {
    match condition_bits(&s.trim().to_uppercase()) {
        Some(bits) => Ok(bits),
        None => asm_err(
            line_num,
            &format!(
                "unknown condition code `{s}`: the codes are {}",
                condition_code_list()
            ),
        ),
    }
}

/// The condition spellings, read off `CONDITIONS` rather than written out,
/// so a row added to the table cannot leave the message behind.
fn condition_code_list() -> String {
    let names: Vec<String> = CONDITIONS
        .iter()
        .map(|(primary, aliases, _)| {
            std::iter::once(*primary)
                .chain(aliases.iter().copied())
                .map(str::to_lowercase)
                .collect::<Vec<_>>()
                .join("/")
        })
        .collect();
    match names.split_last() {
        Some((last, rest)) => format!("{}, and {last}", rest.join(", ")),
        None => String::new(),
    }
}

/// The condition operand of the instructions GAS lets carry `nv`.
/// `CONDITIONS` leaves NV out because GAS refuses the dotless `bnv` and
/// the cset family, but `ccmp`, `ccmn` and `fcsel` all take it, and
/// the hardware runs condition 1111 as always, exactly like AL.
pub(super) fn parse_condition_allowing_nv(s: &str, line_num: usize) -> Result<u8, EmuError> {
    if s.trim().eq_ignore_ascii_case("NV") {
        return Ok(0b1111);
    }
    parse_condition(s, line_num)
}

/// Look an uppercase condition spelling up in the shared table.
fn condition_bits(name: &str) -> Option<u8> {
    CONDITIONS.iter().find_map(|(primary, aliases, bits)| {
        (*primary == name || aliases.contains(&name)).then_some(*bits)
    })
}

/// The condition bits of a conditional-branch mnemonic (`B.<cc>` or `B<cc>`,
/// uppercase), or None for anything else. The bare form matches only when
/// the whole tail is a condition spelling, so `BL`, `BLR` and `BIC` never
/// strip to one. GAS takes `b.nv` (it branches, like `b.al`) but refuses
/// the dotless `bnv`, so NV is accepted on the dotted form only.
pub(super) fn bcond_condition(mn: &str) -> Option<u8> {
    if let Some(tail) = mn.strip_prefix("B.") {
        if tail == "NV" {
            return Some(0b1111);
        }
        return condition_bits(tail);
    }
    condition_bits(mn.strip_prefix('B')?)
}

/// Parse a trailing shift-modifier operand: `lsl #3`, or the course
/// spelling `LSL 3`. `allow_ror` admits ROR for the logical ops; ADD/SUB
/// reserve that encoding.
pub(super) fn parse_shift_modifier(
    op: &str,
    reg_size: u8,
    allow_ror: bool,
    ln: usize,
) -> Result<(u32, u8), EmuError> {
    let t = op.trim();
    let upper = t.to_uppercase();
    let (shift_bits, rest) = if let Some(r) = upper.strip_prefix("LSL") {
        (0b00u32, r)
    } else if let Some(r) = upper.strip_prefix("LSR") {
        (0b01, r)
    } else if let Some(r) = upper.strip_prefix("ASR") {
        (0b10, r)
    } else if let Some(r) = upper.strip_prefix("ROR") {
        if !allow_ror {
            return asm_err(ln, "ROR is not a valid shift for ADD/SUB/CMP/CMN");
        }
        (0b11, r)
    } else {
        return asm_err(
            ln,
            &format!("expected a shift modifier like `lsl #3` as the last operand, got `{t}`"),
        );
    };
    let amt = parse_immediate(rest.trim(), ln)?;
    if !(0..reg_size as i64).contains(&amt) {
        return asm_err(
            ln,
            &format!(
                "shift amount {amt} is out of range for a {reg_size}-bit register (valid: 0-{})",
                reg_size - 1
            ),
        );
    }
    Ok((shift_bits, amt as u8))
}

/// The eight extend keywords ADD/SUB's extended-register form accepts, in
/// `option` field order. Not the load/store set: that one is
/// `decoder::LDST_EXTENDS`, a five-row table that also carries the Rm width
/// rule. This table has no width column on purpose (see
/// `parse_extend_modifier`), so the two stay separate.
const EXTEND_KEYWORDS: [(&str, u32); 8] = [
    ("UXTB", 0b000),
    ("UXTH", 0b001),
    ("UXTW", 0b010),
    ("UXTX", 0b011),
    ("SXTB", 0b100),
    ("SXTH", 0b101),
    ("SXTW", 0b110),
    ("SXTX", 0b111),
];

/// Split a trailing extend modifier into its `option` field and the text
/// of its optional shift amount: `sxtw #2`, `uxtb`, or the course spelling
/// `SXTW 2`. `None` means the operand is not an extend keyword at all, so
/// the caller falls back to the shift-modifier path. The index register's
/// width is deliberately not checked here: GAS assembles `add x0, x1, x2,
/// sxtw` to the same word as the `w2` spelling, so refusing it would
/// reject source the course toolchain accepts.
pub(super) fn parse_extend_modifier(op: &str) -> Option<(u32, &str)> {
    let t = op.trim();
    let upper = t.to_ascii_uppercase();
    for (keyword, option) in EXTEND_KEYWORDS {
        let Some(rest) = upper.strip_prefix(keyword) else {
            continue;
        };
        if rest.is_empty() || rest.starts_with([' ', '\t', '#']) {
            return Some((option, &t[keyword.len()..]));
        }
    }
    None
}

#[derive(Debug)]
pub(super) enum IndexMode {
    Unsigned,
    PreIndex,
    PostIndex,
}

/// Parsed LDR/STR address. Register-offset form (`[xN, wM, SXTW #2]`)
/// comes back as `RegOffset`; everything else stays `Immediate` so the
/// existing call sites keep working.
#[derive(Debug)]
pub(super) enum AddressingMode {
    Immediate {
        rn: u8,
        offset: Option<i64>,
        mode: IndexMode,
    },
    /// `[Xn, (Wm|Xm) (, LSL|UXTW|SXTW|SXTX #<amount>)?]`.
    RegOffset {
        rn: u8,
        rm: u8,
        /// ARM-spec 3-bit option encoding: 010=UXTW, 011=LSL/UXTX,
        /// 110=SXTW, 111=SXTX.
        option: u8,
        /// The written `#<amount>`, if any. The encoder decides the S
        /// (scale) bit from the VALUE against the access size; riding it
        /// on mere presence turns `lsl #0` into an 8x offset and rescales
        /// wrong amounts.
        shift_amount: Option<i64>,
    },
}

fn looks_like_register(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    let lower = s.to_ascii_lowercase();
    if reg_alias(&lower).is_some() {
        return true;
    }
    // Looser than `parse_register` on purpose: an out-of-range `x99` or a
    // SIMD&FP name like `q0` must still read as a register, so it reaches
    // `parse_register` for the real complaint instead of being taken for
    // an immediate offset.
    for prefix in ["x", "w", "b", "h", "s", "d", "q", "v"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            if rest == "zr" {
                return true;
            }
            if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
    }
    false
}

// ---------------------------------------------------------------------------
// address operand tokens
// ---------------------------------------------------------------------------

/// What one token of an address operand is. The four structural kinds
/// stand alone; a word is classified by what it opens with, which is all
/// the shape match below needs to tell `[x0, x1]` from `[x0, #8]`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TokKind {
    LBracket,
    RBracket,
    Comma,
    Bang,
    /// A word that reads as a register name (`x0`, `w29`, `sp`).
    Reg,
    /// A word that opens like a number or a character literal.
    Imm,
    /// Any other word: an extend/shift keyword, a label, a typo.
    Keyword,
}

/// One token, as a kind plus the byte span it covers. The span rather
/// than the text on purpose: the shape match reads `kind`, and every
/// leaf parse still runs on the original source slice, so
/// `parse_register` and `parse_immediate` report exactly what the writer
/// typed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Tok {
    kind: TokKind,
    start: usize,
    end: usize,
}

/// One comma-separated piece of an operand, as byte offsets into the
/// source. Both views are needed: the token shape decides the form, the
/// raw text feeds the leaf parsers.
#[derive(Debug, Clone, Copy)]
struct Seg {
    lo: usize,
    hi: usize,
}

impl Seg {
    fn text<'a>(&self, src: &'a str) -> &'a str {
        &src[self.lo..self.hi]
    }

    /// The tokens lying inside this segment. Segment boundaries always
    /// fall on token boundaries (a comma edge or a bracket edge), so
    /// this never splits a token in half.
    fn toks<'a>(&self, toks: &'a [Tok]) -> &'a [Tok] {
        let lo = toks.partition_point(|t| t.start < self.lo);
        let hi = toks.partition_point(|t| t.end <= self.hi).max(lo);
        &toks[lo..hi]
    }
}

fn structural_kind(c: char) -> Option<TokKind> {
    match c {
        '[' => Some(TokKind::LBracket),
        ']' => Some(TokKind::RBracket),
        ',' => Some(TokKind::Comma),
        '!' => Some(TokKind::Bang),
        _ => None,
    }
}

/// Which kind of word this is. The register test is the loose
/// `looks_like_register`, not `parse_register`: `x99` has to read as a
/// register so it reaches `parse_register` for the real complaint
/// instead of being silently taken for an offset.
fn classify_word(word: &str) -> TokKind {
    if looks_like_register(word) {
        TokKind::Reg
    } else if word.starts_with(|c: char| matches!(c, '#' | '-' | '\'') || c.is_ascii_digit()) {
        TokKind::Imm
    } else {
        TokKind::Keyword
    }
}

/// Split an address operand into tokens. Total by construction: nothing
/// is rejected here, so tokenizing introduces no rejection of its own.
/// Whitespace separates words and is
/// otherwise dropped; the segment slices keep it, because the leaf
/// parsers trim for themselves.
fn tokenize_address(s: &str) -> Vec<Tok> {
    let mut toks: Vec<Tok> = Vec::new();
    let mut chars = s.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if c.is_whitespace() {
            continue;
        }
        if let Some(kind) = structural_kind(c) {
            toks.push(Tok { kind, start: i, end: i + c.len_utf8() });
            continue;
        }
        let mut end = i + c.len_utf8();
        while let Some(&(j, next)) = chars.peek() {
            if next.is_whitespace() || structural_kind(next).is_some() {
                break;
            }
            end = j + next.len_utf8();
            chars.next();
        }
        toks.push(Tok { kind: classify_word(&s[i..end]), start: i, end });
    }
    toks
}

/// The comma-separated segments of `src[lo..hi)`, at most `limit` of
/// them. Mirrors `str::splitn`: the last segment keeps any commas past
/// the limit, and no segment is trimmed.
fn comma_segments(toks: &[Tok], lo: usize, hi: usize, limit: usize) -> Vec<Seg> {
    let mut segments: Vec<Seg> = Vec::new();
    let mut start = lo;
    for tok in toks {
        if tok.kind != TokKind::Comma || tok.start < lo || tok.end > hi {
            continue;
        }
        if segments.len() + 1 >= limit {
            break;
        }
        segments.push(Seg { lo: start, hi: tok.start });
        start = tok.end;
    }
    segments.push(Seg { lo: start, hi });
    segments
}

/// `[Xn, (Wm|Xm) (, LSL|UXTW|SXTW|SXTX #<amount>)?]`, reached once
/// the shape match has seen an index register in the offset segment.
fn parse_reg_offset(src: &str, parts: &[Seg], ln: usize) -> Result<AddressingMode, EmuError> {
    // `parts` is the comma split of the bracket group; index 0 is the
    // base, 1 the index register, 2 the optional extend/shift.
    let (rn, _) = parse_register(parts[0].text(src), ln)?;
    let (rm, rm_is_x) = parse_register(parts[1].text(src), ln)?;
    // No explicit extend / shift: LSL for Xm. A bare W index is a GAS
    // error (an extend must say how the 32 bits widen), and accepting it
    // here with an implicit UXTW assembled programs the course servers
    // reject.
    if parts.len() == 2 {
        if !rm_is_x {
            return asm_err(
                ln,
                "a W index register needs an extend keyword: write [Xn, Wm, uxtw] or [Xn, Wm, sxtw]",
            );
        }
        return Ok(AddressingMode::RegOffset {
            rn,
            rm,
            option: 0b011,
            shift_amount: None,
        });
    }
    // The keyword is taken off the raw text rather than off the first
    // token: `split_extend_keyword` reads it as everything up to the
    // first whitespace, punctuation included, so `lsl,` is one bad
    // keyword and is reported as one. Slicing at the token boundary
    // instead would rename that complaint.
    let modifier = parts[2].text(src).trim();
    let (keyword, shift_str) = split_extend_keyword(modifier);
    let keyword_lower = keyword.to_ascii_lowercase();
    let Some((_, option, needs_x)) = LDST_EXTENDS
        .iter()
        .find(|(kw, _, _)| *kw == keyword_lower.as_str())
    else {
        return asm_err(ln, &format!("bad extend/shift keyword: {keyword}"));
    };
    let (option, needs_x) = (*option, *needs_x);
    // UXTX is the architecture's name for option 011, but GNU as takes
    // only the LSL spelling of it in an address.
    if keyword_lower == "uxtx" {
        return asm_err(ln, "an address cannot use uxtx: write lsl, as in [x0, x1, lsl #3]");
    }
    // Require the extend keyword to match the Rm width ARM-spec rules:
    // UXTW/SXTW only make sense with Wm; LSL/SXTX with Xm. The table's
    // third column is that rule.
    if !needs_x && rm_is_x {
        return asm_err(ln, "UXTW/SXTW require a W index register");
    }
    if needs_x && !rm_is_x {
        return asm_err(ln, "LSL/SXTX require an X index register");
    }
    let shift_amount = if shift_str.trim().is_empty() {
        // An extend may leave its amount out; a shift may not.
        if option == 0b011 {
            return asm_err(ln, "lsl needs its amount: write lsl #0, or the scale, as in lsl #3");
        }
        None
    } else {
        Some(parse_immediate(shift_str, ln)?)
    };
    Ok(AddressingMode::RegOffset {
        rn,
        rm,
        option,
        shift_amount,
    })
}

fn split_extend_keyword(s: &str) -> (&str, &str) {
    // Keyword then optional `#imm`. The keyword is the first whitespace-
    // delimited token; anything after is the shift amount.
    let s = s.trim();
    match s.find(|c: char| c.is_whitespace()) {
        Some(p) => (&s[..p], &s[p..]),
        None => (s, ""),
    }
}

/// Parse a load/store address operand.
///
/// The operand is tokenized first and the form is chosen by matching on
/// the token shape: where the brackets, the commas and the writeback `!`
/// fall, and whether the offset segment names a register. The parser it
/// replaced discriminated by string shape instead, which makes the order
/// of the tests load-bearing: a form checked too late is not rejected, it
/// is re-read as a different form, because whatever the register test
/// turns away goes straight to `parse_immediate`. That produces a wrong
/// encoding, not an error.
///
/// Every leaf parse still runs on the raw source slice of its segment,
/// so the rejections read exactly as they did before.
pub(super) fn parse_addressing_mode(s: &str, ln: usize) -> Result<AddressingMode, EmuError> {
    let s = s.trim();
    let toks = tokenize_address(s);

    // `[Xn, #imm]!` -> pre-index. Checked first because a trailing `!`
    // is the one thing that can follow the bracket group and still not
    // be an offset.
    if toks.last().is_some_and(|t| t.kind == TokKind::Bang) {
        let n = toks.len();
        if n < 3 || toks[0].kind != TokKind::LBracket || toks[n - 2].kind != TokKind::RBracket {
            return asm_err(ln, "expected [Xn, #imm]!");
        }
        let parts = comma_segments(&toks, toks[0].end, toks[n - 2].start, 2);
        let (rn, _) = parse_register(parts[0].text(s), ln)?;
        let offset = if parts.len() > 1 {
            Some(parse_immediate(parts[1].text(s), ln)?)
        } else {
            Some(0)
        };
        return Ok(AddressingMode::Immediate {
            rn,
            offset,
            mode: IndexMode::PreIndex,
        });
    }

    if !toks.first().is_some_and(|t| t.kind == TokKind::LBracket) {
        return asm_err(ln, "expected [ for addressing mode");
    }
    let Some(close) = toks.iter().position(|t| t.kind == TokKind::RBracket) else {
        return asm_err(ln, "invalid addressing mode");
    };
    let (inner_lo, inner_hi) = (toks[0].end, toks[close].start);

    // `[Xn], #imm` -> post-index. GAS requires the comma, and so do we:
    // `[x0] #8` would slide through as post-index and assemble a
    // spelling the servers reject.
    if let Some(first_after) = toks.get(close + 1) {
        let (rn, _) = parse_register(s[inner_lo..inner_hi].trim(), ln)?;
        if first_after.kind != TokKind::Comma {
            return asm_err(ln, "post-index needs a comma: [Xn], #imm");
        }
        let from = first_after.end;
        let offset = parse_immediate(s[from..].trim(), ln)?;
        return Ok(AddressingMode::Immediate {
            rn,
            offset: Some(offset),
            mode: IndexMode::PostIndex,
        });
    }

    // `[Xn]`, `[Xn, #imm]`, `[Xn, Xm, ...]`: a lone register token in the
    // offset segment is the register-offset form. Anything else (`#imm`, a
    // bare number, `d1`, an empty piece) is the immediate form, and
    // `parse_immediate` reports its errors.
    let parts = comma_segments(&toks, inner_lo, inner_hi, 3);
    let offset_is_register = parts.len() >= 2
        && matches!(parts[1].toks(&toks), [tok] if tok.kind == TokKind::Reg);
    if offset_is_register {
        return parse_reg_offset(s, &parts, ln);
    }
    let (rn, _) = parse_register(parts[0].text(s), ln)?;
    if parts.len() > 1 {
        // A plain splitn DROPS anything past the second comma, so
        // `[x0, #8, #9]` encodes as `[x0, #8]` with no message.
        if parts.len() > 2 {
            return asm_err(
                ln,
                "unexpected third operand in the address: the immediate form is [Xn, #imm]",
            );
        }
        let offset = parse_immediate(parts[1].text(s), ln)?;
        return Ok(AddressingMode::Immediate {
            rn,
            offset: Some(offset),
            mode: IndexMode::Unsigned,
        });
    }
    Ok(AddressingMode::Immediate {
        rn,
        offset: None,
        mode: IndexMode::Unsigned,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::rejects;

    #[test]
    fn bare_fp_and_lr_are_predefined_like_gas() {
        // stp fp, lr, [sp, #-16]! == stp x29, x30, [sp, #-16]!
        assert_eq!(
            assemble("STP FP, LR, [SP, #-16]!").unwrap()[0],
            assemble("STP X29, X30, [SP, #-16]!").unwrap()[0]
        );
        assert_eq!(
            assemble("MOV FP, SP").unwrap()[0],
            assemble("MOV X29, SP").unwrap()[0]
        );
        assert_eq!(
            assemble("LDR X0, [FP, #8]").unwrap()[0],
            assemble("LDR X0, [X29, #8]").unwrap()[0]
        );
        // The fallback echoes the token as typed.
        let err = assemble("mov foo, #1").unwrap_err();
        assert!(err.to_string().contains("`foo`"), "was: {err}");
    }

    // -- char literals --

    #[test]
    fn char_literal_in_immediate() {
        // `mov w19, 'A'` should encode as `mov w19, #65`.
        let code = assemble("MOV W19, 'A'").unwrap();
        let reference = assemble("MOV W19, #65").unwrap();
        assert_eq!(code, reference);
    }

    #[test]
    fn char_literal_escape_sequence() {
        let code = assemble("MOV W0, '\\n'").unwrap();
        let reference = assemble("MOV W0, #10").unwrap();
        assert_eq!(code, reference);
    }

    #[test]
    fn char_literal_escape_is_one_letter_like_gas() {
        assert_eq!(assemble("MOV W0, '\\0'").unwrap(), assemble("MOV W0, #48").unwrap());
        assert_eq!(assemble("MOV W0, '\\v'").unwrap(), assemble("MOV W0, #0x76").unwrap());
        rejects(assemble("MOV W0, '\\x41'"), "write any other code as a number");
    }

    #[test]
    fn char_literal_semicolon_is_not_a_comment() {
        // A literal-blind comment stripper cuts the line at the `;`,
        // leaving a dangling quote and an invalid-immediate error.
        let code = assemble("MOV W1, ';'").unwrap();
        let reference = assemble("MOV W1, #59").unwrap();
        assert_eq!(code, reference);
        // A real trailing comment still strips.
        let commented = assemble("MOV W1, #59 ; the separator").unwrap();
        assert_eq!(commented, reference);
    }

    // -- binary immediates --

    #[test]
    fn assemble_binary_immediate_matches_decimal() {
        let bin = assemble("MOV W0, #0b101010").unwrap();
        let dec = assemble("MOV W0, #42").unwrap();
        assert_eq!(bin, dec);
    }

    // -- register names the encoder turns away --

    #[test]
    fn a_register_number_past_the_file_names_the_register_file() {
        // The web layer picks its register teaching block off this wording,
        // so a reworded message there silently stops explaining itself.
        let labels: HashMap<String, u64> = HashMap::new();
        let msg = match encode_line("ldr x1, [x99, #8]", 0, &labels, 1) {
            Err(EmuError::AssemblyError { message, .. }) => message,
            other => panic!("expected an assembly error, got {other:?}"),
        };
        assert!(msg.contains("is not a register"), "message was: {msg}");
        assert!(msg.contains("x0 through x30"), "message was: {msg}");

        let msg = match encode_line("fadd d0, d1, d99", 0, &labels, 1) {
            Err(EmuError::AssemblyError { message, .. }) => message,
            other => panic!("expected an assembly error, got {other:?}"),
        };
        assert!(
            msg.contains("is not a floating-point register"),
            "message was: {msg}"
        );
    }

    // -- the address operand tokenizer --

    /// Render a token stream as `kind:text` so a mismatch reads as the
    /// spelling it came from rather than as a span arithmetic puzzle.
    fn tokens_of(src: &str) -> Vec<String> {
        tokenize_address(src)
            .iter()
            .map(|t| format!("{:?}:{}", t.kind, &src[t.start..t.end]))
            .collect()
    }

    #[test]
    fn tokenizer_classifies_the_operand_words() {
        // The three word kinds are the whole grammar: a register name, a
        // number-ish word, and anything else. Whitespace and casing move
        // the spans, never the kinds, which is why the shape match can
        // be spelled once and cover every spelling.
        for spelling in ["[x0, w2, sxtw #2]", "[x0,w2,sxtw #2]", "[ X0 , W2 , SXTW #2 ]"] {
            assert_eq!(
                tokens_of(spelling)
                    .iter()
                    .map(|t| t.split(':').next().unwrap().to_string())
                    .collect::<Vec<_>>(),
                vec![
                    "LBracket", "Reg", "Comma", "Reg", "Comma", "Keyword", "Imm", "RBracket"
                ],
                "{spelling}"
            );
        }
        assert_eq!(
            tokens_of("[sp, #-8]!"),
            vec!["LBracket:[", "Reg:sp", "Comma:,", "Imm:#-8", "RBracket:]", "Bang:!"]
        );
        // A SIMD&FP name reads as a register too, so `[x0, d1]` reaches
        // `parse_register` for the real complaint instead of falling onto
        // the immediate path.
        assert_eq!(tokens_of("d1"), vec!["Reg:d1"]);
        assert_eq!(tokens_of("q31"), vec!["Reg:q31"]);
        assert_eq!(tokens_of("lsl"), vec!["Keyword:lsl"]);
        assert_eq!(tokens_of("x99"), vec!["Reg:x99"]);
        assert_eq!(tokens_of("0x10"), vec!["Imm:0x10"]);
        assert_eq!(tokens_of("'a'"), vec!["Imm:'a'"]);
        assert_eq!(tokens_of(""), Vec::<String>::new());
    }

    #[test]
    fn comma_segments_match_splitn() {
        // The segments are what the leaf parsers receive: untrimmed, with
        // the limit's overflow left on the last piece. Drift here is a
        // silently different parse.
        for (src, limit) in [("x0, x1, lsl #3, junk", 3), ("x0, #8", 2), ("x0", 3), ("", 2)] {
            let toks = tokenize_address(src);
            let got: Vec<&str> = comma_segments(&toks, 0, src.len(), limit)
                .iter()
                .map(|seg| seg.text(src))
                .collect();
            let want: Vec<&str> = src.splitn(limit, ',').collect();
            assert_eq!(got, want, "`{src}` split {limit} ways");
        }
    }

    // -- the register-alias table --

    #[test]
    fn reg_aliases_resolve_and_read_as_registers() {
        // Both directions of the table in one walk: the encoder resolves
        // every row to the number and width it names, in any casing, and
        // the addressing-mode recognizer agrees that the row is a register
        // (the discrimination `[x0, sp]` vs `[x0, #8]` rides on that).
        for (alias, num, sf) in crate::registers::REG_ALIASES {
            for spelling in [alias.to_string(), alias.to_ascii_lowercase()] {
                assert_eq!(
                    parse_register(&spelling, 1).unwrap(),
                    (*num, *sf),
                    "`{spelling}` resolved wrong"
                );
                assert!(
                    looks_like_register(&spelling),
                    "`{spelling}` must read as a register"
                );
            }
        }
    }

    #[test]
    fn looks_like_register_still_takes_an_out_of_range_index() {
        // It is the addressing-mode discriminator, not a validator: `x99`
        // has to reach `parse_register` to be told it is out of range,
        // rather than being silently read as an immediate offset.
        assert!(looks_like_register("x99"));
        rejects(parse_register("x99", 1), "`X99` is not a register");
        assert!(!looks_like_register("pc"));
        assert!(!looks_like_register("lsl"));
    }

    #[test]
    fn bcond_lookup_never_claims_a_non_branch() {
        for mn in ["B", "BL", "BLR", "BR", "BIC", "BFI", "BAD"] {
            assert!(
                bcond_condition(mn).is_none(),
                "`{mn}` must not parse as a conditional branch"
            );
        }
    }
}
