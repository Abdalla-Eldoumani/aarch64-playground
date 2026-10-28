// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import {
  decodeFrameLayout,
  decodeFrames,
  drawFrames,
  FRAME_STATE,
  rangesToRead,
  slotAt,
  type DrawnStack,
  type FramesSnapshot,
} from "@/lib/emulator/stack-frames";

// Draws real machine states from the node build. Every expected box is
// worked out by hand from the program text (the course's slides for the
// shipped locals example), never by running the code under test.
const nodeRequire = createRequire(import.meta.url);
const { Emulator, memoryMap } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");
type Machine = InstanceType<typeof Emulator>;

// Two ints and a long in main's frame: the long must start at a multiple
// of 8, so 4 bytes of padding sit between a and it, and the 36 bytes in use
// round up to a 48-byte frame with 12 bytes of padding on top.
const PADDED_LOCALS = `// Three local variables on the stack: two ints and one long.
// The long has to start at a multiple of 8, so 4 bytes of padding sit after a.
define(fp, x29)
define(lr, x30)

a_s = 16                                // int a: bytes 16 to 19
total_s = 24                            // long total: bytes 24 to 31 (20 to 23 are padding)
b_s = 32                                // int b: bytes 32 to 35
alloc = -(16 + 20) & -16                // 20 bytes of locals, rounded up to 16: -48
dealloc = -alloc

.data
fmt:    .string "a = %d, b = %d, total = %ld\\n"

.text
// add_two(w0 = a, w1 = b) -> w0 = a + b
// Leaf function: no frame of its own
        .balign 4
        .global add_two
add_two:
        add     w0, w0, w1
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        mov     w9, 6
        str     w9, [fp, a_s]           // a = 6
        mov     w9, 9
        str     w9, [fp, b_s]           // b = 9

        ldr     w0, [fp, a_s]
        ldr     w1, [fp, b_s]
        bl      add_two                 // w0 = a + b
        mov     x9, 100
        mul     x0, x0, x9              // x0 = (a + b) * 100
        str     x0, [fp, total_s]       // total = 1500

        ldr     x0, =fmt
        ldr     w1, [fp, a_s]
        ldr     w2, [fp, b_s]
        ldr     x3, [fp, total_s]
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`;

// Each call keeps its own n in a 32-byte frame (16 for fp and lr, 4 for n,
// 12 of padding); main's frame is the bare 16 bytes.
const FACTORIAL = `// fact(n) works out n! by calling itself; each call keeps its own n in its frame.
define(fp, x29)
define(lr, x30)

n_s = 16                                // int n: bytes 16 to 19
alloc = -(16 + 4) & -16                 // 4 bytes of locals, rounded up: -32
dealloc = -alloc

.data
fmt:    .string "%d! = %d\\n"

.text
// fact(w0 = n) -> w0 = n!
        .balign 4
        .global fact
fact:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     w0, [fp, n_s]           // this call's n
        cmp     w0, 1
        b.gt    fact_recurse
        mov     w0, 1                   // fact(1) = 1
        b       fact_done
fact_recurse:
        sub     w0, w0, 1
        bl      fact                    // w0 = fact(n - 1)
        ldr     w9, [fp, n_s]           // n is still in this call's frame
        mul     w0, w0, w9
fact_done:
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 4
        bl      fact                    // w0 = 4!
        mov     w2, w0
        mov     w1, 4
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

// helper's array holds four ints at fp + 16 to fp + 31, the top of its
// 32-byte frame, so arr[4] to arr[7] land on main's frame record, which
// starts right above: arr[4] and arr[5] on the saved fp, arr[6] and arr[7]
// on the saved lr. Laid out so the store sits on line 32 and its eighth run
// is step 45, the moment the course's overflow walkthrough stops on.
const ARRAY_OVERFLOW = `// helper writes 8 ints into its 4-int array: the last four land on main's saved fp and lr.
define(fp, x29)
define(lr, x30)
arr_s = 16                              // int arr[4]: bytes 16 to 31
alloc = -(16 + 16) & -16                // 16 bytes of locals: -32
dealloc = -alloc
.data
fmt_done:   .string "done\\n"
.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        bl      helper
        ldr     x0, =fmt_done
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
// helper() sets arr[i] = i while i < 8, but arr holds 4 ints
        .balign 4
        .global helper
helper:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x9, fp, arr_s           // x9 = &arr[0]
        mov     w10, 0                  // i = 0
hp_loop:
        cmp     w10, 8                  // bug: the bound should be 4
        b.ge    hp_done
        str     w10, [x9, w10, sxtw 2]  // arr[i] = i
        add     w10, w10, 1
        b       hp_loop
hp_done:
        ldp     fp, lr, [sp], dealloc
        ret
`;

/** The 1-based line of the one line in `source` holding `text`. */
function lineOf(source: string, text: string): number {
  const lines = source.split("\n");
  const at = lines.flatMap((l, i) => (l.includes(text) ? [i + 1] : []));
  expect(at, `"${text}" should be on exactly one line`).toHaveLength(1);
  return at[0];
}

interface Loaded {
  emu: Machine;
  source: string;
  pcOfLine: (line: number) => number;
  lineAt: Map<number, number>;
}

function load(source: string, stdin?: string): Loaded {
  const emu = new Emulator();
  const result = emu.assemble_and_load(source) as { success: boolean; error?: string | null };
  expect(result.error ?? null).toBeNull();
  if (stdin) emu.push_stdin(stdin);
  const flat = Array.from(emu.get_line_map());
  const lineAt = new Map<number, number>();
  for (let i = 0; i + 1 < flat.length; i += 2) lineAt.set(flat[i], flat[i + 1]);
  const pcOfLine = (line: number) => {
    for (const [addr, l] of lineAt) if (l === line) return addr;
    throw new Error(`no instruction on line ${line}`);
  };
  return { emu, source, pcOfLine, lineAt };
}

/** Run until the instruction on `line` is next, `times` times over. A load
 *  leaves the pc on main's first instruction, which counts as the first time. */
function runTo(p: Loaded, line: number, times = 1): void {
  const pc = p.pcOfLine(line);
  p.emu.set_breakpoint(pc);
  for (let i = 0; i < times; i++) {
    if (i === 0 && Number(p.emu.get_pc()) === pc) continue;
    if (i > 0) p.emu.step();
    p.emu.run_until_break(100_000);
    expect(Number(p.emu.get_pc())).toBe(pc);
  }
  p.emu.clear_breakpoint(pc);
}

/** What the machine wrote since the last drain, as `[addr, len]`. */
function takeWrites(p: Loaded): [number, number][] {
  const flat = Array.from(p.emu.take_dirty_addrs());
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
  return pairs;
}

/** One step, keeping what it wrote. */
function stepWriting(p: Loaded): [number, number][] {
  p.emu.take_dirty_addrs();
  p.emu.step();
  return takeWrites(p);
}

function draw(p: Loaded, written: [number, number][] = []): DrawnStack {
  const snapshot = decodeFrames(p.emu.frames()) as FramesSnapshot;
  const layout = decodeFrameLayout({ numbers: Array.from(p.emu.frame_layout()), names: p.emu.frame_names() });
  return drawFrames({
    snapshot,
    layout,
    sp: Number(p.emu.get_sp()),
    fp: Number(p.emu.get_register(29)),
    pc: Number(p.emu.get_pc()),
    memory: rangesToRead(snapshot).map(([addr, len]) => ({ addr, bytes: p.emu.get_memory_range(addr, len) })),
    written,
    regions: normalizeMemoryMap(memoryMap()),
    lineLabel: (addr) => (p.lineAt.has(addr) ? `line ${p.lineAt.get(addr)}` : null),
  });
}

/** The boxes as the view prints them: offset, title, detail, and the marker. */
function rows(stack: DrawnStack, frame: number): string[] {
  return stack.frames[frame].boxes.map((b) =>
    [b.offset, b.title, b.detail, b.marker].filter(Boolean).join(" | "),
  );
}

describe("drawFrames", () => {
  // The slides' frame: alloc = -(16 + 16) & -16 = -32, a_s at fp + 16 and
  // b_s at fp + 20, the saved fp (0: main has no caller frame) at fp + 0 and
  // the saved lr at fp + 8. scanf stored the fixture input 7 and 4.
  it("draws the shipped locals example as the slides do", () => {
    const source = readFileSync(path.join(process.cwd(), "public/examples/cpsc355/locals.s"), "utf8");
    const p = load(source, "7 4\n");
    // The call passes through a trampoline and scanf's stub before line 38;
    // everything it wrote on the way is what a step over it shows.
    runTo(p, lineOf(source, "bl      scanf"));
    p.emu.take_dirty_addrs();
    runTo(p, lineOf(source, "ldr     a_r, [fp, a_s]"));
    const written = takeWrites(p);
    const stack = draw(p, written);
    expect(stack.frames).toHaveLength(1);
    expect(stack.frames[0]).toMatchObject({ name: "main", bytes: 32, from: null, state: null });
    expect(rows(stack, 0)).toEqual([
      "fp + 24 | padding | 8 bytes",
      "fp + 20 | b_s = 4 | int, 4 bytes",
      "fp + 16 | a_s = 7 | int, 4 bytes",
      "fp + 8 | saved lr (x30) | back to the C runtime",
      "fp + 0 | saved fp (x29) | 0, no caller frame | sp, fp",
    ]);
    expect(stack.frames[0].boxes.filter((b) => b.wrote).map((b) => b.title)).toEqual(["b_s = 4", "a_s = 7"]);
    p.emu.free();
  });

  it("draws a reserved frame from sp until fp is set, then from fp", () => {
    const p = load(PADDED_LOCALS);
    runTo(p, lineOf(PADDED_LOCALS, "stp     fp, lr, [sp, alloc]!"));
    const pushed = stepWriting(p);
    let stack = draw(p, pushed);
    expect(stack.frames[0]).toMatchObject({ name: "main", bytes: 48, state: "frame reserved, fp not set yet" });
    expect(rows(stack, 0).slice(-2)).toEqual([
      "sp + 8 | saved lr (x30) | back to the C runtime",
      "sp + 0 | saved fp (x29) | 0, no caller frame | sp",
    ]);
    expect(stack.frames[0].boxes.filter((b) => b.wrote).map((b) => b.title)).toEqual([
      "saved lr (x30)",
      "saved fp (x29)",
    ]);
    p.emu.step();
    stack = draw(p);
    expect(stack.frames[0].state).toBeNull();
    expect(rows(stack, 0).slice(-1)).toEqual(["fp + 0 | saved fp (x29) | 0, no caller frame | sp, fp"]);
    p.emu.free();
  });

  // 36 bytes in use: a at 16 to 19, padding 20 to 23, total at 24 to 31,
  // b at 32 to 35, and padding 36 to 47.
  it("puts the padding where the long's alignment and the round-up leave it", () => {
    const p = load(PADDED_LOCALS);
    runTo(p, lineOf(PADDED_LOCALS, "str     x0, [fp, total_s]"));
    const stack = draw(p, stepWriting(p));
    expect(rows(stack, 0)).toEqual([
      "fp + 36 | padding | 12 bytes",
      "fp + 32 | b_s = 9 | int, 4 bytes",
      "fp + 24 | total_s = 1500 | long, 8 bytes",
      "fp + 20 | padding | 4 bytes",
      "fp + 16 | a_s = 6 | int, 4 bytes",
      "fp + 8 | saved lr (x30) | back to the C runtime",
      "fp + 0 | saved fp (x29) | 0, no caller frame | sp, fp",
    ]);
    expect(stack.frames[0].boxes.filter((b) => b.wrote).map((b) => b.title)).toEqual(["total_s = 1500"]);
    p.emu.free();
  });

  it("shows a leaf call with no frame of its own", () => {
    const p = load(PADDED_LOCALS);
    runTo(p, lineOf(PADDED_LOCALS, "add     w0, w0, w1"));
    const stack = draw(p);
    expect(stack.frames.map((f) => f.name)).toEqual(["main", "add_two"]);
    expect(stack.frames[1]).toMatchObject({
      bytes: 0,
      from: `called from line ${lineOf(PADDED_LOCALS, "bl      add_two")}`,
      state: "leaf: no frame of its own",
      boxes: [],
    });
    p.emu.free();
  });

  // fact(4) calls fact(3), fact(2) and fact(1); fact(1) has run its ldp
  // and waits on its ret, so its frame is gone and sp sits on fact(2)'s
  // record, where fp points too.
  it("draws recursion four calls deep, each call with its own n", () => {
    const p = load(FACTORIAL);
    // fact's ret is the line after its ldp.
    runTo(p, lineOf(FACTORIAL, "ldp     fp, lr, [sp], dealloc") + 1);
    const mainCall = lineOf(FACTORIAL, "bl      fact                    // w0 = 4!");
    const selfCall = lineOf(FACTORIAL, "bl      fact                    // w0 = fact(n - 1)");
    const stack = draw(p);
    expect(stack.frames.map((f) => [f.name, f.bytes, f.from, f.state])).toEqual([
      ["main", 16, null, null],
      ["fact", 32, `called from line ${mainCall}`, null],
      ["fact", 32, `called from line ${selfCall}`, null],
      ["fact", 32, `called from line ${selfCall}`, null],
      ["fact", 0, `called from line ${selfCall}`, "frame released, ret comes next"],
    ]);
    const fourth = (n: number, back: number, caller: string, marker = "") => [
      "fp + 20 | padding | 12 bytes",
      `fp + 16 | n_s = ${n} | int, 4 bytes`,
      `fp + 8 | saved lr (x30) | back to line ${back}`,
      `fp + 0 | saved fp (x29) | ${caller}'s frame${marker}`,
    ];
    expect(rows(stack, 1)).toEqual(fourth(4, mainCall + 1, "main"));
    expect(rows(stack, 2)).toEqual(fourth(3, selfCall + 1, "fact"));
    expect(rows(stack, 3)).toEqual(fourth(2, selfCall + 1, "fact", " | sp, fp"));
    expect(stack.depth).toBe(5);
    expect(stack.folded).toBeNull();
    p.emu.free();
  });

  // fact(100) is main plus 100 calls deep: the view keeps main and the
  // innermost 63, and folds the 37 between them.
  it("folds deep recursion between main and the innermost calls", () => {
    const p = load(FACTORIAL.replace("mov     w0, 4", "mov     w0, 100"));
    runTo(p, lineOf(FACTORIAL, "ldp     fp, lr, [sp], dealloc") + 1);
    const stack = draw(p);
    expect(stack.frames).toHaveLength(64);
    expect(stack.frames[0].name).toBe("main");
    expect(stack.folded).toBe("37 more calls of fact");
    expect(stack.untracked).toBeNull();
    expect(stack.depth).toBe(101);
    p.emu.free();
  });

  // fact(17000) is 17,001 calls deep with main; the machine records 16,384
  // of them, so 617 go unrecorded and 16,384 - 64 = 16,320 are folded.
  it("says how many calls run deeper than the machine keeps track of", () => {
    const p = load(FACTORIAL.replace("mov     w0, 4", "mov     w0, 17000"));
    const ret = p.pcOfLine(lineOf(FACTORIAL, "ldp     fp, lr, [sp], dealloc") + 1);
    p.emu.set_breakpoint(ret);
    p.emu.run_until_break(1_000_000);
    expect(Number(p.emu.get_pc())).toBe(ret);
    const stack = draw(p);
    expect(stack.folded).toBe("16,320 more calls of fact");
    expect(stack.untracked).toBe("617 deeper calls not shown: the playground stops keeping track this deep");
    expect(stack.depth).toBe(17_001);
    p.emu.free();
  });

  // Step 45 stores arr[7] = 7: main's saved fp holds arr[5]:arr[4] =
  // 0x5_00000004 and its saved lr arr[7]:arr[6] = 0x7_00000006, which is no
  // code. Both were last changed by the store on line 32.
  it("marks main's saved fp and lr overwritten by the array's last four, naming the line", () => {
    const p = load(ARRAY_OVERFLOW);
    expect(lineOf(ARRAY_OVERFLOW, "str     w10, [x9, w10, sxtw 2]")).toBe(32);
    for (let i = 0; i < 44; i++) p.emu.step();
    const stack = draw(p, stepWriting(p));
    expect(Number(p.emu.frames()[0])).toBe(45);
    expect(rows(stack, 0)).toEqual([
      "fp + 16 | padding | 16 bytes",
      "fp + 8 | saved lr (x30) | 0x700000006 (not code) · overwritten by line 32",
      "fp + 0 | saved fp (x29) | 0x500000004 · overwritten by line 32",
    ]);
    expect(stack.frames[0].boxes.map((b) => [b.kind, b.overwritten, b.wrote])).toEqual([
      ["padding", false, false],
      ["saved", true, true],
      ["saved", true, false],
    ]);
    const call = lineOf(ARRAY_OVERFLOW, "bl      helper");
    expect(stack.frames[1]).toMatchObject({ name: "helper", bytes: 32, from: `called from line ${call}` });
    expect(rows(stack, 1)).toEqual([
      "fp + 28 | arr_s[3] = 3 | int, 4 bytes",
      "fp + 24 | arr_s[2] = 2 | int, 4 bytes",
      "fp + 20 | arr_s[1] = 1 | int, 4 bytes",
      "fp + 16 | arr_s[0] = 0 | int, 4 bytes",
      `fp + 8 | saved lr (x30) | back to line ${call + 1}`,
      "fp + 0 | saved fp (x29) | main's frame | sp, fp",
    ]);
    // Only a saved fp or lr ever names the line that wrote it.
    const others = stack.frames.flatMap((f) => f.boxes).filter((b) => b.kind !== "saved");
    expect(others.filter((b) => /overwritten|by line/.test(b.detail))).toEqual([]);
    p.emu.free();
  });
});

describe("values by the slot's width", () => {
  // main's 48-byte frame at 0x7fffffd0 holds an int -5 at fp + 16, a long
  // pointing into the stack at fp + 24, the double 1.5 at fp + 32 and a
  // char 0xff at fp + 40, all written into the bytes by hand.
  it("reads an int signed, a pointer in hex, a double as a decimal and a char signed", () => {
    const R = 0x7fffffd0;
    const bytes = new Uint8Array(48);
    const view = new DataView(bytes.buffer);
    view.setBigUint64(8, 0xffff0000n, true);
    view.setInt32(16, -5, true);
    view.setBigUint64(24, 0x7fffffe0n, true);
    view.setFloat64(32, 1.5, true);
    bytes[40] = 0xff;
    const stack = drawFrames({
      snapshot: {
        step: 9, uncounted: 0, hidden: 0, hiddenEntry: 0, chainOk: true, badReturn: null, leftovers: [],
        frames: [{
          index: 0, entry: 0x400000, callPc: 0, retAddr: 0xffff0000, spEntry: R + 48, lo: R, fpEntry: 0,
          record: R, state: FRAME_STATE.complete, flags: 0, fpHit: null, lrHit: null,
        }],
      },
      layout: {
        names: [],
        functions: [{
          entry: 0x400000, end: 0x400100, name: "main", frameBytes: 48, makesRecord: true, arrays: [],
          slots: [
            { offset: 16, width: 4, float: false, name: "n_s", field: null },
            { offset: 24, width: 8, float: false, name: "p_s", field: null },
            { offset: 32, width: 8, float: true, name: "d_s", field: null },
            { offset: 40, width: 1, float: false, name: "c_s", field: null },
          ],
        }],
      },
      sp: R,
      fp: R,
      pc: 0x400010,
      memory: [{ addr: R, bytes }],
      written: [],
      regions: [{ name: "stack", start: 0x7f800000, end: 0x80000000 }],
      lineLabel: () => null,
    });
    expect(rows(stack, 0)).toEqual([
      "fp + 41 | padding | 7 bytes",
      "fp + 40 | c_s = -1 | char, 1 byte",
      "fp + 32 | d_s = 1.5 | double, 8 bytes",
      "fp + 24 | p_s = 0x7fffffe0 | pointer, 8 bytes",
      "fp + 20 | padding | 4 bytes",
      "fp + 16 | n_s = -5 | int, 4 bytes",
      "fp + 8 | saved lr (x30) | back to the C runtime",
      "fp + 0 | saved fp (x29) | 0, no caller frame | sp, fp",
    ]);
  });
});

describe("rangesToRead", () => {
  const frame = (lo: number, spEntry: number) => ({
    index: 0, entry: 0, callPc: 0, retAddr: 0, spEntry, lo, fpEntry: 0, record: 0,
    state: FRAME_STATE.complete, flags: 0, fpHit: null, lrHit: null,
  });
  const snapshot = (frames: ReturnType<typeof frame>[]): FramesSnapshot => ({
    step: 0, uncounted: 0, hidden: 0, hiddenEntry: 0, chainOk: true, badReturn: null, frames, leftovers: [],
  });

  it("reads touching frames as one range and skips empty ones", () => {
    expect(rangesToRead(snapshot([frame(0x7fffffe0, 0x80000000), frame(0x7fffffc0, 0x7fffffe0), frame(0x7fffffc0, 0x7fffffc0)])))
      .toEqual([[0x7fffffc0, 0x40]]);
  });

  it("reads main apart from innermost calls with hidden ones between", () => {
    expect(rangesToRead(snapshot([frame(0x7ffffff0, 0x80000000), frame(0x7fff0000, 0x7fff0020)])))
      .toEqual([[0x7fff0000, 0x20], [0x7ffffff0, 0x10]]);
  });

  it("caps a range at 16 KiB above its low end", () => {
    expect(rangesToRead(snapshot([frame(0x7ff00000, 0x80000000)]))).toEqual([[0x7ff00000, 16 * 1024]]);
  });
});

describe("slotAt", () => {
  /** What a pointer chip would say for `addr`, or null for no chip. */
  const chip = (stack: DrawnStack, addr: number) => {
    const at = slotAt(stack, addr);
    return at && `${at.slot} · ${at.owner}`;
  };

  // The slides' frame again, at the scanf that fills it: a_s at fp + 16 to
  // fp + 19, b_s at fp + 20 to fp + 23, padding at fp + 24 to fp + 31, the
  // saved fp at fp + 0 and the saved lr at fp + 8. main's sp is its fp.
  it("names locals.s's slots at their edges and nothing outside main's frame", () => {
    const source = readFileSync(path.join(process.cwd(), "public/examples/cpsc355/locals.s"), "utf8");
    const p = load(source, "7 4\n");
    runTo(p, lineOf(source, "bl      scanf"));
    const fp = Number(p.emu.get_register(29));
    const stack = draw(p);
    expect(Number(p.emu.get_register(1))).toBe(fp + 16);
    expect(Number(p.emu.get_register(2))).toBe(fp + 20);
    expect(chip(stack, fp + 16)).toBe("a_s · main");
    expect(chip(stack, fp + 19)).toBe("a_s + 3 · main");
    expect(chip(stack, fp + 15)).toBe("saved lr + 7 · main");
    expect(chip(stack, fp + 20)).toBe("b_s · main");
    expect(chip(stack, fp + 23)).toBe("b_s + 3 · main");
    expect(chip(stack, fp + 24)).toBe("fp + 24 · main");
    expect(chip(stack, fp + 0)).toBe("saved fp · main");
    expect(chip(stack, fp + 8)).toBe("saved lr · main");
    expect(chip(stack, fp + 31)).toBe("fp + 31 · main");
    expect(chip(stack, fp + 32)).toBeNull();
    expect(chip(stack, fp - 1)).toBeNull();
    // x0 holds fmt_in's address in .data; the heap starts where the
    // machine's map says; zero is no address at all.
    const heap = normalizeMemoryMap(memoryMap()).find((r) => r.name === "heap")!;
    expect(chip(stack, Number(p.emu.get_register(0)))).toBeNull();
    expect(chip(stack, heap.start)).toBeNull();
    expect(chip(stack, 0)).toBeNull();
    p.emu.free();
  });

  // Two calls deep, inside square: fill's 32-byte frame sits right under
  // main's, so fill's record F has main's at F + 32. fill holds dest_s at
  // F + 16 to F + 23, i_s at F + 24 and sq_s at F + 28 to F + 31; main's
  // array runs from F + 48 to F + 63. square is a leaf, so sp is still F.
  it("tells two frames apart across the line between them", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures/fill-squares.s"), "utf8");
    const p = load(source);
    runTo(p, lineOf(source, "str     w9, [x0]"));
    const F = Number(p.emu.get_register(29));
    const M = F + 32;
    const stack = draw(p);
    expect(stack.frames.map((f) => f.name)).toEqual(["main", "fill", "square"]);
    expect(Number(p.emu.get_sp())).toBe(F);
    expect(chip(stack, Number(p.emu.get_register(0)))).toBe("sq_s · fill");
    expect(chip(stack, F + 31)).toBe("sq_s + 3 · fill");
    expect(chip(stack, F + 32)).toBe("saved fp · main");
    expect(chip(stack, F)).toBe("saved fp · fill");
    expect(chip(stack, F + 8)).toBe("saved lr · fill");
    expect(chip(stack, F + 16)).toBe("dest_s · fill");
    expect(chip(stack, F + 20)).toBe("dest_s + 4 · fill");
    expect(chip(stack, F - 1)).toBeNull();
    expect(chip(stack, M + 16)).toBe("arr_s[0] · main");
    expect(chip(stack, M + 28)).toBe("arr_s[3] · main");
    expect(chip(stack, M + 31)).toBe("arr_s[3] + 3 · main");
    expect(chip(stack, M + 32)).toBeNull();
    p.emu.free();
  });
});
