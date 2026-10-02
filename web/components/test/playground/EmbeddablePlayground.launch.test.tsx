// Running in the console or the terminal: which examples offer the choice,
// what run does in each mode, and that a program with no choice runs in the
// console as it always has.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import type { ReactNode } from "react";

// The editor's change handler, so a case can type into the buffer.
const editorProps = vi.hoisted(() => ({
  current: null as null | { onChange: (next: string) => void },
}));
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: (props: { onChange: (next: string) => void }) => {
    editorProps.current = props;
    return <div data-testid="editor" />;
  },
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
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

// The props say whether the terminal owns the console and from which byte of
// output; reading them is simpler than rendering the whole panel.
const consoleProps = vi.hoisted(() => ({
  current: null as null | {
    ownedByTerminal: boolean;
    terminalOwnedFrom: number | null;
    stdout: string;
  },
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: (props: NonNullable<typeof consoleProps.current>) => {
    consoleProps.current = props;
    return <div data-testid="console" />;
  },
}));

const terminalProps = vi.hoisted(() => ({
  current: null as null | {
    buildContext: () => {
      runProgram: (
        args: string[],
        stdin?: string,
        io?: unknown,
      ) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
    };
    onRegisterIO: (io: unknown) => void;
  },
}));
vi.mock("@/components/panels/TerminalPane", () => ({
  TerminalPane: (props: NonNullable<typeof terminalProps.current>) => {
    terminalProps.current = props;
    return <div data-testid="terminal-pane" />;
  },
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/lib/playground/vfs-persist", () => ({
  loadPersistedVfs: vi.fn(async () => null),
  savePersistedVfs: vi.fn(async () => {}),
}));

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
} from "@/components/playground/EmbeddablePlayground";
import { makeHub as baseHub } from "@/components/test/playground/helpers/emulator-hub";
import type { EmulatorState } from "@/lib/emulator/use-emulator";

// The key is older than the words it now stores; keeping it lets a returning
// student's browser still load the "1" or "0" it saved before.
const LAUNCH_KEY = "aarch64-playground:terminal-program";

const SOURCE = "        mov x0, 1\n";

/** Every test here starts from a program that already assembled. */
function makeHub(overrides: Partial<EmulatorState> = {}): EmulatorState {
  return baseHub({ programLoaded: true, ...overrides });
}

type Hub = EmulatorState;

function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: px,
    configurable: true,
    writable: true,
  });
  window.dispatchEvent(new Event("resize"));
}

function engage(container: HTMLElement) {
  act(() => {
    fireEvent.mouseDown(container.firstChild as Element);
  });
}

function view(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
  return <EmbeddablePlayground ref={ref} chrome="full" startSource={SOURCE} />;
}

function mount(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
  const rendered = render(view(ref));
  engage(rendered.container);
  return rendered;
}

function runModeGroup(): HTMLElement | null {
  return screen.queryByRole("group", { name: "run in" });
}

// The tab band renders only the active panel, so the console's ownership
// props exist only once the console tab is the selected one. The tab's name
// gains ", new output" when output lands behind another tab.
function showConsole(): void {
  fireEvent.click(screen.getByRole("tab", { name: /^console\b/ }));
}

function makeIO() {
  return {
    write: vi.fn(),
    setForeground: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(),
    sessionEnded: vi.fn(),
  };
}

// The real pane registers its io from an effect once xterm is allocated;
// the mock hands it over on demand so a session can be driven.
async function registerPaneIO(io: ReturnType<typeof makeIO>): Promise<void> {
  fireEvent.click(screen.getByRole("tab", { name: "term" }));
  await waitFor(() => expect(terminalProps.current).not.toBeNull());
  act(() => {
    terminalProps.current!.onRegisterIO(io);
  });
}

function argsBox(): HTMLInputElement {
  return screen.getByLabelText("command-line arguments") as HTMLInputElement;
}

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
  // The tablet band renders the header, the tab strip, and the right tabs
  // directly; the lg layout is a mocked ResizableLayout that renders nothing.
  setWidth(800);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  consoleProps.current = null;
  terminalProps.current = null;
});

// The full-chrome surface is reached through dynamic(), so it mounts a beat
// after the shell does. Awaiting the same import settles it before a case
// reads the surface's own markup.
async function fullChromeMounted() {
  await act(async () => {
    await import("@/components/playground/FullChromeSurface");
  });
}

describe("the run-mode control's presence", () => {
  it("appears for an interactive example, at that example's default", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    await fullChromeMounted();
    expect(runModeGroup()).toBeNull();

    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect(runModeGroup()).not.toBeNull();
    // snake starts in the console and moves to the terminal by itself once it
    // turns raw mode on; this control plays no part in that.
    expect(
      screen.getByLabelText("run in the console").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows terminal preselected for a default-terminal example", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    await fullChromeMounted();
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "data structures visualizer",
      });
    });
    expect(
      screen.getByLabelText("run in the terminal").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("never appears for a non-interactive example", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "echo", label: "echo (read)" });
    });
    expect(runModeGroup()).toBeNull();
  });

  it("disappears when a text-only swap replaces the interactive program", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    await fullChromeMounted();
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect(runModeGroup()).not.toBeNull();
    act(() => {
      ref.current!.loadSource("        mov x1, 2\n", "recent");
    });
    expect(runModeGroup()).toBeNull();
  });

  it("is disabled while a program is running in the terminal pane", async () => {
    const hub: Hub = makeHub({ blocked: true });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { rerender } = mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    fireEvent.click(await screen.findByRole("tab", { name: "term" }));
    await waitFor(() => expect(terminalProps.current).not.toBeNull());

    const io = {
      write: vi.fn(),
      setForeground: vi.fn(),
      clear: vi.fn(),
      focus: vi.fn(),
      sessionEnded: vi.fn(),
    };
    let session: Promise<unknown> | null = null;
    act(() => {
      session = terminalProps.current!.buildContext().runProgram(["./prog"], undefined, io);
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("run in the terminal") as HTMLButtonElement).disabled,
      ).toBe(true),
    );

    // Halt the machine and re-render so the terminal session sees it and
    // ends; the session must not outlive the test.
    useEmulatorMock.mockReturnValue(makeHub({ isHalted: true, blocked: false }));
    rerender(<EmbeddablePlayground ref={ref} chrome="full" startSource={SOURCE} />);
    await act(async () => {
      await session;
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("run in the terminal") as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });
});

describe("the mode the control chooses", () => {
  it("set to terminal, run opens the terminal tab instead of running here", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    fireEvent.click(screen.getByLabelText("run in the terminal"));

    fireEvent.click(screen.getByRole("button", { name: "run" }));
    expect(hub.run).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("hands the console its stdin box back when the mode goes to console", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    showConsole();
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "dsav",
      });
    });
    expect(consoleProps.current!.ownedByTerminal).toBe(true);
    fireEvent.click(screen.getByLabelText("run in the console"));
    expect(consoleProps.current!.ownedByTerminal).toBe(false);
  });

  it("saves the chosen mode under the existing key, as a word", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect(window.localStorage.getItem(LAUNCH_KEY)).toBe("console");
    fireEvent.click(screen.getByLabelText("run in the terminal"));
    expect(window.localStorage.getItem(LAUNCH_KEY)).toBe("terminal");
  });

  it("reads the old boolean value a returning student's browser holds", () => {
    // "1" meant terminal before the key held a mode name; a reloaded dsav
    // workspace must still run in the terminal first.
    window.localStorage.setItem(LAUNCH_KEY, "1");
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    showConsole();
    expect(consoleProps.current!.ownedByTerminal).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    expect(hub.run).not.toHaveBeenCalled();
  });

  it("reads the old false value as console", () => {
    window.localStorage.setItem(LAUNCH_KEY, "0");
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    mount(createRef<EmbeddablePlaygroundHandle>());
    showConsole();
    expect(consoleProps.current!.ownedByTerminal).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    expect(hub.run).toHaveBeenCalledTimes(1);
  });
});

describe("launchInteractive: assemble, then run in the terminal, in one action", () => {
  function launchAction(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
    return ref.current!.getCommands().find((a) => a.id === "launch-terminal")!;
  }

  it("assembles first, then opens the terminal tab", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "dsav",
      });
    });

    const action = launchAction(ref);
    expect(action.description).toBe("assemble and run with the terminal pane");
    await act(async () => {
      action.run();
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
  });

  it("stops at a failed assemble: no terminal run, no tab switch", async () => {
    const hub: Hub = makeHub({ assemble: vi.fn().mockResolvedValue(false) });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "dsav",
      });
    });

    await act(async () => {
      launchAction(ref).run();
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    // The error renders in Controls' box; the pane is left exactly as it was.
    expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(hub.run).not.toHaveBeenCalled();
  });

  it("is always present, and says why it would do nothing in console mode", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });

    const action = launchAction(ref);
    expect(action.description).toBe("(this program runs in the console)");
    await act(async () => {
      action.run();
    });
    expect(hub.assemble).not.toHaveBeenCalled();
  });

  it("says where the run command sends the program", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect(ref.current!.getCommands().find((a) => a.id === "run")!.description).toBe(
      "run until halt or breakpoint",
    );

    fireEvent.click(screen.getByLabelText("run in the terminal"));
    const runAction = ref.current!.getCommands().find((a) => a.id === "run")!;
    expect(runAction.description).toBe("run this program in the terminal tab");
    // An assembled program goes straight to the terminal, with no second assemble.
    act(() => runAction.run());
    expect(hub.assemble).not.toHaveBeenCalled();
  });
});

describe("run straight after a program loads", () => {
  // F5, the command palette and the handle all call one run.
  function pressRun(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
    act(() => ref.current!.run());
  }

  function loadDsav(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "dsav",
      });
    });
  }

  it("assembles and opens the terminal tab in terminal mode with nothing assembled", async () => {
    const hub: Hub = makeHub({ programLoaded: false });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);

    await act(async () => {
      pressRun(ref);
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
    // The terminal session calls run() itself once the pane is ready; the
    // press never calls it directly in this mode.
    expect(hub.run).not.toHaveBeenCalled();
  });

  it("says so in the palette instead of sending the student to assemble", () => {
    const hub: Hub = makeHub({ programLoaded: false });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);
    expect(ref.current!.getCommands().find((a) => a.id === "run")!.description).toBe(
      "assemble, then run it in the terminal tab",
    );
  });

  it("sends an assembled terminal program to the terminal without assembling again", () => {
    const hub: Hub = makeHub({ programLoaded: true });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);

    pressRun(ref);
    expect(hub.assemble).not.toHaveBeenCalled();
    expect(hub.run).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("assembles, then runs in the console, with nothing assembled", async () => {
    const hub: Hub = makeHub({ programLoaded: false });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });

    await act(async () => {
      pressRun(ref);
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    expect(hub.run).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("leaves the terminal tab alone when the first assemble fails", async () => {
    const hub: Hub = makeHub({
      programLoaded: false,
      assemble: vi.fn().mockResolvedValue(false),
    });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);

    await act(async () => {
      pressRun(ref);
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(hub.run).not.toHaveBeenCalled();
  });

  it("keeps the run button clickable in terminal mode with nothing assembled", async () => {
    // A click must launch in one action, as the keyboard does; a disabled
    // button would make a mouse user assemble, then run.
    const hub: Hub = makeHub({ programLoaded: false });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);

    const run = screen.getByRole("button", { name: "run" }) as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(run);
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
  });

  it("keeps the run button clickable in console mode with nothing assembled", async () => {
    const hub: Hub = makeHub({ programLoaded: false });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    const run = screen.getByRole("button", { name: "run" }) as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(run);
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    expect(hub.run).toHaveBeenCalledTimes(1);
  });

  it("keeps the button disabled while the first assemble is still running", () => {
    const hub: Hub = makeHub({ programLoaded: false, isAssembling: true });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);
    expect((screen.getByRole("button", { name: "run" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps the button disabled while the program waits for input, in either mode", () => {
    const hub: Hub = makeHub({ programLoaded: false, blocked: true });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);
    expect((screen.getByRole("button", { name: "run" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect((screen.getByRole("button", { name: "run" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("shows a failed first assemble the way assemble always does", () => {
    // The failure comes through emu.assemblyErrors and emu.error, which
    // Controls shows in its own error box; the launch adds no second place.
    const hub: Hub = makeHub({
      programLoaded: false,
      error: "line 3: unknown mnemonic 'movv'",
      assemblyErrors: [{ line: 3, message: "unknown mnemonic 'movv'" }],
    });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("unknown mnemonic");
  });
});

describe("run after an edit or a finish", () => {
  // Run starts the program on screen from the top when the code, files or
  // args changed since the last assemble, or the program finished, as a
  // lesson's run does; assemble alone loads without running.
  const EDITED = "        mov x0, 9\n";

  async function assembled(hub: Hub) {
    useEmulatorMock.mockReturnValue(hub);
    mount(createRef<EmbeddablePlaygroundHandle>());
    await fullChromeMounted();
    // The run row's assemble (the first-run card has one of its own).
    const assemble = screen
      .getAllByRole("button", { name: "assemble" })
      .find((b) => b.getAttribute("aria-keyshortcuts") === "F6")!;
    await act(async () => {
      fireEvent.click(assemble);
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    // Assemble alone loads without running.
    expect(hub.run).not.toHaveBeenCalled();
  }

  async function clickRun() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "run" }));
    });
  }

  it("assembles the edited code first, then runs it", async () => {
    const hub = makeHub();
    await assembled(hub);
    act(() => editorProps.current!.onChange(EDITED));
    await clickRun();
    expect(hub.assemble).toHaveBeenCalledTimes(2);
    expect(vi.mocked(hub.assemble).mock.calls[1][0]).toBe(EDITED);
    expect(hub.run).toHaveBeenCalledTimes(1);
  });

  it("assembles first when only the arguments changed", async () => {
    const hub = makeHub();
    await assembled(hub);
    fireEvent.change(argsBox(), { target: { value: "5 7" } });
    await clickRun();
    expect(hub.assemble).toHaveBeenCalledTimes(2);
    expect(vi.mocked(hub.assemble).mock.calls[1][1]).toEqual(["5", "7"]);
    expect(hub.run).toHaveBeenCalledTimes(1);
  });

  it("carries on an unchanged program without assembling again", async () => {
    const hub = makeHub();
    await assembled(hub);
    await clickRun();
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    expect(hub.run).toHaveBeenCalledTimes(1);
  });

  it("runs a finished program again from the top", async () => {
    const hub = makeHub({ isHalted: true });
    await assembled(hub);
    const run = screen.getByRole("button", { name: "run" }) as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    await clickRun();
    expect(hub.assemble).toHaveBeenCalledTimes(2);
    expect(hub.run).toHaveBeenCalledTimes(1);
  });

  it("launches a finished terminal program again in the terminal", async () => {
    const hub = makeHub({ isHalted: true });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    await fullChromeMounted();
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "dsav", launch: "terminal", label: "dsav" });
    });
    await clickRun();
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
  });
});

describe("regression: a program with no explicit choice", () => {
  it("runs a plain example in the console, with no run-mode control", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    showConsole();
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "basics", label: "arithmetic" });
    });
    expect(runModeGroup()).toBeNull();
    expect(consoleProps.current!.ownedByTerminal).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    expect(hub.run).toHaveBeenCalledTimes(1);
    expect(hub.assemble).not.toHaveBeenCalled();
  });

  it("sends a default-terminal example to the terminal with no control touched", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "dsav",
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    expect(hub.run).not.toHaveBeenCalled();
    expect(hub.assemble).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("runs the student's own code in the console, with no run-mode control", () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    mount(createRef<EmbeddablePlaygroundHandle>());
    showConsole();
    expect(runModeGroup()).toBeNull();
    expect(consoleProps.current!.ownedByTerminal).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    expect(hub.run).toHaveBeenCalledTimes(1);
  });
});

describe("terminalOwnedFrom: where the terminal took the console's output over", () => {
  // A running terminal session checks the machine every 32ms; hand it a
  // halted machine and wait one check so the session ends inside the test
  // that started it.
  async function endSession(
    ref: React.RefObject<EmbeddablePlaygroundHandle | null>,
    rerender: (ui: React.ReactElement) => void,
  ): Promise<void> {
    useEmulatorMock.mockReturnValue(makeHub({ isHalted: true }));
    rerender(view(ref));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
  }

  // Screens a raw-mode program draws after it turns raw mode on and before
  // the terminal session starts.
  const FRAMES = "[2J[H frame one[2J[H frame two";

  it("hides every frame a raw-mode program draws before the terminal session starts", async () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { rerender } = mount(ref);
    showConsole();

    // The program turns raw mode on. Nothing has printed and no pane exists yet.
    useEmulatorMock.mockReturnValue(makeHub({ wantsTerminal: true }));
    await act(async () => {
      rerender(view(ref));
    });
    showConsole();
    expect(consoleProps.current!.terminalOwnedFrom).toBe(0);

    // Frames land while the pane is still mounting.
    useEmulatorMock.mockReturnValue(makeHub({ wantsTerminal: true, stdout: FRAMES }));
    await act(async () => {
      rerender(view(ref));
    });
    showConsole();
    expect(consoleProps.current!.terminalOwnedFrom).toBe(0);

    // The pane is ready and the session starts: the earlier value stands, so
    // none of those bytes show in the console. ConsolePanel's own tests cover
    // what it renders.
    await registerPaneIO(makeIO());
    showConsole();
    await waitFor(() => expect(consoleProps.current!.terminalOwnedFrom).toBe(0));
    expect(consoleProps.current!.stdout).toBe(FRAMES);

    await endSession(ref, rerender);
  });

  it("keeps a line printed before raw mode, and hides the rest", async () => {
    const printed = "menu ready\n";
    useEmulatorMock.mockReturnValue(makeHub({ stdout: printed }));
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { rerender } = mount(ref);
    showConsole();

    // The program prints its menu in normal (cooked) mode, then turns raw mode on.
    useEmulatorMock.mockReturnValue(makeHub({ stdout: printed, wantsTerminal: true }));
    await act(async () => {
      rerender(view(ref));
    });
    showConsole();
    expect(consoleProps.current!.terminalOwnedFrom).toBe(11);

    // Frames arrive over the next renders and the session starts after them;
    // terminalOwnedFrom stays where the menu ended.
    useEmulatorMock.mockReturnValue(
      makeHub({ stdout: printed + FRAMES, wantsTerminal: true }),
    );
    await act(async () => {
      rerender(view(ref));
    });
    await registerPaneIO(makeIO());
    showConsole();
    await waitFor(() => expect(consoleProps.current!.terminalOwnedFrom).toBe(11));

    await endSession(ref, rerender);
  });

  it("is 0 when the run started in the terminal", async () => {
    const soup = "[2J[H drawn frame";
    useEmulatorMock.mockReturnValue(makeHub());
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { rerender } = mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "dsav",
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    await registerPaneIO(makeIO());

    showConsole();
    await waitFor(() => expect(consoleProps.current!.terminalOwnedFrom).toBe(0));

    // The bytes still reach this panel; hiding them is the panel's job, and
    // terminalOwnedFrom is what tells it there is nothing here to show.
    useEmulatorMock.mockReturnValue(makeHub({ stdout: soup }));
    rerender(view(ref));
    expect(consoleProps.current!.stdout).toBe(soup);
    expect(consoleProps.current!.terminalOwnedFrom).toBe(0);

    await endSession(ref, rerender);
  });

  it("stays unset for a plain console run", () => {
    const hub: Hub = makeHub({ stdout: "sum = 10\n" });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "basics", label: "arithmetic" });
    });
    showConsole();
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    expect(hub.run).toHaveBeenCalledTimes(1);
    expect(consoleProps.current!.terminalOwnedFrom).toBeNull();
  });

  it("clears on reset, so the next console run shows all its output", async () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { rerender } = mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "dsav",
        launch: "terminal",
        label: "dsav",
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    await registerPaneIO(makeIO());
    showConsole();
    await waitFor(() => expect(consoleProps.current!.terminalOwnedFrom).toBe(0));

    await endSession(ref, rerender);
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(consoleProps.current!.terminalOwnedFrom).toBeNull();
  });
});

describe("the arguments box for an example that takes the run mode as an argument", () => {
  function loadCalc(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "calc", label: "calculator" });
    });
  }

  it("starts the box at 'console' when loaded in console mode", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);
    expect(argsBox().value).toBe("console");
  });

  it("rewrites the old './calc console' form to just 'console'", () => {
    // The emulator supplies argv[0] itself, so a saved box holding
    // `./calc console` would give calc an extra argument. It is rewritten in
    // place; anything else the student typed stays theirs.
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);
    fireEvent.change(argsBox(), { target: { value: "./calc console" } });
    expect(argsBox().value).toBe("console");
  });

  it("starts the box empty when loaded in terminal mode", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "two-sum",
        launch: "terminal",
        label: "two sum",
      });
    });
    expect(argsBox().value).toBe("");
  });

  it("puts the mode word in place of the example's own saved arguments", () => {
    // temp-convert has its own .args file and also takes the mode word; the
    // mode decides the box, so the word wins at load.
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "temp-convert",
        args: "32 F",
        label: "temperature",
      });
    });
    expect(argsBox().value).toBe("console");
  });

  it("follows the run-mode control both ways while the student has not typed in the box", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);
    fireEvent.click(screen.getByLabelText("run in the terminal"));
    expect(argsBox().value).toBe("");
    fireEvent.click(screen.getByLabelText("run in the console"));
    expect(argsBox().value).toBe("console");
  });

  it("leaves a box the student typed in alone, in either direction", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);
    fireEvent.change(argsBox(), { target: { value: "./calc scientific" } });

    fireEvent.click(screen.getByLabelText("run in the terminal"));
    expect(argsBox().value).toBe("./calc scientific");
    fireEvent.click(screen.getByLabelText("run in the console"));
    expect(argsBox().value).toBe("./calc scientific");
  });

  it("still follows the mode when the box holds the example's own arguments", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "temp-convert",
        args: "32 F",
        label: "temperature",
      });
    });
    // The example's own arguments are a value the app fills in, so the box
    // still counts as untouched.
    fireEvent.change(argsBox(), { target: { value: "32 F" } });
    fireEvent.click(screen.getByLabelText("run in the terminal"));
    expect(argsBox().value).toBe("");
  });

  it("leaves an example with no run-mode choice on its own arguments", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({
        source: SOURCE,
        stem: "command-line-args",
        args: "hello world",
        label: "argv",
      });
    });
    expect(argsBox().value).toBe("hello world");
    expect(runModeGroup()).toBeNull();
  });

  it("assembles with whatever the box holds", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);

    // The button, the shortcut, and the command palette all call the handle's
    // assemble, the only path the arguments take to the emulator.
    await act(async () => {
      ref.current!.assemble();
    });
    // The third argument is the workspace the notes name lines by.
    const workspace = { main: SOURCE, extras: [] };
    expect(hub.assemble).toHaveBeenCalledWith(SOURCE, ["console"], workspace);

    fireEvent.change(argsBox(), { target: { value: "./calc scientific" } });
    await act(async () => {
      ref.current!.assemble();
    });
    expect(hub.assemble).toHaveBeenLastCalledWith(SOURCE, ["./calc", "scientific"], workspace);
  });
});
