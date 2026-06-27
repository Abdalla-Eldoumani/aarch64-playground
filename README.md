# CPSC 355 playground

Browser-based AArch64 emulator tuned for CPSC 355 course material:
hosted Linux ARM64 assembly with m4 register-alias macros, GAS
directives, `.data` / `.text` / `.bss` / `.rodata` sections,
frame-pointer prologues, `ldr xN, =label` literal loads,
extended-register addressing, the AAPCS64 `printf`/`scanf` path, Linux
syscalls via `svc 0` with `x8`, and argc/argv on entry. Drop an
unmodified tutorial file in, hit Assemble, type args, and watch it
execute with stdout, stdin, and a virtual filesystem all on a web page.
No QEMU, no cross-compiler, no install -- every byte runs in the tab.

Live at <https://aarch64-playground.vercel.app>.

## What it does

- **Hand-rolled Rust interpreter** compiled to WebAssembly. About 5
  kloc covering assembler, linker, decoder, executor, and the hosted
  libc + syscall layer. The WASM module runs in a Web Worker so tight
  run loops do not freeze the UI; a main-thread fallback kicks in when
  `Worker` is missing.
- **Full section-aware frontend** (`emulator/src/frontend/`): m4
  expander (`define(...)` plus `name = expr`), GAS-flavour lexer,
  expression evaluator with `. ( ) + - * / & | ^ << >> ~`, section
  parser with `.string` / `.word` / `.double` / `.balign` / `.skip` /
  `.type` / `.size` (parsed and ignored so unmodified `gcc -S` output
  loads cleanly).
- **Literal pool and BL-to-host-stub trampolines** so `ldr xN, =label`
  and `bl printf` reach their targets even when the host stub address
  at `0xFFFF_0000` is out of BL range.
- **Hosted runtime** (`emulator/src/hosted/`): AAPCS64 varargs printf,
  blocking scanf, `puts/putchar/getchar/strlen/strcmp/strcpy/memset/
  memcpy/exit/atof`, and Linux syscalls for `write`, `read`, `exit`,
  `openat`, `close`, `lseek`. Syscalls back onto a virtual filesystem
  stored in `HashMap<String, Vec<u8>>`.
- **argc / argv at entry** so `int main(int argc, char **argv)`-style
  programs work. Type args into the bar above the controls; the
  loader writes the pointer table + string pool at `ARGV_BASE`
  (`0x0080_0000`) and sets `w0 = argc`, `x1 = argv` on the first
  cycle.
- **Visual debugger** sized for everything from a 360px phone to a
  1920px+ desktop: nested resizable panels at `lg+`, fixed two-column
  at `md`, single column with a 10-tab bottom strip below `md`. Motion
  pulses on register changes, ABI alias labels, safe-area insets,
  command palette (`Ctrl+K`), shortcuts modal (`?`), three-way theme
  cycle, import / export, lz-string share links.
- **Save states + bookmarks**. Save states are session-scoped and
  carry the full Cpu snapshot. Bookmarks are persisted across reloads
  (input state only -- source / args / stdin / step count) and can be
  exported / imported as JSON for sharing with classmates.
- **Replay scrubber**: walks back through the last 128 captured CPU
  frames so you can scrub through a run visually before resuming
  execution.
- **Toggles for the classroom**: `cpsc 355 mode` lints idioms the
  course expects (alias suffixes, canonical prologues, 16-byte
  alignment); `lecture mode` swaps to high-contrast theme + fullscreen
  + oversized step/reset buttons; `hotspot mode` highlights the
  hottest instructions across a run.
- **Embed mode** (`?embed=1`) strips the chrome down to editor +
  console for slide decks and inline tutorial demos.
- **Diagnostic bundle**: one click captures source, args, stdin,
  stdout, stderr, exit code, registers, top-of-stack bytes, and the
  last error into clipboard markdown plus a `?bundle=<lz>` deep link.
- **Terminal pane** (`term` tab): xterm.js shell with `./program
  [args]`, redirections (`<file`, `>file`), VFS commands
  (`ls`/`cat`/`cp`/`rm`/`mv`/`upload`/`clear`/`reset`), a `gdb` subset
  (`n`/`s`/`c`/`b`/`p $xN`/`info registers`/`x/Ni`/`bt`), command
  history, and tab completion against the VFS file table.
- **Progressive Web App**: installable, offline-capable. The service
  worker pre-warms the app shell + manifest + icons on install and
  uses cache-first for `/_next/static/`, `/icons/`, and `/examples/`,
  network-first for everything else.
- **Analytics + Core Web Vitals** via `@vercel/analytics` +
  `@vercel/speed-insights`. Anonymized, cookie-free, production-only.
  CSP allow-listed (`va.vercel-scripts.com`,
  `vitals.vercel-insights.com`).
- **Multi-file assembly** via tabs, concatenated before assembly so
  `bl helper` resolves across files.
- **GCC output runs as is**: GAS-style `bgt`/`beq` aliases, `@function`
  attribute tokens, dotted `.L<N>` labels, and `.section .debug_*`
  noise round-trip through the pipeline.

## Quickstart

**Requirements:**

- [Rust](https://rustup.rs/) 1.75+ with `rustup target add wasm32-unknown-unknown`
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) 0.12+
- Node.js 20+
- Optional, only needed if you want to use `npm run dev:all`: `cargo install cargo-watch`

```bash
# 1. Build the WASM module
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

# 2. Install web deps and run the dev server
cd ../web
npm install
npm run dev
```

Open <http://localhost:3000>. Pick a CPSC 355 example from the dropdown
(grouped by course week) or a bare-metal classic, hit **assemble**,
then step or run.

[`docs/getting-started.md`](docs/getting-started.md) walks through a
full session end to end.

For an iterative loop, `npm run dev:all` from `web/` runs the WASM
rebuild watcher and the Next.js dev server together in one terminal,
with prefix-colored output for each side.

## Keyboard shortcuts

| Key          | Action                  |
| ------------ | ----------------------- |
| `F6`         | Assemble                |
| `F10`        | Step one instruction    |
| `Shift+F10`  | Step back               |
| `F5`         | Run / pause             |
| `Shift+F5`   | Reset                   |
| `Ctrl+K`     | Command palette         |
| `Ctrl+S`     | Save state (named)      |
| `Ctrl+Shift+F` | Format the source     |
| `Ctrl+Wheel` | Zoom focused panel      |
| `Ctrl+0`     | Reset zoom              |
| `?`          | Keyboard shortcuts help |

## Deep-link parameters

| Param      | Effect                                                       |
| ---------- | ------------------------------------------------------------ |
| `?example=`| Auto-load a CPSC 355 example by id                            |
| `?theme=`  | `dark` / `light` / `high-contrast`                            |
| `?embed=1` | Embed mode (chrome-stripped, single-pane)                    |
| `?bundle=` | Restore a captured diagnostic bundle (lz-string compressed)  |
| `#p2=`     | Share-link payload (source + args + stdin + cursor)          |
| `#p=`      | Legacy share-link (source-only, still decoded)               |

## Supported instruction surface

Thirteen tutorial files from weeks 3 / 8 / 9 / 10 / 11 / 12 / 13 run
end to end through the pipeline plus five bare-metal classics
(factorial, fibonacci, string-reverse, bubble-sort, gcd).

**Data processing:** `MOV` (movz/movk/alias), `MOVZ`, `MOVK`, `MOVN`,
`ADD`, `ADDS`, `SUB`, `SUBS`, `AND`, `ANDS`, `ORR`, `EOR` (with the
immediate bitmask encoding for `tst w0, 1`-style lines), `LSL`, `LSR`,
`ASR`, `MUL`, `UDIV`, `SDIV`, `MADD`, `MSUB`, `NEG`, `MVN`.

**Memory:** `LDR` / `STR` / `LDRB` / `STRB` / `LDRH` / `STRH` /
`LDRSB` / `LDRSH` / `LDRSW`, plus `LDP` / `STP`. Every addressing mode
GCC emits: immediate unsigned offset, pre-index, post-index, register
offset `[Xn, Xm]`, and extended-register offset
`[Xn, Wm, SXTW #N]` / `[Xn, Xm, LSL #N]`. Plain-integer `LDR`/`STR`
auto-pick 32 vs 64 bit width based on whether the target is `Wt` or
`Xt`. `LDR Dt` / `STR Dt` handle the SIMD&FP unsigned-offset form.
Unaligned accesses succeed to mirror real AArch64 Linux userspace
(SCTLR.A = 0).

**Branches:** `B`, `BL`, `BR`, `BLR`, `RET`, the full set of
conditional `B.EQ`/`B.NE`/... variants (both dotted and GAS-style
`bne`/`bgt`/...), `CBZ`/`CBNZ`, `TBZ`/`TBNZ`.

**Conditional select:** `CSEL`, `CSINC`, `CSET`.

**System:** `NOP`, `SVC` (with `x8`-driven dispatch for hosted mode).

**Floating point:** `FMOV`, `FADD`, `FSUB`, `FMUL`, `FDIV`, `FCMP`,
`SCVTF`, `FCVTZS` in double precision. `.double 0r<literal>` data form.

**Directives:** `.text`, `.data`, `.rodata`, `.bss`, `.section`,
`.global`/`.globl`, `.string`/`.asciz`/`.ascii`, `.byte`, `.hword`/
`.short`, `.word`, `.quad`, `.double`, `.float`, `.skip`/`.zero`,
`.balign`, `.align`, `.type`/`.size`.

**m4 subset:** `define(NAME, BODY)` with token-boundary substitution
and recursive fixed-point expansion; `NAME = EXPRESSION` at top level,
evaluated at the exact byte offset where the assignment appears so
`msg_len = . - msg - 1` resolves the way GAS would. `ifdef`, `ifelse`,
`forloop`, `dnl`, and backtick quoting error out explicitly.

**Hosted runtime:** `printf` (full `%d %i %u %x %X %o %s %c %% %p %f
%.Nf`, mixed int/double via independent `x0..x7` / `d0..d7` walkers),
`scanf` (blocks on empty stdin and resumes on `push_stdin`), plus the
libc stubs listed above and the syscall surface for `write`, `read`,
`exit`, `openat`, `close`, `lseek`.

## Repo layout

```
emulator/  Rust crate: assembler, frontend pipeline, decoder, executor,
           hosted runtime, FPU helpers. ~390 unit + integration tests.
web/       Next.js 16 + React 19 frontend: Monaco editor, resizable
           panel layout, console, VFS uploader, command palette, share
           dialog, terminal pane. 301 vitest tests.
scripts/   verify-corpus.js (runs every bare-metal + tutorial example
           through the WASM build in Node) and vercel-build.sh.
docs/      Architecture, getting-started, contributing, deploy,
           security, instruction reference, cpsc355 style guide,
           terminal command reference.
```

## Deploying

`vercel.json` wires a Vercel deploy that installs Rust + wasm-pack on
the build image, compiles the emulator to WASM, and runs
`next build --webpack`. Push to a Vercel-connected git remote and it
Just Works. The Vercel header layer adds CSP, COOP, X-Frame-Options
DENY, Referrer-Policy, Permissions-Policy, and immutable cache headers
for `/_next/static/`, `/icons/`, and `*.wasm`. See
[`docs/DEPLOY.md`](docs/DEPLOY.md) for details and troubleshooting,
and [`docs/security.md`](docs/security.md) for the security posture.

## Development

The iterative loop is `npm run dev:all` from `web/`. It runs
cargo-watch plus `wasm-pack build --dev` and `next dev` in parallel
under `concurrently`, with prefix-colored output so the WASM and web
sides are easy to tell apart.

```bash
cd web && npm run dev:all
```

If you don't have cargo-watch installed, or for a one-shot rebuild,
the manual flow still works:

```bash
cd emulator && wasm-pack build --target web --out-dir ../web/lib/wasm
cd ../web && npm run dev
```

`dev:all` builds WASM with `--dev`, which skips `wasm-opt` and is
roughly an order of magnitude faster but produces a larger output.
That's fine for local iteration; never use it for production. CI
still builds with `--release`.

For the full test reference (Rust, vitest, corpus, type and lint,
size and lighthouse, cross-browser smoke), see
[`docs/TESTING.md`](docs/TESTING.md).

`npm run dev` / `npm run build` pass `--webpack` to Next 16 because the
WASM pipeline relies on `webpack.experiments.asyncWebAssembly`.

More detail in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/features.md`](docs/features.md),
[`docs/security.md`](docs/security.md),
[`docs/instruction-reference.md`](docs/instruction-reference.md),
[`docs/cpsc355-style-guide.md`](docs/cpsc355-style-guide.md), and
[`docs/terminal.md`](docs/terminal.md).

## License

MIT
