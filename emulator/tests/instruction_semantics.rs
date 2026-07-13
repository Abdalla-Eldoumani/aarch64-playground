//! Instruction-semantics edges through the hosted pipeline: cmp flag
//! patterns at the signed/unsigned boundaries, conditional branches that
//! must fall through, division by zero (defined on AArch64 to produce
//! zero, never a trap), madd/msub arithmetic, and stp/ldp pre/post-index
//! writeback observed one step at a time. Complements the acceptance
//! matrix, which proves each condition's taken direction; the emphasis
//! here is boundary values and the not-taken directions.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// Assemble hosted source and load it, ready to step from `main`.
fn assemble(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu
}

/// Assemble, load, and run to halt.
fn run(src: &str) -> Cpu {
    let mut cpu = assemble(src);
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt within the step budget");
    cpu
}

// ---------------------------------------------------------------------------
// cmp flag patterns at the boundaries. mov / cset / add / svc never write
// NZCV, so the flags left at halt are the last cmp's own result.
// ---------------------------------------------------------------------------

#[test]
fn cmp_equal_operands_sets_z_and_c() {
    let src = r#"
.text
.global main
main:
    mov     w1, 7
    mov     w2, 7
    cmp     w1, w2
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    let f = cpu.regs.nzcv;
    assert!(!f.n);
    assert!(f.z, "equal operands set z");
    assert!(f.c, "c is not-borrow, so equality sets it");
    assert!(!f.v);
}

#[test]
fn cmp_borrow_sets_n_and_clears_c() {
    let src = r#"
.text
.global main
main:
    mov     w1, 3
    mov     w2, 5
    cmp     w1, w2
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    let f = cpu.regs.nzcv;
    assert!(f.n, "3 - 5 is negative");
    assert!(!f.z);
    assert!(!f.c, "unsigned borrow clears c");
    assert!(!f.v, "no signed overflow for small operands");
}

#[test]
fn cmp_unsigned_and_signed_orders_diverge_at_minus_one() {
    // w2 = -1 is 0xFFFFFFFF unsigned: 1 sits below it unsigned (lo) but
    // above it signed (gt). Both csets must agree with that split.
    let src = r#"
.text
.global main
main:
    mov     w1, 1
    mov     w2, -1
    cmp     w1, w2
    cset    w3, lo
    cset    w4, gt
    add     w0, w3, w4
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    assert_eq!(cpu.exit_code(), Some(2), "lo and gt are both true");
    let f = cpu.regs.nzcv;
    assert!(!f.n, "1 - (-1) = 2 keeps n clear");
    assert!(!f.z);
    assert!(!f.c, "1 < 0xFFFFFFFF unsigned, so c clears");
    assert!(!f.v);
}

#[test]
fn cmp_signed_overflow_sets_v_and_keeps_lt_true() {
    // INT_MIN - 1 wraps to INT_MAX: n clears but v sets, so lt (n != v)
    // still reports INT_MIN < 1.
    let src = r#"
.text
.global main
main:
    mov     w1, 0x80000000
    mov     w2, 1
    cmp     w1, w2
    cset    w3, vs
    cset    w4, lt
    cset    w5, pl
    add     w0, w3, w4
    add     w0, w0, w5
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    assert_eq!(cpu.exit_code(), Some(3), "vs, lt, and pl are all true");
    let f = cpu.regs.nzcv;
    assert!(!f.n, "the wrapped result 0x7FFFFFFF is positive");
    assert!(!f.z);
    assert!(f.c, "0x80000000 >= 1 unsigned, so no borrow");
    assert!(f.v, "signed overflow");
}

// ---------------------------------------------------------------------------
// conditional branches: the fall-through direction
// ---------------------------------------------------------------------------

/// Build a program that compares w1 against w2, takes `b.<cond>` to set
/// w0 = 1, and falls through to w0 = 0 otherwise (the same shape the
/// acceptance matrix uses for the taken direction).
fn bcond_taken(setup: &str, cond: &str) -> bool {
    let src = format!(
        ".text\n.global main\nmain:\n{setup}\n    cmp w1, w2\n    b.{cond} taken\n    \
         mov w0, 0\n    b done\ntaken:\n    mov w0, 1\ndone:\n    mov x8, 93\n    svc 0\n",
        setup = setup,
        cond = cond,
    );
    let cpu = run(&src);
    cpu.exit_code() == Some(1)
}

#[test]
fn conditional_branches_fall_through_when_false() {
    assert!(!bcond_taken("    mov w1, 5\n    mov w2, 3", "eq"), "eq falls through");
    assert!(!bcond_taken("    mov w1, 5\n    mov w2, 5", "ne"), "ne falls through");
    assert!(!bcond_taken("    mov w1, 3\n    mov w2, 5", "hs"), "hs falls through");
    assert!(!bcond_taken("    mov w1, 5\n    mov w2, 3", "lo"), "lo falls through");
    assert!(!bcond_taken("    mov w1, 5\n    mov w2, 5", "hi"), "hi falls through on equality");
    assert!(!bcond_taken("    mov w1, 3\n    mov w2, 5", "gt"), "gt falls through");
    assert!(!bcond_taken("    mov w1, 5\n    mov w2, 3", "le"), "le falls through");
    assert!(!bcond_taken("    mov w1, 3\n    mov w2, 5", "ge"), "ge falls through");
}

// ---------------------------------------------------------------------------
// division by zero
// ---------------------------------------------------------------------------

#[test]
fn division_by_zero_produces_zero_not_a_fault() {
    // Both division flavors define x / 0 = 0 on AArch64; the emulator
    // pins that rather than trapping.
    let src = r#"
.text
.global main
main:
    mov     w1, 42
    mov     w2, 0
    udiv    w3, w1, w2
    mov     w4, -9
    sdiv    w5, w4, w2
    cmp     w3, 0
    cset    w6, eq
    cmp     w5, 0
    cset    w7, eq
    add     w0, w6, w7
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    assert_eq!(cpu.exit_code(), Some(2), "both quotients are zero");
    assert_eq!(cpu.regs.read_gpr(3, false), 0);
    assert_eq!(cpu.regs.read_gpr(5, false), 0);
}

// ---------------------------------------------------------------------------
// multiply-accumulate
// ---------------------------------------------------------------------------

#[test]
fn madd_accumulates_and_msub_computes_remainders() {
    let src = r#"
.text
.global main
main:
    mov     w1, 6
    mov     w2, 7
    mov     w3, 8
    madd    w4, w1, w2, w3
    mov     w5, 47
    mov     w6, 10
    udiv    w7, w5, w6
    msub    w9, w7, w6, w5
    add     w0, w4, w9
    mov     x8, 93
    svc     0
"#;
    // madd: 8 + 6*7 = 50; udiv: 47/10 = 4; msub: 47 - 4*10 = 7.
    let cpu = run(src);
    assert_eq!(cpu.exit_code(), Some(57));
    assert_eq!(cpu.regs.read_gpr(4, false), 50, "madd result");
    assert_eq!(cpu.regs.read_gpr(9, false), 7, "msub remainder");
}

// ---------------------------------------------------------------------------
// stp/ldp writeback, one step at a time
// ---------------------------------------------------------------------------

#[test]
fn stp_pre_index_and_ldp_post_index_write_back_sp() {
    let src = r#"
.text
.global main
main:
    stp     x29, x30, [sp, -16]!
    mov     x29, sp
    mov     w0, 3
    ldp     x29, x30, [sp], 16
    ret
"#;
    let mut cpu = assemble(src);
    let sp0 = cpu.regs.read_sp();
    let fp0 = cpu.regs.read_gpr(29, true);
    let lr0 = cpu.regs.read_gpr(30, true);

    cpu.step().expect("stp steps");
    assert_eq!(cpu.regs.read_sp(), sp0 - 16, "pre-index writes the base back first");
    assert_eq!(cpu.mem.read_u64(sp0 - 16).unwrap(), fp0, "x29 stored at [sp]");
    assert_eq!(cpu.mem.read_u64(sp0 - 8).unwrap(), lr0, "x30 stored at [sp, 8]");

    cpu.step().expect("mov x29, sp steps");
    assert_eq!(cpu.regs.read_gpr(29, true), sp0 - 16, "the frame pointer takes the new sp");

    cpu.step().expect("mov w0, 3 steps");
    cpu.step().expect("ldp steps");
    assert_eq!(cpu.regs.read_sp(), sp0, "post-index writes the base back after the access");
    assert_eq!(cpu.regs.read_gpr(29, true), fp0, "x29 restored");
    assert_eq!(cpu.regs.read_gpr(30, true), lr0, "x30 restored");

    let r = cpu.run_until_break(1_000).expect("run to halt");
    assert!(r.halted, "ret lands on the main-return sentinel and exits");
    assert_eq!(cpu.exit_code(), Some(3), "w0 becomes the exit code");
}

// ---------------------------------------------------------------------------
// single precision (S registers) through the full pipeline: the course
// teaches s/d as two views of one register file, with fcvt bridging them
// and plain %f meaning a 4-byte float.
// ---------------------------------------------------------------------------

#[test]
fn single_precision_scanf_compute_fcvt_printf_flow() {
    // scanf %f stores a 4-byte float; the program reads it into s0,
    // halves it in single precision, widens with fcvt, and prints it as
    // the double printf expects. This is the canonical C float flow.
    let src = r#"
define(fp, x29)
define(lr, x30)

alloc = -(16 + 16) & -16
dealloc = -alloc
val_s = 16

        .data
fmt_in:  .string "%f"
fmt_out: .string "half = %.2f\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in
        add     x1, fp, val_s
        bl      scanf

        ldr     s0, [fp, val_s]
        fmov    s1, 0.5
        fmul    s2, s0, s1
        fcvt    d0, s2
        ldr     x0, =fmt_out
        bl      printf

        mov     x0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;
    let mut cpu = assemble(src);
    cpu.push_stdin(b"9.0\n");
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt");
    assert_eq!(cpu.exit_code(), Some(0));
    let out = String::from_utf8(cpu.take_stdout()).unwrap();
    assert_eq!(out, "half = 4.50\n");
}

#[test]
fn single_precision_arithmetic_rounds_in_f32_end_to_end() {
    // 16777216 + 1 stays 16777216 in single precision (the f32 integer
    // ceiling); a double-precision path would print 16777217.
    let src = r#"
        .text
        .global main
main:
        mov     w1, 0x100
        lsl     w1, w1, 16
        scvtf   s0, w1
        fmov    s1, 1.0
        fadd    s2, s0, s1
        fcvt    d0, s2
        mov     x8, 93
        mov     x0, 0
        svc     0
"#;
    let cpu = run(src);
    assert_eq!(cpu.regs.read_fpr_f64(0), 16_777_216.0);
    // The s write cleared the upper half of the register before fcvt.
    assert_eq!(cpu.regs.read_fpr_bits(2), (16_777_216.0f32).to_bits() as u64);
}

#[test]
fn unterminated_string_reports_itself_at_the_opening_line() {
    // A string missing its closing quote must say exactly that, at the
    // line where the quote opened -- never swallow following lines and
    // blame a directive further down.
    let src = r#"        .text
msg:    .string "broken
        .global main
main:   mov     x0, 0
        ret
"#;
    let cpu = Cpu::new();
    let err = assemble_hosted(src, &cpu.host).expect_err("must not assemble");
    let text = err.to_string();
    assert!(
        text.contains("unterminated string literal"),
        "error should name the real problem, got: {text}"
    );
    assert!(text.contains("line 2"), "error should blame line 2, got: {text}");
}
