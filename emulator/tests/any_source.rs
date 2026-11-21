//! Any byte string up to the editor's source cap goes through the lint
//! pass and both assemblers, and loads when it assembles, without a panic.
//! An error result is fine; only a panic fails. A quarter of the sources are
//! random bytes, the rest lines built from assembly tokens, many of them
//! valid so the parser gets deep. The entry points take `&str`, so the
//! bytes become text the way a file read does (each invalid sequence turns
//! into U+FFFD) and are cut back to the cap. The fixed seed repeats every
//! case in order.

use std::panic::{catch_unwind, AssertUnwindSafe};

use aarch64_emulator::assembler::{self, SUPPORTED_MNEMONICS};
use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frames::check::check_source;
use aarch64_emulator::frames::layout::frame_layout;
use aarch64_emulator::frontend::lint::lint;
use aarch64_emulator::frontend::parser::DIRECTIVES;
use aarch64_emulator::frontend::pipeline::assemble_hosted;
use aarch64_emulator::hosted::STUBS;

const SEED: u64 = 0x0A64_D0DE_5EED_0002;
/// Sized to keep the cargo test job inside its usual time.
const CASES: u64 = 4_000;
/// The editor's limit, `MAX_SOURCE_BYTES` in web/lib/playground/upload-guard.ts.
const SOURCE_CAP: usize = 1024 * 1024;

const REGISTERS: &[&str] = &[
    "x0", "x1", "x9", "x19", "x29", "x30", "x31", "w0", "w8", "w30", "w32", "sp", "wsp", "xzr",
    "wzr", "fp", "lr", "d0", "d31", "s1", "h2", "b3", "q4", "v0.16b", "v1.8h", "v2.4s", "v3.2d",
    "v4.d[1]", "v5.s[3]", "{v0.4s, v1.4s}",
];
const NUMBERS: &[&str] = &[
    "0", "1", "-1", "#0", "#1", "#-1", "#4095", "#4096", "#65535", "#0x7fffffffffffffff",
    "0xffffffffffffffff", "18446744073709551616", "-9223372036854775808", "0b1011", "0777",
    "1.5", "-0.0", "1e308", "#1.0e-320", "'a'", "0x", "#",
];
const M4: &[&str] = &[
    "define(", "`", "'", "dnl", "undefine(", "ifelse(", "ifdef(", "eval(", "incr(", "len(",
    "substr(", "index(", "translit(", "changequote(", "divert(", "include(", "$1", "$#", "$@",
    "define(`r', `r')", "define(`a', `a a')",
];
const PUNCTUATION: &[&str] = &[
    "[", "]", "{", "}", ",", "!", "#", ":", "=", "+", "-", "*", "/", "%", "(", ")", "<<", ">>",
    "&", "|", "^", "~", "\"", "\\", ";", "//", "/*", "*/", "@", ":lo12:", "lsl", "asr", "sxtw",
    "\t",
];
const NAMES: &[&str] = &["main", "loop", "fmt", "arr", "1f", "1b", ".L1", "_start", "x_s", "base"];
/// Lines that assemble, so a source made mostly of them breaks deep inside.
const VALID: &[&str] = &[
    "    mov x0, 1",
    "    add x1, x2, x3, lsl 2",
    "    sub w4, w5, 7",
    "    cmp x0, 10",
    "    b.ne loop",
    "    cbz x1, loop",
    "    bl printf",
    "    ldr x0, [x29, 16]",
    "    str w1, [sp, -16]!",
    "    stp x29, x30, [sp, -32]!",
    "    ldp x29, x30, [sp], 32",
    "    adrp x0, fmt",
    "    add x0, x0, :lo12:fmt",
    "    madd x0, x1, x2, x3",
    "    csel x0, x1, x2, lt",
    "    ubfx x0, x1, 4, 8",
    "    fadd d0, d1, d2",
    "    fmov s0, 1.5",
    "    scvtf d1, x2",
    "    add v0.4s, v1.4s, v2.4s",
    "    ret",
    "    .string \"%d\\n\"",
    "    .word 1, 2, 3",
    "    .balign 8",
    "    .text",
    "define(i_r, x19)",
    "    mov i_r, 5",
    "size = 8 * 4",
    "    sub sp, sp, size",
];

/// splitmix64: a few lines, no dependency, and a good stream from any seed.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }

    fn pick<'a>(&mut self, from: &[&'a str]) -> &'a str {
        from[self.below(from.len())]
    }
}

fn name(rng: &mut Rng) -> &'static str {
    if rng.below(4) == 0 {
        STUBS[rng.below(STUBS.len())].name
    } else {
        rng.pick(NAMES)
    }
}

fn operand(rng: &mut Rng) -> String {
    match rng.below(6) {
        0 | 1 => rng.pick(REGISTERS).to_string(),
        2 => rng.pick(NUMBERS).to_string(),
        3 => name(rng).to_string(),
        4 => format!("[{}, {}]{}", rng.pick(REGISTERS), rng.pick(NUMBERS), rng.pick(&["", "!"])),
        _ => format!("{} {}", rng.pick(&["lsl", "lsr", "uxtw", "sxtw"]), rng.pick(NUMBERS)),
    }
}

/// One line: an instruction, a label, a directive, an m4 define, an equate,
/// or a soup of tokens from every list.
fn line(rng: &mut Rng) -> String {
    match rng.below(10) {
        0 => format!("{}:", name(rng)),
        1 => format!("{} {}, {}", rng.pick(DIRECTIVES), operand(rng), rng.pick(&["\"%d\\n\"", "\"x", "8"])),
        2 => format!("define({}, {})", name(rng), operand(rng)),
        3 => format!("{} = {} {} {}", name(rng), rng.pick(NUMBERS), rng.pick(PUNCTUATION), rng.pick(NUMBERS)),
        4 => {
            let pools = [REGISTERS, NUMBERS, M4, PUNCTUATION, NAMES, SUPPORTED_MNEMONICS, DIRECTIVES];
            let count = 1 + rng.below(8);
            let soup: Vec<&str> = (0..count).map(|_| {
                let pool = pools[rng.below(pools.len())];
                rng.pick(pool)
            }).collect();
            soup.join(rng.pick(&[" ", ", ", ""]))
        }
        _ => {
            let operands: Vec<String> = (0..rng.below(5)).map(|_| operand(rng)).collect();
            format!("    {} {}", rng.pick(SUPPORTED_MNEMONICS), operands.join(", "))
        }
    }
}

/// Lines up to `len` bytes, half of them under a hosted header that
/// defines the names `VALID` uses, and a quarter with a few bytes changed
/// so a token breaks mid-word. A source takes none, 90% or 99% of its lines
/// from `VALID`.
fn token_bytes(rng: &mut Rng, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len + 64);
    if rng.below(2) == 0 {
        out.extend_from_slice(b"define(i_r, x19)\nsize = 8 * 4\n.data\nfmt: .string \"%d\\n\"\n.text\n.global main\nmain:\nloop:\n");
    }
    let valid_percent = [0, 90, 99][rng.below(3)];
    while out.len() < len {
        if rng.below(100) < valid_percent {
            out.extend_from_slice(rng.pick(VALID).as_bytes());
        } else {
            out.extend_from_slice(line(rng).as_bytes());
        }
        out.push(b'\n');
    }
    if rng.below(4) == 0 {
        for _ in 0..1 + rng.below(8) {
            let at = rng.below(out.len() + 1);
            match rng.below(3) {
                0 => out.insert(at, rng.next() as u8),
                1 if at < out.len() => {
                    out.remove(at);
                }
                _ if at < out.len() => out[at] = rng.next() as u8,
                _ => {}
            }
        }
    }
    out.truncate(len);
    out
}

/// The case's source and whether it came from tokens. Cases 0 and 1 sit at
/// the cap; the rest are mostly short, and one in 64 reaches toward the cap.
fn source(case: u64) -> (String, bool) {
    let mut rng = Rng(SEED.wrapping_add(case));
    let from_tokens = if case < 2 { case == 1 } else { rng.below(4) != 0 };
    let len = if case < 2 {
        SOURCE_CAP
    } else {
        let bits = if rng.below(64) == 0 { 20 } else { rng.below(13) };
        rng.below((1 << bits) + 1)
    };
    let bytes = if from_tokens {
        token_bytes(&mut rng, len)
    } else {
        (0..len).map(|_| rng.next() as u8).collect()
    };
    let mut text = String::from_utf8_lossy(&bytes).into_owned();
    text.truncate(text.floor_char_boundary(SOURCE_CAP));
    (text, from_tokens)
}

/// Lint and assemble as the playground does, through both assemblers
/// rather than only the one it would pick.
fn one_source(text: &str) {
    let mut cpu = Cpu::new();
    lint(text);
    check_source(text, &cpu.host);
    if let Ok(image) = assemble_hosted(text, &cpu.host) {
        if cpu.load_linked_image(&image).is_ok() {
            frame_layout(text, &image, &cpu.mem);
        }
    }
    if let Ok(code) = assembler::assemble(text) {
        cpu.load_program(&code);
    }
}

#[test]
fn any_source_lints_and_assembles_without_a_panic() {
    for case in 0..CASES {
        let (text, from_tokens) = source(case);
        if catch_unwind(AssertUnwindSafe(|| one_source(&text))).is_err() {
            let kind = if from_tokens { "tokens" } else { "random bytes" };
            panic!(
                "a {}-byte source of {kind} panicked: seed {SEED:#x}, case {case} of {CASES}",
                text.len()
            );
        }
    }
}
