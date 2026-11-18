//! What each libc stub is to a program: the address a `bl` reaches it at,
//! the register its result comes back in, what one call changes and the
//! call card it leaves, and what a program that calls one of the runtime's
//! own two entries gets. Also holds the editor's completion list of library
//! calls (web/lib/asm/asm-completion.ts, read in place) to the stub table.

use std::collections::BTreeSet;
use std::path::PathBuf;

use aarch64_emulator::{call_card, detect_hosted_mode, host_call_context};
use aarch64_emulator::cpu::{Cpu, StepOutcome};
use aarch64_emulator::frontend::pipeline::assemble_hosted;
use aarch64_emulator::hosted::STUBS;
use aarch64_emulator::registers::CLOBBER_PATTERN;

/// Every stub in slot order. A stub's address is its slot, so a stub
/// inserted or moved shifts every address after it, main's return address
/// (`__main_return`) among them, and a new stub goes last.
const ADDRESSES: &[(&str, u64)] = &[
    ("__host_noop", 0xffff_0000),
    ("printf", 0xffff_0010),
    ("scanf", 0xffff_0020),
    ("puts", 0xffff_0030),
    ("putchar", 0xffff_0040),
    ("getchar", 0xffff_0050),
    ("sprintf", 0xffff_0060),
    ("snprintf", 0xffff_0070),
    ("strlen", 0xffff_0080),
    ("strcmp", 0xffff_0090),
    ("strncmp", 0xffff_00a0),
    ("strcpy", 0xffff_00b0),
    ("strncpy", 0xffff_00c0),
    ("strcat", 0xffff_00d0),
    ("strchr", 0xffff_00e0),
    ("strstr", 0xffff_00f0),
    ("strtok", 0xffff_0100),
    ("memset", 0xffff_0110),
    ("memcpy", 0xffff_0120),
    ("memmove", 0xffff_0130),
    ("memcmp", 0xffff_0140),
    ("exit", 0xffff_0150),
    ("atof", 0xffff_0160),
    ("atoi", 0xffff_0170),
    ("strtol", 0xffff_0180),
    ("abs", 0xffff_0190),
    ("labs", 0xffff_01a0),
    ("rand", 0xffff_01b0),
    ("srand", 0xffff_01c0),
    ("time", 0xffff_01d0),
    ("malloc", 0xffff_01e0),
    ("calloc", 0xffff_01f0),
    ("realloc", 0xffff_0200),
    ("free", 0xffff_0210),
    ("usleep", 0xffff_0220),
    ("fflush", 0xffff_0230),
    ("isdigit", 0xffff_0240),
    ("isalpha", 0xffff_0250),
    ("isspace", 0xffff_0260),
    ("toupper", 0xffff_0270),
    ("tolower", 0xffff_0280),
    ("__ctype_b_loc", 0xffff_0290),
    ("__ctype_toupper_loc", 0xffff_02a0),
    ("__ctype_tolower_loc", 0xffff_02b0),
    ("fopen", 0xffff_02c0),
    ("fprintf", 0xffff_02d0),
    ("fgets", 0xffff_02e0),
    ("fputs", 0xffff_02f0),
    ("fclose", 0xffff_0300),
    ("putc", 0xffff_0310),
    ("fputc", 0xffff_0320),
    ("getc", 0xffff_0330),
    ("fwrite", 0xffff_0340),
    ("qsort", 0xffff_0350),
    ("bsearch", 0xffff_0360),
    ("sqrt", 0xffff_0370),
    ("pow", 0xffff_0380),
    ("sin", 0xffff_0390),
    ("cos", 0xffff_03a0),
    ("tan", 0xffff_03b0),
    ("log", 0xffff_03c0),
    ("log10", 0xffff_03d0),
    ("exp", 0xffff_03e0),
    ("floor", 0xffff_03f0),
    ("fabs", 0xffff_0400),
    ("fmod", 0xffff_0410),
    ("sincos", 0xffff_0420),
    ("__main_return", 0xffff_0430),
    ("__isoc99_scanf", 0xffff_0440),
];

#[test]
fn every_stub_keeps_its_name_and_address() {
    let cpu = Cpu::new();
    let table: Vec<(&str, u64)> = cpu
        .host
        .names()
        .map(|name| (name, cpu.host.lookup(name).expect("a listed name resolves")))
        .collect();
    assert_eq!(table, ADDRESSES);
}

/// The data every call below reads or writes through.
const DATA: &str = r#"
        .data
num:    .string "42"
real:   .string "2.5"
text:   .string "hello world"
other:  .string "hello there"
fmt:    .string "v=%d\n"
infmt:  .string "%d"
space:  .string " "
fname:  .string "notes.txt"
wmode:  .string "w"
arr:    .word   7
buf:    .skip   64
"#;

/// Each stub a program calls, with the lines that set up its arguments and
/// the input queued for it. Every call returns from the one step that runs
/// the stub, by these rules: exit ends the program, so it leaves no result
/// to read; usleep returns and reports the pause it asked for; qsort and
/// bsearch get too few elements to call the program's comparator; and each
/// read finds its input already queued.
const CALLS: &[(&str, &str, &str)] = &[
    ("__host_noop", "", ""),
    ("printf", "ldr x0, =fmt\nmov w1, 7", ""),
    ("scanf", "ldr x0, =infmt\nldr x1, =buf", "12\n"),
    ("puts", "ldr x0, =text", ""),
    ("putchar", "mov w0, 65", ""),
    ("getchar", "", "z"),
    ("sprintf", "ldr x0, =buf\nldr x1, =fmt\nmov w2, 9", ""),
    ("snprintf", "ldr x0, =buf\nmov x1, 4\nldr x2, =fmt\nmov w3, 123", ""),
    ("strlen", "ldr x0, =text", ""),
    ("strcmp", "ldr x0, =text\nldr x1, =other", ""),
    ("strncmp", "ldr x0, =text\nldr x1, =other\nmov x2, 5", ""),
    ("strcpy", "ldr x0, =buf\nldr x1, =text", ""),
    ("strncpy", "ldr x0, =buf\nldr x1, =text\nmov x2, 4", ""),
    ("strcat", "ldr x0, =buf\nldr x1, =text", ""),
    ("strchr", "ldr x0, =text\nmov w1, 111", ""),
    ("strstr", "ldr x0, =text\nldr x1, =space", ""),
    ("strtok", "ldr x0, =text\nldr x1, =space", ""),
    ("memset", "ldr x0, =buf\nmov w1, 120\nmov x2, 4", ""),
    ("memcpy", "ldr x0, =buf\nldr x1, =text\nmov x2, 5", ""),
    ("memmove", "ldr x0, =buf\nldr x1, =text\nmov x2, 5", ""),
    ("memcmp", "ldr x0, =text\nldr x1, =other\nmov x2, 7", ""),
    ("exit", "mov w0, 3", ""),
    ("atof", "ldr x0, =real", ""),
    ("atoi", "ldr x0, =num", ""),
    ("strtol", "ldr x0, =num\nmov x1, 0\nmov w2, 10", ""),
    ("abs", "mov w0, -5", ""),
    ("labs", "mov x0, -6", ""),
    ("rand", "", ""),
    ("srand", "mov w0, 1", ""),
    ("time", "mov x0, 0", ""),
    ("malloc", "mov x0, 16", ""),
    ("calloc", "mov x0, 2\nmov x1, 8", ""),
    ("realloc", "mov x0, 0\nmov x1, 16", ""),
    ("free", "mov x0, 0", ""),
    ("usleep", "mov w0, 1000", ""),
    ("fflush", "mov x0, 0", ""),
    ("isdigit", "mov w0, 55", ""),
    ("isalpha", "mov w0, 97", ""),
    ("isspace", "mov w0, 32", ""),
    ("toupper", "mov w0, 97", ""),
    ("tolower", "mov w0, 65", ""),
    ("__ctype_b_loc", "", ""),
    ("__ctype_toupper_loc", "", ""),
    ("__ctype_tolower_loc", "", ""),
    ("fopen", "ldr x0, =fname\nldr x1, =wmode", ""),
    ("fprintf", "ldr x0, =stdout\nldr x0, [x0]\nldr x1, =fmt\nmov w2, 5", ""),
    ("fgets", "ldr x0, =buf\nmov w1, 16\nldr x2, =stdin\nldr x2, [x2]", "line\n"),
    ("fputs", "ldr x0, =text\nldr x1, =stdout\nldr x1, [x1]", ""),
    ("fclose", "ldr x0, =stdout\nldr x0, [x0]", ""),
    ("putc", "mov w0, 66\nldr x1, =stdout\nldr x1, [x1]", ""),
    ("fputc", "mov w0, 67\nldr x1, =stdout\nldr x1, [x1]", ""),
    ("getc", "ldr x0, =stdin\nldr x0, [x0]", "q"),
    ("fwrite", "ldr x0, =text\nmov x1, 1\nmov x2, 5\nldr x3, =stdout\nldr x3, [x3]", ""),
    ("qsort", "ldr x0, =arr\nmov x1, 1\nmov x2, 4\nmov x3, 0", ""),
    ("bsearch", "ldr x0, =arr\nldr x1, =arr\nmov x2, 0\nmov x3, 4\nmov x4, 0", ""),
    ("sqrt", "fmov d0, 2.0", ""),
    ("pow", "fmov d0, 2.0\nfmov d1, 0.5", ""),
    ("sin", "fmov d0, 0.5", ""),
    ("cos", "fmov d0, 0.5", ""),
    ("tan", "fmov d0, 0.5", ""),
    ("log", "fmov d0, 2.0", ""),
    ("log10", "fmov d0, 2.0", ""),
    ("exp", "fmov d0, 0.5", ""),
    ("floor", "fmov d0, 2.5", ""),
    ("fabs", "fmov d0, -2.5", ""),
    ("fmod", "fmov d0, 2.5\nfmov d1, 1.0", ""),
    ("sincos", "fmov d0, 0.5\nldr x0, =buf\nadd x1, x0, 8", ""),
    ("__isoc99_scanf", "ldr x0, =infmt\nldr x1, =buf", "34\n"),
];

/// Call `name` once from main and describe the step that ran the stub:
/// how it ended, x0 and d0 after it, the register a result came back in
/// (the one the clobber after the call left alone), the registers the
/// step reports changed, and the call card.
fn call_once(name: &str, setup: &str, input: &str) -> String {
    let source = format!(
        "{DATA}
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
{setup}
        bl      {name}
after:  ldp     x29, x30, [sp], 16
        ret
"
    );
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host).unwrap_or_else(|e| panic!("{name}: {e}"));
    cpu.load_linked_image(&image).expect("load");
    cpu.push_stdin(input.as_bytes());
    let stub = cpu.host.lookup(name).expect("a registered stub");
    for _ in 0..64 {
        if cpu.regs.read_pc() == stub {
            break;
        }
        cpu.step().expect("step");
    }
    assert_eq!(cpu.regs.read_pc(), stub, "{name}: the call never reached the stub");
    let r = cpu.step().expect("step");
    let ended = if r.pc == image.symbols["after"] && r.outcome == StepOutcome::Advance {
        "returned".to_string()
    } else {
        format!("{:?}", r.outcome)
    };
    let x0 = cpu.regs.read_gpr(0, true);
    let d0 = cpu.regs.read_fpr_bits(0);
    let returns = match (x0 == CLOBBER_PATTERN, d0 == CLOBBER_PATTERN) {
        (false, true) => "x0",
        (true, false) => "d0",
        (true, true) => "nothing",
        (false, false) => "no clobber",
    };
    let card: Vec<String> = call_card(&cpu).iter().map(f64::to_string).collect();
    format!(
        "{name}: {ended}, returns {returns}, x0 {x0:#x}, d0 {d0:#x}, changed x{} d{}, card [{}]",
        runs(cpu.changed_registers()),
        runs(cpu.changed_fp_registers()),
        card.join(" "),
    )
}

/// `[0, 1, 2, 5]` as `0-2,5`.
fn runs(numbers: &[u8]) -> String {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < numbers.len() {
        let mut j = i;
        while j + 1 < numbers.len() && numbers[j + 1] == numbers[j] + 1 {
            j += 1;
        }
        out.push(if i == j {
            numbers[i].to_string()
        } else {
            format!("{}-{}", numbers[i], numbers[j])
        });
        i = j + 1;
    }
    out.join(",")
}

/// One line per stub from `call_once`.
const CALLED: &[&str] = &[
    "__host_noop: returned, returns x0, x0 0x1, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "printf: returned, returns x0, x0 0x4, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card [1 8 4194320 4 0 1 1 5 5 4 4 2 4 1 0 7 0 0 0 0 2 3 0 0 118 61 37 100 10 118 61 55 10]",
    "scanf: returned, returns x0, x0 0x1, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card [2 8 4194320 1 0 1 1 2 2 2 2 0 2 1 0 6291514 0 12 0 4 0 2 3 0 37 100 49 50 98 117 102]",
    "puts: returned, returns x0, x0 0xc, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "putchar: returned, returns x0, x0 0x41, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "getchar: returned, returns x0, x0 0x7a, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "sprintf: returned, returns x0, x0 0x4, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "snprintf: returned, returns x0, x0 0x6, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "strlen: returned, returns x0, x0 0xb, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "strcmp: returned, returns x0, x0 0x1, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "strncmp: returned, returns x0, x0 0x0, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "strcpy: returned, returns x0, x0 0x60003a, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "strncpy: returned, returns x0, x0 0x60003a, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "strcat: returned, returns x0, x0 0x60003a, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "strchr: returned, returns x0, x0 0x60000b, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "strstr: returned, returns x0, x0 0x60000c, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "strtok: returned, returns x0, x0 0x600007, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "memset: returned, returns x0, x0 0x60003a, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "memcpy: returned, returns x0, x0 0x60003a, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "memmove: returned, returns x0, x0 0x60003a, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "memcmp: returned, returns x0, x0 0x3, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "exit: Exited(3), returns no clobber, x0 0x3, d0 0x0, changed x d, card []",
    "atof: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x4004000000000000, changed x0-18 d0-31, card []",
    "atoi: returned, returns x0, x0 0x2a, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "strtol: returned, returns x0, x0 0x2a, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "abs: returned, returns x0, x0 0x5, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "labs: returned, returns x0, x0 0x6, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "rand: returned, returns x0, x0 0x6b8b4567, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "srand: returned, returns nothing, x0 0xdeadbeefdeadbeef, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "time: returned, returns x0, x0 0x1528dec0, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "malloc: returned, returns x0, x0 0x900000, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "calloc: returned, returns x0, x0 0x900000, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "realloc: returned, returns x0, x0 0x900000, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "free: returned, returns nothing, x0 0xdeadbeefdeadbeef, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "usleep: Sleeping(1000000), returns x0, x0 0x0, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "fflush: returned, returns x0, x0 0x0, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "isdigit: returned, returns x0, x0 0x800, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "isalpha: returned, returns x0, x0 0x400, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "isspace: returned, returns x0, x0 0x2000, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "toupper: returned, returns x0, x0 0x41, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "tolower: returned, returns x0, x0 0x61, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "__ctype_b_loc: returned, returns x0, x0 0x801018, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "__ctype_toupper_loc: returned, returns x0, x0 0x801320, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "__ctype_tolower_loc: returned, returns x0, x0 0x801328, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "fopen: returned, returns x0, x0 0xffff2030, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "fprintf: returned, returns x0, x0 0x4, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "fgets: returned, returns x0, x0 0x60003a, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "fputs: returned, returns x0, x0 0xb, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "fclose: returned, returns x0, x0 0x0, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "putc: returned, returns x0, x0 0x42, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "fputc: returned, returns x0, x0 0x43, d0 0xdeadbeefdeadbeef, changed x1-18 d0-31, card []",
    "getc: returned, returns x0, x0 0x71, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "fwrite: returned, returns x0, x0 0x5, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "qsort: returned, returns nothing, x0 0xdeadbeefdeadbeef, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "bsearch: returned, returns x0, x0 0x0, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "sqrt: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3ff6a09e667f3bcd, changed x0-18 d0-31, card []",
    "pow: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3ff6a09e667f3bcd, changed x0-18 d0-31, card []",
    "sin: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3fdeaee8744b05f0, changed x0-18 d0-31, card []",
    "cos: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3fec1528065b7d50, changed x0-18 d0-31, card []",
    "tan: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3fe17b4f5bf3474a, changed x0-18 d0-31, card []",
    "log: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3fe62e42fefa39ef, changed x0-18 d0-31, card []",
    "log10: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3fd34413509f79ff, changed x0-18 d0-31, card []",
    "exp: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3ffa61298e1e069c, changed x0-18 d0-31, card []",
    "floor: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x4000000000000000, changed x0-18 d0-31, card []",
    "fabs: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x4004000000000000, changed x0-18 d0-31, card []",
    "fmod: returned, returns d0, x0 0xdeadbeefdeadbeef, d0 0x3fe0000000000000, changed x0-18 d0-31, card []",
    "sincos: returned, returns nothing, x0 0xdeadbeefdeadbeef, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
    "__isoc99_scanf: returned, returns x0, x0 0x1, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card [2 8 4194320 1 0 1 1 2 2 2 2 0 2 1 0 6291514 0 34 0 4 0 2 3 0 37 100 51 52 98 117 102]",
];

#[test]
fn each_stub_returns_its_result_where_it_did_and_changes_what_it_did() {
    let got: Vec<String> =
        CALLS.iter().map(|(name, setup, input)| call_once(name, setup, input)).collect();
    assert_eq!(got.len(), CALLED.len(), "one line per call");
    for (got, want) in got.iter().zip(CALLED) {
        assert_eq!(got, want);
    }
}

/// The runtime's own two entries are symbols a program can name, since the
/// linker seeds every stub. `__main_return` ends the program with w0 as its
/// status, needs no aligned sp (it is the return from main, not a call) and
/// names no call; `__host_noop` is an ordinary call that does nothing.
const ENTRY_CALLS: &[(&str, &str, &str)] = &[
    ("__main_return", "main_return_ends_main", "mov w0, 5\nbl __main_return\nmov w0, 6"),
    ("__main_return", "main_return_with_sp_off", "sub sp, sp, 8\nmov w0, 5\nbl __main_return"),
    ("__main_return", "main_return_after_srand", "mov w0, 1\nbl srand\nbl __main_return"),
    ("__host_noop", "host_noop_returns", "mov w0, 5\nmov x9, 1\nbl __host_noop\nadd w0, w0, w9"),
    ("__host_noop", "host_noop_with_sp_off", "sub sp, sp, 8\nmov w0, 5\nbl __host_noop"),
];

/// Run main around `body` to its end and describe it: the call context at
/// each step that names a call or sits on `entry`, the exit status, the
/// steps, where it stopped and why, the clobber notes and the output.
fn run_entry(entry: &str, body: &str) -> String {
    let source = format!(
        "        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
{body}
        ldp     x29, x30, [sp], 16
        ret
"
    );
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host).unwrap_or_else(|e| panic!("{entry}: {e}"));
    cpu.load_linked_image(&image).expect("load");
    let stub = cpu.host.lookup(entry).expect("a registered stub");
    let mut context = Vec::new();
    for _ in 0..200 {
        let pc = cpu.regs.read_pc();
        let here = host_call_context(&cpu, &[]).map(|c| (c.name, c.call_site_pc));
        if here.is_some() || pc == stub {
            context.push((pc, here));
        }
        if cpu.step().expect("step").halted {
            break;
        }
    }
    assert!(cpu.is_halted(), "{entry}: main never ended");
    let notes = cpu.take_clobber_notes();
    let stdout = cpu.take_stdout();
    format!(
        "context {context:?}, exit {:?}, steps {}, pc {:#x}, error {:?}, notes {notes:?}, stdout {:?}",
        cpu.exit_code(),
        cpu.steps_taken(),
        cpu.regs.read_pc(),
        cpu.abort_message,
        String::from_utf8_lossy(&stdout),
    )
}

/// One line per program from `run_entry`.
const ENTRY_RUNS: &[&str] = &[
    "main_return_ends_main: context [(4194336, Some((\"__main_return\", 4194316))), (4194340, Some((\"__main_return\", 4194316))), (4294902832, None)], exit Some(5), steps 7, pc 0xffff0430, error None, notes [], stdout \"\"",
    "main_return_with_sp_off: context [(4194336, Some((\"__main_return\", 4194320))), (4194340, Some((\"__main_return\", 4194320))), (4294902832, None)], exit Some(5), steps 8, pc 0xffff0430, error None, notes [], stdout \"\"",
    "main_return_after_srand: context [(4194336, Some((\"srand\", 4194316))), (4194340, Some((\"srand\", 4194316))), (4294902208, Some((\"srand\", 4194316))), (4194344, Some((\"__main_return\", 4194320))), (4194348, Some((\"__main_return\", 4194320))), (4294902832, None)], exit Some(-559038737), steps 11, pc 0xffff0430, error None, notes [0, 2, 4194316, 4294902832], stdout \"\"",
    "host_noop_returns: context [(4194344, Some((\"__host_noop\", 4194320))), (4194348, Some((\"__host_noop\", 4194320))), (4294901760, Some((\"__host_noop\", 4194320)))], exit Some(-559038732), steps 12, pc 0xffff0430, error None, notes [9, 0, 4194320, 4194324], stdout \"\"",
    "host_noop_with_sp_off: context [(4194336, Some((\"__host_noop\", 4194320))), (4194340, Some((\"__host_noop\", 4194320))), (4294901760, Some((\"__host_noop\", 4194320)))], exit None, steps 8, pc 0xffff0000, error Some(\"Bus error\\nsp is 0x7fffffe8 at this call, which is not a multiple of 16: round the frame size above it up to a multiple of 16 (32 instead of 24), or size it with `alloc = -(16 + locals) & -16`\"), notes [], stdout \"\"",
];

/// Every name a program calls makes a `bl` to it a hosted program, and the
/// runtime's own two entries do not.
#[test]
fn a_bl_to_every_callable_stub_makes_a_hosted_program() {
    for (name, _) in ADDRESSES {
        let entry = matches!(*name, "__host_noop" | "__main_return");
        let call_alone = format!("main:\n    bl {name}\n    ret\n");
        assert_eq!(detect_hosted_mode(&call_alone), !entry, "`bl {name}` alone");
    }
}

#[test]
fn a_program_that_names_the_runtimes_own_entries_runs_as_it_did() {
    let got: Vec<String> = ENTRY_CALLS
        .iter()
        .map(|(entry, label, body)| format!("{label}: {}", run_entry(entry, body)))
        .collect();
    assert_eq!(got.len(), ENTRY_RUNS.len(), "one line per program");
    for (got, want) in got.iter().zip(ENTRY_RUNS) {
        assert_eq!(got, want);
    }
}

/// Stubs a program calls that the editor leaves out of its completions on
/// purpose: the name gcc -S writes for scanf, and the three ctype table
/// lookups that compiled code calls, never a student.
const NOT_COMPLETED: &[&str] =
    &["__isoc99_scanf", "__ctype_b_loc", "__ctype_toupper_loc", "__ctype_tolower_loc"];

/// The names in web/lib/asm/asm-completion.ts's `LIBC` list. Panics when the
/// list is not where it was or yields no names, so a reworded file fails
/// here instead of comparing an empty set.
fn completion_names() -> BTreeSet<String> {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop();
    path.push("web/lib/asm/asm-completion.ts");
    let source = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let (list, _) = source
        .split_once("const LIBC: Suggestion[] = [")
        .and_then(|(_, rest)| rest.split_once("].map("))
        .unwrap_or_else(|| {
            panic!("{} has no `const LIBC: Suggestion[] = [...].map(` list", path.display())
        });
    let names: BTreeSet<String> = list.split('"').skip(1).step_by(2).map(str::to_string).collect();
    assert!(!names.is_empty(), "read no names from the LIBC list in {}", path.display());
    names
}

#[test]
fn the_editor_completes_every_stub_a_program_calls_but_the_compilers_names() {
    let callable: BTreeSet<String> =
        STUBS.iter().filter(|stub| stub.callable).map(|stub| stub.name.to_string()).collect();
    for name in NOT_COMPLETED {
        assert!(callable.contains(*name), "{name} is left out but is no stub a program calls");
    }
    let expected: BTreeSet<String> =
        callable.into_iter().filter(|name| !NOT_COMPLETED.contains(&name.as_str())).collect();
    let offered = completion_names();
    let missing: Vec<&String> = expected.difference(&offered).collect();
    let extra: Vec<&String> = offered.difference(&expected).collect();
    assert!(
        missing.is_empty() && extra.is_empty(),
        "asm-completion.ts's LIBC list against the stub table: \
         stubs it lacks {missing:?}, names that are no stub a program calls {extra:?}"
    );
}
