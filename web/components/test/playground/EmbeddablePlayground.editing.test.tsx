// What a student expects of the editing loop, at the component boundary:
// Ctrl+Enter assembles and runs, reset starts an unchanged program over with
// its breakpoints armed, the editor follows the pc only while nothing is
// running, a dot the assemble had to drop is named, a console answer resumes
// a run parked on the read, output behind another tab marks the console tab,
// and a load or import over unsaved edits asks first.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import type { ReactNode } from "react";

const editorProps = vi.hoisted(() => ({
  current: null as null | {
    followCurrentLine?: boolean;
    onRunShortcut?: () => void;
  },
}));
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: (props: NonNullable<typeof editorProps.current>) => {
    editorProps.current = props;
    return <div data-testid="editor" />;
  },
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
  PaneSplit: ({ first, second }: { first: ReactNode; second: ReactNode }) => (
    <div data-testid="pane-split">
      {first}
      {second}
    </div>
  ),
  EDITOR_SPLIT: { label: "resize editor and disassembly" },
  DEBUG_SPLIT: { label: "resize registers and tabs" },
}));

const consoleProps = vi.hoisted(() => ({
  current: null as null | { onInputSent?: () => void },
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: (props: NonNullable<typeof consoleProps.current>) => {
    consoleProps.current = props;
    return <div data-testid="console" />;
  },
}));
vi.mock("@/components/panels/TerminalPane", () => ({
  TerminalPane: () => <div data-testid="terminal-pane" />,
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  show: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));

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
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";
import type { EmulatorState } from "@/lib/emulator/use-emulator";

const SOURCE = "        mov x0, 1\n        ret\n";

function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
  window.dispatchEvent(new Event("resize"));
}

async function mountFull(hub: EmulatorState, startSource = SOURCE) {
  useEmulatorMock.mockReturnValue(hub);
  const ref = createRef<EmbeddablePlaygroundHandle>();
  const view = (s = startSource) => (
    <EmbeddablePlayground ref={ref} chrome="full" startSource={s} />
  );
  const rendered = render(view());
  await act(async () => {
    await import("@/components/playground/FullChromeSurface");
  });
  await waitFor(() => expect(ref.current).not.toBeNull());
  return { ref, rerender: () => rendered.rerender(view()) };
}

beforeEach(() => {
  // The tablet band renders the editor, the tab strip, and the right tabs
  // directly; the lg layout is a mocked ResizableLayout that renders nothing.
  setWidth(800);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
  editorProps.current = null;
  consoleProps.current = null;
});

describe("Ctrl+Enter", () => {
  it("assembles, then runs the program once the assemble succeeded", async () => {
    const hub = makeHub({ programLoaded: true });
    const { ref } = await mountFull(hub);
    await act(async () => {
      ref.current!.assembleAndRun();
    });
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledTimes(1);
  });

  it("does not run a program that failed to assemble", async () => {
    const hub = makeHub({ assemble: vi.fn(async () => false) });
    const { ref } = await mountFull(hub);
    await act(async () => {
      ref.current!.assembleAndRun();
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);
    expect(hub.run).not.toHaveBeenCalled();
  });

  it("is the editor's own chord too, so it works with the caret in the code", async () => {
    const hub = makeHub({ programLoaded: true });
    await mountFull(hub);
    await act(async () => {
      editorProps.current!.onRunShortcut!();
    });
    await waitFor(() => expect(hub.run).toHaveBeenCalledTimes(1));
    expect(hub.assemble).toHaveBeenCalledTimes(1);
  });
});

describe("reset", () => {
  it("starts an unchanged program over instead of demanding an assemble", async () => {
    const hub = makeHub({ programLoaded: true });
    const { ref } = await mountFull(hub);
    await act(async () => {
      ref.current!.assemble();
    });
    expect(hub.assemble).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "reset" }));
    });
    expect(hub.reset).toHaveBeenCalledTimes(1);
    // The same workspace went back in, which re-arms every breakpoint.
    expect(hub.assemble).toHaveBeenCalledTimes(2);
    expect(hub.clearAllBreakpoints).not.toHaveBeenCalled();
  });

  it("only clears the machine when the code changed since the assemble", async () => {
    const hub = makeHub({ programLoaded: true });
    const { ref } = await mountFull(hub);
    await act(async () => {
      ref.current!.assemble();
    });
    act(() => {
      ref.current!.loadSource(`${SOURCE}        mov x1, 2\n`);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "reset" }));
    });
    expect(hub.reset).toHaveBeenCalledTimes(1);
    expect(hub.assemble).toHaveBeenCalledTimes(1);
  });

  it("does the same from the keyboard and the palette, which reach it through the handle", async () => {
    const hub = makeHub({ programLoaded: true });
    const { ref } = await mountFull(hub);
    await act(async () => {
      ref.current!.assemble();
    });
    await act(async () => {
      ref.current!.reset();
    });
    expect(hub.reset).toHaveBeenCalledTimes(1);
    expect(hub.assemble).toHaveBeenCalledTimes(2);
  });
});

describe("following the pc", () => {
  it("asks the editor to follow the line only while nothing is running", async () => {
    const hub = makeHub({ programLoaded: true, currentLine: 1 });
    const { rerender } = await mountFull(hub);
    expect(editorProps.current!.followCurrentLine).toBe(true);

    useEmulatorMock.mockReturnValue(makeHub({ programLoaded: true, currentLine: 1, isRunning: true }));
    act(() => rerender());
    expect(editorProps.current!.followCurrentLine).toBe(false);
  });
});

describe("a breakpoint the assemble dropped", () => {
  it("says which line lost its dot and why", async () => {
    const hub = makeHub();
    const { rerender } = await mountFull(hub);
    useEmulatorMock.mockReturnValue(makeHub({ droppedBreakpoints: [2] }));
    act(() => rerender());
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(
      "removed the breakpoint on main.asm line 2: no instruction runs at or after that line",
    );
  });
});

describe("the console", () => {
  it("hands its answer to the hub's resume, so a run parked on a read continues", async () => {
    const hub = makeHub({ programLoaded: true });
    await mountFull(hub);
    fireEvent.click(screen.getByRole("tab", { name: /^console\b/ }));
    consoleProps.current!.onInputSent!();
    expect(hub.resumeAfterInput).toHaveBeenCalledTimes(1);
  });

  it("marks its tab when output lands behind another tab, until it is opened", async () => {
    const hub = makeHub({ programLoaded: true });
    const { rerender } = await mountFull(hub);
    // The memory tab is up; a run prints.
    useEmulatorMock.mockReturnValue(makeHub({ programLoaded: true, stdout: "Sum = 7\n" }));
    act(() => rerender());
    const tab = screen.getByRole("tab", { name: "console, new output" });

    fireEvent.click(tab);
    expect(screen.getByRole("tab", { name: "console" })).toBeTruthy();

    // Back on memory, the same text does not raise the mark again.
    fireEvent.click(screen.getByRole("tab", { name: "memory" }));
    act(() => rerender());
    expect(screen.getByRole("tab", { name: "console" })).toBeTruthy();
  });

  it("names the wait on the tab while a read is parked", async () => {
    const hub = makeHub({ programLoaded: true, blocked: true });
    await mountFull(hub);
    fireEvent.click(screen.getByRole("tab", { name: "memory" }));
    expect(screen.getByRole("tab", { name: "console, waiting for input" })).toBeTruthy();
  });
});

describe("replacing the code in main.asm", () => {
  function pickFirstRecent(): void {
    fireEvent.click(screen.getByRole("combobox", { name: "load recent program" }));
    const entry = screen
      .getAllByRole("option")
      .find((option) => option.textContent !== "clear history");
    fireEvent.pointerDown(entry!);
  }

  it("asks before a load replaces edits, and keeps them when the student says no", async () => {
    const hub = makeHub();
    const { ref } = await mountFull(hub, "// older program\nret\n");
    // Assembling puts the older program in recents; then the student edits.
    await act(async () => {
      ref.current!.assemble();
    });
    act(() => {
      ref.current!.loadSource("// my edits\nret\n");
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    pickFirstRecent();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(ref.current!.getSource()).toBe("// my edits\nret\n");

    confirm.mockReturnValue(true);
    pickFirstRecent();
    expect(ref.current!.getSource()).toBe("// older program\nret\n");
  });

  it("swaps an untouched program without asking", async () => {
    const hub = makeHub();
    const { ref } = await mountFull(hub, "// first\nret\n");
    act(() => {
      ref.current!.loadProgram({ source: "// second\nret\n" });
    });
    const confirm = vi.spyOn(window, "confirm");
    pickFirstRecent();
    expect(confirm).not.toHaveBeenCalled();
    expect(ref.current!.getSource()).toBe("// first\nret\n");
  });

  it("asks before an import writes over different code in main.asm", async () => {
    const hub = makeHub();
    const { ref } = await mountFull(hub, "// my work\nret\n");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][data-import-input]',
    )!;
    const file = new File(["// imported\nret\n"], "main.s", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(ref.current!.getSource()).toBe("// my work\nret\n");
  });
});
