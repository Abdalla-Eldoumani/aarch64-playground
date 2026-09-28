// The full playground keeps the student's files between visits, and every
// assemble wipes the machine, so the saved files must be loaded back each
// time. The storage module is mocked; lib/test/playground/vfs-persist.test.ts
// covers it.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import type { ReactNode } from "react";

vi.mock("@/components/playground/lazy-editor", () => ({
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

// Capture the terminal context so the tests can call writeVfs and deleteVfs,
// the terminal's file writes, without an xterm.
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
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";

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

// The full chrome's surface arrives through a dynamic import. Transforming
// it the first time took about half a second, which the first test's
// one-second waitFor had to absorb and, on a loaded machine, did not.
beforeAll(async () => {
  await import("@/components/playground/FullChromeSurface");
});

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

describe("the student's saved files (full chrome)", () => {
  it("loads saved files into the machine and loads them again after an assemble", async () => {
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
    // Assemble resets the machine; the saved files must come back.
    vi.mocked(hub.uploadVfsFile).mockClear();
    await act(async () => {
      ref.current!.assemble();
    });
    await waitFor(() =>
      expect(uploads(hub)).toContainEqual(["notes.txt", "keep me\n"]),
    );
  });

  it("saves a file written from the terminal to storage and the machine", async () => {
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

  it("removes a deleted file from the saved files", async () => {
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

  it("adds a program's own files to the saved files instead of replacing them", async () => {
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

describe("the terminal's gcc and run commands and the saved files", () => {
  it("gcc loads the home directory back after it wipes the machine", async () => {
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
    vi.mocked(hub.uploadVfsFile).mockClear();
    await act(async () => {
      await terminal.buildContext().assembleSource("mov x0, 0\nsvc 0\n");
    });
    // The terminal's assemble ran (not the editor's, which moves the line
    // marker), and the student's files came back after the wipe.
    expect(hub.assembleForTool).toHaveBeenCalled();
    expect(hub.assemble).not.toHaveBeenCalled();
    expect(uploads(hub)).toContainEqual(["notes.txt", "keep me\n"]);
  });

  it("a failing gcc reports the exact line and message from the assembler", async () => {
    const hub: Hub = makeHub({
      assembleForTool: vi.fn().mockResolvedValue({
        success: false,
        error: "unknown mnemonic `MOVQ`: check the spelling, or look it up in the instruction reference to see whether the playground implements it",
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
      errors: ["line 3: unknown mnemonic `MOVQ`: check the spelling, or look it up in the instruction reference to see whether the playground implements it"],
    });
    expect(hub.assemble).not.toHaveBeenCalled();
  });

  it("a terminal run loads the home directory back before running", async () => {
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
    vi.mocked(hub.uploadVfsFile).mockClear();
    await act(async () => {
      await terminal.buildContext().runSource("mov x0, 0\nsvc 0\n", ["prog"]);
    });
    expect(hub.assembleForTool).toHaveBeenCalled();
    expect(uploads(hub)).toContainEqual(["input.txt", "1 2 3\n"]);
    expect(hub.run).toHaveBeenCalled();
  });
});

describe("embed frames leave the saved files alone", () => {
  it("never reads or writes storage from embed chrome", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="embed" startSource="mov x0, 1" />,
    );
    engage(container);
    // A lesson loads a program with its own file: the machine gets the file,
    // storage stays untouched.
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
