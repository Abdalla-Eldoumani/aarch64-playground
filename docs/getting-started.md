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

## pass program arguments

Type into the **args** input above the Assemble bar (e.g. `hello world`).
The loader writes the strings into the argv pool at `0x0080_0000` and
sets `w0 = argc`, `x1 = argv` on entry, so `int main(int argc, char
**argv)`-style programs work without any extra wiring. Args persist
per-program -- if you switch sources and come back, your args do too.

## beyond the basics

Once you're comfortable with step / run / reset, the header and the
tab strip expose a handful of features that are worth the five
minutes it takes to try them:

- **Tutorials** walk you through a topic one step at a time, with a
  snippet you can load into the editor per step. Progress per
  tutorial is saved locally and `expect` checks verify register
  state as you advance.
- **Save states** (the **Saves** tab in the debug area) let you
  snapshot the CPU under a name, keep stepping, then jump back. The
  run loop also records the last 128 instructions so **Step back**
  (`Shift+F10`) always undoes the last instruction.
- **Bookmarks** in the same tab persist across page reloads -- they
  capture source + args + stdin + step count, restore by re-running
  the program forward to the saved step. Export / import as JSON to
  share a setup with a classmate.
- **Replay scrubber** appears above the register panel after you've
  taken at least two steps. Drag the slider to walk back through the
  last 128 frames visually; the next forward step resumes from the
  live PC.
- **Diagnostic bundle** (the icon next to **share**) copies a
  markdown report of source + args + stdin + stdout + stderr +
  exit code + register state + last-error to the clipboard, plus a
  `?bundle=<lz>` link a TA can open to land at the exact same state.
- **Watch expressions** (the **Watches** tab) evaluate a small grammar
  (`x0`, `*x0`, `[fp, score1_s]`, `arr[i]`) every time the CPU stops.
- **Memory watches** (the **Memwatch** tab) lets you pin labelled
  (address, length) ranges so you can keep the `.data` buffer in view.
- **Multi-file assembly** (the **+** next to the main file tab) lets
  you register extra source files, concatenated before assembly.
- **Terminal** (the **term** tab) runs an xterm.js shell that knows
  `./program [args]` (with `<file` / `>file` redirections), the basic
  VFS commands, and a `gdb` subset. See [`terminal.md`](terminal.md).
- **CPSC 355 mode** (toggle in the overflow sheet on phone, header on
  desktop) turns on lints for the idioms the course expects -- alias
  suffixes, canonical prologues, 16-byte stack alignment, no bare
  `x29`/`x30`.
- **Lecture mode** swaps to high-contrast theme + fullscreen +
  oversized step / reset buttons for projector use.
- **Hotspot mode** highlights the hottest instructions across a run
  so you can spot loops at a glance.
- **Three themes**: cycle through dark / light / high-contrast from
  the header.
- **Per-panel zoom** with `Ctrl+Wheel` over a panel; `Ctrl+0` resets.
- **Source formatter**: `Ctrl+Shift+F` lowercases mnemonics, indents
  to 8 spaces, aligns trailing comments to column 40.
- **Embed mode**: `?embed=1` strips the chrome to just the editor +
  console for slide decks and inline lecture demos.
- **Offline**: the playground is a PWA. Once loaded once, the app
  shell + examples + icons stay cached and the page works offline.

## keyboard shortcuts

| Key            | Action                  |
| -------------- | ----------------------- |
| `F6`           | Assemble                |
| `F10`          | Step one instruction    |
| `Shift+F10`    | Step back               |
| `F5`           | Run / pause             |
| `Shift+F5`     | Reset                   |
| `Ctrl+K`       | Command palette         |
| `Ctrl+S`       | Save state (named)      |
| `Ctrl+Shift+F` | Format the source       |
| `Ctrl+Wheel`   | Zoom focused panel      |
| `Ctrl+0`       | Reset zoom              |
| `?`            | Keyboard shortcuts help |

That's everything. For the next level of detail, read
[`cpsc355-style-guide.md`](cpsc355-style-guide.md) or
[`features.md`](features.md) for a per-feature index of where things
live in the source.
