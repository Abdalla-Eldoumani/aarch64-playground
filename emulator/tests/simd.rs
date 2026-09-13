//! The Advanced SIMD encoding conformance gate.
//!
//! `tests/simd-inventory.txt` holds every SIMD form GNU as 2.46.1 accepts
//! on csarm with the word it produced, captured from an objdump of the
//! probe rather than derived from the manual. This suite replays it in
//! both directions: a line whose mnemonic this crate implements must
//! assemble to exactly that word, decode, and print back as GAS prints
//! it; a line whose mnemonic is still queued (`common::NOT_YET`) must be
//! REJECTED, so the queue cannot quietly rot into a list of things that
//! half-work.

mod common;

use std::collections::HashMap;

use aarch64_emulator::assembler::encode_line_absolute;
use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::decoder::{decode, format, Instruction};
use aarch64_emulator::frontend::pipeline::assemble_hosted;

use common::{inventory, InventoryLine};

/// A pc well inside `.text`. No line in the inventory is pc-relative, so
/// the value only has to be a plausible instruction address.
const PC: u64 = 0x0040_0100;

/// The three literal-load lines (`ldr s3, _probe`). GAS encodes them as
/// one LDR (literal); the hosted linker cannot, because `.data` sits past
/// imm19's reach, so it lowers each to two words. They are checked
/// through the pipeline by `literal_loads_lower_to_two_words` instead of
/// against their inventory word.
fn is_literal_load(line: &InventoryLine) -> bool {
    line.spelling.contains("_probe")
}

#[test]
fn every_implemented_form_assembles_decodes_and_prints_back() {
    let labels: HashMap<String, u64> = HashMap::new();
    let lines = inventory();
    let mut implemented = 0usize;
    let mut queued = 0usize;
    let mut literal = 0usize;
    let mut failures: Vec<String> = Vec::new();

    for line in &lines {
        if !line.implemented() {
            queued += 1;
            if let Ok(word) = encode_line_absolute(&line.spelling, PC, &labels, 1) {
                failures.push(format!(
                    "`{}` is on the queued list but assembled to 0x{word:08x}: \
                     take its mnemonic off NOT_YET",
                    line.spelling
                ));
            }
            continue;
        }
        if is_literal_load(line) {
            literal += 1;
            continue;
        }
        implemented += 1;

        match encode_line_absolute(&line.spelling, PC, &labels, 1) {
            Ok(word) if word == line.word => {}
            Ok(word) => failures.push(format!(
                "`{}` assembled to 0x{word:08x}, csarm says 0x{:08x}",
                line.spelling, line.word
            )),
            Err(err) => failures.push(format!("`{}` was rejected: {err}", line.spelling)),
        }

        let instr = match decode(line.word) {
            Ok(instr) => instr,
            Err(err) => {
                failures.push(format!(
                    "0x{:08x} (`{}`) did not decode: {err}",
                    line.word, line.spelling
                ));
                continue;
            }
        };
        match format(&instr) {
            Some(text) if text == line.printed => {}
            Some(text) => failures.push(format!(
                "0x{:08x} printed as `{text}`, objdump prints `{}`",
                line.word, line.printed
            )),
            None => failures.push(format!(
                "0x{:08x} (`{}`) decoded to {instr:?} but has no printed form",
                line.word, line.spelling
            )),
        }
    }

    println!(
        "simd inventory: {implemented} implemented, {queued} queued, \
         {literal} literal-load (checked through the pipeline), \
         {} total",
        lines.len()
    );
    assert!(
        failures.is_empty(),
        "{} of {} inventory lines disagree with csarm:\n{}",
        failures.len(),
        lines.len(),
        failures.join("\n")
    );
}

/// `ldr s3, _probe` is a real GAS LDR (literal), but the hosted linker
/// puts `.data` 2-3 MiB from `.text`, past imm19's reach, so it lowers
/// the line to an address load from the literal pool plus an ordinary
/// load through it. The SIMD&FP widths borrow x16, the same scratch the
/// libc trampolines claim.
#[test]
fn literal_loads_lower_to_two_words() {
    let labels: HashMap<String, u64> = HashMap::new();
    for line in inventory().iter().filter(|l| is_literal_load(l)) {
        let reg = line
            .spelling
            .split_whitespace()
            .nth(1)
            .expect("a destination")
            .trim_end_matches(',');
        let source = format!(
            "        .data\n\
             _probe: .word 0\n\
             \n\
                     .text\n\
                     .global main\n\
             main:\n\
                     ldr {reg}, _probe\n\
                     ret\n"
        );
        let mut cpu = Cpu::new();
        let image = assemble_hosted(&source, &cpu.host)
            .unwrap_or_else(|err| panic!("`{}` did not assemble: {err}", line.spelling));
        let entry = image.entry_point;
        cpu.load_linked_image(&image).expect("load");

        let word1 = cpu.mem.read_u32(entry).expect("first word");
        let word2 = cpu.mem.read_u32(entry + 4).expect("second word");
        assert!(
            matches!(decode(word1), Ok(Instruction::LdrLiteral { sf: true, rt: 16, .. })),
            "`{}` lowered its first word to {:?}, expected an x16 literal load",
            line.spelling,
            decode(word1)
        );
        let expected = encode_line_absolute(&format!("ldr {reg}, [x16]"), entry + 4, &labels, 1)
            .expect("the second word re-assembles");
        assert_eq!(
            word2, expected,
            "`{}` lowered its second word to 0x{word2:08x}, expected `ldr {reg}, [x16]` \
             (0x{expected:08x})",
            line.spelling
        );
    }
}

/// The queued list is a list of mnemonics, so a name on it that the
/// inventory never carries is dead weight nobody would notice.
#[test]
fn every_queued_mnemonic_is_one_the_inventory_carries() {
    let lines = inventory();
    let unused: Vec<&&str> = common::NOT_YET
        .iter()
        .filter(|name| !lines.iter().any(|line| line.mnemonic() == **name))
        .collect();
    assert!(unused.is_empty(), "NOT_YET names nothing in the inventory: {unused:?}");
}
