# Terminal pane

A small shell in the playground, beside the console. Open the **term** tab
(on a phone, **terminal**). The console still works as before; use whichever
fits the task.

## Commands

### Programs

| Command | Effect |
| --- | --- |
| `./program [args]` | Re-assemble the editor workspace (main.asm plus every file in the strip) with `args` and run it live in the pane. Here `program` is a literal name, not a placeholder: it always means the editor's own buffer. |
| `./name [args]` | Run an executable built with `gcc` under whatever name you gave it (see the toolchain below). |
| `./name < file` | Either form, with the named file from the playground's virtual filesystem (VFS) fed to stdin. The file is the whole input: stdin closes after it, so a read-until-EOF loop finishes instead of waiting. |
| `./name > file` | Either form, with stdout captured into the named VFS file. |

A run prints the program's exit status when it finishes; a program that
stops without exiting (a fault, the step budget) prints
`[no exit: the program did not finish]` instead of a made-up code. A
compiled executable named `program` takes precedence over the editor-source
alias, matching a real shell's lookup.

### Interactive runs

A program run without a `>` capture owns the pane until it exits: output
streams in as it is produced, and your keystrokes are its stdin. Input
follows the terminal modes a real tty would apply:

- Canonical (scanf-style) programs get cooked-mode line editing: typed
  characters echo as you type, backspace edits the line, and the program
  receives the whole line when you press enter.
- A program that puts the terminal in raw mode (termios, like the snake
  game, the calculator, or deadzone) receives every byte as typed, with
  no echo: it draws its own screen.
- Ctrl+C stops the program and returns the prompt.

Six examples (snake, the data structures visualizer, calc, temp-convert,
two-sum, and deadzone) can run in the terminal: set the `console | terminal`
switch in the header to terminal, and **run** opens the term tab, clears it,
and starts the program there. Step back is off while such a session runs and
comes back when it ends.

Calc, temp-convert, and two-sum each carry a second, plain-text face:
`./program console` here answers a line at a time with no colour or
cursor moves, and picking console on the run-mode control seeds that same
argument for you.

### Toolchain

The course workflow from the lab machines, replayed against the VFS:

```
upload                    # add lab5.asm to the VFS
m4 lab5.asm > lab5.s      # expand the m4 macros
gcc lab5.s -o lab5        # assemble
./lab5 12 34              # run
```

| Command | Effect |
| --- | --- |
| `m4 <file>` | Run the m4 pass over a VFS file and print the expansion. |
| `m4 <file> > out` | Same, captured into a VFS file. |
| `gcc <file.s> -o name` | Assemble a VFS source into an executable named `name` (default `a.out`). |
| `as <file.s> -o name` | Alias for `gcc`. |

`gcc` rejects `.asm` inputs and points you at the `m4` pass first, exactly
like the real toolchain would choke on unexpanded macros. A failed
assemble prints the assembler's own error with its line number in the
terminal, and leaves the editor's error markers alone: the build belongs
to the terminal's file, not whatever the editor happens to show. Other gcc
flags are accepted and ignored; there is no C compiler here, only the
assembler. Executables live for the session and are re-assembled on each
run. Builds and runs reset the machine like any assemble, and the home
directory is re-seeded right after, so `ls` keeps showing your files and a
program run with `./name` can read them.

### Filesystem

Files live in a small virtual filesystem (VFS). In the full playground the
VFS is your home directory: uploads, redirect outputs, and loaded example
fixtures persist in your browser (IndexedDB) across reloads, route changes,
and closed tabs, and they survive re-assembling. `rm` removes a file for
good. Embedded lesson and exercise players stay session-only sandboxes.

| Command | Effect |
| --- | --- |
| `ls` | List the VFS file names. |
| `ls -l` | List with byte counts. |
| `cat <file>` | Print a VFS file's contents. |
| `cp <src> <dst>` | Copy a VFS file. |
| `rm <file>` | Remove a VFS file. |
| `mv <old> <new>` | Rename a VFS file. `mv f f` refuses, like the real tool. |
| `upload` | Open the host file picker to add a file to the VFS. |
| `clear` | Clear the terminal scrollback. |
| `reset` | Reset the emulator (memory, registers); the VFS is preserved. |
| `help` | Show the command list. |

### gdb-lite

| Command | Effect |
| --- | --- |
| `gdb help` | Show the gdb-lite command list. |
| `gdb n`, `gdb s` | Step one instruction. |
| `gdb c` | Continue to halt or breakpoint. |
| `gdb b <label>` | Set a breakpoint at a label (resolved via the linker symbol table). |
| `gdb p $xN` | Print a register in hex (`$x0`..`$x30`, `$sp`, `$pc`). |
| `gdb info registers` | Print every register. |
| `gdb x/Ni $pc` | Show N words of memory at the PC, or at the address in a register (`$x0`). N is at most 1024. |
| `gdb bt` | One-frame backtrace at the current PC. |

## Input handling

- History: ArrowUp and ArrowDown walk previously-submitted lines; repeated identical commands collapse.
- Tab completion: completes against the VFS file list. A unique prefix expands; an ambiguous one lists candidates.
- Paste: multi-line clipboard pastes split on any line-break style (`\r\n`, `\r`, or `\n`), and each line submits as a separate command.

Quoting works as it does in the **args** box: `"two words"` is one argument.
Only a bare `<` or `>` redirects; a quoted `">"` or an escaped `\>` is an
ordinary argument.

## Where the code lives

`web/lib/terminal/dispatch.ts` reads each command line and runs it.
`web/lib/terminal/input-state.ts` holds the line being typed, the history, and
tab completion. `web/components/panels/TerminalPane.tsx` draws the terminal
with xterm.js, which loads only when the tab is first opened.
