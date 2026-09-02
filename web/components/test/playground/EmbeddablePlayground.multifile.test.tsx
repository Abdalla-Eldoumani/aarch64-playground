// The multi-file workspace contract at the component boundary: every
// combined-string line the MACHINE reports is numbered against the workspace
// that was assembled, the gutter's own lines are re-anchored when a buffer
// changes length, the decode strip sees the whole concatenation, tab names
// cannot collide with each other or with main.asm, and a foreground terminal
// session stands down when an assemble replaces the program under it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";

// Capture the editor's props: the per-file marker, gutter, and diagnostics
// all arrive through them, and Monaco itself has no place in jsdom.
const editorProps = vi.hoisted(() => ({
  current: null as null | {
    currentLine: number | null;
    breakpoints: Set<number>;
    onToggleBreakpoint: (line: number) => void;
    assemblyErrors: Array<{ line: number; message: string }>;
  },
}));
vi.mock("@/components/playground/Editor", () => ({
  Editor: (props: NonNullable<typeof editorProps.current>) => {
    editorProps.current = props;
    return <div data-testid="editor" />;
  },
}));

const decodeProps = vi.hoisted(() => ({
  current: null as null | { source: string; currentLine: number | null },
}));
vi.mock("@/components/panels/DecodeStrip", () => ({
  DecodeStrip: (props: NonNullable<typeof decodeProps.current>) => {
    decodeProps.current = props;
    return <div data-testid="decode-strip" />;
  },
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

const terminalProps = vi.hoisted(() => ({
  current: null as null | {
    buildContext: () => {
      runProgram: (
        args: string[],
        stdin?: string,
        io?: unknown,
      ) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
      runSource: (
        text: string,
        args: string[],
        stdin?: string,
      ) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
    };
  },
}));
vi.mock("@/components/panels/TerminalPane", () => ({
  TerminalPane: (props: NonNullable<typeof terminalProps.current>) => {
    terminalProps.current = props;
    return <div data-testid="terminal-pane" />;
  },
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    error: toastError,
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
import { MAX_STDIN_BYTES } from "@/lib/playground/upload-guard";

const FILES_KEY = "aarch64-playground:multi-files";

// main.asm is exactly ten lines and util.s exactly ten, so combined line 14
// is util.s line 3: 10 for main, one for the `// ---- util.s ----` boundary,
// then three into the helper.
const MAIN = Array.from({ length: 10 }, (_, i) => `        mov x0, ${i}`).join("\n");
const UTIL = Array.from({ length: 10 }, (_, i) => `        add x1, x1, ${i}`).join("\n");
const UTIL_LINE_3 = "        add x1, x1, 2";
const UTIL_COMBINED_LINE = 14;

/** Every test here starts from a workspace that already assembled. */
function makeHub(overrides: Partial<EmulatorState> = {}): EmulatorState {
  return baseHub({ programLoaded: true, ...overrides });
}

type Hub = EmulatorState;

function seedFiles(): void {
  window.localStorage.setItem(
    FILES_KEY,
    JSON.stringify([{ name: "util.s", body: UTIL }]),
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

function engage(container: HTMLElement) {
  act(() => {
    fireEvent.mouseDown(container.firstChild as Element);
  });
}

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
  // The lg layout is a mocked ResizableLayout that renders nothing; the
  // tablet band renders the editor, the tab strip, and the right tabs directly.
  setWidth(800);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  editorProps.current = null;
  decodeProps.current = null;
  terminalProps.current = null;
});

describe("multi-file line translation", () => {
  it("keeps the current-line marker in the file the machine assembled", async () => {
    seedFiles();
    const hub: Hub = makeHub({ currentLine: UTIL_COMBINED_LINE });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await act(async () => {
      ref.current!.assemble();
    });

    // The pc is inside util.s, so main.asm shows no marker.
    expect(editorProps.current!.currentLine).toBeNull();

    // Typing five more lines into main.asm re-numbers the combined string.
    // Resolving line 14 against the LIVE buffers put the marker on main.asm
    // line 14 -- the dot changed FILES because the student typed.
    act(() => {
      ref.current!.loadSource(`${MAIN}\nmov x2, 1\nmov x2, 2\nmov x2, 3\nmov x2, 4\nmov x2, 5`);
    });
    expect(editorProps.current!.currentLine).toBeNull();
  });

  it("keeps an assembly error in its own file while the student edits", async () => {
    seedFiles();
    const hub: Hub = makeHub({
      assemblyErrors: [{ line: UTIL_COMBINED_LINE, message: "unknown mnemonic" }],
      error: "unknown mnemonic",
    });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await act(async () => {
      ref.current!.assemble();
    });
    // The jump-to-error switched to util.s and translated the line.
    await waitFor(() =>
      expect(editorProps.current!.assemblyErrors).toEqual([
        { line: 3, message: "unknown mnemonic" },
      ]),
    );

    act(() => {
      ref.current!.loadSource(`${MAIN}\nmov x2, 1\nmov x2, 2`);
    });
    // Still util.s line 3, not main.asm line 14.
    expect(editorProps.current!.assemblyErrors).toEqual([
      { line: 3, message: "unknown mnemonic" },
    ]);
  });

  it("re-anchors gutter breakpoints when a buffer changes length", async () => {
    seedFiles();
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);

    // Click into util.s, then set a breakpoint on its line 3.
    fireEvent.click(screen.getByText("util.s"));
    act(() => {
      editorProps.current!.onToggleBreakpoint(3);
    });
    expect(hub.toggleBreakpoint).toHaveBeenCalledWith(UTIL_COMBINED_LINE);

    // The hub now holds combined line 14. Five more lines in main.asm move it.
    const withBreakpoint: Hub = makeHub({
      breakpoints: new Set([UTIL_COMBINED_LINE]),
      remapBreakpoints: hub.remapBreakpoints,
    });
    useEmulatorMock.mockReturnValue(withBreakpoint);
    act(() => {
      ref.current!.loadSource(`${MAIN}\nmov x2, 1\nmov x2, 2\nmov x2, 3\nmov x2, 4\nmov x2, 5`);
    });

    await waitFor(() => expect(hub.remapBreakpoints).toHaveBeenCalledTimes(1));
    const remap = vi.mocked(hub.remapBreakpoints).mock.calls[0][0];
    // main.asm is 15 lines now, so util.s line 3 is combined line 19.
    expect(remap(UTIL_COMBINED_LINE)).toBe(19);
  });

  it("drops the dots of a helper file that was closed", async () => {
    seedFiles();
    const hub: Hub = makeHub({ breakpoints: new Set([UTIL_COMBINED_LINE]) });
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);

    fireEvent.click(screen.getByLabelText("remove util.s"));

    await waitFor(() => expect(hub.remapBreakpoints).toHaveBeenCalled());
    const remap = vi.mocked(hub.remapBreakpoints).mock.calls[0][0];
    expect(remap(UTIL_COMBINED_LINE)).toBeNull();
  });
});

describe("the decode strip in a multi-file workspace", () => {
  it("reads the line under the pc out of the whole concatenation", async () => {
    seedFiles();
    const hub: Hub = makeHub({ currentLine: UTIL_COMBINED_LINE });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await act(async () => {
      ref.current!.assemble();
    });

    const props = decodeProps.current!;
    expect(props.currentLine).toBe(UTIL_COMBINED_LINE);
    // Handed main.asm alone, line 14 indexed past its end and the gloss fell
    // to its placeholder for every pc inside a helper.
    expect(props.source.split("\n")[UTIL_COMBINED_LINE - 1]).toBe(UTIL_LINE_3);
  });
});

describe("helper file names", () => {
  it("refuses a tab that would shadow the editor's own buffer", async () => {
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);

    const input = screen.getByPlaceholderText("new.asm");
    fireEvent.change(input, { target: { value: "main.asm" } });
    fireEvent.click(screen.getByLabelText("add file"));

    expect(toastError).toHaveBeenCalledWith(
      "main.asm is the editor's own buffer; pick another name",
    );
    expect(screen.queryByLabelText("remove main.asm")).toBeNull();
  });

  it("refuses a second tab with a name already open", async () => {
    seedFiles();
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);

    const input = screen.getByPlaceholderText("new.asm");
    fireEvent.change(input, { target: { value: "util.s" } });
    fireEvent.click(screen.getByLabelText("add file"));

    expect(toastError).toHaveBeenCalledWith("a file named util.s is already open");
    expect(screen.getAllByLabelText("remove util.s")).toHaveLength(1);
  });

  it("accepts a fresh name and opens it", async () => {
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);

    const input = screen.getByPlaceholderText("new.asm");
    fireEvent.change(input, { target: { value: "queue.s" } });
    fireEvent.click(screen.getByLabelText("add file"));

    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByLabelText("remove queue.s")).toBeTruthy();
  });
});

describe("boot stdin seeds", () => {
  it("drops a hard-loaded link's stdin in full chrome", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} startStdin={"42\n"} />,
    );
    engage(container);
    // A program that reads input must BLOCK at the read and pull the student
    // to the console; the seed re-fed itself after every assemble instead.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });

  it("keeps an authored seed in embed chrome", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={MAIN} startStdin={"42\n"} />,
    );
    engage(container);
    await waitFor(() => expect(hub.pushStdin).toHaveBeenCalledWith("42\n"));
  });
});

describe("terminal stdin and output bounds", () => {
  async function openTerminal(): Promise<NonNullable<typeof terminalProps.current>> {
    fireEvent.click(await screen.findByRole("tab", { name: "term" }));
    await waitFor(() => expect(terminalProps.current).not.toBeNull());
    return terminalProps.current!;
  }

  it("refuses a redirect that would push more than the stdin cap in one go", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);
    const terminal = await openTerminal();

    const huge = "x".repeat(MAX_STDIN_BYTES + 1);
    let result: { stderr: string } | null = null;
    await act(async () => {
      result = await terminal.buildContext().runSource("mov x0, 1\nret\n", ["./prog"], huge);
    });
    // `./prog < bigfile` is one command that could hand the machine the whole
    // 4 MiB VFS cap in a single push. The message is the literal the student
    // reads: asserting it against validateStdin(huge) would have passed just
    // as happily on a guard that returned null and pushed the megabyte.
    expect(result!.stderr).toBe("stdin too large: the limit is 100 KiB");
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });

  it("reports only the program's own output, not the editor's scrollback", async () => {
    const hub: Hub = makeHub({ stdout: "editor session output\n", exitCode: 0 });
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);
    const terminal = await openTerminal();

    let result: { stdout: string } | null = null;
    await act(async () => {
      result = await terminal.buildContext().runSource("mov x0, 1\nret\n", ["./prog"]);
    });
    // The tool assemble deliberately leaves the console alone now, so the
    // terminal must not replay what the editor already printed.
    expect(result!.stdout).toBe("");
  });
});

describe("a foreground terminal session under an assemble", () => {
  it("stands down instead of running whatever replaced its program", async () => {
    const blockedHub: Hub = makeHub({ programLoaded: true, blocked: true });
    useEmulatorMock.mockReturnValue(blockedHub);
    const { container, rerender } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);
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
      session = terminalProps
        .current!.buildContext()
        .runProgram(["./prog"], undefined, io);
    });
    // The drive starts the program once and then waits on the blocked read.
    await waitFor(() => expect(blockedHub.run).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(blockedHub.run).toHaveBeenCalledTimes(1);

    // Pressing Assemble drops the loaded flag while the backend works. The
    // drive's resume latch used to fire into that window and set the freshly
    // assembled program running with no user action.
    const reassembling: Hub = makeHub({
      programLoaded: false,
      blocked: false,
      run: blockedHub.run,
      assemble: blockedHub.assemble,
      assembleForTool: blockedHub.assembleForTool,
    });
    useEmulatorMock.mockReturnValue(reassembling);
    rerender(<EmbeddablePlayground chrome="full" startSource={MAIN} />);

    await act(async () => {
      await session;
    });
    expect(blockedHub.run).toHaveBeenCalledTimes(1);
  });
});
