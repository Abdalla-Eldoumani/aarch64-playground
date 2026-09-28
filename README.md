# AArch64 Playground

A browser-based AArch64 (ARMv8) assembly emulator and visual debugger for
CPSC 355 at the University of Calgary. Paste an unmodified course tutorial,
assemble it, and watch it run with real stdout, stdin, registers, stack, and
memory in the browser tab. The emulator is a hand-written Rust interpreter
compiled to WebAssembly, so there is no server, no QEMU, and no install.

Live at <https://aarch64-playground.com>.

## Features

- **Playground** (`/playground`): a Monaco editor with assemble, run, step,
  and step-back; breakpoints; a live decode strip that renders the
  instruction under the pc as its actual encoding fields; three register
  views (the integer `x0`–`x30`, the floating-point `d0`–`d31`, and the
  128-bit vector `v0`–`v31` sliced into 8-, 16-, 32- or 64-bit lanes), each
  with its own decimal and raw-bit readings and the view following the
  write; memory and stack views; a console with interactive stdin and a
  persistent virtual filesystem; a terminal pane with the course toolchain
  (`m4`, `gcc`, `./prog`) and a gdb-style command subset; a
  hex/binary/decimal/two's-complement converter; share links; and dark,
  light, and high-contrast themes.
- **Learn** (`/learn`): short lessons with runnable inline editors.
- **Practice** (`/practice`): coding exercises checked by running your
  program against expected behavior (registers, exit code, stdout), never
  against a stored answer, so any correct approach passes; plus quizzes,
  fill-in-the-blank drills, and prediction sets where you work out by hand
  what a piece of code does, all graded right on the page.
- **Reference** (`/reference`): a searchable reference for all 398
  mnemonics the assembler accepts, with worked encodings and interactive
  flag panels, a calling-convention guide with a step-through frame walk,
  and a pitfalls catalog with runnable examples, kept in sync with what the
  emulator supports.
- **Programs run as they do on the course server**: m4 register-alias
  macros, GAS directives and sections, frame-pointer prologues, the
  `ldr xN, =label` literal pool, `printf`/`scanf` called the standard AArch64
  way (AAPCS64) and the rest of the C library that student and gcc-compiled
  code calls, Linux syscalls via `svc 0`, argc/argv on
  entry, and single- and double-precision floating point (the `s`/`d`
  register views with `fcvt` between them). Beyond the course's own
  instructions it assembles what gcc reaches for: conditional compares, the
  conditional-select aliases, bit counting and reversal, the bitfield insert
  and extract forms, widening multiply-accumulate, the inverted logical
  operations, and in floating point fused multiply-add, min and max,
  `fcsel`, and every float-to-integer rounding mode. The whole Advanced SIMD
  base set assembles and runs too: the 128-bit `v0`–`v31` file, the lane
  arrangements over it, the by-element and permute forms, and the
  `LD1`-`LD4` structure loads and stores, with six vector example programs
  to read. Every form is checked against what the course server produces:
  the 32-bit instruction word from GNU `as`, and the bytes the instruction
  moves when it runs; the extension families that server refuses without an
  architecture directive stay out, listed by ARM feature name in the
  instruction reference. Fifty gcc-compiled C programs run here and must
  match a real AArch64 server's output byte for byte: at `-O0` every change
  has to pass them, and at `-O2` they track the extra forms the optimizer
  emits.
- **Fully client-side and installable**: runs offline as a PWA. The emulator
  runs in a Web Worker with a main-thread fallback, and has step and memory
  limits, so a runaway program stops cleanly instead of freezing the tab.
  The landing page ships no editor code at all: it draws its program as
  static text, and the editor arrives only when you open the playground or
  an embed you can type into.

## Quickstart

Requires [Rust](https://rustup.rs/) with the `wasm32-unknown-unknown` target,
[wasm-pack](https://wasm-bindgen.github.io/wasm-pack/installer/), and Node.js
24 or newer.

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

The site keeps no accounts and asks for no personal data. Vercel Web
Analytics and Speed Insights measure traffic as aggregate page views only;
they set no cookies and record nothing that identifies you. The programs you
write, the files you upload, and the arguments you type stay in your browser.
The only copies live in that browser's localStorage and IndexedDB, and
clearing site data deletes all of it.

## License

AGPL-3.0. See [LICENSE](LICENSE) for the full text.

Copyright (C) 2026 Abdalla Eldoumani.
