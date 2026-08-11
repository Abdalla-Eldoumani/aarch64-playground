import type { RefObject } from "react";
import type { EmulatorState } from "@/lib/emulator/use-emulator";
import type { DispatchContext, TerminalProgramIO } from "@/lib/terminal/dispatch";
import { validateStdin } from "@/lib/playground/upload-guard";

export type TerminalContextDeps = {
  /** The hub as a ref, never the render's object: the hub is new after every
   *  snapshot, so a closure over it freezes mid-command state -- the wait
   *  loop below would poll an isRunning that can never change and report the
   *  pre-run stdout and exit code. */
  machine: RefObject<EmulatorState>;
  /** The editor's live workspace as the one string the assembler sees. */
  combinedSource: () => string;
  /** Put the home directory back after a tool assemble wipes the machine. */
  applySeeds: () => void;
  /** The playground's working-set write paths, so a terminal redirect or an
   *  `rm` lands in the same persisted map an upload does. */
  stageVfsFile: (path: string, body: string) => void;
  removeVfsFile: (path: string) => Promise<boolean>;
  /** The shared foreground drive, for an interactive `./name` run. */
  driveForeground: (io: TerminalProgramIO) => Promise<number | null>;
  /** `gcc -o name` writes this registry and `./name` reads it; it outlives
   *  every per-snapshot context rebuild. */
  executables: Map<string, string>;
};

/**
 * The shell's view of the machine: the VFS, the course toolchain (m4, gcc,
 * `./name`), gdb-lite's stepping and register reads, and the editor's own
 * program behind `./program`.
 *
 * Rebuilt on demand rather than held, and every read goes through the deps'
 * refs, so the context is a thin adapter with no state of its own and the
 * terminal pane never re-initializes underneath an open session.
 */
export function createTerminalContext(deps: TerminalContextDeps): DispatchContext {
  const { machine, applySeeds, driveForeground } = deps;
  const dec = new TextDecoder();
  // One wait loop for every terminal-run shape: sleep BEFORE checking so
  // React has committed run()'s isRunning=true into the ref (see the
  // comment on the original runProgram).
  const waitForHalt = async () => {
    const startedAt = Date.now();
    do {
      await new Promise<void>((r) => setTimeout(r, 16));
    } while (machine.current.isRunning && Date.now() - startedAt < 10_000);
  };
  const runText = async (
    text: string,
    args: string[],
    stdin?: string,
    io?: TerminalProgramIO,
  ) => {
    // The tool assemble deliberately leaves the editor's console
    // scrollback alone, so the hub's stdout/stderr still hold whatever the
    // student was reading. Report this program's output as the DELTA over
    // that, or the terminal would replay the editor's session back at them.
    const priorOut = machine.current.stdout;
    const priorErr = machine.current.stderr;
    const since = (now: string, before: string) =>
      now.startsWith(before) ? now.slice(before.length) : now;
    // Tool-channel assemble: the terminal's program must not paint the
    // editor's error markers, and the verdict comes back directly. The
    // assemble wiped the machine, home directory included, so put the
    // working set back whatever the outcome.
    // args[0] is the `./name` the terminal displays; the emulator owns
    // argv[0] and re-adds it, so only argv[1..] goes through. Passing
    // the whole array would double the program name.
    const verdict = await machine.current.assembleForTool(text, args.slice(1));
    applySeeds();
    if (!verdict.success) {
      // The verdict is the only carrier of the assemble error here;
      // dropping it left the student with a bare "[no exit]" line.
      const e = machine.current;
      const detail = verdict.error
        ? verdict.errorLine != null
          ? `line ${verdict.errorLine}: ${verdict.error}`
          : verdict.error
        : "";
      return {
        stdout: since(e.stdout, priorOut),
        stderr: [since(e.stderr, priorErr), detail].filter(Boolean).join("\n"),
        exitCode: null,
      };
    }
    // Any `< file` stdin goes on top of the reseeded working set. A
    // redirect IS the whole input, so close stdin behind it: that is
    // what lets a read-until-EOF loop finish, exactly like
    // `./prog < file` on the course shell.
    if (stdin !== undefined) {
      // `./prog < bigfile` is one command that can hand the machine the
      // whole 4 MiB VFS cap in a single push; the redirect gets the same
      // bound as every other stdin ingress.
      const oversize = validateStdin(stdin);
      if (oversize) {
        return { stdout: "", stderr: oversize, exitCode: null };
      }
      machine.current.pushStdin(stdin);
      machine.current.closeStdin();
    }
    if (io) {
      // Interactive run: output streams into the pane as it is
      // produced, keystrokes reach stdin while the program lives, and
      // there is no wall-clock cap -- the machine's own step/output
      // walls bound a runaway, and the player owns the exit.
      const exitCode = await driveForeground(io);
      return {
        // Already streamed through the tap; nothing left to print.
        stdout: "",
        stderr: since(machine.current.stderr, priorErr),
        exitCode,
      };
    }
    machine.current.run();
    await waitForHalt();
    const e = machine.current;
    return {
      stdout: since(e.stdout, priorOut),
      stderr: since(e.stderr, priorErr),
      // null means "never exited" (blocked or timed out); the terminal
      // says so instead of inventing an exit 0.
      exitCode: e.exitCode,
    };
  };
  return {
    vfs: new Map<string, string>(),
    listVfs: () => machine.current.vfsFiles.slice().sort(),
    readVfs: async (path: string) => {
      const bytes = await machine.current.readVfsFile(path);
      if (bytes.length === 0 && !machine.current.vfsFiles.includes(path)) {
        return undefined; // distinguish missing from empty
      }
      return dec.decode(bytes);
    },
    writeVfs: (path: string, body: string) => {
      deps.stageVfsFile(path, body);
    },
    deleteVfs: async (path: string) => deps.removeVfsFile(path),
    // The editor's program: the same run shape as a compiled executable,
    // over the live workspace (main plus any extra files, exactly what
    // the assemble button builds).
    runProgram: async (args: string[], stdin?: string, io?: TerminalProgramIO) =>
      runText(deps.combinedSource(), args, stdin, io),
    step: async () => {
      machine.current.step();
      const e = machine.current;
      return { halted: e.isHalted, line: e.currentLine };
    },
    runUntilBreak: async () => {
      machine.current.run();
      const startedAt = Date.now();
      // Same sleep-before-check shape as runProgram: the pre-run
      // isRunning is still false on the first read, and gdb's continue
      // must not resolve while the program is live.
      do {
        await new Promise<void>((r) => setTimeout(r, 16));
      } while (machine.current.isRunning && Date.now() - startedAt < 10_000);
      return { halted: machine.current.isHalted, hit_breakpoint: false };
    },
    setBreakpoint: async (addr: number) => machine.current.setBreakpointAddress(addr),
    clearBreakpoint: async (addr: number) => machine.current.clearBreakpointAddress(addr),
    resolveLabel: async (name: string) => machine.current.resolveLabel(name),
    m4Expand: async (text: string) => machine.current.m4Expand(text),
    assembleSource: async (text: string) => {
      const verdict = await machine.current.assembleForTool(text, []);
      // The gcc assemble wiped the home directory with the rest of the
      // machine; reseed it either way so `ls` right after a build (or
      // a failed one) still shows the student's files.
      applySeeds();
      if (verdict.success) return { success: true, errors: [] };
      const errors = verdict.error
        ? [
            verdict.errorLine != null
              ? `line ${verdict.errorLine}: ${verdict.error}`
              : verdict.error,
          ]
        : [];
      return { success: false, errors };
    },
    runSource: runText,
    executables: deps.executables,
    readRegister: (name: string) => {
      const e = machine.current;
      const lower = name.toLowerCase();
      if (lower === "sp") return BigInt(e.sp);
      if (lower === "pc") return BigInt(e.pc);
      const m = lower.match(/^([xw])(\d+)$/);
      if (!m) return null;
      const idx = Number(m[2]);
      if (idx < 0 || idx > 30) return null;
      const raw = e.registers[idx];
      if (!raw) return null;
      // A `wN` name reads the low 32 bits, not the full 64-bit x register.
      const val = BigInt(raw);
      return m[1] === "w" ? val & 0xffff_ffffn : val;
    },
    readRegisters: () => {
      const e = machine.current;
      const out: Record<string, bigint> = {};
      e.registers.forEach((v, i) => {
        out[`x${i}`] = BigInt(v);
      });
      out.sp = BigInt(e.sp);
      out.pc = BigInt(e.pc);
      return out;
    },
    readMemory: async (addr: number, len: number) => machine.current.getMemory(addr, len),
    pcAddress: () => machine.current.pc,
    reset: async () => machine.current.reset(),
  };
}
