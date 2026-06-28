# getting started

A short tour for a first-time reader. The site has five places:

- `/` the landing page, with a live mini-playground.
- `/playground` the full emulator and visual debugger.
- `/learn` step-by-step lessons that pair a short reading with a runnable editor.
- `/practice` exercises checked by running your program, not by matching a stored solution.
- `/reference` the supported instructions, the calling-convention guide, and a pitfalls catalog.

The rest of this page walks through the playground, then points at the other sections.

## open the playground

Go to <https://aarch64-playground.vercel.app/playground> (or click
"Open the playground" on the landing page). Locally, run `npm run dev` in
`web/` and open <http://localhost:3000/playground>.

You get an editor on the left, registers top-right, and a memory / stack /
console area bottom-right. On a phone it is one pane at a time with a
bottom tab strip.

## load an example

Pick an example from the **load example...** menu in the header. Examples
are grouped by stage, in the order the concepts build (first programs,
data and memory, stack and locals, and so on), with plain names and no
course-week labels. Choose **scores (scanf + avg)** under "Records and
arrays": it reads three scores from stdin, stores them on the stack,
averages them, and prints the result.

The source starts like this:

```
define(fp, x29)
define(lr, x30)
define(score1_r, w19)

score1_s = 16
alloc = -(16 + 16) & -16

.data
fmt_prompt:     .string "Enter score %d: "

.text
.global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
```

It is a course-style tutorial file, accepted as-is.

## assemble and run

Hit **Assemble** (`F6`). The m4 expander runs, the frontend parses each
section, the linker places labels and a literal pool, and the bytes load
into memory at `0x0040_0000` (`.text`), `0x0060_0000` (`.data`), and so on.

Hit **Run** (`F5`). At the first `bl scanf` the console area pauses for
input: switch to the console tab, type a number, and press Enter. The run
resumes and consumes it. After three numbers the program prints the
average and the status bar shows it halted with exit code 0.

## step and set a breakpoint

Reset (`Shift+F5`), then **Step** (`F10`) to advance one instruction at a
time. Changed registers flash, the disassembly highlights the current PC,
and the stack updates as the prologue runs. Click a line number in the
editor to set a breakpoint; **Run** stops there.

## write your own

Every instruction in the reference works, plus more; see
[`instruction-reference.md`](instruction-reference.md). A few things that
come in handy:

- Register aliases (`define(i_r, w19)`) show faded next to the register name.
- Stack-frame slots (`score1_s = 16`) resolve to numeric offsets at assemble time, so `[fp, score1_s]` becomes `[x29, 16]`.
- Literal loads (`ldr x0, =msg`) work without wiring: the linker adds `msg`'s address to the pool and patches the LDR.
- Host calls (`bl printf`) route through a per-host trampoline the linker plants in `.text`.
- Syscalls (`mov x8, 64; svc 0`) produce real output through stdout.

## pass arguments

Type into the **args** input above the Assemble bar (for example
`hello world`). The loader writes the strings into the argv pool at
`0x0080_0000` and sets `w0 = argc`, `x1 = argv` on entry, so
`int main(int argc, char **argv)` programs work unchanged. Args persist
per program, so switching sources and coming back keeps them.

## share

Hit **share** in the header. The dialog shows a URL with the whole program
compressed into the hash. Opening the link loads it straight into the
editor; nothing is sent to a server.

## learn, practice, reference

- **Learn** (`/learn`): lessons that embed the same editor, so you read a
  short section then run the code beside it.
- **Practice** (`/practice`): exercises graded by running your program
  against expected behavior. The checker never reads or stores a solution.
- **Reference** (`/reference`): the supported instruction set, a
  calling-convention guide, and a catalog of common pitfalls.

## more playground features

The header and tab strip expose more. See [`features.md`](features.md)
for the full index of where each lives.

- **Tutorials** walk a topic one step at a time and verify register state with `expect` checks; progress is saved locally.
- **Save states** (the saves tab) snapshot the CPU under a name. The run loop also records recent instructions, so **Step back** (`Shift+F10`) undoes the last one.
- **Bookmarks** (same tab) persist across reloads: they store source, args, stdin, and step count, and restore by re-running to the saved step. Export and import as JSON to share a setup.
- **Replay scrubber** appears once you have stepped at least twice; drag it to walk back through recent frames.
- **Diagnostic bundle** (next to **share**) copies a markdown report of source, args, stdin, output, exit code, and register state, plus a `?bundle=` link that reopens the same state.
- **Watch expressions** (the watches tab) evaluate a small grammar (`x0`, `*x0`, `[fp, score1_s]`, `arr[i]`) every time the CPU stops.
- **Memory watches** (the memwatch tab) pin labelled address ranges.
- **Multi-file assembly** (the **+** by the file tab) registers extra source files, concatenated before assembly.
- **Terminal** (the term tab) is an xterm.js shell with `./program [args]`, redirections, basic VFS commands, and a `gdb` subset. See [`terminal.md`](terminal.md).
- **CPSC 355 mode** (toolbar toggle) turns on lints for course idioms: alias suffixes, canonical prologues, 16-byte stack alignment, and no bare `x29`/`x30`.
- **Lecture mode** switches to high-contrast, fullscreen, oversized controls for projector use.
- **Hotspot mode** highlights the hottest instructions across a run.
- **Three themes** cycle through dark, light, and high-contrast from the header.
- **Per-panel zoom** with `Ctrl+Wheel` over a panel.
- **Source formatter** (`Ctrl+Shift+F`) lowercases mnemonics, indents to 8 spaces, and aligns trailing comments to column 40.
- **Embed mode** (`?embed=1`) strips the chrome to the editor and console for slide decks.
- **Offline**: the app is a PWA, so once loaded the shell, examples, and icons work offline.

## keyboard shortcuts

| Key | Action |
| --- | --- |
| `F6` | Assemble (also `Ctrl+Enter`) |
| `F10` | Step one instruction |
| `Shift+F10` | Step back |
| `F5` | Run / pause |
| `Shift+F5` | Reset |
| `Ctrl+K` | Command palette |
| `Ctrl+Shift+F` | Format the source |
| `Ctrl+Wheel` | Zoom the focused panel |
| `?` | Keyboard shortcuts help |

For more depth, read [`cpsc355-style-guide.md`](cpsc355-style-guide.md) or
[`features.md`](features.md).
