//! Example-picker regression: the authored programs served by the web
//! example loader -- the "Data and memory" and "Stack and locals" stage
//! fillers plus the "Miscellaneous" snake demo -- assemble and run to
//! their fixtures.
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
fn snake_demo_plays_its_scripted_moves_to_game_over() {
    let stdin = read("fixtures/snake.stdin");
    let (stdout, exit) = run_example("snake.s", Some(&stdin));
    assert_eq!(stdout, read("fixtures/snake.stdout"));
    assert_eq!(exit, Some(0));
}
