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
  lists the differences known today and links to how they are checked.
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
- The m4 pass handles `define`, macros with arguments, and `undefine`, line
  by line, and refuses `ifdef`, `ifelse`, and `forloop`. A program that uses
  `dnl`, `divert`, `undivert`, `divnum`, `changecom`, or m4 quotes, and that
  this pass refuses or leaves with `divert`, `undivert`, `divnum`,
  `changecom`, or `changequote` where an instruction goes, goes through m4
  in GNU m4's own order instead, as on the course servers, unless this pass
  already spent the whole work budget, which keeps its refusal. That order runs
  `dnl`, `divert` (to 0 or a negative number), `divnum`, `changecom`, and
  quotes, and refuses the other GNU builtins (`undivert`, `include`,
  `changequote`, and the rest) and numbered diversions such as `divert(1)`.
  Line by line, a macro's arguments must close on the line that uses it.
- Output from `gcc -S` needs a few edits before it assembles, such as deleting
  the `.cfi_` lines. The [instruction reference](docs/instruction-reference.md#gcc-output-compatibility)
  lists them.
- The terminal's `gcc` only assembles. There is no C compiler in the browser.
- It counts instructions, not clock cycles, so it cannot tell you how fast code
  runs on a real chip.
- Limits stop a runaway program instead of freezing the tab: 10 million
  instructions per run, 32 MiB of memory in use (an 8 MiB stack and a 16 MiB
  heap), 4 MiB of output, and 32 MiB of text built by m4, counting every
  round of every line (in GNU m4's order, on the same budget, 1 KiB for each
  macro call plus the text it builds or, when longer, the body it reads, and
  8 bytes for each token m4 reads or text it puts back). Step back reaches
  the last 128 instructions, fewer behind steps that write more than 64 KiB,
  such as a `memset` over a large buffer: the records of those steps share
  32 MiB. The editor shows at most
  1,000 macro warnings and counts the rest on one line.
- Your programs, files, and exercise progress are saved in this browser only.
  There are no accounts, and clearing the site's data deletes them. The
  practice page can export your progress to a file and import it elsewhere.
- A share link holds up to 16 KiB of compressed text. Send a longer program as
  a file: pick **workspace .json** from the playground's **export** menu. The
  file does not carry checks.

## Known differences from the course server

The playground follows one CPSC 355 course server (GNU `as`, gcc, glibc, and
GNU m4 on AArch64 Linux).
[Compare with the course server](docs/TESTING.md#compare-with-the-course-server)
says how it is checked against that server and what the checks find. Where the
two disagree, the server is right. These are the differences known today, with
what to write instead where you can. A difference this list does not name is a
bug, so please [report it](#reporting-a-problem).

The m4 entries below are about programs the playground's m4 reads line by
line, which is most of them. A program that goes through GNU m4's own order
instead (the m4 line under [What it does not do](#what-it-does-not-do) says
which) has its m4 read as the server reads it, apart from two cases: the GNU
builtins that order refuses, which the same line names, and a program in
several files, which the playground reads as one file while the server runs
m4 on each.

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
  `strb x1, [x0]`, and `mul x5, w0, x4`. Name the extend when an `x` register
  meets a `w` one (`cmp x3, w21, sxtw`, `add x24, x21, w20, sxtw 3`, or `uxtw`
  for an unsigned value), make the second register of a `cmp` a `w`
  register when the first is one (`cmp w1, w22`), use an `x` register for
  every address (`ldr w19, [x19]`), a `w` register for a byte
  (`ldrb w1, [x0]`), and one width across a `mul`.
- **`sp` and `xzr` where the server's assembler does not allow them.**
  `and sp, sp, -16`, `mov sp, xzr`, `mov xzr, sp`, `sxtw sp, w0`,
  `add w0, sp, w1`, `add xzr, sp, x1`, `add sp, xzr, x1`, and
  `ldr x0, [xzr]` build here, and `and sp, sp, -16` then stops the program
  with `stack overflow`. Give an instruction that uses `sp` an `x` register
  to write, keep `xzr` out of it, load and store through a base register you
  have set, and round `sp` through another register: `mov x9, sp`,
  `and x9, x9, -16`, `mov sp, x9`.
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
- **A name defined twice without quotes.** Line by line, a second
  `define(fp, x29)` replaces the first here. GNU m4 on the server expands `fp`
  before it defines it, so the second line defines `x29` instead, and m4 may
  never finish once it meets `x29` again. To define a name again, quote it
  (``define(`fp', x29)``) or remove it first with ``undefine(`fp')``.
- **A macro name, a backtick, or `dnl` in a `//` or `/* */` comment.** Line by
  line, the playground takes comments out before m4 reads the program, so these
  build here and do nothing special. GNU m4 on the server reads those comments
  as text. It expands a macro named there, so in a `//` comment the later
  lines of a macro whose body spans lines land in the code; a backtick starts
  a quote that runs to the next `'`; and `dnl` deletes the rest of its line
  and the line break, so the next line joins the comment and drops out of the
  program. The program may then not build there, or build without that line.
  Keep macro names, backticks, and `dnl` out of comments.
- **m4 builtin names and nested quotes outside comments.** Line by line, a
  label named `dnl` or `traceon`, a `.string` holding `len(abc)` or `divnum`,
  and a quoted define body with another quote inside it
  (``define(abc, `a `b' c')``) build here as written. GNU m4 on the server
  runs those builtins, which deletes or replaces the words, and drops the
  inner quotes. Keep m4 builtin names out of labels and strings, and do not
  nest quotes in a define body.

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
  `.word` for `.long` and `.int`, `.skip` with the count times the size for
  a `.fill` of zeros (`.fill 100, 4, 0` is `.skip 400`), a label and `.skip`
  in `.bss` for `.lcomm`, and `.section .rodata` without quotes. Leave out
  `.extern` and `.end`, since library calls need no declaration.
- **A library function the playground does not have**, such as `fgetc`. The
  link fails here with ``undefined reference to `fgetc'``; gcc on the server
  links it. Write `getc` for `fgetc`; the
  [instruction reference](docs/instruction-reference.md#c-library-functions)
  lists the functions the playground has.
- **The unscaled loads and stores by name**: `ldurb`, `sturb`, `ldurh`,
  `sturh`, `ldursb`, `ldursh`, and `ldursw`. Write `ldrb`, `strb`, `ldrh`,
  `strh`, `ldrsb`, `ldrsh`, and `ldrsw`, which take the same offsets in both
  places (`ldrb w0, [x0, -1]`).
- **Some instruction spellings.** The playground refuses `bic` with an
  immediate (write `and` with the inverted mask), `lsrv` (write `lsr`),
  `mov w22, w21, lsl 1` (write `lsl w22, w21, 1`), a shift amount written as
  a sum such as `lsl 3-1` (write the number), `wsp` (it has no `wsp`, so
  write `mov x0, sp`), and gcc's `:got:` operands (write `ldr x0, =stdin`).
- **An operand left out of an expression**, such as `mov w0, 1 *`. The
  server's assembler builds it with a warning and takes the missing operand
  as 0. Write the whole expression.
- **`#` at the start of a line as a comment, and a `/*` comment left open at
  the end of the file.** The server's assembler takes both. Write comments
  with `//`, and close every `/*`.
- **GNU m4 builtins the playground does not run**, such as `ifelse` and
  `eval`. They work on the server. The m4 line under
  [What it does not do](#what-it-does-not-do) says what the playground's m4
  runs.
- **A macro call whose arguments close on the next line**, such as
  `jump_to(done` with its `)` on the line below. Line by line, the playground
  refuses it (`a macro's arguments run past the end of the line`). GNU m4 on
  the server reads on to the `)` and builds it. Close the arguments on the
  line that calls the macro: `jump_to(done)`.

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
  gives whatever was there. Here a local in a small frame reads 0, but a read
  from a page nothing has stored to yet stops with a memory fault: a large
  local array on the stack, or a block from `malloc` read before anything is
  stored in it. Store a value before you load it, or take the block from
  `calloc`, whose memory reads 0.
- **What `main` starts with.** Past the null after the last argument, the
  server's `argv` runs on into the environment, and `x2` to `x18` hold what
  the startup code left there. Here the words after the null are the
  arguments' own text, and those registers hold 0. A program that reads an
  argument it was not given may crash here and run on the server. Check
  `argc` (`x0` at `main`) before you read an argument, and set a register
  before you read it.
- **`add` or `sub` with `sp` and a `w` register but no extend**, such as
  `add x0, sp, w1`. The server's assembler reads it as
  `add x0, sp, w1, uxtw`, which adds the 32 bits of `w1`; here it adds all 64
  bits of `x1`. Write the extend (`add x0, sp, w1, uxtw`) or an `x` register
  (`add x0, sp, x1`).
- **Printed addresses.** Here each section starts at a fixed address (`.data`
  at `0x600000`) and the stack starts just below `0x80000000`. On the server
  they sit elsewhere, so a printed address (`%p`, or a pointer printed as a
  number) differs. Print values, or an address minus the label it belongs to.
- **A store outside the program's memory.** A store to an address that no
  section, the heap, or the stack covers, such as `0x100000000`, lands here
  and the program goes on. The server stops it with `Segmentation fault`. A
  store to address 0 or into the program's code stops here too, but a `read`
  system call (`svc`) into either one writes there here, where Linux returns
  -14 and writes nothing.
- **The last function without a `ret`.** Here the program stops when it runs
  past its last instruction. On the server it runs on into whatever code the
  linker put after it. End every function with `ret`.
- **Some faults have other words here.** A jump into data or onto the stack
  runs any instructions the bytes there spell and stops with
  `unknown instruction` at the first word that is not one, a jump to an
  address nothing covers stops with a memory fault that names a read, and a
  recursion that runs out of stack stops with `stack overflow`. The server
  says `Segmentation fault` for each.
- **Reading numbers.** `scanf` with `%lf` and `atof` read no hexadecimal float
  (`0x1p3` is 8 on the server and 0 here), `atof` reads neither `inf` nor
  `nan`, and when `%d` meets a lone `-`, glibc takes the `-` while the
  playground leaves it for the next read.
- **Files.** `openat` with `O_CREAT` in a directory that does not exist
  creates the file here, because the playground's files have no directories;
  the server returns -2. A program that asks whether its output is a terminal
  is told yes here, even under `> file` in the terminal pane. A file the
  program writes itself lasts here only until the next build or run (Run,
  `gcc`, `as`, or `./program`), which starts the machine again with only your
  uploaded files, an example's own files, and the files `>` wrote; on the
  server it stays.
- **Limits.** A program that needs more than 10 million instructions without
  sleeping stops here (the limits above list the rest), each section holds at
  most 1 MiB, and `time` returns a fixed value, so a program that seeds `rand`
  with `time` prints the same numbers on every run here.

### Stepping and the terminal pane

- **`gcc -c` and `as`** build the file the way `gcc file.s -o name` does
  instead of writing an object file, so `gcc -c helper.s` on a file with no
  `main` is refused with the no-`main` error, where the server writes
  `helper.o`. The pane's `gcc` takes one source file at a time, where the
  server's takes several (`gcc main.s clamp.s -o sensors`), and it ignores
  flags such as `-O2` and `-lm`. In the pane, build with
  `gcc file.s -o name`; for a program in several files, add them with the
  **+** beside the editor's file tab, which builds them together.
- **gdb-lite's `n` and `s`** step one source line, even after a `gcc` line
  without `-g` (they say so once a session). In gdb on the server they step
  by line only in a program built with `gcc -g`, and without `-g` they run to
  the end of the function. gdb on the server counts the lines m4 writes, so a
  macro whose body spans two lines is two steps there and one here. gdb's own
  `next` can also run on past a label it
  reaches after a call, taking the label for a new function, and at the `ret`
  of a comparator `qsort` calls, both `next` and `step` stop inside the
  library; gdb-lite stops on the label's line and on the program's next line.
  On the server, build with `gcc -g` before you use them, or step one
  instruction at a time with `si` and `ni`.
- **gdb-lite's `c` after a fault** does nothing: the program stays stopped
  where it faulted. gdb on the server goes on, and the program ends with the
  signal (`Program terminated with signal SIGSEGV`). Read the fault where it
  stopped, then run the program again. The [terminal guide](docs/terminal.md#gdb-lite)
  says what each gdb-lite command does.
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
