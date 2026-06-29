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

// Drives one method through the post/resolve round trip: invoke it, grab the
// matching posted request, fire its ok response, and hand back both so a test
// asserts the wire shape and the resolved value in one place.
function call(invoke: (c: WorkerClient) => Promise<unknown>) {
  const { w, posted, fire } = makeMockWorker();
  const client = new WorkerClient(w);
  const promise = invoke(client);
  return { posted, fire, promise };
}

describe("WorkerClient init", () => {
  test("posts an init request the first time and again after initialization", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const first = client.init();
    expect(posted[0].kind).toBe("init");
    fire({ id: posted[0].id, kind: "ok", value: makeSnapshot() });
    await first;

    const second = client.init();
    expect(posted).toHaveLength(2);
    expect(posted[1].kind).toBe("init");
    fire({ id: posted[1].id, kind: "ok", value: makeSnapshot() });
    await expect(second).resolves.toMatchObject({ frame: 1 });
  });
});

describe("WorkerClient protocol round-trips", () => {
  test("assemble posts source and args and resolves the result payload", async () => {
    const { posted, fire, promise } = call((c) => c.assemble("mov x0, 1", ["alpha"]));
    expect(posted[0]).toMatchObject({ kind: "assemble", source: "mov x0, 1", args: ["alpha"] });
    const value = { result: { success: true, instruction_count: 1 }, snapshot: makeSnapshot() };
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toEqual(value);
  });

  test("stepBack posts stepBack and resolves the step result", async () => {
    const { posted, fire, promise } = call((c) => c.stepBack());
    expect(posted[0].kind).toBe("stepBack");
    const value = {
      stepResult: { pc: 0, halted: false, error: null, outcome: "advance", exitCode: null },
      snapshot: makeSnapshot(),
    };
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toEqual(value);
  });

  test("runUntilBreak posts the max step budget", async () => {
    const { posted, fire, promise } = call((c) => c.runUntilBreak(1234));
    expect(posted[0]).toMatchObject({ kind: "runUntilBreak", maxSteps: 1234 });
    const value = {
      runResult: { pc: 0, halted: true, steps_executed: 12, hit_breakpoint: false, error: null },
      snapshot: makeSnapshot(),
    };
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toEqual(value);
  });

  test("pause posts pause and resolves undefined", async () => {
    const { posted, fire, promise } = call((c) => c.pause());
    expect(posted[0].kind).toBe("pause");
    fire({ id: posted[0].id, kind: "ok", value: null });
    await expect(promise).resolves.toBeUndefined();
  });

  test("pushStdin posts text and resolves a snapshot", async () => {
    const { posted, fire, promise } = call((c) => c.pushStdin("hi"));
    expect(posted[0]).toMatchObject({ kind: "pushStdin", text: "hi" });
    const value = makeSnapshot();
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toBe(value);
  });

  test("takeStdout posts takeStdout and resolves the buffered text", async () => {
    const { posted, fire, promise } = call((c) => c.takeStdout());
    expect(posted[0].kind).toBe("takeStdout");
    fire({ id: posted[0].id, kind: "ok", value: "out" });
    await expect(promise).resolves.toBe("out");
  });

  test("takeStderr posts takeStderr and resolves the buffered text", async () => {
    const { posted, fire, promise } = call((c) => c.takeStderr());
    expect(posted[0].kind).toBe("takeStderr");
    fire({ id: posted[0].id, kind: "ok", value: "err" });
    await expect(promise).resolves.toBe("err");
  });

  test("getMemory posts addr and len and resolves the bytes", async () => {
    const { posted, fire, promise } = call((c) => c.getMemory(0x1000, 8));
    expect(posted[0]).toMatchObject({ kind: "getMemory", addr: 0x1000, len: 8 });
    const value = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toBe(value);
  });

  test("getSnapshot posts getSnapshot and resolves the snapshot", async () => {
    const { posted, fire, promise } = call((c) => c.getSnapshot());
    expect(posted[0].kind).toBe("getSnapshot");
    const value = makeSnapshot();
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toBe(value);
  });

  test("setBreakpoint posts the address and resolves undefined", async () => {
    const { posted, fire, promise } = call((c) => c.setBreakpoint(0x400010));
    expect(posted[0]).toMatchObject({ kind: "setBreakpoint", addr: 0x400010 });
    fire({ id: posted[0].id, kind: "ok", value: null });
    await expect(promise).resolves.toBeUndefined();
  });

  test("clearBreakpoint posts the address and resolves undefined", async () => {
    const { posted, fire, promise } = call((c) => c.clearBreakpoint(0x400010));
    expect(posted[0]).toMatchObject({ kind: "clearBreakpoint", addr: 0x400010 });
    fire({ id: posted[0].id, kind: "ok", value: null });
    await expect(promise).resolves.toBeUndefined();
  });

  test("saveState posts the name and resolves a snapshot", async () => {
    const { posted, fire, promise } = call((c) => c.saveState("chk1"));
    expect(posted[0]).toMatchObject({ kind: "saveState", name: "chk1" });
    const value = makeSnapshot();
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toBe(value);
  });

  test("loadState posts the name and resolves ok plus snapshot", async () => {
    const { posted, fire, promise } = call((c) => c.loadState("chk1"));
    expect(posted[0]).toMatchObject({ kind: "loadState", name: "chk1" });
    const value = { ok: true, snapshot: makeSnapshot() };
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toEqual(value);
  });

  test("deleteState posts the name and resolves ok plus snapshot", async () => {
    const { posted, fire, promise } = call((c) => c.deleteState("chk1"));
    expect(posted[0]).toMatchObject({ kind: "deleteState", name: "chk1" });
    const value = { ok: false, snapshot: makeSnapshot() };
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toEqual(value);
  });

  test("listStates posts listStates and resolves the names", async () => {
    const { posted, fire, promise } = call((c) => c.listStates());
    expect(posted[0].kind).toBe("listStates");
    fire({ id: posted[0].id, kind: "ok", value: ["a", "b"] });
    await expect(promise).resolves.toEqual(["a", "b"]);
  });

  test("uploadVfsFile posts the path and data and resolves a snapshot", async () => {
    const data = new Uint8Array([4, 2]);
    const { posted, fire, promise } = call((c) => c.uploadVfsFile("notes.bin", data));
    expect(posted[0]).toMatchObject({ kind: "uploadVfsFile", path: "notes.bin", data });
    const value = makeSnapshot();
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toBe(value);
  });

  test("listVfsFiles posts listVfsFiles and resolves the paths", async () => {
    const { posted, fire, promise } = call((c) => c.listVfsFiles());
    expect(posted[0].kind).toBe("listVfsFiles");
    fire({ id: posted[0].id, kind: "ok", value: ["f.bin"] });
    await expect(promise).resolves.toEqual(["f.bin"]);
  });

  test("readVfsFile posts the path and resolves the bytes", async () => {
    const { posted, fire, promise } = call((c) => c.readVfsFile("notes.bin"));
    expect(posted[0]).toMatchObject({ kind: "readVfsFile", path: "notes.bin" });
    const value = new Uint8Array([7, 8, 9]);
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toBe(value);
  });

  test("deleteVfsFile posts the path and resolves removed plus snapshot", async () => {
    const { posted, fire, promise } = call((c) => c.deleteVfsFile("notes.bin"));
    expect(posted[0]).toMatchObject({ kind: "deleteVfsFile", path: "notes.bin" });
    const value = { removed: true, snapshot: makeSnapshot() };
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toEqual(value);
  });

  test("resolveLabel posts the name and resolves an address", async () => {
    const { posted, fire, promise } = call((c) => c.resolveLabel("main"));
    expect(posted[0]).toMatchObject({ kind: "resolveLabel", name: "main" });
    fire({ id: posted[0].id, kind: "ok", value: 0x400000 });
    await expect(promise).resolves.toBe(0x400000);
  });

  test("resolveLabel resolves null for an unknown label", async () => {
    const { posted, fire, promise } = call((c) => c.resolveLabel("ghost"));
    fire({ id: posted[0].id, kind: "ok", value: null });
    await expect(promise).resolves.toBeNull();
  });

  test("clearConsole posts clearConsole and resolves a snapshot", async () => {
    const { posted, fire, promise } = call((c) => c.clearConsole());
    expect(posted[0].kind).toBe("clearConsole");
    const value = makeSnapshot();
    fire({ id: posted[0].id, kind: "ok", value });
    await expect(promise).resolves.toBe(value);
  });

  test("codeBase posts codeBase and resolves the base address", async () => {
    const { posted, fire, promise } = call((c) => c.codeBase());
    expect(posted[0].kind).toBe("codeBase");
    fire({ id: posted[0].id, kind: "ok", value: 0x400000 });
    await expect(promise).resolves.toBe(0x400000);
  });

  test("lineMap posts lineMap and resolves the flat map", async () => {
    const { posted, fire, promise } = call((c) => c.lineMap());
    expect(posted[0].kind).toBe("lineMap");
    fire({ id: posted[0].id, kind: "ok", value: [0x400000, 9] });
    await expect(promise).resolves.toEqual([0x400000, 9]);
  });

  test("an ok response whose value is not a snapshot does not notify subscribers", async () => {
    const { w, posted, fire } = makeMockWorker();
    const client = new WorkerClient(w);
    const cb = vi.fn();
    client.onSnapshot(cb);
    const promise = client.codeBase();
    fire({ id: posted[0].id, kind: "ok", value: 0x400000 });
    await expect(promise).resolves.toBe(0x400000);
    expect(cb).not.toHaveBeenCalled();
  });
});
