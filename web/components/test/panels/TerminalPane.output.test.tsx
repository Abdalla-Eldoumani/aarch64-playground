// Pins how a program's output reaches the pane: one control sequence whose
// count runs far past the screen (CSI S, T, L, M, I, Z or b) finishes as
// quickly as a screen's worth, also when it arrives split across two writes,
// and the text written after it still renders. A count within the screen
// acts as it always has. The pane runs the real xterm here: jsdom has no
// canvas, which xterm's text model does not need.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Terminal } from "@xterm/xterm";
import { TerminalPane } from "@/components/panels/TerminalPane";
import type { TerminalProgramIO } from "@/lib/terminal/dispatch";

// Unclamped, xterm takes about 2.5 microseconds per unit of an S, T, L or M
// count, so the last point holds the thread for seconds; clamped, every
// point takes a few milliseconds.
const COUNTS = [1e3, 1e5, 1e6];
const LIMIT_MS = 1000;

beforeEach(() => {
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
});

// Resolves once xterm has parsed everything written before it.
function parsed(term: Terminal): Promise<void> {
  return new Promise((done) => term.write("", done));
}

// A mounted pane, wiped as a program taking it over wipes it, with the I/O
// surface the program writes through and the terminal behind it.
async function takenOverPane(): Promise<{ io: TerminalProgramIO; term: Terminal }> {
  const open = vi.spyOn(Terminal.prototype, "open");
  const surfaces: TerminalProgramIO[] = [];
  render(
    <TerminalPane
      buildContext={() => {
        throw new Error("no command runs in this suite");
      }}
      onRegisterIO={(registered) => {
        if (registered) surfaces.push(registered);
      }}
    />,
  );
  const term = open.mock.contexts[0] as Terminal;
  open.mockRestore();
  const io = surfaces[0];
  if (!io) throw new Error("the pane registered no I/O surface");
  // The banner is still queued; wiping before it is parsed would keep it.
  await parsed(term);
  io.clear?.();
  return { io, term };
}

function row(term: Terminal, y: number): string {
  const b = term.buffer.active;
  return b.getLine(b.baseY + y)?.translateToString(true) ?? "";
}

describe("a count in a control sequence from program output", { timeout: 60_000 }, () => {
  for (const final of ["S", "T", "L", "M", "I", "Z", "b"]) {
    it.each(COUNTS)(`CSI %i ${final} finishes in time and later text renders`, async (count) => {
      const { io, term } = await takenOverPane();
      const start = performance.now();
      io.write(`A\x1b[${count}${final}`);
      await parsed(term);
      expect(performance.now() - start).toBeLessThan(LIMIT_MS);
      io.write("\r\nlater");
      await parsed(term);
      expect(row(term, term.buffer.active.cursorY)).toBe("later");
    });
  }

  it("finishes in time when the count arrives in two writes", async () => {
    const { io, term } = await takenOverPane();
    const start = performance.now();
    io.write("A\x1b[100");
    io.write("0000S");
    await parsed(term);
    expect(performance.now() - start).toBeLessThan(LIMIT_MS);
  });

  it("repeats a character at most a screen's worth of times", async () => {
    const { io, term } = await takenOverPane();
    io.write("A\x1b[100000b");
    await parsed(term);
    expect(term.buffer.active.baseY).toBeLessThanOrEqual(term.rows);
  });

  it.each([
    ["scrolls up two lines", "1\r\n2\r\n3\x1b[2S", "3"],
    ["repeats a character five times", "A\x1b[5b", "AAAAAA"],
    ["moves forward two tab stops", "A\x1b[2I|", "A               |"],
  ])("a count within the screen %s as before", async (_what, text, firstRow) => {
    const { io, term } = await takenOverPane();
    io.write(text);
    await parsed(term);
    expect(row(term, 0)).toBe(firstRow);
  });
});
