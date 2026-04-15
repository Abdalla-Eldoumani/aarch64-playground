# Architecture

## Shape of the project

Two workspaces, one monorepo.

```
┌────────────────────────────────────────────────────────────┐
│ web/    Next.js 16 (App Router) + React 19                 │
│         Monaco editor, resizable panel layout,             │
│         register / memory / stack / console / watches      │
│         / memory-watches / saves tabs, C-to-asm view,      │
│         command palette, tutorial runner, share links      │
├────────────────────────────────────────────────────────────┤
│         ↑  wasm-bindgen generated JS bindings              │
├────────────────────────────────────────────────────────────┤
│ emulator/  pure Rust                                       │
│   registers.rs  -- X0..X30, SP, PC, NZCV, d0..d31          │
│   memory.rs     -- paged Vec<u8>, 4 KiB pages              │
│   decoder.rs    -- 32-bit word -> Instruction              │
│   executor.rs   -- Instruction + state -> ()               │
│   fpu.rs        -- f64 math + NZCV for fcmp                │
│   snapshot.rs   -- step-back ring + named save states      │
│   cpu.rs        -- top-level step / run loop + VFS + FDs   │
│   assembler.rs  -- one-pass text -> Vec<u32> (legacy)      │
│   frontend/     -- m4 -> lex -> parse -> sections ->       │
│                    linker (section-aware, cpsc 355)        │
│   hosted/       -- printf/scanf/libc stubs + syscalls      │
│   errors.rs     -- EmuError enum (with original_line)      │
│   lib.rs        -- #[wasm_bindgen] API                     │
└────────────────────────────────────────────────────────────┘
```

The emulator never depends on anything browser-specific. The
wasm-bindgen wrappers in `lib.rs` are the only place the Rust side
touches JS types. Everything else compiles and tests cleanly on native.

## Execution flow

1. User types assembly in Monaco.
2. Click **assemble** -> `emu.assembleAndLoad(source)` in
   [`web/lib/emulator.ts`](../web/lib/emulator.ts).
3. Rust side, [`lib.rs`](../emulator/src/lib.rs)
   `Emulator::assemble_and_load`:
   - If the source has `.global main` or a `.data`/`.rodata` section or
     a reference to a host stub, the frontend pipeline runs:
     `m4 -> lex -> parse -> sections -> linker -> encode`.
   - Otherwise the legacy single-pass assembler in
     [`assembler.rs`](../emulator/src/assembler.rs) runs (bare-metal
     classics).
   - `cpu.reset()` zeroes registers, clears runtime tables (stdout,
     stdin, VFS, FDs, exit code), in-place-clears mapped memory pages,
     and stashes the `__main_return` sentinel in LR.
   - `cpu.load_sections(sections)` (hosted path) or `load_program(code)`
     (bare-metal path) writes bytes to the section bases.
   - Returns a serialized `AssembleResultJs` to JS, carrying the
     resolved alias table so the register panel can show labels.
4. React reads the results back: the disassembly view is driven by
   `getMemoryRange` + source-line text.
5. **step** / **run** call `cpu.step()`. `step()` returns a
   `StepOutcome` (`Advance`, `Halted`, `WaitingForInput`,
   `Exited(code)`). The run loop in `use-emulator.ts` pauses on
   `WaitingForInput` and resumes once `push_stdin` arrives.
6. After each batch, `use-emulator.ts` calls `syncState()` which pulls
   all registers + NZCV + changed-regs + halted + stdout + stderr +
   exit code + step count out of Rust and into React state.

The cardinal rule: state lives in Rust. React reads slices via getters
after every mutation. Never mirror state on the JS side.

## The frontend pipeline (cpsc 355 source)

```
source text
   |
   v
m4.rs      expand `define(NAME, BODY)` with token-boundary matching;
           record `name = expr` separately so each assignment gets
           evaluated at its own source byte offset
   |
   v
lexer.rs   tokenize, emit `Token { kind, original_line, col }`
   |
   v
parser.rs  one statement per line:
           directive | instruction | label | symbol_assignment
   |
   v
sections   group items by section (.text / .rodata / .data / .bss)
   |
   v
pipeline.rs (linker):
  - place labels at section offsets
  - evaluate every expression; pass 2 resolves forward references
  - allocate literal-pool slots for `ldr xN, =expr`
  - emit per-host BL trampolines into .text so `bl printf` stays
    in BL range even though the real stub lives at 0xFFFF_XXXX
  - call `lower_operands` (alias substitution, constant folding)
    per instruction and hand the text to the legacy
    `assembler::encode_line_absolute`
   |
   v
Vec<Section> -> cpu.load_sections()
```

Every error inside the pipeline carries `original_line` so the Monaco
marker lands on the pre-m4 line the student actually wrote.

## The legacy assembler

The bare-metal examples still go through the one-pass
`assembler::assemble`. It collects labels, then dispatches per-mnemonic.
Pseudo-instructions are rewritten inside the encoder:

- `MOV Xd, #imm` -> `MOVZ` + optional `MOVK`s (or ORR for logical-
  immediate patterns)
- `CMP Xn, ...` -> `SUBS XZR, Xn, ...`
- `CMN Xn, ...` -> `ADDS XZR, Xn, ...`
- `TST Xn, ...` -> `ANDS XZR, Xn, ...` (uses the bitmask-immediate
  encoder so `tst w0, 1` works)
- `NEG Xd, Xm` -> `SUB Xd, XZR, Xm`
- `MVN Xd, Xm` -> `ORN Xd, XZR, Xm`
- `CSET Xd, cond` -> `CSINC Xd, XZR, XZR, !cond`
- `LSL / LSR / ASR` immediate forms -> `UBFM` / `SBFM`
- CBZ/CBNZ and TBZ/TBNZ are first-class.

This keeps the executor small: it only has to know the canonical
encodings.

## Decoder

ARMv8 instructions are fixed 32-bit. The decoder is a cascade of
`if (word & mask) == pattern` checks ordered from most-specific to
least-specific, returning a typed `Instruction` enum. Verbose but easy
to single-step through in a debugger. FP ops dispatch through
`fpu.rs` on execution.

## Memory model

`HashMap<u64, Vec<u8>>` keyed by 4 KiB page base address. First write
to an address auto-maps the page. `Memory::clear()` zero-fills existing
pages in place rather than dropping/reallocating them; dropping and
re-allocating `Vec<u8>` page buffers triggers a dlmalloc invariant on
wasm32 that traps in `__rdl_dealloc`. Keep page buffers `Vec<u8>`-based
and avoid dropping them during hot paths.

`Cpu::new` pre-maps the first few code pages, the stack pages below
`STACK_BASE`, and one page each at `.rodata` / `.data` / `.bss` so
no `load_sections` call needs to allocate mid-call.

Unaligned LDR/STR succeed (mirrors Linux userspace with `SCTLR.A = 0`),
except in the exclusive-access paths which still raise
`UnalignedAccess`.

## Hosted runtime

SVC with `imm16 == 0` reads `x8` and dispatches into
[`hosted/syscalls.rs`](../emulator/src/hosted/syscalls.rs) (write,
read, exit, openat, close, lseek). Everything else halts for
backwards compatibility with bare-metal programs.

BL / BLR targets inside the range `[0xFFFF_0000, 0xFFFF_1000)` dispatch
into the hosted libc (`printf`, `scanf`, `puts`, `putchar`, `getchar`,
`strlen`, `strcmp`, `strcpy`, `memset`, `memcpy`, `exit`, `atof`). The
stubs read argument registers per AAPCS64, call into Rust, write
results to `x0` / `d0`, then return via `pc = lr`. The frontend
linker also plants a close-range BL trampoline inside `.text` so
`bl printf` can reach the real stub even when it lives 16 pages away.

`main` returning (via `ret` with the sentinel in LR) halts the CPU
with `x0` as the exit code.

## Snapshots and named save states

`SnapshotRing` (capacity 128) captures a `Snapshot { regs, mem, halted,
blocked, exit_code, stdin, vfs, open_files, next_fd }` before each
`step()`. `step_back()` pops the newest frame. Named save states live
in a separate `HashMap<String, Snapshot>` on the same ring, so the
user can snapshot with a name, step forward, reload, and still have
the ring's rolling 128-frame history intact.

## State sync

The React hook in
[`web/lib/use-emulator.ts`](../web/lib/use-emulator.ts) owns a ref to
the `EmulatorInstance` and a ref to the last-assembled source. Every
`step` / `run` tick ends with `syncState()`, which pulls:

- `get_all_registers()` -> `{gpr[], sp, pc, nzcv, fpr[]}`
- `get_changed_registers()` -> indices whose value differs from the
  pre-step snapshot
- `get_pc()` -> u64 as BigInt, reduced to a Number for rendering
- `get_stdout()`, `get_stderr()`, `get_exit_code()`, `is_blocked()`
- halted flag
- step count (increments on Advance, decrements on step-back, resets
  on assemble / reset)

`MemoryPanel`, `StackPanel`, and `MemoryWatches` pull bytes on demand
via `getMemoryRange(addr, len)` during render. That call is cheap (a
single `Vec::to_vec` on the paged buffer) and happens every React
render.

## Error surfaces

Three kinds of errors reach the user:

1. **Assembly / pipeline errors** --
   `EmuError::{AssemblyError, PreprocError, ParseError, LinkError}`,
   each with `original_line`. Surfaced via red marker in Monaco and
   the error strip at the bottom.
2. **Runtime errors** -- `UnknownInstruction`, `MemoryFault`,
   `UnalignedAccess` (exclusive-access only), `InvalidRegister`,
   `UnsupportedSyscall`. Surfaced in the bottom error strip; the CPU
   is marked halted.
3. **WASM load failure** -- network or instantiation error. Caught in
   `use-emulator.ts` and displayed in place of the loading screen.

Rust panics inside WASM go through `console_error_panic_hook` so the
message is readable in the browser console.

## Testing strategy

- Native Rust unit tests live next to their module
  (`#[cfg(test)] mod tests`). 380 lib tests cover memory, registers,
  decoder, executor, assembler, FPU, snapshots, and the whole
  frontend pipeline.
- Two integration suites: `tests/cpsc355_corpus.rs` (2 tests) and
  `tests/hosted_end_to_end.rs` (14 tests) exercise the shipping
  pipeline against real cpsc 355 tutorial source plus hosted printf /
  scanf / syscalls / step-back / BL-to-host / `main`-return paths.
- WASM end-to-end: [`scripts/verify-corpus.js`](../scripts/verify-corpus.js)
  builds a nodejs-target WASM bundle and runs every bare-metal
  example in `web/public/examples/` through it, asserting the
  post-halt register and memory state. Treat it as the source of
  truth for example correctness.
- The web workspace has 44 vitest tests covering the asm-filter,
  auto-save ring, frame-labels pattern matcher, share-link
  round-trip, layout persistence, watch-expression evaluator, and
  the C-to-asm route.

## Gotchas

- **Page storage must stay `Vec<u8>`, not `Box<[u8; 4096]>`.**
  `Box::new([0u8; 4096])` puts a 4 KiB array on the stack before
  moving it to the heap; on wasm32 that confuses bundled dlmalloc
  enough to hit an `unreachable` trap in `__rdl_dealloc` during
  `assemble_and_load`.
- **`Cpu::reset` calls `self.mem.clear()` (zero-fills in place)**
  rather than re-allocating. Dropping the page Vecs hits the same
  trap. `reset` also preserves the host-stub registration so hosted
  re-assemble doesn't lose `printf`.
- **`Cpu::new` pre-maps the first few code pages and all data-section
  pages** so `load_program` / `load_sections` never need to allocate
  mid-call.
- **`Memory` derives `Clone`** because `SnapshotRing` clones the
  whole memory every step to build a step-back frame. The dlmalloc
  rule still holds: clone into a fresh `Vec<u8>` per page, never a
  `Box<[u8; 4096]>`.

`RuntimeError: unreachable` on wasm with a stack bottoming out in
`dlmalloc` / `RawVecInner::deallocate` is this class of bug.
