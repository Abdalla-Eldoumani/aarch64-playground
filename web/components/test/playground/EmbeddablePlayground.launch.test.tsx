// The launch choice at the component boundary: the run-mode control appears
// for exactly the interactive examples, run stays literal run in both modes,
// the composite launch assembles first and stops at a failed assemble, and
// a program with no explicit choice runs in the console, with no run-mode
// control.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";

vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
}));

// The console's ownership badge is one of the five suppression points, and
// the watermark says where a terminal session took its output over; the
// props carry both, so capture them rather than rendering the whole panel.
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

// The key predates the mode having two spellings; the widened decode has to
// keep reading what a returning student's browser already wrote.
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
// props exist only once the console tab is the selected one.
function showConsole(): void {
  fireEvent.click(screen.getByRole("tab", { name: "console" }));
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

describe("the run-mode control's presence", () => {
  it("appears for an interactive example, at that example's default", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    expect(runModeGroup()).toBeNull();

    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect(runModeGroup()).not.toBeNull();
    // snake starts in the console; its raw-mode
    // edge takes the pane mid-run, which is not this control's business.
    expect(
      screen.getByLabelText("run in the console").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows terminal preselected for a default-terminal example", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
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

  it("disappears when a text-only swap replaces the interactive program", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect(runModeGroup()).not.toBeNull();
    act(() => {
      ref.current!.loadSource("        mov x1, 2\n", "recent");
    });
    expect(runModeGroup()).toBeNull();
  });

  it("goes inert while a foreground session owns the pane", async () => {
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

    // Halt the machine and re-render so the drive's poll reads it through
    // emuRef and stands down; the session must not outlive the test.
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
  it("arms the terminal takeover: run hands the pane over instead of running", () => {
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

  it("persists the chosen mode under the existing key, in words", () => {
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
    // "1" was the takeover before the key held a mode name; a reloaded dsav
    // workspace must keep its terminal-first run.
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

describe("launchInteractive, the composite launch", () => {
  function launchAction(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
    return ref.current!.getCommands().find((a) => a.id === "launch-terminal")!;
  }

  it("assembles first, then hands the pane over", async () => {
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

  it("stops at a failed assemble: no takeover, no tab switch", async () => {
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

  it("names the surface the run action lands in", () => {
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
    // An assembled program hands over; it does not re-assemble.
    act(() => runAction.run());
    expect(hub.assemble).not.toHaveBeenCalled();
  });
});

describe("run from a cold load", () => {
  // The run button is disabled with nothing assembled, so a cold-load run
  // press arrives through F5, the palette, or the handle, all one funnel.
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

  it("assembles and takes over in terminal mode with nothing assembled", async () => {
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
    // The drive does the run() itself once the pane registers; the press
    // never calls the hub's run directly in this mode.
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

  it("hands an assembled terminal program over without re-assembling", () => {
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

  it("keeps the no-op in console mode with nothing assembled", async () => {
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
    // The press reaches the hub, which has nothing to run. No assemble, no
    // takeover.
    expect(hub.run).toHaveBeenCalledTimes(1);
    expect(hub.assemble).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "term" }).getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("leaves the pane alone when the cold-load assemble fails", async () => {
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
    // The mouse path has to reach the same one-action launch the keyboard
    // does; a disabled button here would mean assemble-then-run by pointer.
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

  it("leaves the run button disabled in console mode with nothing assembled", () => {
    const hub: Hub = makeHub({ programLoaded: false });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "snake", label: "snake" });
    });
    expect((screen.getByRole("button", { name: "run" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps the button disabled while the launch's own assemble is in flight", () => {
    const hub: Hub = makeHub({ programLoaded: false, isAssembling: true });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadDsav(ref);
    expect((screen.getByRole("button", { name: "run" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps the button disabled while blocked, in either mode", () => {
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

  it("surfaces a cold-load assemble failure the way assemble always does", () => {
    // The failure rides emu.assemblyErrors / emu.error, which Controls
    // renders in its own error box: the composite adds no second channel.
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

describe("regression: a program with no explicit choice", () => {
  it("runs a plain example exactly as it does today", () => {
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

  it("keeps the default-terminal example's takeover with no control touched", () => {
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

  it("leaves a hand-written buffer with no control and no ownership claim", () => {
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

describe("the console's watermark for a terminal-owned run", () => {
  // A live drive polls on a 32ms timer; hand it a halted machine and give it
  // one tick so the session tears down inside the test that started it.
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

  // The frames a raw-mode program paints while the tab switches, the pane
  // mounts, and its io registers, all of it after the tty went raw and
  // before any drive exists.
  const FRAMES = "[2J[H frame one[2J[H frame two";

  it("hides every frame a raw-mode program paints before the drive attaches", async () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { rerender } = mount(ref);
    showConsole();

    // The tty goes raw. Nothing has printed and no pane exists yet.
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

    // The pane registers and the drive attaches: the earlier pin stands, so
    // not one of those bytes is the console's to show. (The slicing itself
    // is ConsolePanel's; its own tests cover what renders.)
    await registerPaneIO(makeIO());
    showConsole();
    await waitFor(() => expect(consoleProps.current!.terminalOwnedFrom).toBe(0));
    expect(consoleProps.current!.stdout).toBe(FRAMES);

    await endSession(ref, rerender);
  });

  it("keeps a cooked line printed before the tty went raw, and hides the rest", async () => {
    const printed = "menu ready\n";
    useEmulatorMock.mockReturnValue(makeHub({ stdout: printed }));
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { rerender } = mount(ref);
    showConsole();

    // The program prints its menu in cooked mode, then flips to raw.
    useEmulatorMock.mockReturnValue(makeHub({ stdout: printed, wantsTerminal: true }));
    await act(async () => {
      rerender(view(ref));
    });
    showConsole();
    expect(consoleProps.current!.terminalOwnedFrom).toBe(11);

    // Frames paint over the following renders and the drive attaches after
    // them; the watermark stays where the cooked output ended.
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

  it("pins zero when the run started in the terminal", async () => {
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
    // the watermark is what tells it there is nothing here to show.
    useEmulatorMock.mockReturnValue(makeHub({ stdout: soup }));
    rerender(view(ref));
    expect(consoleProps.current!.stdout).toBe(soup);
    expect(consoleProps.current!.terminalOwnedFrom).toBe(0);

    await endSession(ref, rerender);
  });

  it("leaves a classic console run with no watermark at all", () => {
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

  it("drops the watermark on reset, so the next console run renders whole", async () => {
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

describe("the args box a mode-args example runs with", () => {
  function loadCalc(ref: React.RefObject<EmbeddablePlaygroundHandle | null>) {
    act(() => {
      ref.current!.loadProgram({ source: SOURCE, stem: "calc", label: "calculator" });
    });
  }

  it("seeds the console token at load in console mode", () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);
    expect(argsBox().value).toBe("console");
  });

  it("migrates the legacy program-name seed to the bare token", () => {
    // The emulator owns argv[0], so a persisted box holding `./calc console`
    // would hand calc an extra argument. It migrates in place; anything else
    // the student typed stays theirs.
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);
    fireEvent.change(argsBox(), { target: { value: "./calc console" } });
    expect(argsBox().value).toBe("console");
  });

  it("seeds an empty box at load in terminal mode", () => {
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

  it("overrides the fixture args a mode-args example also declares", () => {
    // temp-convert carries a .args fixture and also takes the console token; the
    // mode owns the box, so the token wins at load.
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

  it("follows the run-mode control both ways while the box stays clean", () => {
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

  it("still follows the mode from the payload's own seeded value", () => {
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
    // The fixture form is a value the app itself seeds, so the box still
    // counts as clean.
    fireEvent.change(argsBox(), { target: { value: "32 F" } });
    fireEvent.click(screen.getByLabelText("run in the terminal"));
    expect(argsBox().value).toBe("");
  });

  it("leaves an example outside the table on its own fixture args", () => {
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

  it("assembles with whatever the box holds, exactly as before", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    mount(ref);
    loadCalc(ref);

    // The button, the shortcut, and the palette all land on the handle's
    // assemble, which is the one funnel the args text reaches the hub by.
    await act(async () => {
      ref.current!.assemble();
    });
    expect(hub.assemble).toHaveBeenCalledWith(SOURCE, ["console"]);

    fireEvent.change(argsBox(), { target: { value: "./calc scientific" } });
    await act(async () => {
      ref.current!.assemble();
    });
    expect(hub.assemble).toHaveBeenLastCalledWith(SOURCE, ["./calc", "scientific"]);
  });
});
