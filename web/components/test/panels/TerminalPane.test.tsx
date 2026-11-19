import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// Minimal xterm stand-in: records every allocation and exposes the
// onKey / onData callbacks so tests can drive keys and pastes without a
// real terminal or canvas.
type KeyHandler = (e: { key: string; domEvent: KeyboardEvent }) => void;
type DataHandler = (data: string) => void;
type CustomKeyHandler = (e: KeyboardEvent) => boolean;
type ResizeHandler = (size: { cols: number; rows: number }) => void;
const instances = vi.hoisted(
  () =>
    [] as Array<{
      writes: string[];
      dispose: ReturnType<typeof vi.fn>;
      blur: ReturnType<typeof vi.fn>;
      keyCb: KeyHandler | null;
      dataCb: DataHandler | null;
      customKeyCb: CustomKeyHandler | null;
      resizeCb: ResizeHandler | null;
      cols: number;
      rows: number;
      textarea: HTMLTextAreaElement;
      focus: ReturnType<typeof vi.fn>;
      buffer: { active: { type: "normal" | "alternate" } };
      options: { theme?: { background?: string }; fontSize?: number };
    }>,
);
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    writes: string[] = [];
    dispose = vi.fn();
    blur = vi.fn();
    focus = vi.fn();
    keyCb: KeyHandler | null = null;
    dataCb: DataHandler | null = null;
    customKeyCb: CustomKeyHandler | null = null;
    resizeCb: ResizeHandler | null = null;
    cols = 80;
    rows = 24;
    textarea = document.createElement("textarea");
    buffer = { active: { type: "normal" } };
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown> = {}) {
      this.options = { ...options };
      instances.push(this as never);
    }
    // xterm puts its input textarea inside the element it opens in.
    open(element: HTMLElement) {
      element.appendChild(this.textarea);
    }
    loadAddon(addon: { activate?: (term: unknown) => void }) {
      addon.activate?.(this);
    }
    attachCustomKeyEventHandler(cb: CustomKeyHandler) {
      this.customKeyCb = cb;
    }
    writeln(s: string) {
      this.writes.push(s + "\n");
    }
    write(s: string) {
      this.writes.push(s);
    }
    clear() {}
    onKey(cb: KeyHandler) {
      this.keyCb = cb;
      return { dispose: vi.fn() };
    }
    onData(cb: DataHandler) {
      this.dataCb = cb;
      return { dispose: vi.fn() };
    }
    onResize(cb: ResizeHandler) {
      this.resizeCb = cb;
      return { dispose: vi.fn() };
    }
  },
}));
// The pane's width in pixels, and a cell 0.6 of the font size wide, which is
// JetBrains Mono's advance.
const pane = vi.hoisted(() => ({ width: 600 }));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    term: { options: { fontSize?: number } } | null = null;
    activate(term: { options: { fontSize?: number } }) {
      this.term = term;
    }
    proposeDimensions() {
      const size = this.term?.options.fontSize ?? 15;
      return { cols: Math.floor(pane.width / (size * 0.6)), rows: 20 };
    }
    fit() {}
  },
}));

import { TerminalPane } from "@/components/panels/TerminalPane";
import type { DispatchContext, TerminalProgramIO } from "@/lib/terminal/dispatch";

function makeContext(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    vfs: new Map<string, string>(),
    listVfs: vi.fn(() => ["a.txt"]),
    readVfs: vi.fn(async () => "file body\n"),
    writeVfs: vi.fn(),
    deleteVfs: vi.fn(async () => true),
    runProgram: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
    step: vi.fn(async () => ({ halted: false, line: 1 })),
    runUntilBreak: vi.fn(async () => ({ halted: true, hit_breakpoint: false })),
    runUntil: vi.fn(async () => null),
    frameStack: vi.fn(async () => null),
    lineLabel: vi.fn(() => null),
    setBreakpoint: vi.fn(async () => 1),
    deleteBreakpoints: vi.fn(async () => true),
    breakpoints: vi.fn((): [number, string][] => []),
    unsetBreakpoints: vi.fn((): [number, string][] => []),
    resolveLabel: vi.fn(async () => null),
    readRegister: vi.fn(() => 0n),
    readRegisters: vi.fn(() => ({})),
    readMemory: vi.fn(async () => new Uint8Array()),
    pcAddress: vi.fn(() => 0x400000),
    exitCode: vi.fn(() => null),
    m4Expand: async (source: string) => ({ success: true, text: source }),
    assembleSource: async () => ({ success: true, errors: [] }),
    runSource: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    executables: new Map<string, string>(),
    reset: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TerminalPane", () => {
  it("keeps one terminal when buildContext changes on every render", () => {
    // The regression this guards: buildContext closes over the emulator
    // hub and changes identity on every machine snapshot; when the init
    // effect depended on it, each step or run disposed the terminal and
    // destroyed the scrollback mid-session.
    const { rerender } = render(<TerminalPane buildContext={() => makeContext()} />);
    rerender(<TerminalPane buildContext={() => makeContext()} />);
    rerender(<TerminalPane buildContext={() => makeContext()} />);
    expect(instances).toHaveLength(1);
    expect(instances[0].dispose).not.toHaveBeenCalled();
  });

  it("opens in the site's theme and follows a switch until it unmounts", async () => {
    // The backgrounds each theme's terminal sits on (--bg-base per theme).
    document.documentElement.setAttribute("data-theme", "light");
    try {
      const { unmount } = render(<TerminalPane buildContext={() => makeContext()} />);
      const term = instances[0];
      expect(term.options.theme?.background).toBe("#FCFCFD");
      document.documentElement.setAttribute("data-theme", "ember");
      await vi.waitFor(() => expect(term.options.theme?.background).toBe("#14100D"));
      document.documentElement.setAttribute("data-theme", "high-contrast");
      await vi.waitFor(() => expect(term.options.theme?.background).toBe("#000000"));
      document.documentElement.setAttribute("data-theme", "dark");
      await vi.waitFor(() => expect(term.options.theme?.background).toBe("#0B0C10"));
      unmount();
      // Gone from the page, it stops listening.
      document.documentElement.setAttribute("data-theme", "light");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(term.options.theme?.background).toBe("#0B0C10");
    } finally {
      document.documentElement.removeAttribute("data-theme");
    }
  });

  it("submits each line of a paste as its own command, xterm \\r endings included", async () => {
    const ctx = makeContext();
    render(<TerminalPane buildContext={() => ctx} />);
    const term = instances[0];
    // xterm delivers pasted line breaks as bare carriage returns.
    term.dataCb!("ls\rcat a.txt\r");
    await vi.waitFor(() => expect(ctx.readVfs).toHaveBeenCalledWith("a.txt"));
    expect(ctx.listVfs).toHaveBeenCalled();
    // The cat output lands after the async dispatch resolves.
    await vi.waitFor(() => {
      const output = term.writes.join("");
      expect(output).toContain("a.txt");
      expect(output).toContain("file body");
    });
  });

  it("keeps special-key escape sequences out of the command line", async () => {
    // Real xterm fires both onKey and onData for the same keypress, with the
    // identical string; ArrowUp arrives as the 3-character "\x1b[A". The
    // data path must not treat it as a paste: the sequence is invisible
    // on screen but corrupts the submitted command.
    const ctx = makeContext();
    render(<TerminalPane buildContext={() => ctx} />);
    const term = instances[0];
    const press = (key: string, domKey: string) => {
      term.keyCb!({ key, domEvent: { key: domKey } as KeyboardEvent });
      term.dataCb!(key);
    };
    press("l", "l");
    press("s", "s");
    press("\x1b[A", "ArrowUp"); // empty history: onKey is a no-op
    press("\x1bOP", "F1");
    press("\r", "Enter");
    await vi.waitFor(() => expect(ctx.listVfs).toHaveBeenCalled());
    // A corrupted buffer would have dispatched "ls\x1b[A\x1bOP" and printed
    // a command-not-found line containing the raw sequence.
    const output = instances[0].writes.join("");
    expect(output).not.toContain("\x1b[A: command not found");
    expect(output).not.toContain("not found");
  });

  it("runs pasted commands one at a time so later lines see earlier writes", async () => {
    // The course toolchain paste depends on ordering: line 2 reads the
    // file line 1 creates. Concurrent dispatch read it too early.
    const files = new Map<string, string>([["a.txt", "payload\n"]]);
    const ctx = makeContext({
      readVfs: vi.fn(async (path: string) => {
        // A real VFS read suspends; that suspension is what let the next
        // pasted command run ahead.
        await new Promise((r) => setTimeout(r, 5));
        return files.get(path);
      }),
      writeVfs: vi.fn((path: string, body: string) => {
        files.set(path, body);
      }),
    });
    render(<TerminalPane buildContext={() => ctx} />);
    instances[0].dataCb!("cp a.txt b.txt\rcat b.txt\r");
    await vi.waitFor(() => {
      const output = instances[0].writes.join("");
      expect(output).toContain("payload");
      expect(output).not.toContain("no such file");
    });
  });

  it("prints a line and brings the prompt back when a command fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = makeContext({
      readVfs: vi.fn(async () => {
        throw new Error("recursive use of an object detected");
      }),
    });
    render(<TerminalPane buildContext={() => ctx} />);
    instances[0].dataCb!("cat a.txt\r");
    await vi.waitFor(() => {
      const output = instances[0].writes.join("");
      expect(output).toContain("cat: the command failed. run it again");
      // The internal wording must not reach the student.
      expect(output).not.toContain("recursive use");
      // The prompt came back.
      expect(output.lastIndexOf("$ ")).toBeGreaterThan(output.indexOf("cat a.txt"));
    });
    warn.mockRestore();
  });

  it("hands the upload command to the host's file picker through the latest prop", async () => {
    const onUploadRequest = vi.fn();
    render(
      <TerminalPane buildContext={() => makeContext()} onUploadRequest={onUploadRequest} />,
    );
    instances[0].dataCb!("upload\r");
    await vi.waitFor(() => expect(onUploadRequest).toHaveBeenCalledTimes(1));
  });
});

describe("TerminalPane width", () => {
  afterEach(() => {
    pane.width = 600;
    document.documentElement.style.removeProperty("--font-mono");
  });

  // xterm measures its cells on a canvas, which reads no CSS variable: given
  // var(--font-mono) it sized every cell for 10px Arial.
  it("hands xterm the site's mono family by name, never a CSS variable", () => {
    document.documentElement.style.setProperty("--font-mono", "'fontMono', 'fontMono Fallback'");
    render(<TerminalPane buildContext={() => makeContext()} />);
    const family = String((instances[0].options as { fontFamily?: string }).fontFamily);
    expect(family.startsWith("'fontMono', 'fontMono Fallback', ")).toBe(true);
    expect(family).not.toContain("var(");
  });

  // dsav draws its frame 80 columns wide; at 13px a laptop's pane held 70.
  it("keeps 13px text when 80 columns fit", () => {
    pane.width = 700; // 89 columns at 13px
    render(<TerminalPane buildContext={() => makeContext()} />);
    expect(instances[0].options.fontSize).toBe(13);
  });

  it("drops to 12px, and no lower, when 80 columns do not fit at 13px", () => {
    pane.width = 600; // 76 columns at 13px, 83 at 12px
    render(<TerminalPane buildContext={() => makeContext()} />);
    expect(instances[0].options.fontSize).toBe(12);
    cleanup();
    pane.width = 300; // a phone: 80 columns never fit
    render(<TerminalPane buildContext={() => makeContext()} />);
    expect(instances[1].options.fontSize).toBe(12);
  });
});

describe("TerminalPane caret", () => {
  it("blinks, and holds still for a reader who asks for reduced motion", () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    expect((instances[0].options as { cursorBlink?: boolean }).cursorBlink).toBe(true);
    cleanup();
    const reduce = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: query.includes("reduce"), media: query }) as MediaQueryList,
    );
    render(<TerminalPane buildContext={() => makeContext()} />);
    expect((instances[1].options as { cursorBlink?: boolean }).cursorBlink).toBe(false);
    reduce.mockRestore();
  });
});

describe("TerminalPane keyboard", () => {
  /** What xterm's own handler would do with a key: true keeps it in the terminal. */
  function terminalKeeps(init: KeyboardEventInit, type = "keydown"): boolean {
    return instances[0].customKeyCb!(new KeyboardEvent(type, { ...init, cancelable: true }));
  }

  // A run started from the terminal put focus in it, and no key got it out
  // again (WCAG 2.1.2).
  it("leaves the terminal on Ctrl+M, without sending the program a byte", () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    const event = new KeyboardEvent("keydown", { key: "m", ctrlKey: true, cancelable: true });
    expect(instances[0].customKeyCb!(event)).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(instances[0].blur).toHaveBeenCalledTimes(1);
    // The key's release goes nowhere either.
    expect(terminalKeeps({ key: "m", ctrlKey: true }, "keyup")).toBe(false);
    expect(instances[0].blur).toHaveBeenCalledTimes(1);
  });

  it("passes the playground's run keys through to the page", () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    for (const init of [
      { key: "F5" },
      { key: "F5", shiftKey: true },
      { key: "F6" },
      { key: "F9" },
      { key: "F10" },
      { key: "F10", shiftKey: true },
      { key: "Enter", ctrlKey: true },
      { key: "F8", ctrlKey: true },
    ]) {
      expect(terminalKeeps(init), JSON.stringify(init)).toBe(false);
    }
    expect(instances[0].blur).not.toHaveBeenCalled();
  });

  // The six terminal examples read letters, digits, Enter, space, Escape and
  // the arrow keys; all of them, and Tab for the shell, stay with the program.
  it("keeps every key a program reads", () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    for (const init of [
      { key: "w" },
      { key: "q" },
      { key: "7" },
      { key: " " },
      { key: "Enter" },
      { key: "Escape" },
      { key: "ArrowUp" },
      { key: "Tab" },
      { key: "Backspace" },
      { key: "c", ctrlKey: true },
      { key: "d", ctrlKey: true },
      { key: "M", shiftKey: true },
    ]) {
      expect(terminalKeeps(init), JSON.stringify(init)).toBe(true);
    }
  });

  it("shows the way out in the pane and reads it to a screen reader", () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    const hint = screen.getByText(/then Tab, leaves the terminal/);
    expect(hint.textContent).toBe("Ctrl+M, then Tab, leaves the terminal");
    expect(instances[0].textarea.getAttribute("aria-describedby")).toBe(hint.id);
  });
});

describe("TerminalPane size", () => {
  it("hands a program that takes the pane its columns and rows, then each resize until it lets go", () => {
    let io: TerminalProgramIO | null = null;
    render(
      <TerminalPane
        buildContext={() => makeContext()}
        onRegisterIO={(registered) => {
          io = registered;
        }}
      />,
    );
    const term = instances[0];
    term.cols = 48;
    term.rows = 43;
    const resize = vi.fn();
    io!.setForeground({ pushInput: vi.fn(), cancel: vi.fn(), resize });
    expect(resize).toHaveBeenCalledWith(48, 43);
    term.resizeCb?.({ cols: 80, rows: 24 });
    expect(resize).toHaveBeenLastCalledWith(80, 24);
    io!.setForeground(null);
    term.resizeCb?.({ cols: 100, rows: 30 });
    expect(resize).toHaveBeenCalledTimes(2);
  });
});

describe("TerminalPane after a program", () => {
  // Leaving the alternate screen moves the cursor, so the session's end does
  // it only while a program has left the pane there.
  it("says whether a program left it on the alternate screen", () => {
    let io: TerminalProgramIO | null = null;
    render(
      <TerminalPane
        buildContext={() => makeContext()}
        onRegisterIO={(registered) => {
          io = registered;
        }}
      />,
    );
    expect(io!.altScreen?.()).toBe(false);
    instances[0].buffer.active.type = "alternate";
    expect(io!.altScreen?.()).toBe(true);
  });
});

describe("TerminalPane full screen", () => {
  // The page's full screen, with the pane drawn over it: the pane's own
  // element would lose full screen when a layout crossing moves its node.
  let held: Element | null = null;
  const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
  const doc = document as Document & { exitFullscreen?: () => Promise<void> };
  const fullscreenChange = () => document.dispatchEvent(new Event("fullscreenchange"));

  function withBrowserFullScreen() {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => held });
    root.requestFullscreen = vi.fn(async () => {
      held = root;
      fullscreenChange();
    });
    doc.exitFullscreen = vi.fn(async () => {
      held = null;
      fullscreenChange();
    });
  }

  afterEach(() => {
    held = null;
    delete (root as Partial<HTMLElement>).requestFullscreen;
    delete (doc as Partial<Document>).exitFullscreen;
    delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
    vi.restoreAllMocks();
  });

  const fullScreen = () => screen.getByRole("button", { name: "full screen" });
  // jsdom lays nothing out; a pane on screen has a width, one hidden behind another tab has none.
  const onScreen = (px: number) => vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(px);
  const paneRoot = () => screen.getByRole("application", { name: "shell terminal" }).parentElement!.parentElement!;

  it("is a labelled toggle that draws the pane over the page and hands the keyboard to the terminal", async () => {
    withBrowserFullScreen();
    render(<TerminalPane buildContext={() => makeContext()} />);
    expect(fullScreen().getAttribute("aria-pressed")).toBe("false");
    expect(paneRoot().className).not.toContain("fixed");
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    expect(root.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(fullScreen().getAttribute("aria-pressed")).toBe("true");
    expect(paneRoot().className).toContain("fixed");
    expect(instances[0].focus).toHaveBeenCalled();
  });

  it("gives the pane its place and the focus back, from the control or the browser's Esc", async () => {
    withBrowserFullScreen();
    render(<TerminalPane buildContext={() => makeContext()} />);
    fullScreen().focus();
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(fullScreen().getAttribute("aria-pressed")).toBe("false");
    expect(paneRoot().className).not.toContain("fixed");
    expect(document.activeElement).toBe(fullScreen());

    await act(async () => {
      fireEvent.click(fullScreen());
    });
    // The browser leaves full screen on Esc and says so with an event.
    await act(async () => {
      held = null;
      fullscreenChange();
    });
    expect(fullScreen().getAttribute("aria-pressed")).toBe("false");
    expect(paneRoot().className).not.toContain("fixed");
    expect(document.activeElement).toBe(fullScreen());
  });

  it("fills the window where the browser has no full screen, and Esc leaves it there", async () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    expect(fullScreen().getAttribute("aria-pressed")).toBe("true");
    expect(paneRoot().className).toContain("fixed");
    // xterm hands Esc to the page instead of the program, as a browser's
    // full screen takes it.
    const esc = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    expect(instances[0].customKeyCb!(esc)).toBe(false);
    fireEvent.keyDown(instances[0].textarea, { key: "Escape" });
    expect(fullScreen().getAttribute("aria-pressed")).toBe("false");
    expect(paneRoot().className).not.toContain("fixed");
    // Outside full screen Esc is the program's again.
    expect(instances[0].customKeyCb!(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
  });

  it("hands the screen back when the pane unmounts in full screen", async () => {
    withBrowserFullScreen();
    const { unmount } = render(<TerminalPane buildContext={() => makeContext()} />);
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    unmount();
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the pane in full screen, so focus never lands on the covered page", async () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    const last = screen.getByRole("button", { name: "zoom in" });
    // Outside full screen Tab goes on to the page.
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(true);
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    instances[0].focus.mockClear();
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(false);
    expect(instances[0].focus).toHaveBeenCalledTimes(1);
    // Shift+Tab walks back through the controls as usual.
    expect(fireEvent.keyDown(last, { key: "Tab", shiftKey: true })).toBe(true);
  });

  it("brings Tab back to the pane after Ctrl+M in full screen, Shift+Tab to its last control", async () => {
    onScreen(600);
    render(<TerminalPane buildContext={() => makeContext()} />);
    // Outside full screen a Tab from the page is the page's.
    expect(fireEvent.keyDown(document.body, { key: "Tab" })).toBe(true);
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    // Ctrl+M leaves xterm for the page's body, behind the pane.
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "zoom in" }));
    act(() => (document.activeElement as HTMLElement).blur());
    expect(fireEvent.keyDown(document.body, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(fullScreen());
  });

  it("leaves Tab to a dialog open over it in full screen", async () => {
    // The command palette and the shortcuts dialog keep Tab inside themselves.
    onScreen(600);
    render(
      <>
        <TerminalPane buildContext={() => makeContext()} />
        <div role="dialog" aria-label="commands">
          <input aria-label="search commands" />
        </div>
      </>,
    );
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    const field = screen.getByRole("textbox", { name: "search commands" });
    act(() => field.focus());
    expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(field, { key: "Tab", shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  it("leaves Tab to the page while the pane is hidden in full screen", async () => {
    // A palette command that switches the right tab hides the pane behind it.
    onScreen(600);
    render(<TerminalPane buildContext={() => makeContext()} />);
    await act(async () => {
      fireEvent.click(fullScreen());
    });
    onScreen(0);
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(fireEvent.keyDown(document.body, { key: "Tab" })).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("puts its controls after the terminal, where Ctrl+M then Tab lands", () => {
    render(<TerminalPane buildContext={() => makeContext()} />);
    const order = [
      instances[0].textarea,
      fullScreen(),
      screen.getByRole("button", { name: "zoom out" }),
      screen.getByRole("button", { name: "reset zoom (currently 100 percent)" }),
      screen.getByRole("button", { name: "zoom in" }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("TerminalPane text size", () => {
  // A pane on screen: the refit after a size change skips a hidden pane.
  beforeEach(() => {
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(() => pane.width);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => 400);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    pane.width = 600;
  });

  const KEY = "aarch64-playground:zoom:terminal";

  it("steps the text by tenths of 13px, keeps it for the viewer, and refits", async () => {
    pane.width = 700; // 89 columns at 13px
    render(<TerminalPane buildContext={() => makeContext()} />);
    expect(instances[0].options.fontSize).toBe(13);
    fireEvent.click(screen.getByRole("button", { name: "zoom in" }));
    await vi.waitFor(() => expect(instances[0].options.fontSize).toBe(14));
    expect(localStorage.getItem(KEY)).toBe("1.1");
    expect(screen.getByRole("button", { name: "reset zoom (currently 110 percent)" }).textContent).toBe("110%");
    cleanup();
    render(<TerminalPane buildContext={() => makeContext()} />);
    await vi.waitFor(() => expect(instances[1].options.fontSize).toBe(14));
  });

  it("goes down to 60 percent and no further, and its reset is today's 13px with the 12px fit", async () => {
    pane.width = 600; // 76 columns at 13px, 83 at 12px
    render(<TerminalPane buildContext={() => makeContext()} />);
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "zoom out" }));
    await vi.waitFor(() => expect(instances[0].options.fontSize).toBe(8));
    expect(localStorage.getItem(KEY)).toBe("0.6");
    fireEvent.click(screen.getByRole("button", { name: "zoom out" }));
    expect(localStorage.getItem(KEY)).toBe("0.6");
    fireEvent.click(screen.getByRole("button", { name: "reset zoom (currently 60 percent)" }));
    await vi.waitFor(() => expect(instances[0].options.fontSize).toBe(12));
    expect(localStorage.getItem(KEY)).toBe("1");
  });

  it("ignores a stored value it cannot use", async () => {
    pane.width = 700;
    localStorage.setItem(KEY, "9");
    render(<TerminalPane buildContext={() => makeContext()} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(instances[0].options.fontSize).toBe(13);
    expect(screen.getByRole("button", { name: "reset zoom (currently 100 percent)" })).toBeTruthy();
  });
});
