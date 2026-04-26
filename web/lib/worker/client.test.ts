import { describe, expect, test, vi } from "vitest";
import { WorkerClient, spawnEmulatorWorker } from "@/lib/worker/client";
import type { Request, Response, StateSnapshot } from "@/lib/worker/protocol";

function makeSnapshot(): StateSnapshot {
  return {
    frame: 1,
    registers: [],
    sp: "0x0000000080000000",
    pc: "0x0000000000400000",
    nzcv: 0,
    changedRegs: [],
    halted: false,
    blocked: false,
    exitCode: null,
    canStepBack: false,
    stdoutDelta: "",
    stderrDelta: "",
    vfsFiles: [],
    savedStates: [],
    changedMem: false,
    pcTrace: [],
    dirtyAddrs: [],
  };
}

/**
 * The actual worker isn't loadable inside vitest jsdom (the WASM
 * module needs a browser context). These tests exercise the protocol
 * layer with a mock Worker so the message id matching, error
 * propagation, and pending-request cleanup are covered.
 */
function makeMockWorker() {
  const listeners: Record<string, Array<(e: unknown) => void>> = {
    message: [],
    error: [],
  };
  const posted: Request[] = [];
  const w = {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] ??= [];
      listeners[type].push(fn);
    },
    removeEventListener: () => {},
    postMessage: (msg: Request) => {
      posted.push(msg);
    },
    terminate: vi.fn(),
    dispatchEvent: () => true,
    onmessage: null,
    onmessageerror: null,
    onerror: null,
  } as unknown as Worker;

  function fire<R>(response: Response<R>) {
    const ev = { data: response } as MessageEvent;
    listeners.message?.forEach((fn) => fn(ev));
  }

  return { w, posted, fire };
}

describe("WorkerClient", () => {
  test("step request resolves with the matching ok response", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const promise = client.step();
    expect(posted).toHaveLength(1);
    const id = posted[0].id;
    fire({
      id,
      kind: "ok",
      value: {
        stepResult: {
          pc: 0x400000,
          halted: false,
          error: null,
          outcome: "advance",
          exitCode: null,
        },
        snapshot: makeSnapshot(),
      },
    });
    const result = await promise;
    expect(result.stepResult.halted).toBe(false);
    expect(result.stepResult.outcome).toBe("advance");
  });

  test("error response rejects the matching pending promise", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const promise = client.step();
    const id = posted[0].id;
    fire({ id, kind: "error", message: "wasm trap" });
    await expect(promise).rejects.toThrow("wasm trap");
  });

  test("two requests resolve independently and in order", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const a = client.runUntilBreak(1000);
    const b = client.step();
    expect(posted).toHaveLength(2);
    fire({
      id: posted[1].id,
      kind: "ok",
      value: {
        stepResult: { pc: 4, halted: false, error: null, outcome: "advance", exitCode: null },
        snapshot: makeSnapshot(),
      },
    });
    fire({
      id: posted[0].id,
      kind: "ok",
      value: {
        runResult: {
          pc: 8,
          halted: true,
          steps_executed: 100,
          hit_breakpoint: false,
          error: null,
        },
        snapshot: makeSnapshot(),
      },
    });
    const stepResult = await b;
    const runResult = await a;
    expect(stepResult.stepResult.pc).toBe(4);
    expect(runResult.runResult.steps_executed).toBe(100);
  });

  test("terminate rejects pending promises", async () => {
    const { w } = makeMockWorker();
    const client = new WorkerClient(w);
    const promise = client.step();
    client.terminate();
    await expect(promise).rejects.toThrow("worker terminated");
  });

  test("heartbeat fans out to every subscriber", async () => {
    const { w, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const a = vi.fn();
    const b = vi.fn();
    client.onSnapshot(a);
    client.onSnapshot(b);
    fire({ id: -1, kind: "heartbeat", snapshot: makeSnapshot() } as never);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  test("unsubscribing stops further snapshot delivery", async () => {
    const { w, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const cb = vi.fn();
    const off = client.onSnapshot(cb);
    fire({ id: -1, kind: "heartbeat", snapshot: makeSnapshot() } as never);
    off();
    fire({ id: -1, kind: "heartbeat", snapshot: makeSnapshot() } as never);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("ok response with embedded snapshot also fires subscribers", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const cb = vi.fn();
    client.onSnapshot(cb);
    const promise = client.step();
    fire({
      id: posted[0].id,
      kind: "ok",
      value: {
        stepResult: { pc: 4, halted: false, error: null, outcome: "advance", exitCode: null },
        snapshot: makeSnapshot(),
      },
    });
    await promise;
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("ok response that IS a bare snapshot fires subscribers", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const cb = vi.fn();
    client.onSnapshot(cb);
    const promise = client.reset();
    fire({ id: posted[0].id, kind: "ok", value: makeSnapshot() });
    await promise;
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("each request gets a unique monotonic id", async () => {
    const { w, posted } = makeMockWorker();
    const client = new WorkerClient(w);
    void client.step();
    void client.step();
    void client.step();
    const ids = posted.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[1]).toBeGreaterThan(ids[0]);
    expect(ids[2]).toBeGreaterThan(ids[1]);
  });

  test("response with an unknown id is dropped silently", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const promise = client.step();
    expect(() =>
      fire({
        id: 9999,
        kind: "ok",
        value: { stepResult: { pc: 0, halted: false, error: null, outcome: "advance", exitCode: null }, snapshot: makeSnapshot() },
      }),
    ).not.toThrow();
    fire({
      id: posted[0].id,
      kind: "ok",
      value: { stepResult: { pc: 4, halted: false, error: null, outcome: "advance", exitCode: null }, snapshot: makeSnapshot() },
    });
    await expect(promise).resolves.toBeDefined();
  });

  test("spawnEmulatorWorker returns null when Worker is unavailable", () => {
    const original = (globalThis as { Worker?: unknown }).Worker;
    // @ts-expect-error -- intentional removal for the negative path
    delete (globalThis as { Worker?: unknown }).Worker;
    try {
      expect(spawnEmulatorWorker()).toBeNull();
    } finally {
      (globalThis as { Worker?: unknown }).Worker = original;
    }
  });

  test("error event rejects all pending promises with the event message", async () => {
    const { w } = makeMockWorker();
    const listeners: Record<string, Array<(e: unknown) => void>> = {};
    const monkey = w as unknown as {
      addEventListener: (t: string, fn: (e: unknown) => void) => void;
    };
    const orig = monkey.addEventListener;
    monkey.addEventListener = (t: string, fn: (e: unknown) => void) => {
      listeners[t] ??= [];
      listeners[t].push(fn);
      orig.call(w, t, fn);
    };
    const client = new WorkerClient(w);
    const a = client.step();
    const b = client.runUntilBreak(1);
    listeners.error?.forEach((fn) => fn({ message: "wasm crash" }));
    await expect(a).rejects.toThrow("wasm crash");
    await expect(b).rejects.toThrow("wasm crash");
  });
});
