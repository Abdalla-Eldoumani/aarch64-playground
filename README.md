# CPSC 355 playground

A browser-based AArch64 (ARMv8) assembly emulator and visual debugger for
CPSC 355 at the University of Calgary. Paste an unmodified course tutorial,
assemble it, and watch it run with real stdout, stdin, registers, stack, and
memory in the browser tab. The emulator is a hand-written Rust interpreter
compiled to WebAssembly, so there is no server, no QEMU, and no install.

Live at <https://aarch64-playground.com>.

## Features

- **Playground** (`/playground`): a Monaco editor with assemble, run, step,
  and step-back; breakpoints; a live decode strip that renders the
  instruction under the pc as its actual encoding fields; register views for
  both the integer (`x0`–`x30`) and floating-point (`d0`–`d31`) files with
  decimal and raw-bit readings; memory and stack views; a console with
  interactive stdin and a persistent virtual filesystem; a terminal pane
  with the course toolchain (`m4`, `gcc`, `./prog`) and a gdb-style command
  subset; a hex/binary/decimal/two's-complement converter; share links; and
  dark, light, and high-contrast themes.
- **Learn** (`/learn`): short lessons with runnable inline editors.
- **Practice** (`/practice`): coding exercises checked by running your
  program against expected behavior (registers, exit code, stdout), never
  against a stored answer, so any correct approach passes; plus quizzes,
  fill-in-the-blank drills, and mental-trace prediction sets graded right
  on the page.
- **Reference** (`/reference`): a searchable instruction reference with
  worked encodings and interactive flag panels, a calling-convention guide
  with a step-through frame walk, and a pitfalls catalog with runnable
  examples, kept in sync with what the emulator actually supports.
- **Realistic hosted runtime**: m4 register-alias macros, GAS directives and
  sections, frame-pointer prologues, the `ldr xN, =label` literal pool, the
  AAPCS64 `printf`/`scanf` path, Linux syscalls via `svc 0`, argc/argv on
  entry, and single- and double-precision floating point (the `s`/`d`
  register views with `fcvt` between them).
- **Fully client-side and installable**: runs offline as a PWA. The emulator
  runs in a Web Worker with a main-thread fallback, and is bounded so a
  runaway program halts cleanly instead of freezing the tab.

## Quickstart

Requires [Rust](https://rustup.rs/) with the `wasm32-unknown-unknown` target,
[wasm-pack](https://wasm-bindgen.github.io/wasm-pack/installer/), and Node.js
20+ (CI runs on 24).

```bash
# build the wasm module
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

# install and run the web app
cd ../web
npm install
npm run dev
```

Open <http://localhost:3000>. For one terminal that rebuilds the WASM and
serves the app together, run `npm run dev:all` from `web/` (it serves the app
either way; `cargo install cargo-watch` enables the WASM auto-rebuild).

## Stack

Rust and wasm-pack for the emulator; Next.js 16 (App Router), React 19,
TypeScript, and Tailwind CSS for the web app; deployed on Vercel.

## Docs

Start at [`docs/README.md`](docs/README.md): it routes by task to the
architecture, the getting-started tour, the contributing and testing guides,
deployment, the instruction reference, the assembly style guide, the
content-authoring format, the terminal reference, and the security posture.

## Privacy

The site keeps no accounts and asks for no personal data. Traffic is measured
with Vercel Web Analytics and Speed Insights, which report aggregate page
views only, set no cookies, and record nothing that identifies you. The
programs you write, the files you upload, and the arguments you type stay in
your browser: the only copies live in that browser's localStorage and
IndexedDB, and clearing site data deletes all of it.

## License

AGPL-3.0. See [LICENSE](LICENSE) for the full text.

Copyright (C) 2026 Abdalla Eldoumani.
