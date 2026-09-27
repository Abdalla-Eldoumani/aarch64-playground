//! Error parity with the course servers. Every `<case>.s` in
//! tests/error-parity/ was built with `gcc <case>.s -o program` and run as
//! `./program` on the servers; `<case>.server.txt` is that terminal session,
//! with the temporary object file renamed after the case. The playground's
//! message has to open with the server's own diagnostic line and add one
//! line of guidance under it, and a program the server builds has to stop
//! here with the same fault and the same output.

use std::fs;
use std::path::PathBuf;

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::errors::EmuError;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// What one transcript says the server did.
struct Server {
    /// The diagnostic line the playground must repeat: an assembler error
    /// or an ld undefined reference without its location prefix, or the
    /// signal the shell reported.
    key: String,
    /// The assembler's line number, when the assembler named one.
    line: Option<usize>,
    /// Built: what the program printed before it stopped.
    stdout: Option<String>,
}

fn case_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/error-parity")
}

fn read_transcript(text: &str) -> Server {
    let lines: Vec<&str> = text.lines().collect();
    let run_at = lines.iter().position(|l| *l == "$ ./program");
    let Some(run_at) = run_at else {
        // A failed build: `<file>:<line>: Error: <message>` from the
        // assembler, or `(<section>+<offset>): undefined reference ...` from ld.
        for l in &lines {
            if let Some((place, msg)) = l.split_once(": Error: ") {
                let line = place.rsplit(':').next().and_then(|n| n.parse().ok());
                return Server { key: msg.to_string(), line, stdout: None };
            }
            if let Some(at) = l.find("undefined reference to ") {
                return Server { key: l[at..].to_string(), line: None, stdout: None };
            }
        }
        panic!("no diagnostic line in transcript:\n{text}");
    };
    // A run that died: the program's output, then the shell's report,
    // then the exit status.
    let body = &lines[run_at + 1..lines.len() - 1];
    let (report, printed) = body.split_last().expect("a signal report");
    let key = report.trim_end_matches(" (core dumped)").to_string();
    let stdout = printed.iter().map(|l| format!("{l}\n")).collect();
    Server { key, line: None, stdout: Some(stdout) }
}

/// The message and line the playground shows for a failed assemble: the
/// wasm boundary ships the inner message, never the Display prefix.
fn assemble_error(e: EmuError) -> (usize, String) {
    match e {
        EmuError::AssemblyError { line, message }
        | EmuError::PreprocError { line, message }
        | EmuError::ParseError { line, message }
        | EmuError::LinkError { line, message } => (line, message),
        other => (0, other.to_string()),
    }
}

fn check_guidance(case: &str, message: &str, key: &str) {
    let lines: Vec<&str> = message.lines().collect();
    assert_eq!(lines.first().copied(), Some(key), "{case}: first line differs from the server\n{message}");
    assert_eq!(lines.len(), 2, "{case}: expected the server line plus one guidance line\n{message}");
    assert!(!lines[1].trim().is_empty(), "{case}: empty guidance line");
}

fn run_case(case: &str) {
    let dir = case_dir();
    let source = fs::read_to_string(dir.join(format!("{case}.s"))).unwrap();
    let transcript = fs::read_to_string(dir.join(format!("{case}.server.txt"))).unwrap();
    let server = read_transcript(&transcript.replace("\r\n", "\n"));
    let mut cpu = Cpu::new();
    let built = assemble_hosted(&source, &cpu.host);

    let Some(expected_stdout) = server.stdout else {
        let (line, message) = assemble_error(built.err().unwrap_or_else(|| {
            panic!("{case}: the server refuses to build this program, the playground built it")
        }));
        check_guidance(case, &message, &server.key);
        if let Some(gas_line) = server.line {
            assert_eq!(line, gas_line, "{case}: the error marks a different line than GAS");
        }
        return;
    };

    let image = built.unwrap_or_else(|e| panic!("{case}: the server builds this program: {e}"));
    cpu.load_linked_image(&image).expect("load");
    cpu.close_stdin();
    let result = cpu.run_until_break(1_000_000).expect("run");
    assert!(result.halted, "{case}: the program should stop");
    let message = cpu
        .abort_message
        .clone()
        .unwrap_or_else(|| panic!("{case}: the server's run dies with `{}`, this one did not", server.key));
    check_guidance(case, &message, &server.key);
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert_eq!(stdout, expected_stdout, "{case}: stdout differs from the server");
}

#[test]
fn every_case_has_a_transcript() {
    for entry in fs::read_dir(case_dir()).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_some_and(|e| e == "s") {
            let transcript = path.with_extension("server.txt");
            assert!(transcript.exists(), "{} has no server transcript", path.display());
        }
    }
}

#[test]
fn no_main() {
    run_case("no-main");
}

#[test]
fn main_not_global() {
    run_case("main-not-global");
}

#[test]
fn undefined_label() {
    run_case("undefined-label");
}

#[test]
fn undefined_label_in_a_literal_pool_load() {
    run_case("undefined-ldr-label");
}

#[test]
fn undefined_label_in_a_data_directive() {
    run_case("undefined-data-label");
}

#[test]
fn duplicate_label() {
    run_case("duplicate-label");
}

#[test]
fn misspelled_mnemonic() {
    run_case("misspelled-mnemonic");
}

#[test]
fn uppercase_mnemonic_with_brackets() {
    // GAS lowercases the name and squeezes the spaces inside brackets too.
    run_case("uppercase-mnemonic");
}

#[test]
fn missing_ldr_of_the_format_string() {
    run_case("missing-ldr-fmt");
}

#[test]
fn misaligned_stack_at_a_call() {
    run_case("misaligned-stack-call");
}

#[test]
fn misaligned_stack_at_an_access() {
    run_case("misaligned-stack-access");
}

// The guidance itself, beyond the line the server prints.

#[test]
fn a_missing_format_string_names_printf_and_x0_and_never_mov() {
    let source = fs::read_to_string(case_dir().join("missing-ldr-fmt.s")).unwrap();
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host).unwrap();
    cpu.load_linked_image(&image).unwrap();
    cpu.run_until_break(1_000_000).unwrap();
    let message = cpu.abort_message.clone().unwrap();
    assert!(message.contains("printf") && message.contains("x0"), "{message}");
    assert!(message.contains("`ldr x0, =fmt`"), "{message}");
    assert!(!message.contains("mov"), "{message}");
}

#[test]
fn the_misaligned_stack_message_states_its_fix_once() {
    let source = fs::read_to_string(case_dir().join("misaligned-stack-call.s")).unwrap();
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host).unwrap();
    cpu.load_linked_image(&image).unwrap();
    cpu.run_until_break(1_000_000).unwrap();
    let message = cpu.abort_message.clone().unwrap();
    assert_eq!(message.matches("round").count(), 1, "{message}");
    assert_eq!(message.matches("alloc = ").count(), 1, "{message}");
}

#[test]
fn main_not_global_marks_the_main_label() {
    let source = fs::read_to_string(case_dir().join("main-not-global.s")).unwrap();
    let (line, message) = assemble_error(assemble_hosted(&source, &Cpu::new().host).unwrap_err());
    let main_line = source.lines().position(|l| l.starts_with("main:")).unwrap() + 1;
    assert_eq!(line, main_line, "{message}");
    assert!(message.contains("add `.global main`"), "{message}");
}

#[test]
fn a_program_with_its_own_start_still_enters_there() {
    // Built with as + ld rather than gcc, so no startup code wants main.
    let source = "\
        .text
        .global _start
_start: mov     x0, 3
        mov     x8, 93
        svc     0
";
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).expect("a _start program links");
    cpu.load_linked_image(&image).unwrap();
    cpu.run_until_break(1_000).unwrap();
    assert_eq!(cpu.exit_code, Some(3));
}
