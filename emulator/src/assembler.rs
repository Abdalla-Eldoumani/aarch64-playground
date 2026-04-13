use std::collections::HashMap;

use crate::errors::EmuError;

/// Assemble ARM64 source text into a vector of 32-bit instruction words.
///
/// Supports labels (word followed by colon), the instruction subset defined
/// in the project spec, and common pseudo-instructions (MOV, CMP, NEG, etc.).
pub fn assemble(source: &str) -> Result<Vec<u32>, EmuError> {
    let lines = preprocess(source);

    // pass 1: collect labels
    let mut labels: HashMap<String, u64> = HashMap::new();
    let mut instr_count: u64 = 0;
    for (line_num, line) in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(label) = trimmed.strip_suffix(':') {
            let name = label.trim().to_lowercase();
            if name.is_empty() {
                return asm_err(*line_num, "empty label");
            }
            labels.insert(name, instr_count * 4);
        } else {
            instr_count += 1;
        }
    }

    // pass 2: encode instructions
    let mut code: Vec<u32> = Vec::new();
    let mut pc: u64 = 0;
    for (line_num, line) in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.ends_with(':') {
            continue;
        }
        let word = encode_line(trimmed, pc, &labels, *line_num)?;
        code.push(word);
        pc += 4;
    }

    Ok(code)
}

// ---------------------------------------------------------------------------
// preprocessing
// ---------------------------------------------------------------------------

fn preprocess(source: &str) -> Vec<(usize, String)> {
    source
        .lines()
        .enumerate()
        .map(|(i, line)| {
            // strip comments
            let without_comment = if let Some(pos) = line.find("//") {
                &line[..pos]
            } else if let Some(pos) = line.find(';') {
                &line[..pos]
            } else {
                line
            };
            (i + 1, without_comment.trim().to_string())
        })
        .collect()
}

// ---------------------------------------------------------------------------
// line encoding
// ---------------------------------------------------------------------------

fn encode_line(
    line: &str,
    pc: u64,
    labels: &HashMap<String, u64>,
    line_num: usize,
) -> Result<u32, EmuError> {
    let (mnemonic, operands) = split_mnemonic(line);
    let mn = mnemonic.to_uppercase();
    let ops: Vec<&str> = if operands.is_empty() {
        vec![]
    } else {
        split_operands(operands)
    };

    match mn.as_str() {
        // -- moves --
        "MOV" => encode_mov(&ops, line_num),
        "MOVZ" => encode_movzk(&ops, 0b10, line_num),
        "MOVK" => encode_movzk(&ops, 0b11, line_num),
        "MOVN" => encode_movzk(&ops, 0b00, line_num),

        // -- arithmetic immediate / register --
        "ADD" => encode_dp(&ops, 0, 0, line_num),
        "ADDS" => encode_dp(&ops, 0, 1, line_num),
        "SUB" => encode_dp(&ops, 1, 0, line_num),
        "SUBS" => encode_dp(&ops, 1, 1, line_num),

        // -- compare (aliases) --
        "CMP" => encode_cmp(&ops, 1, line_num),
        "CMN" => encode_cmp(&ops, 0, line_num),

        // -- logical --
        "AND" => encode_log_reg(&ops, 0b00, false, false, line_num),
        "ANDS" => encode_log_reg(&ops, 0b11, false, false, line_num),
        "ORR" => encode_log_reg(&ops, 0b01, false, false, line_num),
        "EOR" => encode_log_reg(&ops, 0b10, false, false, line_num),
        "MVN" => encode_mvn(&ops, line_num),
        "TST" => encode_tst(&ops, line_num),

        // -- shifts (immediate forms via UBFM/SBFM) --
        "LSL" => encode_shift(&ops, 0, line_num),
        "LSR" => encode_shift(&ops, 1, line_num),
        "ASR" => encode_shift(&ops, 2, line_num),

        // -- multiply / divide --
        "MUL" => encode_mul_div(&ops, 0, line_num),
        "UDIV" => encode_mul_div(&ops, 1, line_num),
        "SDIV" => encode_mul_div(&ops, 2, line_num),
        "NEG" => encode_neg(&ops, line_num),

        // -- memory --
        "LDR" => encode_ldst(&ops, 1, 0b11, line_num),
        "STR" => encode_ldst(&ops, 0, 0b11, line_num),
        "LDRB" => encode_ldst(&ops, 1, 0b00, line_num),
        "STRB" => encode_ldst(&ops, 0, 0b00, line_num),
        "LDRH" => encode_ldst(&ops, 1, 0b01, line_num),
        "STRH" => encode_ldst(&ops, 0, 0b01, line_num),
        "LDP" => encode_ldst_pair(&ops, 1, line_num),
        "STP" => encode_ldst_pair(&ops, 0, line_num),

        // -- branches --
        "B" => encode_branch_imm(&ops, false, pc, labels, line_num),
        "BL" => encode_branch_imm(&ops, true, pc, labels, line_num),
        "BR" => encode_branch_reg(&ops, 0b0000, line_num),
        "BLR" => encode_branch_reg(&ops, 0b0001, line_num),
        "RET" => encode_ret(&ops, line_num),

        // -- conditional branches --
        "B.EQ" => encode_bcond(&ops, 0b0000, pc, labels, line_num),
        "B.NE" => encode_bcond(&ops, 0b0001, pc, labels, line_num),
        "B.HS" | "B.CS" => encode_bcond(&ops, 0b0010, pc, labels, line_num),
        "B.LO" | "B.CC" => encode_bcond(&ops, 0b0011, pc, labels, line_num),
        "B.MI" => encode_bcond(&ops, 0b0100, pc, labels, line_num),
        "B.PL" => encode_bcond(&ops, 0b0101, pc, labels, line_num),
        "B.VS" => encode_bcond(&ops, 0b0110, pc, labels, line_num),
        "B.VC" => encode_bcond(&ops, 0b0111, pc, labels, line_num),
        "B.HI" => encode_bcond(&ops, 0b1000, pc, labels, line_num),
        "B.LS" => encode_bcond(&ops, 0b1001, pc, labels, line_num),
        "B.GE" => encode_bcond(&ops, 0b1010, pc, labels, line_num),
        "B.LT" => encode_bcond(&ops, 0b1011, pc, labels, line_num),
        "B.GT" => encode_bcond(&ops, 0b1100, pc, labels, line_num),
        "B.LE" => encode_bcond(&ops, 0b1101, pc, labels, line_num),

        // -- conditional select --
        "CSEL" => encode_cond_sel(&ops, 0, line_num),
        "CSINC" => encode_cond_sel(&ops, 1, line_num),
        "CSET" => encode_cset(&ops, line_num),

        // -- system --
        "NOP" => Ok(0xD503_201F),
        "SVC" => encode_svc(&ops, line_num),

        _ => asm_err(line_num, &format!("unknown mnemonic: {mn}")),
    }
}

// ---------------------------------------------------------------------------
// operand parsing helpers
// ---------------------------------------------------------------------------

fn split_mnemonic(line: &str) -> (&str, &str) {
    let line = line.trim();
    if let Some(pos) = line.find(|c: char| c.is_whitespace()) {
        let mn = &line[..pos];
        let rest = line[pos..].trim();
        (mn, rest)
    } else {
        (line, "")
    }
}

fn split_operands(s: &str) -> Vec<&str> {
    // split on commas but keep bracket groups together
    let mut result = Vec::new();
    let mut depth = 0;
    let mut start = 0;
    for (i, c) in s.char_indices() {
        match c {
            '[' => depth += 1,
            ']' => depth -= 1,
            ',' if depth == 0 => {
                result.push(s[start..i].trim());
                start = i + 1;
            }
            _ => {}
        }
    }
    let last = s[start..].trim();
    if !last.is_empty() {
        result.push(last);
    }
    result
}

fn parse_register(s: &str, line_num: usize) -> Result<(u8, bool), EmuError> {
    let s = s.trim().to_uppercase();
    match s.as_str() {
        "SP" => Ok((31, true)), // sf=true for SP
        "XZR" => Ok((31, true)),
        "WZR" => Ok((31, false)),
        _ => {
            let (prefix, sf) = if let Some(rest) = s.strip_prefix('X') {
                (rest, true)
            } else if let Some(rest) = s.strip_prefix('W') {
                (rest, false)
            } else {
                return asm_err(line_num, &format!("expected register, got: {s}"));
            };
            let num: u8 = prefix
                .parse()
                .map_err(|_| asm_error(line_num, &format!("invalid register: {s}")))?;
            if num > 30 {
                return asm_err(line_num, &format!("register index out of range: {s}"));
            }
            Ok((num, sf))
        }
    }
}

fn parse_immediate(s: &str, line_num: usize) -> Result<i64, EmuError> {
    let s = s.trim();
    let s = s.strip_prefix('#').unwrap_or(s);
    let s = s.trim();

    let negative = s.starts_with('-');
    let s = if negative { &s[1..] } else { s };

    let val: u64 = if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u64::from_str_radix(hex, 16)
            .map_err(|_| asm_error(line_num, &format!("invalid hex immediate: {s}")))?
    } else {
        s.parse()
            .map_err(|_| asm_error(line_num, &format!("invalid immediate: {s}")))?
    };

    Ok(if negative { -(val as i64) } else { val as i64 })
}

fn parse_condition(s: &str, line_num: usize) -> Result<u8, EmuError> {
    match s.trim().to_uppercase().as_str() {
        "EQ" => Ok(0b0000),
        "NE" => Ok(0b0001),
        "HS" | "CS" => Ok(0b0010),
        "LO" | "CC" => Ok(0b0011),
        "MI" => Ok(0b0100),
        "PL" => Ok(0b0101),
        "VS" => Ok(0b0110),
        "VC" => Ok(0b0111),
        "HI" => Ok(0b1000),
        "LS" => Ok(0b1001),
        "GE" => Ok(0b1010),
        "LT" => Ok(0b1011),
        "GT" => Ok(0b1100),
        "LE" => Ok(0b1101),
        "AL" => Ok(0b1110),
        _ => asm_err(line_num, &format!("unknown condition: {s}")),
    }
}

fn asm_err<T>(line_num: usize, msg: &str) -> Result<T, EmuError> {
    Err(asm_error(line_num, msg))
}

fn asm_error(line_num: usize, msg: &str) -> EmuError {
    EmuError::AssemblyError {
        line: line_num,
        message: msg.to_string(),
    }
}

// ---------------------------------------------------------------------------
// instruction encoders
// ---------------------------------------------------------------------------

fn encode_mov(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 2 {
        return asm_err(ln, "MOV requires 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let op2 = ops[1].trim();

    // MOV Xd, #imm -> MOVZ or MOVN
    if op2.starts_with('#') || op2.starts_with('-') || op2.chars().next().map_or(false, |c| c.is_ascii_digit()) {
        let imm = parse_immediate(op2, ln)?;
        if imm >= 0 && imm <= 0xFFFF {
            return encode_movzk(&[ops[0], op2], 0b10, ln); // MOVZ
        } else if imm < 0 {
            // MOVN: ~imm
            let not_imm = !(imm as u64);
            let trunc = if sf { not_imm } else { not_imm & 0xFFFF_FFFF };
            if trunc <= 0xFFFF {
                let sf_bit = if sf { 1u32 } else { 0 };
                return Ok((sf_bit << 31) | (0b00 << 29) | (0b100101 << 23)
                    | ((trunc as u32) << 5) | (rd as u32));
            }
            return asm_err(ln, "immediate out of range for MOV");
        }
        return asm_err(ln, "immediate out of range for MOV");
    }

    // MOV Xd, Xn -> ORR Xd, XZR, Xn
    let (rm, _) = parse_register(op2, ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };
    // ORR <Xd>, XZR, <Xm>
    Ok((sf_bit << 31) | (0b01 << 29) | (0b01010 << 24) | ((rm as u32) << 16)
        | (0b11111 << 5) | (rd as u32))
}

fn encode_movzk(ops: &[&str], opc: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 2 {
        return asm_err(ln, "MOVZ/MOVK/MOVN requires at least 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let imm = parse_immediate(ops[1], ln)? as u64;

    if imm > 0xFFFF {
        return asm_err(ln, "immediate exceeds 16 bits");
    }

    let mut hw: u8 = 0;
    if ops.len() > 2 {
        // parse LSL #16 / LSL #32 / LSL #48
        let shift_str = ops[2].trim().to_uppercase();
        if let Some(rest) = shift_str.strip_prefix("LSL") {
            let amt = parse_immediate(rest.trim(), ln)?;
            hw = match amt {
                0 => 0,
                16 => 1,
                32 => 2,
                48 => 3,
                _ => return asm_err(ln, "MOVZ/MOVK shift must be 0, 16, 32, or 48"),
            };
        }
    }

    let sf_bit = if sf { 1u32 } else { 0 };
    Ok((sf_bit << 31) | ((opc as u32) << 29) | (0b100101 << 23)
        | ((hw as u32) << 21) | ((imm as u32) << 5) | (rd as u32))
}

fn encode_dp(ops: &[&str], op_bit: u8, s_bit: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "ADD/SUB requires 3 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let op3 = ops[2].trim();
    let sf_bit = if sf { 1u32 } else { 0 };

    // immediate form
    if op3.starts_with('#') || op3.chars().next().map_or(false, |c| c.is_ascii_digit()) {
        let imm = parse_immediate(op3, ln)?;
        if imm < 0 || imm > 4095 {
            return asm_err(ln, "immediate out of range (0-4095)");
        }
        return Ok((sf_bit << 31) | ((op_bit as u32) << 30) | ((s_bit as u32) << 29)
            | (0b10001 << 24) | ((imm as u32) << 10)
            | ((rn as u32) << 5) | (rd as u32));
    }

    // register form
    let (rm, _) = parse_register(op3, ln)?;
    Ok((sf_bit << 31) | ((op_bit as u32) << 30) | ((s_bit as u32) << 29)
        | (0b01011 << 24) | ((rm as u32) << 16)
        | ((rn as u32) << 5) | (rd as u32))
}

fn encode_cmp(ops: &[&str], op_bit: u8, ln: usize) -> Result<u32, EmuError> {
    // CMP Xn, op2 -> SUBS XZR, Xn, op2
    // CMN Xn, op2 -> ADDS XZR, Xn, op2
    if ops.len() != 2 {
        return asm_err(ln, "CMP/CMN requires 2 operands");
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    let new_ops = [zr, ops[0], ops[1]];
    encode_dp(&new_ops, op_bit, 1, ln)
}

fn encode_log_reg(ops: &[&str], opc: u8, _n: bool, _set_flags: bool, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "logical op requires 3 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    Ok((sf_bit << 31) | ((opc as u32) << 29) | (0b01010 << 24)
        | ((rm as u32) << 16) | ((rn as u32) << 5) | (rd as u32))
}

fn encode_mvn(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // MVN Xd, Xm -> ORN Xd, XZR, Xm
    if ops.len() != 2 {
        return asm_err(ln, "MVN requires 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rm, _) = parse_register(ops[1], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    // ORN = opc=01, N=1
    Ok((sf_bit << 31) | (0b01 << 29) | (0b01010 << 24) | (1 << 21)
        | ((rm as u32) << 16) | (0b11111 << 5) | (rd as u32))
}

fn encode_tst(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // TST Xn, Xm -> ANDS XZR, Xn, Xm
    if ops.len() != 2 {
        return asm_err(ln, "TST requires 2 operands");
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    let new_ops = [zr, ops[0], ops[1]];
    encode_log_reg(&new_ops, 0b11, false, true, ln)
}

fn encode_shift(ops: &[&str], shift_type: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "shift requires 3 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let op3 = ops[2].trim();
    let sf_bit = if sf { 1u32 } else { 0 };
    let reg_size: u8 = if sf { 64 } else { 32 };

    // immediate form via UBFM/SBFM
    if op3.starts_with('#') || op3.chars().next().map_or(false, |c| c.is_ascii_digit()) {
        let amt = parse_immediate(op3, ln)? as u8;
        let (opc, immr, imms) = match shift_type {
            0 => {
                // LSL: UBFM Xd, Xn, #(reg_size - amt), #(reg_size - 1 - amt)
                (0b10, (reg_size.wrapping_sub(amt)) % reg_size, reg_size - 1 - amt)
            }
            1 => {
                // LSR: UBFM Xd, Xn, #amt, #(reg_size - 1)
                (0b10, amt, reg_size - 1)
            }
            2 => {
                // ASR: SBFM Xd, Xn, #amt, #(reg_size - 1)
                (0b00, amt, reg_size - 1)
            }
            _ => unreachable!(),
        };

        let n_bit = if sf { 1u32 } else { 0 };
        return Ok((sf_bit << 31) | ((opc as u32) << 29) | (0b100110 << 23)
            | (n_bit << 22) | ((immr as u32) << 16) | ((imms as u32) << 10)
            | ((rn as u32) << 5) | (rd as u32));
    }

    // register form: variable shifts go through LSLV/LSRV/ASRV (dp2 instrs).
    // LSLV layout: sf_0_S=0_11010110_Rm_0010_00_Rn_Rd
    let (rm, _) = parse_register(op3, ln)?;
    let opcode: u32 = match shift_type {
        0 => 0b001000, // LSLV
        1 => 0b001001, // LSRV
        2 => 0b001010, // ASRV
        _ => unreachable!(),
    };
    Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
        | (opcode << 10) | ((rn as u32) << 5) | (rd as u32))
}

fn encode_mul_div(ops: &[&str], variant: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 3 {
        return asm_err(ln, "MUL/UDIV/SDIV requires 3 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    match variant {
        0 => {
            // MUL -> MADD Xd, Xn, Xm, XZR
            Ok((sf_bit << 31) | (0b0011011000 << 21) | ((rm as u32) << 16)
                | (0b11111 << 10) | ((rn as u32) << 5) | (rd as u32))
        }
        1 => {
            // UDIV
            Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
                | (0b000010 << 10) | ((rn as u32) << 5) | (rd as u32))
        }
        2 => {
            // SDIV
            Ok((sf_bit << 31) | (0b0011010110 << 21) | ((rm as u32) << 16)
                | (0b000011 << 10) | ((rn as u32) << 5) | (rd as u32))
        }
        _ => unreachable!(),
    }
}

fn encode_neg(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // NEG Xd, Xm -> SUB Xd, XZR, Xm
    if ops.len() != 2 {
        return asm_err(ln, "NEG requires 2 operands");
    }
    let (_, sf) = parse_register(ops[0], ln)?;
    let zr = if sf { "XZR" } else { "WZR" };
    let new_ops = [ops[0], zr, ops[1]];
    encode_dp(&new_ops, 1, 0, ln)
}

fn encode_ldst(ops: &[&str], load: u8, size: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 2 {
        return asm_err(ln, "LDR/STR requires at least 2 operands");
    }
    let (rt, _) = parse_register(ops[0], ln)?;

    // parse addressing mode from remaining operands
    let addr_str: String = ops[1..].join(",");
    let addr_str = addr_str.trim();

    let (rn, offset, mode) = parse_addressing_mode(addr_str, ln)?;

    // encode based on mode
    let offset_val = offset.unwrap_or(0);

    match mode {
        IndexMode::Unsigned => {
            // unsigned offset encoding
            let scale = match size {
                0b00 => 1u64,
                0b01 => 2,
                0b10 => 4,
                0b11 => 8,
                _ => unreachable!(),
            };
            if offset_val < 0 || (offset_val as u64) % scale != 0 {
                return asm_err(ln, "unsigned offset must be positive and aligned");
            }
            let imm12 = (offset_val as u64 / scale) as u32;
            if imm12 > 4095 {
                return asm_err(ln, "offset out of range");
            }
            Ok(((size as u32) << 30) | (0b111001 << 24) | ((load as u32) << 22)
                | (imm12 << 10) | ((rn as u32) << 5) | (rt as u32))
        }
        IndexMode::PreIndex | IndexMode::PostIndex => {
            if offset_val < -256 || offset_val > 255 {
                return asm_err(ln, "pre/post-index offset must be in [-256, 255]");
            }
            let imm9 = (offset_val as u32) & 0x1FF;
            let idx = if matches!(mode, IndexMode::PreIndex) { 0b11u32 } else { 0b01 };
            Ok(((size as u32) << 30) | (0b111000 << 24) | ((load as u32) << 22)
                | (imm9 << 12) | (idx << 10) | ((rn as u32) << 5) | (rt as u32))
        }
    }
}

#[derive(Debug)]
enum IndexMode {
    Unsigned,
    PreIndex,
    PostIndex,
}

fn parse_addressing_mode(s: &str, ln: usize) -> Result<(u8, Option<i64>, IndexMode), EmuError> {
    let s = s.trim();

    // [Xn, #imm]! -> pre-index
    if s.ends_with('!') {
        let inner = s.strip_suffix('!').unwrap().trim();
        let inner = inner.strip_prefix('[')
            .and_then(|s| s.strip_suffix(']'))
            .ok_or_else(|| asm_error(ln, "expected [Xn, #imm]!"))?;
        let parts: Vec<&str> = inner.splitn(2, ',').collect();
        let (rn, _) = parse_register(parts[0], ln)?;
        let offset = if parts.len() > 1 {
            Some(parse_immediate(parts[1], ln)?)
        } else {
            Some(0)
        };
        return Ok((rn, offset, IndexMode::PreIndex));
    }

    // check if it starts with [
    if !s.starts_with('[') {
        return asm_err(ln, "expected [ for addressing mode");
    }

    // [Xn], #imm -> post-index
    if let Some(bracket_end) = s.find(']') {
        let inside = &s[1..bracket_end];
        let after = s[bracket_end + 1..].trim();

        if !after.is_empty() {
            // post-index
            let (rn, _) = parse_register(inside.trim(), ln)?;
            let offset_str = after.strip_prefix(',').unwrap_or(after).trim();
            let offset = parse_immediate(offset_str, ln)?;
            return Ok((rn, Some(offset), IndexMode::PostIndex));
        }

        // [Xn] or [Xn, #imm]
        let parts: Vec<&str> = inside.splitn(2, ',').collect();
        let (rn, _) = parse_register(parts[0], ln)?;
        if parts.len() > 1 {
            let offset = parse_immediate(parts[1], ln)?;
            return Ok((rn, Some(offset), IndexMode::Unsigned));
        }
        return Ok((rn, None, IndexMode::Unsigned));
    }

    asm_err(ln, "invalid addressing mode")
}

fn encode_ldst_pair(ops: &[&str], load: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() < 3 {
        return asm_err(ln, "LDP/STP requires at least 3 operands");
    }
    let (rt, sf) = parse_register(ops[0], ln)?;
    let (rt2, _) = parse_register(ops[1], ln)?;

    let addr_str: String = ops[2..].join(",");
    let (rn, offset, mode) = parse_addressing_mode(addr_str.trim(), ln)?;

    let offset_val = offset.unwrap_or(0);
    let scale: i64 = if sf { 8 } else { 4 };
    if offset_val % scale != 0 {
        return asm_err(ln, "pair offset must be aligned to register size");
    }
    let imm7 = (offset_val / scale) as i8;
    if imm7 < -64 || imm7 > 63 {
        return asm_err(ln, "pair offset out of range");
    }
    let imm7_enc = (imm7 as u32) & 0x7F;

    let opc: u32 = if sf { 0b10 } else { 0b00 };
    let mode_bits: u32 = match mode {
        IndexMode::PostIndex => 0b01,
        IndexMode::Unsigned => 0b10,
        IndexMode::PreIndex => 0b11,
    };

    Ok((opc << 30) | (0b101 << 27) | (0 << 26) | (mode_bits << 23)
        | ((load as u32) << 22) | (imm7_enc << 15)
        | ((rt2 as u32) << 10) | ((rn as u32) << 5) | (rt as u32))
}

fn encode_branch_imm(
    ops: &[&str], link: bool, pc: u64, labels: &HashMap<String, u64>, ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 1 {
        return asm_err(ln, "B/BL requires 1 operand");
    }
    let target = ops[0].trim();

    let offset_bytes = if target.starts_with('#') || target.starts_with('-') || target.chars().next().map_or(false, |c| c.is_ascii_digit()) {
        parse_immediate(target, ln)?
    } else {
        let label = target.to_lowercase();
        let addr = labels.get(&label)
            .ok_or_else(|| asm_error(ln, &format!("undefined label: {target}")))?;
        *addr as i64 - pc as i64
    };

    if offset_bytes % 4 != 0 {
        return asm_err(ln, "branch offset must be 4-byte aligned");
    }
    let imm26 = ((offset_bytes / 4) as u32) & 0x3FF_FFFF;

    let op = if link { 1u32 } else { 0 };
    Ok((op << 31) | (0b00101 << 26) | imm26)
}

fn encode_bcond(
    ops: &[&str], cond: u8, pc: u64, labels: &HashMap<String, u64>, ln: usize,
) -> Result<u32, EmuError> {
    if ops.len() != 1 {
        return asm_err(ln, "B.cond requires 1 operand");
    }
    let target = ops[0].trim();

    let offset_bytes = if target.starts_with('#') || target.starts_with('-') || target.chars().next().map_or(false, |c| c.is_ascii_digit()) {
        parse_immediate(target, ln)?
    } else {
        let label = target.to_lowercase();
        let addr = labels.get(&label)
            .ok_or_else(|| asm_error(ln, &format!("undefined label: {target}")))?;
        *addr as i64 - pc as i64
    };

    if offset_bytes % 4 != 0 {
        return asm_err(ln, "branch offset must be 4-byte aligned");
    }
    let imm19 = ((offset_bytes / 4) as u32) & 0x7FFFF;

    Ok(0x5400_0000 | (imm19 << 5) | (cond as u32))
}

fn encode_branch_reg(ops: &[&str], opc: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 1 {
        return asm_err(ln, "BR/BLR requires 1 operand");
    }
    let (rn, _) = parse_register(ops[0], ln)?;
    Ok(0xD61F_0000 | ((opc as u32) << 21) | ((rn as u32) << 5))
}

fn encode_ret(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let rn = if ops.is_empty() || ops[0].is_empty() {
        30 // default: X30
    } else {
        parse_register(ops[0], ln)?.0
    };
    // RET = BR variant with opc=0b0010
    Ok(0xD61F_0000 | (0b0010 << 21) | ((rn as u32) << 5))
}

fn encode_cond_sel(ops: &[&str], op2: u8, ln: usize) -> Result<u32, EmuError> {
    if ops.len() != 4 {
        return asm_err(ln, "CSEL/CSINC requires 4 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let (rn, _) = parse_register(ops[1], ln)?;
    let (rm, _) = parse_register(ops[2], ln)?;
    let cond = parse_condition(ops[3], ln)?;
    let sf_bit = if sf { 1u32 } else { 0 };

    Ok((sf_bit << 31) | (0b0011010100 << 21) | ((rm as u32) << 16)
        | ((cond as u32) << 12) | ((op2 as u32) << 10)
        | ((rn as u32) << 5) | (rd as u32))
}

fn encode_cset(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    // CSET Xd, cond -> CSINC Xd, XZR, XZR, invert(cond)
    if ops.len() != 2 {
        return asm_err(ln, "CSET requires 2 operands");
    }
    let (rd, sf) = parse_register(ops[0], ln)?;
    let cond = parse_condition(ops[1], ln)?;
    let inv_cond = cond ^ 1; // invert low bit
    let sf_bit = if sf { 1u32 } else { 0 };

    Ok((sf_bit << 31) | (0b0011010100 << 21) | (0b11111 << 16)
        | ((inv_cond as u32) << 12) | (1 << 10)
        | (0b11111 << 5) | (rd as u32))
}

fn encode_svc(ops: &[&str], ln: usize) -> Result<u32, EmuError> {
    let imm = if ops.is_empty() || ops[0].is_empty() {
        0
    } else {
        parse_immediate(ops[0], ln)? as u16
    };
    Ok(0xD400_0001 | ((imm as u32) << 5))
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cpu::Cpu;

    #[test]
    fn assemble_mov_add_halt() {
        let source = r#"
            MOV X0, #10
            MOV X1, #20
            ADD X2, X0, X1
            SVC #0
        "#;
        let code = assemble(source).unwrap();
        assert_eq!(code.len(), 4);

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();

        assert_eq!(cpu.regs.read_gpr(0, true), 10);
        assert_eq!(cpu.regs.read_gpr(1, true), 20);
        assert_eq!(cpu.regs.read_gpr(2, true), 30);
        assert!(cpu.is_halted());
    }

    #[test]
    fn assemble_labels_and_branches() {
        let source = r#"
            MOV X0, #5
        loop:
            SUBS X0, X0, #1
            B.NE loop
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(100).unwrap();

        assert_eq!(cpu.regs.read_gpr(0, true), 0);
        assert!(cpu.is_halted());
    }

    #[test]
    fn assemble_str_ldr() {
        let source = r#"
            MOV X0, #42
            STR X0, [SP, #-16]!
            MOV X0, #0
            LDR X1, [SP], #16
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(1, true), 42);
    }

    #[test]
    fn assemble_cmp_cset() {
        let source = r#"
            MOV X0, #10
            MOV X1, #10
            CMP X0, X1
            CSET X2, EQ
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(2, true), 1);
    }

    #[test]
    fn assemble_mul() {
        let source = r#"
            MOV X0, #7
            MOV X1, #6
            MUL X2, X0, X1
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(10).unwrap();

        assert_eq!(cpu.regs.read_gpr(2, true), 42);
    }

    #[test]
    fn assemble_factorial() {
        let source = r#"
            MOV X0, #5       // n = 5
            MOV X1, #1       // result = 1
        loop:
            MUL X1, X1, X0   // result *= n
            SUBS X0, X0, #1  // n--
            B.GT loop
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(100).unwrap();

        assert_eq!(cpu.regs.read_gpr(1, true), 120); // 5! = 120
    }

    #[test]
    fn assemble_stp_ldp() {
        let source = r#"
            MOV X0, #100
            MOV X1, #200
            STP X0, X1, [SP, #-16]!
            MOV X0, #0
            MOV X1, #0
            LDP X2, X3, [SP], #16
            SVC #0
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(2, true), 100);
        assert_eq!(cpu.regs.read_gpr(3, true), 200);
    }

    #[test]
    fn assemble_bl_ret() {
        let source = r#"
            MOV X0, #10
            BL double
            SVC #0
        double:
            ADD X0, X0, X0
            RET
        "#;
        let code = assemble(source).unwrap();

        let mut cpu = Cpu::new();
        cpu.load_program(&code);
        cpu.run_until_break(20).unwrap();

        assert_eq!(cpu.regs.read_gpr(0, true), 20);
    }

    #[test]
    fn assemble_comments_stripped() {
        let source = r#"
            // this is a comment
            MOV X0, #1   // inline comment
            SVC #0       ; another style
        "#;
        let code = assemble(source).unwrap();
        assert_eq!(code.len(), 2);
    }

    #[test]
    fn assemble_error_on_unknown() {
        let result = assemble("FOOBAR X0, X1");
        assert!(result.is_err());
    }
}
