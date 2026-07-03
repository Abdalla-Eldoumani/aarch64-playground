//! Small libc helpers the cpsc 355 corpus reaches for directly. All of
//! them receive their arguments in the AAPCS64 GP registers (`x0..x7`)
//! and write their return value into `x0` (or `d0` for `atof`).
//!
//! These are intentionally naive; they mirror behavior, not optimization.

use crate::errors::EmuError;
use crate::hosted::printf::read_c_string;
use crate::hosted::{HostContext, HostOutcome};

pub fn puts(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let ptr = ctx.regs.read_gpr(0, true);
    let bytes = read_c_string(ctx.mem, ptr)?;
    ctx.stdout.extend_from_slice(&bytes);
    ctx.stdout.push(b'\n');
    ctx.regs.write_gpr(0, true, (bytes.len() + 1) as u64);
    Ok(HostOutcome::Continue)
}

pub fn putchar(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let byte = (ctx.regs.read_gpr(0, true) & 0xFF) as u8;
    ctx.stdout.push(byte);
    ctx.regs.write_gpr(0, true, byte as u64);
    Ok(HostOutcome::Continue)
}

pub fn getchar(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    if ctx.stdin.is_empty() {
        return Ok(HostOutcome::NeedInput);
    }
    let byte = ctx.stdin.remove(0);
    ctx.regs.write_gpr(0, true, byte as u64);
    Ok(HostOutcome::Continue)
}

pub fn strlen(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let ptr = ctx.regs.read_gpr(0, true);
    let bytes = read_c_string(ctx.mem, ptr)?;
    ctx.regs.write_gpr(0, true, bytes.len() as u64);
    Ok(HostOutcome::Continue)
}

pub fn strcmp(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let a_ptr = ctx.regs.read_gpr(0, true);
    let b_ptr = ctx.regs.read_gpr(1, true);
    let a = read_c_string(ctx.mem, a_ptr)?;
    let b = read_c_string(ctx.mem, b_ptr)?;
    let result = match a.cmp(&b) {
        std::cmp::Ordering::Less => -1i64,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    };
    ctx.regs.write_gpr(0, true, result as u64);
    Ok(HostOutcome::Continue)
}

pub fn strcpy(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let dst = ctx.regs.read_gpr(0, true);
    let src = ctx.regs.read_gpr(1, true);
    let bytes = read_c_string(ctx.mem, src)?;
    for (i, b) in bytes.iter().enumerate() {
        ctx.mem.write_u8(dst + i as u64, *b)?;
    }
    ctx.mem.write_u8(dst + bytes.len() as u64, 0)?;
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

pub fn memset(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let dst = ctx.regs.read_gpr(0, true);
    let value = ctx.regs.read_gpr(1, true) as u8;
    let n = ctx.regs.read_gpr(2, true);
    for i in 0..n {
        ctx.mem.write_u8(dst + i, value)?;
    }
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

pub fn memcpy(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let dst = ctx.regs.read_gpr(0, true);
    let src = ctx.regs.read_gpr(1, true);
    let n = ctx.regs.read_gpr(2, true);
    // Copy byte-by-byte; the corpus never passes overlapping ranges to memcpy.
    for i in 0..n {
        let b = ctx.mem.read_u8(src + i)?;
        ctx.mem.write_u8(dst + i, b)?;
    }
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

pub fn exit(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let code = ctx.regs.read_gpr(0, true) as i64;
    Ok(HostOutcome::Exited(code))
}

/// Sentinel stub the loader stashes in `LR` before calling `main`. A
/// program that returns out of `main` lands here and we halt with the
/// caller's return value (the ARM64 AAPCS64 convention puts it in `w0`).
pub fn main_return(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    // Only the low 32 bits of x0 are meaningful as an exit code when
    // `int main()` returns.
    let code = ctx.regs.read_gpr(0, false) as i32 as i64;
    Ok(HostOutcome::Exited(code))
}

pub fn atoi(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let ptr = ctx.regs.read_gpr(0, true);
    let bytes = read_c_string(ctx.mem, ptr)?;
    let s = String::from_utf8_lossy(&bytes);
    // C's atoi: skip leading whitespace, take an optional sign, then
    // digits until the first non-digit; no digits at all yields 0.
    let trimmed = s.trim_start();
    let (negative, digits) = match trimmed.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, trimmed.strip_prefix('+').unwrap_or(trimmed)),
    };
    let mut value: i64 = 0;
    for c in digits.chars() {
        let Some(d) = c.to_digit(10) else { break };
        value = value.wrapping_mul(10).wrapping_add(d as i64);
    }
    if negative {
        value = -value;
    }
    // int return: keep w0 and x0 reads consistent by sign-extending.
    ctx.regs.write_gpr(0, true, value as i32 as i64 as u64);
    Ok(HostOutcome::Continue)
}

pub fn atof(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let ptr = ctx.regs.read_gpr(0, true);
    let bytes = read_c_string(ctx.mem, ptr)?;
    let s = String::from_utf8_lossy(&bytes);
    // C's atof skips leading whitespace then parses; anything trailing
    // stops the scan but doesn't error. `str::parse::<f64>` is stricter,
    // so trim and retry if it fails.
    let trimmed = s.trim_start();
    let value = trimmed.parse::<f64>().unwrap_or_else(|_| {
        // Find the longest valid prefix.
        let mut end = 0;
        for (i, _) in trimmed.char_indices() {
            if trimmed[..=i].parse::<f64>().is_ok() {
                end = i + 1;
            }
        }
        if end > 0 {
            trimmed[..end].parse::<f64>().unwrap_or(0.0)
        } else {
            0.0
        }
    });
    ctx.regs.write_fpr_f64(0, value);
    Ok(HostOutcome::Continue)
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
        fn place_string(&mut self, addr: u64, s: &[u8]) {
            for (i, b) in s.iter().enumerate() {
                self.mem.write_u8(addr + i as u64, *b).unwrap();
            }
            self.mem.write_u8(addr + s.len() as u64, 0).unwrap();
        }
    }

    #[test]
    fn puts_appends_newline_and_returns_length() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"hello");
        h.regs.write_gpr(0, true, 0x0050_0000);
        puts(&mut h.ctx()).unwrap();
        assert_eq!(h.stdout, b"hello\n");
        assert_eq!(h.regs.read_gpr(0, true), 6);
    }

    #[test]
    fn putchar_emits_low_byte() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, b'X' as u64);
        putchar(&mut h.ctx()).unwrap();
        assert_eq!(h.stdout, b"X");
    }

    #[test]
    fn getchar_returns_need_input_on_empty_stdin() {
        let mut h = Host::new();
        let outcome = getchar(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::NeedInput);
    }

    #[test]
    fn getchar_consumes_one_byte() {
        let mut h = Host::new();
        h.stdin.extend_from_slice(b"AB");
        getchar(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), b'A' as u64);
        assert_eq!(h.stdin, b"B");
    }

    #[test]
    fn strlen_counts_bytes_until_null() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"aarch64");
        h.regs.write_gpr(0, true, 0x0050_0000);
        strlen(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 7);
    }

    #[test]
    fn strcmp_equal_zero_less_negative_greater_positive() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"abc");
        h.place_string(0x0050_0010, b"abc");
        h.place_string(0x0050_0020, b"abd");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0010);
        strcmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 0);
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0020);
        strcmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
        h.regs.write_gpr(0, true, 0x0050_0020);
        h.regs.write_gpr(1, true, 0x0050_0000);
        strcmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 1);
    }

    #[test]
    fn strcpy_copies_including_null_terminator() {
        let mut h = Host::new();
        h.place_string(0x0050_0010, b"source");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0010);
        strcpy(&mut h.ctx()).unwrap();
        let copied = read_c_string(&h.mem, 0x0050_0000).unwrap();
        assert_eq!(copied, b"source");
    }

    #[test]
    fn memset_fills_n_bytes() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, 0xAB);
        h.regs.write_gpr(2, true, 4);
        memset(&mut h.ctx()).unwrap();
        for i in 0..4 {
            assert_eq!(h.mem.read_u8(0x0060_0000 + i).unwrap(), 0xAB);
        }
    }

    #[test]
    fn memcpy_duplicates_range() {
        let mut h = Host::new();
        for i in 0..8 {
            h.mem.write_u8(0x0060_0000 + i, (i + 1) as u8).unwrap();
        }
        h.regs.write_gpr(0, true, 0x0060_0100);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 8);
        memcpy(&mut h.ctx()).unwrap();
        for i in 0..8 {
            assert_eq!(h.mem.read_u8(0x0060_0100 + i).unwrap(), (i + 1) as u8);
        }
    }

    #[test]
    fn exit_returns_exited_outcome_with_code() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 7);
        let outcome = exit(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::Exited(7));
    }

    #[test]
    fn atoi_parses_argv_style_numbers() {
        // The a5b shape: "./a5b 3 21" hands atoi the strings "3" and "21".
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"21");
        h.regs.write_gpr(0, true, 0x0050_0000);
        atoi(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 21);
    }

    #[test]
    fn atoi_handles_sign_whitespace_and_trailing_garbage() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"  -42abc");
        h.regs.write_gpr(0, true, 0x0050_0000);
        atoi(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -42);
        // Sign-extended into x0 so w0 and x0 reads agree.
        assert_eq!(h.regs.read_gpr(0, false) as u32 as i32, -42);
    }

    #[test]
    fn atoi_returns_zero_on_nonsense() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"pyramid");
        h.regs.write_gpr(0, true, 0x0050_0000);
        atoi(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0);
    }

    #[test]
    fn atof_parses_plain_decimal() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"3.14");
        h.regs.write_gpr(0, true, 0x0050_0000);
        atof(&mut h.ctx()).unwrap();
        assert!((h.regs.read_fpr_f64(0) - 3.14).abs() < 1e-12);
    }

    #[test]
    fn atof_ignores_trailing_garbage() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"  -2.5xyz");
        h.regs.write_gpr(0, true, 0x0050_0000);
        atof(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_fpr_f64(0), -2.5);
    }

    #[test]
    fn atof_returns_zero_on_nonsense() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"not a number");
        h.regs.write_gpr(0, true, 0x0050_0000);
        atof(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_fpr_f64(0), 0.0);
    }
}
