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
    // site got "invalid immediate: size", pointing at correct code.
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
fn ldr_eq_with_a_bad_register_reports_its_line() {
    // `x40` parsed into u8 fine and sailed to the linker's line-0 err;
    // the Monaco marker then highlighted line 1.
    let src = ".text
.global main
main:
ldr x40, =99
ret
";
    let msg = assemble_err(src);
    assert!(msg.contains("line 4"), "message was: {msg}");
    assert!(msg.contains("x40"), "message was: {msg}");
}

#[test]
fn data_in_text_names_the_alignment_cause_at_the_instruction() {
    // The misaligned pool offset used to surface as "ldr literal offset 29
    // is not a multiple of 4" at line 0, blaming the student's correct ldr.
    let src = ".text
               .global main
               msg: .string \"hi\"
               main:
               ldr x0, =msg
               ret
";
    let msg = assemble_err(src);
    assert!(msg.contains("line 5"), "message was: {msg}");
    assert!(msg.contains(".balign"), "message was: {msg}");
    assert!(msg.contains(".data") || msg.contains(".rodata"), "message was: {msg}");
}

#[test]
fn a_section_outgrowing_its_window_is_rejected_not_overlapped() {
    // 1 MiB of .data used to place the next label at the .bss base: two
    // symbols on one address, stores clobbering unrelated variables.
    let src = ".data
               big: .skip 1048576
               after: .word 7
               .text
               .global main
               main:
               ret
";
    let msg = assemble_err(src);
    assert!(msg.contains(".data"), "message was: {msg}");
    assert!(msg.contains("1 MiB"), "message was: {msg}");
    // The absurd-count case is a message too, never a wrap or panic.
    let src = ".data
huge: .skip 9223372036854775807
.text
.global main
main:
ret
";
    let msg = assemble_err(src);
    assert!(msg.contains(".data"), "message was: {msg}");
}

#[test]
fn a_typod_macro_name_in_an_operand_names_the_symbol() {
    // The evaluator's `unknown symbol` was swallowed into "invalid
    // immediate", pointing the student at ranges instead of the typo.
    let src = "define(SIZE, 10)
               .text
               .global main
               main:
               mov x0, #(SZIE + 1)
               ret
";
    let msg = assemble_err(src);
    assert!(msg.contains("SZIE"), "message was: {msg}");
    assert!(msg.contains("line 5"), "message was: {msg}");
    // The web layer picks its undefined-symbol teaching block off this
    // wording, and the terminal pane never runs that layer, so the
    // emulator has to carry the wording itself.
    assert!(
        msg.contains("is not defined anywhere in this program"),
        "message was: {msg}"
    );
    // Division by zero keeps its own diagnosis on the same path.
    let msg = assemble_err(".text
.global main
main:
mov x0, #(5 / 0)
ret
");
    assert!(msg.contains("zero"), "message was: {msg}");
}

#[test]
fn equ_and_set_point_at_the_supported_spelling() {
    let msg = assemble_err(".equ FOO, 5
.text
.global main
main:
ret
");
    assert!(msg.contains("NAME = expression"), "message was: {msg}");
    assert!(msg.contains("line 1"), "message was: {msg}");
    let msg = assemble_err(".set FOO, 5
.text
.global main
main:
ret
");
    assert!(msg.contains("NAME = expression"), "message was: {msg}");
}

#[test]
fn a_malformed_define_is_diagnosed_not_blamed_on_a_mnemonic() {
    // `define(fp, x29` used to pass through and report "unknown mnemonic:
    // DEFINE(FP,": uppercased, truncated, describing the macro as a CPU
    // instruction.
    let msg = assemble_err("define(fp, x29
.text
.global main
main:
ret
");
    assert!(msg.contains("define"), "message was: {msg}");
    assert!(msg.contains(")"), "message was: {msg}");
    assert!(msg.contains("line 1"), "message was: {msg}");
    let msg = assemble_err("define(fp x29)
.text
.global main
main:
ret
");
    assert!(msg.contains("comma"), "message was: {msg}");
    let msg = assemble_err("define(, x29)
.text
.global main
main:
ret
");
    assert!(msg.contains("name"), "message was: {msg}");
    let msg = assemble_err("define(fp, x29) x
.text
.global main
main:
ret
");
    assert!(msg.contains("after the closing"), "message was: {msg}");
}

#[test]
fn a_hash_comment_line_names_the_comment_characters() {
    let msg = assemble_err(".text
.global main
main:
# set up
ret
");
    assert!(msg.contains("//"), "message was: {msg}");
    assert!(msg.contains("line 4"), "message was: {msg}");
}

#[test]
fn exponent_floats_lex_in_double_and_float_lists() {
    // `.double 1e5` was "invalid integer literal `1e5`"; `.double 1e-3`
    // quoted text the student never typed ("1e").
    let cpu = Cpu::new();
    let src = ".data
d: .double 1e5
e: .double 1e-3
f: .float 2E4
.text
.global main
main:
ret
";
    assert!(assemble_hosted(src, &cpu.host).is_ok(), "exponent floats should assemble");
}

#[test]
fn an_empty_value_between_commas_names_the_extra_comma() {
    let msg = assemble_err(".data
v: .word 1,,2
.text
.global main
main:
ret
");
    assert!(msg.contains("comma"), "message was: {msg}");
    assert!(msg.contains("line 2"), "message was: {msg}");
    // Leading, trailing, and the deferred label-list path all reject.
    assert!(assemble_err(".data
v: .word ,1
.text
.global main
main:
ret
").contains("comma"));
    assert!(assemble_err(".data
v: .word 1,2,
.text
.global main
main:
ret
").contains("comma"));
    let msg = assemble_err(".data
t: .dword a,,b
.text
.global main
main:
a: ret
b: ret
");
    assert!(msg.contains("comma"), "message was: {msg}");
}

#[test]
fn tokens_in_expression_errors_read_as_source_not_debug() {
    // `.word #5` used to say "unexpected token `Hash`"; `.word "hi"`
    // dumped StringLit([104, 105]).
    let msg = assemble_err(".data
v: .word #5
.text
.global main
main:
ret
");
    assert!(msg.contains("`#`"), "message was: {msg}");
    assert!(msg.contains("without the #"), "message was: {msg}");
    assert!(!msg.contains("Hash"), "message was: {msg}");
    let msg = assemble_err(".data
v: .word \"hi\"
.text
.global main
main:
ret
");
    assert!(msg.contains("string literal"), "message was: {msg}");
    assert!(msg.contains(".asciz"), "message was: {msg}");
    assert!(!msg.contains("StringLit"), "message was: {msg}");
}

#[test]
fn dotted_local_labels_work_in_data_slots() {
    // `.quad .L2` is literal GCC jump-table output; the deferral test
    // only knew Ident and Dot, so DirectiveIdent fell into the evaluator.
    let cpu = Cpu::new();
    let src = ".text
               .global main
               main:
               ret
               .L2:
               ret
               .data
               table: .quad .L2
";
    assert!(assemble_hosted(src, &cpu.host).is_ok(), ".quad .L2 should assemble");
}

#[test]
fn falling_off_main_names_the_missing_ret() {
    // A main with no ret used to fetch the zero padding (or, when .text
    // was 8-aligned, silently EXECUTE the first libc trampoline) and
    // report `unknown instruction: 0x00000000`.
    let mut cpu = Cpu::new();
    let src = ".text
.global main
main:
mov w0, 5
";
    let image = assemble_hosted(src, &cpu.host).unwrap();
    cpu.load_linked_image(&image).unwrap();
    let r = cpu.run_until_break(100).unwrap();
    assert!(r.halted);
    let msg = r.error.unwrap_or_default();
    assert!(msg.contains("last instruction"), "was: {msg}");
    assert!(msg.contains("ret"), "was: {msg}");

    // The 8-aligned shape is the dangerous one: the fall-through address
    // used to be the first trampoline itself.
    let mut cpu = Cpu::new();
    let src = ".text
.global main
main:
mov w0, 5
mov w1, 6
";
    let image = assemble_hosted(src, &cpu.host).unwrap();
    cpu.load_linked_image(&image).unwrap();
    let r = cpu.run_until_break(100).unwrap();
    assert!(r.halted);
    assert!(
        r.error.unwrap_or_default().contains("last instruction"),
        "the guard must fire before the trampoline executes"
    );
    // Nothing printed: the trampoline never ran.
    assert!(cpu.stdout.is_empty());
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

/// `.` inside an `ldr xN, =expr` operand means the address of that LDR,
/// and the literal pool is keyed by operand TEXT. Both halves were wrong:
/// `.` resolved to zero, and two identical operands at different
/// addresses shared one slot. GAS allocates a separate pool entry per
/// site (`R_AARCH64_ABS64 .text+0xc` and `.text+0x14` for two
/// `ldr xN, =. + 8` four instructions apart).
#[test]
fn symbol_plus_offset_resolves_into_the_middle_of_an_object() {
    // csarm's sym_offset probe: `msg+19` is 19 bytes past `msg`, the
    // byte there is 's' (115), and `adr`, `ldr =`, and the spaced
    // spelling all land on the same address.
    let src = ".section .rodata\n\
               .LC0: .string \"hello world, this is the tail\"\n\
               .text\n\
               .global main\n\
               main:\n\
               adrp x0, .LC0\n\
               add  x0, x0, :lo12:.LC0\n\
               adrp x1, .LC0+19\n\
               add  x1, x1, :lo12:.LC0+19\n\
               ldr  x2, =.LC0\n\
               adrp x3, .LC0 + 19\n\
               add  x3, x3, :lo12:.LC0 + 19\n\
               adr  x4, .LC0+19\n\
               adrp x5, .LC0+19-4\n\
               add  x5, x5, :lo12:.LC0+19-4\n\
               ldrb w6, [x1]\n\
               mov x8, 93\n\
               svc 0\n";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("symbol+offset must assemble");
    cpu.load_linked_image(&image).expect("load failed");
    let r = cpu.run_until_break(1000).expect("run failed");
    assert!(r.halted);
    let base = cpu.regs.read_gpr(0, true);
    assert_eq!(cpu.regs.read_gpr(1, true), base + 19, "the addend folds into the address");
    assert_eq!(cpu.regs.read_gpr(2, true), base, "ldr = is the oracle for the bare symbol");
    assert_eq!(cpu.regs.read_gpr(3, true), base + 19, "the spaced spelling is the same operand");
    assert_eq!(cpu.regs.read_gpr(4, true), base + 19, "adr takes the addend too");
    assert_eq!(cpu.regs.read_gpr(5, true), base + 15, "a negative addend subtracts");
    assert_eq!(cpu.regs.read_gpr(6, false), 115, "index 19 of the string is 's'");
}

#[test]
fn plain_symbol_operands_assemble_to_the_same_bytes_as_before() {
    // The bypass for a bare label has to stay byte-identical: these two
    // words were recorded from a run before symbol+offset existed.
    let src = ".section .rodata\n\
               .LC0: .string \"hi\"\n\
               .text\n\
               .global main\n\
               main:\n\
               adrp x3, .LC0\n\
               add  x3, x3, :lo12:.LC0\n\
               mov x8, 93\n\
               svc 0\n";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("bare symbol must assemble");
    cpu.load_linked_image(&image).expect("load failed");
    assert_eq!(cpu.mem.read_u32(image.text_base).unwrap(), 0x9000_0803, "adrp x3, .LC0");
    assert_eq!(
        cpu.mem.read_u32(image.text_base + 4).unwrap(),
        0x9100_0063,
        "add x3, x3, :lo12:.LC0"
    );
}

#[test]
fn page_straddling_offset_folds_before_the_split() {
    // csarm's straddle probe: `edge` sits six bytes below a 4 KiB
    // boundary, so `edge+8` is on the next page. An implementation that
    // pages `edge` and then adds 8 to the low bits is 4096 low.
    let src = ".section .rodata\n\
               .balign 4096\n\
               pad: .skip 4090\n\
               edge: .string \"AB\"\n\
               .text\n\
               .global main\n\
               main:\n\
               adrp x0, edge\n\
               add  x0, x0, :lo12:edge\n\
               adrp x4, edge+8\n\
               add  x4, x4, :lo12:edge+8\n\
               mov x8, 93\n\
               svc 0\n";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("straddling offset must assemble");
    cpu.load_linked_image(&image).expect("load failed");
    let r = cpu.run_until_break(1000).expect("run failed");
    assert!(r.halted);
    let base = cpu.regs.read_gpr(0, true);
    assert_eq!(base & 0xFFF, 4090, "edge is six bytes below the page boundary");
    assert_ne!((base + 8) >> 12, base >> 12, "edge+8 is on the next page");
    assert_eq!(cpu.regs.read_gpr(4, true), base + 8);
}

#[test]
fn relocatable_operand_errors_name_the_symbol() {
    for src in [
        ".text\n.global main\nmain:\nadrp x0, nosuchsym+4\nret\n",
        ".section .rodata\n.LC0: .string \"hi\"\n.text\n.global main\nmain:\nadd x0, x0, :lo12:.LC0+notasym\nret\n",
    ] {
        let msg = assemble_err(src);
        assert!(
            msg.contains("nosuchsym") || msg.contains("notasym"),
            "message was: {msg}"
        );
    }
}

#[test]
fn dot_relative_ldr_eq_resolves_per_site() {
    let src = ".text\n\
               .global main\n\
               main:\n\
               ldr x0, =. + 8\n\
               nop\n\
               ldr x1, =. + 8\n\
               mov x8, 93\n\
               svc 0\n";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("dot-relative ldr= must assemble");
    let first_ldr = image.text_base;
    let second_ldr = image.text_base + 8;
    cpu.load_linked_image(&image).expect("load failed");
    let r = cpu.run_until_break(1000).expect("run failed");
    assert!(r.halted);
    assert_eq!(
        cpu.regs.read_gpr(0, true),
        first_ldr + 8,
        "`.` is the address of the ldr that asked for the slot"
    );
    assert_eq!(
        cpu.regs.read_gpr(1, true),
        second_ldr + 8,
        "the second site needs its own pool entry, not the first one's value"
    );

    // Operands with no `.` still deduplicate, so the pool does not grow a
    // slot per use site across the board.
    let shared = ".data\n\
                  msg: .string \"hi\"\n\
                  .text\n\
                  .global main\n\
                  main:\n\
                  ldr x0, =msg\n\
                  ldr x1, =msg\n\
                  mov x8, 93\n\
                  svc 0\n";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(shared, &cpu.host).expect("shared ldr= must assemble");
    cpu.load_linked_image(&image).expect("load failed");
    let r = cpu.run_until_break(1000).expect("run failed");
    assert!(r.halted);
    assert_eq!(cpu.regs.read_gpr(0, true), cpu.regs.read_gpr(1, true));
}

/// GAS treats `=` as `.set`, which is positional: each use takes the most
/// recent definition above it. Two files concatenated into one workspace
/// can each write `len = . - msg` against their own string, and the linker
/// kept only the first value and handed it to both files' uses.
///
/// Oracle (`aarch64-linux-gnu-as` on the same source): the first `.word
/// len` is 9 and the second is 3; a `.word len` placed above both
/// definitions is 9, the first binding.
#[test]
fn a_redefined_equate_resolves_against_the_definition_above_each_use() {
    let src = ".data\n\
               early: .word len\n\
               msg: .ascii \"abcdefghi\"\n\
               len = . - msg\n\
               first: .word len\n\
               msg2: .ascii \"xyz\"\n\
               len = . - msg2\n\
               second: .word len\n\
               .text\n\
               .global main\n\
               main:\n\
               mov x8, 93\n\
               svc 0\n";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("two equates of one name must link");
    cpu.load_linked_image(&image).expect("load failed");

    let word_at = |cpu: &Cpu, symbol: &str| -> u32 {
        let addr = image.symbols[symbol];
        u32::from_le_bytes(
            cpu.mem
                .read_bytes(addr, 4)
                .expect("data word is mapped")
                .try_into()
                .unwrap(),
        )
    };
    assert_eq!(word_at(&cpu, "first"), 9, "the first definition is 9 bytes");
    assert_eq!(
        word_at(&cpu, "second"),
        3,
        "the second use must take the second definition, not the first"
    );
    assert_eq!(
        word_at(&cpu, "early"),
        9,
        "a use above every definition takes the first binding, as GAS does"
    );
}

/// The lint quotes the macro body in its warning text, and read it from a
/// map that collapses a redefined name onto its LAST body. A windowed
/// alias therefore named a register the student never wrote at that line.
#[test]
fn macro_hygiene_quotes_the_body_bound_at_that_line() {
    let src = "define(x0, w19)\n\
               .string \"x0 here\"\n\
               undefine(`x0')\n\
               define(x0, w21)\n\
               .string \"x0 there\"\n";
    let warnings = lint(src);
    let at = |line: usize| -> String {
        warnings
            .iter()
            .filter(|w| w.line == line)
            .map(|w| w.message.clone())
            .collect::<Vec<_>>()
            .join(" | ")
    };
    // Each define site warns about its own body, on its own line.
    assert!(at(1).contains("w19"), "line 1 warnings: {}", at(1));
    assert!(!at(1).contains("w21"), "line 1 warnings: {}", at(1));
    assert!(at(4).contains("w21"), "line 4 warnings: {}", at(4));
    // The literal-text warnings quote the body in effect where they fire.
    assert!(at(2).contains("w19"), "line 2 warnings: {}", at(2));
    assert!(at(5).contains("w21"), "line 5 warnings: {}", at(5));
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
/// Both of these used to overflow the wasm stack rather than return an
/// error. A wasm stack overflow is unrecoverable: the trap skips
/// wasm-bindgen's borrow-guard Drop, so every later call fails on a stuck
/// borrow flag and the instance is dead until the tab reloads. Depth is
/// refused before the recursion can reach the wasm stack limit.
#[test]
fn deeply_nested_addressing_brackets_are_refused_not_overflowed() {
    // rewrite_operand and rewrite_operand_list call each other once per
    // bracket level. Well past the guard, and far past anything real.
    let depth = 5000;
    let src = format!(
        ".text\n.global main\nmain:\nldr x0, {}x1{}\nret\n",
        "[".repeat(depth),
        "]".repeat(depth)
    );
    let msg = assemble_err(&src);
    assert!(
        msg.contains("nests deeper"),
        "expected a depth refusal, got: {msg}"
    );
}

#[test]
fn thousands_of_stacked_labels_on_one_line_assemble() {
    // parse_line peels one `label:` per turn. It used to recurse, so a
    // long enough line blew the stack; peeling in a loop makes the line
    // ordinary work. Valid assembly, so the assemble must succeed.
    let labels: String = (0..20_000).map(|i| format!("l{i}: ")).collect();
    let src = format!(".text\n.global main\nmain:\n{labels}ret\n");
    let cpu = Cpu::new();
    let image = assemble_hosted(&src, &cpu.host)
        .unwrap_or_else(|e| panic!("stacked labels must assemble, got: {e}"));
    // Every label resolves to the same address as the ret it precedes.
    assert!(image.symbols.contains_key("l0"));
    assert!(image.symbols.contains_key("l19999"));
    assert_eq!(image.symbols["l0"], image.symbols["l19999"]);
}

/// The entry point comes from a LABEL, and `_start` counts. Three bugs
/// land on these few lines: an equate named `main` was taken as the entry
/// point, `_start`-only programs fell back to the top of .text, and
/// `.global main` alongside `_start:` was refused even though ld links it.
#[test]
fn the_entry_point_is_a_label_and_start_counts_as_one() {
    let cpu = Cpu::new();

    // An equate is not an entry point. This used to start execution at
    // address 5 and halt on a memory fault with no explanation.
    let equate = ".text\n\
                  main = 5\n\
                  helper:\n\
                  mov x0, 0\n\
                  ret\n";
    let msg = assemble_err(equate);
    assert!(
        msg.contains("no entry point") || msg.contains("no `main:`"),
        "an equate named main must not become the entry point, got: {msg}"
    );

    // `_start` alone links, and enters AT `_start` rather than at whatever
    // helper sits first in .text.
    let start_only = ".text\n\
                      helper:\n\
                      mov x0, 99\n\
                      ret\n\
                      _start:\n\
                      mov x0, 0\n\
                      ret\n";
    let image = assemble_hosted(start_only, &cpu.host).expect("_start alone must link");
    assert_eq!(
        image.entry_point, image.symbols["_start"],
        "execution must start at _start, not at the top of .text"
    );
    assert_ne!(image.entry_point, image.symbols["helper"]);

    // `.global main` declared out of habit while entering at `_start` is
    // what real ld accepts: an unreferenced undefined global is not an error.
    let global_and_start = ".text\n\
                            .global main\n\
                            _start:\n\
                            mov x0, 0\n\
                            ret\n";
    let image = assemble_hosted(global_and_start, &cpu.host)
        .expect("`.global main` plus `_start:` must link, as ld does");
    assert_eq!(image.entry_point, image.symbols["_start"]);
}

#[test]
fn a_brace_register_list_survives_the_frontend_and_runs() {
    // The hosted parser used to refuse every `{...}` operand: the `.` of
    // an arrangement made the operand look like an expression, and the
    // evaluator then reported "unexpected `{`". That closed the whole
    // structure load/store family, and TBL with it, to real programs.
    // This drives one of each shape end to end and checks the bytes.
    //
    // buf holds 0..31, idx holds the table indices, out is the store
    // target. Every expected value below is read off those two tables.
    let src = "        .data\n\
               buf:    .byte 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15\n\
                       .byte 16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31\n\
               idx:    .byte 3,1,0,2,15,14,7,7\n\
               out:    .space 16\n\
               brace:  .string \"a { not an operand } b\"\n\
               \n\
                       .text\n\
                       .global main\n\
               main:\n\
                       ldr  x9, =buf\n\
                       ldr  x1, =out\n\
                       ldr  x5, =idx\n\
                       mov  x0, x9\n\
                       // a brace in a comment { like this } is just text\n\
                       ld1  {v0.16b}, [x0], #16\n\
                       sub  x10, x0, x9\n\
                       umov w2, v0.b[5]\n\
                       ld4r {v4.8b-v7.8b}, [x0]\n\
                       umov w3, v6.b[7]\n\
                       movi v3.16b, #0\n\
                       ld1  {v3.b}[3], [x0]\n\
                       umov w4, v3.b[3]\n\
                       ld1  {v3.b}[7], [x0], #1\n\
                       umov w6, v3.b[7]\n\
                       sub  x11, x0, x9\n\
                       movi v1.8b, #0xff\n\
                       st2  {v0.8b, v1.8b}, [x1]\n\
                       ld1  {v9.8b}, [x5]\n\
                       tbl  v10.8b, {v0.16b}, v9.8b\n\
                       umov w7, v10.b[4]\n\
                       mov  x8, 93\n\
                       svc  0\n";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("a brace list must assemble");
    cpu.load_linked_image(&image).expect("load failed");
    let result = cpu.run_until_break(1000).expect("run failed");
    assert!(result.halted, "the program must reach its exit syscall");

    // ld1 (multiple) filled v0 with buf[0..16], so lane 5 is 5.
    assert_eq!(cpu.regs.read_gpr(2, false), 5, "ld1 {{v0.16b}} loaded the wrong bytes");
    // Its immediate post-index writes back the bytes it moved: 16.
    assert_eq!(cpu.regs.read_gpr(10, true), 16, "the post-index writeback is wrong");
    // ld4r read four bytes at buf+16 (16, 17, 18, 19) and broadcast one
    // into each register, so every lane of v6 is 18.
    assert_eq!(cpu.regs.read_gpr(3, false), 18, "ld4r broadcast the wrong element");
    // The single-lane load touched lane 3 of a zeroed v3 with buf[16].
    assert_eq!(cpu.regs.read_gpr(4, false), 16, "the single-lane load is wrong");
    // A lane load with a post-index after the `[3]` suffix: the same
    // byte again into lane 7, and the base moves on by one element.
    assert_eq!(cpu.regs.read_gpr(6, false), 16, "the lane post-index load is wrong");
    assert_eq!(cpu.regs.read_gpr(11, true), 17, "a lane form writes back its element width");
    // tbl through a brace table: index 4 of idx is 15, and buf[15] is 15.
    assert_eq!(cpu.regs.read_gpr(7, false), 15, "tbl through a brace table is wrong");

    // st2 interleaved v0's low half with a vector of 0xff bytes.
    let out = image.symbols["out"];
    let written = cpu.mem.read_bytes(out, 16).expect("read the store target");
    assert_eq!(
        written,
        vec![0, 0xff, 1, 0xff, 2, 0xff, 3, 0xff, 4, 0xff, 5, 0xff, 6, 0xff, 7, 0xff],
        "st2 did not interleave the two registers"
    );

    // A brace inside a string literal (and inside a comment, above) is
    // data, not an operand: it has to reach memory untouched.
    let brace = image.symbols["brace"];
    let text = cpu.mem.read_bytes(brace, 23).expect("read the string");
    assert_eq!(
        text,
        b"a { not an operand } b\0".to_vec(),
        "a brace inside a .string must survive verbatim"
    );
}
