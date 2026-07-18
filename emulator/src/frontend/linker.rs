//! Encoder for the `ldr xN, =...` pseudo-instruction.
//!
//! GAS handles `ldr xN, =SYMBOL` by allocating 8 bytes in a literal pool
//! near the instruction and emitting an `LDR (literal)` that reads them.
//! After all labels are placed, it writes the target address into the pool
//! and back-patches the instruction's imm19. The hosted pipeline builds that
//! pool inline (see `pipeline.rs`); this module supplies the instruction
//! encoder it uses.

use crate::errors::EmuError;

/// Encode an LDR (literal) instruction.
///
/// `sf` selects Xt (true) or Wt (false). `offset_bytes` is the signed byte
/// offset from this instruction's PC to the literal. It must be a multiple
/// of 4 and fit in a 19-bit signed field scaled by 4 (roughly plus or minus
/// 1 MiB of reach).
pub fn encode_ldr_literal(sf: bool, rt: u8, offset_bytes: i64) -> Result<u32, EmuError> {
    if rt > 31 {
        return Err(err(format!("invalid register x{rt}")));
    }
    if offset_bytes % 4 != 0 {
        return Err(err(format!(
            "ldr literal offset {offset_bytes} is not a multiple of 4"
        )));
    }
    let imm19 = offset_bytes / 4;
    if !(-(1 << 18)..(1 << 18)).contains(&imm19) {
        return Err(err(format!(
            "ldr literal offset {offset_bytes} out of range for imm19"
        )));
    }
    let imm19_bits = (imm19 as u32) & 0x7_FFFF;
    let sf_bit = if sf { 1u32 << 30 } else { 0 };
    Ok(0x1800_0000 | sf_bit | (imm19_bits << 5) | (rt as u32 & 0x1F))
}

fn err(message: String) -> EmuError {
    EmuError::LinkError { line: 0, message }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::decoder::{decode, Instruction};

    #[test]
    fn encode_ldr_literal_x_positive_offset() {
        // LDR X0, pc+16 -> imm19 = 4 (instruction units).
        let word = encode_ldr_literal(true, 0, 16).unwrap();
        assert_eq!(word, 0x58000080);
    }

    #[test]
    fn encode_ldr_literal_w_register_zero_offset() {
        // LDR W1, pc+0 -> imm19 = 0, rt = 1, W form.
        let word = encode_ldr_literal(false, 1, 0).unwrap();
        assert_eq!(word, 0x18000001);
    }

    #[test]
    fn encode_ldr_literal_negative_offset() {
        // LDR X1, pc-4 -> imm19 = -1. Sign-extends to 0x7FFFF in 19 bits.
        let word = encode_ldr_literal(true, 1, -4).unwrap();
        assert_eq!(word, 0x58FFFFE1);
    }

    #[test]
    fn encode_ldr_literal_rejects_unaligned_offset() {
        assert!(encode_ldr_literal(true, 0, 2).is_err());
    }

    #[test]
    fn encode_ldr_literal_rejects_out_of_range() {
        // imm19 signed range is +/-2^18 instruction units = +/-1 MiB bytes.
        assert!(encode_ldr_literal(true, 0, 1 << 20).is_err());
    }

    #[test]
    fn roundtrip_encoded_ldr_literal_decodes_to_same_values() {
        let word = encode_ldr_literal(true, 5, 40).unwrap();
        match decode(word).unwrap() {
            Instruction::LdrLiteral { sf, rt, offset } => {
                assert!(sf);
                assert_eq!(rt, 5);
                assert_eq!(offset, 40);
            }
            other => panic!("expected LdrLiteral, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_negative_offset() {
        let word = encode_ldr_literal(true, 0, -8).unwrap();
        match decode(word).unwrap() {
            Instruction::LdrLiteral { sf, rt, offset } => {
                assert!(sf);
                assert_eq!(rt, 0);
                assert_eq!(offset, -8);
            }
            other => panic!("expected LdrLiteral, got {other:?}"),
        }
    }

    #[test]
    fn ldr_literal_runs_end_to_end() {
        use crate::cpu::{Cpu, CODE_BASE};
        // Place the target value right after a halt, and have the first
        // instruction LDR X7 from that location. Layout:
        //   pc+0  ldr x7, pc+8
        //   pc+4  svc #0 (halt)
        //   pc+8  lo32 of 0xDEAD_BEEF_CAFE_BABE
        //   pc+12 hi32 of 0xDEAD_BEEF_CAFE_BABE
        let mut cpu = Cpu::new();
        let ldr = encode_ldr_literal(true, 7, 8).unwrap();
        let svc = 0xD4000001_u32;
        cpu.mem.write_u32(CODE_BASE, ldr).unwrap();
        cpu.mem.write_u32(CODE_BASE + 4, svc).unwrap();
        cpu.mem
            .write_u64(CODE_BASE + 8, 0xDEAD_BEEF_CAFE_BABE)
            .unwrap();
        cpu.step().unwrap();
        assert_eq!(cpu.regs.read_gpr(7, true), 0xDEAD_BEEF_CAFE_BABE);
    }

    #[test]
    fn ldr_literal_w_register_truncates_to_32_bits() {
        use crate::cpu::{Cpu, CODE_BASE};
        let mut cpu = Cpu::new();
        let ldr = encode_ldr_literal(false, 3, 4).unwrap();
        cpu.mem.write_u32(CODE_BASE, ldr).unwrap();
        cpu.mem.write_u32(CODE_BASE + 4, 0xBAADF00D).unwrap();
        cpu.step().unwrap();
        assert_eq!(cpu.regs.read_gpr(3, true), 0xBAADF00D);
    }
}
