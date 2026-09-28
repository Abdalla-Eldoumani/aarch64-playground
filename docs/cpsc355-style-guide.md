# CPSC 355 style guide

What the playground accepts, in the words the course uses. A course file
that follows these conventions runs here without changes. The error messages
in the editor link to the sections below.

## m4 preprocessing

Two forms are recognized:

```
define(fp, x29)                 // token-boundary substitution
define(score1_r, w19)

alloc = -(16 + 16) & -16        // expression symbol, evaluated at this
                                 // point in the section walk
msg_len = . - msg - 1
```

- `define(NAME, BODY)` substitutes every standalone `NAME` with `BODY`
  in the rest of the source. Expansion repeats until nothing changes, up
  to 32 rounds, before the playground reports a cycle.
- `NAME = EXPRESSION` records a symbol evaluated where it appears. `.` is
  the address of the assignment line, so `msg_len = . - msg - 1` is the
  length of string `msg` minus its null terminator, wherever `msg_len` is
  used later.

Comments strip before substitution: `//` to end of line.

`ifdef`, `ifelse`, `forloop`, and `dnl` are rejected with a clear error
rather than silently ignored, and so is a backtick anywhere except
``undefine(`NAME')``, whose m4 quotes are legal. Undefining a name ends that
define's reach at that line, so an alias can be rebound per function.

### Where GNU m4's text-level rules bite

Real GNU m4 (the `m4 prog.asm | gcc` pipeline on the university Linux
machines) knows nothing about assembly syntax, which produces four
behaviors the playground's m4 reproduces exactly. A program built from
the instructions and directives the reference documents prints the same
bytes here as on the servers. The pre-assembly lint warns
whenever a program hits one, because the rewrite is almost never what
the author meant:

- m4 substitutes a macro name **anywhere** it appears as a whole word,
  including inside `"..."` strings and `'.'` character literals.
  `define(register, w19)` turns `.string "register count:"` into
  `.string "w19 count:"`, on the server and here alike. Escapes are
  not special either: `define(n, w19)` rewrites a later `"\n"` into
  `"\w19"`. Rename the macro (`register_r`).
- m4 binds **sequentially**: a name used above its `define(...)` line
  stays unexpanded and the assembler rejects it, here and on the
  servers. Define aliases before their first use.
- m4 treats `#` as a comment start: nothing after `#` on a line is
  expanded, here or on the server. `mov x0, #SIZE` with
  `define(SIZE, 40)` never expands and the assembler rejects it. Use an
  equate (`SIZE = 40`), which the assembler itself resolves, for any
  value used after `#`.
- A defined name immediately followed by `(` is an m4 macro **call**
  on the server, and the parenthesized text is consumed as arguments.
  Put a space before the `(` or rename the macro.

## section directives

```
.text / .data / .rodata / .bss           // section switchers
.section .rodata                         // named form also accepted
.global name / .globl name               // mark for linker visibility
.balign 4 / .align 4                     // byte count vs 2^N
.skip 40 / .zero 40                      // reserve zero bytes
.string "x" / .asciz "x" / .ascii "x"    // null-terminated or not
.byte 0x42 / .hword / .short / .word / .quad / .dword
.double 0r3.14159265358979               // ieee 754 double bytes
.float 0r1.5
.type / .size                            // silently accepted
```

The directive table in [instruction-reference.md](instruction-reference.md#directives)
lists every spelling, including the ones gcc writes (`.xword`, `.p2align`,
`.space`, `.2byte`). `.equ` and `.set` are refused: write `NAME = value`.

Base addresses:

| section      | base          |
| ------------ | ------------- |
| `.text`      | `0x0040_0000` |
| `.rodata`    | `0x0050_0000` |
| `.data`      | `0x0060_0000` |
| `.bss`       | `0x0070_0000` |
| host stubs   | `0xFFFF_0000` |
| stack base   | `0x8000_0000` |

## authored program style

The playground accepts more than course files write. Course tutorial and
assignment files use a fixed set of directives, so every program the site
ships (the lessons, the exercises, the examples, and the programs in the
authoring guide) stays inside that set. A content test
(`web/lib/test/content/course-style.test.ts`) enforces this list:

| never authored     | what course files write               |
| ------------------ | ------------------------------------- |
| `.type` / `.size`  | nothing; `.global main` stands alone  |
| `.globl`           | `.global`                             |
| `.section`         | bare `.data` / `.text` / `.bss`       |
| `.quad` / `.xword` | `.dword`                              |
| `.space`           | `.skip`                               |
| `.p2align`         | `.balign` (bytes) or `.align` (2^N)   |
| `.equ` / `.set`    | m4 `define(...)` or `name = expr`     |

The playground accepts the wider set so that most of what gcc `-S` writes
assembles as it is. A whole `-S` file still needs a few edits, listed under
[GCC output compatibility](instruction-reference.md#gcc-output-compatibility).

## addressing modes

```
[xN]                                // base-only
[xN, #imm] / [xN, imm]              // immediate offset
[xN, #imm]!                         // pre-index (writeback)
[xN], #imm                          // post-index (writeback)
[xN, xM]                            // register offset, LSL by access size
[xN, wM, SXTW]                      // sign-extend W to 64
[xN, wM, SXTW #2]                   // sign-extend and scale by 4 (word)
[xN, xM, LSL #3]                    // shift by 3 (double)
```

All four signed-offset widths (`B` / `H` / `W` / `X`) emit correctly;
plain `LDR` / `STR` auto-pick 32 vs 64 bit based on whether the target
register is `Wt` or `Xt`.

Unaligned access succeeds (matches Linux userspace with SCTLR.A = 0),
except through `sp`: a load or store based on `sp`, or a libc call, while
`sp` is not a multiple of 16 stops with `Bus error`, as it does on the
servers.

## literal pool

```
ldr x0, =msg            // loads the address of msg
ldr x0, =0xdeadbeef     // loads a large constant
ldr x16, =printf        // loads the host-stub address of printf
```

The linker appends a literal pool after `.text` (8-byte aligned). Each
unique `=expr` target gets one 8-byte pool slot, and the LDR instruction
is patched with a PC-relative imm19 offset to that slot.

The page-relative pair forms the same address without a pool slot:

```
adrp x0, msg            // page base of msg
add  x0, x0, :lo12:msg  // plus the low 12 bits
```

`adrp` loads the 4 KiB page base and `:lo12:` adds the low 12 bits. Both
forms assemble. The course leans on the literal pool, but gcc output using
the `adrp` / `add` pair runs unchanged.

## C library and system calls

Pre-registered libc stubs at addresses `0xFFFF_0000 + idx * 16`:

```
printf, sprintf, snprintf, scanf, puts, putchar, getchar,
strlen, strcmp, strncmp, strcpy, strncpy, strcat, strchr, strstr, strtok,
memset, memcpy, memcmp, memmove,
atoi, atof, strtol, abs, labs,
isdigit, isalpha, isspace, toupper, tolower,
rand, srand, time, exit, usleep,
malloc, free, calloc, realloc,
fflush, fopen, fprintf, fgets, fputs, fclose
```

`putc`, `fputc`, `getc`, `fwrite`, `qsort`, and `bsearch` are registered
too; [instruction-reference.md](instruction-reference.md) has the full table.

The `stdin`, `stdout`, and `stderr` symbols resolve to loader-written
words holding their `FILE*` handles, so `fprintf(stderr, ...)` and
`fputs(s, stdout)` link and run the way they do on the servers. The
`isdigit`/`isalpha`/`isspace` macros' `__ctype_b_loc` table is hosted
too, so gcc-compiled ctype code runs unmodified.

The libm subset, in the floating-point convention (argument in `d0`, second
argument in `d1` for `pow` and `fmod`, result in `d0`):

```
sqrt, pow, sin, cos, tan, log, log10, exp, floor, fabs, fmod
```

`sincos` is there too: it takes its argument in `d0` and stores the sine and
cosine through the pointers in `x0` and `x1`.

Pre-registered syscalls (via `svc 0` with the syscall number in `x8`):

```
63  read         (x0=fd, x1=buf, x2=count)
64  write        (x0=fd, x1=buf, x2=count)
93  exit         (x0=status)
94  exit_group   (x0=status)
56  openat       (x0=AT_FDCWD=-100, x1=path, x2=flags, x3=mode)
57  close        (x0=fd)
62  lseek        (x0=fd, x1=offset, x2=whence)
```

Plus the interactive set a terminal program reaches for:

```
29  ioctl          (TCGETS / TCSETS termios, the raw-mode handshake)
25  fcntl          (F_GETFL / F_SETFL, O_NONBLOCK on stdin)
101 nanosleep      (pauses the run; the virtual clock advances)
113 clock_gettime  (the virtual clock, so replay stays deterministic)
278 getrandom      (deterministic, drawn from the snapshotted seed)
```

`bl printf` and friends cannot reach `0xFFFF_XXXX` from `.text` in a
single imm26 offset. The linker plants a per-host trampoline after
`.text` (LDR X16, =<stub>; BR X16) and rewrites `bl printf` to target
that trampoline.

When `main` returns with `ret`, it jumps to `__main_return`, a stub whose
address the loader put in LR before the program started; that stub stops
the program with `w0` as the exit code.

## virtual filesystem

Programs read and write files in a small virtual filesystem (VFS) kept in
the browser. A file you upload in the console or with the terminal's `upload`
is copied into it before the program runs, so `openat` finds it by name.
`write` on an open file grows it, and `read` moves its offset forward.
`Emulator::upload_vfs_file` in `emulator/src/lib.rs` is the entry point.

## naming conventions

Course files follow a naming convention that shows up in the alias names:

| suffix | meaning                        | example                    |
| ------ | ------------------------------ | -------------------------- |
| `_r`   | register                       | `define(score1_r, w19)`    |
| `_s`   | stack-frame slot (bytes)       | `score2_s = 20`            |
| `_m`   | `.data` / `.bss` object        | `count_m: .word 0`         |

`lower_operands` resolves these names like any other symbol: when it sees
`[fp, score2_s]` it looks up `score2_s` in the symbol table, substitutes
`20`, and hands `[fp, 20]` to the encoder.
