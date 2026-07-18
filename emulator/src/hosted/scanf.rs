//! scanf implementation. Supports `%d %u %x %s %c %f` with maximum
//! field widths honored (`%4s` writes at most 4 bytes plus NUL, `%2d`
//! parses at most 2 digits), plus literal whitespace in the format
//! matching any number of input whitespace characters. Pointer varargs
//! follow AAPCS64 (x1..x7 then the caller's stack), sharing printf's
//! walker.
//!
//! When stdin runs out mid-field, scanf returns `NeedInput` WITHOUT
//! consuming the partial match. The caller pauses the run loop; on
//! resume, scanf re-parses from the original offset so the student's
//! input arrives as one logical read.
//!
//! Return convention (x0): the number of fields successfully matched,
//! or -1 on early end-of-input before any field.

use crate::errors::EmuError;
use crate::hosted::printf::read_c_string;
use crate::hosted::{HostContext, HostOutcome, VarargWalker};

/// C's isspace in the default locale: space, \t, \n, \v, \f, \r. Byte-level
/// on purpose -- Rust's Unicode `char::is_whitespace` on a raw byte treated
/// 0xA0 (the tail of a UTF-8 NBSP) as a separator and split tokens
/// mid-character; glibc's scanf never does.
fn is_c_space(b: u8) -> bool {
    b.is_ascii_whitespace() || b == 0x0B
}

pub fn scanf(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fmt_ptr = ctx.regs.read_gpr(0, true);
    let fmt_bytes = read_c_string(ctx.mem, fmt_ptr, "scanf's format string")?;
    let fmt = String::from_utf8_lossy(&fmt_bytes).into_owned();

    // Snapshot stdin so we can roll back if we stall mid-field.
    let original_stdin = ctx.stdin.clone();

    let mut in_pos: usize = 0;
    // Pointer args follow AAPCS64 varargs: x1..x7 then the stack spill.
    let mut walker = VarargWalker { gp_idx: 1, fp_idx: 0, stack_off: 0 };
    let mut matched: i64 = 0;

    let fmt_chars: Vec<char> = fmt.chars().collect();
    let mut f = 0;
    while f < fmt_chars.len() {
        let c = fmt_chars[f];
        if c.is_ascii_whitespace() || c == '\x0B' {
            // Skip any run of whitespace in the input; matches zero-or-more.
            while in_pos < ctx.stdin.len()
                && is_c_space(ctx.stdin[in_pos])
            {
                in_pos += 1;
            }
            f += 1;
            continue;
        }
        if c != '%' {
            // Literal character: must match exactly.
            if in_pos >= ctx.stdin.len() {
                return stall(ctx, original_stdin, matched);
            }
            if ctx.stdin[in_pos] as char != c {
                break;
            }
            in_pos += 1;
            f += 1;
            continue;
        }
        f += 1;
        // Optional suppression flag `*` (skip the field).
        let suppress = f < fmt_chars.len() && fmt_chars[f] == '*';
        if suppress {
            f += 1;
        }
        // Optional maximum field width. This is the one overflow defense
        // C gives students (`%4s` on a 5-byte buffer), so it must truly
        // bound the read; it used to be parsed and thrown away.
        let mut width: Option<usize> = None;
        while f < fmt_chars.len() && fmt_chars[f].is_ascii_digit() {
            let digit = (fmt_chars[f] as usize) - ('0' as usize);
            width = Some(width.unwrap_or(0).saturating_mul(10).saturating_add(digit));
            f += 1;
        }
        // Length modifier. The store WIDTH follows it: `%d` writes a
        // 4-byte int, `%ld` an 8-byte long; a plain `%f` stores a 4-byte
        // float where `%lf` stores an 8-byte double. (The VALUE parse is
        // width-agnostic; only the memory write differs.)
        let mut long_modifier = false;
        while f < fmt_chars.len() && matches!(fmt_chars[f], 'l' | 'h' | 'z' | 'j' | 't') {
            if fmt_chars[f] == 'l' {
                long_modifier = true;
            }
            f += 1;
        }
        if f >= fmt_chars.len() {
            // Lone '%' at end of format; treat as literal.
            break;
        }
        let conv = fmt_chars[f];
        f += 1;

        match conv {
            '%' => {
                if in_pos >= ctx.stdin.len() {
                    return stall(ctx, original_stdin, matched);
                }
                if ctx.stdin[in_pos] as char != '%' {
                    break;
                }
                in_pos += 1;
            }
            'c' => {
                // `%Nc` reads exactly N bytes (no NUL, no whitespace skip).
                let count = width.unwrap_or(1).max(1);
                // saturating: a huge `%<big>c` width made `in_pos + count`
                // wrap and then slice out of order, panicking the instance.
                if in_pos.saturating_add(count) > ctx.stdin.len() {
                    return stall(ctx, original_stdin, matched);
                }
                let start = in_pos;
                in_pos += count;
                if !suppress {
                    let ptr = walker.next_int(ctx);
                    for (i, b) in ctx.stdin[start..in_pos].iter().enumerate() {
                        ctx.mem.write_u8(ptr + i as u64, *b)?;
                    }
                    matched += 1;
                }
            }
            'd' | 'i' => {
                // Skip leading whitespace.
                while in_pos < ctx.stdin.len()
                    && is_c_space(ctx.stdin[in_pos])
                {
                    in_pos += 1;
                }
                let limit = width.unwrap_or(usize::MAX).max(1);
                let end = in_pos.saturating_add(limit).min(ctx.stdin.len());
                let complete =
                    in_pos.saturating_add(limit) <= ctx.stdin.len() || ctx.stdin_closed;
                let (value, consumed, stalled) =
                    parse_signed_int(&ctx.stdin[in_pos..end], conv == 'i', complete);
                if stalled {
                    return stall(ctx, original_stdin, matched);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = walker.next_int(ctx);
                    if long_modifier {
                        ctx.mem.write_u64(ptr, value as u64)?;
                    } else {
                        ctx.mem.write_u32(ptr, value as u32)?;
                    }
                    matched += 1;
                }
            }
            'u' => {
                while in_pos < ctx.stdin.len()
                    && is_c_space(ctx.stdin[in_pos])
                {
                    in_pos += 1;
                }
                let limit = width.unwrap_or(usize::MAX).max(1);
                let end = in_pos.saturating_add(limit).min(ctx.stdin.len());
                let complete =
                    in_pos.saturating_add(limit) <= ctx.stdin.len() || ctx.stdin_closed;
                let (value, consumed, stalled) =
                    parse_unsigned_int(&ctx.stdin[in_pos..end], 10, complete);
                if stalled {
                    return stall(ctx, original_stdin, matched);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = walker.next_int(ctx);
                    if long_modifier {
                        ctx.mem.write_u64(ptr, value)?;
                    } else {
                        ctx.mem.write_u32(ptr, value as u32)?;
                    }
                    matched += 1;
                }
            }
            'x' | 'X' => {
                while in_pos < ctx.stdin.len()
                    && is_c_space(ctx.stdin[in_pos])
                {
                    in_pos += 1;
                }
                let limit = width.unwrap_or(usize::MAX).max(1);
                let end = in_pos.saturating_add(limit).min(ctx.stdin.len());
                let complete =
                    in_pos.saturating_add(limit) <= ctx.stdin.len() || ctx.stdin_closed;
                let (value, consumed, stalled) =
                    parse_unsigned_int(&ctx.stdin[in_pos..end], 16, complete);
                if stalled {
                    return stall(ctx, original_stdin, matched);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = walker.next_int(ctx);
                    if long_modifier {
                        ctx.mem.write_u64(ptr, value)?;
                    } else {
                        ctx.mem.write_u32(ptr, value as u32)?;
                    }
                    matched += 1;
                }
            }
            's' => {
                // Skip leading whitespace, then read until whitespace/EOF.
                while in_pos < ctx.stdin.len()
                    && is_c_space(ctx.stdin[in_pos])
                {
                    in_pos += 1;
                }
                if in_pos >= ctx.stdin.len() {
                    return stall(ctx, original_stdin, matched);
                }
                let limit = width.unwrap_or(usize::MAX).max(1);
                let start = in_pos;
                while in_pos < ctx.stdin.len()
                    && in_pos - start < limit
                    && !is_c_space(ctx.stdin[in_pos])
                {
                    in_pos += 1;
                }
                // Stall only when the token ran into the end of the buffer
                // with field width to spare: more of it may still arrive.
                // A width-terminated token is complete by definition.
                if in_pos == ctx.stdin.len() && in_pos - start < limit {
                    return stall(ctx, original_stdin, matched);
                }
                if !suppress {
                    let ptr = walker.next_int(ctx);
                    for (i, b) in ctx.stdin[start..in_pos].iter().enumerate() {
                        ctx.mem.write_u8(ptr + i as u64, *b)?;
                    }
                    ctx.mem
                        .write_u8(ptr + (in_pos - start) as u64, 0)?;
                    matched += 1;
                }
            }
            'f' | 'F' | 'e' | 'E' | 'g' | 'G' => {
                while in_pos < ctx.stdin.len()
                    && is_c_space(ctx.stdin[in_pos])
                {
                    in_pos += 1;
                }
                let limit = width.unwrap_or(usize::MAX).max(1);
                let end = in_pos.saturating_add(limit).min(ctx.stdin.len());
                let complete =
                    in_pos.saturating_add(limit) <= ctx.stdin.len() || ctx.stdin_closed;
                let (value, consumed, stalled) = parse_float(&ctx.stdin[in_pos..end], complete);
                if stalled {
                    return stall(ctx, original_stdin, matched);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = walker.next_int(ctx);
                    if long_modifier {
                        // %lf: the pointer names a double, store 8 bytes.
                        ctx.mem.write_u64(ptr, value.to_bits())?;
                    } else {
                        // %f: the pointer names a float, store 4 bytes,
                        // exactly like C's scanf.
                        ctx.mem.write_u32(ptr, (value as f32).to_bits())?;
                    }
                    matched += 1;
                }
            }
            _ => break,
        }
    }

    // Commit: drop the bytes we consumed.
    ctx.stdin.drain(..in_pos);
    ctx.regs.write_gpr(0, true, matched as u64);
    Ok(HostOutcome::Continue)
}

fn stall(
    ctx: &mut HostContext<'_>,
    original: Vec<u8>,
    matched: i64,
) -> Result<HostOutcome, EmuError> {
    // Restore so the next invocation re-parses from the start.
    *ctx.stdin = original;
    // With stdin closed no more input can ever arrive: finish the call
    // with the fields that matched, or C's EOF (-1) when none did.
    if ctx.stdin_closed {
        let ret = if matched > 0 { matched } else { -1 };
        ctx.regs.write_gpr(0, true, ret as u64);
        return Ok(HostOutcome::Continue);
    }
    Ok(HostOutcome::NeedInput)
}

/// Parse a signed integer at the start of `buf`. `flexible` lets a
/// 0x/0X prefix switch to hex (C's `%i`). `complete` means the slice
/// ends at a hard field boundary (a width limit), so running out of
/// bytes finishes the token instead of stalling for more input. Returns
/// `(value, bytes_consumed, stalled)`.
fn parse_signed_int(buf: &[u8], flexible: bool, complete: bool) -> (i64, usize, bool) {
    if buf.is_empty() {
        return (0, 0, true);
    }
    let mut i = 0;
    let negative = match buf[0] {
        b'-' => {
            i += 1;
            true
        }
        b'+' => {
            i += 1;
            false
        }
        _ => false,
    };
    let mut base = 10;
    let mut prefixed = false;
    if flexible
        && i + 1 < buf.len()
        && buf[i] == b'0'
        && (buf[i + 1] == b'x' || buf[i + 1] == b'X')
    {
        base = 16;
        prefixed = true;
        i += 2;
    }
    // `start` AFTER the prefix skip: capturing it before left `0x` inside
    // the digits slice, so every `%i` hex read parsed as Err and stored 0
    // while still reporting a match.
    let start = i;
    while i < buf.len() && is_digit_for_base(buf[i], base) {
        i += 1;
    }
    if i == start {
        // Nothing after the prefix (or no digits at all). At a soft
        // buffer end the token may still arrive.
        if i == buf.len() && !complete {
            return (0, 0, true);
        }
        if prefixed {
            // `0xzz`: the longest valid token is the bare `0`, exactly
            // strtol's answer -- consume sign+`0` and leave the rest.
            return (0, start - 1, false);
        }
        return (0, 0, false);
    }
    // Stall if the digits ran into a soft end-of-buffer: a longer run
    // might follow in the next stdin push.
    if i == buf.len() && !complete {
        return (0, 0, true);
    }
    let s = std::str::from_utf8(&buf[start..i]).unwrap_or("");
    // The slice is nonempty valid digits, so the only possible parse
    // failure is overflow; glibc saturates (strtol + ERANGE) and still
    // reports the field matched.
    let value = match i64::from_str_radix(s, base) {
        Ok(v) => {
            if negative {
                -v
            } else {
                v
            }
        }
        Err(_) => {
            if negative {
                i64::MIN
            } else {
                i64::MAX
            }
        }
    };
    (value, i, false)
}

fn parse_unsigned_int(buf: &[u8], base: u32, complete: bool) -> (u64, usize, bool) {
    if buf.is_empty() {
        return (0, 0, true);
    }
    let mut i = 0;
    let mut prefixed = false;
    if base == 16
        && buf.len() >= 2
        && buf[0] == b'0'
        && (buf[1] == b'x' || buf[1] == b'X')
    {
        prefixed = true;
        i += 2;
    }
    let start = i;
    while i < buf.len() && is_digit_for_base(buf[i], base) {
        i += 1;
    }
    if i == start {
        if i == buf.len() && !complete {
            return (0, 0, true);
        }
        if prefixed {
            // `0Xzz`: strtoul's answer is the bare `0`.
            return (0, 1, false);
        }
        return (0, 0, false);
    }
    if i == buf.len() && !complete {
        return (0, 0, true);
    }
    let s = std::str::from_utf8(&buf[start..i]).unwrap_or("");
    // Only overflow can fail here; glibc saturates and reports a match.
    let value = u64::from_str_radix(s, base).unwrap_or(u64::MAX);
    (value, i, false)
}

fn parse_float(buf: &[u8], complete: bool) -> (f64, usize, bool) {
    if buf.is_empty() {
        return (0.0, 0, true);
    }
    // Accept: optional sign, digits, optional '.', digits, optional e/E+digits.
    let mut i = 0;
    if buf[0] == b'-' || buf[0] == b'+' {
        i += 1;
    }
    let mut seen_digit = false;
    while i < buf.len() && buf[i].is_ascii_digit() {
        i += 1;
        seen_digit = true;
    }
    if i < buf.len() && buf[i] == b'.' {
        i += 1;
        while i < buf.len() && buf[i].is_ascii_digit() {
            i += 1;
            seen_digit = true;
        }
    }
    if seen_digit && i < buf.len() && (buf[i] == b'e' || buf[i] == b'E') {
        let before_exp = i;
        i += 1;
        if i < buf.len() && (buf[i] == b'+' || buf[i] == b'-') {
            i += 1;
        }
        let exp_start = i;
        while i < buf.len() && buf[i].is_ascii_digit() {
            i += 1;
        }
        if i == exp_start {
            // `1.5e` with nothing after: on a soft buffer end the exponent
            // may still arrive; otherwise back the field off to the
            // well-formed mantissa (C behavior) instead of parsing the
            // dangling `e` into an error that stored 0.
            if i == buf.len() && !complete {
                return (0.0, 0, true);
            }
            i = before_exp;
        }
    }
    if !seen_digit {
        return (0.0, 0, i == buf.len() && !complete);
    }
    if i == buf.len() && !complete {
        return (0.0, 0, true);
    }
    let s = std::str::from_utf8(&buf[..i]).unwrap_or("");
    (s.parse::<f64>().unwrap_or(0.0), i, false)
}

fn is_digit_for_base(b: u8, base: u32) -> bool {
    match base {
        10 => b.is_ascii_digit(),
        16 => b.is_ascii_hexdigit(),
        8 => matches!(b, b'0'..=b'7'),
        2 => matches!(b, b'0' | b'1'),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cpu::OpenFile;
    use crate::memory::Memory;
    use crate::registers::RegisterFile;
    use std::collections::HashMap;

    struct Host {
        regs: RegisterFile,
        mem: Memory,
        stdout: Vec<u8>,
        stderr: Vec<u8>,
        stdin: Vec<u8>,
        vfs: HashMap<String, Vec<u8>>,
        open_files: HashMap<u32, OpenFile>,
        next_fd: u32,
        rand_state: u64,
    }

    impl Host {
        fn new() -> Self {
            let mut mem = Memory::new();
            mem.map_page(0x0050_0000);
            mem.map_page(0x0060_0000);
            Host {
                regs: RegisterFile::new(),
                mem,
                stdout: Vec::new(),
                stderr: Vec::new(),
                stdin: Vec::new(),
                vfs: HashMap::new(),
                open_files: HashMap::new(),
                next_fd: 3,
                rand_state: 1,
            }
        }
        fn ctx(&mut self) -> HostContext<'_> {
            HostContext {
                regs: &mut self.regs,
                mem: &mut self.mem,
                stdout: &mut self.stdout,
                stderr: &mut self.stderr,
                stdin: &mut self.stdin,
                stdin_closed: false,
                vfs: &mut self.vfs,
                open_files: &mut self.open_files,
                next_fd: &mut self.next_fd,
                rand_state: &mut self.rand_state,
            }
        }
        fn place_fmt(&mut self, fmt: &str) {
            let fmt_addr = 0x0050_0000u64;
            for (i, b) in fmt.as_bytes().iter().enumerate() {
                self.mem.write_u8(fmt_addr + i as u64, *b).unwrap();
            }
            self.mem
                .write_u8(fmt_addr + fmt.len() as u64, 0)
                .unwrap();
            self.regs.write_gpr(0, true, fmt_addr);
        }
    }

    fn closed_ctx(h: &mut Host) -> HostContext<'_> {
        let mut ctx = h.ctx();
        ctx.stdin_closed = true;
        ctx
    }

    #[test]
    fn percent_ld_writes_eight_bytes() {
        // scanf("%ld", &x) must write 8 bytes; the store used to be a fixed
        // write_u32, leaving the top 4 bytes of a .dword stale. Pre-fill the
        // destination with 0xFF so a 4-byte write would leave the high half set.
        let mut h = Host::new();
        h.place_fmt("%ld");
        let dst = 0x0060_0000u64;
        h.mem.write_u64(dst, 0xFFFF_FFFF_FFFF_FFFF).unwrap();
        h.regs.write_gpr(1, true, dst);
        h.stdin.extend_from_slice(b"5
");
        scanf(&mut closed_ctx(&mut h)).unwrap();
        assert_eq!(h.mem.read_u64(dst).unwrap(), 5, "the full 8 bytes were written");
        // plain %d still writes only the low 4 bytes.
        let mut h = Host::new();
        h.place_fmt("%d");
        h.mem.write_u64(dst, 0xFFFF_FFFF_0000_0000).unwrap();
        h.regs.write_gpr(1, true, dst);
        h.stdin.extend_from_slice(b"7
");
        scanf(&mut closed_ctx(&mut h)).unwrap();
        assert_eq!(h.mem.read_u32(dst).unwrap(), 7);
        assert_eq!(h.mem.read_u32(dst + 4).unwrap(), 0xFFFF_FFFF, "high half untouched");
    }

    #[test]
    fn percent_c_with_a_huge_width_does_not_panic() {
        // A `%<huge>c` width saturated to usize::MAX and `in_pos + count`
        // wrapped, then sliced out of order and panicked the instance. It
        // must instead stall (waiting for input that cannot arrive).
        let mut h = Host::new();
        h.place_fmt("%2000000000c");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"ab");
        let outcome = scanf(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::NeedInput);
    }

    #[test]
    fn a_pasted_nbsp_does_not_split_a_percent_s_token() {
        // stdin "a\u{a0}b\n" arrives as UTF-8 bytes 61 C2 A0 62 0A. C's
        // isspace rejects both 0xC2 and 0xA0, so glibc reads the whole
        // run "a\u{a0}b" as one %s token; the Unicode predicate split it
        // after the C2 lead byte, storing a string ending mid-character.
        let mut h = Host::new();
        h.place_fmt("%s");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice("a\u{a0}b\n".as_bytes());
        let outcome = scanf(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(h.regs.read_gpr(0, true), 1);
        let mut stored = Vec::new();
        for i in 0..5 {
            stored.push(h.mem.read_u8(0x0060_0000 + i).unwrap());
        }
        assert_eq!(stored, vec![0x61, 0xC2, 0xA0, 0x62, 0x00]);
    }

    #[test]
    fn scanf_returns_eof_on_closed_empty_stdin() {
        let mut h = Host::new();
        h.place_fmt("%d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        let outcome = scanf(&mut closed_ctx(&mut h)).unwrap();
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
    }

    #[test]
    fn scanf_completes_a_trailing_token_when_stdin_is_closed() {
        // "42" with no trailing separator used to stall forever waiting
        // for more digits; a closed stdin makes the token complete.
        let mut h = Host::new();
        h.place_fmt("%d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"42");
        let outcome = scanf(&mut closed_ctx(&mut h)).unwrap();
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 42);
    }

    #[test]
    fn scanf_reports_the_partial_match_count_at_eof() {
        let mut h = Host::new();
        h.place_fmt("%d %d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 0x0060_0004);
        h.stdin.extend_from_slice(b"7\n");
        let outcome = scanf(&mut closed_ctx(&mut h)).unwrap();
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 7);
    }

    #[test]
    fn field_width_bounds_a_string_read() {
        // `%4s` is the defensive idiom C gives students; it used to write
        // the whole token unbounded.
        let mut h = Host::new();
        h.place_fmt("%4s");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.mem.write_u32(0x0060_0008, 0xDEAD_BEEF).unwrap();
        h.stdin.extend_from_slice(b"AAAAAAAAAAAAAAAAAAAA \n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 0x4141_4141);
        assert_eq!(h.mem.read_u8(0x0060_0004).unwrap(), 0);
        // The sentinel two words up must be untouched.
        assert_eq!(h.mem.read_u32(0x0060_0008).unwrap(), 0xDEAD_BEEF);
        // The unread tail stays queued for the next read.
        assert_eq!(&h.stdin[..3], b"AAA");
    }

    #[test]
    fn field_width_bounds_an_int_read() {
        let mut h = Host::new();
        h.place_fmt("%2d%2d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 0x0060_0004);
        h.stdin.extend_from_slice(b"12345 \n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 2);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 12);
        assert_eq!(h.mem.read_u32(0x0060_0004).unwrap(), 34);
        assert_eq!(&h.stdin[..2], b"5 ");
    }

    #[test]
    fn width_qualified_char_reads_that_many_bytes() {
        let mut h = Host::new();
        h.place_fmt("%3c");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"abcd");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u8(0x0060_0000).unwrap(), b'a');
        assert_eq!(h.mem.read_u8(0x0060_0002).unwrap(), b'c');
        assert_eq!(h.stdin, b"d");
    }

    #[test]
    fn eighth_pointer_comes_from_the_stack_spill() {
        // AAPCS64 passes the 9th arg (fmt + 8 pointers) at [sp]; walking a
        // bare register counter read x8, a live scratch register.
        let mut h = Host::new();
        h.place_fmt("%d %d %d %d %d %d %d %d");
        for i in 0..7 {
            h.regs
                .write_gpr(1 + i, true, 0x0060_0000 + (i as u64) * 4);
        }
        // A fresh RegisterFile has sp = 0; park it inside the mapped page.
        let sp = 0x0060_0800u64;
        h.regs.write_sp(sp);
        h.mem.write_u64(sp, 0x0060_0000 + 7 * 4).unwrap();
        // Poison x8 so a regression to the register walk shows up.
        h.regs.write_gpr(8, true, 0x0060_0100);
        h.mem.write_u32(0x0060_0100, 0xCAFE_F00D).unwrap();
        h.stdin.extend_from_slice(b"1 2 3 4 5 6 7 8\n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 8);
        assert_eq!(h.mem.read_u32(0x0060_0000 + 7 * 4).unwrap(), 8);
        assert_eq!(h.mem.read_u32(0x0060_0100).unwrap(), 0xCAFE_F00D);
    }

    #[test]
    fn percent_i_reads_hex_with_either_prefix_case() {
        for input in [b"0x1f \n".as_slice(), b"0X1F \n".as_slice()] {
            let mut h = Host::new();
            h.place_fmt("%i");
            h.regs.write_gpr(1, true, 0x0060_0000);
            h.stdin.extend_from_slice(input);
            scanf(&mut h.ctx()).unwrap();
            assert_eq!(h.regs.read_gpr(0, true), 1, "input {input:?}");
            assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 0x1F, "input {input:?}");
        }
    }

    #[test]
    fn percent_x_accepts_an_uppercase_prefix() {
        let mut h = Host::new();
        h.place_fmt("%x");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"0X1F\n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 0x1F);
    }

    #[test]
    fn overflowing_digits_saturate_like_strtol() {
        let (v, consumed, stalled) = parse_signed_int(b"99999999999999999999 ", false, false);
        assert!(!stalled);
        assert_eq!(consumed, 20);
        assert_eq!(v, i64::MAX);
        let (v, _, _) = parse_signed_int(b"-99999999999999999999 ", false, false);
        assert_eq!(v, i64::MIN);
    }

    #[test]
    fn hex_prefix_with_no_digits_consumes_the_bare_zero() {
        // strtol's answer for `0xzz` is 0 consuming just the `0`, leaving
        // `xzz` -- not a phantom match that eats the prefix.
        let (v, consumed, stalled) = parse_signed_int(b"0xzz ", true, false);
        assert!(!stalled);
        assert_eq!((v, consumed), (0, 1));
        let (v, consumed, _) = parse_unsigned_int(b"0Xzz ", 16, false);
        assert_eq!((v, consumed), (0, 1));
    }

    #[test]
    fn dangling_exponent_backs_off_to_the_mantissa() {
        let (v, consumed, stalled) = parse_float(b"1.5e \n", false);
        assert!(!stalled);
        assert_eq!(consumed, 3);
        assert_eq!(v, 1.5);
    }

    #[test]
    fn scanf_single_int() {
        let mut h = Host::new();
        h.place_fmt("%d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"42\n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 42);
    }

    #[test]
    fn scanf_negative_int() {
        let mut h = Host::new();
        h.place_fmt("%d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"-7 ");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap() as i32, -7);
    }

    #[test]
    fn scanf_two_ints_separated_by_space() {
        let mut h = Host::new();
        h.place_fmt("%d %d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 0x0060_0004);
        h.stdin.extend_from_slice(b"3 5\n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 2);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 3);
        assert_eq!(h.mem.read_u32(0x0060_0004).unwrap(), 5);
    }

    #[test]
    fn scanf_returns_need_input_when_stdin_empty() {
        let mut h = Host::new();
        h.place_fmt("%d");
        let outcome = scanf(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::NeedInput);
        // Stdin must be untouched so a later push can supply the field.
        assert!(h.stdin.is_empty());
    }

    #[test]
    fn scanf_stalls_when_int_is_incomplete() {
        let mut h = Host::new();
        h.place_fmt("%d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"12"); // no trailing whitespace / EOF
        let outcome = scanf(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::NeedInput);
        assert_eq!(h.stdin, b"12"); // rolled back
    }

    #[test]
    fn scanf_resumes_after_push_stdin() {
        let mut h = Host::new();
        h.place_fmt("%d");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"12");
        assert_eq!(
            scanf(&mut h.ctx()).unwrap(),
            HostOutcome::NeedInput
        );
        // User supplies a terminating newline; retry should now succeed.
        h.stdin.extend_from_slice(b"3\n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 123);
    }

    #[test]
    fn scanf_string_reads_up_to_whitespace() {
        let mut h = Host::new();
        h.place_fmt("%s");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"hello world\n");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        let mut out = Vec::new();
        for i in 0..5 {
            out.push(h.mem.read_u8(0x0060_0000 + i).unwrap());
        }
        assert_eq!(out, b"hello");
        assert_eq!(h.mem.read_u8(0x0060_0000 + 5).unwrap(), 0);
    }

    #[test]
    fn scanf_char_reads_one_byte_even_whitespace() {
        let mut h = Host::new();
        h.place_fmt("%c");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b" A");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u8(0x0060_0000).unwrap(), b' ');
    }

    #[test]
    #[allow(clippy::approx_constant)] // 3.14 is the literal stdin text, not an approximation of pi
    fn scanf_plain_f_stores_a_4_byte_float() {
        // C contract: scanf("%f", &x) writes a 4-byte float. A program
        // then reads it back with `ldr s0, [addr]`.
        let mut h = Host::new();
        h.place_fmt("%f");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"3.14 ");
        // Sentinel just past the float: %f must not touch bytes 4..8.
        h.mem.write_u32(0x0060_0004, 0xDEAD_BEEF).unwrap();
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        let bits = h.mem.read_u32(0x0060_0000).unwrap();
        let value = f32::from_bits(bits);
        assert!((value - 3.14).abs() < 1e-6);
        assert_eq!(h.mem.read_u32(0x0060_0004).unwrap(), 0xDEAD_BEEF);
    }

    #[test]
    #[allow(clippy::approx_constant)] // 3.14 is the literal stdin text, not an approximation of pi
    fn scanf_lf_stores_an_8_byte_double() {
        let mut h = Host::new();
        h.place_fmt("%lf");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"3.14 ");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        let bits = h.mem.read_u64(0x0060_0000).unwrap();
        let value = f64::from_bits(bits);
        assert!((value - 3.14).abs() < 1e-12);
    }

    #[test]
    fn scanf_hex_field() {
        let mut h = Host::new();
        h.place_fmt("%x");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.stdin.extend_from_slice(b"DEAD ");
        scanf(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.mem.read_u32(0x0060_0000).unwrap(), 0xDEAD);
    }
}
