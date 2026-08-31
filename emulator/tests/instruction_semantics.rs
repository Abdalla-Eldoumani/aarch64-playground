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
// division by zero
// ---------------------------------------------------------------------------
// (The conditional-branch fall-through direction lives in acceptance.rs's
// every_conditional_branch, which walks the shared condition table in both
// directions under both spellings.)

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
fn fsqrt_takes_roots_in_both_widths_end_to_end() {
    // The three cases a student meets: an exact root, zero, and a negative
    // operand, which IEEE answers with NaN rather than a trap. The S form
    // rounds in single precision like the rest of the FP set.
    let src = r#"
        .text
        .global main
main:
        fmov    d16, 9.0
        fsqrt   d17, d16            // 3.0
        fsub    d18, d16, d16       // 0.0
        fsqrt   d19, d18            // 0.0
        fmov    d20, 4.0
        fneg    d20, d20            // -4.0
        fsqrt   d21, d20            // NaN: no root of a negative
        fmov    s0, 2.0
        fmul    s1, s0, s0          // 4.0
        fsqrt   s2, s1              // 2.0
        mov     x8, 93
        mov     x0, 0
        svc     0
"#;
    let cpu = run(src);
    assert_eq!(cpu.regs.read_fpr_f64(17), 3.0);
    assert_eq!(cpu.regs.read_fpr_f64(19), 0.0, "the root of zero is zero");
    assert!(cpu.regs.read_fpr_f64(21).is_nan(), "the root of a negative is NaN");
    assert_eq!(cpu.regs.read_fpr_f32(2), 2.0);
    // The S write zeroed the upper half, so the register holds f32 bits only.
    assert_eq!(cpu.regs.read_fpr_bits(2), (2.0f32).to_bits() as u64);
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

/// add/sub immediates, byte-matched against GNU as. The encoder used to
/// refuse all four of these: anything over 4095, the explicit `lsl #12`,
/// and a negative (which GAS re-spells as the opposite operation). The
/// reference words come from `aarch64-linux-gnu-as` on the same source.
#[test]
fn add_sub_immediates_encode_exactly_as_gas_does() {
    use aarch64_emulator::assembler::assemble;

    let cases: [(&str, u32); 5] = [
        // sub sp, sp, #0x1, lsl #12 -- the prologue that could not assemble
        ("sub sp, sp, 4096", 0xd140_07ff),
        ("add x0, x1, #1, lsl #12", 0x9140_0420),
        // GAS turns a negative into the opposite operation
        ("sub sp, sp, -16", 0x9100_43ff),
        ("add x4, x5, -16", 0xd100_40a4),
        // the largest unshifted immediate still encodes unshifted
        ("sub x2, x3, 4095", 0xd13f_fc62),
    ];

    for (src, expected) in cases {
        let got = assemble(src).unwrap_or_else(|e| panic!("{src}: {e}"));
        assert_eq!(
            got[0], expected,
            "{src}: got {:#010x}, GAS emits {expected:#010x}",
            got[0]
        );
    }
}

/// Forms the course toolchain assembles that this encoder used to refuse
/// outright. Every expected word is what `aarch64-linux-gnu-as` emits for
/// the same source line.
#[test]
fn the_forms_gas_accepts_encode_to_the_words_gas_emits() {
    use aarch64_emulator::assembler::assemble;

    let cases = [
        // A bitmask constant is one ORR-immediate on the real assembler;
        // this used to be "immediate out of range for MOV".
        ("mov x0, 0x5555555555555555", 0xB200_F3E0u32),
        ("mov x0, 0x00ff00ff00ff00ff", 0xB200_9FE0),
        // ROR by an immediate is the EXTR alias; by a register it is RORV.
        ("ror x0, x1, 3", 0x93C1_0C20),
        ("ror w0, w1, 3", 0x1381_0C20),
        ("ror x0, x1, x2", 0x9AC2_2C20),
        // SBFX existed only as UBFX before, so signed extracts were an
        // "unknown mnemonic".
        ("sbfx x0, x1, 2, 4", 0x9342_1420),
        ("sbfx w0, w1, 2, 4", 0x1302_1420),
        // The extended-register form: the widening index behind every
        // array subscript. The shift-modifier parser rejected it.
        ("add x0, x1, w2, sxtw 2", 0x8B22_C820),
        ("add x0, x1, x2, uxtx 1", 0x8B22_6420),
        ("add w0, w1, w2, uxtb 1", 0x0B22_0420),
        ("add sp, x1, w2, uxtw 2", 0x8B22_483F),
        ("add x0, x1, w2, sxtw", 0x8B22_C020),
        ("sub x0, x1, w2, uxth 3", 0xCB22_2C20),
        ("adds x0, x1, w2, sxtb 4", 0xAB22_9020),
        // The extend reaches the CMP alias, which routes through the same
        // encoder with XZR as the destination.
        ("cmp x0, w1, sxtw 2", 0xEB21_C81F),
        // The plain shifted-register form must not have moved.
        ("add x0, x1, x2, lsl 2", 0x8B02_0820),
        ("ror x0, x1, 0", 0x93C1_0020),
    ];
    for (src, expected) in cases {
        let got = assemble(src).unwrap_or_else(|e| panic!("{src}: {e}"));
        assert_eq!(
            got[0], expected,
            "{src}: got {:#010x}, GAS emits {expected:#010x}",
            got[0]
        );
    }

    // The small constants keep the encoding GAS picks for them, so adding
    // the bitmask fallback did not steal MOVZ/MOVN's cases.
    assert_eq!(assemble("mov x0, 0xffff0000").unwrap()[0], 0xD2BF_FFE0);
}

/// The words above have to decode back and execute, not just encode.
#[test]
fn ror_and_sbfx_and_extended_add_run_to_the_right_values() {
    let src = r#"
.text
.global main
main:
    mov     x1, 0x1234
    ror     x2, x1, 4
    mov     w3, 0x80
    sbfx    w4, w3, 4, 4
    mov     x5, 4
    mov     w6, -2
    add     x7, x5, w6, sxtw 1
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    // 0x1234 rotated right by 4 wraps the low nibble to the top.
    assert_eq!(cpu.regs.read_gpr(2, true), 0x4000_0000_0000_0123);
    // Bits [7:4] of 0x80 are 0b1000, sign-extended to -8.
    assert_eq!(cpu.regs.read_gpr(4, false) as u32 as i32, -8);
    // 4 + sign_extend(-2) * 2.
    assert_eq!(cpu.regs.read_gpr(7, true) as i64, 0);
}

#[test]
fn an_immediate_that_needs_more_than_a_shift_is_refused_with_the_rule() {
    use aarch64_emulator::assembler::assemble;
    // 4097 is neither <= 4095 nor a multiple of 4096.
    let err = assemble("add x0, x1, 4097").unwrap_err().to_string();
    assert!(
        err.contains("multiple of 4096"),
        "the message should name the rule, got: {err}"
    );
}

/// `parse_register` collapses sp and xzr to index 31, so these forms used
/// to assemble and compute with ZERO instead of the stack pointer -- a
/// silent wrong answer from a plausible typo. GAS refuses every one of
/// them ("expected an integer or zero register"), and so must we.
#[test]
fn sp_is_refused_where_the_encoding_has_no_room_for_it() {
    use aarch64_emulator::assembler::assemble;

    for src in [
        "and x0, sp, x1",
        "orr x0, x1, sp",
        "and sp, x0, x1",
        "mul x0, sp, x1",
        "mul x0, x1, sp",
        "udiv x0, sp, x1",
        "lsl x0, sp, x1",
        "madd x0, sp, x1, x2",
    ] {
        let err = match assemble(src) {
            Ok(words) => panic!("{src} must be refused, encoded {:#010x}", words[0]),
            Err(e) => e.to_string(),
        };
        assert!(
            err.contains("sp"),
            "{src}: the message should name sp, got: {err}"
        );
    }

    // The add/sub path DOES have an sp encoding and must keep working.
    assert!(assemble("add x0, sp, x1").is_ok());
    assert!(assemble("sub sp, sp, 16").is_ok());
}

// ---------------------------------------------------------------------------
// Multi-precision arithmetic: the whole reason ADC/SBC exist. The low half
// runs through the flag-setting form, and the carry it leaves in NZCV is the
// carry-in of the high half.
// ---------------------------------------------------------------------------

#[test]
fn adc_chains_a_128_bit_add_across_two_registers() {
    // A = 0x0000000000000001_FFFFFFFFFFFFFFFF, B = 0x0000000000000002_0000000000000001.
    // The low halves wrap to 0 and carry, so the high halves sum to 1+2+1 = 4.
    let src = r#"
.text
.global main
main:
    movn    x1, 0
    mov     x2, 1
    mov     x3, 1
    mov     x4, 2
    adds    x5, x1, x3
    adc     x6, x2, x4
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    assert_eq!(cpu.regs.read_gpr(5, true), 0, "low half wraps to zero");
    assert_eq!(cpu.regs.read_gpr(6, true), 4, "high half takes the carry in");
}

#[test]
fn sbc_chains_a_128_bit_subtract_across_two_registers() {
    // 0x0000000000000001_0000000000000000 - 1 = 0x0000000000000000_FFFFFFFFFFFFFFFF.
    // The low half borrows, which clears C, and sbc subtracts that borrow.
    let src = r#"
.text
.global main
main:
    mov     x1, 0
    mov     x2, 1
    mov     x3, 1
    mov     x4, 0
    subs    x5, x1, x3
    sbc     x6, x2, x4
    mov     x8, 93
    svc     0
"#;
    let cpu = run(src);
    assert_eq!(cpu.regs.read_gpr(5, true), u64::MAX, "low half borrows");
    assert_eq!(cpu.regs.read_gpr(6, true), 0, "high half pays the borrow");
}
