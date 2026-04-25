import { parseArgs } from "@/lib/args";

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
 * `<file` and `>file` redirections. Re-uses `parseArgs` for quoting so
 * the terminal honors the same rules as the args input above the editor.
 */
export function parseCommandLine(line: string): ParsedCommandLine {
  const trimmed = line.trim();
  if (!trimmed) return { cmd: "", args: [] };
  const tokens = parseArgs(trimmed);
  let stdinFrom: string | undefined;
  let stdoutTo: string | undefined;
  const remaining: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "<" && i + 1 < tokens.length) {
      stdinFrom = tokens[i + 1];
      i += 1;
      continue;
    }
    if (t === ">" && i + 1 < tokens.length) {
      stdoutTo = tokens[i + 1];
      i += 1;
      continue;
    }
    remaining.push(t);
  }
  const [cmd = "", ...args] = remaining;
  return { cmd, args, stdinFrom, stdoutTo };
}

/**
 * Hooks the terminal needs from the surrounding playground -- VFS, the
 * emulator backend, register reads, and a label resolver. Tests pass in
 * stubbed implementations; the production wiring sits in TerminalPane.
 */
export interface DispatchContext {
  /** Lower-level VFS handle (rare; helpers below are usually enough). */
  vfs: Map<string, string>;
  listVfs(): string[];
  readVfs(path: string): string | undefined;
  writeVfs(path: string, body: string): void;
  deleteVfs(path: string): boolean;
  /** Run the currently-loaded program with argv and optional stdin. */
  runProgram(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  step(): Promise<{ halted: boolean; line: number | null }>;
  runUntilBreak(): Promise<{ halted: boolean; hit_breakpoint: boolean }>;
  setBreakpoint(addr: number): Promise<void>;
  clearBreakpoint(addr: number): Promise<void>;
  /** Look up a label's runtime address. Returns null when unresolved. */
  resolveLabel(label: string): number | null;
  /** Read a single register by name (`x0`..`x30`, `sp`, `pc`). */
  readRegister(name: string): bigint | null;
  /** Read every register the gdb `info registers` block should print. */
  readRegisters(): Record<string, bigint>;
  readMemory(addr: number, len: number): Promise<Uint8Array>;
  pcAddress(): number;
  reset(): Promise<void>;
}

const HELP_LINES = [
  "available commands:",
  "  ./program [args]                  run the currently-loaded program",
  "  ./program < file                  feed stdin from a VFS file",
  "  ./program > file                  capture stdout into a VFS file",
  "  cat <file>                        print a VFS file",
  "  ls                                list VFS files",
  "  ls -l                             list VFS files with byte counts",
  "  cp <src> <dst>                    copy a VFS file",
  "  rm <file>                         remove a VFS file",
  "  mv <old> <new>                    rename a VFS file",
  "  upload                            opens the host file picker (TerminalPane handles this)",
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

function hex16(n: bigint): string {
  const sign = n < 0n ? -n : n;
  return "0x" + sign.toString(16).padStart(16, "0");
}

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
    return {
      status: "ok",
      lines: names.map((n) => {
        const body = ctx.readVfs(n) ?? "";
        return `${String(body.length).padStart(6)} bytes  ${n}`;
      }),
    };
  }
  if (cmd === "cat") {
    const target = args[0];
    if (!target) return { status: "err", lines: ["cat: missing operand"] };
    const body = ctx.readVfs(target);
    if (body === undefined) return { status: "err", lines: [`cat: ${target}: no such file in vfs`] };
    return { status: "ok", lines: body.split("\n") };
  }
  if (cmd === "cp") {
    const [src, dst] = args;
    if (!src || !dst) return { status: "err", lines: ["cp: usage: cp <src> <dst>"] };
    const body = ctx.readVfs(src);
    if (body === undefined) return { status: "err", lines: [`cp: ${src}: no such file in vfs`] };
    ctx.writeVfs(dst, body);
    return { status: "ok", lines: [] };
  }
  if (cmd === "rm") {
    const target = args[0];
    if (!target) return { status: "err", lines: ["rm: missing operand"] };
    const ok = ctx.deleteVfs(target);
    if (!ok) return { status: "err", lines: [`rm: ${target}: no such file in vfs`] };
    return { status: "ok", lines: [] };
  }
  if (cmd === "mv") {
    const [src, dst] = args;
    if (!src || !dst) return { status: "err", lines: ["mv: usage: mv <old> <new>"] };
    const body = ctx.readVfs(src);
    if (body === undefined) return { status: "err", lines: [`mv: ${src}: no such file in vfs`] };
    ctx.writeVfs(dst, body);
    ctx.deleteVfs(src);
    return { status: "ok", lines: [] };
  }
  if (cmd === "reset") {
    await ctx.reset();
    return { status: "ok", lines: ["reset complete"] };
  }
  if (cmd === "upload") {
    return { status: "ok", lines: ["upload: launching host file picker..."], control: undefined };
  }
  if (cmd === "./program" || cmd === "program") {
    let stdin: string | undefined;
    if (stdinFrom) {
      const body = ctx.readVfs(stdinFrom);
      if (body === undefined) return { status: "err", lines: [`./program: ${stdinFrom}: no such file in vfs`] };
      stdin = body;
    }
    const argv = ["./program", ...args];
    const result = await ctx.runProgram(argv, stdin);
    if (stdoutTo) ctx.writeVfs(stdoutTo, result.stdout);
    const lines: string[] = [];
    if (!stdoutTo && result.stdout) lines.push(...result.stdout.split("\n"));
    if (result.stderr) lines.push(...result.stderr.split("\n").map((l) => `stderr: ${l}`));
    if (result.exitCode != null) lines.push(`[exit ${result.exitCode}]`);
    return { status: result.exitCode === 0 ? "ok" : "err", lines, exitCode: result.exitCode };
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
    const addr = ctx.resolveLabel(label);
    if (addr == null) return { status: "err", lines: [`gdb: unknown label '${label}'`] };
    await ctx.setBreakpoint(addr);
    return { status: "ok", lines: [`breakpoint set at ${hex16(BigInt(addr))} (${label})`] };
  }
  if (sub === "p") {
    const operand = args[1];
    if (!operand?.startsWith("$")) return { status: "err", lines: ["gdb: p needs $reg, e.g. p $x0"] };
    const name = operand.slice(1).toLowerCase();
    const v = ctx.readRegister(name);
    if (v == null) return { status: "err", lines: [`gdb: unknown register ${operand}`] };
    return { status: "ok", lines: [`$${name} = ${hex16(v)}`] };
  }
  if (sub === "info" && args[1] === "registers") {
    const regs = ctx.readRegisters();
    const lines = Object.entries(regs).map(([name, v]) => `${name.padEnd(4)} ${hex16(v)}`);
    return { status: "ok", lines };
  }
  if (sub === "x" || sub.startsWith("x/")) {
    return runGdbExamine(args, ctx);
  }
  if (sub === "bt") {
    const pc = ctx.pcAddress();
    return { status: "ok", lines: [`#0  ${hex16(BigInt(pc))} in <current>`] };
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
    const hex = "0x" + (word >>> 0).toString(16).padStart(8, "0");
    lines.push(`${hex16(BigInt(base + off))}  ${hex}`);
  }
  return { status: "ok", lines };
}
