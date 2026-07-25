//! Integration test: the cpsc 355 tutorial corpus must parse cleanly.
//!
//! Execution correctness is a phase B concern once libc stubs and syscall
//! dispatch land. For now we assert each file goes from source text to a
//! `Program` value without error. Instructions pass through as raw token
//! slices -- the linker that turns them into encoded words is still being
//! built -- so this test is really "the parser and m4 expander accept
//! this file".
//!
//! The corpus lives at `docs/cpsc355-reference/Tutorials/` and is gitignored
//! (it's course material, not for public redistribution). When the corpus
//! is not present on disk (CI, a clean clone), each file is reported as
//! skipped and the test still passes. Run this locally after dropping the
//! tutorials into `docs/cpsc355-reference/` to see it check every file.
//!
//! Add new tutorial files to `REQUIRED` below as phase A gains the
//! features they need.

use std::path::{Path, PathBuf};

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::parser::parse;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

const REQUIRED: &[&str] = &[
    "Week 3/exercise.s",
    "Week 8/example1_scores.asm",
    "Week 9/example1_student_record.asm",
    "Week 10/ex4_find_max.asm",
    "Week 11/ex2_static_counter.asm",
    "Week 11/ex4_argv.asm",
    "week12/fp_ex2_circle.asm",
    "week12/ex5_is_prime.asm",
    "week13/io_ex1_hello.asm",
    "week13/io_ex2_echo.asm",
    "week13/io_ex3_write_file.asm",
    "week13/io_ex4_read_file.asm",
    "week13/io_ex5_copy_file.asm",
];

fn corpus_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // emulator/ -> repo root
    p.push("docs/cpsc355-reference/Tutorials");
    p
}

#[test]
fn tutorial_corpus_parses() {
    let root = corpus_root();
    if !root.exists() {
        eprintln!(
            "cpsc355-reference not found at {}; skipping (expected in CI)",
            root.display()
        );
        return;
    }
    let mut failures: Vec<(String, String)> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();
    let mut parsed: Vec<String> = Vec::new();
    for rel in REQUIRED {
        let path: PathBuf = root.join(rel);
        match try_parse(&path) {
            Ok(Some(())) => parsed.push((*rel).to_string()),
            Ok(None) => skipped.push((*rel).to_string()),
            Err(msg) => failures.push(((*rel).to_string(), msg)),
        }
    }
    println!("parsed:  {}", parsed.len());
    for name in &parsed {
        println!("  OK  {name}");
    }
    if !skipped.is_empty() {
        println!("skipped: {}", skipped.len());
        for name in &skipped {
            println!("  --  {name}");
        }
    }
    if !failures.is_empty() {
        for (name, msg) in &failures {
            eprintln!("FAIL {name}: {msg}");
        }
        panic!("{} tutorial files failed to parse", failures.len());
    }
}

#[test]
fn tutorial_corpus_pipeline_status() {
    // Runs each tutorial file through the full hosted pipeline and
    // reports how far it gets: link success (pipeline can assemble +
    // load it) and run success (the program halts without error within
    // a step budget). This is the gauge of B12 progress.
    let root = corpus_root();
    if !root.exists() {
        eprintln!("cpsc355-reference not found; skipping");
        return;
    }
    let mut link_ok = 0;
    let mut link_fail = 0;
    let mut run_ok = 0;
    let mut run_fail = 0;
    for rel in REQUIRED {
        let path: PathBuf = root.join(rel);
        if !path.exists() {
            continue;
        }
        let source = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("  read fail {rel}: {e}");
                continue;
            }
        };
        let mut cpu = Cpu::new();
        match assemble_hosted(&source, &cpu.host) {
            Ok(image) => {
                if cpu.load_linked_image(&image).is_err() {
                    println!("LINK-LOAD FAIL: {rel}");
                    link_fail += 1;
                    continue;
                }
                link_ok += 1;
                match cpu.run_until_break(1_000_000) {
                    Ok(r) if r.halted => {
                        println!("RUN OK:   {rel} ({} steps)", r.steps_executed);
                        run_ok += 1;
                    }
                    Ok(_r) if cpu.is_blocked() => {
                        // scanf stalled waiting for stdin -- expected for
                        // interactive tutorials, still counts as linking.
                        println!("RUN WAIT: {rel} (paused for stdin)");
                        run_ok += 1;
                    }
                    Ok(_) => {
                        println!("RUN NOHALT: {rel}");
                        run_fail += 1;
                    }
                    Err(e) => {
                        println!("RUN FAIL: {rel}: {e}");
                        run_fail += 1;
                    }
                }
            }
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("no entry point") {
                    // A driver-paired helper unit (its main lives in the
                    // tutorial's C file): everything parses and encodes;
                    // only entry selection refuses, as real ld would.
                    println!("LINK HELPER: {rel} (no main by design)");
                    link_ok += 1;
                } else {
                    println!("LINK FAIL: {rel}: {e}");
                    link_fail += 1;
                }
            }
        }
    }
    println!(
        "\ntutorial pipeline: link {}/{} run {}/{}",
        link_ok,
        link_ok + link_fail,
        run_ok,
        run_ok + run_fail
    );
    // Every tutorial file that is present must link AND run (halt or
    // pause for stdin). A regression shows up as a lower count here, and
    // the per-file `println!` above says which one fell off.
    assert_eq!(
        link_fail, 0,
        "{link_fail} tutorial file(s) failed to link through the pipeline"
    );
    assert_eq!(
        run_fail, 0,
        "{run_fail} tutorial file(s) linked but failed to run"
    );
    assert!(
        run_ok > 0,
        "no tutorial file ran through the pipeline end to end"
    );
}

fn try_parse(path: &Path) -> Result<Option<()>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let source = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    match parse(&source) {
        Ok(_) => Ok(Some(())),
        Err(e) => Err(e.to_string()),
    }
}
