//! What a step that hands work to the runtime leaves behind, for a library
//! call (a `bl` into a stub) and for a system call (`svc 0`) alike: each calm
//! halt such a step can end in (the output wall, the memory cap, a fault, a
//! misaligned sp, the step wall, falling off main) with its message and stop
//! point, the step and bulk-work counts, a sleep and what it refunds, a read
//! that waits for input, the registers a call changes, and what the panels
//! read after a call (the call card, the clobber notes, the call context and
//! the call stack's numbers).

use aarch64_emulator::cpu::{
    output_ceiling_message, step_ceiling_message, Cpu, StepOutcome, StepResult, MAX_SLEEP_NS,
    MEMORY_CAP_MESSAGE, READ_BY_INSTRUCTION,
};
use aarch64_emulator::frames::layout::frame_layout;
use aarch64_emulator::frames::{frame_view, view_numbers};
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};
use aarch64_emulator::registers::CLOBBER_PATTERN;
use aarch64_emulator::{call_card, host_call_context};

struct Prog {
    cpu: Cpu,
    image: LinkedImage,
    source: String,
}

fn load(source: &str) -> Prog {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("assemble: {e}"));
    cpu.load_linked_image(&image).expect("load");
    Prog { cpu, image, source: source.to_string() }
}

impl Prog {
    fn label(&self, name: &str) -> u64 {
        self.image.symbols[name]
    }

    fn stub(&self, name: &str) -> u64 {
        self.cpu.host.lookup(name).expect("a registered stub")
    }

    fn step(&mut self) -> StepResult {
        self.cpu.step().expect("step")
    }

    /// Step until the instruction at `pc` is next.
    fn step_to(&mut self, pc: u64) {
        for _ in 0..10_000 {
            if self.cpu.regs.read_pc() == pc {
                return;
            }
            self.step();
        }
        panic!("never reached {pc:#x}");
    }

    /// Step until the machine halts and hand back the step that halted it.
    fn halt(&mut self) -> StepResult {
        for _ in 0..2_000_000 {
            let r = self.step();
            if r.halted {
                return r;
            }
        }
        panic!("never halted");
    }

    fn line_map(&self) -> Vec<u32> {
        self.image.line_map.iter().flat_map(|(a, l)| [*a as u32, *l]).collect()
    }
}

fn halted_with(r: &StepResult, pc: u64, message: &str) {
    assert!(r.halted, "the step did not halt");
    assert_eq!(r.outcome, StepOutcome::Halted);
    assert_eq!(r.error.as_deref(), Some(message));
    assert_eq!(r.pc, pc);
}

/// The plain text of a read from an address no section covers.
fn read_fault(address: u64) -> String {
    format!(
        "memory fault: the program tried to read 0x{address:016x}, which no section covers. \
         The base register (the first one inside the brackets, or a pointer passed to a call) \
         does not hold an address, usually because `ldr xN, label` lost its `=` (it loads the \
         value stored at the label) or a `mov` was written where `ldr xN, =label` was meant"
    )
}

/// Five printf calls of a million characters each: the fifth crosses the
/// 4 MiB output wall.
const PRINTF_FLOOD: &str = r#"
        .rodata
fmt:    .string "%1000000d"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        mov     w19, 6
loop:   ldr     x0, =fmt
        mov     w1, 7
        bl      printf
after:  subs    w19, w19, 1
        b.ne    loop
        ldp     x19, x20, [sp], 16
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;

#[test]
fn a_library_call_that_crosses_the_output_wall_halts_after_returning() {
    let mut p = load(PRINTF_FLOOD);
    let r = p.halt();
    halted_with(&r, p.label("after"), &output_ceiling_message());
    assert_eq!(p.cpu.stdout.len(), 5_000_000);
    assert_eq!(p.cpu.stdout_seen(), 5_000_000);
    assert_eq!(p.cpu.exit_code, None);
    assert_eq!(p.cpu.steps_taken(), 42);
    assert_eq!(p.cpu.steps_total(), 42);
    // The call finished, so it was clobbered, its card kept and what it
    // changed (x0, x1, and the trampoline's x16) shown.
    assert_eq!(p.cpu.regs.read_gpr(9, true), CLOBBER_PATTERN);
    assert_eq!(p.cpu.changed_registers(), &[0, 1, 16]);
    assert!(p.cpu.changed_fp_registers().is_empty());
    let card = call_card(&p.cpu);
    assert_eq!(&card[..5], &[1.0, 42.0, (p.label("after") - 4) as f64, 1_000_000.0, 0.0]);
    // A halted machine stays halted, with the same answer.
    let again = p.step();
    assert!(again.halted);
    assert_eq!(again.outcome, StepOutcome::Halted);
    assert_eq!(again.error, None);
    assert_eq!(p.cpu.abort_message.as_deref(), Some(output_ceiling_message().as_str()));
}

/// Five write(1, buf, 1000000) calls: the fifth crosses the output wall.
const WRITE_FLOOD: &str = r#"
        .bss
buf:    .skip   1000000
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        mov     w19, 6
loop:   mov     x0, 1
        ldr     x1, =buf
        movz    x2, 0xF, lsl 16
        movk    x2, 0x4240
        mov     x8, 64
write:  svc     0
        subs    w19, w19, 1
        b.ne    loop
        ldp     x19, x20, [sp], 16
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;

#[test]
fn a_system_call_that_crosses_the_output_wall_halts_on_the_svc() {
    let mut p = load(WRITE_FLOOD);
    let r = p.halt();
    halted_with(&r, p.label("write"), &output_ceiling_message());
    assert_eq!(p.cpu.stdout.len(), 5_000_000);
    assert_eq!(p.cpu.steps_taken(), 4 + 4 * 8 + 6);
    // The call wrote its whole buffer before the wall stopped the program,
    // but the halted step leaves the changed sets as the step before did.
    assert_eq!(p.cpu.regs.read_gpr(0, true), 1_000_000);
    assert_eq!(p.cpu.regs.read_gpr(8, true), 64);
    assert!(p.cpu.changed_registers().is_empty());
}

/// memset or getrandom of 1 KiB into a fresh page each time round, until
/// the page cap stops one of them part-way.
const MEMSET_PAGES: &str = r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        movz    x19, 1, lsl 32
        mov     x20, 4096
loop:   mov     x0, x19
        mov     w1, 0
        mov     x2, 1024
        bl      memset
        add     x19, x19, x20
        b       loop
"#;

const GETRANDOM_PAGES: &str = r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        movz    x19, 1, lsl 32
        mov     x20, 4096
loop:   mov     x0, x19
        mov     x1, 1024
        mov     x2, 0
        mov     x8, 278
draw:   svc     0
        add     x19, x19, x20
        b       loop
"#;

#[test]
fn a_library_call_that_meets_the_page_cap_halts_inside_the_call() {
    let mut p = load(MEMSET_PAGES);
    let r = p.halt();
    halted_with(&r, p.stub("memset"), MEMORY_CAP_MESSAGE);
    // 8,178 calls fill a page each; the next one meets the cap at its first byte.
    assert_eq!(p.cpu.steps_taken(), 5 + 8_178 * 9 + 7);
    assert_eq!(p.cpu.steps_total(), 5 + 8_178 * 9 + 7 + 8_178 * 64);
    assert_eq!(p.cpu.regs.read_gpr(19, true), (1u64 << 32) + 8_178 * 4096);
}

#[test]
fn a_system_call_that_meets_the_page_cap_halts_on_the_svc() {
    let mut p = load(GETRANDOM_PAGES);
    let r = p.halt();
    halted_with(&r, p.label("draw"), MEMORY_CAP_MESSAGE);
    assert_eq!(p.cpu.steps_taken(), 5 + 8_178 * 7 + 5);
    assert_eq!(p.cpu.steps_total(), 5 + 8_178 * 7 + 5 + 8_178 * 64);
    assert_eq!(p.cpu.regs.read_gpr(19, true), (1u64 << 32) + 8_178 * 4096);
}

#[test]
fn a_library_call_reading_through_a_non_address_in_x0_names_the_missing_ldr() {
    let mut p = load(
        r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0x1234
        bl      printf
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let r = p.halt();
    halted_with(
        &r,
        p.stub("printf"),
        "Segmentation fault\nprintf reads memory at x0, but x0 holds 0x1234, not an address: \
         put `ldr x0, =fmt` right before `bl printf`, where fmt is the label on the string it needs",
    );
    // The format was never read, so the call left no card.
    assert!(call_card(&p.cpu).is_empty());
}

#[test]
fn a_printf_percent_s_through_a_bad_pointer_says_which_pointer() {
    let mut p = load(
        r#"
        .rodata
fmt:    .string "%s"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =fmt
        mov     x1, 0x2000
        bl      printf
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let r = p.halt();
    halted_with(
        &r,
        p.stub("printf"),
        "printf %s was handed the pointer 0x2000, which does not point at readable memory. \
         Check that the argument register holds a string address (ldr xN, =label)",
    );
    // The card shows the call that stopped the program.
    let card = call_card(&p.cpu);
    assert_eq!(card[0], 1.0);
    assert_eq!(card[4], 1.0);
}

#[test]
fn a_library_call_reading_through_a_bad_pointer_not_in_x0_keeps_the_plain_fault() {
    let mut p = load(
        r#"
        .bss
buf:    .skip   16
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =buf
        mov     x1, 0x2000
        mov     x2, 4
        bl      memcpy
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let r = p.halt();
    halted_with(&r, p.stub("memcpy"), &read_fault(0x2000));
    assert!(call_card(&p.cpu).is_empty());
}

#[test]
fn a_system_call_reading_through_x0_keeps_the_plain_fault() {
    // write(0x2000, 0x2000, 4) reads its buffer before it looks at the fd,
    // so the fault's address is the one x0 holds; only a library call's
    // fault earns the `ldr x0, =fmt` hint.
    let mut p = load(
        r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0x2000
        mov     x1, 0x2000
        mov     x2, 4
        mov     x8, 64
write:  svc     0
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let r = p.halt();
    halted_with(&r, p.label("write"), &read_fault(0x2000));
    assert!(p.cpu.stdout.is_empty());
}

/// A program that writes `svc 0` over printf's trampoline, then calls
/// printf with x8 = `number` and x0 = x1 = 0x2000, an address no section
/// covers. The `svc` runs at a trampoline pc, so only the dispatch tells a
/// syscall from a library call there.
fn svc_over_the_trampoline(number: u32) -> String {
    format!(
        r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        adr     x9, call
        ldr     w10, [x9]
        sbfx    x10, x10, 0, 26
        add     x9, x9, x10, lsl 2
        movz    w11, 0x0001
        movk    w11, 0xD400, lsl 16
        str     w11, [x9]
        mov     x0, 0x2000
        mov     x1, 0x2000
        mov     x2, 4
        mov     x8, {number}
call:   bl      printf
        ldp     x29, x30, [sp], 16
        ret
"#
    )
}

#[test]
fn a_system_call_at_a_trampoline_pc_keeps_the_plain_fault() {
    // write reads its buffer at x1 and nanosleep its time at x0; both
    // fault on 0x2000 with x0 holding it, and only a library call earns
    // the `ldr x0, =fmt` hint.
    for number in [64, 101] {
        let mut p = load(&svc_over_the_trampoline(number));
        let r = p.halt();
        let pc = p.cpu.trampoline_base;
        assert_eq!(p.cpu.host_call_name(pc), Some("printf"));
        halted_with(&r, pc, &read_fault(0x2000));
        assert_eq!(p.cpu.steps_taken(), 15);
        assert!(p.cpu.take_clobber_notes().is_empty());
    }
}

#[test]
fn an_unsupported_system_call_halts_on_the_svc_with_the_supported_list() {
    let mut p = load(
        r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x8, 999
call:   svc     0
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let r = p.halt();
    halted_with(
        &r,
        p.label("call"),
        "syscall 999 (x8) is not supported. This emulator implements fcntl(25), ioctl(29), \
         openat(56), close(57), lseek(62), read(63), write(64), exit(93/94), nanosleep(101), \
         clock_gettime(113), and getrandom(278); use `mov x8, 93` then `svc 0` to exit",
    );
}

#[test]
fn a_call_that_crosses_the_output_wall_and_fails_reports_the_wall() {
    // 8,178 memsets fill the page budget. fgets then takes a typed line of
    // 4,200,001 bytes, whose echo crosses the output wall, and meets the
    // page cap storing it: one call, both stops, and the wall is reported.
    let mut p = load(
        r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        stp     x21, x22, [sp, -16]!
        movz    x19, 1, lsl 32
        mov     x20, 4096
        movz    w21, 8178
fill:   mov     x0, x19
        mov     w1, 0
        mov     x2, 1024
        bl      memset
        add     x19, x19, x20
        subs    w21, w21, 1
        b.ne    fill
        mov     x0, x19
        movz    w1, 0x4B40
        movk    w1, 0x4C, lsl 16
        ldr     x2, =stdin
        ldr     x2, [x2]
        bl      fgets
        ldp     x21, x22, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let mut line = vec![b'x'; 4_200_000];
    line.push(b'\n');
    p.cpu.push_stdin_interactive(&line);
    let r = p.halt();
    halted_with(&r, p.stub("fgets"), &output_ceiling_message());
    assert_eq!(p.cpu.stdout.len(), 4_200_001);
    assert!(p.cpu.stdin.is_empty());
}

#[test]
fn a_library_call_with_sp_off_16_halts_with_the_bus_error() {
    let mut p = load(
        r#"
        .rodata
fmt:    .string "hi\n"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        sub     sp, sp, 8
        ldr     x0, =fmt
        bl      printf
        add     sp, sp, 8
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let sp = p.cpu.regs.read_sp() - 24;
    let r = p.halt();
    halted_with(
        &r,
        p.stub("printf"),
        &format!(
            "Bus error\nsp is 0x{sp:x} at this call, which is not a multiple of 16: round the \
             frame size above it up to a multiple of 16 (32 instead of 24), or size it with \
             `alloc = -(16 + locals) & -16`"
        ),
    );
    assert!(p.cpu.stdout.is_empty());
}

#[test]
fn a_forty_byte_frames_bus_error_names_no_other_frames_size() {
    // 40 leaves sp 8 off a multiple of 16, as 24 does, and the course's
    // formula rounds it to 48: telling this program "32 instead of 24"
    // points at a frame it does not have.
    let mut p = load(
        r#"
        .rodata
fmt:    .string "hi\n"
        .text
        .global main
main:   stp     x29, x30, [sp, -40]!
        mov     x29, sp
        ldr     x0, =fmt
        bl      printf
        ldp     x29, x30, [sp], 40
        ret
"#,
    );
    let r = p.halt();
    let message = r.error.as_deref().expect("a halt message");
    assert!(message.starts_with("Bus error\n") && message.contains("not a multiple of 16"), "{message}");
    assert!(!message.contains("instead of 24"), "{message}");
}

#[test]
fn falling_off_main_after_a_library_call_halts_at_the_end_of_the_text() {
    let mut p = load(
        r#"
        .rodata
fmt:    .string "hi\n"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =fmt
        bl      printf
"#,
    );
    let r = p.halt();
    halted_with(
        &r,
        p.cpu.text_end().expect("a loaded image"),
        "execution ran past the last instruction of the program. main needs a `ret` (with an \
         epilogue if it pushed one) or an exit call as its final step",
    );
    assert_eq!(p.cpu.stdout, b"hi\n");
}

/// 64 bytes of bulk work a call: memset or getrandom, round and round.
const MEMSET_LOOP: &str = r#"
        .bss
buf:    .skip   1024
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
loop:   ldr     x0, =buf
        mov     w1, 1
        mov     x2, 1024
        bl      memset
        b       loop
"#;

const GETRANDOM_LOOP: &str = r#"
        .bss
buf:    .skip   1024
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
loop:   ldr     x0, =buf
        mov     x1, 1024
        mov     x2, 0
        mov     x8, 278
        svc     0
        b       loop
"#;

#[test]
fn bulk_work_in_a_library_call_counts_toward_the_step_wall() {
    let mut p = load(MEMSET_LOOP);
    p.cpu.set_max_total_steps(10_000);
    let r = p.halt();
    // Eight steps and 64 charged a round: the 139th call crosses the wall
    // and the `b loop` after it is the step that meets it.
    halted_with(&r, p.label("loop") + 16, &step_ceiling_message());
    assert_eq!(p.cpu.steps_taken(), 2 + 138 * 8 + 7);
    assert_eq!(p.cpu.steps_total(), 2 + 138 * 8 + 7 + 139 * 64);
}

#[test]
fn bulk_work_in_a_system_call_counts_toward_the_step_wall() {
    let mut p = load(GETRANDOM_LOOP);
    p.cpu.set_max_total_steps(10_000);
    let r = p.halt();
    // Six steps and 64 charged a round: the 143rd call crosses the wall.
    halted_with(&r, p.label("loop") + 20, &step_ceiling_message());
    assert_eq!(p.cpu.steps_taken(), 2 + 142 * 6 + 5);
    assert_eq!(p.cpu.steps_total(), 2 + 142 * 6 + 5 + 143 * 64);
}

#[test]
fn usleep_sleeps_refunds_and_returns_like_a_call() {
    let mut p = load(
        r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x9, 9
        mov     w0, 3
        bl      usleep
first:  movz    w0, 0x4B40
        movk    w0, 0x4C, lsl 16
        bl      usleep
second: mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    p.step_to(p.stub("usleep"));
    assert_eq!(p.cpu.steps_total(), 7);
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::Sleeping(3_000));
    assert_eq!(r.pc, p.label("first"));
    assert!(!r.halted);
    assert_eq!(r.error, None);
    // Eight steps less the three a 3 us sleep refunds.
    assert_eq!(p.cpu.steps_total(), 5);
    assert_eq!(p.cpu.steps_taken(), 8);
    assert_eq!(p.cpu.term.virtual_ns, 3_000);
    assert_eq!(p.cpu.take_pending_sleep_ns(), Some(3_000));
    // A sleeping call is a finished call: caller-saved registers clobbered.
    assert_eq!(p.cpu.regs.read_gpr(0, true), 0);
    assert_eq!(p.cpu.regs.read_gpr(9, true), CLOBBER_PATTERN);
    assert_eq!(p.cpu.changed_registers(), &(0..=18).collect::<Vec<u8>>()[..]);

    // Five seconds asked, two given: one call is clamped to MAX_SLEEP_NS.
    p.step_to(p.stub("usleep"));
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::Sleeping(MAX_SLEEP_NS));
    assert_eq!(r.pc, p.label("second"));
    assert_eq!(p.cpu.term.virtual_ns, 3_000 + MAX_SLEEP_NS);
    assert_eq!(p.cpu.steps_total(), 0);
    assert_eq!(p.cpu.take_pending_sleep_ns(), Some(MAX_SLEEP_NS));
    let r = p.halt();
    assert_eq!(r.outcome, StepOutcome::Exited(0));
    assert_eq!(r.pc, p.stub("__main_return"));
}

#[test]
fn a_two_second_sleep_raises_the_output_wall_by_its_refund() {
    // 2 s refunds 200,000 bytes off what was printed before it, so the
    // flood after it stops at 4,400,000 bytes instead of 4,200,000.
    let mut p = load(
        r#"
        .rodata
fmt:    .string "%100000d"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =fmt
        mov     w1, 7
        bl      printf
        ldr     x0, =fmt
        mov     w1, 7
        bl      printf
        movz    w0, 0x8480
        movk    w0, 0x1E, lsl 16
        bl      usleep
loop:   ldr     x0, =fmt
        mov     w1, 7
        bl      printf
        b       loop
"#,
    );
    let r = p.halt();
    assert_eq!(r.error.as_deref(), Some(output_ceiling_message().as_str()));
    assert_eq!(p.cpu.stdout.len(), 4_400_000);
}

#[test]
fn nanosleep_sleeps_on_the_svc_and_keeps_the_registers() {
    let mut p = load(
        r#"
        .data
ts:     .xword  0, 1500
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x9, 9
        ldr     x0, =ts
        mov     x1, 0
        mov     x8, 101
nap:    svc     0
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    p.step_to(p.label("nap"));
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::Sleeping(1_500));
    assert_eq!(r.pc, p.label("nap") + 4);
    assert_eq!(p.cpu.term.virtual_ns, 1_500);
    // One step refunded per whole microsecond.
    assert_eq!(p.cpu.steps_total(), p.cpu.steps_taken() - 1);
    assert_eq!(p.cpu.regs.read_gpr(9, true), 9);
    assert_eq!(p.cpu.changed_registers(), &[0]);
    assert_eq!(p.cpu.take_pending_sleep_ns(), Some(1_500));
}

#[test]
fn a_scanf_with_no_input_waits_on_the_stub_and_resumes_when_input_comes() {
    let mut p = load(
        r#"
        .rodata
fmt:    .string "%d"
        .bss
n:      .skip   4
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =fmt
        ldr     x1, =n
        bl      scanf
after:  ldr     x1, =n
        ldr     w0, [x1]
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    let scanf = p.stub("scanf");
    p.step_to(scanf);
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::WaitingForInput);
    assert_eq!(r.pc, scanf);
    assert!(!r.halted);
    assert!(p.cpu.blocked);
    assert!(p.cpu.changed_registers().is_empty());
    assert!(call_card(&p.cpu).is_empty());
    let at = host_call_context(&p.cpu, &p.line_map()).expect("inside scanf");
    assert_eq!(at.name, "scanf");
    assert_eq!(at.call_site_pc, p.label("after") - 4);
    // Waiting again changes nothing.
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::WaitingForInput);
    assert_eq!(r.pc, scanf);

    p.cpu.push_stdin(b"42\n");
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::Advance);
    assert_eq!(r.pc, p.label("after"));
    assert_eq!(p.cpu.regs.read_gpr(0, true), 1);
    let card = call_card(&p.cpu);
    assert_eq!(&card[..5], &[2.0, p.cpu.steps_taken() as f64, (p.label("after") - 4) as f64, 1.0, 0.0]);
    let r = p.halt();
    assert_eq!(r.outcome, StepOutcome::Exited(42));
}

#[test]
fn a_read_with_no_input_waits_on_the_svc_and_resumes_when_input_comes() {
    let mut p = load(
        r#"
        .bss
buf:    .skip   16
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0
        ldr     x1, =buf
        mov     x2, 16
        mov     x8, 63
read:   svc     0
        ldp     x29, x30, [sp], 16
        ret
"#,
    );
    p.step_to(p.label("read"));
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::WaitingForInput);
    assert_eq!(r.pc, p.label("read"));
    assert!(p.cpu.blocked);
    p.cpu.push_stdin_interactive(b"abc\n");
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::Advance);
    assert_eq!(r.pc, p.label("read") + 4);
    assert_eq!(p.cpu.regs.read_gpr(0, true), 4);
    assert_eq!(p.cpu.changed_registers(), &[0]);
    // The typed line echoes once, as a terminal shows it.
    assert_eq!(p.cpu.stdout, b"abc\n");
    assert_eq!(p.cpu.stdout_seen(), 4);
    let r = p.halt();
    assert_eq!(r.outcome, StepOutcome::Exited(4));
}

#[test]
fn exit_through_svc_halts_past_the_svc() {
    let mut p = load(
        r#"
        .text
        .global main
main:   mov     x0, 3
        mov     x8, 93
quit:   svc     0
        ret
"#,
    );
    let r = p.halt();
    assert_eq!(r.outcome, StepOutcome::Exited(3));
    assert_eq!(r.pc, p.label("quit") + 4);
    assert_eq!(r.error, None);
    assert_eq!(p.cpu.exit_code, Some(3));
}

/// A printf whose leftovers the program then uses: x9 after the call.
const PRINTF_THEN_X9: &str = r#"
        .rodata
fmt:    .string "%d\n"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x9, 5
        ldr     x0, =fmt
        mov     w1, 7
        bl      printf
after:  add     x0, x9, 1
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;

#[test]
fn a_library_call_changes_the_caller_saved_registers_and_says_so() {
    let mut p = load(PRINTF_THEN_X9);
    let printf = p.stub("printf");
    p.step_to(printf);
    let at = host_call_context(&p.cpu, &p.line_map()).expect("inside printf");
    assert_eq!(at.name, "printf");
    assert_eq!(at.call_site_pc, p.label("after") - 4);
    assert_eq!(at.call_site_line, Some(11));
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::Advance);
    assert_eq!(r.pc, p.label("after"));
    assert_eq!(r.error, None);
    assert_eq!(p.cpu.stdout, b"7\n");
    assert_eq!(p.cpu.regs.read_gpr(0, true), 2);
    assert_eq!(p.cpu.changed_registers(), &(0..=18).collect::<Vec<u8>>()[..]);
    assert_eq!(p.cpu.changed_fp_registers(), &(0..32).collect::<Vec<u8>>()[..]);
    assert!(host_call_context(&p.cpu, &p.line_map()).is_none());

    let card = call_card(&p.cpu);
    assert_eq!(
        &card[..11],
        &[1.0, p.cpu.steps_taken() as f64, (p.label("after") - 4) as f64, 2.0, 0.0, 1.0, 1.0, 3.0, 3.0, 2.0, 2.0]
    );

    // The use of x9 is noted against the call that left it.
    p.step();
    let notes = p.cpu.take_clobber_notes();
    assert_eq!(
        notes,
        vec![9, READ_BY_INSTRUCTION, (p.label("after") - 4) as u32, p.label("after") as u32]
    );
}

#[test]
fn qsort_entering_the_comparator_pushes_a_runtime_call() {
    let source = r#"
        .data
arr:    .word   3, 1, 2
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =arr
        mov     x1, 3
        mov     x2, 4
        ldr     x3, =cmp
        bl      qsort
after:  ldr     x0, =arr
        ldr     w0, [x0]
        ldp     x29, x30, [sp], 16
        ret
cmp:    ldr     w0, [x0]
        ldr     w1, [x1]
        sub     w0, w0, w1
        ret
"#;
    let mut p = load(source);
    let layout = frame_layout(&p.source, &p.image, &p.cpu.mem);
    let qsort = p.stub("qsort");
    p.step_to(qsort);
    let r = p.step();
    assert_eq!(r.outcome, StepOutcome::Advance);
    assert_eq!(r.pc, p.label("cmp"));
    assert_eq!(p.cpu.call_stack().depth(), 2);
    // The arguments and the link qsort set for the comparator.
    assert_eq!(p.cpu.changed_registers(), &[0, 1, 30]);
    assert!(p.cpu.changed_fp_registers().is_empty());
    // What the stack frames view reads, as the machine hands it over.
    let expected = [
        10.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.0, 4194304.0, 0.0, 4294902832.0, 2147483648.0, 2147483632.0, 0.0, 2147483632.0, 0.0,
        4.0, 0.0, 0.0, -1.0, -1.0, 0.0, 0.0, -1.0, -1.0,
        1.0, 4194348.0, 4294902608.0, 4294902608.0, 2147483632.0, 2147483632.0, 2147483632.0,
        0.0, 1.0, 2.0, 0.0, 0.0, -1.0, -1.0, 0.0, 0.0, -1.0, -1.0,
        2.0, 2.0, 0.0, 0.0, 8.0, 0.0,
        4194304.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0,
        4194348.0, 1.0, 1.0, 0.0, 0.0, 6291460.0, 0.0, 0.0, 0.0,
    ];
    assert_eq!(view_numbers(&frame_view(&p.cpu, &layout)), expected);
    let r = p.halt();
    assert_eq!(r.outcome, StepOutcome::Exited(1));
}
