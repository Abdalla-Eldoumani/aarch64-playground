//! Server-parity regression suite. Every behavior here was verified
//! against the real course toolchain -- GAS + glibc + GNU m4 on the
//! U of C ARM servers (and cross-checked under qemu-user with the same
//! toolchain) -- before it was implemented. Each test pins one behavior
//! a syntactically valid course program depends on, so a regression
//! shows up as a program that works on the servers but not here.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// Assemble, load, feed stdin, run to a halt, and hand back the CPU and
/// everything the program printed.
fn run_with_stdin(source: &str, stdin: &str) -> (Cpu, String) {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");
    cpu.push_stdin(stdin.as_bytes());
    cpu.close_stdin();
    let result = cpu.run_until_break(2_000_000).expect("run");
    assert!(result.halted, "program did not halt");
    let out = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    (cpu, out)
}

// GAS resolves a locally-defined label used inside an instruction's
// immediate field to the label's offset WITHIN ITS OWN SECTION, at
// assembly time, with no relocation: `.bss` symbol at section offset 24
// encodes as `#0x18` in both `add` and `ldr` (verified with objdump on
// the servers' GAS 2.46). Assignment solutions lean on this when they
// write `add x1, fp, a_local` / `ldr x19, [fp, a_local]` around scanf:
// both sides fold to the same small frame offset, so the program is
// self-consistent and runs.
#[test]
fn bss_label_as_immediate_resolves_to_section_offset() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
in_fmt:         .string "%ld"
out_fmt:        .string "%ld\n"

        .bss
scratch:        .skip 16
slot:           .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        ldr     x0, =in_fmt
        add     x1, fp, slot
        bl      scanf
        ldr     x19, [fp, slot]

        add     x19, x19, 1
        ldr     x0, =out_fmt
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 32
        ret
"#;
    // `slot` sits at .bss offset 16, so scanf writes [fp, 16] and the
    // load reads it back: input 41 prints 42. Under the old absolute
    // resolution the ldr refused to assemble ("offset out of range").
    let (_, out) = run_with_stdin(source, "41\n");
    assert_eq!(out, "42\n");
}

// The same rule reaches `.data` labels and plain arithmetic contexts:
// `cmp` against a label compares against its section offset, and
// `label + constant` folds before encoding (GAS emits `#0xb` for a
// symbol at offset 3 plus 8).
#[test]
fn data_label_immediates_fold_in_cmp_and_arithmetic() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%ld\n"

        .bss
pad:            .skip 24
mark:           .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 24
        cmp     x19, mark
        b.ne    wrong
        mov     x20, mark + 8
        b       print
wrong:
        mov     x20, 0
print:
        ldr     x0, =fmt
        mov     x1, x20
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    // mark = .bss offset 24: the cmp takes the equal branch and
    // mark + 8 folds to 32.
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "32\n");
}

// `.` inside an instruction immediate is section-relative too, so
// `. - label` measures the plain byte distance. Mixing an absolute `.`
// with section-relative labels folded `. - main` to a 4 MiB-ish number
// and refused to encode.
#[test]
fn dot_in_immediates_stays_section_relative() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%ld\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x1, . - main
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    // The mov sits 8 bytes past main.
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "8\n");
}

// `.space` is the GAS spelling course solutions use alongside `.skip`;
// both reserve N bytes, and a second operand fills them (low byte) in a
// data section. In `.bss` GAS ignores a fill and zero-fills.
#[test]
fn space_directive_reserves_and_fills() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
filled:         .space 4, 7
fmt:            .string "%d %d\n"

        .bss
gap:            .space 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =filled
        ldrb    w1, [x9]
        ldrb    w2, [x9, 3]
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "7 7\n");
}
