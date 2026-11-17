//! The codes the wasm hands the web mean what the web reads them as: the
//! call card's layout and codes, the frame states and flags, and the
//! clobber notes' codes. web/lib/emulator copies each one by value, so a
//! change to the crate's const alone passes every other cargo test and
//! shows only in the web suite after a wasm rebuild. This reads those
//! files in place and holds every copy to the crate's const.

use std::collections::BTreeMap;
use std::path::PathBuf;

use aarch64_emulator::cpu::{READ_BY_CALL, READ_BY_MAIN_RETURN};
use aarch64_emulator::frames::{
    COMPLETE, ENTERED, LEAF, LR_UNSAVED, NONSTANDARD, NO_RECORD, RESERVED, RUNTIME_CALL,
};
use aarch64_emulator::hosted::{
    ARG_FP, ARG_STACK, CALL_NO_INPUT, CALL_NO_MATCH, CALL_SCANF, CALL_STOPPED, MAX_CALL_BYTES,
};
use aarch64_emulator::registers::FLAGS_CODE;
use aarch64_emulator::{CALL_HEADER, CALL_ROW};

fn web_file(name: &str) -> String {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop();
    p.push("web/lib/emulator");
    p.push(name);
    std::fs::read_to_string(&p)
        .unwrap_or_else(|e| panic!("read {}: {e}", p.display()))
        .replace("\r\n", "\n")
}

/// The value of the one `const NAME = <integer>;` line in `source`,
/// exported or not.
fn ts_const(file: &str, source: &str, name: &str) -> i64 {
    let prefix = format!("const {name} = ");
    let values: Vec<&str> = source
        .lines()
        .map(|line| line.trim_start().trim_start_matches("export "))
        .filter_map(|line| line.strip_prefix(prefix.as_str()))
        .collect();
    let [value] = values[..] else {
        panic!("{file} should declare `const {name} = <integer>;` once, found {}", values.len())
    };
    value
        .trim_end_matches(';')
        .parse()
        .unwrap_or_else(|e| panic!("{file}'s {name} is not an integer ({value}): {e}"))
}

/// Each `(web name, crate value, crate name)` against the web file's const.
fn check(file: &str, copies: &[(&str, i64, &str)]) {
    let source = web_file(file);
    for &(name, value, crate_name) in copies {
        assert_eq!(
            ts_const(file, &source, name),
            value,
            "web/lib/emulator/{file}'s {name} copies the crate's {crate_name}"
        );
    }
}

#[test]
fn call_card_layout_and_codes() {
    check(
        "call-cards.ts",
        &[
            ("HEADER", CALL_HEADER as i64, "CALL_HEADER"),
            ("ROW", CALL_ROW as i64, "CALL_ROW"),
            ("KEPT", MAX_CALL_BYTES as i64, "hosted::MAX_CALL_BYTES"),
            ("SCANF", CALL_SCANF.into(), "hosted::CALL_SCANF"),
            ("STOPPED", CALL_STOPPED.into(), "hosted::CALL_STOPPED"),
            ("NO_MATCH", CALL_NO_MATCH.into(), "hosted::CALL_NO_MATCH"),
            ("NO_INPUT", CALL_NO_INPUT.into(), "hosted::CALL_NO_INPUT"),
            ("FP_SOURCE", ARG_FP, "hosted::ARG_FP"),
            ("STACK_SOURCE", ARG_STACK, "hosted::ARG_STACK"),
        ],
    );
}

#[test]
fn frame_states_and_flags() {
    check(
        "stack-frames.ts",
        &[
            ("LR_UNSAVED", LR_UNSAVED.into(), "frames::LR_UNSAVED"),
            ("RUNTIME_CALL", RUNTIME_CALL.into(), "frames::RUNTIME_CALL"),
        ],
    );

    // FRAME_STATE is an object, one `key: value,` line per state.
    let source = web_file("stack-frames.ts");
    let body = source
        .split("export const FRAME_STATE = {")
        .nth(1)
        .and_then(|rest| rest.split("} as const;").next())
        .expect("stack-frames.ts declares `export const FRAME_STATE = { ... } as const;`");
    let web: BTreeMap<&str, i64> = body
        .lines()
        .filter_map(|line| line.trim().strip_suffix(','))
        .filter_map(|entry| entry.split_once(": "))
        .map(|(key, value)| {
            let value = value.parse().unwrap_or_else(|e| panic!("FRAME_STATE.{key} is not an integer ({value}): {e}"));
            (key, value)
        })
        .collect();
    let states: BTreeMap<&str, i64> = BTreeMap::from([
        ("complete", COMPLETE.into()),
        ("entered", ENTERED.into()),
        ("reserved", RESERVED.into()),
        ("leaf", LEAF.into()),
        ("nonstandard", NONSTANDARD.into()),
        ("noRecord", NO_RECORD.into()),
    ]);
    assert_eq!(
        web, states,
        "stack-frames.ts's FRAME_STATE copies the crate's frames::COMPLETE to NO_RECORD"
    );
}

#[test]
fn clobber_note_codes() {
    check(
        "clobber-note.ts",
        &[
            ("READ_BY_CALL", READ_BY_CALL.into(), "cpu::READ_BY_CALL"),
            ("READ_BY_MAIN_RETURN", READ_BY_MAIN_RETURN.into(), "cpu::READ_BY_MAIN_RETURN"),
            ("FLAGS", FLAGS_CODE.into(), "registers::FLAGS_CODE"),
        ],
    );
}
