// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { drawCalls, type CallRow, type DrawnCalls } from "@/lib/emulator/call-tree";
import { calleeLeftovers, FRAME_ROW, FRAMES_HEADER } from "@/lib/emulator/frame-data";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import { decodeFrameLayout, decodeFrames } from "@/lib/emulator/stack-frames";

// The list of calls on real machine states from the node build: the numbers
// come through the frames export, the words from call-tree.ts. Every
// expected list is worked out by hand from the program's text; the C
// programs' counts from their own recursion depths.
const nodeRequire = createRequire(import.meta.url);
const { Emulator, memoryMap } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");
type Machine = InstanceType<typeof Emulator>;

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");
const FIXTURE = read("lib/test/emulator/fixtures/call-tree.s");
const REGIONS = normalizeMemoryMap(memoryMap());

function load(source: string): Machine {
  const emu = new Emulator();
  const result = emu.assemble_and_load(source) as { error?: string | null };
  expect(result.error ?? null).toBeNull();
  return emu;
}

function calls(emu: Machine): DrawnCalls {
  const layout = decodeFrameLayout({ numbers: Array.from(emu.frame_layout()), names: emu.frame_names() });
  const drawn = drawCalls(Array.from(emu.frames()), layout, REGIONS);
  expect(drawn).not.toBeNull();
  return drawn!;
}

/** The list as lines: two spaces a level, the row's text, and `*` on the
 *  current call or `...` on one waiting for its callee. */
function lines(drawn: DrawnCalls): string[] {
  const out: string[] = [];
  const walk = (rows: CallRow[], depth: number) => {
    for (const row of rows) {
      const mark = row.state === "current" ? " *" : row.state === "running" ? " ..." : "";
      out.push(`${"  ".repeat(depth)}${row.call}${row.result ? ` · ${row.result}` : ""}${mark}`);
      walk(row.children, depth + 1);
    }
  };
  walk(drawn.rows, 0);
  return out;
}

/** Run until the instruction at `pc` is next, `times` times over. */
function runTo(emu: Machine, pc: number, times = 1) {
  emu.set_breakpoint(pc);
  for (let i = 0; i < times; i++) {
    emu.step();
    emu.run_until_break(10_000_000);
    expect(Number(emu.get_pc())).toBe(pc);
  }
  emu.clear_breakpoint(pc);
}

const labelPc = (emu: Machine, source: string, label: string) => {
  const line = source.split("\n").findIndex((l) => l.startsWith(`${label}:`)) + 2;
  const flat = Array.from(emu.get_line_map());
  for (let i = 0; i + 1 < flat.length; i += 2) if (flat[i + 1] >= line) return flat[i];
  throw new Error(`no code after ${label}`);
};

const finish = (emu: Machine) => {
  emu.run_until_break(10_000_000);
  expect(emu.is_halted()).toBe(true);
};

describe("the list of calls", () => {
  it("shows fact(4) down to its base case, each call its own row, the base case current", () => {
    const emu = load(FIXTURE);
    // fact's `mov w0, 1`, reached once n is 1.
    runTo(emu, labelPc(emu, FIXTURE, "fact") + 20);
    expect(lines(calls(emu))).toEqual(["main ...", "  fact(4) ...", "    fact(3) ...", "      fact(2) ...", "        fact(1) *"]);
  });

  it("ends with every call returned and its value, and the cube run folded after four", () => {
    const emu = load(FIXTURE);
    finish(emu);
    // 4! = 24 by 4 * 3 * 2 * 1; cube(i) = i * i * i; cube(5) to cube(7)
    // fold into one row; main returns 0.
    expect(lines(calls(emu))).toEqual([
      "main · returned 0",
      "  fact(4) · returned 24",
      "    fact(3) · returned 6",
      "      fact(2) · returned 2",
      "        fact(1) · returned 1",
      "  cube(1) · returned 1",
      "  cube(2) · returned 8",
      "  cube(3) · returned 27",
      "  cube(4) · returned 64",
      "  cube × 3 · all returned",
    ]);
    expect(calls(emu).hidden).toBeNull();
  });

  it("reads a fold of one call as that call, and the fold's count from the second", () => {
    const emu = load(FIXTURE);
    const cube = labelPc(emu, FIXTURE, "cube");
    runTo(emu, cube, 5);
    expect(lines(calls(emu)).slice(-2)).toEqual(["  cube(4) · returned 64", "  cube(5) *"]);
    runTo(emu, cube, 1);
    expect(lines(calls(emu)).slice(-2)).toEqual(["  cube(4) · returned 64", "  cube × 2 *"]);
    expect(calls(emu).rows[0].children.at(-1)!.said).toBe("2 calls of cube");
  });

  it("folds the C corpus's 7,945-deep recursion into rec × 7,940, the current call among them", () => {
    const source = read("../emulator/tests/c-corpus/46_stack_overflow.s");
    const emu = load(source);
    finish(emu);
    // main, then rec(0) to rec(7943): 7,944 calls, four of them rows.
    expect(lines(calls(emu))).toEqual([
      "main ...",
      "  rec(0) ...",
      "    rec(1) ...",
      "      rec(2) ...",
      "        rec(3) ...",
      "          rec × 7,940 *",
    ]);
  });

  it("counts all 20,001 calls of sumto(20000), deeper than the frames keep: sumto × 19,997", () => {
    const emu = load(read("lib/test/emulator/fixtures/sumto.s"));
    finish(emu);
    expect(emu.take_stdout()).toBe("sum = 200010000\n");
    // sumto(n) = n * (n + 1) / 2; sumto(19996) down to sumto(0) fold.
    expect(lines(calls(emu))).toEqual([
      "main · returned 0",
      "  sumto(20000) · returned 200010000",
      "    sumto(19999) · returned 199990000",
      "      sumto(19998) · returned 199970001",
      "        sumto(19997) · returned 199950003",
      "          sumto × 19,997 · all returned",
    ]);
  });

  it("counts every call of a recursion with no base case up to the overflow, as the frames below do", () => {
    const source = read("lib/test/emulator/fixtures/no-base-case.s");
    const emu = load(source);
    // count pushes 16 bytes a call: the calls whose push fits above the
    // stack's floor (8 MiB below 0x80000000, the servers' ulimit -s), and
    // the one whose push faults.
    runTo(emu, labelPc(emu, source, "count"));
    const floor = 0x8000_0000 - 8 * 1024 * 1024;
    const entered = (Number(emu.get_sp()) - floor) / 16 + 1;
    expect(entered).toBe(524_288);
    finish(emu);
    expect(lines(calls(emu))).toEqual([
      "main ...",
      "  count(0) ...",
      "    count(1) ...",
      "      count(2) ...",
      "        count(3) ...",
      "          count × 524,284 *",
    ]);
    // The frames: main and 16,383 count calls recorded, 507,905 deeper ones
    // counted ("507,905 deeper frames not recorded").
    const snapshot = decodeFrames(Array.from(emu.frames()))!;
    expect([snapshot.hidden + snapshot.frames.length - 1, snapshot.uncounted]).toEqual([16_383, 507_905]);
  });

  it("folds each of 51_deep_frames' three recursions and dims them once returned", () => {
    const emu = load(read("../emulator/tests/c-corpus/51_deep_frames.s"));
    finish(emu);
    // walk(3000) makes 3,001 calls, ten(600) 601 and keep(1500) 1,501.
    const shown = lines(calls(emu)).map((line) => line.replace(/ · returned .*/, ""));
    expect(shown).toEqual([
      "main",
      "  walk(3000)",
      "    walk(2999)",
      "      walk(2998)",
      "        walk(2997)",
      "          walk × 2,997 · all returned",
      "  ten(600)",
      "    ten(599)",
      "      ten(598)",
      "        ten(597)",
      "          ten × 597 · all returned",
      "  keep(1500)",
      "    keep(1499)",
      "      keep(1498)",
      "        keep(1497)",
      "          keep × 1,497 · all returned",
    ]);
    // ten returns a long long: what main printed with %lld.
    const printed = emu.take_stdout().match(/^ten=(.*)$/m)![1];
    expect(calls(emu).rows[0].children[1].result).toBe(`returned ${printed}`);
  });

  it("keeps 200 calls and counts the rest in plain words", () => {
    // tick and tock in turn, 150 times each: no run to fold, so main and
    // the first 199 calls fill the list and 101 calls are left out.
    const source = [
      ".text",
      "        .balign 4",
      "        .global tick",
      "tick:",
      "        mov     w0, 1",
      "        ret",
      "        .balign 4",
      "        .global tock",
      "tock:",
      "        mov     w0, 2",
      "        ret",
      "        .balign 4",
      "        .global main",
      "main:",
      "        stp     x29, x30, [sp, -16]!",
      "        mov     x29, sp",
      "        mov     w19, 0",
      "tt_loop:",
      "        bl      tick",
      "        bl      tock",
      "        add     w19, w19, 1",
      "        cmp     w19, 150",
      "        b.lt    tt_loop",
      "        mov     w0, 0",
      "        ldp     x29, x30, [sp], 16",
      "        ret",
    ].join("\n");
    const emu = load(source);
    runTo(emu, labelPc(emu, source, "tock"), 100);
    const inside = calls(emu);
    expect(lines(inside)).toHaveLength(200);
    expect(inside.hidden).toBe("1 more call not shown, the current one among them");
    finish(emu);
    const after = calls(emu);
    expect(lines(after)).toHaveLength(200);
    expect(lines(after).at(-1)).toBe("  tick · returned 1");
    expect(after.hidden).toBe("101 more calls not shown");
  });

  it("is back exactly as it was after Back, at every step across a return and a fold", () => {
    const emu = load(FIXTURE);
    runTo(emu, labelPc(emu, FIXTURE, "cube"), 4);
    const seen = [lines(calls(emu))];
    for (let i = 0; i < 40; i++) {
      emu.step();
      seen.push(lines(calls(emu)));
    }
    expect(seen.at(-1)).not.toEqual(seen[0]);
    for (let i = 39; i >= 0; i--) {
      emu.step_back();
      expect(lines(calls(emu))).toEqual(seen[i]);
    }
  });

  it("is absent from a wasm build whose frames end at the leftovers, which still decode", () => {
    const emu = load(FIXTURE);
    runTo(emu, labelPc(emu, FIXTURE, "cube"), 1);
    const numbers = Array.from(emu.frames());
    const before = numbers.slice(0, FRAMES_HEADER + numbers[8] * FRAME_ROW + numbers[9] * 2);
    expect(drawCalls(before, null, REGIONS)).toBeNull();
    expect(decodeFrames(before)).toEqual(decodeFrames(numbers));
    expect(calleeLeftovers(numbers)).toEqual(calleeLeftovers(before));
  });

  it("names a call the layout does not know by its address, as the frames head an unnamed frame", () => {
    const emu = load(FIXTURE);
    runTo(emu, labelPc(emu, FIXTURE, "cube"), 1);
    const drawn = drawCalls(Array.from(emu.frames()), null, REGIONS)!;
    // At least 8 hex digits, the frames view's form for an address; cube
    // still shows the 1 it reads from w0.
    const at = (label: string) => `0x${Number(emu.resolve_label(label)).toString(16).padStart(8, "0")}`;
    expect([drawn.rows[0].call, drawn.rows[0].children.at(-1)!.call]).toEqual([at("main"), `${at("cube")}(1)`]);
  });
});

describe("a returned value", () => {
  const RETURNS = read("lib/test/emulator/fixtures/call-returns.s");

  it("reads as x0 after a 64-bit write, as w0 after a 32-bit one, and an address in hex", () => {
    const emu = load(RETURNS);
    finish(emu);
    // Both functions leave the bits 0x80000000: a long 2^31 from as_long's
    // lsl x0, an int whose sign bit is set from as_int's lsl w0. printf
    // reads them the same way with %ld and %d.
    expect(emu.take_stdout()).toBe("2147483648 -2147483648 hi\n");
    const msg = Number(emu.resolve_label("msg"));
    expect(lines(calls(emu))).toEqual([
      "main · returned 0",
      "  as_long · returned 2147483648",
      "  as_int · returned -2147483648",
      `  greeting · returned 0x${msg.toString(16).padStart(8, "0")}`,
    ]);
  });

  it("keeps the reading of the write before the ret across Back and a named save", () => {
    const emu = load(RETURNS);
    const asInt = labelPc(emu, RETURNS, "as_int");
    // as_int's lsl w0, then its ret.
    runTo(emu, asInt + 4);
    emu.step();
    emu.save_state("at the ret");
    emu.step();
    const asIntRow = () => calls(emu).rows[0].children[1];
    expect(asIntRow().result).toBe("returned -2147483648");
    // Back over the ret and the lsl, to x0 as mov x0, 1 left it; the save
    // brings back the w0 the lsl wrote.
    emu.step_back();
    emu.step_back();
    expect(asIntRow().state).toBe("current");
    expect(emu.load_state("at the ret")).toBe(true);
    emu.step();
    expect(asIntRow().result).toBe("returned -2147483648");
  });
});

describe("an argument", () => {
  it("is an address in hex where the function uses x0 as one", () => {
    // fill(x0 = arr base): main passes &arr[0], fp + 16 in its frame, and
    // fill keeps it with `str x0, [fp, dest_s]`.
    const source = read("lib/test/emulator/fixtures/fill-squares.s");
    const emu = load(source);
    runTo(emu, labelPc(emu, source, "fill"));
    const arr = Number(emu.get_register(29)) + 16;
    expect(lines(calls(emu))).toEqual(["main ...", `  fill(0x${arr.toString(16).padStart(8, "0")}) *`]);
  });

  it("is the value a function first tests with cbz or tbnz, a pointer in hex", () => {
    // first_byte opens with cbz x0 (a pointer), not_zero with cbz w0 and
    // is_odd with tbnz w0 (ints). main passes &msg, -3 and 7; "hi" starts
    // with 'h', 104.
    const emu = load(read("lib/test/emulator/fixtures/branch-args.s"));
    finish(emu);
    const msg = Number(emu.resolve_label("msg"));
    expect(lines(calls(emu))).toEqual([
      "main · returned 0",
      `  first_byte(0x${msg.toString(16).padStart(8, "0")}) · returned 104`,
      "  not_zero(-3) · returned 1",
      "  is_odd(7) · returned 1",
    ]);
  });
});
