//! Step over, step out and run to cursor: `Cpu::run_until` with a goal.
//! Every count below is worked out by hand from the programs' instructions
//! (a library call is the `bl`, the two trampoline words and the stub: four
//! steps), never by running them some other way first.

use aarch64_emulator::cpu::{Cpu, RunResult, Until};
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// 4! by recursion. fact(1) runs 11 instructions (stp to ret); fact(n > 1)
/// runs 12 of its own plus fact(n - 1): fact(4) is 3 * 12 + 11 = 47.
const FACT: &str = r#"// Prints 4! worked out by recursion.

define(fp, x29)
define(lr, x30)
define(n_r, w19)

.data
fmt_out:    .string "%d\n"

.text

// fact(w0 = n) -> w0 = n!
        .balign 4
        .global fact
fact:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     x19, [fp, 16]               // keep the caller's n
        mov     n_r, w0
        cmp     n_r, 1
        b.gt    fact_rec
        mov     w0, 1                       // 1! = 1
        b       fact_done
fact_rec:
        sub     w0, n_r, 1
        bl      fact                        // w0 = (n - 1)!
        mul     w0, w0, n_r
fact_done:
        ldr     x19, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 4
        bl      fact
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

// Word offsets into FACT's functions.
const FACT_BL: u64 = 9 * 4;
const FACT_MUL: u64 = 10 * 4;
const FACT_DONE: u64 = 11 * 4;
const MAIN_BL: u64 = 3 * 4;
const MAIN_AFTER_BL: u64 = 4 * 4;

fn load(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("assembles");
    cpu.load_linked_image(&image).expect("loads");
    cpu
}

fn label(cpu: &Cpu, name: &str) -> u64 {
    cpu.resolve_label(name).expect("label exists")
}

fn depth(cpu: &Cpu) -> u64 {
    cpu.call_stack().depth()
}

/// Single steps until the pc is `pc` with the call stack `depth` deep.
fn step_to(cpu: &mut Cpu, pc: u64, depth_wanted: u64) {
    for _ in 0..10_000 {
        if cpu.regs.read_pc() == pc && depth(cpu) == depth_wanted {
            return;
        }
        cpu.step().expect("steps");
    }
    panic!("never reached {pc:#x} at depth {depth_wanted}");
}

fn over(cpu: &mut Cpu) -> RunResult {
    let goal = Until { depth: Some(depth(cpu)), pc: None };
    cpu.run_until(1_000_000, goal).expect("runs")
}

fn out(cpu: &mut Cpu) -> RunResult {
    let goal = Until { depth: Some(depth(cpu) - 1), pc: None };
    cpu.run_until(1_000_000, goal).expect("runs")
}

#[test]
fn step_over_a_call_runs_it_whole_and_counts_every_step() {
    let mut cpu = load(FACT);
    let main = label(&cpu, "main");
    step_to(&mut cpu, main + MAIN_BL, 1);
    let before = cpu.steps_total();
    let r = over(&mut cpu);
    assert!(r.reached && !r.hit_breakpoint && !r.bad_return && !r.halted);
    assert_eq!(r.pc, main + MAIN_AFTER_BL);
    assert_eq!(depth(&cpu), 1);
    assert_eq!(cpu.regs.read_gpr(0, true), 24);
    // The bl plus fact(4)'s 47.
    assert_eq!(r.steps_executed, 48);
    assert_eq!(cpu.steps_total() - before, 48);
}

#[test]
fn step_over_a_recursive_call_comes_back_at_the_same_depth() {
    let mut cpu = load(FACT);
    let fact = label(&cpu, "fact");
    // main, fact(4), fact(3): fact(3) about to call fact(2).
    step_to(&mut cpu, fact + FACT_BL, 3);
    let r = over(&mut cpu);
    assert!(r.reached);
    assert_eq!(r.pc, fact + FACT_MUL);
    assert_eq!(depth(&cpu), 3);
    assert_eq!(cpu.regs.read_gpr(0, true), 2, "2! came back");
    assert_eq!(cpu.regs.read_gpr(19, true), 3, "fact(3)'s own n");
    // The bl plus fact(2)'s 12 + 11.
    assert_eq!(r.steps_executed, 24);
}

#[test]
fn step_out_of_the_third_level_lands_in_the_second() {
    let mut cpu = load(FACT);
    let fact = label(&cpu, "fact");
    // Just inside fact(3), the third level (main is the first).
    step_to(&mut cpu, fact, 3);
    let r = out(&mut cpu);
    assert!(r.reached);
    assert_eq!(r.pc, fact + FACT_MUL, "fact(4) right after its call");
    assert_eq!(depth(&cpu), 2);
    assert_eq!(cpu.regs.read_gpr(0, true), 6, "3! came back");
    assert_eq!(cpu.regs.read_gpr(19, true), 4, "fact(4)'s n, put back");
    // fact(3) whole: 12 + fact(2) 23.
    assert_eq!(r.steps_executed, 35);
}

#[test]
fn a_breakpoint_inside_the_callee_stops_a_step_over() {
    let mut cpu = load(FACT);
    let (main, fact) = (label(&cpu, "main"), label(&cpu, "fact"));
    step_to(&mut cpu, main + MAIN_BL, 1);
    cpu.set_breakpoint(fact + FACT_DONE);
    let r = over(&mut cpu);
    assert!(r.hit_breakpoint && !r.reached);
    assert_eq!(r.pc, fact + FACT_DONE);
    // fact(1) gets there first: main and four calls of fact.
    assert_eq!(depth(&cpu), 5);
}

#[test]
fn step_out_of_main_stops_at_program_exit() {
    let mut cpu = load(FACT);
    let r = out(&mut cpu);
    assert!(r.halted && !r.reached && r.error.is_none());
    assert_eq!(cpu.exit_code(), Some(0));
    assert_eq!(cpu.take_stdout(), b"24\n");
}

#[test]
fn step_over_a_library_call_lands_on_the_next_line() {
    let mut cpu = load(FACT);
    let main = label(&cpu, "main");
    let printf_bl = main + 6 * 4;
    step_to(&mut cpu, printf_bl, 1);
    let r = over(&mut cpu);
    assert!(r.reached);
    assert_eq!(r.pc, printf_bl + 4);
    assert_eq!(r.steps_executed, 4);
    assert_eq!(cpu.take_stdout(), b"24\n");
}

#[test]
fn run_to_cursor_stops_at_the_address_and_matches_single_steps() {
    let mut cpu = load(FACT);
    let fact = label(&cpu, "fact");
    let goal = Until { depth: None, pc: Some(fact + FACT_DONE) };
    let r = cpu.run_until(1_000_000, goal).expect("runs");
    assert!(r.reached);
    assert_eq!(r.pc, fact + FACT_DONE);
    // main's 3 and the bl; fact(4), fact(3), fact(2) to their bl, 8 each;
    // fact(1) from stp to its b fact_done, 8.
    assert_eq!(r.steps_executed, 4 + 3 * 8 + 8);
    assert_eq!(depth(&cpu), 5);
}

/// The second call never comes back: quit calls exit.
const QUIT: &str = r#"// Leaves through exit(3) from inside a function.

define(fp, x29)
define(lr, x30)

.text

// quit(): exits with status 3
        .balign 4
        .global quit
quit:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 3
        bl      exit

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      quit
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn step_over_a_call_that_exits_stops_at_the_exit() {
    let mut cpu = load(QUIT);
    let main = label(&cpu, "main");
    step_to(&mut cpu, main + 2 * 4, 1);
    let r = over(&mut cpu);
    assert!(r.halted && !r.reached && r.error.is_none());
    assert_eq!(cpu.exit_code(), Some(3));
    // The bl, quit's four, exit's trampoline and stub.
    assert_eq!(r.steps_executed, 1 + 4 + 3);
}

/// fill keeps an array of four ints on its own frame and writes n of them;
/// n = 8 runs on over main's saved fp (elements 4 and 5) and saved lr (6
/// and 7), so main's ret goes to 0x0000000700000006.
const OVERRUN: &str = r#"// fill writes past the end of its array onto main's frame record.

define(fp, x29)
define(lr, x30)

arr_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.text

// fill(w0 = n): arr[i] = i for i < n, with room for four
        .balign 4
        .global fill
fill:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x10, fp, arr_s              // the array's base
        mov     w9, 0
        b       fill_test
fill_loop:
        str     w9, [x10, w9, SXTW 2]       // arr[i] = i
        add     w9, w9, 1
fill_test:
        cmp     w9, w0
        b.lt    fill_loop
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 8
        bl      fill
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_ret_through_an_overwritten_lr_stops_with_where_it_went() {
    let mut cpu = load(OVERRUN);
    let (main, fill) = (label(&cpu, "main"), label(&cpu, "fill"));
    let main_ret = main + 6 * 4;
    step_to(&mut cpu, main_ret, 1);
    let r = over(&mut cpu);
    assert!(r.bad_return && !r.reached && !r.halted);
    assert_eq!(r.pc, 0x0000_0007_0000_0006);
    assert_eq!(r.steps_executed, 1);
    let stack = cpu.call_stack();
    assert_eq!(stack.bad_return().pc, main_ret);
    assert_eq!(stack.bad_return().target, 0x0000_0007_0000_0006);
    // The explanation the web words: fill's store wrote main's saved lr.
    assert_eq!(stack.activations()[0].lr_hit.pc, fill + 5 * 4);
}

#[test]
fn step_out_of_main_stops_at_the_return_that_went_astray() {
    let mut cpu = load(OVERRUN);
    let r = out(&mut cpu);
    assert!(r.bad_return && !r.halted);
    assert_eq!(r.pc, 0x0000_0007_0000_0006);
}

/// greet calls puts without saving lr, so lr then holds the address of
/// greet's own ret, and the ret jumps to itself: a return that lands back
/// in the program's code.
const LR_UNSAVED: &str = r#"// greet forgets to save lr before calling puts.

define(fp, x29)
define(lr, x30)

.data
msg:        .string "hi"

.text

// greet(): prints hi, then cannot return
        .balign 4
        .global greet
greet:
        ldr     x0, =msg
        bl      puts
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      greet
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_ret_that_lands_back_in_the_program_is_still_astray() {
    let mut cpu = load(LR_UNSAVED);
    let greet_ret = label(&cpu, "greet") + 2 * 4;
    step_to(&mut cpu, greet_ret, 2);
    let r = over(&mut cpu);
    assert!(r.bad_return && !r.reached);
    assert_eq!(r.pc, greet_ret, "back on the ret itself");
    assert_eq!(depth(&cpu), 2, "greet never left the call stack");
}

#[test]
fn a_plain_run_still_runs_into_the_fault() {
    let mut cpu = load(OVERRUN);
    let r = cpu.run_until_break(1_000_000).expect("runs");
    assert!(r.halted && r.error.is_some() && !r.bad_return && !r.reached);
}

/// spin never returns.
const SPIN: &str = r#"// A call that loops forever.

define(fp, x29)
define(lr, x30)

.text

// spin(): never returns
        .balign 4
        .global spin
spin:
        b       spin

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      spin
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn step_over_a_call_that_never_returns_meets_the_step_ceiling() {
    let mut cpu = load(SPIN);
    cpu.set_max_total_steps(1_000);
    let main = label(&cpu, "main");
    step_to(&mut cpu, main + 2 * 4, 1);
    let r = over(&mut cpu);
    assert!(r.halted && !r.reached);
    assert!(r.error.is_some(), "the ceiling's calm halt says why");
    assert_eq!(cpu.steps_total(), 1_000);
}

#[test]
fn a_chunk_that_ends_inside_the_call_has_not_reached() {
    let mut cpu = load(SPIN);
    let main = label(&cpu, "main");
    step_to(&mut cpu, main + 2 * 4, 1);
    let goal = Until { depth: Some(1), pc: None };
    let r = cpu.run_until(10, goal).expect("runs");
    assert!(!r.reached && !r.halted && !r.hit_breakpoint);
    assert_eq!(r.steps_executed, 10);
    assert_eq!(depth(&cpu), 2, "still inside spin");
}

/// Reads an int, then sleeps a millisecond.
const READ_SLEEP: &str = r#"// Reads one int with scanf, then sleeps.

define(fp, x29)
define(lr, x30)

n_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_in:     .string "%d"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        ldr     x0, =fmt_in
        add     x1, fp, n_s
        bl      scanf
        mov     w0, 1000
        bl      usleep
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

#[test]
fn step_over_waits_for_input_then_finishes_the_call() {
    let mut cpu = load(READ_SLEEP);
    let main = label(&cpu, "main");
    let scanf_bl = main + 4 * 4;
    step_to(&mut cpu, scanf_bl, 1);
    let goal = Until { depth: Some(1), pc: None };
    let r = cpu.run_until(1_000_000, goal).expect("runs");
    assert!(!r.reached && !r.halted && cpu.is_blocked());
    cpu.push_stdin(b"7\n");
    let r = cpu.run_until(1_000_000, goal).expect("runs");
    assert!(r.reached);
    assert_eq!(r.pc, scanf_bl + 4);
}

#[test]
fn a_goal_met_by_a_sleeping_step_is_not_run_past() {
    let mut cpu = load(READ_SLEEP);
    cpu.push_stdin(b"7\n");
    let main = label(&cpu, "main");
    let usleep_bl = main + 6 * 4;
    step_to(&mut cpu, usleep_bl, 1);
    let r = over(&mut cpu);
    assert!(r.reached);
    assert_eq!(r.pc, usleep_bl + 4);
    assert_eq!(r.steps_executed, 4);
}
