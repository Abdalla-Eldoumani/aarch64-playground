//! Stepping repro + regression for the headline stepping fix.
//!
//! Stepping is predictable for simple all-`.text` programs but drifts for
//! complex ones: the editor's current-line marker jumps to a wrong line on
//! entering and moving through `main`, and breakpoints land on unrelated
//! lines. The drift is NOT in the emulator's PC stepping (proven sound
//! here) -- it is in the web layer, which derives the current source line
//! by counting non-label, non-comment source lines and treats m4
//! `define()` lines, `.data`/`.string` directives, and section directives
//! as "instructions". That source-text count diverges from the linker's
//! real instruction layout exactly when a program has data/macros (i.e.
//! complex programs), which is why simple bare-metal programs look fine.
//!
//! These tests pin the emulator-level facts the fix relies on, using one
//! original complex program (m4 defines + a `.data` word + a non-leaf
//! `main` that `bl`s a leaf helper + a counted loop with a conditional
//! branch). They establish the regression baseline so the fix can be
//! scoped to emitting an authoritative address->editor-line map from the
//! linker and consuming it on the web side.

use aarch64_emulator::cpu::{Cpu, StepOutcome, CODE_BASE};
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};

/// An original cpsc 355-style program exercising the four shapes the drift
/// needs to surface: m4 register aliases, a `.data` word, a non-leaf
/// `main` that `bl`s a leaf `square`, and a counted loop with a
/// conditional branch. It sums i*i for i in 1..=n (n read from `.data`)
/// and returns the sum as the process exit code.
///
/// Editor line numbers matter for the line-map assertions below: line 1
/// is the first `define`, `main`'s first instruction (`stp`) is line 14,
/// and `square`'s body begins at line 34.
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
    // The prologue + setup (stp, mov fp, ldr =count_m, ldr [x0], mov, mov)
    // is six straight-line instructions; each must advance the PC by
    // exactly 4 -- the entry transition into main is a normal sequence,
    // not a stall.
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
    // Run forward until sum_r (w19) becomes non-zero -- after the first
    // squared value is accumulated -- so step-back has real register state
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
    // Sum of squares 1..=5 = 1 + 4 + 9 + 16 + 25 = 55, returned as w0 and
    // surfaced as the exit code by the main-return sentinel.
    assert_eq!(cpu.exit_code(), Some(55), "exit code is the sum of squares");
}

// -- the authoritative line map (the actual fix surface) --

#[test]
fn line_map_maps_main_first_instruction_to_editor_line() {
    let (_cpu, image) = assemble_complex();
    let main_addr = *image.symbols.get("main").expect("main symbol resolved");
    // main's first instruction (`stp fp, lr, [sp, -16]!`) sits on editor
    // line 14 of COMPLEX_SRC -- after the five define lines, the blank,
    // the `.data` block (lines 7-9), the blank, and the
    // `.text`/`.global main`/`main:` header lines. The text-counting
    // heuristic the fix replaces would instead point at the 9th non-label
    // source line, which is wrong precisely because it counted the data
    // and define lines.
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

    // Entries are emitted in `.text` address order. Addresses are
    // contiguous (4 bytes apart) and the editor lines strictly increase,
    // never pointing back at the m4 define lines (1-5) or the `.data`
    // block (7-9) -- those carry no instructions and so get no entries.
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
    // Every emitted `.text` instruction gets exactly one entry; the
    // trampolines and the literal pool (the `ldr x0, =count_m` pool slot)
    // do not. This program is all-`.text` plus one pool entry, so the map
    // length equals the instruction count.
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
