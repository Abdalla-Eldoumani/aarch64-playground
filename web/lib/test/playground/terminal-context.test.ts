// The shell's view of the machine: what `./program`, `gcc`, and gdb-lite
// actually do to the hub. The contracts pinned here are the ones the module's
// comments name: argv[0] belongs to the emulator, the home directory is
// re-seeded after every tool assemble, output is reported as the DELTA over
// the editor's scrollback, a `< file` redirect gets the same stdin cap as
// every other ingress, and a run waits for the machine to actually stop.
import { describe, expect, it, vi } from "vitest";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";
import type { EmulatorState } from "@/lib/emulator/use-emulator";
import {
  createTerminalContext,
  type TerminalContextDeps,
} from "@/lib/playground/terminal-context";
import { MAX_STDIN_BYTES } from "@/lib/playground/upload-guard";

const SOURCE = "        mov x0, 1\n        ret\n";

function setup(
  hubOverrides: Partial<EmulatorState> = {},
  depOverrides: Partial<TerminalContextDeps> = {},
) {
  const hub = makeHub(hubOverrides);
  const deps: TerminalContextDeps = {
    machine: { current: hub },
    combinedSource: () => SOURCE,
    applySeeds: vi.fn(),
    stageVfsFile: vi.fn(),
    removeVfsFile: vi.fn(async () => true),
    driveForeground: vi.fn(async () => 0),
    executables: new Map<string, string>(),
    ...depOverrides,
  };
  return { hub, deps, ctx: createTerminalContext(deps) };
}

/** Give the hub a run that starts, then stops one macrotask later with the
 *  output a real program would have produced. The wait loop sleeps before it
 *  reads, so the stop always lands inside the first poll. */
function haltsWith(
  hub: EmulatorState,
  after: { stdout?: string; stderr?: string; exitCode?: number | null },
): void {
  hub.run = vi.fn(() => {
    hub.isRunning = true;
    setTimeout(() => {
      hub.isRunning = false;
      hub.isHalted = true;
      if (after.stdout !== undefined) hub.stdout = after.stdout;
      if (after.stderr !== undefined) hub.stderr = after.stderr;
      if (after.exitCode !== undefined) hub.exitCode = after.exitCode;
    }, 0);
  });
}

function failedAssemble(error: string | null, errorLine: number | null) {
  return vi.fn(async () => ({ success: false, error, errorLine }));
}

describe("running a program", () => {
  it("assembles the live workspace and hands the emulator argv[1..] only", async () => {
    const { hub, deps, ctx } = setup();
    haltsWith(hub, { exitCode: 0 });
    await ctx.runProgram(["./program", "5", "7"]);
    // The emulator owns argv[0]; passing the whole array doubled the name.
    expect(hub.assembleForTool).toHaveBeenCalledWith(SOURCE, ["5", "7"]);
    expect(deps.applySeeds).toHaveBeenCalledTimes(1);
    expect(hub.run).toHaveBeenCalledTimes(1);
  });

  it("reports only this program's output, as the delta over the editor's scrollback", async () => {
    const { hub, ctx } = setup({ stdout: "editor session\n", stderr: "old warning\n" });
    haltsWith(hub, {
      stdout: "editor session\nsum = 12\n",
      stderr: "old warning\nnew warning\n",
      exitCode: 0,
    });
    const result = await ctx.runProgram(["./program"]);
    expect(result.stdout).toBe("sum = 12\n");
    expect(result.stderr).toBe("new warning\n");
    expect(result.exitCode).toBe(0);
  });

  it("reports the whole buffer when the scrollback no longer prefixes it", async () => {
    // A clear (or a trim of the 256 KB console cap) mid-run means the new
    // buffer is not an extension of the old one; the delta cannot be a slice.
    const { hub, ctx } = setup({ stdout: "before\n" });
    haltsWith(hub, { stdout: "fresh output\n", exitCode: 0 });
    expect((await ctx.runProgram(["./program"])).stdout).toBe("fresh output\n");
  });

  it("says a program never exited rather than inventing an exit 0", async () => {
    const { hub, ctx } = setup();
    haltsWith(hub, { exitCode: null });
    expect((await ctx.runProgram(["./program"])).exitCode).toBeNull();
  });

  it("waits for the run to stop before reading the result", async () => {
    const { hub, ctx } = setup();
    // Three polls' worth of running: the pre-run isRunning=false must not be
    // read as "already finished".
    hub.run = vi.fn(() => {
      hub.isRunning = true;
      setTimeout(() => {
        hub.isRunning = false;
        hub.stdout = "done\n";
        hub.exitCode = 0;
      }, 60);
    });
    const result = await ctx.runProgram(["./program"]);
    expect(result.stdout).toBe("done\n");
    expect(result.exitCode).toBe(0);
  });

  it("runs the text it is given, not the editor's buffer, through runSource", async () => {
    const { hub, ctx } = setup();
    haltsWith(hub, { exitCode: 0 });
    await ctx.runSource("        mov x0, 9\n", ["./other"]);
    expect(hub.assembleForTool).toHaveBeenCalledWith("        mov x0, 9\n", []);
  });
});

describe("a failed tool assemble", () => {
  it("carries the verdict's error out with its line, and never runs", async () => {
    const { hub, deps, ctx } = setup();
    hub.assembleForTool = failedAssemble("unknown mnemonic `mvo`", 3);
    const result = await ctx.runProgram(["./program"]);
    expect(result.stderr).toBe("line 3: unknown mnemonic `mvo`");
    expect(result.exitCode).toBeNull();
    expect(hub.run).not.toHaveBeenCalled();
    // The assemble wiped the machine, home directory included: it goes back
    // whatever the outcome, or `ls` right after a failed build is empty.
    expect(deps.applySeeds).toHaveBeenCalledTimes(1);
  });

  it("drops the line prefix when the verdict has no line", async () => {
    const { hub, ctx } = setup();
    hub.assembleForTool = failedAssemble("no main symbol", null);
    expect((await ctx.runProgram(["./program"])).stderr).toBe("no main symbol");
  });

  it("keeps the machine's own stderr delta when the verdict carries no message", async () => {
    const { hub, ctx } = setup({ stderr: "old\n" });
    hub.assembleForTool = vi.fn(async () => {
      hub.stderr = "old\nassembler said something\n";
      return { success: false, error: null, errorLine: null };
    });
    expect((await ctx.runProgram(["./program"])).stderr).toBe(
      "assembler said something\n",
    );
  });
});

describe("a `< file` redirect", () => {
  it("pushes the input and closes stdin behind it", async () => {
    const { hub, ctx } = setup();
    haltsWith(hub, { exitCode: 0 });
    await ctx.runProgram(["./program"], "12 34\n");
    expect(hub.pushStdin).toHaveBeenCalledWith("12 34\n");
    // Closing is what lets a read-until-EOF loop finish, exactly like
    // `./prog < file` on the course shell.
    expect(hub.closeStdin).toHaveBeenCalledTimes(1);
  });

  it("leaves stdin open when the command has no redirect", async () => {
    const { hub, ctx } = setup();
    haltsWith(hub, { exitCode: 0 });
    await ctx.runProgram(["./program"]);
    expect(hub.pushStdin).not.toHaveBeenCalled();
    expect(hub.closeStdin).not.toHaveBeenCalled();
  });

  it("refuses an over-cap redirect instead of handing the machine the whole file", async () => {
    const { hub, ctx } = setup();
    haltsWith(hub, { exitCode: 0 });
    const result = await ctx.runProgram(["./program"], "x".repeat(MAX_STDIN_BYTES + 1));
    expect(result).toEqual({
      stdout: "",
      stderr: "stdin too large: the limit is 100 KiB",
      exitCode: null,
    });
    expect(hub.pushStdin).not.toHaveBeenCalled();
    expect(hub.run).not.toHaveBeenCalled();
  });

  it("accepts a redirect exactly at the cap", async () => {
    const { hub, ctx } = setup();
    haltsWith(hub, { exitCode: 0 });
    const atCap = "x".repeat(MAX_STDIN_BYTES);
    const result = await ctx.runProgram(["./program"], atCap);
    expect(result.stderr).toBe("");
    expect(hub.pushStdin).toHaveBeenCalledWith(atCap);
  });
});

describe("an interactive `./name` run", () => {
  it("hands the session to the shared foreground drive and prints nothing itself", async () => {
    const io = { write: vi.fn(), setForeground: vi.fn() };
    const drive = vi.fn(async () => 3);
    const { hub, ctx } = setup({ stderr: "before\n" }, { driveForeground: drive });
    hub.assembleForTool = vi.fn(async () => {
      hub.stderr = "before\nlate warning\n";
      return { success: true, error: null, errorLine: null };
    });
    const result = await ctx.runProgram(["./program"], undefined, io as never);
    expect(drive).toHaveBeenCalledWith(io);
    // The drive streams output through the tap; nothing is left to print.
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("late warning\n");
    expect(result.exitCode).toBe(3);
    // The drive owns the run; the wait loop never starts one of its own.
    expect(hub.run).not.toHaveBeenCalled();
  });
});

describe("the VFS surface", () => {
  it("lists the machine's files sorted, without reordering the hub's array", async () => {
    const { hub, ctx } = setup({ vfsFiles: ["notes.txt", "a.s", "m.dat"] });
    expect(ctx.listVfs()).toEqual(["a.s", "m.dat", "notes.txt"]);
    expect(hub.vfsFiles).toEqual(["notes.txt", "a.s", "m.dat"]);
  });

  it("decodes a file's bytes", async () => {
    const { hub, ctx } = setup({ vfsFiles: ["notes.txt"] });
    hub.readVfsFile = vi.fn(async () => new TextEncoder().encode("keep me\n"));
    expect(await ctx.readVfs("notes.txt")).toBe("keep me\n");
  });

  it("tells an empty file apart from a missing one", async () => {
    const { hub, ctx } = setup({ vfsFiles: ["empty.txt"] });
    hub.readVfsFile = vi.fn(async () => new Uint8Array());
    expect(await ctx.readVfs("empty.txt")).toBe("");
    expect(await ctx.readVfs("gone.txt")).toBeUndefined();
  });

  it("routes writes and deletes through the playground's staged paths", async () => {
    const remove = vi.fn(async () => false);
    const { deps, ctx } = setup({}, { removeVfsFile: remove });
    ctx.writeVfs("lab5.s", "mov x0, 0\n");
    expect(deps.stageVfsFile).toHaveBeenCalledWith("lab5.s", "mov x0, 0\n");
    expect(await ctx.deleteVfs("lab5.s")).toBe(false);
    expect(remove).toHaveBeenCalledWith("lab5.s");
  });
});

describe("gdb-lite's reads", () => {
  it("steps and reports where the machine stopped", async () => {
    const { hub, ctx } = setup({ currentLine: 12 });
    hub.step = vi.fn(() => {
      hub.isHalted = true;
      hub.currentLine = 13;
    });
    expect(await ctx.step()).toEqual({ halted: true, line: 13 });
  });

  it("continues until the machine stops running", async () => {
    const { hub, ctx } = setup();
    haltsWith(hub, { exitCode: 0 });
    expect(await ctx.runUntilBreak()).toEqual({ halted: true, hit_breakpoint: false });
  });

  it("reads sp, pc, and a numbered register", () => {
    const registers = Array(31).fill("0x0000000000000000");
    registers[3] = "0x123456789abcdef0";
    const { ctx } = setup({ registers, sp: "0x0000000080000000", pc: 0x400010 });
    expect(ctx.readRegister("sp")).toBe(0x80000000n);
    expect(ctx.readRegister("pc")).toBe(0x400010n);
    expect(ctx.readRegister("x3")).toBe(0x123456789abcdef0n);
    // A `wN` name is the low 32 bits of the same register, not a register of
    // its own.
    expect(ctx.readRegister("w3")).toBe(0x9abcdef0n);
    expect(ctx.readRegister("X3")).toBe(0x123456789abcdef0n);
  });

  it("refuses a name that is not a register", () => {
    const { ctx } = setup();
    expect(ctx.readRegister("x31")).toBeNull();
    expect(ctx.readRegister("x99")).toBeNull();
    expect(ctx.readRegister("fp")).toBeNull();
    expect(ctx.readRegister("banana")).toBeNull();
  });

  it("dumps every register plus sp and pc", () => {
    const registers = Array(31).fill("0x0000000000000000");
    registers[0] = "0x2a";
    const { ctx } = setup({ registers, pc: 0x400000 });
    const all = ctx.readRegisters();
    expect(all.x0).toBe(42n);
    expect(all.x30).toBe(0n);
    expect(all.x31).toBeUndefined();
    expect(all.sp).toBe(0x80000000n);
    expect(all.pc).toBe(0x400000n);
  });

  it("delegates the machine reads it does not interpret", async () => {
    const { hub, ctx } = setup({ pc: 0x400020 });
    hub.getMemory = vi.fn(() => new Uint8Array([1, 2]));
    hub.resolveLabel = vi.fn(async () => 0x420000);
    await ctx.setBreakpoint(0x400010);
    await ctx.clearBreakpoint(0x400010);
    await ctx.reset();
    expect(hub.setBreakpointAddress).toHaveBeenCalledWith(0x400010);
    expect(hub.clearBreakpointAddress).toHaveBeenCalledWith(0x400010);
    expect(hub.reset).toHaveBeenCalledTimes(1);
    expect(await ctx.resolveLabel("main")).toBe(0x420000);
    expect(await ctx.readMemory(0x400000, 2)).toEqual(new Uint8Array([1, 2]));
    expect(ctx.pcAddress()).toBe(0x400020);
    await ctx.m4Expand("define(`N', 4)");
    expect(hub.m4Expand).toHaveBeenCalledWith("define(`N', 4)");
  });
});

describe("gcc's assemble channel", () => {
  it("reports success with no errors and re-seeds the home directory", async () => {
    const { deps, ctx } = setup();
    expect(await ctx.assembleSource(SOURCE)).toEqual({ success: true, errors: [] });
    expect(deps.applySeeds).toHaveBeenCalledTimes(1);
  });

  it("reports a failure with its line, and still re-seeds", async () => {
    const { hub, deps, ctx } = setup();
    hub.assembleForTool = failedAssemble("expected register", 7);
    expect(await ctx.assembleSource("bad")).toEqual({
      success: false,
      errors: ["line 7: expected register"],
    });
    expect(deps.applySeeds).toHaveBeenCalledTimes(1);
  });

  it("returns an empty error list when the verdict carries no message", async () => {
    const { hub, ctx } = setup();
    hub.assembleForTool = failedAssemble(null, null);
    expect(await ctx.assembleSource("bad")).toEqual({ success: false, errors: [] });
  });
});

describe("the context itself", () => {
  it("starts with an empty scratch vfs and shares the caller's executables map", () => {
    const executables = new Map<string, string>([["prog", SOURCE]]);
    const { deps, ctx } = setup({}, { executables });
    expect(ctx.vfs.size).toBe(0);
    // `gcc -o name` writes this registry and `./name` reads it, so it has to
    // outlive every per-snapshot context rebuild.
    expect(ctx.executables).toBe(executables);
    expect(createTerminalContext(deps).executables).toBe(executables);
  });

  it("reads through the ref, so a rebuilt hub is visible to an old context", async () => {
    const hub = makeHub({ pc: 0x400000 });
    const machine = { current: hub };
    const ctx = createTerminalContext({
      machine,
      combinedSource: () => SOURCE,
      applySeeds: vi.fn(),
      stageVfsFile: vi.fn(),
      removeVfsFile: vi.fn(async () => true),
      driveForeground: vi.fn(async () => null),
      executables: new Map<string, string>(),
    });
    machine.current = makeHub({ pc: 0x400040 });
    expect(ctx.pcAddress()).toBe(0x400040);
  });
});
