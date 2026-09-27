//! printf implementation. Double-precision floats and 64-bit ints cover
//! every format the corpus uses. Varargs follow AAPCS64:
//! - Integer/pointer args use the next general-purpose register (NGRN
//!   in the spec) starting at the first slot after the fixed parameters.
//!   For printf, `x0` holds the format string pointer, so vararg ints
//!   start at `x1` and run through `x7` before spilling.
//! - Double args use the next SIMD register (NDRN) `d0..d7`.
//! - Spilled args (NGRN > 7 or NDRN > 7) live on the stack starting at
//!   the SP at the call site, advancing 8 bytes per spilled arg. The
//!   stack offset is **shared** between integer and float spills, so a
//!   format like `"%d ... %f ..."` that exhausts both register files
//!   reads ints and doubles from the same NSAA cursor in source order.

use crate::errors::EmuError;
use crate::hosted::{HostContext, HostOutcome, VarargWalker};

pub fn printf(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fmt_ptr = ctx.regs.read_gpr(0, true);
    // x0 is the format string (fixed param), so vararg ints start at x1.
    let out = format_into(ctx, fmt_ptr, 1, "printf's format string")?;
    ctx.stdout.extend_from_slice(&out);
    ctx.regs.write_gpr(0, true, out.len() as u64);
    Ok(HostOutcome::Continue)
}

/// sprintf(buf, fmt, ...) -> the characters written, not counting the
/// terminator. x0 is the buffer and x1 the format, so the varargs start
/// at x2, the same shift fprintf makes for its stream. The buffer's
/// size is the caller's problem, exactly as in C.
pub fn sprintf(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let buf = ctx.regs.read_gpr(0, true);
    let fmt_ptr = ctx.regs.read_gpr(1, true);
    let out = format_into(ctx, fmt_ptr, 2, "sprintf's format string")?;
    write_c_string(ctx, buf, &out)?;
    ctx.regs.write_gpr(0, true, out.len() as u64);
    Ok(HostOutcome::Continue)
}

/// snprintf(buf, size, fmt, ...) -> the length the formatted string
/// WOULD have had. That return value is the whole point of the call: it
/// does not shrink to the truncated length, so `if (n >= size)` detects
/// the overflow. At most `size - 1` characters plus a terminator are
/// stored, and a size of 0 stores nothing at all (the buffer may be
/// NULL then, so it must not be touched).
pub fn snprintf(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let buf = ctx.regs.read_gpr(0, true);
    let size = ctx.regs.read_gpr(1, true);
    let fmt_ptr = ctx.regs.read_gpr(2, true);
    let out = format_into(ctx, fmt_ptr, 3, "snprintf's format string")?;
    if size > 0 {
        let keep = (out.len() as u64).min(size - 1) as usize;
        write_c_string(ctx, buf, &out[..keep])?;
    }
    ctx.regs.write_gpr(0, true, out.len() as u64);
    Ok(HostOutcome::Continue)
}

/// Store bytes plus a terminator at a guest address.
fn write_c_string(ctx: &mut HostContext<'_>, buf: u64, bytes: &[u8]) -> Result<(), EmuError> {
    for (i, b) in bytes.iter().enumerate() {
        ctx.mem.write_u8(buf.wrapping_add(i as u64), *b)?;
    }
    ctx.mem.write_u8(buf.wrapping_add(bytes.len() as u64), 0)
}

/// The printf engine with the destination left to the caller: read the
/// format at `fmt_ptr`, walk the varargs starting at GP register
/// `first_gp` (1 for printf, where x0 is the format; 2 for fprintf,
/// where x0 is the stream and x1 the format), and hand back the
/// formatted bytes.
/// `what` names the format string in fault messages.
pub(crate) fn format_into(
    ctx: &mut HostContext<'_>,
    fmt_ptr: u64,
    first_gp: u8,
    what: &str,
) -> Result<Vec<u8>, EmuError> {
    // Bytes, not text: glibc copies a format's bytes through untouched,
    // whether or not they spell UTF-8.
    let fmt = read_c_string(ctx.mem, fmt_ptr, what)?;

    // d0..d7 are all available for vararg doubles.
    let mut walker = VarargWalker { gp_idx: first_gp, fp_idx: 0, stack_off: 0 };
    let mut out: Vec<u8> = Vec::new();

    let mut i = 0;
    while i < fmt.len() {
        let c = fmt[i];
        i += 1;
        if c != b'%' {
            out.push(c);
            continue;
        }
        let spec = parse_spec(&fmt, &mut i, ctx, &mut walker);
        let Some(&conv) = fmt.get(i) else {
            // Trailing '%' with nothing after it; emit literally.
            out.push(b'%');
            break;
        };
        i += 1;
        format_conversion(&spec, conv, ctx, &mut walker, &mut out)?;
        // Per-call transient bound: MAX_FIELD_WIDTH clamps ONE conversion,
        // but a 64 KiB format stuffed with wide conversions could still
        // stage tens of megabytes here before the cumulative output wall
        // ever saw it. No real program prints a megabyte in one call.
        if out.len() > MAX_PRINTF_CALL_BYTES {
            return Err(EmuError::AssemblyError {
                line: 0,
                message: format!(
                    "printf produced over {} KiB in a single call and was stopped",
                    MAX_PRINTF_CALL_BYTES / 1024
                ),
            });
        }
    }

    Ok(out)
}

/// Read a null-terminated byte sequence from guest memory. `what` names the
/// operation for the student ("strlen", "printf %s", "the openat path"), so
/// an unterminated string is blamed on the call that read it, never on
/// printf by default.
pub fn read_c_string(
    mem: &crate::memory::Memory,
    addr: u64,
    what: &str,
) -> Result<Vec<u8>, EmuError> {
    // The cap keeps a runaway pointer from looping forever; it matches the
    // most one printf call may print.
    let out = read_c_prefix(mem, addr, MAX_PRINTF_CALL_BYTES)?;
    if out.len() < MAX_PRINTF_CALL_BYTES {
        return Ok(out);
    }
    Err(EmuError::RuntimeError {
        message: format!(
            "{what}: the string at 0x{addr:x} has no terminating zero byte \
             within 1 MiB. Declare strings with .asciz or .string (not \
             .ascii), and check nothing wrote over the terminator"
        ),
    })
}

/// Up to `max` bytes of the string at `addr`, stopping at its terminator.
/// `%.5s` may name an array with no terminator at all: C reads only the
/// bytes the precision allows.
fn read_c_prefix(mem: &crate::memory::Memory, addr: u64, max: usize) -> Result<Vec<u8>, EmuError> {
    let mut out = Vec::new();
    let mut a = addr;
    while out.len() < max {
        let b = mem.read_u8(a)?;
        if b == 0 {
            break;
        }
        out.push(b);
        a = a.wrapping_add(1);
    }
    Ok(out)
}

/// Upper bound on ONE printf call's total output. Checked per conversion in
/// the format loop; the cumulative `cpu::MAX_OUTPUT_BYTES` wall bounds the
/// program as a whole.
const MAX_PRINTF_CALL_BYTES: usize = 1024 * 1024;

/// Upper bound on a printf field width or precision. glibc prints any width
/// in full, and so does this up to what one call may print; one past that
/// makes the call stop with its message instead of being clamped into a
/// wrong answer, and keeps "%2000000000d" from building gigabytes first.
const MAX_FIELD_WIDTH: usize = MAX_PRINTF_CALL_BYTES + 1;

#[derive(Debug, Default, Clone)]
struct FormatSpec {
    left_align: bool,
    zero_pad: bool,
    plus: bool,
    space: bool,
    alt: bool,
    width: usize,
    precision: Option<usize>,
    long: bool,
    /// Count of `h` length modifiers: 1 is `short`, 2 or more is `char`.
    short: u8,
    /// `L`: a long double, which this runtime does not format.
    long_double: bool,
}

/// Read an integer argument at the width its length modifier names,
/// sign-extended. C promotes every short/char vararg to int, so the
/// register always holds 32 useful bits; `%hd` and `%hhd` then print the
/// value the C program would see after the truncation back down.
fn narrow_signed(raw: u64, spec: &FormatSpec) -> i64 {
    match spec.short {
        0 if spec.long => raw as i64,
        0 => raw as u32 as i32 as i64,
        1 => raw as u16 as i16 as i64,
        _ => raw as u8 as i8 as i64,
    }
}

/// Same, for the unsigned conversions (`%u %x %X %o`).
fn narrow_unsigned(raw: u64, spec: &FormatSpec) -> u64 {
    match spec.short {
        0 if spec.long => raw,
        0 => raw as u32 as u64,
        1 => raw as u16 as u64,
        _ => raw as u8 as u64,
    }
}

/// Walk one conversion's flags, width, precision and length modifier.
///
/// A `*` in the width or precision position takes its value from the
/// varargs, so this walks the same cursor the conversion itself will:
/// for `"%*d"` the width argument comes BEFORE the value, per C.
fn parse_spec(
    fmt: &[u8],
    i: &mut usize,
    ctx: &mut HostContext<'_>,
    walker: &mut VarargWalker,
) -> FormatSpec {
    let mut spec = FormatSpec::default();
    while let Some(&c) = fmt.get(*i) {
        match c {
            b'-' => spec.left_align = true,
            b'0' => spec.zero_pad = true,
            b'+' => spec.plus = true,
            b' ' => spec.space = true,
            b'#' => spec.alt = true,
            // Digit grouping, which the C locale has nothing to group with.
            b'\'' => {}
            _ => break,
        }
        *i += 1;
    }
    // `*` reads an int vararg; C says a negative one means the `-` flag
    // with the width's absolute value.
    if fmt.get(*i) == Some(&b'*') {
        *i += 1;
        let arg = walker.next_int(ctx) as u32 as i32;
        if arg < 0 {
            spec.left_align = true;
        }
        spec.width = (arg.unsigned_abs() as usize).min(MAX_FIELD_WIDTH);
    } else {
        spec.width = read_count(fmt, i);
    }
    // `.*` reads an int vararg too, where C defines a negative value as
    // no precision at all rather than a clamped zero.
    if fmt.get(*i) == Some(&b'.') {
        *i += 1;
        if fmt.get(*i) == Some(&b'*') {
            *i += 1;
            let arg = walker.next_int(ctx) as u32 as i32;
            spec.precision = usize::try_from(arg).ok().map(|p| p.min(MAX_FIELD_WIDTH));
        } else {
            spec.precision = Some(read_count(fmt, i));
        }
    }
    // Length modifier. The fetch slot is the same 64-bit register either
    // way, but the WIDTH read out of it must follow C: plain `%d` is an
    // int and consumes w-register bits only. z, j and t name 64-bit types
    // here, as l and ll do.
    while let Some(&c) = fmt.get(*i) {
        match c {
            b'l' | b'z' | b'j' | b't' => {
                spec.long = true;
                spec.short = 0;
            }
            b'h' => {
                spec.long = false;
                spec.short = spec.short.saturating_add(1);
            }
            b'L' => spec.long_double = true,
            _ => break,
        }
        *i += 1;
    }
    spec
}

/// A run of decimal digits in the format, capped like a `*` value.
fn read_count(fmt: &[u8], i: &mut usize) -> usize {
    let mut n = 0usize;
    while let Some(&d) = fmt.get(*i).filter(|c| c.is_ascii_digit()) {
        n = n.saturating_mul(10).saturating_add(usize::from(d - b'0')).min(MAX_FIELD_WIDTH);
        *i += 1;
    }
    n
}

fn format_conversion(
    spec: &FormatSpec,
    conv: u8,
    ctx: &mut HostContext<'_>,
    walker: &mut VarargWalker,
    out: &mut Vec<u8>,
) -> Result<(), EmuError> {
    // C ignores the `0` flag under a precision for the integer
    // conversions only, so `zero_ok` below says per conversion whether
    // it may pad with zeros at all.
    let int_zero_ok = spec.precision.is_none();
    match conv {
        b'%' => out.push(b'%'),
        b'd' | b'i' => {
            // Plain %d is C's int: only w-register bits, sign-extended.
            let value = narrow_signed(walker.next_int(ctx), spec);
            let digits = int_digits(value.unsigned_abs(), 10, false, spec.precision);
            emit_field(sign_of(value < 0, spec), digits.as_bytes(), spec, int_zero_ok, out);
        }
        b'u' | b'x' | b'X' | b'o' => {
            let value = narrow_unsigned(walker.next_int(ctx), spec);
            let base = match conv {
                b'o' => 8,
                b'u' => 10,
                _ => 16,
            };
            let mut digits = int_digits(value, base, conv == b'X', spec.precision);
            // `#` puts 0x before a nonzero hex value, and makes an octal
            // value start with 0 unless its precision already did.
            let prefix: &[u8] = match conv {
                b'x' if spec.alt && value != 0 => b"0x",
                b'X' if spec.alt && value != 0 => b"0X",
                _ => b"",
            };
            if conv == b'o' && spec.alt && !digits.starts_with('0') {
                digits.insert(0, '0');
            }
            emit_field(prefix, digits.as_bytes(), spec, int_zero_ok, out);
        }
        b'p' => {
            // glibc prints a NULL pointer as `(nil)`, not `0x0`.
            let value = walker.next_int(ctx);
            if value == 0 {
                emit_field(b"", b"(nil)", spec, false, out);
            } else {
                let digits = int_digits(value, 16, false, spec.precision);
                emit_field(b"0x", digits.as_bytes(), spec, int_zero_ok, out);
            }
        }
        b'c' => {
            let value = walker.next_int(ctx) as u8;
            emit_field(b"", &[value], spec, false, out);
        }
        b's' => {
            let ptr = walker.next_int(ctx);
            // C's %s precision is a maximum BYTE count, and the bytes go
            // out as they are, whether or not they spell UTF-8.
            let bytes = match spec.precision {
                Some(max) => read_c_prefix(ctx.mem, ptr, max),
                None => read_c_string(ctx.mem, ptr, "printf %s"),
            }
            .map_err(|e| match e {
                EmuError::MemoryFault { .. } => EmuError::RuntimeError {
                    message: format!(
                        "printf %s was handed the pointer 0x{ptr:x}, which does not \
                         point at readable memory. Check that the argument register \
                         holds a string address (ldr xN, =label)"
                    ),
                },
                other => other,
            })?;
            emit_field(b"", &bytes, spec, false, out);
        }
        b'f' | b'F' | b'e' | b'E' | b'g' | b'G' => {
            if spec.long_double {
                return Err(EmuError::RuntimeError {
                    message: format!(
                        "printf %L{} (a long double) is not supported by the \
                         playground; pass a double and print it with %{}",
                        conv as char, conv as char
                    ),
                });
            }
            let value = walker.next_double(ctx);
            let mut body = if value.is_nan() {
                "nan".to_string()
            } else if value.is_infinite() {
                "inf".to_string()
            } else {
                let magnitude = value.abs();
                let prec = spec.precision.unwrap_or(6);
                match conv.to_ascii_lowercase() {
                    b'f' => format_fixed(magnitude, prec, spec.alt),
                    b'e' => format_scientific(magnitude, prec, spec.alt),
                    // C: precision is SIGNIFICANT digits here, 0 reading as 1.
                    _ => format_general(magnitude, prec.max(1), spec.alt),
                }
            };
            if conv.is_ascii_uppercase() {
                body.make_ascii_uppercase();
            }
            // The sign bit decides the sign, so -0.0 and a negative NaN
            // print theirs; the 0 flag pads a number, never inf or nan.
            let sign = sign_of(value.is_sign_negative(), spec);
            emit_field(sign, body.as_bytes(), spec, value.is_finite(), out);
        }
        b'a' | b'A' => {
            // Real glibc formats hex floats. Echoing the specifier
            // literally also left its argument unconsumed, silently
            // shifting every later conversion of the same class, which is
            // worse than stopping.
            return Err(EmuError::RuntimeError {
                message: format!(
                    "printf %{} is not supported by this emulator; format the value with %f",
                    conv as char
                ),
            });
        }
        _ => {
            // Unknown conversion: emit '%' followed by the character
            // verbatim, matching glibc's handling of genuinely undefined
            // specifiers (no argument is consumed there either).
            out.push(b'%');
            out.push(conv);
        }
    }
    Ok(())
}

/// The sign a signed conversion prints: `-`, or what `+` or ` ` asks for.
fn sign_of(negative: bool, spec: &FormatSpec) -> &'static [u8] {
    if negative {
        b"-"
    } else if spec.plus {
        b"+"
    } else if spec.space {
        b" "
    } else {
        b""
    }
}

/// The digits of `value` in `base`, at least `precision` of them. C's one
/// odd case: zero with a precision of 0 prints no digits at all.
fn int_digits(value: u64, base: u32, upper: bool, precision: Option<usize>) -> String {
    let mut digits = match (value, base) {
        (0, _) if precision == Some(0) => String::new(),
        (_, 8) => format!("{value:o}"),
        (_, 10) => format!("{value}"),
        _ if upper => format!("{value:X}"),
        _ => format!("{value:x}"),
    };
    if let Some(wanted) = precision.filter(|&p| p > digits.len()) {
        digits.insert_str(0, &"0".repeat(wanted - digits.len()));
    }
    digits
}

/// Past this many places a double's decimal expansion is exact and every
/// further digit is 0. Rust's formatter refuses a precision over 65535.
const EXACT_PLACES: usize = 1100;

/// `%f` of a non-negative finite value. `#` keeps the point even with no
/// digits after it.
fn format_fixed(value: f64, precision: usize, alt: bool) -> String {
    let exact = precision.min(EXACT_PLACES);
    let mut body = format!("{value:.exact$}");
    body.extend(std::iter::repeat_n('0', precision - exact));
    if alt && precision == 0 {
        body.push('.');
    }
    body
}

/// `%e`: d.dddddde+XX with glibc's shape (a signed exponent of at least
/// two digits). Rust renders the correctly rounded mantissa but a bare
/// exponent ("2.500000e0"), so the exponent is reshaped.
fn format_scientific(value: f64, precision: usize, alt: bool) -> String {
    let exact = precision.min(EXACT_PLACES);
    let raw = format!("{value:.exact$e}");
    let (digits, exp) = raw.split_once('e').expect("float scientific form");
    let mantissa: String = digits.chars().chain(std::iter::repeat_n('0', precision - exact)).collect();
    let (exp_sign, exp_abs) = match exp.strip_prefix('-') {
        Some(rest) => ('-', rest),
        None => ('+', exp),
    };
    let point = if alt && precision == 0 { "." } else { "" };
    format!("{mantissa}{point}e{exp_sign}{exp_abs:0>2}")
}

/// `%g`: C's rule. With P significant digits, use `%e` when the exponent
/// is below -4 or at least P, else `%f`; then strip trailing zeros (and a
/// bare trailing point) unless `#` asked to keep them.
fn format_general(value: f64, sig: usize, alt: bool) -> String {
    let exponent = |text: String| -> i32 {
        text.split_once('e').expect("float scientific form").1.parse().expect("exponent parses")
    };
    let exp = exponent(format!("{:.*e}", (sig - 1).min(EXACT_PLACES), value));
    // glibc picks the form from the exponent BEFORE rounding. When rounding
    // then carries into a new digit (999.5 at %#.3g), it prints the
    // exponent form with the %f fraction length it had planned, which is
    // zero: "1.e+03". Eighteen digits never carry, so they give the
    // exponent before rounding.
    let carried = exp == sig as i32 && exponent(format!("{value:.17e}")) == exp - 1;
    let mut body = if alt && carried {
        format_scientific(value, 0, true)
    } else if exp < -4 || exp >= sig as i32 {
        format_scientific(value, sig - 1, alt)
    } else {
        format_fixed(value, (sig as i32 - 1 - exp) as usize, alt)
    };
    let mantissa_end = body.find('e').unwrap_or(body.len());
    if !alt && body[..mantissa_end].contains('.') {
        let trimmed = body[..mantissa_end]
            .trim_end_matches('0')
            .trim_end_matches('.')
            .len();
        body.replace_range(trimmed..mantissa_end, "");
    }
    body
}

/// Lay out one conversion in its field: `prefix` (a sign or 0x) goes
/// before any zero padding and `body` after it. The width pads with
/// spaces unless the 0 flag applies to this conversion (`zero_ok`) and
/// `-` has not asked for the padding on the right.
fn emit_field(prefix: &[u8], body: &[u8], spec: &FormatSpec, zero_ok: bool, out: &mut Vec<u8>) {
    let pad = spec.width.saturating_sub(prefix.len() + body.len());
    if spec.left_align {
        out.extend_from_slice(prefix);
        out.extend_from_slice(body);
        out.resize(out.len() + pad, b' ');
    } else if spec.zero_pad && zero_ok {
        out.extend_from_slice(prefix);
        out.resize(out.len() + pad, b'0');
        out.extend_from_slice(body);
    } else {
        out.resize(out.len() + pad, b' ');
        out.extend_from_slice(prefix);
        out.extend_from_slice(body);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cpu::OpenFile;
    use crate::memory::Memory;
    use crate::registers::RegisterFile;
    use std::collections::HashMap;

    fn call(fmt: &str, setup: impl FnOnce(&mut RegisterFile, &mut Memory)) -> (String, usize) {
        try_call(fmt, setup).expect("printf should succeed")
    }

    fn try_call(
        fmt: &str,
        setup: impl FnOnce(&mut RegisterFile, &mut Memory),
    ) -> Result<(String, usize), EmuError> {
        let mut regs = RegisterFile::new();
        let mut mem = Memory::new();
        let fmt_addr = 0x0050_0000u64;
        mem.map_page(fmt_addr);
        let fmt_bytes = fmt.as_bytes();
        for (i, b) in fmt_bytes.iter().enumerate() {
            mem.write_u8(fmt_addr + i as u64, *b).unwrap();
        }
        mem.write_u8(fmt_addr + fmt_bytes.len() as u64, 0).unwrap();
        regs.write_gpr(0, true, fmt_addr);
        setup(&mut regs, &mut mem);
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut stdin = Vec::new();
        let mut vfs: HashMap<String, Vec<u8>> = HashMap::new();
        let mut open_files: HashMap<u32, OpenFile> = HashMap::new();
        let mut next_fd = 3u32;
        let mut rand_state = crate::hosted::libc::RandState::default();
        let mut term = crate::cpu::TermState::default();
        let mut heap = crate::hosted::heap::HeapState::default();
        let mut strtok_save = 0u64;
        let mut ctx = HostContext {
            regs: &mut regs,
            mem: &mut mem,
            stdout: &mut stdout,
            stderr: &mut stderr,
            stdin: &mut stdin,
            stdin_closed: false,
            vfs: &mut vfs,
            open_files: &mut open_files,
            next_fd: &mut next_fd,
            rand_state: &mut rand_state,
            term: &mut term,
            heap: &mut heap,
            strtok_save: &mut strtok_save,
            callbacks: &mut Default::default(),
        };
        printf(&mut ctx)?;
        let written = ctx.regs.read_gpr(0, true) as usize;
        let s = String::from_utf8_lossy(&stdout).into_owned();
        Ok((s, written))
    }

    /// Scratch addresses for the buffer-writing stubs: the format string
    /// at one, the destination at the other.
    const FMT_ADDR: u64 = 0x0050_0000;
    const BUF_ADDR: u64 = 0x0060_0000;

    /// Run a stub that formats into guest memory. `setup` places every
    /// register the call takes (the buffer, the format, any varargs);
    /// the buffer is pre-filled with a marker byte so a test can see
    /// exactly how far the stub wrote. Hands back the first `read_back`
    /// bytes of the buffer and the stub's return value.
    fn call_into_buffer(
        stub: crate::hosted::HostFn,
        fmt: &str,
        read_back: usize,
        setup: impl FnOnce(&mut RegisterFile, &mut Memory),
    ) -> (Vec<u8>, u64) {
        let mut regs = RegisterFile::new();
        let mut mem = Memory::new();
        mem.map_page(FMT_ADDR);
        mem.map_page(BUF_ADDR);
        for (i, b) in fmt.as_bytes().iter().enumerate() {
            mem.write_u8(FMT_ADDR + i as u64, *b).unwrap();
        }
        mem.write_u8(FMT_ADDR + fmt.len() as u64, 0).unwrap();
        for i in 0..64u64 {
            mem.write_u8(BUF_ADDR + i, 0xEE).unwrap();
        }
        setup(&mut regs, &mut mem);
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut stdin = Vec::new();
        let mut vfs: HashMap<String, Vec<u8>> = HashMap::new();
        let mut open_files: HashMap<u32, OpenFile> = HashMap::new();
        let mut next_fd = 3u32;
        let mut rand_state = crate::hosted::libc::RandState::default();
        let mut term = crate::cpu::TermState::default();
        let mut heap = crate::hosted::heap::HeapState::default();
        let mut strtok_save = 0u64;
        let mut ctx = HostContext {
            regs: &mut regs,
            mem: &mut mem,
            stdout: &mut stdout,
            stderr: &mut stderr,
            stdin: &mut stdin,
            stdin_closed: false,
            vfs: &mut vfs,
            open_files: &mut open_files,
            next_fd: &mut next_fd,
            rand_state: &mut rand_state,
            term: &mut term,
            heap: &mut heap,
            strtok_save: &mut strtok_save,
            callbacks: &mut Default::default(),
        };
        stub(&mut ctx).unwrap();
        let returned = ctx.regs.read_gpr(0, true);
        let bytes = (0..read_back as u64)
            .map(|i| mem.read_u8(BUF_ADDR + i).unwrap())
            .collect();
        (bytes, returned)
    }

    #[test]
    fn sprintf_terminates_the_buffer_and_returns_the_length() {
        // x0 is the buffer and x1 the format, so the first vararg is x2.
        let (bytes, n) = call_into_buffer(sprintf, "%s=%d", 8, |regs, mem| {
            let text = 0x0050_0100u64;
            for (i, b) in b"hp".iter().enumerate() {
                mem.write_u8(text + i as u64, *b).unwrap();
            }
            mem.write_u8(text + 2, 0).unwrap();
            regs.write_gpr(0, true, BUF_ADDR);
            regs.write_gpr(1, true, FMT_ADDR);
            regs.write_gpr(2, true, text);
            regs.write_gpr(3, true, 42);
        });
        assert_eq!(n, 5);
        assert_eq!(&bytes[..6], b"hp=42\0");
        // Nothing past the terminator was touched.
        assert_eq!(bytes[6], 0xEE);
    }

    #[test]
    fn snprintf_truncates_but_returns_the_full_length() {
        // x0 buffer, x1 size, x2 format: the varargs start at x3.
        let call = |size: u64| {
            call_into_buffer(snprintf, "%d-%d", 10, move |regs, _| {
                regs.write_gpr(0, true, BUF_ADDR);
                regs.write_gpr(1, true, size);
                regs.write_gpr(2, true, FMT_ADDR);
                regs.write_gpr(3, true, 12);
                regs.write_gpr(4, true, 345);
            })
        };
        // Room to spare: the whole string plus its terminator.
        let (bytes, n) = call(16);
        assert_eq!(n, 6);
        assert_eq!(&bytes[..7], b"12-345\0");
        // Truncated: size - 1 characters, still terminated, and the
        // return value is the length it WOULD have needed.
        let (bytes, n) = call(4);
        assert_eq!(n, 6, "the return value must not shrink to the truncation");
        assert_eq!(&bytes[..4], b"12-\0");
        assert_eq!(bytes[4], 0xEE);
        // Size 0 writes nothing at all, not even a terminator.
        let (bytes, n) = call(0);
        assert_eq!(n, 6);
        assert_eq!(bytes[0], 0xEE);
    }

    #[test]
    fn plain_percent_d_reads_int_width_like_glibc() {
        // glibc's %d consumes an int: a `.word` loaded with `ldr w1` (or
        // even a 64-bit load that dragged neighbor bytes along) prints the
        // low 32 bits sign-extended, exactly like the course machine.
        let (s, _) = call("%d", |regs, _| {
            regs.write_gpr(1, true, 0x0000_0007_0000_0055);
        });
        assert_eq!(s, "85");
        let (s, _) = call("%d", |regs, _| {
            regs.write_gpr(1, true, 0x0000_0000_FFFF_FFFB);
        });
        assert_eq!(s, "-5");
        // %ld keeps the full register.
        let (s, _) = call("%ld", |regs, _| {
            regs.write_gpr(1, true, 0x0000_0007_0000_0055);
        });
        assert_eq!(s, "30064771157");
        let (s, _) = call("%x", |regs, _| {
            regs.write_gpr(1, true, u64::MAX);
        });
        assert_eq!(s, "ffffffff");
    }

    #[test]
    fn h_and_hh_truncate_the_way_glibc_does() {
        // 65541 is 0x10005: as a short it is 5, as a signed char it is 5,
        // as an int it stays 65541. A modifier loop that records only `l`
        // prints 65541 three times where aarch64 glibc prints "5 5 65541".
        let (s, _) = call("%hd %hhd %d", |regs, _| {
            regs.write_gpr(1, true, 65541);
            regs.write_gpr(2, true, 65541);
            regs.write_gpr(3, true, 65541);
        });
        assert_eq!(s, "5 5 65541");
        // Truncation happens before the sign is read: 0xFF80 is -128 as a
        // short, and 0x80 is -128 as a signed char.
        let (s, _) = call("%hd %hhd", |regs, _| {
            regs.write_gpr(1, true, 0xFF80);
            regs.write_gpr(2, true, 0x80);
        });
        assert_eq!(s, "-128 -128");
        // The unsigned conversions truncate without sign extension.
        let (s, _) = call("%hu %hhu %hx", |regs, _| {
            regs.write_gpr(1, true, 0x1_FF80);
            regs.write_gpr(2, true, 0x1_FF80);
            regs.write_gpr(3, true, 0xDEAD_BEEF);
        });
        assert_eq!(s, "65408 128 beef");
        // A later `l` still wins, as it does in the C library.
        let (s, _) = call("%hld", |regs, _| {
            regs.write_gpr(1, true, 0x0000_0007_0000_0055);
        });
        assert_eq!(s, "30064771157");
    }

    #[test]
    fn unimplemented_float_conversions_stop_with_a_remedy() {
        // Echoing an unimplemented specifier literally desynced later
        // float conversions; the student saw a plausible wrong number
        // with no message. %a is the one float form still unhosted.
        let err = try_call("%a", |_, _| {}).unwrap_err();
        assert!(err.to_string().contains("%f"), "was: {err}");
    }

    #[test]
    fn one_call_cannot_stage_megabytes() {
        // MAX_FIELD_WIDTH clamps one conversion; a 64 KiB format stuffed
        // with wide conversions stages ~45 MB in the transient buffer
        // before the cumulative wall sees it. The per-call bound must trip.
        let fmt = "%4096d".repeat(300);
        let err = try_call(&fmt, |_, _| {}).unwrap_err();
        assert!(
            err.to_string().contains("single call"),
            "error was: {err}"
        );
    }

    #[test]
    fn printf_literal_string() {
        let (s, n) = call("hello\n", |_, _| {});
        assert_eq!(s, "hello\n");
        assert_eq!(n, 6);
    }

    #[test]
    fn printf_percent_d() {
        let (s, _) = call("%d", |regs, _| {
            regs.write_gpr(1, true, 42);
        });
        assert_eq!(s, "42");
    }

    #[test]
    fn printf_percent_d_negative() {
        let (s, _) = call("%d", |regs, _| {
            regs.write_gpr(1, true, (-7i64) as u64);
        });
        assert_eq!(s, "-7");
    }

    #[test]
    fn printf_percent_u() {
        let (s, _) = call("%u", |regs, _| {
            regs.write_gpr(1, true, 4_000_000_000);
        });
        assert_eq!(s, "4000000000");
    }

    #[allow(non_snake_case)]
    #[test]
    fn printf_percent_x_and_X() {
        let (s1, _) = call("%x", |regs, _| {
            regs.write_gpr(1, true, 0xDEAD);
        });
        assert_eq!(s1, "dead");
        let (s2, _) = call("%X", |regs, _| {
            regs.write_gpr(1, true, 0xBEEF);
        });
        assert_eq!(s2, "BEEF");
    }

    #[test]
    fn printf_percent_s() {
        let (s, _) = call("%s", |regs, mem| {
            let str_addr = 0x0051_0000u64;
            mem.map_page(str_addr);
            for (i, b) in b"world".iter().enumerate() {
                mem.write_u8(str_addr + i as u64, *b).unwrap();
            }
            mem.write_u8(str_addr + 5, 0).unwrap();
            regs.write_gpr(1, true, str_addr);
        });
        assert_eq!(s, "world");
    }

    #[test]
    fn printf_percent_c() {
        let (s, _) = call("%c%c", |regs, _| {
            regs.write_gpr(1, true, b'H' as u64);
            regs.write_gpr(2, true, b'i' as u64);
        });
        assert_eq!(s, "Hi");
    }

    #[test]
    fn printf_percent_percent() {
        let (s, _) = call("100%%", |_, _| {});
        assert_eq!(s, "100%");
    }

    #[test]
    fn printf_width_right_aligned() {
        let (s, _) = call("%5d", |regs, _| {
            regs.write_gpr(1, true, 42);
        });
        assert_eq!(s, "   42");
    }

    #[test]
    fn printf_width_left_aligned() {
        let (s, _) = call("%-5d|", |regs, _| {
            regs.write_gpr(1, true, 42);
        });
        assert_eq!(s, "42   |");
    }

    #[test]
    fn printf_zero_padded() {
        let (s, _) = call("%05d", |regs, _| {
            regs.write_gpr(1, true, 7);
        });
        assert_eq!(s, "00007");
    }

    #[test]
    fn percent_c_honors_field_width() {
        // Verified against gcc/glibc: "%5c|" of 'x' is "    x|" and the
        // left-aligned form pads on the right.
        let (s, _) = call("%5c|", |regs, _| {
            regs.write_gpr(1, true, 'x' as u64);
        });
        assert_eq!(s, "    x|");
        let (s, _) = call("%-5c|", |regs, _| {
            regs.write_gpr(1, true, 'x' as u64);
        });
        assert_eq!(s, "x    |");
        // The 0 flag never zero-pads a character.
        let (s, _) = call("%05c|", |regs, _| {
            regs.write_gpr(1, true, 'x' as u64);
        });
        assert_eq!(s, "    x|");
    }

    #[test]
    fn zero_flag_with_precision_keeps_padding_floats_only() {
        // C drops the 0 flag under a precision for the integer conversions
        // but keeps it for %f. Expected strings verified against glibc.
        let (s, _) = call("%08.2f", |regs, _| {
            regs.write_fpr_f64(0, 3.5);
        });
        assert_eq!(s, "00003.50");
        let (s, _) = call("%08.3f", |regs, _| {
            regs.write_fpr_f64(0, -3.5);
        });
        assert_eq!(s, "-003.500");
        // The integer form stays space-padded (precision already
        // zero-extended the digits).
        let (s, _) = call("%05.3d", |regs, _| {
            regs.write_gpr(1, true, 7);
        });
        assert_eq!(s, "  007");
    }

    #[test]
    fn percent_s_precision_does_not_panic_on_multibyte() {
        // `%.1s` on a multi-byte UTF-8 string hits String::truncate
        // mid-char and panics the wasm instance. Precision counts bytes (C
        // semantics), so it must truncate the raw bytes, not the decoded
        // String.
        let (s, _) = call("[%.1s]", |regs, mem| {
            // place the 2-byte UTF-8 'e-acute' (0xC3 0xA9) then NUL.
            let addr = 0x0060_0000u64;
            mem.write_u8(addr, 0xC3).unwrap();
            mem.write_u8(addr + 1, 0xA9).unwrap();
            mem.write_u8(addr + 2, 0).unwrap();
            regs.write_gpr(1, true, addr);
        });
        // one byte kept -> lossy decode of a lone 0xC3 -> U+FFFD.
        assert!(s.starts_with("[") && s.ends_with("]"));
    }

    #[test]
    fn bytes_that_are_not_utf8_pass_through_untouched() {
        // glibc copies the format's bytes and a %s string's bytes as they
        // are; decoding them as UTF-8 turned each stray byte into the
        // three-byte replacement character. The format is "\xff%s\xfe".
        let text = 0x0050_0100u64;
        let (bytes, n) = call_into_buffer(sprintf, "\u{0}", 6, |regs, mem| {
            for (i, b) in [0xFFu8, b'%', b's', 0xFE, 0].iter().enumerate() {
                mem.write_u8(FMT_ADDR + i as u64, *b).unwrap();
            }
            for (i, b) in [0xE9u8, b'!', 0].iter().enumerate() {
                mem.write_u8(text + i as u64, *b).unwrap();
            }
            regs.write_gpr(0, true, BUF_ADDR);
            regs.write_gpr(1, true, FMT_ADDR);
            regs.write_gpr(2, true, text);
        });
        assert_eq!(n, 4);
        assert_eq!(&bytes[..5], &[0xFF, 0xE9, b'!', 0xFE, 0]);
    }

    #[test]
    fn percent_s_with_a_precision_reads_no_further_than_it() {
        // "%.3s" of an array with no terminator is defined C: only three
        // bytes are read. The fourth byte here sits on an unmapped page.
        let (s, n) = call("[%.3s]", |regs, mem| {
            let edge = 0x0061_0000u64 - 3;
            mem.map_page(edge);
            for (i, b) in b"abc".iter().enumerate() {
                mem.write_u8(edge + i as u64, *b).unwrap();
            }
            regs.write_gpr(1, true, edge);
        });
        assert_eq!(s, "[abc]");
        assert_eq!(n, 5);
    }

    #[test]
    fn unterminated_string_names_the_caller_not_printf() {
        // 1 MiB of non-zero bytes: the scan gives up and the message
        // blames the operation that read the string, with its address.
        let err = try_call("%s", |regs, mem| {
            let base = 0x0060_0000u64;
            for page in 0..257 {
                mem.map_page(base + page * 4096);
            }
            for i in 0..(MAX_PRINTF_CALL_BYTES + 8) {
                mem.write_u8(base + i as u64, b'A').unwrap();
            }
            regs.write_gpr(1, true, base);
        })
        .unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("printf %s"), "was: {msg}");
        assert!(msg.contains("0x600000"), "was: {msg}");
        assert!(msg.contains(".asciz"), "was: {msg}");
    }

    #[test]
    fn percent_s_with_a_bad_pointer_names_the_conversion() {
        // A null (unmapped) pointer must not surface as a bare memory
        // fault; the message names printf %s, the pointer, and the remedy.
        let err = try_call("%s", |regs, _| {
            regs.write_gpr(1, true, 0);
        })
        .unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("printf %s"), "was: {msg}");
        assert!(msg.contains("0x0"), "was: {msg}");
        assert!(msg.contains("ldr"), "was: {msg}");
    }

    #[test]
    fn printf_percent_f_default_precision_six() {
        let (s, _) = call("%f", |regs, _| {
            regs.write_fpr_f64(0, std::f64::consts::PI);
        });
        assert_eq!(s, "3.141593");
    }

    #[test]
    fn printf_percent_f_custom_precision() {
        let (s, _) = call("%.4f", |regs, _| {
            regs.write_fpr_f64(0, std::f64::consts::PI);
        });
        assert_eq!(s, "3.1416");
    }

    #[test]
    fn printf_percent_f_integer_precision() {
        let (s, _) = call("%.0f", |regs, _| {
            regs.write_fpr_f64(0, 2.6);
        });
        assert_eq!(s, "3");
    }

    #[test]
    fn printf_mixed_int_and_double() {
        // "%d %f %d %f" pulls x1 d0 x2 d1 independently.
        let (s, _) = call("%d %f %d %f", |regs, _| {
            regs.write_gpr(1, true, 1);
            regs.write_gpr(2, true, 2);
            regs.write_fpr_f64(0, 1.5);
            regs.write_fpr_f64(1, 2.5);
        });
        assert_eq!(s, "1 1.500000 2 2.500000");
    }

    #[test]
    fn printf_percent_p_prints_hex_pointer() {
        let (s, _) = call("%p", |regs, _| {
            regs.write_gpr(1, true, 0x0040_0000);
        });
        assert_eq!(s, "0x400000");
    }

    #[test]
    #[allow(clippy::approx_constant)] // 3.14159 is the corpus value, not a stand-in for PI
    fn percent_e_matches_glibc_shape() {
        let cases: &[(&str, f64, &str)] = &[
            ("%e", 3.14159, "3.141590e+00"),
            ("%e", 0.0, "0.000000e+00"),
            ("%.2e", 12345.678, "1.23e+04"),
            ("%e", -0.000001, "-1.000000e-06"),
            ("%E", 2.5, "2.500000E+00"),
        ];
        for (fmt, v, want) in cases {
            let (s, _) = call(fmt, |regs, _| {
                regs.write_fpr_bits(0, v.to_bits());
            });
            assert_eq!(&s, want, "{fmt} of {v}");
        }
    }

    #[test]
    #[allow(clippy::approx_constant)] // 3.14159 is the corpus value, not a stand-in for PI
    fn percent_g_picks_the_form_and_strips_zeros_like_glibc() {
        let cases: &[(&str, f64, &str)] = &[
            ("%g", 3.14159, "3.14159"),
            ("%g", 100.0, "100"),
            ("%g", 0.0001, "0.0001"),
            ("%g", 0.00001, "1e-05"),
            ("%g", 1234567.0, "1.23457e+06"),
            ("%.3g", 3.14159, "3.14"),
            ("%g", 0.0, "0"),
        ];
        for (fmt, v, want) in cases {
            let (s, _) = call(fmt, |regs, _| {
                regs.write_fpr_bits(0, v.to_bits());
            });
            assert_eq!(&s, want, "{fmt} of {v}");
        }
    }

    #[test]
    fn printf_percent_p_of_null_prints_nil_like_glibc() {
        let (s, _) = call("%p", |regs, _| {
            regs.write_gpr(1, true, 0);
        });
        assert_eq!(s, "(nil)");
    }

    #[test]
    fn printf_percent_o() {
        let (s, _) = call("%o", |regs, _| {
            regs.write_gpr(1, true, 0o755);
        });
        assert_eq!(s, "755");
    }

    #[test]
    fn printf_long_modifier_accepted() {
        // `%ld` and `%d` agree on a value that fits 32 bits.
        let (s, _) = call("%ld", |regs, _| {
            regs.write_gpr(1, true, 123);
        });
        assert_eq!(s, "123");
    }

    #[test]
    fn printf_returns_byte_count_written() {
        let (_, n) = call("abc", |_, _| {});
        assert_eq!(n, 3);
    }

    #[test]
    fn printf_handles_string_with_embedded_newline() {
        let (s, _) = call("line\n", |_, _| {});
        assert_eq!(s, "line\n");
    }

    #[test]
    fn an_absurd_width_stops_the_call_instead_of_printing_a_clamped_field() {
        // glibc prints any width in full, so a clamped field would be a
        // wrong answer; past what one call may print, the call stops, and
        // it never builds the gigabytes first.
        let err = try_call("%2000000000d", |regs, _| {
            regs.write_gpr(1, true, 5);
        })
        .unwrap_err();
        assert!(err.to_string().contains("single call"), "was: {err}");
    }

    #[test]
    fn a_width_past_four_kib_prints_in_full() {
        // glibc's answer for "%5000d" is 4999 spaces and the digit.
        let (s, n) = call("%5000d|", |regs, _| {
            regs.write_gpr(1, true, 5);
        });
        assert_eq!(n, 5001);
        assert!(s.starts_with("    ") && s.ends_with("5|"));
    }

    #[test]
    fn star_width_reads_the_argument_before_the_value() {
        // glibc: printf("%*d", 8, 42) is "      42". The width arg comes
        // first, so x1 is the width and x2 the value.
        let (s, n) = call("%*d", |regs, _| {
            regs.write_gpr(1, true, 8);
            regs.write_gpr(2, true, 42);
        });
        assert_eq!(s, "      42");
        assert_eq!(n, 8);
        // The rest of the format keeps walking from where the star left
        // the cursor, so a second conversion still reads its own arg.
        let (s, _) = call("[%*d][%d]", |regs, _| {
            regs.write_gpr(1, true, 4);
            regs.write_gpr(2, true, 7);
            regs.write_gpr(3, true, 9);
        });
        assert_eq!(s, "[   7][9]");
    }

    #[test]
    fn star_width_honors_the_left_align_flag() {
        let (s, _) = call("%-*d|", |regs, _| {
            regs.write_gpr(1, true, 6);
            regs.write_gpr(2, true, 42);
        });
        assert_eq!(s, "42    |");
    }

    #[test]
    fn a_negative_star_width_left_justifies() {
        // C: a negative field width is the `-` flag with its absolute
        // value, so printf("%*d|", -6, 42) matches printf("%-6d|", 42).
        let (s, _) = call("%*d|", |regs, _| {
            regs.write_gpr(1, true, (-6i64) as u64);
            regs.write_gpr(2, true, 42);
        });
        assert_eq!(s, "42    |");
    }

    #[test]
    fn star_precision_reads_an_int_before_the_double() {
        // The precision is an int vararg (x1) and the value a double
        // (d0): the two register files advance independently.
        let (s, _) = call("%.*f", |regs, _| {
            regs.write_gpr(1, true, 2);
            regs.write_fpr_f64(0, std::f64::consts::PI);
        });
        assert_eq!(s, "3.14");
        // A negative precision is as if none were given: %f falls back to
        // its default of six places.
        let (s, _) = call("%.*f", |regs, _| {
            regs.write_gpr(1, true, (-1i64) as u64);
            regs.write_fpr_f64(0, std::f64::consts::PI);
        });
        assert_eq!(s, "3.141593");
    }

    #[test]
    fn star_width_pads_a_string() {
        let (s, _) = call("%*s|", |regs, mem| {
            let str_addr = 0x0052_0000u64;
            mem.map_page(str_addr);
            for (i, b) in b"hi".iter().enumerate() {
                mem.write_u8(str_addr + i as u64, *b).unwrap();
            }
            mem.write_u8(str_addr + 2, 0).unwrap();
            regs.write_gpr(1, true, 8);
            regs.write_gpr(2, true, str_addr);
        });
        assert_eq!(s, "      hi|");
    }

    #[test]
    fn an_absurd_star_width_stops_the_call_like_a_written_one() {
        // The cap has to cover the guest-supplied width too, or a single
        // register value builds a multi-gigabyte string.
        let err = try_call("%*d", |regs, _| {
            regs.write_gpr(1, true, 2_000_000_000);
            regs.write_gpr(2, true, 5);
        })
        .unwrap_err();
        assert!(err.to_string().contains("single call"), "was: {err}");
    }

    #[test]
    fn an_absurd_precision_stops_the_call() {
        let err = try_call("%.2000000000f", |regs, _| {
            regs.write_fpr_f64(0, 1.0);
        })
        .unwrap_err();
        assert!(err.to_string().contains("single call"), "was: {err}");
    }

    #[test]
    fn integer_flags_and_precision_follow_glibc() {
        // Each expected string is what aarch64 glibc prints.
        let cases: &[(&str, u64, &str)] = &[
            ("[%.0d]", 0, "[]"),
            ("[%+.0d]", 0, "[+]"),
            ("[% .0d]", 0, "[ ]"),
            ("[%5.0d]", 0, "[     ]"),
            ("[%.0x]", 0, "[]"),
            ("[%#.0x]", 0, "[]"),
            ("[%#.0o]", 0, "[0]"),
            ("[%#x]", 0, "[0]"),
            ("[%#.4x]", 0x1f, "[0x001f]"),
            ("[%#010x]", 0xff, "[0x000000ff]"),
            ("[%-#8X]", 0xab, "[0XAB    ]"),
            ("[%#.5o]", 8, "[00010]"),
            ("[%#o]", 8, "[010]"),
            ("[%+012d]", 42, "[+00000000042]"),
            ("[%zx %jd %td]", u64::MAX, "[ffffffffffffffff -1 -1]"),
        ];
        for (fmt, v, want) in cases {
            let (s, _) = call(fmt, |regs, _| {
                regs.write_gpr(1, true, *v);
                regs.write_gpr(2, true, *v);
                regs.write_gpr(3, true, *v);
            });
            assert_eq!(&s, want, "{fmt} of {v:#x}");
        }
    }

    #[test]
    fn float_flags_inf_and_nan_follow_glibc() {
        let cases: &[(&str, f64, &str)] = &[
            ("[%f]", f64::INFINITY, "[inf]"),
            ("[%F]", f64::INFINITY, "[INF]"),
            ("[%e]", f64::NEG_INFINITY, "[-inf]"),
            ("[%G]", f64::NAN, "[NAN]"),
            ("[%f]", -f64::NAN, "[-nan]"),
            ("[%08f]", f64::INFINITY, "[     inf]"),
            ("[%+f]", f64::NAN, "[+nan]"),
            ("[%#.0f]", 3.0, "[3.]"),
            ("[%#.0e]", 3.0, "[3.e+00]"),
            ("[%#g]", 3.0, "[3.00000]"),
            ("[%#.3g]", 100.0, "[100.]"),
            // A carry into a new digit keeps glibc's zero-length fraction.
            ("[%#.3g]", 999.5, "[1.e+03]"),
            ("[%#.2G]", 99.95, "[1.E+02]"),
            ("[%#g]", 999999.5, "[1.e+06]"),
            ("[%#.2g]", 999.5, "[1.0e+03]"),
            ("[%#.3g]", 9.9951, "[10.0]"),
            ("[%.3g]", 999.5, "[1e+03]"),
            ("[%012.3e]", -1.5, "[-001.500e+00]"),
            ("[%012g]", -1.5, "[-000000001.5]"),
            ("[%'.2f]", 1234.5, "[1234.50]"),
            ("[%f]", -0.0, "[-0.000000]"),
        ];
        for (fmt, v, want) in cases {
            let (s, _) = call(fmt, |regs, _| {
                regs.write_fpr_bits(0, v.to_bits());
            });
            assert_eq!(&s, want, "{fmt} of {v}");
        }
    }

    #[test]
    fn exact_binary_ties_round_to_even_like_glibc() {
        let cases: &[(&str, f64, &str)] = &[
            ("%.0f", 0.5, "0"),
            ("%.0f", 1.5, "2"),
            ("%.0f", 2.5, "2"),
            ("%.1f", 0.25, "0.2"),
            ("%.2f", 1.125, "1.12"),
            ("%.0e", 2.5, "2e+00"),
        ];
        for (fmt, v, want) in cases {
            let (s, _) = call(fmt, |regs, _| {
                regs.write_fpr_bits(0, v.to_bits());
            });
            assert_eq!(&s, want, "{fmt} of {v}");
        }
    }
}
