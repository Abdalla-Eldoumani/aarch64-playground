// Pins the frames view as a screen reader and a stepping student meet it:
// a list of calls, main first, each a list of boxes high address first;
// the amber bar on the last write; a call or a return said once after a
// step and never during a run; and the words for an empty or older machine.
// The machine's numbers are written out by hand in frame-data's row layout.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FramesView } from "@/components/panels/FramesView";

afterEach(() => cleanup());

const MAIN_RECORD = 0x7fffffe0;
const ADD_ENTRY = 0x400040;

/** One frame row: index, entry, call, return, entry sp, low end, fp at
 *  entry, record, state, flags, then two empty hits. */
function frameRow(index: number, entry: number, callPc: number, spEntry: number, lo: number, record: number, state: number) {
  return [index, entry, callPc, callPc ? callPc + 4 : 0xffff0000, spEntry, lo, 0, record, state, 0, 0, 0, -1, -1, 0, 0, -1, -1];
}

/** main's 32-byte frame (record at its low end, a_s at fp + 16), and with
 *  `called`, a leaf add_two entered from 0x400010. */
function frames(called: boolean): number[] {
  const rows = [frameRow(0, 0x400000, 0, MAIN_RECORD + 32, MAIN_RECORD, MAIN_RECORD, 0)];
  if (called) rows.push(frameRow(1, ADD_ENTRY, 0x400010, MAIN_RECORD, MAIN_RECORD, 0, 3));
  return [7, 0, 0, 0, 1, 0, 0, 0, rows.length, 0, ...rows.flat()];
}

// main and add_two, main with one int slot a_s at fp + 16.
const LAYOUT = {
  numbers: [2, 0x400000, 0x400040, 0, 32, 1, 1, 0, 16, 4, 0, 1, -1, ADD_ENTRY, 0x400048, 2, 0, 0, 0, 0],
  names: ["main", "a_s", "add_two"],
};

/** main's record holds 0 and the C runtime's return; a_s holds 7. */
function memory(addr: number, len: number) {
  const out = new Uint8Array(len);
  const view = new DataView(out.buffer);
  if (addr === MAIN_RECORD && len >= 24) {
    view.setBigUint64(8, 0xffff0000n, true);
    view.setInt32(16, 7, true);
  }
  return out;
}

function props(over: Partial<Parameters<typeof FramesView>[0]> = {}): Parameters<typeof FramesView>[0] {
  const registers = Array(31).fill("0x0000000000000000") as string[];
  registers[29] = `0x${MAIN_RECORD.toString(16)}`;
  return {
    frames: frames(false),
    frameLayout: LAYOUT,
    registers,
    sp: `0x${MAIN_RECORD.toString(16)}`,
    pc: 0x400010,
    getMemory: memory,
    dirtyAddrs: [],
    memoryRegions: [],
    lineLabel: (addr) => (addr === 0x400010 ? "line 12" : addr === 0x400014 ? "line 13" : null),
    programLoaded: true,
    running: false,
    ...over,
  };
}

const said = () => screen.getByRole("status").textContent?.trim();

describe("FramesView", () => {
  it("reads as a list of calls, each a list of boxes from the high address down", () => {
    render(<FramesView {...props({ frames: frames(true) })} />);
    const calls = Array.from(screen.getByRole("list", { name: "calls, main first" }).children);
    expect(calls).toHaveLength(2);
    expect(calls[0].textContent).toMatch(/^main · 32 bytes/);
    const boxes = within(screen.getByRole("list", { name: "main's frame, high address first" })).getAllByRole(
      "listitem",
    );
    expect(boxes.map((b) => b.textContent)).toEqual([
      "fp + 20padding12 bytes",
      "fp + 16a_s = 7int, 4 bytes",
      "fp + 8saved lr (x30)back to the C runtime",
      "fp + 0saved fp (x29)0, no caller frame← sp, fp points here",
    ]);
    expect(screen.getByText("add_two")).toBeTruthy();
    expect(screen.getByText("leaf: no frame of its own")).toBeTruthy();
    expect(screen.getByText(/called from line 12/)).toBeTruthy();
  });

  it("puts the amber bar on the box the last step wrote", () => {
    render(<FramesView {...props({ dirtyAddrs: [[MAIN_RECORD + 16, 4]] })} />);
    const written = screen.getByText("a_s = 7").parentElement!;
    expect(written.style.boxShadow).toBe("inset 3px 0 0 0 var(--amber)");
    expect(written.textContent).toContain("just written");
    expect(screen.getByText("saved lr (x30)").parentElement!.style.boxShadow).toBe("");
  });

  it("says a call and a return once each, after the step that made it", () => {
    const { rerender } = render(<FramesView {...props()} />);
    expect(said()).toBe("");
    rerender(<FramesView {...props({ frames: frames(true) })} />);
    expect(said()).toBe("add_two called");
    rerender(<FramesView {...props({ frames: frames(false) })} />);
    expect(said()).toBe("add_two returned");
  });

  it("says nothing about the calls a run makes, or about where it stops", () => {
    const { rerender } = render(<FramesView {...props({ running: true })} />);
    rerender(<FramesView {...props({ running: true, frames: frames(true) })} />);
    rerender(<FramesView {...props({ running: false, frames: frames(true) })} />);
    expect(said()).toBe("");
  });

  it("asks for a step before a program is loaded", () => {
    render(<FramesView {...props({ programLoaded: false, frames: null, frameLayout: null })} />);
    expect(screen.getByText(/Step through the program/)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says so on an older emulator that sends no frames", () => {
    render(<FramesView {...props({ frames: null, frameLayout: null })} />);
    expect(screen.getByText("The emulator loaded here cannot draw stack frames.")).toBeTruthy();
  });
});
