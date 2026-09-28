//! Stepping, breakpoints, step-back, and the map from each instruction's
//! address to its editor line. The editor's current-line marker once
//! drifted because the web counted m4 `define` lines and data directives
//! as instructions; the linker now records the real line for each one.

use aarch64_emulator::cpu::{Cpu, StepOutcome, CODE_BASE};
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};

/// Sums i*i for i in 1..=n (n read from `.data`) and returns the sum as the
/// exit code. It has every shape that made the marker drift: m4 register
/// names, a `.data` word, a `main` that calls `square`, and a loop. The
/// line-map tests count on `main`'s `stp` being editor line 14.
const COMPLEX_SRC: &str = r#"define(sum_r, w19)
define(i_r, w20)
define(n_r, w21)
define(fp, x29)
define(lr, x30)

.data
count_m:
    .word 5

.text
.global main
main:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    ldr     x0, =count_m
    ldr     n_r, [x0]
    mov     sum_r, 0
    mov     i_r, 1
loop:
    cmp     i_r, n_r
    b.gt    done
    mov     w0, i_r
    bl      square
    add     sum_r, sum_r, w0
    add     i_r, i_r, 1
    b       loop
done:
    mov     w0, sum_r
    ldp     fp, lr, [sp], 16
    ret

square:
    mul     w0, w0, w0
    ret
"#;

/// Assemble the complex program into a fresh CPU and load it ready to
/// step from `main`.
fn assemble_complex() -> (Cpu, LinkedImage) {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(COMPLEX_SRC, &cpu.host).expect("complex program assembles");
    cpu.load_linked_image(&image).expect("image loads into memory");
    (cpu, image)
}

#[test]
fn complex_program_enters_at_main() {
    let (cpu, image) = assemble_complex();
    let main_addr = *image.symbols.get("main").expect("main symbol resolved");
    assert_eq!(main_addr, CODE_BASE, "main lands at the .text base");
    assert_eq!(image.entry_point, main_addr, "entry point is main");
    assert_eq!(cpu.regs.read_pc(), main_addr, "pc starts at main's first instruction");
}

#[test]
fn non_branch_steps_advance_pc_by_four() {
    let (mut cpu, _image) = assemble_complex();
    // main's first six instructions have no branch, so each step moves the
    // pc by exactly 4; the very first step must not stall.
    for i in 0..6 {
        let before = cpu.regs.read_pc();
        cpu.step().expect("step ok");
        let after = cpu.regs.read_pc();
        assert_eq!(after, before + 4, "straight-line step {i} advances pc by 4");
    }
}

#[test]
fn bl_enters_callee_and_ret_returns_after_call() {
    let (mut cpu, image) = assemble_complex();
    let square_addr = *image.symbols.get("square").expect("square symbol resolved");

    // Step until the PC lands on `square`'s first instruction; the step
    // that took us there is the `bl square`.
    let mut bl_pc = None;
    for _ in 0..50 {
        let before = cpu.regs.read_pc();
        cpu.step().expect("step ok");
        if cpu.regs.read_pc() == square_addr {
            bl_pc = Some(before);
            break;
        }
    }
    let bl_pc = bl_pc.expect("execution reaches the bl into square");
    // Entry to the callee came via a branch, not a +4 fallthrough.
    assert_ne!(bl_pc + 4, square_addr, "square is entered by a call, not fallthrough");
    assert_eq!(cpu.regs.read_pc(), square_addr, "bl lands on square's first instruction");

    // square: `mul` advances +4 inside the leaf, then `ret` returns to the
    // instruction immediately after the bl.
    let mul_pc = cpu.regs.read_pc();
    cpu.step().expect("mul steps");
    assert_eq!(cpu.regs.read_pc(), mul_pc + 4, "mul advances by 4 inside the leaf");
    cpu.step().expect("ret steps");
    assert_eq!(cpu.regs.read_pc(), bl_pc + 4, "ret returns to the instruction after the bl");
}

#[test]
fn step_back_restores_prior_state_mid_loop() {
    let (mut cpu, _image) = assemble_complex();
    // Run forward until sum_r (w19) becomes non-zero, after the first
    // squared value is accumulated, so step-back has real register state
    // to restore, not just a pc.
    let mut guard = 0;
    while cpu.regs.read_gpr(19, true) == 0 {
        cpu.step().expect("step ok");
        guard += 1;
        assert!(guard < 100, "sum_r changes within the first loop iteration");
    }
    let sum_now = cpu.regs.read_gpr(19, true);
    let pc_now = cpu.regs.read_pc();
    assert!(cpu.can_step_back(), "a snapshot frame exists to restore");

    cpu.step().expect("one more forward step");
    assert_ne!(cpu.regs.read_pc(), pc_now, "pc advanced on the extra step");

    let outcome = cpu.step_back();
    assert!(matches!(outcome, StepOutcome::Advance), "restored to a running state");
    assert_eq!(cpu.regs.read_pc(), pc_now, "step_back restored the prior pc");
    assert_eq!(cpu.regs.read_gpr(19, true), sum_now, "step_back restored sum_r");
}

#[test]
fn breakpoint_hits_exact_instruction_address() {
    let (mut cpu, image) = assemble_complex();
    let square_addr = *image.symbols.get("square").expect("square symbol resolved");
    cpu.set_breakpoint(square_addr);

    let run = cpu.run_until_break(10_000).expect("run ok");
    assert!(run.hit_breakpoint, "the breakpoint was hit");
    assert!(!run.halted, "execution paused at the breakpoint rather than halting");
    assert_eq!(cpu.regs.read_pc(), square_addr, "stopped exactly at square's address");
}

#[test]
fn complex_program_runs_to_expected_exit_code() {
    let (mut cpu, _image) = assemble_complex();
    let run = cpu.run_until_break(100_000).expect("run ok");
    assert!(run.halted, "program halts on ret from main via the __main_return sentinel");
    // 1 + 4 + 9 + 16 + 25 = 55; main returns it in w0 and it becomes the
    // exit code.
    assert_eq!(cpu.exit_code(), Some(55), "exit code is the sum of squares");
}

// -- the line map --

#[test]
fn line_map_maps_main_first_instruction_to_editor_line() {
    let (_cpu, image) = assemble_complex();
    let main_addr = *image.symbols.get("main").expect("main symbol resolved");
    // Line 14 sits below five defines and the `.data` block, so counting
    // source lines as instructions would land on an earlier line.
    let entry = image
        .line_map
        .iter()
        .find(|(addr, _)| *addr == main_addr)
        .expect("main's first instruction has a line-map entry");
    assert_eq!(entry.1, 14, "main's first instruction maps to its editor line");
}

#[test]
fn line_map_skips_data_and_define_lines_and_strictly_increases() {
    let (_cpu, image) = assemble_complex();
    assert!(!image.line_map.is_empty(), "a hosted program emits a line map");

    // The define lines (1-5) and the `.data` block (7-9) hold no
    // instructions, so no entry may point at them.
    let mut prev_addr: Option<u64> = None;
    let mut prev_line: Option<u32> = None;
    for (addr, line) in &image.line_map {
        if let Some(pa) = prev_addr {
            assert_eq!(*addr, pa + 4, "consecutive .text instructions are 4 bytes apart");
        }
        if let Some(pl) = prev_line {
            assert!(*line > pl, "editor lines strictly increase across instructions");
        }
        assert!(
            *line >= 14,
            "no instruction maps into the define/.data/header lines (got line {line})",
        );
        prev_addr = Some(*addr);
        prev_line = Some(*line);
    }
}

#[test]
fn line_map_covers_every_text_instruction() {
    let (_cpu, image) = assemble_complex();
    // The libc call stubs and the literal pool slot behind
    // `ldr x0, =count_m` are not the student's instructions, so they get
    // no entry and the counts match.
    assert_eq!(
        image.line_map.len(),
        image.instruction_count,
        "one line-map entry per emitted .text instruction",
    );
}

/// The host can pause the snapshot ring (the web does this for live
/// terminal sessions): paused steps push no frames, so step_back has
/// nothing to undo, and resuming re-arms it.
#[test]
fn paused_snapshots_skip_the_ring() {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(COMPLEX_SRC, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");

    cpu.snapshots_paused = true;
    cpu.step().expect("step");
    cpu.step().expect("step");
    assert!(!cpu.can_step_back(), "paused steps must not record frames");

    cpu.snapshots_paused = false;
    cpu.step().expect("step");
    assert!(cpu.can_step_back(), "resuming re-arms the ring");
}

/// An unrecorded stretch ENDS the history: frames from before it are
/// dropped, so one step_back can never leap across the gap into a state
/// many instructions old while the step counter falls by one.
#[test]
fn an_unrecorded_stretch_drops_the_earlier_history() {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(COMPLEX_SRC, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");

    // Two recorded steps, so the ring holds real frames.
    cpu.step().expect("step");
    cpu.step().expect("step");
    assert!(cpu.can_step_back());

    // A paused stretch must invalidate them rather than hide a hole.
    cpu.snapshots_paused = true;
    cpu.step().expect("step");
    assert!(
        !cpu.can_step_back(),
        "frames recorded before an unrecorded stretch must not survive it"
    );

    // Raw mode (a terminal program) skips the ring for the same reason.
    cpu.snapshots_paused = false;
    cpu.step().expect("step");
    assert!(cpu.can_step_back());
    cpu.term.raw_mode = true;
    cpu.step().expect("step");
    assert!(
        !cpu.can_step_back(),
        "a raw-mode stretch must end the history too"
    );
}

/// Loading a program clears the pause flag: step-back must never arrive
/// silently dead in a freshly loaded program.
#[test]
fn loading_a_program_resumes_snapshotting() {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(COMPLEX_SRC, &cpu.host).expect("assemble");

    cpu.snapshots_paused = true;
    cpu.load_linked_image(&image).expect("load");
    assert!(!cpu.snapshots_paused, "load must clear the pause");

    cpu.step().expect("step");
    assert!(cpu.can_step_back(), "a loaded program records frames");
}

/// A coarse `.balign` inside `.text` pads with NOP words, so execution can
/// fall through the gap the way it does under GAS; the pad words execute
/// but stay out of the line map (they are not student instructions).
#[test]
fn text_alignment_padding_executes_as_nops_and_stays_out_of_the_line_map() {
    let src = "\
        .text
        .balign 4
        .global main
main:   mov     w0, 7
        .balign 16
after:  add     w0, w0, 1
        mov     x8, 93
        svc     0
";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("assemble");
    cpu.load_linked_image(&image).expect("load");

    // One instruction at main, then a 12-byte pad up to the 16-byte
    // boundary, then the rest.
    let after = image.symbols["after"];
    assert_eq!(after, CODE_BASE + 16, "the label lands on the boundary");
    for pad_addr in ((CODE_BASE + 4)..after).step_by(4) {
        let word = cpu.mem.read_u32(pad_addr).expect("pad readable");
        assert_eq!(word, 0xD503_201F, "pad word at {pad_addr:#x} is a NOP");
        assert!(
            !image.line_map.iter().any(|(a, _)| *a == pad_addr),
            "pad word at {pad_addr:#x} must not appear in the line map"
        );
    }

    let r = cpu.run_until_break(1_000).expect("run");
    assert!(r.halted, "program halts");
    assert!(r.error.is_none(), "no runtime error: {:?}", r.error);
    assert_eq!(cpu.exit_code(), Some(8), "the fall-through executed the add");
}
