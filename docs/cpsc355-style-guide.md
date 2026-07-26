# cpsc 355 style guide

What the playground accepts, expressed in the same vocabulary the course
uses. If your tutorial file follows these conventions, the playground
runs it end to end without modification.

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
  in the rest of the source. Fixed-point; up to 32 rounds before the
  playground flags a cycle.
- `NAME = EXPRESSION` records a symbol evaluated where it appears. `.` is
  the address of the assignment line, so `msg_len = . - msg - 1` is the
  length of string `msg` minus its null terminator, wherever `msg_len` is
  used later.

Comments strip before substitution: `//` to end of line.

`ifdef`, `ifelse`, `forloop`, and `dnl` are rejected with a clear error
rather than silently ignored, and so is a backtick anywhere except
``undefine(`NAME')``, whose m4 quotes are legal. Undefining a name ends that
define's reach at that line, so an alias can be rebound per function.

### Where the playground's m4 differs from GNU m4 on the servers

Real GNU m4 (the `m4 prog.asm | gcc` pipeline on the university Linux
machines) knows nothing about assembly syntax, which produces three
behaviors the playground deliberately does not copy. The pre-assembly
lint warns whenever a program would hit one:

- GNU m4 substitutes a macro name **anywhere** it appears as a whole
  word, including inside `"..."` strings and `'.'` character literals.
  `define(register, w19)` turns `.string "register count:"` into
  `.string "w19 count:"` on the server. The playground leaves string and
  character literals alone; rename the macro (`register_r`) so both
  behave the same.
- GNU m4 treats `#` as a comment start: nothing after `#` on a line is
  expanded. `mov x0, #SIZE` with `define(SIZE, 40)` never expands on the
  server and the assembler rejects it. Use an equate (`SIZE = 40`),
  which the assembler itself resolves, for any value used after `#`.
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
.byte 0x42 / .hword / .short / .word / .quad
.double 0r3.14159265358979               // ieee 754 double bytes
.float 0r1.5
.type / .size                            // silently accepted
```

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

The list above is what the machine accepts, which is wider than what the
course writes. Course tutorial and assignment files use a fixed directive
vocabulary, so every program the site ships as course-style source (lesson
and exercise programs, the built-in examples, the authoring-guide payloads)
stays inside it. A content test (`web/lib/test/content/course-style.test.ts`) enforces
the difference list:

| never authored     | what course files write               |
| ------------------ | ------------------------------------- |
| `.type` / `.size`  | nothing; `.global main` stands alone  |
| `.globl`           | `.global`                             |
| `.section`         | bare `.data` / `.text` / `.bss`       |
| `.quad` / `.xword` | `.dword`                              |
| `.space`           | `.skip`                               |
| `.p2align`         | `.balign` (bytes) or `.align` (2^N)   |
| `.equ` / `.set`    | m4 `define(...)` or `name = expr`     |

The wider acceptance is deliberate, so unmodified gcc `-S` output still
loads. The authored rule keeps every shipped program reading like a course
file.

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

Unaligned access succeeds (matches Linux userspace with SCTLR.A = 0).

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

## hosted runtime

Pre-registered libc stubs at addresses `0xFFFF_0000 + idx * 16`:

```
printf, scanf, puts, putchar, getchar, strlen, strcmp, strcpy,
memset, memcpy, atoi, rand, srand, time, exit, atof, malloc, free, usleep,
fflush
```

Pre-registered syscalls (via `svc 0` with the syscall number in `x8`):

```
63  read         (x0=fd, x1=buf, x2=count)
64  write        (x0=fd, x1=buf, x2=count)
93  exit         (x0=status)
56  openat       (x0=AT_FDCWD=-100, x1=path, x2=flags, x3=mode)
57  close        (x0=fd)
62  lseek        (x0=fd, x1=offset, x2=whence)
```

`bl printf` and friends cannot reach `0xFFFF_XXXX` from `.text` in a
single imm26 offset. The linker plants a per-host trampoline after
`.text` (LDR X16, =<stub>; BR X16) and rewrites `bl printf` to target
that trampoline.

Main returning via `ret` lands on the `__main_return` sentinel the
loader pre-stashed in LR; that stub halts the CPU with `w0` as the exit
code.

## virtual filesystem

`cpu.upload_vfs_file(path, bytes)` registers a file that `openat(path)`
finds. `write(fd, ...)` on a VFS fd grows the file; `read(fd, ...)` advances
the offset. The console panel's file-upload dropzone calls this directly, so
file tutorials run against files the student just dropped in.

## naming conventions

The corpus follows a convention that shows up in the alias names:

| suffix | meaning                        | example                    |
| ------ | ------------------------------ | -------------------------- |
| `_r`   | register                       | `define(score1_r, w19)`    |
| `_s`   | stack-frame slot (bytes)       | `score2_s = 20`            |
| `_m`   | `.data` / `.bss` object        | `count_m: .word 0`         |

Following this convention keeps `lower_operands` honest: when it sees
`[fp, score2_s]` it looks up `score2_s` in the symbol table, substitutes
`20`, and hands `[fp, 20]` to the encoder.
