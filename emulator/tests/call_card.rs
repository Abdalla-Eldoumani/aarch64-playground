//! The call card's numbers: what a printf or scanf call did, conversion by
//! conversion, as `call_card` hands them to the web. Every expected value
//! is worked out by hand from the program's text: the registers each line
//! loads, the bytes the input holds, the characters the format prints.

use std::path::PathBuf;

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};
use aarch64_emulator::hosted::{
    CALL_NO_INPUT, CALL_NO_MATCH, CALL_OK, CALL_PRINTF, CALL_SCANF, CALL_STOPPED,
};
use aarch64_emulator::{call_card, CALL_HEADER, CALL_ROW};

fn repo_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop();
    p
}

fn read(path: &str) -> String {
    let path = repo_root().join(path);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()))
        .replace("\r\n", "\n")
}

fn fixture(name: &str) -> String {
    read(&format!("web/lib/test/emulator/fixtures/{name}"))
}

/// One conversion as the card's numbers give it, its format and text
/// pieces cut out of the bytes the numbers carry.
#[derive(Debug, PartialEq)]
struct Row {
    conv: String,
    source: i64,
    code: u8,
    arg: u64,
    stored: u64,
    size: u64,
    text: String,
    label: Option<(String, u64)>,
}

#[derive(Debug, PartialEq)]
struct Card {
    kind: u8,
    step: u64,
    call_pc: u64,
    result: i64,
    failed: bool,
    conversions: usize,
    fmt: String,
    fmt_len: usize,
    text: String,
    text_len: usize,
    rows: Vec<Row>,
}

fn card(cpu: &Cpu) -> Option<Card> {
    let n = call_card(cpu);
    if n.is_empty() {
        return None;
    }
    let rows = n[5] as usize;
    let (fmt_kept, text_kept) = (n[7] as usize, n[9] as usize);
    let body = CALL_HEADER + rows * CALL_ROW;
    let bytes = |from: usize, len: usize| -> Vec<u8> { n[from..from + len].iter().map(|&b| b as u8).collect() };
    let (fmt, text) = (bytes(body, fmt_kept), bytes(body + fmt_kept, text_kept));
    let word = |lo: f64, hi: f64| lo as u64 | (hi as u64) << 32;
    // A place past the bytes kept reads as the bytes kept, as the web shows it.
    let cut = |b: &[u8], from: f64, to: f64| {
        String::from_utf8_lossy(&b[(from as usize).min(b.len())..(to as usize).min(b.len())]).into_owned()
    };
    // The label names follow the text, one per row that has one.
    let mut names = body + fmt_kept + text_kept;
    let rows = (0..rows)
        .map(|i| {
            let r = &n[CALL_HEADER + i * CALL_ROW..][..CALL_ROW];
            let label = (r[11] > 0.0).then(|| {
                let name = String::from_utf8(bytes(names, r[11] as usize)).expect("a label is UTF-8");
                names += r[11] as usize;
                (name, r[12] as u64)
            });
            Row {
                conv: cut(&fmt, r[0], r[1]),
                source: r[2] as i64,
                code: r[3] as u8,
                arg: word(r[4], r[5]),
                stored: word(r[6], r[7]),
                size: r[8] as u64,
                text: cut(&text, r[9], r[10]),
                label,
            }
        })
        .collect();
    assert_eq!(names, n.len(), "the numbers end with the label names");
    Some(Card {
        kind: n[0] as u8,
        step: n[1] as u64,
        call_pc: n[2] as u64,
        result: n[3] as i64,
        failed: n[4] != 0.0,
        conversions: n[6] as usize,
        fmt: String::from_utf8_lossy(&fmt).into_owned(),
        fmt_len: n[8] as usize,
        text: String::from_utf8_lossy(&text).into_owned(),
        text_len: n[10] as usize,
        rows,
    })
}

/// A printf row: no store, no label unless the value is a data address.
fn printed(conv: &str, source: i64, arg: u64, text: &str) -> Row {
    Row { conv: conv.into(), source, code: CALL_OK, arg, stored: 0, size: 0, text: text.into(), label: None }
}

/// A scanf row that stored `size` bytes through the pointer in `source`.
fn stored(conv: &str, source: i64, arg: u64, stored: u64, size: u64, text: &str) -> Row {
    Row { conv: conv.into(), source, code: CALL_OK, arg, stored, size, text: text.into(), label: None }
}

struct Loaded {
    cpu: Cpu,
    image: LinkedImage,
}

fn load(source: &str) -> Loaded {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("assemble: {e}"));
    cpu.load_linked_image(&image).expect("load");
    Loaded { cpu, image }
}

impl Loaded {
    fn pc_of(&self, line: u32) -> u64 {
        self.image
            .line_map
            .iter()
            .find(|(_, l)| *l == line)
            .unwrap_or_else(|| panic!("no instruction on line {line}"))
            .0
    }

    /// Run until the call on `line` has returned, and read the card.
    fn after_call(&mut self, line: u32) -> Card {
        let back = self.pc_of(line) + 4;
        self.cpu.set_breakpoint(back);
        let r = self.cpu.run_until_break(1_000_000).expect("run");
        self.cpu.clear_breakpoint(back);
        assert_eq!(self.cpu.regs.read_pc(), back, "stopped at {r:?} instead of after line {line}");
        let c = card(&self.cpu).expect("the last step made the call");
        assert_eq!((c.call_pc, c.step), (self.pc_of(line), self.cpu.steps_taken()));
        c
    }

    fn fp(&self) -> u64 {
        self.cpu.regs.snapshot()[29]
    }

    fn label(&self, name: &str) -> u64 {
        self.cpu.resolve_label(name).unwrap_or_else(|| panic!("no label {name}"))
    }
}

fn labelled(mut row: Row, name: &str) -> Row {
    row.label = Some((name.into(), 0));
    row
}

#[test]
fn the_locals_scanf_stores_7_in_a_s_at_fp_16_and_4_in_b_s_at_fp_20() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.push_stdin(b"7 4\n");
    let c = p.after_call(36);
    let fp = p.fp();
    assert_eq!((c.kind, c.result, c.failed, c.conversions), (CALL_SCANF, 2, false, 2));
    assert_eq!((c.fmt.as_str(), c.text.as_str()), ("%d %d", "7 4"));
    assert_eq!(
        c.rows,
        [stored("%d", 1, fp + 16, 7, 4, "7"), stored("%d", 2, fp + 20, 4, 4, "4")]
    );
}

#[test]
fn the_locals_printfs_print_the_prompt_and_two_words() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.push_stdin(b"7 4\n");
    let prompt = p.after_call(31);
    assert_eq!((prompt.kind, prompt.result, prompt.conversions), (CALL_PRINTF, 20, 0));
    assert_eq!(prompt.text, "Enter two integers: ");
    let c = p.after_call(47);
    assert_eq!((c.kind, c.result), (CALL_PRINTF, 23));
    assert_eq!((c.fmt.as_str(), c.text.as_str()), ("Sum = %d, Product = %d\n", "Sum = 11, Product = 28\n"));
    assert_eq!(c.rows, [printed("%d", 1, 11, "11"), printed("%d", 2, 28, "28")]);
}

#[test]
fn every_printf_family_names_its_register_value_and_text() {
    let mut p = load(&fixture("call-printf.s"));
    // w1 = -5 leaves x1's top half zero; %d reads the low 32 bits.
    let ints = p.after_call(30);
    assert_eq!(ints.text, "-5 42 4294967295 -7 1099511627776\n");
    assert_eq!(
        ints.rows,
        [
            printed("%d", 1, 0xFFFF_FFFB, "-5"),
            printed("%i", 2, 42, "42"),
            printed("%u", 3, 0xFFFF_FFFF, "4294967295"),
            printed("%ld", 4, (-7i64) as u64, "-7"),
            printed("%lld", 5, 1 << 40, "1099511627776"),
        ]
    );
    let hex = p.after_call(36);
    assert_eq!(hex.rows, [printed("%x", 1, 255, "ff"), printed("%lx", 2, u64::MAX, "ffffffffffffffff")]);
    let text = p.after_call(42);
    let word = p.label("word_m");
    assert_eq!(text.text, "Ahi%\n");
    assert_eq!(
        text.rows,
        [
            printed("%c", 1, 65, "A"),
            labelled(printed("%s", 2, word, "hi"), "word_m"),
            printed("%%", -1, 0, "%"),
        ]
    );
    // d0 is source 32, d1 33; the argument is the double's bits.
    let real = p.after_call(48);
    assert_eq!(
        real.rows,
        [printed("%f", 32, 2.5f64.to_bits(), "2.500000"), printed("%lf", 33, (-0.125f64).to_bits(), "-0.125000")]
    );
    let ptr = p.after_call(53);
    assert_eq!(ptr.rows, [printed("%p", 1, 0x1234, "0x1234")]);
}

#[test]
fn every_scanf_family_names_its_pointer_what_it_stored_and_where() {
    let mut p = load(&fixture("call-scanf.s"));
    p.cpu.push_stdin(b"-12 0x10 7 9000000000 -3\n1f ff Z cat 2.5 0.5\n");
    let ints = p.after_call(40);
    // The second call starts at the newline the first left; %s stores the
    // word and its zero byte.
    let rest = p.after_call(50);
    let at = |name: &str| p.label(name);
    assert_eq!((ints.result, ints.text.as_str()), (5, "-12 0x10 7 9000000000 -3"));
    assert_eq!(
        ints.rows,
        [
            labelled(stored("%d", 1, at("int_m"), 0xFFFF_FFF4, 4, "-12"), "int_m"),
            labelled(stored("%i", 2, at("any_m"), 16, 4, "0x10"), "any_m"),
            labelled(stored("%u", 3, at("uint_m"), 7, 4, "7"), "uint_m"),
            labelled(stored("%ld", 4, at("long_m"), 9_000_000_000, 8, "9000000000"), "long_m"),
            labelled(stored("%lld", 5, at("llong_m"), (-3i64) as u64, 8, "-3"), "llong_m"),
        ]
    );
    assert_eq!((rest.result, rest.text.as_str()), (6, "\n1f ff Z cat 2.5 0.5"));
    assert_eq!(
        rest.rows,
        [
            labelled(stored("%x", 1, at("hex_m"), 0x1f, 4, "1f"), "hex_m"),
            labelled(stored("%lx", 2, at("lhex_m"), 0xff, 8, "ff"), "lhex_m"),
            labelled(stored("%c", 3, at("char_m"), u64::from(b'Z'), 1, "Z"), "char_m"),
            labelled(stored("%s", 4, at("word_m"), u64::from_le_bytes(*b"cat\0\0\0\0\0"), 4, "cat"), "word_m"),
            labelled(stored("%f", 5, at("float_m"), u64::from(2.5f32.to_bits()), 4, "2.5"), "float_m"),
            labelled(stored("%lf", 6, at("double_m"), 0.5f64.to_bits(), 8, "0.5"), "double_m"),
        ]
    );
}

#[test]
fn a_label_part_way_into_an_array_is_named_with_the_distance() {
    let src = "define(fp, x29)\ndefine(lr, x30)\n\n.data\nfmt_in:     .string \"%d\"\n\n.bss\n.align 4\nlist_m:     .skip 16\n\n.text\n        .balign 4\n        .global main\nmain:\n        stp     fp, lr, [sp, -16]!\n        mov     fp, sp\n        ldr     x0, =fmt_in\n        ldr     x1, =list_m\n        add     x1, x1, 8                   // &list_m[2]\n        bl      scanf\n        mov     w0, 0\n        ldp     fp, lr, [sp], 16\n        ret\n";
    let mut p = load(src);
    p.cpu.push_stdin(b"5\n");
    let c = p.after_call(20);
    let list = p.label("list_m");
    let mut row = stored("%d", 1, list + 8, 5, 4, "5");
    row.label = Some(("list_m".into(), 8));
    assert_eq!(c.rows, [row]);
}

#[test]
fn an_eighth_conversion_has_no_register_left_and_reads_the_stack() {
    let mut p = load(&fixture("too-many-conversions.s"));
    let c = p.after_call(25);
    // x1 to x7 hold 1 to 7; the eighth comes from [sp + 0], where main's
    // saved fp is: 0, main having no caller frame.
    assert_eq!(c.text, "1 2 3 4 5 6 7 0\n");
    let mut want: Vec<Row> = (1..=7).map(|n| printed("%d", n, n as u64, &n.to_string())).collect();
    want.push(printed("%d", 64, 0, "0"));
    assert_eq!(c.rows, want);
}

/// Nine numbers: x1 to x7 carry seven, the stack the eighth and ninth.
const STACK_ARGS: &str = r#"// Prints nine numbers with one printf: x1 to x7 carry seven, and the
// eighth and ninth wait on the stack at sp + 0 and sp + 8.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%d %d %d %d %d %d %d %d %d\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x9, 8
        mov     x10, 9
        stp     x9, x10, [sp, -16]!         // the eighth and ninth values
        ldr     x0, =fmt_out
        mov     w1, 1
        mov     w2, 2
        mov     w3, 3
        mov     w4, 4
        mov     w5, 5
        mov     w6, 6
        mov     w7, 7
        bl      printf
        add     sp, sp, 16                  // drop them

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_ninth_conversion_reads_the_next_stack_slot() {
    let mut p = load(STACK_ARGS);
    let c = p.after_call(28);
    assert_eq!(c.text, "1 2 3 4 5 6 7 8 9\n");
    let mut want: Vec<Row> = (1..=7).map(|n| printed("%d", n, n as u64, &n.to_string())).collect();
    want.extend([printed("%d", 64, 8, "8"), printed("%d", 65, 9, "9")]);
    assert_eq!(c.rows, want);
}

#[test]
fn a_percent_s_with_no_string_address_stops_there_and_keeps_the_fault_text() {
    let mut p = load(&fixture("not-a-string.s"));
    let r = p.cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted);
    assert_eq!(
        r.error.as_deref(),
        Some(
            "printf %s was handed the pointer 0x7, which does not point at readable memory. \
             Check that the argument register holds a string address (ldr xN, =label)"
        )
    );
    let c = card(&p.cpu).expect("the faulting step made the call");
    assert_eq!((c.kind, c.failed, c.text.as_str(), c.call_pc), (CALL_PRINTF, true, "name: ", p.pc_of(19)));
    assert_eq!(c.rows, [Row { code: CALL_STOPPED, ..printed("%s", 1, 7, "") }]);
}

#[test]
fn a_scanf_handed_a_value_stores_at_that_value() {
    let mut p = load(&fixture("scanf-value.s"));
    p.cpu.push_stdin(b"7\n");
    let c = p.after_call(24);
    assert_eq!(c.rows, [stored("%d", 1, 0, 7, 4, "7")]);
    // What the program does is untouched: a_s was never written.
    let r = p.cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted);
    assert_eq!(p.cpu.take_stdout(), b"a = 0\n");
}

#[test]
fn input_that_does_not_fit_stops_scanf_at_that_conversion() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.push_stdin(b"x 4\n");
    let c = p.after_call(36);
    assert_eq!((c.result, c.conversions), (0, 1));
    assert_eq!(c.rows, [Row { code: CALL_NO_MATCH, ..printed("%d", -1, 0, "x") }]);
    // %d skips the spaces before a field, so the word it met starts after them.
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.push_stdin(b"  x 4\n");
    assert_eq!(p.after_call(36).rows, [Row { code: CALL_NO_MATCH, ..printed("%d", -1, 0, "x") }]);
}

#[test]
fn input_that_ends_first_leaves_scanf_returning_eof() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.close_stdin();
    let c = p.after_call(36);
    assert_eq!(c.result, -1);
    assert_eq!(c.rows, [Row { code: CALL_NO_INPUT, ..printed("%d", -1, 0, "") }]);
}

#[test]
fn a_scanf_waiting_for_input_has_its_card_once_the_input_comes() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    let r = p.cpu.run_until_break(1_000_000).expect("run");
    assert!(!r.halted && p.cpu.is_blocked(), "parked on scanf");
    assert_eq!(card(&p.cpu), None);
    p.cpu.push_stdin(b"7 4\n");
    p.cpu.step().expect("step");
    let c = card(&p.cpu).expect("the step finished the call");
    assert_eq!((c.call_pc, c.result, c.rows.len()), (p.pc_of(36), 2, 2));
}

#[test]
fn the_card_lasts_one_step_and_back_brings_an_earlier_one_back() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.push_stdin(b"7 4\n");
    let scanf = p.after_call(36);
    let at = p.cpu.steps_taken();
    p.cpu.step().expect("step");
    assert_eq!(card(&p.cpu), None, "the next step made no call");
    let printf = p.after_call(47);
    assert_eq!(printf.kind, CALL_PRINTF);
    p.cpu.step_back();
    assert_eq!(card(&p.cpu), None, "back inside printf, before it ran");
    while p.cpu.steps_taken() > at {
        p.cpu.step_back();
    }
    assert_eq!(card(&p.cpu), Some(scanf));
}

#[test]
fn a_named_save_keeps_the_card_it_was_taken_with() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.push_stdin(b"7 4\n");
    let scanf = p.after_call(36);
    p.cpu.save_state("after scanf");
    p.after_call(47);
    assert!(p.cpu.load_state("after scanf"));
    assert_eq!(card(&p.cpu), Some(scanf));
}

const TAIL_CALL: &str = r#"// say() prints its number with a tail call: it takes its frame down and
// branches to printf, so printf returns straight to main.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "hi %d\n"

.text

// say(w0 = n): prints n
        .balign 4
        .global say
say:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w1, w0
        ldr     x0, =fmt_out
        ldp     fp, lr, [sp], 16
        b       printf                      // printf returns to say's caller

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 5
        bl      say

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_tail_called_printf_is_named_by_its_b_also_after_back_and_a_restore() {
    let mut p = load(TAIL_CALL);
    let (b_printf, stub) = (p.pc_of(22), p.cpu.host.lookup("printf").expect("printf"));
    // At printf itself, past the b and the trampoline it goes through.
    p.cpu.set_breakpoint(stub);
    p.cpu.run_until_break(1_000_000).expect("run");
    p.cpu.clear_breakpoint(stub);
    assert_eq!(p.cpu.regs.read_pc(), stub);
    p.cpu.save_state("in printf");
    let named = |cpu: &Cpu| card(cpu).map(|c| (c.call_pc, c.text));
    let want = Some((b_printf, "hi 5\n".to_string()));
    p.cpu.step().expect("printf");
    // lr still holds main's way back from bl say: lr - 4 would name line 31.
    assert_eq!(named(&p.cpu), want);
    // main's next two steps move the last instruction run on; Back puts it back.
    for _ in 0..2 {
        p.cpu.step().expect("main");
    }
    for _ in 0..3 {
        p.cpu.step_back();
    }
    p.cpu.step().expect("printf again");
    assert_eq!(named(&p.cpu), want, "after Back");
    p.cpu.run_until_break(1_000_000).expect("to the end");
    assert!(p.cpu.load_state("in printf"));
    p.cpu.step().expect("printf from the save");
    assert_eq!(named(&p.cpu), want, "after a restore");
}

#[test]
fn a_new_program_starts_with_no_card() {
    let mut p = load(&read("web/public/examples/cpsc355/locals.s"));
    p.cpu.push_stdin(b"7 4\n");
    p.after_call(36);
    let steps = p.cpu.steps_taken();
    let quiet = assemble_hosted(".text\n.global main\nmain:\n        mov     w0, 1\n        b       main\n", &p.cpu.host)
        .expect("assemble");
    p.cpu.load_linked_image(&quiet).expect("load");
    for _ in 0..steps {
        p.cpu.step().expect("step");
    }
    assert_eq!(card(&p.cpu), None, "a step count the old card was stamped with");
}

#[test]
fn a_format_past_the_limits_is_counted_but_not_kept() {
    let fmt = format!("{}{}", "%%".repeat(40), "a".repeat(300));
    let src = format!(
        ".data\nfmt_out:    .string \"{fmt}\"\n\n.text\n        .balign 4\n        .global main\nmain:\n        stp     x29, x30, [sp, -16]!\n        ldr     x0, =fmt_out\n        bl      printf\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n"
    );
    let mut p = load(&src);
    let c = p.after_call(10);
    assert_eq!((c.rows.len(), c.conversions), (32, 40));
    assert_eq!((c.fmt.len(), c.fmt_len, c.text.len(), c.text_len), (256, 380, 256, 340));
}
