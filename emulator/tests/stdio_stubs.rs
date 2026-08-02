//! End-to-end contracts for the FILE*-level stdio stubs (fopen /
//! fprintf / fclose over the VFS), the shape assignment log-file
//! programs use: fopen("file", "w"), fprintf per record, one fclose.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

fn run(source: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");
    cpu.close_stdin();
    let result = cpu.run_until_break(2_000_000).expect("run");
    assert!(result.halted, "program did not halt");
    cpu
}

#[test]
fn fopen_fprintf_fclose_write_the_log_file() {
    let source = r#"
define(fp, x29)
define(lr, x30)
define(file_r, x19)

        .data
log_name:       .string "out.log"
log_mode:       .string "w"
rec_fmt:        .string "%d\t%s\t%.2f\n"
word:           .string "mid"
ret_fmt:        .string "fclose says %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =log_name
        ldr     x1, =log_mode
        bl      fopen
        mov     file_r, x0

        mov     x0, file_r
        ldr     x1, =rec_fmt
        mov     w2, 7
        ldr     x3, =word
        fmov    d0, 2.5
        bl      fprintf

        mov     x0, file_r
        bl      fclose
        mov     w1, w0
        ldr     x0, =ret_fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = run(source);
    assert_eq!(
        cpu.vfs.get("out.log").map(|b| b.as_slice()),
        Some(b"7\tmid\t2.50\n".as_slice())
    );
    assert_eq!(
        String::from_utf8_lossy(&cpu.take_stdout()),
        "fclose says 0\n"
    );
}

#[test]
fn fopen_missing_file_for_reading_answers_null() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
name:           .string "absent.txt"
mode_r:         .string "r"
msg:            .string "got NULL\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =name
        ldr     x1, =mode_r
        bl      fopen
        cbnz    x0, done
        ldr     x0, =msg
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = run(source);
    assert_eq!(String::from_utf8_lossy(&cpu.take_stdout()), "got NULL\n");
}

#[test]
fn append_mode_continues_after_the_first_close() {
    let source = r#"
define(fp, x29)
define(lr, x30)
define(file_r, x19)

        .data
name:           .string "notes.txt"
mode_w:         .string "w"
mode_a:         .string "a"
first:          .string "one\n"
second:         .string "two\n"
plain:          .string "%s"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =name
        ldr     x1, =mode_w
        bl      fopen
        mov     file_r, x0
        mov     x0, file_r
        ldr     x1, =plain
        ldr     x2, =first
        bl      fprintf
        mov     x0, file_r
        bl      fclose

        ldr     x0, =name
        ldr     x1, =mode_a
        bl      fopen
        mov     file_r, x0
        mov     x0, file_r
        ldr     x1, =plain
        ldr     x2, =second
        bl      fprintf
        mov     x0, file_r
        bl      fclose

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let cpu = run(source);
    assert_eq!(
        cpu.vfs.get("notes.txt").map(|b| b.as_slice()),
        Some(b"one\ntwo\n".as_slice())
    );
}

#[test]
fn fclose_twice_answers_eof_the_second_time() {
    let source = r#"
define(fp, x29)
define(lr, x30)
define(file_r, x19)

        .data
name:           .string "twice.txt"
mode_w:         .string "w"
fmt:            .string "%d %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =name
        ldr     x1, =mode_w
        bl      fopen
        mov     file_r, x0

        mov     x0, file_r
        bl      fclose
        mov     w20, w0
        mov     x0, file_r
        bl      fclose
        mov     w2, w0
        mov     w1, w20
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = run(source);
    assert_eq!(String::from_utf8_lossy(&cpu.take_stdout()), "0 -1\n");
}

#[test]
fn fprintf_to_a_wild_pointer_halts_calmly() {
    let source = r#"
define(fp, x29)
define(lr, x30)

        .data
fmt:            .string "%d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 12345
        ldr     x1, =fmt
        mov     w2, 1
        bl      fprintf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");
    let result = cpu.run_until_break(2_000_000).expect("run never panics");
    assert!(result.halted, "the wild stream is a calm halt");
    let message = cpu.abort_message.clone().unwrap_or_default();
    assert!(
        message.contains("fprintf") && message.contains("fopen"),
        "message names the cause and the fix: {message}"
    );
}
