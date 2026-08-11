//! External-call context for the stepping UI.
//!
//! A `bl printf` costs three steps that hold no source line: the two words
//! of the trampoline that reaches the 0xFFFF_0000 stub range, then the stub
//! address itself. Stepping through them used to leave the marker nowhere
//! and the decode strip showing a synthetic address. `host_call_context`
//! answers for all three -- which libc function, and the call site the `bl`
//! came from, recovered from LR at run time because ONE trampoline serves
//! every call site of the same function.
//!
//! These tests pin that contract on original programs: two printf sites on
//! different lines, a scanf parked waiting on input, a pc in plain `.text`,
//! and a program that calls nothing hosted.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};
use aarch64_emulator::host_call_context;

/// Two printf call sites on different editor lines (16 and 18), so the
/// dynamic call-site recovery has something to get wrong: both sites route
/// through the single `__tramp_printf`.
const TWO_CALLS_SRC: &str = r#"define(fp, x29)
define(lr, x30)

.rodata
first_m:
    .string "first\n"
second_m:
    .string "second\n"

.text
.global main
main:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    ldr     x0, =first_m
    bl      printf
    ldr     x0, =second_m
    bl      printf
    mov     w0, 0
    ldp     fp, lr, [sp], 16
    ret
"#;

/// A scanf with nothing queued on stdin, so the run parks on the stub
/// address itself. `bl scanf` sits on editor line 19.
const BLOCKING_SCANF_SRC: &str = r#"define(fp, x29)
define(lr, x30)

.rodata
fmt_m:
    .string "%d"

.bss
value_m:
    .skip 4

.text
.global main
main:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    ldr     x0, =fmt_m
    ldr     x1, =value_m
    bl      scanf
    mov     w0, 0
    ldp     fp, lr, [sp], 16
    ret
"#;

/// A hosted program that calls nothing: no trampolines exist, so no pc in
/// it can belong to an external call.
const NO_CALLS_SRC: &str = r#".text
.global main
main:
    mov     w0, 7
    mov     w1, 6
    mul     w0, w0, w1
    ret
"#;

fn assemble(src: &str) -> (Cpu, LinkedImage) {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).expect("program assembles");
    cpu.load_linked_image(&image).expect("image loads into memory");
    (cpu, image)
}

/// The flat `[addr, line, ...]` map the wasm wrapper carries, built here the
/// way the boundary builds it.
fn flat_line_map(image: &LinkedImage) -> Vec<u32> {
    image
        .line_map
        .iter()
        .flat_map(|(addr, line)| [*addr as u32, *line])
        .collect()
}

/// Editor line the line map gives an address, so a test can check the
/// reported call site against the map rather than against a literal.
fn line_of(image: &LinkedImage, addr: u64) -> Option<u32> {
    image
        .line_map
        .iter()
        .find(|(mapped, _)| *mapped == addr)
        .map(|(_, line)| *line)
}

/// What `host_call_context` reported at one pc during a run.
struct Observation {
    pc: u64,
    name: String,
    call_site_pc: u64,
    call_site_line: Option<u32>,
}

/// Step the program to its halt, recording every pc where the context
/// answers. Nothing else in the run is allowed to answer, so the recorded
/// sequence is the whole in-call story.
fn observe_in_call_pcs(cpu: &mut Cpu, image: &LinkedImage) -> Vec<Observation> {
    let map = flat_line_map(image);
    let mut seen = Vec::new();
    for _ in 0..500 {
        if let Some(ctx) = host_call_context(cpu, &map) {
            seen.push(Observation {
                pc: cpu.regs.read_pc(),
                name: ctx.name,
                call_site_pc: ctx.call_site_pc,
                call_site_line: ctx.call_site_line,
            });
        }
        if cpu.is_halted() {
            break;
        }
        cpu.step().expect("step ok");
    }
    seen
}

#[test]
fn each_printf_site_resolves_to_its_own_call_line() {
    let (mut cpu, image) = assemble(TWO_CALLS_SRC);
    let stub = cpu.host.lookup("printf").expect("printf is registered");
    let tramp = image.trampoline_base;
    assert_eq!(
        image.trampoline_names,
        vec!["printf".to_string()],
        "both sites share one trampoline",
    );
    assert_eq!(cpu.trampoline_base, tramp, "the loader carries the base");
    assert_eq!(cpu.trampoline_names, image.trampoline_names);

    let seen = observe_in_call_pcs(&mut cpu, &image);
    assert_eq!(
        String::from_utf8_lossy(&cpu.take_stdout()),
        "first\nsecond\n",
        "both calls really ran",
    );

    // Three in-call pcs per site: trampoline word 1, trampoline word 2, the
    // stub. Nothing else in the program answers.
    let expected: [(u64, u32); 6] = [
        (tramp, 16),
        (tramp + 4, 16),
        (stub, 16),
        (tramp, 18),
        (tramp + 4, 18),
        (stub, 18),
    ];
    assert_eq!(seen.len(), expected.len(), "six in-call steps across two calls");
    for (obs, (pc, line)) in seen.iter().zip(expected) {
        assert_eq!(obs.name, "printf", "the pc names the callee");
        assert_eq!(obs.pc, pc, "in-call pcs run tramp, tramp+4, stub");
        assert_eq!(
            obs.call_site_line,
            Some(line),
            "call site resolves to its own editor line at pc {:#x}",
            obs.pc,
        );
        assert_eq!(
            line_of(&image, obs.call_site_pc),
            Some(line),
            "the reported call site is the `bl` instruction itself",
        );
    }
}

#[test]
fn a_blocked_scanf_names_the_call_it_is_parked_in() {
    let (mut cpu, image) = assemble(BLOCKING_SCANF_SRC);
    let map = flat_line_map(&image);
    let stub = cpu.host.lookup("scanf").expect("scanf is registered");

    for _ in 0..200 {
        if cpu.is_blocked() {
            break;
        }
        cpu.step().expect("step ok");
    }
    assert!(cpu.is_blocked(), "scanf parks with stdin empty");
    assert_eq!(cpu.regs.read_pc(), stub, "the park is on the stub address");

    let ctx = host_call_context(&cpu, &map).expect("a parked pc has call context");
    assert_eq!(ctx.name, "scanf");
    assert_eq!(ctx.call_site_line, Some(19), "the marker stays on `bl scanf`");
    assert_eq!(line_of(&image, ctx.call_site_pc), Some(19));
}

#[test]
fn a_pc_in_plain_text_has_no_call_context() {
    let (mut cpu, image) = assemble(TWO_CALLS_SRC);
    let map = flat_line_map(&image);
    assert!(
        host_call_context(&cpu, &map).is_none(),
        "the entry pc is a line the student wrote",
    );
    // The prologue and the address load before the first call are ordinary
    // instructions too.
    for step in 0..3 {
        cpu.step().expect("step ok");
        assert!(
            host_call_context(&cpu, &map).is_none(),
            "step {step} of main is not an external call",
        );
    }
}

#[test]
fn a_program_with_no_libc_calls_never_answers() {
    let (mut cpu, image) = assemble(NO_CALLS_SRC);
    assert_eq!(image.trampoline_base, 0, "no host calls, no trampolines");
    assert!(image.trampoline_names.is_empty());
    assert!(cpu.trampoline_names.is_empty(), "the loader carries the empty list");

    let seen = observe_in_call_pcs(&mut cpu, &image);
    assert!(cpu.is_halted(), "the program ran to its ret");
    assert_eq!(cpu.exit_code(), Some(42), "7 * 6 came back as the exit code");
    // Includes the step where pc rests on the `__main_return` sentinel: the
    // loader's return address is not a call the program made.
    assert!(seen.is_empty(), "no pc in the program belongs to an external call");
}

#[test]
fn loading_a_bare_metal_program_drops_the_previous_trampolines() {
    let (mut cpu, image) = assemble(TWO_CALLS_SRC);
    let tramp = image.trampoline_base;
    assert!(cpu.host_call_name(tramp).is_some(), "the hosted image has a trampoline");

    // The legacy path has no trampolines at all; a stale base would label
    // one of the new program's own instructions as a libc call.
    cpu.load_program(&[0xD503_201F]);
    assert!(cpu.trampoline_names.is_empty());
    assert!(
        cpu.host_call_name(tramp).is_none(),
        "the old trampoline address is plain memory again",
    );
}
