# AArch64 Playground

An AArch64 (ARMv8) assembly emulator and visual debugger that runs in your
browser, built for students learning ARM assembly in CPSC 355 at the
University of Calgary (not an official university project). Paste a course
program, assemble it, and step through it while the registers, stack, memory,
and output change. There is nothing to install, and your code stays in the
browser tab.

Use it at <https://aarch64-playground.com>, or run your own copy with the
steps in [Run it locally](#run-it-locally).

## What you can do

- Write or paste a program, assemble it, and run it. `printf`, `scanf`,
  command-line arguments, and files work the way they do on the course server.
- Step one instruction at a time, step back, and set breakpoints while the
  registers, the stack, and memory update.
- Use a terminal pane that runs the course workflow (`m4`, `gcc`, `./program`)
  on files kept in the browser.
- Read 32 lessons, each with programs you can run in place. Every lesson ends
  with buttons to the previous and next lessons, and first links the
  exercises that practice it.
- Practice with 68 coding exercises, checked by running your program on hidden
  inputs, and 68 sets of quizzes, fill-in-the-blank questions, and output
  predictions.
- Look up every instruction the emulator accepts, with its syntax, an example,
  the C it matches, and the flags it sets. The reference also walks through the
  calling convention and lists 36 common mistakes, each a program you can run.
- Send a program as a link. The whole program is inside the link, so no server
  stores it.
- Install the site as an app. After one visit the playground works offline,
  and **Save every page for offline** keeps the lessons, practice, and
  reference too.

## What it does not do

- It copies one course server's toolchain (GNU `as`, glibc, and GNU m4 on
  AArch64 Linux), not every system. Where the playground and that server
  disagree, the server is right and the difference is a bug.
- It runs user programs only, with no operating system underneath. System
  registers (`MRS`, `MSR`), atomics and exclusive loads and stores (`LDXR`,
  `STXR`, `LDAR`, `STLR`, `SWP`, `CAS`), SVE, and SME are not supported. The
  base Advanced SIMD (vector) set works; its optional extensions (AES, SHA,
  dot product, half-precision arithmetic, and the rest) do not.
- Library calls such as `printf`, `malloc`, and `fopen` do not run glibc's
  code. The emulator answers them and returns what glibc would. `time` returns
  a fixed value and the clock moves only when a program sleeps, so the same
  input always gives the same run.
- Only some system calls exist (`read`, `write`, `openat`, `close`, `lseek`,
  `exit`, and a few that terminal programs use). Files live in a small virtual
  filesystem in the browser: at most 16 files and 4 MiB.
- The m4 pass handles `define`, macros with arguments, and `undefine`. It
  refuses `ifdef`, `ifelse`, `forloop`, and `dnl`, and a macro's arguments
  must close on the line that uses it.
- Output from `gcc -S` needs a few edits before it assembles, such as deleting
  the `.cfi_` lines. The [instruction reference](docs/instruction-reference.md#gcc-output-compatibility)
  lists them.
- The terminal's `gcc` only assembles. There is no C compiler in the browser.
- It counts instructions, not clock cycles, so it cannot tell you how fast code
  runs on a real chip.
- Limits stop a runaway program instead of freezing the tab: 10 million
  instructions per run, 32 MiB of memory in use (an 8 MiB stack and a 16 MiB
  heap), and 4 MiB of output. Step back reaches the last 128 instructions.
- Your programs, files, and exercise progress are saved in this browser only.
  There are no accounts, and clearing the site's data deletes them. The
  practice page can export your progress to a file and import it elsewhere.
- A share link holds up to 16 KiB of compressed text. Send a longer program as
  a file: pick **workspace .json** from the playground's **export** menu.

## Run it locally

You need:

- Rust 1.96 or newer, installed through [rustup](https://rustup.rs/)
- [wasm-pack](https://wasm-bindgen.github.io/wasm-pack/) 0.14
- [Node.js](https://nodejs.org/) 24 or newer

From the repository root:

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked --version 0.14.0 wasm-pack
wasm-pack build emulator --target web --out-dir ../web/lib/wasm
wasm-pack build emulator --target nodejs --out-dir ../web/lib/wasm-node
cd web
npm ci
npm run dev
```

Open <http://localhost:3000>. To use another port, pass it after `--`, as in
`npm run dev -- -p 3151`.

The first `wasm-pack` build is the emulator the site loads. The second is a
Node.js copy that the tests and `npm run build` need. `--out-dir` is relative
to `emulator/`. Rebuild both after you change anything under `emulator/`.

For a production build, run these in `web/`:

```bash
npm run build
npm run start
```

A local production server logs browser console errors for Vercel's two
analytics scripts, which exist only on Vercel. In Chrome, each script logs a
404 error and a refused-script error. The errors do not affect the site.

To run the tests, see [docs/TESTING.md](docs/TESTING.md). To change the code,
start with [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Every doc is listed in
[docs/README.md](docs/README.md).

## Privacy

The site has no accounts and asks for no personal data. Vercel Web Analytics
and Speed Insights count page views in aggregate; they set no cookies. Your
programs, uploaded files, and arguments stay in your browser's localStorage and
IndexedDB, and clearing the site's data deletes them.

## Reporting a problem

Open an issue with the program and what you expected. Report a security
problem privately through
[GitHub's advisory form](https://github.com/Abdalla-Eldoumani/aarch64-playground/security/advisories/new).

## License

AGPL-3.0. See [LICENSE](LICENSE) for the full text.

Copyright (C) 2026 Abdalla Eldoumani.
