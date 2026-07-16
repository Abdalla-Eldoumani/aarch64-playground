//! Error-contract regressions for the hosted assembly frontend: programs
//! that must be REJECTED at assemble time with a line number and a remedy,
//! never panic, silently mis-encode, or report success.

use aarch64_emulator::cpu::Cpu;
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
