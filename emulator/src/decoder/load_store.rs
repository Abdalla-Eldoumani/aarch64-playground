//! The load and store group: single registers, pairs, literal loads,
//! the SIMD&FP forms, and the multiple- and single-structure loads and
//! stores with their opcode table and lane-index packing.

use super::*;

/// The load/store multiple-structures opcodes, as (opcode, the number in
/// the mnemonic, how many registers the brace list names). LD1 and ST1
/// alone reach two, three and four registers without interleaving, so
/// they own four rows and every other family one.
pub const SIMD_STRUCT_MULTIPLE: &[(u8, u8, u8)] = &[
    (0b0000, 4, 4),
    (0b0010, 1, 4),
    (0b0100, 3, 3),
    (0b0110, 1, 3),
    (0b0111, 1, 1),
    (0b1000, 2, 2),
    (0b1010, 1, 2),
];

/// The lane index a single-structure word carries, or None when the
/// combination is unallocated. Q, S and the two-bit size field hold it
/// between them, and how many of those bits are index is what the
/// element width decides: `ld1 {v3.b}[15]` (0x4d401ce3: Q=1, S=1,
/// size=11) spends all four, `ld1 {v3.h}[7]` (0x4d4058e3: Q=1, S=1,
/// size=10) three with size's low bit held clear, `ld1 {v3.s}[3]`
/// (0x4d4090e3: Q=1, S=1, size=00) two, and `ld1 {v3.d}[1]`
/// (0x4d4084e3: Q=1, S=0, size=01) only Q.
pub fn simd_struct_index(esize: u8, q: bool, s: bool, size: u8) -> Option<u8> {
    let q = u8::from(q);
    let s = u8::from(s);
    match esize {
        1 => Some((q << 3) | (s << 2) | size),
        2 => (size & 1 == 0).then_some((q << 2) | (s << 1) | (size >> 1)),
        4 => (size == 0b00).then_some((q << 1) | s),
        8 => (size == 0b01 && s == 0).then_some(q),
        _ => None,
    }
}

/// The inverse: the Q, S and size bits an index packs into. The caller
/// has already range-checked the index against the element width.
pub fn simd_struct_index_bits(esize: u8, index: u8) -> (bool, bool, u8) {
    match esize {
        1 => (index & 8 != 0, index & 4 != 0, index & 3),
        2 => (index & 4 != 0, index & 2 != 0, (index & 1) << 1),
        4 => (index & 2 != 0, index & 1 != 0, 0b00),
        _ => (index & 1 != 0, false, 0b01),
    }
}

/// The total bytes a structure load or store moves, which is also the
/// only amount its immediate post-index form can add to the base: the
/// word carries no immediate field because there is one legal value.
pub fn simd_struct_bytes(shape: SimdStructShape, count: u8, esize: u8, q: bool) -> u64 {
    let per_register = match shape {
        SimdStructShape::Multiple => {
            if q {
                16
            } else {
                8
            }
        }
        _ => u64::from(esize),
    };
    u64::from(count) * per_register
}

// ---------------------------------------------------------------------------
// load/store group
// ---------------------------------------------------------------------------

pub(super) fn decode_ldst_group(instr: u32) -> Result<Instruction, EmuError> {
    // LDR (literal): opc(31:30) 011 V 00 in bits 29:24. Bit 26 (V) is
    // left in the word and read below, so the SIMD&FP literal forms
    // (0x1C/0x5C/0x9C000000) decode beside the integer ones.
    if (instr & 0x3B00_0000) == 0x1800_0000 {
        return decode_ldr_literal(instr);
    }

    // load/store pair
    if (instr & 0x3A00_0000) == 0x2800_0000 {
        return decode_ldst_pair(instr);
    }

    // the Advanced SIMD structure loads and stores, LD1-LD4 / ST1-ST4:
    // 0 Q 0011 0 x ... , where bit 24 picks whole registers from the
    // single-element shapes. Nothing else in the group claims 0x0C/0x0D.
    if (instr & 0xBE00_0000) == 0x0C00_0000 {
        return decode_simd_ldst_structure(instr)
            .ok_or(EmuError::UnknownInstruction(instr));
    }

    // single register load/store
    decode_ldst_single(instr)
}

/// LD1-LD4 / ST1-ST4 in all three shapes. `None` for an unallocated
/// combination, which the caller turns into an unknown instruction
/// rather than executing something the word does not mean.
fn decode_simd_ldst_structure(instr: u32) -> Option<Instruction> {
    let q = bit(instr, 30) == 1;
    let single = bit(instr, 24) == 1;
    let load = bit(instr, 22) == 1;
    let r = bit(instr, 21) == 1;
    let rm = bits(instr, 20, 16) as u8;
    let size = bits(instr, 11, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rt = bits(instr, 4, 0) as u8;

    // Without writeback the Rm field is RES0, and on the multiple
    // shape bit 21 is too.
    let post = if bit(instr, 23) == 1 {
        Some(rm)
    } else {
        if rm != 0 {
            return None;
        }
        None
    };

    if !single {
        if r {
            return None;
        }
        let opcode = bits(instr, 15, 12) as u8;
        let &(_, structures, count) =
            SIMD_STRUCT_MULTIPLE.iter().find(|row| row.0 == opcode)?;
        let esize = 1u8 << size;
        // A 1D arrangement holds one element, so there is nothing for an
        // interleaving form to interleave: only LD1/ST1 spell it.
        if esize == 8 && !q && structures > 1 {
            return None;
        }
        return Some(Instruction::SimdLdStStructure {
            load,
            structures,
            count,
            esize,
            q,
            shape: SimdStructShape::Multiple,
            rt,
            rn,
            post,
        });
    }

    // Single-structure: opcode<2:1> names the element width (11 being
    // the replicate rows), opcode<0> and R together the family number.
    let opcode = bits(instr, 15, 13) as u8;
    let s = bit(instr, 12) == 1;
    let structures = 1 + (opcode & 1) * 2 + u8::from(r);
    let (esize, shape) = if opcode >> 1 == 0b11 {
        // LD1R-LD4R. S is RES0 here, and there is no store form.
        if s || !load {
            return None;
        }
        (1u8 << size, SimdStructShape::Replicate)
    } else {
        let esize = match opcode >> 1 {
            0b00 => 1,
            0b01 => 2,
            _ if size & 1 == 0 => 4,
            _ => 8,
        };
        (esize, SimdStructShape::Lane(simd_struct_index(esize, q, s, size)?))
    };
    Some(Instruction::SimdLdStStructure {
        load,
        structures,
        count: structures,
        esize,
        q,
        shape,
        rt,
        rn,
        post,
    })
}

fn decode_ldr_literal(instr: u32) -> Result<Instruction, EmuError> {
    // opc:011_V_00. V picks the register file; opc picks the width.
    let opc = bits(instr, 31, 30);
    let imm19 = bits(instr, 23, 5);
    let rt = bits(instr, 4, 0) as u8;
    // imm19 is in instruction units (4 bytes each), signed.
    let offset = sign_extend(imm19, 19) * 4;
    if bit(instr, 26) == 1 {
        let size = match opc {
            0b00 => MemSize::W,
            0b01 => MemSize::X,
            0b10 => MemSize::Q,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        return Ok(Instruction::FpLdrLiteral { rt, offset, size });
    }
    // opc 10 is LDRSW (literal) and 11 is PRFM (literal); neither is
    // implemented, and neither may fall through as a plain LDR.
    if opc > 0b01 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    Ok(Instruction::LdrLiteral { sf: opc == 0b01, rt, offset })
}

fn decode_ldst_pair(instr: u32) -> Result<Instruction, EmuError> {
    let opc = bits(instr, 31, 30);
    let v = bit(instr, 26); // 0 = general registers, 1 = SIMD&FP
    let mode_bits = bits(instr, 24, 23);
    let l = bit(instr, 22); // 0=STP, 1=LDP
    let imm7 = bits(instr, 21, 15);
    let rt2 = bits(instr, 14, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rt = bits(instr, 4, 0) as u8;

    // op2 00 is the no-allocate pair (LDNP/STNP): a plain signed offset
    // with no writeback, differing from LDP/STP only in a cache hint this
    // interpreter has nothing to do with.
    let no_allocate = mode_bits == 0b00;
    let mode = match mode_bits {
        0b00 | 0b10 => IndexMode::SignedOffset,
        0b01 => IndexMode::PostIndex,
        _ => IndexMode::PreIndex,
    };

    let op = if l == 1 { LdStPairOp::Ldp } else { LdStPairOp::Stp };

    if v == 1 {
        // SIMD&FP pair: opc 00 = S, 01 = D, 10 = Q. Without this gate an
        // FP pair falls into the general decode below and runs as a
        // 32-bit GP pair with a halved offset.
        let size = match opc {
            0b00 => MemSize::W,
            0b01 => MemSize::X,
            0b10 => MemSize::Q,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        let signed_imm = sign_extend(imm7, 7) as i16 * size.bytes() as i16;
        return Ok(Instruction::FpLdStPair {
            op,
            size,
            rt,
            rt2,
            rn,
            imm7: signed_imm,
            mode,
            no_allocate,
        });
    }

    // The integer no-allocate pair is out of scope; it must not fall
    // through as an ordinary LDP/STP.
    if no_allocate {
        return Err(EmuError::UnknownInstruction(instr));
    }

    // opc 01 with L set is LDPSW; its store half and opc 11 are not base
    // instructions, and decoding either as a word pair would run the
    // wrong thing quietly.
    let op = match (opc, op) {
        (0b01, LdStPairOp::Ldp) => LdStPairOp::Ldpsw,
        (0b01, _) | (0b11, _) => return Err(EmuError::UnknownInstruction(instr)),
        _ => op,
    };
    let sf = opc != 0b00; // 10 = 64-bit, 00 = 32-bit, LDPSW writes X

    // imm7 is signed, scaled by the access size: 8 for an X pair, 4 for a
    // W pair and for LDPSW's two words
    let scale = if opc == 0b10 { 8 } else { 4 };
    let signed_imm = sign_extend(imm7, 7) as i16 * scale;

    Ok(Instruction::LdStPair {
        op,
        sf,
        rt,
        rt2,
        rn,
        imm7: signed_imm,
        mode,
    })
}

/// The register-offset operand of a load/store: Rm in bits 20:16, the
/// extend `option` in 15:13 and the scale bit S in 12. The integer and
/// SIMD&FP paths share it because they share the rules.
///
/// The legal option fields are the ones the assembler can write, so the
/// set comes from the shared table. 0b011 is spelled both `lsl` and
/// `uxtx`; the table lists `lsl` first, so a 64-bit index decodes as Lsl
/// the way GAS disassembles it. S=1 means "scale the index by the access
/// size", so the shift is log2 of that width, read off the shared byte
/// count rather than re-spelled as a second size table.
fn decode_ldst_reg_offset(instr: u32, size: MemSize) -> Result<LdStOffset, EmuError> {
    let rm = bits(instr, 20, 16) as u8;
    let option = bits(instr, 15, 13);
    let s = bit(instr, 12) as u8;
    let extend = match LDST_EXTENDS
        .iter()
        .find(|(_, opt, _)| u32::from(*opt) == option)
        .map(|(keyword, _, _)| *keyword)
    {
        Some("uxtw") => ExtendType::Uxtw,
        Some("lsl") => ExtendType::Lsl,
        Some("sxtw") => ExtendType::Sxtw,
        Some("sxtx") => ExtendType::Sxtx,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };
    let shift_amount = if s == 1 {
        Some(size.bytes().trailing_zeros() as u8)
    } else {
        None
    };
    Ok(LdStOffset::Register { rm, extend, shift_amount })
}

/// SIMD&FP LDR/STR (V=1). The width is `opc<1>:size`, not `size` alone:
/// opc<1> set with size 00 is the 128-bit Q form, which the two-bit size
/// field cannot spell on its own. Addressing is the integer set: scaled
/// unsigned offset, the imm9 family (unscaled LDUR/STUR plus pre- and
/// post-index writeback), and the register offset.
fn decode_fp_ldst_single(instr: u32, size_field: u8) -> Result<Instruction, EmuError> {
    let opc_outer = bits(instr, 25, 24);
    let opc_inner = bits(instr, 23, 22);
    let rn = bits(instr, 9, 5) as u8;
    let ft = bits(instr, 4, 0) as u8;
    let load = opc_inner & 0b01 == 1;
    let size = if opc_inner & 0b10 == 0 {
        MemSize::from_size_field(size_field)
    } else if size_field == 0b00 {
        MemSize::Q
    } else {
        // opc<1> set with any other size is unallocated.
        return Err(EmuError::UnknownInstruction(instr));
    };

    match opc_outer {
        0b01 => {
            let imm12 = bits(instr, 21, 10);
            let offset = (imm12 as i64) * (size.bytes() as i64);
            Ok(Instruction::FpLdSt {
                load,
                ft,
                rn,
                offset: LdStOffset::Immediate(offset),
                size,
                mode: IndexMode::SignedOffset,
                unscaled: false,
            })
        }
        0b00 if bit(instr, 21) == 1 => {
            if bits(instr, 11, 10) != 0b10 {
                return Err(EmuError::UnknownInstruction(instr));
            }
            Ok(Instruction::FpLdSt {
                load,
                ft,
                rn,
                offset: decode_ldst_reg_offset(instr, size)?,
                size,
                mode: IndexMode::SignedOffset,
                unscaled: false,
            })
        }
        0b00 => {
            let offset = sign_extend(bits(instr, 20, 12), 9);
            let idx = bits(instr, 11, 10);
            let mode = match idx {
                0b00 => IndexMode::SignedOffset, // unscaled LDUR/STUR
                0b01 => IndexMode::PostIndex,
                0b11 => IndexMode::PreIndex,
                _ => return Err(EmuError::UnknownInstruction(instr)),
            };
            Ok(Instruction::FpLdSt {
                load,
                ft,
                rn,
                offset: LdStOffset::Immediate(offset),
                size,
                mode,
                unscaled: idx == 0b00,
            })
        }
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

fn decode_ldst_single(instr: u32) -> Result<Instruction, EmuError> {
    let size_field = bits(instr, 31, 30) as u8;

    let v = bit(instr, 26);
    if v == 1 {
        return decode_fp_ldst_single(instr, size_field);
    }
    let size = MemSize::from_size_field(size_field);

    let opc = bits(instr, 25, 24);
    let rn = bits(instr, 9, 5) as u8;
    let rt = bits(instr, 4, 0) as u8;

    // unsigned offset: xx11_1001 xxoo_oooo oooo_oonn nnnt_tttt
    if opc == 0b01 && bits(instr, 29, 28) == 0b11 {
        let imm12 = bits(instr, 21, 10);
        let scale = size.bytes();
        let offset = (imm12 as i64) * (scale as i64);
        // bits 23:22 distinguish STR/LDR/LDRS-X/LDRS-W.
        let inner_opc = bits(instr, 23, 22);
        match inner_opc {
            0b00 => {
                return Ok(Instruction::LdSt {
                    op: LdStOp::Str,
                    rt,
                    rn,
                    offset: LdStOffset::Immediate(offset),
                    size,
                    mode: IndexMode::SignedOffset,
                });
            }
            0b01 => {
                return Ok(Instruction::LdSt {
                    op: LdStOp::Ldr,
                    rt,
                    rn,
                    offset: LdStOffset::Immediate(offset),
                    size,
                    mode: IndexMode::SignedOffset,
                });
            }
            0b10 | 0b11 => {
                // LDRSB / LDRSH (size B or H) or LDRSW (size W).
                // size=X is reserved for the sign-extending forms.
                if matches!(size, MemSize::X) {
                    return Err(EmuError::UnknownInstruction(instr));
                }
                let sf = inner_opc == 0b10; // 10 = Xt, 11 = Wt
                return Ok(Instruction::LdrSignExtended {
                    rt,
                    rn,
                    offset: LdStOffset::Immediate(offset),
                    size,
                    mode: IndexMode::SignedOffset,
                    sf,
                });
            }
            _ => unreachable!(),
        }
    }

    // pre/post-index and register offset: xx11_1000 xx0o_oooo oooo_MMnn nnnt_tttt
    if bits(instr, 29, 28) == 0b11 && bit(instr, 24) == 0 {
        let opc = bits(instr, 23, 22);
        let idx_type = bits(instr, 11, 10);

        if idx_type == 0b10 {
            let offset = decode_ldst_reg_offset(instr, size)?;

            // opc 00/01 are STR/LDR; 10/11 are the sign-extending loads
            // (LDRSB/LDRSH/LDRSW with an Xt or Wt target). Keying only on
            // bit 22 misread LDRSB-register as a plain STR/LDR.
            return match opc {
                0b00 | 0b01 => Ok(Instruction::LdSt {
                    op: if opc == 0b01 { LdStOp::Ldr } else { LdStOp::Str },
                    rt,
                    rn,
                    offset,
                    size,
                    mode: IndexMode::SignedOffset,
                }),
                _ => {
                    // size=X is reserved for the sign-extending forms
                    // (prefetch space); LDRSW is size=W with an Xt target.
                    if matches!(size, MemSize::X) {
                        return Err(EmuError::UnknownInstruction(instr));
                    }
                    Ok(Instruction::LdrSignExtended {
                        rt,
                        rn,
                        offset,
                        size,
                        mode: IndexMode::SignedOffset,
                        sf: opc == 0b10,
                    })
                }
            };
        }

        // The sign-extending imm9 forms: LDURS* (idx 00) and LDRS* with
        // pre/post writeback. They must be taken here, before the LdStOp
        // selection below, or they misdecode as a plain LDR/STR of the
        // wrong direction and width.
        if opc >= 0b10 {
            // size=X is reserved in this space (it is the prefetch
            // encoding), the same rule the register-offset arm applies.
            if matches!(size, MemSize::X) {
                return Err(EmuError::UnknownInstruction(instr));
            }
            let mode = match idx_type {
                0b00 => IndexMode::SignedOffset,
                0b01 => IndexMode::PostIndex,
                0b11 => IndexMode::PreIndex,
                _ => return Err(EmuError::UnknownInstruction(instr)),
            };
            return Ok(Instruction::LdrSignExtended {
                rt,
                rn,
                offset: LdStOffset::Immediate(sign_extend(bits(instr, 20, 12), 9)),
                size,
                mode,
                sf: opc == 0b10, // 10 = Xt, 11 = Wt
            });
        }
        let op = if opc == 0b01 { LdStOp::Ldr } else { LdStOp::Str };

        // 9-bit signed immediate family: unscaled offset (the LDUR/STUR
        // encodings GAS emits for negative or unaligned LDR/STR offsets),
        // pre-index, and post-index.
        let imm9 = bits(instr, 20, 12);
        let offset = sign_extend(imm9, 9);

        let mode = match idx_type {
            0b00 => IndexMode::SignedOffset,
            0b01 => IndexMode::PostIndex,
            0b11 => IndexMode::PreIndex,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };

        return Ok(Instruction::LdSt {
            op,
            rt,
            rn,
            offset: LdStOffset::Immediate(offset),
            size,
            mode,
        });
    }

    Err(EmuError::UnknownInstruction(instr))
}
