//! Runaway-loop and memory-bomb bounds. These prove the in-browser
//! execution sandbox can never hang or exhaust the tab: a
//! runaway loop hits the cumulative step ceiling and a runaway allocation
//! hits the mapped-page cap, both aborting as a CALM halt that carries a
//! plain-language message through the result `error` field, never a
//! silent stop, never a raw panic. A normal program stays well under both
//! walls and finishes unaffected.
//!
//! The bounds live in the emulator, so they hold regardless of how the
//! program arrived (typed, decoded from a share link, or uploaded).

use aarch64_emulator::cpu::{
    step_ceiling_message, Cpu, MAX_SNAPSHOT_SIDE_BYTES, MAX_TOTAL_STEPS, MEMORY_CAP_MESSAGE,
};
use aarch64_emulator::frontend::pipeline::assemble_hosted;
use aarch64_emulator::hosted::syscalls::MAX_OPEN_FILES;
use aarch64_emulator::memory::MAX_MAPPED_PAGES;

// Hand-encoded instructions, matching the convention in the cpu / hosted
// integration tests (authored here, not copied from any course material).

/// MOVZ Xd, #imm16, LSL #(hw*16).
fn movz(rd: u8, imm16: u16, hw: u8) -> u32 {
    0xD280_0000 | ((hw as u32) << 21) | ((imm16 as u32) << 5) | (rd as u32)
}

/// SUBS Xd, Xn, #imm12.
fn subs_imm(rd: u8, rn: u8, imm12: u16) -> u32 {
    0xF100_0000 | ((imm12 as u32) << 10) | ((rn as u32) << 5) | (rd as u32)
}

/// B.cond with a branch offset measured in instructions.
fn b_cond(cond: u8, offset_instr: i32) -> u32 {
    let imm19 = ((offset_instr as u32) & 0x7FFFF) << 5;
    0x5400_0000 | imm19 | (cond as u32)
}

/// SVC #imm16.
fn svc(imm16: u16) -> u32 {
    0xD400_0001 | ((imm16 as u32) << 5)
}

// The full end-to-end runaway wall executes the real ~10M-step ceiling,
// which takes ~60s in a debug build -- too slow for the default `cargo test`
// gate. It is kept as an on-demand proof; run it explicitly with
// `cargo test --test bounds -- --ignored`. The fast boundary proof (the
// ceiling fires exactly at MAX_TOTAL_STEPS) lives in the cpu unit tests
// (`step_ceiling_aborts_calmly_with_message`), which the default gate runs.
#[test]
#[ignore = "runs the real ~10M-step wall (~60s); run with --ignored"]
fn runaway_loop_aborts_calmly_within_the_step_ceiling() {
    let mut cpu = Cpu::new();
    // `b .`, a branch to self and so an infinite loop. Driven with a
    // step budget just above the ceiling so the runaway wall (not max_steps)
    // is what stops it. This runs the real ~10M-step wall end to end,
    // proving a runaway program terminates rather than hanging the tab.
    cpu.load_program(&[0x1400_0000]);
    let r = cpu.run_until_break(MAX_TOTAL_STEPS as u32 + 16).unwrap();

    assert!(r.halted, "a runaway loop must halt at the ceiling");
    assert_eq!(
        r.error,
        Some(step_ceiling_message()),
        "the abort must carry the calm step-ceiling message"
    );
    assert!(
        r.steps_executed as u64 <= MAX_TOTAL_STEPS + 2,
        "the wall must stop the loop at ~MAX_TOTAL_STEPS, got {}",
        r.steps_executed
    );
}

#[test]
fn memory_bomb_aborts_calmly_within_the_page_cap() {
    let mut cpu = Cpu::new();
    // Fill almost the whole page budget up front. `map_page` does not push a
    // step-back snapshot, so this reaches the near-cap condition without the
    // ring cloning ~1000 pages per step; the store loop below then needs only
    // a handful of new-page writes to walk across the cap.
    let baseline = cpu.mem.mapped_page_count();
    let filler_base = 0x1000_0000u64;
    // Four pages of headroom: enough for the store loop to walk across the
    // cap, few enough that the run stays fast.
    for i in 0..(MAX_MAPPED_PAGES - baseline - 4) {
        cpu.mem.map_page(filler_base + (i as u64) * 4096);
    }

    // x0 = 0x2000_0000; loop: str w1,[x0]; x0 += 4096; b loop. Each store
    // maps a fresh page, so the loop walks straight into the cap and the
    // store that would map one page too many aborts calmly.
    cpu.load_program(&[
        movz(0, 0x2000, 1), // movz x0, #0x2000, lsl #16  -> x0 = 0x2000_0000
        0xB900_0001,        // str  w1, [x0]              -> maps the page at x0
        0x9140_0400,        // add  x0, x0, #1, lsl #12   -> x0 += 4096
        0x17FF_FFFE,        // b    -2                    -> back to the store
    ]);
    let r = cpu.run_until_break(1_000_000).unwrap();

    assert!(r.halted, "a memory bomb must halt at the cap");
    assert_eq!(
        r.error.as_deref(),
        Some(MEMORY_CAP_MESSAGE),
        "the abort must carry the calm memory-cap message"
    );
    assert!(
        cpu.mem.mapped_page_count() <= MAX_MAPPED_PAGES,
        "the cap must hold: {} pages mapped",
        cpu.mem.mapped_page_count()
    );
}

/// Assemble hosted source and load it, the way the playground does.
fn load(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu
}

/// Twelve fills of a 64 KiB buffer through the `memset` stub. The buffer
/// is mapped after the first pass, so the page cap never sees this work.
const BUFFER_FILL_LOOP: &str = r#"
        .bss
buf:    .skip 65536
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        mov     w19, 12
fill:
        ldr     x0, =buf
        mov     x1, 0
        movz    x2, 0x1, lsl 16
        bl      memset
        subs    w19, w19, 1
        b.ne    fill
        mov     w0, 0
        ldp     x19, x20, [sp], 16
        ldp     x29, x30, [sp], 16
        ret
"#;

#[test]
fn a_buffer_filling_loop_keeps_the_dirty_log_bounded() {
    // The dirty log recorded one entry per byte and every snapshot frame
    // copied the whole log, so this loop cost 0.4 s and 12 MB of pure
    // bookkeeping at twelve iterations, and died on a 417 MB allocation at
    // eight hundred. Sequential writes now coalesce into one range.
    let mut cpu = load(BUFFER_FILL_LOOP);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "the fill loop finishes on its own");
    assert!(r.error.is_none(), "no wall is tripped, got {:?}", r.error);
    let dirty = cpu.mem.take_dirty();
    assert!(
        dirty.len() < 64,
        "a 786 KB fill must not record 786k ranges, got {}",
        dirty.len()
    );
}

#[test]
fn a_large_virtual_filesystem_stops_the_snapshot_ring() {
    // Guest pages are shared copy-on-write, so a frame costs almost
    // nothing to take, but the virtual files, the queued stdin and the
    // open-file paths are copied whole, once per step. 100k steps with a
    // 1 MiB virtual file took 51 s against 73 ms with none. Past the side
    // budget the ring stops recording, the same trade a raw-mode program
    // makes, and the run goes back to full speed.
    let src = r#"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut small = load(src);
    assert!(small.upload_vfs_file("notes.txt".into(), vec![7u8; 64]));
    small.step().expect("step");
    assert!(
        small.can_step_back(),
        "a course-sized file must keep step-back working"
    );

    let mut big = load(src);
    assert!(big.upload_vfs_file("data.bin".into(), vec![7u8; MAX_SNAPSHOT_SIDE_BYTES + 1]));
    big.step().expect("step");
    assert!(
        !big.can_step_back(),
        "past the side budget the ring must stop recording"
    );
    let r = big.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "the program still runs to its end");
    assert!(r.error.is_none(), "no wall is tripped, got {:?}", r.error);
}

#[test]
fn an_open_loop_cannot_grow_the_descriptor_table() {
    // Re-opening one existing file left an fd entry per call, each holding
    // its own copy of the path: 200 opens of a 60 KiB path held 11 MiB,
    // cloned again into every snapshot frame. Past the wall openat answers
    // -1 (EMFILE) and the program keeps running.
    let src = r#"
        .data
path:   .string "log.txt"
fmt:    .string "%d\n"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        mov     w19, 40
open_loop:
        mov     x0, 0
        ldr     x1, =path
        mov     x2, 64
        mov     x3, 0
        mov     x8, 56
        svc     0
        mov     w20, w0
        subs    w19, w19, 1
        b.ne    open_loop
        ldr     x0, =fmt
        mov     w1, w20
        bl      printf
        mov     w0, 0
        ldp     x19, x20, [sp], 16
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "an open loop must not hang");
    assert_eq!(
        cpu.open_files.len(),
        MAX_OPEN_FILES,
        "the descriptor table must stop at the wall"
    );
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(stdout, "-1\n", "a refused open reports EMFILE, not a halt");
}

// The bulk-work wall end to end spends the real ~10M-step ceiling on
// `memset` bytes (~160 MB of guest writes), which is minutes in a debug
// build, the same trade as the runaway-loop proof above, so it is kept
// on demand: `cargo test --test bounds -- --ignored`. The fast proof that
// bulk bytes are charged at all lives in the cpu unit tests
// (`bulk_stub_work_is_charged_against_the_step_budget`).
#[test]
#[ignore = "spends the real ~10M-step ceiling on bulk bytes; run with --ignored"]
fn a_bulk_fill_loop_halts_calmly_at_the_step_ceiling() {
    // A `memset` over an ALREADY-MAPPED buffer never touches the page cap,
    // so before the bytes were charged this loop chose its own workload
    // per step and ran unbounded: 3608 steps moved 24.6 MB.
    let src = BUFFER_FILL_LOOP.replace("mov     w19, 12", "movz    w19, 0xFFFF");
    let mut cpu = load(&src);
    let error = loop {
        let r = cpu.run_until_break(1_000_000).expect("run");
        if r.halted {
            break r.error;
        }
    };
    assert_eq!(
        error,
        Some(step_ceiling_message()),
        "bulk stub work must reach the step wall and halt calmly"
    );
}

#[test]
fn normal_program_runs_to_halt_unaffected() {
    let mut cpu = Cpu::new();
    // A real counted loop: x0 = 5; while (x0 != 0) x0 -= 1; then halt. Tens
    // of steps (far below the ceiling), so it finishes on its own with no
    // abort message.
    cpu.load_program(&[
        movz(0, 5, 0),      // mov  x0, #5
        subs_imm(0, 0, 1),  // loop: subs x0, x0, #1
        b_cond(0b0001, -1), // b.ne loop
        svc(0),             // halt
    ]);
    let r = cpu.run_until_break(10_000).unwrap();

    assert!(r.halted, "a normal program halts on its own");
    assert!(
        r.error.is_none(),
        "a normal program produces no abort message, got {:?}",
        r.error
    );
    assert!(
        (r.steps_executed as u64) < MAX_TOTAL_STEPS,
        "a normal program runs well under the ceiling"
    );
    assert_eq!(cpu.regs.read_gpr(0, true), 0, "the loop ran to completion");
}



/// Real runaway recursion descends the full 8 MiB stack and halts with the
/// stack-overflow cause, never the memory-cap one: the floor sits well
/// under the page cap in page terms, which is the ordering this pins.
#[test]
fn runaway_recursion_halts_with_the_stack_overflow_cause() {
    let src = "
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        sub     sp, sp, 4080
        bl      main
";
    let mut cpu = load(src);
    let error = loop {
        let r = cpu.run_until_break(1_000_000).expect("run");
        if r.halted {
            break r.error;
        }
    };
    let msg = error.expect("runaway recursion must abort with a message");
    assert!(
        msg.contains("stack overflow"),
        "the cause must be the stack floor, not the page cap: {msg}"
    );
    assert!(msg.contains("recursion"), "the message names the usual cause: {msg}");
}
