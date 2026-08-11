import { afterEach, describe, expect, test, vi } from "vitest";

// Holder for the value `spawnEmulatorWorker` returns. The hoisted mock reads
// it lazily so each test decides whether a worker is "available".
const h = vi.hoisted(() => ({ worker: null as unknown }));

vi.mock("@/lib/worker/client", () => ({
  spawnEmulatorWorker: () => h.worker,
}));

// A minimal fake wasm wrapper: runs never halt, so runUntilBreak only
// stops when a flag (pause, cap) says so. Only the members the backend
// touches during runUntilBreak/snapshot exist.
function fakeEmu() {
  return {
    runUntilBreak: (max: number) => ({
      pc: 0x400000,
      halted: false,
      steps_executed: max,
      hit_breakpoint: false,
      error: null,
    }),
    isBlocked: () => false,
    isHalted: () => false,
    getAllRegisters: () => ({ gpr: [], sp: "0", pc: "0", nzcv: 0 }),
    getFpRegisters: () => [],
    getChangedRegisters: () => [],
    getChangedFpRegisters: () => [],
    getExitCode: () => null,
    canStepBack: () => false,
    takeStdout: () => "",
    takeStderr: () => "",
    listVfsFiles: () => [],
    listStates: () => [],
    takeDirtyAddrs: () => [],
    wantsTerminal: () => false,
    hostCallContext: () => null,
  };
}

vi.mock("@/lib/emulator/emulator", () => ({
  loadEmulator: async () => fakeEmu(),
}));

import { pickBackend } from "@/lib/emulator/backend";

const BACKEND_KEY = "aarch64-playground:backend";

function setPref(value: string | null) {
  if (value === null) window.localStorage.removeItem(BACKEND_KEY);
  else window.localStorage.setItem(BACKEND_KEY, value);
}

// A sentinel standing in for a real WorkerClient; pickBackend returns it by
// reference when it chooses the worker path.
function workerSentinel() {
  return { onSnapshot: () => () => {}, assemble: () => {}, step: () => {} };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  h.worker = null;
});

describe("pickBackend", () => {
  test("returns the worker backend when one is available and no override is set", () => {
    const sentinel = workerSentinel();
    h.worker = sentinel;
    setPref(null);
    expect(pickBackend()).toBe(sentinel);
  });

  test("force 'main' selects the main-thread backend and never spawns a worker", () => {
    const sentinel = workerSentinel();
    h.worker = sentinel;
    setPref("main");
    const backend = pickBackend();
    expect(backend).not.toBe(sentinel);
    expect(typeof backend.assemble).toBe("function");
    expect(typeof backend.onSnapshot).toBe("function");
  });

  test("falls back to the main-thread backend when no worker is available", () => {
    h.worker = null;
    setPref(null);
    const backend = pickBackend();
    expect(typeof backend.step).toBe("function");
    expect(typeof backend.onSnapshot).toBe("function");
  });

  test("force 'worker' uses the worker when one is available", () => {
    const sentinel = workerSentinel();
    h.worker = sentinel;
    setPref("worker");
    expect(pickBackend()).toBe(sentinel);
  });

  test("a throwing localStorage does not break selection", () => {
    const sentinel = workerSentinel();
    h.worker = sentinel;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    expect(pickBackend()).toBe(sentinel);
  });
});

describe("MainThreadBackend pause parity", () => {
  test("a pause between chunks stops the loop like the worker's flag", async () => {
    setPref("main");
    const backend = pickBackend()!;
    await backend.init();
    // 100 chunks of 10k; pause lands during the first between-chunk yield.
    const run = backend.runUntilBreak(1_000_000);
    await backend.pause();
    const { runResult } = await run;
    expect(runResult.steps_executed).toBeLessThan(1_000_000);
  });

  test("a fresh run clears the previous pause", async () => {
    setPref("main");
    const backend = pickBackend()!;
    await backend.init();
    const first = backend.runUntilBreak(1_000_000);
    await backend.pause();
    await first;
    // The next run must not inherit the stale flag: with the fake's
    // never-halting machine it runs its full budget.
    const { runResult } = await backend.runUntilBreak(30_000);
    expect(runResult.steps_executed).toBe(30_000);
  });
});
