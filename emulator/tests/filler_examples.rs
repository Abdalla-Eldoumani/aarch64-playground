//! Example-picker regression: the authored programs served by the web
//! example loader -- the "Data and memory" and "Stack and locals" stage
//! fillers plus the two "Miscellaneous" snake games -- assemble and run
//! to their fixtures (or, for the real-time arcade snake, through a
//! timed scripted session).
//!
//! These are the same `.s` files the web example loader serves over HTTP,
//! read straight from `web/public/examples/cpsc355/` (not a copy) so the
//! served asset and the asserted behavior cannot drift. Each program is
//! assembled through the hosted pipeline, run to halt (pushing the stdin
//! fixture where the program reads input), and its stdout + exit code are
//! checked against the fixture files next to it.
//!
//! Line endings are normalized to LF on both sides: the WASM runtime emits
//! LF, but a Windows checkout can hand these tracked text files back as
//! CRLF, so the comparison is on logical content.

use std::path::PathBuf;

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// `web/public/examples/cpsc355/`, resolved relative to the emulator crate.
fn examples_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // emulator/ -> repo root
    p.push("web/public/examples/cpsc355");
    p
}

fn read(rel: &str) -> String {
    let path = examples_root().join(rel);
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    raw.replace("\r\n", "\n")
}

/// Assemble, load, optionally feed stdin, run to halt, return (stdout, exit).
fn run_example(src_rel: &str, stdin: Option<&str>) -> (String, Option<i64>) {
    let source = read(src_rel);
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host)
        .unwrap_or_else(|e| panic!("assemble {src_rel}: {e}"));
    cpu.load_linked_image(&image)
        .unwrap_or_else(|e| panic!("load {src_rel}: {e}"));
    if let Some(input) = stdin {
        cpu.push_stdin(input.as_bytes());
    }
    let r = cpu
        .run_until_break(1_000_000)
        .unwrap_or_else(|e| panic!("run {src_rel}: {e}"));
    assert!(
        r.halted,
        "{src_rel} did not halt (still blocked for input: {})",
        cpu.is_blocked()
    );
    let stdout = String::from_utf8_lossy(&cpu.take_stdout())
        .replace("\r\n", "\n");
    (stdout, cpu.exit_code())
}

#[test]
fn globals_filler_multiplies_data_and_stores_the_product() {
    let (stdout, exit) = run_example("globals.s", None);
    assert_eq!(stdout, read("fixtures/globals.stdout"));
    assert_eq!(exit, Some(0));
}

#[test]
fn locals_filler_reads_two_ints_and_prints_sum_and_product() {
    let stdin = read("fixtures/locals.stdin");
    let (stdout, exit) = run_example("locals.s", Some(&stdin));
    assert_eq!(stdout, read("fixtures/locals.stdout"));
    assert_eq!(exit, Some(0));
}

#[test]
fn snake_console_plays_its_scripted_moves_to_game_over() {
    let stdin = read("fixtures/snake-console.stdin");
    let (stdout, exit) = run_example("snake-console.s", Some(&stdin));
    assert_eq!(stdout, read("fixtures/snake-console.stdout"));
    assert_eq!(exit, Some(0));
}

/// The arcade snake drains stale stdin every frame (real-time design),
/// so a pre-pushed fixture never survives its menu. Drive it the way a
/// player does instead: one key at each pacing boundary (a nanosleep
/// pause or a spent run chunk). The script starts classic mode, turns
/// once, quits to the game over screen, then quits out through the
/// menu; the padding tokens are the "human" gaps between presses.
#[test]
fn snake_arcade_plays_a_timed_session_and_exits_cleanly() {
    let source = read("snake.s");
    let mut cpu = aarch64_emulator::cpu::Cpu::new();
    let image = aarch64_emulator::frontend::pipeline::assemble_hosted(&source, &cpu.host)
        .unwrap_or_else(|e| panic!("assemble snake.s: {e}"));
    cpu.load_linked_image(&image).expect("load snake.s");

    let script = [
        "", "", "
", "", "", "w", "", "", "q", "q", "", "", "q", "", "", "q", "", "", "q",
    ];
    let mut tokens = script.iter();
    let mut boundaries = 0u64;
    let mut halted = false;
    for _ in 0..4000 {
        let r = cpu.run_until_break(1_000_000).expect("run snake.s");
        if r.halted {
            halted = true;
            break;
        }
        let _ = cpu.take_pending_sleep_ns();
        boundaries += 1;
        if boundaries % 2 == 0 {
            if let Some(tok) = tokens.next() {
                cpu.push_stdin(tok.as_bytes());
            }
        }
        assert!(!cpu.blocked, "the arcade game must never block on stdin");
    }
    assert!(halted, "the scripted session must reach a clean exit");
    assert_eq!(cpu.exit_code, Some(0));
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert!(stdout.contains("GAME OVER"), "the quit path shows the game over screen");
    assert!(stdout.contains("Time Alive"), "the run stats panel prints");
    // The game put the terminal in raw mode to play and restored it on
    // the way out; a clean exit leaves the flag lowered.
    assert!(!cpu.term.raw_mode, "exit must restore the terminal");
}
