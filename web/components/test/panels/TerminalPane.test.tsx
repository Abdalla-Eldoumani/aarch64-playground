import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Minimal xterm stand-in: records every allocation and exposes the
// onKey / onData callbacks so tests can drive keys and pastes without a
// real terminal or canvas.
type KeyHandler = (e: { key: string; domEvent: KeyboardEvent }) => void;
type DataHandler = (data: string) => void;
type CustomKeyHandler = (e: KeyboardEvent) => boolean;
const instances = vi.hoisted(
  () =>
    [] as Array<{
      writes: string[];
      dispose: ReturnType<typeof vi.fn>;
      blur: ReturnType<typeof vi.fn>;
      keyCb: KeyHandler | null;
      dataCb: DataHandler | null;
      customKeyCb: CustomKeyHandler | null;
      textarea: HTMLTextAreaElement;
      options: { theme?: { background?: string }; fontSize?: number };
    }>,
);
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    writes: string[] = [];
    dispose = vi.fn();
    blur = vi.fn();
    keyCb: KeyHandler | null = null;
    dataCb: DataHandler | null = null;
    customKeyCb: CustomKeyHandler | null = null;
    textarea = document.createElement("textarea");
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown> = {}) {
      this.options = { ...options };
      instances.push(this as never);
    }
    open() {}
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
import type { DispatchContext } from "@/lib/terminal/dispatch";

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
    setBreakpoint: vi.fn(async () => {}),
    clearBreakpoint: vi.fn(async () => {}),
    resolveLabel: vi.fn(async () => null),
    readRegister: vi.fn(() => 0n),
    readRegisters: vi.fn(() => ({})),
    readMemory: vi.fn(async () => new Uint8Array()),
    pcAddress: vi.fn(() => 0x400000),
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
      expect(term.options.theme?.background).toBe("#FFFFFF");
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
