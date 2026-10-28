// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ProgramLines } from "@/lib/emulator/frame-cards";
import { callDepth } from "@/lib/emulator/frame-data";
import { stopReason } from "@/lib/emulator/stop-reason";
import type { StepTarget } from "@/lib/emulator/emulator-state";
import type { RunResultPayload, StateSnapshot } from "@/lib/worker/protocol";

// Step over, step out and run to cursor on the real node build, through
// run_to, and the words they stop with. Lines, step counts and addresses are
// worked out by hand from the programs below.
const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");
type Machine = InstanceType<typeof Emulator>;

// fact is lines 15 to 31 (its bl on 26, the mul after it on 27, fact_done's
// ldr on 29); main is lines 35 to 45 (bl fact on 39).
const FACT = `// Prints 4! worked out by recursion.

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
        mov     w0, 4
        bl      fact
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

// fill writes eight ints into its four-int array: elements 6 and 7 land on
// main's saved lr (line 22 is the store), so main's ret on line 39 goes to
// 7 << 32 | 6.
const OVERRUN = `// fill writes past the end of its array onto main's frame record.

define(fp, x29)
define(lr, x30)

arr_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.text

// fill(w0 = n): arr[i] = i for i < n, with room for four
        .balign 4
        .global fill
fill:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x10, fp, arr_s              // the array's base
        mov     w9, 0
        b       fill_test
fill_loop:
        str     w9, [x10, w9, SXTW 2]       // arr[i] = i
        add     w9, w9, 1
fill_test:
        cmp     w9, w0
        b.lt    fill_loop
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 8
        bl      fill
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

// greet sits first in .text, at 0x400000: its ldr, its bl puts at 0x400004,
// its ret at 0x400008 (line 17), which is where the bl left lr pointing.
const LR_UNSAVED = `// greet forgets to save lr before calling puts.

define(fp, x29)
define(lr, x30)

.data
msg:        .string "hi"

.text

// greet(): prints hi, then cannot return
        .balign 4
        .global greet
greet:
        ldr     x0, =msg
        bl      puts
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      greet
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

// scanf's bl is line 21.
const READS = `// Reads one int with scanf.

define(fp, x29)
define(lr, x30)

n_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_in:     .string "%d"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        ldr     x0, =fmt_in
        add     x1, fp, n_s
        bl      scanf
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`;

interface RawRun extends RunResultPayload {
  pc: number;
}

/** One machine and the hub's view of it: what stopReason reads. */
function machine(source: string) {
  const emu: Machine = new Emulator();
  const loaded = emu.assemble_and_load(source) as { success: boolean; error?: string };
  expect(loaded.error ?? null).toBeNull();
  const map = Array.from(emu.get_line_map());
  const lineOf = (addr: number) => {
    for (let i = 0; i + 1 < map.length; i += 2) if (map[i] === addr) return map[i + 1];
    return null;
  };
  const pcOf = (line: number) => {
    for (let i = 0; i + 1 < map.length; i += 2) if (map[i + 1] === line) return map[i];
    throw new Error(`no instruction on line ${line}`);
  };
  const text = source.split("\n");
  const lines: ProgramLines = {
    linePlace: (addr) => {
      const line = lineOf(addr);
      return line == null ? null : { file: null, line, text: text[line - 1] };
    },
    lineAddr: (line) => {
      for (let i = 0; i + 1 < map.length; i += 2) if (map[i + 1] === line) return map[i];
      return null;
    },
  };
  const snapshot = (): StateSnapshot => {
    const exit = emu.get_exit_code();
    return {
      frame: 0,
      registers: Array.from({ length: 31 }, (_, i) => `0x${BigInt(emu.get_register(i)).toString(16)}`),
      fpRegisters: [],
      vectorRegisters: [],
      sp: "0x0",
      pc: `0x${BigInt(emu.get_pc()).toString(16)}`,
      nzcv: 0,
      changedRegs: [],
      changedFpRegs: [],
      halted: emu.is_halted(),
      blocked: emu.is_blocked(),
      exitCode: exit == null ? null : Number(exit),
      canStepBack: false,
      stdoutDelta: "",
      stderrDelta: "",
      vfsFiles: [],
      savedStates: [],
      wantsTerminal: false,
      frames: Array.from(emu.frames()),
      dirtyAddrs: [],
    };
  };
  const layout = { numbers: Array.from(emu.frame_layout()), names: emu.frame_names() };
  const depth = () => callDepth(Array.from(emu.frames()));
  const run = (target: StepTarget, until: { depth?: number; pc?: number }) => {
    const result = emu.run_to(1_000_000, until.depth ?? -1, until.pc ?? -1) as RawRun;
    return { result, said: stopReason(target, result, snapshot(), layout, lines) };
  };
  return {
    emu,
    pcOf,
    depth,
    over: () => run("over", { depth: depth() }),
    out: () => run("out", { depth: depth() - 1 }),
    to: (line: number) => run(line, { pc: pcOf(line) }),
  };
}

describe("step over, step out and run to cursor on the machine", () => {
  it("runs to the caret's line, then over the call on it", () => {
    const m = machine(FACT);
    const to = m.to(39);
    // stp, mov, mov w0.
    expect(to.result).toMatchObject({ reached: true, steps_executed: 3 });
    expect(to.said).toEqual({ text: "reached line 39", problem: false });
    const over = m.over();
    // The bl and fact(4): 12 + 12 + 12 + 11.
    expect(over.result).toMatchObject({ reached: true, steps_executed: 48 });
    expect(over.said).toEqual({ text: "reached line 40", problem: false });
    expect(Number(m.emu.get_register(0))).toBe(24);
    m.emu.free();
  });

  it("says nothing for a step over that moved one instruction", () => {
    const m = machine(FACT);
    expect(m.over()).toMatchObject({ result: { reached: true, steps_executed: 1 }, said: null });
    m.emu.free();
  });

  it("steps out of the third level into the second", () => {
    const m = machine(FACT);
    m.to(16);
    m.to(16);
    expect(m.depth()).toBe(3);
    const out = m.out();
    expect(out.result.reached).toBe(true);
    expect(out.said?.text).toBe("returned to fact at line 27");
    expect(m.depth()).toBe(2);
    expect(Number(m.emu.get_register(0))).toBe(6);
    m.emu.free();
  });

  it("stops a step over at a breakpoint inside the call", () => {
    const m = machine(FACT);
    m.to(39);
    m.emu.set_breakpoint(m.pcOf(29));
    const over = m.over();
    expect(over.result).toMatchObject({ hit_breakpoint: true, reached: false });
    expect(over.said?.text).toBe("stopped at the breakpoint on line 29");
    m.emu.free();
  });

  it("steps out of main to the program's exit", () => {
    const m = machine(FACT);
    const out = m.out();
    expect(out.result).toMatchObject({ halted: true, reached: false });
    expect(out.said?.text).toBe("the program exited with code 0");
    m.emu.free();
  });

  it("waits for input inside a step over of scanf", () => {
    const m = machine(READS);
    m.to(21);
    const over = m.over();
    expect(over.result.reached).toBe(false);
    expect(over.said?.text).toBe("waiting for input");
    m.emu.free();
  });

  // The words are the frames view's card for the same return. By hand: fill's
  // loop stores arr[i] at step 12 + 4i (stp, mov, mov w0 and bl in main, then
  // fill's stp, mov, add, mov and b, then cmp and b.lt), so arr[7] at step 40.
  it("names the store behind a ret through an overwritten lr", () => {
    const m = machine(OVERRUN);
    m.to(39);
    const over = m.over();
    expect(over.result).toMatchObject({ bad_return: true, reached: false, halted: false });
    expect(over.result.pc).toBe(0x7_0000_0006);
    expect(over.said).toEqual({
      text:
        "main's ret on line 39 jumped to 0x700000006 instead of going back to the C runtime, " +
        "because line 22 in fill overwrote the saved lr in main's frame at step 40.",
      problem: true,
      card: expect.objectContaining({ cause: "overwritten" }),
    });
    m.emu.free();
  });

  // greet's ret goes to 0x400008, itself; main's mov after bl greet is line 25.
  it("names a call made before lr was saved", () => {
    const m = machine(LR_UNSAVED);
    m.to(17);
    const over = m.over();
    expect(over.result).toMatchObject({ bad_return: true, pc: 0x400008 });
    expect(over.said?.card?.cause).toBe("unsaved");
    expect(over.said?.text).toBe(
      "greet's ret on line 17 went back into greet instead of going back to main at line 25, " +
        "because greet called out with `bl puts` on line 16 before saving lr, so lr still held " +
        "that call's return address.",
    );
    m.emu.free();
  });
});
