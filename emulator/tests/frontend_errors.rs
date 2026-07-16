//! Error-contract regressions for the hosted assembly frontend: programs
//! that must be REJECTED at assemble time with a line number and a remedy,
//! never panic, silently mis-encode, or report success.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::lint::lint;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

fn assemble_err(src: &str) -> String {
    let cpu = Cpu::new();
    match assemble_hosted(src, &cpu.host) {
        Ok(_) => panic!("expected an assemble error, got success"),
        Err(e) => e.to_string(),
    }
}

#[test]
fn ldr_eq_outside_text_is_rejected_not_panicked() {
    // A missing .text used to panic the wasm module: pass 1d sized the
    // literal pool for .text only, then pass 2 indexed the missing slot.
    let src = ".global main\n\
               .data\n\
               msg: .string \"Hello\\n\"\n\
               main:\n\
               ldr x0, =msg\n\
               bl printf\n\
               mov x0, 0\n\
               ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains(".text"), "message was: {msg}");
    assert!(msg.contains("line 5"), "message was: {msg}");
}

#[test]
fn bl_printf_outside_text_is_rejected_not_truncated() {
    // Same asymmetry, second symptom: with no pool involved, the direct
    // `bl printf` silently truncated a 4 GiB offset into imm26 and died
    // mid-run at a garbage address.
    let src = ".global main\n\
               .data\n\
               msg: .string \"abc\"\n\
               main:\n\
               mov x0, 1\n\
               bl printf\n\
               ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains(".text"), "message was: {msg}");
    assert!(msg.contains("line 5"), "message was: {msg}");
}

#[test]
fn instructions_in_rodata_are_rejected_with_the_section_name() {
    let src = ".rodata\n\
               mov x0, 1\n";
    let msg = assemble_err(src);
    assert!(msg.contains(".rodata"), "message was: {msg}");
    assert!(msg.contains("line 2"), "message was: {msg}");
}

#[test]
fn duplicate_labels_are_rejected_naming_both_lines() {
    // Last-definition-wins silently rerouted branches: the first loop
    // jumped into the second loop's body and spun to the step ceiling.
    let src = ".text\n\
               .global main\n\
               main:\n\
               loop:\n\
               sub w0, w0, 1\n\
               cbnz w0, loop\n\
               loop:\n\
               ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains("`loop`"), "message was: {msg}");
    assert!(msg.contains("line 4"), "message was: {msg}");
    assert!(msg.contains("line 7"), "message was: {msg}");
}

#[test]
fn cross_section_duplicate_labels_are_rejected() {
    let src = ".data\n\
               buf: .word 1\n\
               .bss\n\
               buf: .skip 8\n\
               .text\n\
               main: ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains("`buf`"), "message was: {msg}");
}

#[test]
fn label_colliding_with_an_equate_is_rejected_in_both_orders() {
    // Equate first: the label used to clobber it, then the innocent use
    // site got "immediate out of range for MOV".
    let src = "count = 7\n\
               .text\n\
               main:\n\
               mov x0, count\n\
               ret\n\
               count:\n";
    let msg = assemble_err(src);
    assert!(msg.contains("count"), "message was: {msg}");
    // Label first: the equate used to vanish silently.
    let src = ".text\n\
               main:\n\
               ret\n\
               count:\n\
               count = 7\n";
    let msg = assemble_err(src);
    assert!(msg.contains("count"), "message was: {msg}");
}

#[test]
fn out_of_reach_conditional_branches_are_rejected_not_wrapped() {
    // imm19 reaches +/-1 MiB and imm14 +/-32 KiB; section bases sit 1-2
    // MiB apart, so a branch to a data label used to wrap silently into
    // an infinite loop blamed on the step ceiling.
    let src = ".data\n\
               flag: .word 1\n\
               .text\n\
               .global main\n\
               main:\n\
               mov x0, 1\n\
               b.eq flag\n\
               ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains("out of reach"), "message was: {msg}");
    assert!(msg.contains("line 7"), "message was: {msg}");

    let src = ".bss\n\
               buf: .skip 8\n\
               .text\n\
               .global main\n\
               main:\n\
               tbz x0, 0, buf\n\
               ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains("out of reach"), "message was: {msg}");
}

#[test]
fn a_broken_equate_reports_its_own_line_and_cause() {
    // `size = cont + 1` with `cont` undefined used to vanish, and the USE
    // site got "invalid immediate: size" -- pointing at correct code.
    let src = ".text\n\
               .global main\n\
               size = cont + 1\n\
               main:\n\
               mov x0, size\n\
               ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains("cont"), "message was: {msg}");
    assert!(msg.contains("line 3"), "message was: {msg}");

    let src = ".text\nmain:\nsize = 1 / 0\nmov x0, 1\nret\n";
    let msg = assemble_err(src);
    assert!(msg.contains("division by zero"), "message was: {msg}");
}

#[test]
fn a_program_with_no_instructions_fails_the_assemble() {
    let msg = assemble_err(".text\n.global main\n");
    assert!(msg.contains("no instructions"), "message was: {msg}");
}

#[test]
fn global_main_without_the_label_fails_the_assemble() {
    let src = ".text\n\
               .global main\n\
               mian:\n\
               mov x0, 0\n\
               ret\n";
    let msg = assemble_err(src);
    assert!(msg.contains("main"), "message was: {msg}");
}

#[test]
fn the_conformance_corpus_lints_clean() {
    // The lint is advisory and heuristic; a false positive on correct
    // course-style code would teach students to distrust it. Every
    // conformance fixture must produce zero warnings.
    for (name, src) in [
        ("sum-to-n", include_str!("conformance/sum-to-n.s")),
        ("sort-three", include_str!("conformance/sort-three.s")),
        ("stack-average", include_str!("conformance/stack-average.s")),
        ("prime-test", include_str!("conformance/prime-test.s")),
        ("count-evens", include_str!("conformance/count-evens.s")),
        ("greeting", include_str!("conformance/greeting.s")),
        ("circle-metrics", include_str!("conformance/circle-metrics.s")),
        ("line-count", include_str!("conformance/line-count.s")),
        ("pack-color", include_str!("conformance/pack-color.s")),
        ("alt-series", include_str!("conformance/alt-series.s")),
        ("alias-sum", include_str!("conformance/alias-sum.s")),
        ("weekday-name", include_str!("conformance/weekday-name.s")),
        ("lucky-draws", include_str!("conformance/lucky-draws.s")),
        ("value-stack", include_str!("conformance/value-stack.s")),
    ] {
        let warnings = lint(src);
        assert!(
            warnings.is_empty(),
            "{name} produced lint warnings: {warnings:?}"
        );
    }
}

#[test]
fn data_before_text_still_assembles() {
    // The reject must key on the section an instruction lands in, not on
    // section order: .data-first programs are the course norm.
    let src = ".data\n\
               msg: .string \"hi\\n\"\n\
               .text\n\
               .global main\n\
               main:\n\
               ldr x0, =msg\n\
               bl printf\n\
               mov x0, 0\n\
               ret\n";
    let cpu = Cpu::new();
    assert!(assemble_hosted(src, &cpu.host).is_ok());
}
