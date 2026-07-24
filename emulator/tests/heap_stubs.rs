//! End-to-end contracts for the malloc/free heap stubs, the usleep and
//! fflush stubs, and the no-entry-point link gate. Everything drives the
//! public pipeline: assemble_hosted -> load -> run_until_break.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

fn load(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu
}

fn stdout_of(cpu: &mut Cpu) -> String {
    String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
}

#[test]
fn malloc_blocks_hold_data_and_free_reuses_them() {
    let src = r#"
        .data
fmt:    .string "%d %d %d\n"
        .text
        .global main
main:
        stp     x29, x30, [sp, -32]!
        mov     x29, sp
        stp     x19, x20, [sp, 16]

        mov     x0, 24
        bl      malloc
        mov     x19, x0
        mov     x1, 7
        str     x1, [x19]
        mov     x1, 9
        str     x1, [x19, 16]

        mov     x0, x19
        bl      free

        // an exact-size request lands on the freed block again
        mov     x0, 24
        bl      malloc
        mov     x20, x0

        ldr     x0, =fmt
        ldr     x1, [x19]
        ldr     x2, [x19, 8]
        cmp     x19, x20
        cset    w3, eq
        bl      printf

        ldp     x19, x20, [sp, 16]
        mov     w0, 0
        ldp     x29, x30, [sp], 32
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "program should finish");
    assert_eq!(cpu.exit_code, Some(0));
    // 7 survives in place, the middle slot was never written (zero), and
    // the second malloc reused the freed address (flag 1).
    assert_eq!(stdout_of(&mut cpu), "7 0 1\n");
}

#[test]
fn free_of_a_wild_pointer_is_a_calm_halt() {
    let src = r#"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0x4321
        bl      free
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "the bad free must halt the program");
    let msg = cpu.abort_message.clone().unwrap_or_default();
    assert!(msg.contains("free"), "message should blame free: {msg}");
    assert!(
        msg.contains("not an address malloc returned"),
        "message should say why: {msg}"
    );
}

#[test]
fn double_free_is_diagnosed() {
    let src = r#"
        .text
        .global main
main:
        stp     x29, x30, [sp, -32]!
        mov     x29, sp
        str     x19, [sp, 16]
        mov     x0, 16
        bl      malloc
        mov     x19, x0
        mov     x0, x19
        bl      free
        mov     x0, x19
        bl      free
        mov     w0, 0
        ldr     x19, [sp, 16]
        ldp     x29, x30, [sp], 32
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted);
    let msg = cpu.abort_message.clone().unwrap_or_default();
    assert!(msg.contains("double free"), "got: {msg}");
}

#[test]
fn free_null_is_a_noop_and_huge_malloc_returns_null() {
    let src = r#"
        .data
fmt:    .string "%d\n"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     x0, 0
        bl      free

        // two windows' worth cannot fit; malloc reports NULL
        mov     x0, 0x200000
        bl      malloc
        ldr     x1, =fmt
        cmp     x0, 0
        cset    w2, eq
        mov     x0, x1
        mov     w1, w2
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted);
    assert_eq!(cpu.exit_code, Some(0));
    assert_eq!(stdout_of(&mut cpu), "1\n");
}

#[test]
fn usleep_pauses_the_run_and_advances_the_virtual_clock() {
    let src = r#"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        movz    w0, 50000
        bl      usleep
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(!r.halted, "run should pause at the sleep");
    assert_eq!(cpu.take_pending_sleep_ns(), Some(50_000_000));
    assert_eq!(cpu.term.virtual_ns, 50_000_000);
    let r2 = cpu.run_until_break(1_000_000).expect("run");
    assert!(r2.halted);
    assert_eq!(cpu.exit_code, Some(0));
}

#[test]
fn fflush_returns_zero_and_continues() {
    let src = r#"
        .data
msg:    .string "before"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =msg
        bl      printf
        mov     x0, 0
        bl      fflush
        mov     w0, w0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted);
    assert_eq!(cpu.exit_code, Some(0), "fflush returns 0 into main's w0");
    assert_eq!(stdout_of(&mut cpu), "before");
}

#[test]
fn a_helpers_only_file_refuses_to_link() {
    let src = r#"
        .text
        .global double_it
double_it:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        lsl     w0, w0, 1
        ldp     x29, x30, [sp], 16
        ret
"#;
    let cpu = Cpu::new();
    let err = assemble_hosted(src, &cpu.host).expect_err("no entry point must not link");
    let msg = err.to_string();
    assert!(msg.contains("no entry point"), "got: {msg}");
    assert!(msg.contains("main"), "the message should point at main: {msg}");
}
