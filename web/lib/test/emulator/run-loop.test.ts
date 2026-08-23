import { describe, expect, it } from "vitest";

import {
  CHUNK_STEPS,
  NO_PROGRESS_ERROR,
  runChunked,
  type RunLoopHost,
  type RunLoopOptions,
} from "@/lib/emulator/run-loop";
import type { RunResultPayload } from "@/lib/worker/protocol";

/**
 * A stand-in machine. `chunk` decides what each chunk reports; everything
 * else defaults to a program that never finishes, so a run only stops for
 * the reason a test arranged.
 */
function fakeHost(
  overrides: Partial<RunLoopHost> & {
    chunk?: (call: number) => Partial<RunResultPayload>;
  } = {},
) {
  const heartbeats: number[] = [];
  const state = {
    calls: 0,
    chunks: 0,
    epoch: 0,
    paused: false,
    blocked: false,
    heartbeats,
    // The exact payload objects the host handed back, so a test can prove
    // the loop never wrote into one.
    handedBack: [] as RunResultPayload[],
  };
  const host: RunLoopHost = {
    runChunk: (steps) => {
      state.calls++;
      const payload: RunResultPayload = {
        pc: 0x400000,
        halted: false,
        steps_executed: steps,
        hit_breakpoint: false,
        error: null,
        ...overrides.chunk?.(state.calls),
      };
      state.handedBack.push(payload);
      return payload;
    },
    isBlocked: () => state.blocked,
    isPauseRequested: () => state.paused,
    currentEpoch: () => state.epoch,
    onChunk: () => {
      state.chunks++;
    },
    onHeartbeat: () => {
      heartbeats.push(state.calls);
    },
    ...overrides,
  };
  return { host, state };
}

// Deterministic and instant: the loop's yield is where the host would learn
// about a pause or a machine swap, so tests drive it directly.
function options(onYield?: () => void): RunLoopOptions {
  return {
    yieldToHost: async () => {
      onYield?.();
    },
  };
}

describe("runChunked", () => {
  it("folds every chunk's steps into one total", async () => {
    const { host, state } = fakeHost({
      chunk: (call) => (call === 3 ? { halted: true } : {}),
    });
    const result = await runChunked(host, 1_000_000, options());
    expect(state.calls).toBe(3);
    expect(state.chunks).toBe(3);
    expect(result.steps_executed).toBe(3 * CHUNK_STEPS);
    expect(result.halted).toBe(true);
    expect(result.step_limit_reached).toBe(false);
  });

  it("stops within one chunk of a pause", async () => {
    // The pause lands at the yield, which is the only opening the host has.
    const { host, state } = fakeHost();
    const result = await runChunked(
      host,
      1_000_000,
      options(() => {
        state.paused = true;
      }),
    );
    expect(state.calls).toBe(1);
    expect(result.steps_executed).toBe(CHUNK_STEPS);
    expect(result.halted).toBe(false);
    expect(result.error).toBeNull();
  });

  it("does not call a paused stop at the budget a step-limit stop", async () => {
    // The flag is still set when the result is folded: a run the student
    // paused must not be reported as an endless loop that ran out of budget.
    const { host, state } = fakeHost();
    const result = await runChunked(
      host,
      2 * CHUNK_STEPS,
      options(() => {
        state.paused = true;
      }),
    );
    expect(result.steps_executed).toBe(CHUNK_STEPS);
    expect(result.step_limit_reached).toBe(false);
  });

  it("cancels when the machine is replaced under the run", async () => {
    const { host, state } = fakeHost();
    const result = await runChunked(
      host,
      1_000_000,
      options(() => {
        state.epoch++;
      }),
    );
    expect(state.calls).toBe(1);
    expect(result.cancelled).toBe(true);
    expect(result.steps_executed).toBe(CHUNK_STEPS);
  });

  it("checks the epoch on every chunk, not on every heartbeat", async () => {
    // The worker paces its heartbeats; the cancel check used to ride that
    // pace, so a replaced machine kept being driven for whole chunks.
    const { host, state } = fakeHost();
    const result = await runChunked(host, 1_000_000, {
      ...options(() => {
        state.epoch++;
      }),
      heartbeatIntervalMs: 50,
      now: () => 0,
    });
    expect(state.heartbeats).toEqual([]);
    expect(state.calls).toBe(1);
    expect(result.cancelled).toBe(true);
  });

  it("stops a machine that makes no progress and says why", async () => {
    const { host, state } = fakeHost({ chunk: () => ({ steps_executed: 0 }) });
    const result = await runChunked(host, 1_000_000, options());
    expect(state.calls).toBe(1);
    expect(result.error).toBe(NO_PROGRESS_ERROR);
    expect(result.steps_executed).toBe(0);
    expect(result.step_limit_reached).toBe(false);
    // The host's own record is untouched: one host used to write the
    // message into it in place.
    expect(state.handedBack[0].error).toBeNull();
  });

  it("reports a run the budget alone stopped", async () => {
    const { host, state } = fakeHost();
    const result = await runChunked(host, 3 * CHUNK_STEPS, options());
    expect(state.calls).toBe(3);
    expect(result.steps_executed).toBe(3 * CHUNK_STEPS);
    expect(result.step_limit_reached).toBe(true);
  });

  it("leaves the budget stop unreported when the machine is waiting on input", async () => {
    const { host, state } = fakeHost();
    // The program parks on a read during the only chunk this budget allows:
    // it did not run out of budget, it is waiting for the student.
    const blocking: RunLoopHost = { ...host, isBlocked: () => state.calls > 0 };
    const result = await runChunked(blocking, CHUNK_STEPS, options());
    expect(result.step_limit_reached).toBe(false);
    expect(result.steps_executed).toBe(CHUNK_STEPS);
  });

  it("hands a nanosleep pause up to the driver", async () => {
    const { host, state } = fakeHost({ chunk: () => ({ sleep_ms: 40 }) });
    const result = await runChunked(host, 1_000_000, options());
    expect(state.calls).toBe(1);
    expect(result.sleep_ms).toBe(40);
    expect(result.error).toBeNull();
  });

  it("stops on a breakpoint and on a runtime error", async () => {
    const bp = fakeHost({ chunk: () => ({ hit_breakpoint: true }) });
    expect((await runChunked(bp.host, 1_000_000, options())).hit_breakpoint).toBe(true);
    expect(bp.state.calls).toBe(1);

    const bad = fakeHost({ chunk: () => ({ error: "bus error", error_line: 12 }) });
    const result = await runChunked(bad.host, 1_000_000, options());
    expect(result.error).toBe("bus error");
    expect(result.error_line).toBe(12);
    expect(bad.state.calls).toBe(1);
  });

  it("paces heartbeats without pacing the chunks", async () => {
    // Frames advance per chunk; the snapshot fan-out is what a host may
    // want to spend less often (a worker's is a postMessage).
    let clock = 0;
    const { host, state } = fakeHost({
      chunk: (call) => (call === 6 ? { halted: true } : {}),
    });
    await runChunked(host, 1_000_000, {
      ...options(),
      heartbeatIntervalMs: 50,
      // 20ms per read, and the loop reads the clock once per chunk.
      now: () => {
        clock += 20;
        return clock;
      },
    });
    expect(state.chunks).toBe(6);
    expect(state.heartbeats.length).toBeLessThan(state.chunks);
    expect(state.heartbeats.length).toBeGreaterThan(0);
  });

  it("emits one heartbeat per chunk when nothing is paced", async () => {
    const { host, state } = fakeHost({
      chunk: (call) => (call === 4 ? { halted: true } : {}),
    });
    await runChunked(host, 1_000_000, options());
    // The chunk that ends the run reports through the returned result, so
    // it is the host, not the loop, that surfaces the final state.
    expect(state.heartbeats).toEqual([1, 2, 3]);
  });

  it("runs nothing on an empty budget", async () => {
    const { host, state } = fakeHost();
    const result = await runChunked(host, 0, options());
    expect(state.calls).toBe(0);
    expect(result.steps_executed).toBe(0);
  });

  it("yields for real when the host does not inject one", async () => {
    // The shipped yield has to actually resolve on both hosts; a loop that
    // never came back from it would hang every run.
    const { host, state } = fakeHost({
      chunk: (call) => (call === 2 ? { halted: true } : {}),
    });
    const result = await runChunked(host, 1_000_000);
    expect(state.calls).toBe(2);
    expect(result.halted).toBe(true);
  });
});
