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
    fpRegisters: [],
    vectorRegisters: [],
    changedFpRegs: [],
    halted: false,
    blocked: false,
    exitCode: null,
    canStepBack: false,
    stdoutDelta: "",
    stderrDelta: "",
    vfsFiles: [],
    savedStates: [],
    wantsTerminal: false,
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
    // a heartbeat answers no request, so its id never matches a pending one
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
  // Each method must post its own kind with its arguments on the wire; the
  // reply is only relayed. The methods that answer nothing resolve
  // undefined whatever the worker's ok carries.
  const data = new Uint8Array([4, 2]);
  const ROWS: Array<{
    name: string;
    invoke: (c: WorkerClient) => Promise<unknown>;
    wire: Record<string, unknown>;
    voidReply?: true;
  }> = [
    { name: "assemble", invoke: (c) => c.assemble("mov x0, 1", ["alpha"]), wire: { kind: "assemble", source: "mov x0, 1", args: ["alpha"] } },
    { name: "stepBack", invoke: (c) => c.stepBack(), wire: { kind: "stepBack" } },
    { name: "runUntilBreak", invoke: (c) => c.runUntilBreak(1234), wire: { kind: "runUntilBreak", maxSteps: 1234 } },
    { name: "pause", invoke: (c) => c.pause(), wire: { kind: "pause" }, voidReply: true },
    // A redirect: no echo, so the worker takes the silent queue.
    { name: "pushStdin", invoke: (c) => c.pushStdin("hi"), wire: { kind: "pushStdin", text: "hi", interactive: false } },
    { name: "pushStdin at a prompt", invoke: (c) => c.pushStdin("42\n", true), wire: { kind: "pushStdin", text: "42\n", interactive: true } },
    { name: "takeStdout", invoke: (c) => c.takeStdout(), wire: { kind: "takeStdout" } },
    { name: "takeStderr", invoke: (c) => c.takeStderr(), wire: { kind: "takeStderr" } },
    { name: "getMemory", invoke: (c) => c.getMemory(0x1000, 8), wire: { kind: "getMemory", addr: 0x1000, len: 8 } },
    { name: "getSnapshot", invoke: (c) => c.getSnapshot(), wire: { kind: "getSnapshot" } },
    { name: "setBreakpoint", invoke: (c) => c.setBreakpoint(0x400010), wire: { kind: "setBreakpoint", addr: 0x400010 }, voidReply: true },
    { name: "clearBreakpoint", invoke: (c) => c.clearBreakpoint(0x400010), wire: { kind: "clearBreakpoint", addr: 0x400010 }, voidReply: true },
    { name: "saveState", invoke: (c) => c.saveState("chk1"), wire: { kind: "saveState", name: "chk1" } },
    { name: "loadState", invoke: (c) => c.loadState("chk1"), wire: { kind: "loadState", name: "chk1" } },
    { name: "deleteState", invoke: (c) => c.deleteState("chk1"), wire: { kind: "deleteState", name: "chk1" } },
    { name: "listStates", invoke: (c) => c.listStates(), wire: { kind: "listStates" } },
    { name: "uploadVfsFile", invoke: (c) => c.uploadVfsFile("notes.bin", data), wire: { kind: "uploadVfsFile", path: "notes.bin", data } },
    { name: "listVfsFiles", invoke: (c) => c.listVfsFiles(), wire: { kind: "listVfsFiles" } },
    { name: "readVfsFile", invoke: (c) => c.readVfsFile("notes.bin"), wire: { kind: "readVfsFile", path: "notes.bin" } },
    { name: "deleteVfsFile", invoke: (c) => c.deleteVfsFile("notes.bin"), wire: { kind: "deleteVfsFile", path: "notes.bin" } },
    { name: "resolveLabel", invoke: (c) => c.resolveLabel("main"), wire: { kind: "resolveLabel", name: "main" } },
    { name: "clearConsole", invoke: (c) => c.clearConsole(), wire: { kind: "clearConsole" } },
    { name: "codeBase", invoke: (c) => c.codeBase(), wire: { kind: "codeBase" } },
    { name: "lineMap", invoke: (c) => c.lineMap(), wire: { kind: "lineMap" } },
  ];

  test.each(ROWS)("$name posts its request and settles on the matching reply", async (row) => {
    const { posted, fire, promise } = call(row.invoke);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject(row.wire);
    const reply = { relayed: row.name };
    fire({ id: posted[0].id, kind: "ok", value: row.voidReply ? null : reply });
    if (row.voidReply) await expect(promise).resolves.toBeUndefined();
    else await expect(promise).resolves.toBe(reply);
  });

  test("resolveLabel resolves null for an unknown label", async () => {
    const { posted, fire, promise } = call((c) => c.resolveLabel("ghost"));
    fire({ id: posted[0].id, kind: "ok", value: null });
    await expect(promise).resolves.toBeNull();
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
