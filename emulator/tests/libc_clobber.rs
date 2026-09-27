//! Library calls leave caller-saved registers the way real ones do.
//!
//! On the servers, printf and every other library function may change
//! x0-x18, v0-v7, v16-v31, the top half of v8-v15, and the flags, so a
//! program that keeps a value in x9 across a call prints garbage there.
//! These tests pin the same behaviour here: what gets overwritten, what
//! survives (the return value and the callee-saved registers), and the
//! one note a program earns by reading a register a call left.

use aarch64_emulator::clobber_note_lines;
use aarch64_emulator::cpu::{Cpu, READ_BY_CALL, READ_BY_INSTRUCTION, READ_BY_MAIN_RETURN};
use aarch64_emulator::frontend::pipeline::assemble_hosted;
use aarch64_emulator::registers::{CLOBBER_NZCV, CLOBBER_PATTERN};

/// Assemble, load, and run to the end. Returns the machine and the flat
/// `[addr, line, ...]` map the web layer resolves note lines through.
fn run(src: &str) -> (Cpu, Vec<u32>) {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("assembles");
    cpu.load_linked_image(&image).expect("loads");
    cpu.run_until_break(100_000).expect("runs");
    assert!(cpu.is_halted(), "the program ran to its end");
    let map = image.line_map.iter().flat_map(|(addr, line)| [*addr as u32, *line]).collect();
    (cpu, map)
}

/// The notes as the web receives them: one `[register, read_by,
/// call_line, read_line]` row each, `xN` as N and `dN` as 32 + N.
fn notes(cpu: &mut Cpu, map: &[u32]) -> Vec<[u32; 4]> {
    let mut rows = cpu.take_clobber_notes();
    clobber_note_lines(&mut rows, map);
    rows.chunks_exact(4).map(|r| [r[0], r[1], r[2], r[3]]).collect()
}

/// x9 holds 42 across a printf and is printed on both sides of it. The
/// second `mov x1, x9` is on line 18; the printf that clobbered x9 is on
/// line 16. Built with gcc and run on the course server, the same program
/// printed `x9 = 42` and then `x9 = 108`: printf really does reuse x9.
const X9_ACROSS_PRINTF: &str = r#"define(fp, x29)
define(lr, x30)

        .data
fmt_m:  .string "x9 = %ld\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x9, 42
        ldr     x0, =fmt_m
        mov     x1, x9
        bl      printf
        ldr     x0, =fmt_m
        mov     x1, x9
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_value_kept_in_x9_across_printf_is_lost_and_noted() {
    let (mut cpu, map) = run(X9_ACROSS_PRINTF);
    let stdout = String::from_utf8(cpu.take_stdout()).unwrap();
    assert_eq!(stdout, format!("x9 = 42\nx9 = {}\n", CLOBBER_PATTERN as i64));
    assert_eq!(cpu.exit_code(), Some(0));

    assert_eq!(notes(&mut cpu, &map), vec![[9, READ_BY_INSTRUCTION, 16, 18]]);
    assert!(cpu.take_clobber_notes().is_empty(), "notes are drained once");
}

/// Sets x8, x18, the callee-saved x19/x28, full vectors in v3 and v8,
/// d10, and the flags, then calls puts and returns without touching any
/// of them.
const WHAT_A_CALL_LEAVES: &str = r#"define(fp, x29)
define(lr, x30)

        .data
msg_m:  .string "hi"
        .balign 16
wide_m: .quad 0x1111111111111111, 0x2222222222222222

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x8, 5
        mov     x18, 6
        mov     x19, 7
        mov     x28, 8
        ldr     x0, =wide_m
        ldr     q3, [x0]
        ldr     q8, [x0]
        fmov    d10, 2.5
        cmp     x8, 5
        ldr     x0, =msg_m
        bl      puts
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_call_overwrites_x8_x18_the_flags_and_every_caller_saved_vector_bit() {
    let (cpu, _) = run(WHAT_A_CALL_LEAVES);
    let pattern = u128::from(CLOBBER_PATTERN);
    assert_eq!(cpu.regs.read_gpr(8, true), CLOBBER_PATTERN, "x8");
    assert_eq!(cpu.regs.read_gpr(18, true), CLOBBER_PATTERN, "x18");
    // cmp x8, 5 left Z set; the call leaves the fixed nibble instead.
    assert_eq!(cpu.regs.nzcv.pack(), CLOBBER_NZCV);
    assert_eq!(cpu.regs.read_fpr_q(3), (pattern << 64) | pattern, "v3 is caller-saved whole");
    assert_eq!(
        cpu.regs.read_fpr_q(8),
        (pattern << 64) | 0x1111_1111_1111_1111,
        "v8 keeps only its low half (d8)"
    );
    assert_eq!(cpu.regs.read_fpr_f64(10), 2.5, "d10 survives");
    assert_eq!(cpu.regs.read_fpr_q(10) >> 64, pattern, "the top of v10 does not");
}

#[test]
fn callee_saved_registers_and_the_return_value_survive() {
    let (cpu, _) = run(WHAT_A_CALL_LEAVES);
    assert_eq!(cpu.regs.read_gpr(19, true), 7, "x19");
    assert_eq!(cpu.regs.read_gpr(28, true), 8, "x28");
    assert_ne!(cpu.regs.read_gpr(0, true), CLOBBER_PATTERN, "puts's result in x0");
    assert_eq!(cpu.exit_code(), Some(cpu.regs.read_gpr(0, false) as i32 as i64));
}

/// strlen answers in x0; atof answers in d0 and leaves x0 to the pattern,
/// which the `mov x20, x0` on line 19 then reads.
const RETURN_REGISTERS: &str = r#"define(fp, x29)
define(lr, x30)

        .data
num_m:  .string "2.5"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =num_m
        bl      strlen
        mov     x19, x0
        ldr     x0, =num_m
        bl      atof
        fmov    d8, d0
        mov     x20, x0
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn x0_survives_an_int_return_and_d0_survives_a_double_return() {
    let (mut cpu, map) = run(RETURN_REGISTERS);
    assert_eq!(cpu.regs.read_gpr(19, true), 3, "strlen's length");
    assert_eq!(cpu.regs.read_fpr_f64(8), 2.5, "atof's double");
    assert_eq!(cpu.regs.read_gpr(20, true), CLOBBER_PATTERN, "atof returns nothing in x0");
    // x0 read on line 19 after the atof call on line 17.
    assert_eq!(notes(&mut cpu, &map), vec![[0, READ_BY_INSTRUCTION, 17, 19]]);
}

/// puts clobbers x1, then printf's `%ld` reads x1 as its argument without
/// the program setting it (line 17). x9 is written before it is read, so
/// it earns no note; x12 is read twice (lines 21 and 22) and earns one.
const STALE_ARGUMENT: &str = r#"define(fp, x29)
define(lr, x30)

        .data
one_m:  .string "one"
fmt_m:  .string "%ld\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =one_m
        bl      puts
        ldr     x0, =fmt_m
        bl      printf
after:
        mov     x9, 1
        add     x10, x9, 1
        add     x11, x12, 0
        add     x11, x12, 0
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn one_note_per_register_and_none_after_a_write() {
    let (mut cpu, map) = run(STALE_ARGUMENT);
    // x1: left by puts (line 15), read by the printf call (line 17). x12:
    // left by that printf, read on line 21 and again on 22, noted once.
    assert_eq!(
        notes(&mut cpu, &map),
        vec![[1, READ_BY_CALL, 15, 17], [12, READ_BY_INSTRUCTION, 17, 21]]
    );
}

#[test]
fn a_register_panel_read_between_steps_is_not_the_programs_read() {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(STALE_ARGUMENT, &cpu.host).expect("assembles");
    cpu.load_linked_image(&image).expect("loads");
    let after = cpu.resolve_label("after").expect("label");
    cpu.set_breakpoint(after);
    cpu.run_until_break(100_000).expect("runs");
    assert_eq!(cpu.regs.read_pc(), after);
    cpu.take_clobber_notes();
    // The panel reads every register; the next step (`mov x9, 1`) reads none.
    for i in 0..31 {
        cpu.regs.read_gpr(i, true);
    }
    cpu.step().expect("steps");
    assert!(cpu.take_clobber_notes().is_empty());
}

/// After puts: d3 read through its D view (a note), v9 read whole (vector
/// reads are not tracked), d8 read (callee-saved, no note).
const VECTOR_READS: &str = r#"define(fp, x29)
define(lr, x30)

        .data
msg_m:  .string "hi"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        fmov    d8, 1.5
        ldr     x0, =msg_m
        bl      puts
        fmov    d4, d3
        mov     v5.16b, v9.16b
        fmov    d6, d8
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_d_register_read_is_noted_and_a_vector_read_is_not() {
    let (mut cpu, map) = run(VECTOR_READS);
    // d3 (32 + 3) read on line 16 after the puts call on line 15.
    assert_eq!(notes(&mut cpu, &map), vec![[35, READ_BY_INSTRUCTION, 15, 16]]);
    assert_eq!(cpu.regs.read_fpr_f64(6), 1.5, "d8 carried its value across");
}

/// free answers nothing, so main hands back whatever free left in w0.
const VOID_CALL_LAST: &str = r#"define(fp, x29)
define(lr, x30)

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 0
        bl      free
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn main_returning_what_a_void_call_left_is_noted() {
    let (mut cpu, map) = run(VOID_CALL_LAST);
    assert_eq!(cpu.exit_code(), Some(CLOBBER_PATTERN as u32 as i32 as i64));
    // Left by the free call on line 11; main's return has no line of its own.
    assert_eq!(notes(&mut cpu, &map), vec![[0, READ_BY_MAIN_RETURN, 11, 0]]);
}

/// scanf parks on an empty stdin and is entered again once input arrives,
/// so the pause must leave its arguments alone.
const PARKED_SCANF: &str = r#"define(fp, x29)
define(lr, x30)

        .data
fmt_m:  .string "%ld"
        .balign 8
val_m:  .quad 0

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =fmt_m
        ldr     x1, =val_m
        bl      scanf
        ldr     x0, =val_m
        ldr     x0, [x0]
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_call_parked_on_input_clobbers_nothing_until_it_returns() {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(PARKED_SCANF, &cpu.host).expect("assembles");
    cpu.load_linked_image(&image).expect("loads");
    cpu.run_until_break(100_000).expect("runs");
    assert!(cpu.is_blocked());
    let pointer = cpu.resolve_label("val_m").expect("label");
    assert_eq!(cpu.regs.read_gpr(1, true), pointer, "x1 still points at val_m");
    cpu.push_stdin(b"41\n");
    cpu.run_until_break(100_000).expect("runs");
    assert_eq!(cpu.exit_code(), Some(41));
    assert_eq!(cpu.regs.read_gpr(1, true), CLOBBER_PATTERN, "clobbered once scanf returned");
}
