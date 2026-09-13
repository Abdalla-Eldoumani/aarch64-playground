import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import type { ReactNode } from "react";

// The core children pull in Monaco and toast; stub them so jsdom
// never instantiates the editor or WASM. The tests exercise
// EmbeddablePlayground's own logic (lazy engage, the handle, onStateChange,
// chrome gating), not the children. The reduced embed/checker chrome renders
// only these three plus the minimal control set, so they keep the heavy full
// layout out of these unit tests.
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: () => <div data-testid="console" />,
}));
// react-resizable-panels needs a ResizeObserver jsdom does not provide; the
// full-chrome layout is not what these unit tests exercise.
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
  // The tablet arrangement reaches the panel library through PaneSplit;
  // these suites want the panes it wraps, not the split itself.
  PaneSplit: ({ first, second }: { first: ReactNode; second: ReactNode }) => (
    <div data-testid="pane-split">
      {first}
      {second}
    </div>
  ),
  EDITOR_SPLIT: { label: "resize editor and disassembly" },
  DEBUG_SPLIT: { label: "resize registers and tabs" },
}));
// Capture the tutorial's props so tests can drive onLoadSnippet, the snippet
// handoff contract, without walking the real tour UI.
const tutorialProps = vi.hoisted(() => ({
  current: null as null | {
    onLoadSnippet: (
      src: string,
      label: string,
      args?: string,
      stdin?: string,
    ) => void;
  },
}));
vi.mock("@/components/playground/TutorialRunner", () => ({
  TutorialRunner: (props: NonNullable<typeof tutorialProps.current>) => {
    tutorialProps.current = props;
    return <div data-testid="tutorial-runner" />;
  },
}));
// Capture the terminal's props so tests can exercise buildTerminalContext, the
// run-wait contract behind `./program`, without booting a real xterm.
const terminalProps = vi.hoisted(() => ({
  current: null as null | {
    buildContext: () => {
      runProgram: (
        args: string[],
        stdin?: string,
      ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    };
  },
}));
vi.mock("@/components/panels/TerminalPane", () => ({
  TerminalPane: (props: NonNullable<typeof terminalProps.current>) => {
    terminalProps.current = props;
    return <div data-testid="terminal-pane" />;
  },
}));

// A spy for the hub so a test can assert it is not called (the hub not
// engaged) before the lazy trigger fires.
const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
  type EmbeddableState,
} from "@/components/playground/EmbeddablePlayground";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";
import type { EmulatorState } from "@/lib/emulator/use-emulator";

type Hub = EmulatorState;

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
  // The idle-engage cases stub globals jsdom does not provide; leaving one in
  // place would change what every later case sees.
  vi.unstubAllGlobals();
});

// The full-chrome surface is reached through dynamic(), so it mounts a beat
// after the shell does. Awaiting the same import settles it before a case
// reads the surface's own markup.
async function fullChromeMounted() {
  await act(async () => {
    await import("@/components/playground/FullChromeSurface");
  });
}

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

  it("carries the base converter in the command actions", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    const action = ref
      .current!.getCommands()
      .find((command) => command.id === "base-converter");
    expect(action).toBeTruthy();
    expect(action!.description).toContain("two's complement");
    // Running it flips the full-chrome tab and the mobile pane request; in
    // embed chrome that state simply has no surface, so it must not throw.
    act(() => action!.run());
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

  it("routes the observer's engage through an idle slot, once", () => {
    // jsdom supplies neither of these, so both are stubbed: the observer to
    // drive the only engage path that defers, and the idle queue to hold the
    // callback rather than run it.
    let intersect: () => void = () => {};
    class ObserverStub {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];
      constructor(callback: IntersectionObserverCallback) {
        intersect = () => {
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        };
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    let runIdle: () => void = () => {};
    let idleOptions: IdleRequestOptions | undefined;
    const requestIdle = vi.fn(
      (callback: IdleRequestCallback, options?: IdleRequestOptions) => {
        runIdle = () => callback({ didTimeout: false, timeRemaining: () => 0 });
        idleOptions = options;
        return 7;
      },
    );
    vi.stubGlobal("IntersectionObserver", ObserverStub);
    vi.stubGlobal("requestIdleCallback", requestIdle);
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    render(<EmbeddablePlayground chrome="embed" />);
    expect(useEmulatorMock).not.toHaveBeenCalled();

    // Two intersections, one queued engage: the observer reports every change.
    act(() => {
      intersect();
      intersect();
    });
    expect(requestIdle).toHaveBeenCalledTimes(1);
    expect(idleOptions).toEqual({ timeout: 1200 });
    expect(useEmulatorMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("editor")).toBeNull();

    act(() => runIdle());
    expect(useEmulatorMock).toHaveBeenCalled();
    expect(screen.getByTestId("editor")).toBeTruthy();
  });

  it("arranges the embed through the container-driven grid areas", () => {
    const { container } = render(<EmbeddablePlayground chrome="embed" />);
    engage(container);
    // The embed's own width, not the viewport, picks the arrangement: the
    // root declares the size container and each panel sits in a named area
    // the globals.css container queries re-place per width band.
    const layoutRoot = container.querySelector(".embed-layout");
    expect(layoutRoot).not.toBeNull();
    const grid = layoutRoot!.querySelector(".embed-grid");
    expect(grid).not.toBeNull();
    expect(
      grid!.querySelector('.embed-area-editor [data-testid="editor"]'),
    ).toBeTruthy();
    expect(
      grid!.querySelector('.embed-area-registers [data-testid="registers"]'),
    ).toBeTruthy();
    expect(
      grid!.querySelector('.embed-area-console [data-testid="console"]'),
    ).toBeTruthy();
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

  it("renders the embed control set: run, step, back, reset, and no assemble or check", () => {
    const { container } = render(<EmbeddablePlayground chrome="embed" />);
    engage(container);
    expect(screen.getByLabelText("run")).toBeTruthy();
    expect(screen.getByLabelText("step")).toBeTruthy();
    expect(screen.getByLabelText("back")).toBeTruthy();
    expect(screen.getByLabelText("reset")).toBeTruthy();
    // Assemble stays full-only: the embed's run and step assemble first.
    expect(screen.queryByLabelText("assemble")).toBeNull();
    // Check belongs to checker chrome.
    expect(screen.queryByLabelText("check")).toBeNull();
  });

  it("drops step and back when the host opts out", () => {
    const { container } = render(
      <EmbeddablePlayground chrome="embed" showStep={false} showBack={false} />,
    );
    engage(container);
    expect(screen.getByLabelText("run")).toBeTruthy();
    expect(screen.getByLabelText("reset")).toBeTruthy();
    expect(screen.queryByLabelText("step")).toBeNull();
    expect(screen.queryByLabelText("back")).toBeNull();
  });

  it("embed Step assembles the current source before advancing", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    fireEvent.click(screen.getByLabelText("step"));
    await waitFor(() => expect(hub.step).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledWith("mov x0, #1", []);
    // A bare step over empty memory executes nothing the student wrote.
    expect(vi.mocked(hub.assemble).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(hub.step).mock.invocationCallOrder[0],
    );
  });

  it("embed Step restarts a halted program instead of standing still", async () => {
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
      isHalted: true,
    });
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    const step = screen.getByLabelText("step");
    // The button stays live on a finished program: step means run it again
    // from the first instruction, the same reading run takes.
    expect(step.hasAttribute("disabled")).toBe(false);
    fireEvent.click(step);
    await waitFor(() => expect(hub.step).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    expect(vi.mocked(hub.assemble).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(hub.step).mock.invocationCallOrder[0],
    );
  });

  it("checker Check runs the current source to completion, then reports the post-run snapshot", async () => {
    const hub: Hub = makeHub({ exitCode: 7 });
    hub.assemble = vi.fn().mockResolvedValue(true);
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
    expect(vi.mocked(hub.assemble).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(hub.run).mock.invocationCallOrder[0],
    );
    expect((onCheck.mock.calls[0][0] as EmbeddableState).exitCode).toBe(7);
  });

  it("checker Check never grades a program that failed to assemble", async () => {
    const hub: Hub = makeHub({ exitCode: 7 });
    hub.assemble = vi.fn().mockResolvedValue(false);
    useEmulatorMock.mockReturnValue(hub);
    const onCheck = vi.fn();
    const { container } = render(
      <EmbeddablePlayground chrome="checker" startSource="mvo x0, #1" onCheck={onCheck} />,
    );
    engage(container);
    fireEvent.click(screen.getByLabelText("check"));
    await waitFor(() => expect(hub.assemble).toHaveBeenCalledTimes(1));
    // An unconditional callback would grade the stale machine, ticking
    // structural checks green against source that never built.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hub.run).not.toHaveBeenCalled();
    expect(onCheck).not.toHaveBeenCalled();
  });

  it("checker Check re-runs after a source edit, but not when the source is unchanged", async () => {
    // A loaded program so the re-run is driven purely by the source-change
    // guard, not by the empty-instructions branch.
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
    });
    hub.assemble = vi.fn().mockResolvedValue(true);
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
    hub.assemble = vi.fn().mockResolvedValue(true);
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
    expect(vi.mocked(hub.assemble).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(hub.run).mock.invocationCallOrder[0],
    );
  });

  it("embed Run does not re-assemble an unchanged, already-loaded program", async () => {
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
    });
    hub.assemble = vi.fn().mockResolvedValue(true);
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

  it("embed Run re-assembles a halted program so it restarts from the top", async () => {
    // A finished program leaves the machine halted; Run must mean "run it
    // again", not a dead button or a silent no-op on stale memory.
    const hub: Hub = makeHub({
      isHalted: true,
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
    });
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    const run = screen.getByLabelText("run");
    expect((run as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(run);
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledWith("mov x0, #1", []);
  });

  it("embed Run re-applies the stdin seed after its assemble", async () => {
    // Assembling resets the machine (stdin queue included), so a program
    // arriving with seeded input must have it back before the run or the
    // read blocks and nothing ever prints.
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground
        chrome="embed"
        startSource="mov x0, #1"
        startStdin={"5\n"}
      />,
    );
    engage(container);
    (hub.pushStdin as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(1));
    expect(hub.pushStdin).toHaveBeenCalledWith("5\n");
    const order = (fn: ReturnType<typeof vi.fn>) => fn.mock.invocationCallOrder[0];
    expect(order(hub.assemble as ReturnType<typeof vi.fn>)).toBeLessThan(
      order(hub.pushStdin as ReturnType<typeof vi.fn>),
    );
    expect(order(hub.pushStdin as ReturnType<typeof vi.fn>)).toBeLessThan(
      order(hub.run as ReturnType<typeof vi.fn>),
    );
  });

  it("embed Run skips execution when the assemble fails", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(false);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="bad prog" startStdin={"5\n"} />,
    );
    engage(container);
    (hub.pushStdin as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() => expect(hub.assemble).toHaveBeenCalledTimes(1));
    // No run over empty memory and no seeding of a machine that has no program.
    expect(hub.run).not.toHaveBeenCalled();
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });

  it("checker Check re-applies the stdin seed after its assemble", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const onCheck = vi.fn();
    const { container } = render(
      <EmbeddablePlayground
        chrome="checker"
        startSource="mov x0, #1"
        startStdin={"7\n"}
        onCheck={onCheck}
      />,
    );
    engage(container);
    (hub.pushStdin as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByLabelText("check"));
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(1));
    expect(hub.pushStdin).toHaveBeenCalledWith("7\n");
    expect(
      (hub.assemble as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ).toBeLessThan(
      (hub.pushStdin as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
  });

  it("renders the load-failure message when the hub fails to load", () => {
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

  it("gates the full-chrome execution controls on the hub's loaded flag", async () => {
    // The real Controls renders in full chrome; run/step/back must follow
    // programLoaded even when the snapshot ring says stepping back is
    // possible (a stale canStepBack cannot outvote a missing program).
    useEmulatorMock.mockReturnValue(
      makeHub({ programLoaded: false, canStepBack: true }),
    );
    const { unmount } = render(<EmbeddablePlayground chrome="full" />);
    await fullChromeMounted();
    for (const name of [/^run/, /^step/, /^back/]) {
      expect(
        screen.getByRole("button", { name }).hasAttribute("disabled"),
      ).toBe(true);
    }
    expect(
      screen.getByRole("button", { name: /^assemble/ }).hasAttribute("disabled"),
    ).toBe(false);
    unmount();

    useEmulatorMock.mockReturnValue(
      makeHub({ programLoaded: true, canStepBack: true }),
    );
    render(<EmbeddablePlayground chrome="full" />);
    for (const name of [/^run/, /^step/, /^back/]) {
      expect(
        screen.getByRole("button", { name }).hasAttribute("disabled"),
      ).toBe(false);
    }
  });
});

describe("loadProgram", () => {
  it("resets the machine and applies the full payload", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="embed" startSource="old prog" />,
    );
    engage(container);
    act(() =>
      ref.current!.loadProgram({
        source: "new prog",
        args: "./prog a b",
        stdin: "in\n",
        vfs: { "input.txt": "data\n" },
      }),
    );
    // A fresh program starts on a fresh machine: no registers, console,
    // or VFS from the previous program may survive the load.
    expect(hub.reset).toHaveBeenCalledTimes(1);
    expect(hub.uploadVfsFile).toHaveBeenCalledWith(
      "input.txt",
      new TextEncoder().encode("data\n"),
    );
    expect(ref.current!.getSource()).toBe("new prog");
    expect(ref.current!.getArgs()).toBe("./prog a b");
    // stdin is a seed, not an immediate push: assembling clears the queue,
    // so it lands after each assemble instead.
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });

  it("re-applies the program's stdin and vfs seeds after a successful assemble", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="embed" startSource="old" />,
    );
    engage(container);
    act(() =>
      ref.current!.loadProgram({
        source: "mov x0, 1",
        stdin: "in\n",
        vfs: { "f.txt": "x" },
      }),
    );
    (hub.uploadVfsFile as ReturnType<typeof vi.fn>).mockClear();
    act(() => ref.current!.assemble());
    await waitFor(() => expect(hub.pushStdin).toHaveBeenCalledWith("in\n"));
    expect(hub.uploadVfsFile).toHaveBeenCalledWith(
      "f.txt",
      new TextEncoder().encode("x"),
    );
    // Seeds land after the assemble round-trip, on the freshly reset machine.
    expect(
      (hub.assemble as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ).toBeLessThan(
      (hub.pushStdin as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
  });

  it("does not seed inputs when the assemble fails", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(false);
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="embed" startSource="old" />,
    );
    engage(container);
    act(() => ref.current!.loadProgram({ source: "bad prog", stdin: "in\n" }));
    act(() => ref.current!.assemble());
    await waitFor(() => expect(hub.assemble).toHaveBeenCalled());
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });
});

describe("program delivery from recents and the tutorial", () => {
  afterEach(() => {
    window.localStorage.clear();
    tutorialProps.current = null;
  });

  it("loads a recent as a fresh program: machine reset, args cleared, stdin dropped", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(
      <EmbeddablePlayground
        ref={ref}
        chrome="full"
        startSource={"// working buffer\nret"}
      />,
    );
    await fullChromeMounted();
    // A handoff carrying stdin and VFS seeds displaces the buffer into
    // recents. The stdin seed must not survive the recall; the VFS file
    // stays, because full chrome treats the VFS as the student's home
    // directory (files persist across program loads until removed).
    act(() =>
      ref.current!.loadProgram({
        source: "// prog a",
        args: "./a 1",
        stdin: "stale-in\n",
        vfs: { "stale.txt": "x" },
      }),
    );
    // The custom Select opens as a listbox; pick the first real recent row
    // (any option that is not the clear-history sentinel).
    fireEvent.click(screen.getByRole("combobox", { name: "load recent program" }));
    const entry = screen
      .getAllByRole("option")
      .find((option) => option.textContent !== "clear history");
    expect(entry).toBeDefined();
    (hub.reset as ReturnType<typeof vi.fn>).mockClear();
    (hub.uploadVfsFile as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.pointerDown(entry!);
    // The recall is a program delivery, not a text swap: fresh machine,
    // recalled source, no inherited args.
    expect(hub.reset).toHaveBeenCalledTimes(1);
    expect(ref.current!.getSource()).toBe("// working buffer\nret");
    expect(ref.current!.getArgs()).toBe("");
    // Assembling the recalled program must not re-seed the previous
    // program's stdin; the home-directory file rides along.
    act(() => ref.current!.assemble());
    await waitFor(() => expect(hub.assemble).toHaveBeenCalled());
    expect(hub.pushStdin).not.toHaveBeenCalled();
    const uploaded = (hub.uploadVfsFile as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(uploaded).toContain("stale.txt");
  });

  it("loads a tutorial snippet without pre-seeding stdin: input stays interactive", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource="// old" />,
    );
    await waitFor(() => expect(tutorialProps.current).not.toBeNull());
    act(() => {
      tutorialProps.current!.onLoadSnippet(
        "mov x0, 1",
        "scores",
        "./scores",
        "85\n92\n",
      );
    });
    expect(hub.reset).toHaveBeenCalled();
    expect(ref.current!.getSource()).toBe("mov x0, 1");
    expect(ref.current!.getArgs()).toBe("./scores");
    // The full playground never queues canned stdin: a program that reads
    // input blocks at the read, the console tab opens, and the student
    // types the values themselves. Assembling must not push the fixture.
    act(() => ref.current!.assemble());
    await waitFor(() => expect(hub.assemble).toHaveBeenCalled());
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });
});

describe("prior-work preservation (full chrome)", () => {
  const KEY_CURRENT = "aarch64-playground:auto-save:current";
  const KEY_RECENT = "aarch64-playground:auto-save:recent";

  afterEach(() => {
    window.localStorage.clear();
  });

  function recentBodies(): string[] {
    const raw = window.localStorage.getItem(KEY_RECENT);
    if (!raw) return [];
    return (JSON.parse(raw) as Array<{ body: string }>).map((e) => e.body);
  }

  it("keeps an autosave displaced by a handoff boot reachable through recents", () => {
    window.localStorage.setItem(KEY_CURRENT, "// prior work\nret");
    // The loading gate keeps the heavy full layout out of the test; the
    // preservation effect runs on mount regardless.
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(<EmbeddablePlayground chrome="full" startSource="// shared program" />);
    expect(recentBodies()).toContain("// prior work\nret");
  });

  it("leaves recents alone when the boot buffer is the autosave itself", () => {
    window.localStorage.setItem(KEY_CURRENT, "// prior work\nret");
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(
      <EmbeddablePlayground chrome="full" startSource={"// prior work\nret"} />,
    );
    expect(window.localStorage.getItem(KEY_RECENT)).toBeNull();
  });

  it("preserves the replaced buffer in recents when a program loads over it", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(
      <EmbeddablePlayground
        ref={ref}
        chrome="full"
        startSource={"// working buffer\nret"}
      />,
    );
    act(() => ref.current!.loadProgram({ source: "// example", label: "example" }));
    expect(recentBodies()).toContain("// working buffer\nret");
  });
});

describe("terminal context", () => {
  function setWidth(px: number): void {
    Object.defineProperty(window, "innerWidth", {
      value: px,
      configurable: true,
      writable: true,
    });
    window.dispatchEvent(new Event("resize"));
  }

  afterEach(() => {
    terminalProps.current = null;
    setWidth(1024);
  });

  it("runProgram reports the post-run stdout and exit code, not the pre-run state", async () => {
    // Mirror the real useEmulator: run() flips isRunning through React state,
    // so the hub object the wait loop reads through emuRef only advances when
    // a render commits. The stub keeps that latency: `phase` moves inside
    // run(), but no hub carries the new value until the next rerender, which
    // is what makes a check-before-sleep loop exit on the pre-run false and
    // report stale stdout and exit code.
    let phase: "idle" | "running" | "done" = "idle";
    const assemble = vi.fn(async () => true);
    const run = vi.fn(() => {
      phase = "running";
    });
    useEmulatorMock.mockImplementation(() => ({
      ...makeHub(),
      assemble,
      run,
      isRunning: phase === "running",
      stdout: phase === "done" ? "Hello from a system call!\n" : "",
      exitCode: phase === "done" ? 3 : null,
    }));
    // The tablet branch renders the right-tab strip directly, so the term tab
    // (and the mocked TerminalPane behind it) mounts without ResizableLayout.
    setWidth(800);
    const view = () => <EmbeddablePlayground chrome="full" startSource="ret" />;
    const { rerender } = render(view());
    fireEvent.click(await screen.findByRole("tab", { name: "term" }));
    await waitFor(() => expect(terminalProps.current).not.toBeNull());

    const context = terminalProps.current!.buildContext();
    // Fake timers from here: the poll sleeps 16 ms between reads of the hub,
    // and with real timers a loaded machine could let that sleep elapse
    // before the running hub was committed, which read as the very bug this
    // test guards. Advancing the clock by hand pins the order.
    vi.useFakeTimers();
    try {
      let result: { stdout: string; stderr: string; exitCode: number } | null = null;
      const pending = context.runProgram(["./program"]).then((r) => {
        result = r;
      });
      // Flush the awaited assemble so run() fires; the running hub has not
      // committed yet, so a loop that checks before sleeping would bail here.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(run).toHaveBeenCalledTimes(1);

      // Commit the running hub, then let the poll take two reads: the command
      // must still be waiting on the live run, not already resolved with
      // pre-run state.
      rerender(view());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(32);
      });
      expect(result).toBeNull();

      // Commit the halted hub; the next poll observes it and reports its output.
      phase = "done";
      rerender(view());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16);
        await pending;
      });
      expect(result).toEqual({
        stdout: "Hello from a system call!\n",
        stderr: "",
        exitCode: 3,
      });
    } finally {
      vi.useRealTimers();
    }
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
    const assemble = vi.fn().mockResolvedValue(true);
    const step = vi.fn();
    // Mirror the real useEmulator: a fresh hub object every render (its memo
    // deps include the changing registers/pc) while the assemble/step spies
    // persist. A referentially stable hub would pass even if `emu` were
    // re-added to the autoplay effect's deps, the freeze regression this
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
    // Drive the walk's idle wait (jsdom has no requestIdleCallback, so it
    // sits on the setTimeout fallback), then flush the awaited assemble so
    // the step interval registers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
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

  it("waits for an idle slot before the first assemble", async () => {
    let runIdle: () => void = () => {};
    let idleOptions: IdleRequestOptions | undefined;
    const requestIdle = vi.fn(
      (callback: IdleRequestCallback, options?: IdleRequestOptions) => {
        runIdle = () => callback({ didTimeout: false, timeRemaining: () => 0 });
        idleOptions = options;
        return 11;
      },
    );
    vi.stubGlobal("requestIdleCallback", requestIdle);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    const assemble = vi.fn().mockResolvedValue(true);
    const step = vi.fn();
    useEmulatorMock.mockImplementation(() => ({ ...makeHub(), assemble, step }));
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
      await vi.advanceTimersByTimeAsync(2000);
    });
    // The walk is parked in the idle queue: nothing has reached the machine,
    // and the timeout is what keeps a busy thread from stranding it there.
    expect(assemble).not.toHaveBeenCalled();
    expect(requestIdle).toHaveBeenCalledTimes(1);
    expect(idleOptions).toEqual({ timeout: 1200 });

    await act(async () => {
      runIdle();
      await Promise.resolve();
    });
    expect(assemble).toHaveBeenCalledTimes(1);
    expect(assemble).toHaveBeenCalledWith("mov x0, #1", []);
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
