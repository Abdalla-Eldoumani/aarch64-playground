# Architecture

## Shape of the project

Two workspaces, one monorepo.

```
┌────────────────────────────────────────────────┐
│ web/    Next.js 16 (App Router) + React 19     │
│         Monaco editor, register/memory/stack   │
│         panels, Controls, InstructionView      │
├────────────────────────────────────────────────┤
│         ↑  wasm-bindgen generated JS bindings  │
├────────────────────────────────────────────────┤
│ emulator/  pure Rust                           │
│   registers.rs  -- X0..X30, SP, PC, NZCV       │
│   memory.rs     -- paged Vec<u8>, 4 KiB pages  │
│   decoder.rs    -- 32-bit word -> Instruction  │
│   executor.rs   -- Instruction + state -> ()   │
│   cpu.rs        -- top-level step / run loop   │
│   assembler.rs  -- two-pass text -> Vec<u32>   │
│   errors.rs     -- EmuError enum               │
│   lib.rs        -- #[wasm_bindgen] API         │
└────────────────────────────────────────────────┘
```

The emulator never depends on anything browser-specific. The wasm-bindgen wrappers in `lib.rs` are the only place the Rust side touches JS types. Everything else compiles and tests cleanly on native.

## Execution flow

1. User types assembly in Monaco.
2. Click **assemble** -> `emu.assembleAndLoad(source)` in [`web/lib/emulator.ts`](../web/lib/emulator.ts).
3. Rust side, [`lib.rs`](../emulator/src/lib.rs) `Emulator::assemble_and_load`:
   - calls [`assembler::assemble(source)`](../emulator/src/assembler.rs) -- two-pass assembler returns `Vec<u32>`
   - `cpu.reset()` zeroes registers and in-place-clears mapped memory pages
   - `cpu.load_program(code)` writes the words to `CODE_BASE` (0x400000)
   - returns a serialized `AssembleResultJs` to JS
4. React reads the results back: `instructions[]` built by `getMemoryRange` + source-line text.
5. **step** / **run** call `cpu.step()` in a loop; after each batch, `use-emulator.ts` calls `syncState()` which pulls all registers + NZCV + changed-regs + halted out of Rust and into React state.

The cardinal rule: state lives in Rust. React reads slices via getters after every mutation. Never mirror state on the JS side.

## The two-pass assembler

```
Pass 1: strip comments, collect labels -> HashMap<String, u64>
Pass 2: for each non-label line, call encode_line()
        which dispatches on mnemonic and emits a 32-bit word
```

Labels resolve to byte offsets relative to `CODE_BASE`. Branch offsets are PC-relative and computed in pass 2 using the label table.

Pseudo-instructions are rewritten inside the encoder:

- `MOV Xd, #imm` -> `MOVZ` + optional `MOVK`s (or `ORR` for logical-immediate patterns)
- `CMP Xn, ...` -> `SUBS XZR, Xn, ...`
- `CMN Xn, ...` -> `ADDS XZR, Xn, ...`
- `TST Xn, ...` -> `ANDS XZR, Xn, ...`
- `NEG Xd, Xm` -> `SUB Xd, XZR, Xm`
- `MVN Xd, Xm` -> `ORN Xd, XZR, Xm` (implemented via logical-shifted encoding with N=1)
- `CSET Xd, cond` -> `CSINC Xd, XZR, XZR, !cond`
- `LSL/LSR/ASR` immediate forms -> `UBFM`/`SBFM` with the right immr/imms

This keeps the executor small: it only has to know the canonical encodings.

## Decoder

ARMv8 instructions are fixed 32-bit. The decoder is a cascade of
`if (word & mask) == pattern` checks ordered from most-specific to least-specific, returning a typed `Instruction` enum. Verbose but easy to single-step through in a debugger.

## Memory model

`HashMap<u64, Vec<u8>>` keyed by 4 KiB page base address. First write to an address auto-maps the page. `Memory::clear()` zero-fills existing pages in place rather than dropping/reallocating them -- see the gotcha note in [`emulator/CLAUDE.md`](../emulator/CLAUDE.md) for why.

`Cpu::new` pre-maps the four stack pages below `STACK_BASE` (0x80000000) and four code pages starting at `CODE_BASE` (0x400000). `load_program` never triggers a mid-call page allocation, which sidesteps a dlmalloc invariant on wasm32 that would otherwise trap.

## State sync

The React hook in [`web/lib/use-emulator.ts`](../web/lib/use-emulator.ts) owns a ref to the `EmulatorInstance` and a ref to the last-assembled source. Every `step` / `run` tick ends with `syncState()`, which pulls:

- `get_all_registers()` -> `{gpr[], sp, pc, nzcv}` as a serialized JS object
- `get_changed_registers()` -> `Uint8Array` of indices whose value differs from the pre-step snapshot
- `is_halted()` -> bool
- `get_pc()` -> u64 as BigInt, reduced to a Number for rendering

`MemoryPanel` and `StackPanel` pull bytes on demand via `getMemoryRange(addr, len)` during render. That call is cheap (a single `Vec::to_vec` on the paged buffer) and happens every React render.

## Error surfaces

Three kinds of errors reach the user:

1. **Assembly errors** -- `EmuError::AssemblyError { line, message }` from the assembler. Surfaced via red marker in Monaco and the error strip at the bottom.
2. **Runtime errors** -- `UnknownInstruction`, `MemoryFault`, `UnalignedAccess`, `InvalidRegister` from the executor. Surfaced in the bottom error strip; the CPU is marked halted.
3. **WASM load failure** -- network or instantiation error. Caught in `use-emulator.ts` and displayed in place of the loading screen.

Rust panics inside WASM go through `console_error_panic_hook` so the message is readable in the browser console.

## Testing strategy

- Native Rust unit tests live next to their module (`#[cfg(test)] mod tests`). 96 tests cover memory, registers, decoder, executor, assembler, and full end-to-end programs via `Cpu::run_until_break`.
- WASM is smoke-tested end-to-end by [`scripts/verify-examples.js`](../scripts/verify-examples.js), which builds a nodejs-target WASM bundle and runs every program in `web/public/examples/` through it, asserting the post-halt register and memory state matches the comment in each file. Treat its output as the source of truth for example correctness.
- The frontend has no automated tests yet. It's small enough that manual verification with the example programs is usually enough.

## Gotchas

See [`emulator/CLAUDE.md`](../emulator/CLAUDE.md) for the `Vec<u8>` vs `Box<[u8; 4096]>` page storage gotcha -- one of the hardest-to-debug wasm32 interactions in this project.
