import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The embed console contract: hub output must reach the student through the
// REAL ConsolePanel inside embed chrome, so these tests stub only the heavy
// neighbors (Monaco editor, register grid) and leave the console unmocked.
// EmbeddablePlayground.test.tsx owns the control-logic coverage; this file
// owns what the student actually sees in the console.
vi.mock("@/components/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/Toast", () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
    info: vi.fn(),
  }),
}));

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import { EmbeddablePlayground } from "./EmbeddablePlayground";

function makeHub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    isLoaded: true,
    loadError: null as string | null,
    registers: Array(31).fill("0x0000000000000000") as string[],
    sp: "0x0000000080000000",
    pc: 0x400000,
    nzcv: 0,
    changedRegs: new Set<number>(),
    isRunning: false,
    isHalted: false,
    error: null as string | null,
    assemblyErrors: [],
    breakpoints: new Set<number>(),
    currentLine: null,
    instructions: [],
    codeBase: 0x400000,
    stdout: "",
    stderr: "",
    blocked: false,
    exitCode: null as number | null,
    hostedMode: false,
    vfsFiles: [] as string[],
    canStepBack: false,
    stepCount: 0,
    savedStates: [] as string[],
    lineCounts: new Map<number, number>(),
    dirtyAddrs: [] as Array<[number, number]>,
    replayFrames: [],
    assemble: vi.fn(),
    step: vi.fn(),
    stepBack: vi.fn(),
    run: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    toggleBreakpoint: vi.fn(),
    getMemory: vi.fn(() => new Uint8Array()),
    pushStdin: vi.fn(),
    uploadVfsFile: vi.fn(),
    readVfsFile: vi.fn(),
    deleteVfsFile: vi.fn(),
    resolveLabel: vi.fn(),
    setBreakpointAddress: vi.fn(),
    clearBreakpointAddress: vi.fn(),
    restoreBookmark: vi.fn(),
    clearConsole: vi.fn(),
    saveState: vi.fn(),
    loadState: vi.fn(),
    deleteState: vi.fn(),
    seekReplay: vi.fn(),
    ...overrides,
  };
}

function engage(container: HTMLElement) {
  act(() => {
    fireEvent.mouseDown(container.firstChild as Element);
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("embed console rendering", () => {
  it("renders accumulated stdout deltas in place of the placeholder", () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const view = () => (
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />
    );
    const { container, rerender } = render(view());
    engage(container);
    expect(screen.getByText(/output prints here/i)).toBeTruthy();

    // The hub grows stdout as snapshot deltas apply; each re-render must
    // stream the accumulated text into the embed console.
    useEmulatorMock.mockReturnValue(makeHub({ stdout: "sum =" }));
    rerender(view());
    expect(screen.getByText("sum =")).toBeTruthy();
    expect(screen.queryByText(/output prints here/i)).toBeNull();

    useEmulatorMock.mockReturnValue(makeHub({ stdout: "sum = 10\n" }));
    rerender(view());
    expect(screen.getByText(/sum = 10/)).toBeTruthy();
  });

  it("renders stderr in the danger treatment beside stdout", () => {
    useEmulatorMock.mockReturnValue(
      makeHub({ stdout: "partial result\n", stderr: "error: bad input\n" }),
    );
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    expect(screen.getByText(/partial result/)).toBeTruthy();
    const err = screen.getByText(/error: bad input/);
    expect(err.className).toContain("--danger");
  });

  it("shows the exit code in the embed console header", () => {
    useEmulatorMock.mockReturnValue(makeHub({ stdout: "done\n", exitCode: 3 }));
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    expect(screen.getByText("exit 3")).toBeTruthy();
  });

  it("sends stdin from the embed console to the hub, newline-terminated", () => {
    const hub = makeHub({ blocked: true });
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    const input = screen.getByLabelText("Standard input");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(hub.pushStdin).toHaveBeenCalledWith("42\n");
  });
});
