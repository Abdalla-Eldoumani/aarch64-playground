import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCommand, parseCommandLine, type DispatchContext } from "./dispatch";

describe("parseCommandLine", () => {
  it("splits cmd and args on whitespace", () => {
    const r = parseCommandLine("ls /tmp");
    expect(r.cmd).toBe("ls");
    expect(r.args).toEqual(["/tmp"]);
    expect(r.stdinFrom).toBeUndefined();
    expect(r.stdoutTo).toBeUndefined();
  });

  it("respects double quotes in arguments", () => {
    const r = parseCommandLine('echo "hello world"');
    expect(r.cmd).toBe("echo");
    expect(r.args).toEqual(["hello world"]);
  });

  it("captures `< file` as stdinFrom", () => {
    const r = parseCommandLine("./prog arg1 < input.txt");
    expect(r.cmd).toBe("./prog");
    expect(r.args).toEqual(["arg1"]);
    expect(r.stdinFrom).toBe("input.txt");
  });

  it("captures `> file` as stdoutTo", () => {
    const r = parseCommandLine("./prog > output.txt");
    expect(r.cmd).toBe("./prog");
    expect(r.args).toEqual([]);
    expect(r.stdoutTo).toBe("output.txt");
  });

  it("captures both redirections in either order", () => {
    const r1 = parseCommandLine("./p < in.txt > out.txt");
    expect(r1.stdinFrom).toBe("in.txt");
    expect(r1.stdoutTo).toBe("out.txt");
    const r2 = parseCommandLine("./p > out.txt < in.txt");
    expect(r2.stdinFrom).toBe("in.txt");
    expect(r2.stdoutTo).toBe("out.txt");
  });

  it("returns empty cmd for whitespace-only input", () => {
    expect(parseCommandLine("").cmd).toBe("");
    expect(parseCommandLine("   ").cmd).toBe("");
  });
});

afterEach(() => vi.restoreAllMocks());

function makeCtx(over: Partial<DispatchContext> = {}): DispatchContext {
  return {
    vfs: new Map<string, string>(),
    listVfs: () => [],
    readVfs: (_p: string) => undefined,
    writeVfs: (_p: string, _b: string) => {},
    deleteVfs: (_p: string) => false,
    runProgram: async (_args, _stdin) => ({ stdout: "", stderr: "", exitCode: 0 }),
    step: async () => ({ halted: false, line: null }),
    runUntilBreak: async () => ({ halted: true, hit_breakpoint: false }),
    setBreakpoint: async (_addr) => {},
    clearBreakpoint: async (_addr) => {},
    resolveLabel: (_label) => null,
    readRegister: (_name) => null,
    readRegisters: () => ({}),
    readMemory: async (_addr, _len) => new Uint8Array(),
    pcAddress: () => 0x400000,
    reset: async () => {},
    ...over,
  };
}

describe("dispatchCommand", () => {
  it("clear emits a special CLEAR control marker", async () => {
    const r = await dispatchCommand("clear", makeCtx());
    expect(r.status).toBe("ok");
    expect(r.control).toBe("clear");
  });

  it("ls lists VFS files alphabetically", async () => {
    const ctx = makeCtx({ listVfs: () => ["b.txt", "a.txt"] });
    const r = await dispatchCommand("ls", ctx);
    expect(r.status).toBe("ok");
    expect(r.lines).toEqual(["a.txt", "b.txt"]);
  });

  it("ls -l reports each file with a byte count", async () => {
    const ctx = makeCtx({
      listVfs: () => ["a.txt", "b.txt"],
      readVfs: (p) => (p === "a.txt" ? "hello" : "hi"),
    });
    const r = await dispatchCommand("ls -l", ctx);
    expect(r.status).toBe("ok");
    expect(r.lines.join("\n")).toContain("5 bytes  a.txt");
    expect(r.lines.join("\n")).toContain("2 bytes  b.txt");
  });

  it("cat prints the file body", async () => {
    const ctx = makeCtx({ readVfs: (p) => (p === "a.txt" ? "hello\nworld" : undefined) });
    const r = await dispatchCommand("cat a.txt", ctx);
    expect(r.status).toBe("ok");
    expect(r.lines.join("\n")).toBe("hello\nworld");
  });

  it("cat reports a missing file as an error", async () => {
    const r = await dispatchCommand("cat nope.txt", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines.join("\n").toLowerCase()).toContain("no such file");
  });

  it("cp copies a file in the VFS", async () => {
    let dst = "";
    const ctx = makeCtx({
      readVfs: (p) => (p === "src.txt" ? "payload" : undefined),
      writeVfs: (p, body) => {
        if (p === "dst.txt") dst = body;
      },
    });
    const r = await dispatchCommand("cp src.txt dst.txt", ctx);
    expect(r.status).toBe("ok");
    expect(dst).toBe("payload");
  });

  it("rm removes a file", async () => {
    const removed: string[] = [];
    const ctx = makeCtx({
      deleteVfs: (p) => {
        removed.push(p);
        return true;
      },
    });
    const r = await dispatchCommand("rm a.txt", ctx);
    expect(r.status).toBe("ok");
    expect(removed).toEqual(["a.txt"]);
  });

  it("mv renames a file by copy + delete", async () => {
    const writes: Array<[string, string]> = [];
    const removed: string[] = [];
    const ctx = makeCtx({
      readVfs: (p) => (p === "old.txt" ? "body" : undefined),
      writeVfs: (p, b) => writes.push([p, b]),
      deleteVfs: (p) => {
        removed.push(p);
        return true;
      },
    });
    const r = await dispatchCommand("mv old.txt new.txt", ctx);
    expect(r.status).toBe("ok");
    expect(writes).toEqual([["new.txt", "body"]]);
    expect(removed).toEqual(["old.txt"]);
  });

  it("./program runs the loaded program with args", async () => {
    let received: string[] = [];
    const ctx = makeCtx({
      runProgram: async (args) => {
        received = args;
        return { stdout: "out", stderr: "", exitCode: 0 };
      },
    });
    const r = await dispatchCommand("./program hello world", ctx);
    expect(r.status).toBe("ok");
    expect(received).toEqual(["./program", "hello", "world"]);
    expect(r.lines.join("\n")).toContain("out");
  });

  it("./program < file reads stdin from the VFS file", async () => {
    let stdinSeen = "";
    const ctx = makeCtx({
      readVfs: (p) => (p === "input.txt" ? "abc\n" : undefined),
      runProgram: async (_args, stdin) => {
        stdinSeen = stdin ?? "";
        return { stdout: "ok", stderr: "", exitCode: 0 };
      },
    });
    const r = await dispatchCommand("./program < input.txt", ctx);
    expect(r.status).toBe("ok");
    expect(stdinSeen).toBe("abc\n");
  });

  it("./program > file writes stdout to the VFS file", async () => {
    let written: [string, string] | null = null;
    const ctx = makeCtx({
      writeVfs: (p, b) => {
        written = [p, b];
      },
      runProgram: async () => ({ stdout: "captured", stderr: "", exitCode: 0 }),
    });
    const r = await dispatchCommand("./program > out.txt", ctx);
    expect(r.status).toBe("ok");
    expect(written).toEqual(["out.txt", "captured"]);
  });

  it("help returns the command list", async () => {
    const r = await dispatchCommand("help", makeCtx());
    expect(r.status).toBe("ok");
    const text = r.lines.join("\n").toLowerCase();
    expect(text).toContain("ls");
    expect(text).toContain("cat");
    expect(text).toContain("./program");
  });

  it("unknown commands report 'command not found'", async () => {
    const r = await dispatchCommand("xyz", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines.join("\n").toLowerCase()).toContain("not found");
  });

  it("reset calls the reset hook", async () => {
    let called = false;
    const ctx = makeCtx({ reset: async () => { called = true; } });
    const r = await dispatchCommand("reset", ctx);
    expect(r.status).toBe("ok");
    expect(called).toBe(true);
  });

  it("gdb b <label> sets a breakpoint at the resolved address", async () => {
    const set: number[] = [];
    const ctx = makeCtx({
      resolveLabel: (l) => (l === "main" ? 0x400044 : null),
      setBreakpoint: async (addr) => { set.push(addr); },
    });
    const r = await dispatchCommand("gdb b main", ctx);
    expect(r.status).toBe("ok");
    expect(set).toEqual([0x400044]);
  });

  it("gdb p $x0 prints the register value in hex", async () => {
    const ctx = makeCtx({ readRegister: (n) => (n === "x0" ? 42n : null) });
    const r = await dispatchCommand("gdb p $x0", ctx);
    expect(r.status).toBe("ok");
    expect(r.lines.join("\n")).toContain("0x000000000000002a");
  });

  it("gdb info registers prints all gpr/sp/pc", async () => {
    const ctx = makeCtx({
      readRegisters: () => ({
        x0: 0x1n,
        x1: 0x2n,
        sp: 0x80000000n,
        pc: 0x400000n,
      }),
    });
    const r = await dispatchCommand("gdb info registers", ctx);
    expect(r.status).toBe("ok");
    const text = r.lines.join("\n");
    expect(text).toContain("x0");
    expect(text).toContain("0x0000000000000001");
    expect(text).toContain("sp");
    expect(text).toContain("pc");
  });

  it("gdb n / s steps once", async () => {
    let steps = 0;
    const ctx = makeCtx({
      step: async () => { steps += 1; return { halted: false, line: 42 }; },
    });
    await dispatchCommand("gdb n", ctx);
    await dispatchCommand("gdb s", ctx);
    expect(steps).toBe(2);
  });

  it("gdb c continues until halt", async () => {
    let ran = false;
    const ctx = makeCtx({
      runUntilBreak: async () => { ran = true; return { halted: true, hit_breakpoint: false }; },
    });
    const r = await dispatchCommand("gdb c", ctx);
    expect(r.status).toBe("ok");
    expect(ran).toBe(true);
  });
});
