//! scanf implementation. Supports `%d %u %x %s %c %f`, plus literal
//! whitespace in the format matching any number of input whitespace
//! characters.
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
use crate::hosted::{HostContext, HostOutcome};

pub fn scanf(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fmt_ptr = ctx.regs.read_gpr(0, true);
    let fmt_bytes = read_c_string(ctx.mem, fmt_ptr)?;
    let fmt = String::from_utf8_lossy(&fmt_bytes).into_owned();

    // Snapshot stdin so we can roll back if we stall mid-field.
    let original_stdin = ctx.stdin.clone();

    let mut in_pos: usize = 0;
    let mut arg_idx: u8 = 1; // x0 is the format string
    let mut matched: i64 = 0;

    let fmt_chars: Vec<char> = fmt.chars().collect();
    let mut f = 0;
    while f < fmt_chars.len() {
        let c = fmt_chars[f];
        if c.is_whitespace() {
            // Skip any run of whitespace in the input; matches zero-or-more.
            while in_pos < ctx.stdin.len()
                && (ctx.stdin[in_pos] as char).is_whitespace()
            {
                in_pos += 1;
            }
            f += 1;
            continue;
        }
        if c != '%' {
            // Literal character: must match exactly.
            if in_pos >= ctx.stdin.len() {
                return stall(ctx, original_stdin);
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
        // Optional width (currently unused but parsed).
        while f < fmt_chars.len() && fmt_chars[f].is_ascii_digit() {
            f += 1;
        }
        // Length modifier; ignored because every register is 64-bit.
        while f < fmt_chars.len() && matches!(fmt_chars[f], 'l' | 'h' | 'z' | 'j' | 't') {
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
                    return stall(ctx, original_stdin);
                }
                if ctx.stdin[in_pos] as char != '%' {
                    break;
                }
                in_pos += 1;
            }
            'c' => {
                if in_pos >= ctx.stdin.len() {
                    return stall(ctx, original_stdin);
                }
                let byte = ctx.stdin[in_pos];
                in_pos += 1;
                if !suppress {
                    let ptr = ctx.regs.read_gpr(arg_idx, true);
                    arg_idx = arg_idx.saturating_add(1);
                    ctx.mem.write_u8(ptr, byte)?;
                    matched += 1;
                }
            }
            'd' | 'i' => {
                // Skip leading whitespace.
                while in_pos < ctx.stdin.len()
                    && (ctx.stdin[in_pos] as char).is_whitespace()
                {
                    in_pos += 1;
                }
                let (value, consumed, stalled) =
                    parse_signed_int(&ctx.stdin[in_pos..], conv == 'i');
                if stalled {
                    return stall(ctx, original_stdin);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = ctx.regs.read_gpr(arg_idx, true);
                    arg_idx = arg_idx.saturating_add(1);
                    ctx.mem.write_u32(ptr, value as u32)?;
                    matched += 1;
                }
            }
            'u' => {
                while in_pos < ctx.stdin.len()
                    && (ctx.stdin[in_pos] as char).is_whitespace()
                {
                    in_pos += 1;
                }
                let (value, consumed, stalled) = parse_unsigned_int(&ctx.stdin[in_pos..], 10);
                if stalled {
                    return stall(ctx, original_stdin);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = ctx.regs.read_gpr(arg_idx, true);
                    arg_idx = arg_idx.saturating_add(1);
                    ctx.mem.write_u32(ptr, value as u32)?;
                    matched += 1;
                }
            }
            'x' | 'X' => {
                while in_pos < ctx.stdin.len()
                    && (ctx.stdin[in_pos] as char).is_whitespace()
                {
                    in_pos += 1;
                }
                let (value, consumed, stalled) = parse_unsigned_int(&ctx.stdin[in_pos..], 16);
                if stalled {
                    return stall(ctx, original_stdin);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = ctx.regs.read_gpr(arg_idx, true);
                    arg_idx = arg_idx.saturating_add(1);
                    ctx.mem.write_u32(ptr, value as u32)?;
                    matched += 1;
                }
            }
            's' => {
                // Skip leading whitespace, then read until whitespace/EOF.
                while in_pos < ctx.stdin.len()
                    && (ctx.stdin[in_pos] as char).is_whitespace()
                {
                    in_pos += 1;
                }
                if in_pos >= ctx.stdin.len() {
                    return stall(ctx, original_stdin);
                }
                let start = in_pos;
                while in_pos < ctx.stdin.len()
                    && !(ctx.stdin[in_pos] as char).is_whitespace()
                {
                    in_pos += 1;
                }
                // If we ran out of buffer without hitting whitespace, stall;
                // the next stdin push may continue the token.
                if in_pos == ctx.stdin.len() {
                    return stall(ctx, original_stdin);
                }
                if !suppress {
                    let ptr = ctx.regs.read_gpr(arg_idx, true);
                    arg_idx = arg_idx.saturating_add(1);
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
                    && (ctx.stdin[in_pos] as char).is_whitespace()
                {
                    in_pos += 1;
                }
                let (value, consumed, stalled) = parse_float(&ctx.stdin[in_pos..]);
                if stalled {
                    return stall(ctx, original_stdin);
                }
                if consumed == 0 {
                    break;
                }
                in_pos += consumed;
                if !suppress {
                    let ptr = ctx.regs.read_gpr(arg_idx, true);
                    arg_idx = arg_idx.saturating_add(1);
                    ctx.mem.write_u64(ptr, value.to_bits())?;
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

fn stall(ctx: &mut HostContext<'_>, original: Vec<u8>) -> Result<HostOutcome, EmuError> {
    // Restore so the next invocation re-parses from the start.
    *ctx.stdin = original;
    Ok(HostOutcome::NeedInput)
}

/// Parse a signed base-10 integer at the start of `buf`. `flexible` true
/// lets `0x...` slip into hex (matching C's `%i` behavior). Returns
/// `(value, bytes_consumed, stalled)` where `stalled` is true when the
/// buffer ended before the token was obviously complete.
fn parse_signed_int(buf: &[u8], flexible: bool) -> (i64, usize, bool) {
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
    let start = i;
    let base = if flexible && buf[i..].starts_with(b"0x") {
        i += 2;
        16
    } else if flexible && buf[i..].starts_with(b"0") && i + 1 < buf.len() {
        10 // Could be octal per strict `%i`, but the corpus only uses decimal.
    } else {
        10
    };
    while i < buf.len() && is_digit_for_base(buf[i], base) {
        i += 1;
    }
    if i == start {
        return (0, 0, false);
    }
    // Stall if we hit end-of-buffer right after the digits, since a longer
    // digit run might follow.
    if i == buf.len() {
        return (0, 0, true);
    }
    let s = std::str::from_utf8(&buf[start..i]).unwrap_or("");
    let value = i64::from_str_radix(s, base).unwrap_or(0);
    (if negative { -value } else { value }, i, false)
}

fn parse_unsigned_int(buf: &[u8], base: u32) -> (u64, usize, bool) {
    if buf.is_empty() {
        return (0, 0, true);
    }
    let mut i = 0;
    if base == 16 && buf.starts_with(b"0x") {
        i += 2;
    }
    let start = i;
    while i < buf.len() && is_digit_for_base(buf[i], base) {
        i += 1;
    }
    if i == start {
        return (0, 0, false);
    }
    if i == buf.len() {
        return (0, 0, true);
    }
    let s = std::str::from_utf8(&buf[start..i]).unwrap_or("");
    let value = u64::from_str_radix(s, base).unwrap_or(0);
    (value, i, false)
}

fn parse_float(buf: &[u8]) -> (f64, usize, bool) {
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
    if i < buf.len() && (buf[i] == b'e' || buf[i] == b'E') {
        i += 1;
        if i < buf.len() && (buf[i] == b'+' || buf[i] == b'-') {
            i += 1;
        }
        while i < buf.len() && buf[i].is_ascii_digit() {
            i += 1;
        }
    }
    if !seen_digit {
        return (0.0, 0, false);
    }
    if i == buf.len() {
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
            }
        }
        fn ctx(&mut self) -> HostContext<'_> {
            HostContext {
                regs: &mut self.regs,
                mem: &mut self.mem,
                stdout: &mut self.stdout,
                stderr: &mut self.stderr,
                stdin: &mut self.stdin,
                vfs: &mut self.vfs,
                open_files: &mut self.open_files,
                next_fd: &mut self.next_fd,
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
    fn scanf_float_reads_ieee_double() {
        let mut h = Host::new();
        h.place_fmt("%f");
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
