import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import type { ReactNode } from "react";

// The editor and panels are stubbed so jsdom never builds Monaco or loads the
// WASM; these tests cover EmbeddablePlayground's own logic, not its children.
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: (props: { openOn?: string; vectorRegisters?: string[] }) => (
    <div
      data-testid="registers"
      data-openon={props.openOn}
      data-vectors={props.vectorRegisters ? "shown" : "hidden"}
    />
  ),
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: ({ keyHints = true }: { keyHints?: boolean }) => (
    <div data-testid="console" data-keyhints={String(keyHints)} />
  ),
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
// Capture the tutorial's props so tests can call onLoadSnippet without the
// real tutorials UI.
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
// Capture the terminal's props so tests can call buildTerminalContext, which
// waits for `./program` to finish, without starting a real xterm.
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

// A spy, so a test can check the emulator is not started before the embed
// is pressed or scrolled into view.
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
  it("can be driven through its ref handle once started", () => {
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

  it("opens the embed's registers on the view the page asks for, x registers only otherwise", () => {
    const named = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" registerView="v" />,
    );
    engage(named.container);
    const panel = screen.getByTestId("registers");
    expect(panel.getAttribute("data-openon")).toBe("v");
    expect(panel.getAttribute("data-vectors")).toBe("shown");
    named.unmount();

    const plain = render(<EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />);
    engage(plain.container);
    const xOnly = screen.getByTestId("registers");
    expect(xOnly.getAttribute("data-openon")).toBeNull();
    expect(xOnly.getAttribute("data-vectors")).toBe("hidden");
  });

  it("lists the base converter among the commands", () => {
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
    // Running it switches tabs that only the full playground and the phone
    // layout have; an embed has neither, so it must not throw.
    act(() => action!.run());
  });

  // F9 outside the editor and the palette row act on main.asm's caret line.
  it("toggles a breakpoint on the caret's line from the handle and the palette", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground
        ref={ref}
        chrome="embed"
        startSource={"main:\n  mov x0, 1\n  ret"}
        startCursor={{ line: 2, column: 3 }}
      />,
    );
    engage(container);
    act(() => ref.current!.toggleBreakpoint());
    expect(hub.toggleBreakpoint).toHaveBeenCalledWith(2);

    const row = ref.current!.getCommands().find((command) => command.id === "toggle-breakpoint")!;
    expect(row.description).toBe("line 2, where the caret is: set or clear a breakpoint");
    act(() => row.run());
    expect(hub.toggleBreakpoint).toHaveBeenCalledTimes(2);
  });

  it("does not start the emulator before the first press", () => {
    const { container } = render(<EmbeddablePlayground chrome="embed" />);
    // An embed waits until it scrolls into view or is pressed; jsdom has no
    // IntersectionObserver, so the emulator must not start on mount.
    expect(useEmulatorMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("editor")).toBeNull();

    engage(container);
    expect(useEmulatorMock).toHaveBeenCalled();
    expect(screen.getByTestId("editor")).toBeTruthy();
  });

  it("starts once, in an idle moment, after scrolling into view", () => {
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

  it("places each embed pane in its named grid area", () => {
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

  it("hides step and back when the page turns them off", () => {
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

  it("checker Check runs the current source to completion, then reports the state after the run", async () => {
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
    // A loaded program that ran to its end, so the re-run is driven purely
    // by the source-change guard, not by the empty-instructions branch or
    // by a run that stopped short.
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
      isHalted: true,
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

  it("checker Check feeds the exercise's input, then closes it, and reruns a run that stopped short", async () => {
    // Loaded but not halted: a Run that stopped at a read. Grading that
    // half-finished state would fail a correct program, so Check starts over.
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "svc" }],
      isHalted: false,
    });
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const onCheck = vi.fn();
    const { container } = render(
      <EmbeddablePlayground
        chrome="checker"
        startSource="svc 0"
        startStdin={"one\ntwo\n"}
        onCheck={onCheck}
      />,
    );
    engage(container);
    fireEvent.click(screen.getByLabelText("check"));
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByLabelText("check"));
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(2));
    expect(hub.run).toHaveBeenCalledTimes(2);
    // The input goes in before end of input, and end of input before the run.
    const pushed = vi.mocked(hub.pushStdin).mock.invocationCallOrder.at(-1)!;
    const closed = vi.mocked(hub.closeStdin).mock.invocationCallOrder.at(-1)!;
    const ran = vi.mocked(hub.run).mock.invocationCallOrder.at(-1)!;
    expect(vi.mocked(hub.pushStdin)).toHaveBeenLastCalledWith("one\ntwo\n");
    expect(pushed).toBeLessThan(closed);
    expect(closed).toBeLessThan(ran);
  });

  it("checker shows an args box only when asked, and runs with what it holds", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const { container, rerender } = render(
      <EmbeddablePlayground chrome="checker" startSource="mov x0, 1" onCheck={vi.fn()} />,
    );
    expect(screen.queryByLabelText("args")).toBeNull();
    rerender(
      <EmbeddablePlayground
        chrome="checker"
        startSource="mov x0, 1"
        startArgs="12 7"
        showArgs
        onCheck={vi.fn()}
      />,
    );
    engage(container);
    const box = screen.getByLabelText("args") as HTMLInputElement;
    expect(box.value).toBe("12 7");
    fireEvent.change(box, { target: { value: "5 -3 8" } });
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() => expect(hub.assemble).toHaveBeenCalledWith("mov x0, 1", ["5", "-3", "8"]));
  });

  it("checker Check grades with the exercise's own args whatever the args box holds", async () => {
    // The expected output was written for the exercise's args, so a check on
    // the box's own args failed a correct program the moment the box changed.
    const hub: Hub = makeHub({
      instructions: [{ address: 0x400000, hex: "0x00000000", text: "mov" }],
      isHalted: true,
    });
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const onCheck = vi.fn();
    const { container } = render(
      <EmbeddablePlayground
        chrome="checker"
        startSource="mov x0, 1"
        startArgs="12 7"
        showArgs
        onCheck={onCheck}
      />,
    );
    engage(container);
    const box = screen.getByLabelText("args") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "5 6" } });
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() => expect(hub.assemble).toHaveBeenLastCalledWith("mov x0, 1", ["5", "6"]));

    const check = screen.getByLabelText("check");
    fireEvent.click(check);
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenLastCalledWith("mov x0, 1", ["12", "7"]);
    expect(hub.assemble).toHaveBeenCalledTimes(2);
    // The box stays the student's, for the next Run.
    expect(box.value).toBe("5 6");

    // A second check on the same source reuses the run with the exercise's args.
    fireEvent.click(check);
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(2));
    expect(hub.assemble).toHaveBeenCalledTimes(2);

    // And Run goes back to what the box holds.
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() => expect(hub.assemble).toHaveBeenCalledTimes(3));
    expect(hub.assemble).toHaveBeenLastCalledWith("mov x0, 1", ["5", "6"]);
  });

  it("embed consoles point at the step and run buttons, not at keys only the playground binds", () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const { container } = render(<EmbeddablePlayground chrome="embed" startSource="mov x0, 1" />);
    expect(screen.getByTestId("console").dataset.keyhints).toBe("false");
    engage(container);
    expect(screen.getByTestId("console").dataset.keyhints).toBe("false");
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

  it("embed Run sends the preset stdin again after its assemble", async () => {
    // Assembling resets the machine (stdin queue included), so a program
    // that came with preset input must have it back before the run or the
    // read waits and nothing ever prints.
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
    // No run over empty memory and no input for a machine that has no program.
    expect(hub.run).not.toHaveBeenCalled();
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });

  it("checker Check sends the preset stdin again after its assemble", async () => {
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

  it("renders the load-failure message when the emulator fails to load", () => {
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

  it("disables the full playground's step and back until a program is loaded, and keeps run live", async () => {
    // The real Controls renders in full chrome; step and back must follow
    // programLoaded even when the step-back history says stepping back is
    // possible (an old canStepBack cannot outvote a missing program). Run
    // assembles first, so it stays live with nothing loaded.
    useEmulatorMock.mockReturnValue(
      makeHub({ programLoaded: false, canStepBack: true }),
    );
    const { unmount } = render(<EmbeddablePlayground chrome="full" />);
    await fullChromeMounted();
    for (const name of [/^step/, /^back/]) {
      expect(
        screen.getByRole("button", { name }).hasAttribute("disabled"),
      ).toBe(true);
    }
    for (const name of [/^run/, /^assemble/]) {
      expect(
        screen.getByRole("button", { name }).hasAttribute("disabled"),
      ).toBe(false);
    }
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
  it("resets the machine and applies the source, args, stdin, and files", () => {
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
    // or files from the previous program may survive the load.
    expect(hub.reset).toHaveBeenCalledTimes(1);
    expect(hub.uploadVfsFile).toHaveBeenCalledWith(
      "input.txt",
      new TextEncoder().encode("data\n"),
    );
    expect(ref.current!.getSource()).toBe("new prog");
    expect(ref.current!.getArgs()).toBe("./prog a b");
    // stdin is not sent yet: assembling clears the queue, so it is sent after
    // each assemble instead.
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });

  it("sends the program's stdin and files again after a successful assemble", async () => {
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
    // They arrive after the assemble finishes, on the freshly reset machine.
    expect(
      (hub.assemble as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ).toBeLessThan(
      (hub.pushStdin as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
  });

  it("sends no input when the assemble fails", async () => {
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

describe("loading a program from recents and the tutorial", () => {
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
    // Loading a program with stdin and a file pushes the current code into
    // recents. The stdin must not come back with the recalled code; the file
    // stays, because the full playground treats files as the student's home
    // directory (they stay across program loads until removed).
    act(() =>
      ref.current!.loadProgram({
        source: "// prog a",
        args: "./a 1",
        stdin: "stale-in\n",
        vfs: { "stale.txt": "x" },
      }),
    );
    // The custom Select opens as a listbox; pick the first real recent row
    // (any option that is not "clear history").
    fireEvent.click(screen.getByRole("combobox", { name: "load recent program" }));
    const entry = screen
      .getAllByRole("option")
      .find((option) => option.textContent !== "clear history");
    expect(entry).toBeDefined();
    (hub.reset as ReturnType<typeof vi.fn>).mockClear();
    (hub.uploadVfsFile as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.pointerDown(entry!);
    // Loading a recent is a full program load, not a text swap: fresh
    // machine, recalled source, no args carried over.
    expect(hub.reset).toHaveBeenCalledTimes(1);
    expect(ref.current!.getSource()).toBe("// working buffer\nret");
    expect(ref.current!.getArgs()).toBe("");
    // Assembling the recalled program must not resend the previous
    // program's stdin; the home-directory file comes along.
    act(() => ref.current!.assemble());
    await waitFor(() => expect(hub.assemble).toHaveBeenCalled());
    expect(hub.pushStdin).not.toHaveBeenCalled();
    const uploaded = (hub.uploadVfsFile as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(uploaded).toContain("stale.txt");
  });

  it("loads a tutorial snippet without preset stdin, so the student types the input", async () => {
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
    // The full playground never queues preset stdin: a program that reads
    // input waits at the read, the console tab opens, and the student
    // types the values themselves. Assembling must not send the preset input.
    act(() => ref.current!.assemble());
    await waitFor(() => expect(hub.assemble).toHaveBeenCalled());
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });
});

describe("keeping earlier work (full chrome)", () => {
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

  it("keeps the autosaved code in recents when the page opens with other code", () => {
    window.localStorage.setItem(KEY_CURRENT, "// prior work\nret");
    // The loading gate keeps the heavy full layout out of the test; the
    // effect that keeps earlier work runs on mount regardless.
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(<EmbeddablePlayground chrome="full" startSource="// shared program" />);
    expect(recentBodies()).toContain("// prior work\nret");
  });

  it("leaves recents alone when the starting code is the autosave itself", () => {
    window.localStorage.setItem(KEY_CURRENT, "// prior work\nret");
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(
      <EmbeddablePlayground chrome="full" startSource={"// prior work\nret"} />,
    );
    expect(window.localStorage.getItem(KEY_RECENT)).toBeNull();
  });

  it("keeps the replaced code in recents when a program loads over it", () => {
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

  it("runProgram reports stdout and exit code from after the run, not before it", async () => {
    // As in the real useEmulator, a new isRunning shows only after the next
    // render, so a wait loop that checks before it sleeps would see the old
    // false and report the output from before the run.
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

  it("assembles then steps on a timer, surviving the re-render after each step", async () => {
    const assemble = vi.fn().mockResolvedValue(true);
    const step = vi.fn();
    // Like the real useEmulator, hand back a new object every render. A stable
    // one would hide the freeze this guards: an autoplay effect keyed on `emu`
    // clears its timer on the first re-render, and the walk stops after 0-1 steps.
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
