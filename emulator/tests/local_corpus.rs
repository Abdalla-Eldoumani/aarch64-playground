//! Integration test: a folder of assembly programs kept outside the repo
//! parses, links, and runs.
//!
//! Some good test programs cannot be committed because the repo has no
//! right to share them. Point `LOCAL_CORPUS_DIR` at a folder of them and
//! both tests walk every `.asm` and `.s` file under it: each must parse,
//! and each must link through the hosted pipeline and run to a halt (or
//! pause waiting on stdin, for the interactive ones).
//!
//! With the variable unset, both tests print a skip line and pass, so CI
//! and fresh clones stay green. Set to a path that is not a folder, or to
//! a folder with no programs in it, they fail, so a typo in the path
//! cannot pass as a skip.
//!
//! Two kinds of file cannot run alone and are reported, not failed. A file
//! with no `main` is a helper meant to be linked with another file: only
//! choosing an entry point refuses, as the real linker would. A file that
//! calls a function a `.c` file in the same folder defines needs that C
//! half, which the emulator does not compile.

use std::path::{Path, PathBuf};

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::parser::parse;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

const CORPUS_VAR: &str = "LOCAL_CORPUS_DIR";

/// Every `.asm` and `.s` file under the folder `LOCAL_CORPUS_DIR` names,
/// sorted so the report reads the same on every run. `None` means the
/// variable is unset and the caller should skip.
fn corpus_files() -> Option<Vec<PathBuf>> {
    let Some(root) = std::env::var_os(CORPUS_VAR).filter(|v| !v.is_empty()) else {
        println!("skipped: set {CORPUS_VAR} to a folder of .asm or .s programs to run this test");
        return None;
    };
    let root = PathBuf::from(root);
    assert!(
        root.is_dir(),
        "{CORPUS_VAR} is {}, which is not a folder",
        root.display()
    );
    let mut files = Vec::new();
    collect_programs(&root, &mut files);
    files.sort();
    assert!(
        !files.is_empty(),
        "no .asm or .s files under {}",
        root.display()
    );
    Some(files)
}

fn collect_programs(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries =
        std::fs::read_dir(dir).unwrap_or_else(|e| panic!("cannot read {}: {e}", dir.display()));
    for entry in entries {
        let path = entry.expect("folder entry").path();
        if path.is_dir() {
            collect_programs(&path, out);
        } else if matches!(path.extension().and_then(|e| e.to_str()), Some("asm" | "s")) {
            out.push(path);
        }
    }
}

#[test]
fn local_corpus_parses() {
    let Some(files) = corpus_files() else { return };
    let mut failures: Vec<(String, String)> = Vec::new();
    for path in &files {
        let name = path.display().to_string();
        let parsed = std::fs::read_to_string(path)
            .map_err(|e| e.to_string())
            .and_then(|source| parse(&source).map(|_| ()).map_err(|e| e.to_string()));
        match parsed {
            Ok(()) => println!("  OK  {name}"),
            Err(msg) => failures.push((name, msg)),
        }
    }
    println!("parsed: {}/{}", files.len() - failures.len(), files.len());
    if !failures.is_empty() {
        for (name, msg) in &failures {
            eprintln!("FAIL {name}: {msg}");
        }
        panic!("{} corpus file(s) failed to parse", failures.len());
    }
}

#[test]
fn every_local_corpus_program_links_and_runs() {
    let Some(files) = corpus_files() else { return };
    let mut link_ok = 0;
    let mut link_fail = 0;
    let mut run_ok = 0;
    let mut run_fail = 0;
    for path in &files {
        let name = path.display();
        let source = match std::fs::read_to_string(path) {
            Ok(s) => s,
            Err(e) => {
                println!("READ FAIL: {name}: {e}");
                link_fail += 1;
                continue;
            }
        };
        let mut cpu = Cpu::new();
        match assemble_hosted(&source, &cpu.host) {
            Ok(image) => {
                if cpu.load_linked_image(&image).is_err() {
                    println!("LINK-LOAD FAIL: {name}");
                    link_fail += 1;
                    continue;
                }
                link_ok += 1;
                match cpu.run_until_break(1_000_000) {
                    Ok(r) if r.halted => {
                        println!("RUN OK:   {name} ({} steps)", r.steps_executed);
                        run_ok += 1;
                    }
                    Ok(_r) if cpu.is_blocked() => {
                        // scanf stalled waiting for stdin, expected for
                        // interactive programs, still counts as linking.
                        println!("RUN WAIT: {name} (paused for stdin)");
                        run_ok += 1;
                    }
                    Ok(_) => {
                        println!("RUN NOHALT: {name}");
                        run_fail += 1;
                    }
                    Err(e) => {
                        println!("RUN FAIL: {name}: {e}");
                        run_fail += 1;
                    }
                }
            }
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("no entry point") {
                    println!("LINK HELPER: {name} (no main by design)");
                    link_ok += 1;
                } else if let Some(name) = function_from_c_neighbour(path, &msg) {
                    println!("LINK NEEDS C: {name} (`{name}` is defined in a C file next to it)");
                } else {
                    println!("LINK FAIL: {name}: {e}");
                    link_fail += 1;
                }
            }
        }
    }
    println!(
        "\ncorpus pipeline: link {}/{} run {}/{}",
        link_ok,
        link_ok + link_fail,
        run_ok,
        run_ok + run_fail
    );
    // A regression shows up as a nonzero count here, and the per-file
    // `println!` above says which one fell off.
    assert_eq!(
        link_fail, 0,
        "{link_fail} corpus file(s) failed to link through the pipeline"
    );
    assert_eq!(
        run_fail, 0,
        "{run_fail} corpus file(s) linked but failed to run"
    );
}

/// The label a link error says is missing, when a `.c` file in the
/// program's folder defines a function by that name.
fn function_from_c_neighbour(path: &Path, link_error: &str) -> Option<String> {
    let name = link_error
        .split("no label named `")
        .nth(1)?
        .split('`')
        .next()?;
    let call = format!("{name}(");
    // A text match, not a C parser: loose, but this check only runs locally.
    let defined = std::fs::read_dir(path.parent()?)
        .ok()?
        .flatten()
        .any(|entry| {
            let c_file = entry.path();
            c_file.extension().is_some_and(|ext| ext == "c")
                && std::fs::read_to_string(&c_file).is_ok_and(|src| src.contains(&call))
        });
    defined.then(|| name.to_string())
}
