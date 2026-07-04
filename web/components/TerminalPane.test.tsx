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

import { TerminalPane } from "./TerminalPane";
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

  it("routes the upload pseudo-command to the host picker through the latest prop", async () => {
    const onUploadRequest = vi.fn();
    render(
      <TerminalPane buildContext={() => makeContext()} onUploadRequest={onUploadRequest} />,
    );
    instances[0].dataCb!("upload\r");
    await vi.waitFor(() => expect(onUploadRequest).toHaveBeenCalledTimes(1));
  });
});
