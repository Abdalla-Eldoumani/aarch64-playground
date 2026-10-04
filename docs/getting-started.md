# Getting started

This tour runs one course-style program in the playground, steps through it,
and then points at the rest of the site. The site has five parts:

- `/`: the home page, with a short program you can step through.
- `/playground`: the full emulator and debugger.
- `/learn`: lessons, each with programs you can run beside the text.
- `/practice`: coding exercises checked by running your program, plus quizzes,
  fill-in-the-blank sets, and prediction sets graded on the page.
- `/reference`: every supported instruction, the calling convention, and a
  catalog of common mistakes.

## Open the playground

Go to <https://aarch64-playground.com/playground>. To run it on your own
machine, follow the README's [Run it locally](../README.md#run-it-locally) and
open <http://localhost:3000/playground>.

The editor is on the left. The registers are top right, and the memory, stack,
console, and other tabs are below them. On a phone the playground shows one
view at a time (code, registers, console, and more), picked from the tabs
under the run controls.

The first visit offers an **interface walkthrough** that points at each part
in turn. Reopen it any time from the command palette (`Ctrl+K`), or open
`/playground?walkthrough`.

## Load an example

Open the **load example...** menu and pick **scores (scanf + avg)** under
"Records and arrays". It reads three scores, stores them on the stack, and
prints their average. Some lines from the top of the file:

```
define(fp, x29)
define(lr, x30)
define(score1_r, w19)

score1_s = 16
alloc = -(16 + 16) & -16

.data
fmt_prompt:     .string "Enter score %d: "
```

It is a course-style file and runs as written: m4 aliases (`define`), stack
offsets as symbols (`score1_s = 16`), and `printf` and `scanf` calls.

## Assemble and run

1. Press **assemble** (`F6`). The playground expands the m4 macros, assembles
   each section, links the calls to `printf` and `scanf`, and loads the
   program into memory. Errors appear on the line that caused them.
2. Press **run** (`F5`). At the first `scanf` the console asks for input. Type
   a number and press Enter. The run picks it up and carries on.
3. Answer the other two prompts. The program prints the average, the controls
   show **halted**, and the console shows `exit 0`.

**run** assembles first when it needs to: when nothing is loaded yet, when the
program has finished, or when you changed the code, the files, or the args.
**assemble** on its own loads the program without running it, ready to step.
`Ctrl+Enter` assembles and runs in one step, even from inside the editor.

## Step and set a breakpoint

1. Press **assemble** again.
2. Press **step** (`F10`) to run one instruction. The registers it changed are
   marked, the current line is highlighted, and the stack panel follows the
   prologue as it builds the frame.
3. Press **back** (`Shift+F10`) to undo the last instruction. Step back
   reaches the last 128 instructions.
4. Click the margin to the left of a line number to set a breakpoint there,
   or put the caret on the line and press `F9`. **run** stops when it reaches
   that line.

The **next instruction** strip above the registers shows the instruction the
next step runs: its encoding, field by field, and a plain-English reading of
what it does.

## Pass arguments

Type into the **args** box, for example `hello world`. The box holds `argv[1]`
onward. The program still gets `./program` as `argv[0]`, the way Linux runs
it, so `argc` is 1 when the box is empty. The box remembers what you typed for
each program.

## Share a program

Press **share**. The dialog shows a link with the whole program compressed
into it. Opening the link loads the program into the editor, and nothing is
sent to a server.

When a program misbehaves and you want help, press **diagnostic bundle**. It
shows a report of the program, its input and output, and the registers, stack,
and memory, and copies it or a link that reopens the program.

## Other tools in the playground

- **Tutorials** walk through an example program one step at a time and check
  the registers as you go.
- The **term** tab is a terminal with the course workflow (`m4`, `gcc`,
  `./program`) and a small `gdb`. The terminal keeps the keyboard while it has
  focus, so press `Ctrl+M`, then `Tab`, to move out of it. See
  [terminal.md](terminal.md).
- The **watches** tab evaluates expressions such as `x0`, `*x0`, and
  `[fp, score1_s]` each time the program stops. A stack offset also takes an
  index: `score1_s[1]` reads the 8 bytes at `fp + score1_s + 8`. A `.data`
  label takes one too, when a `.byte`, `.hword`, `.word`, or `.dword` line
  (or another spelling of one of those sizes, such as `.quad`) follows it: `nums[2]` reads the third element, 1, 2, 4, or 8 bytes wide to
  match. A label with no such line, or with mixed sizes, is refused rather
  than guessed. Name registers directly (`w19`); an m4 alias such as
  `score1_r` is not understood there. **memwatch** pins address ranges you
  name.
- The **convert** tab shows one value as binary, octal, decimal, and hex,
  signed and unsigned, and as an IEEE-754 float at 32 or 64 bits. Click a bit
  to flip it.
- The **saves** tab stores the machine under a name, and bookmarks that
  survive a reload.
- The **+** beside the file tab adds more source files. They are assembled
  together with `main.asm`.
- The register panel switches between the integer (`x`), floating-point (`d`),
  and 128-bit vector (`v`) registers, each in decimal or hex. A vector
  register splits into 8, 16, 32, or 64-bit lanes, or float lanes.
- The **theme** button beside the GitHub link, at the top of every page,
  opens the ten themes: dark, light, high contrast, midnight, ember, forest,
  dusk, paper, glacier, and rose. On a phone they sit in the menu, in two rows
  of five. The choice is remembered.
- `?embed=1` on the playground's address hides everything but the editor,
  registers, and console, for slides.
- After one visit the playground works offline. **Save every page for
  offline**, in the menu or at the foot of any page, keeps the lessons,
  practice, and the reference too.

[features.md](features.md) lists the file behind each of these.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `F6` | Assemble |
| `Ctrl+Enter` | Assemble and run |
| `F5` | Run or pause |
| `F10` | Step |
| `Shift+F10` | Step back |
| `Shift+F5` | Reset |
| `F9` | Set or clear a breakpoint on the caret's line |
| `Ctrl+K` | Command palette, from anywhere on the page |
| `Ctrl+M` | Leave the terminal (then `Tab`) |
| `?` | Every shortcut |

## The rest of the site

- **Learn**: each lesson has editors with **run**, **step**, **back**, and
  **reset** under them, so you can change an example and run it in place.
- **Practice**: a coding exercise gives you a starter program and a **check**
  button. Check runs your program on the visible input and on hidden ones and
  compares the output; it never looks at a stored answer, so any correct
  approach passes. Your progress and answers stay in this browser; the
  **progress** row exports them to a file and imports them on another device.
- **Reference**: the list starts with the instructions the course uses, and
  a button above it shows all of them. Type a mnemonic or plain words in the
  box (`/` jumps to it): `multiply`, `load a byte`, and `x * y` all work, and
  a small typo such as `mvo` still finds `mov`. The group buttons narrow the
  list, and when nothing matches it shows the closest instructions. The
  address keeps the search, so a link opens the same list. Each entry shows
  the syntax, an example, the C it matches, and the flags it sets.
  The calling-convention guide steps through a stack frame, and each mistake
  in the pitfalls catalog runs in place.

For how course files are written, read
[cpsc355-style-guide.md](cpsc355-style-guide.md).
