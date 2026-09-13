//! The Advanced SIMD behaviour replay.
//!
//! `tests/simd-behaviour.txt` is what each inventory line actually did on
//! csarm: for three input sets, the registers it changed and the 16-byte
//! memory chunks it wrote. This suite rebuilds that machine state here and
//! replays every line whose family has landed, so a load or store that
//! encodes correctly but moves the wrong bytes still fails.
//!
//! The harness mapped a buffer holding `k & 0xff` at offset `k`, 1 KiB
//! before the base and 64 KiB after, and pointed the line's base register
//! at it. The `[sp` forms ran against a copy of the buffer's first 256
//! bytes that was written back afterwards, which is the same thing as
//! pointing SP at the buffer: no such line reaches past offset 63.

mod common;

use std::collections::{BTreeMap, HashMap};

use aarch64_emulator::assembler::encode_line_absolute;
use aarch64_emulator::decoder::decode;
use aarch64_emulator::executor::execute;
use aarch64_emulator::memory::Memory;
use aarch64_emulator::registers::RegisterFile;

use common::{inventory, InventoryLine};

/// The load/store families, whose base register lives in brackets and
/// whose rows carry memory chunks.
const MEMORY: &[&str] = &["ldr", "str", "ldur", "stur", "ldp", "stp", "ldnp", "stnp"];

/// The register-to-register families: the vector immediates and the lane
/// moves. They touch no memory, so no row of theirs names a base.
const MOVES: &[&str] = &["movi", "mvni", "orr", "bic", "fmov", "dup", "ins", "umov", "smov", "mov"];

/// The integer lane families: three-same, two-register misc, across
/// lanes and the SIMD-scalar class of each. Like MOVES they name no
/// base, and unlike MOVES they compute rather than copy, which is what
/// this suite is here to check.
const INTEGER: &[&str] = &[
    "add", "sub", "mul", "mla", "mls", "pmul", "and", "orn", "eor", "bsl", "bit", "bif",
    "cmeq", "cmge", "cmgt", "cmhi", "cmhs", "cmtst", "cmle", "cmlt",
    "sqadd", "uqadd", "sqsub", "uqsub", "suqadd", "usqadd", "sqabs", "sqneg",
    "shadd", "uhadd", "srhadd", "urhadd", "shsub", "uhsub", "sqdmulh", "sqrdmulh",
    "smax", "smin", "umax", "umin", "smaxp", "sminp", "umaxp", "uminp",
    "smaxv", "sminv", "umaxv", "uminv", "addv", "saddlv", "uaddlv", "addp",
    "saddlp", "uaddlp", "sadalp", "uadalp", "sabd", "uabd", "saba", "uaba",
    "neg", "abs", "not", "mvn", "cnt", "rbit", "rev16", "rev32", "rev64", "clz", "cls",
    "urecpe", "ursqrte",
];

/// Whether this suite replays a line. Everything else implemented (the
/// SIMD-scalar SCVTF) is left to `simd.rs` until its own feature lands.
fn is_replayed(line: &InventoryLine) -> bool {
    line.implemented()
        && !line.spelling.contains("_probe")
        && (MEMORY.contains(&line.mnemonic())
            || MOVES.contains(&line.mnemonic())
            || INTEGER.contains(&line.mnemonic()))
}

/// Where the mapped buffer's base sits: page-aligned (so SP-based forms
/// clear the 16-byte SA0 rule), clear of the null-page guard, and with
/// room for the 1 KiB that sits below it.
const BASE: u64 = aarch64_emulator::cpu::DATA_BASE + 0x1000;
const BEFORE: u64 = 1024;
const AFTER: u64 = 65536;

const PC: u64 = 0x0040_0100;

/// The buffer as the harness laid it out: byte `k & 0xff` at offset `k`
/// from the base, for k in -1024..65536.
fn pristine() -> Vec<u8> {
    (0..(BEFORE + AFTER) as usize)
        .map(|i| (i.wrapping_sub(BEFORE as usize) & 0xff) as u8)
        .collect()
}

/// A `v` register's fixture spelling: 32 hex digits, byte 0 first.
fn vector_hex(value: u128) -> String {
    value
        .to_le_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn parse_vector(text: &str) -> u128 {
    assert_eq!(text.len(), 32, "a v register is 32 hex digits: {text}");
    let mut bytes = [0u8; 16];
    for (i, byte) in bytes.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&text[i * 2..i * 2 + 2], 16)
            .unwrap_or_else(|_| panic!("bad v register hex: {text}"));
    }
    u128::from_le_bytes(bytes)
}

fn parse_u64(text: &str) -> u64 {
    u64::from_str_radix(text, 16).unwrap_or_else(|_| panic!("bad 64-bit hex: {text}"))
}

/// `key=value` pairs of one fixture line, in order.
fn fields(rest: &str) -> Vec<(&str, &str)> {
    rest.split_whitespace()
        .filter_map(|field| field.split_once('='))
        .collect()
}

/// The base register a load/store spelling names: the first word inside
/// the address brackets. None for a line with no address at all, which a
/// lane reference (`ins v3.b[15], w7`) also has to answer, since its own
/// brackets hold a lane index rather than a register.
fn base_register(spelling: &str) -> Option<&str> {
    let inside = spelling.split_once(", [")?.1;
    Some(
        inside
            .split(|c: char| c == ',' || c == ']')
            .next()
            .expect("a base register")
            .trim(),
    )
}

/// The input state of one set, and the machine it builds.
struct InputSet {
    name: String,
    regs: Vec<(String, String)>,
}

impl InputSet {
    fn registers(&self) -> RegisterFile {
        let mut regs = RegisterFile::new();
        for (name, value) in &self.regs {
            let idx: u8 = name[1..].parse().expect("a register index");
            match name.as_bytes()[0] {
                b'v' => regs.write_fpr_q(idx, parse_vector(value)),
                b'x' => regs.write_gpr(idx, true, parse_u64(value)),
                _ => panic!("unknown input register `{name}`"),
            }
        }
        regs
    }

    fn vector(&self, index: u8) -> u128 {
        let key = format!("v{index}");
        self.regs
            .iter()
            .find(|(name, _)| *name == key)
            .map(|(_, value)| parse_vector(value))
            .unwrap_or(0)
    }

    fn gpr(&self, index: u8) -> u64 {
        let key = format!("x{index}");
        self.regs
            .iter()
            .find(|(name, _)| *name == key)
            .map(|(_, value)| parse_u64(value))
            .unwrap_or(0)
    }
}

struct Row<'a> {
    index: usize,
    set: &'a str,
    rest: &'a str,
}

fn parse_fixture(text: &str) -> (BTreeMap<String, InputSet>, Vec<Row<'_>>) {
    let mut sets: BTreeMap<String, InputSet> = BTreeMap::new();
    let mut rows: Vec<Row> = Vec::new();
    for line in text.lines() {
        let line = line.trim_end();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("set ") {
            let (name, body) = rest.split_once(' ').expect("a set name and body");
            sets.insert(
                name.to_string(),
                InputSet {
                    name: name.to_string(),
                    regs: fields(body)
                        .into_iter()
                        .map(|(k, v)| (k.to_string(), v.to_string()))
                        .collect(),
                },
            );
            continue;
        }
        let mut parts = line.splitn(3, ' ');
        let index: usize = parts
            .next()
            .expect("an index")
            .parse()
            .unwrap_or_else(|_| panic!("bad row index: {line}"));
        let set = parts.next().expect("a set name");
        rows.push(Row { index, set, rest: parts.next().unwrap_or("") });
    }
    (sets, rows)
}

/// Replay one row. Returns the first disagreement, or None.
fn replay(line: &InventoryLine, set: &InputSet, rest: &str) -> Option<String> {
    let labels: HashMap<String, u64> = HashMap::new();
    let word = match encode_line_absolute(&line.spelling, PC, &labels, 1) {
        Ok(word) => word,
        Err(err) => return Some(format!("did not assemble: {err}")),
    };
    let instr = match decode(word) {
        Ok(instr) => instr,
        Err(err) => return Some(format!("0x{word:08x} did not decode: {err}")),
    };

    let mut regs = set.registers();
    let base_index: Option<u8> = match base_register(&line.spelling) {
        // A register-to-register line has no address, so nothing to point
        // at the buffer and no base to check afterwards.
        None => None,
        Some("sp") => {
            regs.write_sp(BASE);
            None
        }
        Some(base_name) => {
            let idx: u8 = base_name[1..]
                .parse()
                .unwrap_or_else(|_| panic!("odd base register `{base_name}`"));
            regs.write_gpr(idx, true, BASE);
            Some(idx)
        }
    };

    let start = BASE - BEFORE;
    let image = pristine();
    let mut mem = Memory::new();
    mem.write_bytes(start, &image).expect("map the buffer");
    regs.write_pc(PC);
    if let Err(err) = execute(&instr, &mut regs, &mut mem) {
        return Some(format!("execution failed: {err}"));
    }

    // Registers. Anything the row does not name has to be untouched.
    let named = fields(rest);
    let value_of = |key: &str| named.iter().find(|(k, _)| *k == key).map(|(_, v)| *v);
    for index in [0u8, 1, 3, 4, 5, 6, 30, 31] {
        let expected = match value_of(&format!("v{index}")) {
            Some(text) => parse_vector(text),
            None => set.vector(index),
        };
        let actual = regs.read_fpr_q(index);
        if actual != expected {
            return Some(format!(
                "v{index} is {} , csarm says {}",
                vector_hex(actual),
                vector_hex(expected)
            ));
        }
    }
    let expected_x3 = match value_of("x3") {
        Some(text) => parse_u64(text),
        None => set.gpr(3),
    };
    if regs.read_gpr(3, true) != expected_x3 {
        return Some(format!(
            "x3 is {:016x}, csarm says {expected_x3:016x}",
            regs.read_gpr(3, true)
        ));
    }
    if let Some(idx) = base_index {
        let delta = value_of("base").map(parse_u64).unwrap_or(0);
        let expected = BASE.wrapping_add(delta);
        let actual = regs.read_gpr(idx, true);
        if actual != expected {
            return Some(format!(
                "the base register x{idx} moved by {}, csarm says {}",
                actual.wrapping_sub(BASE) as i64,
                delta as i64
            ));
        }
    }

    // Memory. Every chunk the row names holds what csarm wrote; every
    // chunk it does not name is exactly as it was mapped.
    let mut expected = image;
    if let Some(chunks) = value_of("mem") {
        for chunk in chunks.split(',') {
            let (offset, hex) = chunk.split_once(':').expect("offset:hex chunk");
            // Chunk offsets are relative to the base, so the 1 KiB
            // below it carries negative ones.
            let offset: i64 = offset.parse().expect("a chunk offset");
            assert_eq!(hex.len(), 32, "a memory chunk is 16 bytes: {chunk}");
            let at = (BEFORE as i64 + offset) as usize;
            for i in 0..16 {
                expected[at + i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16)
                    .unwrap_or_else(|_| panic!("bad chunk hex: {chunk}"));
            }
        }
    }
    let actual = mem.read_bytes(start, expected.len()).expect("read the buffer");
    if actual != expected {
        let at = actual
            .iter()
            .zip(&expected)
            .position(|(a, b)| a != b)
            .expect("a difference");
        let chunk = (at / 16) * 16;
        let render = |bytes: &[u8]| -> String {
            bytes[chunk..chunk + 16].iter().map(|b| format!("{b:02x}")).collect()
        };
        return Some(format!(
            "the 16 bytes at buffer offset {} are {}, csarm says {}",
            chunk as i64 - BEFORE as i64,
            render(&actual),
            render(&expected)
        ));
    }
    None
}

#[test]
fn every_implemented_line_moves_the_bytes_csarm_moved() {
    let lines = inventory();
    let text = include_str!("simd-behaviour.txt");
    let (sets, rows) = parse_fixture(text);
    assert_eq!(sets.len(), 3, "the capture has three input sets");

    let mut replayed = 0usize;
    let mut skipped = 0usize;
    let mut failures: Vec<String> = Vec::new();

    for row in &rows {
        let line = &lines[row.index];
        if !is_replayed(line) {
            skipped += 1;
            continue;
        }
        replayed += 1;
        let set = sets
            .get(row.set)
            .unwrap_or_else(|| panic!("row {} names an unknown set {}", row.index, row.set));
        if let Some(problem) = replay(line, set, row.rest) {
            failures.push(format!(
                "line {} set {}: `{}`: {problem}",
                row.index, set.name, line.spelling
            ));
        }
    }

    println!("simd behaviour: {replayed} rows replayed, {skipped} rows still queued");
    assert!(
        failures.is_empty(),
        "{} of {replayed} replayed rows disagree with csarm:\n{}",
        failures.len(),
        failures.iter().take(20).cloned().collect::<Vec<_>>().join("\n")
    );
}
