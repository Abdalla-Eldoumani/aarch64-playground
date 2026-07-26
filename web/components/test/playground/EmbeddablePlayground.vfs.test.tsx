// The persistent home-directory contract, at the component boundary: the
// full playground hydrates the persisted working set into the machine,
// stages every user write back into the store, merges a program's fixtures
// over (never instead of) the working set, and re-seeds files across
// assemble's machine reset. Embed chrome never touches the store. The
// persistence module is mocked; its own IDB behavior is pinned in
// lib/vfs-persist.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";

vi.mock("@/components/playground/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: () => <div data-testid="console" />,
}));
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
}));

// Capture the terminal context so the tests can drive writeVfs/deleteVfs --
// the staged write paths -- without an xterm.
const terminalProps = vi.hoisted(() => ({
  current: null as null | {
    buildContext: () => {
      writeVfs: (path: string, body: string) => void;
      deleteVfs: (path: string) => Promise<boolean>;
      assembleSource: (text: string) => Promise<{ success: boolean; errors: string[] }>;
      runSource: (
        text: string,
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

const persistMock = vi.hoisted(() => ({
  loadPersistedVfs: vi.fn(async (): Promise<Record<string, string> | null> => null),
  savePersistedVfs: vi.fn(async () => {}),
}));
vi.mock("@/lib/playground/vfs-persist", () => persistMock);

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
} from "@/components/playground/EmbeddablePlayground";

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
    programLoaded: false,
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
    dirtyAddrs: [] as Array<[number, number]>,
    replayFrames: [],
    assemble: vi.fn().mockResolvedValue(true),
    assembleForTool: vi
      .fn()
      .mockResolvedValue({ success: true, error: null, errorLine: null }),
    step: vi.fn(),
    stepBack: vi.fn(),
    run: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    toggleBreakpoint: vi.fn(),
    clearAllBreakpoints: vi.fn(),
    remapBreakpoints: vi.fn(),
    lint: vi.fn(async () => []),
    getMemory: vi.fn(() => new Uint8Array()),
    pushStdin: vi.fn(),
    uploadVfsFile: vi.fn(),
    readVfsFile: vi.fn(),
    deleteVfsFile: vi.fn().mockResolvedValue(true),
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

type Hub = ReturnType<typeof makeHub>;

function engage(container: HTMLElement) {
  act(() => {
    fireEvent.mouseDown(container.firstChild as Element);
  });
}

const decode = (data: Uint8Array | string) =>
  typeof data === "string" ? data : new TextDecoder().decode(data);

/** Names and bodies delivered to the machine, in call order. */
function uploads(hub: Hub): Array<[string, string]> {
  return (hub.uploadVfsFile as ReturnType<typeof vi.fn>).mock.calls.map(
    (call) => [call[0] as string, decode(call[1] as Uint8Array)],
  );
}

function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: px,
    configurable: true,
    writable: true,
  });
  window.dispatchEvent(new Event("resize"));
}

async function openTerminal(): Promise<NonNullable<typeof terminalProps.current>> {
  fireEvent.click(await screen.findByRole("tab", { name: "term" }));
  await waitFor(() => expect(terminalProps.current).not.toBeNull());
  return terminalProps.current!;
}

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  persistMock.loadPersistedVfs.mockImplementation(async () => null);
  terminalProps.current = null;
  setWidth(1024);
});

describe("the persistent working set (full chrome)", () => {
  it("hydrates persisted files into the machine and re-seeds them across assemble", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "notes.txt": "keep me\n",
    }));
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource="mov x0, 1" />,
    );
    engage(container);
    await waitFor(() =>
      expect(uploads(hub)).toContainEqual(["notes.txt", "keep me\n"]),
    );
    // Assemble resets the machine; the working set must come back.
    hub.uploadVfsFile.mockClear();
    await act(async () => {
      ref.current!.assemble();
    });
    await waitFor(() =>
      expect(uploads(hub)).toContainEqual(["notes.txt", "keep me\n"]),
    );
  });

  it("stages a terminal write into the store and the machine", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    setWidth(800);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource="mov x0, 1" />,
    );
    engage(container);
    const terminal = await openTerminal();
    act(() => {
      terminal.buildContext().writeVfs("lab5.s", "mov x0, 0\n");
    });
    expect(uploads(hub)).toContainEqual(["lab5.s", "mov x0, 0\n"]);
    await waitFor(() =>
      expect(persistMock.savePersistedVfs).toHaveBeenCalledWith({
        "lab5.s": "mov x0, 0\n",
      }),
    );
  });

  it("removes a deleted file from the persisted set", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "a.txt": "1",
      "b.txt": "2",
    }));
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    setWidth(800);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource="mov x0, 1" />,
    );
    engage(container);
    await waitFor(() => expect(uploads(hub).length).toBeGreaterThanOrEqual(2));
    const terminal = await openTerminal();
    await act(async () => {
      await terminal.buildContext().deleteVfs("a.txt");
    });
    expect(hub.deleteVfsFile).toHaveBeenCalledWith("a.txt");
    await waitFor(() =>
      expect(persistMock.savePersistedVfs).toHaveBeenCalledWith({ "b.txt": "2" }),
    );
  });

  it("merges a program's fixtures over the working set instead of replacing it", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "mine.txt": "student file",
    }));
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource="// old" />,
    );
    engage(container);
    await waitFor(() =>
      expect(uploads(hub)).toContainEqual(["mine.txt", "student file"]),
    );
    act(() => {
      ref.current!.loadProgram({
        source: "mov x0, 2",
        vfs: { "numbers.txt": "1 2 3\n" },
      });
    });
    const delivered = uploads(hub);
    expect(delivered).toContainEqual(["numbers.txt", "1 2 3\n"]);
    expect(delivered).toContainEqual(["mine.txt", "student file"]);
    await waitFor(() =>
      expect(persistMock.savePersistedVfs).toHaveBeenCalledWith({
        "mine.txt": "student file",
        "numbers.txt": "1 2 3\n",
      }),
    );
  });
});

describe("the terminal toolchain and the working set", () => {
  it("gcc reseeds the home directory after its machine wipe", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "notes.txt": "keep me\n",
    }));
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    setWidth(800);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource="mov x0, 1" />,
    );
    engage(container);
    await waitFor(() =>
      expect(uploads(hub)).toContainEqual(["notes.txt", "keep me\n"]),
    );
    const terminal = await openTerminal();
    hub.uploadVfsFile.mockClear();
    await act(async () => {
      await terminal.buildContext().assembleSource("mov x0, 0\nsvc 0\n");
    });
    // The tool-channel assemble ran (not the marker-painting one), and
    // the student's files came back after the wipe.
    expect(hub.assembleForTool).toHaveBeenCalled();
    expect(hub.assemble).not.toHaveBeenCalled();
    expect(uploads(hub)).toContainEqual(["notes.txt", "keep me\n"]);
  });

  it("a failing gcc reports the precise line and message from the verdict", async () => {
    const hub: Hub = makeHub({
      assembleForTool: vi.fn().mockResolvedValue({
        success: false,
        error: "unknown mnemonic: MOVQ",
        errorLine: 3,
      }),
    });
    useEmulatorMock.mockReturnValue(hub);
    setWidth(800);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource="mov x0, 1" />,
    );
    engage(container);
    const terminal = await openTerminal();
    let verdict: { success: boolean; errors: string[] } | null = null;
    await act(async () => {
      verdict = await terminal.buildContext().assembleSource("movq x0, 1\n");
    });
    expect(verdict).toEqual({
      success: false,
      errors: ["line 3: unknown mnemonic: MOVQ"],
    });
    expect(hub.assemble).not.toHaveBeenCalled();
  });

  it("a terminal program run reseeds the home directory before running", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "input.txt": "1 2 3\n",
    }));
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    setWidth(800);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource="mov x0, 1" />,
    );
    engage(container);
    await waitFor(() =>
      expect(uploads(hub)).toContainEqual(["input.txt", "1 2 3\n"]),
    );
    const terminal = await openTerminal();
    hub.uploadVfsFile.mockClear();
    await act(async () => {
      await terminal.buildContext().runSource("mov x0, 0\nsvc 0\n", ["prog"]);
    });
    expect(hub.assembleForTool).toHaveBeenCalled();
    expect(uploads(hub)).toContainEqual(["input.txt", "1 2 3\n"]);
    expect(hub.run).toHaveBeenCalled();
  });
});

describe("the working set stays out of reduced chromes", () => {
  it("never reads or writes the store from embed chrome", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="embed" startSource="mov x0, 1" />,
    );
    engage(container);
    // A lesson figure's program delivery, fixtures included: the machine
    // gets the file, the store stays untouched.
    act(() => {
      ref.current!.loadProgram({
        source: "mov x0, 2",
        vfs: { "fixture.txt": "authored" },
      });
    });
    expect(uploads(hub)).toContainEqual(["fixture.txt", "authored"]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(persistMock.loadPersistedVfs).not.toHaveBeenCalled();
    expect(persistMock.savePersistedVfs).not.toHaveBeenCalled();
  });
});
