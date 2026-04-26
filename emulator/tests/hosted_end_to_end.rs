//! End-to-end integration tests for the phase B hosted runtime. These
//! build a tiny program in memory, wire up host stubs, and drive it
//! through `Cpu::run_until_break` to prove that printf, scanf, and the
//! write/read/exit syscalls all produce the right output once the full
//! pipeline runs.
//!
//! The cpsc 355 tutorial corpus still needs the frontend linker to
//! resolve `bl printf` and `ldr xN, =label` automatically (phase B.13+
//! work); these tests exercise the same machinery end-to-end with
//! hand-built binaries so we know each layer works.

use aarch64_emulator::cpu::{Cpu, CODE_BASE, STACK_BASE};
use aarch64_emulator::hosted::libc;
use aarch64_emulator::hosted::printf;

/// Encode MOVZ Xd, #imm16, LSL #(hw*16).
fn movz(rd: u8, imm16: u16, hw: u8) -> u32 {
    0xD280_0000 | ((hw as u32) << 21) | ((imm16 as u32) << 5) | (rd as u32)
}

/// Encode MOVK Xd, #imm16, LSL #(hw*16).
fn movk(rd: u8, imm16: u16, hw: u8) -> u32 {
    0xF280_0000 | ((hw as u32) << 21) | ((imm16 as u32) << 5) | (rd as u32)
}

/// Encode BLR Xn.
fn blr(rn: u8) -> u32 {
    0xD63F_0000 | ((rn as u32) << 5)
}

/// Encode SVC #imm16.
fn svc(imm16: u16) -> u32 {
    0xD400_0001 | ((imm16 as u32) << 5)
}

/// Emit a movz/movk chain that places `value` into `rd` regardless of
/// how many halfwords it spans.
fn load_imm64(rd: u8, value: u64, out: &mut Vec<u32>) {
    let halves = [
        (value & 0xFFFF) as u16,
        ((value >> 16) & 0xFFFF) as u16,
        ((value >> 32) & 0xFFFF) as u16,
        ((value >> 48) & 0xFFFF) as u16,
    ];
    out.push(movz(rd, halves[0], 0));
    if halves[1] != 0 {
        out.push(movk(rd, halves[1], 1));
    }
    if halves[2] != 0 {
        out.push(movk(rd, halves[2], 2));
    }
    if halves[3] != 0 {
        out.push(movk(rd, halves[3], 3));
    }
}

#[test]
fn printf_spills_ninth_int_arg_to_stack() {
    // AAPCS64: x0 = fmt, x1..x7 = vararg ints 1..7. Beyond x7, ints
    // spill to the stack starting at SP+0, advancing 8 bytes per arg.
    // 3 doubles all fit in d0..d2 so no fp spill happens here -- this
    // test exercises the int-spill path the corpus would otherwise
    // never reach.
    let mut cpu = Cpu::new();
    let printf_addr = cpu.host.register("printf", printf::printf);

    let data_base = 0x0060_0000u64;
    let fmt = b"%d %d %d %d %d %d %d %d %d %.1f %.1f %.1f\n\0";
    for (i, b) in fmt.iter().enumerate() {
        cpu.mem.write_u8(data_base + i as u64, *b).unwrap();
    }

    // Pre-populate the FP register file so we don't need to encode FMOV
    // sequences in the test program.
    cpu.regs.write_fpr_f64(0, 1.5);
    cpu.regs.write_fpr_f64(1, 2.5);
    cpu.regs.write_fpr_f64(2, 3.5);

    // Spill slots for ints 8 and 9. The walker reads from SP at the
    // call site; we leave SP at STACK_BASE so SP+0 = STACK_BASE.
    let spill_base = STACK_BASE;
    cpu.mem.write_u64(spill_base, 8).unwrap();
    cpu.mem.write_u64(spill_base + 8, 9).unwrap();

    // Program: load fmt + 7 register-resident ints + printf stub, BLR.
    let mut prog: Vec<u32> = Vec::new();
    load_imm64(0, data_base, &mut prog);
    for i in 1u8..=7u8 {
        load_imm64(i, i as u64, &mut prog);
    }
    load_imm64(16, printf_addr, &mut prog);
    prog.push(blr(16));
    prog.push(svc(1));
    cpu.load_program(&prog);

    let result = cpu.run_until_break(2000).unwrap();
    assert!(result.halted, "program should have halted");
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(stdout, "1 2 3 4 5 6 7 8 9 1.5 2.5 3.5\n");
}

#[test]
fn printf_int_and_float_spill_share_stack_cursor() {
    // The shared-NSAA case: enough ints AND enough doubles to spill
    // both register files, so the walker must advance ONE stack
    // cursor (not two independent ones). With the old code each type
    // had its own (idx-8)*8 formula and the spilled int + spilled
    // double would collide at SP+0.
    let mut cpu = Cpu::new();
    let printf_addr = cpu.host.register("printf", printf::printf);

    let data_base = 0x0060_0000u64;
    // 8 ints (last spills) followed by 9 doubles (last spills).
    let fmt = b"%d %d %d %d %d %d %d %d %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f\n\0";
    for (i, b) in fmt.iter().enumerate() {
        cpu.mem.write_u8(data_base + i as u64, *b).unwrap();
    }

    // d0..d7 carry doubles 1..8. Double 9 spills.
    for n in 0u8..8u8 {
        cpu.regs.write_fpr_f64(n, (n as f64) + 1.0);
    }

    // Stack layout (SP-relative):
    //   SP+0:  spilled int 8     -> walker reads first
    //   SP+8:  spilled double 9  -> walker reads second (shared cursor)
    let spill_base = STACK_BASE;
    cpu.mem.write_u64(spill_base, 8).unwrap();
    cpu.mem.write_u64(spill_base + 8, 9.0f64.to_bits()).unwrap();

    // Program: x0 = fmt, x1..x7 = ints 1..7, BLR printf.
    let mut prog: Vec<u32> = Vec::new();
    load_imm64(0, data_base, &mut prog);
    for i in 1u8..=7u8 {
        load_imm64(i, i as u64, &mut prog);
    }
    load_imm64(16, printf_addr, &mut prog);
    prog.push(blr(16));
    prog.push(svc(1));
    cpu.load_program(&prog);

    let result = cpu.run_until_break(2000).unwrap();
    assert!(result.halted, "program should have halted");
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(
        stdout,
        "1 2 3 4 5 6 7 8 1.0 2.0 3.0 4.0 5.0 6.0 7.0 8.0 9.0\n"
    );
}

#[test]
fn printf_via_host_stub_emits_to_stdout() {
    let mut cpu = Cpu::new();
    let printf_addr = cpu.host.register("printf", printf::printf);

    // Place the format string "hello %d\n" in .data.
    let data_base = 0x0060_0000u64;
    let fmt = b"hello %d\n\0";
    for (i, b) in fmt.iter().enumerate() {
        cpu.mem.write_u8(data_base + i as u64, *b).unwrap();
    }

    // Program: load fmt into x0, 42 into x1, printf stub into x16, blr x16, svc #1 (halt).
    let mut prog: Vec<u32> = Vec::new();
    load_imm64(0, data_base, &mut prog);
    load_imm64(1, 42, &mut prog);
    load_imm64(16, printf_addr, &mut prog);
    prog.push(blr(16));
    prog.push(svc(1)); // non-zero imm16 -> halt, not syscall
    cpu.load_program(&prog);

    let result = cpu.run_until_break(200).unwrap();
    assert!(result.halted, "program should have halted");
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(stdout, "hello 42\n");
}

#[test]
fn scanf_blocks_until_stdin_arrives_and_then_resumes() {
    let mut cpu = Cpu::new();
    use aarch64_emulator::hosted::scanf;
    let scanf_addr = cpu.host.register("scanf", scanf::scanf);

    // Put format "%d" at data_base+0, and reserve 4 bytes for the result.
    let data_base = 0x0060_0000u64;
    cpu.mem.write_u8(data_base, b'%').unwrap();
    cpu.mem.write_u8(data_base + 1, b'd').unwrap();
    cpu.mem.write_u8(data_base + 2, 0).unwrap();
    let result_addr = data_base + 16;

    let mut prog: Vec<u32> = Vec::new();
    load_imm64(0, data_base, &mut prog);
    load_imm64(1, result_addr, &mut prog);
    load_imm64(16, scanf_addr, &mut prog);
    prog.push(blr(16));
    prog.push(svc(1));
    cpu.load_program(&prog);

    // First run: scanf stalls on empty stdin.
    let r = cpu.run_until_break(200).unwrap();
    assert!(!r.halted);
    assert!(cpu.is_blocked(), "scanf should have blocked");

    // Feed input. The run loop should resume and parse the field.
    cpu.push_stdin(b"99\n");
    let r = cpu.run_until_break(200).unwrap();
    assert!(r.halted, "program should have halted after scanf completed");
    let parsed = cpu.mem.read_u32(result_addr).unwrap();
    assert_eq!(parsed, 99);
}

#[test]
fn write_syscall_emits_to_stdout() {
    let mut cpu = Cpu::new();
    let data_base = 0x0060_0000u64;
    let msg = b"hi syscall!\n";
    for (i, b) in msg.iter().enumerate() {
        cpu.mem.write_u8(data_base + i as u64, *b).unwrap();
    }

    // x0 = 1 (stdout), x1 = data_base, x2 = len, x8 = 64 (write), svc #0
    let mut prog: Vec<u32> = Vec::new();
    load_imm64(0, 1, &mut prog);
    load_imm64(1, data_base, &mut prog);
    load_imm64(2, msg.len() as u64, &mut prog);
    load_imm64(8, 64, &mut prog);
    prog.push(svc(0));
    prog.push(svc(1));
    cpu.load_program(&prog);

    let r = cpu.run_until_break(200).unwrap();
    assert!(r.halted);
    let stdout = cpu.take_stdout();
    assert_eq!(stdout, msg);
}

#[test]
fn exit_syscall_sets_exit_code() {
    let mut cpu = Cpu::new();
    // x0 = 7, x8 = 93 (exit), svc #0
    let mut prog: Vec<u32> = Vec::new();
    load_imm64(0, 7, &mut prog);
    load_imm64(8, 93, &mut prog);
    prog.push(svc(0));
    prog.push(svc(1)); // would halt if we got this far
    cpu.load_program(&prog);

    let r = cpu.run_until_break(200).unwrap();
    assert!(r.halted);
    assert_eq!(cpu.exit_code(), Some(7));
}

#[test]
fn exit_libc_stub_halts_with_code() {
    let mut cpu = Cpu::new();
    let exit_addr = cpu.host.register("exit", libc::exit);
    let mut prog: Vec<u32> = Vec::new();
    load_imm64(0, 42, &mut prog);
    load_imm64(16, exit_addr, &mut prog);
    prog.push(blr(16));
    prog.push(svc(1));
    cpu.load_program(&prog);
    let r = cpu.run_until_break(200).unwrap();
    assert!(r.halted);
    assert_eq!(cpu.exit_code(), Some(42));
}

/// Drive the full pipeline the way `assemble_and_load` does: feed source,
/// run until halt, collect stdout. This is the bar the cpsc 355 corpus
/// needs to clear.
fn run_source(source: &str) -> (String, Option<i64>, bool) {
    use aarch64_emulator::frontend::pipeline::assemble_hosted;
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("pipeline should succeed");
    cpu.load_linked_image(&image).unwrap();
    let result = cpu.run_until_break(100_000).unwrap();
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    (stdout, cpu.exit_code(), result.halted)
}

#[test]
fn hosted_pipeline_runs_hello_world_via_syscall() {
    // Minimal week-13-flavored source: .data string, ldr xN, =label,
    // write syscall, halt.
    let src = r#"
.text
.global main
main:
    mov x0, 1
    ldr x1, =msg
    mov x2, 13
    mov x8, 64
    svc 0
    mov x0, 0
    mov x8, 93
    svc 0
.data
msg:
    .string "hello world!\n"
"#;
    let (stdout, exit_code, halted) = run_source(src);
    assert!(halted, "program should halt");
    assert_eq!(stdout, "hello world!\n");
    assert_eq!(exit_code, Some(0));
}

#[test]
fn hosted_pipeline_handles_m4_register_aliases_and_data_word() {
    let src = r#"
define(counter_r, w19)
.text
.global main
main:
    mov counter_r, 42
    ldr x0, =value
    str counter_r, [x0]
    ldr w1, [x0]
    mov x0, 0
    mov x8, 93
    svc 0
.data
value:
    .word 0
"#;
    let (_, exit_code, halted) = run_source(src);
    assert!(halted);
    assert_eq!(exit_code, Some(0));
}

#[test]
fn hosted_pipeline_printf_via_host_stub_integration() {
    use aarch64_emulator::frontend::pipeline::assemble_hosted;
    use aarch64_emulator::hosted::printf;
    // `bl printf` can't reach 0xFFFF_0000 from .text directly. For now
    // we exercise the pipeline up to the point where `ldr x16, =printf`
    // resolves, `blr x16` calls the stub, and stdout picks up the
    // formatted string. `printf` is pre-registered in Cpu::new().
    let src = r#"
.text
.global main
main:
    ldr x0, =fmt
    mov x1, 7
    ldr x16, =printf
    blr x16
    mov x0, 0
    mov x8, 93
    svc 0
.data
fmt:
    .string "got %d\n"
"#;
    let mut cpu = Cpu::new();
    cpu.host.register("printf", printf::printf);
    let image = assemble_hosted(src, &cpu.host).unwrap();
    cpu.load_linked_image(&image).unwrap();
    let r = cpu.run_until_break(100_000).unwrap();
    assert!(r.halted);
    let out = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(out, "got 7\n");
}

#[test]
fn bare_metal_style_svc_zero_with_x8_zero_still_halts() {
    // Regression guard: the five bare-metal examples never set x8, so the
    // SVC #0 at the end should halt exactly as it did before phase B.
    let mut cpu = Cpu::new();
    let mut prog = Vec::new();
    load_imm64(0, 5, &mut prog);
    prog.push(svc(0));
    cpu.load_program(&prog);
    let r = cpu.run_until_break(100).unwrap();
    assert!(r.halted);
    assert_eq!(cpu.regs.read_gpr(0, true), 5);
    assert_eq!(cpu.exit_code(), None);
    // Stack pointer should still be at its base.
    assert_eq!(cpu.regs.read_sp(), STACK_BASE);
    // PC stays at the halting SVC: one MOVZ + one SVC = SVC at offset 4.
    assert_eq!(cpu.regs.read_pc(), CODE_BASE + 4);
}

#[test]
fn hosted_pipeline_frame_locals_via_assignment_alias() {
    // Regression for frame-local addressing through a `name = expr` alias
    // (`score2_s = 20`). The pipeline resolves the alias at the point it
    // appears in the section walk, and `lower_operands` then substitutes
    // the numeric offset into the LDR so the legacy encoder can accept
    // the scaled unsigned offset form.
    let src = r#"
define(fp, x29)
define(lr, x30)
define(score2_r, w20)

score2_s = 20
alloc = -(16 + 16) & -16

.text
.global main
main:   stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     score2_r, 42
        str     score2_r, [fp, score2_s]
        ldr     score2_r, [fp, score2_s]
        mov     w0, 0
        mov     x8, 93
        svc     0
"#;
    let (_, exit_code, halted) = run_source(src);
    assert!(halted);
    assert_eq!(exit_code, Some(0));
}

#[test]
fn hosted_pipeline_bl_host_trampoline_round_trip() {
    // `bl printf` resolves to a 0xFFFF_XXXX host stub address, which is
    // well out of BL's 128 MiB imm26 range from .text. The linker inserts
    // a per-host trampoline (`LDR X16, =printf; BR X16`) and rewrites the
    // call to hop through that trampoline.
    let src = r#"
.text
.global main
main:
    mov     x0, 42
    bl      exit
"#;
    let (_, exit_code, halted) = run_source(src);
    assert!(halted);
    assert_eq!(exit_code, Some(42));
}

#[test]
fn hosted_pipeline_bl_with_tab_whitespace_trampolines() {
    // The legacy string-based redirect did `strip_prefix("bl ")`
    // against a literal space and silently left `bl\texit` untouched,
    // sending the BL at a 0xFFFF_XXXX host stub directly and crashing
    // the encoder's imm26 range check. The token form lexes tab and
    // space identically so the trampoline now wires up correctly.
    let src = "\n.text\n.global main\nmain:\n    mov     x0, 11\n    bl\texit\n";
    let (_, exit_code, halted) = run_source(src);
    assert!(halted);
    assert_eq!(exit_code, Some(11));
}

#[test]
fn hosted_pipeline_empty_args_zeroes_argc_and_argv() {
    // Phase 3 parity check: `load_linked_image(image)` is now defined as
    // `load_linked_image_with_args(image, &[])`, and the empty-args
    // branch of `setup_argv` zeroes w0/x1. A program loaded without args
    // must observe `argc = 0` and `argv = NULL` on entry, identical to
    // the pre-argv legacy behavior.
    use aarch64_emulator::frontend::pipeline::assemble_hosted;
    let src = r#"
.text
.global main
main:
    mov     x0, 0
    mov     x8, 93
    svc     0
"#;
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("pipeline should succeed");
    cpu.load_linked_image(&image).unwrap();
    assert_eq!(cpu.regs.read_gpr(0, true), 0, "argc should be 0 with no args");
    assert_eq!(cpu.regs.read_gpr(1, true), 0, "argv should be NULL with no args");
}

#[test]
fn hosted_pipeline_string_literal_containing_bl_is_left_alone() {
    // `.string "bl printf"` lives in `.rodata` as `Item::Bytes`, so the
    // redirect never sees those tokens; this regression-pins that the
    // bytes survive verbatim regardless of what trampolines exist.
    let src = r#"
.text
.global main
main:
    mov     x0, 1
    ldr     x1, =fake_bl
    mov     x2, 9
    mov     x8, 64
    svc     0
    mov     x0, 0
    mov     x8, 93
    svc     0
.data
fake_bl:
    .string "bl printf"
"#;
    let (stdout, exit_code, halted) = run_source(src);
    assert!(halted);
    assert_eq!(exit_code, Some(0));
    assert_eq!(stdout, "bl printf");
}

#[test]
fn hosted_pipeline_main_return_halts_with_exit_code() {
    // Programs that fall off the end of `main` via `ret` expect the
    // runtime to treat that as `exit(w0)`. The loader stashes a sentinel
    // `__main_return` host-stub address in LR so the final `ret` lands
    // on a stub that halts with the caller's w0 as the exit code.
    let src = r#"
.text
.global main
main:
    stp     x29, x30, [sp, -16]!
    mov     x29, sp
    mov     w0, 7
    ldp     x29, x30, [sp], 16
    ret
"#;
    let (_, exit_code, halted) = run_source(src);
    assert!(halted);
    assert_eq!(exit_code, Some(7));
}

#[test]
fn step_back_restores_registers_and_memory() {
    // Three movz instructions walking w0 from 0->1->2->3. Stepping
    // forward three times sets x0=3; stepping back twice should put
    // x0 back at 1 and then back at 0. PC should track too.
    let mut cpu = Cpu::new();
    let movz0 = 0xD280_0000; // movz x0, #0
    let movz1 = 0xD280_0020; // movz x0, #1
    let movz2 = 0xD280_0040; // movz x0, #2
    let movz3 = 0xD280_0060; // movz x0, #3
    cpu.load_program(&[movz0, movz1, movz2, movz3]);
    // Step forward three times: x0 becomes 2 after the third step.
    for _ in 0..3 {
        cpu.step().unwrap();
    }
    assert_eq!(cpu.regs.read_gpr(0, true), 2);
    assert_eq!(cpu.regs.read_pc(), CODE_BASE + 12);
    assert!(cpu.can_step_back());

    // Step back once -> x0 should be 1 (state before the third step).
    let outcome = cpu.step_back();
    assert!(matches!(outcome, aarch64_emulator::cpu::StepOutcome::Advance));
    assert_eq!(cpu.regs.read_gpr(0, true), 1);
    assert_eq!(cpu.regs.read_pc(), CODE_BASE + 8);

    // Step back twice more -> back to initial state.
    cpu.step_back();
    cpu.step_back();
    assert_eq!(cpu.regs.read_gpr(0, true), 0);
    assert_eq!(cpu.regs.read_pc(), CODE_BASE);
    assert!(!cpu.can_step_back());
}

#[test]
fn step_back_restores_memory_writes() {
    // STR w1, [x0] writes to memory; step-back should unwrite it.
    let mut cpu = Cpu::new();
    // movz x0, #0x7000 (lsl #16) then a write. Keep it simple: hand-
    // build a tiny program that stores at address 0x00700000.
    cpu.regs.write_gpr(0, true, 0x0070_0000);
    cpu.regs.write_gpr(1, true, 0xDEAD_BEEF);
    // STR W1, [X0, #0]: 0xB900_0001
    cpu.load_program(&[0xB900_0001, 0xD4000021]);
    cpu.step().unwrap();
    assert_eq!(cpu.mem.read_u32(0x0070_0000).unwrap(), 0xDEAD_BEEF);
    cpu.step_back();
    assert_eq!(cpu.mem.read_u32(0x0070_0000).unwrap(), 0);
}

#[test]
fn resolve_label_finds_main_after_hosted_assemble() {
    use aarch64_emulator::frontend::pipeline::assemble_hosted;
    let mut cpu = Cpu::new();
    let image = assemble_hosted(
        ".text\n.global main\nmain:\n  mov w0, 0\n  ret\n",
        &cpu.host,
    )
    .expect("assembled");
    cpu.load_linked_image(&image).expect("loaded");
    let main_addr = cpu.resolve_label("main").expect("main exists");
    assert_eq!(main_addr, CODE_BASE, "main should be at .text base");
    assert!(cpu.resolve_label("nonexistent").is_none());
}

#[test]
fn delete_vfs_file_removes_entry() {
    let mut cpu = Cpu::new();
    cpu.upload_vfs_file("foo.txt".to_string(), b"hello".to_vec());
    assert_eq!(cpu.vfs.get("foo.txt"), Some(&b"hello".to_vec()));
    let removed = cpu.vfs.remove("foo.txt").is_some();
    assert!(removed);
    assert!(cpu.vfs.get("foo.txt").is_none());
    // Removing again is a no-op.
    assert!(cpu.vfs.remove("foo.txt").is_none());
}

#[test]
fn pc_trace_records_each_step() {
    // Tiny program: 3 NOPs then HLT (svc #0 with x8=93 = exit). The
    // hostable runtime would normally trip on x8=93; just give it
    // distinct PCs to capture.
    let mut cpu = Cpu::new();
    // 4 nops then a halt. NOP encoding: 0xD503201F.
    cpu.load_program(&[0xD503201F, 0xD503201F, 0xD503201F, 0xD4000021]);
    let _ = cpu.step().unwrap();
    let _ = cpu.step().unwrap();
    let _ = cpu.step().unwrap();
    let trace = cpu.take_pc_trace();
    assert_eq!(trace.len(), 3);
    assert_eq!(trace[0], CODE_BASE);
    assert_eq!(trace[1], CODE_BASE + 4);
    assert_eq!(trace[2], CODE_BASE + 8);
    // Drained trace returns empty until more steps run.
    assert!(cpu.take_pc_trace().is_empty());
}

#[test]
fn dirty_addrs_record_writes() {
    use aarch64_emulator::memory::Memory;
    let mut mem = Memory::new();
    mem.write_u32(0x0070_0000, 0xDEAD_BEEF).unwrap();
    mem.write_u8(0x0070_0010, 0x42).unwrap();
    let dirty = mem.take_dirty();
    assert!(dirty.iter().any(|&(a, l)| a == 0x0070_0000 && l == 4));
    assert!(dirty.iter().any(|&(a, l)| a == 0x0070_0010 && l == 1));
    // Drained: returns empty.
    assert!(mem.take_dirty().is_empty());
}
