//! Unit tests for the CPU: stepping, loading, the walls, stdin and
//! output, host stubs, and step-back.

use super::*;

#[test]
fn stores_and_copies_are_told_from_uses() {
    use PassiveRead::{Copied, Stored, Used};
    let labels = HashMap::new();
    let d = |r: u32| 1u64 << (32 + r);
    let cases = [
        ("str x9, [sp, 16]", Stored(1 << 9)),
        ("str w3, [x1], 4", Stored(1 << 3)),
        ("str x5, [x29, -8]", Stored(1 << 5)),
        ("strb w2, [x0, x4]", Stored(1 << 2)),
        ("str x1, [x1]", Stored(0)),
        ("str x1, [x0, x1]", Stored(0)),
        ("stp x2, x3, [sp, -16]!", Stored((1 << 2) | (1 << 3))),
        ("stp x0, x9, [x0]", Stored(1 << 9)),
        ("str d3, [sp, -16]!", Stored(d(3))),
        ("str q7, [x0]", Stored(d(7))),
        ("stp d8, d9, [sp, 16]", Stored(d(8) | d(9))),
        ("mov x1, x9", Copied { from: 9, to: 1 }),
        ("mov w21, w2", Copied { from: 2, to: 21 }),
        ("fmov d4, d3", Copied { from: 35, to: 36 }),
        ("fmov s1, s2", Copied { from: 34, to: 33 }),
        ("fmov d0, x9", Copied { from: 9, to: 32 }),
        ("fmov x1, d2", Copied { from: 34, to: 1 }),
        ("ldr x9, [sp]", Used),
        ("ldp x2, x3, [sp], 16", Used),
        ("ldr q7, [x0]", Used),
        ("add x1, x9, 0", Used),
        ("mov x1, 5", Used),
        ("orr x1, xzr, x9, lsl 1", Used),
        ("mvn x1, x9", Used),
        ("fmov d0, 1.0", Used),
        ("mov x0, sp", Used),
    ];
    for (line, want) in cases {
        let word = crate::assembler::encode_line_absolute(line, 0, &labels, 1).expect(line);
        assert_eq!(passive_read(&decoder::decode(word).expect(line)), want, "{line}");
    }
}

// hand-encode a few instructions for integration tests

fn encode_movz(rd: u8, imm16: u16, hw: u8) -> u32 {
    // MOVZ Xd, #imm16, LSL #(hw*16)
    // 1_10_100101_hw_imm16_rd
    0xD280_0000 | ((hw as u32) << 21) | ((imm16 as u32) << 5) | (rd as u32)
}

fn encode_add_imm(rd: u8, rn: u8, imm12: u16) -> u32 {
    // ADD Xd, Xn, #imm12
    // 1_0_0_10001_00_imm12_rn_rd
    0x9100_0000 | ((imm12 as u32) << 10) | ((rn as u32) << 5) | (rd as u32)
}

fn encode_subs_imm(rd: u8, rn: u8, imm12: u16) -> u32 {
    // SUBS Xd, Xn, #imm12
    // 1_1_1_10001_00_imm12_rn_rd
    0xF100_0000 | ((imm12 as u32) << 10) | ((rn as u32) << 5) | (rd as u32)
}

fn encode_b_cond(cond: u8, offset_instr: i32) -> u32 {
    // B.cond offset (in instructions, will be *4)
    let imm19 = ((offset_instr as u32) & 0x7FFFF) << 5;
    0x5400_0000 | imm19 | (cond as u32)
}

fn encode_svc(imm16: u16) -> u32 {
    0xD400_0001 | ((imm16 as u32) << 5)
}

#[test]
fn simple_mov_and_add() {
    let mut cpu = Cpu::new();
    let code = vec![
        encode_movz(0, 10, 0),   // MOV X0, #10
        encode_movz(1, 20, 0),   // MOV X1, #20
        encode_add_imm(2, 0, 0), // ADD X2, X0, #0 (copy)
        encode_svc(0),           // halt
    ];
    cpu.load_program(&code);

    // step through all four
    for _ in 0..4 {
        cpu.step().unwrap();
    }

    assert_eq!(cpu.regs.read_gpr(0, true), 10);
    assert_eq!(cpu.regs.read_gpr(1, true), 20);
    assert_eq!(cpu.regs.read_gpr(2, true), 10);
    assert!(cpu.is_halted());
}

#[test]
fn countdown_loop() {
    // X0 = 5; while (X0 != 0) { X0 -= 1; } halt
    let mut cpu = Cpu::new();
    let code = vec![
        encode_movz(0, 5, 0),         // MOV X0, #5
        encode_subs_imm(0, 0, 1),     // loop: SUBS X0, X0, #1
        encode_b_cond(0b0001, -1),     // B.NE loop (offset -1 instruction = -4 bytes)
        encode_svc(0),                 // halt
    ];
    cpu.load_program(&code);

    let result = cpu.run_until_break(100).unwrap();
    assert!(result.halted);
    assert_eq!(cpu.regs.read_gpr(0, true), 0);
}

#[test]
fn changed_regs_tracked() {
    let mut cpu = Cpu::new();
    let code = vec![
        encode_movz(5, 42, 0),
        encode_svc(0),
    ];
    cpu.load_program(&code);

    cpu.step().unwrap();
    assert!(cpu.changed_registers().contains(&5));
}

#[test]
fn changed_fp_regs_tracked() {
    // movz x5, 42 (integer step: fp set stays empty), then fmov d0, #1.5.
    // The VFP8 immediate for 1.5 is 0x78 and the IEEE-754 double bits are
    // 0x3FF8000000000000, both independent literals from the Arm manual,
    // never recomputed through the code under test.
    let mut cpu = Cpu::new();
    let code = vec![
        encode_movz(5, 42, 0),
        0x1E60_1000u32 | (0x78 << 13), // fmov d0, #1.5
        encode_svc(0),
    ];
    cpu.load_program(&code);

    cpu.step().unwrap();
    assert!(cpu.changed_fp_registers().is_empty());
    cpu.step().unwrap();
    assert!(cpu.changed_fp_registers().contains(&0));
    assert_eq!(cpu.regs.read_fpr_bits(0), 0x3FF8_0000_0000_0000);
}

#[test]
fn breakpoint_stops_execution() {
    let mut cpu = Cpu::new();
    let code = vec![
        encode_movz(0, 1, 0),
        encode_movz(1, 2, 0),
        encode_movz(2, 3, 0),
        encode_svc(0),
    ];
    cpu.load_program(&code);

    // break at the third instruction
    cpu.set_breakpoint(CODE_BASE + 8);
    let result = cpu.run_until_break(100).unwrap();

    assert!(result.hit_breakpoint);
    assert!(!result.halted);
    assert_eq!(cpu.regs.read_pc(), CODE_BASE + 8);
    // first two instructions executed
    assert_eq!(cpu.regs.read_gpr(0, true), 1);
    assert_eq!(cpu.regs.read_gpr(1, true), 2);
    // third not yet
    assert_eq!(cpu.regs.read_gpr(2, true), 0);
}

#[test]
fn reset_clears_state() {
    let mut cpu = Cpu::new();
    cpu.regs.write_gpr(0, true, 999);
    cpu.reset();
    assert_eq!(cpu.regs.read_gpr(0, true), 0);
    assert_eq!(cpu.regs.read_sp(), STACK_BASE);
    assert_eq!(cpu.regs.read_pc(), CODE_BASE);
}

#[test]
fn load_sections_writes_data_bytes_at_data_base() {
    use crate::frontend::parser::parse;
    let mut cpu = Cpu::new();
    let prog = parse(".data\n.word 0xdeadbeef\n").unwrap();
    cpu.load_sections(&prog).unwrap();
    let bytes = cpu.mem.read_bytes(DATA_BASE, 4).unwrap();
    assert_eq!(bytes, vec![0xef, 0xbe, 0xad, 0xde]);
}

#[test]
fn load_sections_places_rodata_at_rodata_base() {
    use crate::frontend::parser::parse;
    let mut cpu = Cpu::new();
    let prog = parse(".section .rodata\n.string \"hi\"\n").unwrap();
    cpu.load_sections(&prog).unwrap();
    let bytes = cpu.mem.read_bytes(RODATA_BASE, 3).unwrap();
    assert_eq!(bytes, b"hi\0");
}

#[test]
fn load_sections_reserve_leaves_zeros_in_bss() {
    use crate::frontend::parser::parse;
    let mut cpu = Cpu::new();
    // .skip 40 plus a .byte after so we verify the reserve's length.
    let prog = parse(".bss\n.skip 40\n.byte 0xff\n").unwrap();
    cpu.load_sections(&prog).unwrap();
    // First 40 bytes should still be zero; byte 40 should be 0xff.
    let head = cpu.mem.read_bytes(BSS_BASE, 40).unwrap();
    assert!(head.iter().all(|&b| b == 0));
    let marker = cpu.mem.read_bytes(BSS_BASE + 40, 1).unwrap();
    assert_eq!(marker, vec![0xff]);
}

#[test]
fn load_sections_respects_alignment() {
    use crate::frontend::parser::parse;
    let mut cpu = Cpu::new();
    // After a single byte, .balign 4 should skip 3 bytes before the next word.
    let prog = parse(".data\n.byte 0xaa\n.balign 4\n.word 0x11223344\n").unwrap();
    cpu.load_sections(&prog).unwrap();
    let head = cpu.mem.read_bytes(DATA_BASE, 8).unwrap();
    assert_eq!(head[0], 0xaa);
    // padding bytes stay zero; the next word lands at offset 4.
    assert_eq!(&head[4..8], &[0x44, 0x33, 0x22, 0x11]);
}

#[test]
fn load_sections_empty_program_is_safe() {
    use crate::frontend::parser::parse;
    let mut cpu = Cpu::new();
    let prog = parse("").unwrap();
    cpu.load_sections(&prog).unwrap();
    assert_eq!(cpu.regs.read_pc(), CODE_BASE);
}

#[test]
fn legacy_load_program_still_works() {
    // The bare-metal examples go through load_program, not load_sections.
    // Make sure it still resets PC and writes the right bytes.
    let mut cpu = Cpu::new();
    let code = vec![encode_movz(0, 5, 0), encode_svc(0)];
    cpu.load_program(&code);
    assert_eq!(cpu.regs.read_pc(), CODE_BASE);
    cpu.step().unwrap();
    assert_eq!(cpu.regs.read_gpr(0, true), 5);
}

#[test]
fn reset_re_maps_section_pages() {
    // After reset, a write to each section base should succeed without
    // auto-mapping logic breaking the dlmalloc invariant.
    let mut cpu = Cpu::new();
    cpu.reset();
    cpu.mem.write_u32(DATA_BASE, 0x1234_5678).unwrap();
    cpu.mem.write_u32(RODATA_BASE, 0x9abc_def0).unwrap();
    cpu.mem.write_u32(BSS_BASE, 0xcafe_babe).unwrap();
}

#[test]
fn reset_returns_the_page_budget_to_baseline() {
    // A program that exhausts MAX_MAPPED_PAGES must not leave the
    // budget spent: reset gives the pages back, so the next program
    // starts from the same baseline as a fresh tab.
    let mut cpu = Cpu::new();
    let baseline = cpu.mem.mapped_page_count();
    let mut addr = 0x0100_0000u64;
    while cpu.mem.write_u8(addr, 1).is_ok() {
        addr += 4096;
    }
    assert!(cpu.mem.mapped_page_count() >= crate::memory::MAX_MAPPED_PAGES);
    cpu.reset();
    assert_eq!(cpu.mem.mapped_page_count(), baseline);
    // And the budget is genuinely usable again.
    cpu.mem.write_u8(0x0100_0000, 1).unwrap();
}

// -- step outcome and hosted state --

#[test]
fn step_outcome_advance_on_normal_instruction() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 5, 0)]);
    let r = cpu.step().unwrap();
    assert_eq!(r.outcome, StepOutcome::Advance);
}

#[test]
fn step_outcome_halted_on_svc() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_svc(0)]);
    let r = cpu.step().unwrap();
    assert_eq!(r.outcome, StepOutcome::Halted);
    assert!(r.halted);
}

#[test]
fn output_ceiling_halts_calmly() {
    // The step and page walls never covered printing; a write syscall
    // crossing MAX_OUTPUT_BYTES must halt with the calm message.
    let mut cpu = Cpu::new();
    cpu.load_program(&[
        encode_movz(8, 64, 0),   // x8 = write
        encode_movz(0, 1, 0),    // x0 = stdout
        encode_movz(1, 0x60, 1), // x1 = DATA_BASE (0x0060_0000)
        encode_movz(2, 16, 0),   // x2 = 16 bytes
        encode_svc(0),
    ]);
    for i in 0..16 {
        cpu.mem.write_u8(0x0060_0000 + i, b'x').unwrap();
    }
    cpu.output_total = MAX_OUTPUT_BYTES - 8;
    let r = cpu.run_until_break(100).unwrap();
    assert!(r.halted);
    assert_eq!(r.error, Some(output_ceiling_message()));
    assert_eq!(cpu.abort_message, Some(output_ceiling_message()));
}

#[test]
fn output_accounting_survives_console_drains() {
    // The wall measures what the program produced, not what happens to
    // be queued: draining stdout between steps must not reset it.
    let mut cpu = Cpu::new();
    cpu.load_program(&[
        encode_movz(8, 64, 0),
        encode_movz(0, 1, 0),
        encode_movz(1, 0x60, 1),
        encode_movz(2, 16, 0),
        encode_svc(0),
    ]);
    for i in 0..16 {
        cpu.mem.write_u8(0x0060_0000 + i, b'x').unwrap();
    }
    cpu.output_total = MAX_OUTPUT_BYTES - 8;
    for _ in 0..4 {
        cpu.step().unwrap();
        let _ = cpu.take_stdout(); // UI heartbeat drain
    }
    let r = cpu.step().unwrap(); // the svc that crosses the wall
    assert!(r.halted);
    assert_eq!(r.error, Some(output_ceiling_message()));
}

#[test]
fn step_back_restores_the_display_counters_but_never_the_output_budget() {
    // Two counters over the same bytes, on purpose. The display pair
    // rolls back so a host can unprint an undone step; the flood
    // budget does not, or a step/step-back loop would print forever.
    let mut cpu = Cpu::new();
    cpu.load_program(&[
        encode_movz(8, 64, 0),   // x8 = write
        encode_movz(0, 1, 0),    // x0 = stdout
        encode_movz(1, 0x60, 1), // x1 = DATA_BASE (0x0060_0000)
        encode_movz(2, 16, 0),   // x2 = 16 bytes
        encode_svc(0),
    ]);
    for i in 0..16 {
        cpu.mem.write_u8(0x0060_0000 + i, b'x').unwrap();
    }
    for _ in 0..5 {
        cpu.step().unwrap();
    }
    assert_eq!(cpu.stdout_seen(), 16);
    assert_eq!(cpu.output_total, 16);

    cpu.step_back(); // undo the svc that wrote
    assert_eq!(cpu.stdout_seen(), 0, "the display counter follows the frame");
    assert_eq!(cpu.output_total, 16, "the wall keeps counting the original");
    assert_eq!(cpu.stdout.len(), 16, "the buffer is not rolled back");
}

#[test]
fn an_interactive_push_echoes_where_a_plain_push_stays_silent() {
    // The queue is the same either way; only the echo differs. Hand
    // the read syscall one typed line and one redirected line and
    // watch which one reaches stdout.
    let read_program = [
        encode_movz(8, 63, 0),   // x8 = read
        encode_movz(0, 0, 0),    // x0 = stdin
        encode_movz(1, 0x60, 1), // x1 = DATA_BASE
        encode_movz(2, 4, 0),    // x2 = 4 bytes
        encode_svc(0),
    ];

    let mut typed = Cpu::new();
    typed.load_program(&read_program);
    typed.push_stdin_interactive(b"ab\n");
    for _ in 0..5 {
        typed.step().unwrap();
    }
    assert_eq!(typed.stdout, b"ab\n");
    assert!(typed.stdin.is_empty(), "the read drained the line");

    let mut redirected = Cpu::new();
    redirected.load_program(&read_program);
    redirected.push_stdin(b"ab\n");
    for _ in 0..5 {
        redirected.step().unwrap();
    }
    assert!(redirected.stdout.is_empty());
}

#[test]
fn unsupported_syscall_halts_calmly_instead_of_wedging() {
    // A raw error with `halted` false and PC unmoved lets Run re-issue
    // chunks against the same fault at full speed and freeze the tab,
    // and every Step reproduces the identical error forever.
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(8, 172, 0), encode_svc(0)]);
    cpu.step().unwrap(); // mov x8, 172 (getpid, not implemented)
    let r = cpu.step().unwrap(); // svc 0
    assert!(r.halted);
    assert!(r.error.as_deref().unwrap_or("").contains("172"));
    assert!(cpu.is_halted());
    assert!(cpu.abort_message.is_some());
    // A further step must not re-execute anything.
    let pc_before = cpu.regs.read_pc();
    let again = cpu.step().unwrap();
    assert_eq!(again.outcome, StepOutcome::Halted);
    assert_eq!(cpu.regs.read_pc(), pc_before);
}

#[test]
fn exit_group_terminates_like_exit() {
    // glibc's exit() issues exit_group (94) on AArch64 Linux; the
    // course machine accepts it, so the playground must too.
    let mut cpu = Cpu::new();
    cpu.load_program(&[
        encode_movz(0, 7, 0),
        encode_movz(8, 94, 0),
        encode_svc(0),
    ]);
    let r = cpu.run_until_break(10).unwrap();
    assert!(r.halted);
    assert_eq!(r.error, None);
    assert_eq!(cpu.exit_code(), Some(7));
}

#[test]
fn undecodable_word_halts_calmly_with_the_message_preserved() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[0x0000_0000]);
    let r = cpu.step().unwrap();
    assert!(r.halted);
    assert!(
        r.error.as_deref().unwrap_or("").contains("unknown instruction"),
        "error was: {:?}",
        r.error
    );
    assert!(cpu.is_halted());
}

#[test]
fn runtime_fault_during_run_keeps_the_executed_step_count() {
    // Three good instructions then a read fault; the run result must
    // report the steps that DID execute, halted, and the message.
    let mut cpu = Cpu::new();
    cpu.load_program(&[
        encode_movz(0, 1, 0),
        encode_movz(1, 2, 0),
        encode_movz(2, 3, 0),
        0xF940_0020, // ldr x0, [x1]: x1 = 2, unmapped/unaligned
    ]);
    let r = cpu.run_until_break(100).unwrap();
    assert!(r.halted);
    assert_eq!(r.steps_executed, 4);
    assert!(r.error.is_some());
    assert_eq!(cpu.regs.read_gpr(2, true), 3);
}

#[test]
fn step_outcome_waiting_for_input_when_blocked() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 1, 0)]);
    cpu.blocked = true;
    let r = cpu.step().unwrap();
    assert_eq!(r.outcome, StepOutcome::WaitingForInput);
    // PC stayed put.
    assert_eq!(r.pc, CODE_BASE);
}

#[test]
fn push_stdin_clears_blocked() {
    let mut cpu = Cpu::new();
    cpu.blocked = true;
    cpu.push_stdin(b"hello\n");
    assert!(!cpu.blocked);
    assert_eq!(cpu.stdin, b"hello\n");
}

#[test]
fn step_outcome_exited_when_exit_code_set() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 5, 0), encode_svc(0)]);
    // Simulate an exit() stub setting the code before the halting SVC.
    cpu.exit_code = Some(42);
    // First step: advance past the mov, but outcome reflects the pending exit.
    let r = cpu.step().unwrap();
    assert_eq!(r.outcome, StepOutcome::Exited(42));
    assert!(r.halted);
}

#[test]
fn reset_clears_hosted_state() {
    let mut cpu = Cpu::new();
    cpu.stdout.extend_from_slice(b"stale");
    cpu.stderr.extend_from_slice(b"err");
    cpu.stdin.extend_from_slice(b"input");
    cpu.blocked = true;
    cpu.exit_code = Some(7);
    cpu.vfs.insert("a.txt".into(), b"data".to_vec());
    cpu.open_files
        .insert(3, OpenFile { path: "a.txt".into(), offset: 0, writable: false });
    cpu.next_fd = 42;
    cpu.reset();
    assert!(cpu.stdout.is_empty());
    assert!(cpu.stderr.is_empty());
    assert!(cpu.stdin.is_empty());
    assert!(!cpu.blocked);
    assert!(cpu.exit_code.is_none());
    assert!(cpu.vfs.is_empty());
    assert!(cpu.open_files.is_empty());
    assert_eq!(cpu.next_fd, 3);
}

#[test]
fn the_strtok_cursor_rides_in_snapshots_and_clears_on_reset() {
    // strtok's cursor is the one piece of libc state a program can
    // observe without holding it: if step-back left it where the
    // undone call put it, replaying the call would hand out the
    // NEXT token instead of the same one.
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 1, 0), encode_movz(0, 2, 0)]);
    cpu.strtok_save = 0x0050_0004;
    cpu.save_state("mid-parse");
    cpu.step().unwrap();
    cpu.strtok_save = 0x0050_0009;
    cpu.step_back();
    assert_eq!(cpu.strtok_save, 0x0050_0004);
    cpu.strtok_save = 0x0050_000E;
    assert!(cpu.load_state("mid-parse"));
    assert_eq!(cpu.strtok_save, 0x0050_0004);
    cpu.reset();
    assert_eq!(cpu.strtok_save, 0);
}

#[test]
fn run_until_break_pauses_on_blocked() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 1, 0), encode_svc(0)]);
    cpu.blocked = true;
    // Even with max_steps=100, the loop should bail immediately.
    let r = cpu.run_until_break(100).unwrap();
    assert_eq!(r.steps_executed, 0);
    assert!(!r.halted);
}

#[test]
fn pc_landing_on_host_stub_dispatches_and_returns_to_lr() {
    // BL can't reach 0xFFFF_0000 from CODE_BASE in a single imm26 hop,
    // so in real code a BLR via a literal-pool load takes us there.
    // For the dispatch test we set PC/LR directly and step, which is
    // exactly the state the CPU lands in after the real sequence.
    use crate::hosted::{HostContext, HostOutcome};
    use crate::cpu::HOST_STUB_BASE;

    fn writes_x0_seven(ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
        ctx.regs.write_gpr(0, true, 7);
        Ok(HostOutcome::Continue)
    }
    let mut cpu = Cpu::new();
    let stub_addr = cpu.host.register("test_stub", writes_x0_seven);
    cpu.load_program(&[encode_svc(0)]); // halt after the stub returns
    cpu.regs.write_gpr(30, true, CODE_BASE);
    cpu.regs.write_pc(stub_addr);
    let r = cpu.step().unwrap();
    assert_eq!(r.outcome, StepOutcome::Advance);
    assert_eq!(cpu.regs.read_gpr(0, true), 7);
    assert_eq!(cpu.regs.read_pc(), CODE_BASE);
    // One more step: the halting SVC runs.
    let r = cpu.step().unwrap();
    assert!(r.halted);
    // Sanity: address is aligned to the stub stride above the base.
    assert!(stub_addr >= HOST_STUB_BASE);
    assert_eq!((stub_addr - HOST_STUB_BASE) % 16, 0);
}

#[test]
fn step_back_replays_the_same_rand_draw() {
    // rand's state rides in the snapshot: undoing a draw and stepping
    // again must produce the identical value, or replay diverges.
    let mut cpu = Cpu::new();
    let stub_addr = cpu.host.lookup("rand").expect("rand pre-registered");
    cpu.load_program(&[encode_svc(0)]);
    // First draw.
    cpu.regs.write_gpr(30, true, CODE_BASE);
    cpu.regs.write_pc(stub_addr);
    cpu.step().unwrap();
    let first = cpu.regs.read_gpr(0, true);
    // Second draw.
    cpu.regs.write_gpr(30, true, CODE_BASE);
    cpu.regs.write_pc(stub_addr);
    cpu.step().unwrap();
    let second = cpu.regs.read_gpr(0, true);
    assert_ne!(first, second, "consecutive draws differ");
    // Undo the second draw and take it again: same value.
    cpu.step_back();
    cpu.step().unwrap();
    assert_eq!(cpu.regs.read_gpr(0, true), second);
}

#[test]
fn host_stub_returning_exited_halts_cpu_and_sets_code() {
    use crate::hosted::{HostContext, HostOutcome};
    fn exit_stub(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
        Ok(HostOutcome::Exited(99))
    }
    let mut cpu = Cpu::new();
    let stub_addr = cpu.host.register("exit", exit_stub);
    cpu.regs.write_pc(stub_addr);
    cpu.regs.write_gpr(30, true, CODE_BASE);
    let r = cpu.step().unwrap();
    assert_eq!(r.outcome, StepOutcome::Exited(99));
    assert_eq!(cpu.exit_code(), Some(99));
    assert!(cpu.is_halted());
}

#[test]
fn host_stub_returning_need_input_blocks_cpu() {
    use crate::hosted::{HostContext, HostOutcome};
    fn scanf_like(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
        Ok(HostOutcome::NeedInput)
    }
    let mut cpu = Cpu::new();
    let stub_addr = cpu.host.register("scanf", scanf_like);
    cpu.regs.write_pc(stub_addr);
    cpu.regs.write_gpr(30, true, CODE_BASE);
    let r = cpu.step().unwrap();
    assert_eq!(r.outcome, StepOutcome::WaitingForInput);
    assert!(cpu.is_blocked());
    // PC stays at the stub so re-entry re-dispatches once stdin is fed.
    assert_eq!(cpu.regs.read_pc(), stub_addr);
}

#[test]
fn clear_console_does_not_reset_cpu_state() {
    let mut cpu = Cpu::new();
    cpu.regs.write_gpr(0, true, 99);
    cpu.stdout.extend_from_slice(b"hello");
    cpu.clear_console();
    assert!(cpu.stdout.is_empty());
    // The rest of the CPU state is untouched.
    assert_eq!(cpu.regs.read_gpr(0, true), 99);
}

// -- runaway-loop / step-ceiling bounds --

#[test]
fn steps_total_increments_once_per_step() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[
        encode_movz(0, 1, 0),
        encode_movz(1, 2, 0),
        encode_movz(2, 3, 0),
        encode_svc(0),
    ]);
    cpu.step().unwrap();
    cpu.step().unwrap();
    cpu.step().unwrap();
    assert_eq!(cpu.steps_total, 3);
}

#[test]
fn step_ceiling_aborts_calmly_with_message() {
    let mut cpu = Cpu::new();
    // b . (branch to self): an unconditional infinite loop.
    cpu.load_program(&[0x1400_0000]);
    // Fast-forward the cumulative budget to the wall so the exact
    // boundary is exercised without running ten million steps.
    cpu.steps_total = MAX_TOTAL_STEPS - 1;
    let first = cpu.run_until_break(100).unwrap();
    assert!(first.halted, "the run should halt at the ceiling");
    assert_eq!(first.error, Some(step_ceiling_message()));
    assert_eq!(cpu.abort_message, Some(step_ceiling_message()));
    // The wall holds across repeated runs: still halted, no more steps.
    let again = cpu.run_until_break(100).unwrap();
    assert!(again.halted);
    assert_eq!(again.steps_executed, 0);
    assert_eq!(again.error, Some(step_ceiling_message()));
}

#[test]
fn step_ceiling_also_bounds_single_stepping() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[0x1400_0000]); // b .
    cpu.steps_total = MAX_TOTAL_STEPS;
    // A single step at the wall halts calmly rather than executing.
    let r = cpu.step().unwrap();
    assert!(r.halted);
    assert_eq!(r.error, Some(step_ceiling_message()));
    assert_eq!(r.outcome, StepOutcome::Halted);
}

#[test]
fn breakpoint_on_a_chunk_boundary_is_reported_not_skipped() {
    // Both backends drive runs in fixed-size chunks; a breakpoint whose
    // first arrival lands exactly on a chunk boundary must be reported
    // by the ending chunk, because the next chunk's first-step resume
    // exemption would otherwise run straight through it.
    let mut cpu = Cpu::new();
    let code = vec![
        encode_movz(0, 1, 0),
        encode_movz(1, 2, 0),
        encode_movz(2, 3, 0),
        encode_movz(3, 4, 0),
        encode_svc(0),
    ];
    cpu.load_program(&code);
    cpu.set_breakpoint(CODE_BASE + 8); // the third instruction

    // Chunk of exactly 2 steps: the loop stops at the cap with PC
    // resting on the breakpoint that has not yet been reported.
    let chunk = cpu.run_until_break(2).unwrap();
    assert_eq!(chunk.pc, CODE_BASE + 8);
    assert!(chunk.hit_breakpoint, "the boundary chunk must report the hit");
    assert_eq!(cpu.regs.read_gpr(2, true), 0, "the breakpoint line must not execute");

    // A true resume steps past it and runs to the halt.
    let resumed = cpu.run_until_break(100).unwrap();
    assert!(resumed.halted);
    assert_eq!(cpu.regs.read_gpr(2, true), 3);
}

#[test]
fn restore_paths_clear_a_stale_abort_message() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    cpu.save_state("checkpoint");
    cpu.step().unwrap();

    // A recorded abort must not survive into a restored save...
    cpu.abort_message = Some("stale abort".to_string());
    assert!(cpu.load_state("checkpoint"));
    assert!(cpu.abort_message.is_none());
    let r = cpu.run_until_break(10).unwrap();
    assert!(r.halted);
    assert!(r.error.is_none(), "a clean run after restore reports no error");

    // ...nor past a backward step, which also refunds the step budget.
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    cpu.step().unwrap();
    let spent = cpu.steps_total;
    cpu.abort_message = Some("stale abort".to_string());
    cpu.step_back();
    assert!(cpu.abort_message.is_none());
    assert_eq!(cpu.steps_total, spent - 1);
}

#[test]
fn restoring_a_save_drops_the_step_back_history() {
    // Frames recorded after the save sit in the restored machine's
    // FUTURE: one step back off a restore would land two instructions
    // past the restore point.
    let mut cpu = Cpu::new();
    cpu.load_program(&[
        encode_movz(0, 1, 0),
        encode_movz(1, 2, 0),
        encode_movz(2, 3, 0),
        encode_movz(3, 4, 0),
        encode_svc(0),
    ]);
    cpu.step().unwrap();
    cpu.save_state("checkpoint");
    let restore_pc = cpu.regs.read_pc();
    cpu.step().unwrap();
    cpu.step().unwrap();
    cpu.step().unwrap();

    assert!(cpu.load_state("checkpoint"));
    assert_eq!(cpu.regs.read_pc(), restore_pc);
    assert!(!cpu.can_step_back(), "a restore ends the recorded history");
    cpu.step_back();
    assert_eq!(
        cpu.regs.read_pc(),
        restore_pc,
        "step_back must never move the machine forward"
    );
    assert_eq!(cpu.regs.read_gpr(3, true), 0, "no future write survives");
}

#[test]
fn an_ignored_sleep_never_stalls_the_machine() {
    use crate::hosted::{HostContext, HostOutcome};
    fn sleeper(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
        Ok(HostOutcome::Sleep(1_000_000))
    }
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    let stub = cpu.host.register("sleeper", sleeper);
    cpu.regs.write_pc(stub);
    cpu.regs.write_gpr(30, true, CODE_BASE);

    let first = cpu.run_until_break(10).unwrap();
    assert_eq!(first.steps_executed, 1, "the run hands back at the pause");
    assert!(!first.halted);

    // The runner never asks for the pause: a native embedder, or any
    // driver that forgets `take_pending_sleep_ns`. A kept pause makes
    // every later call execute zero steps.
    let second = cpu.run_until_break(10).unwrap();
    assert!(
        second.steps_executed > 0,
        "a forgotten pause must not wedge the run loop"
    );
    assert!(second.halted);
    assert_eq!(cpu.regs.read_gpr(0, true), 7);
}

#[test]
fn only_the_sleeping_step_reports_sleeping() {
    use crate::hosted::{HostContext, HostOutcome};
    fn sleeper(_ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
        Ok(HostOutcome::Sleep(1_000_000))
    }
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    let stub = cpu.host.register("sleeper", sleeper);
    cpu.regs.write_pc(stub);
    cpu.regs.write_gpr(30, true, CODE_BASE);

    let slept = cpu.step().unwrap();
    assert_eq!(slept.outcome, StepOutcome::Sleeping(1_000_000));
    // The pause is still readable right after the step that asked for
    // it, and the next step clears it: it describes one instruction,
    // not the rest of the program.
    let next = cpu.step().unwrap();
    assert_eq!(next.outcome, StepOutcome::Advance);
    assert_eq!(cpu.take_pending_sleep_ns(), None);
}

#[test]
fn bulk_stub_work_is_charged_against_the_step_budget() {
    use crate::hosted::{HostContext, HostOutcome};
    // A whole-page fill inside ONE instruction, the shape of `memset`
    // over an already-mapped buffer. Unpriced, a loop of these picks
    // its own workload per step and the runaway wall never sees it.
    fn fills_a_page(ctx: &mut HostContext<'_>) -> Result<HostOutcome, crate::errors::EmuError> {
        for i in 0..4096u64 {
            ctx.mem.write_u8(0x1000_0000 + i, 0xAB)?;
        }
        Ok(HostOutcome::Continue)
    }
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    let stub = cpu.host.register("filler", fills_a_page);
    cpu.regs.write_pc(stub);
    cpu.regs.write_gpr(30, true, CODE_BASE);

    cpu.step().unwrap();
    assert_eq!(
        cpu.steps_total,
        1 + 4096 / BULK_BYTES_PER_STEP,
        "the bytes moved must be charged on top of the step itself"
    );

    // An ordinary instruction still costs exactly one step.
    let before = cpu.steps_total;
    cpu.step().unwrap();
    assert_eq!(cpu.steps_total, before + 1);
}

#[test]
fn the_sleep_output_refund_stops_at_its_lifetime_cap() {
    // Without a cap of its own the step refund's cap is the only limit,
    // and the documented 4 MiB output wall becomes 23 MiB. The lifetime
    // cap states the true ceiling:
    // MAX_OUTPUT_BYTES, plus at most MAX_REFUND_OUTPUT_BYTES earned
    // back by real pauses.
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_svc(0)]);
    let start = MAX_OUTPUT_BYTES * 3;
    cpu.output_total = start;
    let per_sleep = (MAX_SLEEP_NS / SLEEP_OUTPUT_REFUND_NS_PER_BYTE) as usize;
    for _ in 0..(MAX_REFUND_OUTPUT_BYTES / per_sleep + 20) {
        cpu.apply_sleep(MAX_SLEEP_NS);
    }
    assert_eq!(
        start - cpu.output_total,
        MAX_REFUND_OUTPUT_BYTES,
        "the output refund must stop at its lifetime cap"
    );
    // A fresh program starts the refund budget over.
    cpu.load_program(&[encode_svc(0)]);
    cpu.output_total = start;
    cpu.apply_sleep(MAX_SLEEP_NS);
    assert_eq!(start - cpu.output_total, per_sleep);
}

#[test]
fn a_halted_run_still_reports_its_own_abort() {
    // The stale-message gate must not swallow a genuine abort raised by
    // the run itself.
    let mut cpu = Cpu::new();
    cpu.load_program(&[0x1400_0000]); // b .
    cpu.steps_total = MAX_TOTAL_STEPS - 1;
    let r = cpu.run_until_break(10).unwrap();
    assert!(r.halted);
    assert_eq!(r.error, Some(step_ceiling_message()));
}

#[test]
fn a_runaway_sp_halts_with_the_stack_overflow_cause() {
    // Never run real deep recursion here (slow in debug); park sp past
    // the floor directly and take one step.
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    cpu.regs.write_sp(STACK_FLOOR - 16);
    let r = cpu.step().unwrap();
    assert!(r.halted);
    let msg = r.error.unwrap_or_default();
    assert!(msg.contains("stack overflow"), "was: {msg}");
    assert!(msg.contains("recursion"), "was: {msg}");
    assert!(cpu.is_halted());

    // A normal frame nowhere near the floor is untouched.
    let mut cpu = Cpu::new();
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    cpu.regs.write_sp(STACK_BASE - 4096);
    let r = cpu.step().unwrap();
    assert!(r.error.is_none());
}

#[test]
fn load_program_resets_the_step_budget() {
    let mut cpu = Cpu::new();
    cpu.load_program(&[0x1400_0000]);
    cpu.steps_total = MAX_TOTAL_STEPS;
    cpu.abort_message = Some("stale".to_string());
    // Reloading a program starts a fresh budget and clears the message.
    cpu.load_program(&[encode_movz(0, 7, 0), encode_svc(0)]);
    assert_eq!(cpu.steps_total, 0);
    assert!(cpu.abort_message.is_none());
    let r = cpu.run_until_break(10).unwrap();
    assert!(r.halted);
    assert!(r.error.is_none());
    assert_eq!(cpu.regs.read_gpr(0, true), 7);
}

#[test]
fn reset_clears_the_step_budget_and_abort_message() {
    let mut cpu = Cpu::new();
    cpu.steps_total = 12_345;
    cpu.abort_message = Some("stale".to_string());
    cpu.reset();
    assert_eq!(cpu.steps_total, 0);
    assert!(cpu.abort_message.is_none());
}

// -- memory cap hit inside the hosted write paths --

#[test]
fn host_stub_write_past_page_cap_aborts_calmly() {
    use crate::hosted::{HostContext, HostOutcome};
    use crate::memory::MAX_MAPPED_PAGES;
    // A libc-style stub that writes into a fresh, unmapped page. At the
    // page cap that write raises a Write MemoryFault, exactly as a real
    // buffer-filling routine (scanf/read) would near the cap.
    fn writes_fresh_page(
        ctx: &mut HostContext<'_>,
    ) -> Result<HostOutcome, crate::errors::EmuError> {
        ctx.mem.write_u32(0x2000_0000, 0)?;
        Ok(HostOutcome::Continue)
    }
    let mut cpu = Cpu::new();
    // Fill the page budget so the stub's write would map one page too many.
    let baseline = cpu.mem.mapped_page_count();
    for i in 0..(MAX_MAPPED_PAGES - baseline) {
        cpu.mem.map_page(0x1000_0000 + (i as u64) * 4096);
    }
    let stub_addr = cpu.host.register("cap_writer", writes_fresh_page);
    cpu.regs.write_pc(stub_addr);
    cpu.regs.write_gpr(30, true, CODE_BASE);
    let r = cpu.step().unwrap();
    assert!(r.halted, "a cap hit in a libc stub must halt");
    assert_eq!(
        r.error.as_deref(),
        Some(MEMORY_CAP_MESSAGE),
        "a libc-path cap hit must carry the calm memory-cap message"
    );
    assert_eq!(cpu.abort_message.as_deref(), Some(MEMORY_CAP_MESSAGE));
    assert_eq!(r.outcome, StepOutcome::Halted);
}

#[test]
fn syscall_write_past_page_cap_aborts_calmly() {
    use crate::memory::MAX_MAPPED_PAGES;
    let mut cpu = Cpu::new();
    // `svc #0` with x8 = read(63) dispatches the read syscall, which
    // copies stdin into the buffer pointed at by x1.
    cpu.load_program(&[encode_svc(0)]);
    cpu.push_stdin(b"data");
    // Fill the page budget so the read's buffer write maps one page too many.
    let baseline = cpu.mem.mapped_page_count();
    for i in 0..(MAX_MAPPED_PAGES - baseline) {
        cpu.mem.map_page(0x1000_0000 + (i as u64) * 4096);
    }
    cpu.regs.write_gpr(8, true, 63); // SYS_READ
    cpu.regs.write_gpr(0, true, 0); // fd 0 (stdin)
    cpu.regs.write_gpr(1, true, 0x2000_0000); // unmapped buffer at the cap
    cpu.regs.write_gpr(2, true, 4); // count
    let r = cpu.step().unwrap();
    assert!(r.halted, "a cap hit in a syscall must halt");
    assert_eq!(
        r.error.as_deref(),
        Some(MEMORY_CAP_MESSAGE),
        "a syscall-path cap hit must carry the calm memory-cap message"
    );
    assert_eq!(cpu.abort_message.as_deref(), Some(MEMORY_CAP_MESSAGE));
}
