import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCommand, parseCommandLine, type DispatchContext } from "@/lib/terminal/dispatch";

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
    m4Expand: async (source: string) => ({ success: true, text: source }),
    assembleSource: async () => ({ success: true, errors: [] }),
    runSource: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    executables: new Map<string, string>(),
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

describe("the course toolchain", () => {
  it("m4 expands a vfs file to stdout, or into a redirect target", async () => {
    const files = new Map([["calc.asm", "define(a, x19)\nmov a, 4\n"]]);
    const writes: Array<[string, string]> = [];
    const ctx = makeCtx({
      readVfs: (p) => files.get(p),
      writeVfs: (p, b) => void writes.push([p, b]),
      m4Expand: async () => ({ success: true, text: "\nmov x19, 4\n" }),
    });
    const printed = await dispatchCommand("m4 calc.asm", ctx);
    expect(printed.status).toBe("ok");
    expect(printed.lines).toContain("mov x19, 4");

    const redirected = await dispatchCommand("m4 calc.asm > calc.s", ctx);
    expect(redirected.status).toBe("ok");
    expect(redirected.lines).toEqual([]);
    expect(writes).toEqual([["calc.s", "\nmov x19, 4\n"]]);
  });

  it("m4 explains itself when the emulator build predates the export", async () => {
    const ctx = makeCtx({
      readVfs: () => "define(a, x19)\n",
      m4Expand: async () => null,
    });
    const r = await dispatchCommand("m4 calc.asm", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[0]).toMatch(/rebuild the WASM/);
  });

  it("m4 reports expansion errors with the file and line", async () => {
    const ctx = makeCtx({
      readVfs: () => "include(evil)\n",
      m4Expand: async () => ({ success: false, error: "unsupported m4 construct: include", error_line: 1 }),
    });
    const r = await dispatchCommand("m4 calc.asm", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("m4: calc.asm:1: unsupported m4 construct: include");
  });

  it("gcc assembles a .s file into a named executable that ./name runs", async () => {
    const files = new Map([["calc.s", "mov x0, 7\nsvc 0\n"]]);
    const executables = new Map<string, string>();
    const ran: string[] = [];
    const ctx = makeCtx({
      readVfs: (p) => files.get(p),
      executables,
      assembleSource: async () => ({ success: true, errors: [] }),
      runSource: async (source, args) => {
        ran.push(`${args.join(" ")}::${source}`);
        return { stdout: "7\n", stderr: "", exitCode: 0 };
      },
    });
    const build = await dispatchCommand("gcc calc.s -o calc", ctx);
    expect(build.status).toBe("ok");
    expect(build.lines).toEqual([]);
    expect(executables.get("calc")).toBe("mov x0, 7\nsvc 0\n");

    const run = await dispatchCommand("./calc 1 2", ctx);
    expect(run.status).toBe("ok");
    expect(run.lines).toContain("7");
    expect(ran[0].startsWith("./calc 1 2::")).toBe(true);
  });

  it("gcc points a .asm file at the m4 step first, like the course flow", async () => {
    const ctx = makeCtx({ readVfs: () => "define(a, x19)\n" });
    const r = await dispatchCommand("gcc calc.asm -o calc", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[1]).toBe("  m4 calc.asm > calc.s");
  });

  it("gcc surfaces assembler errors gcc-style and registers nothing", async () => {
    const executables = new Map<string, string>();
    const ctx = makeCtx({
      readVfs: () => "movq x0, 7\n",
      executables,
      assembleSource: async () => ({ success: false, errors: ["line 1: unknown mnemonic: MOVQ"] }),
    });
    const r = await dispatchCommand("gcc bad.s -o bad", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("bad.s: line 1: unknown mnemonic: MOVQ");
    expect(executables.size).toBe(0);
  });

  it("gcc defaults the output name to a.out", async () => {
    const executables = new Map<string, string>();
    const ctx = makeCtx({
      readVfs: () => "mov x0, 0\n",
      executables,
      assembleSource: async () => ({ success: true, errors: [] }),
    });
    await dispatchCommand("gcc prog.s", ctx);
    expect(executables.has("a.out")).toBe(true);
  });

  it("running an unbuilt executable explains the gcc step", async () => {
    const r = await dispatchCommand("./ghost", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines[0]).toMatch(/gcc <file\.s> -o ghost/);
  });
});

// A Map-backed VFS context so multi-command chains observe each other's
// writes, the way the real pane does across a session.
function vfsCtx(seed: Record<string, string>, over: Partial<DispatchContext> = {}) {
  const files = new Map(Object.entries(seed));
  const ctx = makeCtx({
    vfs: files,
    listVfs: () => [...files.keys()],
    readVfs: (p) => files.get(p),
    writeVfs: (p, b) => void files.set(p, b),
    deleteVfs: (p) => files.delete(p),
    ...over,
  });
  return { ctx, files };
}

describe("file command chains over one VFS", () => {
  it("cp, mv, rm compose: the copy survives, the original and intermediate do not", async () => {
    const { ctx, files } = vfsCtx({ "a.txt": "payload" });
    expect((await dispatchCommand("cp a.txt b.txt", ctx)).status).toBe("ok");
    expect((await dispatchCommand("mv b.txt c.txt", ctx)).status).toBe("ok");
    expect((await dispatchCommand("rm a.txt", ctx)).status).toBe("ok");
    const ls = await dispatchCommand("ls", ctx);
    expect(ls.lines).toEqual(["c.txt"]);
    expect(files.get("c.txt")).toBe("payload");
    const cat = await dispatchCommand("cat c.txt", ctx);
    expect(cat.lines).toEqual(["payload"]);
  });

  it("cp onto an existing name overwrites it", async () => {
    const { ctx, files } = vfsCtx({ "a.txt": "new", "b.txt": "old" });
    await dispatchCommand("cp a.txt b.txt", ctx);
    expect(files.get("b.txt")).toBe("new");
  });

  it("mv to the same name refuses like the real tool and keeps the file", async () => {
    const { ctx, files } = vfsCtx({ "a.txt": "body" });
    const r = await dispatchCommand("mv a.txt a.txt", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("mv: 'a.txt' and 'a.txt' are the same file");
    expect(files.get("a.txt")).toBe("body");
  });

  it("rm on a missing file reports an error", async () => {
    const { ctx } = vfsCtx({});
    const r = await dispatchCommand("rm ghost.txt", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("rm: ghost.txt: no such file in vfs");
  });

  it("cp, mv, rm, and cat report missing operands as usage errors", async () => {
    const { ctx } = vfsCtx({});
    expect((await dispatchCommand("cp only-src", ctx)).lines[0]).toBe("cp: usage: cp <src> <dst>");
    expect((await dispatchCommand("mv only-old", ctx)).lines[0]).toBe("mv: usage: mv <old> <new>");
    expect((await dispatchCommand("rm", ctx)).lines[0]).toBe("rm: missing operand");
    expect((await dispatchCommand("cat", ctx)).lines[0]).toBe("cat: missing operand");
  });

  it("quoted names carry spaces through the tokenizer", async () => {
    const { ctx, files } = vfsCtx({ "my notes.txt": "spaced" });
    const cat = await dispatchCommand('cat "my notes.txt"', ctx);
    expect(cat.status).toBe("ok");
    expect(cat.lines).toEqual(["spaced"]);
    await dispatchCommand('cp "my notes.txt" "my copy.txt"', ctx);
    expect(files.get("my copy.txt")).toBe("spaced");
  });
});

describe("redirection semantics", () => {
  it("reading and writing the same file overwrites it after the run", async () => {
    const { ctx, files } = vfsCtx(
      { "notes.txt": "before" },
      {
        runProgram: async (_args, stdin) => ({
          stdout: `got:${stdin}`,
          stderr: "",
          exitCode: 0,
        }),
      },
    );
    const r = await dispatchCommand("./program < notes.txt > notes.txt", ctx);
    expect(r.status).toBe("ok");
    // stdin was read before the run, then stdout replaced the file.
    expect(files.get("notes.txt")).toBe("got:before");
    expect(r.lines).toEqual(["[exit 0]"]);
  });

  it("a slash in the target is just a flat VFS name, not a directory", async () => {
    const { ctx, files } = vfsCtx(
      {},
      { runProgram: async () => ({ stdout: "x", stderr: "", exitCode: 0 }) },
    );
    const r = await dispatchCommand("./program > out/run.txt", ctx);
    expect(r.status).toBe("ok");
    expect(files.get("out/run.txt")).toBe("x");
  });

  it("a quoted > stays a literal argument, like a real shell", () => {
    const r = parseCommandLine('cat ">" out.txt');
    expect(r.cmd).toBe("cat");
    expect(r.args).toEqual([">", "out.txt"]);
    expect(r.stdoutTo).toBeUndefined();
  });

  it("an escaped \\> stays literal while a bare > still redirects", () => {
    const r = parseCommandLine("./prog \\> literal > out.txt");
    expect(r.args).toEqual([">", "literal"]);
    expect(r.stdoutTo).toBe("out.txt");
  });

  it("a trailing < or > with no operand stays a positional token", () => {
    const r = parseCommandLine("./prog <");
    expect(r.stdinFrom).toBeUndefined();
    expect(r.args).toEqual(["<"]);
    const r2 = parseCommandLine("./prog >");
    expect(r2.stdoutTo).toBeUndefined();
    expect(r2.args).toEqual([">"]);
  });

  it("stdin redirect from a missing file fails before the program runs", async () => {
    let ran = false;
    const { ctx } = vfsCtx(
      {},
      {
        runProgram: async () => {
          ran = true;
          return { stdout: "", stderr: "", exitCode: 0 };
        },
      },
    );
    const r = await dispatchCommand("./program < ghost.txt", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("./program: ghost.txt: no such file in vfs");
    expect(ran).toBe(false);
  });
});

describe("run result surfacing", () => {
  it("a nonzero exit marks the command failed and prints the exit line", async () => {
    const ctx = makeCtx({
      runProgram: async () => ({ stdout: "partial\n", stderr: "", exitCode: 3 }),
    });
    const r = await dispatchCommand("./program", ctx);
    expect(r.status).toBe("err");
    expect(r.exitCode).toBe(3);
    expect(r.lines[r.lines.length - 1]).toBe("[exit 3]");
  });

  it("stderr lines are prefixed so they read apart from stdout", async () => {
    const ctx = makeCtx({
      runProgram: async () => ({ stdout: "out\n", stderr: "boom", exitCode: 1 }),
    });
    const r = await dispatchCommand("./program", ctx);
    expect(r.lines).toContain("stderr: boom");
  });

  it("an empty command line dispatches to a silent ok", async () => {
    const r = await dispatchCommand("   ", makeCtx());
    expect(r).toEqual({ status: "ok", lines: [] });
  });

  it("upload asks the pane to open the host file picker", async () => {
    const r = await dispatchCommand("upload", makeCtx());
    expect(r.status).toBe("ok");
    expect(r.lines[0]).toBe("upload: launching host file picker...");
  });
});

describe("gdb-lite edges", () => {
  it("gdb p reads $sp and $pc through the register hook", async () => {
    const ctx = makeCtx({
      readRegister: (n) => (n === "sp" ? 0x7ffffff0n : n === "pc" ? 0x400008n : null),
    });
    const sp = await dispatchCommand("gdb p $sp", ctx);
    expect(sp.status).toBe("ok");
    expect(sp.lines).toEqual(["$sp = 0x000000007ffffff0"]);
    const pc = await dispatchCommand("gdb p $pc", ctx);
    expect(pc.lines).toEqual(["$pc = 0x0000000000400008"]);
  });

  it("gdb p uppercases operands are normalized to the lowercase register", async () => {
    const ctx = makeCtx({ readRegister: (n) => (n === "x0" ? 1n : null) });
    const r = await dispatchCommand("gdb p $X0", ctx);
    expect(r.status).toBe("ok");
    expect(r.lines).toEqual(["$x0 = 0x0000000000000001"]);
  });

  it("gdb p without a $ operand explains the syntax", async () => {
    const r = await dispatchCommand("gdb p x0", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("gdb: p needs $reg, e.g. p $x0");
  });

  it("gdb p on an unknown register names it", async () => {
    const r = await dispatchCommand("gdb p $q9", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("gdb: unknown register $q9");
  });

  it("gdb b without a label, and with an unresolvable label, both fail clearly", async () => {
    const noLabel = await dispatchCommand("gdb b", makeCtx());
    expect(noLabel.status).toBe("err");
    expect(noLabel.lines[0]).toBe("gdb: b needs a label");
    const unknown = await dispatchCommand("gdb b nowhere", makeCtx());
    expect(unknown.status).toBe("err");
    expect(unknown.lines[0]).toBe("gdb: unknown label 'nowhere'");
  });

  it("gdb b echoes the resolved address and the label", async () => {
    const ctx = makeCtx({ resolveLabel: (l) => (l === "loop" ? 0x400014 : null) });
    const r = await dispatchCommand("gdb b loop", ctx);
    expect(r.lines).toEqual(["breakpoint set at 0x0000000000400014 (loop)"]);
  });

  it("gdb x/2i $pc prints two little-endian words from memory", async () => {
    // Bytes seeded little-endian: word0 = 0xd2800020, word1 = 0xd65f03c0.
    const ctx = makeCtx({
      pcAddress: () => 0x400000,
      readMemory: async (addr, len) => {
        expect(addr).toBe(0x400000);
        expect(len).toBe(8);
        return new Uint8Array([0x20, 0x00, 0x80, 0xd2, 0xc0, 0x03, 0x5f, 0xd6]);
      },
    });
    const r = await dispatchCommand("gdb x/2i $pc", ctx);
    expect(r.status).toBe("ok");
    expect(r.lines).toEqual([
      "0x0000000000400000  0xd2800020",
      "0x0000000000400004  0xd65f03c0",
    ]);
  });

  it("gdb x without an address operand explains the syntax", async () => {
    const r = await dispatchCommand("gdb x/4i pc", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("gdb: x needs an address, e.g. x/8i $pc");
  });

  it("gdb bt prints a one-frame backtrace at the current pc", async () => {
    const ctx = makeCtx({ pcAddress: () => 0x400010 });
    const r = await dispatchCommand("gdb bt", ctx);
    expect(r.lines).toEqual(["#0  0x0000000000400010 in <current>"]);
  });

  it("gdb rejects an unknown subcommand by name", async () => {
    const r = await dispatchCommand("gdb frobnicate", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("gdb: unknown subcommand 'frobnicate'");
  });
});

describe("toolchain edges", () => {
  it("as is an alias for gcc, sharing its diagnostics", async () => {
    const r = await dispatchCommand("as", makeCtx());
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("as: no input files");
  });

  it("gcc rejects more than one input file", async () => {
    const { ctx } = vfsCtx({ "a.s": "ret\n", "b.s": "ret\n" });
    const r = await dispatchCommand("gcc a.s b.s -o both", ctx);
    expect(r.status).toBe("err");
    expect(r.lines[0]).toBe("gcc: one input file at a time in the playground");
  });

  it("m4 without an operand and with a missing file both fail clearly", async () => {
    const noOperand = await dispatchCommand("m4", makeCtx());
    expect(noOperand.status).toBe("err");
    expect(noOperand.lines[0]).toBe("m4: usage: m4 <file> [> out.s]");
    const missing = await dispatchCommand("m4 ghost.asm", makeCtx());
    expect(missing.status).toBe("err");
    expect(missing.lines[0]).toBe("m4: ghost.asm: no such file in vfs");
  });
});
