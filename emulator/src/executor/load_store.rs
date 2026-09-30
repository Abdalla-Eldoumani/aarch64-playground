//! Loads and stores: the null-page guard and the stack-alignment check
//! every access passes, then the single, pair, literal, sign-extending,
//! SIMD&FP and structure forms.

use super::*;

/// The first page is never mapped on Linux; a guest access there is a
/// null or garbage base register, not memory the program owns. Memory
/// auto-maps on write, so without this a store through a zeroed base
/// silently succeeds and the program runs to a wrong answer that the
/// course servers kill with SIGSEGV.
const NULL_PAGE_LIMIT: u64 = 4096;

fn check_guest_address(addr: u64, access: crate::errors::MemAccess) -> Result<(), EmuError> {
    if addr < NULL_PAGE_LIMIT {
        return Err(EmuError::NullPointerAccess { address: addr, access });
    }
    Ok(())
}

/// AArch64 checks SP itself, never the effective address: SCTLR_EL1.SA0
/// is set on Linux, so any load or store using SP as the base faults
/// when SP is off the 16-byte boundary: `ldr w0, [sp, 4]` from an
/// aligned SP is legal, `ldr w0, [sp]` from an SP off by 8 is not.
/// Runs before the offset math and any writeback, like the ARM
/// pseudocode's CheckSPAlignment(). `rn >= 31` mirrors the
/// `read_gpr_or_sp` convention.
fn check_sp_alignment(rn: u8, regs: &RegisterFile) -> Result<(), EmuError> {
    if rn >= 31 {
        let sp = regs.read_sp();
        if !sp.is_multiple_of(16) {
            return Err(EmuError::SpAlignmentFault { sp, at_call: false });
        }
    }
    Ok(())
}

/// The byte displacement a load/store's offset operand contributes. The
/// register form's extend rules are the same for the integer file and the
/// SIMD&FP file, so every load/store path reads them from here.
fn resolve_ldst_offset(offset: &LdStOffset, regs: &RegisterFile) -> i64 {
    match offset {
        LdStOffset::Immediate(imm) => *imm,
        LdStOffset::Register {
            rm,
            extend,
            shift_amount,
        } => {
            let raw = regs.read_gpr(*rm, true);
            let extended = match extend {
                ExtendType::Lsl | ExtendType::Sxtx => raw,
                ExtendType::Uxtw => raw & 0xFFFF_FFFF,
                ExtendType::Sxtw => (raw as i32) as i64 as u64,
            };
            (extended << u64::from(shift_amount.unwrap_or(0))) as i64
        }
    }
}

/// The accessed address and the writeback value (None when the base is
/// left alone) an index mode produces from a base and a displacement.
fn apply_index_mode(base: u64, offset_val: i64, mode: IndexMode) -> (u64, Option<u64>) {
    let moved = (base as i64).wrapping_add(offset_val) as u64;
    match mode {
        IndexMode::PreIndex => (moved, Some(moved)),
        IndexMode::PostIndex => (base, Some(moved)),
        IndexMode::SignedOffset => (moved, None),
    }
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_ldst(
    op: LdStOp, rt: u8, rn: u8, offset: &LdStOffset, size: MemSize,
    mode: IndexMode, regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let offset_val = resolve_ldst_offset(offset, regs);
    let (address, writeback) = apply_index_mode(base, offset_val, mode);

    match op {
        LdStOp::Ldr => {
            check_guest_address(address, crate::errors::MemAccess::Read)?;
            let value = match size {
                MemSize::B => mem.read_u8(address)? as u64,
                MemSize::H => mem.read_u16(address)? as u64,
                MemSize::W => mem.read_u32(address)? as u64,
                MemSize::X => mem.read_u64(address)?,
                // Q is a SIMD&FP width; the integer decode never spells it.
                MemSize::Q => return Err(EmuError::UnknownInstruction(0)),
            };
            regs.write_gpr(rt, true, value);
        }
        LdStOp::Str => {
            check_guest_address(address, crate::errors::MemAccess::Write)?;
            let value = regs.read_gpr(rt, true);
            match size {
                MemSize::B => mem.write_u8(address, value as u8)?,
                MemSize::H => mem.write_u16(address, value as u16)?,
                MemSize::W => mem.write_u32(address, value as u32)?,
                MemSize::X => mem.write_u64(address, value)?,
                // Q is a SIMD&FP width; the integer decode never spells it.
                MemSize::Q => return Err(EmuError::UnknownInstruction(0)),
            }
        }
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_ldst_pair(
    op: LdStPairOp, sf: bool, rt: u8, rt2: u8, rn: u8,
    imm7: i16, mode: IndexMode,
    regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);

    let (address, writeback) = match mode {
        IndexMode::PreIndex => {
            let addr = (base as i64 + imm7 as i64) as u64;
            (addr, Some(addr))
        }
        IndexMode::PostIndex => {
            let wb = (base as i64 + imm7 as i64) as u64;
            (base, Some(wb))
        }
        IndexMode::SignedOffset => {
            let addr = (base as i64 + imm7 as i64) as u64;
            (addr, None)
        }
    };

    let pair_size: u64 = if sf && op != LdStPairOp::Ldpsw { 8 } else { 4 };
    let access = match op {
        LdStPairOp::Ldp | LdStPairOp::Ldpsw => crate::errors::MemAccess::Read,
        LdStPairOp::Stp => crate::errors::MemAccess::Write,
    };
    check_guest_address(address, access)?;
    check_guest_address(address.wrapping_add(pair_size), access)?;

    match op {
        LdStPairOp::Ldp => {
            let v1 = if sf {
                mem.read_u64(address)?
            } else {
                mem.read_u32(address)? as u64
            };
            let v2 = if sf {
                mem.read_u64(address + pair_size)?
            } else {
                mem.read_u32(address + pair_size)? as u64
            };
            regs.write_gpr(rt, sf, v1);
            regs.write_gpr(rt2, sf, v2);
        }
        LdStPairOp::Ldpsw => {
            let v1 = mem.read_u32(address)? as i32 as i64 as u64;
            let v2 = mem.read_u32(address + pair_size)? as i32 as i64 as u64;
            regs.write_gpr(rt, true, v1);
            regs.write_gpr(rt2, true, v2);
        }
        LdStPairOp::Stp => {
            let v1 = regs.read_gpr(rt, sf);
            let v2 = regs.read_gpr(rt2, sf);
            if sf {
                mem.write_u64(address, v1)?;
                mem.write_u64(address + pair_size, v2)?;
            } else {
                mem.write_u32(address, v1 as u32)?;
                mem.write_u32(address + pair_size, v2 as u32)?;
            }
        }
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

/// SIMD&FP LDR/STR at every width the register file has a view for.
/// Base register 31 means SP here, exactly as in the integer load/store
/// path: FP spills sit on the stack. A load writes the scalar view and
/// zeroes every bit above it; a B or H store writes only the low byte or
/// halfword of the register.
#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_fp_ldst(
    load: bool, ft: u8, rn: u8, offset: &LdStOffset, size: MemSize,
    mode: IndexMode, regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let offset_val = resolve_ldst_offset(offset, regs);
    let (address, writeback) = apply_index_mode(base, offset_val, mode);
    check_guest_address(
        address,
        if load {
            crate::errors::MemAccess::Read
        } else {
            crate::errors::MemAccess::Write
        },
    )?;

    if load {
        match size {
            MemSize::B => {
                let v = u64::from(mem.read_u8(address)?);
                regs.write_fpr_scalar(ft, 1, v);
            }
            MemSize::H => {
                let v = u64::from(mem.read_u16(address)?);
                regs.write_fpr_scalar(ft, 2, v);
            }
            MemSize::W => {
                let v = u64::from(mem.read_u32(address)?);
                regs.write_fpr_scalar(ft, 4, v);
            }
            MemSize::X => {
                let v = mem.read_u64(address)?;
                regs.write_fpr_scalar(ft, 8, v);
            }
            MemSize::Q => {
                let v = mem.read_u128(address)?;
                regs.write_fpr_q(ft, v);
            }
        }
    } else {
        match size {
            MemSize::B => mem.write_u8(address, regs.read_fpr_bits(ft) as u8)?,
            MemSize::H => mem.write_u16(address, regs.read_fpr_bits(ft) as u16)?,
            MemSize::W => mem.write_u32(address, regs.read_fpr_bits(ft) as u32)?,
            MemSize::X => mem.write_u64(address, regs.read_fpr_bits(ft))?,
            MemSize::Q => mem.write_u128(address, regs.read_fpr_q(ft))?,
        }
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_fp_ldst_pair(
    op: LdStPairOp, size: MemSize, rt: u8, rt2: u8, rn: u8,
    imm7: i16, mode: IndexMode,
    regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let (address, writeback) = apply_index_mode(base, imm7 as i64, mode);

    let pair_size = u64::from(size.bytes());
    // The SIMD&FP decode never builds LDPSW, so it reads as the plain load.
    let access = match op {
        LdStPairOp::Ldp | LdStPairOp::Ldpsw => crate::errors::MemAccess::Read,
        LdStPairOp::Stp => crate::errors::MemAccess::Write,
    };
    check_guest_address(address, access)?;
    check_guest_address(address.wrapping_add(pair_size), access)?;
    let second = address.wrapping_add(pair_size);

    match op {
        LdStPairOp::Ldp | LdStPairOp::Ldpsw => match size {
            // Each element is a scalar destination, so the bits above the
            // loaded width go to zero, like the single-register load.
            MemSize::W => {
                regs.write_fpr_scalar(rt, 4, u64::from(mem.read_u32(address)?));
                regs.write_fpr_scalar(rt2, 4, u64::from(mem.read_u32(second)?));
            }
            MemSize::X => {
                regs.write_fpr_scalar(rt, 8, mem.read_u64(address)?);
                regs.write_fpr_scalar(rt2, 8, mem.read_u64(second)?);
            }
            MemSize::Q => {
                regs.write_fpr_q(rt, mem.read_u128(address)?);
                regs.write_fpr_q(rt2, mem.read_u128(second)?);
            }
            // opc 11 is unallocated, so the decoder never builds a B or H
            // pair.
            MemSize::B | MemSize::H => return Err(EmuError::UnknownInstruction(0)),
        },
        LdStPairOp::Stp => match size {
            MemSize::W => {
                mem.write_u32(address, regs.read_fpr_bits(rt) as u32)?;
                mem.write_u32(second, regs.read_fpr_bits(rt2) as u32)?;
            }
            MemSize::X => {
                mem.write_u64(address, regs.read_fpr_bits(rt))?;
                mem.write_u64(second, regs.read_fpr_bits(rt2))?;
            }
            MemSize::Q => {
                mem.write_u128(address, regs.read_fpr_q(rt))?;
                mem.write_u128(second, regs.read_fpr_q(rt2))?;
            }
            MemSize::B | MemSize::H => return Err(EmuError::UnknownInstruction(0)),
        },
    }

    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }

    Ok(ExecResult::Advance)
}

/// One element of `esize` bytes, zero-extended.
fn read_element(mem: &Memory, addr: u64, esize: u8) -> Result<u64, EmuError> {
    Ok(match esize {
        1 => u64::from(mem.read_u8(addr)?),
        2 => u64::from(mem.read_u16(addr)?),
        4 => u64::from(mem.read_u32(addr)?),
        _ => mem.read_u64(addr)?,
    })
}

fn write_element(mem: &mut Memory, addr: u64, esize: u8, value: u64) -> Result<(), EmuError> {
    match esize {
        1 => mem.write_u8(addr, value as u8),
        2 => mem.write_u16(addr, value as u16),
        4 => mem.write_u32(addr, value as u32),
        _ => mem.write_u64(addr, value),
    }
}

/// LD1-LD4 / ST1-ST4 in all three shapes.
///
/// The bytes are consumed in address order and the register list is
/// walked in step with them, which is what makes a load de-interleave
/// and a store interleave: `ld2 {v3.8b, v4.8b}` puts the byte at +0 in
/// v3 lane 0 and the byte at +1 in v4 lane 0, so v3 ends up holding
/// every even byte and v4 every odd one. LD1/ST1 with more than one
/// register is the degenerate case: one structure per element, so each
/// register is simply filled in turn. A 64-bit arrangement zeroes bits
/// 127:64 of every destination, like any other write below the full
/// width; the single-lane shape is the one that does not, because it
/// writes one lane and leaves the register around it alone.
#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_simd_ldst_structure(
    load: bool, structures: u8, count: u8, esize: u8, q: bool,
    shape: SimdStructShape, rt: u8, rn: u8, post: Option<u8>,
    regs: &mut RegisterFile, mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let total = simd_struct_bytes(shape, count, esize, q);
    let access = if load {
        crate::errors::MemAccess::Read
    } else {
        crate::errors::MemAccess::Write
    };
    check_guest_address(base, access)?;
    check_guest_address(base.wrapping_add(total - 1), access)?;

    // The register list wraps past v31, so every index goes through here.
    let reg_at = |step: u32| ((u32::from(rt) + step) % 32) as u8;

    match shape {
        SimdStructShape::Multiple => {
            let lanes = if q { 16u32 } else { 8 } / u32::from(esize);
            // A load writes every lane, so zeroing first is all the
            // upper-half rule needs.
            if load && !q {
                for step in 0..u32::from(count) {
                    regs.write_fpr_q(reg_at(step), 0);
                }
            }
            let repeats = u32::from(count / structures);
            let mut offset = 0u64;
            for repeat in 0..repeats {
                for lane in 0..lanes {
                    for slot in 0..u32::from(structures) {
                        let reg = reg_at(repeat * u32::from(structures) + slot);
                        let addr = base.wrapping_add(offset);
                        if load {
                            let value = read_element(mem, addr, esize)?;
                            regs.write_fpr_lane(reg, esize, lane as u8, value);
                        } else {
                            let value = regs.read_fpr_lane(reg, esize, lane as u8);
                            write_element(mem, addr, esize, value)?;
                        }
                        offset += u64::from(esize);
                    }
                }
            }
        }
        SimdStructShape::Lane(index) => {
            for slot in 0..u32::from(count) {
                let reg = reg_at(slot);
                let addr = base.wrapping_add(u64::from(slot) * u64::from(esize));
                if load {
                    let value = read_element(mem, addr, esize)?;
                    regs.write_fpr_lane(reg, esize, index, value);
                } else {
                    let value = regs.read_fpr_lane(reg, esize, index);
                    write_element(mem, addr, esize, value)?;
                }
            }
        }
        SimdStructShape::Replicate => {
            let lanes = if q { 16u32 } else { 8 } / u32::from(esize);
            for slot in 0..u32::from(count) {
                let addr = base.wrapping_add(u64::from(slot) * u64::from(esize));
                let value = u128::from(read_element(mem, addr, esize)?);
                let mut filled = 0u128;
                for lane in 0..lanes {
                    filled |= value << (lane * u32::from(esize) * 8);
                }
                // Writing the whole register is what zeroes the upper
                // half of a 64-bit arrangement.
                regs.write_fpr_q(reg_at(slot), filled);
            }
        }
    }

    if let Some(rm) = post {
        // Rm 31 is the immediate form: the total bytes moved, which the
        // word does not spell because there is only one legal value.
        let step = if rm == 31 { total } else { regs.read_gpr(rm, true) };
        regs.write_gpr_or_sp(rn, true, base.wrapping_add(step));
    }

    Ok(ExecResult::Advance)
}

pub(super) fn exec_ldr_literal(
    sf: bool,
    rt: u8,
    offset: i64,
    regs: &mut RegisterFile,
    mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    let pc = regs.read_pc();
    let target = (pc as i64).wrapping_add(offset) as u64;
    if sf {
        let value = mem.read_u64(target)?;
        regs.write_gpr(rt, true, value);
    } else {
        let value = mem.read_u32(target)? as u64;
        regs.write_gpr(rt, false, value);
    }
    Ok(ExecResult::Advance)
}

/// LDR (literal) of a SIMD&FP register: the PC-relative load the linker
/// never emits (the hosted pipeline lowers `ldr s0, label` to two words)
/// but gcc output can carry.
pub(super) fn exec_fp_ldr_literal(
    rt: u8,
    offset: i64,
    size: MemSize,
    regs: &mut RegisterFile,
    mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    let target = (regs.read_pc() as i64).wrapping_add(offset) as u64;
    check_guest_address(target, crate::errors::MemAccess::Read)?;
    match size {
        MemSize::W => regs.write_fpr_scalar(rt, 4, u64::from(mem.read_u32(target)?)),
        MemSize::X => regs.write_fpr_scalar(rt, 8, mem.read_u64(target)?),
        MemSize::Q => regs.write_fpr_q(rt, mem.read_u128(target)?),
        // opc 11 is unallocated, so the decoder never builds these.
        MemSize::B | MemSize::H => return Err(EmuError::UnknownInstruction(0)),
    }
    Ok(ExecResult::Advance)
}

#[allow(clippy::too_many_arguments)] // operands mirror the instruction's fields
pub(super) fn exec_ldrs(
    rt: u8,
    rn: u8,
    offset: &LdStOffset,
    size: MemSize,
    mode: IndexMode,
    sf: bool,
    regs: &mut RegisterFile,
    mem: &mut Memory,
) -> Result<ExecResult, EmuError> {
    // Compute the effective address using the same offset math as exec_ldst.
    check_sp_alignment(rn, regs)?;
    let base = regs.read_gpr_or_sp(rn, true);
    let offset_val = resolve_ldst_offset(offset, regs);
    let (address, writeback) = apply_index_mode(base, offset_val, mode);
    check_guest_address(address, crate::errors::MemAccess::Read)?;
    let value_64 = match size {
        MemSize::B => (mem.read_u8(address)? as i8) as i64,
        MemSize::H => (mem.read_u16(address)? as i16) as i64,
        MemSize::W => (mem.read_u32(address)? as i32) as i64,
        // X is reserved in the sign-extending space and Q is SIMD&FP only.
        MemSize::X | MemSize::Q => return Err(EmuError::UnknownInstruction(0)),
    };
    if sf {
        regs.write_gpr(rt, true, value_64 as u64);
    } else {
        // Write low 32 bits; write_gpr with sf=false zeros upper bits.
        regs.write_gpr(rt, false, (value_64 as u32) as u64);
    }
    if let Some(wb) = writeback {
        regs.write_gpr_or_sp(rn, true, wb);
    }
    Ok(ExecResult::Advance)
}
