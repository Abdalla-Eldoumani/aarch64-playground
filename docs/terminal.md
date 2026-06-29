# Terminal pane

An xterm.js shell that runs alongside the standard console. Open it from
the terminal tab on the right-side tab strip (desktop and tablet) or the
bottom tab strip (mobile). The console tab is unchanged; pick whichever
fits the task.

## Commands

### Programs

| Command | Effect |
| --- | --- |
| `./program [args]` | Re-assemble the current source with `args` and run to halt. |
| `./program < file` | Same, with the named VFS file fed to stdin. |
| `./program > file` | Same, with stdout captured into the named VFS file. |

### Filesystem

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
- Paste: multi-line clipboard pastes split on `\n`, and each line submits as a separate command.

## Implementation

- `web/lib/terminal/dispatch.ts` parses each command line and routes it to a handler. It reuses the shell-style tokenizer in `web/lib/args.ts`, so quoting works the same as the args input.
- `web/lib/terminal/input-state.ts` is a pure class for the buffer, cursor, history, and tab completion, unit-tested without xterm.
- `web/components/TerminalPane.tsx` wraps `@xterm/xterm` and `@xterm/addon-fit` and writes each dispatch result back to the terminal. It is lazy-loaded so the xterm bundle ships only when the term tab is opened.
