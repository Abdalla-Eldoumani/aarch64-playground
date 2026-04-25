import { describe, expect, test, vi } from "vitest";
import { WorkerClient } from "@/lib/worker/client";
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
});
