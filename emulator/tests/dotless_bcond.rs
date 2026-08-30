//! GAS accepts the dotless spelling of every conditional branch (`bne`,
//! `ble`, ...) and gcc emits nothing else. The hosted pipeline once left
//! those out of its branch-mnemonic list, so the label operand was rewritten
//! to the label's section offset and then encoded as a pc-relative
//! displacement: every `bne loop` in a student program jumped to
//! pc + (loop - .text base), always forward, with no error.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;
use aarch64_emulator::registers::CONDITIONS;

fn run(src: &str) -> (String, Option<i64>) {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    let r = cpu.run_until_break(100_000).expect("run failed");
    assert!(r.halted, "program did not halt");
    assert!(r.error.is_none(), "runtime error: {:?}", r.error);
    (String::from_utf8_lossy(&cpu.take_stdout()).into_owned(), cpu.exit_code())
}

const LOOP: &str = "
        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     w1, 0
        b       .L2
.L3:    add     w1, w1, 1
.L2:    cmp     w1, 3
        COND    .L3
        mov     w0, w1
        ldp     x29, x30, [sp], 16
        ret
";

#[test]
fn dotless_ble_reaches_its_label() {
    let (_, code) = run(&LOOP.replace("COND", "ble"));
    assert_eq!(code, Some(4));
}

#[test]
fn dotted_and_dotless_spellings_agree() {
    for (dotted, dotless) in [("b.le", "ble"), ("b.ne", "bne"), ("b.lt", "blt"), ("b.eq", "beq")] {
        let a = run(&LOOP.replace("COND", dotted));
        let b = run(&LOOP.replace("COND", dotless));
        assert_eq!(a, b, "{dotted} and {dotless} diverged");
    }
}

#[test]
fn every_condition_assembles_identically_under_both_spellings() {
    // Assemble-only: the emitted words must be byte-identical whichever
    // spelling the program used, for every condition in the shared table.
    let host = Cpu::new().host;
    for (primary, aliases, _) in CONDITIONS {
        for cc in std::iter::once(primary).chain(aliases.iter()) {
            let cc = cc.to_ascii_lowercase();
            let dotted = assemble_hosted(&LOOP.replace("COND", &format!("b.{cc}")), &host)
                .unwrap_or_else(|e| panic!("b.{cc}: {e}"));
            let dotless = assemble_hosted(&LOOP.replace("COND", &format!("b{cc}")), &host)
                .unwrap_or_else(|e| panic!("b{cc}: {e}"));
            assert_eq!(
                dotted.writes, dotless.writes,
                "b.{cc} and b{cc} emitted different bytes"
            );
        }
    }
}

#[test]
fn bne_counts_down_with_a_plain_label() {
    let src = "
        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     w19, 5
        mov     w20, 0
top:    add     w20, w20, w19
        subs    w19, w19, 1
        bne     top
        mov     w0, w20
        ldp     x29, x30, [sp], 16
        ret
";
    let (_, code) = run(src);
    assert_eq!(code, Some(15));
}
