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
use crate::cpu::{CODE_BASE, SECTION_WINDOW};
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
    /// Address of the first host-call trampoline, and the stub each 8-byte
    /// slot jumps to in emission order (slot `i` lives at
    /// `trampoline_base + i * 8`). One trampoline serves every call site of
    /// the same function, so these two only say WHICH libc function a pc
    /// inside the range belongs to; LR says which call site it came from.
    /// Zero and empty for a program that calls nothing hosted.
    pub trampoline_base: u64,
    pub trampoline_names: Vec<String>,
}

/// Literal-pool slot identity: the operand text, plus the address of the
/// LDR when the expression names the current address (`ldr xN, =. + k`).
/// Everything else deduplicates by text alone, the way GAS pools do.
type PoolKey = (String, Option<u64>);

/// Every value a `name = expr` equate takes, keyed by name, as
/// `(1-based source line, value)` pairs in no particular order.
///
/// GAS treats `=` as `.set`, which is POSITIONAL: a use takes the most
/// recent definition above it, and a use above every definition takes the
/// first one (both verified against aarch64-linux-gnu-as). Two files
/// concatenated into one workspace can each write `len = . - msg` against
/// their own string, and the linker used to keep only the first value and
/// hand it to both files' uses. Labels stay file-wide, as they are in GAS.
type EquateDefs = HashMap<String, Vec<(usize, u64)>>;

/// The value `name` holds at 1-based source `line`. Equates resolve
/// positionally; labels, host stubs and trampolines come from the flat
/// table, where they are visible from anywhere.
fn symbol_at(
    name: &str,
    line: usize,
    symbols: &HashMap<String, u64>,
    equates: &EquateDefs,
) -> Option<i64> {
    let Some(defs) = equates.get(name) else {
        return symbols.get(name).map(|v| *v as i64);
    };
    let mut best: Option<(usize, u64)> = None;
    for (at, value) in defs {
        if *at <= line && best.is_none_or(|(chosen, _)| *at >= chosen) {
            best = Some((*at, *value));
        }
    }
    match best {
        Some((_, value)) => Some(value as i64),
        // Above every definition: GAS resolves a forward reference to the
        // first binding the symbol receives.
        None => defs.iter().min_by_key(|(at, _)| *at).map(|(_, v)| *v as i64),
    }
}

/// Record one resolved equate definition. The flat table keeps the FIRST
/// value so that everything reading it as a plain map -- the membership
/// test in `looks_like_expression`, `LinkedImage.symbols`, the legacy
/// encoder's label lookup -- sees exactly what it saw before positional
/// resolution existed.
fn record_equate(
    name: &str,
    line: usize,
    value: u64,
    symbols: &mut HashMap<String, u64>,
    equates: &mut EquateDefs,
) {
    symbols.entry(name.to_string()).or_insert(value);
    equates.entry(name.to_string()).or_default().push((line, value));
}

pub fn assemble_hosted(source: &str, host: &HostTable) -> Result<LinkedImage, EmuError> {
    let prog = parse(source)?;
    link(&prog, host)
}

fn link(prog: &Program, host: &HostTable) -> Result<LinkedImage, EmuError> {
    let mut layout = collect_and_place(prog)?;

    // Pass 1b: host-stub addresses so `bl printf` (via a literal-pool
    // trampoline) and any direct-label lookups can find them.
    for name in host.names() {
        if let Some(addr) = host.lookup(name) {
            layout.symbols.entry(name.to_string()).or_insert(addr);
        }
    }

    // The three standard streams, as glibc exposes them: a symbol naming
    // a loader-written word that holds the FILE*, so `ldr x0, =stderr`
    // followed by `ldr x0, [x0]` reaches the handle fprintf wants. Seeded
    // like the host stubs above, so a program with its own `stdout` label
    // keeps it.
    for (i, name) in ["stdin", "stdout", "stderr"].iter().enumerate() {
        layout
            .symbols
            .entry((*name).to_string())
            .or_insert(crate::hosted::stdio::STDIO_GLOBALS_BASE + (i as u64) * 8);
    }

    resolve_equates(&mut layout)?;
    let pool = size_literal_pool(prog, &mut layout)?;
    let emission = emit_image(prog, &layout, &pool)?;
    let entry_point = resolve_entry_point(prog, &layout)?;

    Ok(LinkedImage {
        writes: emission.writes,
        entry_point,
        instruction_count: emission.instruction_count,
        text_base: CODE_BASE,
        text_end: CODE_BASE + layout.text_len,
        symbols: layout.symbols,
        line_map: emission.line_map,
        // `tramp_base` is a real address even with nothing to put there;
        // report 0 so a caller can tell "no host calls" from "trampolines
        // start here" without consulting the name list.
        trampoline_base: if pool.trampolines.is_empty() { 0 } else { pool.tramp_base },
        trampoline_names: pool.trampolines,
    })
}

/// Where everything landed, worked out before a single byte is emitted.
/// The layout passes fill it in and pass 2 walks the identical layout from
/// it, so the two can never disagree about a size or an address.
struct Layout {
    /// Flat name -> absolute address for labels, host stubs, trampoline
    /// labels, and each equate's first value.
    symbols: HashMap<String, u64>,
    /// Every value each `name = expr` equate takes, for the positional
    /// resolution `symbol_at` does.
    equates: EquateDefs,
    /// First-definition lines, for duplicate-label errors that name both
    /// sites. GAS rejects a redefined label; accepting it here made the
    /// last definition win silently, so branches jumped to the wrong copy.
    label_lines: HashMap<String, usize>,
    /// Each label's offset within its own section. GAS resolves a defined
    /// label used as an instruction immediate (`ldr x19, [fp, a_local]`,
    /// `add x1, fp, a_local`, `cmp x0, a_local`) to this section-relative
    /// value at assembly time, with no relocation -- verified against
    /// aarch64 GAS on the course servers. The absolute address in `symbols`
    /// stays the answer everywhere else (branches, `ldr =`, adr, .quad).
    label_offsets: HashMap<String, u64>,
    /// `.skip <expr>` byte counts, resolved during the placement walk and
    /// reused by pass 2 rather than evaluated a second time.
    reserve_sizes: HashMap<(SectionKind, usize), u64>,
    /// Absolute address of each `.text` instruction, in emission order.
    /// Pass 1d needs it to size a per-site literal pool slot for
    /// `ldr xN, =. + k`, and taking it from the placement walk is what
    /// keeps the three passes' layouts from drifting apart.
    text_instr_pcs: Vec<u64>,
    /// Byte length of `.text`, which fixes where the trampolines, the
    /// literal pool and the image's fall-through boundary sit.
    text_len: u64,
    /// `name = expr` assignments still waiting on a symbol, as
    /// (name, body, the address the line sits at, 1-based source line).
    assignments: Vec<(String, String, u64, usize)>,
}

/// The literal pool and the libc trampolines, sized and placed. A slot is
/// a byte offset from `base`; `tramp_addr` names the trampoline each
/// hosted `bl` is redirected through.
struct Pool {
    slots: HashMap<PoolKey, u64>,
    values: Vec<u64>,
    /// Host functions that need a trampoline, in emission order:
    /// trampoline `i` sits at `tramp_base + i * 8`.
    trampolines: Vec<String>,
    tramp_addr: HashMap<String, u64>,
    tramp_base: u64,
    base: u64,
}

/// What pass 2 produced: the byte writes in emission order, the
/// authoritative address -> editor-line map, and the number of
/// instruction words that landed.
struct Emission {
    writes: Vec<(u64, Vec<u8>)>,
    line_map: Vec<(u64, u32)>,
    instruction_count: usize,
}

/// Pass 1a: place labels at section base + running byte offset, and
/// collect `name = expr` assignments with the address where they
/// appear so the linker can evaluate `. - msg - 1` and similar bodies
/// in the right place. Assignments that resolve against the symbols
/// seen so far fold immediately -- `.skip STACKSIZE * 4` needs its
/// equate during this very walk; the rest wait for pass 1c's rounds.
/// Reserve sizes resolved here are kept for pass 2, which must walk
/// the identical layout.
///
/// Section bases sit one `cpu::SECTION_WINDOW` apart
/// (SectionKind::default_base), so any section that outgrows the window
/// silently runs into the next one's addresses: two labels on one
/// address, stores clobbering unrelated variables. Checked during this
/// walk, where the offending line is still known.
fn collect_and_place(prog: &Program) -> Result<Layout, EmuError> {
    let mut symbols: HashMap<String, u64> = HashMap::new();
    let mut equates: EquateDefs = HashMap::new();
    let mut text_len: u64 = 0;
    let mut assignments: Vec<(String, String, u64, usize)> = Vec::new();
    let mut reserve_sizes: HashMap<(SectionKind, usize), u64> = HashMap::new();
    let mut label_lines: HashMap<String, usize> = HashMap::new();
    let mut label_offsets: HashMap<String, u64> = HashMap::new();
    let mut text_instr_pcs: Vec<u64> = Vec::new();
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
                    label_offsets.insert(name.clone(), offset);
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
                    // Every definition is folded and recorded, not just the
                    // first: a redefined name has one value per site and
                    // each use takes the one above it. Folding here rather
                    // than waiting for pass 1c is what lets `.skip
                    // STACKSIZE * 4` size during this very walk.
                    if let Some(v) =
                        try_evaluate_at(body, base + offset, &symbols, &equates, *original_line)
                    {
                        record_equate(name, *original_line, v as u64, &mut symbols, &mut equates);
                        continue;
                    }
                    assignments.push((name.clone(), body.clone(), base + offset, *original_line));
                }
                Item::Instruction { tokens, original_line } => {
                    last_line = *original_line;
                    if section.kind == SectionKind::Text {
                        text_instr_pcs.push(base + offset);
                    }
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
                    // The `ldr reg, label` literal load lowers to two
                    // words (pass 2); every walk must agree on the size
                    // or the layouts drift apart.
                    offset += if extract_ldr_label_load(tokens).is_some() {
                        8
                    } else {
                        4
                    };
                }
                Item::DataExprs { exprs, width, original_line } => {
                    last_line = *original_line;
                    offset += (exprs.len() * width) as u64;
                }
                Item::ReserveExpr { tokens, original_line } => {
                    last_line = *original_line;
                    let value = evaluate(
                        tokens,
                        &|name| symbol_at(name, *original_line, &symbols, &equates),
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

    Ok(Layout {
        symbols,
        equates,
        label_lines,
        label_offsets,
        reserve_sizes,
        text_instr_pcs,
        text_len,
        assignments,
    })
}

/// Pass 1c: evaluate each `name = expr` assignment using its recorded
/// `.` address. Do multiple rounds since later assignments can depend
/// on earlier ones or on labels defined later in the same section.
fn resolve_equates(layout: &mut Layout) -> Result<(), EmuError> {
    for _ in 0..16 {
        let mut changed = false;
        let mut remaining: Vec<(String, String, u64, usize)> = Vec::new();
        for (name, body, here, line) in &layout.assignments {
            // A pending assignment whose name turned out to be a label
            // (defined after it) must not vanish silently. Checked against
            // `label_lines` rather than the folded-symbol table, because a
            // name bound by an earlier equate is no longer a reason to
            // skip this definition -- each one has its own value.
            if let Some(first) = layout.label_lines.get(name) {
                return Err(EmuError::AssemblyError {
                    line: *line,
                    message: format!(
                        "`{name} = ...` collides with the label `{name}:` \
                         on line {first} -- rename one of them"
                    ),
                });
            }
            if let Some(v) =
                try_evaluate_at(body, *here, &layout.symbols, &layout.equates, *line)
            {
                record_equate(
                    name,
                    *line,
                    v as u64,
                    &mut layout.symbols,
                    &mut layout.equates,
                );
                changed = true;
            } else {
                remaining.push((name.clone(), body.clone(), *here, *line));
            }
        }
        layout.assignments = remaining;
        if !changed {
            break;
        }
    }

    // Whatever is still pending is permanently broken -- a typo'd symbol,
    // a division by zero, a cycle. Re-run the evaluation WITHOUT the
    // `.ok()` so its own error (which names the cause at the assignment's
    // line) surfaces; silently dropping it used to blame the innocent USE
    // site with "invalid immediate".
    if let Some((_, body, here, line)) = layout.assignments.first() {
        let tokens = lex(body, *line)?;
        evaluate(
            &tokens,
            &|name| symbol_at(name, *line, &layout.symbols, &layout.equates),
            *here as i64,
            *line,
        )?;
        // Unreachable in practice: the fixpoint loop already failed this
        // assignment against the same symbol table.
    }

    // Pin each equate's flat-table value to its FIRST definition by SOURCE
    // line. The flat table is what every non-positional reader gets
    // (`LinkedImage.symbols`, the legacy encoder's label lookup), and the
    // passes above fill it in walk order -- which is section order, not
    // source order -- so a redefined name could otherwise land there with
    // whichever definition the linker happened to reach first.
    for (name, defs) in &layout.equates {
        if let Some((_, value)) = defs.iter().min_by_key(|(line, _)| *line) {
            layout.symbols.insert(name.clone(), *value);
        }
    }

    Ok(())
}

/// Pass 1d: scan .text instructions for `ldr xN, =expr` to size the
/// literal pool, and for `bl <hostname>` calls that need a trampoline
/// because direct BL cannot reach the 0xFFFF_0000 host-stub range.
/// Keyed by operand text plus, for a `.`-relative expression, the
/// address of the LDR itself. `ldr x0, =. + 8` is a different constant
/// at every site, so sharing one slot by text handed the second site
/// the first one's value -- and `.` used to resolve to 0 outright.
fn size_literal_pool(prog: &Program, layout: &mut Layout) -> Result<Pool, EmuError> {
    let mut pool_slots: HashMap<PoolKey, u64> = HashMap::new();
    let mut pool_values: Vec<u64> = Vec::new();
    let mut host_trampolines: Vec<String> = Vec::new();
    let mut host_trampoline_set: HashMap<String, ()> = HashMap::new();
    let mut text_pcs = layout.text_instr_pcs.iter();
    for section in &prog.sections {
        if section.kind != SectionKind::Text {
            continue;
        }
        for item in &section.items {
            if let Item::Instruction { tokens, original_line } = item {
                let pc = *text_pcs
                    .next()
                    .expect("pass 1a records one pc per .text instruction");
                if let Some((target_text, dot_relative)) = extract_ldr_eq_operand(tokens) {
                    let here = if dot_relative { Some(pc) } else { None };
                    if let std::collections::hash_map::Entry::Vacant(slot) =
                        pool_slots.entry((target_text, here))
                    {
                        let value = resolve_ldr_eq_target(
                            &slot.key().0,
                            &layout.symbols,
                            &layout.equates,
                            here.unwrap_or(0),
                            *original_line,
                        )?;
                        slot.insert(pool_values.len() as u64 * 8);
                        pool_values.push(value);
                    }
                    continue;
                }
                if let Some((_, label_text)) = extract_ldr_label_load(tokens) {
                    // The label's address goes into the pool like an
                    // `ldr xN, =label` constant would; the two forms
                    // share a slot when both appear.
                    if let std::collections::hash_map::Entry::Vacant(slot) =
                        pool_slots.entry((label_text, None))
                    {
                        let value = resolve_ldr_eq_target(
                            &slot.key().0,
                            &layout.symbols,
                            &layout.equates,
                            0,
                            *original_line,
                        )?;
                        slot.insert(pool_values.len() as u64 * 8);
                        pool_values.push(value);
                    }
                    continue;
                }
                if let Some(target) = extract_bl_target(tokens) {
                    if let Some(addr) = layout.symbols.get(&target) {
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
    let tramp_base = CODE_BASE + ((layout.text_len + 8) & !7);
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
        layout.symbols.insert(format!("__tramp_{name}"), addr);
        // Reserve a literal pool slot holding the real host-stub address,
        // if one isn't already there under the host name.
        let host_addr = *layout.symbols.get(name).expect("host target in symbols");
        pool_slots
            .entry((name.clone(), None))
            .or_insert_with(|| {
                let slot = pool_values.len() as u64 * 8;
                pool_values.push(host_addr);
                slot
            });
    }

    Ok(Pool {
        slots: pool_slots,
        values: pool_values,
        trampolines: host_trampolines,
        tramp_addr,
        tramp_base,
        base: pool_base,
    })
}

/// Pass 2: emit bytes for every section, then the literal pool.
fn emit_image(prog: &Program, layout: &Layout, pool: &Pool) -> Result<Emission, EmuError> {
    // Name the pieces this pass reads, so the emission below says
    // `symbols` and `pool_base` the way the passes that produced them do.
    let Layout { symbols, equates, label_offsets, reserve_sizes, .. } = layout;
    let Pool {
        slots: pool_slots,
        values: pool_values,
        trampolines: host_trampolines,
        tramp_addr,
        ..
    } = pool;
    let tramp_base = pool.tramp_base;
    let pool_base = pool.base;

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
                            let pad = n - rem;
                            // GAS fills a .text alignment gap with NOPs so a
                            // fall-through executes cleanly; data sections
                            // stay zero-filled by the fresh pages. Pad words
                            // are not student instructions, so they get no
                            // line-map entry and no instruction_count bump.
                            if section.kind == SectionKind::Text && offset.is_multiple_of(4) {
                                let words = (pad / 4) as usize;
                                if words > 0 {
                                    let mut bytes = Vec::with_capacity(words * 4);
                                    for _ in 0..words {
                                        bytes.extend_from_slice(
                                            &crate::decoder::NOP_WORD.to_le_bytes(),
                                        );
                                    }
                                    writes.push((base + offset, bytes));
                                }
                            }
                            offset += pad;
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
                            &|name| symbol_at(name, *original_line, symbols, equates),
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
                    if let Some((reg, label_text)) = extract_ldr_label_load(tokens) {
                        // GAS encodes `ldr reg, label` as one LDR
                        // (literal), and the servers' linker resolves it
                        // because ld packs the sections a few KB apart.
                        // Here .data and .bss sit 2-3 MiB from .text --
                        // past imm19's 1 MiB reach -- so the linker
                        // lowers it to two words: the label's address
                        // arrives from the literal pool (a real LDR
                        // (literal), always in reach), then an ordinary
                        // load through it. The X view of the destination
                        // doubles as the address register; the s/d forms
                        // borrow x16, the same scratch the libc
                        // trampolines already claim.
                        let addr_reg: u8 = match parse_ldr_dest(&reg) {
                            Some(LdrDest::Gpr { idx }) => idx,
                            Some(LdrDest::Fp) => 16,
                            None => unreachable!("recognizer only claims parseable dests"),
                        };
                        let slot = *pool_slots
                            .get(&(label_text.clone(), None))
                            .ok_or_else(|| EmuError::LinkError {
                                line: *original_line,
                                message: format!(
                                    "no literal pool slot for `{label_text}`"
                                ),
                            })?;
                        let slot_addr = pool_base + slot;
                        let word1 =
                            encode_ldr_literal(true, addr_reg, slot_addr as i64 - pc as i64)?;
                        let word2 = assembler::encode_line_absolute(
                            &format!("ldr {reg}, [x{addr_reg}]"),
                            pc + 4,
                            symbols,
                            *original_line,
                        )?;
                        writes.push((pc, word1.to_le_bytes().to_vec()));
                        writes.push((pc + 4, word2.to_le_bytes().to_vec()));
                        line_map.push((pc, *original_line as u32));
                        line_map.push((pc + 4, *original_line as u32));
                        offset += 8;
                        instruction_count += 2;
                        continue;
                    }
                    let word = if let Some((target_text, dot_relative)) =
                        extract_ldr_eq_operand(tokens)
                    {
                        let (rt, sf) = parse_ldr_eq_rt(tokens, *original_line)?;
                        let here = if dot_relative { Some(pc) } else { None };
                        let slot = *pool_slots.get(&(target_text.clone(), here)).ok_or_else(
                            || EmuError::LinkError {
                                line: *original_line,
                                message: format!("no literal pool slot for `{target_text}`"),
                            },
                        )?;
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
                        redirect_bl_to_trampoline_tokens(&mut tokens_owned, tramp_addr);
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
                            // `.` inside an instruction immediate folds
                            // section-relative, exactly like a label: GAS
                            // gives `add x1, x1, . - main` the distance 8,
                            // not an absolute address. Instructions only
                            // exist in .text, so the section offset is
                            // pc - CODE_BASE.
                            lower_operands(
                                &stripped,
                                pc - crate::cpu::CODE_BASE,
                                symbols,
                                equates,
                                label_offsets,
                                *original_line,
                            )?
                        };
                        assembler::encode_line_absolute(
                            &line_text,
                            pc,
                            symbols,
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
        let slot = pool_slots[&(name.clone(), None)];
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

    Ok(Emission {
        writes,
        line_map,
        instruction_count,
    })
}

/// The address execution starts at, which real ld takes from `main` (or
/// `_start` for a program that declares neither a `main` label nor a
/// `.global main`).
fn resolve_entry_point(prog: &Program, layout: &Layout) -> Result<u64, EmuError> {
    // An entry point has to be a LABEL. `main = 5` also lands in `symbols`,
    // and taking it started execution at address 5 with no diagnostic.
    let main_is_label = layout.label_lines.contains_key("main");
    let start_is_label = layout.label_lines.contains_key("_start");

    // `.global main` with no `main:` silently fell back to CODE_BASE;
    // real ld reports the undefined reference. It is only an error when
    // nothing else can be the entry point, though: ld links a program that
    // declares the global out of habit and enters at `_start`, because an
    // unreferenced undefined global is not an error.
    if prog.globals.contains("main") && !main_is_label && !start_is_label {
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
    if !main_is_label && !start_is_label {
        return Err(EmuError::LinkError {
            line: 0,
            message: "no entry point -- define `main:` (declared `.global main`) \
                      or `_start:`. A file holding only helper functions runs as \
                      part of a program whose other file has `main`"
                .into(),
        });
    }
    // `_start`-only programs used to fall back to CODE_BASE, which runs
    // whatever helper happens to sit at the top of .text instead of the
    // program the student wrote.
    Ok(if main_is_label {
        layout.symbols["main"]
    } else {
        layout.symbols["_start"]
    })
}

/// Return the textual key for an `ldr xN, =<expr>` pseudo plus whether the
/// expression names the current address, or None if the instruction is
/// something else. `.` makes the constant depend on where the LDR sits, so
/// the caller has to key its pool slot per site rather than by text.
fn extract_ldr_eq_operand(
    tokens: &[crate::frontend::lexer::Token],
) -> Option<(String, bool)> {
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
    let operand = &after[1..];
    let dot_relative = operand.iter().any(|t| matches!(t.kind, TokenKind::Dot));
    Some((stringify_tokens(operand), dot_relative))
}

/// Recognize the GAS `ldr <reg>, <label-expr>` literal-load form (no
/// brackets, no `=`, no `#`): load the value AT the label's address.
/// Returns the destination register text and the operand's textual key.
/// Bare-register tails (`ldr x0, x1`), addressing modes, `=expr` pool
/// loads, and `#imm` all keep their existing paths and their existing
/// errors; so does any destination the lowering cannot emit.
fn extract_ldr_label_load(
    tokens: &[crate::frontend::lexer::Token],
) -> Option<(String, String)> {
    if tokens.len() < 4 {
        return None;
    }
    let TokenKind::Ident(mn) = &tokens[0].kind else {
        return None;
    };
    if !mn.eq_ignore_ascii_case("ldr") {
        return None;
    }
    let TokenKind::Ident(reg) = &tokens[1].kind else {
        return None;
    };
    if !matches!(tokens[2].kind, TokenKind::Comma) {
        return None;
    }
    let tail = &tokens[3..];
    let first = tail.first()?;
    if !matches!(
        first.kind,
        TokenKind::Ident(_) | TokenKind::DirectiveIdent(_)
    ) {
        return None;
    }
    if tail.iter().any(|t| {
        matches!(
            t.kind,
            TokenKind::LBracket | TokenKind::Equals | TokenKind::Hash
        )
    }) {
        return None;
    }
    if let TokenKind::Ident(first_name) = &first.kind {
        if is_register_or_shift_keyword(first_name) {
            return None;
        }
    }
    parse_ldr_dest(reg)?;
    Some((reg.clone(), stringify_tokens(tail)))
}

/// The destination of an `ldr reg, label` load, by register class.
enum LdrDest {
    Gpr { idx: u8 },
    Fp,
}

/// Parse the destination register of an `ldr reg, label` load. X/W use
/// their own X view as the address holder; S/D borrow x16. Anything
/// else (q0, xzr, sp) returns None so the caller leaves the line to the
/// legacy encoder and its diagnostics.
fn parse_ldr_dest(reg: &str) -> Option<LdrDest> {
    let mut chars = reg.chars();
    let class = chars.next()?.to_ascii_lowercase();
    let idx: u8 = reg[1..].parse().ok()?;
    match class {
        'x' | 'w' if idx <= 30 => Some(LdrDest::Gpr { idx }),
        'd' | 's' if idx <= 31 => Some(LdrDest::Fp),
        _ => None,
    }
}

/// Render a token slice back to source text. Every `TokenKind` gets an
/// arm on purpose: the old catch-all silently dropped whole tokens, so
/// `ldr x0, =.Lmsg` (a DirectiveIdent) produced an empty operand and two
/// different operands could collapse onto the same literal-pool key. The
/// match stays exhaustive so a new token kind is a compile error here
/// instead of a silent hole.
fn stringify_tokens(tokens: &[crate::frontend::lexer::Token]) -> String {
    let mut out = String::new();
    for t in tokens {
        match &t.kind {
            TokenKind::Ident(s) => out.push_str(s),
            // Dotted local labels (`ldr x0, =.Lmsg`) ride through like any
            // other symbol; dropping them left an empty operand.
            TokenKind::DirectiveIdent(s) => out.push_str(s),
            TokenKind::IntLit(v) => out.push_str(&format!("{v}")),
            TokenKind::FloatLit(v) => out.push_str(&format!("{v}")),
            TokenKind::CharLit(v) => out.push_str(&format!("{v}")),
            // Re-quote the bytes so the result lexes back to this same
            // literal. Non-printables use the OCTAL escape, which is
            // capped at three digits: `\x` runs greedily, so a `\x01`
            // followed by a printable hex digit would merge into one byte.
            TokenKind::StringLit(bytes) => {
                out.push('"');
                for &b in bytes {
                    match b {
                        b'"' => out.push_str("\\\""),
                        b'\\' => out.push_str("\\\\"),
                        0x20..=0x7E => out.push(b as char),
                        _ => out.push_str(&format!("\\{b:03o}")),
                    }
                }
                out.push('"');
            }
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
            TokenKind::LBracket => out.push('['),
            TokenKind::RBracket => out.push(']'),
            TokenKind::LBrace => out.push('{'),
            TokenKind::RBrace => out.push('}'),
            TokenKind::Colon => out.push(':'),
            TokenKind::Equals => out.push('='),
            TokenKind::Dot => out.push('.'),
            TokenKind::Hash => out.push('#'),
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
    equates: &EquateDefs,
    here: u64,
    line: usize,
) -> Result<u64, EmuError> {
    // Lex the operand fragment, evaluate as an expression with the full
    // symbol table. `here` is the address of the LDR that asked for this
    // slot, which is what GAS resolves `.` to inside an `=expr` operand.
    // Passing 0 unconditionally made `ldr x0, =. + 8` load 8.
    let tokens = lex(text, line)?;
    let value = evaluate(
        &tokens,
        &|name| symbol_at(name, line, symbols, equates),
        here as i64,
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
    equates: &EquateDefs,
    line: usize,
) -> Option<i64> {
    let tokens = lex(body, line).ok()?;
    evaluate(
        &tokens,
        &|name| symbol_at(name, line, symbols, equates),
        here as i64,
        line,
    )
    .ok()
}

/// How deep `[`...`]` nesting may go before an operand is refused.
/// `rewrite_operand` and `rewrite_operand_list` call each other once per
/// bracket level, so `[[[[...]]]]` recurses without bound. A wasm stack
/// overflow is unrecoverable -- the trap skips wasm-bindgen's borrow-guard
/// Drop and every later call fails on the stuck borrow flag -- so depth is
/// counted and refused long before the stack is at risk. This mirrors
/// `expr::MAX_EXPR_DEPTH`, which guards the same hazard on the expression
/// side. Real addressing modes nest one level.
const MAX_OPERAND_DEPTH: usize = 32;

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
    equates: &EquateDefs,
    label_offsets: &HashMap<String, u64>,
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
    let rewritten = rewrite_operand_list(tail, pc, symbols, equates, label_offsets, ln, 0)?;
    Ok(format!("{mnemonic} {rewritten}"))
}

fn is_branch_mnemonic(mn: &str) -> bool {
    let lower = mn.to_ascii_lowercase();
    // Unconditional and link branches, conditional branches (both the
    // `b.cond` and dotless `bcond` spellings), CBZ/CBNZ and TBZ/TBNZ
    // families; all take a label in their last operand slot. Missing the
    // dotless spellings here once rewrote `bne loop` to a section offset
    // that encode_bcond then took as a pc-relative displacement, so the
    // branch landed at pc + (loop - .text base) with no error.
    matches!(lower.as_str(), "b" | "bl" | "cbz" | "cbnz" | "tbz" | "tbnz")
        || lower.starts_with("b.")
        || is_dotless_bcond(&lower)
}

/// `b<cc>` for any condition spelling in the shared table. The whole tail
/// must be a condition, which keeps `bl`, `blr` and `bic` out.
fn is_dotless_bcond(lower: &str) -> bool {
    lower.strip_prefix('b').is_some_and(|tail| {
        crate::registers::CONDITIONS.iter().any(|(primary, aliases, _)| {
            primary.eq_ignore_ascii_case(tail)
                || aliases.iter().any(|a| a.eq_ignore_ascii_case(tail))
        })
    })
}

fn rewrite_operand_list(
    s: &str,
    pc: u64,
    symbols: &HashMap<String, u64>,
    equates: &EquateDefs,
    label_offsets: &HashMap<String, u64>,
    ln: usize,
    depth: usize,
) -> Result<String, EmuError> {
    let mut out: Vec<String> = Vec::new();
    let segments = split_top_level_commas(s);
    for seg in segments {
        out.push(rewrite_operand(seg.trim(), pc, symbols, equates, label_offsets, ln, depth)?);
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
    equates: &EquateDefs,
    label_offsets: &HashMap<String, u64>,
    ln: usize,
    depth: usize,
) -> Result<String, EmuError> {
    if depth > MAX_OPERAND_DEPTH {
        return Err(EmuError::AssemblyError {
            line: ln,
            message: format!("addressing operand nests deeper than {MAX_OPERAND_DEPTH} brackets"),
        });
    }
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
        let rewritten_inside =
            rewrite_operand_list(inside, pc, symbols, equates, label_offsets, ln, depth + 1)?;
        return Ok(format!("[{rewritten_inside}{trailer}"));
    }
    // Strip a leading `#` while evaluating; the legacy encoder accepts
    // either form, so we emit the decimal literal without the hash.
    let body = trimmed.strip_prefix('#').unwrap_or(trimmed).trim();
    if !looks_like_expression(body, symbols) {
        return Ok(trimmed.to_string());
    }
    match try_evaluate_operand(body, pc, symbols, equates, label_offsets, ln)? {
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
    equates: &EquateDefs,
    label_offsets: &HashMap<String, u64>,
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
    // A defined label names its section-relative offset here, the way GAS
    // resolves a label inside an instruction's immediate field (no
    // relocation exists for those bits, so GAS folds the symbol's raw
    // section offset -- verified against the course servers). Equates and
    // everything else keep their absolute values from `symbol_at`.
    match evaluate(
        &tokens,
        &|name| match label_offsets.get(name) {
            Some(off) => Some(*off as i64),
            None => symbol_at(name, ln, symbols, equates),
        },
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
    // Literal-aware: a `;` inside a character or string literal is
    // content, and cutting there truncated `mov w1, ';'` mid-operand.
    crate::frontend::m4::strip_comment(s).trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        is_branch_mnemonic, redirect_bl_to_trampoline_tokens, stringify_tokens,
        strip_leading_labels,
    };
    use crate::frontend::lexer::{lex, TokenKind};
    use std::collections::HashMap;

    #[test]
    fn every_label_taking_mnemonic_is_recognised_as_a_branch() {
        // A conditional-branch spelling the recognizer misses gets its label
        // rewritten to a section offset, which encodes as a wrong-target
        // branch with no error; this walks the whole set so the gap class
        // cannot reopen.
        for mn in ["b", "bl", "cbz", "cbnz", "tbz", "tbnz"] {
            assert!(is_branch_mnemonic(mn), "{mn}");
        }
        for (primary, aliases, _) in crate::registers::CONDITIONS {
            for cc in std::iter::once(primary).chain(aliases.iter()) {
                for spelling in [
                    format!("b.{cc}"),
                    format!("b{cc}"),
                    format!("B.{cc}"),
                    format!("B{cc}"),
                ] {
                    assert!(is_branch_mnemonic(&spelling), "{spelling}");
                }
            }
        }
        for mn in ["blr", "br", "bic", "bfi", "bfxil", "add", "ldr"] {
            assert!(!is_branch_mnemonic(mn), "{mn} is not a label-taking branch");
        }
    }

    #[test]
    fn strip_leading_labels_keeps_literal_semicolons() {
        // The tail stripper once cut at the first `;` unconditionally,
        // truncating a character-literal operand mid-quote.
        assert_eq!(strip_leading_labels("mov w3, ';'"), "mov w3, ';'");
        assert_eq!(strip_leading_labels("here: mov w3, ';' ; a comment"), "mov w3, ';'");
        assert_eq!(strip_leading_labels(".string \"a;b\" // trailing"), ".string \"a;b\"");
    }

    #[test]
    fn stringify_carries_every_token_kind() {
        // The old catch-all dropped FloatLit, StringLit, brackets, braces,
        // `:` and `=` without a word, so two different operands could
        // collapse onto one literal-pool key. Round-tripping through the
        // lexer proves nothing is lost.
        let source = r#"foo .Lbar 42 3.5 'A' "hi\n" , + - * / % & | ^ ~ ! << >> ( ) [ ] { } : = . #"#;
        let tokens = lex(source, 1).unwrap();
        let rendered = stringify_tokens(&tokens);
        let relexed = lex(&rendered, 1).unwrap();
        // A char literal deliberately renders as its numeric value, which
        // is what the expression evaluator on the other side wants; every
        // other kind has to come back exactly as it went in.
        let expected: Vec<TokenKind> = tokens
            .iter()
            .map(|t| match &t.kind {
                TokenKind::CharLit(v) => TokenKind::IntLit(i64::from(*v)),
                other => other.clone(),
            })
            .collect();
        assert_eq!(
            relexed.iter().map(|t| t.kind.clone()).collect::<Vec<_>>(),
            expected,
            "rendered as: {rendered}"
        );
    }

    #[test]
    fn stringified_strings_survive_the_greedy_hex_escape() {
        // `\x` runs until the first non-hex byte, so escaping a
        // non-printable as `\x01` next to a printable '4' would re-lex as
        // one 0x14. The octal escape is capped at three digits.
        let tokens = lex("\"\\001 4\"", 1).unwrap();
        let relexed = lex(&stringify_tokens(&tokens), 1).unwrap();
        assert_eq!(relexed[0].kind, TokenKind::StringLit(vec![1, b' ', b'4']));
    }

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
