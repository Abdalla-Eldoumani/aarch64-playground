// The machine numbers lines across all the files joined into one text, so
// every line number it reports has to be traced back to the right file.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import type { ReactNode } from "react";

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
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: (props: NonNullable<typeof editorProps.current>) => {
    editorProps.current = props;
    return <div data-testid="editor" />;
  },
}));

const decodeProps = vi.hoisted(() => ({
  current: null as null | { source: string; currentLine: number | null; compact?: boolean },
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

// The full-chrome surface is reached through dynamic(), so it mounts a beat
// after the shell does. Awaiting the same import settles it before a case
// reads the surface's own markup.
async function fullChromeMounted() {
  await act(async () => {
    await import("@/components/playground/FullChromeSurface");
  });
}

describe("multi-file line translation", () => {
  it("stays on the tab being edited when an assemble puts the entry in another file", async () => {
    seedFiles();
    const hub: Hub = makeHub({ currentLine: UTIL_COMBINED_LINE });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();
    await act(async () => {
      ref.current!.assemble();
    });
    // Nothing has stepped yet: main.asm stays up, with no marker of its own.
    expect(editorProps.current!.currentLine).toBeNull();
  });

  it("keeps the current-line marker in the file the machine assembled", async () => {
    seedFiles();
    // The program has stepped into util.s.
    const hub: Hub = makeHub({ currentLine: UTIL_COMBINED_LINE, stepCount: 4 });
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();
    await act(async () => {
      ref.current!.assemble();
    });

    // The pc is inside util.s, so the editor follows it there.
    expect(editorProps.current!.currentLine).toBe(3);

    // The student looks back at main.asm while paused: no marker there, and
    // the tab they picked stays picked.
    fireEvent.click(screen.getByRole("button", { name: "main.asm" }));
    expect(editorProps.current!.currentLine).toBeNull();

    // Typing five more lines into main.asm shifts every later combined line.
    // Mapping line 14 against the current text would put the marker on
    // main.asm line 14, in another file, only because the student typed.
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

  it("keeps a breakpoint on its own line when an earlier file grows", async () => {
    seedFiles();
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();

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

  it("drops the breakpoints of a helper file that was closed", async () => {
    seedFiles();
    const hub: Hub = makeHub({ breakpoints: new Set([UTIL_COMBINED_LINE]) });
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();

    fireEvent.click(screen.getByLabelText("remove util.s"));

    await waitFor(() => expect(hub.remapBreakpoints).toHaveBeenCalled());
    const remap = vi.mocked(hub.remapBreakpoints).mock.calls[0][0];
    expect(remap(UTIL_COMBINED_LINE)).toBeNull();
  });
});

describe("the decode strip in a multi-file workspace", () => {
  it("reads the line at the pc from all files joined, not main.asm alone", async () => {
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
    // Given main.asm alone, line 14 is past its end, and the strip would show
    // its placeholder whenever the pc is inside a helper.
    expect(props.source.split("\n")[UTIL_COMBINED_LINE - 1]).toBe(UTIL_LINE_3);
  });
});

describe("the decode strip in a short window", () => {
  function setHeight(px: number): void {
    Object.defineProperty(window, "innerHeight", { value: px, configurable: true, writable: true });
    window.dispatchEvent(new Event("resize"));
  }
  afterEach(() => setHeight(768));

  async function stripCompact(height: number) {
    setHeight(height);
    const { container } = render(<EmbeddablePlayground chrome="full" startSource={MAIN} />);
    engage(container);
    await fullChromeMounted();
    return decodeProps.current!.compact;
  }

  it("drops the field meanings in a short window, so the registers keep their rows", async () => {
    expect(await stripCompact(657)).toBe(true);
  });

  it("keeps them at a regular height", async () => {
    expect(await stripCompact(900)).toBe(false);
  });
});

describe("helper file names", () => {
  it("refuses a new tab named main.asm", async () => {
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} />,
    );
    engage(container);

    const input = screen.getByLabelText("new file name");
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

    const input = screen.getByLabelText("new file name");
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

    const input = screen.getByLabelText("new file name");
    fireEvent.change(input, { target: { value: "queue.s" } });
    fireEvent.click(screen.getByLabelText("add file"));

    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByLabelText("remove queue.s")).toBeTruthy();
  });
});

describe("importing a program's files", () => {
  const PROGRAM = "        .global main\nmain:   bl cube\n        ret\n";
  const CUBE = "        .global cube\ncube:   mul x0, x0, x0\n        ret\n";

  function pick(...files: File[]): void {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][data-import-input]',
    )!;
    fireEvent.change(input, { target: { files } });
  }
  const file = (body: string, name: string) => new File([body], name, { type: "text/plain" });

  it("puts the file that defines main in main.asm when none is named main", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    pick(file(CUBE, "cube.s"), file(PROGRAM, "a6.s"));

    await waitFor(() => expect(ref.current!.getSource()).toBe(PROGRAM));
    expect(ref.current!.getFiles()).toEqual([{ name: "cube.s", body: CUBE }]);
    // main.asm held other code, so the import asked before writing over it.
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("main.asm"));
  });

  it("adds one picked helper as its own tab and leaves main.asm alone", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    pick(file(CUBE, "cube.s"));

    await waitFor(() =>
      expect(ref.current!.getFiles()).toEqual([{ name: "cube.s", body: CUBE }]),
    );
    expect(ref.current!.getSource()).toBe(MAIN);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("fills a new tab's starter comment without asking", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();
    fireEvent.change(screen.getByLabelText("new file name"), { target: { value: "cube.s" } });
    fireEvent.click(screen.getByLabelText("add file"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    pick(file(CUBE, "cube.s"));

    await waitFor(() =>
      expect(ref.current!.getFiles()).toEqual([{ name: "cube.s", body: CUBE }]),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(ref.current!.getSource()).toBe(MAIN);
  });
});

describe("the error line under the run row", () => {
  async function mountWithError(message: string, line: number) {
    useEmulatorMock.mockReturnValue(
      makeHub({ assemblyErrors: [{ line, message }], error: message }),
    );
    const ref = createRef<EmbeddablePlaygroundHandle>();
    const { container } = render(
      <EmbeddablePlayground ref={ref} chrome="full" startSource={MAIN} />,
    );
    engage(container);
    await fullChromeMounted();
    await act(async () => {
      ref.current!.assemble();
    });
    return screen.getByRole("alert").textContent ?? "";
  }

  it("leads a one-file error with its line, under a hint that fits it", async () => {
    const text = await mountWithError("expected a register here, got `3`", 4);
    expect(text).toContain("line 4: expected a register here, got `3`");
    expect(text).toContain("registers only");
  });

  it("names the files of a label defined twice", async () => {
    seedFiles();
    const text = await mountWithError(
      "symbol `main' is already defined\n`main:` first appears on line 3: give this one a different name",
      UTIL_COMBINED_LINE,
    );
    expect(text).toContain("util.s line 3: symbol `main' is already defined");
    expect(text).toContain("first appears on main.asm line 3");
  });
});

describe("stdin given when the page opens", () => {
  it("drops stdin that came with a link in full chrome", async () => {
    const hub: Hub = makeHub();
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="full" startSource={MAIN} startStdin={"42\n"} />,
    );
    engage(container);
    // A program that reads input must wait at the read and bring the student
    // to the console; preset input would be fed in again after every assemble.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(hub.pushStdin).not.toHaveBeenCalled();
  });

  // Queued once, by the run's own assemble: a copy queued as the hub came up
  // could reach the machine after that assemble's reset and be read twice.
  it("keeps the page's preset stdin in embed chrome, queued by the run", async () => {
    const hub: Hub = makeHub();
    hub.assemble = vi.fn().mockResolvedValue(true);
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={MAIN} startStdin={"42\n"} />,
    );
    engage(container);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(hub.pushStdin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(1));
    expect(hub.pushStdin).toHaveBeenCalledTimes(1);
    expect(hub.pushStdin).toHaveBeenCalledWith("42\n");
  });
});

describe("terminal stdin and output bounds", () => {
  async function openTerminal(): Promise<NonNullable<typeof terminalProps.current>> {
    fireEvent.click(await screen.findByRole("tab", { name: "term" }));
    await waitFor(() => expect(terminalProps.current).not.toBeNull());
    return terminalProps.current!;
  }

  it("refuses a redirect that would send more than the stdin limit at once", async () => {
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
    // 4 MiB file-storage limit at once. The message is asserted as a literal:
    // comparing against validateStdin(huge) would also pass if the guard
    // returned null.
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
    // The terminal's own assemble leaves the console alone, so the terminal
    // must not replay what the editor's run already printed.
    expect(result!.stdout).toBe("");
  });
});

describe("a terminal run when the student assembles again", () => {
  it("stops instead of running the program that replaced its own", async () => {
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
    // The terminal session starts the program once and then waits at the read.
    await waitFor(() => expect(blockedHub.run).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(blockedHub.run).toHaveBeenCalledTimes(1);

    // Pressing assemble clears programLoaded while the emulator works. The
    // session must not resume in that gap and start the new program with no
    // press from the student.
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
