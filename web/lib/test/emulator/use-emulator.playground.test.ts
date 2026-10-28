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
      expect(view.result.current.stepCount).toBe(4 + k * 1_000_000);
    }
    // The fifth press runs the last 500,010: 4 + 4,500,010.
    expect(await press(view, "over")).toBe("reached line 36");
    expect(view.result.current.stepCount).toBe(4_500_014);
    expect(view.result.current.error).toBeNull();
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
    // In work's loop, two calls deep, with no call on the line: one instruction.
    expect(await press(view, "over")).toBeNull();
    expect(view.result.current.stepCount).toBe(2_000_005);
  }, 60_000);

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
