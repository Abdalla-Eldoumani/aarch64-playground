//! The scalar floating-point group: arithmetic, compares, conversions,
//! FMOV and conditional select. It hands the Advanced SIMD words that
//! share its top-level group to `decode_advanced_simd` first. Also the
//! FMOV 8-bit immediate expansion.

use super::*;

/// Expand the FMOV 8-bit VFP immediate to its IEEE 754 double bit pattern.
/// Per the Arm manual: sign = b7, exponent = NOT(b6) then b6 replicated eight
/// times then b5:b4, mantissa = b3:b0 at the top of the 52-bit fraction.
/// Every encodable value is (16..31)/16 scaled by a power of two from 2^-3
/// to 2^4, either sign; the assembler brute-forces this table in reverse.
pub fn expand_fmov_imm8(imm8: u8) -> u64 {
    let b7 = ((imm8 >> 7) & 1) as u64;
    let b6 = ((imm8 >> 6) & 1) as u64;
    let b54 = ((imm8 >> 4) & 0b11) as u64;
    let b30 = (imm8 & 0b1111) as u64;
    let rep = if b6 == 1 { 0xFFu64 } else { 0 };
    (b7 << 63) | ((b6 ^ 1) << 62) | (rep << 54) | (b54 << 52) | (b30 << 48)
}

pub(super) fn decode_fp_group(instr: u32) -> Result<Instruction, EmuError> {
    if let Some(decoded) = decode_advanced_simd(instr) {
        return Ok(decoded);
    }

    // Data-processing (1 source): FMOV (reg), FNEG, FABS, FCVT.
    //   Encoding: 0_0_0_11110_ftype_1_00_000_1_op_000_Rn_Rd  (opcode in bits 20:15)
    // Data-processing (2 source): FADD/FSUB/FMUL/FDIV.
    //   Encoding: 0_0_0_11110_ftype_1_Rm_opcode_10_Rn_Rd
    // FCMP:
    //   Encoding: 0_0_0_11110_ftype_1_Rm_00_1000_Rn_opcode2
    // FCVTZS (float -> Xd/Wd, round toward zero):
    //   Encoding: sf_0_0_11110_ftype_1_11_000_000000_Rn_Rd
    // SCVTF (Xn/Wn -> float):
    //   Encoding: sf_0_0_11110_ftype_1_00_010_000000_Rn_Rd
    // ftype picks the scalar width: 00 = single (S), 01 = double (D),
    // the two views the course uses. Half precision (11) stays unhandled.

    // FP data-processing 3-source (the FMADD family) sits at bits[28:24]
    // = 11111, one above the class every other scalar FP form uses, so it
    // is taken before the guard below rejects it.
    if bits(instr, 28, 24) == 0b11111 && bits(instr, 31, 29) == 0 {
        let ftype = bits(instr, 23, 22);
        if ftype != 0b00 && ftype != 0b01 {
            return Err(EmuError::UnknownInstruction(instr));
        }
        let o1 = bit(instr, 21) as u8;
        let o0 = bit(instr, 15) as u8;
        let Some((_, _, _, op)) = FP_MUL_ADD_OPS
            .iter()
            .find(|(_, a, b, _)| *a == o1 && *b == o0)
        else {
            return Err(EmuError::UnknownInstruction(instr));
        };
        return Ok(Instruction::FpMulAdd {
            op: *op,
            fd: bits(instr, 4, 0) as u8,
            fn_: bits(instr, 9, 5) as u8,
            fm: bits(instr, 20, 16) as u8,
            fa: bits(instr, 14, 10) as u8,
            single: ftype == 0b00,
        });
    }

    let bits_28_24 = bits(instr, 28, 24);
    if bits_28_24 != 0b11110 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let ftype = bits(instr, 23, 22);
    if ftype != 0b00 && ftype != 0b01 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let single = ftype == 0b00;
    let bit21 = bit(instr, 21);

    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;
    let rm = bits(instr, 20, 16) as u8;

    // FP <-> integer conversion, both forms: rmode in 20:19, opcode in
    // 18:16. Bit 21 = 1 is the integer form, whose bits 15:10 are fixed
    // zero; bit 21 = 0 is the fixed-point one, where a 6-bit scale field
    // replaces them and holds 64 minus fbits. The rows come from the
    // shared tables so the encoder and this cannot drift.
    //
    // This is the ONLY branch that may run with bit 21 = 0. The
    // FMOV-immediate test below reads bits 12:10, which a fixed-point
    // scale ending in 100 would satisfy, so every other branch stays
    // behind the gate that follows.
    let fbits = if bit21 == 1 {
        (bits(instr, 15, 10) == 0).then_some(0u8)
    } else {
        Some((64 - bits(instr, 15, 10)) as u8)
    };
    if let Some(fbits) = fbits {
        let rmode = bits(instr, 20, 19) as u8;
        let opcode = bits(instr, 18, 16) as u8;
        let sf = bit(instr, 31) == 1;
        if let Some((_, _, _, op)) = FP_TO_INT_OPS
            .iter()
            .find(|(_, r, o, _)| *r == rmode && *o == opcode)
        {
            return Ok(Instruction::FpToInt { op: *op, rd, fn_: rn, sf, single, fbits });
        }
        if let Some((_, _, _, op)) = FP_FROM_INT_OPS
            .iter()
            .find(|(_, r, o, _)| *r == rmode && *o == opcode)
        {
            return Ok(Instruction::FpFromInt { op: *op, fd: rd, rn, sf, single, fbits });
        }
    }

    if bit21 != 1 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    // FP data-processing 2-source: bits[15:10] = opcode | 10
    if bits(instr, 11, 10) == 0b10 {
        let opcode = bits(instr, 15, 12);
        let Some((_, _, op)) = FP_BINARY_OPS.iter().find(|(_, code, _)| u32::from(*code) == opcode)
        else {
            return Err(EmuError::UnknownInstruction(instr));
        };
        return Ok(Instruction::FpBinary { op: *op, fd: rd, fn_: rn, fm: rm, single });
    }

    // FCCMP / FCCMPE: bits 11:10 = 01, the signalling form in bit 4.
    if bits(instr, 11, 10) == 0b01 {
        let cond = Condition::from_u8(bits(instr, 15, 12) as u8)?;
        let nzcv = bits(instr, 3, 0) as u8;
        return Ok(Instruction::FpCondCompare { fn_: rn, fm: rm, nzcv, cond, single });
    }

    // FCSEL: bits 11:10 = 11.
    if bits(instr, 11, 10) == 0b11 {
        let cond = Condition::from_u8(bits(instr, 15, 12) as u8)?;
        return Ok(Instruction::FpCondSel { fd: rd, fn_: rn, fm: rm, cond, single });
    }

    // FP data-processing 1-source: opcode in bits 20:15, bits 14:10 = 10000.
    // FMOV keeps its dedicated variant; FABS/FNEG/FSQRT share FpUnary. FCVT's
    // opcode is 0001 followed by dest-type: the ftype names the SOURCE
    // width, so only the cross-width pairs are valid encodings.
    if bits(instr, 14, 10) == 0b10000 {
        let opcode = bits(instr, 20, 15);
        if let Some((_, _, op)) = FP_UNARY_OPS.iter().find(|(_, code, _)| u32::from(*code) == opcode)
        {
            return Ok(Instruction::FpUnary { op: *op, fd: rd, fn_: rn, single });
        }
        if let Some((_, op)) = FP_ROUND_OPS.iter().find(|(code, _)| u32::from(*code) == opcode) {
            return Ok(Instruction::SimdFpTwoMisc {
                op: *op,
                esize: if single { 4 } else { 8 },
                q: false,
                scalar: true,
                fbits: 0,
                rn,
                rd,
            });
        }
        match opcode {
            0b000000 => return Ok(Instruction::FpMoveReg { fd: rd, fn_: rn, single }),
            // FCVT Sd, Dn: dest single, source double (narrow).
            0b000100 if !single => {
                return Ok(Instruction::FpCvt { fd: rd, fn_: rn, widen: false })
            }
            // FCVT Dd, Sn: dest double, source single (widen, exact).
            0b000101 if single => {
                return Ok(Instruction::FpCvt { fd: rd, fn_: rn, widen: true })
            }
            _ => {}
        }
    }

    // FMOV (scalar, immediate): imm8 in bits 20:13, bits 12:10 = 100, and
    // the Rn field is zero. Expanded here so the executor writes raw bits;
    // the S form expands to f32 bits (every VFP immediate is exact in f32).
    if bits(instr, 12, 10) == 0b100 && bits(instr, 9, 5) == 0 {
        let imm8 = bits(instr, 20, 13) as u8;
        let imm_bits = if single {
            (f64::from_bits(expand_fmov_imm8(imm8)) as f32).to_bits() as u64
        } else {
            expand_fmov_imm8(imm8)
        };
        return Ok(Instruction::FpMoveImm { fd: rd, imm_bits, single });
    }

    // FCMP: opcode2 = 001000 in bits 15:10, bits 4:0 = 00000, bits 20:16 = Rm.
    // opc bits 4:3 pick the variant: 00 FCMP, 10 FCMPE. The signaling
    // form differs only in how quiet NaNs trap, and the emulator raises
    // no FP exceptions, so both set the same flags.
    if bits(instr, 15, 10) == 0b001000 && matches!(bits(instr, 4, 0), 0b00000 | 0b10000) {
        return Ok(Instruction::FpCompare { fn_: rn, fm: rm, single });
    }
    // opc bit 3 is the compare against #0.0, whose Rm field is zero.
    if bits(instr, 15, 10) == 0b001000 && rm == 0 && matches!(bits(instr, 4, 0), 0b01000 | 0b11000) {
        return Ok(Instruction::FpCompareZero { fn_: rn, single });
    }

    // FMOV between the register files: rmode 00, opcode 110 (FP -> GP) or
    // 111 (GP -> FP), bits 15:10 zero. Only the matched-width pairs are
    // valid encodings (w<->s when sf=0/ftype=S, x<->d when sf=1/ftype=D).
    let fmov_field = bits(instr, 20, 10);
    if fmov_field == 0b00110_000000 || fmov_field == 0b00111_000000 {
        let sf = bit(instr, 31) == 1;
        if sf == single {
            return Err(EmuError::UnknownInstruction(instr));
        }
        return Ok(Instruction::FpMoveGeneral {
            to_fp: fmov_field == 0b00111_000000,
            sf,
            single,
            rd,
            rn,
        });
    }

    Err(EmuError::UnknownInstruction(instr))
}
