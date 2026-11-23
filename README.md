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
  command-line arguments, and files work as they do on the course server,
  apart from the [known differences](#known-differences-from-the-course-server).
- Step one instruction at a time, step back, and set breakpoints while the
  registers, the stack, and memory update. Step over a call, step out of a
  function, or run to the line the cursor is on.
- Watch each function's stack frame being built, used, and torn down, drawn
  the way the course draws it: one box per saved register and local, with
  its offset from `fp`. Under the frames, the playground explains a write
  over a saved `fp` or `lr`, a `ret` that goes back to no caller, and a
  caller reading one of `x19` to `x28` after a call left it changed.
- Use a terminal pane that runs the course workflow (`m4`, `gcc`, `./program`)
  on files kept in the browser.
- Write checks for your own program in the playground's **checks** tab. Each
  check gives the program some input and arguments and says what it should
  print, and optionally the exit code. **run checks** runs them all without
  touching the program you are debugging. Checks are not saved: they last
  until you load another program or leave or reload the page, and a share link
  carries them.
- Read 32 lessons, each with programs you can run in place. Every lesson ends
  with buttons to the previous and next lessons, and first links the
  exercises that practice it.
- Practice with 68 coding exercises, checked by running your program on hidden
  inputs, and 68 sets of quizzes, fill-in-the-blank questions, and output
  predictions. Three frame drawings ask you to fill in a paused function's
  stack frame.
- Look up every instruction the emulator accepts, with its syntax, an example,
  the C it matches, and the flags it sets. The list starts with the ones the
  course uses, and you can search it in plain words, such as `multiply` or
  `load a byte`. The reference also walks through the calling convention and
  lists 36 common mistakes, each a program you can run.
- Send a program as a link, with its checks if it has any. Everything is
  inside the link, so no server stores it.
- Install the site as an app. After one visit the playground works offline,
  and **Save every page for offline** keeps the lessons, practice, and
  reference too.

## What it does not do

- It follows one course server's toolchain (GNU `as`, glibc, and GNU m4 on
  AArch64 Linux), not every system, and it does not match that server in
  every case. [Known differences from the course server](#known-differences-from-the-course-server)
  says what is checked and lists the differences known today.
- It runs user programs only, with no operating system underneath. System
  registers (`MRS`, `MSR`), atomics and exclusive loads and stores (`LDXR`,
  `STXR`, `LDAR`, `STLR`, `SWP`, `CAS`), SVE, and SME are not supported. The
  base Advanced SIMD (vector) set works; its optional extensions (AES, SHA,
  dot product, half-precision arithmetic, and the rest) do not.
- Library calls such as `printf`, `malloc`, and `fopen` do not run glibc's
  code. The emulator answers them and returns what glibc would, apart from
  the [known differences](#known-differences-from-the-course-server). `time` returns
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
  heap), 4 MiB of output, and 32 MiB of text built by m4, counting every
  round of every line. Step back reaches the last 128 instructions, fewer
  behind steps that write more than 64 KiB, such as a `memset` over a large
  buffer: the records of those steps share 32 MiB. The editor shows at most
  1,000 macro warnings and counts the rest on one line.
- Your programs, files, and exercise progress are saved in this browser only.
  There are no accounts, and clearing the site's data deletes them. The
  practice page can export your progress to a file and import it elsewhere.
- A share link holds up to 16 KiB of compressed text. Send a longer program as
  a file: pick **workspace .json** from the playground's **export** menu. The
  file does not carry checks.

## Known differences from the course server

The playground follows one CPSC 355 course server (GNU `as`, gcc, glibc, and
GNU m4 on AArch64 Linux). These checks compare it with that server:

- **The site's own programs.** The site ships 622: the examples, the lesson
  and exercise programs, the reference and pitfall programs, and the home
  page's program. 621 of them were run on the server on 2026-11-06. Here, 616
  of those give the same output, exit code, and written files, byte for byte,
  or both sides refuse them the same way. One terminal game builds on both
  sides and is not compared. The other 4 differ for reasons this section
  lists: the math functions, a `_start` program, an unfinished exercise
  starter that prints registers it never set, and an example whose files
  define the same names, which GNU m4 cannot read as one pasted file. The
  newest example, flappy, has not been run on the server yet.
- **C programs.** 101 programs compiled by gcc on the server, at three
  optimization levels. 98 print the server's output and exit with its code at
  every level. The other 3 crash on purpose and must stop with the
  playground's own fault message.
- **Error messages.** 15 common mistakes, such as a missing `main` or a stack
  frame that is not a multiple of 16, have the server's own error on record.
  The playground's message starts with the server's line and adds one line on
  what to change. 45 more tests each hold one behaviour measured on the
  server.
- **Vector instructions.** Each of the 2,208 Advanced SIMD forms the
  assembler takes assembles to the word GNU `as` gives on the server, and the
  results match the server's in all 6,618 recorded cases.
- **Recorded runs.** 2,224 server runs of programs written for course-style
  exercises, picked because an earlier version of the playground and the
  server disagreed on them. 794 now agree: the same kind of result (refused
  when building, refused when linking, crashed, ran out of time, or finished)
  and, for a run that finished, the same output and exit code. Most of the
  rest come from the differences below.

Where the two disagree, the server is right. A difference this section does
not list is a bug, so please [report it](#reporting-a-problem).

### Builds here, refused on the server

- **A `;` in a line.** The playground reads the text after `;` as a comment.
  The server's assembler reads `;` as the end of one statement and the start
  of another, so `mov w19, 7 ; load the counter` does not build there, and
  `mov w19, 1 ; mov w19, 7` runs both instructions there but only the first
  here. The playground gives no warning, and some of its error messages still
  suggest `;` for comments. Write comments with `//`.
- **`w` and `x` registers mixed where the server refuses them.** These build
  here: `cmp x3, w21`, `cmp w1, x22`, and `add x1, x0, w21` with no extend,
  `add x24, x21, w20, lsl 3`, `ldr w19, [w19]`, `ldrb x1, [x0]`,
  `strb x1, [x0]`, and `mul x5, w0, x4`. Name the extend
  (`cmp x3, w21, sxtw`, `add x24, x21, w20, sxtw 3`, or `uxtw` for an
  unsigned value), use an `x` register for every address (`ldr w19, [x19]`),
  a `w` register for a byte (`ldrb w1, [x0]`), and one width across a `mul`.
- **`sp` where the server's assembler does not allow it.** `and sp, sp, -16`,
  `mov sp, xzr`, `mov xzr, sp`, and `sxtw sp, w0` build here. Round `sp`
  through another register: `mov x9, sp`, `and x9, x9, -16`, `mov sp, x9`.
- **`.balign` with a number that is not a power of 2**, such as `.balign 3`.
  The server stops with `alignment not a power of 2`. Use 2, 4, 8, or 16.
- **`.rodata` on a line of its own.** The server's assembler does not know it
  (`unknown pseudo-op`). Write `.section .rodata`.
- **A `:lo12:` load or store at an address that is not a multiple of its
  size**, such as an 8-byte `ldr` from a label one byte past an 8-byte
  boundary. The server's linker refuses it with `relocation truncated to fit`.
  Put `.balign 8` before 8-byte data, or load the address with
  `ldr x1, =label`.
- **A program with its own `_start`.** Here it runs from `main` when it has
  one and from `_start` when it does not. gcc on the server adds its own
  startup code, which has a `_start` and calls `main`, so a `.global _start`
  fails with ``multiple definition of `_start'`` and a program with no `main`
  fails with ``undefined reference to `main'``. In a program you build with
  gcc, write `.global main` and `main:`.
- **The math functions.** `pow`, `sqrt`, `sin`, `cos`, `log`, and the rest link
  here with no flag. On the server gcc needs `-lm` at the end of the line
  (`gcc calc.s -o calc -lm`), or the link fails with
  ``undefined reference to `pow'``.
- **A label one file uses from another without `.global`.** The playground
  joins a program's files into one source, so the label links here, and a
  `define` in one file reaches the files after it. On the server each file is
  assembled and passed through m4 on its own, so the link fails with
  ``undefined reference to `name'``. Mark every label another file uses with
  `.global`, and put the defines a file uses in that file.
- **A name defined twice without quotes.** Here a second `define(fp, x29)`
  replaces the first. GNU m4 on the server expands `fp` before it defines it,
  so the second line defines `x29` instead, and m4 may never finish once it
  meets `x29` again. To define a name again, quote it (``define(`fp', x29)``)
  or remove it first with ``undefine(`fp')``.
- **A backtick or `dnl` in a `//` or `/* */` comment, or a label named
  `dnl`.** These build here and do nothing special. GNU m4 on the server reads
  those comments as text: a backtick starts a quote that runs to the next `'`,
  and `dnl` deletes the rest of its line and the line break, so the program
  may not build there. Keep backticks and `dnl` out of comments, and do not
  name a label `dnl`.

### Refused here, builds on the server

- **Code in `.data`, or code just after a string in `.text`.** The playground
  refuses both (`instruction in the .data section`, `this instruction lands at
  a misaligned address`). The server builds them, and the program dies when
  it reaches that code: `Segmentation fault` for code in `.data`,
  `Illegal instruction` for code after a string. Put `.text` above your code,
  and `.balign 4` between data and code.
- **Code in `.rodata`.** The playground refuses it; the server builds it and
  runs it. Put code in `.text`.
- **`adr` to a label in another section**, such as `adr x0, fmt` with `fmt`
  in `.data`. The playground places its sections too far apart for `adr`
  (`ADR/ADRP target out of +/-1MiB`). Write `ldr x0, =fmt`, or `adrp` with
  `add :lo12:`.
- **Some directives.** The playground refuses `.long`, `.int`, `.fill`,
  `.lcomm`, `.extern`, `.end`, and `.section ".rodata"` with quotes. Write
  `.word` for `.long` and `.int`, `.skip` for a `.fill` of zeros, a label and
  `.skip` in `.bss` for `.lcomm`, and `.section .rodata` without quotes.
  Leave out `.extern` and `.end`, since library calls need no declaration.
- **Some instruction spellings.** The playground refuses `bic` with an
  immediate (write `and` with the inverted mask), `lsrv` (write `lsr`),
  `mov w22, w21, lsl 1` (write `lsl w22, w21, 1`), a shift amount written as
  a sum such as `lsl 3-1` (write the number), `wsp` (it has no `wsp`, so
  write `mov x0, sp`), and gcc's `:got:` operands.
- **`#` at the start of a line as a comment, and a `/*` comment left open at
  the end of the file.** The server's assembler takes both. Write comments
  with `//`, and close every `/*`.
- **GNU m4 builtins the playground does not run**, such as `ifelse` and
  `eval`. They work on the server. The m4 line under
  [What it does not do](#what-it-does-not-do) says what the playground's m4
  runs.

### Builds in both places, runs differently

- **Registers a library call may change.** After `printf`, `scanf`, `malloc`,
  or any other library call, the playground fills the registers the call may
  change (`x0` to `x18` other than a result in `x0`, most of the `v`
  registers, and the flags) with a fixed pattern, `0xdeadbeefdeadbeef` in
  the `x` registers, and its console notes the first read of each. On the
  server they hold whatever the library left there, which can change with the
  input. The same program may print another number there, crash, never
  finish, or seem to work. Keep a value you need after a call in `x19` to
  `x28`, or on the stack.
- **Memory nothing has written.** On the server a read of it goes through and
  gives whatever was there. Here a local in a small frame reads 0, and a read
  from a stack page nothing has touched yet, such as a large local array,
  stops with a memory fault. Store a value before you load it.
- **Printed addresses.** Here each section starts at a fixed address (`.data`
  at `0x600000`) and the stack starts just below `0x80000000`. On the server
  they sit elsewhere, so a printed address (`%p`, or a pointer printed as a
  number) differs. Print values, or an address minus the label it belongs to.
- **A store outside the program's memory.** A store to an address that no
  section, the heap, or the stack covers, such as `0x100000000`, lands here
  and the program goes on. The server stops it with `Segmentation fault`. A
  store to address 0 or into the program's code stops here too.
- **Some faults have other words here.** A jump into data or onto the stack
  stops with `unknown instruction`, a jump to an address nothing covers stops
  with a memory fault that names a read, and a recursion that runs out of
  stack stops with `stack overflow`. The server says `Segmentation fault` for
  each.
- **Reading numbers.** `scanf` with `%lf` and `atof` read no hexadecimal float
  (`0x1p3` is 8 on the server and 0 here), `atof` reads neither `inf` nor
  `nan`, and when `%d` meets a lone `-`, glibc takes the `-` while the
  playground leaves it for the next read.
- **Files.** `openat` with `O_CREAT` in a directory that does not exist
  creates the file here, because the playground's files have no directories;
  the server returns -2. A program that asks whether its output is a terminal
  is told yes here, even under `> file` in the terminal pane.
- **Limits.** A program that needs more than 10 million instructions stops
  here (the limits above list the rest), each section holds at most 1 MiB,
  and `time` returns a fixed value, so a program that seeds `rand` with
  `time` prints the same numbers on every run here.

### Stepping and the terminal pane

- **`gcc -c` and `as`** build the file the way `gcc file.s -o name` does
  instead of writing an object file, so `gcc -c helper.s` on a file with no
  `main` is refused with the no-`main` error, where the server writes
  `helper.o`. The pane's `gcc` takes one source file at a time, where the
  server's takes several (`gcc main.s clamp.s -o sensors`), and it ignores
  flags such as `-O2` and `-lm`.
- **gdb-lite's `n` and `s`** step one instruction, as `si` does. In gdb on the
  server they step one source line in a program built with `gcc -g`, and
  without `-g` they run to the end of the function. Step with `si` and `ni`,
  which work the same way in both places.
- **`ldr xN, label`** is two instructions here, because the playground loads
  the value through the literal pool, and one on the server, so `si` takes two
  steps on that line. The [instruction reference](docs/instruction-reference.md)
  notes this and a few smaller cases, such as `.ltorg`, beside the forms they
  concern.

## Run it locally

You need:

- Rust 1.99 or newer, installed through [rustup](https://rustup.rs/)
- [wasm-pack](https://wasm-bindgen.github.io/wasm-pack/) 0.15
- [Node.js](https://nodejs.org/) 24 or newer

From the repository root:

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked --version 0.15.1 wasm-pack
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
