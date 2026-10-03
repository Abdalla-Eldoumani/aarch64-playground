//! Behaviour of the course's ARM servers (GAS, glibc and GNU m4), each
//! case checked there before it was built here. A failure means a program
//! that runs on the servers no longer runs the same way in the playground.

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

// GAS turns a label used as an immediate into its offset inside its own
// section: a `.bss` label 24 bytes in encodes as `#0x18` in both `add` and
// `ldr`. Student code writes `add x1, fp, a_local` and
// `ldr x19, [fp, a_local]` around scanf, and it runs because both get the
// same small offset.
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

// `.` (the current address) inside an immediate is section-relative too, so
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

/// Run a source expecting a calm halt with an abort message; hand the
/// message back for the caller's assertions.
fn run_expect_halt_message(source: &str) -> (Cpu, String) {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");
    cpu.close_stdin();
    let result = cpu.run_until_break(2_000_000).expect("run never panics");
    assert!(result.halted, "expected a calm halt");
    let message = cpu.abort_message.clone().unwrap_or_default();
    (cpu, message)
}

// Linux never maps the first page, so a store through a base register
// that is zero crashes on the servers (SIGSEGV). Here an m4 alias
// (`define(i_r, w19)`) zeroes the register the array address was just
// loaded into; the emulator used to map any page on write, so this ran on
// to a wrong answer instead.
#[test]
fn store_through_a_zeroed_base_register_halts_like_the_servers() {
    let source = r#"
define(fp, x29)
define(lr, x30)
define(i_r, w19)

        .data
fmt:            .string "a[%d] = %d\n"

        .bss
arr:            .skip 40

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =arr
        mov     i_r, 0
fill:
        cmp     i_r, 10
        b.ge    done
        add     w9, i_r, 1
        str     w9, [x19, i_r, SXTW 2]
        add     i_r, i_r, 1
        b       fill

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (mut cpu, message) = run_expect_halt_message(source);
    assert!(
        message.contains("segmentation") && message.contains("m4 alias"),
        "message names the servers' behavior and the likely cause: {message}"
    );
    assert_eq!(
        String::from_utf8_lossy(&cpu.take_stdout()),
        "",
        "nothing prints before the fault, as on real hardware"
    );
}

// Linux turns on SA0, the stack alignment check: a load or store through
// an SP that is not a multiple of 16 is a bus error on the servers (exit
// 135). The check reads SP before any `!` update, so `stp ..., [sp, -8]!`
// from an aligned SP passes and the next access through SP faults.
#[test]
fn misaligned_sp_access_halts_like_the_servers() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     sp, sp, 8
        str     x19, [sp]
        add     sp, sp, 8
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, message) = run_expect_halt_message(source);
    assert!(
        message.contains("multiple of 16") && message.starts_with("Bus error"),
        "message names the rule and the servers' behavior: {message}"
    );
}

// The same rule at a call: `bl printf` with SP off a 16-byte boundary
// dies inside glibc on the servers, so the emulator stops at the call.
#[test]
fn misaligned_sp_at_a_libc_call_halts_with_the_call_wording() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "n = %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     sp, sp, 8
        ldr     x0, =fmt
        mov     w1, 7
        bl      printf
        add     sp, sp, 8
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (mut cpu, message) = run_expect_halt_message(source);
    assert!(
        message.contains("at this call"),
        "the call-boundary wording points at the bl: {message}"
    );
    assert_eq!(String::from_utf8_lossy(&cpu.take_stdout()), "");
}

// An offset from an ALIGNED sp is legal whatever the offset's own
// alignment: SA0 checks the stack pointer, not the address it points to
// once the offset is added.
#[test]
fn aligned_sp_with_odd_offsets_still_runs() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        mov     w9, 42
        str     w9, [sp, 20]
        ldr     w1, [sp, 20]
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 32
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "42\n");
}

// rand() must give glibc's exact sequence: programs print unseeded draws
// and students compare the playground's output with a run on the
// servers. The values below were captured there.
#[test]
fn unseeded_and_seeded_rand_match_glibc() {
    let source = r#"
define(fp, x29)
define(lr, x30)
define(i_r, w19)

        .data
fmt:            .string "%d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 0
loop1:
        cmp     i_r, 5
        b.ge    reseed
        bl      rand
        mov     w1, w0
        ldr     x0, =fmt
        bl      printf
        add     i_r, i_r, 1
        b       loop1

reseed:
        mov     w0, 42
        bl      srand
        mov     i_r, 0
loop2:
        cmp     i_r, 3
        b.ge    done
        bl      rand
        mov     w1, w0
        ldr     x0, =fmt
        bl      printf
        add     i_r, i_r, 1
        b       loop2

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(
        out,
        "1804289383\n846930886\n1681692777\n1714636915\n1957747793\n\
         71876166\n708592740\n1483128881\n"
    );
}

// Linux never starts a process with argc = 0: argv[0] is the program
// path. Assignment solutions gate on `cmp argc, 3` and print usage,
// dereferencing argv[0], when the count is wrong; with no arguments
// the emulator used to hand them argc = 0 and argv = NULL, so the
// usage path faulted at address 0 instead of printing.
#[test]
fn usage_gate_reads_argv0_with_no_arguments() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
use_fmt:        .string "usage: %s a b\n"
sum_fmt:        .string "%ld\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        cmp     w0, 3
        b.ne    usage

        mov     x19, x1
        ldr     x0, [x19, 8]
        bl      atoi
        mov     w20, w0
        ldr     x0, [x19, 16]
        bl      atoi
        add     w1, w20, w0
        sxtw    x1, w1
        ldr     x0, =sum_fmt
        bl      printf
        b       done

usage:
        ldr     x0, =use_fmt
        ldr     x1, [x1, 0]
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    // No arguments: argc = 1, the usage path prints argv[0].
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");
    let r = cpu.run_until_break(2_000_000).expect("run");
    assert!(r.halted);
    assert_eq!(
        String::from_utf8_lossy(&cpu.take_stdout()),
        "usage: ./program a b\n"
    );

    // Two arguments: argc = 3, the compute path runs.
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image_with_args(&image, &["19", "23"])
        .expect("load");
    let r = cpu.run_until_break(2_000_000).expect("run");
    assert!(r.halted);
    assert_eq!(String::from_utf8_lossy(&cpu.take_stdout()), "42\n");
}

// GAS accepts `ldr <reg>, <label>`, LDR (literal), a load FROM the
// label's address, and course code writes it alongside `ldr =label`.
// The value must be read at run time: this program stores to the label
// first and loads it back through the literal form.
#[test]
fn ldr_label_literal_load_reads_memory_at_run_time() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%ld\n"
n_var:          .quad 0

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =n_var
        mov     x10, 7
        str     x10, [x9]

        ldr     x19, n_var
        ldr     x0, =fmt
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "7\n");
}

// The same form reaches W and the fp registers (`ldr d0, label`), and a
// label in `.bss`, 3 MiB from .text and far past the 1 MiB a real
// LDR (literal) can reach, still loads.
#[test]
fn ldr_label_literal_load_covers_w_d_and_bss() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%d %.1f\n"
d_var:          .double 2.5

        .bss
w_var:          .skip 4

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =w_var
        mov     w10, 42
        str     w10, [x9]

        ldr     w1, w_var
        ldr     d0, d_var
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "42 2.5\n");
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

// GAS reads a leading zero as octal inside an instruction, exactly as it
// does in a data directive: `mov w1, 052` loads 42 and `017` is 15. The
// operand reached the encoder as plain text and was read as decimal, so
// one literal meant two numbers depending on where it was written. A lone
// `0` stays zero, and `018` is refused rather than read as eighteen.
#[test]
fn leading_zero_instruction_immediates_are_octal() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%d %d %d %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt
        mov     w1, 052
        mov     w2, 010
        add     w3, w2, 017
        mov     w4, 0
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "42 8 23 0\n");

    let bad = source.replace("mov     w1, 052", "mov     w1, 018");
    let cpu = Cpu::new();
    let err = assemble_hosted(&bad, &cpu.host).expect_err("018 is not octal").to_string();
    assert!(err.contains("018") && err.contains("octal"), "message was: {err}");
}

// Linux maps a whole .bss (and .data) as zero-filled pages, so a read of
// a page no store ever touched answers 0 on the servers. The emulator maps
// pages on first write, and a read past the first 4 KiB of a big .bss
// used to fault as an unmapped access.
#[test]
fn an_untouched_bss_page_reads_as_zero() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%ld %ld\n"

        .bss
        .balign 8
table:          .skip 20000

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =table
        mov     x10, 5
        str     x10, [x9]               // the first page, written
        ldr     x1, [x9]
        add     x9, x9, 16384
        ldr     x2, [x9]                // four pages on, never written
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "5 0\n");
}

// gcc ends a function whose last act is a libc call with `b printf`, a
// sibling call: printf returns straight to that function's caller. The
// linker only redirected `bl`, so the branch had no target in reach.
#[test]
fn a_tail_call_into_libc_returns_to_the_callers_caller() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "tail %d\n"

        .text
        .balign 4
say:
        mov     w1, w0
        ldr     x0, =fmt
        b       printf

        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 7
        bl      say
        mov     w0, 9
        bl      say

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (cpu, out) = run_with_stdin(source, "");
    assert_eq!(out, "tail 7\ntail 9\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

// gcc plants `brk #1000` where it proved the code can only fault (a use
// of a pointer that is NULL on that path). On the servers the shell
// reports `Trace/breakpoint trap` and the output before it survives.
#[test]
fn brk_stops_with_the_servers_trap_wording() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
msg:            .string "before"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =msg
        bl      puts
        brk     #1000
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (mut cpu, message) = run_expect_halt_message(source);
    assert!(message.starts_with("Trace/breakpoint trap"), "message was: {message}");
    assert!(message.contains("brk #1000"), "message names the instruction: {message}");
    assert_eq!(String::from_utf8_lossy(&cpu.take_stdout()), "before\n");
}

// LONG_MIN has no positive twin, so gcc writes it as the negative decimal
// literal `-9223372036854775808` in both `mov` and `.quad`. GAS takes it;
// the lexer read the digits as a positive i64 first and overflowed.
#[test]
fn long_min_is_a_literal_gas_accepts() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%ld %ld %ld\n"
        .balign 8
low:            .quad -9223372036854775808

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x1, -9223372036854775808
        ldr     x9, =low
        ldr     x2, [x9]
        mov     x3, -4607182418800017408
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "-9223372036854775808 -9223372036854775808 -4607182418800017408\n");
}

// gcc names an offset into a section with a dotted equate
// (`.LANCHOR2 = . + 4352`); GAS takes a name starting with a dot on the
// left of `=` the same as any other, and the parser read it as an
// unknown directive.
#[test]
fn a_dotted_name_can_be_an_equate() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%ld\n"
        .balign 8
vals:           .quad 10, 20, 30
.Lthird = vals + 16

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =.Lthird
        ldr     x1, [x9]
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "30\n");
}

// gcc -O2 names the copy of a function it specializes `twice.constprop.0`,
// and GAS takes a dot anywhere after a symbol's first character. The lexer
// ended the name at the first dot, so the label line was refused as having
// nothing to assemble, and a student pasting gcc's output hit that wall.
#[test]
fn a_gcc_clone_name_is_a_label() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%d\n"

        .text
        .balign 4
twice.constprop.0:
        lsl     w0, w0, 1
        ret

        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 21
        bl      twice.constprop.0
        mov     w1, w0
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "42\n");
}

// The other dotted names gcc writes: `.isra.0`, `.part.0` and `.cold`
// clones, stacked suffixes, and static locals (`count.0`), reached as a
// `bl`, `b`, `adr` and `blr` target, through `ldr =`, `adrp` with `:lo12:`,
// and from a `.quad` slot.
#[test]
fn every_gcc_dotted_name_resolves_wherever_a_label_can_go() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%d %d %d %d\n"
        .balign 8
where:          .quad hits.12
count.0:        .word 5
hits.12:        .word 7

        .text
        .balign 4
bump.isra.0:
        add     w0, w0, 1
        ret
half.part.0:
        asr     w0, w0, 1
        ret
pick.constprop.0.isra.0:
        b       half.part.0
fail.cold:
        mov     w0, 99
        ret

        .global main
main:
        stp     fp, lr, [sp, -48]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]

        ldr     x9, =count.0
        ldr     w0, [x9]
        bl      bump.isra.0
        mov     w19, w0

        ldr     x9, =where
        ldr     x9, [x9]
        ldr     w0, [x9]
        bl      pick.constprop.0.isra.0
        mov     w20, w0

        adrp    x9, hits.12
        add     x9, x9, :lo12:hits.12
        ldr     w21, [x9]

        adr     x9, fail.cold
        blr     x9
        mov     w4, w0

        mov     w3, w21
        mov     w2, w20
        mov     w1, w19
        ldr     x0, =fmt
        bl      printf

        ldp     x21, x22, [sp, 32]
        ldp     x19, x20, [sp, 16]
        mov     w0, 0
        ldp     fp, lr, [sp], 48
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "6 3 7 99\n");
}

// gcc -O2 turns a dense switch into a table of 2-byte entries, each the
// distance in instructions from a base label,
// `.2byte (.Lcase - .Lbase) / 4`, read with ldrh and sign-extended by
// `sxth`. The lexer split `.2byte` at its digit and refused it as the
// integer `2b`. Case 3 sits above the base, so its entry is negative and
// only the sign extension reaches it.
#[test]
fn a_halfword_jump_table_dispatches_every_case() {
    let source = r#"
        .section .rodata
fmt:    .string "%d %d %d %d\n"

        .text
        .balign 4
.Lcase3:
        mov     w0, 44
        ret
pick:
        adrp    x1, .Ltab
        add     x1, x1, :lo12:.Ltab
        ldrh    w1, [x1, w0, uxtw #1]
        adr     x2, .Lbase
        add     x1, x2, w1, sxth #2
        br      x1
.Lbase:
        .section .rodata
        .balign 2
.Ltab:
        .2byte  (.Lcase0 - .Lbase) / 4
        .2byte  (.Lcase1 - .Lbase) / 4
        .2byte  (.Lcase2 - .Lbase) / 4
        .2byte  (.Lcase3 - .Lbase) / 4
        .text
.Lcase0:
        mov     w0, 11
        ret
.Lcase1:
        mov     w0, 22
        ret
.Lcase2:
        mov     w0, 33
        ret

        .global main
main:
        stp     x29, x30, [sp, -32]!
        mov     x29, sp
        stp     x19, x20, [sp, 16]
        mov     w0, 3
        bl      pick
        mov     w19, w0
        mov     w0, 0
        bl      pick
        mov     w20, w0
        mov     w0, 2
        bl      pick
        mov     w3, w0
        mov     w0, 1
        bl      pick
        mov     w4, w0
        mov     w2, w20
        mov     w1, w19
        adrp    x0, fmt
        add     x0, x0, :lo12:fmt
        bl      printf
        ldp     x19, x20, [sp, 16]
        mov     w0, 0
        ldp     x29, x30, [sp], 32
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "44 11 33 22\n");
}

// GAS's other sized data spellings: `.4byte` is `.word`, and `.8byte` and
// `.xword` (the one AArch64 gcc writes for every 8-byte value) are `.quad`, with label
// expressions as well as numbers.
#[test]
fn sized_data_directives_match_their_named_twins() {
    let source = r#"
        .section .rodata
fmt:    .string "%ld %lx %d %d %d\n"

        .data
        .balign 8
vals:   .8byte  -2, 0x1122334455667788
slot:   .xword  vals + 8
words:  .4byte  -3, 70000
        .4byte  .Lend - vals
.Lend:

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        adrp    x9, vals
        add     x9, x9, :lo12:vals
        ldr     x1, [x9]
        adrp    x10, slot
        add     x10, x10, :lo12:slot
        ldr     x10, [x10]
        ldr     x2, [x10]
        adrp    x11, words
        add     x11, x11, :lo12:words
        ldrsw   x3, [x11]
        ldr     w4, [x11, 4]
        ldr     w5, [x11, 8]
        adrp    x0, fmt
        add     x0, x0, :lo12:fmt
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "-2 1122334455667788 -3 70000 36\n");
}

// GAS's numeric local labels: `1:` may be defined any number of times, and
// `1b` / `1f` name the nearest definition above or below, in .text and in
// .data alike. The program and its output are the csarm run's.
#[test]
fn numeric_local_labels_name_the_nearest_definition() {
    let source = r#"
        .data
        .balign 8
2:      .quad   40                      // a local label in .data
10:     .quad   2                       // a two-digit one

        .text
fmt:    .string "sum %ld, count %ld, data %ld\n"
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     x19, 0                  // sum of 5 + 4 + 3 + 2 + 1
        mov     x20, 5
1:      add     x19, x19, x20
        subs    x20, x20, 1
        b.ne    1b                      // the 1: just above

        cbz     x19, 1f                 // never taken: the next 1: below
        mov     x21, 3
1:      sub     x21, x21, 1             // a second 1:
        cbnz    x21, 1b                 // the nearest 1: above is this one
        b       3f
        mov     x19, 99                 // skipped
3:      ldr     x9, =2b                 // the 2: in .data, above this line
        ldr     x22, [x9]
        ldr     x9, =10b
        ldr     x10, [x9]
        add     x22, x22, x10

        ldr     x0, =fmt
        mov     x1, x19
        mov     x2, x21
        mov     x3, x22
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "sum 15, count 0, data 42\n");
}

// `:lo12:` with its `#`, inside an address and as an add immediate, next
// to the older spelling without it. Output from the csarm run.
#[test]
fn lo12_takes_the_immediate_hash_like_gnu_as() {
    let source = r#"
        .data
        .balign 8
count:  .word   1234
        .balign 8                       // an 8-byte load needs an 8-aligned :lo12:
total:  .quad   -5

        .text
fmt:    .string "%d %d %ld %d\n"
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        adrp    x9, count
        ldr     w1, [x9, #:lo12:count]  // the word at count
        add     x10, x9, #:lo12:count   // count's address
        ldr     w2, [x10]
        adrp    x11, total
        ldr     x3, [x11, #:lo12:total]
        ldr     w4, [x9, :lo12:count]   // the same load without the #

        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "1234 1234 -5 1234\n");
}

// `.single` is GNU as's other spelling of `.float`. Output from csarm,
// the bits of 1.5 included.
#[test]
fn single_stores_the_same_bytes_as_float() {
    let source = r#"
        .data
        .balign 4
vals:   .single 1.5, -2.25
same:   .float  1.5
whole:  .single 3

        .text
fmt:    .string "%.2f %.2f %.2f bits %x %x\n"
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x9, =vals
        ldr     s0, [x9]
        ldr     s1, [x9, 4]
        ldr     x10, =whole
        ldr     s2, [x10]
        fcvt    d0, s0
        fcvt    d1, s1
        fcvt    d2, s2
        ldr     w1, [x9]                // 1.5 as .single
        ldr     x11, =same
        ldr     w2, [x11]               // 1.5 as .float

        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "1.50 -2.25 3.00 bits 3fc00000 3fc00000\n");
}

// gcc -S names scanf `__isoc99_scanf`; a call by that name reads the same
// way. Input and output from the csarm run.
#[test]
fn isoc99_scanf_is_scanf() {
    let source = r#"
        .text
fmt_in: .string "%ld %ld"
fmt_out: .string "read %d values: %ld + %ld = %ld\n"
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -32]!
        mov     x29, sp

        ldr     x0, =fmt_in
        add     x1, x29, 16
        add     x2, x29, 24
        bl      __isoc99_scanf

        mov     w1, w0                  // how many scanf filled
        ldr     x2, [x29, 16]
        ldr     x3, [x29, 24]
        add     x4, x2, x3
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 32
        ret
"#;
    let (_, out) = run_with_stdin(source, "40 2\n");
    assert_eq!(out, "read 2 values: 40 + 2 = 42\n");
}

// m4 macros with arguments, as GNU m4 expands them: a quoted body over
// three lines (an open subroutine), `$#` and `$*`, blanks before an
// argument dropped, the tenth argument, arguments past a define's body
// ignored, and arguments a body never uses swallowed. The program and its
// output are the csarm run's.
#[test]
fn m4_macros_take_arguments_like_gnu_m4() {
    let source = r#"// m4 macros that take arguments: $1 and $2 in the body stand for the
// arguments of each use, $# counts them and $* lists them.

define(fp, x29)
define(lr, x30)
define(t_r, x19)
define(k_r, x20)

define(tri_open, `add     $1, $2, 1
        mul     $1, $1, $2
        lsr     $1, $1, 1')
define(show, `.string "$# [$1] [$2] [$*]\n"')
define(tenth, `[$10]')
define(two, first, second)
define(plain, x21)

        .text
fmt:    .string "tri(%ld) = %ld, %ld\n"
msg1:   show(a, b,c)
msg2:   show( pad , y )
msg3:   show
msg4:   show(f(1, 2), z)
msg5:   .string "tenth(1,2,3,4,5,6,7,8,9,ten) two plain(ignored)\n"
        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     k_r, 10
        tri_open(t_r, k_r)
        mov     plain(skipped), 7
        ldr     x0, =fmt
        mov     x1, k_r
        mov     x2, t_r
        mov     x3, x21
        bl      printf

        ldr     x0, =msg1
        bl      printf
        ldr     x0, =msg2
        bl      printf
        ldr     x0, =msg3
        bl      printf
        ldr     x0, =msg4
        bl      printf
        ldr     x0, =msg5
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(
        out,
        "tri(10) = 55, 7\n3 [a] [b] [a,b,c]\n2 [pad ] [y ] [pad ,y ]\n0 [] [] []\n\
         2 [f(1, 2)] [z] [f(1, 2),z]\n[ten] first x21\n"
    );
    // The three lines the macro wrote all step as the line that used it.
    let image = assemble_hosted(source, &Cpu::new().host).expect("assemble");
    let call_line = source.lines().position(|l| l.contains("tri_open(t_r")).unwrap() as u32 + 1;
    assert_eq!(image.line_map.iter().filter(|(_, line)| *line == call_line).count(), 3);
    let after = image.line_map.iter().find(|(_, line)| *line > call_line).unwrap().1;
    assert_eq!(after, call_line + 1, "the lines below the call keep their numbers");
}

// A define whose quoted body spans three lines is one line of GNU m4's
// output. So after `m4 f.asm > f.s`, gcc names line 10 of f.s, as on
// csarm, while the editor, which assembles the source itself, marks line
// 12. The program and the message are the csarm run's.
#[test]
fn a_define_spanning_lines_is_one_line_of_m4_output() {
    use aarch64_emulator::errors::EmuError;
    use aarch64_emulator::frontend::m4::expand;

    let source = r#"// A define over three lines, then a line gas refuses: gcc names the
// line of m4's output, which the define makes two lines shorter.
define(tri_open, `add     $1, $2, 1
        mul     $1, $1, $2
        lsr     $1, $1, 1')

        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        movi    v0.8b, -129
        mov     x20, 10
        tri_open(x19, x20)
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let gas = "immediate value out of range -128 to 255 at operand 2 -- `movi v0.8b,-129'";
    let error_at = |text: &str| match assemble_hosted(text, &Cpu::new().host).err() {
        Some(EmuError::AssemblyError { line, message }) => (line, message),
        other => panic!("expected an assembler error, got {other:?}"),
    };
    let m4_out = expand(source).expect("m4").text;
    assert_eq!(m4_out.lines().nth(9), Some("        movi    v0.8b, -129"));
    let (line, message) = error_at(&m4_out);
    assert_eq!((line, message.lines().next()), (10, Some(gas)), "gcc f.s");
    let (line, message) = error_at(source);
    assert_eq!((line, message.lines().next()), (12, Some(gas)), "the editor");
}

// A known difference, kept on purpose. csarm assembles each file on its own,
// so a label without `.global` stays in its file and this pair fails to link:
// "undefined reference to `helper'". The playground joins a program's files
// into one source, as m4's include() does, which is how the shipped
// multi-file survivor game is built, so every label reaches every file.
#[test]
fn joined_files_share_labels_without_global() {
    let main = r#"// main calls helper, which lives in helper.s.

        .text
fmt:    .string "helper returned %ld\n"
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 20
        bl      helper
        mov     x1, x0
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let helper = r#"// helper doubles x0. It has no .global line.

        .text
        .balign 4
helper: add     x0, x0, x0
        ret
"#;
    // The join the playground's files strip makes.
    let joined = format!("{main}\n// ---- helper.s ----\n{helper}");
    let (_, out) = run_with_stdin(&joined, "");
    assert_eq!(out, "helper returned 40\n");
}

// gcc aligns functions and loop heads with `.p2align 5,,15`: pad to 2^5
// bytes, but only when that takes 15 bytes or fewer. The padding is
// executed in .text, so it must be no-ops. Each distance below is where
// GAS put the label, taken or skipped.
#[test]
fn p2align_pads_to_a_power_of_two_within_its_limit() {
    let source = r#"
        .section .rodata
fmt:    .string "%ld %ld %ld %ld %ld %ld %ld\n"

        .data
        .p2align 4
d0:     .byte   1
        .p2align 3
d1:     .byte   2
        .p2align 4,,7
d2:     .byte   3
        .p2align 4,,6
d3:     .byte   4
        .p2align 2,,3
d4:     .byte   5

        .text
        .p2align 5
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        .p2align 5,,15
t1:     nop
        .p2align 5,,31
t2:     nop
        .p2align 4
t3:     nop
        adr     x9, main
        adr     x1, t1
        sub     x1, x1, x9
        adr     x2, t2
        sub     x2, x2, x9
        adr     x3, t3
        sub     x3, x3, x9
        adrp    x9, d0
        add     x9, x9, :lo12:d0
        adrp    x4, d1
        add     x4, x4, :lo12:d1
        sub     x4, x4, x9
        adrp    x5, d2
        add     x5, x5, :lo12:d2
        sub     x5, x5, x9
        adrp    x6, d3
        add     x6, x6, :lo12:d3
        sub     x6, x6, x9
        adrp    x7, d4
        add     x7, x7, :lo12:d4
        sub     x7, x7, x9
        adrp    x0, fmt
        add     x0, x0, :lo12:fmt
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "8 32 48 8 16 17 20\n");
}

/// Reads one field with the format in place of FORMAT, then prints what
/// scanf returned, the 8 bytes at the destination (0x55 wherever nothing
/// was stored), and every byte of input it left.
const SCANF_PROBE: &str = r#"
define(fp, x29)
define(lr, x30)

        .data
        .balign 8
value:      .quad   0x5555555555555555
fmt_in:     .string "FORMAT"
fmt_out:    .string "ret=%d bits=%016lx rest=["
fmt_end:    .string "]\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in
        ldr     x1, =value
        bl      scanf

        mov     w1, w0
        ldr     x9, =value
        ldr     x2, [x9]
        ldr     x0, =fmt_out
        bl      printf

rest:   bl      getchar
        cmp     w0, -1
        b.eq    done
        bl      putchar
        b       rest

done:   ldr     x0, =fmt_end
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

// glibc's scanf reads `inf`, `infinity` and `nan` in any case, with a
// sign, and a NaN payload in parentheses. A field it cannot use whole
// (`in`, `1.5e`, `nan(1 2)`) fails and keeps what it read, and `%f` stores
// a 4-byte float. Each row is the server's output for that input.
#[test]
fn scanf_f_reads_inf_and_nan_like_glibc() {
    let none = "5555555555555555";
    let rows = [
        ("%lf", "inf\n", "ret=1 bits=7ff0000000000000 rest=[\n]\n".to_string()),
        ("%lf", "INF\n", "ret=1 bits=7ff0000000000000 rest=[\n]\n".into()),
        ("%lf", "-Infinity\n", "ret=1 bits=fff0000000000000 rest=[\n]\n".into()),
        ("%lf", "   -inf 7\n", "ret=1 bits=fff0000000000000 rest=[ 7\n]\n".into()),
        ("%lf", "infinityx\n", "ret=1 bits=7ff0000000000000 rest=[x\n]\n".into()),
        ("%lf", "inf5\n", "ret=1 bits=7ff0000000000000 rest=[5\n]\n".into()),
        ("%lf", "infin\n", format!("ret=0 bits={none} rest=[]\n")),
        ("%lf", "in\n", format!("ret=0 bits={none} rest=[]\n")),
        ("%3lf", "infinity\n", "ret=1 bits=7ff0000000000000 rest=[inity\n]\n".into()),
        ("%4lf", "infinity\n", format!("ret=0 bits={none} rest=[nity\n]\n")),
        ("%lf", "nan\n", "ret=1 bits=7ff8000000000000 rest=[\n]\n".into()),
        ("%lf", "NaN\n", "ret=1 bits=7ff8000000000000 rest=[\n]\n".into()),
        ("%lf", "-nan\n", "ret=1 bits=fff8000000000000 rest=[\n]\n".into()),
        ("%lf", "nanx\n", "ret=1 bits=7ff8000000000000 rest=[x\n]\n".into()),
        ("%lf", "nan(123)\n", "ret=1 bits=7ff800000000007b rest=[\n]\n".into()),
        ("%lf", "nan(0x7b)\n", "ret=1 bits=7ff800000000007b rest=[\n]\n".into()),
        ("%lf", "nan(017)\n", "ret=1 bits=7ff800000000000f rest=[\n]\n".into()),
        ("%lf", "nan(a_Z9)\n", "ret=1 bits=7ff8000000000000 rest=[\n]\n".into()),
        ("%lf", "nan(1 2)\n", format!("ret=0 bits={none} rest=[2)\n]\n")),
        ("%f", "inf\n", "ret=1 bits=555555557f800000 rest=[\n]\n".into()),
        ("%f", "-nan\n", "ret=1 bits=55555555ffc00000 rest=[\n]\n".into()),
        ("%f", "nan(123)\n", "ret=1 bits=555555557fc0007b rest=[\n]\n".into()),
        ("%lf", "2.5\n", "ret=1 bits=4004000000000000 rest=[\n]\n".into()),
        ("%lf", "1.5e\n", format!("ret=0 bits={none} rest=[\n]\n")),
        ("%lf", "1e5e\n", "ret=1 bits=40f86a0000000000 rest=[e\n]\n".into()),
        ("%lf", "-\n", format!("ret=0 bits={none} rest=[\n]\n")),
        ("%lf", "-", format!("ret=0 bits={none} rest=[]\n")),
        ("%lf", "  \n", format!("ret=-1 bits={none} rest=[]\n")),
    ];
    for (format, input, want) in rows {
        let (_, out) = run_with_stdin(&SCANF_PROBE.replace("FORMAT", format), input);
        assert_eq!(out, want, "scanf(\"{format}\") reading {input:?}");
    }
}

/// Run with stdin left open, as typed into the console: fd 0 is a terminal.
fn run_on_the_console(source: &str, files: &[(&str, &str)]) -> String {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");
    for (path, body) in files {
        cpu.upload_vfs_file(path.to_string(), body.as_bytes().to_vec());
    }
    let result = cpu.run_until_break(2_000_000).expect("run");
    assert!(result.halted, "program did not halt");
    String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
}

/// Run with stdin fed from a file: queued and closed before the program
/// starts, as `./program < input` does.
fn run_with_stdin_from_a_file(source: &str, files: &[(&str, &str)]) -> String {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");
    for (path, body) in files {
        cpu.upload_vfs_file(path.to_string(), body.as_bytes().to_vec());
    }
    cpu.push_stdin(b"x\n");
    cpu.close_stdin();
    let result = cpu.run_until_break(2_000_000).expect("run");
    assert!(result.halted, "program did not halt");
    String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
}

// A raw system call that fails answers the negated Linux error number in
// x0: -2 (ENOENT) for a missing file, -9 (EBADF) for a descriptor that is
// not open or not open for writing, -22 (EINVAL) for a bad argument. The
// -1 a C programmer expects comes from the library wrappers, not svc.
#[test]
fn failed_file_syscalls_answer_linux_error_numbers() {
    let source = r#"
define(fp, x29)
define(lr, x30)
define(fd_r, x19)

AT_FDCWD = -100
SYS_FCNTL = 25
SYS_OPENAT = 56
SYS_CLOSE = 57
SYS_LSEEK = 62
SYS_READ = 63
SYS_WRITE = 64

        .data
missing:    .string "no-such-file.txt"
empty:      .string ""
present:    .string "data.txt"
fmt:        .string "%ld\n"

        .bss
        .balign 8
buf:        .skip 8

        .text
        .balign 4
        .global main

// print the number in x1 on its own line
print:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =fmt
        bl      printf
        ldp     fp, lr, [sp], 16
        ret

main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     x19, [fp, 16]

        mov     x0, AT_FDCWD
        ldr     x1, =missing
        mov     x2, 0
        mov     x8, SYS_OPENAT
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, AT_FDCWD
        ldr     x1, =empty
        mov     x2, 0
        mov     x8, SYS_OPENAT
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, AT_FDCWD
        ldr     x1, =present
        mov     x2, 0
        mov     x8, SYS_OPENAT
        svc     0
        mov     fd_r, x0
        mov     x1, x0
        bl      print

        mov     x0, fd_r                // write to a read-only descriptor
        ldr     x1, =buf
        mov     x2, 1
        mov     x8, SYS_WRITE
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, fd_r                // lseek with whence 7
        mov     x1, 0
        mov     x2, 7
        mov     x8, SYS_LSEEK
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, fd_r                // lseek to -5
        mov     x1, -5
        mov     x2, 0
        mov     x8, SYS_LSEEK
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, fd_r
        mov     x8, SYS_CLOSE
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, fd_r                // close it again
        mov     x8, SYS_CLOSE
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, 99
        ldr     x1, =buf
        mov     x2, 1
        mov     x8, SYS_READ
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, 99
        mov     x1, 0
        mov     x2, 0
        mov     x8, SYS_LSEEK
        svc     0
        mov     x1, x0
        bl      print

        mov     x0, 0                   // fcntl command 99
        mov     x1, 99
        mov     x2, 0
        mov     x8, SYS_FCNTL
        svc     0
        mov     x1, x0
        bl      print

        mov     w0, 0
        ldr     x19, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret
"#;
    let out = run_on_the_console(source, &[("data.txt", "hello\n")]);
    assert_eq!(out, "-2\n-2\n3\n-9\n-22\n-22\n0\n-9\n-9\n-9\n-22\n");
}

// Only the console is a terminal. With stdin fed from a file, ioctl
// TCGETS and TCSETS on fd 0 answer -25 (ENOTTY) and leave the buffer
// alone, as on the server; an open file and an unknown request answer
// -25 too, and a descriptor that is not open -9. Typed input keeps fd 0 a
// cooked terminal.
#[test]
fn ioctl_finds_a_terminal_only_on_the_console() {
    let source = r#"
define(fp, x29)
define(lr, x30)

TCGETS = 0x5401
TCSETS = 0x5402
SYS_IOCTL = 29
SYS_OPENAT = 56

        .data
        .balign 8
termios:    .quad   0x5555555555555555, 0x5555555555555555, 0x5555555555555555
            .quad   0x5555555555555555, 0x5555555555555555, 0x5555555555555555
            .quad   0x5555555555555555, 0x5555555555555555
present:    .string "data.txt"
fmt:        .string "%ld\n"
fmt_hex:    .string "0x%08x\n"

        .text
        .balign 4
        .global main

// ioctl(x0, x1, termios), then print what it answered
ask:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x2, =termios
        mov     x8, SYS_IOCTL
        svc     0
        mov     x1, x0
        ldr     x0, =fmt
        bl      printf
        ldp     fp, lr, [sp], 16
        ret

main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 0
        mov     x1, TCGETS
        bl      ask

        ldr     x9, =termios            // c_lflag, or 0x55555555 if untouched
        ldr     w1, [x9, 12]
        ldr     x0, =fmt_hex
        bl      printf

        mov     x0, -100
        ldr     x1, =present
        mov     x2, 0
        mov     x8, SYS_OPENAT
        svc     0
        mov     x1, TCGETS
        bl      ask

        mov     x0, 99
        mov     x1, TCGETS
        bl      ask

        mov     x0, 0
        mov     x1, 0x1234
        bl      ask

        mov     x0, 0
        mov     x1, TCSETS
        bl      ask

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let files = [("data.txt", "hello\n")];
    assert_eq!(
        run_with_stdin_from_a_file(source, &files),
        "-25\n0x55555555\n-25\n-9\n-25\n-25\n"
    );
    assert_eq!(run_on_the_console(source, &files), "0\n0x00008a3b\n-25\n-9\n-25\n0\n");
}

// GAS gives an escape it has no name for its own letter, with no warning:
// `\w` is `w` and `\e` is `e`, while `\b` and `\f` are the control codes.
// The playground refused all four.
#[test]
fn unknown_string_escapes_keep_their_letter_like_the_servers() {
    let source = r#"
        .data
fmt:    .string "%d %s\n"
s0:     .string "<\w>"
s1:     .string "<\b>"
s2:     .string "<\f>"
s3:     .string "<\e>"
s4:     .string "<\q>"
s5:     .string "<\0>"
s6:     .string "<\x41>"
s7:     .string "<\101>"
s8:     .string "<\\>"
s9:     .string "<\">"
table:  .quad   s0, s1, s2, s3, s4, s5, s6, s7, s8, s9

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -32]!
        mov     x29, sp
        str     x19, [x29, 16]
        str     x20, [x29, 24]

        mov     w19, 0
        ldr     x20, =table
loop:
        cmp     w19, 10
        b.ge    done
        ldr     x0, =fmt
        mov     w1, w19
        ldr     x2, [x20, w19, sxtw 3]
        bl      printf
        add     w19, w19, 1
        b       loop
done:
        ldr     x19, [x29, 16]
        ldr     x20, [x29, 24]
        mov     w0, 0
        ldp     x29, x30, [sp], 32
        ret
"#;
    let (cpu, out) = run_with_stdin(source, "");
    assert_eq!(
        out,
        "0 <w>\n1 <\x08>\n2 <\x0c>\n3 <e>\n4 <q>\n5 <\n6 <A>\n7 <A>\n8 <\\>\n9 <\">\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
}

// An instruction's char operand is one byte, or a backslash and one byte:
// on the servers `mov w0, '\0'` is `mov w0, #0x30` and `cmp w0, '\v'`
// compares with a v. The playground gave 0 and refused `\v`.
#[test]
fn char_operands_in_instructions_read_one_letter_like_the_servers() {
    let source = r#"
        .data
fmt:    .string "%d %d %d\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x0, =fmt
        mov     w1, '\0'
        mov     w2, '\w'
        mov     w3, 'v'
        cmp     w3, '\v'
        cset    w3, eq
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let (_, out) = run_with_stdin(source, "");
    assert_eq!(out, "48 119 1\n");

    let bad = source.replace(r"mov     w2, '\w'", r"mov     w2, '\x41'");
    let cpu = Cpu::new();
    let err = assemble_hosted(&bad, &cpu.host).expect_err("'\\x41' is not one letter").to_string();
    assert!(err.contains("write any other code as a number"), "message was: {err}");
}

// An m4 define named `n` turns the `\n` in a string into `\w19`, and one
// named `sum` rewrites the word. The servers assemble it and print the
// rewritten text with no newline; the lint says why on the string's line.
#[test]
fn a_define_inside_a_string_prints_what_the_servers_print() {
    let source = r#"// sum of 1 to n
define(n, w19)
define(i, w20)
define(sum, w21)
define(fp, x29)
define(lr, x30)

fmt:    .string "sum of 1 to %d is %d\n"
        .balign 4
        .global main

main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     n, 10
        mov     sum, 0
        mov     i, 1
test:
        cmp     i, n
        b.gt    done
        add     sum, sum, i
        add     i, i, 1
        b       test
done:
        ldr     x0, =fmt
        mov     w1, n
        mov     w2, sum
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let (cpu, out) = run_with_stdin(source, "");
    assert_eq!(out, "w21 of 1 to 10 is 55w19");
    assert_eq!(cpu.exit_code(), Some(0));
    let warnings = aarch64_emulator::frontend::lint::lint(source);
    assert!(
        warnings.iter().any(|w| w.line == 8 && w.message.contains("`n` is defined as a macro")),
        "the lint names the define on the string's line: {warnings:?}"
    );
}

// `ldr x20, label` without the `=` loads the first 8 bytes stored at the
// label, here 0x0000000800000004. The servers link it and die with
// SIGSEGV (exit 139) at the first load through x20, printing nothing.
#[test]
fn ldr_label_without_equals_faults_with_a_hint_that_names_it() {
    let source = r#"
        .data
vals:   .word   4, 8, 15, 16
fmt:    .string "vals[%d] = %d\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x20, vals
        mov     w19, 0
next:
        cmp     w19, 4
        b.ge    done
        ldr     w2, [x20, w19, sxtw 2]
        mov     w1, w19
        ldr     x0, =fmt
        bl      printf
        add     w19, w19, 1
        b       next
done:
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let (mut cpu, message) = run_expect_halt_message(source);
    assert!(
        message.starts_with("memory fault: the program tried to read 0x0000000800000004"),
        "{message}"
    );
    assert!(
        message.contains("first one inside the brackets")
            && message.contains("`ldr xN, label` lost its `=`"),
        "the hint names the base register and the missing `=`: {message}"
    );
    assert_eq!(String::from_utf8_lossy(&cpu.take_stdout()), "");
}
