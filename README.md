# aarch64-playground

A browser-based ARMv8 (AArch64) instruction emulator with a visual debugger. Write ARM64 assembly, hit Assemble, step through it, and watch every register and memory byte update in real time. No QEMU, no cross-compiler, no setup.

## Why

Most online assembly tools target x86. The few that target ARM64 are either command-line QEMU wrappers or heavy Emscripten builds of Unicorn. This is a hand-rolled interpreter written in Rust (~5 kloc), compiled straight to WebAssembly, with a Next.js 16 + React 19 debugger UI on top. It's built for teaching — CPSC 355-style courses, anyone learning AArch64 from scratch.

Live at <https://aarch64-playground.vercel.app>.

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

Open <http://localhost:3000>. Pick an example from the dropdown, hit **assemble**, then step or run.

## Keyboard shortcuts

| Key       | Action          |
| --------- | --------------- |
| `F6`      | Assemble        |
| `F5`      | Run / pause     |
| `Shift+F5`| Reset           |
| `F10`     | Step one instr. |

## Supported instructions

Hand-rolled assembler + decoder. The subset below is what's actually parsed and executed; everything else errors at assemble time.

**Data processing (immediate + register):** `ADD`, `ADDS`, `SUB`, `SUBS`, `AND`, `ANDS`, `ORR`, `EOR`, `LSL`, `LSR`, `ASR`, `MUL`, `UDIV`, `SDIV`, `NEG`, `MVN`.

**Moves:** `MOV`, `MOVZ`, `MOVK`, `MOVN`.

**Compare & test:** `CMP`, `CMN`, `TST`.

**Conditional select:** `CSEL`, `CSINC`, `CSET`.

**Memory:** `LDR`, `STR`, `LDRB`, `STRB`, `LDRH`, `STRH`, `LDP`, `STP` — with immediate, pre-index, post-index, and signed-offset addressing modes.

**Branches:** `B`, `BL`, `BR`, `BLR`, `RET`, plus the full set of conditional branches (`B.EQ`, `B.NE`, `B.HS`/`B.CS`, `B.LO`/`B.CC`, `B.MI`, `B.PL`, `B.VS`, `B.VC`, `B.HI`, `B.LS`, `B.GE`, `B.LT`, `B.GT`, `B.LE`).

**System:** `NOP`, `SVC` (treated as halt).

Register names follow the usual AArch64 conventions: `X0`-`X30`, `W0`-`W30`, `SP`, `XZR`/`WZR`. PC is read-only.

## Repo layout

```
emulator/  Rust crate. Pure ARMv8 interpreter + hand-rolled assembler.
           Compiles to WASM via wasm-pack.
web/       Next.js 16 + React 19 frontend with a Monaco editor and state panels.
           Imports the WASM module the emulator crate produces.
scripts/   Build helpers: Vercel entrypoint (vercel-build.sh) and the
           example verifier (verify-examples.js).
docs/      Architecture and contributor docs.
```

Each workspace has its own `CLAUDE.md` with deeper notes for contributors and AI pairs.

## Deploying

`vercel.json` at the repo root wires up a Vercel deploy: it installs Rust + wasm-pack on the build image, compiles the emulator, then runs `next build`. Push to a Vercel-connected git remote and it Just Works. See `docs/DEPLOY.md` for details and troubleshooting.

## Development

```bash
# Rust: 96-test suite
cd emulator && cargo test --lib

# TypeScript: type check
cd web && npx tsc --noEmit

# End-to-end: run every example through the WASM emulator
node scripts/verify-examples.js

# Rebuild WASM + dev server
cd emulator && wasm-pack build --target web --out-dir ../web/lib/wasm
cd ../web && npm run dev
```

`npm run dev` / `npm run build` pass `--webpack` to Next 16 because the WASM pipeline relies on `webpack.experiments.asyncWebAssembly`; migrating to Turbopack is a future task.

More detail in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT
