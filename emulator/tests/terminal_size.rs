//! ioctl TIOCGWINSZ: the terminal pane's size, as a full-screen program asks
//! for it. The pane sets the size and pauses the step-back ring while it
//! drives the program; the console's three descriptors answer it then, while
//! stdin is the console. Every other case answers as before, so a headless
//! run that never sets a size sees no change, and no step the ring records
//! ever sees a size.

use aarch64_emulator::cpu::{Cpu, WindowSize};
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// Asks TIOCGWINSZ on fds 0, 1 and 2, on an open file, and on a descriptor
/// that is not open. Each line is the answer, then the 16 bytes the struct
/// winsize was asked into (8 for the struct, 8 past it), which start as 0x55.
const ASK: &str = r#"
define(fp, x29)
define(lr, x30)

TIOCGWINSZ = 0x5413
SYS_IOCTL = 29
SYS_OPENAT = 56

        .data
        .balign 8
ws:     .quad   0, 0
fill:   .quad   0x5555555555555555
path:   .string "data.txt"
fmt:    .string "%ld %016lx %016lx\n"

        .text
        .balign 4
        .global main

// ioctl(x0, TIOCGWINSZ, ws) into fresh 0x55 bytes, then print what it answered
ask:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =fill
        ldr     x9, [x9]
        ldr     x2, =ws
        str     x9, [x2]
        str     x9, [x2, 8]
        mov     x1, TIOCGWINSZ
        mov     x8, SYS_IOCTL
        svc     0
asked:
        mov     x1, x0
        ldr     x9, =ws
        ldr     x2, [x9]
        ldr     x3, [x9, 8]
        ldr     x0, =fmt
        bl      printf
        ldp     fp, lr, [sp], 16
        ret

main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 0
        bl      ask
        mov     x0, 1
        bl      ask
        mov     x0, 2
        bl      ask
        mov     x0, -100
        ldr     x1, =path
        mov     x2, 0
        mov     x8, SYS_OPENAT
        svc     0
        bl      ask
        mov     x0, 99
        bl      ask
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// 43 rows and 48 columns: ws_row 0x2b, ws_col 0x30, no pixel size, and
/// nothing written past the struct.
const SIZE: &str = "0 000000000030002b 5555555555555555\n";
/// ENOTTY (-25) with the buffer untouched.
const NOT_A_TTY: &str = "-25 5555555555555555 5555555555555555\n";
/// EBADF (-9): fd 99 is not open.
const NOT_OPEN: &str = "-9 5555555555555555 5555555555555555\n";

/// What ASK prints when the console answers no size: today's answers.
fn no_size() -> String {
    [NOT_A_TTY, NOT_A_TTY, NOT_A_TTY, NOT_A_TTY, NOT_OPEN].concat()
}

fn load_into(cpu: &mut Cpu) {
    let image =
        assemble_hosted(ASK, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu.upload_vfs_file("data.txt".to_string(), b"hello\n".to_vec());
}

fn load() -> Cpu {
    let mut cpu = Cpu::new();
    load_into(&mut cpu);
    cpu
}

/// Loaded and driven the way the terminal pane drives a program: the ring
/// paused (a load clears the pause) and the pane's 48 x 43 set.
fn in_the_pane() -> Cpu {
    let mut cpu = load();
    cpu.snapshots_paused = true;
    cpu.set_window_size(48, 43);
    cpu
}

fn answers(cpu: &mut Cpu) -> String {
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "program did not halt");
    String::from_utf8(cpu.take_stdout()).expect("stdout is utf-8")
}

/// Run to the instruction after the next ioctl and read the struct winsize.
fn to_next_answer(cpu: &mut Cpu) -> u64 {
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.hit_breakpoint, "never reached the instruction after the ioctl");
    cpu.mem.read_u64(cpu.symbols["ws"]).expect("read ws")
}

fn stop_after_each_ioctl(cpu: &mut Cpu) {
    let asked = cpu.symbols["asked"];
    cpu.set_breakpoint(asked);
}

const FILL: u64 = 0x5555_5555_5555_5555;
const ANSWER: u64 = 0x0030_002b;

#[test]
fn a_size_the_pane_set_answers_on_the_consoles_three_descriptors() {
    let mut cpu = in_the_pane();
    let want = [SIZE, SIZE, SIZE, NOT_A_TTY, NOT_OPEN].concat();
    assert_eq!(answers(&mut cpu), want);
}

#[test]
fn with_no_size_set_every_descriptor_answers_as_before() {
    let mut cpu = load();
    assert_eq!(answers(&mut cpu), no_size());
    let mut cpu = load();
    cpu.snapshots_paused = true;
    assert_eq!(answers(&mut cpu), no_size());
}

#[test]
fn a_size_set_while_the_ring_records_answers_enotty() {
    let mut cpu = load();
    cpu.set_window_size(48, 43);
    assert_eq!(answers(&mut cpu), no_size());
}

#[test]
fn stdin_from_a_file_answers_enotty_on_all_three_descriptors_even_with_a_size_set() {
    let mut cpu = in_the_pane();
    // Queued and closed before the first step: `./program < input`.
    cpu.push_stdin(b"x\n");
    cpu.close_stdin();
    assert_eq!(answers(&mut cpu), no_size());
}

#[test]
fn a_zero_row_or_column_count_clears_the_size() {
    let mut cpu = in_the_pane();
    cpu.set_window_size(48, 0);
    assert_eq!(cpu.window_size, None);
    assert_eq!(answers(&mut cpu), no_size());

    let mut cpu = in_the_pane();
    cpu.set_window_size(0, 43);
    assert_eq!(cpu.window_size, None);
    assert_eq!(answers(&mut cpu), no_size());
}

#[test]
fn set_window_size_takes_columns_then_rows() {
    let mut cpu = in_the_pane();
    assert_eq!(cpu.window_size, Some(WindowSize { rows: 43, cols: 48 }));
}

#[test]
fn a_load_clears_the_size() {
    let mut cpu = in_the_pane();
    load_into(&mut cpu);
    assert_eq!(cpu.window_size, None);
    cpu.snapshots_paused = true;
    assert_eq!(answers(&mut cpu), no_size());
}

#[test]
fn a_reset_clears_the_size() {
    let mut cpu = in_the_pane();
    cpu.reset();
    assert_eq!(cpu.window_size, None);
}

#[test]
fn stepping_back_over_the_ioctl_and_forward_again_gives_the_same_answer() {
    // Back needs the ring recording, and a recording ring keeps the size
    // from every ioctl, so both passes answer ENOTTY with the same bytes
    // even though the pane has a size set.
    let mut cpu = load();
    cpu.set_window_size(48, 43);
    stop_after_each_ioctl(&mut cpu);
    let ws = cpu.symbols["ws"];
    assert_eq!(to_next_answer(&mut cpu), FILL);
    assert_eq!(cpu.regs.read_gpr(0, true) as i64, -25);
    cpu.step_back();
    assert_eq!(cpu.regs.read_gpr(0, true), 0, "back put fd 0 back in x0");
    cpu.step().expect("step");
    assert_eq!(cpu.regs.read_gpr(0, true) as i64, -25);
    assert_eq!(cpu.mem.read_u64(ws).unwrap(), FILL);
}

#[test]
fn restoring_a_save_from_before_the_size_answers_the_live_size() {
    let mut cpu = load();
    cpu.snapshots_paused = true;
    stop_after_each_ioctl(&mut cpu);
    assert_eq!(to_next_answer(&mut cpu), FILL, "fd 0 with no size: ENOTTY");
    cpu.save_state("no size yet");
    cpu.set_window_size(48, 43);
    assert!(cpu.load_state("no size yet"));
    assert_eq!(to_next_answer(&mut cpu), ANSWER, "fd 1 answers the size set after the save");
}

#[test]
fn restoring_a_save_from_while_a_size_was_set_brings_no_size_back() {
    let mut cpu = in_the_pane();
    stop_after_each_ioctl(&mut cpu);
    assert_eq!(to_next_answer(&mut cpu), ANSWER);
    cpu.save_state("sized");
    cpu.set_window_size(0, 0);
    assert!(cpu.load_state("sized"));
    assert_eq!(to_next_answer(&mut cpu), FILL, "fd 1 answers ENOTTY: the size was cleared");
    assert_eq!(cpu.regs.read_gpr(0, true) as i64, -25);
}
