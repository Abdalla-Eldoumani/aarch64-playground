import { formatWord32, formatWord64 } from "@/lib/emulator/format-hex";
import { parseArgsDetailed } from "@/lib/playground/args";

/**
 * Result of running a single command line. `lines` is the printable
 * payload (terminal will write each line followed by `\r\n`); `status`
 * lets callers style the prompt accordingly. `control` lets a command
 * ask the terminal pane for special behaviour (clear screen, etc.).
 */
export interface DispatchResult {
  status: "ok" | "err";
  lines: string[];
  control?: "clear";
  exitCode?: number;
}

export interface ParsedCommandLine {
  cmd: string;
  args: string[];
  stdinFrom?: string;
  stdoutTo?: string;
}

/**
 * Tokenize a shell-style command line into command + args + optional
 * `<file` and `>file` redirections. Re-uses the shared tokenizer for
 * quoting so the terminal honors the same rules as the args input above
 * the editor. Like a real shell, only a BARE `<` or `>` redirects: a
 * quoted `">"` or escaped `\>` stays a literal argument.
 */
export function parseCommandLine(line: string): ParsedCommandLine {
  const trimmed = line.trim();
  if (!trimmed) return { cmd: "", args: [] };
  const tokens = parseArgsDetailed(trimmed);
  let stdinFrom: string | undefined;
  let stdoutTo: string | undefined;
  const remaining: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.quoted && t.text === "<" && i + 1 < tokens.length) {
      stdinFrom = tokens[i + 1].text;
      i += 1;
      continue;
    }
    if (!t.quoted && t.text === ">" && i + 1 < tokens.length) {
      stdoutTo = tokens[i + 1].text;
      i += 1;
      continue;
    }
    remaining.push(t.text);
  }
  const [cmd = "", ...args] = remaining;
  return { cmd, args, stdinFrom, stdoutTo };
}

/**
 * Hooks the terminal needs from the surrounding playground -- VFS, the
 * emulator backend, register reads, and a label resolver. Tests pass in
 * stubbed implementations; the production wiring sits in TerminalPane.
 */
/** A running foreground program's input surface: the pane forwards raw
 *  keystrokes here and Ctrl+C cancels. */
export interface TerminalForegroundProgram {
  pushInput(data: string): void;
  cancel(): void;
}

/** The terminal pane's I/O surface for interactive program runs: output
 *  streams into xterm as it is produced, and the pane routes keystrokes
 *  to whichever program is registered as foreground. */
export interface TerminalProgramIO {
  write(text: string): void;
  setForeground(fg: TerminalForegroundProgram | null): void;
  /** Wipe the pane (scrollback included) the moment a program takes it
   *  over, so the game starts on a clean screen instead of layering
   *  onto whatever the shell ran before. */
  clear?(): void;
  /** Called only by self-attached sessions (a raw-mode program started
   *  from the run button): the pane prints the exit line and a fresh
   *  prompt. `./name` runs skip it -- dispatch prints those lines. */
  sessionEnded?(exitCode: number | null): void;
  /** Put the keyboard back on the pane (returning to the terminal tab
   *  mid-session; hiding the pane blurs its textarea). */
  focus?(): void;
}

export interface DispatchContext {
  /** Lower-level VFS handle (rare; helpers below are usually enough). */
  vfs: Map<string, string>;
  listVfs(): string[];
  /** Async because production reads round-trip through the worker;
   *  tests can return a resolved Promise. */
  readVfs(path: string): Promise<string | undefined> | string | undefined;
  writeVfs(path: string, body: string): void;
  deleteVfs(path: string): Promise<boolean> | boolean;
  /** Run the currently-loaded program with argv and optional stdin.
   *  With `io`, the run is interactive: output streams to the pane and
   *  keystrokes reach stdin while the program lives. */
  runProgram(
    args: string[],
    stdin?: string,
    io?: TerminalProgramIO,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
  step(): Promise<{ halted: boolean; line: number | null }>;
  runUntilBreak(): Promise<{ halted: boolean; hit_breakpoint: boolean }>;
  setBreakpoint(addr: number): Promise<void>;
  clearBreakpoint(addr: number): Promise<void>;
  /** Look up a label's runtime address. Returns null when unresolved. */
  resolveLabel(label: string): Promise<number | null> | number | null;
  /** Standalone m4 pass over source text; null when the emulator build
   *  predates the export (the command explains instead of crashing). */
  m4Expand(
    source: string,
  ): Promise<{ success: boolean; text?: string; error?: string; error_line?: number } | null>;
  /** Assemble source text into the machine (the `gcc` step). Resolves with
   *  the assembler's verdict; errors carry the student-facing message. */
  assembleSource(source: string): Promise<{ success: boolean; errors: string[] }>;
  /** Run previously-compiled source (a `gcc` output) with argv and stdin. */
  runSource(
    source: string,
    args: string[],
    stdin?: string,
    io?: TerminalProgramIO,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
  /** The terminal's executable registry: `gcc -o name` writes it, `./name`
   *  reads it. Survives across commands within the pane's lifetime. */
  executables: Map<string, string>;
  /** Read a single register by name (`x0`..`x30`, `sp`, `pc`). */
  readRegister(name: string): bigint | null;
  /** Read every register the gdb `info registers` block should print. */
  readRegisters(): Record<string, bigint>;
  readMemory(addr: number, len: number): Promise<Uint8Array>;
  pcAddress(): number;
  reset(): Promise<void>;
  /** Present when the pane can host interactive programs; dispatch hands
   *  it to runProgram/runSource for `./name` runs without a `>` capture. */
  terminalIO?: TerminalProgramIO;
}

const HELP_LINES = [
  "available commands:",
  "  m4 prog.asm > prog.s              expand m4 macros, exactly like the course toolchain",
  "  gcc prog.s -o prog                assemble a VFS file into an executable",
  "  ./prog [args]                     run an executable built with gcc",
  "  ./program [args]                  run the editor's currently-loaded program",
  "  ./program < file                  feed stdin from a VFS file",
  "  ./program > file                  capture stdout into a VFS file",
  "  cat <file>                        print a VFS file",
  "  ls                                list VFS files",
  "  ls -l                             list VFS files with byte counts",
  "  cp <src> <dst>                    copy a VFS file",
  "  rm <file>                         remove a VFS file",
  "  mv <old> <new>                    rename a VFS file",
  "  upload                            open the host file picker to add a file to the VFS",
  "  clear                             clear the terminal scrollback",
  "  reset                             reset the emulator state (VFS preserved)",
  "  gdb help                          show the gdb-lite command list",
];

const GDB_HELP_LINES = [
  "gdb-lite commands:",
  "  gdb n | gdb s                     step one instruction",
  "  gdb c                             continue to halt or breakpoint",
  "  gdb b <label>                     set a breakpoint at a labeled address",
  "  gdb p $xN                         print register N's value in hex",
  "  gdb info registers                print every register",
  "  gdb x/Ni $pc                      disassemble N words at the current PC",
  "  gdb bt                            print a one-frame backtrace (current PC)",
];

export async function dispatchCommand(
  line: string,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  const parsed = parseCommandLine(line);
  if (!parsed.cmd) return { status: "ok", lines: [] };

  const { cmd, args, stdinFrom, stdoutTo } = parsed;

  if (cmd === "clear") return { status: "ok", lines: [], control: "clear" };
  if (cmd === "help") return { status: "ok", lines: HELP_LINES };
  if (cmd === "ls") {
    const long = args[0] === "-l";
    const names = ctx.listVfs().slice().sort();
    if (!long) return { status: "ok", lines: names };
    const lines: string[] = [];
    const enc = new TextEncoder();
    for (const n of names) {
      const body = (await ctx.readVfs(n)) ?? "";
      // Byte count, not string.length: a multi-byte UTF-8 file would
      // otherwise report its UTF-16 code-unit count.
      lines.push(`${String(enc.encode(body).length).padStart(6)} bytes  ${n}`);
    }
    return { status: "ok", lines };
  }
  if (cmd === "cat") {
    const target = args[0];
    if (!target) return { status: "err", lines: ["cat: missing operand"] };
    const body = await ctx.readVfs(target);
    if (body === undefined) return { status: "err", lines: [`cat: ${target}: no such file in vfs`] };
    return { status: "ok", lines: body.split("\n") };
  }
  if (cmd === "cp") {
    const [src, dst] = args;
    if (!src || !dst) return { status: "err", lines: ["cp: usage: cp <src> <dst>"] };
    const body = await ctx.readVfs(src);
    if (body === undefined) return { status: "err", lines: [`cp: ${src}: no such file in vfs`] };
    ctx.writeVfs(dst, body);
    return { status: "ok", lines: [] };
  }
  if (cmd === "rm") {
    const target = args[0];
    if (!target) return { status: "err", lines: ["rm: missing operand"] };
    const ok = await ctx.deleteVfs(target);
    if (!ok) return { status: "err", lines: [`rm: ${target}: no such file in vfs`] };
    return { status: "ok", lines: [] };
  }
  if (cmd === "mv") {
    const [src, dst] = args;
    if (!src || !dst) return { status: "err", lines: ["mv: usage: mv <old> <new>"] };
    if (src === dst) {
      // Real mv refuses a self-move; the old copy-then-delete shape
      // deleted the file instead.
      return { status: "err", lines: [`mv: '${src}' and '${dst}' are the same file`] };
    }
    const body = await ctx.readVfs(src);
    if (body === undefined) return { status: "err", lines: [`mv: ${src}: no such file in vfs`] };
    ctx.writeVfs(dst, body);
    await ctx.deleteVfs(src);
    return { status: "ok", lines: [] };
  }
  if (cmd === "reset") {
    await ctx.reset();
    return { status: "ok", lines: ["reset complete"] };
  }
  if (cmd === "upload") {
    return { status: "ok", lines: ["upload: launching host file picker..."], control: undefined };
  }
  if (cmd === "m4") {
    const target = args[0];
    if (!target) return { status: "err", lines: ["m4: usage: m4 <file> [> out.s]"] };
    const body = await ctx.readVfs(target);
    if (body === undefined) return { status: "err", lines: [`m4: ${target}: no such file in vfs`] };
    const result = await ctx.m4Expand(body);
    if (result === null) {
      return {
        status: "err",
        lines: ["m4: this emulator build predates the standalone m4 pass; rebuild the WASM to enable it"],
      };
    }
    if (!result.success) {
      const where = result.error_line != null ? `${target}:${result.error_line}: ` : "";
      return { status: "err", lines: [`m4: ${where}${result.error ?? "expansion failed"}`] };
    }
    const text = result.text ?? "";
    if (stdoutTo) {
      ctx.writeVfs(stdoutTo, text);
      return { status: "ok", lines: [] };
    }
    return { status: "ok", lines: text.split("\n") };
  }

  if (cmd === "gcc" || cmd === "as") {
    // Course shape: gcc prog.s -o prog. Optimization/debug flags are
    // accepted and ignored; the output name defaults to a.out like the
    // real driver.
    const positional: string[] = [];
    let outName = "a.out";
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-o" && i + 1 < args.length) {
        outName = args[i + 1];
        i += 1;
      } else if (a.startsWith("-")) {
        continue; // -g, -O2, -Wall... accepted silently
      } else {
        positional.push(a);
      }
    }
    const src = positional[0];
    if (!src) return { status: "err", lines: [`${cmd}: no input files`] };
    if (positional.length > 1) {
      return { status: "err", lines: [`${cmd}: one input file at a time in the playground`] };
    }
    if (src.endsWith(".asm")) {
      return {
        status: "err",
        lines: [
          `${cmd}: ${src}: run the m4 pass first, the way the course toolchain does:`,
          `  m4 ${src} > ${src.replace(/\.asm$/, ".s")}`,
        ],
      };
    }
    const body = await ctx.readVfs(src);
    if (body === undefined) return { status: "err", lines: [`${cmd}: ${src}: no such file in vfs`] };
    const verdict = await ctx.assembleSource(body);
    if (!verdict.success) {
      const lines = verdict.errors.length
        ? verdict.errors.map((e) => `${src}: ${e}`)
        : [`${cmd}: ${src}: assembly failed`];
      return { status: "err", lines };
    }
    ctx.executables.set(outName, body);
    return { status: "ok", lines: [] };
  }

  if (cmd === "./program" || cmd === "program" || cmd.startsWith("./")) {
    const name = cmd.startsWith("./") ? cmd.slice(2) : cmd;
    // A compiled artifact always wins: `gcc x.s -o program` used to be
    // silently shadowed by the editor buffer, with no command able to
    // reveal the built executable existed.
    const compiled = ctx.executables.get(name);
    const isEditorProgram = name === "program" && compiled === undefined;
    if (!isEditorProgram && compiled === undefined) {
      return {
        status: "err",
        lines: [`./${name}: no such executable. Build one first: gcc <file.s> -o ${name}`],
      };
    }
    let stdin: string | undefined;
    if (stdinFrom) {
      const body = await ctx.readVfs(stdinFrom);
      if (body === undefined) return { status: "err", lines: [`./${name}: ${stdinFrom}: no such file in vfs`] };
      stdin = body;
    }
    const argv = [`./${name}`, ...args];
    // A `> file` capture stays a batch run; everything else streams
    // through the pane when it offers interactive I/O.
    const io = stdoutTo ? undefined : ctx.terminalIO;
    const result = isEditorProgram
      ? await ctx.runProgram(argv, stdin, io)
      : await ctx.runSource(compiled as string, argv, stdin, io);
    if (stdoutTo) ctx.writeVfs(stdoutTo, result.stdout);
    const lines: string[] = [];
    // Strip a single trailing newline before splitting: a normal
    // `printf("...\n")` otherwise renders a spurious blank line.
    if (!stdoutTo && result.stdout) {
      lines.push(...result.stdout.replace(/\n$/, "").split("\n"));
    }
    if (result.stderr) lines.push(...result.stderr.split("\n").map((l) => `stderr: ${l}`));
    if (result.exitCode != null) lines.push(`[exit ${result.exitCode}]`);
    else lines.push("[no exit: the program did not finish]");
    return {
      status: result.exitCode === 0 ? "ok" : "err",
      lines,
      exitCode: result.exitCode ?? undefined,
    };
  }

  if (cmd === "gdb") {
    return runGdb(args, ctx);
  }

  return { status: "err", lines: [`${cmd}: command not found. Type 'help' for the list.`] };
}

async function runGdb(args: string[], ctx: DispatchContext): Promise<DispatchResult> {
  const sub = args[0];
  if (!sub || sub === "help") return { status: "ok", lines: GDB_HELP_LINES };
  if (sub === "n" || sub === "s") {
    await ctx.step();
    return { status: "ok", lines: [] };
  }
  if (sub === "c") {
    await ctx.runUntilBreak();
    return { status: "ok", lines: [] };
  }
  if (sub === "b") {
    const label = args[1];
    if (!label) return { status: "err", lines: ["gdb: b needs a label"] };
    const addr = await ctx.resolveLabel(label);
    if (addr == null) return { status: "err", lines: [`gdb: unknown label '${label}'`] };
    await ctx.setBreakpoint(addr);
    return { status: "ok", lines: [`breakpoint set at ${formatWord64(addr)} (${label})`] };
  }
  if (sub === "p") {
    const operand = args[1];
    if (!operand?.startsWith("$")) return { status: "err", lines: ["gdb: p needs $reg, e.g. p $x0"] };
    const name = operand.slice(1).toLowerCase();
    const v = ctx.readRegister(name);
    if (v == null) return { status: "err", lines: [`gdb: unknown register ${operand}`] };
    return { status: "ok", lines: [`$${name} = ${formatWord64(v)}`] };
  }
  if (sub === "info" && args[1] === "registers") {
    const regs = ctx.readRegisters();
    const lines = Object.entries(regs).map(
      ([name, v]) => `${name.padEnd(4)} ${formatWord64(v)}`,
    );
    return { status: "ok", lines };
  }
  if (sub === "x" || sub.startsWith("x/")) {
    return runGdbExamine(args, ctx);
  }
  if (sub === "bt") {
    const pc = ctx.pcAddress();
    return { status: "ok", lines: [`#0  ${formatWord64(pc)} in <current>`] };
  }
  return { status: "err", lines: [`gdb: unknown subcommand '${sub}'`] };
}

async function runGdbExamine(args: string[], ctx: DispatchContext): Promise<DispatchResult> {
  // Accepts `x/Ni $pc` (N words at PC). Anything else for now is a stub.
  const fmt = args[0];
  const target = args[1];
  if (!target || !target.startsWith("$")) {
    return { status: "err", lines: ["gdb: x needs an address, e.g. x/8i $pc"] };
  }
  const m = fmt.match(/^x\/(\d+)i$/);
  const count = m ? Number(m[1]) : 4;
  // The count is untrusted free text; an absurd one froze the worker for
  // minutes building megabytes of hex lines nobody could read.
  const MAX_EXAMINE_COUNT = 1024;
  if (!Number.isFinite(count) || count > MAX_EXAMINE_COUNT) {
    return {
      status: "err",
      lines: [`gdb: x/Ni shows at most ${MAX_EXAMINE_COUNT} instructions at a time`],
    };
  }
  const name = target.slice(1).toLowerCase();
  const base = name === "pc" ? ctx.pcAddress() : Number(ctx.readRegister(name) ?? 0n);
  const bytes = await ctx.readMemory(base, count * 4);
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const off = i * 4;
    const word =
      (bytes[off] ?? 0) |
      ((bytes[off + 1] ?? 0) << 8) |
      ((bytes[off + 2] ?? 0) << 16) |
      ((bytes[off + 3] ?? 0) << 24);
    const hex = formatWord32(word);
    lines.push(`${formatWord64(base + off)}  ${hex}`);
  }
  return { status: "ok", lines };
}
