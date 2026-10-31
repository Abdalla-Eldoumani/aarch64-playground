// @vitest-environment node
// gdb-lite's ni, si, finish, bt, info frame and x/Ngx, through the terminal's
// real context over machine states from the node build. Every expected line
// is worked out by hand from the programs (and, for locals.s, the course's
// slides), never by running the code under test another way.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";
import type { EmulatorState } from "@/lib/emulator/emulator-state";
import { formatWord64 } from "@/lib/emulator/format-hex";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import { createTerminalContext } from "@/lib/playground/terminal-context";
import { dispatchCommand } from "@/lib/terminal/dispatch";

const nodeRequire = createRequire(import.meta.url);
const { Emulator, memoryMap } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");

// fact's bl is line 26 and fact_done's ldr line 29; main's bl fact is line 39.
const fact = (n: number) => `// Prints ${n}! worked out by recursion.

define(fp, x29)
define(lr, x30)
define(n_r, w19)

.data
fmt_out:    .string "%d\\n"

.text

// fact(w0 = n) -> w0 = n!
        .balign 4
        .global fact
fact:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     x19, [fp, 16]               // keep the caller's n
        mov     n_r, w0
        cmp     n_r, 1
        b.gt    fact_rec
        mov     w0, 1                       // 1! = 1
        b       fact_done
fact_rec:
        sub     w0, n_r, 1
        bl      fact                        // w0 = (n - 1)!
        mul     w0, w0, n_r
fact_done:
        ldr     x19, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, ${n}
        bl      fact
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

/** The terminal's context over `source` run to the first time `line` is
 *  next, or to its end with no line. */
function stoppedAt(source: string, line: number | null, stdin?: string) {
  const emu = new Emulator();
  emu.assemble_and_load(source);
  if (stdin) emu.push_stdin(stdin);
  const map = Array.from(emu.get_line_map());
  const pcOf = (l: number) => map[map.indexOf(l) - 1];
  if (line == null) emu.run_until_break(10_000_000);
  else emu.run_to(1_000_000, -1, pcOf(line));
  const regs = emu.get_all_registers() as { gpr: string[]; sp: string; pc: string };
  const lineOf = (addr: number) => {
    for (let i = 0; i + 1 < map.length; i += 2) if (map[i] === addr) return `line ${map[i + 1]}`;
    return null;
  };
  const hub: EmulatorState = makeHub({
    programLoaded: true,
    frames: Array.from(emu.frames()),
    frameLayout: { numbers: Array.from(emu.frame_layout()), names: emu.frame_names() },
    registers: regs.gpr,
    sp: regs.sp,
    pc: Number(BigInt(regs.pc)),
    readMemory: async (addr, len) => emu.get_memory_range(addr, len),
    memoryRegions: normalizeMemoryMap(memoryMap()),
    lineLabel: lineOf,
  });
  const ctx = createTerminalContext({
    machine: { current: hub },
    workspace: () => ({ main: source, extras: [] }),
    applySeeds: vi.fn(),
    stageVfsFile: vi.fn(),
    removeVfsFile: vi.fn(async () => true),
    driveForeground: vi.fn(async () => 0),
    executables: new Map(),
  });
  return { ctx, sp: Number(BigInt(regs.sp)) };
}

const gdb = async (command: string, ctx: ReturnType<typeof stoppedAt>["ctx"]) =>
  dispatchCommand(`gdb ${command}`, ctx);

/** The frames bt's lines stand for: k + 1 for "(#0 to #k: ...)", K for
 *  "... K more calls ...", one for each other line. */
const framesIn = (lines: string[]) =>
  lines.reduce((sum, line) => {
    const unrecorded = /^\(#0 to #(\d+):/.exec(line);
    const folded = /^\.\.\. ([\d,]+) more calls \.\.\.$/.exec(line);
    return sum + (unrecorded ? Number(unrecorded[1]) + 1 : folded ? Number(folded[1].replace(/,/g, "")) : 1);
  }, 0);

describe("gdb-lite bt", () => {
  it("lists the current function and line, then each caller at its call", async () => {
    // fact(1) reaches fact_done first: main, then fact(4) to fact(1).
    const { ctx } = stoppedAt(fact(4), 29);
    const { lines } = await gdb("bt", ctx);
    expect(lines).toEqual([
      "#0  fact at line 29",
      "#1  fact at line 26",
      "#2  fact at line 26",
      "#3  fact at line 26",
      "#4  main at line 39",
    ]);
    expect(framesIn(lines)).toBe(5);
  });

  it("folds past 20 frames and still ends on main", async () => {
    // main and 30 calls of fact: #0 to #19, ten folded, main #30.
    const { ctx } = stoppedAt(fact(30), 29);
    const { lines } = await gdb("bt", ctx);
    expect(lines).toEqual([
      "#0  fact at line 29",
      ...Array.from({ length: 19 }, (_, k) => `#${k + 1}  fact at line 26`),
      "... 10 more calls ...",
      "#30  main at line 39",
    ]);
    expect(framesIn(lines)).toBe(31);
  });

  it("names the frames deeper than the record, then 20 recorded ones, the fold and main", async () => {
    // fact(17000) is 17,001 frames deep with main; 16,384 are recorded
    // (main and 16,383 calls), so the innermost 617, #0 to #616, are not.
    // #617, whose call into #616 is not recorded, has no line; #618 to #636
    // are at their bl; the other 16,363 recorded calls fold:
    // 617 + 20 + 16,363 + main = 17,001.
    const { ctx } = stoppedAt(fact(17000), 29);
    const { lines } = await gdb("bt", ctx);
    expect(lines).toEqual([
      "(#0 to #616: 617 deeper frames, not recorded)",
      "#617  fact",
      ...Array.from({ length: 19 }, (_, k) => `#${618 + k}  fact at line 26`),
      "... 16,363 more calls ...",
      "#17000  main",
    ]);
    expect(framesIn(lines)).toBe(17_001);
  });

  it("adds up to the whole stack at a recursion's overflow", async () => {
    // count pushes 16 bytes a call until the push of call 524,288 faults:
    // 524,289 frames with main (call-tree.test.ts works the depth out from
    // sp). 507,905 run deeper than the record, then 16,363 recorded calls
    // fold under the 20 shown: 507,905 + 20 + 16,363 + main = 524,289.
    const source = readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures/no-base-case.s"), "utf8");
    const { ctx } = stoppedAt(source, null);
    const { lines } = await gdb("bt", ctx);
    expect(lines).toEqual([
      "(#0 to #507904: 507,905 deeper frames, not recorded)",
      "#507905  count",
      ...Array.from({ length: 19 }, (_, k) => `#${507_906 + k}  count at line 15`),
      "... 16,363 more calls ...",
      "#524288  main",
    ]);
    expect(framesIn(lines)).toBe(524_289);
  });
});

// locals.s with "7 4", stopped on line 38 once scanf has stored both: the
// slides' 32-byte frame, fp = sp, a_s = 7 at fp + 16, b_s = 4 at fp + 20,
// 8 bytes of padding above, main's saved fp 0 (no caller frame).
const LOCALS = readFileSync(path.join(process.cwd(), "public/examples/cpsc355/locals.s"), "utf8");

describe("gdb-lite info frame", () => {
  it("gives the frame's bounds and each box from the top down", async () => {
    const { ctx, sp } = stoppedAt(LOCALS, 38, "7 4\n");
    const { status, lines } = await gdb("info frame", ctx);
    expect(status).toBe("ok");
    expect(lines[0]).toBe(`main: 32 bytes, ${formatWord64(sp)} up to ${formatWord64(sp + 32)}`);
    expect(lines.slice(1)).toEqual([
      expect.stringMatching(/^ {2}fp \+ 24 +padding +8 bytes$/),
      expect.stringMatching(/^ {2}fp \+ 20 +b_s = 4 +int, 4 bytes$/),
      expect.stringMatching(/^ {2}fp \+ 16 +a_s = 7 +int, 4 bytes$/),
      expect.stringMatching(/^ {2}fp \+ 8 +saved lr \(x30\) +0x[0-9a-f]{16}, back to the C runtime$/),
      expect.stringMatching(/^ {2}fp \+ 0 +saved fp \(x29\) +0x0{16}, 0, no caller frame$/),
    ]);
  });
});

describe("gdb-lite x/Ngx", () => {
  it("shows 8-byte words two to a line from $sp, $fp or an address", async () => {
    const { ctx, sp } = stoppedAt(LOCALS, 38, "7 4\n");
    // a_s = 7 and b_s = 4 make one word, b above a: 0x0000000400000007.
    const fromSp = (await gdb("x/4gx $sp", ctx)).lines;
    expect(fromSp).toEqual([
      expect.stringMatching(new RegExp(`^${formatWord64(sp)}:  0x0{16}  0x[0-9a-f]{16}$`)),
      `${formatWord64(sp + 16)}:  0x0000000400000007  0x0000000000000000`,
    ]);
    expect((await gdb("x/4gx $fp", ctx)).lines).toEqual(fromSp);
    expect((await gdb(`x/1gx ${formatWord64(sp + 16)}`, ctx)).lines).toEqual([
      `${formatWord64(sp + 16)}:  0x0000000400000007`,
    ]);
  });

  it("asks for a place it can read", async () => {
    const { ctx } = stoppedAt(LOCALS, 38, "7 4\n");
    expect(await gdb("x/2gx main", ctx)).toEqual({
      status: "err",
      lines: ["gdb: x/Ngx needs $sp, $fp, a register or an address, e.g. x/4gx $sp"],
    });
    expect((await gdb("x/2000gx $sp", ctx)).status).toBe("err");
  });
});

describe("gdb-lite bt and info frame with no frame", () => {
  it("say the program has finished once main has returned", async () => {
    const { ctx } = stoppedAt(fact(4), null);
    for (const command of ["bt", "info frame"]) {
      expect(await gdb(command, ctx)).toEqual({ status: "err", lines: ["gdb: no frames: the program has finished"] });
    }
  });

  it("ask for a program before anything is loaded", async () => {
    const ctx = createTerminalContext({
      machine: { current: makeHub() },
      workspace: () => ({ main: "", extras: [] }),
      applySeeds: vi.fn(),
      stageVfsFile: vi.fn(),
      removeVfsFile: vi.fn(async () => true),
      driveForeground: vi.fn(async () => 0),
      executables: new Map(),
    });
    expect(await gdb("bt", ctx)).toEqual({ status: "err", lines: ["gdb: bt needs an assembled program"] });
    expect(await gdb("info frame", ctx)).toEqual({
      status: "err",
      lines: ["gdb: info frame needs an assembled program"],
    });
  });
});

describe("gdb-lite ni, si, finish", () => {
  it("steps over with ni and out with finish, saying why each stopped", async () => {
    const { ctx } = stoppedAt(fact(4), 39);
    const hub = makeHub({ runUntil: vi.fn(async (t) => (t === "over" ? "reached line 40" : "returned to main at line 27")) });
    const over = await dispatchCommand("gdb ni", { ...ctx, runUntil: hub.runUntil });
    const out = await dispatchCommand("gdb finish", { ...ctx, runUntil: hub.runUntil });
    expect(over.lines).toEqual(["reached line 40"]);
    expect(out.lines).toEqual(["returned to main at line 27"]);
    expect(vi.mocked(hub.runUntil).mock.calls).toEqual([["over"], ["out"]]);
  });

  it("keeps n and s one instruction, and si with them", async () => {
    const { ctx } = stoppedAt(fact(4), 39);
    const step = vi.fn(async () => ({ halted: false, line: 16 }));
    const runUntil = vi.fn(async () => null);
    for (const command of ["n", "s", "si"]) {
      expect((await dispatchCommand(`gdb ${command}`, { ...ctx, step, runUntil })).lines).toEqual([]);
    }
    expect(step).toHaveBeenCalledTimes(3);
    expect(runUntil).not.toHaveBeenCalled();
  });
});
