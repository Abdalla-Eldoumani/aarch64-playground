//! Runaway-loop and memory-bomb bounds. These prove the in-browser
//! execution sandbox can never hang or exhaust the tab: a
//! runaway loop hits the cumulative step ceiling and a runaway allocation
//! hits the mapped-page cap, both aborting as a CALM halt that carries a
//! plain-language message through the result `error` field -- never a
//! silent stop, never a raw panic. A normal program stays well under both
//! walls and finishes unaffected.
//!
//! The bounds live in the emulator, so they hold regardless of how the
//! program arrived (typed, decoded from a share link, or uploaded).

use aarch64_emulator::cpu::{
    step_ceiling_message, Cpu, MAX_TOTAL_STEPS, MEMORY_CAP_MESSAGE,
};
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

#[test]
fn runaway_loop_aborts_calmly_within_the_step_ceiling() {
    let mut cpu = Cpu::new();
    // `b .` -- branch to self, an unconditional infinite loop. Driven with a
    // step budget just above the ceiling so the runaway wall (not max_steps)
    // is what stops it. This runs the real ~10M-step wall end to end; it
    // completes in well under the test timeout, proving a runaway program
    // terminates rather than hanging the tab.
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

#[test]
fn normal_program_runs_to_halt_unaffected() {
    let mut cpu = Cpu::new();
    // A real counted loop: x0 = 5; while (x0 != 0) x0 -= 1; then halt. Tens
    // of steps -- far below the ceiling -- so it finishes on its own with no
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
