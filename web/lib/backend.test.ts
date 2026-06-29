import { afterEach, describe, expect, test, vi } from "vitest";

// Holder for the value `spawnEmulatorWorker` returns. The hoisted mock reads
// it lazily so each test decides whether a worker is "available".
const h = vi.hoisted(() => ({ worker: null as unknown }));

vi.mock("@/lib/worker/client", () => ({
  spawnEmulatorWorker: () => h.worker,
}));

import { pickBackend } from "@/lib/backend";

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
