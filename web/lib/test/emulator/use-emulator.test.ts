import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import type { EmulatorBackend } from "@/lib/emulator/backend";
import type {
  AssembleResultPayload,
  RunResultPayload,
  StateSnapshot,
  StepResultPayload,
} from "@/lib/worker/protocol";

// Holder for the fake backend. The hoisted `@/lib/backend` mock reads it
// lazily inside `pickBackend`, so each test installs its own backend before
// rendering the hook.
const h = vi.hoisted(() => ({ backend: undefined as unknown }));

vi.mock("@/lib/emulator/backend", () => ({
  pickBackend: () => h.backend,
}));

// detectHostedMode normally awaits the WASM module, which is browser-only
// and excluded from the test build. Stub it so the hook never reaches wasm.
vi.mock("@/lib/emulator/emulator", () => ({
  detectHostedMode: () => Promise.resolve(true),
}));

import {
  CONSOLE_TRIM_MARKER,
  MAX_CONSOLE_CHARS,
  appendBounded,
  useEmulator,
} from "@/lib/emulator/use-emulator";

describe("appendBounded", () => {
  it("passes output through untouched under the cap", () => {
    expect(appendBounded("hello ", "world")).toBe("hello world");
  });

  it("keeps the newest output and marks the trim visibly", () => {
    const prev = "x".repeat(MAX_CONSOLE_CHARS);
    const next = appendBounded(prev, "TAIL");
    expect(next.startsWith(CONSOLE_TRIM_MARKER)).toBe(true);
    expect(next.endsWith("TAIL")).toBe(true);
    expect(next.length).toBe(MAX_CONSOLE_CHARS + CONSOLE_TRIM_MARKER.length);
  });
});

const CODE_BASE = 0x400000;
const ENTRY_PC_HEX = "0x0000000000400000";

function toHex(n: number): string {
  return "0x" + n.toString(16).padStart(16, "0");
}

// A hosted m4 + data program whose `main` prologue -- the first real
// instruction -- is editor line 9. The legacy line-count fallback counts
// the `define` line as instruction index 0 and so puts the marker on line
// 1; only the authoritative address->line map lands it on the prologue.
const HOSTED_SOURCE = [
  "define(a, x19)",
  "",
  "        .data",
  'msg:    .string "hi"',
  "",
  "        .text",
  "        .global main",
  "main:",
  "        stp     x29, x30, [sp, -16]!",
  "        mov     x29, sp",
  "        mov     x0, 0",
  "        ldp     x29, x30, [sp], 16",
  "        ret",
].join("\n");

const PROLOGUE_LINE = 9;

// A bare-metal program with no m4/data/label lines, so the linker emits an
// empty line map and the hook falls back to index-based line counting.
const BARE_SOURCE = ["mov x0, 1", "mov x1, 2", "ret"].join("\n");

// addr -> editor line for the five .text instructions, skipping the
// define/data/label lines just as the linker's line map does.
const FLAT_LINE_MAP = [
  CODE_BASE, 9,
  CODE_BASE + 4, 10,
  CODE_BASE + 8, 11,
  CODE_BASE + 12, 12,
  CODE_BASE + 16, 13,
];

function snap(overrides: Partial<StateSnapshot> = {}): StateSnapshot {
  return {
    frame: 0,
    registers: Array(31).fill("0x0000000000000000"),
    sp: "0x0000000080000000",
    pc: ENTRY_PC_HEX,
    nzcv: 0,
    changedRegs: [],
    fpRegisters: [],
    changedFpRegs: [],
    halted: false,
    blocked: false,
    exitCode: null,
    canStepBack: false,
    stdoutDelta: "",
    stderrDelta: "",
    vfsFiles: [],
    savedStates: [],
    changedMem: false,
    dirtyAddrs: [],
    ...overrides,
  };
}

interface BackendConfig {
  instructionCount: number;
  lineMapFlat: number[];
  assembleSuccess: boolean;
  assembleError?: string;
  assembleErrorLine?: number;
  assembleThrows: boolean;
  stepResult: StepResultPayload;
  stepThrows: boolean;
  stepBackThrows: boolean;
  runResult: RunResultPayload;
  runThrows: boolean;
  runDeferred: boolean;
  resolveLabelValue: number | null;
  readVfsBytes: Uint8Array;
  deleteVfsRemoved: boolean;
  loadStateOk: boolean;
  deleteStateOk: boolean;
  memBytes: Uint8Array;
}

// Records every backend interaction so a test can assert the hook forwards
// the right argument without reaching into private state.
interface BackendCalls {
  assemble: Array<[string, string[]]>;
  step: number;
  stepBack: number;
  run: number[];
  reset: number;
  pause: number;
  clearConsole: number;
  setBreakpoint: number[];
  clearBreakpoint: number[];
  pushStdin: string[];
  saveState: string[];
  loadState: string[];
  deleteState: string[];
  uploadVfsFile: Array<[string, Uint8Array]>;
  readVfsFile: string[];
  deleteVfsFile: string[];
  resolveLabel: string[];
  getMemory: Array<[number, number]>;
}

// Fake backend in the established harness shape: snapshots fire through the
// listener BEFORE the operation promise resolves (mirroring
// MainThreadBackend.notifyAndReturn / WorkerClient), so the hook's
// applySnapshot runs while currentLineRef/latestSnapRef are read by the
// step/run callbacks.
function makeBackend(config: Partial<BackendConfig> = {}) {
  const cfg: BackendConfig = {
    instructionCount: 5,
    lineMapFlat: FLAT_LINE_MAP,
    assembleSuccess: true,
    assembleThrows: false,
    stepResult: { pc: CODE_BASE, halted: false, error: null, outcome: "advance", exitCode: null },
    stepThrows: false,
    stepBackThrows: false,
    runResult: { pc: CODE_BASE, halted: false, steps_executed: 5, hit_breakpoint: false, error: null },
    runThrows: false,
    runDeferred: false,
    resolveLabelValue: CODE_BASE,
    readVfsBytes: new Uint8Array([1, 2, 3]),
    deleteVfsRemoved: true,
    loadStateOk: true,
    deleteStateOk: true,
    memBytes: new Uint8Array(4),
    ...config,
  };

  let listener: ((s: StateSnapshot) => void) | null = null;
  let frame = 0;
  let runResolve: (() => void) | null = null;

  const calls: BackendCalls = {
    assemble: [],
    step: 0,
    stepBack: 0,
    run: [],
    reset: 0,
    pause: 0,
    clearConsole: 0,
    setBreakpoint: [],
    clearBreakpoint: [],
    pushStdin: [],
    saveState: [],
    loadState: [],
    deleteState: [],
    uploadVfsFile: [],
    readVfsFile: [],
    deleteVfsFile: [],
    resolveLabel: [],
    getMemory: [],
  };

  function fire(overrides: Partial<StateSnapshot> = {}): StateSnapshot {
    const s = snap({ frame: ++frame, ...overrides });
    listener?.(s);
    return s;
  }

  const backend: EmulatorBackend = {
    onSnapshot(l) {
      listener = l;
      return () => {
        listener = null;
      };
    },
    init() {
      return Promise.resolve(snap({ frame: 0 }));
    },
    codeBase() {
      return Promise.resolve(CODE_BASE);
    },
    lineMap() {
      return Promise.resolve(cfg.lineMapFlat);
    },
    getMemory(addr, len) {
      calls.getMemory.push([addr, len]);
      return Promise.resolve(cfg.memBytes);
    },
    assemble(source, args) {
      calls.assemble.push([source, args]);
      if (cfg.assembleThrows) return Promise.reject(new Error("boom"));
      const result: AssembleResultPayload = cfg.assembleSuccess
        ? { success: true, instruction_count: cfg.instructionCount }
        : {
            success: false,
            error: cfg.assembleError,
            error_line: cfg.assembleErrorLine,
            instruction_count: 0,
          };
      const s = fire();
      return Promise.resolve({ result, snapshot: s });
    },
    step() {
      calls.step++;
      if (cfg.stepThrows) return Promise.reject(new Error("step boom"));
      const s = fire();
      return Promise.resolve({ stepResult: cfg.stepResult, snapshot: s });
    },
    stepBack() {
      calls.stepBack++;
      if (cfg.stepBackThrows) return Promise.reject(new Error("stepback boom"));
      const s = fire({ canStepBack: true });
      const stepResult: StepResultPayload = {
        pc: CODE_BASE,
        halted: false,
        error: null,
        outcome: "advance",
        exitCode: null,
      };
      return Promise.resolve({ stepResult, snapshot: s });
    },
    runUntilBreak(maxSteps) {
      calls.run.push(maxSteps);
      if (cfg.runThrows) return Promise.reject(new Error("run boom"));
      if (cfg.runDeferred) {
        return new Promise((resolve) => {
          runResolve = () => {
            const s = fire();
            resolve({ runResult: cfg.runResult, snapshot: s });
          };
        });
      }
      const s = fire();
      return Promise.resolve({ runResult: cfg.runResult, snapshot: s });
    },
    pause() {
      calls.pause++;
      return Promise.resolve();
    },
    reset() {
      calls.reset++;
      return Promise.resolve(fire());
    },
    pushStdin(text) {
      calls.pushStdin.push(text);
      return Promise.resolve(fire());
    },
    closeStdin() {
      return Promise.resolve(fire());
    },
    clearAllBreakpoints() {
      return Promise.resolve();
    },
    isRangeMapped() {
      return Promise.resolve(true);
    },
    lint() {
      return Promise.resolve([]);
    },
    setBreakpoint(addr) {
      calls.setBreakpoint.push(addr);
      return Promise.resolve();
    },
    clearBreakpoint(addr) {
      calls.clearBreakpoint.push(addr);
      return Promise.resolve();
    },
    saveState(name) {
      calls.saveState.push(name);
      return Promise.resolve(fire({ savedStates: [name] }));
    },
    loadState(name) {
      calls.loadState.push(name);
      return Promise.resolve({ ok: cfg.loadStateOk, snapshot: fire() });
    },
    deleteState(name) {
      calls.deleteState.push(name);
      return Promise.resolve({ ok: cfg.deleteStateOk, snapshot: fire() });
    },
    uploadVfsFile(path, data) {
      calls.uploadVfsFile.push([path, data]);
      return Promise.resolve(fire({ vfsFiles: [path] }));
    },
    readVfsFile(path) {
      calls.readVfsFile.push(path);
      return Promise.resolve(cfg.readVfsBytes);
    },
    deleteVfsFile(path) {
      calls.deleteVfsFile.push(path);
      return Promise.resolve({ removed: cfg.deleteVfsRemoved, snapshot: fire() });
    },
    resolveLabel(name) {
      calls.resolveLabel.push(name);
      return Promise.resolve(cfg.resolveLabelValue);
    },
    async m4Expand() {
      return null;
    },
    clearConsole() {
      calls.clearConsole++;
      return Promise.resolve(fire());
    },
  };

  return {
    backend,
    calls,
    fire,
    // Exposed so a test can flip outcomes mid-run (a successful assemble
    // followed by a failing one exercises the loaded-program state machine).
    cfg,
    triggerRun: () => runResolve?.(),
  };
}

async function mountLoaded(fake: { backend: EmulatorBackend }) {
  h.backend = fake.backend;
  const view = renderHook(() => useEmulator());
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  return view;
}

// Mount with a program already assembled: step/stepBack/run gate on a
// successful assemble, so tests that exercise execution start here.
async function mountAssembled(fake: { backend: EmulatorBackend }) {
  const view = await mountLoaded(fake);
  await act(async () => {
    await expect(view.result.current.assemble(HOSTED_SOURCE)).resolves.toBe(true);
  });
  return view;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useEmulator load + snapshot application", () => {
  it("reports load error when backend init rejects", async () => {
    h.backend = {
      onSnapshot: () => () => {},
      init: () => Promise.reject(new Error("wasm failed to load")),
    };
    const { result } = renderHook(() => useEmulator());
    await waitFor(() => expect(result.current.loadError).toBe("wasm failed to load"));
    expect(result.current.isLoaded).toBe(false);
  });

  it("applies every field of a snapshot to state", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    const regs = Array.from({ length: 31 }, (_, i) => toHex(i));

    act(() => {
      fake.fire({
        registers: regs,
        sp: "0x00000000abcd0000",
        pc: "0x000000000040002a",
        nzcv: 0b1010,
        changedRegs: [3, 7],
        halted: true,
        blocked: true,
        exitCode: 42,
        canStepBack: true,
        vfsFiles: ["data.bin"],
        savedStates: ["chk1"],
        stdoutDelta: "hello ",
        stderrDelta: "warn",
      });
    });

    expect(result.current.registers).toEqual(regs);
    expect(result.current.sp).toBe("0x00000000abcd0000");
    expect(result.current.pc).toBe(0x40002a);
    expect(result.current.nzcv).toBe(0b1010);
    expect(Array.from(result.current.changedRegs).sort((a, b) => a - b)).toEqual([3, 7]);
    expect(result.current.isHalted).toBe(true);
    expect(result.current.blocked).toBe(true);
    expect(result.current.exitCode).toBe(42);
    expect(result.current.canStepBack).toBe(true);
    expect(result.current.vfsFiles).toEqual(["data.bin"]);
    expect(result.current.savedStates).toEqual(["chk1"]);
    expect(result.current.stdout).toBe("hello ");
    expect(result.current.stderr).toBe("warn");
  });

  it("blocks on stdin when a snapshot reports blocked", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    expect(result.current.blocked).toBe(false);
    act(() => {
      fake.fire({ blocked: true });
    });
    expect(result.current.blocked).toBe(true);
  });

  it("surfaces a zero exit code distinct from null", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    expect(result.current.exitCode).toBeNull();
    act(() => {
      fake.fire({ exitCode: 0 });
    });
    expect(result.current.exitCode).toBe(0);
  });

  it("accumulates stdout and stderr deltas across snapshots", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    act(() => {
      fake.fire({ stdoutDelta: "foo" });
    });
    act(() => {
      fake.fire({ stdoutDelta: "bar" });
    });
    expect(result.current.stdout).toBe("foobar");
    act(() => {
      fake.fire({ stderrDelta: "e1" });
    });
    act(() => {
      fake.fire({ stderrDelta: "e2" });
    });
    expect(result.current.stderr).toBe("e1e2");
  });

  it("exposes dirty memory ranges as address/length pairs", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    act(() => {
      fake.fire({ dirtyAddrs: [0x1000, 4, 0x2000, 8] });
    });
    expect(result.current.dirtyAddrs).toEqual([
      [0x1000, 4],
      [0x2000, 8],
    ]);
  });
});

describe("useEmulator assemble", () => {
  it("marks a hosted program's prologue line and decodes instructions", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      // Success resolves true so callers can chain input seeding on it.
      await expect(result.current.assemble(HOSTED_SOURCE)).resolves.toBe(true);
    });

    // The authoritative map must move the marker to the prologue right after
    // assemble, with no step required.
    await waitFor(() => expect(result.current.currentLine).toBe(PROLOGUE_LINE));
    expect(result.current.instructions).toHaveLength(5);
    expect(result.current.instructions[0].address).toBe(CODE_BASE);
    expect(result.current.instructions[0].hex).toBe("0x00000000");
    expect(result.current.instructions[0].text).toContain("stp");
  });

  it("records assembly errors with line and message on failure", async () => {
    const fake = makeBackend({
      assembleSuccess: false,
      assembleError: "bad instruction",
      assembleErrorLine: 3,
    });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await expect(result.current.assemble(HOSTED_SOURCE)).resolves.toBe(false);
    });

    expect(result.current.assemblyErrors).toEqual([{ line: 3, message: "bad instruction" }]);
    expect(result.current.error).toBe("bad instruction");
    expect(result.current.instructions).toEqual([]);
  });

  it("assembleForTool returns the precise verdict and never touches error state", async () => {
    const fake = makeBackend({
      assembleSuccess: false,
      assembleError: "unknown mnemonic: MOVQ",
      assembleErrorLine: 2,
    });
    const { result } = await mountLoaded(fake);

    let verdict: { success: boolean; error: string | null; errorLine: number | null } | null =
      null;
    await act(async () => {
      verdict = await result.current.assembleForTool(HOSTED_SOURCE);
    });

    // The caller gets the full verdict directly...
    expect(verdict).toEqual({
      success: false,
      error: "unknown mnemonic: MOVQ",
      errorLine: 2,
    });
    // ...and the editor-facing error surface stays exactly as it was.
    expect(result.current.error).toBeNull();
    expect(result.current.assemblyErrors).toEqual([]);
  });

  it("sets a bare error without a line when the failure has no error_line", async () => {
    const fake = makeBackend({
      assembleSuccess: false,
      assembleError: "general failure",
    });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(HOSTED_SOURCE);
    });

    expect(result.current.error).toBe("general failure");
    expect(result.current.assemblyErrors).toEqual([]);
  });

  it("rejects empty/comment-only source before reaching the backend", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await expect(result.current.assemble("\n   \n// comment\nlabel:")).resolves.toBe(false);
    });

    expect(result.current.error).toBe("no instructions to assemble");
    expect(result.current.instructions).toEqual([]);
    expect(fake.calls.assemble).toEqual([]);
  });

  it("captures a thrown backend error in the catch path", async () => {
    const fake = makeBackend({ assembleThrows: true });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await expect(result.current.assemble(HOSTED_SOURCE)).resolves.toBe(false);
    });

    expect(result.current.error).toBe("boom");
  });
});

describe("useEmulator stepping and running", () => {
  it("step advances the step counter and clears prior errors", async () => {
    const fake = makeBackend();
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.step();
    });
    await waitFor(() => expect(result.current.stepCount).toBe(1));
    expect(result.current.error).toBeNull();
    expect(fake.calls.step).toBe(1);
  });

  it("step surfaces a step-result error while still counting the step", async () => {
    const fake = makeBackend({
      stepResult: { pc: CODE_BASE, halted: false, error: "trap", outcome: "error", exitCode: null },
    });
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.step();
    });
    await waitFor(() => expect(result.current.error).toBe("trap"));
    expect(result.current.stepCount).toBe(1);
  });

  it("step records a rejected backend call as an error", async () => {
    const fake = makeBackend({ stepThrows: true });
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.step();
    });
    await waitFor(() => expect(result.current.error).toBe("step boom"));
    expect(result.current.stepCount).toBe(0);
  });

  it("stepBack decrements the step counter and clamps at zero", async () => {
    const fake = makeBackend();
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.step();
    });
    await waitFor(() => expect(result.current.stepCount).toBe(1));

    await act(async () => {
      result.current.stepBack();
    });
    await waitFor(() => expect(result.current.stepCount).toBe(0));

    await act(async () => {
      result.current.stepBack();
    });
    await waitFor(() => expect(result.current.stepCount).toBe(0));
    expect(fake.calls.stepBack).toBe(2);
  });

  it("stepBack records a rejected backend call as an error", async () => {
    const fake = makeBackend({ stepBackThrows: true });
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.stepBack();
    });
    await waitFor(() => expect(result.current.error).toBe("stepback boom"));
  });

  it("run adds the executed step count and clears the running flag", async () => {
    const fake = makeBackend({
      runResult: { pc: CODE_BASE, halted: false, steps_executed: 7, hit_breakpoint: false, error: null },
    });
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.stepCount).toBe(7));
    expect(result.current.isRunning).toBe(false);
    expect(fake.calls.run).toEqual([1_000_000]);
  });

  it("run surfaces a run-result error", async () => {
    const fake = makeBackend({
      runResult: { pc: CODE_BASE, halted: false, steps_executed: 3, hit_breakpoint: false, error: "run trap" },
    });
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.error).toBe("run trap"));
    expect(result.current.stepCount).toBe(3);
  });

  it("run records a rejected backend call and still clears the running flag", async () => {
    const fake = makeBackend({ runThrows: true });
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.error).toBe("run boom"));
    expect(result.current.isRunning).toBe(false);
  });

  it("run is a no-op once the program has halted", async () => {
    const fake = makeBackend();
    const { result } = await mountAssembled(fake);

    act(() => {
      fake.fire({ halted: true });
    });
    expect(result.current.isHalted).toBe(true);

    act(() => {
      result.current.run();
    });
    expect(fake.calls.run).toHaveLength(0);
    expect(result.current.isRunning).toBe(false);
  });

  it("a run captured before a halt-clearing assemble still executes", async () => {
    // The embed's Run awaits assemble and then invokes the `run` it
    // captured at click time. When the previous program had halted, that
    // captured closure must observe the fresh post-assemble halt flag
    // (via the ref), not the stale pre-assemble one, or the run silently
    // never starts and no output ever streams.
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    act(() => {
      fake.fire({ halted: true });
    });
    expect(result.current.isHalted).toBe(true);
    const capturedRun = result.current.run;

    await act(async () => {
      await result.current.assemble(HOSTED_SOURCE);
    });
    expect(result.current.isHalted).toBe(false);

    await act(async () => {
      capturedRun();
    });
    expect(fake.calls.run).toEqual([1_000_000]);
  });

  it("run sets the running flag until the backend resolves", async () => {
    const fake = makeBackend({ runDeferred: true });
    const { result } = await mountAssembled(fake);

    act(() => {
      result.current.run();
    });
    expect(result.current.isRunning).toBe(true);

    await act(async () => {
      fake.triggerRun();
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.stepCount).toBe(5);
  });

  it("pause clears the running flag and calls the backend", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    act(() => {
      result.current.pause();
    });
    expect(result.current.isRunning).toBe(false);
    expect(fake.calls.pause).toBe(1);
  });
});

describe("useEmulator reset", () => {
  it("clears execution state and calls the backend", async () => {
    const fake = makeBackend();
    const { result } = await mountAssembled(fake);

    await act(async () => {
      result.current.step();
    });
    act(() => {
      fake.fire({ stdoutDelta: "hi" });
    });
    await waitFor(() => expect(result.current.stepCount).toBe(1));
    expect(result.current.stdout).toBe("hi");

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.stepCount).toBe(0);
    expect(result.current.stdout).toBe("");
    expect(result.current.stderr).toBe("");
    expect(result.current.currentLine).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.assemblyErrors).toEqual([]);
    expect(fake.calls.reset).toBe(1);
  });

  it("clears decoded instructions", async () => {
    const fake = makeBackend({ lineMapFlat: [], instructionCount: 3 });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(BARE_SOURCE);
    });
    expect(result.current.instructions).toHaveLength(3);

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.instructions).toEqual([]);
  });

  it("clears assembly errors left by a failed assemble", async () => {
    const fake = makeBackend({
      assembleSuccess: false,
      assembleError: "nope",
      assembleErrorLine: 2,
    });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(HOSTED_SOURCE);
    });
    expect(result.current.error).toBe("nope");

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.assemblyErrors).toEqual([]);
  });
});

describe("useEmulator loaded-program gating", () => {
  it("ignores step, stepBack, and run before any assemble", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    expect(result.current.programLoaded).toBe(false);

    act(() => {
      result.current.step();
      result.current.stepBack();
      result.current.run();
    });

    // Nothing reaches the backend: no garbage decode of zeroed memory, no
    // phantom step count, no replay frames for steps that never ran.
    expect(fake.calls.step).toBe(0);
    expect(fake.calls.stepBack).toBe(0);
    expect(fake.calls.run).toEqual([]);
    expect(result.current.stepCount).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.replayFrames).toEqual([]);
  });

  it("opens the gate on a successful assemble and closes it on a failed one", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(HOSTED_SOURCE);
    });
    expect(result.current.programLoaded).toBe(true);

    await act(async () => {
      result.current.step();
    });
    await waitFor(() => expect(result.current.replayFrames).toHaveLength(1));

    // The next assemble fails. The backend wiped the machine for the
    // attempt, so the gate closes and the dead program's replay frames go.
    fake.cfg.assembleSuccess = false;
    fake.cfg.assembleError = "bad instruction";
    await act(async () => {
      await expect(result.current.assemble(HOSTED_SOURCE)).resolves.toBe(false);
    });
    expect(result.current.programLoaded).toBe(false);
    expect(result.current.replayFrames).toEqual([]);

    act(() => {
      result.current.step();
      result.current.run();
    });
    expect(fake.calls.step).toBe(1);
    expect(fake.calls.run).toEqual([]);
  });

  it("closes the gate on reset", async () => {
    const fake = makeBackend();
    const { result } = await mountAssembled(fake);
    await act(async () => {
      result.current.step();
    });
    await waitFor(() => expect(result.current.replayFrames).toHaveLength(1));

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.programLoaded).toBe(false);
    expect(result.current.replayFrames).toEqual([]);

    act(() => {
      result.current.step();
      result.current.run();
    });
    expect(fake.calls.step).toBe(1);
    expect(fake.calls.run).toEqual([]);
  });

  it("reopens the gate when a saved machine state loads after a reset", async () => {
    const fake = makeBackend();
    const { result } = await mountAssembled(fake);
    await act(async () => {
      result.current.reset();
    });
    expect(result.current.programLoaded).toBe(false);

    await act(async () => {
      result.current.loadState("chk1");
    });
    await waitFor(() => expect(result.current.programLoaded).toBe(true));

    await act(async () => {
      result.current.step();
    });
    expect(fake.calls.step).toBe(1);
  });

  it("keeps the gate closed when the state load fails", async () => {
    const fake = makeBackend({ loadStateOk: false });
    const { result } = await mountLoaded(fake);
    await act(async () => {
      result.current.loadState("ghost");
    });
    expect(result.current.programLoaded).toBe(false);
  });

  it("tracks bookmark restores: open on success, closed on failure", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    await act(async () => {
      await result.current.restoreBookmark({ source: HOSTED_SOURCE, stepCount: 1 });
    });
    expect(result.current.programLoaded).toBe(true);

    fake.cfg.assembleSuccess = false;
    fake.cfg.assembleError = "nope";
    await act(async () => {
      await result.current.restoreBookmark({ source: HOSTED_SOURCE, stepCount: 1 });
    });
    expect(result.current.programLoaded).toBe(false);
  });
});

describe("useEmulator breakpoints", () => {
  it("toggles a breakpoint via the authoritative line map", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(HOSTED_SOURCE);
    });

    act(() => {
      result.current.toggleBreakpoint(PROLOGUE_LINE);
    });
    expect(result.current.breakpoints.has(PROLOGUE_LINE)).toBe(true);
    expect(fake.calls.setBreakpoint).toEqual([CODE_BASE]);

    act(() => {
      result.current.toggleBreakpoint(PROLOGUE_LINE);
    });
    expect(result.current.breakpoints.has(PROLOGUE_LINE)).toBe(false);
    expect(fake.calls.clearBreakpoint).toEqual([CODE_BASE]);
  });

  it("toggles a breakpoint via index counting when the map is empty", async () => {
    const fake = makeBackend({ lineMapFlat: [], instructionCount: 3 });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(BARE_SOURCE);
    });

    act(() => {
      result.current.toggleBreakpoint(2);
    });
    expect(result.current.breakpoints.has(2)).toBe(true);
    expect(fake.calls.setBreakpoint).toEqual([CODE_BASE + 4]);
  });

  it("ignores a breakpoint on a line with no resolvable instruction", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(HOSTED_SOURCE);
    });

    act(() => {
      // line 99 is past the end of the program; nothing maps to it.
      result.current.toggleBreakpoint(99);
    });
    expect(result.current.breakpoints.size).toBe(0);
    expect(fake.calls.setBreakpoint).toEqual([]);
  });

  it("forwards address-based breakpoint set and clear to the backend", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.setBreakpointAddress(0x401234);
    });
    expect(fake.calls.setBreakpoint).toEqual([0x401234]);

    await act(async () => {
      await result.current.clearBreakpointAddress(0x401234);
    });
    expect(fake.calls.clearBreakpoint).toEqual([0x401234]);
  });
});

describe("useEmulator backend passthroughs", () => {
  it("pushStdin forwards text to the backend", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    act(() => {
      result.current.pushStdin("input line");
    });
    expect(fake.calls.pushStdin).toEqual(["input line"]);
  });

  it("save/load/delete state forward the name and ignore an empty save name", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    act(() => {
      result.current.saveState("chk1");
    });
    act(() => {
      result.current.saveState("");
    });
    act(() => {
      result.current.loadState("chk1");
    });
    act(() => {
      result.current.deleteState("chk1");
    });

    expect(fake.calls.saveState).toEqual(["chk1"]);
    expect(fake.calls.loadState).toEqual(["chk1"]);
    expect(fake.calls.deleteState).toEqual(["chk1"]);
  });

  it("uploadVfsFile forwards path and data", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    const data = new Uint8Array([4, 2]);
    act(() => {
      result.current.uploadVfsFile("notes.bin", data);
    });
    expect(fake.calls.uploadVfsFile).toEqual([["notes.bin", data]]);
  });

  it("readVfsFile returns the backend bytes", async () => {
    const fake = makeBackend({ readVfsBytes: new Uint8Array([7, 8, 9]) });
    const { result } = await mountLoaded(fake);
    let bytes: Uint8Array = new Uint8Array();
    await act(async () => {
      bytes = await result.current.readVfsFile("notes.bin");
    });
    expect(Array.from(bytes)).toEqual([7, 8, 9]);
    expect(fake.calls.readVfsFile).toEqual(["notes.bin"]);
  });

  it("deleteVfsFile reports whether a file was removed", async () => {
    const removed = makeBackend({ deleteVfsRemoved: true });
    const view1 = await mountLoaded(removed);
    let r1: boolean | undefined;
    await act(async () => {
      r1 = await view1.result.current.deleteVfsFile("a.bin");
    });
    expect(r1).toBe(true);
    cleanup();

    const missing = makeBackend({ deleteVfsRemoved: false });
    const view2 = await mountLoaded(missing);
    let r2: boolean | undefined;
    await act(async () => {
      r2 = await view2.result.current.deleteVfsFile("missing.bin");
    });
    expect(r2).toBe(false);
  });

  it("resolveLabel returns an address or null", async () => {
    const found = makeBackend({ resolveLabelValue: 0x400010 });
    const view1 = await mountLoaded(found);
    let addr: number | null = null;
    await act(async () => {
      addr = await view1.result.current.resolveLabel("main");
    });
    expect(addr).toBe(0x400010);
    cleanup();

    const absent = makeBackend({ resolveLabelValue: null });
    const view2 = await mountLoaded(absent);
    let missing: number | null = 0;
    await act(async () => {
      missing = await view2.result.current.resolveLabel("ghost");
    });
    expect(missing).toBeNull();
  });

  it("clearConsole empties the buffers and calls the backend", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);
    act(() => {
      fake.fire({ stdoutDelta: "x", stderrDelta: "y" });
    });
    expect(result.current.stdout).toBe("x");

    act(() => {
      result.current.clearConsole();
    });
    expect(result.current.stdout).toBe("");
    expect(result.current.stderr).toBe("");
    expect(fake.calls.clearConsole).toBe(1);
  });
});

describe("useEmulator memory cache", () => {
  it("returns a placeholder on a cache miss then the fetched bytes", async () => {
    const fake = makeBackend({ memBytes: new Uint8Array([9, 9, 9, 9]) });
    const { result } = await mountLoaded(fake);

    let first: Uint8Array = new Uint8Array();
    act(() => {
      first = result.current.getMemory(0x500000, 4);
    });
    expect(Array.from(first)).toEqual([0, 0, 0, 0]);

    await waitFor(() => {
      const cached = result.current.getMemory(0x500000, 4);
      expect(Array.from(cached)).toEqual([9, 9, 9, 9]);
    });
    // A second read of the same range must not re-fetch.
    expect(fake.calls.getMemory.filter(([a]) => a === 0x500000)).toHaveLength(1);
  });
});

describe("useEmulator replay + bookmarks", () => {
  it("captures replay frames and seeks back to them", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.assemble(HOSTED_SOURCE);
    });
    await act(async () => {
      result.current.step();
    });
    await waitFor(() => expect(result.current.replayFrames).toHaveLength(1));

    act(() => {
      fake.fire({ pc: toHex(CODE_BASE + 8) });
    });
    expect(result.current.pc).toBe(CODE_BASE + 8);
    expect(result.current.currentLine).toBe(11);

    act(() => {
      result.current.seekReplay(0);
    });
    expect(result.current.pc).toBe(CODE_BASE);
    expect(result.current.currentLine).toBe(PROLOGUE_LINE);

    // An out-of-range index is a no-op.
    act(() => {
      result.current.seekReplay(99);
    });
    expect(result.current.pc).toBe(CODE_BASE);
  });

  it("restoreBookmark assembles, pushes stdin, then steps to the saved count", async () => {
    const fake = makeBackend();
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.restoreBookmark({
        source: HOSTED_SOURCE,
        args: "1 2",
        stdin: "in",
        stepCount: 2,
      });
    });

    expect(fake.calls.assemble).toEqual([[HOSTED_SOURCE, ["1", "2"]]]);
    expect(fake.calls.pushStdin).toEqual(["in"]);
    expect(fake.calls.step).toBe(2);
    await waitFor(() => expect(result.current.stepCount).toBe(2));
  });

  it("restoreBookmark stops early when a failed assemble blocks stepping", async () => {
    const fake = makeBackend({
      assembleSuccess: false,
      assembleError: "nope",
      assembleErrorLine: 4,
    });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.restoreBookmark({ source: HOSTED_SOURCE, stepCount: 3 });
    });

    expect(result.current.error).toBe("nope");
    expect(result.current.assemblyErrors).toEqual([{ line: 4, message: "nope" }]);
    expect(fake.calls.pushStdin).toEqual([]);
    expect(fake.calls.step).toBe(0);
  });

  it("restoreBookmark halts the step loop when the program halts", async () => {
    const fake = makeBackend({
      stepResult: { pc: CODE_BASE, halted: true, error: null, outcome: "halted", exitCode: 0 },
    });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.restoreBookmark({ source: HOSTED_SOURCE, stepCount: 5 });
    });

    expect(fake.calls.step).toBe(1);
    await waitFor(() => expect(result.current.stepCount).toBe(1));
  });

  it("restoreBookmark halts the step loop when the program waits on input", async () => {
    const fake = makeBackend({
      stepResult: { pc: CODE_BASE, halted: false, error: null, outcome: "waiting", exitCode: null },
    });
    const { result } = await mountLoaded(fake);

    await act(async () => {
      await result.current.restoreBookmark({ source: HOSTED_SOURCE, stepCount: 5 });
    });

    expect(fake.calls.step).toBe(1);
  });
});
