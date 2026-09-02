//! The interactive syscall surface: ioctl termios raw mode, fcntl
//! O_NONBLOCK with -EAGAIN reads, nanosleep pacing (the Sleeping
//! outcome, the virtual clock, and the budget refunds with their
//! lifetime cap), clock_gettime, and getrandom's deterministic draws.
//! These are the calls a real-time terminal program (the snake example)
//! stands on, so each contract is pinned end to end through
//! `assemble_hosted` -> `run_until_break`.

use aarch64_emulator::cpu::{Cpu, StepOutcome, MAX_SLEEP_NS};
use aarch64_emulator::frontend::pipeline::assemble_hosted;

fn load(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu
}

/// Run to halt, skipping (and counting) sleep pauses like a batch runner.
fn run_to_halt(cpu: &mut Cpu) -> u64 {
    let mut sleeps = 0u64;
    loop {
        let r = cpu.run_until_break(1_000_000).expect("run");
        if r.halted {
            return sleeps;
        }
        if cpu.take_pending_sleep_ns().is_some() {
            sleeps += 1;
            continue;
        }
        assert!(!cpu.blocked, "unexpected stdin block");
    }
}

#[test]
fn nanosleep_breaks_the_run_and_advances_the_virtual_clock() {
    let src = r#"
        .data
ts:     .skip 16
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =ts
        mov     x1, 0
        str     x1, [x0]
        movz    x1, 0x02FA, lsl 16
        movk    x1, 0xF080
        str     x1, [x0, 8]
        ldr     x0, =ts
        mov     x1, 0
        mov     x8, 101
        svc     0
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(!r.halted, "run should pause at the sleep, not finish");
    assert_eq!(cpu.take_pending_sleep_ns(), Some(50_000_000));
    assert_eq!(cpu.term.virtual_ns, 50_000_000);
    let r2 = cpu.run_until_break(1_000_000).expect("run");
    assert!(r2.halted);
    assert_eq!(cpu.exit_code, Some(0));
}

#[test]
fn three_max_length_sleeps_advance_the_virtual_clock_by_three_clamps() {
    // Sleep the single-call max three times: each call clamps to
    // MAX_SLEEP_NS, so the virtual clock advances by exactly three clamps.
    let src = r#"
        .data
ts:     .skip 16
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        mov     w19, 3
sleep_loop:
        ldr     x0, =ts
        mov     x1, 2
        str     x1, [x0]
        mov     x1, 0
        str     x1, [x0, 8]
        ldr     x0, =ts
        mov     x1, 0
        mov     x8, 101
        svc     0
        sub     w19, w19, 1
        cbnz    w19, sleep_loop
        mov     w0, 0
        ldp     x19, x20, [sp], 16
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let sleeps = run_to_halt(&mut cpu);
    assert_eq!(sleeps, 3);
    // Three max-length sleeps advanced the clock by exactly 3 * clamp.
    assert_eq!(cpu.term.virtual_ns, 3 * MAX_SLEEP_NS);
}

#[test]
fn clock_gettime_reads_the_virtual_clock_after_sleeps() {
    let src = r#"
        .data
ts:     .skip 16
tp:     .skip 16
fmt:    .string "%ld %ld\n"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =ts
        mov     x1, 1
        str     x1, [x0]
        movz    x1, 0x1DCD, lsl 16
        movk    x1, 0x6500
        str     x1, [x0, 8]
        ldr     x0, =ts
        mov     x1, 0
        mov     x8, 101
        svc     0
        mov     x0, 1
        ldr     x1, =tp
        mov     x8, 113
        svc     0
        ldr     x2, =tp
        ldr     x1, [x2]
        ldr     x2, [x2, 8]
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    run_to_halt(&mut cpu);
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(stdout, "1 500000000\n");
}

#[test]
fn nonblocking_read_returns_eagain_instead_of_pausing() {
    // fcntl(0, F_SETFL, O_NONBLOCK) then read from empty stdin: the
    // program sees -11 and keeps running instead of blocking.
    let src = r#"
        .data
buf:    .skip 4
fmt:    .string "read=%d\n"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0
        mov     x1, 4
        mov     x2, 0x800
        mov     x8, 25
        svc     0
        mov     x0, 0
        ldr     x1, =buf
        mov     x2, 1
        mov     x8, 63
        svc     0
        mov     w1, w0
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "a non-blocking read must not pause the machine");
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(stdout, "read=-11\n");
}

#[test]
fn tcsets_clearing_icanon_raises_the_terminal_flag() {
    // TCGETS a cooked termios, clear ICANON|ECHO, TCSETS it back: the
    // raw-mode flag the UI reads must flip, and the round trip returns 0.
    let src = r#"
        .data
tio:    .skip 60
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0
        mov     x1, 0x5401
        ldr     x2, =tio
        mov     x8, 29
        svc     0
        ldr     x2, =tio
        ldr     w1, [x2, 12]
        mov     w3, 0xA
        mvn     w3, w3
        and     w1, w1, w3
        str     w1, [x2, 12]
        mov     x0, 0
        mov     x1, 0x5402
        mov     x8, 29
        svc     0
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    assert!(!cpu.term.raw_mode);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted);
    assert!(cpu.term.raw_mode, "TCSETS with ICANON cleared must set raw mode");
    assert_eq!(cpu.exit_code, Some(0));
}

#[test]
fn getrandom_draws_are_deterministic_per_load() {
    let src = r#"
        .data
buf:    .skip 8
fmt:    .string "%d %d %d %d\n"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =buf
        mov     x1, 4
        mov     x2, 0
        mov     x8, 278
        svc     0
        ldr     x4, =buf
        ldrb    w1, [x4]
        ldrb    w2, [x4, 1]
        ldrb    w3, [x4, 2]
        ldrb    w4, [x4, 3]
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let run = |src: &str| {
        let mut cpu = load(src);
        run_to_halt(&mut cpu);
        String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
    };
    let a = run(src);
    let b = run(src);
    assert_eq!(a, b, "same load, same draws");
    assert!(a.trim().split(' ').count() == 4);
}

#[test]
fn raw_mode_disables_the_step_back_ring() {
    // The ring records frames until TCSETS raw, then stops.
    let src = r#"
        .data
tio:    .skip 60
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0
        mov     x1, 0x5401
        ldr     x2, =tio
        mov     x8, 29
        svc     0
        ldr     x2, =tio
        str     wzr, [x2, 12]
        mov     x0, 0
        mov     x1, 0x5402
        mov     x8, 29
        svc     0
        mov     w0, 1
        mov     w0, 2
        mov     w0, 3
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted);
    // The machine can still honor step_back requests from before raw
    // mode engaged, but no frames were recorded after it: stepping back
    // lands before the raw-mode flip, never inside the raw-mode window.
    while cpu.can_step_back() {
        cpu.step_back();
        assert!(
            !cpu.term.raw_mode,
            "no snapshot may land inside the raw-mode window"
        );
    }
}

#[test]
fn step_outcome_reports_sleeping() {
    let src = r#"
        .data
ts:     .skip 16
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =ts
        mov     x1, 0
        str     x1, [x0]
        movz    x1, 0xF, lsl 16
        movk    x1, 0x4240
        str     x1, [x0, 8]
        ldr     x0, =ts
        mov     x1, 0
        mov     x8, 101
        svc     0
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let mut sleeping_steps = 0;
    // A single-step driver never asks for the pause. The machine has to
    // keep going anyway: the pause describes the step that asked for it,
    // and the next step clears it.
    for _ in 0..64 {
        let s = cpu.step().expect("step");
        if matches!(s.outcome, StepOutcome::Sleeping(1_000_000)) {
            sleeping_steps += 1;
        }
        if s.halted {
            break;
        }
    }
    assert_eq!(
        sleeping_steps, 1,
        "exactly the nanosleep step reports Sleeping(ns)"
    );
    assert!(cpu.is_halted(), "the program still runs to its exit");
}

#[test]
fn a_runner_that_never_asks_for_the_pause_still_finishes() {
    // The pause used to survive until someone called
    // `take_pending_sleep_ns`, and `run_until_break` refused to execute
    // while it was set: a driver that forgot got zero steps forever.
    let src = r#"
        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     w0, 1000
        bl      usleep
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let paused = cpu.run_until_break(1_000_000).expect("run");
    assert!(!paused.halted, "the run hands back at the pause");
    let resumed = cpu.run_until_break(1_000_000).expect("run");
    assert!(
        resumed.steps_executed > 0,
        "an unread pause must not stall the run loop"
    );
    assert!(resumed.halted);
    assert_eq!(cpu.exit_code, Some(0));
}
