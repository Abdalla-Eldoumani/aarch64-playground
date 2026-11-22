//! What each libc stub is to a program: the address a `bl` reaches it at,
//! the register its result comes back in, what one call changes and the
//! call card it leaves, what a program that calls one of the runtime's
//! own two entries gets, and that a program with its own `atol` loads and
//! runs as it did before the library had one. Also holds the editor's completion list of library
//! calls (web/lib/asm/asm-completion.ts, read in place) to the stub table.

use std::collections::BTreeSet;
use std::path::PathBuf;

use aarch64_emulator::{call_card, detect_hosted_mode, host_call_context};
use aarch64_emulator::assembler::assemble;
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
    ("atol", 0xffff_0450),
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
    ("atol", "ldr x0, =num", ""),
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
    "atol: returned, returns x0, x0 0x2a, d0 0xdeadbeefdeadbeef, changed x0-18 d0-31, card []",
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
    "host_noop_with_sp_off: context [(4194336, Some((\"__host_noop\", 4194320))), (4194340, Some((\"__host_noop\", 4194320))), (4294901760, Some((\"__host_noop\", 4194320)))], exit None, steps 8, pc 0xffff0000, error Some(\"Bus error\\nsp is 0x7fffffe8 at this call, which is not a multiple of 16: round the frame size above it up to a multiple of 16, or size it with `alloc = -(16 + locals) & -16`\"), notes [], stdout \"\"",
];

/// Every name a program calls through the rows detection reads makes a `bl`
/// to it a hosted program; the runtime's own two entries and the rows after
/// `__isoc99_scanf` (`atol`) do not.
#[test]
fn a_bl_to_every_callable_stub_makes_a_hosted_program() {
    let last_read = ADDRESSES.iter().position(|(name, _)| *name == "__isoc99_scanf").expect("listed");
    for (row, (name, _)) in ADDRESSES.iter().enumerate() {
        let entry = matches!(*name, "__host_noop" | "__main_return");
        let call_alone = format!("main:\n    bl {name}\n    ret\n");
        let read = row <= last_read;
        assert_eq!(detect_hosted_mode(&call_alone), !entry && read, "`bl {name}` alone");
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

/// An `atol` that reads digits only: " 42" and "-12" give 0, which the
/// library's would read as 42 and -12.
const OWN_ATOL_BODY: &str = "
atol:   mov     x1, 0
        mov     x3, 10
atol_loop:
        ldrb    w2, [x0], 1
        sub     w2, w2, 48
        cmp     w2, 9
        b.hi    atol_done
        mul     x1, x1, x3
        add     x1, x1, w2, uxtw
        b       atol_loop
atol_done:
        mov     x0, x1
        ret
";

/// Programs that define their own `atol`, or call a name that starts with
/// it: hosted with `main`, hosted with `_start`, and four with no directive,
/// which load on the bare-metal path. No course or student program found
/// defines one, so these are written for the purpose.
fn own_atol_programs() -> Vec<(&'static str, String)> {
    let stack_42 = "        sub     sp, sp, 16\n        mov     x9, 0x3234\n        str     x9, [sp]\n        mov     x0, sp\n";
    vec![
        (
            "hosted_main",
            format!(
                "define(fp, x29)
define(lr, x30)

        .data
spaced:     .string \" 42\"
negative:   .string \"-12\"
plain:      .string \"907\"
fmt:        .string \"%ld %ld %ld\\n\"

        .text
        .balign 4
        .global atol{OWN_ATOL_BODY}
        .balign 4
        .global main
main:   stp     fp, lr, [sp, -32]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        ldr     x0, =spaced
        bl      atol
        mov     x19, x0
        ldr     x0, =negative
        bl      atol
        mov     x20, x0
        ldr     x0, =plain
        bl      atol
        mov     x3, x0
        mov     x2, x20
        mov     x1, x19
        ldr     x0, =fmt
        bl      printf
        ldp     x19, x20, [sp, 16]
        mov     w0, 0
        ldp     fp, lr, [sp], 32
        ret
"
            ),
        ),
        (
            "hosted_start",
            format!(
                "        .data
num:    .string \" 77\"

        .text
        .global _start
_start: ldr     x0, =num
        bl      atol
        mov     x8, 93
        svc     0
{OWN_ATOL_BODY}"
            ),
        ),
        ("bare_start", format!("_start:\n{stack_42}        bl      atol\n        mov     x8, 93\n        svc     0\n{OWN_ATOL_BODY}")),
        (
            "bare_main",
            format!("main:   stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n{stack_42}        bl      atol\n        add     sp, sp, 16\n        ldp     x29, x30, [sp], 16\n        ret\n{OWN_ATOL_BODY}"),
        ),
        ("bare_no_entry", format!("{stack_42}        bl      atol\n        add     sp, sp, 16\n        b       finish\n{OWN_ATOL_BODY}finish: mov     x19, x0\n")),
        (
            "bare_prefix",
            format!("{stack_42}        bl      atol_digits\n        add     sp, sp, 16\n        b       finish\n{}finish: mov     x19, x0\n", OWN_ATOL_BODY.replace("atol", "atol_digits")),
        ),
    ]
}

/// Load `source` the way the playground does (`detect_hosted_mode` picks
/// the path), run it to its end, and describe it: the path, the libc
/// trampolines the link made, the exit status, the steps, where it stopped
/// and why, x0 and the output; or the path and why it was not built.
fn load_and_run(source: &str) -> String {
    let hosted = detect_hosted_mode(source);
    let mut cpu = Cpu::new();
    let trampolines = if hosted {
        let image = match assemble_hosted(source, &cpu.host) {
            Ok(image) => image,
            Err(e) => return format!("hosted {hosted}, not built: {e}"),
        };
        cpu.load_linked_image_with_args(&image, &[]).expect("load");
        image.trampoline_names
    } else {
        let code = match assemble(source) {
            Ok(code) => code,
            Err(e) => return format!("hosted {hosted}, not built: {e}"),
        };
        cpu.reset();
        cpu.load_program(&code);
        Vec::new()
    };
    cpu.run_until_break(10_000).expect("run");
    let stdout = cpu.take_stdout();
    format!(
        "hosted {hosted}, trampolines {trampolines:?}, exit {:?}, steps {}, pc {:#x}, x0 {:#x}, error {:?}, stdout {:?}",
        cpu.exit_code(),
        cpu.steps_taken(),
        cpu.regs.read_pc(),
        cpu.regs.read_gpr(0, true),
        cpu.abort_message,
        String::from_utf8_lossy(&stdout),
    )
}

/// One line per program from `load_and_run`.
const OWN_ATOL_RUNS: &[&str] = &[
    "hosted_main: hosted true, trampolines [\"printf\"], exit Some(0), steps 69, pc 0xffff0430, x0 0x0, error None, stdout \"0 0 907\\n\"",
    "hosted_start: hosted true, trampolines [], exit Some(0), steps 12, pc 0x400010, x0 0x0, error None, stdout \"\"",
    "bare_start: hosted false, trampolines [], exit Some(42), steps 29, pc 0x40001c, x0 0x2a, error None, stdout \"\"",
    "bare_main: hosted false, trampolines [], exit None, steps 33, pc 0x0, x0 0x2a, error Some(\"memory fault: the program tried to read 0x0000000000000000, which no section covers. The base register (the first one inside the brackets, or a pointer passed to a call) does not hold an address, usually because `ldr xN, label` lost its `=` (it loads the value stored at the label) or a `mov` was written where `ldr xN, =label` was meant\"), stdout \"\"",
    "bare_no_entry: hosted false, trampolines [], exit None, steps 31, pc 0x40004c, x0 0x2a, error Some(\"execution ran past the last instruction of the program. main needs a `ret` (with an epilogue if it pushed one) or an exit call as its final step\"), stdout \"\"",
    "bare_prefix: hosted false, trampolines [], exit None, steps 31, pc 0x40004c, x0 0x2a, error Some(\"execution ran past the last instruction of the program. main needs a `ret` (with an epilogue if it pushed one) or an exit call as its final step\"), stdout \"\"",
];

#[test]
fn a_program_with_its_own_atol_loads_and_runs_as_it_did() {
    let got: Vec<String> = own_atol_programs()
        .iter()
        .map(|(label, source)| format!("{label}: {}", load_and_run(source)))
        .collect();
    assert_eq!(got.len(), OWN_ATOL_RUNS.len(), "one line per program: {got:#?}");
    for (got, want) in got.iter().zip(OWN_ATOL_RUNS) {
        assert_eq!(got, want);
    }
}

/// Directive-free programs that spell `atol` without a directive to make
/// them hosted. Detection reads no stub after `__isoc99_scanf`, so each
/// loads and runs as it did before the library had `atol`:
/// - `bl atol` in a comment of each form the assembler takes (`//`, `;`, and
///   `/* */` on its own line, after code and over several lines);
/// - a program's own `atol` defined as `atol :`, `atol<TAB>:` or `ATOL :`;
/// - `// bl atol` or `; bl atol` on a line with m4 quotes. m4 reads these
///   four in GNU m4's order, so they run, and their path stays the
///   bare-metal one.
const ATOL_SPELLINGS: &[(&str, &str)] = &[
    ("line_slashes", "// bl atol\n        mov     x0, 5\n        mov     x8, 93\n        svc     0\n"),
    ("tail_slashes", "        mov     x0, 5 // bl atol\n        mov     x8, 93\n        svc     0\n"),
    ("line_semicolon", "; bl atol\n        mov     x0, 5\n        mov     x8, 93\n        svc     0\n"),
    ("tail_semicolon", "        mov     x0, 5 ; bl atol\n        mov     x8, 93\n        svc     0\n"),
    ("line_block", "/* bl atol */\n        mov     x0, 5\n        mov     x8, 93\n        svc     0\n"),
    ("tail_block", "        mov     x0, 5 /* bl atol */\n        mov     x8, 93\n        svc     0\n"),
    ("lines_block", "/* the call\n        bl      atol\n   is not made */\n        mov     x0, 5\n        mov     x8, 93\n        svc     0\n"),
    ("block_main", "/* bl atol */\nmain:   mov     x0, 5\n        mov     x8, 93\n        svc     0\n"),
    ("block_start_lr", "/* bl atol */\n_start: mov     x0, x30\n        and     x0, x0, 0xff\n        mov     x8, 93\n        svc     0\n"),
    ("own_space_colon", "        mov     x0, 5\n        bl      atol\n        mov     x8, 93\n        svc     0\natol :  mov     x0, 7\n        ret\n"),
    ("own_space_colon_start", "_start: mov     x0, 5\n        bl      atol\n        mov     x8, 93\n        svc     0\natol :  mov     x0, 7\n        ret\n"),
    ("own_space_colon_main", "main:   mov     x0, 5\n        bl      atol\n        mov     x8, 93\n        svc     0\natol :  mov     x0, 7\n        ret\n"),
    ("own_tab_colon", "        mov     x0, 5\n        bl      atol\n        mov     x8, 93\n        svc     0\natol\t:  mov     x0, 7\n        ret\n"),
    ("own_upper_space_colon", "        mov     x0, 5\n        bl      atol\n        mov     x8, 93\n        svc     0\nATOL :  mov     x0, 7\n        ret\n"),
    ("quoted_slashes", "        mov     x0, `5' // bl atol\n        mov     x8, 93\n        svc     0\n"),
    ("quoted_slashes_start_lr", "_start: mov     x0, `x30' // bl atol\n        and     x0, x0, 0xff\n        mov     x8, 93\n        svc     0\n"),
    ("quoted_slashes_main", "main:   mov     x0, `5' // bl atol\n        mov     x8, 93\n        svc     0\n"),
    ("quoted_semicolon", "        mov     x0, `5' ; bl atol\n        mov     x8, 93\n        svc     0\n"),
];

/// One line per program from `load_and_run`, each as d312a96f's emulator
/// gave it, but for the four with m4 quotes, which it refused: each runs as
/// the same program with no quotes does.
const ATOL_SPELLINGS_RUNS: &[&str] = &[
    "line_slashes: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "tail_slashes: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "line_semicolon: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "tail_semicolon: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "line_block: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "tail_block: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "lines_block: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "block_main: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "block_start_lr: hosted false, trampolines [], exit Some(0), steps 4, pc 0x400010, x0 0x0, error None, stdout \"\"",
    "own_space_colon: hosted false, trampolines [], exit Some(7), steps 6, pc 0x400010, x0 0x7, error None, stdout \"\"",
    "own_space_colon_start: hosted false, trampolines [], exit Some(7), steps 6, pc 0x400010, x0 0x7, error None, stdout \"\"",
    "own_space_colon_main: hosted false, trampolines [], exit Some(7), steps 6, pc 0x400010, x0 0x7, error None, stdout \"\"",
    "own_tab_colon: hosted false, trampolines [], exit Some(7), steps 6, pc 0x400010, x0 0x7, error None, stdout \"\"",
    "own_upper_space_colon: hosted false, trampolines [], exit Some(7), steps 6, pc 0x400010, x0 0x7, error None, stdout \"\"",
    "quoted_slashes: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "quoted_slashes_start_lr: hosted false, trampolines [], exit Some(0), steps 4, pc 0x400010, x0 0x0, error None, stdout \"\"",
    "quoted_slashes_main: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
    "quoted_semicolon: hosted false, trampolines [], exit Some(5), steps 3, pc 0x40000c, x0 0x5, error None, stdout \"\"",
];

#[test]
fn programs_that_spell_atol_load_and_run_as_before_the_stub() {
    let got: Vec<String> = ATOL_SPELLINGS
        .iter()
        .map(|(label, source)| format!("{label}: {}", load_and_run(source)))
        .collect();
    assert_eq!(got.len(), ATOL_SPELLINGS_RUNS.len(), "one line per program: {got:#?}");
    for (got, want) in got.iter().zip(ATOL_SPELLINGS_RUNS) {
        assert_eq!(got, want);
    }
}

/// With no directive, `bl atol` alone does not make a program hosted, so a
/// bare-metal `_start` program that calls the library's `atol` is refused,
/// as it was before the library had one.
#[test]
fn a_bare_start_program_that_calls_the_librarys_atol_is_refused_as_before() {
    let source = "_start: sub     sp, sp, 16\n        mov     x9, 0x3234\n        str     x9, [sp]\n        mov     x0, sp\n        bl      atol\n        mov     x8, 93\n        svc     0\n";
    assert_eq!(
        load_and_run(source),
        "hosted false, not built: assembly error at line 5: undefined reference to `atol'\n\
         no line defines `atol:`: check the spelling, and check that the label line ends with a `:`"
    );
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
