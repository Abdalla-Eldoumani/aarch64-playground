# Terminal pane

The terminal pane is an xterm.js shell available alongside the standard
console. Open it from the `term` tab on the right-side tab strip
(desktop / tablet) or the bottom tab strip (mobile). The console tab is
unchanged -- pick whichever surface fits your task.

## Commands

### Programs

| Command | Effect |
| --- | --- |
| `./program [args]`        | Re-assemble the current source with `args` and run to halt. |
| `./program < file`        | Same, with the named VFS file fed to stdin. |
| `./program > file`        | Same, with stdout captured into the named VFS file. |

### Filesystem

| Command | Effect |
| --- | --- |
| `ls`                      | List the VFS file names. |
| `ls -l`                   | List with byte counts. |
| `cat <file>`              | Print a VFS file's contents. |
| `cp <src> <dst>`          | Copy a VFS file. |
| `rm <file>`               | Remove a VFS file. |
| `mv <old> <new>`          | Rename a VFS file. |
| `upload`                  | Open the host file picker; pick a file to add to the VFS. |
| `clear`                   | Clear the terminal scrollback. |
| `reset`                   | Reset the emulator (memory, registers); preserves the VFS. |
| `help`                    | Show the command list. |

### gdb-lite

| Command | Effect |
| --- | --- |
| `gdb help`                | Show the gdb-lite command list. |
| `gdb n`, `gdb s`          | Step one instruction. |
| `gdb c`                   | Continue to halt or breakpoint. |
| `gdb b <label>`           | Set a breakpoint at a labeled address (resolved via the linker symbol table). |
| `gdb p $xN`               | Print register `xN` in hex (`$x0`..`$x30`, `$sp`, `$pc`). |
| `gdb info registers`      | Print every register. |
| `gdb x/Ni $pc`            | Show N words of memory at the current PC. |
| `gdb bt`                  | One-frame backtrace at the current PC. |

## Input handling

- **History** -- ArrowUp / ArrowDown walk through previously-submitted lines. Repeated identical commands collapse.
- **Tab completion** -- works against the VFS file list. A unique prefix expands; an ambiguous prefix lists candidates.
- **Paste** -- multi-line clipboard pastes are split on `\n`; each line submits as a separate command.
- **Touch** -- xterm.js's default touch scroll keeps focus on the input. The on-screen keyboard pastes via the standard system gesture.

## Implementation

- `web/lib/terminal/dispatch.ts` parses each command line and routes it to a handler. The parser shares the shell-style tokenizer in `web/lib/args.ts` so the same quoting rules apply.
- `web/lib/terminal/input-state.ts` is a pure class managing the buffer, cursor, history, and tab completion. Easily unit-tested without xterm.
- `web/components/TerminalPane.tsx` wraps `@xterm/xterm` + `@xterm/addon-fit`, listens for keys, and writes the output of each dispatch back to the terminal. Lazy-loaded so the xterm bundle (~50 KB gz) only ships when the user opens the term tab.
