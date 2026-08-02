//! CPSC 355 conformance suite -- the emulator regression gate.
//!
//! Each fixture under `conformance/` is an ORIGINAL assignment-style
//! program, one per category a student writes: arithmetic and loops,
//! branching with the condition codes, an array on the stack, a leaf
//! subroutine, a non-leaf subroutine that calls a leaf, a printf/scanf
//! round trip, a floating-point calculation, a file-I/O syscall
//! sequence, bitfield packing (the bitwise-tutorial material:
//! bfi / ubfx / bic), and `.req` register aliasing (how later
//! assignments name registers). None reproduces course-archive text; every one is authored
//! to the course style (lowercase mnemonics, m4 aliases, AAPCS64
//! prologue/epilogue where the function needs one, contextual stack
//! discipline, idiomatic addressing and syscalls).
//!
//! Two kinds of check run here:
//!   * run-and-assert -- assemble, load (with stdin / VFS where needed),
//!     run to halt, and assert stdout + exit code + register/memory/VFS
//!     state.
//!   * full step-check -- on the baseline arithmetic program and the
//!     non-leaf program, assert the pc advances one instruction at a time
//!     (and to known branch targets), `bl` steps into the callee and `ret`
//!     returns after the call, `step_back` restores state, a breakpoint is
//!     hit at the right address, and the linker line map points main's
//!     first instruction at the right editor line.
//!
//! This suite passing is the hard gate for any later change that touches
//! the emulator.

use aarch64_emulator::cpu::{Cpu, StepOutcome};
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};

const SUM_TO_N: &str = include_str!("conformance/sum-to-n.s");
const SORT_THREE: &str = include_str!("conformance/sort-three.s");
const STACK_AVERAGE: &str = include_str!("conformance/stack-average.s");
const PRIME_TEST: &str = include_str!("conformance/prime-test.s");
const COUNT_EVENS: &str = include_str!("conformance/count-evens.s");
const GREETING: &str = include_str!("conformance/greeting.s");
const CIRCLE_METRICS: &str = include_str!("conformance/circle-metrics.s");
const LINE_COUNT: &str = include_str!("conformance/line-count.s");
const PACK_COLOR: &str = include_str!("conformance/pack-color.s");
const ALT_SERIES: &str = include_str!("conformance/alt-series.s");
const ALIAS_SUM: &str = include_str!("conformance/alias-sum.s");
const WEEKDAY_NAME: &str = include_str!("conformance/weekday-name.s");
const LUCKY_DRAWS: &str = include_str!("conformance/lucky-draws.s");
const VALUE_STACK: &str = include_str!("conformance/value-stack.s");

// ---------------------------------------------------------------------------
// harness (mirrors hosted_end_to_end::run_source so the suite has one place
// to assemble -> load -> run, with stdin / VFS variants for I/O programs)
// ---------------------------------------------------------------------------

/// Assemble and load a program without running it, returning the CPU ready
/// to step from `main` plus the linked image (for symbols / line map).
fn assemble(src: &str) -> (Cpu, LinkedImage) {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    (cpu, image)
}

fn run(src: &str) -> Cpu {
    let (mut cpu, _image) = assemble(src);
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt within the step budget");
    cpu
}

fn run_with_args(src: &str, args: &[&str]) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image_with_args(&image, args)
        .expect("load failed");
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt within the step budget");
    cpu
}

fn run_with_stdin(src: &str, stdin: &str) -> Cpu {
    let (mut cpu, _image) = assemble(src);
    cpu.push_stdin(stdin.as_bytes());
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(
        r.halted,
        "program did not halt (still blocked for input: {})",
        cpu.is_blocked()
    );
    cpu
}

fn run_with_vfs(src: &str, files: &[(&str, &[u8])]) -> Cpu {
    let (mut cpu, _image) = assemble(src);
    for (name, data) in files {
        cpu.upload_vfs_file((*name).to_string(), data.to_vec());
    }
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(r.halted, "program did not halt within the step budget");
    cpu
}

fn stdout_of(cpu: &mut Cpu) -> String {
    String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
}

// ---------------------------------------------------------------------------
// run-and-assert: one program per category
// ---------------------------------------------------------------------------

#[test]
fn arithmetic_loop_sums_one_to_n() {
    let mut cpu = run(SUM_TO_N);
    assert_eq!(stdout_of(&mut cpu), "Sum = 55\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn branching_sorts_three_integers() {
    let mut cpu = run_with_stdin(SORT_THREE, "5 1 3\n");
    assert_eq!(stdout_of(&mut cpu), "Enter three integers: Sorted: 1 3 5\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn stack_array_sums_and_averages() {
    let mut cpu = run_with_stdin(STACK_AVERAGE, "10 20 30 40 50\n");
    assert_eq!(
        stdout_of(&mut cpu),
        "Enter 5 numbers: Sum = 150, Average = 30\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn leaf_subroutine_reports_primality() {
    let mut cpu = run(PRIME_TEST);
    assert_eq!(stdout_of(&mut cpu), "17 is prime: 1\n21 is prime: 0\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn nonleaf_subroutine_counts_even_elements() {
    let mut cpu = run(COUNT_EVENS);
    assert_eq!(stdout_of(&mut cpu), "Even count: 3\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn bitfield_ops_pack_extract_and_clear_channels() {
    let mut cpu = run(PACK_COLOR);
    assert_eq!(
        stdout_of(&mut cpu),
        "color = 0x112233\ngreen = 34\nno blue = 0x112200\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn fp_sign_ops_drive_the_alternating_series() {
    let mut cpu = run(ALT_SERIES);
    assert_eq!(
        stdout_of(&mut cpu),
        "sum = 0.5833\nlast term size = 0.2500\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn req_aliases_name_registers_through_a_loop() {
    let mut cpu = run(ALIAS_SUM);
    assert_eq!(stdout_of(&mut cpu), "total = 8.5\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn pointer_table_selects_weekday_from_argv() {
    let mut cpu = run_with_args(WEEKDAY_NAME, &["4"]);
    assert_eq!(stdout_of(&mut cpu), "day 4 is Thursday\n");
    assert_eq!(cpu.exit_code(), Some(0));
    // The .dword slots really hold the string addresses, in table order.
    let table = cpu.resolve_label("day_table").expect("table symbol");
    let sunday = cpu.resolve_label("day_sun").expect("day_sun symbol");
    let saturday = cpu.resolve_label("day_sat").expect("day_sat symbol");
    assert_eq!(cpu.mem.read_u64(table).unwrap(), sunday);
    assert_eq!(cpu.mem.read_u64(table + 48).unwrap(), saturday);
}

#[test]
fn pointer_table_program_prints_usage_without_arguments() {
    let mut cpu = run_with_args(WEEKDAY_NAME, &[]);
    assert_eq!(stdout_of(&mut cpu), "usage: weekday-name n\n");
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn seeded_draws_print_the_fixed_sequence() {
    // time() is a fixed stamp, so srand(time(0)) pins the whole run.
    // These three values are the contract of the rand stub's LCG.
    let mut cpu = run(LUCKY_DRAWS);
    assert_eq!(
        stdout_of(&mut cpu),
        "pick 1: 16\npick 2: 27\npick 3: 36\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn value_stack_guards_capacity_over_an_equate_sized_buffer() {
    let mut cpu = run(VALUE_STACK);
    assert_eq!(
        stdout_of(&mut cpu),
        "stack full\npopped 40\npopped 30\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
    // .skip STACKSIZE * 4 reserved exactly 16 bytes; the slots the
    // program wrote are still there.
    let stack = cpu.resolve_label("stack").expect("stack symbol");
    assert_eq!(cpu.mem.read_u32(stack).unwrap(), 10);
    assert_eq!(cpu.mem.read_u32(stack + 4).unwrap(), 20);
}

#[test]
fn printf_scanf_round_trip_computes_birth_year() {
    let mut cpu = run_with_stdin(GREETING, "Ada 36\n");
    assert_eq!(
        stdout_of(&mut cpu),
        "Enter your name: Enter your age: Hello, Ada! You were born around 1989.\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn floating_point_computes_area_and_circumference() {
    let mut cpu = run_with_stdin(CIRCLE_METRICS, "5\n");
    assert_eq!(
        stdout_of(&mut cpu),
        "Enter radius: Area = 78.54, Circumference = 31.42\n"
    );
    assert_eq!(cpu.exit_code(), Some(0));
}

#[test]
fn file_io_counts_nonempty_lines_and_touches_vfs_only() {
    // "alpha", "beta", a blank line, then "gamma" -> three non-empty lines.
    let input: &[u8] = b"alpha\nbeta\n\ngamma\n";
    let mut cpu = run_with_vfs(LINE_COUNT, &[("notes.txt", input)]);

    assert_eq!(stdout_of(&mut cpu), "Lines: 3\n");
    assert_eq!(cpu.exit_code(), Some(0));

    // memory state: the file landed verbatim in the .bss read buffer.
    let buf = cpu.resolve_label("buf").expect("buf symbol exists");
    let got: Vec<u8> = (0..input.len() as u64)
        .map(|i| cpu.mem.read_u8(buf + i).unwrap())
        .collect();
    assert_eq!(got, input, "the read buffer holds the file bytes");

    // VFS state: read-only access leaves exactly the input file unchanged
    // and creates nothing on a host filesystem (the program only ever sees
    // the in-memory VFS).
    assert_eq!(cpu.vfs.len(), 1, "no stray files were created");
    assert_eq!(
        cpu.vfs.get("notes.txt").map(|v| v.as_slice()),
        Some(input),
        "the input file is untouched"
    );
}

// ---------------------------------------------------------------------------
// full step-check helper: the line map points main's first instruction at
// the editor line that actually holds the prologue, and the map is dense
// (4-byte steps) and monotonic (strictly increasing editor lines).
// ---------------------------------------------------------------------------

fn assert_line_map_marks_main_prologue(src: &str, image: &LinkedImage) {
    let main_addr = *image.symbols.get("main").expect("main symbol resolved");
    let (_, line) = image
        .line_map
        .iter()
        .find(|(addr, _)| *addr == main_addr)
        .expect("main's first instruction has a line-map entry");
    let editor_line = src
        .lines()
        .nth((*line as usize) - 1)
        .expect("the mapped editor line exists")
        .trim();
    assert!(
        editor_line.starts_with("stp"),
        "main's first instruction maps to its prologue line, got: {editor_line:?}"
    );

    let mut prev_addr: Option<u64> = None;
    let mut prev_line: Option<u32> = None;
    for (addr, ln) in &image.line_map {
        if let Some(pa) = prev_addr {
            assert_eq!(*addr, pa + 4, "consecutive .text instructions are 4 bytes apart");
        }
        if let Some(pl) = prev_line {
            assert!(*ln > pl, "editor lines strictly increase across instructions");
        }
        prev_addr = Some(*addr);
        prev_line = Some(*ln);
    }
    assert_eq!(
        image.line_map.len(),
        image.instruction_count,
        "one line-map entry per emitted .text instruction"
    );
}

// ---------------------------------------------------------------------------
// full step-check: baseline arithmetic / loop program (sum-to-n)
// ---------------------------------------------------------------------------

#[test]
fn baseline_enters_at_main_and_steps_one_per_instruction() {
    let (mut cpu, image) = assemble(SUM_TO_N);
    let main_addr = *image.symbols.get("main").expect("main symbol resolved");
    assert_eq!(image.entry_point, main_addr, "entry point is main");
    assert_eq!(cpu.regs.read_pc(), main_addr, "pc starts at main's first instruction");

    // prologue + setup: stp, mov fp, ldr =n_m, ldr [x0], mov, mov -- six
    // straight-line instructions, each advancing the pc by exactly 4.
    for i in 0..6 {
        let before = cpu.regs.read_pc();
        cpu.step().expect("step ok");
        assert_eq!(cpu.regs.read_pc(), before + 4, "straight-line step {i} advances pc by 4");
    }
}

#[test]
fn baseline_back_edge_branches_to_loop_top() {
    let (mut cpu, image) = assemble(SUM_TO_N);
    let loop_addr = *image.symbols.get("sum_loop").expect("sum_loop symbol resolved");

    // The first arrival at sum_loop is the fallthrough out of setup
    // (before == loop_addr - 4); the `b sum_loop` back-edge is a taken
    // branch from elsewhere to the loop label.
    let mut saw_back_edge = false;
    for _ in 0..200 {
        let before = cpu.regs.read_pc();
        cpu.step().expect("step ok");
        if cpu.regs.read_pc() == loop_addr && before != loop_addr - 4 {
            saw_back_edge = true;
            break;
        }
    }
    assert!(saw_back_edge, "the loop back-edge branches to the sum_loop target");
}

#[test]
fn baseline_step_back_restores_total_and_pc() {
    let (mut cpu, _image) = assemble(SUM_TO_N);
    // Run until the running total (w19) is non-zero -- once the first
    // `add sum_r, sum_r, i_r` has executed there is real state to restore.
    let mut guard = 0;
    while cpu.regs.read_gpr(19, true) == 0 {
        cpu.step().expect("step ok");
        guard += 1;
        assert!(guard < 100, "the total becomes non-zero early in the loop");
    }
    let total = cpu.regs.read_gpr(19, true);
    let pc = cpu.regs.read_pc();
    assert!(cpu.can_step_back(), "a snapshot frame exists");

    cpu.step().expect("one more forward step");
    assert_ne!(cpu.regs.read_pc(), pc, "pc advanced on the extra step");

    let outcome = cpu.step_back();
    assert!(matches!(outcome, StepOutcome::Advance), "restored to a running state");
    assert_eq!(cpu.regs.read_pc(), pc, "step_back restored the pc");
    assert_eq!(cpu.regs.read_gpr(19, true), total, "step_back restored the total");
}

#[test]
fn baseline_breakpoint_hits_loop_top() {
    let (mut cpu, image) = assemble(SUM_TO_N);
    let loop_addr = *image.symbols.get("sum_loop").expect("sum_loop symbol resolved");
    cpu.set_breakpoint(loop_addr);

    let run = cpu.run_until_break(10_000).expect("run ok");
    assert!(run.hit_breakpoint, "the breakpoint was hit");
    assert!(!run.halted, "execution paused at the breakpoint rather than halting");
    assert_eq!(cpu.regs.read_pc(), loop_addr, "stopped exactly at sum_loop");
}

#[test]
fn baseline_line_map_marks_main_prologue() {
    let (_cpu, image) = assemble(SUM_TO_N);
    assert_line_map_marks_main_prologue(SUM_TO_N, &image);
}

// ---------------------------------------------------------------------------
// full step-check: non-leaf subroutine program (count-evens)
// ---------------------------------------------------------------------------

#[test]
fn nonleaf_enters_at_main() {
    let (cpu, image) = assemble(COUNT_EVENS);
    let main_addr = *image.symbols.get("main").expect("main symbol resolved");
    assert_eq!(image.entry_point, main_addr, "entry point is main");
    assert_eq!(cpu.regs.read_pc(), main_addr, "pc starts at main");
}

#[test]
fn nonleaf_bl_enters_callee_and_ret_returns_after_call() {
    let (mut cpu, image) = assemble(COUNT_EVENS);
    let callee = *image.symbols.get("count_even").expect("count_even symbol resolved");

    // Step until the pc lands on count_even's first instruction; the step
    // that took us there is the `bl count_even`.
    let mut bl_pc = None;
    for _ in 0..80 {
        let before = cpu.regs.read_pc();
        cpu.step().expect("step ok");
        if cpu.regs.read_pc() == callee {
            bl_pc = Some(before);
            break;
        }
    }
    let bl_pc = bl_pc.expect("execution reaches the bl into count_even");
    assert_ne!(bl_pc + 4, callee, "count_even is entered by a call, not fallthrough");

    // Run forward until control returns to the instruction after the bl --
    // the `ret` out of the non-leaf returns to main.
    let mut returned = false;
    for _ in 0..400 {
        cpu.step().expect("step ok");
        if cpu.regs.read_pc() == bl_pc + 4 {
            returned = true;
            break;
        }
    }
    assert!(returned, "ret from count_even returns to the instruction after the bl");
}

#[test]
fn nonleaf_breakpoint_hits_inside_nested_leaf() {
    let (mut cpu, image) = assemble(COUNT_EVENS);
    let leaf = *image.symbols.get("is_even").expect("is_even symbol resolved");
    cpu.set_breakpoint(leaf);

    let run = cpu.run_until_break(10_000).expect("run ok");
    assert!(run.hit_breakpoint, "the breakpoint inside the nested leaf was hit");
    assert!(!run.halted, "execution paused at the breakpoint");
    assert_eq!(cpu.regs.read_pc(), leaf, "stopped exactly at is_even's address");
}

#[test]
fn nonleaf_step_back_restores_count_and_pc() {
    let (mut cpu, _image) = assemble(COUNT_EVENS);
    // count_even accumulates its running count in w21; run until the first
    // even element has been counted (w21 != 0).
    let mut guard = 0;
    while cpu.regs.read_gpr(21, true) == 0 {
        cpu.step().expect("step ok");
        guard += 1;
        assert!(guard < 300, "the count becomes non-zero during the loop");
    }
    let count = cpu.regs.read_gpr(21, true);
    let pc = cpu.regs.read_pc();
    assert!(cpu.can_step_back(), "a snapshot frame exists");

    cpu.step().expect("one more forward step");
    let outcome = cpu.step_back();
    assert!(matches!(outcome, StepOutcome::Advance), "restored to a running state");
    assert_eq!(cpu.regs.read_pc(), pc, "step_back restored the pc");
    assert_eq!(cpu.regs.read_gpr(21, true), count, "step_back restored the count");
}

#[test]
fn nonleaf_line_map_marks_main_prologue() {
    let (_cpu, image) = assemble(COUNT_EVENS);
    assert_line_map_marks_main_prologue(COUNT_EVENS, &image);
}
