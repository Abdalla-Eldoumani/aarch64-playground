# cpsc 355 playground

Browser-based AArch64 emulator tuned for CPSC 355 course material: hosted
Linux ARM64 assembly with m4 register-alias macros, GAS directives,
`.data` / `.text` / `.bss` / `.rodata` sections, frame-pointer prologues,
`ldr xN, =label` literal loads, extended-register addressing, the AAPCS64
`printf`/`scanf` path, and Linux syscalls via `svc 0` with `x8`. Drop an
unmodified tutorial file in, hit Assemble, and watch it execute with
stdout, stdin, and a virtual filesystem all on a web page.

Live at <https://aarch64-playground.vercel.app>.

## What it does

- **Hand-rolled Rust interpreter** compiled to WebAssembly. No QEMU, no
  Emscripten, no C toolchain. About 5 kloc including the
  assembler/linker/decoder/executor.
- **Full section-aware frontend** (`emulator/src/frontend/`): m4 expander
  (`define(...)` plus `name = expr`), GAS-flavour lexer, expression
  evaluator with `. ( ) + - * / & | ^ << >> ~`, section parser with
  `.string` / `.word` / `.double` / `.balign` / `.skip` / ...
- **Literal pool and BL-to-host-stub trampolines** so `ldr xN, =label`
  and `bl printf` reach their targets even when the real host stub
  address at `0xFFFF_0000` is out of BL range.
- **Hosted runtime** (`emulator/src/hosted/`): AAPCS64 varargs printf,
  blocking scanf, `puts/putchar/getchar/strlen/strcmp/strcpy/memset/
  memcpy/exit/atof`, and the Linux syscalls for `write`, `read`, `exit`,
  `openat`, `close`, `lseek`. Syscalls back onto a virtual filesystem
  stored in `HashMap<String, Vec<u8>>`.
- **C to AArch64 view** (`?view=c-to-asm`) that forwards source to the
  Compiler Explorer API, filters out DWARF/CFI noise, and lets you load
  the generated assembly straight into the playground.
- **Fully responsive UI** from 360px phone to 1920px desktop: nested
  resizable panels at lg+, fixed two-column at md, single-pane-with-tab-
  strip at < md. Motion pulses on register changes, ABI-alias labels,
  safe-area insets, command palette (Ctrl+K), keyboard shortcuts modal,
  light/dark theme toggle, import/export, and compressed share links
  via lz-string.
- **Debugger features** most students will reach for: named save
  states, 128-frame step-back (Shift+F10), memory watches, watch
  expressions (`x0`, `*x0`, `[fp, name]`, `arr[i]`), instruction
  count, baseline diff, stack-frame labels from the symbol table,
  Monaco hover docs per mnemonic, and guided tutorial walkthroughs.
- **Multi-file assembly** via tabs, concatenated before assembly so
  `bl helper` can resolve across files.
- **C <-> asm line linkage**: while the cursor sits on an asm line in
  the C-to-asm view, the header shows the matching C line from
  Godbolt's source map.
- **GCC output runs too**: unmodified `gcc -S` AArch64 output
  assembles and executes. GAS-style `bgt`/`beq` aliases, `@function`
  attribute tokens, dotted `.L<N>` labels, and `.section .debug_*`
  noise (filtered by the C-to-asm view before handoff) all round-trip
  through the pipeline.

## Quickstart

**Requirements:**
- [Rust](https://rustup.rs/) 1.75+ with `rustup target add wasm32-unknown-unknown`
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) 0.12+
- Node.js 20+

```bash
# 1. Build the WASM module
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

# 2. Install web deps and run the dev server
cd ../web
npm install
npm run dev
```

Open <http://localhost:3000>. Pick a cpsc 355 example from the dropdown
(grouped by course week) or a bare-metal classic, hit **assemble**, then
step or run.

## Keyboard shortcuts

| Key          | Action                  |
| ------------ | ----------------------- |
| `F6`         | Assemble                |
| `F10`        | Step one instruction    |
| `Shift+F10`  | Step back               |
| `F5`         | Run / pause             |
| `Shift+F5`   | Reset                   |
| `Ctrl+K`     | Open the command palette|
| `?`          | Keyboard shortcuts help |

## Supported surface

The frontend encoder covers the instruction and directive set the cpsc
355 tutorial corpus reaches for. Thirteen tutorial files from weeks
3 / 8 / 9 / 10 / 11 / 12 / 13 run end to end through the pipeline.

**Data processing:** `MOV` (movz/movk/alias), `MOVZ`, `MOVK`, `MOVN`,
`ADD`, `ADDS`, `SUB`, `SUBS`, `AND`, `ANDS`, `ORR`, `EOR` (including the
immediate bitmask encoding for `tst w0, 1`-style lines), `LSL`, `LSR`,
`ASR`, `MUL`, `UDIV`, `SDIV`, `MADD`, `MSUB`, `NEG`, `MVN`.

**Memory:** `LDR` / `STR` / `LDRB` / `STRB` / `LDRH` / `STRH` / `LDRSB` /
`LDRSH` / `LDRSW`, plus `LDP` / `STP`. Every addressing mode GCC emits:
immediate unsigned offset, pre-index, post-index, register offset
`[Xn, Xm]`, and extended-register offset `[Xn, Wm, SXTW #N]` /
`[Xn, Xm, LSL #N]`. Plain-integer `LDR`/`STR` auto-pick 32 vs 64 bit
width based on whether the target is `Wt` or `Xt`. `LDR Dt` / `STR Dt`
handle the SIMD&FP unsigned-offset form. Unaligned accesses succeed to
mirror real AArch64 Linux userspace (SCTLR.A = 0).

**Branches:** `B`, `BL`, `BR`, `BLR`, `RET`, the full set of
conditional `B.EQ`/`B.NE`/... variants, `CBZ`/`CBNZ`, `TBZ`/`TBNZ`.

**Conditional select:** `CSEL`, `CSINC`, `CSET`.

**System:** `NOP`, `SVC` (with `x8`-driven dispatch for hosted mode).

**Floating point:** `FMOV`, `FADD`, `FSUB`, `FMUL`, `FDIV`, `FCMP`,
`SCVTF`, `FCVTZS` in double precision. `.double 0r<literal>` data form.

**Directives:** `.text`, `.data`, `.rodata`, `.bss`, `.section`,
`.global`/`.globl`, `.string`/`.asciz`/`.ascii`, `.byte`, `.hword`/
`.short`, `.word`, `.quad`, `.double`, `.float`, `.skip`/`.zero`,
`.balign`, `.align`, `.type`/`.size` (parsed-and-ignored so GCC output
loads cleanly).

**m4 subset:** `define(NAME, BODY)` with token-boundary substitution
and recursive fixed-point expansion; `NAME = EXPRESSION` at top level,
evaluated at the exact byte offset where the assignment appears so
`msg_len = . - msg - 1` resolves the way GAS would. `ifdef`, `ifelse`,
`forloop`, `dnl`, and backtick quoting error out explicitly.

**Hosted runtime:** `printf` (full `%d %i %u %x %X %o %s %c %% %p %f
%.Nf`, mixed int/double via independent `x0..x7` / `d0..d7` walkers),
`scanf` (blocks on empty stdin and resumes on `push_stdin`), plus the
libc stubs listed above and the syscall surface for `write`, `read`,
`exit`, `openat`, `close`, `lseek`. An in-browser virtual filesystem
makes week 13 `open`/`read`/`write`/`close` tutorials runnable without
shipping real files.

## Repo layout

```
emulator/  Rust crate: assembler, frontend pipeline, decoder, executor,
           hosted runtime, FPU helpers. 377 unit tests + 14 integration
           tests.
web/       Next.js 16 + React 19 frontend: Monaco editor, resizable
           panel layout, console, VFS uploader, command palette, share
           dialog, C-to-asm view.
scripts/   verify-corpus.js (runs the 5 bare-metal examples through the
           WASM build in Node) and vercel-build.sh.
docs/      Architecture, getting-started, instruction reference,
           cpsc355 style guide.
```

## Deploying

`vercel.json` wires a Vercel deploy that installs Rust + wasm-pack on
the build image, compiles the emulator to WASM, and runs `next build
--webpack`. Push to a Vercel-connected git remote and it Just Works.
See `docs/DEPLOY.md` for details and troubleshooting.

## Development

```bash
# Rust: full test suite (lib + integration)
cd emulator && cargo test

# TypeScript: type check and lint
cd web && npx tsc --noEmit && npm run lint

# End-to-end: run every bare-metal example through the WASM emulator
node scripts/verify-corpus.js

# Rebuild WASM + dev server
cd emulator && wasm-pack build --target web --out-dir ../web/lib/wasm
cd ../web && npm run dev
```

`npm run dev` / `npm run build` pass `--webpack` to Next 16 because the
WASM pipeline relies on `webpack.experiments.asyncWebAssembly`.

More detail in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/instruction-reference.md`](docs/instruction-reference.md),
[`docs/cpsc355-style-guide.md`](docs/cpsc355-style-guide.md), and
[`docs/c-to-asm.md`](docs/c-to-asm.md) (privacy + caching note for
the C-to-asm view). The
[`docs/getting-started.md`](docs/getting-started.md) page is the fastest
path from zero to a running tutorial.

## License

MIT
