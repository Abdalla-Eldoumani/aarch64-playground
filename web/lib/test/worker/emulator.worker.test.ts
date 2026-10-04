// @vitest-environment node
// The worker entry itself, loaded against a fake wasm module and a fake
// worker scope: how it recovers from a dead instance and a failed download,
// how a machine-replacing request stands a running loop down, and what it
// answers to a request it does not know.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "@/lib/worker/protocol";

const wasm = vi.hoisted(() => {
  const state = {
    initCalls: 0,
    initFailures: 0,
    built: 0,
    /** What the next step() throws, once. */
    stepThrows: null as unknown,
  };
  class FakeEmulator {
    constructor() {
      state.built++;
    }
    assemble_and_load() {
      return { success: true, instruction_count: 1 };
    }
    assemble_and_load_with_args() {
      return { success: true, instruction_count: 1 };
    }
    step() {
      if (state.stepThrows) {
        const e = state.stepThrows;
        state.stepThrows = null;
        throw e;
      }
      return { pc: 0x400004n, halted: false };
    }
    step_back() {
      return { pc: 0x400000n, halted: false };
    }
    // Never halts, so only a pause or a new epoch ends a run.
    run_until_break(steps: number) {
      return { pc: 0x400000n, halted: false, steps_executed: steps, hit_breakpoint: false };
    }
    reset() {}
    load_state() {
      return true;
    }
    is_blocked() {
      return false;
    }
    get_all_registers() {
      return { gpr: [], sp: "0x0", pc: "0x0", nzcv: 0 };
    }
    get_changed_registers() {
      return new Uint8Array(0);
    }
    take_stdout() {
      return "";
    }
    take_stderr() {
      return "";
    }
    get_exit_code() {
      return undefined;
    }
    is_halted() {
      return false;
    }
    can_step_back() {
      return false;
    }
    list_vfs_files() {
      return [];
    }
    list_states() {
      return [];
    }
    take_dirty_addrs() {
      return new Uint32Array(0);
    }
  }
  const init = async () => {
    state.initCalls++;
    if (state.initFailures > 0) {
      state.initFailures--;
      throw new Error("failed to fetch the wasm");
    }
  };
  return { state, FakeEmulator, init };
});

vi.mock("@/lib/wasm/aarch64_emulator", () => ({
  default: wasm.init,
  Emulator: wasm.FakeEmulator,
  memoryMap: undefined,
}));

type Reply = { id: number; kind: string; value?: unknown; message?: string };
let posted: Reply[] = [];
let onMessage: ((event: { data: Request }) => Promise<void>) | null = null;

/** Send one request and wait for the worker's reply to it. */
async function send(request: Request): Promise<Reply> {
  const pending = onMessage!({ data: request });
  await vi.waitFor(() => expect(posted.some((r) => r.id === request.id)).toBe(true));
  await pending;
  return posted.find((r) => r.id === request.id)!;
}

beforeEach(async () => {
  Object.assign(wasm.state, { initCalls: 0, initFailures: 0, built: 0, stepThrows: null });
  posted = [];
  onMessage = null;
  vi.stubGlobal("self", {
    addEventListener: (type: string, fn: typeof onMessage) => {
      if (type === "message") onMessage = fn;
    },
    postMessage: (message: Reply) => {
      posted.push(message);
    },
  });
  // A fresh module per test: the worker keeps its machine in module scope.
  vi.resetModules();
  await import("@/lib/worker/emulator.worker");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the emulator worker", () => {
  it("answers init without downloading the wasm", async () => {
    const reply = await send({ id: 1, kind: "init" });
    expect(reply.kind).toBe("ok");
    expect(wasm.state.initCalls).toBe(0);
  });

  it("retries the download on the next request after a failed one", async () => {
    wasm.state.initFailures = 1;
    const failed = await send({ id: 1, kind: "assemble", source: "ret", args: [] });
    expect(failed).toMatchObject({ kind: "error", message: "failed to fetch the wasm" });
    const retried = await send({ id: 2, kind: "assemble", source: "ret", args: [] });
    expect(retried.kind).toBe("ok");
    expect(wasm.state.initCalls).toBe(2);
    expect(wasm.state.built).toBe(1);
  });

  it("builds a fresh machine after a trap leaves the instance unusable", async () => {
    await send({ id: 1, kind: "assemble", source: "ret", args: [] });
    wasm.state.stepThrows = new Error("unreachable executed");
    expect(await send({ id: 2, kind: "step" })).toMatchObject({ kind: "error" });
    expect((await send({ id: 3, kind: "assemble", source: "ret", args: [] })).kind).toBe("ok");
    expect(wasm.state.built).toBe(2);
  });

  it("keeps the machine after an ordinary error", async () => {
    await send({ id: 1, kind: "assemble", source: "ret", args: [] });
    wasm.state.stepThrows = new Error("memory fault: the program tried to read 0x10");
    expect(await send({ id: 2, kind: "step" })).toMatchObject({ kind: "error" });
    await send({ id: 3, kind: "step" });
    expect(wasm.state.built).toBe(1);
  });

  it.each([
    ["assemble", { kind: "assemble", source: "ret", args: [] }],
    ["reset", { kind: "reset" }],
    ["loadState", { kind: "loadState", name: "a" }],
    ["stepBack", { kind: "stepBack" }],
  ] as const)("stands a running loop down when %s replaces the machine", async (_name, replace) => {
    await send({ id: 1, kind: "assemble", source: "ret", args: [] });
    const run = onMessage!({ data: { id: 2, kind: "runUntilBreak", maxSteps: 50_000_000 } });
    // Let the run take a chunk or two before the machine is replaced.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await send({ id: 3, ...replace } as Request);
    await run;
    const reply = posted.find((r) => r.id === 2) as { value: { runResult: { cancelled?: boolean } } };
    expect(reply.value.runResult.cancelled).toBe(true);
  });

  it("does not stand a run down for a request that leaves the machine in place", async () => {
    await send({ id: 1, kind: "assemble", source: "ret", args: [] });
    const run = onMessage!({ data: { id: 2, kind: "runUntilBreak", maxSteps: 50_000_000 } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await send({ id: 3, kind: "getSnapshot" });
    await send({ id: 4, kind: "pause" });
    await run;
    const reply = posted.find((r) => r.id === 2) as { value: { runResult: { cancelled?: boolean } } };
    expect(reply.value.runResult.cancelled).toBeUndefined();
  });

  it("answers an unknown request kind with an error naming it", async () => {
    const reply = await send({ id: 9, kind: "defragment" } as unknown as Request);
    expect(reply.kind).toBe("error");
    expect(reply.message).toContain("unknown request kind");
    expect(reply.message).toContain("defragment");
  });
});
