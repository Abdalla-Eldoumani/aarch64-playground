//! CPSC 355 acceptance matrix. One focused, original program per category
//! of syntactically valid course assembly, asserting concrete registers,
//! stdout, and exit codes. Every program is authored to the course style
//! (lowercase mnemonics, m4 aliases, AAPCS64 prologue/epilogue where the
//! function needs one, idiomatic addressing and syscalls) and is original
//! -- none reproduces course archive text.
//!
//! The matrix is the proof that the assembler + emulator accept and
//! correctly execute every valid form: m4 aliases, the prologue/epilogue,
//! all four sections, every addressing mode, the literal pool, the hosted
//! runtime and raw syscalls, sign/zero extension, 16-byte alignment, the
//! frame pointer, and floating point. Each program exercises a real
//! decode + execute path through `assemble_hosted` -> `run_until_break`.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// Assemble hosted source, load it, run to completion, and return the CPU
/// so the test can inspect registers, memory, stdout, and the exit code.
fn assemble_and_run(source: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt within the step budget");
    cpu
}

/// As `assemble_and_run`, but pushes `stdin` before running so scanf/read
/// find their input and the program completes in a single run.
fn run_with_stdin(source: &str, stdin: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu.push_stdin(stdin.as_bytes());
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(
        r.halted,
        "program did not halt (blocked waiting for input: {})",
        cpu.is_blocked()
    );
    cpu
}

/// As `assemble_and_run`, but registers virtual files first so the
/// openat/read syscalls have something to open.
fn run_with_vfs(source: &str, files: &[(&str, &[u8])]) -> Cpu {
    let mut cpu = Cpu::new();
    for (name, data) in files {
        cpu.upload_vfs_file((*name).to_string(), data.to_vec());
    }
    let image =
        assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt within the step budget");
    cpu
}

fn stdout_of(cpu: &mut Cpu) -> String {
    String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
}

// ---------------------------------------------------------------------------
// 1. m4 aliases and the `name = expr` assignment form
// ---------------------------------------------------------------------------

#[test]
fn m4_aliases_and_assignment_expressions() {
    // Exercises define(name, reg), the `name = expr` form, the
    // `. - label - 1` length idiom, and the `-(16 + locals) & -16`
    // allocation idiom, all in one non-leaf frame.
    let src = r#"
define(fp, x29)
define(lr, x30)
define(acc_r, w19)

locals = 16
alloc = -(16 + locals) & -16
dealloc = -alloc

.data
msg:    .string "hi"
msg_len = . - msg - 1

.text
.global main
main:
    stp     fp, lr, [sp, alloc]!
    mov     fp, sp
    mov     acc_r, msg_len
    add     w0, acc_r, dealloc
    ldp     fp, lr, [sp], dealloc
    ret
"#;
    // msg_len = 2 (strlen "hi"); dealloc = 32; result = 34.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(34));
}

// ---------------------------------------------------------------------------
// 2. prologue/epilogue: a non-leaf caller and a leaf callee
// ---------------------------------------------------------------------------

#[test]
fn prologue_epilogue_nonleaf_and_leaf() {
    // main is non-leaf (saves fp/lr, sets the frame pointer, calls a
    // helper). square is a leaf that omits the prologue entirely and uses
    // only a scratch register.
    let src = r#"
define(fp, x29)
define(lr, x30)

.text
.global main
main:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    mov     w0, 7
    bl      square
    ldp     fp, lr, [sp], 16
    ret

square:
    mul     w0, w0, w0
    ret
"#;
    // 7 * 7 = 49.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(49));
}

// ---------------------------------------------------------------------------
// 3. sections, base addresses, alignment, and the location counter
// ---------------------------------------------------------------------------

#[test]
fn sections_and_base_addresses() {
    // Touches all four sections: .bss reserve with the location counter,
    // .rodata constant, .data constant, plus .balign / .align / .skip and
    // .global. ldr =label resolves an address in each section.
    let src = r#"
.bss
.balign 8
scratch:    .skip 8
counter:    .skip 4

.rodata
ro_val:     .word 100

.data
.align 2
dat_val:    .word 7

.text
.global main
main:
    ldr     x0, =ro_val
    ldr     w1, [x0]
    ldr     x0, =dat_val
    ldr     w2, [x0]
    add     w3, w1, w2
    ldr     x0, =counter
    str     w3, [x0]
    ldr     w0, [x0]
    mov     x8, 93
    svc     0
"#;
    // 100 + 7 = 107, round-tripped through the .bss counter.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(107));
}

// ---------------------------------------------------------------------------
// 4. addressing modes
// ---------------------------------------------------------------------------

#[test]
fn addressing_modes() {
    // base+imm, base+reg, base+reg LSL, base+32-bit reg SXTW and UXTW
    // (array indexing), pre-index, and post-index -- all against one word
    // array, accumulating into w19.
    let src = r#"
.data
arr:    .word 10, 20, 30, 40, 50

.text
.global main
main:
    ldr     x0, =arr
    ldr     w19, [x0, 0]
    mov     x1, 8
    ldr     w2, [x0, x1]
    add     w19, w19, w2
    mov     x1, 1
    ldr     w2, [x0, x1, lsl 2]
    add     w19, w19, w2
    mov     w1, 3
    ldr     w2, [x0, w1, sxtw 2]
    add     w19, w19, w2
    mov     w1, 4
    ldr     w2, [x0, w1, uxtw 2]
    add     w19, w19, w2
    mov     x3, x0
    ldr     w2, [x3, 4]!
    add     w19, w19, w2
    ldr     w2, [x3], 4
    add     w19, w19, w2
    mov     w0, w19
    mov     x8, 93
    svc     0
"#;
    // 10 + 30 + 20 + 40 + 50 + 20 + 20 = 190.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(190));
}

// ---------------------------------------------------------------------------
// 5. the literal pool: ldr =label, ldr =constant, and adrp / add :lo12:
// ---------------------------------------------------------------------------

#[test]
fn literal_pool_and_pc_relative_addressing() {
    let src = r#"
.data
val:    .word 0

.text
.global main
main:
    ldr     w1, =0x1234
    ldr     x0, =val
    str     w1, [x0]
    ldr     w2, [x0]
    adrp    x3, val
    add     x3, x3, :lo12:val
    ldr     w4, [x3]
    add     w0, w2, w4
    mov     x8, 93
    svc     0
"#;
    // 0x1234 = 4660; both reads see it; 4660 + 4660 = 9320.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(9320));
}

// ---------------------------------------------------------------------------
// 6a. hosted runtime: scanf + printf round trip
// ---------------------------------------------------------------------------

#[test]
fn hosted_runtime_scanf_printf_round_trip() {
    let src = r#"
.data
fmt_in:     .string "%d %d"
fmt_out:    .string "sum = %d\n"

.bss
a_m:        .skip 4
b_m:        .skip 4

.text
.global main
main:
    stp     x29, x30, [sp, -16]!
    mov     x29, sp
    ldr     x0, =fmt_in
    ldr     x1, =a_m
    ldr     x2, =b_m
    bl      scanf
    ldr     x0, =a_m
    ldr     w1, [x0]
    ldr     x0, =b_m
    ldr     w2, [x0]
    add     w1, w1, w2
    ldr     x0, =fmt_out
    bl      printf
    mov     w0, 0
    ldp     x29, x30, [sp], 16
    ret
"#;
    let mut cpu = run_with_stdin(src, "7 5\n");
    assert_eq!(stdout_of(&mut cpu), "sum = 12\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

// ---------------------------------------------------------------------------
// 6b. raw Linux syscalls: openat / read / write / close / exit
// ---------------------------------------------------------------------------

#[test]
fn raw_syscalls_file_round_trip() {
    let src = r#"
.data
path:   .string "data.txt"

.bss
buf:    .skip 64

.text
.global main
main:
    mov     x0, -100
    ldr     x1, =path
    mov     x2, 0
    mov     x3, 0
    mov     x8, 56
    svc     0
    mov     x19, x0
    mov     x0, x19
    ldr     x1, =buf
    mov     x2, 64
    mov     x8, 63
    svc     0
    mov     x20, x0
    mov     x0, 1
    ldr     x1, =buf
    mov     x2, x20
    mov     x8, 64
    svc     0
    mov     x0, x19
    mov     x8, 57
    svc     0
    mov     x0, 0
    mov     x8, 93
    svc     0
"#;
    let mut cpu = run_with_vfs(src, &[("data.txt", b"hello\n")]);
    assert_eq!(stdout_of(&mut cpu), "hello\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

// ---------------------------------------------------------------------------
// 7. sign and zero extension
// ---------------------------------------------------------------------------

#[test]
fn sign_and_zero_extension() {
    // ldrsb / ldrsh / ldrsw load negative values from memory; sxtb / sxth /
    // sxtw / uxtb / uxth extend register values. Each result lands in a
    // distinct register the test inspects directly.
    let src = r#"
.data
b_val:  .byte 0xFF
h_val:  .hword 0xFFFE
w_val:  .word 0xFFFFFFFF

.text
.global main
main:
    ldr     x10, =b_val
    ldrsb   x1, [x10]
    ldr     x10, =h_val
    ldrsh   x2, [x10]
    ldr     x10, =w_val
    ldrsw   x3, [x10]
    movz    w4, 0x80
    sxtb    x5, w4
    uxtb    x6, w4
    movz    w7, 0x8000
    sxth    x13, w7
    uxth    x14, w7
    mov     w11, 0xFFFF
    movk    w11, 0xFFFF, lsl 16
    sxtw    x12, w11
    mov     w0, 0
    ret
"#;
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.regs.read_gpr(1, true) as i64, -1, "ldrsb");
    assert_eq!(cpu.regs.read_gpr(2, true) as i64, -2, "ldrsh");
    assert_eq!(cpu.regs.read_gpr(3, true) as i64, -1, "ldrsw");
    assert_eq!(cpu.regs.read_gpr(5, true) as i64, -128, "sxtb");
    assert_eq!(cpu.regs.read_gpr(6, true), 128, "uxtb");
    assert_eq!(cpu.regs.read_gpr(13, true) as i64, -32768, "sxth");
    assert_eq!(cpu.regs.read_gpr(14, true), 32768, "uxth");
    assert_eq!(cpu.regs.read_gpr(12, true) as i64, -1, "sxtw");
}

// ---------------------------------------------------------------------------
// 8. stack alignment and the frame pointer
// ---------------------------------------------------------------------------

#[test]
fn stack_alignment_and_frame_pointer() {
    // SP must stay 16-byte aligned across the call to the helper, and a
    // local is addressed via [fp, offset]. The program folds both the
    // caller's and the callee's `sp & 15` into the result, so a non-zero
    // misalignment anywhere would change the exit code.
    let src = r#"
define(fp, x29)
define(lr, x30)

local_s = 16
alloc = -(16 + 16) & -16

.text
.global main
main:
    stp     fp, lr, [sp, alloc]!
    mov     fp, sp
    mov     w0, 42
    str     w0, [fp, local_s]
    mov     x1, sp
    and     x1, x1, 15
    bl      checkalign
    ldr     w2, [fp, local_s]
    add     w0, w0, w1
    add     w0, w0, w2
    ldp     fp, lr, [sp], 32
    ret

checkalign:
    mov     x0, sp
    and     x0, x0, 15
    ret
"#;
    // checkalign returns 0 (aligned); caller w1 = 0 (aligned); local = 42.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(42));
}

// ---------------------------------------------------------------------------
// 9. floating point
// ---------------------------------------------------------------------------

#[test]
fn floating_point() {
    // scvtf, fadd, fsub, fmul, fdiv, fmov, fcvtzs, fcmp with D registers,
    // a .double constant loaded with ldr d, and a .float constant loaded
    // into an S register.
    let src = r#"
.data
.balign 8
two_pt_five:    .double 0r2.5
half:           .double 0r0.5
flt_val:        .float 0r1.5

.text
.global main
main:
    mov     w0, 10
    scvtf   d0, w0
    ldr     x1, =two_pt_five
    ldr     d1, [x1]
    fadd    d2, d0, d1
    fsub    d3, d2, d1
    fmul    d4, d0, d1
    fdiv    d6, d4, d1
    fmov    d7, d6
    fcvtzs  w2, d2
    fcmp    d3, d7
    cset    w3, eq
    ldr     x1, =flt_val
    ldr     s8, [x1]
    add     w0, w2, w3
    mov     x8, 93
    svc     0
"#;
    // fcvtzs(12.5) = 12; d3 (10.0) == d7 (10.0) -> +1; exit 13.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(13));
    assert_eq!(cpu.regs.read_fpr_f64(4), 25.0, "fmul d4");
    assert_eq!(cpu.regs.read_fpr_f64(6), 10.0, "fdiv d6");
    let s8 = f32::from_bits(cpu.regs.read_fpr_bits(8) as u32);
    assert_eq!(s8, 1.5_f32, "ldr s8 from .float");
}

// ---------------------------------------------------------------------------
// 10. compare and conditional select
// ---------------------------------------------------------------------------

#[test]
fn compare_and_conditional_select() {
    // cmp / cmn / tst feeding cset, csel, and csinc. Each check contributes
    // 1 to the accumulator only when its semantics are correct.
    let src = r#"
.text
.global main
main:
    mov     w0, 0

    mov     w1, 5
    mov     w2, 5
    cmp     w1, w2
    cset    w4, eq
    add     w0, w0, w4

    mov     w3, -3
    cmn     w3, 3
    cset    w4, eq
    add     w0, w0, w4

    mov     w5, 0b1010
    tst     w5, 2
    cset    w6, ne
    add     w0, w0, w6

    mov     w7, 7
    mov     w8, 3
    cmp     w7, w8
    csel    w9, w7, w8, gt
    cmp     w9, 7
    cset    w10, eq
    add     w0, w0, w10

    cmp     w7, w8
    csinc   w11, w8, w8, le
    cmp     w11, 4
    cset    w12, eq
    add     w0, w0, w12

    mov     x8, 93
    svc     0
"#;
    // Five independent checks, each adds 1 when correct -> 5.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(5));
}

// ---------------------------------------------------------------------------
// 11. the branch family: b, bl, br, blr, ret, cbz/cbnz, tbz/tbnz
// ---------------------------------------------------------------------------

#[test]
fn branch_family() {
    let src = r#"
.text
.global main
main:
    mov     w0, 0
    ldr     x17, =start_real
    br      x17
    mov     w0, 0xEE
    mov     x8, 93
    svc     0
start_real:
    mov     w14, 0
    cbz     w14, cbz_ok
    b       fail
cbz_ok:
    add     w0, w0, 1
    mov     w14, 1
    cbnz    w14, cbnz_ok
    b       fail
cbnz_ok:
    add     w0, w0, 1
    mov     w15, 0b100
    tbz     w15, 0, tbz_ok
    b       fail
tbz_ok:
    add     w0, w0, 1
    tbnz    w15, 2, tbnz_ok
    b       fail
tbnz_ok:
    add     w0, w0, 1
    ldr     x16, =helper
    blr     x16
    mov     x8, 93
    svc     0
fail:
    mov     w0, 0xFF
    mov     x8, 93
    svc     0

helper:
    add     w0, w0, 1
    ret
"#;
    // br over the trap, cbz, cbnz, tbz, tbnz, blr + ret each add 1 -> 5.
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(5));
}

// ---------------------------------------------------------------------------
// 12. every conditional branch encodes and resolves correctly
// ---------------------------------------------------------------------------

/// Build a program that sets the flags from `cmp w1, w2`, takes `b.<cond>`
/// to set w0 = 1, and falls through to w0 = 0 otherwise. Returns whether
/// the branch was taken.
fn bcond_taken(setup: &str, cond: &str) -> bool {
    let src = format!(
        ".text\n.global main\nmain:\n{setup}\n    cmp w1, w2\n    b.{cond} taken\n    \
         mov w0, 0\n    b done\ntaken:\n    mov w0, 1\ndone:\n    mov x8, 93\n    svc 0\n",
        setup = setup,
        cond = cond,
    );
    let cpu = assemble_and_run(&src);
    cpu.exit_code() == Some(1)
}

#[test]
fn every_conditional_branch() {
    // Each condition is fed a cmp that makes it true, covering both
    // signed (ge/lt/gt/le) and unsigned (hs/lo/hi/ls) orderings plus the
    // flag-direct conditions (eq/ne/mi/pl/vs/vc).
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 5", "eq"), "eq");
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 3", "ne"), "ne");
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 3", "hs"), "hs");
    assert!(bcond_taken("    mov w1, 3\n    mov w2, 5", "lo"), "lo");
    assert!(bcond_taken("    mov w1, 3\n    mov w2, 5", "mi"), "mi");
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 3", "pl"), "pl");
    assert!(bcond_taken("    mov w1, 0x80000000\n    mov w2, 1", "vs"), "vs");
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 3", "vc"), "vc");
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 3", "hi"), "hi");
    assert!(bcond_taken("    mov w1, 3\n    mov w2, 5", "ls"), "ls");
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 3", "ge"), "ge");
    assert!(bcond_taken("    mov w1, 3\n    mov w2, 5", "lt"), "lt");
    assert!(bcond_taken("    mov w1, 5\n    mov w2, 3", "gt"), "gt");
    assert!(bcond_taken("    mov w1, 3\n    mov w2, 5", "le"), "le");
}

// ---------------------------------------------------------------------------
// 13. label pointer tables in .data (the assignment jump-table shape)
// ---------------------------------------------------------------------------

#[test]
fn dword_label_pointer_table_indexes_strings() {
    // A .data table whose slots are label addresses, all forward
    // references, indexed with the [base, Wm, SXTW 3] form the course
    // pairs with pointer-sized slots.
    let src = r#"
define(fp, x29)
define(lr, x30)
define(pick_r, w19)
define(table_r, x20)

        .data
        .balign 8
dir_table:  .dword name_east, name_north, name_south, name_west

fmt_pick:   .string "picked %s\n"

name_east:  .string "east"
name_north: .string "north"
name_south: .string "south"
name_west:  .string "west"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     pick_r, 2                       // third slot
        ldr     table_r, =dir_table
        ldr     x1, [table_r, pick_r, SXTW 3]   // 8-byte pointer slots
        ldr     x0, =fmt_pick
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = assemble_and_run(src);
    assert_eq!(stdout_of(&mut cpu), "picked south\n");
    assert_eq!(cpu.exit_code(), Some(0));
    // The raw slots hold the labels' absolute addresses in order.
    let table = cpu.resolve_label("dir_table").expect("table symbol");
    for (i, name) in ["name_east", "name_north", "name_south", "name_west"]
        .iter()
        .enumerate()
    {
        let expected = cpu.resolve_label(name).expect("string symbol");
        let slot = cpu.mem.read_u64(table + (i as u64) * 8).expect("slot read");
        assert_eq!(slot, expected, "slot {i} points at {name}");
    }
}

#[test]
fn current_address_in_data_slot_is_the_slot_address() {
    let src = r#"
        .data
        .balign 8
before: .dword 7
selfp:  .dword .

        .text
        .global main
main:
        mov     w0, 0
        mov     x8, 93
        svc     0
"#;
    let cpu = assemble_and_run(src);
    let selfp = cpu.resolve_label("selfp").expect("selfp symbol");
    assert_eq!(
        cpu.mem.read_u64(selfp).expect("slot read"),
        selfp,
        ".dword . stores its own address, not the parse-time zero"
    );
}

#[test]
fn unknown_symbol_in_data_slot_reports_symbol_and_line() {
    let cpu = Cpu::new();
    let err = aarch64_emulator::frontend::pipeline::assemble_hosted(
        ".data\ntable: .dword no_such_label\n",
        &cpu.host,
    )
    .expect_err("an unresolvable data slot must fail the assemble");
    let msg = format!("{err}");
    assert!(msg.contains("no_such_label"), "names the symbol: {msg}");
    assert!(msg.contains("line 2"), "points at the table line: {msg}");
}

// ---------------------------------------------------------------------------
// 17. .skip sized by an equate (the reserved-buffer assignment shape)
// ---------------------------------------------------------------------------

#[test]
fn skip_with_symbolic_size_reserves_the_computed_bytes() {
    let src = r#"
STACKSIZE = 4

        .bss
buffer:     .skip STACKSIZE * 4
sentinel:   .skip 4

        .text
        .global main
main:
        ldr     x9, =buffer
        mov     w10, 7
        str     w10, [x9, 12]       // last element of the 16-byte buffer
        ldr     w0, [x9, 12]
        mov     x8, 93
        svc     0
"#;
    let cpu = assemble_and_run(src);
    assert_eq!(cpu.exit_code(), Some(7));
    // The reserve really occupies STACKSIZE * 4 bytes: the next label
    // lands exactly 16 past the buffer.
    let buffer = cpu.resolve_label("buffer").expect("buffer symbol");
    let sentinel = cpu.resolve_label("sentinel").expect("sentinel symbol");
    assert_eq!(sentinel - buffer, 16);
}

#[test]
fn skip_with_undefined_symbol_reports_it() {
    let cpu = Cpu::new();
    let err = aarch64_emulator::frontend::pipeline::assemble_hosted(
        ".bss\nbuf: .skip NOSUCH * 4\n",
        &cpu.host,
    )
    .expect_err("an undefined size symbol must fail the assemble");
    let msg = format!("{err}");
    assert!(msg.contains("NOSUCH"), "names the symbol: {msg}");
    assert!(msg.contains("line 2"), "points at the reserve line: {msg}");
}

// ---------------------------------------------------------------------------
// 16. struct-field addressing off the frame pointer (equate offsets)
// ---------------------------------------------------------------------------

#[test]
fn struct_field_offsets_reach_unaligned_and_fp_slots() {
    // The struct-copy assignment shape: field offsets are equates, a
    // 64-bit load grabs two packed ints at a 4-aligned offset (which
    // only the unscaled encoding can express), and a double spills to
    // the frame with writeback.
    let src = r#"
define(fp, x29)
define(lr, x30)

point_x = 0
point_y = 4
box_w = 8
box_area = 12
box_size = 16

alloc = -(16 + box_size) & -16
dealloc = -alloc
box_s = 16

        .data
fmt_pair:   .string "x %d y %d\n"
fmt_area:   .string "area %.1f\n"

        .text
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        mov     w9, 21
        str     w9, [fp, box_s + point_x]
        mov     w9, 43
        str     w9, [fp, box_s + point_y]

        // Both packed ints in one 64-bit load: offset 16+0 is 8-aligned,
        // but the same load at point_y (offset 20) is not, so the pair
        // below proves the unscaled form under an equate expression.
        ldr     x9, [fp, box_s + point_y]       // unaligned 64-bit read
        and     x2, x9, 0xFFFFFFFF              // low word = y
        ldr     x9, [fp, box_s + point_x]
        and     x1, x9, 0xFFFFFFFF              // low word = x
        ldr     x0, =fmt_pair
        bl      printf

        // Double spill with writeback, read back at a negative offset.
        mov     x9, 6
        scvtf   d0, x9
        str     d0, [sp, -16]!
        ldr     d1, [sp]
        add     sp, sp, 16
        ldr     d2, [sp, -16]                   // negative FP-data offset
        fadd    d0, d1, d2
        ldr     x0, =fmt_area
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;
    let mut cpu = assemble_and_run(src);
    assert_eq!(stdout_of(&mut cpu), "x 21 y 43\narea 12.0\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

// ---------------------------------------------------------------------------
// 14. rand / srand / time (the random-array assignment idiom)
// ---------------------------------------------------------------------------

#[test]
fn seeded_random_draws_are_reproducible() {
    // The classic setup: srand(time(0)), then draws masked into a range.
    // The emulator's time() is a fixed timestamp, so the sequence is the
    // same on every run -- assert that by running the program twice.
    let src = r#"
define(fp, x29)
define(lr, x30)
define(count_r, w19)

        .data
fmt_draw:   .string "draw %d\n"

        .text
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 0                   // time(0)
        bl      time
        bl      srand                   // seed with the fixed stamp

        mov     count_r, 3
draw_loop:
        bl      rand
        and     w1, w0, 0xFF            // draw mod 256, course-style mask
        ldr     x0, =fmt_draw
        bl      printf
        subs    count_r, count_r, 1
        b.gt    draw_loop

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut first = assemble_and_run(src);
    let first_out = stdout_of(&mut first);
    assert_eq!(first.exit_code(), Some(0));
    assert_eq!(first_out.lines().count(), 3, "three draws print");
    for line in first_out.lines() {
        let n: i64 = line
            .strip_prefix("draw ")
            .and_then(|v| v.parse().ok())
            .unwrap_or_else(|| panic!("unexpected line: {line}"));
        assert!((0..=255).contains(&n), "masked draw in range: {n}");
    }
    let mut second = assemble_and_run(src);
    assert_eq!(stdout_of(&mut second), first_out, "fixed seed, fixed sequence");
}

// ---------------------------------------------------------------------------
// 15. atoi over argv (how assignment programs read numeric arguments)
// ---------------------------------------------------------------------------

#[test]
fn atoi_converts_argv_strings() {
    // argv[1] and argv[2] arrive as strings; the course converts them
    // with atoi and works with the integers. Exit code carries the sum
    // so the test observes both conversions.
    let src = r#"
define(fp, x29)
define(lr, x30)
define(argv_r, x19)
define(first_r, w20)

        .text
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     argv_r, x1
        ldr     x0, [argv_r, 8]         // argv[1]
        bl      atoi
        mov     first_r, w0
        ldr     x0, [argv_r, 16]        // argv[2]
        bl      atoi
        add     w0, first_r, w0

        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = Cpu::new();
    let image = aarch64_emulator::frontend::pipeline::assemble_hosted(src, &cpu.host)
        .unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image_with_args(&image, &["prog", "19", "-7"])
        .expect("load failed");
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt");
    assert_eq!(cpu.exit_code(), Some(12));
}

