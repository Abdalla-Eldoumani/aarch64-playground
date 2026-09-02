//! Cooked-tty echo for typed input, and the display counters that let a
//! host unprint it again.
//!
//! A real terminal in cooked mode prints what you type, so a session at a
//! real prompt reads "Enter score 1: 10" while a console that shows only
//! the program's own output reads "Enter score 1: ".
//! `push_stdin_interactive` marks a run of queued bytes as typed; the
//! first read that touches the run echoes it whole, at the moment it is
//! consumed. `push_stdin` keeps the old silent behavior
//! for the redirect paths (fixtures, scripted terminal drives, the
//! exercise checker), and raw mode echoes nothing at all.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

fn load(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu
}

fn run_to_halt(cpu: &mut Cpu) {
    let r = cpu.run_until_break(1_000_000).expect("run failed");
    assert!(
        r.halted,
        "program did not halt (blocked waiting for input: {})",
        cpu.is_blocked()
    );
}

fn stdout_of(cpu: &mut Cpu) -> String {
    String::from_utf8(cpu.take_stdout()).expect("stdout is utf-8")
}

/// Two prompts, two scanf reads, one printed total: the shape of the
/// course program the echo behaviour was reported against.
const TWO_PROMPTS: &str = r#"
define(fp, x29)
define(lr, x30)

        .data
p1:     .string "Enter score 1: "
p2:     .string "Enter score 2: "
fmt_in: .string "%d"
total:  .string "total %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        ldr     x0, =p1
        bl      printf
        ldr     x0, =fmt_in
        add     x1, fp, 16
        bl      scanf

        ldr     x0, =p2
        bl      printf
        ldr     x0, =fmt_in
        add     x1, fp, 20
        bl      scanf

        ldr     w1, [fp, 16]
        ldr     w2, [fp, 20]
        add     w1, w1, w2
        ldr     x0, =total
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 32
        ret
"#;

/// Three getchar calls over one typed line: the first byte pulls the echo,
/// the other two must add nothing.
const GETCHAR_LINE: &str = r#"
define(fp, x29)
define(lr, x30)

        .data
prompt: .string "type: "
done:   .string "done\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =prompt
        bl      printf
        bl      getchar
        bl      getchar
        bl      getchar
        ldr     x0, =done
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// TCGETS, clear ICANON, TCSETS: the real route a terminal program takes
/// into raw mode. Then one getchar the program echoes itself.
const RAW_MODE_GETCHAR: &str = r#"
define(fp, x29)
define(lr, x30)

        .data
tio:    .skip 60

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 0
        mov     x1, 0x5401
        ldr     x2, =tio
        mov     x8, 29
        svc     0
        ldr     x2, =tio
        ldr     w1, [x2, 12]
        mov     w3, 0xA
        mvn     w3, w3
        and     w1, w1, w3
        str     w1, [x2, 12]
        mov     x0, 0
        mov     x1, 0x5402
        mov     x8, 29
        svc     0
        bl      getchar
        bl      putchar
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// Two printf calls, nothing read: a ruler for the display counters.
const PRINT_TWICE: &str = r#"
define(fp, x29)
define(lr, x30)

        .data
one:    .string "one\n"
two:    .string "two\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =one
        bl      printf
        ldr     x0, =two
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// write(2, "bad\n", 4): the stderr counter needs its own producer.
const WRITE_TO_STDERR: &str = r#"
define(fp, x29)
define(lr, x30)

        .data
msg:    .string "bad\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 2
        ldr     x1, =msg
        mov     x2, 4
        mov     x8, 64
        svc     0
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn push_stdin_never_echoes() {
    // The redirect path. Every fixture, the corpus runner, the scripted
    // terminal drives and the exercise checker come through here, so this
    // transcript must not change.
    let mut cpu = load(TWO_PROMPTS);
    cpu.push_stdin(b"10\n20\n");
    run_to_halt(&mut cpu);
    assert_eq!(stdout_of(&mut cpu), "Enter score 1: Enter score 2: total 30\n");
}

#[test]
fn an_interactive_line_echoes_once_after_its_prompt() {
    // What a student sees at a real prompt: each answer lands on its own
    // prompt line, once, and the trailing newline the second scanf skips
    // does not print itself again.
    let mut cpu = load(TWO_PROMPTS);
    cpu.push_stdin_interactive(b"10\n");
    cpu.push_stdin_interactive(b"20\n");
    run_to_halt(&mut cpu);
    assert_eq!(
        stdout_of(&mut cpu),
        "Enter score 1: 10\nEnter score 2: 20\ntotal 30\n"
    );
}

#[test]
fn a_line_typed_at_a_blocked_prompt_echoes_when_the_read_resumes() {
    // The web's actual flow: the program parks on scanf, the student types,
    // the run resumes. The echo has to land after the prompt that asked for
    // it, and the newline the NEXT read skips must not print itself.
    let mut cpu = load(TWO_PROMPTS);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(!r.halted);
    assert!(cpu.is_blocked(), "the first scanf parks with nothing queued");
    assert_eq!(stdout_of(&mut cpu), "Enter score 1: ");

    cpu.push_stdin_interactive(b"10\n");
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(!r.halted);
    assert!(cpu.is_blocked(), "the second scanf parks in turn");
    assert_eq!(stdout_of(&mut cpu), "10\nEnter score 2: ");

    cpu.push_stdin_interactive(b"20\n");
    run_to_halt(&mut cpu);
    assert_eq!(stdout_of(&mut cpu), "20\ntotal 30\n");
}

#[test]
fn getchar_echoes_the_line_on_the_first_byte_only() {
    let mut cpu = load(GETCHAR_LINE);
    cpu.push_stdin_interactive(b"ab\n");
    // Queuing is not consuming: nothing has been read, so nothing prints.
    assert_eq!(cpu.stdout.len(), 0);
    run_to_halt(&mut cpu);
    // "ab\n" once, from the first getchar; the other two consume the rest
    // of the same line and print nothing.
    assert_eq!(stdout_of(&mut cpu), "type: ab\ndone\n");
}

#[test]
fn the_same_program_stays_silent_on_a_redirect() {
    let mut cpu = load(GETCHAR_LINE);
    cpu.push_stdin(b"ab\n");
    run_to_halt(&mut cpu);
    assert_eq!(stdout_of(&mut cpu), "type: done\n");
}

#[test]
fn raw_mode_suppresses_the_echo() {
    // A termios program paints its own screen and would fight the echo for
    // the cursor, so raw mode echoes nothing: the only byte on stdout is
    // the one the program chose to print itself.
    let mut cpu = load(RAW_MODE_GETCHAR);
    cpu.push_stdin_interactive(b"ab\n");
    run_to_halt(&mut cpu);
    assert!(cpu.term.raw_mode, "the program must have reached raw mode");
    assert_eq!(stdout_of(&mut cpu), "a");
}

#[test]
fn close_stdin_echoes_nothing() {
    // End-of-input is a signal, not a read: a line nobody consumed never
    // reaches the transcript.
    let mut cpu = load(PRINT_TWICE);
    cpu.push_stdin_interactive(b"10\n");
    cpu.close_stdin();
    run_to_halt(&mut cpu);
    assert_eq!(stdout_of(&mut cpu), "one\ntwo\n");
}

#[test]
fn display_counters_grow_with_output_and_snap_back_on_step_back() {
    let mut cpu = load(PRINT_TWICE);
    assert_eq!(cpu.stdout_seen(), 0);

    step_until(&mut cpu, |c| c.stdout_seen() == 4);
    step_until(&mut cpu, |c| c.stdout_seen() == 8);
    assert_eq!(cpu.stdout.len(), 8);
    assert_eq!(cpu.stderr_seen(), 0);

    cpu.step_back();
    assert_eq!(cpu.stdout_seen(), 4, "the undone printf is un-counted");
    assert_eq!(
        cpu.stdout.len(),
        8,
        "the buffer itself keeps what the student already saw"
    );
}

#[test]
fn the_stderr_counter_tracks_its_own_stream() {
    let mut cpu = load(WRITE_TO_STDERR);
    run_to_halt(&mut cpu);
    assert_eq!(cpu.stderr_seen(), 4);
    assert_eq!(cpu.stdout_seen(), 0);
    assert_eq!(String::from_utf8(cpu.take_stderr()).unwrap(), "bad\n");
}

#[test]
fn echoed_input_counts_toward_the_display_counter() {
    let mut cpu = load(GETCHAR_LINE);
    cpu.push_stdin_interactive(b"ab\n");
    run_to_halt(&mut cpu);
    // "type: " + "ab\n" + "done\n": the echo drains to the host like any
    // other output, so it is counted like any other output.
    assert_eq!(cpu.stdout_seen(), 14);
}

#[test]
fn a_named_save_round_trip_restores_the_display_counters() {
    let mut cpu = load(PRINT_TWICE);
    step_until(&mut cpu, |c| c.stdout_seen() == 4);
    cpu.save_state("mid");

    run_to_halt(&mut cpu);
    assert_eq!(cpu.stdout_seen(), 8);

    assert!(cpu.load_state("mid"));
    assert_eq!(cpu.stdout_seen(), 4);
    assert_eq!(cpu.stderr_seen(), 0);

    // The restored machine still runs its remaining half.
    run_to_halt(&mut cpu);
    assert_eq!(cpu.stdout_seen(), 8);
}

#[test]
fn stepping_back_over_the_echo_replays_it_exactly_once() {
    // The transcript a straight run produces.
    let expected = {
        let mut cpu = load(TWO_PROMPTS);
        cpu.push_stdin_interactive(b"10\n");
        cpu.push_stdin_interactive(b"20\n");
        run_to_halt(&mut cpu);
        stdout_of(&mut cpu)
    };

    let mut cpu = load(TWO_PROMPTS);
    cpu.push_stdin_interactive(b"10\n");
    cpu.push_stdin_interactive(b"20\n");

    // Mirror what a host does with the counters: keep every byte stdout
    // produced, and trim back to the frame's count when a step is undone.
    let mut transcript: Vec<u8> = Vec::new();
    let mut stepped_back = false;
    for _ in 0..2_000 {
        if cpu.is_halted() {
            break;
        }
        cpu.step().expect("step");
        transcript.extend_from_slice(&cpu.take_stdout());
        if !stepped_back && transcript.ends_with(b"10\n") {
            cpu.step_back();
            transcript.truncate(cpu.stdout_seen() as usize);
            assert_eq!(
                transcript, b"Enter score 1: ",
                "stepping back before the read un-prints its echo"
            );
            stepped_back = true;
        }
    }

    assert!(stepped_back, "the run must reach the echoed read");
    assert!(cpu.is_halted(), "the replay must finish the program");
    assert_eq!(
        String::from_utf8(transcript).expect("stdout is utf-8"),
        expected,
        "the replayed transcript matches the straight run, echo included"
    );
}

/// Step until `done` holds, with a bound so a broken program fails as a
/// test instead of hanging.
fn step_until(cpu: &mut Cpu, done: fn(&Cpu) -> bool) {
    for _ in 0..2_000 {
        if done(cpu) {
            return;
        }
        cpu.step().expect("step");
    }
    panic!("the program never reached the expected state");
}
