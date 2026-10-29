// Pins the list of calls above the frames as a reader meets it: a nested
// list, main first, each call's own calls under it; the call the machine is
// in marked with the amber bar, a returned one dimmed with its value, a run
// folded with its count, the calls left out counted in words; a return said
// with its value once, after the step. The machine's numbers are written out
// by hand in the frames export's layout (frame-data.ts, call-tree.ts).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FramesView } from "@/components/panels/FramesView";

afterEach(cleanup);

const MAIN = 0x400000;
const ADD_TWO = 0x400040;
const RECORD = 0x7fffffe0;

/** One frame row: index, entry, call, return, entry sp, low end, fp at
 *  entry, record, state, flags, and two empty hits. */
function frameRow(index: number, entry: number, callPc: number, spEntry: number, lo: number, record: number, state: number) {
  return [index, entry, callPc, callPc ? callPc + 4 : 0xffff0000, spEntry, lo, 0, record, state, 0, 0, 0, -1, -1, 0, 0, -1, -1];
}

/** One call tree node: caller (one more than its index, 0 for none),
 *  entry, calls, open calls, x0's width, x0 at the call and at the
 *  return, each as high and low halves. */
function node(parent: number, entry: number, calls: number, open: number, width: number, arg: number, ret: number) {
  return [parent, entry, calls, open, width, 0, arg, 0, ret];
}

/** main's frame and, with `called`, a leaf add_two entered from 0x400010;
 *  then the call tree `tree` (its header and nodes), if any. */
function frames(called: boolean, step: number, tree: number[] | null): number[] {
  const rows = [frameRow(0, MAIN, 0, RECORD + 32, RECORD, RECORD, 0)];
  if (called) rows.push(frameRow(1, ADD_TWO, 0x400010, RECORD, RECORD, 0, 3));
  return [step, 0, 0, 0, 1, 0, 0, 0, rows.length, 0, ...Array(7).fill(0), ...rows.flat(), ...(tree ?? [])];
}

// main, which reads no argument, calls add_two(5), which returns 7.
const IN_ADD_TWO = [2, 2, 0, 0, ...node(0, MAIN, 1, 1, 0, 1, 0), ...node(1, ADD_TWO, 1, 1, 4, 5, 0)];
const BACK_IN_MAIN = [2, 1, 0, 0, ...node(0, MAIN, 1, 1, 0, 1, 0), ...node(1, ADD_TWO, 1, 0, 4, 5, 7)];

const LAYOUT = {
  numbers: [2, MAIN, ADD_TWO, 0, 32, 1, 0, 0, ADD_TWO, 0x400048, 1, 0, 0, 0, 0],
  names: ["main", "add_two"],
};

function props(over: Partial<Parameters<typeof FramesView>[0]> = {}): Parameters<typeof FramesView>[0] {
  const registers = Array(31).fill("0x0000000000000000") as string[];
  registers[29] = `0x${RECORD.toString(16)}`;
  return {
    frames: frames(true, 8, IN_ADD_TWO),
    frameLayout: LAYOUT,
    registers,
    sp: `0x${RECORD.toString(16)}`,
    pc: ADD_TWO,
    getMemory: (_addr, len) => new Uint8Array(len),
    dirtyAddrs: [],
    memoryRegions: [],
    lineLabel: () => null,
    programLoaded: true,
    running: false,
    calls: true,
    ...over,
  };
}

const list = () => screen.getByRole("list", { name: "calls so far" });
const said = () => screen.getByRole("status").textContent?.trim();
/** A row's paragraph in the list by its visible call text. */
const row = (call: string) => within(list()).getAllByText(call, { selector: "span" })[0].closest("p")!;

describe("FramesView's list of calls", () => {
  it("is a nested list, main first, with each call's own calls under it, above the frames", () => {
    render(<FramesView {...props()} />);
    const top = within(list()).getAllByRole("listitem");
    expect(top.map((item) => item.querySelector("p")!.textContent)).toEqual([
      "mainmain, waiting for its call to return",
      "add_two(5)add_two(5), the current call",
    ]);
    // add_two's row sits in a list inside main's item.
    expect(top[1].parentElement!.closest("li")).toBe(top[0]);
    const frames = screen.getByRole("list", { name: "calls, main first" });
    expect(list().compareDocumentPosition(frames) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks the call the machine is in with the amber bar and dims a returned one with its value", () => {
    const { rerender } = render(<FramesView {...props()} />);
    expect(row("add_two(5)").className).toContain("inset_3px_0_0_0_var(--amber)");
    expect(row("main").className).toContain("text-[var(--text-primary)]");
    rerender(<FramesView {...props({ frames: frames(false, 9, BACK_IN_MAIN), pc: 0x400014 })} />);
    expect(row("add_two(5)").textContent).toBe("add_two(5)add_two(5) · returned 7");
    expect(row("add_two(5)").className).toContain("text-[var(--text-tertiary)]");
    expect(row("main").className).toContain("inset_3px_0_0_0_var(--amber)");
  });

  it("shows a folded run's count, says it in words, and counts the calls left out", () => {
    // main, rec(0), then 7,940 more rec calls folded, the current one among
    // them; three calls past the list's end.
    const tree = [
      3, 3, 1, 3,
      ...node(0, MAIN, 1, 1, 0, 1, 0),
      ...node(1, ADD_TWO, 1, 1, 8, 0, 0),
      ...node(2, ADD_TWO, 7940, 7940, 8, 1, 0),
    ];
    render(<FramesView {...props({ frames: frames(true, 8, tree) })} />);
    const fold = row("add_two × 7,940");
    expect(within(fold).getByText("7,940 calls of add_two").className).toBe("sr-only");
    expect(fold.textContent).toContain(", the current call");
    expect(screen.getByText("3 more calls not shown, the current one among them")).toBeTruthy();
  });

  it("says a return with the value the call left in w0, once, after the step", () => {
    const { rerender } = render(<FramesView {...props({ frames: frames(false, 7, BACK_IN_MAIN.slice()) })} />);
    rerender(<FramesView {...props({ frames: frames(true, 8, IN_ADD_TWO) })} />);
    expect(said()).toBe("add_two called");
    const registers = props().registers.slice();
    registers[0] = "0x0000000000000007";
    rerender(<FramesView {...props({ frames: frames(false, 9, BACK_IN_MAIN), registers })} />);
    expect(said()).toBe("add_two returned 7");
  });

  it("is not there without the calls switch, and a return is said without its value", () => {
    const { rerender } = render(<FramesView {...props({ calls: false, frames: frames(true, 8, IN_ADD_TWO) })} />);
    expect(screen.queryByRole("list", { name: "calls so far" })).toBeNull();
    const registers = props().registers.slice();
    registers[0] = "0x0000000000000007";
    rerender(<FramesView {...props({ calls: false, frames: frames(false, 9, BACK_IN_MAIN), registers })} />);
    expect(said()).toBe("add_two returned");
  });

  it("is not there on a machine whose frames carry no call tree", () => {
    render(<FramesView {...props({ frames: frames(true, 8, null) })} />);
    expect(screen.queryByRole("list", { name: "calls so far" })).toBeNull();
    expect(screen.getByRole("list", { name: "calls, main first" })).toBeTruthy();
  });
});
