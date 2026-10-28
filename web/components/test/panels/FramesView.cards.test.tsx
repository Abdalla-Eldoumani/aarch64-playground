// The cards under the frames, rendered from real machine states of the node
// build: where they sit, when they show, that each is said once, and the
// instruction set as code. The words themselves are pinned against the
// fixtures' hand-counted lines and steps in lib/test/emulator/frame-cards.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { FramesView } from "@/components/panels/FramesView";
import type { ProgramLines } from "@/lib/emulator/frame-cards";

afterEach(cleanup);

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
/** Every text the polite status takes from now on, a repeat included. */
function listen() {
  const heard: string[] = [];
  new MutationObserver(() => heard.push(said() ?? "")).observe(screen.getByRole("status"), {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return heard;
}
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

  it("keep the bad return's card from main's ret on, said once", () => {
    const m = machine(fixture("array-overrun.s"));
    m.step(59);
    const { rerender } = render(<FramesView {...m.props()} />);
    const card = within(cards()!).getByRole("listitem").textContent;
    expect(card).toMatch(/^main's ret on line 21 jumped to 0x700000006 .* at step 45\.$/);
    rerender(<FramesView {...m.props()} />);
    // The fault: the card stays, and the status is not said again.
    m.step(1);
    rerender(<FramesView {...m.props()} />);
    expect(m.emu.is_halted()).toBe(true);
    expect(within(cards()!).getByRole("listitem").textContent).toBe(card);
    expect(said()).toBe("");
    m.emu.free();
  });

  // The run row's alert says the fault with this card in it, so the frames
  // view does not say it a second time.
  it("leave a card a run brought to the run row", () => {
    const m = machine(fixture("array-overrun.s"));
    const { rerender } = render(<FramesView {...m.props()} />);
    const heard = listen();
    rerender(<FramesView {...m.props()} running />);
    m.step(29);
    rerender(<FramesView {...m.props()} running />);
    m.step(31);
    expect(m.emu.is_halted()).toBe(true);
    rerender(<FramesView {...m.props()} />);
    expect(within(cards()!).getByRole("listitem").textContent).toMatch(/^main's ret on line 21 jumped to 0x700000006 /);
    expect(said()).toBe("");
    expect(heard.filter(Boolean)).toEqual([]);
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
