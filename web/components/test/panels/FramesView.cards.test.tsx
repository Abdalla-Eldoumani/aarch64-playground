// The cards under the frames, rendered from real machine states of the node
// build: where they sit, when they show, that each is said once, the write
// kept in view before them, and the instruction set as code. The words
// themselves are pinned against the fixtures' hand-counted lines and steps
// in lib/test/emulator/frame-cards.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { FramesView } from "@/components/panels/FramesView";
import { cardContext, returnCard, type ProgramLines } from "@/lib/emulator/frame-cards";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");
type Machine = InstanceType<typeof Emulator>;

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures", name), "utf8").replace(/\r\n/g, "\n");

const hex = (v: bigint | number) => `0x${BigInt(v).toString(16).padStart(16, "0")}`;

function machine(source: string) {
  const emu: Machine = new Emulator();
  expect((emu.assemble_and_load(source) as { error?: string | null }).error ?? null).toBeNull();
  const map = Array.from(emu.get_line_map());
  const text = source.split("\n");
  const lineOf = (addr: number) => {
    for (let i = 0; i + 1 < map.length; i += 2) if (map[i] === addr) return map[i + 1];
    return null;
  };
  const lines: ProgramLines = {
    linePlace: (addr) => {
      const line = lineOf(addr);
      return line == null ? null : { file: null, line, text: text[line - 1] };
    },
    lineAddr: (line) => {
      for (let i = 0; i + 1 < map.length; i += 2) if (map[i + 1] === line) return map[i];
      return null;
    },
  };
  const frameLayout = { numbers: Array.from(emu.frame_layout()), names: emu.frame_names() };
  let notes: number[] = [];
  /** The view's props as the hub would hand them over after the last step. */
  const props = () => {
    const dirty = Array.from(emu.take_dirty_addrs());
    const dirtyAddrs: [number, number][] = [];
    for (let i = 0; i + 1 < dirty.length; i += 2) dirtyAddrs.push([dirty[i], dirty[i + 1]]);
    return {
      frames: Array.from(emu.frames()),
      frameLayout,
      registers: Array.from({ length: 31 }, (_, i) => hex(emu.get_register(i))),
      sp: hex(emu.get_sp()),
      pc: Number(emu.get_pc()),
      getMemory: (addr: number, len: number) => emu.get_memory_range(addr, len),
      readMemory: (addr: number, len: number) => Promise.resolve(emu.get_memory_range(addr, len)),
      dirtyAddrs,
      memoryRegions: [],
      lineLabel: (addr: number) => (lineOf(addr) == null ? null : `line ${lineOf(addr)}`),
      programLines: lines,
      noteRows: notes,
      programLoaded: true,
      running: false,
    };
  };
  const step = (n: number) => {
    for (let i = 0; i < n; i++) emu.step();
    notes = Array.from(emu.take_clobber_notes());
  };
  return { emu, props, step };
}

const cards = () => screen.queryByRole("list", { name: "what went wrong" });
const said = () => screen.getByRole("status").textContent?.trim();
/** Every text the polite status takes from now on, a repeat included; the
 *  observer reports after the task, so read it after `heardSoFar`. */
function listen() {
  const heard: string[] = [];
  new MutationObserver(() => heard.push(said() ?? "")).observe(screen.getByRole("status"), {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return heard;
}
const heardSoFar = () => new Promise((done) => setTimeout(done, 0));
// The panel cache before its read lands: zeros.
const missed = (_addr: number, len: number) => new Uint8Array(len);

// array-overrun.s stores arr[6] over main's saved lr at step 40 and main's
// ret takes it at step 59 (frame-cards.test.ts counts them).
describe("the cards under the frames", () => {
  it("show a write at the step that made it, after the calls, and say it once", async () => {
    const m = machine(fixture("array-overrun.s"));
    m.step(39);
    const { rerender } = render(<FramesView {...m.props()} />);
    expect(cards()).toBeNull();
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    const list = await screen.findByRole("list", { name: "what went wrong" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toMatch(/^Line 32 in helper \(str w10, \[x9, w10, sxtw 2\]\) wrote arr_s\[6\] over main's saved lr\./);
    expect(within(items[0]).getByText("str w10, [x9, w10, sxtw 2]").tagName).toBe("CODE");
    // After the list of calls, in reading order.
    const calls = screen.getByRole("list", { name: "calls, main first" });
    expect(calls.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(said()).toBe(items[0].textContent?.trim());
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    expect(cards()).toBeNull();
    m.emu.free();
  });

  // The panel cache answers zeros until its read lands; worded from those,
  // the card said "It now holds 0x0" and then "0x6", twice over.
  it("word a write from the machine's bytes only, and say it once as the cache fills", async () => {
    const m = machine(fixture("array-overrun.s"));
    m.step(39);
    const { rerender } = render(<FramesView {...m.props()} getMemory={missed} />);
    const heard = listen();
    m.step(1);
    const at40 = m.props();
    rerender(<FramesView {...at40} getMemory={missed} />);
    expect(cards()).toBeNull();
    const card = within(await screen.findByRole("list", { name: "what went wrong" })).getByRole("listitem");
    const words =
      "Line 32 in helper (str w10, [x9, w10, sxtw 2]) wrote arr_s[6] over main's saved lr. " +
      "It now holds 0x6; it should send main back to the C runtime.";
    expect(card.textContent).toBe(words);
    // The cache's read lands: the same write, not said again.
    rerender(<FramesView {...at40} />);
    await waitFor(() => expect(heard).toEqual([words]));
    expect(card.textContent).toBe(words);
    m.emu.free();
  });

  it("keep the bad return's card from main's ret on, said once", async () => {
    const m = machine(fixture("array-overrun.s"));
    m.step(58);
    const { rerender } = render(<FramesView {...m.props()} />);
    const heard = listen();
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    const card = within(cards()!).getByRole("listitem").textContent;
    expect(card).toMatch(/^main's ret on line 21 jumped to 0x700000006 .* at step 45\.$/);
    // The fault: the card stays, and the status is not said again.
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    expect(m.emu.is_halted()).toBe(true);
    expect(within(cards()!).getByRole("listitem").textContent).toBe(card);
    await heardSoFar();
    expect(heard).toEqual([card]);
    m.emu.free();
  });

  // The run row's alert says the fault with this card in it (the hub's
  // errorCard), so the frames view does not say it a second time, then or
  // after the alert has gone.
  it("leave a run's bad return to the run row's alert that carries it", async () => {
    const m = machine(fixture("array-overrun.s"));
    const { rerender } = render(<FramesView {...m.props()} />);
    const heard = listen();
    rerender(<FramesView {...m.props()} running />);
    m.step(60);
    expect(m.emu.is_halted()).toBe(true);
    const stopped = m.props();
    rerender(<FramesView {...stopped} running />);
    const ctx = cardContext(stopped.frames, stopped.frameLayout, stopped.programLines)!;
    const errorCard = returnCard(ctx, BigInt(m.emu.get_register(30)))!;
    rerender(<FramesView {...stopped} errorCard={errorCard} />);
    expect(within(cards()!).getByRole("listitem").textContent).toBe(errorCard.text);
    rerender(<FramesView {...stopped} />);
    await heardSoFar();
    expect(heard).toEqual([]);
    expect(said()).toBe("");
    m.emu.free();
  });

  // A Run that stops at a breakpoint on line 33, the line after the store:
  // the run row says nothing of the write, so the status says each card
  // once, when its word has come from the machine.
  it("say the write card a run's stop brings, once at each stop", async () => {
    const m = machine(fixture("array-overrun.s"));
    const { rerender } = render(<FramesView {...m.props()} />);
    const heard = listen();
    const painted: string[] = [];
    let at = 0;
    for (const stop of [30, 35, 40, 45]) {
      rerender(<FramesView {...m.props()} running />);
      m.step(stop - at);
      at = stop;
      rerender(<FramesView {...m.props()} running />);
      rerender(<FramesView {...m.props()} />);
      const card = within(await screen.findByRole("list", { name: "what went wrong" })).getByRole("listitem");
      painted.push(card.textContent!);
      await waitFor(() => expect(heard).toEqual(painted));
    }
    expect(painted.map((p) => p.match(/wrote (arr_s\[\d\]) over main's saved (fp|lr)/)?.slice(1).join(" "))).toEqual([
      "arr_s[4] fp",
      "arr_s[5] fp",
      "arr_s[6] lr",
      "arr_s[7] lr",
    ]);
    m.emu.free();
  });

  // lr-not-saved.s: show's ret on line 29 goes back to itself on steps 16,
  // 17, 18 and on, one loop and one event.
  it("say the lr card once however many times the ret loops back", async () => {
    const m = machine(fixture("lr-not-saved.s"));
    m.step(15);
    const { rerender } = render(<FramesView {...m.props()} />);
    const heard = listen();
    for (let i = 0; i < 5; i++) {
      m.step(1);
      rerender(<FramesView {...m.props()} />);
    }
    expect(within(cards()!).getByRole("listitem").textContent).toMatch(/^show's ret on line 29 went back into show /);
    await heardSoFar();
    expect(heard).toEqual([within(cards()!).getByRole("listitem").textContent]);
    m.emu.free();
  });

  // clear stores 0 at arr[w11] with w11 left at 6, so every pass writes the
  // same word over main's saved lr: steps 11, 16, 21 and 26 (stp, mov, bl,
  // then clear's stp, mov, add, two movs, cmp, b.ge and the str at 11; add,
  // b, cmp, b.ge and str again each 5 after). Each write is its own event,
  // so each is said, in the same words.
  it("say a write at each step it is made, even in the same words", async () => {
    const m = machine(`// clear zeroes arr, but stores at the wrong index every pass.

define(fp, x29)
define(lr, x30)

arr_s = 16                              // int arr[4]: fp + 16 to fp + 31
alloc = -(16 + 16) & -16
dealloc = -alloc

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      clear
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// clear(): arr[i] = 0 for i = 0 to 3 (bug: stores at arr[w11], not arr[w10])
        .balign 4
        .global clear
clear:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x9, fp, arr_s           // x9 = &arr[0]
        mov     w10, 0                  // i
        mov     w11, 6
cl_test:
        cmp     w10, 4
        b.ge    cl_done
        str     wzr, [x9, w11, sxtw 2]
        add     w10, w10, 1
        b       cl_test
cl_done:
        ldp     fp, lr, [sp], dealloc
        ret
`);
    m.step(10);
    const { rerender } = render(<FramesView {...m.props()} />);
    const heard = listen();
    const words =
      "Line 33 in clear (str wzr, [x9, w11, sxtw 2]) wrote arr_s[6] over main's saved lr. " +
      "It now holds 0x0; it should send main back to the C runtime.";
    // Steps 11 (the first store), 12 (no store), 16 (the second store).
    for (const [steps, stored] of [[1, true], [1, false], [4, true]] as const) {
      m.step(steps);
      rerender(<FramesView {...m.props()} />);
      if (stored) await waitFor(() => expect(within(cards()!).getByRole("listitem").textContent).toBe(words));
      else expect(cards()).toBeNull();
    }
    await heardSoFar();
    expect(heard).toEqual([words, words]);
    m.emu.free();
  });

  // Stepped to 40, the view taken down and put back (the memory tab and
  // back, a phone's chip press), then on to 41 and Back onto 40: the card
  // shows each time and is said once. The same view on a new load of the
  // program, which is how a reset, an edit and a run from the start reach
  // it, says it again.
  it("say a card once for the program as loaded, across a remount and Back", async () => {
    const m = machine(fixture("array-overrun.s"));
    m.step(39);
    const { rerender } = render(<FramesView {...m.props()} />);
    const heard = listen();
    m.step(1);
    const at40 = m.props();
    rerender(<FramesView {...at40} />);
    await waitFor(() => expect(heard).toHaveLength(1));
    rerender(<></>);
    rerender(<FramesView {...at40} />);
    await screen.findByRole("list", { name: "what went wrong" });
    expect(said()).toBe("");
    const again = listen();
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    m.emu.step_back();
    rerender(<FramesView {...m.props()} />);
    await screen.findByRole("list", { name: "what went wrong" });
    await heardSoFar();
    expect(again).toEqual([]);

    const fresh = machine(fixture("array-overrun.s"));
    fresh.step(40);
    rerender(<FramesView {...fresh.props()} />);
    await waitFor(() => expect(again).toEqual(heard));
    m.emu.free();
    fresh.emu.free();
  });

  // The step's write first: with its call and the cards when they fit, and
  // when the write and the cards do not fit together, the write alone.
  it("keep the write in view before the cards when both do not fit", async () => {
    const reports: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(readonly report: () => void) {}
        observe() {
          reports.push(this.report);
        }
        disconnect() {}
      },
    );
    const m = machine(fixture("array-overrun.s"));
    m.step(40);
    render(<FramesView {...m.props()} />);
    const list = await screen.findByRole("list", { name: "what went wrong" });
    const box = screen.getByRole("group", { name: "stack frames" });
    const wrote = box.querySelector<HTMLElement>("[data-wrote]")!;
    const state = { top: 0 };
    Object.defineProperty(box, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(box, "scrollTop", {
      configurable: true,
      get: () => state.top,
      set: (v: number) => {
        state.top = v;
      },
    });
    const place = (el: Element, top: number, height: number) => {
      Object.defineProperty(el, "offsetTop", { configurable: true, value: top });
      Object.defineProperty(el, "offsetHeight", { configurable: true, value: height });
    };
    // main's call 0 to 300 px down, its overwritten lr 200 to 240, the
    // cards 600 to 700: only the write fits the 200 px box.
    place(wrote.closest("[data-call]")!, 0, 300);
    place(wrote, 200, 40);
    place(list, 600, 100);
    act(() => reports.forEach((report) => report()));
    expect(state.top).toBeLessThanOrEqual(200);
    expect(state.top + 200).toBeGreaterThanOrEqual(240);
    m.emu.free();
  });

  // callee-saved.s: main's add on line 30, step 9, reads x19 that square's
  // ret on line 20 left changed.
  it("word a caller reading x19 at the step that read it", () => {
    const m = machine(fixture("callee-saved.s"));
    m.step(8);
    const { rerender } = render(<FramesView {...m.props()} />);
    expect(cards()).toBeNull();
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    expect(within(cards()!).getByRole("listitem").textContent).toMatch(
      /^Line 30 in main reads x19, but square changed it and its ret on line 20 did not put it back\./,
    );
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    expect(cards()).toBeNull();
    m.emu.free();
  });
});
