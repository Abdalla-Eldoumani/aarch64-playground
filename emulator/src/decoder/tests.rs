//! Unit tests for the decoder, grouped by instruction class.

// Binary literals here group digits by instruction field (sf/opcode/imm/rn/rd)
// rather than by nibble, and zero-valued fields stay written out. Both
// are deliberate, so the encodings read like the architecture manual.
#![allow(clippy::unusual_byte_groupings, clippy::identity_op)]
use super::*;

// -- bitmask immediate tests --

#[test]
fn bitmask_7_ones_in_8bit_element() {
    // element size 8 requires len=3: NOT(imms) must have bit 3 as highest.
    // imms=0b110110 -> NOT=0b001001 -> highest bit=3 -> len=3 -> esize=8
    // s = imms & 0b111 = 6 -> 7 ones = 0x7F, replicated
    let val = decode_bitmask_imm(false, 0, 0b110110, true).unwrap();
    assert_eq!(val, 0x7F7F_7F7F_7F7F_7F7F);
}

#[test]
fn bitmask_alternating_bits() {
    // 0x5555... = alternating 01 pattern. Element size 2, 1 one, rotated by 0.
    // Element size 2 needs len=1, so NOT(imms) must top out at bit 1:
    // imms = 0b111100 -> NOT = 0b000011 -> len=1 -> esize=2.
    // s = imms & 1 = 0 -> 1 one, r = immr & 1
    // With immr=0: element = 0b01, replicated = 0x5555...
    let val = decode_bitmask_imm(false, 0, 0b111100, true).unwrap();
    assert_eq!(val, 0x5555_5555_5555_5555);
}

#[test]
fn bitmask_64bit_lower_32() {
    // N=1, immr=0, imms=31 (0b011111) -> 64-bit element, 32 ones, no rotation
    // = 0x00000000_FFFFFFFF
    let val = decode_bitmask_imm(true, 0, 31, true).unwrap();
    assert_eq!(val, 0x0000_0000_FFFF_FFFF);
}

#[test]
fn bitmask_rotated() {
    // N=1, immr=4, imms=7 -> 64-bit element, 8 ones rotated right by 4
    // 8 ones = 0xFF, ROR 4 = 0xF000_0000_0000_000F
    let val = decode_bitmask_imm(true, 4, 7, true).unwrap();
    assert_eq!(val, 0xF000_0000_0000_000F);
}

#[test]
fn bitmask_32bit_mode() {
    // sf=false, N must be 0
    // N=0, immr=0, imms=0b001111 -> element=32 (len=5 since NOT(001111)=110000, highest=5)
    // s = imms & 0x1F = 15, r = immr & 0x1F = 0
    // 16 ones = 0x0000FFFF, no rotation
    let val = decode_bitmask_imm(false, 0, 0b001111, false).unwrap();
    assert_eq!(val, 0x0000_FFFF);
}

#[test]
fn bitmask_n1_sf_false_rejected() {
    // N=1 with 32-bit register is invalid
    assert!(decode_bitmask_imm(true, 0, 0, false).is_err());
}

#[test]
fn bitmask_encode_decode_round_trips_rotated_values() {
    // A single-bit immediate like `#2` needs a rotation; the encoder
    // must produce an (immr, imms) the decoder reads back to the same
    // value. Pins the rotate-direction fix.
    for &(value, sf) in &[
        (2u64, false),
        (2u64, true),
        (0x8000_0000u64, false),
        (0xF000_0000_0000_000Fu64, true),
        (0x0000_0000_FFFF_0000u64, true),
        (4u64, false),
        (0x40u64, true),
    ] {
        let (n, immr, imms) = encode_bitmask_imm(value, sf)
            .unwrap_or_else(|| panic!("{value:#x} should encode (sf={sf})"));
        let decoded = decode_bitmask_imm(n, immr, imms, sf).unwrap();
        let expected = if sf { value } else { value & 0xFFFF_FFFF };
        assert_eq!(decoded, expected, "round-trip {value:#x} sf={sf}");
    }
}

// -- MOV/MOVZ/MOVK tests --

#[test]
fn decode_movz_x0_42() {
    // MOVZ X0, #42 = 0xD280_0540
    // 1_10_100101_00_0000000000101010_00000
    let instr = 0xD280_0540;
    let decoded = decode(instr).unwrap();
    assert_eq!(
        decoded,
        Instruction::MoveWide {
            op: MoveWideOp::Movz,
            sf: true,
            rd: 0,
            imm16: 42,
            hw: 0,
        }
    );
}

#[test]
fn decode_movk_x1_hw1() {
    // MOVK X1, #0xABCD, LSL #16
    // 1_11_100101_01_1010101111001101_00001
    let instr = 0xF2A0_0001 | (0xABCD << 5);
    let decoded = decode(instr).unwrap();
    match decoded {
        Instruction::MoveWide { op, sf, rd, imm16, hw } => {
            assert_eq!(op, MoveWideOp::Movk);
            assert!(sf);
            assert_eq!(rd, 1);
            assert_eq!(imm16, 0xABCD);
            assert_eq!(hw, 1);
        }
        _ => panic!("expected MoveWide"),
    }
}

// -- ADD/SUB immediate tests --

#[test]
fn decode_add_x0_x1_42() {
    // ADD X0, X1, #42
    // 1_0_0_10001_00_000000101010_00001_00000
    let instr: u32 = 0b1_0_0_10001_00_000000101010_00001_00000;
    let decoded = decode(instr).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpImm {
            op: DpOp::Add,
            sf: true,
            rd: 0,
            rn: 1,
            imm: 42,
            shift: 0,
        }
    );
}

#[test]
fn decode_subs_w3_w4_100() {
    // SUBS W3, W4, #100
    // 0_1_1_10001_00_000001100100_00100_00011
    let instr: u32 = 0b0_1_1_10001_00_000001100100_00100_00011;
    let decoded = decode(instr).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpImm {
            op: DpOp::Subs,
            sf: false,
            rd: 3,
            rn: 4,
            imm: 100,
            shift: 0,
        }
    );
}

// -- add/sub register tests --

#[test]
fn decode_add_x0_x1_x2() {
    // ADD X0, X1, X2
    // 1_0_0_01011_00_0_00010_000000_00001_00000
    let instr: u32 = 0b1_0_0_01011_00_0_00010_000000_00001_00000;
    let decoded = decode(instr).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpReg {
            op: DpOp::Add,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 2,
            shift: ShiftType::LSL,
            amount: 0,
        }
    );
}

// -- branch tests --

#[test]
fn decode_b_forward() {
    // B #8 -> offset 8 bytes = 2 instructions
    // 0_00101_00000000000000000000000010
    let instr: u32 = 0b0_00101_00000000000000000000000010;
    let decoded = decode(instr).unwrap();
    assert_eq!(decoded, Instruction::BrImm { link: false, offset: 8 });
}

#[test]
fn decode_bl() {
    // BL #-4 -> offset -4 bytes
    // 1_00101_11111111111111111111111111
    let instr: u32 = 0b1_00101_11111111111111111111111111;
    let decoded = decode(instr).unwrap();
    assert_eq!(decoded, Instruction::BrImm { link: true, offset: -4 });
}

#[test]
fn decode_br_x30() {
    // BR X30 = 0xD61F_03C0
    let instr = 0xD61F_03C0;
    let decoded = decode(instr).unwrap();
    assert_eq!(decoded, Instruction::BrReg { op: BrRegOp::Br, rn: 30 });
}

#[test]
fn decode_ret() {
    // RET (X30) = 0xD65F_03C0
    let instr = 0xD65F_03C0;
    let decoded = decode(instr).unwrap();
    assert_eq!(decoded, Instruction::BrReg { op: BrRegOp::Ret, rn: 30 });
}

#[test]
fn decode_b_eq() {
    // B.EQ #8
    // 0101_0100 0000_0000 0000_0000 0100_0000
    let instr: u32 = 0x5400_0040;
    let decoded = decode(instr).unwrap();
    assert_eq!(
        decoded,
        Instruction::BCond {
            cond: Condition::EQ,
            offset: 8,
        }
    );
}

// -- load/store tests --

#[test]
fn decode_str_x0_sp_offset() {
    // STR X0, [SP, #8] (unsigned offset)
    // 11_111_0_01_00_000000000010_11111_00000
    let instr: u32 = 0xF900_07E0;
    let decoded = decode(instr).unwrap();
    match decoded {
        Instruction::LdSt { op, rt, rn, offset, size, mode } => {
            assert_eq!(op, LdStOp::Str);
            assert_eq!(rt, 0);
            assert_eq!(rn, 31); // SP
            assert_eq!(size, MemSize::X);
            assert_eq!(mode, IndexMode::SignedOffset);
            if let LdStOffset::Immediate(off) = offset {
                assert_eq!(off, 8);
            } else {
                panic!("expected immediate offset");
            }
        }
        _ => panic!("expected LdSt"),
    }
}

#[test]
fn decode_ldr_x1_x2_pre_index() {
    // LDR X1, [X2, #16]! (pre-index)
    // 11_111_0_00_01_0_000010000_11_00010_00001
    let instr: u32 = 0xF841_0C41;
    let decoded = decode(instr).unwrap();
    match decoded {
        Instruction::LdSt { op, rt, rn, offset, size, mode } => {
            assert_eq!(op, LdStOp::Ldr);
            assert_eq!(rt, 1);
            assert_eq!(rn, 2);
            assert_eq!(size, MemSize::X);
            assert_eq!(mode, IndexMode::PreIndex);
            if let LdStOffset::Immediate(off) = offset {
                assert_eq!(off, 16);
            } else {
                panic!("expected immediate offset");
            }
        }
        _ => panic!("expected LdSt"),
    }
}

#[test]
fn decode_stp_x0_x1_sp_pre() {
    // STP X0, X1, [SP, #-16]! (pre-index)
    // 10_101_0_011_1111110_00001_11111_00000
    let instr: u32 = 0xA9BF_07E0;
    let decoded = decode(instr).unwrap();
    match decoded {
        Instruction::LdStPair { op, sf, rt, rt2, rn, imm7, mode } => {
            assert_eq!(op, LdStPairOp::Stp);
            assert!(sf);
            assert_eq!(rt, 0);
            assert_eq!(rt2, 1);
            assert_eq!(rn, 31);
            assert_eq!(imm7, -16);
            assert_eq!(mode, IndexMode::PreIndex);
        }
        _ => panic!("expected LdStPair, got {:?}", decoded),
    }
}

// -- NOP and SVC --

#[test]
fn decode_nop() {
    assert_eq!(decode(0xD503_201F).unwrap(), Instruction::Nop);
}

#[test]
fn decode_svc_0() {
    let instr = 0xD400_0001;
    assert_eq!(decode(instr).unwrap(), Instruction::Svc { imm16: 0 });
}

// -- unknown instruction --

#[test]
fn decode_unknown() {
    assert!(decode(0x0000_0000).is_err());
}

// -- extended-register addressing --

/// Build the instruction word for LDR Xt, [Xn, Rm, option shift].
/// `option` is the 3-bit encoding (010=UXTW, 011=LSL, 110=SXTW, 111=SXTX).
/// `s` is 1 when a shift is applied, 0 otherwise.
fn build_ldr_x_extended(rt: u8, rn: u8, rm: u8, option: u8, s: u8) -> u32 {
    // size=11 (X), V=0, opc=01 (LDR), top nibble 0xF8, idx_type=10, imm9=0.
    let base: u32 = 0xF860_0800;
    base | ((rm as u32 & 0x1F) << 16)
        | ((option as u32 & 0x7) << 13)
        | ((s as u32 & 0x1) << 12)
        | ((rn as u32 & 0x1F) << 5)
        | (rt as u32 & 0x1F)
}

#[test]
fn decode_ldr_extended_uxtw_no_shift() {
    let word = build_ldr_x_extended(0, 1, 2, 0b010, 0);
    match decode(word).unwrap() {
        Instruction::LdSt { offset: LdStOffset::Register { rm, extend, shift_amount }, .. } => {
            assert_eq!(rm, 2);
            assert_eq!(extend, ExtendType::Uxtw);
            assert_eq!(shift_amount, None);
        }
        other => panic!("unexpected: {other:?}"),
    }
}

#[test]
fn decode_ldr_extended_sxtw_with_shift_3() {
    // For MemSize::X, S=1 gives shift 3 (scaled by 8 bytes).
    let word = build_ldr_x_extended(0, 1, 2, 0b110, 1);
    match decode(word).unwrap() {
        Instruction::LdSt { offset: LdStOffset::Register { rm, extend, shift_amount }, .. } => {
            assert_eq!(rm, 2);
            assert_eq!(extend, ExtendType::Sxtw);
            assert_eq!(shift_amount, Some(3));
        }
        other => panic!("unexpected: {other:?}"),
    }
}

#[test]
fn decode_ldr_extended_lsl_and_sxtx() {
    let lsl = build_ldr_x_extended(0, 1, 2, 0b011, 1);
    let sxtx = build_ldr_x_extended(0, 1, 2, 0b111, 1);
    let matches = |w: u32, expected: ExtendType| match decode(w).unwrap() {
        Instruction::LdSt { offset: LdStOffset::Register { extend, .. }, .. } => {
            extend == expected
        }
        _ => false,
    };
    assert!(matches(lsl, ExtendType::Lsl));
    assert!(matches(sxtx, ExtendType::Sxtx));
}

#[test]
fn decode_ldr_reserved_option_errors() {
    // option = 000 (UXTB) is not valid for indexed addressing.
    let bad = build_ldr_x_extended(0, 1, 2, 0b000, 0);
    assert!(decode(bad).is_err());
}

// -- compare-and-branch, test-bit-and-branch --

fn build_cbz(sf: bool, nonzero: bool, rt: u8, offset_bytes: i64) -> u32 {
    let sf_bit = if sf { 1u32 << 31 } else { 0 };
    let op_bit = if nonzero { 1u32 << 24 } else { 0 };
    let imm19 = ((offset_bytes / 4) as u32) & 0x7_FFFF;
    0x3400_0000 | sf_bit | op_bit | (imm19 << 5) | (rt as u32 & 0x1F)
}

fn build_tbz(nonzero: bool, bit_pos: u8, rt: u8, offset_bytes: i64) -> u32 {
    let b5 = (bit_pos >> 5) as u32;
    let b40 = (bit_pos & 0x1F) as u32;
    let op_bit = if nonzero { 1u32 << 24 } else { 0 };
    let imm14 = ((offset_bytes / 4) as u32) & 0x3FFF;
    0x3600_0000 | (b5 << 31) | op_bit | (b40 << 19) | (imm14 << 5) | (rt as u32 & 0x1F)
}

#[test]
fn decode_cbz_w() {
    let word = build_cbz(false, false, 3, 16);
    match decode(word).unwrap() {
        Instruction::CompareBranch { sf, rt, nonzero, offset } => {
            assert!(!sf);
            assert_eq!(rt, 3);
            assert!(!nonzero);
            assert_eq!(offset, 16);
        }
        other => panic!("unexpected: {other:?}"),
    }
}

#[test]
fn decode_cbnz_x_negative_offset() {
    let word = build_cbz(true, true, 5, -8);
    match decode(word).unwrap() {
        Instruction::CompareBranch { sf, rt, nonzero, offset } => {
            assert!(sf);
            assert_eq!(rt, 5);
            assert!(nonzero);
            assert_eq!(offset, -8);
        }
        other => panic!("unexpected: {other:?}"),
    }
}

#[test]
fn decode_tbz_bit_zero() {
    let word = build_tbz(false, 0, 7, 12);
    match decode(word).unwrap() {
        Instruction::TestBranch { rt, bit_pos, nonzero, offset } => {
            assert_eq!(rt, 7);
            assert_eq!(bit_pos, 0);
            assert!(!nonzero);
            assert_eq!(offset, 12);
        }
        other => panic!("unexpected: {other:?}"),
    }
}

#[test]
fn decode_tbnz_high_bit() {
    let word = build_tbz(true, 63, 2, -4);
    match decode(word).unwrap() {
        Instruction::TestBranch { rt, bit_pos, nonzero, offset } => {
            assert_eq!(rt, 2);
            assert_eq!(bit_pos, 63);
            assert!(nonzero);
            assert_eq!(offset, -4);
        }
        other => panic!("unexpected: {other:?}"),
    }
}

// -- bitfield extract-and-extend (sxt*/uxt*) --

#[test]
fn decode_sxtb_x_is_sbfm() {
    // SXTB Xd, Wn = SBFM Xd, Xn, #0, #7: sf=1, opc=00, N=1, immr=0, imms=7.
    let word: u32 = (1 << 31) | (0b00 << 29) | (0b100110 << 23) | (1 << 22) | (7 << 10) | (1 << 5);
    match decode(word).unwrap() {
        Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
            assert_eq!(op, BitfieldOp::Sbfm);
            assert!(sf);
            assert_eq!(rd, 0);
            assert_eq!(rn, 1);
            assert_eq!(immr, 0);
            assert_eq!(imms, 7);
        }
        other => panic!("expected Bitfield, got {other:?}"),
    }
}

#[test]
fn ldrs_register_offset_decodes_as_a_sign_extending_load() {
    // 0x38E26820 = ldrsb w0, [x1, x2]; keying the family on bit 22
    // alone misread it as a plain STR. 0xB8A27823 = ldrsw x3,
    // [x1, x2, lsl #2].
    match decode(0x38E2_6820).unwrap() {
        Instruction::LdrSignExtended { rt, rn, size, sf, offset, .. } => {
            assert_eq!(rt, 0);
            assert_eq!(rn, 1);
            assert_eq!(size, MemSize::B);
            assert!(!sf);
            assert!(matches!(offset, LdStOffset::Register { rm: 2, .. }));
        }
        other => panic!("expected LdrSignExtended, got {other:?}"),
    }
    match decode(0xB8A2_7823).unwrap() {
        Instruction::LdrSignExtended { rt, size, sf, .. } => {
            assert_eq!(rt, 3);
            assert_eq!(size, MemSize::W);
            assert!(sf);
        }
        other => panic!("expected LdrSignExtended, got {other:?}"),
    }
    // The writeback forms take the same arm rather than falling
    // through to a plain LDR/STR: 0x38C00421 = ldrsb w1, [x1], #0.
    match decode(0x38C0_0421).unwrap() {
        Instruction::LdrSignExtended { rt, rn, size, sf, mode, .. } => {
            assert_eq!((rt, rn), (1, 1));
            assert_eq!(size, MemSize::B);
            assert!(!sf);
            assert_eq!(mode, IndexMode::PostIndex);
        }
        other => panic!("expected LdrSignExtended, got {other:?}"),
    }
    // size=X stays reserved in this space: it is the prefetch encoding.
    assert!(decode(0xF8C0_0421).is_err());
}

#[test]
fn dp1_source_words_decode_by_opcode_and_width() {
    // Bit 30 set is the DP 1-source group. The opcode alone does not
    // name the row: 000010 is rev32 at X width and rev at W width, so
    // a decoder keying on the opcode runs one as the other.
    assert!(
        matches!(
            decode(0xDAC0_0800),
            Ok(Instruction::DataProc1 { op: Dp1Op::Rev32, sf: true, .. })
        ),
        "rev32 x0,x0"
    );
    assert!(
        matches!(
            decode(0x5AC0_0800),
            Ok(Instruction::DataProc1 { op: Dp1Op::Rev, sf: false, .. })
        ),
        "rev w0,w0"
    );
    // Rows outside the table, the S bit, and a nonzero Rm field are
    // all reserved and must reject rather than run as something else.
    assert!(decode(0xDAC0_1800).is_err(), "opcode 000110 is not a row");
    assert!(decode(0xFAC0_1020).is_err(), "the S bit is reserved here");
    assert!(decode(0xDAC1_1020).is_err(), "Rm must be zero");
    // The cond-select op=1 family (csinv/csneg) shares the group.
    assert!(
        matches!(decode(0x5A80_0000), Ok(Instruction::CondSel { op: CondSelOp::Csinv, .. })),
        "csinv w0,w0,w0,eq decodes"
    );
    assert!(
        matches!(decode(0xDA80_0400), Ok(Instruction::CondSel { op: CondSelOp::Csneg, .. })),
        "csneg x0,x0,x0,eq decodes"
    );
    // sanity: the older forms still decode.
    assert!(decode(0x1A80_0000).is_ok(), "csel w0,w0,w0,eq");
    assert!(decode(0x1AC0_0800).is_ok(), "udiv w0,w0,w0");
}

#[test]
fn reserved_32bit_bitfield_encodings_are_rejected() {
    // sf=0 with immr/imms >= 32 (or N != sf) is reserved; the LSL-alias
    // arm computes reg_size - immr and underflows without the guard.
    // Both words are reserved encodings: immr=33/imms=32 and
    // immr=46/imms=45.
    assert!(decode(0x5321_8000).is_err());
    assert!(decode(0x536E_B400).is_err());
    // N=1 with sf=0 is reserved even with small fields.
    assert!(decode(0x5340_0C41).is_err());
}

#[test]
fn reserved_ext_8b_index_is_rejected() {
    // ext v3.8b, v7.8b, v21.8b, #11: imm4<3> set with Q=0 is reserved,
    // and the executor's 16-byte window would run past its end.
    assert!(decode(0x2E15_58E3).is_err());
    assert!(decode(0x2E15_78E3).is_err());
    // #7 is the last valid 8B index and #11 is fine with Q=1.
    assert!(decode(0x2E15_38E3).is_ok());
    assert!(decode(0x6E15_58E3).is_ok());
}

#[test]
fn decode_uxth_w_is_ubfm() {
    // UXTH Wd, Wn = UBFM Wd, Wn, #0, #15: sf=0, opc=10, N=0, immr=0, imms=15.
    let word: u32 = (0b10 << 29) | (0b100110 << 23) | (15 << 10) | (2 << 5) | 3;
    match decode(word).unwrap() {
        Instruction::Bitfield { op, sf, rd, rn, immr, imms } => {
            assert_eq!(op, BitfieldOp::Ubfm);
            assert!(!sf);
            assert_eq!(rd, 3);
            assert_eq!(rn, 2);
            assert_eq!(immr, 0);
            assert_eq!(imms, 15);
        }
        other => panic!("expected Bitfield, got {other:?}"),
    }
}

#[test]
fn decode_lsl_immediate_stays_a_shift_not_a_bitfield() {
    // `lsl x0, x1, #4` lowers to UBFM with imms+1==immr; it must keep
    // decoding as the shifted-register alias, not the general bitfield.
    let word: u32 =
        (1 << 31) | (0b10 << 29) | (0b100110 << 23) | (1 << 22) | (60 << 16) | (59 << 10) | (1 << 5);
    match decode(word).unwrap() {
        Instruction::LogReg { shift, amount, .. } => {
            assert_eq!(shift, ShiftType::LSL);
            assert_eq!(amount, 4);
        }
        other => panic!("expected LogReg (LSL alias), got {other:?}"),
    }
}

// -- ADR / ADRP --

#[test]
fn decode_adrp_recovers_page_displacement() {
    // ADRP X0, +1 page (imm21 = 1 -> byte displacement 0x1000).
    let imm21 = 1u32;
    let immlo = imm21 & 0x3;
    let immhi = (imm21 >> 2) & 0x7_FFFF;
    let word: u32 = (1 << 31) | (immlo << 29) | (0b10000 << 24) | (immhi << 5);
    match decode(word).unwrap() {
        Instruction::Adr { adrp, rd, imm } => {
            assert!(adrp);
            assert_eq!(rd, 0);
            assert_eq!(imm, 0x1000);
        }
        other => panic!("expected Adr, got {other:?}"),
    }
}

#[test]
fn decode_adr_byte_relative() {
    // ADR X5, +8 bytes (imm21 = 8, no page scaling).
    let imm21 = 8u32;
    let immlo = imm21 & 0x3;
    let immhi = (imm21 >> 2) & 0x7_FFFF;
    let word: u32 = (immlo << 29) | (0b10000 << 24) | (immhi << 5) | 5;
    match decode(word).unwrap() {
        Instruction::Adr { adrp, rd, imm } => {
            assert!(!adrp);
            assert_eq!(rd, 5);
            assert_eq!(imm, 8);
        }
        other => panic!("expected Adr, got {other:?}"),
    }
}

// -- conditional select --

#[test]
fn decode_csel_x0_x1_x2_eq() {
    // CSEL X0, X1, X2, EQ
    // 1_0_0_11010100_00010_0000_00_00001_00000
    let decoded = decode(0x9A82_0020).unwrap();
    assert_eq!(
        decoded,
        Instruction::CondSel {
            op: CondSelOp::Csel,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 2,
            cond: Condition::EQ,
        }
    );
}

#[test]
fn decode_csinc_w0_w1_w2_ne() {
    // CSINC W0, W1, W2, NE
    // 0_0_0_11010100_00010_0001_01_00001_00000
    let decoded = decode(0x1A82_1420).unwrap();
    assert_eq!(
        decoded,
        Instruction::CondSel {
            op: CondSelOp::Csinc,
            sf: false,
            rd: 0,
            rn: 1,
            rm: 2,
            cond: Condition::NE,
        }
    );
}

// -- divide and multiply-accumulate --

#[test]
fn decode_udiv_x0_x1_x2() {
    // UDIV X0, X1, X2
    // 1_0_0_11010110_00010_000010_00001_00000
    let decoded = decode(0x9AC2_0820).unwrap();
    assert_eq!(
        decoded,
        Instruction::MulDiv { op: MulDivOp::Udiv, sf: true, rd: 0, rn: 1, rm: 2 }
    );
}

#[test]
fn decode_sdiv_x0_x1_x2() {
    // SDIV X0, X1, X2
    // 1_0_0_11010110_00010_000011_00001_00000
    let decoded = decode(0x9AC2_0C20).unwrap();
    assert_eq!(
        decoded,
        Instruction::MulDiv { op: MulDivOp::Sdiv, sf: true, rd: 0, rn: 1, rm: 2 }
    );
}

#[test]
fn decode_madd_x0_x1_x2_x3() {
    // MADD X0, X1, X2, X3
    // 1_00_11011_000_00010_0_00011_00001_00000
    let decoded = decode(0x9B02_0C20).unwrap();
    assert_eq!(
        decoded,
        Instruction::MulAccumulate {
            op: MulAccumulateOp::Madd,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 2,
            ra: 3,
        }
    );
}

#[test]
fn decode_msub_x0_x1_x2_x3() {
    // MSUB X0, X1, X2, X3
    // 1_00_11011_000_00010_1_00011_00001_00000
    let decoded = decode(0x9B02_8C20).unwrap();
    assert_eq!(
        decoded,
        Instruction::MulAccumulate {
            op: MulAccumulateOp::Msub,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 2,
            ra: 3,
        }
    );
}

#[test]
fn decode_madd_with_zr_accumulator_is_mul() {
    // MADD X0, X1, X2, XZR stays on the MulDiv::Mul path.
    let decoded = decode(0x9B02_7C20).unwrap();
    assert_eq!(
        decoded,
        Instruction::MulDiv { op: MulDivOp::Mul, sf: true, rd: 0, rn: 1, rm: 2 }
    );
}

// -- load/store pair index modes --

#[test]
fn decode_ldp_post_index_scales_imm7_by_eight() {
    // LDP X0, X1, [SP], #16 (raw imm7 = 2, scaled by 8)
    // 10_101_0_001_1_0000010_00001_11111_00000
    let decoded = decode(0xA8C1_07E0).unwrap();
    assert_eq!(
        decoded,
        Instruction::LdStPair {
            op: LdStPairOp::Ldp,
            sf: true,
            rt: 0,
            rt2: 1,
            rn: 31,
            imm7: 16,
            mode: IndexMode::PostIndex,
        }
    );
}

// -- add/sub with carry --

#[test]
fn decode_adc_x0_x1_x2() {
    // ADC X0, X1, X2 = 0x9A020020
    let decoded = decode(0x9A02_0020).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpCarry {
            sub: false,
            set_flags: false,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 2,
        }
    );
}

#[test]
fn decode_adcs_w3_w4_w5() {
    // ADCS W3, W4, W5 = 0x3A050083
    let decoded = decode(0x3A05_0083).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpCarry {
            sub: false,
            set_flags: true,
            sf: false,
            rd: 3,
            rn: 4,
            rm: 5,
        }
    );
}

#[test]
fn decode_sbc_x9_x10_x11() {
    // SBC X9, X10, X11 = 0xDA0B0149
    let decoded = decode(0xDA0B_0149).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpCarry {
            sub: true,
            set_flags: false,
            sf: true,
            rd: 9,
            rn: 10,
            rm: 11,
        }
    );
}

#[test]
fn decode_sbcs_w0_w1_w2() {
    // SBCS W0, W1, W2 = 0x7A020020
    let decoded = decode(0x7A02_0020).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpCarry {
            sub: true,
            set_flags: true,
            sf: false,
            rd: 0,
            rn: 1,
            rm: 2,
        }
    );
}

#[test]
fn decode_adc_with_zero_register_operand() {
    // ADC X0, X1, XZR = 0x9A1F0020: register 31 is ZR here, never SP.
    let decoded = decode(0x9A1F_0020).unwrap();
    assert_eq!(
        decoded,
        Instruction::DpCarry {
            sub: false,
            set_flags: false,
            sf: true,
            rd: 0,
            rn: 1,
            rm: 31,
        }
    );
}

#[test]
fn decode_rejects_carry_word_with_nonzero_fixed_field() {
    // Same space with bits [15:10] = 000001, which no instruction uses:
    // it must stay unknown rather than decoding as ADC.
    assert!(decode(0x9A02_0420).is_err());
}

#[test]
fn decode_stp_w_signed_offset_scales_imm7_by_four() {
    // STP W0, W1, [X2, #4] (raw imm7 = 1, scaled by 4)
    // 00_101_0_010_0_0000001_00001_00010_00000
    let decoded = decode(0x2900_8440).unwrap();
    assert_eq!(
        decoded,
        Instruction::LdStPair {
            op: LdStPairOp::Stp,
            sf: false,
            rt: 0,
            rt2: 1,
            rn: 2,
            imm7: 4,
            mode: IndexMode::SignedOffset,
        }
    );
}

// -- the half-precision pair (FCVTN / FCVTL over 4H) --

/// Every expected value here is worked out by hand from the format,
/// not read back off the implementation. A half subnormal is
/// `frac * 2^-24`, the least normal is `2^-14`, and the largest
/// finite half is 65504.
#[test]
fn f32_to_f16_rounds_and_denormalizes_by_hand() {
    // Subnormals: the value IS the fraction field, in units of 2^-24.
    assert_eq!(f32_to_f16(2f32.powi(-20)), 0x0010); // 16 * 2^-24
    assert_eq!(f32_to_f16(2f32.powi(-24)), 0x0001); // the least subnormal
    // Half a unit in the last place, so round-to-nearest-EVEN keeps
    // the even neighbour, which is zero.
    assert_eq!(f32_to_f16(2f32.powi(-25)), 0x0000);
    // Three quarters of a ulp rounds up instead.
    assert_eq!(f32_to_f16(1.5 * 2f32.powi(-25)), 0x0001);
    // 65520 sits exactly halfway between the largest finite half and
    // 65536, so ties-to-even carries it out of the format entirely.
    assert_eq!(f32_to_f16(65520.0), 0x7c00);
    assert_eq!(f32_to_f16(65504.0), 0x7bff);
    assert_eq!(f32_to_f16(1.0), 0x3c00);
    assert_eq!(f32_to_f16(-2.5), 0xc100);
    assert_eq!(f32_to_f16(f32::INFINITY), 0x7c00);
    assert_eq!(f32_to_f16(f32::NEG_INFINITY), 0xfc00);
    assert_eq!(f32_to_f16(-0.0), 0x8000);
    // A NaN keeps its sign and the payload bits half precision has
    // room for, and a signalling one is quieted on the way down.
    assert_eq!(f32_to_f16(f32::from_bits(0x7FC0_2000)), 0x7e01);
    assert_eq!(f32_to_f16(f32::from_bits(0x7F80_2000)), 0x7e01);
    assert_eq!(f32_to_f16(f32::from_bits(0xFFC0_2000)), 0xfe01);
}

#[test]
fn f16_to_f32_widens_exactly_by_hand() {
    assert_eq!(f16_to_f32(0x0001), 2f32.powi(-24));
    assert_eq!(f16_to_f32(0x0010), 2f32.powi(-20));
    assert_eq!(f16_to_f32(0x0400), 2f32.powi(-14)); // the least normal
    assert_eq!(f16_to_f32(0x3c00), 1.0);
    assert_eq!(f16_to_f32(0x7bff), 65504.0);
    assert_eq!(f16_to_f32(0xc100), -2.5);
    assert_eq!(f16_to_f32(0x7c00), f32::INFINITY);
    assert_eq!(f16_to_f32(0xfc00), f32::NEG_INFINITY);
    assert_eq!(f16_to_f32(0x0000).to_bits(), 0);
    assert_eq!(f16_to_f32(0x8000).to_bits(), 0x8000_0000);
    // The quiet bit is set on the way up too, and the payload moves.
    assert_eq!(f16_to_f32(0x7e00).to_bits(), 0x7FC0_0000);
    assert_eq!(f16_to_f32(0x7e01).to_bits(), 0x7FC0_2000);
    assert_eq!(f16_to_f32(0x7c01).to_bits(), 0x7FC0_2000);
}

/// Widening is exact, so narrowing has to undo it bit for bit. The
/// loops cover every finite non-zero half: the subnormals, where the
/// leading one has to be found and put back, and the normals.
#[test]
fn every_finite_f16_round_trips_through_f32() {
    for half in (0x0001u16..=0x7bff).chain(0x8001u16..=0xfbff) {
        let back = f32_to_f16(f16_to_f32(half));
        assert_eq!(back, half, "0x{half:04x} came back as 0x{back:04x}");
    }
}
