import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import { useEmulator } from "@/lib/emulator/use-emulator";
import type { StepTarget } from "@/lib/emulator/emulator-state";
import { createTerminalContext } from "@/lib/playground/terminal-context";
import { dispatchCommand } from "@/lib/terminal/dispatch";

// Step over and step out past the run's 1,000,000-step chunk, on the hub over
// the main-thread backend and the real node build: the hub, the backend and
// the run loop are the shipped ones. Step counts are worked out by hand.
const nodeRequire = createRequire(import.meta.url);
const wasm = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import(
  "@/lib/wasm-node/aarch64_emulator"
);
type Machine = InstanceType<typeof wasm.Emulator>;
const machines: Machine[] = [];

// The web build of the wasm cannot load under node, so each hub's machine is
// a node one.
vi.mock("@/lib/emulator/emulator", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/emulator/emulator")>();
  return {
    ...real,
    loadEmulator: async () => {
      const emu = new wasm.Emulator();
      machines.push(emu);
      return new real.EmulatorInstance(emu);
    },
    detectHostedMode: async (source: string) => wasm.detectHostedMode(source),
    loadMemoryMap: async () => normalizeMemoryMap(wasm.memoryMap()),
  };
});

beforeEach(() => {
  window.localStorage.setItem("aarch64-playground:backend", "main");
});

afterEach(() => {
  cleanup();
  for (const emu of machines.splice(0)) emu.free();
});

// work(n) counts to n one pass at a time: stp, mov, mov w9 and b (4), then
// cmp and b.lt for each count 0 to n and an add for each of 1 to n (3n + 2),
// then mov, ldp and ret (3): 3n + 9 steps, so the bl and work(n) take
// 3n + 10. main's bl work is line 35, the mov after it line 36.
const counting = (n: number, low: string, high: string) => `// Counts to ${n} inside a function, one pass at a time.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "count = %d\\n"

.text

// work(w0 = n) -> w0 = n, one loop pass at a time
        .balign 4
        .global work
work:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w9, 0                       // count
        b       wk_test
wk_loop:
        add     w9, w9, 1
wk_test:
        cmp     w9, w0
        b.lt    wk_loop
        mov     w0, w9
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, ${low}
        movk    w0, ${high}, lsl 16         // w0 = n
        bl      work
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

// 1,500,000 is 0x16e360: the bl and work take 4,500,010 steps.
const LONG = counting(1_500_000, "0xe360", "0x16");
// 500,000 is 0x7a120: the bl and work take 1,500,010 steps.
const LONGISH = counting(500_000, "0xa120", "0x7");

// spin never returns. main's bl spin is line 19.
const SPIN = `// spin loops forever: an exit condition that never becomes true.

define(fp, x29)
define(lr, x30)

.text

// spin(): never returns
        .balign 4
        .global spin
spin:
        b       spin

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      spin
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

// A load through a null pointer on line 7: a fault.
const NULL_READ = `// reads through a null pointer
        .text
        .balign 4
        .global main
main:
        mov     x0, 0
        ldr     x1, [x0]
        ret
`;

const paused = (goal: string) =>
  `paused after 1,000,000 steps, before the ${goal} finished. ${goal} again to go on, ` +
  "or check for a loop whose exit condition never becomes true";

/** A hub with `source` assembled and run to `line`, the bl the tests step over. */
async function stoppedAt(source: string, line: number) {
  const view = renderHook(() => useEmulator());
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  await act(async () => {
    await expect(view.result.current.assemble(source)).resolves.toBe(true);
  });
  await press(view, line);
  return view;
}

type Hub = Awaited<ReturnType<typeof stoppedAt>>;

async function press(view: Pick<Hub, "result">, target: StepTarget): Promise<string | null> {
  let said: string | null = null;
  await act(async () => {
    said = await view.result.current.runUntil(target);
  });
  return said;
}

async function gdb(view: Hub, command: string) {
  const ctx = createTerminalContext({
    machine: {
      get current() {
        return view.result.current;
      },
    },
    workspace: () => ({ main: "", extras: [] }),
    applySeeds: vi.fn(),
    stageVfsFile: vi.fn(),
    removeVfsFile: vi.fn(async () => true),
    driveForeground: vi.fn(async () => 0),
    executables: new Map(),
  });
  let lines: string[] = [];
  await act(async () => {
    lines = (await dispatchCommand(`gdb ${command}`, ctx)).lines;
  });
  return lines;
}

describe("a goal run past the 1,000,000-step run chunk", () => {
  it("pauses with words that say how to go on, and the same press goes on to the line after the call", async () => {
    // stp, mov, mov and movk: the bl is next, 4 steps in.
    const view = await stoppedAt(LONG, 35);
    expect(view.result.current.stepCount).toBe(4);
    for (const k of [1, 2, 3, 4]) {
      expect(await press(view, "over")).toBe(paused("step over"));
      expect(view.result.current.error).toBe(paused("step over"));
      // A pause, not a fault: the status line says so in plain words.
      expect(view.result.current.paused).toBe(true);
      expect(view.result.current.stepCount).toBe(4 + k * 1_000_000);
    }
    // The fifth press runs the last 500,010: 4 + 4,500,010.
    expect(await press(view, "over")).toBe("reached line 36");
    expect(view.result.current.stepCount).toBe(4_500_014);
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.paused).toBe(false);
    expect(view.result.current.stopReason).toBe("reached line 36");
    expect(BigInt(view.result.current.registers[0])).toBe(1_500_000n);
  }, 60_000);

  it("leaves run a plain run, and a later step over starts from where that run stopped", async () => {
    const view = await stoppedAt(LONG, 35);
    expect(await press(view, "over")).toBe(paused("step over"));
    act(() => {
      view.result.current.run();
    });
    // A whole chunk of its own, with run's words: 1,000,004 + 1,000,000.
    await waitFor(() => expect(view.result.current.stepCount).toBe(2_000_004), { timeout: 20_000 });
    await waitFor(() => expect(view.result.current.isRunning).toBe(false));
    expect(view.result.current.error).toBe(
      "paused after 1,000,000 steps without finishing. " +
        "press run to continue, or check for a loop whose exit condition never becomes true",
    );
    expect(view.result.current.paused).toBe(true);
    // In work's loop, two calls deep, with no call on the line: one instruction.
    expect(await press(view, "over")).toBeNull();
    expect(view.result.current.stepCount).toBe(2_000_005);
    expect(view.result.current.paused).toBe(false);
  }, 60_000);

  it("calls a fault an error, never a pause", async () => {
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await act(async () => {
      await expect(view.result.current.assemble(NULL_READ)).resolves.toBe(true);
    });
    act(() => {
      view.result.current.run();
    });
    await waitFor(() => expect(view.result.current.error).toMatch(/^line 7: stopped: tried to read from address 0x0/));
    expect(view.result.current.paused).toBe(false);
  });

  it("goes on the same way through gdb ni", async () => {
    const view = await stoppedAt(LONGISH, 35);
    expect(await gdb(view, "ni")).toEqual([paused("step over")]);
    expect(view.result.current.stepCount).toBe(1_000_004);
    // 4 + 1,500,010.
    expect(await gdb(view, "ni")).toEqual(["reached line 36"]);
    expect(view.result.current.stepCount).toBe(1_500_014);
  }, 60_000);

  it("says the same for finish from inside the call", async () => {
    // Into work: the bl and its stp, 6 steps in, two calls deep.
    const view = await stoppedAt(LONGISH, 16);
    expect(view.result.current.stepCount).toBe(6);
    expect(await gdb(view, "finish")).toEqual([paused("step out")]);
    // 6 + 1,000,000, then the rest of the 1,500,010: back in main on line 36.
    expect(await gdb(view, "finish")).toEqual(["returned to main at line 36"]);
    expect(view.result.current.stepCount).toBe(1_500_014);
  }, 60_000);

  it("keeps the playground's 10,000,000-step ceiling in its own words", async () => {
    // stp and mov: the bl is next, 2 steps in. Nine presses pause at
    // 9,000,002; the tenth meets the ceiling at 10,000,000 instructions.
    const view = await stoppedAt(SPIN, 19);
    for (let k = 1; k <= 9; k++) expect(await press(view, "over")).toBe(paused("step over"));
    expect(view.result.current.stepCount).toBe(9_000_002);
    expect(await press(view, "over")).toBeNull();
    expect(view.result.current.error).toMatch(/stopped after 10 million steps, which is the playground's ceiling/);
    expect(view.result.current.isHalted).toBe(true);
  }, 120_000);
});

describe("a stop's words on the real hub", () => {
  const exitsWith = (code: number) => `// main leaves ${code} as its exit code.
        .text
        .balign 4
        .global main
main:
        mov     w0, ${code}
        ret
`;

  it("does not say an old program's exit code when a new one runs to the same count", async () => {
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await act(async () => {
      await expect(view.result.current.assemble(exitsWith(3))).resolves.toBe(true);
    });
    expect(await press(view, "out")).toBe("the program exited with code 3");
    expect(view.result.current.stopReason).toBe("the program exited with code 3");
    const steps = view.result.current.stepCount;

    await act(async () => {
      await expect(view.result.current.assemble(exitsWith(5))).resolves.toBe(true);
    });
    act(() => {
      view.result.current.run();
    });
    await waitFor(() => expect(view.result.current.exitCode).toBe(5));
    await waitFor(() => expect(view.result.current.isRunning).toBe(false));
    expect(view.result.current.stepCount).toBe(steps);
    expect(view.result.current.stopReason).toBeNull();
  });

  it("prints a bad return's card through gdb without the backticks that mark its code", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures/lr-not-saved.s"), "utf8");
    // show's bl print_n: it comes back to its own ret, so finish goes nowhere.
    const view = await stoppedAt(source, 28);
    const [line] = await gdb(view, "finish");
    expect(line).toContain("show called out with bl print_n on line 28 before saving lr");
    expect(line).not.toContain("`");
  });
});

// main calls quit, which ends the program through exit(3). quit's four
// instructions start the text at 0x400000; with mainFirst, main's six go
// first and quit starts 24 bytes on, at 0x400018.
const quits = (mainFirst: boolean) => {
  const quit = `
// quit(): never returns
        .balign 4
        .global quit
quit:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 3                       // exit code
        bl      exit
`;
  const main = `
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      quit
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;
  return `// Ends the program from inside a function, through exit(3).

define(fp, x29)
define(lr, x30)

.text
${mainFirst ? main + quit : quit + main}`;
};

async function assembled(view: Pick<Hub, "result">, source: string) {
  await act(async () => {
    await expect(view.result.current.assemble(source)).resolves.toBe(true);
  });
}

describe("gdb b across a reset", () => {
  // gdb keeps a breakpoint when the program starts again and sets it again by
  // its name; Reset and Assemble are the playground's restart.
  it("stops at the breakpoint again once the program is assembled after a reset", async () => {
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await assembled(view, quits(false));
    expect(await gdb(view, "b quit")).toEqual(["breakpoint 1 at 0x0000000000400000 (quit)"]);
    act(() => view.result.current.reset());
    await assembled(view, quits(false));
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBeNull();
    expect(view.result.current.pc).toBe(0x400000);
  });

  it("finds the label again in the program as it reads now", async () => {
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await assembled(view, quits(false));
    await gdb(view, "b quit");
    act(() => view.result.current.reset());
    await assembled(view, quits(true));
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBeNull();
    expect(view.result.current.pc).toBe(0x400018);
  });

  it("says once, at the next gdb command, which breakpoint it could not set again", async () => {
    // gdb: 'Error in re-setting breakpoint 1: Function "quit" not defined.'
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await assembled(view, quits(false));
    await gdb(view, "b quit");
    act(() => view.result.current.reset());
    await assembled(view, quits(false).replaceAll("quit", "leave"));
    const listed = ["Num  Address             What", "1    pending             quit"];
    expect(await gdb(view, "info breakpoints")).toEqual([
      "gdb: error in re-setting breakpoint 1: unknown label 'quit'",
      ...listed,
    ]);
    expect(await gdb(view, "info breakpoints")).toEqual(listed);
  });

  // Loading another program clears every breakpoint, the gutter's included.
  it("drops it when another program is loaded", async () => {
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await assembled(view, quits(false));
    await gdb(view, "b quit");
    act(() => {
      view.result.current.clearAllBreakpoints();
      view.result.current.reset();
    });
    await assembled(view, quits(false));
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBe(3);
  });
});

// gdb numbers each breakpoint ("Breakpoint 1 at 0x4007b8"), never gives a
// number twice, and deletes one by number or all with a bare delete, printing
// nothing; a deleted breakpoint no longer stops the run.
describe("gdb delete on the real hub", () => {
  async function hubWith(source: string) {
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await assembled(view, source);
    return view;
  }

  it("deletes one breakpoint by its number, and the run goes past it", async () => {
    const view = await hubWith(quits(false));
    expect(await gdb(view, "b quit")).toEqual(["breakpoint 1 at 0x0000000000400000 (quit)"]);
    // quit's four instructions come first, so main starts at 0x400010.
    expect(await gdb(view, "b main")).toEqual(["breakpoint 2 at 0x0000000000400010 (main)"]);
    expect(await gdb(view, "delete 1")).toEqual([]);
    expect(await gdb(view, "info breakpoints")).toEqual([
      "Num  Address             What",
      "2    0x0000000000400010  main",
    ]);
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBe(3);
  });

  it("deletes every breakpoint with no number, and numbers the next one on from there", async () => {
    const view = await hubWith(quits(false));
    await gdb(view, "b quit");
    await gdb(view, "b quit");
    expect(await gdb(view, "delete")).toEqual([]);
    expect(await gdb(view, "info breakpoints")).toEqual(["no breakpoints"]);
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBe(3);
    expect(await gdb(view, "b quit")).toEqual(["breakpoint 3 at 0x0000000000400000 (quit)"]);
  });

  it("says gdb's words for a number it does not have, and keeps the breakpoints it has", async () => {
    const view = await hubWith(quits(false));
    await gdb(view, "b quit");
    expect(await gdb(view, "delete 7")).toEqual(["gdb: no breakpoint number 7"]);
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBeNull();
    expect(view.result.current.pc).toBe(0x400000);
  });

  it("stays deleted after the next assemble and Run", async () => {
    const view = await hubWith(quits(false));
    await gdb(view, "b quit");
    await gdb(view, "delete 1");
    await assembled(view, quits(false));
    act(() => {
      void view.result.current.run();
    });
    await waitFor(() => expect(view.result.current.exitCode).toBe(3));
  });

  it("does nothing and says nothing when there are none", async () => {
    const view = await hubWith(quits(false));
    expect(await gdb(view, "delete")).toEqual([]);
    expect(await gdb(view, "info breakpoints")).toEqual(["no breakpoints"]);
  });

  // A gutter dot on the same instruction is a stop of its own.
  it("leaves a gutter dot's stop on the instruction it shared", async () => {
    const view = await hubWith(quits(false));
    // Line 12 is quit's stp, the instruction gdb b quit names.
    act(() => view.result.current.toggleBreakpoint(12));
    await gdb(view, "b quit");
    await gdb(view, "delete 1");
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBeNull();
    expect(view.result.current.pc).toBe(0x400000);
  });

  // gdb's clear deletes every breakpoint on a line, so the list never shows a
  // stop the machine no longer has.
  it("deletes the gdb b on an instruction whose last gutter dot is taken off", async () => {
    const view = await hubWith(quits(false));
    await gdb(view, "b quit");
    act(() => view.result.current.toggleBreakpoint(12));
    act(() => view.result.current.toggleBreakpoint(12));
    expect(await gdb(view, "info breakpoints")).toEqual(["no breakpoints"]);
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBe(3);
  });

  it("deletes every number it is given", async () => {
    const view = await hubWith(quits(false));
    await gdb(view, "b quit");
    await gdb(view, "b main");
    await gdb(view, "b quit");
    expect(await gdb(view, "delete 1 2")).toEqual([]);
    expect(await gdb(view, "info breakpoints")).toEqual([
      "Num  Address             What",
      "3    0x0000000000400000  quit",
    ]);
  });
});

describe("gdb-lite once the program has exited, on the real hub", () => {
  // bt and c read the exit code, so a step back from the exit, which brings
  // the program back, must bring them back too.
  it("lists the frames again and continues after a step back from the exit", async () => {
    const view = renderHook(() => useEmulator());
    await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
    await act(async () => {
      await expect(view.result.current.assemble(quits(false))).resolves.toBe(true);
    });
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBe(3);
    expect(await gdb(view, "bt")).toEqual(["gdb: no frames: the program has finished"]);
    await act(async () => {
      view.result.current.stepBack();
    });
    await waitFor(() => expect(view.result.current.exitCode).toBeNull());
    // Back inside exit, called from quit: the pc is in the library, so quit
    // has no line; main is at its bl quit on line 22.
    expect(await gdb(view, "bt")).toEqual(["#0  quit", "#1  main at line 22"]);
    await gdb(view, "c");
    expect(view.result.current.exitCode).toBe(3);
  });
});

// A call to a local function, a call to printf, a loop, and one m4 line that
// becomes two instructions (line 31). add2 is lines 16 to 20, first in the
// text at 0x400000; main is lines 24 to 42, from 0x400014. Every stop below is
// gdb's own for the same program built with gcc -g, run under qemu-aarch64
// (addresses as add2+N and main+N; GAS lays the program out the same way),
// with lines as the editor numbers them.
const STEPS = `// Small program for gdb's next and step: straight-line code, a call to a
// local function, a call to printf, a loop, and one m4 line that becomes
// two instructions.
define(fp, x29)
define(lr, x30)
define(sum_r, w19)
define(i_r, w20)
define(clear2, \`mov     w21, 0
        mov     w22, 0')

        .data
fmt:    .string "sum %d\\n"

        .text
        .balign 4
add2:   stp     fp, lr, [sp, -16]!
        mov     fp, sp
        add     w0, w0, w1
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     sum_r, 0
        mov     w0, 3
        mov     w1, 4
        bl      add2
        mov     sum_r, w0
        clear2
        mov     i_r, 0
loop:   add     sum_r, sum_r, i_r
        add     i_r, i_r, 1
        cmp     i_r, 3
        b.lt    loop
        ldr     x0, =fmt
        mov     w1, sum_r
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;
const ADD2 = 0x400000;
const MAIN = 0x400014;

describe("gdb n and s, stop for stop with gdb on a -g build", () => {
  /** Each command's words, then where it left the pc. */
  async function stops(view: Hub, commands: string[]) {
    const out: [string[], number][] = [];
    for (const command of commands) out.push([await gdb(view, command), view.result.current.pc]);
    return out;
  }
  const reached = (line: number, pc: number): [string[], number] => [[`reached line ${line}`], pc];

  it("steps a line at a time, and a count of lines at once", async () => {
    expect(await stops(await stoppedAt(STEPS, 26), ["n", "n"])).toEqual([
      reached(27, MAIN + 12),
      reached(28, MAIN + 16),
    ]);
    expect(await stops(await stoppedAt(STEPS, 26), ["n 3"])).toEqual([reached(29, MAIN + 20)]);
  });

  it("runs a local call whole with n, and goes into it with s", async () => {
    const over = await stoppedAt(STEPS, 29);
    expect(await stops(over, ["n"])).toEqual([reached(30, MAIN + 24)]);
    expect(BigInt(over.result.current.registers[0])).toBe(7n);
    expect(await stops(await stoppedAt(STEPS, 29), ["s", "s", "s", "s"])).toEqual([
      reached(16, ADD2),
      reached(17, ADD2 + 4),
      reached(18, ADD2 + 8),
      reached(19, ADD2 + 12),
    ]);
    expect(await stops(await stoppedAt(STEPS, 28), ["s 3"])).toEqual([reached(17, ADD2 + 4)]);
    expect(await stops(await stoppedAt(STEPS, 28), ["s 6"])).toEqual([reached(20, ADD2 + 16)]);
  });

  it("goes back to the caller from a callee's ret with n and with s", async () => {
    expect(await stops(await stoppedAt(STEPS, 20), ["n", "n"])).toEqual([
      reached(30, MAIN + 24),
      reached(31, MAIN + 28),
    ]);
    expect(await stops(await stoppedAt(STEPS, 20), ["s"])).toEqual([reached(30, MAIN + 24)]);
  });

  it("takes an m4 line of two instructions as one line", async () => {
    // gdb follows m4's output there, where they are two lines.
    expect(await stops(await stoppedAt(STEPS, 30), ["n", "n"])).toEqual([
      reached(31, MAIN + 28),
      reached(32, MAIN + 36),
    ]);
  });

  it("follows a loop's back edge to its top", async () => {
    const view = await stoppedAt(STEPS, 36);
    expect(BigInt(view.result.current.registers[20])).toBe(1n);
    expect(await stops(view, ["n"])).toEqual([reached(33, MAIN + 40)]);
    expect(BigInt(view.result.current.registers[20])).toBe(1n);
    expect(await stops(view, ["n 4"])).toEqual([reached(33, MAIN + 40)]);
    expect(BigInt(view.result.current.registers[20])).toBe(2n);
  });

  it("runs printf whole with n and with s", async () => {
    for (const command of ["n", "s"]) {
      const view = await stoppedAt(STEPS, 39);
      expect(await stops(view, [command])).toEqual([reached(40, MAIN + 68)]);
      expect(view.result.current.stdout).toBe("sum 10\n");
    }
  });

  it("stops at main's return before the exit, so counts come out as gdb's", async () => {
    const view = await stoppedAt(STEPS, 41);
    const [ret, out, exit] = await stops(view, ["n", "n", "n"]);
    expect(ret).toEqual(reached(42, MAIN + 76));
    expect(out[0]).toEqual(["main has returned; the next n or s ends the program"]);
    expect(exit[0]).toEqual(["the program exited with code 0"]);
    expect(view.result.current.exitCode).toBe(0);
    expect(await gdb(view, "n")).toEqual(["gdb: the program has finished"]);
  });

  it("stops a count at the exit and says only that", async () => {
    const view = await stoppedAt(STEPS, 40);
    expect(await gdb(view, "n 5")).toEqual(["the program exited with code 0"]);
    expect(view.result.current.exitCode).toBe(0);
  });

  it("stops at a breakpoint inside the call n runs, then steps on from there", async () => {
    const view = await stoppedAt(STEPS, 29);
    act(() => view.result.current.toggleBreakpoint(18));
    expect(await stops(view, ["n", "n", "n"])).toEqual([
      [["stopped at the breakpoint on line 18"], ADD2 + 8],
      reached(19, ADD2 + 12),
      reached(20, ADD2 + 16),
    ]);
    // s stops at the callee's first instruction, before the breakpoint.
    const into = await stoppedAt(STEPS, 29);
    act(() => into.result.current.toggleBreakpoint(18));
    expect(await stops(into, ["s"])).toEqual([reached(16, ADD2)]);
  });

  it("stops a count at a breakpoint on a line it steps to", async () => {
    const view = await stoppedAt(STEPS, 26);
    act(() => view.result.current.toggleBreakpoint(28));
    expect(await stops(view, ["n 3", "n"])).toEqual([
      [["stopped at the breakpoint on line 28"], MAIN + 16],
      reached(29, MAIN + 20),
    ]);
    const into = await stoppedAt(STEPS, 28);
    expect(await gdb(into, "b add2")).toEqual(["breakpoint 1 at 0x0000000000400000 (add2)"]);
    expect(await stops(into, ["s 2", "s"])).toEqual([
      [["stopped at the breakpoint on line 16"], ADD2],
      reached(17, ADD2 + 4),
    ]);
    const inside = await stoppedAt(STEPS, 28);
    act(() => inside.result.current.toggleBreakpoint(18));
    expect(await stops(inside, ["n 3"])).toEqual([[["stopped at the breakpoint on line 18"], ADD2 + 8]]);
  });

  it("stays put on a count of 0 or less and says where", async () => {
    const view = await stoppedAt(STEPS, 26);
    expect(await stops(view, ["n 0", "s 0", "n -1"])).toEqual([
      [["at line 26"], MAIN + 8],
      [["at line 26"], MAIN + 8],
      [["at line 26"], MAIN + 8],
    ]);
    expect(view.result.current.stepCount).toBe(2);
  });

  it("ends a large count at Pause", async () => {
    // spin's line adds, and the next branches back to it, for as long as it runs.
    const view = await stoppedAt(SPIN.replace("spin:\n        b       spin", "spin:   add     w9, w9, 1\n        b       spin"), 19);
    const ctx = createTerminalContext({
      machine: {
        get current() {
          return view.result.current;
        },
      },
      workspace: () => ({ main: "", extras: [] }),
      applySeeds: vi.fn(),
      stageVfsFile: vi.fn(),
      removeVfsFile: vi.fn(async () => true),
      driveForeground: vi.fn(async () => 0),
      executables: new Map(),
    });
    // Into spin, then its two lines over and over.
    const done = dispatchCommand("gdb s 100000000", ctx);
    await waitFor(() => expect(view.result.current.isRunning).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 200));
    act(() => view.result.current.pause());
    const { lines } = await done;
    await waitFor(() => expect(view.result.current.isRunning).toBe(false));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^reached line 1[12]$/);
    expect(view.result.current.stepCount).toBeGreaterThan(10);
    expect(view.result.current.stepCount).toBeLessThan(1_000_000);
  });
});
