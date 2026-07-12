# Terminal pane

An xterm.js shell that runs alongside the standard console. Open it from
the terminal tab on the right-side tab strip (desktop and tablet) or the
bottom tab strip (mobile). The console tab is unchanged; pick whichever
fits the task.

## Commands

### Programs

| Command | Effect |
| --- | --- |
| `./program [args]` | Re-assemble the current editor source with `args` and run to halt. |
| `./name [args]` | Run an executable built with `gcc` (see the toolchain below). |
| `./program < file` | Either form, with the named VFS file fed to stdin. |
| `./program > file` | Either form, with stdout captured into the named VFS file. |

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
like the real toolchain would choke on unexpanded macros. Other gcc flags
are accepted and ignored; there is no C compiler here, only the assembler.
Executables live for the session and are re-assembled on each run.

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
| `mv <old> <new>` | Rename a VFS file. |
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
| `gdb x/Ni $pc` | Show N words of memory at the current PC. |
| `gdb bt` | One-frame backtrace at the current PC. |

## Input handling

- History: ArrowUp and ArrowDown walk previously-submitted lines; repeated identical commands collapse.
- Tab completion: completes against the VFS file list. A unique prefix expands; an ambiguous one lists candidates.
- Paste: multi-line clipboard pastes split on any line-break style (`\r\n`, `\r`, or `\n`), and each line submits as a separate command.

## Implementation

- `web/lib/terminal/dispatch.ts` parses each command line and routes it to a handler. It reuses the shell-style tokenizer in `web/lib/playground/args.ts`, so quoting works the same as the args input.
- `web/lib/terminal/input-state.ts` is a pure class for the buffer, cursor, history, and tab completion, unit-tested without xterm.
- `web/components/panels/TerminalPane.tsx` wraps `@xterm/xterm` and `@xterm/addon-fit` and writes each dispatch result back to the terminal. It is lazy-loaded so the xterm bundle ships only when the term tab is opened.
