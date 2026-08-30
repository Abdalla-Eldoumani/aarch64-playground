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
    let bytes = read_c_string(ctx.mem, ptr, "puts")?;
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
        // Closed stdin means EOF (-1), so the canonical read-until-EOF
        // loop can terminate; before the close signal existed this state
        // was an unbreakable wait.
        if ctx.stdin_closed {
            ctx.regs.write_gpr(0, true, (-1i64) as u64);
            return Ok(HostOutcome::Continue);
        }
        return Ok(HostOutcome::NeedInput);
    }
    let byte = ctx.stdin.remove(0);
    ctx.regs.write_gpr(0, true, byte as u64);
    Ok(HostOutcome::Continue)
}

pub fn strlen(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let ptr = ctx.regs.read_gpr(0, true);
    let bytes = read_c_string(ctx.mem, ptr, "strlen")?;
    ctx.regs.write_gpr(0, true, bytes.len() as u64);
    Ok(HostOutcome::Continue)
}

pub fn strcmp(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let a_ptr = ctx.regs.read_gpr(0, true);
    let b_ptr = ctx.regs.read_gpr(1, true);
    let a = read_c_string(ctx.mem, a_ptr, "strcmp")?;
    let b = read_c_string(ctx.mem, b_ptr, "strcmp")?;
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
    let bytes = read_c_string(ctx.mem, src, "strcpy")?;
    for (i, b) in bytes.iter().enumerate() {
        ctx.mem.write_u8(dst.wrapping_add(i as u64), *b)?;
    }
    ctx.mem.write_u8(dst.wrapping_add(bytes.len() as u64), 0)?;
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

pub fn memset(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let dst = ctx.regs.read_gpr(0, true);
    let value = ctx.regs.read_gpr(1, true) as u8;
    let n = ctx.regs.read_gpr(2, true);
    // The guest picks both the pointer and the length, so the walk wraps
    // instead of overflowing: a pointer near the top of the address space
    // must fault calmly, not panic the instance.
    for i in 0..n {
        ctx.mem.write_u8(dst.wrapping_add(i), value)?;
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
        let b = ctx.mem.read_u8(src.wrapping_add(i))?;
        ctx.mem.write_u8(dst.wrapping_add(i), b)?;
    }
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

/// memmove(dst, src, n) -> dst. The overlap-safe copy: when the
/// destination starts above the source the walk runs backwards, so the
/// bytes still to be read are never overwritten first. (memcpy beside it
/// stays a plain forward walk, which is what glibc's memcpy is too.)
pub fn memmove(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let dst = ctx.regs.read_gpr(0, true);
    let src = ctx.regs.read_gpr(1, true);
    let n = ctx.regs.read_gpr(2, true);
    if dst < src {
        for i in 0..n {
            let b = ctx.mem.read_u8(src.wrapping_add(i))?;
            ctx.mem.write_u8(dst.wrapping_add(i), b)?;
        }
    } else {
        for i in (0..n).rev() {
            let b = ctx.mem.read_u8(src.wrapping_add(i))?;
            ctx.mem.write_u8(dst.wrapping_add(i), b)?;
        }
    }
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

/// memcmp(a, b, n) -> the difference of the first bytes that differ,
/// read as unsigned chars, or 0 when the ranges match.
pub fn memcmp(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let a_ptr = ctx.regs.read_gpr(0, true);
    let b_ptr = ctx.regs.read_gpr(1, true);
    let n = ctx.regs.read_gpr(2, true);
    let mut result = 0i32;
    let mut compared = 0u64;
    for i in 0..n {
        let a = ctx.mem.read_u8(a_ptr.wrapping_add(i))?;
        let b = ctx.mem.read_u8(b_ptr.wrapping_add(i))?;
        compared = i + 1;
        if a != b {
            result = a as i32 - b as i32;
            break;
        }
    }
    // The walk is priced like a write of the same size: `n` is
    // guest-chosen and the whole mapped space is reachable.
    ctx.mem.note_bulk_read(compared * 2);
    write_int(ctx, result);
    Ok(HostOutcome::Continue)
}

/// strncmp(a, b, n) -> the difference of the first bytes that differ, or
/// 0 when the first `n` bytes (or both strings) match.
///
/// glibc hands back that DIFFERENCE, not a normalized -1/0/1: `strncmp`
/// on "a" and "z" answers -25 on the servers. The strcmp stub above
/// normalizes and predates this note; the sign is all C promises, so
/// both satisfy the contract while this one also matches the number a
/// student prints.
pub fn strncmp(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let a_ptr = ctx.regs.read_gpr(0, true);
    let b_ptr = ctx.regs.read_gpr(1, true);
    let n = ctx.regs.read_gpr(2, true);
    let mut result = 0i32;
    let mut compared = 0u64;
    for i in 0..n {
        let a = ctx.mem.read_u8(a_ptr.wrapping_add(i))?;
        let b = ctx.mem.read_u8(b_ptr.wrapping_add(i))?;
        compared = i + 1;
        if a != b {
            result = a as i32 - b as i32;
            break;
        }
        // Equal terminators end the comparison early -- neither string
        // has anything left for byte n-1 to disagree about.
        if a == 0 {
            break;
        }
    }
    // Priced like memcmp: the length is guest-chosen.
    ctx.mem.note_bulk_read(compared * 2);
    write_int(ctx, result);
    Ok(HostOutcome::Continue)
}

/// strncpy(dst, src, n) -> dst, with glibc's two sharp edges intact: a
/// source shorter than `n` leaves the rest of the destination filled
/// with NULs (not just one terminator), and a source at least `n` long
/// leaves the destination with NO terminator at all.
pub fn strncpy(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let dst = ctx.regs.read_gpr(0, true);
    let src = ctx.regs.read_gpr(1, true);
    let n = ctx.regs.read_gpr(2, true);
    let mut past_end = false;
    for i in 0..n {
        // Past the source's terminator nothing more is read: the source
        // may legitimately end one byte before an unmapped page.
        let b = if past_end {
            0
        } else {
            ctx.mem.read_u8(src.wrapping_add(i))?
        };
        if b == 0 {
            past_end = true;
        }
        ctx.mem.write_u8(dst.wrapping_add(i), b)?;
    }
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

/// strcat(dst, src) -> dst. Appends at the destination's terminator and
/// re-terminates; the caller owns the space, exactly as in C.
pub fn strcat(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let dst = ctx.regs.read_gpr(0, true);
    let src = ctx.regs.read_gpr(1, true);
    let existing = read_c_string(ctx.mem, dst, "strcat's destination")?;
    let bytes = read_c_string(ctx.mem, src, "strcat's source")?;
    let end = dst.wrapping_add(existing.len() as u64);
    for (i, b) in bytes.iter().enumerate() {
        ctx.mem.write_u8(end.wrapping_add(i as u64), *b)?;
    }
    ctx.mem.write_u8(end.wrapping_add(bytes.len() as u64), 0)?;
    ctx.regs.write_gpr(0, true, dst);
    Ok(HostOutcome::Continue)
}

/// strchr(s, c) -> a pointer to the first `c`, or NULL. The int is cut
/// down to a char first, and the terminator counts as part of the
/// string: `strchr(s, 0)` answers the address of the NUL, which is how
/// C finds the end of a string in one call.
pub fn strchr(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let s = ctx.regs.read_gpr(0, true);
    let needle = (ctx.regs.read_gpr(1, false) & 0xFF) as u8;
    let bytes = read_c_string(ctx.mem, s, "strchr")?;
    let found = match bytes.iter().position(|b| *b == needle) {
        Some(i) => s.wrapping_add(i as u64),
        None if needle == 0 => s.wrapping_add(bytes.len() as u64),
        None => 0,
    };
    ctx.regs.write_gpr(0, true, found);
    Ok(HostOutcome::Continue)
}

/// strstr(haystack, needle) -> a pointer to the first occurrence, or
/// NULL. An empty needle matches immediately and answers the haystack
/// itself, which is what C specifies and what glibc does.
pub fn strstr(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let hay_ptr = ctx.regs.read_gpr(0, true);
    let needle_ptr = ctx.regs.read_gpr(1, true);
    let hay = read_c_string(ctx.mem, hay_ptr, "strstr's haystack")?;
    let needle = read_c_string(ctx.mem, needle_ptr, "strstr's needle")?;
    let at = if needle.is_empty() {
        Some(0)
    } else {
        hay.windows(needle.len()).position(|w| w == needle.as_slice())
    };
    let found = match at {
        Some(i) => hay_ptr.wrapping_add(i as u64),
        None => 0,
    };
    ctx.regs.write_gpr(0, true, found);
    Ok(HostOutcome::Continue)
}

/// Return an `int` the way the ABI does: sign-extended through x0, so a
/// `%d` print and a `cmp w0` read the same value.
fn write_int(ctx: &mut HostContext<'_>, value: i32) {
    ctx.regs.write_gpr(0, true, value as i64 as u64);
}

pub fn exit(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let code = crate::hosted::exit_status(ctx.regs);
    Ok(HostOutcome::Exited(code))
}

/// usleep(w0 = microseconds) -> 0. Same pacing contract as the
/// nanosleep syscall: the CPU advances the virtual clock and credits
/// the sleep refunds, and a real-time runner waits it out.
pub fn usleep(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    // useconds_t is 32-bit.
    let us = ctx.regs.read_gpr(0, false);
    ctx.regs.write_gpr(0, true, 0);
    if us == 0 {
        return Ok(HostOutcome::Continue);
    }
    Ok(HostOutcome::Sleep(us * 1_000))
}

/// fflush(stream) -> 0. Emulator output is unbuffered, so there is
/// nothing to flush; the stub exists so the idiomatic fflush(0) before
/// a delay works instead of halting on an unknown call.
pub fn fflush(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    ctx.regs.write_gpr(0, true, 0);
    Ok(HostOutcome::Continue)
}

/// C `RAND_MAX` as glibc defines it: rand() draws land in
/// `0..=2147483647`, exactly the range course programs see on the
/// servers.
pub const RAND_MAX: i64 = 2_147_483_647;

/// glibc's rand(): the TYPE_3 additive-feedback generator, not an LCG.
/// State is a 31-word circular buffer with taps 3 words apart:
/// `r[i] = r[i-31] + r[i-3] (mod 2^32)`, output `r[i] >> 1`. Seeding
/// runs a 16807 Park-Miller LCG (Schrage's method) to fill the buffer,
/// then discards 310 outputs. Reproducing it exactly is the point:
/// an unseeded course program prints the same numbers here as on the
/// servers, so students can diff against sample runs.
///
/// `entropy` is the separate 64-bit word the getrandom syscall draws
/// from -- kept apart so reseeding rand never shifts a raw-mode game's
/// food placement, and vice versa. The whole struct is `Copy` and rides
/// in every snapshot, so step-back replays draws.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RandState {
    r: [u32; 31],
    f: usize,
    rp: usize,
    pub entropy: u64,
}

impl RandState {
    /// glibc srand: a zero seed behaves as srand(1).
    pub fn seed(seed: u32) -> Self {
        let seed = if seed == 0 { 1 } else { seed };
        let mut r = [0u32; 31];
        r[0] = seed;
        let mut word = seed as i32;
        for slot in r.iter_mut().skip(1) {
            // Schrage's method for 16807 * word mod 2^31-1 without
            // overflowing i32; Rust's / and % truncate toward zero like
            // C, so a seed at or above 2^31 follows glibc bit for bit.
            let hi = (word as i64) / 127_773;
            let lo = (word as i64) % 127_773;
            let mut x = 16_807 * lo - 2_836 * hi;
            if x < 0 {
                x += 2_147_483_647;
            }
            word = x as i32;
            *slot = word as u32;
        }
        let mut state = RandState { r, f: 3, rp: 0, entropy: 1 };
        for _ in 0..310 {
            state.next_u32();
        }
        state
    }

    /// One draw: the additive recurrence, output shifted down a bit so
    /// the low bit's short cycle never reaches the caller.
    pub fn next_u32(&mut self) -> u32 {
        let v = self.r[self.f].wrapping_add(self.r[self.rp]);
        self.r[self.f] = v;
        self.f = (self.f + 1) % 31;
        self.rp = (self.rp + 1) % 31;
        v >> 1
    }
}

impl Default for RandState {
    /// C's unseeded rand behaves as srand(1).
    fn default() -> Self {
        Self::seed(1)
    }
}

/// The timestamp `time` reports. A browser emulator has no reason to
/// leak wall-clock time, and a fixed value makes the classic
/// `srand(time(0))` seeding produce the same run every time -- which is
/// what a student stepping backward and forward through a program needs.
/// Only stability matters, not the date it decodes to.
pub const FIXED_TIME: u64 = 355_000_000;

pub fn rand(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let value = ctx.rand_state.next_u32() as u64;
    ctx.regs.write_gpr(0, true, value);
    Ok(HostOutcome::Continue)
}

pub fn srand(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    // C takes an unsigned int seed in w0. The getrandom entropy word
    // survives the reseed on purpose -- the two streams are unrelated.
    let entropy = ctx.rand_state.entropy;
    *ctx.rand_state = RandState::seed(ctx.regs.read_gpr(0, false) as u32);
    ctx.rand_state.entropy = entropy;
    Ok(HostOutcome::Continue)
}

pub fn time(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    // time(time_t *tloc): returns the timestamp, and stores it through
    // the pointer too when one is given.
    let tloc = ctx.regs.read_gpr(0, true);
    if tloc != 0 {
        ctx.mem.write_u64(tloc, FIXED_TIME)?;
    }
    ctx.regs.write_gpr(0, true, FIXED_TIME);
    Ok(HostOutcome::Continue)
}

/// Sentinel stub the loader stashes in `LR` before calling `main`. A
/// program that returns out of `main` lands here and we halt with the
/// caller's return value (the ARM64 AAPCS64 convention puts it in `w0`).
pub fn main_return(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    // Only the low 32 bits of x0 are meaningful as an exit code when
    // `int main()` returns.
    let code = crate::hosted::exit_status(ctx.regs);
    Ok(HostOutcome::Exited(code))
}

pub fn atoi(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let ptr = ctx.regs.read_gpr(0, true);
    let bytes = read_c_string(ctx.mem, ptr, "atoi")?;
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
    let bytes = read_c_string(ctx.mem, ptr, "atof")?;
    let s = String::from_utf8_lossy(&bytes);
    // C's atof skips leading whitespace, parses the longest strtod-shaped
    // prefix, and returns 0.0 when nothing parses -- trailing junk never
    // errors. Scan the grammar over bytes: slicing at `char_indices() + 1`
    // panicked mid-character on any non-ASCII byte (a pasted degree sign
    // or accented letter), which in wasm killed the whole instance.
    let trimmed = s.trim_start();
    let bytes = trimmed.as_bytes();
    let mut end = 0;
    if end < bytes.len() && (bytes[end] == b'-' || bytes[end] == b'+') {
        end += 1;
    }
    let mut seen_digit = false;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
        seen_digit = true;
    }
    if end < bytes.len() && bytes[end] == b'.' {
        end += 1;
        while end < bytes.len() && bytes[end].is_ascii_digit() {
            end += 1;
            seen_digit = true;
        }
    }
    if seen_digit && end < bytes.len() && (bytes[end] == b'e' || bytes[end] == b'E') {
        let before_exp = end;
        end += 1;
        if end < bytes.len() && (bytes[end] == b'-' || bytes[end] == b'+') {
            end += 1;
        }
        let exp_start = end;
        while end < bytes.len() && bytes[end].is_ascii_digit() {
            end += 1;
        }
        if end == exp_start {
            end = before_exp;
        }
    }
    let value = if seen_digit {
        trimmed[..end].parse::<f64>().unwrap_or(0.0)
    } else {
        0.0
    };
    ctx.regs.write_fpr_f64(0, value);
    Ok(HostOutcome::Continue)
}

/// abs(w0) -> |w0| as an int. INT_MIN has no positive counterpart, so it
/// comes back as itself, the wrap glibc and the hardware both produce.
pub fn abs(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let value = ctx.regs.read_gpr(0, false) as u32 as i32;
    ctx.regs.write_gpr(0, true, value.wrapping_abs() as i64 as u64);
    Ok(HostOutcome::Continue)
}

/// labs(x0) -> |x0| as a long, LONG_MIN wrapping to itself like abs.
pub fn labs(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let value = ctx.regs.read_gpr(0, true) as i64;
    ctx.regs.write_gpr(0, true, value.wrapping_abs() as u64);
    Ok(HostOutcome::Continue)
}

/// C's isspace in the default locale, byte-level: space, \t, \n, \v, \f,
/// \r. Same rule scanf parses tokens by; Rust's Unicode whitespace would
/// split a pasted NBSP mid-character.
fn is_c_space(b: u8) -> bool {
    b.is_ascii_whitespace() || b == 0x0B
}

/// strtol(nptr, endptr, base) -> the converted long.
/// Leading whitespace and an optional sign are skipped, base 0 infers
/// the base from the prefix, and `endptr` (when it is not NULL) is left
/// pointing at the first character the conversion did not use -- back at
/// `nptr` itself when nothing converted, which is how C code detects
/// "that was not a number".
pub fn strtol(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let nptr = ctx.regs.read_gpr(0, true);
    let endptr = ctx.regs.read_gpr(1, true);
    let base = ctx.regs.read_gpr(2, false) as u32 as i32;
    let bytes = read_c_string(ctx.mem, nptr, "strtol's string")?;
    let (value, consumed) = parse_strtol(&bytes, base);
    if endptr != 0 {
        ctx.mem.write_u64(endptr, nptr.wrapping_add(consumed as u64))?;
    }
    ctx.regs.write_gpr(0, true, value as u64);
    Ok(HostOutcome::Continue)
}

/// The strtol grammar, returning the value and how many bytes it used.
/// A value too big for a long clamps to LONG_MAX / LONG_MIN, which is
/// what glibc returns alongside ERANGE (nothing here models errno, and
/// the clamped value is the part course code reads).
fn parse_strtol(bytes: &[u8], base: i32) -> (i64, usize) {
    // An impossible base converts nothing at all, EINVAL in glibc.
    if base != 0 && !(2..=36).contains(&base) {
        return (0, 0);
    }
    let mut i = 0;
    while i < bytes.len() && is_c_space(bytes[i]) {
        i += 1;
    }
    let negative = match bytes.get(i) {
        Some(b'-') => {
            i += 1;
            true
        }
        Some(b'+') => {
            i += 1;
            false
        }
        _ => false,
    };
    // The 0x prefix counts only when a hex digit actually follows it:
    // "0x" alone converts the bare zero and leaves endptr on the 'x',
    // exactly as glibc does.
    let hex_prefix = bytes.get(i) == Some(&b'0')
        && matches!(bytes.get(i + 1), Some(b'x') | Some(b'X'))
        && bytes.get(i + 2).is_some_and(u8::is_ascii_hexdigit);
    let base = match base {
        0 if hex_prefix => {
            i += 2;
            16
        }
        // A leading zero with no 'x' is octal, and that zero is itself
        // the first octal digit.
        0 if bytes.get(i) == Some(&b'0') => 8,
        0 => 10,
        16 if hex_prefix => {
            i += 2;
            16
        }
        other => other as u32,
    };
    let limit = if negative { 1u64 << 63 } else { i64::MAX as u64 };
    let mut magnitude = 0u64;
    let mut overflowed = false;
    let mut digits = 0;
    while let Some(d) = bytes.get(i).and_then(|b| digit_value(*b, base)) {
        magnitude = magnitude
            .saturating_mul(base as u64)
            .saturating_add(d as u64);
        if magnitude > limit {
            overflowed = true;
        }
        digits += 1;
        i += 1;
    }
    if digits == 0 {
        // No conversion: the value is 0 and endptr goes back to the very
        // start, whitespace and sign included.
        return (0, 0);
    }
    let value = if overflowed {
        if negative {
            i64::MIN
        } else {
            i64::MAX
        }
    } else if negative {
        // A magnitude of exactly 2^63 negates to LONG_MIN.
        (magnitude as i64).wrapping_neg()
    } else {
        magnitude as i64
    };
    (value, i)
}

/// The value of one digit in `base`, or None when the byte is not one.
fn digit_value(b: u8, base: u32) -> Option<u32> {
    let value = match b {
        b'0'..=b'9' => (b - b'0') as u32,
        b'a'..=b'z' => (b - b'a') as u32 + 10,
        b'A'..=b'Z' => (b - b'A') as u32 + 10,
        _ => return None,
    };
    (value < base).then_some(value)
}

/// strtok(s, delim) -> the next token, or NULL when the string is spent.
/// glibc's exact walk: leading delimiters are skipped, the delimiter
/// that ends the token is overwritten with a NUL, and the cursor for the
/// next `strtok(NULL, ...)` is parked just past it. Once the string runs
/// out the cursor sits on the terminator, so every further call keeps
/// answering NULL.
pub fn strtok(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let arg = ctx.regs.read_gpr(0, true);
    let delim_ptr = ctx.regs.read_gpr(1, true);
    let delims = read_c_string(ctx.mem, delim_ptr, "strtok's delimiters")?;
    // A NULL first argument means "continue"; glibc reads its static
    // cursor, and a program that continues before it ever started reads
    // through NULL and dies. Reading address 0 faults here the same way.
    let mut cursor = if arg != 0 { arg } else { *ctx.strtok_save };
    loop {
        let b = ctx.mem.read_u8(cursor)?;
        if b == 0 {
            *ctx.strtok_save = cursor;
            ctx.regs.write_gpr(0, true, 0);
            return Ok(HostOutcome::Continue);
        }
        if !delims.contains(&b) {
            break;
        }
        cursor = cursor.wrapping_add(1);
    }
    let start = cursor;
    loop {
        let b = ctx.mem.read_u8(cursor)?;
        if b == 0 {
            // The last token ends at the string's own terminator; the
            // cursor stays on it so the next call reports exhaustion.
            *ctx.strtok_save = cursor;
            break;
        }
        if delims.contains(&b) {
            ctx.mem.write_u8(cursor, 0)?;
            *ctx.strtok_save = cursor.wrapping_add(1);
            break;
        }
        cursor = cursor.wrapping_add(1);
    }
    ctx.regs.write_gpr(0, true, start);
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
        rand_state: RandState,
        term: crate::cpu::TermState,
        heap: crate::hosted::heap::HeapState,
        strtok_save: u64,
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
                rand_state: RandState::default(),
                term: crate::cpu::TermState::default(),
                heap: crate::hosted::heap::HeapState::default(),
                strtok_save: 0,
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
                term: &mut self.term,
                heap: &mut self.heap,
                strtok_save: &mut self.strtok_save,
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
    fn exit_reads_a_signed_int_like_main_return() {
        // mov w0, #-1 leaves x0 = 0x00000000FFFFFFFF; exit(int) must see
        // -1, the same value `return -1` from main reports.
        let mut h = Host::new();
        h.regs.write_gpr(0, false, 0xFFFF_FFFF);
        let out = exit(&mut h.ctx()).unwrap();
        assert_eq!(out, HostOutcome::Exited(-1));
        let out = main_return(&mut h.ctx()).unwrap();
        assert_eq!(out, HostOutcome::Exited(-1));
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
        let copied = read_c_string(&h.mem, 0x0050_0000, "test").unwrap();
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
    fn a_buffer_walk_off_the_top_of_memory_stays_defined() {
        // The guest picks the pointer AND the length, so a buffer that
        // runs off the end of the address space is reachable from ordinary
        // source. `dst + i` panicked the whole instance in a debug build
        // and wrapped silently in release; the walk wraps by contract now,
        // and the memory layer treats the wrapped address like any other.
        let mut h = Host::new();
        let top = u64::MAX - 3;
        h.regs.write_gpr(0, true, top);
        h.regs.write_gpr(1, true, 0xAB);
        h.regs.write_gpr(2, true, 8);
        memset(&mut h.ctx()).unwrap();
        assert_eq!(h.mem.read_u8(u64::MAX).unwrap(), 0xAB);
        assert_eq!(h.mem.read_u8(0).unwrap(), 0xAB);

        // memcpy walks two guest pointers; strcpy walks one plus a length
        // the string itself decides.
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, top);
        h.regs.write_gpr(2, true, 8);
        memcpy(&mut h.ctx()).unwrap();
        assert_eq!(h.mem.read_u8(0x0060_0003).unwrap(), 0xAB);

        h.place_string(0x0050_0000, b"abc");
        h.regs.write_gpr(0, true, u64::MAX - 1);
        h.regs.write_gpr(1, true, 0x0050_0000);
        strcpy(&mut h.ctx()).unwrap();
        assert_eq!(h.mem.read_u8(u64::MAX).unwrap(), b'b');
        assert_eq!(h.mem.read_u8(1).unwrap(), 0);
    }

    #[test]
    fn strncmp_stops_at_n_and_reports_the_byte_difference() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"apple");
        h.place_string(0x0050_0010, b"apricot");
        // "ap" is common to both, so a compare bounded there says equal.
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0010);
        h.regs.write_gpr(2, true, 2);
        strncmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 0);
        // One byte further, 'p' - 'r' is the value glibc hands back, not -1.
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0010);
        h.regs.write_gpr(2, true, 5);
        strncmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, b'p' as i64 - b'r' as i64);
        // A shorter string loses to its own terminator.
        h.place_string(0x0050_0020, b"app");
        h.regs.write_gpr(0, true, 0x0050_0020);
        h.regs.write_gpr(1, true, 0x0050_0000);
        h.regs.write_gpr(2, true, 10);
        strncmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 0 - b'l' as i64);
    }

    #[test]
    fn strncmp_never_reads_past_the_limit() {
        // Two buffers that fill their page to the last byte with no
        // terminator: a compare bounded at n must not walk into the
        // unmapped page after them.
        let mut h = Host::new();
        for i in 0..4u64 {
            h.mem.write_u8(0x0060_0FFC + i, b'z').unwrap();
            h.mem.write_u8(0x0050_0FFC + i, b'z').unwrap();
        }
        h.regs.write_gpr(0, true, 0x0060_0FFC);
        h.regs.write_gpr(1, true, 0x0050_0FFC);
        h.regs.write_gpr(2, true, 4);
        strncmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 0);
    }

    #[test]
    fn strncpy_pads_with_nuls_and_omits_the_terminator_when_full() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"hi");
        // Short source: the rest of the field is zero-filled, not left
        // as it was.
        for i in 0..6 {
            h.mem.write_u8(0x0060_0000 + i, b'X').unwrap();
        }
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, 0x0050_0000);
        h.regs.write_gpr(2, true, 6);
        strncpy(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0x0060_0000);
        let field: Vec<u8> = (0..6).map(|i| h.mem.read_u8(0x0060_0000 + i).unwrap()).collect();
        assert_eq!(field, b"hi\0\0\0\0");

        // Source at least n long: exactly n bytes and NO terminator.
        h.place_string(0x0050_0010, b"abcdef");
        h.mem.write_u8(0x0060_0100 + 3, b'!').unwrap();
        h.regs.write_gpr(0, true, 0x0060_0100);
        h.regs.write_gpr(1, true, 0x0050_0010);
        h.regs.write_gpr(2, true, 3);
        strncpy(&mut h.ctx()).unwrap();
        let field: Vec<u8> = (0..4).map(|i| h.mem.read_u8(0x0060_0100 + i).unwrap()).collect();
        assert_eq!(field, b"abc!");
    }

    #[test]
    fn strcat_appends_at_the_terminator() {
        let mut h = Host::new();
        h.place_string(0x0060_0000, b"log: ");
        h.place_string(0x0050_0000, b"done");
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, 0x0050_0000);
        strcat(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0x0060_0000);
        assert_eq!(read_c_string(&h.mem, 0x0060_0000, "test").unwrap(), b"log: done");
    }

    #[test]
    fn strchr_finds_bytes_the_terminator_included() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"a,b");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, b',' as u64);
        strchr(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0x0050_0001);
        // Absent byte: NULL.
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, b'z' as u64);
        strchr(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0);
        // Searching for 0 answers the terminator's own address.
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0);
        strchr(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0x0050_0003);
    }

    #[test]
    fn strstr_matches_substrings_and_the_empty_needle() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"the answer is 42");
        h.place_string(0x0050_0020, b"answer");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0020);
        strstr(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0x0050_0004);
        // An empty needle matches at once, at the haystack itself.
        h.place_string(0x0050_0030, b"");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0030);
        strstr(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0x0050_0000);
        // A needle longer than the haystack cannot match.
        h.place_string(0x0050_0040, b"the answer is 42 exactly");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0x0050_0040);
        strstr(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0);
    }

    #[test]
    fn memcmp_compares_raw_bytes_including_zeros() {
        let mut h = Host::new();
        for i in 0..4u64 {
            h.mem.write_u8(0x0060_0000 + i, 0).unwrap();
            h.mem.write_u8(0x0060_0010 + i, 0).unwrap();
        }
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, 0x0060_0010);
        h.regs.write_gpr(2, true, 4);
        memcmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 0);
        // A difference after an embedded NUL still counts, which is the
        // whole reason memcmp is not strcmp.
        h.mem.write_u8(0x0060_0013, 9).unwrap();
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, 0x0060_0010);
        h.regs.write_gpr(2, true, 4);
        memcmp(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -9);
    }

    #[test]
    fn memmove_survives_overlap_in_both_directions() {
        let mut h = Host::new();
        let load = |h: &mut Host| {
            for i in 0..6u64 {
                h.mem.write_u8(0x0060_0000 + i, (i + 1) as u8).unwrap();
            }
        };
        let field = |h: &Host| -> Vec<u8> {
            (0..8).map(|i| h.mem.read_u8(0x0060_0000 + i).unwrap()).collect()
        };
        // Shift up: a forward copy would smear byte 1 across the range.
        load(&mut h);
        h.regs.write_gpr(0, true, 0x0060_0002);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 6);
        memmove(&mut h.ctx()).unwrap();
        assert_eq!(field(&h), vec![1, 2, 1, 2, 3, 4, 5, 6]);
        // Shift down: the same hazard with the walk reversed.
        load(&mut h);
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, 0x0060_0002);
        h.regs.write_gpr(2, true, 4);
        memmove(&mut h.ctx()).unwrap();
        assert_eq!(field(&h)[..4], [3, 4, 5, 6]);
        assert_eq!(h.regs.read_gpr(0, true), 0x0060_0000);
    }

    #[test]
    fn abs_and_labs_wrap_at_the_minimum_like_glibc() {
        let mut h = Host::new();
        h.regs.write_gpr(0, false, (-7i32) as u32 as u64);
        abs(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 7);
        h.regs.write_gpr(0, false, i32::MIN as u32 as u64);
        abs(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, i32::MIN as i64);

        h.regs.write_gpr(0, true, (-9_000_000_000i64) as u64);
        labs(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 9_000_000_000);
        h.regs.write_gpr(0, true, i64::MIN as u64);
        labs(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, i64::MIN);
    }

    #[test]
    fn strtol_infers_the_base_and_reports_where_it_stopped() {
        let cases: &[(&[u8], i32, i64, u64)] = &[
            // text, base, value, bytes consumed
            (b"  -0x1f rest", 0, -31, 7),
            (b"0755", 0, 493, 4),
            (b"0", 0, 0, 1),
            (b"+42abc", 0, 42, 3),
            (b"ff", 16, 255, 2),
            (b"0xFF", 16, 255, 4),
            (b"1011", 2, 11, 4),
            (b"zz", 36, 1295, 2),
            // A 0x with no hex digit converts the bare zero and leaves
            // endptr on the x.
            (b"0x", 0, 0, 1),
            (b"0xg", 16, 0, 1),
            // Nothing convertible: endptr goes back to the start.
            (b"   abc", 0, 0, 0),
            (b"", 10, 0, 0),
            // An impossible base converts nothing at all.
            (b"10", 1, 0, 0),
            (b"10", 37, 0, 0),
        ];
        for (text, base, value, consumed) in cases {
            let mut h = Host::new();
            h.place_string(0x0050_0000, text);
            h.regs.write_gpr(0, true, 0x0050_0000);
            h.regs.write_gpr(1, true, 0x0060_0000);
            h.regs.write_gpr(2, false, *base as u32 as u64);
            strtol(&mut h.ctx()).unwrap();
            let text = String::from_utf8_lossy(text).into_owned();
            assert_eq!(h.regs.read_gpr(0, true) as i64, *value, "value of {text:?}");
            assert_eq!(
                h.mem.read_u64(0x0060_0000).unwrap(),
                0x0050_0000 + consumed,
                "endptr for {text:?}"
            );
        }
    }

    #[test]
    fn strtol_clamps_out_of_range_values_and_tolerates_a_null_endptr() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"99999999999999999999");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0);
        h.regs.write_gpr(2, false, 10);
        strtol(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, i64::MAX);

        h.place_string(0x0050_0000, b"-99999999999999999999");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0);
        h.regs.write_gpr(2, false, 10);
        strtol(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, i64::MIN);

        // The exact edges are not overflow.
        h.place_string(0x0050_0000, b"-9223372036854775808");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0);
        h.regs.write_gpr(2, false, 10);
        strtol(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, i64::MIN);
        h.place_string(0x0050_0000, b"9223372036854775807");
        h.regs.write_gpr(0, true, 0x0050_0000);
        h.regs.write_gpr(1, true, 0);
        h.regs.write_gpr(2, false, 10);
        strtol(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, i64::MAX);
    }

    #[test]
    fn strtok_walks_delimiter_runs_and_then_stays_exhausted() {
        let mut h = Host::new();
        h.place_string(0x0060_0000, b" one,,two ; three ");
        h.place_string(0x0050_0000, b" ,;");
        let token = |h: &mut Host, first: bool| -> String {
            h.regs.write_gpr(0, true, if first { 0x0060_0000 } else { 0 });
            h.regs.write_gpr(1, true, 0x0050_0000);
            strtok(&mut h.ctx()).unwrap();
            let at = h.regs.read_gpr(0, true);
            if at == 0 {
                return String::new();
            }
            String::from_utf8_lossy(&read_c_string(&h.mem, at, "test").unwrap()).into_owned()
        };
        assert_eq!(token(&mut h, true), "one");
        assert_eq!(token(&mut h, false), "two");
        assert_eq!(token(&mut h, false), "three");
        // Exhausted, and it stays exhausted however often it is asked.
        assert_eq!(token(&mut h, false), "");
        assert_eq!(token(&mut h, false), "");
        // The cursor is saved on the terminator, glibc's parking spot.
        assert_eq!(h.mem.read_u8(h.strtok_save).unwrap(), 0);
    }

    #[test]
    fn strtok_of_delimiters_only_answers_null_immediately() {
        let mut h = Host::new();
        h.place_string(0x0060_0000, b",,,");
        h.place_string(0x0050_0000, b",");
        h.regs.write_gpr(0, true, 0x0060_0000);
        h.regs.write_gpr(1, true, 0x0050_0000);
        strtok(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0);
        // Nothing was cut: the string is untouched apart from the walk.
        assert_eq!(read_c_string(&h.mem, 0x0060_0000, "test").unwrap(), b",,,");
    }

    #[test]
    fn exit_returns_exited_outcome_with_code() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 7);
        let outcome = exit(&mut h.ctx()).unwrap();
        assert_eq!(outcome, HostOutcome::Exited(7));
    }

    #[test]
    fn rand_is_deterministic_and_in_range() {
        let mut h = Host::new();
        let mut first_run = Vec::new();
        for _ in 0..5 {
            rand(&mut h.ctx()).unwrap();
            let v = h.regs.read_gpr(0, true) as i64;
            assert!((0..=RAND_MAX).contains(&v), "rand out of range: {v}");
            first_run.push(v);
        }
        // Same seed, same sequence.
        let mut h2 = Host::new();
        for expected in &first_run {
            rand(&mut h2.ctx()).unwrap();
            assert_eq!(h2.regs.read_gpr(0, true) as i64, *expected);
        }
        // The draws are not all identical.
        assert!(first_run.windows(2).any(|w| w[0] != w[1]));
    }

    #[test]
    fn srand_reseeds_the_sequence() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 42);
        srand(&mut h.ctx()).unwrap();
        rand(&mut h.ctx()).unwrap();
        let seeded_first = h.regs.read_gpr(0, true);
        // Re-seeding with the same value replays the same draw.
        h.regs.write_gpr(0, true, 42);
        srand(&mut h.ctx()).unwrap();
        rand(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), seeded_first);
        // A different seed diverges.
        h.regs.write_gpr(0, true, 43);
        srand(&mut h.ctx()).unwrap();
        rand(&mut h.ctx()).unwrap();
        assert_ne!(h.regs.read_gpr(0, true), seeded_first);
    }

    #[test]
    fn unseeded_rand_matches_srand_one() {
        // C: rand() before any srand behaves as if srand(1) had run.
        let mut fresh = Host::new();
        rand(&mut fresh.ctx()).unwrap();
        let unseeded = fresh.regs.read_gpr(0, true);
        let mut seeded = Host::new();
        seeded.regs.write_gpr(0, true, 1);
        srand(&mut seeded.ctx()).unwrap();
        rand(&mut seeded.ctx()).unwrap();
        assert_eq!(seeded.regs.read_gpr(0, true), unseeded);
    }

    #[test]
    fn time_returns_fixed_stamp_and_stores_through_pointer() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 0); // time(0)
        time(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), FIXED_TIME);
        // With a pointer, the value also lands in memory.
        h.regs.write_gpr(0, true, 0x0060_0000);
        time(&mut h.ctx()).unwrap();
        assert_eq!(h.mem.read_u64(0x0060_0000).unwrap(), FIXED_TIME);
        assert_eq!(h.regs.read_gpr(0, true), FIXED_TIME);
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
    fn getchar_returns_eof_once_stdin_is_closed() {
        let mut h = Host::new();
        let mut ctx = h.ctx();
        ctx.stdin_closed = true;
        getchar(&mut ctx).unwrap();
        assert_eq!(ctx.regs.read_gpr(0, true) as i64, -1);
    }

    #[test]
    fn getchar_still_blocks_while_stdin_is_open() {
        let mut h = Host::new();
        assert_eq!(getchar(&mut h.ctx()).unwrap(), HostOutcome::NeedInput);
    }

    #[test]
    #[allow(clippy::approx_constant)] // 3.14 is the literal source text, not an approximation of pi
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

    #[test]
    fn atof_survives_non_ascii_bytes() {
        // Slicing at char_indices()+1 panicked inside a multi-byte char --
        // in wasm that killed the whole instance. A typed degree sign or
        // a raw 0x80 byte must parse the numeric prefix calmly.
        let mut h = Host::new();
        h.place_string(0x0050_0000, "3.5\u{b0}".as_bytes());
        h.regs.write_gpr(0, true, 0x0050_0000);
        atof(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_fpr_f64(0), 3.5);

        let mut h = Host::new();
        h.place_string(0x0050_0000, &[0x80, b'1']);
        h.regs.write_gpr(0, true, 0x0050_0000);
        atof(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_fpr_f64(0), 0.0);
    }

    #[test]
    fn atof_backs_a_dangling_exponent_off_to_the_mantissa() {
        let mut h = Host::new();
        h.place_string(0x0050_0000, b"1.5e");
        h.regs.write_gpr(0, true, 0x0050_0000);
        atof(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_fpr_f64(0), 1.5);
    }
}
