import { vi } from "vitest";
import type { EmulatorState } from "@/lib/emulator/use-emulator";

/**
 * One stand-in for the emulator hub, shared by every playground component
 * suite.
 *
 * Typed against the real EmulatorState rather than a loose record, because a
 * loose record hides exactly the mistakes a fake exists to catch: a suite can
 * miss fpRegisters, externalCall, or memoryRegions, so the d-register view, the
 * external-call card, and the memory jump list render their fallback branch,
 * and a typo in an override name never fails.
 *
 * The defaults describe a loaded machine with nothing assembled and nothing
 * run. Where a field gates a whole view, the default is the one that leaves
 * the view in its fallback branch: fpRegisters is [] (RegisterPanel shows the
 * d-file only at exactly 32 slots, so [] reads as a wasm build with no FP
 * surface), externalCall is null (the pc is on one of the program's own
 * instructions), and memoryRegions is [] (the memory panel falls back to its
 * own section list). A suite that wants the other branch passes it.
 *
 * The mocks are built per call, so two hubs in one test never share call
 * records. Every promise-returning field resolves the shape its type
 * promises; an assemble resolving `undefined` lets a suite pass on a branch
 * the real hub can never take.
 */
export function makeHub(overrides: Partial<EmulatorState> = {}): EmulatorState {
  return {
    isLoaded: true,
    loadError: null,
    registers: Array(31).fill("0x0000000000000000") as string[],
    fpRegisters: [],
    sp: "0x0000000080000000",
    pc: 0x400000,
    nzcv: 0,
    changedRegs: new Set<number>(),
    changedFpRegs: new Set<number>(),
    isRunning: false,
    isAssembling: false,
    isHalted: false,
    programLoaded: false,
    error: null,
    assemblyErrors: [],
    breakpoints: new Set<number>(),
    currentLine: null,
    externalCall: null,
    instructions: [],
    codeBase: 0x400000,
    memoryRegions: [],
    stdout: "",
    stderr: "",
    blocked: false,
    wantsTerminal: false,
    setOutputTap: vi.fn(),
    exitCode: null,
    hostedMode: false,
    vfsFiles: [],
    assemble: vi.fn(async () => true),
    assembleForTool: vi.fn(async () => ({
      success: true,
      error: null,
      errorLine: null,
    })),
    step: vi.fn(),
    stepBack: vi.fn(),
    canStepBack: false,
    stepCount: 0,
    savedStates: [],
    saveState: vi.fn(),
    loadState: vi.fn(),
    deleteState: vi.fn(),
    run: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    toggleBreakpoint: vi.fn(),
    clearAllBreakpoints: vi.fn(),
    remapBreakpoints: vi.fn(),
    getMemory: vi.fn(() => new Uint8Array()),
    getMemoryMapped: vi.fn(() => true),
    pushStdin: vi.fn(),
    setSnapshotsPaused: vi.fn(),
    closeStdin: vi.fn(),
    uploadVfsFile: vi.fn(),
    readVfsFile: vi.fn(async () => new Uint8Array()),
    deleteVfsFile: vi.fn(async () => true),
    resolveLabel: vi.fn(async () => null),
    lint: vi.fn(async () => []),
    m4Expand: vi.fn(async () => null),
    setBreakpointAddress: vi.fn(async () => {}),
    clearBreakpointAddress: vi.fn(async () => {}),
    restoreBookmark: vi.fn(async () => ({ success: true, stepped: 0 })),
    clearConsole: vi.fn(),
    dirtyAddrs: [],
    replayFrames: [],
    seekReplay: vi.fn(),
    ...overrides,
  };
}
