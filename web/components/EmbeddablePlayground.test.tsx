import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";

// The core children pull in Monaco / framer / toast; stub them so jsdom
// never instantiates the editor or WASM. The tests exercise
// EmbeddablePlayground's own logic (lazy engage, the handle, onStateChange,
// chrome gating), not the children.
vi.mock("@/components/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/ConsolePanel", () => ({
  ConsolePanel: () => <div data-testid="console" />,
}));

// A spy for the hub so a test can assert it is not called (the hub not
// engaged) before the lazy trigger fires.
const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
  type EmbeddableState,
} from "./EmbeddablePlayground";

type Hub = ReturnType<typeof makeHub>;

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

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EmbeddablePlayground", () => {
  it("exports the component and is driveable through an imperative handle", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(<EmbeddablePlayground ref={ref} chrome="full" startSource="mov x0, #1" />);
    expect(ref.current).not.toBeNull();
    act(() => ref.current!.step());
    expect(hub.step).toHaveBeenCalledTimes(1);
    expect(ref.current!.getSource()).toBe("mov x0, #1");
  });

  it("does not engage the hub before the lazy trigger fires", () => {
    const { container } = render(<EmbeddablePlayground chrome="embed" />);
    // Embed defers until viewport entry / interaction; jsdom has no
    // IntersectionObserver, so the hub must stay dormant on mount.
    expect(useEmulatorMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("editor")).toBeNull();

    engage(container);
    expect(useEmulatorMock).toHaveBeenCalled();
    expect(screen.getByTestId("editor")).toBeTruthy();
  });

  it("emits exactly the ten outcome fields through onStateChange", async () => {
    useEmulatorMock.mockReturnValue(makeHub({ exitCode: 0, stdout: "hi" }));
    const onStateChange = vi.fn();
    render(<EmbeddablePlayground chrome="full" onStateChange={onStateChange} />);
    await waitFor(() => expect(onStateChange).toHaveBeenCalled());
    const state = onStateChange.mock.calls.at(-1)![0] as EmbeddableState;
    expect(Object.keys(state).sort()).toEqual(
      [
        "error",
        "exitCode",
        "isHalted",
        "isRunning",
        "nzcv",
        "pc",
        "registers",
        "sp",
        "stderr",
        "stdout",
      ].sort(),
    );
    expect(state.stdout).toBe("hi");
    expect(state.exitCode).toBe(0);
  });

  it("renders only a minimal control set in embed chrome", () => {
    const { container } = render(<EmbeddablePlayground chrome="embed" />);
    engage(container);
    expect(screen.getByLabelText("run")).toBeTruthy();
    expect(screen.getByLabelText("reset")).toBeTruthy();
    // Full-only controls (assemble / step / back) belong to the full chrome.
    expect(screen.queryByLabelText("assemble")).toBeNull();
    expect(screen.queryByLabelText("step")).toBeNull();
    expect(screen.queryByLabelText("check")).toBeNull();
  });

  it("exposes a Check button in checker chrome that reports the state", () => {
    const hub: Hub = makeHub({ exitCode: 7 });
    useEmulatorMock.mockReturnValue(hub);
    const onCheck = vi.fn();
    const { container } = render(
      <EmbeddablePlayground chrome="checker" onCheck={onCheck} />,
    );
    engage(container);
    const check = screen.getByLabelText("check");
    fireEvent.click(check);
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect((onCheck.mock.calls[0][0] as EmbeddableState).exitCode).toBe(7);
  });

  it("renders the calm fault treatment when the hub fails to load", () => {
    useEmulatorMock.mockReturnValue(
      makeHub({ isLoaded: false, loadError: "wasm exploded" }),
    );
    render(<EmbeddablePlayground chrome="full" />);
    expect(screen.getByText(/failed to load emulator/i)).toBeTruthy();
    expect(screen.getByText("wasm exploded")).toBeTruthy();
  });

  it("sets data-embed on the wrapper only in embed chrome", () => {
    const { container, rerender } = render(<EmbeddablePlayground chrome="full" />);
    expect((container.firstChild as HTMLElement).getAttribute("data-embed")).toBeNull();
    rerender(<EmbeddablePlayground chrome="embed" />);
    expect((container.firstChild as HTMLElement).getAttribute("data-embed")).toBe("1");
  });
});
