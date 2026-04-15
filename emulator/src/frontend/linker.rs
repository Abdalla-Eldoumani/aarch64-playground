//! Encoders and pool bookkeeping for the `ldr xN, =...` pseudo-instruction.
//!
//! GAS handles `ldr xN, =SYMBOL` by allocating 8 bytes in a literal pool
//! near the instruction and emitting an `LDR (literal)` that reads them.
//! After all labels are placed, it writes the target address into the pool
//! and back-patches the instruction's imm19. We do the same: allocate a
//! slot while encoding, then walk back through the pool at link time to
//! fill in addresses and fix up offsets.
//!
//! For numeric constants (`ldr xN, =0x1234`) that fit in at most two
//! MOVZ/MOVK halfwords, we bypass the pool entirely and emit the chain.
//! Anything larger falls back to the pool.

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

/// Encode `ldr xN, =VALUE` (or wN) using MOVZ/MOVK. Returns `None` when
/// the value needs more than two non-zero 16-bit halfwords, signalling
/// that the literal pool should be used instead.
pub fn try_movz_movk_chain(value: u64, sf: bool, rt: u8) -> Option<Vec<u32>> {
    if rt > 31 {
        return None;
    }
    let halfs: u8 = if sf { 4 } else { 2 };
    if !sf && (value >> 32) != 0 {
        // Value doesn't fit in 32 bits; W-register encoding can't reach.
        return None;
    }
    let mut slots: Vec<(u8, u16)> = Vec::new();
    for i in 0..halfs {
        let shift = i * 16;
        let hw = ((value >> shift) & 0xFFFF) as u16;
        if hw != 0 {
            slots.push((shift, hw));
        }
    }
    if slots.is_empty() {
        // Zero value: one MOVZ with imm16=0 at shift 0.
        return Some(vec![encode_movz(sf, rt, 0, 0)]);
    }
    if slots.len() > 2 {
        return None;
    }
    let mut out = Vec::with_capacity(slots.len());
    let (first_shift, first_hw) = slots[0];
    out.push(encode_movz(sf, rt, first_hw, first_shift));
    for &(shift, hw) in &slots[1..] {
        out.push(encode_movk(sf, rt, hw, shift));
    }
    Some(out)
}

/// 8-byte literal pool appended after the last `.text` instruction. Each
/// entry holds the 64-bit target value; the linker fills them in once
/// every label address is known.
#[derive(Debug, Clone, Default)]
pub struct LiteralPool {
    pub entries: Vec<LiteralEntry>,
}

/// A single pool slot: the value to place there (when resolved) and the
/// byte offset inside the pool. The linker back-patches the emitting LDR
/// instruction using the slot's final PC address.
#[derive(Debug, Clone)]
pub struct LiteralEntry {
    pub value: u64,
    pub byte_offset: u64,
}

impl LiteralPool {
    pub fn new() -> Self {
        LiteralPool::default()
    }

    /// Reserve an 8-byte slot holding `value`. Returns the slot's byte
    /// offset inside the pool (0, 8, 16, ...).
    pub fn push(&mut self, value: u64) -> u64 {
        let offset = self.entries.len() as u64 * 8;
        self.entries.push(LiteralEntry {
            value,
            byte_offset: offset,
        });
        offset
    }

    /// Size of the pool in bytes.
    pub fn byte_len(&self) -> u64 {
        self.entries.len() as u64 * 8
    }

    /// Emit the pool as a little-endian byte stream, matching the memory
    /// layout the emulator expects at the pool's base address.
    pub fn emit_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.entries.len() * 8);
        for entry in &self.entries {
            out.extend_from_slice(&entry.value.to_le_bytes());
        }
        out
    }
}

/// Back-patch an `LDR (literal)` instruction word with a new byte offset
/// (from the instruction's PC to its target). Used when the pool's final
/// address is known and we need to rewrite the placeholder offset the
/// encoder initially emitted.
pub fn patch_ldr_literal(word: u32, offset_bytes: i64) -> Result<u32, EmuError> {
    if offset_bytes % 4 != 0 {
        return Err(err(format!(
            "ldr literal patch offset {offset_bytes} not multiple of 4"
        )));
    }
    let imm19 = offset_bytes / 4;
    if !(-(1 << 18)..(1 << 18)).contains(&imm19) {
        return Err(err(format!(
            "ldr literal patch offset {offset_bytes} out of range"
        )));
    }
    let imm19_bits = (imm19 as u32) & 0x7_FFFF;
    // Clear bits 23:5 then write the new imm19.
    Ok((word & !(0x7_FFFF << 5)) | (imm19_bits << 5))
}

fn encode_movz(sf: bool, rt: u8, imm16: u16, shift_bits: u8) -> u32 {
    let sf_bit = if sf { 1u32 << 31 } else { 0 };
    let hw = (shift_bits / 16) as u32;
    sf_bit | 0x5280_0000 | (hw << 21) | ((imm16 as u32) << 5) | (rt as u32 & 0x1F)
}

fn encode_movk(sf: bool, rt: u8, imm16: u16, shift_bits: u8) -> u32 {
    let sf_bit = if sf { 1u32 << 31 } else { 0 };
    let hw = (shift_bits / 16) as u32;
    sf_bit | 0x7280_0000 | (hw << 21) | ((imm16 as u32) << 5) | (rt as u32 & 0x1F)
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
    fn movz_chain_for_small_constant() {
        // 42 fits in one halfword.
        let out = try_movz_movk_chain(42, true, 0).unwrap();
        assert_eq!(out.len(), 1);
        // MOVZ X0, #42: 0xD2800540 = 1101 0010 1000 0000 0000 0101 0100 0000
        assert_eq!(out[0], 0xD2800540);
    }

    #[test]
    fn movz_chain_for_zero() {
        // Zero still yields one MOVZ.
        let out = try_movz_movk_chain(0, true, 0).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0], 0xD2800000);
    }

    #[test]
    fn movz_chain_for_shifted_halfword() {
        // 0x10000000 = 0x1000 << 16: MOVZ X0, #0x1000, LSL #16.
        let out = try_movz_movk_chain(0x1000_0000, true, 0).unwrap();
        assert_eq!(out.len(), 1);
        // bit 31=1 (X), opc=10, hw=01 (shift 16)
        // 0xD2A20000 = 1101 0010 1010 0010 0000 0000 0000 0000
        assert_eq!(out[0], 0xD2A20000);
    }

    #[test]
    fn movz_movk_chain_for_two_halfwords() {
        // 0xDEAD_BEEF = BEEF at shift 0, DEAD at shift 16.
        let out = try_movz_movk_chain(0xDEAD_BEEF, true, 0).unwrap();
        assert_eq!(out.len(), 2);
        // First: MOVZ X0, #0xBEEF -> 0xD297DDE0
        assert_eq!(out[0], 0xD297DDE0);
        // Second: MOVK X0, #0xDEAD, LSL #16 -> 0xF2BBD5A0
        assert_eq!(out[1], 0xF2BBD5A0);
    }

    #[test]
    fn movz_chain_rejects_three_halfwords() {
        // 0x0001_0001_0001 has three non-zero halfwords.
        assert!(try_movz_movk_chain(0x0001_0001_0001, true, 0).is_none());
    }

    #[test]
    fn movz_chain_w_register_rejects_value_above_32_bits() {
        assert!(try_movz_movk_chain(0x1_0000_0000, false, 0).is_none());
    }

    #[test]
    fn literal_pool_entries_lay_out_at_eight_byte_strides() {
        let mut pool = LiteralPool::new();
        assert_eq!(pool.push(0xDEAD), 0);
        assert_eq!(pool.push(0xBEEF), 8);
        assert_eq!(pool.push(0xCAFE), 16);
        assert_eq!(pool.byte_len(), 24);
    }

    #[test]
    fn literal_pool_emits_little_endian_bytes() {
        let mut pool = LiteralPool::new();
        pool.push(0x0123_4567_89AB_CDEF);
        let bytes = pool.emit_bytes();
        assert_eq!(
            bytes,
            vec![0xEF, 0xCD, 0xAB, 0x89, 0x67, 0x45, 0x23, 0x01]
        );
    }

    #[test]
    fn patch_replaces_imm19_without_touching_other_fields() {
        let before = encode_ldr_literal(true, 3, 0).unwrap();
        let after = patch_ldr_literal(before, 32).unwrap();
        // Re-encode and confirm equality.
        let expected = encode_ldr_literal(true, 3, 32).unwrap();
        assert_eq!(after, expected);
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
