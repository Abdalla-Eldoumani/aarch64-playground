import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

// Minimal xterm stand-in: records every allocation and exposes the
// onKey / onData callbacks so tests can drive keys and pastes without a
// real terminal or canvas.
type KeyHandler = (e: { key: string; domEvent: KeyboardEvent }) => void;
type DataHandler = (data: string) => void;
const instances = vi.hoisted(
  () =>
    [] as Array<{
      writes: string[];
      dispose: ReturnType<typeof vi.fn>;
      keyCb: KeyHandler | null;
      dataCb: DataHandler | null;
    }>,
);
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    writes: string[] = [];
    dispose = vi.fn();
    keyCb: KeyHandler | null = null;
    dataCb: DataHandler | null = null;
    constructor() {
      instances.push(this as never);
    }
    open() {}
    loadAddon() {}
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
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
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
  it("survives prop identity churn without re-allocating the terminal", () => {
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
    // Real xterm fires onKey AND onData for the same keypress with the
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

  it("serializes a pasted command sequence so later lines see earlier writes", async () => {
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

  it("prints a line and restores the prompt when a command rejects", async () => {
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

  it("routes the upload pseudo-command to the host picker through the latest prop", async () => {
    const onUploadRequest = vi.fn();
    render(
      <TerminalPane buildContext={() => makeContext()} onUploadRequest={onUploadRequest} />,
    );
    instances[0].dataCb!("upload\r");
    await vi.waitFor(() => expect(onUploadRequest).toHaveBeenCalledTimes(1));
  });
});
