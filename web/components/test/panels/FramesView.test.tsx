// Pins the frames view as a screen reader and a stepping student meet it:
// a list of calls, main first, each a list of boxes high address first;
// the amber bar on the last write; a call or a return said once after a
// step and never during a run; the slot a pointer chip names, lit in cyan
// and brought into view on a press; and the words for an empty or older machine.
// The machine's numbers are written out by hand in frame-data's row layout.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { FramesView } from "@/components/panels/FramesView";
import { PointerContext, type PointedSlot } from "@/components/panels/slot-pointer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom has no layout and no ResizeObserver: the geometry tests place the
// boxes by hand, and the stub reports only when a test says the box resized.
let observing: StubResizeObserver[] = [];
class StubResizeObserver {
  constructor(readonly report: () => void) {}
  observe() {
    observing.push(this);
  }
  disconnect() {
    observing = observing.filter((o) => o !== this);
  }
}
const resized = () => act(() => [...observing].forEach((o) => o.report()));

/** The frames box as a scroll box `height` px tall, scrolled by `scroll`. */
function scrollBox(height: number) {
  const box = screen.getByRole("group", { name: "stack frames" });
  const state = { height, top: 0 };
  Object.defineProperty(box, "clientHeight", { configurable: true, get: () => state.height });
  Object.defineProperty(box, "scrollTop", {
    configurable: true,
    get: () => state.top,
    set: (v: number) => {
      state.top = v;
    },
  });
  return state;
}

/** Puts an element `top` px down the box's content, `height` px tall. */
function place(el: Element, top: number, height: number) {
  Object.defineProperty(el, "offsetTop", { configurable: true, value: top });
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: height });
}

const call = (name: string) => screen.getByText(name, { selector: "span" }).closest("li")!;
const slot = (text: string) => screen.getByText(text).closest("li")!;

const MAIN_RECORD = 0x7fffffe0;
const ADD_ENTRY = 0x400040;

/** One frame row: index, entry, call, return, entry sp, low end, fp at
 *  entry, record, state, flags, and two empty hits. */
function frameRow(index: number, entry: number, callPc: number, spEntry: number, lo: number, record: number, state: number) {
  return [index, entry, callPc, callPc ? callPc + 4 : 0xffff0000, spEntry, lo, 0, record, state, 0, 0, 0, -1, -1, 0, 0, -1, -1];
}

/** main's 32-byte frame (record at its low end, a_s at fp + 16), and with
 *  `called`, a leaf add_two entered from 0x400010; `step` is the machine's
 *  step count. */
function frames(called: boolean, step = 7): number[] {
  const rows = [frameRow(0, 0x400000, 0, MAIN_RECORD + 32, MAIN_RECORD, MAIN_RECORD, 0)];
  if (called) rows.push(frameRow(1, ADD_ENTRY, 0x400010, MAIN_RECORD, MAIN_RECORD, 0, 3));
  // No bad return, so the header's last seven numbers (its call) are 0.
  return [step, 0, 0, 0, 1, 0, 0, 0, rows.length, 0, ...Array(7).fill(0), ...rows.flat()];
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
    const { rerender } = render(<FramesView {...props({ frames: frames(false, 7) })} />);
    expect(said()).toBe("");
    rerender(<FramesView {...props({ frames: frames(true, 8) })} />);
    expect(said()).toBe("add_two called");
    rerender(<FramesView {...props({ frames: frames(false, 9) })} />);
    expect(said()).toBe("add_two returned");
  });

  // Back over a bl leaves the call unmade; Back over a ret puts the reader
  // inside the call again. Neither is the call returning.
  it("says what Back takes back, never a return", () => {
    const { rerender } = render(<FramesView {...props({ frames: frames(false, 7) })} />);
    rerender(<FramesView {...props({ frames: frames(true, 8) })} />);
    rerender(<FramesView {...props({ frames: frames(false, 7) })} />);
    expect(said()).toBe("back before the call to add_two");
    rerender(<FramesView {...props({ frames: frames(true, 8) })} />);
    expect(said()).toBe("add_two called");
    rerender(<FramesView {...props({ frames: frames(false, 9) })} />);
    rerender(<FramesView {...props({ frames: frames(true, 8) })} />);
    expect(said()).toBe("back inside add_two");
  });

  it("says nothing when a reset or a new program leaves the call", () => {
    const { rerender } = render(<FramesView {...props({ frames: frames(false, 7) })} />);
    rerender(<FramesView {...props({ frames: frames(true, 8) })} />);
    rerender(<FramesView {...props({ frames: frames(false, 0) })} />);
    expect(said()).toBe("add_two called");
  });

  it("says nothing about the calls a run makes, or about where it stops", () => {
    const { rerender } = render(<FramesView {...props({ running: true })} />);
    rerender(<FramesView {...props({ running: true, frames: frames(true) })} />);
    rerender(<FramesView {...props({ running: false, frames: frames(true) })} />);
    expect(said()).toBe("");
  });

  describe("keeping the step in view", () => {
    const wroteA = { dirtyAddrs: [[MAIN_RECORD + 16, 4]] as [number, number][] };

    // main's call 38 to 218 px down the box, a_s (just written) 110 to 155.
    it("shows the whole call the step wrote into when it fits", () => {
      const { rerender } = render(<FramesView {...props(wroteA)} />);
      const box = scrollBox(200);
      place(call("main"), 38, 180);
      place(slot("a_s = 7"), 110, 45);
      rerender(<FramesView {...props({ ...wroteA, frames: frames(false, 8) })} />);
      expect(box.top).toBeLessThanOrEqual(38);
      expect(box.top + box.height).toBeGreaterThanOrEqual(218);
    });

    it("brings the write back into view after a rotation", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      render(<FramesView {...props(wroteA)} />);
      const box = scrollBox(300);
      place(call("main"), 38, 180);
      place(slot("a_s = 7"), 110, 45);
      box.top = 180;
      box.height = 120;
      resized();
      expect(box.top).toBeLessThanOrEqual(110);
      expect(box.top + box.height).toBeGreaterThanOrEqual(155);
    });

    // add_two, a leaf with no boxes, sits 260 to 300 px down.
    it("brings the innermost call back into view after a resize when the step wrote nothing", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      render(<FramesView {...props({ frames: frames(true) })} />);
      const box = scrollBox(400);
      place(call("main"), 0, 220);
      place(call("add_two"), 260, 40);
      box.height = 200;
      resized();
      expect(box.top).toBeLessThanOrEqual(260);
      expect(box.top + box.height).toBeGreaterThanOrEqual(300);
    });
  });

  describe("a pointer chip's slot", () => {
    // x1 holds a_s's address (fp + 16), x2 one in the padding (fp + 24).
    const registers = Array(31).fill("0x0000000000000000") as string[];
    registers[1] = `0x${(MAIN_RECORD + 16).toString(16)}`;
    registers[2] = `0x${(MAIN_RECORD + 24).toString(16)}`;
    registers[29] = `0x${MAIN_RECORD.toString(16)}`;
    const pointed = (slot: PointedSlot | null, over: Partial<Parameters<typeof FramesView>[0]> = {}) => (
      <PointerContext.Provider value={{ pointed: slot, point: vi.fn() }}>
        <FramesView {...props({ registers, ...over })} />
      </PointerContext.Provider>
    );
    const lit = () => Array.from(document.querySelectorAll("[data-lit]"));
    const ring = (li: Element) => (li.children[1] as HTMLElement).style.boxShadow;

    it("lights the box the register points into, in cyan, and names the register for a screen reader", () => {
      const { rerender } = render(pointed({ reg: 1, reveal: 0 }));
      expect(lit()).toEqual([slot("a_s = 7")]);
      expect(ring(slot("a_s = 7"))).toBe("inset 0 0 0 2px var(--cyan)");
      expect(slot("a_s = 7").textContent).toContain(", x1 points here");
      rerender(pointed({ reg: 2, reveal: 0 }));
      expect(lit()).toEqual([slot("padding")]);
      rerender(pointed({ reg: 3, reveal: 0 }));
      expect(lit()).toEqual([]);
      rerender(pointed(null));
      expect(lit()).toEqual([]);
      expect(ring(slot("a_s = 7"))).toBe("");
    });

    it("draws the amber bar over the cyan ring on a slot the step also wrote", () => {
      render(pointed({ reg: 1, reveal: 0 }, { dirtyAddrs: [[MAIN_RECORD + 16, 4]] }));
      expect(ring(slot("a_s = 7"))).toBe("inset 3px 0 0 0 var(--amber), inset 0 0 0 2px var(--cyan)");
    });

    // main 0 to 220 px down the box, a_s 110 to 155, the leaf add_two 260 to 300.
    it("brings the slot into view on a press and holds it there until the machine moves", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      const { rerender } = render(pointed({ reg: 1, reveal: 0 }, { frames: frames(true) }));
      const box = scrollBox(100);
      place(call("main"), 0, 220);
      place(slot("a_s = 7"), 110, 45);
      place(call("add_two"), 260, 40);
      box.top = 200;
      rerender(pointed({ reg: 1, reveal: 1 }, { frames: frames(true) }));
      expect(box.top).toBeLessThanOrEqual(110);
      expect(box.top + box.height).toBeGreaterThanOrEqual(155);
      resized();
      expect(box.top).toBeLessThanOrEqual(110);
      rerender(pointed({ reg: 1, reveal: 1 }, { frames: frames(true, 8) }));
      expect(box.top + box.height).toBeGreaterThanOrEqual(300);
    });

    it("takes the focus a press left behind, and leaves it where the chip still holds it", () => {
      const { rerender } = render(pointed({ reg: 1, reveal: 0 }));
      const view = screen.getByRole("group", { name: "stack frames" });
      rerender(pointed({ reg: 1, reveal: 1 }));
      expect(document.activeElement).toBe(view);
      const chip = document.body.appendChild(document.createElement("button"));
      chip.focus();
      rerender(pointed({ reg: 1, reveal: 2 }));
      expect(document.activeElement).toBe(chip);
      chip.remove();
    });
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
