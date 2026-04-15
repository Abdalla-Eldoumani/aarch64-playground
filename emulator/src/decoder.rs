use crate::errors::EmuError;
use crate::registers::{Condition, ShiftType};

// ---------------------------------------------------------------------------
// sub-enums
// ---------------------------------------------------------------------------

/// Data-processing (immediate and register) operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DpOp {
    Add,
    Adds,
    Sub,
    Subs,
}

/// Move-wide operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoveWideOp {
    Movn,
    Movz,
    Movk,
}

/// Logical operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogOp {
    And,
    Orr,
    Eor,
}

/// Load/store single-register direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LdStOp {
    Ldr,
    Str,
}

/// Access size for single-register loads/stores.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemSize {
    B,  // 1 byte
    H,  // 2 bytes
    W,  // 4 bytes
    X,  // 8 bytes
}

impl MemSize {
    /// Number of bytes for this access width.
    pub fn bytes(self) -> u32 {
        match self {
            Self::B => 1,
            Self::H => 2,
            Self::W => 4,
            Self::X => 8,
        }
    }
}

/// Load/store pair direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LdStPairOp {
    Ldp,
    Stp,
}

/// Addressing mode for load/store.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexMode {
    SignedOffset,
    PreIndex,
    PostIndex,
}

/// How an Xm/Wm index register is extended into the effective-address
/// computation. `Lsl` treats the 64-bit register value as-is (equivalent to
/// UXTX on AArch64); the others sign- or zero-extend a 32-bit value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtendType {
    /// Zero-extend a 32-bit unsigned value.
    Uxtw,
    /// Use the 64-bit value directly (option 011 in the encoding).
    Lsl,
    /// Sign-extend a 32-bit value.
    Sxtw,
    /// Sign-extend a 64-bit value (no-op, kept for encoding symmetry).
    Sxtx,
}

/// Offset for single-register load/store.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LdStOffset {
    Immediate(i64),
    Register {
        rm: u8,
        extend: ExtendType,
        shift_amount: u8,
    },
}

/// Unconditional branch-to-register variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrRegOp {
    Br,
    Blr,
    Ret,
}

/// Conditional select variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CondSelOp {
    Csel,
    Csinc,
}

/// Multiply/divide variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MulDivOp {
    Mul,
    Udiv,
    Sdiv,
}

/// Multiply-accumulate variant. `Madd` computes `Rd = Ra + Rn*Rm`; `Msub`
/// computes `Rd = Ra - Rn*Rm`. The course uses MSUB for remainder:
/// `sdiv q, a, b; msub r, q, b, a` yields `r = a mod b`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MulAccumulateOp {
    Madd,
    Msub,
}

/// Floating-point binary operation. Double precision only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FpBinOp {
    Fadd,
    Fsub,
    Fmul,
    Fdiv,
}

// ---------------------------------------------------------------------------
// instruction enum
// ---------------------------------------------------------------------------

/// A decoded ARM64 instruction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Instruction {
    /// ADD/SUB/ADDS/SUBS with 12-bit immediate.
    DpImm {
        op: DpOp,
        sf: bool,
        rd: u8,
        rn: u8,
        imm: u32,
        shift: u8, // 0 or 12
    },
    /// ADD/SUB/ADDS/SUBS with shifted register operand.
    DpReg {
        op: DpOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        shift: ShiftType,
        amount: u8,
    },
    /// MOVZ/MOVK/MOVN.
    MoveWide {
        op: MoveWideOp,
        sf: bool,
        rd: u8,
        imm16: u16,
        hw: u8,
    },
    /// AND/ORR/EOR with bitmask immediate.
    LogImm {
        op: LogOp,
        sf: bool,
        rd: u8,
        rn: u8,
        imm: u64,
        set_flags: bool,
    },
    /// AND/ORR/EOR/MVN with shifted register.
    LogReg {
        op: LogOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        shift: ShiftType,
        amount: u8,
        set_flags: bool,
        invert: bool, // true for MVN (ORN with rn=ZR), BIC, EON
    },
    /// LDR/STR/LDRB/STRB/LDRH/STRH.
    LdSt {
        op: LdStOp,
        rt: u8,
        rn: u8,
        offset: LdStOffset,
        size: MemSize,
        mode: IndexMode,
    },
    /// SIMD&FP LDR/STR, unsigned-offset form. `size` picks D (0b11, 8B)
    /// or S (0b10, 4B) width; pre/post-index and register-offset forms
    /// aren't wired through yet.
    FpLdSt {
        load: bool,
        ft: u8,
        rn: u8,
        offset: i64,
        size: MemSize,
    },
    /// LDP/STP.
    LdStPair {
        op: LdStPairOp,
        sf: bool,
        rt: u8,
        rt2: u8,
        rn: u8,
        imm7: i16,
        mode: IndexMode,
    },
    /// B/BL (26-bit signed offset, already shifted left 2).
    BrImm {
        link: bool,
        offset: i64,
    },
    /// BR/BLR/RET.
    BrReg {
        op: BrRegOp,
        rn: u8,
    },
    /// B.cond (19-bit signed offset, already shifted left 2).
    BCond {
        cond: Condition,
        offset: i64,
    },
    /// CSEL/CSINC.
    CondSel {
        op: CondSelOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        cond: Condition,
    },
    /// MUL/UDIV/SDIV.
    MulDiv {
        op: MulDivOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
    },
    /// LDR (literal): load Xt or Wt from a PC-relative offset. The linker
    /// places the referenced value in a literal pool after the `.text`
    /// section and back-patches the offset into this instruction word.
    LdrLiteral {
        sf: bool,
        rt: u8,
        /// Byte offset relative to the instruction's PC, already shifted.
        offset: i64,
    },
    /// CBZ / CBNZ: compare register to zero and branch. `nonzero` is
    /// true for CBNZ (branch when the register is nonzero).
    CompareBranch {
        sf: bool,
        rt: u8,
        nonzero: bool,
        /// Byte offset relative to the instruction's PC, already scaled.
        offset: i64,
    },
    /// TBZ / TBNZ: test one bit of a register and branch. `nonzero` is
    /// true for TBNZ (branch when the tested bit is 1). `bit_pos` is
    /// the 0-based bit index (0..=63).
    TestBranch {
        rt: u8,
        bit_pos: u8,
        nonzero: bool,
        /// Byte offset relative to the instruction's PC, already scaled.
        offset: i64,
    },
    /// MADD / MSUB: three-source multiply with an accumulator. The
    /// existing `MulDiv::Mul` path still handles MUL (MADD with Ra=XZR).
    MulAccumulate {
        op: MulAccumulateOp,
        sf: bool,
        rd: u8,
        rn: u8,
        rm: u8,
        ra: u8,
    },
    /// LDRSB / LDRSH / LDRSW: sign-extending loads. `sf` selects the
    /// target register width (Xt when true, Wt when false; LDRSW only
    /// has the Xt form so it always sets `sf = true`). `size` is the
    /// number of bytes read from memory (B, H, or W).
    LdrSignExtended {
        rt: u8,
        rn: u8,
        offset: LdStOffset,
        size: MemSize,
        mode: IndexMode,
        sf: bool,
    },
    /// FADD / FSUB / FMUL / FDIV in double precision.
    FpBinary {
        op: FpBinOp,
        fd: u8,
        fn_: u8,
        fm: u8,
    },
    /// FMOV Dd, Dn (reg-to-reg).
    FpMoveReg {
        fd: u8,
        fn_: u8,
    },
    /// FCMP Dn, Dm. Sets NZCV; Dd is unused in the encoding.
    FpCompare {
        fn_: u8,
        fm: u8,
    },
    /// SCVTF Dd, Rn: signed int (W or X) to double. `sf` picks Xn vs Wn.
    FpScvtf {
        fd: u8,
        rn: u8,
        sf: bool,
    },
    /// FCVTZS Rd, Dn: double to signed int (W or X), round-toward-zero.
    /// `sf` picks Xd vs Wd.
    FpFcvtzs {
        rd: u8,
        fn_: u8,
        sf: bool,
    },
    /// NOP.
    Nop,
    /// SVC (treated as halt).
    Svc {
        imm16: u16,
    },
}

// ---------------------------------------------------------------------------
// bit-extraction helpers
// ---------------------------------------------------------------------------

fn bit(instr: u32, pos: u8) -> u32 {
    (instr >> pos) & 1
}

fn bits(instr: u32, hi: u8, lo: u8) -> u32 {
    (instr >> lo) & ((1 << (hi - lo + 1)) - 1)
}

fn sign_extend(val: u32, bit_width: u8) -> i64 {
    let shift = 64 - bit_width as u64;
    ((val as i64) << shift) >> shift
}

// ---------------------------------------------------------------------------
// bitmask immediate decoder
// ---------------------------------------------------------------------------

/// Decode the N:immr:imms bitmask immediate encoding used by logical
/// instructions. Returns the 64-bit expanded bitmask.
///
/// ARM64 bitmask immediates encode repeating bit patterns. The element
/// size is determined by the highest bit of `NOT(imms)` when N=0, or
/// is 64 bits when N=1. Within each element, `imms` consecutive bits
/// are set starting at bit 0, then rotated right by `immr`.
pub fn decode_bitmask_imm(n: bool, immr: u8, imms: u8, sf: bool) -> Result<u64, EmuError> {
    let len = if n {
        6 // 64-bit element
    } else {
        // find highest bit of NOT(imms[5:0])
        let not_imms = (!imms) & 0x3F;
        if not_imms == 0 {
            return Err(EmuError::UnknownInstruction(0));
        }
        // highest set bit position (0-indexed)
        let mut len = 5u8;
        while len > 0 && (not_imms & (1 << len)) == 0 {
            len -= 1;
        }
        len
    };

    // reject if !sf and N=1
    if !sf && n {
        return Err(EmuError::UnknownInstruction(0));
    }

    let esize: u32 = 1 << len;
    let mask = esize - 1;

    let s = (imms as u32) & mask;
    let r = (immr as u32) & mask;

    // s == mask is a reserved encoding
    if s == mask {
        return Err(EmuError::UnknownInstruction(0));
    }

    // create element with (s+1) ones
    let ones: u64 = (1u64 << (s + 1)) - 1;

    // rotate right by r within the element
    let element_mask: u64 = if esize == 64 { u64::MAX } else { (1u64 << esize) - 1 };
    let element = if r == 0 {
        ones
    } else {
        ((ones >> r) | (ones << (esize - r))) & element_mask
    };

    // replicate across 64 bits
    let mut result = element;
    let mut width = esize;
    while width < 64 {
        result |= result << width;
        width *= 2;
    }

    if !sf {
        result &= 0xFFFF_FFFF;
    }

    Ok(result)
}

/// Encode a 64-bit value (or 32-bit when `!sf`) as the `(N, immr, imms)`
/// triple that `decode_bitmask_imm` consumes. Returns `None` when the
/// value isn't expressible as an ARM64 logical bitmask immediate; those
/// exclude all-zeros, all-ones, and any pattern that doesn't reduce to
/// a rotated run of ones in a 2/4/8/16/32/64-bit element.
pub fn encode_bitmask_imm(value: u64, sf: bool) -> Option<(bool, u8, u8)> {
    let reg_width: u32 = if sf { 64 } else { 32 };
    // Reject trivial patterns the ARM spec excludes.
    let trimmed = if sf { value } else { value & 0xFFFF_FFFF };
    if !sf && value != trimmed {
        // Upper 32 bits set in a 32-bit instruction -- not encodable.
        return None;
    }
    if trimmed == 0 {
        return None;
    }
    if sf && trimmed == u64::MAX {
        return None;
    }
    if !sf && trimmed == 0xFFFF_FFFF {
        return None;
    }

    // Replicate the 32-bit value to 64 bits so the search below can treat
    // everything uniformly; the decoder does the same in reverse.
    let replicated: u64 = if sf {
        trimmed
    } else {
        trimmed | (trimmed << 32)
    };

    for &esize in &[2u32, 4, 8, 16, 32, 64] {
        if esize > reg_width {
            break;
        }
        let mask: u64 = if esize == 64 { u64::MAX } else { (1u64 << esize) - 1 };
        let element = replicated & mask;
        let mut stride: u32 = esize;
        let mut repeats = true;
        while stride < 64 {
            if ((replicated >> stride) & mask) != element {
                repeats = false;
                break;
            }
            stride += esize;
        }
        if !repeats {
            continue;
        }
        if element == 0 || element == mask {
            continue;
        }
        let ones = element.count_ones();
        // Try rotating right by each possible amount; a valid bitmask
        // immediate rotates into a contiguous run of ones in the low bits.
        for r in 0..esize {
            let rotated = if r == 0 {
                element
            } else {
                ((element >> r) | (element << (esize - r))) & mask
            };
            if rotated == (1u64 << ones) - 1 {
                let s_val = ones - 1;
                let n_bit = esize == 64;
                let len: u32 = match esize {
                    2 => 1,
                    4 => 2,
                    8 => 3,
                    16 => 4,
                    32 => 5,
                    64 => 6,
                    _ => unreachable!(),
                };
                let imms: u8 = if n_bit {
                    (s_val as u8) & 0x3F
                } else {
                    let upper_count = 5u32 - len;
                    let upper_bits = if upper_count == 0 {
                        0u8
                    } else {
                        (((1u32 << upper_count) - 1) as u8) << (len + 1)
                    };
                    upper_bits | ((s_val as u8) & ((1u8 << len) - 1))
                };
                let immr = r as u8;
                return Some((n_bit, immr, imms));
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// top-level decoder
// ---------------------------------------------------------------------------

/// Decode a 32-bit ARM64 instruction word into a typed `Instruction`.
pub fn decode(instr: u32) -> Result<Instruction, EmuError> {
    // NOP is a specific encoding
    if instr == 0xD503_201F {
        return Ok(Instruction::Nop);
    }

    // SVC: 1101_0100 000i_iiii iiii_iiii iii0_0001
    if (instr & 0xFFE0_001F) == 0xD400_0001 {
        let imm16 = bits(instr, 20, 5) as u16;
        return Ok(Instruction::Svc { imm16 });
    }

    let op0 = bits(instr, 28, 25);

    match op0 {
        // data processing -- immediate
        0b1000 | 0b1001 => decode_dp_imm_group(instr),
        // branches, exception, system
        0b1010 | 0b1011 => decode_branch_group(instr),
        // loads and stores
        0b0100 | 0b0110 | 0b1100 | 0b1110 => decode_ldst_group(instr),
        // data processing -- register
        0b0101 | 0b1101 => decode_dp_reg_group(instr),
        // scalar FP (and SIMD, which we do not implement)
        0b0111 | 0b1111 => decode_fp_group(instr),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

fn decode_fp_group(instr: u32) -> Result<Instruction, EmuError> {
    // Data-processing (1 source): FMOV (reg), FNEG, FABS, FSQRT.
    //   Encoding: 0_0_0_11110_ftype_1_00_000_1_op_000_Rn_Rd  (opcode in bits 20:15)
    // Data-processing (2 source): FADD/FSUB/FMUL/FDIV.
    //   Encoding: 0_0_0_11110_ftype_1_Rm_opcode_10_Rn_Rd
    // FCMP:
    //   Encoding: 0_0_0_11110_ftype_1_Rm_00_1000_Rn_opcode2
    // FCVTZS (double -> Xd/Wd, round toward zero):
    //   Encoding: sf_0_0_11110_ftype_1_11_000_000000_Rn_Rd
    // SCVTF (Xn/Wn -> double):
    //   Encoding: sf_0_0_11110_ftype_1_00_010_000000_Rn_Rd
    // We only handle double precision (ftype=01).

    let bits_28_24 = bits(instr, 28, 24);
    if bits_28_24 != 0b11110 {
        return Err(EmuError::UnknownInstruction(instr));
    }
    let ftype = bits(instr, 23, 22);
    if ftype != 0b01 {
        // Only double precision for now.
        return Err(EmuError::UnknownInstruction(instr));
    }
    if bit(instr, 21) != 1 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;
    let rm = bits(instr, 20, 16) as u8;

    // FP data-processing 2-source: bits[15:10] = opcode | 10
    if bits(instr, 11, 10) == 0b10 {
        let opcode = bits(instr, 15, 12);
        let op = match opcode {
            0b0000 => FpBinOp::Fmul,
            0b0001 => FpBinOp::Fdiv,
            0b0010 => FpBinOp::Fadd,
            0b0011 => FpBinOp::Fsub,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        return Ok(Instruction::FpBinary { op, fd: rd, fn_: rn, fm: rm });
    }

    // FP data-processing 1-source (bits 21 down): opcode2 in bits 20:15.
    if bits(instr, 20, 15) == 0b000000 && bits(instr, 14, 10) == 0b10000 {
        // FMOV Dd, Dn
        return Ok(Instruction::FpMoveReg { fd: rd, fn_: rn });
    }

    // FCMP: opcode2 = 001000 in bits 15:10, bits 4:0 = 00000, bits 20:16 = Rm.
    if bits(instr, 15, 10) == 0b001000 && bits(instr, 4, 0) == 0 {
        return Ok(Instruction::FpCompare { fn_: rn, fm: rm });
    }

    // FCVTZS (double -> signed int): sf_0_0_11110_01_1_11_000_000000_Rn_Rd
    if bits(instr, 20, 10) == 0b11000_000000 {
        let sf = bit(instr, 31) == 1;
        return Ok(Instruction::FpFcvtzs { rd, fn_: rn, sf });
    }

    // SCVTF (signed int -> double): sf_0_0_11110_01_1_00_010_000000_Rn_Rd
    if bits(instr, 20, 10) == 0b00010_000000 {
        let sf = bit(instr, 31) == 1;
        return Ok(Instruction::FpScvtf { fd: rd, rn, sf });
    }

    Err(EmuError::UnknownInstruction(instr))
}

// ---------------------------------------------------------------------------
// data processing -- immediate group
// ---------------------------------------------------------------------------

fn decode_dp_imm_group(instr: u32) -> Result<Instruction, EmuError> {
    let op0 = bits(instr, 25, 23);

    match op0 {
        // add/subtract immediate
        0b010 => decode_add_sub_imm(instr),
        // move wide immediate
        0b101 => decode_move_wide(instr),
        // logical immediate
        0b100 => decode_logical_imm(instr),
        // bitfield (used for LSL/LSR/ASR immediate via aliases)
        0b110 => decode_bitfield(instr),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

fn decode_add_sub_imm(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op = bit(instr, 30);    // 0=ADD, 1=SUB
    let s = bit(instr, 29);     // set flags
    let shift = bit(instr, 22) as u8; // 0 or 1 (LSL #0 or LSL #12)
    let imm12 = bits(instr, 21, 10);
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpImm {
        op: dp_op,
        sf,
        rd,
        rn,
        imm: imm12,
        shift: shift * 12,
    })
}

fn decode_move_wide(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let hw = bits(instr, 22, 21) as u8;
    let imm16 = bits(instr, 20, 5) as u16;
    let rd = bits(instr, 4, 0) as u8;

    // 32-bit form cannot use hw >= 2
    if !sf && hw >= 2 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    let op = match opc {
        0b00 => MoveWideOp::Movn,
        0b10 => MoveWideOp::Movz,
        0b11 => MoveWideOp::Movk,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };

    Ok(Instruction::MoveWide {
        op,
        sf,
        rd,
        imm16,
        hw,
    })
}

fn decode_logical_imm(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 22) == 1;
    let immr = bits(instr, 21, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let imm = decode_bitmask_imm(n, immr, imms, sf)
        .map_err(|_| EmuError::UnknownInstruction(instr))?;

    let (op, set_flags) = match opc {
        0b00 => (LogOp::And, false),
        0b01 => (LogOp::Orr, false),
        0b10 => (LogOp::Eor, false),
        0b11 => (LogOp::And, true), // ANDS
        _ => unreachable!(),
    };

    Ok(Instruction::LogImm {
        op,
        sf,
        rd,
        rn,
        imm,
        set_flags,
    })
}

fn decode_bitfield(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let immr = bits(instr, 21, 16) as u8;
    let imms = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let reg_size: u8 = if sf { 64 } else { 32 };

    // We represent shift-immediates as ORR Xd, XZR, Xn, <shift> #amount.
    // This reuses the LogReg path in the executor.
    match opc {
        // SBFM: ASR alias when imms == reg_size-1
        0b00 if imms == reg_size - 1 => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::ASR,
            amount: immr,
            set_flags: false,
            invert: false,
        }),
        // UBFM: LSR alias when imms == reg_size-1
        0b10 if imms == reg_size - 1 => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::LSR,
            amount: immr,
            set_flags: false,
            invert: false,
        }),
        // UBFM: LSL alias when imms+1 == immr
        0b10 if immr != 0 && imms + 1 == immr => Ok(Instruction::LogReg {
            op: LogOp::Orr,
            sf,
            rd,
            rn: 31,
            rm: rn,
            shift: ShiftType::LSL,
            amount: reg_size - immr,
            set_flags: false,
            invert: false,
        }),
        _ => Err(EmuError::UnknownInstruction(instr)),
    }
}

// ---------------------------------------------------------------------------
// branch group
// ---------------------------------------------------------------------------

fn decode_branch_group(instr: u32) -> Result<Instruction, EmuError> {
    // compare-and-branch: x011_010o ... (CBZ when bit 24 = 0, CBNZ = 1)
    if (instr & 0x7E00_0000) == 0x3400_0000 {
        let sf = bit(instr, 31) == 1;
        let nonzero = bit(instr, 24) == 1;
        let imm19 = bits(instr, 23, 5);
        let rt = bits(instr, 4, 0) as u8;
        let offset = sign_extend(imm19, 19) * 4;
        return Ok(Instruction::CompareBranch {
            sf,
            rt,
            nonzero,
            offset,
        });
    }

    // test-bit-and-branch: b5_011_011_o b40_imm14_Rt (TBZ when bit 24 = 0, TBNZ = 1)
    if (instr & 0x7E00_0000) == 0x3600_0000 {
        let b5 = bit(instr, 31) as u8;
        let b40 = bits(instr, 23, 19) as u8;
        let bit_pos = (b5 << 5) | b40;
        let nonzero = bit(instr, 24) == 1;
        let imm14 = bits(instr, 18, 5);
        let rt = bits(instr, 4, 0) as u8;
        let offset = sign_extend(imm14, 14) * 4;
        return Ok(Instruction::TestBranch {
            rt,
            bit_pos,
            nonzero,
            offset,
        });
    }

    // conditional branch: 0101_010o oooo_oooo oooo_oooo ooo0_cccc
    if (instr & 0xFF00_0010) == 0x5400_0000 {
        let imm19 = bits(instr, 23, 5);
        let cond_bits = bits(instr, 3, 0) as u8;
        let offset = sign_extend(imm19, 19) * 4;
        let cond = Condition::from_u8(cond_bits)?;
        return Ok(Instruction::BCond { cond, offset });
    }

    // unconditional branch immediate: x001_01oo oooo_oooo oooo_oooo oooo_oooo
    if (instr & 0x7C00_0000) == 0x1400_0000 {
        let link = bit(instr, 31) == 1;
        let imm26 = bits(instr, 25, 0);
        let offset = sign_extend(imm26, 26) * 4;
        return Ok(Instruction::BrImm { link, offset });
    }

    // unconditional branch register: 1101_011_ 0___1_1111 0000_00nn nnn0_0000
    if (instr & 0xFE1F_FC1F) == 0xD61F_0000 {
        let opc = bits(instr, 24, 21);
        let rn = bits(instr, 9, 5) as u8;
        let op = match opc {
            0b0000 => BrRegOp::Br,
            0b0001 => BrRegOp::Blr,
            0b0010 => BrRegOp::Ret,
            _ => return Err(EmuError::UnknownInstruction(instr)),
        };
        return Ok(Instruction::BrReg { op, rn });
    }

    Err(EmuError::UnknownInstruction(instr))
}

// ---------------------------------------------------------------------------
// load/store group
// ---------------------------------------------------------------------------

fn decode_ldst_group(instr: u32) -> Result<Instruction, EmuError> {
    // LDR (literal), scalar form. Mask bit 26 to 0 so the SIMD/FP literal
    // form (0x5C00_0000, bit 26 = 1) drops through to the regular decode
    // path and errors there as unknown.
    if (instr & 0xBF00_0000) == 0x1800_0000 {
        return decode_ldr_literal(instr);
    }

    // load/store pair
    if (instr & 0x3A00_0000) == 0x2800_0000 {
        return decode_ldst_pair(instr);
    }

    // single register load/store
    decode_ldst_single(instr)
}

fn decode_ldr_literal(instr: u32) -> Result<Instruction, EmuError> {
    // opc:01_011_0_00 -- bit 30 selects width (0 = W, 1 = X).
    let sf = bit(instr, 30) == 1;
    let imm19 = bits(instr, 23, 5);
    let rt = bits(instr, 4, 0) as u8;
    // imm19 is in instruction units (4 bytes each), signed.
    let offset = sign_extend(imm19, 19) * 4;
    Ok(Instruction::LdrLiteral { sf, rt, offset })
}

fn decode_ldst_pair(instr: u32) -> Result<Instruction, EmuError> {
    let opc = bits(instr, 31, 30);
    let sf = opc == 0b10; // 10 = 64-bit, 00 = 32-bit
    let mode_bits = bits(instr, 24, 23);
    let l = bit(instr, 22); // 0=STP, 1=LDP
    let imm7 = bits(instr, 21, 15);
    let rt2 = bits(instr, 14, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rt = bits(instr, 4, 0) as u8;

    let mode = match mode_bits {
        0b01 => IndexMode::PostIndex,
        0b10 => IndexMode::SignedOffset,
        0b11 => IndexMode::PreIndex,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };

    let op = if l == 1 { LdStPairOp::Ldp } else { LdStPairOp::Stp };

    // imm7 is signed, scaled by access size (4 for 32-bit, 8 for 64-bit)
    let scale = if sf { 8 } else { 4 };
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

fn decode_ldst_single(instr: u32) -> Result<Instruction, EmuError> {
    let size_bits = bits(instr, 31, 30);
    let size = match size_bits {
        0b00 => MemSize::B,
        0b01 => MemSize::H,
        0b10 => MemSize::W,
        0b11 => MemSize::X,
        _ => unreachable!(),
    };

    let v = bit(instr, 26);
    if v == 1 {
        // SIMD&FP LDR/STR, unsigned offset form. Other SIMD/FP addressing
        // variants stay unsupported for now; the corpus uses only this one.
        let opc_outer = bits(instr, 25, 24);
        let opc_inner = bits(instr, 23, 22);
        if opc_outer == 0b01 && (opc_inner == 0b00 || opc_inner == 0b01) {
            let imm12 = bits(instr, 21, 10);
            let scale = size.bytes();
            let offset = (imm12 as i64) * (scale as i64);
            let rn = bits(instr, 9, 5) as u8;
            let ft = bits(instr, 4, 0) as u8;
            let load = opc_inner == 0b01;
            return Ok(Instruction::FpLdSt {
                load,
                ft,
                rn,
                offset,
                size,
            });
        }
        return Err(EmuError::UnknownInstruction(instr));
    }

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
        let is_load = bit(instr, 22) == 1;
        let op = if is_load { LdStOp::Ldr } else { LdStOp::Str };

        let idx_type = bits(instr, 11, 10);

        if idx_type == 0b10 {
            // register offset: option field in bits [15:13], S in bit 12.
            let rm = bits(instr, 20, 16) as u8;
            let option = bits(instr, 15, 13);
            let s = bit(instr, 12) as u8;
            let extend = match option {
                0b010 => ExtendType::Uxtw,
                0b011 => ExtendType::Lsl,
                0b110 => ExtendType::Sxtw,
                0b111 => ExtendType::Sxtx,
                _ => return Err(EmuError::UnknownInstruction(instr)),
            };
            let shift_amount = if s == 1 {
                match size {
                    MemSize::B => 0,
                    MemSize::H => 1,
                    MemSize::W => 2,
                    MemSize::X => 3,
                }
            } else {
                0
            };

            return Ok(Instruction::LdSt {
                op,
                rt,
                rn,
                offset: LdStOffset::Register {
                    rm,
                    extend,
                    shift_amount,
                },
                size,
                mode: IndexMode::SignedOffset,
            });
        }

        // pre-index or post-index with 9-bit signed immediate
        let imm9 = bits(instr, 20, 12);
        let offset = sign_extend(imm9, 9);

        let mode = match idx_type {
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

// ---------------------------------------------------------------------------
// data processing -- register group
// ---------------------------------------------------------------------------

fn decode_dp_reg_group(instr: u32) -> Result<Instruction, EmuError> {
    // sub-routing based on bits [28] and [24]:
    //   bit28=0, bit24=0 -> logical shifted register (01010)
    //   bit28=0, bit24=1 -> add/sub shifted register (01011)
    //   bit28=1, bit24=0 -> dp2 or conditional select (11010)
    //   bit28=1, bit24=1 -> dp3 / MADD / MUL (11011)
    let b28 = bit(instr, 28);
    let b24 = bit(instr, 24);

    match (b28, b24) {
        (0, 0) => decode_logical_reg(instr),
        (0, 1) => decode_add_sub_reg(instr),
        (1, 1) => decode_dp3(instr),
        (1, 0) => {
            // conditional select vs dp2: differentiate by bits [23:21]
            // conditional select: bits[23:21] = 100
            // dp2:                bits[23:21] = 110
            let sub = bits(instr, 23, 21);
            if sub == 0b100 {
                decode_cond_select(instr)
            } else {
                decode_dp2(instr)
            }
        }
        _ => unreachable!(),
    }
}

fn decode_add_sub_reg(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op_bit = bit(instr, 30);
    let s = bit(instr, 29);
    let shift = ShiftType::from_u8(bits(instr, 23, 22) as u8);
    let rm = bits(instr, 20, 16) as u8;
    let imm6 = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let dp_op = match (op_bit, s) {
        (0, 0) => DpOp::Add,
        (0, 1) => DpOp::Adds,
        (1, 0) => DpOp::Sub,
        (1, 1) => DpOp::Subs,
        _ => unreachable!(),
    };

    Ok(Instruction::DpReg {
        op: dp_op,
        sf,
        rd,
        rn,
        rm,
        shift,
        amount: imm6,
    })
}

fn decode_logical_reg(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let opc = bits(instr, 30, 29);
    let n = bit(instr, 21) == 1; // N bit: inverts rm
    let shift = ShiftType::from_u8(bits(instr, 23, 22) as u8);
    let rm = bits(instr, 20, 16) as u8;
    let imm6 = bits(instr, 15, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let (op, set_flags, invert) = match (opc, n) {
        (0b00, false) => (LogOp::And, false, false),
        (0b00, true) => (LogOp::And, false, true),   // BIC
        (0b01, false) => (LogOp::Orr, false, false),
        (0b01, true) => (LogOp::Orr, false, true),   // ORN/MVN
        (0b10, false) => (LogOp::Eor, false, false),
        (0b10, true) => (LogOp::Eor, false, true),   // EON
        (0b11, false) => (LogOp::And, true, false),   // ANDS
        (0b11, true) => (LogOp::And, true, true),     // BICS
        _ => unreachable!(),
    };

    Ok(Instruction::LogReg {
        op,
        sf,
        rd,
        rn,
        rm,
        shift,
        amount: imm6,
        set_flags,
        invert,
    })
}

fn decode_cond_select(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op2 = bit(instr, 10);
    let rm = bits(instr, 20, 16) as u8;
    let cond_bits = bits(instr, 15, 12) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    let cond = Condition::from_u8(cond_bits)?;

    let op = match op2 {
        0 => CondSelOp::Csel,
        1 => CondSelOp::Csinc,
        _ => unreachable!(),
    };

    Ok(Instruction::CondSel {
        op,
        sf,
        rd,
        rn,
        rm,
        cond,
    })
}

fn decode_dp2(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let s = bit(instr, 29);
    let opcode = bits(instr, 15, 10);
    let rm = bits(instr, 20, 16) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    if s != 0 {
        return Err(EmuError::UnknownInstruction(instr));
    }

    let op = match opcode {
        0b000010 => MulDivOp::Udiv,
        0b000011 => MulDivOp::Sdiv,
        _ => return Err(EmuError::UnknownInstruction(instr)),
    };

    Ok(Instruction::MulDiv {
        op,
        sf,
        rd,
        rn,
        rm,
    })
}

fn decode_dp3(instr: u32) -> Result<Instruction, EmuError> {
    let sf = bit(instr, 31) == 1;
    let op31 = bits(instr, 23, 21);
    let o0 = bit(instr, 15);
    let rm = bits(instr, 20, 16) as u8;
    let ra = bits(instr, 14, 10) as u8;
    let rn = bits(instr, 9, 5) as u8;
    let rd = bits(instr, 4, 0) as u8;

    // MADD / MSUB share op31=000; o0 selects between them.
    if op31 == 0b000 {
        // Keep MUL (MADD with Ra=XZR and o0=0) on the existing MulDiv::Mul
        // path so older tests and the legacy assembler still match it.
        if ra == 31 && o0 == 0 {
            return Ok(Instruction::MulDiv {
                op: MulDivOp::Mul,
                sf,
                rd,
                rn,
                rm,
            });
        }
        let op = if o0 == 0 {
            MulAccumulateOp::Madd
        } else {
            MulAccumulateOp::Msub
        };
        return Ok(Instruction::MulAccumulate {
            op,
            sf,
            rd,
            rn,
            rm,
            ra,
        });
    }

    Err(EmuError::UnknownInstruction(instr))
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
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
        // N=0, immr=0, imms=0b000000 -> len=0 doesn't work...
        // Actually for element size 2: len=1, so ~imms needs bit1 set.
        // imms = 0b0000_00, NOT = 0b111111, highest bit at 5 -> len=5? No.
        // Let me think again. The element size encoding:
        // N=0: look at highest set bit of NOT(imms[5:0])
        // For element size 2 (len=1): NOT(imms) must have bit 1 as highest.
        // So imms = 0b111100 -> NOT = 0b000011 -> highest bit = 1 -> len=1 -> esize=2
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
        // wait: NOT(0b001111) = 0b110000, highest bit = 5 -> len=5 -> esize=32
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
                assert_eq!(shift_amount, 0);
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
                assert_eq!(shift_amount, 3);
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
}
