import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import type { AssembleResultPayload, StateSnapshot } from "@/lib/worker/protocol";

// Holder for the fake backend. The hoisted `@/lib/backend` mock reads it
// lazily inside `pickBackend`, so each test installs its own backend before
// rendering the hook.
const h = vi.hoisted(() => ({ backend: undefined as unknown }));

vi.mock("@/lib/backend", () => ({
  pickBackend: () => h.backend,
}));

// detectHostedMode normally awaits the WASM module, which is browser-only
// and excluded from the test build. Stub it so the hook never reaches wasm.
vi.mock("@/lib/emulator", () => ({
  detectHostedMode: () => Promise.resolve(true),
}));

import { useEmulator } from "./use-emulator";

const CODE_BASE = 0x400000;
const ENTRY_PC_HEX = "0x0000000000400000";

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

// addr -> editor line for the five .text instructions, skipping the
// define/data/label lines just as the linker's line map does.
const FLAT_LINE_MAP = [
  CODE_BASE, 9,
  CODE_BASE + 4, 10,
  CODE_BASE + 8, 11,
  CODE_BASE + 12, 12,
  CODE_BASE + 16, 13,
];

function snapshot(pcHex: string, frame: number): StateSnapshot {
  return {
    frame,
    registers: Array(31).fill("0x0000000000000000"),
    sp: "0x0000000080000000",
    pc: pcHex,
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

// Minimal backend that reproduces the real ordering: the post-assemble
// snapshot fires through the listener BEFORE the assemble promise resolves
// (mirroring MainThreadBackend.notifyAndReturn / WorkerClient), so the
// hook's applySnapshot runs while the line map is still empty.
function makeFakeBackend(flatLineMap: number[], instructionCount: number) {
  let listener: ((snap: StateSnapshot) => void) | null = null;
  let frame = 0;
  return {
    onSnapshot(l: (snap: StateSnapshot) => void) {
      listener = l;
      return () => {
        listener = null;
      };
    },
    init() {
      return Promise.resolve(snapshot(ENTRY_PC_HEX, frame++));
    },
    codeBase() {
      return Promise.resolve(CODE_BASE);
    },
    lineMap() {
      return Promise.resolve(flatLineMap);
    },
    getMemory() {
      return Promise.resolve(new Uint8Array(4));
    },
    assemble() {
      const result: AssembleResultPayload = {
        success: true,
        instruction_count: instructionCount,
      };
      const snap = snapshot(ENTRY_PC_HEX, frame++);
      listener?.(snap);
      return Promise.resolve({ result, snapshot: snap });
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useEmulator post-assemble current-line marker", () => {
  it("marks a hosted program's prologue line immediately after assemble", async () => {
    h.backend = makeFakeBackend(FLAT_LINE_MAP, 5);

    const { result } = renderHook(() => useEmulator());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      result.current.assemble(HOSTED_SOURCE);
    });

    // Without the fix the marker stays on the legacy fallback line (1, the
    // first `define`). The authoritative map must move it to the prologue
    // right after assemble, with no step required.
    await waitFor(() => expect(result.current.currentLine).toBe(PROLOGUE_LINE));
  });
});
