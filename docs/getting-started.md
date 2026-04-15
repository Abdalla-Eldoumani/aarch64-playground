# getting started

A five-minute tour of the cpsc 355 playground. This page assumes you
have never used it before.

## open the playground

Go to <https://aarch64-playground.vercel.app> (or run `npm run dev` in
the `web/` directory and open <http://localhost:3000>). You land on an
editor on the left, a register view top-right, and a memory / stack /
console tab bottom-right. On a phone you get a single pane at a time
with a bottom tab strip.

## load a tutorial

Click **load example...** in the header and pick **week 8 scores
(scanf + avg)**. The editor fills with a CPSC 355 example that reads
three scores from stdin, stores them on the stack, averages them, and
prints the result.

The source starts like this:

```
define(fp, x29)
define(lr, x30)
define(score1_r, w19)
...

score1_s = 16
score2_s = 20
score3_s = 24

alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_prompt:     .string "Enter score %d: "
...

.text
.global main
main:   stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        ...
```

If this looks familiar that's because it's the unmodified tutorial file
from your course materials. The playground accepts it as-is.

## assemble and run

Hit the **Assemble** button at the bottom (or `F6`). The m4
expander runs, the frontend parses each section, the linker places
labels and allocates a literal pool, and the resulting bytes load into
memory at `0x0040_0000` (`.text`), `0x0060_0000` (`.data`), etc.

Hit **Run** (or `F5`). The program starts executing. When it reaches
the first `bl scanf`, the console tab lights up in the right-side
panel and the run loop pauses on "waiting for input". Click over to
the console tab, type a number, hit Enter. The run loop resumes,
consumes the input, and continues.

After three numbers the program prints an average and halts. The
status bar shows `halted, exit 0`.

## step through it

Reset (`Shift+F5`) and hit **Step** (`F10`) to advance one instruction
at a time. The register panel yellow-pulses each register that changed;
the disassembly panel highlights the current PC; the stack panel
updates as the frame prologue runs.

Click a line number in the editor to set a breakpoint; `Run` will stop
at it.

## step outside the tutorial

Write your own assembly. Every instruction the cpsc 355 reference
mentions works, and a lot more besides; see
[`instruction-reference.md`](instruction-reference.md) for the full
list.

Things that come in handy:

- **Register aliases** (`define(i_r, w19)`) show up faded next to the
  register name in the register panel.
- **Stack-frame slots** (`score1_s = 16`) resolve to numeric offsets at
  assemble time; `[fp, score1_s]` becomes `[x29, 16]` before the
  encoder sees it.
- **Literal loads** (`ldr x0, =msg`) work without any extra wiring; the
  linker puts `msg`'s address into an 8-byte pool slot after `.text`
  and patches the LDR imm19.
- **Host calls** (`bl printf`) route through a per-host trampoline the
  linker planted in `.text`, so you don't have to care that the real
  stub address lives out at `0xFFFF_XXXX`.
- **Syscalls** (`mov x8, 64; svc 0`) produce real output through the
  playground's stdout.

## share your program

Hit **share** in the header. The dialog shows a URL with the entire
program compressed into the hash. Copy it and paste into Slack / Teams /
whatever. Opening the link loads the program straight into the
editor; nothing is sent to a server.

## try the c-to-asm view

Click **C -> asm** in the header. Write some C; the playground
forwards it to Compiler Explorer, gets back AArch64 assembly, and
shows it next to the source. Hit **load into playground** and the
generated assembly lands in the main editor so you can step through
it. While your cursor is on an asm line the header shows the matching
C line number, so you can jump back and forth between the two views.

The C source is sent to **godbolt.org** to compile -- if your snippet
is sensitive, do not paste it here. See
[`c-to-asm.md`](c-to-asm.md) for the full data-handling note,
compiler id, cache TTL, and directive filter.

## beyond the basics

Once you're comfortable with step / run / reset, the header and the
tab strip expose a handful of features that are worth the five
minutes it takes to try them:

- **Tutorials** walk you through a topic one step at a time, with a
  snippet you can load into the editor per step. Progress per
  tutorial is saved locally.
- **Save states** (the **Saves** tab in the debug area) let you
  snapshot the CPU under a name, keep stepping, then jump back. The
  run loop also records the last 128 instructions so **Step back**
  (`Shift+F10`) always undoes the last instruction.
- **Watch expressions** (the **Watches** tab) evaluate a small grammar
  (`x0`, `*x0`, `[fp, score1_s]`, `arr[i]`) every time the CPU stops,
  so you can keep an eye on `[fp, score1_s]` without counting stack
  offsets by hand.
- **Memory watches** (the **Memwatch** tab) lets you pin labelled
  (address, length) ranges so you can keep the `.data` buffer in view
  without scrolling the memory panel.
- **Multi-file assembly** (the **+** next to the main file tab) lets
  you register extra source files. They are concatenated before
  assembly so `bl helper` calls in `main.asm` can resolve to a
  `helper:` label in another file.
- **Light theme** toggle in the header for laptops that autoswitch.
- **Instruction count** in the controls bar ticks up every time a
  real instruction executes, so you can compare two implementations
  by how many steps they take.

## keyboard shortcuts

| Key          | Action                   |
| ------------ | ------------------------ |
| `F6`         | Assemble                 |
| `F10`        | Step one instruction     |
| `Shift+F10`  | Step back                |
| `F5`         | Run / pause              |
| `Shift+F5`   | Reset                    |
| `Ctrl+K`     | Command palette          |
| `?`          | Keyboard-shortcut help   |

That's everything. For the next level of detail, read
[`cpsc355-style-guide.md`](cpsc355-style-guide.md).
