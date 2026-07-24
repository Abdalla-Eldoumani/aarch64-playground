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
    let fmt_bytes = read_c_string(ctx.mem, fmt_ptr, "printf's format string")?;
    let fmt = String::from_utf8_lossy(&fmt_bytes).into_owned();

    // x0 is the format string (fixed param), so vararg ints start at x1.
    // d0..d7 are all available for vararg doubles.
    let mut walker = VarargWalker { gp_idx: 1, fp_idx: 0, stack_off: 0 };
    let mut out: Vec<u8> = Vec::new();

    let chars: Vec<char> = fmt.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c != '%' {
            push_char(&mut out, c);
            i += 1;
            continue;
        }
        i += 1;
        let spec = parse_spec(&chars, &mut i);
        if i >= chars.len() {
            // Trailing '%' with nothing after it; emit literally.
            push_char(&mut out, '%');
            break;
        }
        let conv = chars[i];
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

    ctx.stdout.extend_from_slice(&out);
    ctx.regs.write_gpr(0, true, out.len() as u64);
    Ok(HostOutcome::Continue)
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
    let mut out = Vec::new();
    let mut a = addr;
    // 64 KiB cap keeps a runaway pointer from looping forever; adjust if
    // the corpus ever needs longer strings.
    for _ in 0..(64 * 1024) {
        let b = mem.read_u8(a)?;
        if b == 0 {
            return Ok(out);
        }
        out.push(b);
        a = a.wrapping_add(1);
    }
    Err(EmuError::RuntimeError {
        message: format!(
            "{what}: the string at 0x{addr:x} has no terminating zero byte \
             within 64 KiB -- declare strings with .asciz or .string (not \
             .ascii), and check nothing wrote over the terminator"
        ),
    })
}

/// Upper bound on a printf field width or precision. The values come from the
/// guest format string; without a cap, "%2000000000d" or "%.2000000000f"
/// would build a multi-gigabyte host string and abort the allocator. 4096 is
/// far wider than any real format.
const MAX_FIELD_WIDTH: usize = 4096;

/// Upper bound on ONE printf call's total output. Checked per conversion in
/// the format loop; the cumulative `cpu::MAX_OUTPUT_BYTES` wall bounds the
/// program as a whole.
const MAX_PRINTF_CALL_BYTES: usize = 1024 * 1024;

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
}

fn parse_spec(chars: &[char], i: &mut usize) -> FormatSpec {
    let mut spec = FormatSpec::default();
    // Flags.
    while *i < chars.len() {
        match chars[*i] {
            '-' => spec.left_align = true,
            '0' => spec.zero_pad = true,
            '+' => spec.plus = true,
            ' ' => spec.space = true,
            '#' => spec.alt = true,
            _ => break,
        }
        *i += 1;
    }
    // Width (clamped so a guest-supplied value cannot blow up the output).
    while *i < chars.len() && chars[*i].is_ascii_digit() {
        spec.width = spec
            .width
            .saturating_mul(10)
            .saturating_add(chars[*i] as usize - '0' as usize)
            .min(MAX_FIELD_WIDTH);
        *i += 1;
    }
    // Precision.
    if *i < chars.len() && chars[*i] == '.' {
        *i += 1;
        let mut prec = 0usize;
        while *i < chars.len() && chars[*i].is_ascii_digit() {
            prec = prec
                .saturating_mul(10)
                .saturating_add(chars[*i] as usize - '0' as usize)
                .min(MAX_FIELD_WIDTH);
            *i += 1;
        }
        spec.precision = Some(prec);
    }
    // Length modifier. The fetch slot is the same 64-bit register either
    // way, but the WIDTH read out of it must follow C: plain `%d` is an
    // int and consumes w-register bits only -- glibc on the course
    // machine prints 85 for a `.word`, not the neighbor's bytes.
    while *i < chars.len() && matches!(chars[*i], 'l' | 'h' | 'z' | 'j' | 't') {
        spec.long = chars[*i] == 'l';
        *i += 1;
    }
    spec
}

fn format_conversion(
    spec: &FormatSpec,
    conv: char,
    ctx: &mut HostContext<'_>,
    walker: &mut VarargWalker,
    out: &mut Vec<u8>,
) -> Result<(), EmuError> {
    // C ignores the `0` flag when a precision is given, but only for the
    // integer conversions (d i o u x X); %f keeps zero padding, and the
    // non-numeric conversions never pad with zeros. Resolved here so
    // pad_and_emit needs no knowledge of which conversion it is padding.
    let spec = &FormatSpec {
        zero_pad: spec.zero_pad
            && match conv {
                'd' | 'i' | 'u' | 'x' | 'X' | 'o' | 'p' => spec.precision.is_none(),
                'f' | 'F' => true,
                _ => false,
            },
        ..spec.clone()
    };
    match conv {
        '%' => out.push(b'%'),
        'd' | 'i' => {
            let raw = walker.next_int(ctx);
            // Plain %d is C's int: only w-register bits, sign-extended.
            let value = if spec.long { raw as i64 } else { raw as u32 as i32 as i64 };
            let mut body = if value < 0 {
                format!("-{}", (value as i128).unsigned_abs())
            } else if spec.plus {
                format!("+{value}")
            } else if spec.space {
                format!(" {value}")
            } else {
                format!("{value}")
            };
            apply_precision_int(&mut body, spec);
            pad_and_emit(&body, spec, out);
        }
        'u' => {
            let raw = walker.next_int(ctx);
            let value = if spec.long { raw } else { raw as u32 as u64 };
            let mut body = format!("{value}");
            apply_precision_int(&mut body, spec);
            pad_and_emit(&body, spec, out);
        }
        'x' => {
            let raw = walker.next_int(ctx);
            let value = if spec.long { raw } else { raw as u32 as u64 };
            let mut body = format!("{value:x}");
            if spec.alt && value != 0 {
                body = format!("0x{body}");
            }
            apply_precision_int(&mut body, spec);
            pad_and_emit(&body, spec, out);
        }
        'X' => {
            let raw = walker.next_int(ctx);
            let value = if spec.long { raw } else { raw as u32 as u64 };
            let mut body = format!("{value:X}");
            if spec.alt && value != 0 {
                body = format!("0X{body}");
            }
            apply_precision_int(&mut body, spec);
            pad_and_emit(&body, spec, out);
        }
        'o' => {
            let raw = walker.next_int(ctx);
            let value = if spec.long { raw } else { raw as u32 as u64 };
            let mut body = format!("{value:o}");
            if spec.alt && !body.starts_with('0') {
                body = format!("0{body}");
            }
            apply_precision_int(&mut body, spec);
            pad_and_emit(&body, spec, out);
        }
        'p' => {
            let value = walker.next_int(ctx);
            let body = format!("0x{value:x}");
            pad_and_emit(&body, spec, out);
        }
        'c' => {
            let value = walker.next_int(ctx) as u8;
            pad_and_emit_bytes(&[value], spec, out);
        }
        's' => {
            let ptr = walker.next_int(ctx);
            let bytes = read_c_string(ctx.mem, ptr, "printf %s").map_err(|e| match e {
                EmuError::MemoryFault { .. } => EmuError::RuntimeError {
                    message: format!(
                        "printf %s was handed the pointer 0x{ptr:x}, which does not \
                         point at readable memory -- check that the argument register \
                         holds a string address (ldr xN, =label)"
                    ),
                },
                other => other,
            })?;
            // C's %s precision is a maximum BYTE count. Truncate the raw
            // bytes (not the decoded String): `String::truncate` panics when
            // the cut lands mid-UTF-8-char, so `%.1s` on a multi-byte string
            // used to abort the whole wasm instance.
            let shown: &[u8] = match spec.precision {
                Some(p) if p < bytes.len() => &bytes[..p],
                _ => &bytes,
            };
            let s = String::from_utf8_lossy(shown).into_owned();
            pad_and_emit(&s, spec, out);
        }
        'f' | 'F' => {
            let value = walker.next_double(ctx);
            let prec = spec.precision.unwrap_or(6);
            let body = format_fixed(value, prec, spec.plus, spec.space);
            pad_and_emit(&body, spec, out);
        }
        'e' | 'E' | 'g' | 'G' | 'a' | 'A' => {
            // Real glibc formats these. Echoing the specifier literally
            // also left its argument unconsumed, silently shifting every
            // later conversion of the same class -- worse than stopping.
            return Err(EmuError::RuntimeError {
                message: format!(
                    "printf %{conv} is not supported by this emulator; format the value with %f"
                ),
            });
        }
        '*' => {
            return Err(EmuError::RuntimeError {
                message: "printf's `*` width is not supported; write the width as digits, like %8d"
                    .into(),
            });
        }
        _ => {
            // Unknown conversion: emit '%' followed by the character
            // verbatim, matching glibc's handling of genuinely undefined
            // specifiers (no argument is consumed there either).
            out.push(b'%');
            push_char(out, conv);
        }
    }
    Ok(())
}

fn format_fixed(value: f64, precision: usize, plus: bool, space: bool) -> String {
    let body = format!("{:.*}", precision, value);
    if value.is_sign_negative() || body.starts_with('-') {
        body
    } else if plus {
        format!("+{body}")
    } else if space {
        format!(" {body}")
    } else {
        body
    }
}

fn apply_precision_int(body: &mut String, spec: &FormatSpec) {
    if let Some(prec) = spec.precision {
        // For %d/%u/%x/%o, precision is the minimum number of digits; pad
        // with leading zeros. Strip the sign first so it stays in front.
        let (sign, rest) = if body.starts_with(['-', '+', ' ']) {
            (Some(body.chars().next().unwrap()), body[1..].to_string())
        } else {
            (None, body.clone())
        };
        if rest.len() < prec {
            let padded = "0".repeat(prec - rest.len()) + &rest;
            *body = match sign {
                Some(s) => {
                    let mut out = String::with_capacity(padded.len() + 1);
                    out.push(s);
                    out.push_str(&padded);
                    out
                }
                None => padded,
            };
        }
    }
}

fn pad_and_emit(body: &str, spec: &FormatSpec, out: &mut Vec<u8>) {
    pad_and_emit_bytes(body.as_bytes(), spec, out);
}

fn pad_and_emit_bytes(body: &[u8], spec: &FormatSpec, out: &mut Vec<u8>) {
    if body.len() >= spec.width {
        out.extend_from_slice(body);
        return;
    }
    let pad_count = spec.width - body.len();
    if spec.left_align {
        out.extend_from_slice(body);
        for _ in 0..pad_count {
            out.push(b' ');
        }
    } else if spec.zero_pad {
        // Zero-pad numbers on the right side of any sign.
        if let Some(first) = body.first() {
            if matches!(first, b'-' | b'+' | b' ') {
                out.push(*first);
                for _ in 0..pad_count {
                    out.push(b'0');
                }
                out.extend_from_slice(&body[1..]);
                return;
            }
        }
        for _ in 0..pad_count {
            out.push(b'0');
        }
        out.extend_from_slice(body);
    } else {
        for _ in 0..pad_count {
            out.push(b' ');
        }
        out.extend_from_slice(body);
    }
}

fn push_char(out: &mut Vec<u8>, c: char) {
    let mut buf = [0u8; 4];
    let s = c.encode_utf8(&mut buf);
    out.extend_from_slice(s.as_bytes());
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
        let mut rand_state = 1u64;
        let mut term = crate::cpu::TermState::default();
        let mut heap = crate::hosted::heap::HeapState::default();
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
        };
        printf(&mut ctx)?;
        let written = ctx.regs.read_gpr(0, true) as usize;
        let s = String::from_utf8(stdout).unwrap();
        Ok((s, written))
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
    fn unimplemented_float_conversions_stop_with_a_remedy() {
        // Echoing `%e` literally desynced later float conversions; the
        // student saw a plausible wrong number with no message.
        let err = try_call("%e", |_, _| {}).unwrap_err();
        assert!(err.to_string().contains("%f"), "was: {err}");
        let err = try_call("%*d", |_, _| {}).unwrap_err();
        assert!(err.to_string().contains("width"), "was: {err}");
    }

    #[test]
    fn one_call_cannot_stage_megabytes() {
        // MAX_FIELD_WIDTH clamps one conversion; a 64 KiB format stuffed
        // with wide conversions used to stage ~45 MB in the transient
        // buffer before any wall saw it. The per-call bound must trip.
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
        // `%.1s` on a multi-byte UTF-8 string used to hit String::truncate
        // mid-char and panic the wasm instance. Precision counts bytes (C
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
    fn unterminated_string_names_the_caller_not_printf() {
        // 64 KiB of non-zero bytes: the scan gives up and the message
        // blames the operation that read the string, with its address.
        let err = try_call("%s", |regs, mem| {
            let base = 0x0060_0000u64;
            for page in 0..17 {
                mem.map_page(base + page * 4096);
            }
            for i in 0..(64 * 1024 + 8) {
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
    fn printf_percent_o() {
        let (s, _) = call("%o", |regs, _| {
            regs.write_gpr(1, true, 0o755);
        });
        assert_eq!(s, "755");
    }

    #[test]
    fn printf_long_modifier_accepted() {
        // `%ld` should behave the same as `%d` since we read 64-bit regs.
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
    fn printf_clamps_an_absurd_width() {
        // A guest width far beyond MAX_FIELD_WIDTH must not build a giant
        // buffer; it clamps to the cap.
        let (s, n) = call("%2000000000d", |regs, _| {
            regs.write_gpr(1, true, 5);
        });
        assert_eq!(n, MAX_FIELD_WIDTH);
        assert_eq!(s.len(), MAX_FIELD_WIDTH);
        assert!(s.ends_with('5'));
    }

    #[test]
    fn printf_clamps_an_absurd_precision() {
        let (s, _) = call("%.2000000000f", |regs, _| {
            regs.write_fpr_f64(0, 1.0);
        });
        assert!(s.len() <= MAX_FIELD_WIDTH + 2);
        assert!(s.starts_with("1."));
    }
}
