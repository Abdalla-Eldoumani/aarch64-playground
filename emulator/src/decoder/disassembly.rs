//! `format`: the text GNU as would print back for a decoded SIMD&FP
//! instruction, so a test can hold an encoding to the way objdump reads it.

use super::*;

/// The short decimal GAS spells a vector FMOV immediate with (`#1.0`,
/// `#-2.5`, `#0.5`). Every VFP 8-bit float is a multiple of 1/128, so
/// seven places is exact and the trailing zeros come off.
fn fmov_imm_text(imm8: u8) -> String {
    let value = f64::from_bits(expand_fmov_imm8(imm8));
    let text = format!("{value:.7}");
    let trimmed = text.trim_end_matches('0');
    if trimmed.ends_with('.') {
        format!("{trimmed}0")
    } else {
        trimmed.to_string()
    }
}

// ---------------------------------------------------------------------------
// SIMD&FP disassembly
// ---------------------------------------------------------------------------

/// The register-name prefix a SIMD&FP access width is spelled with.
fn fp_reg_letter(size: MemSize) -> char {
    match size {
        MemSize::B => 'b',
        MemSize::H => 'h',
        MemSize::W => 's',
        MemSize::X => 'd',
        MemSize::Q => 'q',
    }
}

/// A base register in an address: 31 is SP, never XZR.
fn base_name(rn: u8) -> String {
    if rn >= 31 { "sp".to_string() } else { format!("x{rn}") }
}

/// `#8`, `#-3`, in the decimal objdump prints offsets with.
fn imm_text(offset: i64) -> String {
    format!("#{offset}")
}

/// The address operand of a single-register load/store, GAS spelling.
fn address_text(rn: u8, offset: &LdStOffset, mode: IndexMode) -> String {
    let base = base_name(rn);
    match offset {
        LdStOffset::Immediate(imm) => match mode {
            IndexMode::PreIndex => format!("[{base}, {}]!", imm_text(*imm)),
            IndexMode::PostIndex => format!("[{base}], {}", imm_text(*imm)),
            IndexMode::SignedOffset if *imm == 0 => format!("[{base}]"),
            IndexMode::SignedOffset => format!("[{base}, {}]", imm_text(*imm)),
        },
        LdStOffset::Register {
            rm,
            extend,
            shift_amount,
        } => {
            // UXTW and SXTW take a W index; LSL, UXTX and SXTX take an X.
            let (index, keyword) = match extend {
                ExtendType::Uxtw => (format!("w{rm}"), "uxtw"),
                ExtendType::Sxtw => (format!("w{rm}"), "sxtw"),
                ExtendType::Sxtx => (format!("x{rm}"), "sxtx"),
                ExtendType::Lsl => (format!("x{rm}"), "lsl"),
            };
            match shift_amount {
                // A cleared S bit on an LSL index is the bare `[Xn, Xm]`
                // spelling; every other combination names its keyword.
                None if matches!(extend, ExtendType::Lsl) => format!("[{base}, {index}]"),
                None => format!("[{base}, {index}, {keyword}]"),
                Some(n) => format!("[{base}, {index}, {keyword} #{n}]"),
            }
        }
    }
}

/// GAS text for the SIMD&FP instructions this crate decodes, for the
/// conformance suite that replays the csarm inventory. `None` for
/// everything else: the general disassembly the UI shows is built in the
/// web layer, and this exists to prove an encoding round-trips.
pub fn format(instr: &Instruction) -> Option<String> {
    match instr {
        Instruction::FpLdSt {
            load,
            ft,
            rn,
            offset,
            size,
            mode,
            unscaled,
        } => {
            let mnemonic = match (*load, *unscaled) {
                (true, false) => "ldr",
                (false, false) => "str",
                (true, true) => "ldur",
                (false, true) => "stur",
            };
            let reg = fp_reg_letter(*size);
            Some(format!(
                "{mnemonic} {reg}{ft}, {}",
                address_text(*rn, offset, *mode)
            ))
        }
        Instruction::FpLdStPair {
            op,
            size,
            rt,
            rt2,
            rn,
            imm7,
            mode,
            no_allocate,
        } => {
            let mnemonic = match (op, *no_allocate) {
                (LdStPairOp::Ldp, false) => "ldp",
                (LdStPairOp::Stp, false) => "stp",
                (LdStPairOp::Ldp, true) => "ldnp",
                (LdStPairOp::Stp, true) => "stnp",
                // Integer only; the SIMD&FP decode never builds it.
                (LdStPairOp::Ldpsw, _) => "ldpsw",
            };
            let reg = fp_reg_letter(*size);
            let address = address_text(*rn, &LdStOffset::Immediate(i64::from(*imm7)), *mode);
            Some(format!("{mnemonic} {reg}{rt}, {reg}{rt2}, {address}"))
        }
        Instruction::SimdLdStStructure {
            load,
            structures,
            count,
            esize,
            q,
            shape,
            rt,
            rn,
            post,
        } => {
            let replicate = matches!(shape, SimdStructShape::Replicate);
            let head = if *load { "ld" } else { "st" };
            let tail = if replicate { "r" } else { "" };
            // GAS prints a list of more than one register as a range,
            // and the range wraps past v31 exactly as the list does.
            let element = |t: &str| {
                if *count == 1 {
                    format!("{{v{rt}.{t}}}")
                } else {
                    let last = (u32::from(*rt) + u32::from(*count) - 1) % 32;
                    format!("{{v{rt}.{t}-v{last}.{t}}}")
                }
            };
            let list = match shape {
                SimdStructShape::Lane(index) => {
                    let letter = element_letter(*esize).to_string();
                    format!("{}[{index}]", element(&letter))
                }
                _ => element(Arrangement { esize: *esize, q: *q }.suffix()),
            };
            let address = match post {
                None => format!("[{}]", base_name(*rn)),
                Some(31) => format!(
                    "[{}], #{}",
                    base_name(*rn),
                    simd_struct_bytes(*shape, *count, *esize, *q)
                ),
                Some(rm) => format!("[{}], x{rm}", base_name(*rn)),
            };
            Some(format!("{head}{structures}{tail} {list}, {address}"))
        }
        Instruction::FpLdrLiteral { rt, offset, size } => {
            let reg = fp_reg_letter(*size);
            Some(format!("ldr {reg}{rt}, {}", imm_text(*offset)))
        }
        Instruction::FpMoveLane { to_fp, rd, rn } => Some(if *to_fp {
            format!("fmov v{rd}.d[1], x{rn}")
        } else {
            format!("fmov x{rd}, v{rn}.d[1]")
        }),
        Instruction::SimdModifiedImm { op, arrangement, rd, value, imm8, shift, msl } => {
            // FMOV's immediate is a float, and GAS prints the short
            // decimal the line was written with, not a bit pattern.
            if *op == SimdImmOp::Fmov {
                let a = arrangement.expect("the vector fmov immediate names an arrangement");
                return Some(format!("fmov v{rd}.{}, #{}", a.suffix(), fmov_imm_text(*imm8)));
            }
            let mnemonic = match op {
                SimdImmOp::Movi => "movi",
                SimdImmOp::Mvni => "mvni",
                SimdImmOp::Orr => "orr",
                SimdImmOp::Bic => "bic",
                SimdImmOp::Fmov => unreachable!("handled above"),
            };
            let dest = match arrangement {
                Some(a) => format!("v{rd}.{}", a.suffix()),
                None => format!("d{rd}"),
            };
            // The byte-mask forms print the immediate they expand to;
            // every other form prints imm8 and its shift as written.
            let byte_mask = arrangement.is_none_or(|a| a.esize == 8);
            let imm = if byte_mask { *value as u64 } else { u64::from(*imm8) };
            let suffix = match (byte_mask || *shift == 0, *msl) {
                (true, _) => String::new(),
                (false, false) => format!(", lsl #{shift}"),
                (false, true) => format!(", msl #{shift}"),
            };
            Some(format!("{mnemonic} {dest}, #{imm:#x}{suffix}"))
        }
        Instruction::SimdLogicalReg { op, q, rm, rn, rd } => {
            let t = if *q { "16b" } else { "8b" };
            // GAS prints `orr Vd.T, Vn.T, Vn.T` as the vector `mov`.
            if *op == SimdLogicalOp::Orr && rn == rm {
                return Some(format!("mov v{rd}.{t}, v{rn}.{t}"));
            }
            let mnemonic = simd_logical_name(*op);
            Some(format!("{mnemonic} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdThreeSame { op, esize, q, scalar, rm, rn, rd } => {
            let name = simd_same_row(*op).name;
            if *scalar {
                let l = element_letter(*esize);
                return Some(format!("{name} {l}{rd}, {l}{rn}, {l}{rm}"));
            }
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdTwoMisc { op, esize, q, scalar, rn, rd } => {
            let row = simd_misc_row(*op);
            let zero = if row.shape == SimdMiscShape::Zero { ", #0" } else { "" };
            let narrowing = row.shape == SimdMiscShape::Narrow;
            if *scalar {
                let l = element_letter(*esize);
                // A narrowing extract reads a lane of twice its result.
                let source = if narrowing { element_letter(esize * 2) } else { l };
                return Some(format!("{} {l}{rd}, {source}{rn}{zero}", row.name));
            }
            let narrow = Arrangement { esize: *esize, q: *q }.suffix();
            let wide = Arrangement { esize: esize * 2, q: true }.suffix();
            // The `2` suffix IS the Q bit for the rows that change width:
            // it names the half of the register the narrow side lives in.
            let two = if *q { "2" } else { "" };
            if narrowing {
                return Some(format!("{}{two} v{rd}.{narrow}, v{rn}.{wide}", row.name));
            }
            if row.shape == SimdMiscShape::Shll {
                let amount = u32::from(*esize) * 8;
                return Some(format!("{}{two} v{rd}.{wide}, v{rn}.{narrow}, #{amount}", row.name));
            }
            // The pairwise widening rows halve the lane count and double
            // the width, so the destination is spelled one step up.
            let dest = if row.shape == SimdMiscShape::Widen {
                Arrangement { esize: esize * 2, q: *q }.suffix()
            } else {
                narrow
            };
            Some(format!("{} v{rd}.{dest}, v{rn}.{narrow}{zero}", row.name))
        }
        Instruction::SimdThreeDiff { op, esize, upper, scalar, rm, rn, rd } => {
            let row = simd_diff_row(*op);
            if *scalar {
                let narrow = element_letter(*esize);
                let wide = element_letter(esize * 2);
                return Some(format!("{} {wide}{rd}, {narrow}{rn}, {narrow}{rm}", row.name));
            }
            let two = if *upper { "2" } else { "" };
            let narrow = Arrangement { esize: *esize, q: *upper }.suffix();
            let wide = Arrangement { esize: esize * 2, q: true }.suffix();
            let name = row.name;
            Some(match row.shape {
                SimdDiffShape::Long => {
                    format!("{name}{two} v{rd}.{wide}, v{rn}.{narrow}, v{rm}.{narrow}")
                }
                SimdDiffShape::Wide => {
                    format!("{name}{two} v{rd}.{wide}, v{rn}.{wide}, v{rm}.{narrow}")
                }
                SimdDiffShape::Narrow => {
                    format!("{name}{two} v{rd}.{narrow}, v{rn}.{wide}, v{rm}.{wide}")
                }
            })
        }
        Instruction::SimdShiftImm { op, esize, q, scalar, shift, rn, rd } => {
            let row = simd_shift_row(*op);
            let name = row.name;
            if *scalar {
                let narrow = element_letter(*esize);
                let source = if row.shape == SimdShiftShape::Narrow {
                    element_letter(esize * 2)
                } else {
                    narrow
                };
                return Some(format!("{name} {narrow}{rd}, {source}{rn}, #{shift}"));
            }
            let two = if *q { "2" } else { "" };
            let narrow = Arrangement { esize: *esize, q: *q }.suffix();
            let wide = Arrangement { esize: esize * 2, q: true }.suffix();
            Some(match row.shape {
                SimdShiftShape::Same => {
                    format!("{name} v{rd}.{narrow}, v{rn}.{narrow}, #{shift}")
                }
                // GAS spells the lengthening shift by zero SXTL / UXTL,
                // which is the whole of what those two mnemonics are.
                SimdShiftShape::Long if *shift == 0 => {
                    let alias = if row.u { "uxtl" } else { "sxtl" };
                    format!("{alias}{two} v{rd}.{wide}, v{rn}.{narrow}")
                }
                SimdShiftShape::Long => {
                    format!("{name}{two} v{rd}.{wide}, v{rn}.{narrow}, #{shift}")
                }
                SimdShiftShape::Narrow => {
                    format!("{name}{two} v{rd}.{narrow}, v{rn}.{wide}, #{shift}")
                }
            })
        }
        Instruction::SimdAcross { op, esize, q, rn, rd } => {
            let row = simd_across_row(*op);
            let dest = element_letter(if row.widen { esize * 2 } else { *esize });
            let source = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{} {dest}{rd}, v{rn}.{source}", row.name))
        }
        Instruction::SimdPermute { op, esize, q, rm, rn, rd } => {
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            let name = simd_permute_name(*op);
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdExt { q, index, rm, rn, rd } => {
            let t = if *q { "16b" } else { "8b" };
            Some(format!("ext v{rd}.{t}, v{rn}.{t}, v{rm}.{t}, #{index}"))
        }
        Instruction::SimdTableLookup { extend, q, len, rm, rn, rd } => {
            let name = if *extend { "tbx" } else { "tbl" };
            let t = if *q { "16b" } else { "8b" };
            // GAS prints a table of more than one register as a range,
            // and the range wraps past v31 exactly as the table does.
            let table = if *len == 1 {
                format!("{{v{rn}.16b}}")
            } else {
                let last = (u32::from(*rn) + u32::from(*len) - 1) % 32;
                format!("{{v{rn}.16b-v{last}.16b}}")
            };
            Some(format!("{name} v{rd}.{t}, {table}, v{rm}.{t}"))
        }
        Instruction::SimdByElement { op, esize, q, scalar, index, rm, rn, rd } => {
            let row = simd_elem_row(*op);
            let elem = element_letter(*esize);
            let name = row.name;
            match row.kind {
                SimdElemKind::Same(_) if *scalar => {
                    Some(format!("{name} {elem}{rd}, {elem}{rn}, v{rm}.{elem}[{index}]"))
                }
                SimdElemKind::Same(_) => {
                    let t = Arrangement { esize: *esize, q: *q }.suffix();
                    Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{elem}[{index}]"))
                }
                // The scalar long form writes twice what it reads, the
                // way the three-different scalar rows do.
                SimdElemKind::Long(_) if *scalar => {
                    let wide = element_letter(esize * 2);
                    Some(format!("{name} {wide}{rd}, {elem}{rn}, v{rm}.{elem}[{index}]"))
                }
                SimdElemKind::Long(_) => {
                    let two = if *q { "2" } else { "" };
                    let narrow = Arrangement { esize: *esize, q: *q }.suffix();
                    let wide = Arrangement { esize: esize * 2, q: true }.suffix();
                    Some(format!(
                        "{name}{two} v{rd}.{wide}, v{rn}.{narrow}, v{rm}.{elem}[{index}]"
                    ))
                }
            }
        }
        Instruction::SimdFpThreeSame { op, esize, q, scalar, rm, rn, rd } => {
            let name = simd_fp_same_row(*op).name;
            if *scalar {
                let l = element_letter(*esize);
                return Some(format!("{name} {l}{rd}, {l}{rn}, {l}{rm}"));
            }
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{t}"))
        }
        Instruction::SimdFpTwoMisc { op, esize, q, scalar, fbits, rn, rd } => {
            let row = simd_fp_misc_row(*op);
            let name = row.name;
            let tail = if row.shape == SimdFpMiscShape::Zero {
                ", #0.0".to_string()
            } else if *fbits != 0 {
                format!(", #{fbits}")
            } else {
                String::new()
            };
            if *scalar {
                let l = element_letter(*esize);
                // A narrowing convert writes half the width it reads.
                if row.shape == SimdFpMiscShape::Narrow {
                    let half = element_letter(*esize / 2);
                    return Some(format!("{name} {half}{rd}, {l}{rn}"));
                }
                return Some(format!("{name} {l}{rd}, {l}{rn}{tail}"));
            }
            // The `2` suffix IS the Q bit on the rows that change width:
            // it names the half of the register the narrow side lives in.
            let two = if *q { "2" } else { "" };
            let wide = Arrangement { esize: *esize, q: true }.suffix();
            let half = Arrangement { esize: *esize / 2, q: *q }.suffix();
            Some(match row.shape {
                SimdFpMiscShape::Narrow => format!("{name}{two} v{rd}.{half}, v{rn}.{wide}"),
                SimdFpMiscShape::Long => format!("{name}{two} v{rd}.{wide}, v{rn}.{half}"),
                _ => {
                    let t = Arrangement { esize: *esize, q: *q }.suffix();
                    format!("{name} v{rd}.{t}, v{rn}.{t}{tail}")
                }
            })
        }
        Instruction::SimdFpAcross { op, esize, q, rn, rd } => {
            let row = simd_fp_across_row(*op);
            // The scalar pairwise class always folds a pair, so its
            // source is 2s or 2d whatever bit 30 says.
            let source = if row.scalar_class {
                Arrangement { esize: *esize, q: *esize == 8 }
            } else {
                Arrangement { esize: *esize, q: *q }
            };
            let dest = element_letter(*esize);
            Some(format!("{} {dest}{rd}, v{rn}.{}", row.name, source.suffix()))
        }
        Instruction::SimdFpByElement { op, esize, q, scalar, index, rm, rn, rd } => {
            let name = simd_fp_elem_row(*op).name;
            let elem = element_letter(*esize);
            if *scalar {
                return Some(format!("{name} {elem}{rd}, {elem}{rn}, v{rm}.{elem}[{index}]"));
            }
            let t = Arrangement { esize: *esize, q: *q }.suffix();
            Some(format!("{name} v{rd}.{t}, v{rn}.{t}, v{rm}.{elem}[{index}]"))
        }
        Instruction::SimdCopy { op, esize, q, index, index2, rn, rd } => {
            let elem = element_letter(*esize);
            let arrangement = Arrangement { esize: *esize, q: *q };
            let gp = |wide: bool, reg: u8| format!("{}{reg}", if wide { 'x' } else { 'w' });
            Some(match op {
                SimdCopyOp::DupGeneral => format!(
                    "dup v{rd}.{}, {}",
                    arrangement.suffix(),
                    gp(*esize == 8, *rn)
                ),
                SimdCopyOp::DupElement => format!(
                    "dup v{rd}.{}, v{rn}.{elem}[{index}]",
                    arrangement.suffix()
                ),
                SimdCopyOp::DupScalar => format!("mov {elem}{rd}, v{rn}.{elem}[{index}]"),
                SimdCopyOp::InsGeneral => {
                    format!("mov v{rd}.{elem}[{index}], {}", gp(*esize == 8, *rn))
                }
                SimdCopyOp::InsElement => {
                    format!("mov v{rd}.{elem}[{index}], v{rn}.{elem}[{index2}]")
                }
                // UMOV of a whole-register-width lane is the general
                // `mov`, which is the spelling GAS prints back for it.
                SimdCopyOp::Umov => {
                    let full = *esize == if *q { 8 } else { 4 };
                    let mnemonic = if full { "mov" } else { "umov" };
                    format!("{mnemonic} {}, v{rn}.{elem}[{index}]", gp(*q, *rd))
                }
                SimdCopyOp::Smov => format!("smov {}, v{rn}.{elem}[{index}]", gp(*q, *rd)),
            })
        }
        _ => None,
    }
}
