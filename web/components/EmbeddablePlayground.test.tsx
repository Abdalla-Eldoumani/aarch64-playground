import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";

// The core children pull in Monaco and toast; stub them so jsdom
// never instantiates the editor or WASM. The tests exercise
// EmbeddablePlayground's own logic (lazy engage, the handle, onStateChange,
// chrome gating), not the children. The reduced embed/checker chrome renders
// only these three plus the minimal control set, so they keep the heavy full
// layout out of these unit tests.
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
  it("is driveable through an imperative handle once engaged", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
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
    const { container } = render(
      <EmbeddablePlayground chrome="embed" onStateChange={onStateChange} />,
    );
    engage(container);
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

  it("checker Check runs the current source to completion, then reports the post-run snapshot", async () => {
    const hub: Hub = makeHub({ exitCode: 7 });
    hub.assemble = vi.fn().mockResolvedValue(undefined);
    useEmulatorMock.mockReturnValue(hub);
    const onCheck = vi.fn();
    const { container } = render(
      <EmbeddablePlayground chrome="checker" startSource="mov x0, #1" onCheck={onCheck} />,
    );
    engage(container);
    fireEvent.click(screen.getByLabelText("check"));
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(1));
    // The current source is assembled and run before the snapshot is read, so
    // the checker never evaluates a stale run (or zeroed pre-run state).
    expect(hub.assemble).toHaveBeenCalledWith("mov x0, #1", []);
    expect(hub.run).toHaveBeenCalledTimes(1);
    expect(hub.assemble.mock.invocationCallOrder[0]).toBeLessThan(
      hub.run.mock.invocationCallOrder[0],
    );
    expect((onCheck.mock.calls[0][0] as EmbeddableState).exitCode).toBe(7);
  });

  it("checker Check re-runs after a source edit, but not when the source is unchanged", async () => {
    // A loaded program so the re-run is driven purely by the source-change
    // guard, not by the empty-instructions branch.
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
    });
    hub.assemble = vi.fn().mockResolvedValue(undefined);
    useEmulatorMock.mockReturnValue(hub);
    const onCheck = vi.fn();
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground
        ref={ref}
        chrome="checker"
        startSource="mov x0, #1"
        onCheck={onCheck}
      />,
    );
    engage(container);
    const check = screen.getByLabelText("check");

    // First check: nothing has run yet, so it assembles + runs the starter.
    fireEvent.click(check);
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    expect(hub.run).toHaveBeenCalledTimes(1);

    // Editing the source then checking re-assembles + re-runs the new source.
    act(() => ref.current!.loadSource("mov x0, #2"));
    fireEvent.click(check);
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(2));
    expect(hub.assemble).toHaveBeenLastCalledWith("mov x0, #2", []);
    expect(hub.assemble).toHaveBeenCalledTimes(2);
    expect(hub.run).toHaveBeenCalledTimes(2);

    // Checking again without an edit reports the existing state without re-running.
    fireEvent.click(check);
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(3));
    expect(hub.assemble).toHaveBeenCalledTimes(2);
    expect(hub.run).toHaveBeenCalledTimes(2);
  });

  it("embed Run assembles the current source before executing", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(undefined);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledWith("mov x0, #1", []);
    // assemble must precede run so runUntilBreak sees a loaded program, not
    // empty memory (the visible Run is the embed's only execution trigger).
    expect(hub.assemble.mock.invocationCallOrder[0]).toBeLessThan(
      hub.run.mock.invocationCallOrder[0],
    );
  });

  it("embed Run does not re-assemble an unchanged, already-loaded program", async () => {
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
    });
    hub.assemble = vi.fn().mockResolvedValue(undefined);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    const run = screen.getByLabelText("run");
    fireEvent.click(run);
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    fireEvent.click(run);
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(2));
    // source unchanged and a program is loaded, so Run executes again without
    // a second assemble.
    expect(hub.assemble).toHaveBeenCalledTimes(1);
  });

  it("renders the calm fault treatment when the hub fails to load", () => {
    useEmulatorMock.mockReturnValue(
      makeHub({ isLoaded: false, loadError: "wasm exploded" }),
    );
    // Full chrome engages on mount; the load-error gate returns before any
    // heavy panel renders.
    render(<EmbeddablePlayground chrome="full" />);
    expect(screen.getByText(/failed to load emulator/i)).toBeTruthy();
    expect(screen.getByText("wasm exploded")).toBeTruthy();
  });

  it("sets data-embed on the wrapper only in embed chrome", () => {
    // isLoaded:false keeps the core on the loading gate so the heavy full
    // layout never renders; the wrapper attribute still reflects chrome.
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    const { container, rerender } = render(<EmbeddablePlayground chrome="full" />);
    expect((container.firstChild as HTMLElement).getAttribute("data-embed")).toBeNull();
    rerender(<EmbeddablePlayground chrome="embed" />);
    expect((container.firstChild as HTMLElement).getAttribute("data-embed")).toBe("1");
  });
});

describe("autoplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("assembles then steps on a timer, surviving the per-step re-render", async () => {
    const assemble = vi.fn().mockResolvedValue(undefined);
    const step = vi.fn();
    // Mirror the real useEmulator: a fresh hub object every render (its memo
    // deps include the changing registers/pc) while the assemble/step spies
    // persist. A referentially stable hub would pass even if `emu` were
    // re-added to the autoplay effect's deps -- the freeze regression this
    // guards: keying on `emu` clears the interval on the first re-render and the
    // once-per-engage guard then strands the walk (step fires 0-1 times).
    useEmulatorMock.mockImplementation(() => ({ ...makeHub(), assemble, step }));
    // A factory so every (re-)render gets a fresh element: React bails out on an
    // identical element reference, so this forces the re-render and a new hub.
    const view = () => (
      <EmbeddablePlayground
        chrome="embed"
        autoplay
        autoplaySteps={3}
        startSource="mov x0, #1"
      />
    );
    const { container, rerender } = render(view());
    // The global matchMedia stub reports not-reduced, so the walk runs.
    engage(container);
    // Flush the awaited assemble so the step interval registers.
    await act(async () => {
      await Promise.resolve();
    });
    // Drive the per-step re-renders that hand useEmulator a new identity. The
    // ref-based effect keeps the one timer alive across them, so each tick still
    // lands; an `emu`-keyed effect would clear it on the first re-render.
    rerender(view());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    rerender(view());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    rerender(view());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(assemble).toHaveBeenCalledTimes(1);
    expect(assemble).toHaveBeenCalledWith("mov x0, #1", []);
    expect(step).toHaveBeenCalledTimes(3);
  });

  it("does nothing under prefers-reduced-motion: reduce", async () => {
    const realMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: /prefers-reduced-motion:\s*reduce/.test(query),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const hub: Hub = makeHub();
      hub.assemble = vi.fn().mockResolvedValue(undefined);
      useEmulatorMock.mockReturnValue(hub);
      const { container } = render(
        <EmbeddablePlayground
          chrome="embed"
          autoplay
          autoplaySteps={3}
          startSource="mov x0, #1"
        />,
      );
      engage(container);
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(hub.assemble).not.toHaveBeenCalled();
      expect(hub.step).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = realMatchMedia;
    }
  });
});
