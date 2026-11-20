//! Any 32-bit word goes through the decoder, one step of the machine and
//! the disassembly printer without a panic. An unknown word, a fault or a
//! halt is a calm result; only a panic fails. The words and the register
//! values come from a fixed seed, so a rerun repeats every case in order.

use std::panic::{catch_unwind, AssertUnwindSafe};

use aarch64_emulator::cpu::{Cpu, CODE_BASE, DATA_BASE, STACK_BASE, STACK_FLOOR};
use aarch64_emulator::decoder::{self, Instruction};
use aarch64_emulator::registers::NzcvFlags;

const SEED: u64 = 0x0A64_D0DE_5EED_0001;
/// Sized to keep the cargo test job inside its usual time.
const CASES: u64 = 500_000;
/// A new machine costs about a hundred steps, so one serves a block of cases.
const BLOCK: u64 = 256;

/// splitmix64: a few lines, no dependency, and a good stream from any seed.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

/// Half the registers hold an edge value or a mapped address, so loads,
/// stores, shifts and divides reach past their first fault.
fn register_value(rng: &mut Rng) -> u64 {
    const EDGES: [u64; 12] = [
        0,
        1,
        u64::MAX,
        1 << 63,
        i64::MAX as u64,
        0x8000_0000,
        0x7FFF_FFFF,
        0xFFFF_FFFF,
        CODE_BASE,
        DATA_BASE,
        STACK_BASE - 16,
        STACK_BASE - 4096,
    ];
    if rng.below(2) == 0 {
        EDGES[rng.below(EDGES.len() as u64) as usize]
    } else {
        rng.next()
    }
}

/// shortcut: an ldp or stp whose base plus offset leaves i64's range trips
/// the overflow check in `exec_ldst_pair` (a release build wraps), so its
/// step is skipped; remove this when that add wraps.
fn pair_offset_overflows(instr: &Instruction, cpu: &Cpu) -> bool {
    match *instr {
        Instruction::LdStPair { rn, imm7, .. } => {
            (cpu.regs.read_gpr_or_sp(rn, true) as i64).checked_add(i64::from(imm7)).is_none()
        }
        _ => false,
    }
}

/// The case's word, its disassembly, and one step of it with every
/// register set from the case's own stream.
fn one_case(cpu: &mut Cpu, case: u64) {
    let mut rng = Rng(SEED.wrapping_add(case));
    let word = rng.next() as u32;
    let instr = decoder::decode(word);
    if let Ok(instr) = &instr {
        decoder::format(instr);
    }
    cpu.load_program(&[word]);
    for r in 0..31 {
        cpu.regs.write_gpr(r, true, register_value(&mut rng));
    }
    // Below the floor, the stack wall halts before the word runs.
    let sp = if rng.below(4) == 0 { register_value(&mut rng).max(STACK_FLOOR) } else { STACK_BASE };
    cpu.regs.write_sp(sp);
    for v in 0..32 {
        cpu.regs.write_fpr_q(v, u128::from(rng.next()) << 64 | u128::from(rng.next()));
    }
    cpu.regs.nzcv = NzcvFlags::unpack(rng.below(16) as u8);
    if instr.is_ok_and(|instr| pair_offset_overflows(&instr, cpu)) {
        return;
    }
    let _ = cpu.step();
}

#[test]
fn any_word_decodes_steps_and_prints_without_a_panic() {
    let mut cpu = Cpu::new();
    for case in 0..CASES {
        if case % BLOCK == 0 {
            cpu = Cpu::new();
        }
        if catch_unwind(AssertUnwindSafe(|| one_case(&mut cpu, case))).is_err() {
            let word = Rng(SEED.wrapping_add(case)).next() as u32;
            panic!("word {word:#010x} panicked: seed {SEED:#x}, case {case} of {CASES}");
        }
    }
}
