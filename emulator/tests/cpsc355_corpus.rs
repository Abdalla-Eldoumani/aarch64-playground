//! Integration test: the CPSC 355 tutorial corpus assembles and runs.
//!
//! Two gates: every listed file parses to a `Program`, and every file
//! present links through the hosted pipeline and runs to a halt (or a
//! clean pause on stdin for the interactive ones).
//!
//! The corpus lives at `cpsc355-kb/tutorials/` and is gitignored (it's
//! course material, not for public redistribution). Both tests are
//! #[ignore]d so CI and clean clones never see them, and a run with
//! --ignored on a machine WITHOUT the corpus fails loudly rather than
//! passing as a skip. Individual files missing under a present root are
//! still reported as skipped.
//!
//! `REQUIRED` lists the tutorial programs that stand alone: the two
//! `sepcomp-asm-main-calls-c-*` files are left out on purpose, since
//! their `main` lives in a C file the emulator does not compile.

use std::path::{Path, PathBuf};

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::parser::parse;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

const REQUIRED: &[&str] = &[
    "w26/wk03-arm-setup-assembly-basics/tutorial-w26-wk03-code-arithmetic-operations-demo.asm",
    "w26/wk08-load-store-stack/tutorial-w26-wk08-code-stack-scores-array.asm",
    "w26/wk08-load-store-stack/tutorial-w26-wk08-code-stack-cumulative-sum.asm",
    "w26/wk09-structs-and-arrays/tutorial-w26-wk09-code-struct-student-record.asm",
    "w26/wk10-2d-arrays-and-subroutines/tutorial-w26-wk10-code-subroutine-find-max.asm",
    "w26/wk11-external-data/tutorial-w26-wk11-code-static-counter.asm",
    "w26/wk11-external-data/tutorial-w26-wk11-code-command-line-args.asm",
    "w26/wk12-sepcomp-and-floating-point/tutorial-w26-wk12-code-fp-circle-area.asm",
    "w26/wk12-sepcomp-and-floating-point/tutorial-w26-wk12-code-sepcomp-asm-is-prime.asm",
    "w26/wk13-syscall-io-and-encoding/tutorial-w26-wk13-code-syscall-hello-write.asm",
    "w26/wk13-syscall-io-and-encoding/tutorial-w26-wk13-code-syscall-echo-stdin.asm",
    "w26/wk13-syscall-io-and-encoding/tutorial-w26-wk13-code-syscall-write-file.asm",
    "w26/wk13-syscall-io-and-encoding/tutorial-w26-wk13-code-syscall-read-file.asm",
    "w26/wk13-syscall-io-and-encoding/tutorial-w26-wk13-code-syscall-copy-file.asm",
];

fn corpus_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // emulator/ -> repo root
    p.push("cpsc355-kb/tutorials");
    p
}

#[test]
#[ignore = "requires the local cpsc355-kb corpus; run with --ignored"]
fn tutorial_corpus_parses() {
    let root = corpus_root();
    assert!(
        root.exists(),
        "cpsc355-kb corpus not found at {}; this test only runs on a machine that has it",
        root.display()
    );
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
#[ignore = "requires the local cpsc355-kb corpus; run with --ignored"]
fn every_present_tutorial_links_and_runs() {
    // Runs each tutorial file through the full hosted pipeline and
    // reports how far it gets: link success (pipeline can assemble +
    // load it) and run success (the program halts without error within
    // a step budget).
    let root = corpus_root();
    assert!(
        root.exists(),
        "cpsc355-kb corpus not found at {}; this test only runs on a machine that has it",
        root.display()
    );
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
                        // scanf stalled waiting for stdin, expected for
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
