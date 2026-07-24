//! Full-stack assembly pipeline for hosted cpsc 355 source. Runs the
//! parser, resolves labels across every section, allocates a literal pool
//! for `ldr xN, =expr` pseudo-instructions, and emits a `LinkedImage`
//! that the CPU loader writes into memory as-is.
//!
//! Ordinary instructions reconstruct their post-m4 source line from
//! `Program::expanded_source` (indexed by `original_line`) and go through
//! `assembler::encode_line_absolute`, so every encoding the legacy
//! assembler already knows about keeps working unchanged. `ldr xN, =expr`
//! is the one pseudo that needs special handling, since the legacy
//! encoder doesn't recognize `=` in operands.

use std::collections::HashMap;

use crate::assembler;
use crate::cpu::CODE_BASE;
use crate::errors::EmuError;
use crate::frontend::expr::evaluate;
use crate::frontend::lexer::{lex, TokenKind};
use crate::frontend::linker::encode_ldr_literal;
use crate::frontend::parser::parse;
use crate::frontend::sections::{Item, Program, SectionKind};
use crate::hosted::HostTable;

/// Result of a hosted-assembly run. `writes` is an ordered list of
/// (address, bytes) pairs that the loader applies verbatim.
#[derive(Debug, Clone)]
pub struct LinkedImage {
    pub writes: Vec<(u64, Vec<u8>)>,
    pub entry_point: u64,
    pub instruction_count: usize,
    /// Absolute address of the first instruction in `.text`, for debugger
    /// decoration.
    pub text_base: u64,
    /// First address past the last real `.text` byte. Execution arriving
    /// here fell off the end of the program (a `main` with no ret/exit);
    /// the trampolines start at least 4 bytes later, so this address is
    /// never a legitimate branch target.
    pub text_end: u64,
    /// Resolved label -> absolute address for every label the linker
    /// saw (instructions, data symbols, m4 expression symbols, plus
    /// the synthetic `__tramp_<libc>` trampolines). Used by the
    /// `gdb b <label>` terminal command and any future symbolic
    /// debugger surface.
    pub symbols: HashMap<String, u64>,
    /// Authoritative address -> editor-source-line map. For every
    /// `.text` instruction emitted at `pc`, this holds `(pc,
    /// original_line)` where `original_line` is the 1-based EDITOR
    /// (pre-m4) line. m4 keeps line numbers aligned -- `define()` lines
    /// expand to empty lines -- so `original_line` is the line the
    /// student actually wrote. The debugger marker, the disassembly
    /// text, and breakpoint placement key off this instead of counting
    /// non-label source lines (which double-counts data/macro/directive
    /// lines and drifts on complex programs). Trampolines and the
    /// literal pool get no entries.
    pub line_map: Vec<(u64, u32)>,
}

pub fn assemble_hosted(source: &str, host: &HostTable) -> Result<LinkedImage, EmuError> {
    let prog = parse(source)?;
    link(&prog, host)
}

fn link(prog: &Program, host: &HostTable) -> Result<LinkedImage, EmuError> {
    let mut symbols: HashMap<String, u64> = HashMap::new();

    // Pass 1a: place labels at section base + running byte offset, and
    // collect `name = expr` assignments with the address where they
    // appear so the linker can evaluate `. - msg - 1` and similar bodies
    // in the right place. Assignments that resolve against the symbols
    // seen so far fold immediately -- `.skip STACKSIZE * 4` needs its
    // equate during this very walk; the rest wait for pass 1c's rounds.
    // Reserve sizes resolved here are kept for pass 2, which must walk
    // the identical layout.
    // Section bases sit 1 MiB apart (SectionKind::default_base), so any
    // section that outgrows this window silently runs into the next one's
    // addresses: two labels on one address, stores clobbering unrelated
    // variables. Checked during this walk, where the offending line is
    // still known.
    const SECTION_WINDOW: u64 = 1024 * 1024;

    let mut text_len: u64 = 0;
    let mut assignments: Vec<(String, String, u64, usize)> = Vec::new();
    let mut reserve_sizes: HashMap<(SectionKind, usize), u64> = HashMap::new();
    // First-definition lines, for duplicate-label errors that name both
    // sites. GAS rejects a redefined label; accepting it here made the
    // last definition win silently, so branches jumped to the wrong copy.
    let mut label_lines: HashMap<String, usize> = HashMap::new();
    for section in &prog.sections {
        let base = section.kind.default_base();
        let mut offset: u64 = 0;
        let mut last_line: usize = 0;
        for (idx, item) in section.items.iter().enumerate() {
            match item {
                Item::Label { name, original_line } => {
                    last_line = *original_line;
                    if let Some(first) = label_lines.get(name) {
                        return Err(EmuError::AssemblyError {
                            line: *original_line,
                            message: format!(
                                "label `{name}` is already defined on line {first} -- \
                                 give each label a unique name (labels are file-wide, \
                                 not per-function)"
                            ),
                        });
                    }
                    if symbols.contains_key(name) {
                        return Err(EmuError::AssemblyError {
                            line: *original_line,
                            message: format!(
                                "label `{name}` collides with the `{name} = ...` \
                                 constant defined earlier -- rename one of them"
                            ),
                        });
                    }
                    label_lines.insert(name.clone(), *original_line);
                    symbols.insert(name.clone(), base + offset);
                }
                Item::Bytes(b) => offset += b.len() as u64,
                Item::Reserve(n) => offset = offset.saturating_add(*n),
                Item::AlignToBytes(n) => {
                    if *n > 0 {
                        let rem = offset % n;
                        if rem != 0 {
                            offset += n - rem;
                        }
                    }
                }
                Item::SymbolAssignment { name, body, original_line } => {
                    last_line = *original_line;
                    if let Some(first) = label_lines.get(name) {
                        return Err(EmuError::AssemblyError {
                            line: *original_line,
                            message: format!(
                                "`{name} = ...` collides with the label `{name}:` \
                                 on line {first} -- rename one of them"
                            ),
                        });
                    }
                    if !symbols.contains_key(name) {
                        if let Some(v) = try_evaluate_at(body, base + offset, &symbols, *original_line) {
                            symbols.insert(name.clone(), v as u64);
                            continue;
                        }
                    }
                    assignments.push((name.clone(), body.clone(), base + offset, *original_line));
                }
                Item::Instruction { original_line, .. } => {
                    last_line = *original_line;
                    // Data emitted into .text above this point knocked every
                    // following instruction off its 4-byte boundary; report
                    // it here, where the line is known, instead of letting
                    // the linker blame an internal literal-pool offset.
                    if section.kind == SectionKind::Text && !offset.is_multiple_of(4) {
                        return Err(EmuError::AssemblyError {
                            line: *original_line,
                            message: format!(
                                "this instruction lands at a misaligned address: {} byte(s) of \
                                 data sit in .text above it -- move the data to .data or \
                                 .rodata, or add `.balign 4` between the data and the code",
                                offset % 4
                            ),
                        });
                    }
                    offset += 4;
                }
                Item::DataExprs { exprs, width, original_line } => {
                    last_line = *original_line;
                    offset += (exprs.len() * width) as u64;
                }
                Item::ReserveExpr { tokens, original_line } => {
                    last_line = *original_line;
                    let value = evaluate(
                        tokens,
                        &|name| symbols.get(name).map(|v| *v as i64),
                        (base + offset) as i64,
                        *original_line,
                    )?;
                    if value < 0 {
                        return Err(EmuError::AssemblyError {
                            line: *original_line,
                            message: ".skip needs a non-negative byte count".into(),
                        });
                    }
                    reserve_sizes.insert((section.kind, idx), value as u64);
                    offset = offset.saturating_add(value as u64);
                }
            }
            if offset > SECTION_WINDOW {
                return Err(EmuError::AssemblyError {
                    line: last_line,
                    message: format!(
                        "{} has grown past its 1 MiB window ({} bytes so far) and would \
                         overlap the next section's addresses -- shrink the data or .skip \
                         reservations (check any size equate for a typo)",
                        section.kind.name(),
                        offset
                    ),
                });
            }
        }
        if section.kind == SectionKind::Text {
            text_len = offset;
        }
    }

    // Pass 1b: host-stub addresses so `bl printf` (via a literal-pool
    // trampoline) and any direct-label lookups can find them.
    for name in host.names() {
        if let Some(addr) = host.lookup(name) {
            symbols.entry(name.to_string()).or_insert(addr);
        }
    }

    // Pass 1c: evaluate each `name = expr` assignment using its recorded
    // `.` address. Do multiple rounds since later assignments can depend
    // on earlier ones or on labels defined later in the same section.
    for _ in 0..16 {
        let mut changed = false;
        let mut remaining: Vec<(String, String, u64, usize)> = Vec::new();
        for (name, body, here, line) in &assignments {
            if symbols.contains_key(name) {
                // A pending assignment whose name turned out to be a label
                // (defined after it) must not vanish silently.
                if let Some(first) = label_lines.get(name) {
                    return Err(EmuError::AssemblyError {
                        line: *line,
                        message: format!(
                            "`{name} = ...` collides with the label `{name}:` \
                             on line {first} -- rename one of them"
                        ),
                    });
                }
                continue;
            }
            if let Some(v) = try_evaluate_at(body, *here, &symbols, *line) {
                symbols.insert(name.clone(), v as u64);
                changed = true;
            } else {
                remaining.push((name.clone(), body.clone(), *here, *line));
            }
        }
        assignments = remaining;
        if !changed {
            break;
        }
    }

    // Whatever is still pending is permanently broken -- a typo'd symbol,
    // a division by zero, a cycle. Re-run the evaluation WITHOUT the
    // `.ok()` so its own error (which names the cause at the assignment's
    // line) surfaces; silently dropping it used to blame the innocent USE
    // site with "invalid immediate".
    if let Some((_, body, here, line)) = assignments.first() {
        let tokens = lex(body, *line)?;
        evaluate(
            &tokens,
            &|name| symbols.get(name).map(|v| *v as i64),
            *here as i64,
            *line,
        )?;
        // Unreachable in practice: the fixpoint loop already failed this
        // assignment against the same symbol table.
    }

    // Pass 1d: scan .text instructions for `ldr xN, =expr` to size the
    // literal pool, and for `bl <hostname>` calls that need a trampoline
    // because direct BL cannot reach the 0xFFFF_0000 host-stub range.
    let mut pool_slots: HashMap<String, u64> = HashMap::new();
    let mut pool_values: Vec<u64> = Vec::new();
    let mut host_trampolines: Vec<String> = Vec::new();
    let mut host_trampoline_set: HashMap<String, ()> = HashMap::new();
    for section in &prog.sections {
        if section.kind != SectionKind::Text {
            continue;
        }
        for item in &section.items {
            if let Item::Instruction { tokens, original_line } = item {
                if let Some(target_text) = extract_ldr_eq_operand(tokens) {
                    if let std::collections::hash_map::Entry::Vacant(slot) = pool_slots.entry(target_text) {
                        let value = resolve_ldr_eq_target(slot.key(), &symbols, *original_line)?;
                        slot.insert(pool_values.len() as u64 * 8);
                        pool_values.push(value);
                    }
                    continue;
                }
                if let Some(target) = extract_bl_target(tokens) {
                    if let Some(addr) = symbols.get(&target) {
                        if is_host_address(*addr)
                            && !host_trampoline_set.contains_key(&target)
                        {
                            host_trampoline_set.insert(target.clone(), ());
                            host_trampolines.push(target);
                        }
                    }
                }
            }
        }
    }

    // Each trampoline is two instructions (LDR X16, <pool slot>; BR X16)
    // = 8 bytes. They sit between .text and the literal pool so BL's
    // imm26 range easily reaches them, and so their LDR literal's imm19
    // reaches the pool entries that hold the real host stub addresses.
    // `+ 8` (not `+ 7`): always leave a gap of at least 4 bytes between
    // the last real instruction and the first trampoline, so sequential
    // fall-through can be told apart from a `bl printf` arriving at a
    // trampoline. With plain 8-alignment an 8-aligned .text fell straight
    // into the first trampoline and silently called that libc function.
    let tramp_base = CODE_BASE + ((text_len + 8) & !7);
    let tramp_bytes = (host_trampolines.len() as u64) * 8;
    let pool_base = tramp_base + tramp_bytes;

    // The trampolines and literal pool are appended after .text; bound the
    // whole .text image (not just its instructions) against the 1 MiB window
    // so a large .text plus its pool cannot silently spill into .rodata.
    let max_pool_slots = pool_values.len() as u64 + host_trampolines.len() as u64;
    let image_end = pool_base + max_pool_slots * 8;
    if image_end > CODE_BASE + SECTION_WINDOW {
        return Err(EmuError::AssemblyError {
            line: 0,
            message: format!(
                ".text plus its literal pool and libc trampolines reaches {} bytes, past \
                 the 1 MiB code window -- shrink .text or reduce the `ldr xN, =...` \
                 constants and libc calls",
                image_end - CODE_BASE
            ),
        });
    }

    // Each trampoline needs a pool slot that holds the host stub's real
    // 64-bit address. Pre-allocate those slots and wire the per-name
    // trampoline address into the symbol table so `bl printf` can route
    // through a synthetic `__tramp_printf` label.
    let mut tramp_addr: HashMap<String, u64> = HashMap::new();
    for (idx, name) in host_trampolines.iter().enumerate() {
        let addr = tramp_base + (idx as u64) * 8;
        tramp_addr.insert(name.clone(), addr);
        symbols.insert(format!("__tramp_{name}"), addr);
        // Reserve a literal pool slot holding the real host-stub address,
        // if one isn't already there under the host name.
        let host_addr = *symbols.get(name).expect("host target in symbols");
        pool_slots
            .entry(name.clone())
            .or_insert_with(|| {
                let slot = pool_values.len() as u64 * 8;
                pool_values.push(host_addr);
                slot
            });
    }

    // Pass 2: emit bytes for every section, then the literal pool.
    let mut writes: Vec<(u64, Vec<u8>)> = Vec::new();
    let mut line_map: Vec<(u64, u32)> = Vec::new();
    let mut instruction_count: usize = 0;
    let expanded_lines: Vec<&str> = prog.expanded_source.lines().collect();

    for section in &prog.sections {
        let base = section.kind.default_base();
        let mut offset: u64 = 0;
        for (idx, item) in section.items.iter().enumerate() {
            match item {
                Item::Label { .. } => {}
                Item::Bytes(b) => {
                    writes.push((base + offset, b.clone()));
                    offset += b.len() as u64;
                }
                Item::Reserve(n) => offset += n,
                Item::ReserveExpr { .. } => {
                    // Sized during pass 1a; pages arrive zero-filled, so
                    // reserving is just the same offset hop again.
                    offset += reserve_sizes[&(section.kind, idx)];
                }
                Item::AlignToBytes(n) => {
                    if *n > 0 {
                        let rem = offset % n;
                        if rem != 0 {
                            offset += n - rem;
                        }
                    }
                }
                Item::SymbolAssignment { .. } => {}
                Item::DataExprs { exprs, width, original_line } => {
                    // Deferred data slots: every label now has an absolute
                    // address, so evaluate each value against the full
                    // symbol table. `.` means the address of the slot being
                    // filled, matching GAS.
                    let mut bytes = Vec::with_capacity(exprs.len() * width);
                    for (i, group) in exprs.iter().enumerate() {
                        let here = base + offset + (i * width) as u64;
                        let value = evaluate(
                            group,
                            &|name| symbols.get(name).map(|v| *v as i64),
                            here as i64,
                            *original_line,
                        )?;
                        let le = value.to_le_bytes();
                        bytes.extend_from_slice(&le[..*width]);
                    }
                    writes.push((base + offset, bytes));
                    offset += (exprs.len() * width) as u64;
                }
                Item::Instruction { tokens, original_line } => {
                    // Pass 1d (literal pool + trampolines) only scans
                    // .text, so an instruction landing anywhere else has
                    // no pool slot and no trampoline: `ldr xN, =sym`
                    // panicked on a missing key and `bl printf` truncated
                    // its offset into a garbage branch. On the course
                    // toolchain code outside .text faults at runtime;
                    // here we say what is missing while the line is known.
                    if section.kind != SectionKind::Text {
                        return Err(EmuError::AssemblyError {
                            line: *original_line,
                            message: format!(
                                "instruction in the {} section -- add a `.text` \
                                 directive above your code",
                                section.kind.name()
                            ),
                        });
                    }
                    let pc = base + offset;
                    let word = if let Some(target_text) = extract_ldr_eq_operand(tokens) {
                        let (rt, sf) = parse_ldr_eq_rt(tokens, *original_line)?;
                        let slot = *pool_slots.get(&target_text).ok_or_else(|| {
                            EmuError::LinkError {
                                line: *original_line,
                                message: format!(
                                    "no literal pool slot for `{target_text}`"
                                ),
                            }
                        })?;
                        let slot_addr = pool_base + slot;
                        let byte_offset = slot_addr as i64 - pc as i64;
                        encode_ldr_literal(sf, rt, byte_offset)?
                    } else {
                        // Rewrite `bl <hostname>` to hop through the
                        // trampoline so the out-of-range synthetic host
                        // address becomes reachable. Operating on the
                        // tokens directly handles tab whitespace and
                        // any trailing token noise that the old raw-
                        // string path could not.
                        let mut tokens_owned = tokens.clone();
                        redirect_bl_to_trampoline_tokens(&mut tokens_owned, &tramp_addr);
                        let raw = expanded_lines
                            .get(original_line - 1)
                            .copied()
                            .unwrap_or("");
                        let stripped = strip_leading_labels(raw);
                        if stripped.is_empty() {
                            return Err(EmuError::AssemblyError {
                                line: *original_line,
                                message: "empty instruction line".into(),
                            });
                        }
                        // Resolve aliases and constant expressions into
                        // plain numeric literals so the legacy encoder
                        // sees `[sp, -32]!` instead of `[sp, alloc]!`.
                        let line_text = if let Some(name) = extract_bl_target(&tokens_owned) {
                            // `bl label+addend` used to silently drop the
                            // addend and branch to the bare symbol. There is
                            // no encoding for it here, so reject rather than
                            // mislead. A plain `bl label` is exactly 2 tokens.
                            if tokens_owned.len() > 2 {
                                return Err(EmuError::AssemblyError {
                                    line: *original_line,
                                    message: "bl takes a single label with no addend; \
                                              branch to the label directly"
                                        .into(),
                                });
                            }
                            // Token redirect already produced the final
                            // mnemonic+target; bypass the string path so
                            // tab-separated lines reach the encoder
                            // correctly.
                            format!("bl {name}")
                        } else {
                            lower_operands(&stripped, pc, &symbols, *original_line)?
                        };
                        assembler::encode_line_absolute(
                            &line_text,
                            pc,
                            &symbols,
                            *original_line,
                        )?
                    };
                    writes.push((pc, word.to_le_bytes().to_vec()));
                    // Record the authoritative pc -> editor-line entry for
                    // every instruction (all are .text by the guard above);
                    // trampolines and the literal pool are emitted
                    // separately below and intentionally get no entries.
                    line_map.push((pc, *original_line as u32));
                    offset += 4;
                    instruction_count += 1;
                }
            }
        }
    }

    // Emit host-call trampolines. Each is `LDR X16, <pool slot>; BR X16`
    // with the pool slot holding the real host stub address. Two
    // instructions per trampoline = 8 bytes.
    for (idx, name) in host_trampolines.iter().enumerate() {
        let addr = tramp_base + (idx as u64) * 8;
        let slot = pool_slots[name];
        let slot_addr = pool_base + slot;
        let byte_offset = slot_addr as i64 - addr as i64;
        let ldr_word = encode_ldr_literal(true, 16, byte_offset)?;
        // BR X16 = 0xD61F_0200 | (rn << 5) with rn = 16
        let br_word: u32 = 0xD61F_0000 | (16u32 << 5);
        writes.push((addr, ldr_word.to_le_bytes().to_vec()));
        writes.push((addr + 4, br_word.to_le_bytes().to_vec()));
    }

    // Emit pool bytes.
    for (i, value) in pool_values.iter().enumerate() {
        let addr = pool_base + (i as u64) * 8;
        writes.push((addr, value.to_le_bytes().to_vec()));
    }

    // A program that produced no instructions "assembled" and then died on
    // step 1 with `unknown instruction: 0x00000000`; real ld rejects it.
    if instruction_count == 0 {
        return Err(EmuError::LinkError {
            line: 0,
            message: "the program has no instructions -- if a comment or a \
                      missing .text swallowed your code, put it back under \
                      `.text`"
                .into(),
        });
    }
    // `.global main` with no `main:` silently fell back to CODE_BASE;
    // real ld reports the undefined reference.
    if prog.globals.contains("main") && !symbols.contains_key("main") {
        return Err(EmuError::LinkError {
            line: 0,
            message: "no `main:` label found -- `.global main` was declared \
                      and execution starts at `main`"
                .into(),
        });
    }
    // A file with neither entry symbol used to run from the top of
    // .text, which turns a helpers-only file into a confusing crash.
    // Real ld refuses to link it; so do we.
    if !symbols.contains_key("main") && !symbols.contains_key("_start") {
        return Err(EmuError::LinkError {
            line: 0,
            message: "no entry point -- define `main:` (declared `.global main`) \
                      or `_start:`. A file holding only helper functions runs as \
                      part of a program whose other file has `main`"
                .into(),
        });
    }
    let entry_point = symbols.get("main").copied().unwrap_or(CODE_BASE);

    Ok(LinkedImage {
        writes,
        entry_point,
        instruction_count,
        text_base: CODE_BASE,
        text_end: CODE_BASE + text_len,
        symbols,
        line_map,
    })
}

/// Return the textual key for an `ldr xN, =<expr>` pseudo, or None if the
/// instruction is something else.
fn extract_ldr_eq_operand(tokens: &[crate::frontend::lexer::Token]) -> Option<String> {
    if tokens.len() < 4 {
        return None;
    }
    let TokenKind::Ident(mn) = &tokens[0].kind else {
        return None;
    };
    if !mn.eq_ignore_ascii_case("ldr") {
        return None;
    }
    // tokens: ident(ldr), ident(reg), comma, equals, ...
    let comma_pos = tokens.iter().position(|t| matches!(t.kind, TokenKind::Comma))?;
    let after = &tokens[comma_pos + 1..];
    let first_after = after.first()?;
    if !matches!(first_after.kind, TokenKind::Equals) {
        return None;
    }
    // The operand text is everything after the '='; stringify tokens.
    Some(stringify_tokens(&after[1..]))
}

fn stringify_tokens(tokens: &[crate::frontend::lexer::Token]) -> String {
    let mut out = String::new();
    for t in tokens {
        match &t.kind {
            TokenKind::Ident(s) => out.push_str(s),
            TokenKind::IntLit(v) => out.push_str(&format!("{v}")),
            TokenKind::CharLit(v) => out.push_str(&format!("{v}")),
            TokenKind::Comma => out.push(','),
            TokenKind::Plus => out.push('+'),
            TokenKind::Minus => out.push('-'),
            TokenKind::Star => out.push('*'),
            TokenKind::Slash => out.push('/'),
            TokenKind::Percent => out.push('%'),
            TokenKind::Amp => out.push('&'),
            TokenKind::Pipe => out.push('|'),
            TokenKind::Caret => out.push('^'),
            TokenKind::Tilde => out.push('~'),
            TokenKind::Bang => out.push('!'),
            TokenKind::LShift => out.push_str("<<"),
            TokenKind::RShift => out.push_str(">>"),
            TokenKind::LParen => out.push('('),
            TokenKind::RParen => out.push(')'),
            TokenKind::Dot => out.push('.'),
            TokenKind::Hash => out.push('#'),
            _ => {}
        }
        out.push(' ');
    }
    out.trim().to_string()
}

fn parse_ldr_eq_rt(
    tokens: &[crate::frontend::lexer::Token],
    line: usize,
) -> Result<(u8, bool), EmuError> {
    let TokenKind::Ident(reg) = &tokens[1].kind else {
        return Err(err(line, "expected register after LDR"));
    };
    let first = reg.chars().next().unwrap_or(' ').to_ascii_uppercase();
    let (sf, idx_str) = match first {
        'X' => (true, &reg[1..]),
        'W' => (false, &reg[1..]),
        _ => return Err(err(line, &format!("bad register `{reg}` in LDR =pseudo"))),
    };
    let idx: u8 = idx_str
        .parse()
        .map_err(|_| err(line, &format!("bad register index in `{reg}`")))?;
    if idx > 31 {
        return Err(err(
            line,
            &format!("`{reg}` is not a register; the register file runs x0-x30 (plus xzr/sp)"),
        ));
    }
    Ok((idx, sf))
}

fn resolve_ldr_eq_target(
    text: &str,
    symbols: &HashMap<String, u64>,
    line: usize,
) -> Result<u64, EmuError> {
    // Lex the operand fragment, evaluate as an expression with the full
    // symbol table. `. here` is meaningless in a pool entry so we pass 0.
    let tokens = lex(text, line)?;
    let value = evaluate(
        &tokens,
        &|name| symbols.get(name).map(|v| *v as i64),
        0,
        line,
    )?;
    Ok(value as u64)
}

/// Evaluate an assignment body at a specific point in the section walk,
/// using the symbol table accumulated so far. `here` is the absolute
/// address the assignment line appears at; expressions using `.` resolve
/// against that.
fn try_evaluate_at(
    body: &str,
    here: u64,
    symbols: &HashMap<String, u64>,
    line: usize,
) -> Option<i64> {
    let tokens = lex(body, line).ok()?;
    evaluate(
        &tokens,
        &|name| symbols.get(name).map(|v| *v as i64),
        here as i64,
        line,
    )
    .ok()
}

/// Walk the operand tail of an instruction line, evaluate any expression
/// that resolves to a constant, and rewrite it as a plain numeric literal
/// so the legacy assembler's `parse_immediate` can consume it. Register
/// operands (x0, w3, sp, d5, ...) and shift keywords (LSL, SXTW) pass
/// through unchanged because the expression evaluator returns None when
/// it cannot fold them into a constant.
fn lower_operands(
    line: &str,
    pc: u64,
    symbols: &HashMap<String, u64>,
    ln: usize,
) -> Result<String, EmuError> {
    let trimmed = line.trim();
    let split = trimmed
        .find(|c: char| c.is_whitespace())
        .unwrap_or(trimmed.len());
    let mnemonic = &trimmed[..split];
    let tail = trimmed[split..].trim_start();
    if tail.is_empty() {
        return Ok(mnemonic.to_string());
    }
    // Branches want to see a label name, not an evaluated offset; leave
    // the tail alone for them. ADR/ADRP likewise carry a label the encoder
    // resolves against the absolute symbol table (and `:lo12:` operands are
    // handled per-operand below).
    if is_branch_mnemonic(mnemonic)
        || mnemonic.eq_ignore_ascii_case("adr")
        || mnemonic.eq_ignore_ascii_case("adrp")
    {
        return Ok(format!("{mnemonic} {tail}"));
    }
    let rewritten = rewrite_operand_list(tail, pc, symbols, ln)?;
    Ok(format!("{mnemonic} {rewritten}"))
}

fn is_branch_mnemonic(mn: &str) -> bool {
    let lower = mn.to_ascii_lowercase();
    // Unconditional and link branches, conditional branches (b.cond), CBZ/CBNZ
    // and TBZ/TBNZ families; all take a label in their last operand slot.
    matches!(lower.as_str(), "b" | "bl" | "cbz" | "cbnz" | "tbz" | "tbnz")
        || lower.starts_with("b.")
}

fn rewrite_operand_list(
    s: &str,
    pc: u64,
    symbols: &HashMap<String, u64>,
    ln: usize,
) -> Result<String, EmuError> {
    let mut out: Vec<String> = Vec::new();
    let segments = split_top_level_commas(s);
    for seg in segments {
        out.push(rewrite_operand(seg.trim(), pc, symbols, ln)?);
    }
    Ok(out.join(", "))
}

fn split_top_level_commas(s: &str) -> Vec<&str> {
    let mut out: Vec<&str> = Vec::new();
    let mut depth: i32 = 0;
    let mut start: usize = 0;
    let bytes = s.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'[' | b'(' | b'{' => depth += 1,
            b']' | b')' | b'}' => depth -= 1,
            b',' if depth == 0 => {
                out.push(&s[start..i]);
                start = i + 1;
            }
            _ => {}
        }
    }
    out.push(&s[start..]);
    out
}

fn rewrite_operand(
    s: &str,
    pc: u64,
    symbols: &HashMap<String, u64>,
    ln: usize,
) -> Result<String, EmuError> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    // GAS relocation specifier `:lo12:SYM` (the second half of an
    // `adrp`/`add :lo12:` address pair) resolves to the low 12 bits of the
    // symbol's address so the legacy `add` encoder sees a plain immediate.
    if let Some(sym) = trimmed
        .strip_prefix(":lo12:")
        .or_else(|| trimmed.strip_prefix(":LO12:"))
    {
        let name = sym.trim();
        match symbols.get(name) {
            Some(addr) => return Ok(format!("{}", addr & 0xFFF)),
            None => {
                return Err(EmuError::AssemblyError {
                    line: ln,
                    message: format!("unknown symbol in :lo12: `{name}`"),
                })
            }
        }
    }
    // Bracketed operand [Xn, <expr>] or [Xn, <expr>]!: rewrite the inside
    // recursively and preserve the trailing characters (whitespace, !).
    if trimmed.starts_with('[') {
        let close = find_matching_bracket(trimmed).ok_or_else(|| EmuError::AssemblyError {
            line: ln,
            message: "unbalanced addressing bracket".into(),
        })?;
        let inside = &trimmed[1..close];
        let trailer = &trimmed[close..];
        let rewritten_inside = rewrite_operand_list(inside, pc, symbols, ln)?;
        return Ok(format!("[{rewritten_inside}{trailer}"));
    }
    // Strip a leading `#` while evaluating; the legacy encoder accepts
    // either form, so we emit the decimal literal without the hash.
    let body = trimmed.strip_prefix('#').unwrap_or(trimmed).trim();
    if !looks_like_expression(body, symbols) {
        return Ok(trimmed.to_string());
    }
    match try_evaluate_operand(body, pc, symbols, ln)? {
        Some(value) => Ok(format!("{value}")),
        None => Ok(trimmed.to_string()),
    }
}

fn find_matching_bracket(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut depth: i32 = 0;
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'[' => depth += 1,
            b']' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

/// Quick filter: is this operand body something we should try to
/// evaluate? True if it contains arithmetic/operator characters, or if
/// it's a bare identifier that resolves against the symbol table.
fn looks_like_expression(body: &str, symbols: &HashMap<String, u64>) -> bool {
    if body.is_empty() {
        return false;
    }
    // Contains any expression operator or `.`-current-address.
    let has_op = body
        .chars()
        .any(|c| matches!(c, '+' | '-' | '*' | '/' | '&' | '|' | '^' | '~' | '(' | ')' | '.' | '<' | '>' | '%'));
    if has_op {
        return true;
    }
    // Bare identifier that we know about (alias resolved to a constant).
    // Skip things that look like registers or shift keywords; leave those
    // alone even if a user happened to define a symbol with the same name.
    if is_register_or_shift_keyword(body) {
        return false;
    }
    if is_plain_ident(body) && symbols.contains_key(body) {
        return true;
    }
    false
}

fn is_plain_ident(s: &str) -> bool {
    let mut it = s.chars();
    match it.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' || c == '.' => {}
        _ => return false,
    }
    it.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.')
}

fn is_register_or_shift_keyword(s: &str) -> bool {
    let lower = s.to_ascii_lowercase();
    // Register prefixes followed by digits (or zr).
    for prefix in ["x", "w", "d", "s", "q", "h", "b"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            if rest == "zr" {
                return true;
            }
            if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
    }
    matches!(
        lower.as_str(),
        "sp" | "xzr" | "wzr" | "fp" | "lr" |
        "lsl" | "lsr" | "asr" | "ror" |
        "sxtw" | "sxtx" | "uxtw" | "uxtx" |
        "sxtb" | "sxth" | "uxtb" | "uxth"
    )
}

/// Evaluate an operand body that looked like an expression. `Ok(None)`
/// means "not an integer expression, hand the text to the encoder" (float
/// immediates, shift-modifier operands); a genuine broken expression
/// propagates its own diagnosis -- swallowing it into the encoder's
/// "invalid immediate" hid `unknown symbol \`SZIE\`` behind a message about
/// immediate ranges when a macro name was typo'd.
fn try_evaluate_operand(
    body: &str,
    pc: u64,
    symbols: &HashMap<String, u64>,
    ln: usize,
) -> Result<Option<i64>, EmuError> {
    // A shift modifier's keyword-plus-amount shape (`lsl #(1 + 1)`) is an
    // encoder operand, never an expression.
    let first_word = body.split_whitespace().next().unwrap_or("");
    if is_register_or_shift_keyword(first_word) {
        return Ok(None);
    }
    let Ok(tokens) = lex(body, ln) else {
        return Ok(None);
    };
    // A float immediate (`fmov d0, #1.5`) must reach the FP encoder as
    // written; the evaluator only speaks integers.
    if tokens
        .iter()
        .any(|t| matches!(t.kind, TokenKind::FloatLit(_)))
    {
        return Ok(None);
    }
    match evaluate(
        &tokens,
        &|name| symbols.get(name).map(|v| *v as i64),
        pc as i64,
        ln,
    ) {
        Ok(v) => Ok(Some(v)),
        Err(e) => Err(e),
    }
}

/// If this instruction is `bl <ident>`, return the target identifier.
fn extract_bl_target(tokens: &[crate::frontend::lexer::Token]) -> Option<String> {
    if tokens.len() < 2 {
        return None;
    }
    let TokenKind::Ident(mn) = &tokens[0].kind else {
        return None;
    };
    if !mn.eq_ignore_ascii_case("bl") {
        return None;
    }
    let TokenKind::Ident(name) = &tokens[1].kind else {
        return None;
    };
    Some(name.clone())
}

fn is_host_address(addr: u64) -> bool {
    const HOST_STUB_BASE: u64 = 0xFFFF_0000;
    (HOST_STUB_BASE..HOST_STUB_BASE + 0x1_0000).contains(&addr)
}

/// Token-based BL redirect. When the line is `bl <ident>` and `<ident>`
/// names a host stub with a registered trampoline, mutate `tokens[1]`
/// from `Ident(name)` to `Ident("__tramp_<name>")`. Returns true when
/// the rewrite happened. Operates on the lexer's already-tokenized
/// instruction so trailing comments (stripped by m4) and tab whitespace
/// (already collapsed by the lexer) cannot break the match the way the
/// raw-string version did.
pub(crate) fn redirect_bl_to_trampoline_tokens(
    tokens: &mut [crate::frontend::lexer::Token],
    tramp_addr: &HashMap<String, u64>,
) -> bool {
    if tokens.len() < 2 {
        return false;
    }
    let TokenKind::Ident(mn) = &tokens[0].kind else {
        return false;
    };
    if !mn.eq_ignore_ascii_case("bl") {
        return false;
    }
    let TokenKind::Ident(name) = &tokens[1].kind else {
        return false;
    };
    if !tramp_addr.contains_key(name) {
        return false;
    }
    let new_name = format!("__tramp_{name}");
    tokens[1].kind = TokenKind::Ident(new_name);
    true
}

/// Old string-based BL redirect. Kept under `#[cfg(test)]` only as a
/// regression baseline against the token form; production code uses
/// `redirect_bl_to_trampoline_tokens` exclusively.
#[cfg(test)]
fn redirect_bl_to_trampoline(line: &str, tramp_addr: &HashMap<String, u64>) -> String {
    let trimmed = line.trim_start();
    let rest = match trimmed.strip_prefix("bl ").or_else(|| trimmed.strip_prefix("BL ")) {
        Some(r) => r,
        None => return line.to_string(),
    };
    let target = rest.trim().trim_end_matches(|c: char| c.is_whitespace() || c == '\t');
    if tramp_addr.contains_key(target) {
        format!("bl __tramp_{target}")
    } else {
        line.to_string()
    }
}

fn err(line: usize, message: &str) -> EmuError {
    EmuError::AssemblyError {
        line,
        message: message.to_string(),
    }
}

/// Remove any leading `ident:` labels from a raw source line, since
/// `encode_line_absolute` expects just the instruction. Multiple labels
/// can appear in a row (`fn: main: stp fp, lr, ...`). Also strips `//`
/// and `;` line comments so the underlying encoder doesn't see them.
fn strip_leading_labels(line: &str) -> String {
    let mut s = line.trim_start();
    loop {
        let bytes = s.as_bytes();
        let mut end = 0;
        while end < bytes.len() {
            let b = bytes[end];
            let ok = b.is_ascii_alphanumeric() || b == b'_' || b == b'.' || b == b'$';
            if !ok {
                break;
            }
            end += 1;
        }
        if end == 0 || bytes.get(end) != Some(&b':') {
            break;
        }
        s = s[end + 1..].trim_start();
    }
    let s = match s.find("//") {
        Some(p) => &s[..p],
        None => s,
    };
    let s = match s.find(';') {
        Some(p) => &s[..p],
        None => s,
    };
    s.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        redirect_bl_to_trampoline_tokens, stringify_tokens, strip_leading_labels,
    };
    use crate::frontend::lexer::lex;
    use std::collections::HashMap;

    #[test]
    fn strips_single_label() {
        assert_eq!(strip_leading_labels("main: mov x0, 1"), "mov x0, 1");
    }

    #[test]
    fn strips_stacked_labels() {
        assert_eq!(
            strip_leading_labels("start: main: mov x0, 1"),
            "mov x0, 1"
        );
    }

    #[test]
    fn leaves_naked_instruction_alone() {
        assert_eq!(strip_leading_labels("  mov x0, 1"), "mov x0, 1");
    }

    #[test]
    fn strips_line_comments() {
        assert_eq!(strip_leading_labels("main: mov x0, 1 // hi"), "mov x0, 1");
        assert_eq!(strip_leading_labels("main: mov x0, 1 ; hi"), "mov x0, 1");
    }

    #[test]
    fn ignores_colon_inside_operand() {
        // No leading ident:, just pass through.
        assert_eq!(strip_leading_labels("ldr x0, [x1, :lo12:foo]"), "ldr x0, [x1, :lo12:foo]");
    }

    fn tramp_with_printf() -> HashMap<String, u64> {
        let mut t = HashMap::new();
        t.insert("printf".to_string(), 0x0040_1000u64);
        t
    }

    #[test]
    fn token_redirect_rewrites_plain_bl() {
        let mut tokens = lex("bl printf", 1).unwrap();
        let rewritten = redirect_bl_to_trampoline_tokens(&mut tokens, &tramp_with_printf());
        assert!(rewritten);
        assert_eq!(stringify_tokens(&tokens), "bl __tramp_printf");
    }

    #[test]
    fn token_redirect_handles_trailing_comment_after_m4_strip() {
        // m4 strips `// call libc` before the lexer sees it, so the
        // instruction tokens are exactly the same as the no-comment case.
        // The token-based redirect must succeed where the string version
        // could fail when fed an unstripped line.
        let mut tokens = lex("bl printf", 1).unwrap();
        let rewritten = redirect_bl_to_trampoline_tokens(&mut tokens, &tramp_with_printf());
        assert!(rewritten);
        assert_eq!(stringify_tokens(&tokens), "bl __tramp_printf");
    }

    #[test]
    fn token_redirect_handles_tab_whitespace() {
        // The string version does `strip_prefix("bl ")` (literal space)
        // and silently leaves `bl\tprintf` unrewritten. The lexer treats
        // tabs and spaces identically, so the token form succeeds here.
        let mut tokens = lex("bl\tprintf", 1).unwrap();
        let rewritten = redirect_bl_to_trampoline_tokens(&mut tokens, &tramp_with_printf());
        assert!(rewritten);
        assert_eq!(stringify_tokens(&tokens), "bl __tramp_printf");
    }

    #[test]
    fn token_redirect_leaves_string_literal_alone() {
        // `.string "bl printf"` lexes as a directive plus a single string
        // literal token; tokens[0] is not `Ident("bl")` so the function
        // must return false and not mutate the stream.
        let mut tokens = lex(".string \"bl printf\"", 1).unwrap();
        let before = tokens.clone();
        let rewritten = redirect_bl_to_trampoline_tokens(&mut tokens, &tramp_with_printf());
        assert!(!rewritten);
        assert_eq!(tokens, before);
    }

    #[test]
    fn token_redirect_returns_false_for_unknown_target() {
        let mut tokens = lex("bl my_local_label", 1).unwrap();
        let before = tokens.clone();
        let rewritten = redirect_bl_to_trampoline_tokens(&mut tokens, &tramp_with_printf());
        assert!(!rewritten);
        assert_eq!(tokens, before);
    }

    #[test]
    fn legacy_string_redirect_misses_tab_whitespace() {
        // Regression baseline: the old string-based version handles a
        // plain space-separated `bl printf` but silently leaves
        // `bl\tprintf` unrewritten because it does
        // `strip_prefix("bl ")` against a literal space. Pinning the
        // bug here so any future revival of the string form is forced
        // to confront it.
        use super::redirect_bl_to_trampoline;
        let tramp = tramp_with_printf();
        assert_eq!(
            redirect_bl_to_trampoline("bl printf", &tramp),
            "bl __tramp_printf"
        );
        assert_eq!(redirect_bl_to_trampoline("bl\tprintf", &tramp), "bl\tprintf");
    }
}
