/**
 * The calls a program has made, returned ones included, as the stack frames
 * view lists them: the machine's call tree (`CallTree::numbers` in
 * emulator/src/frames/tree.rs, the tail of the frames numbers) decoded and
 * worded, each value read as the frames read a slot of its width. A run of
 * calls to one function past its first four comes folded into one node
 * that counts them ("rec × 7,940"). Only the frames view's chunk imports
 * this.
 */

import { FRAME_ROW, FRAMES_HEADER } from "@/lib/emulator/frame-data";
import type { MemoryRegion } from "@/lib/emulator/memory-map";
import { COUNT, hex, plural, typed, type FrameLayout } from "@/lib/emulator/stack-frames";

/** The tree's header, then the numbers per node. */
const HEAD = 5;
const NODE = 10;

export interface CallRow {
  /** "fact(4)", or for a fold "rec × 7,940". */
  call: string;
  /** The call for a screen reader: a fold's "×" as words. */
  said: string;
  /** "returned 24", "all returned" for a fold, null until then. */
  result: string | null;
  /** The call the machine is in, a call waiting on its callee, or done. */
  state: "current" | "running" | "returned";
  children: CallRow[];
}

export interface DrawnCalls {
  /** The program's first function, with every call under it. */
  rows: CallRow[];
  /** The calls kept out of the list, in words, or null. */
  hidden: string | null;
  /** The width of x0's latest write, 4 or 8: how a return just made reads. */
  x0Width: number;
}

/** The tree at the end of the frames numbers, worded, or null when the
 *  wasm sends none (a build before the call tree). */
export function drawCalls(
  n: readonly number[],
  layout: FrameLayout | null,
  regions: readonly MemoryRegion[],
): DrawnCalls | null {
  const at = FRAMES_HEADER + n[8] * FRAME_ROW + n[9] * 2;
  const count = n[at];
  if (count == null || n.length !== at + HEAD + count * NODE) return null;
  const [current, outside, dropped, x0Width] = n.slice(at + 1, at + HEAD);
  // x0 comes as its high and low 32 bits, read at the width it was written.
  const value = (hi: number, lo: number, width: number) =>
    typed((BigInt(hi) << 32n) | BigInt(lo), width, false, regions).value;
  const rows: CallRow[] = [];
  const all: CallRow[] = [];
  for (let i = 0; i < count; i++) {
    const [parent, entry, calls, open, width, argHi, argLo, retHi, retLo, retWidth] = n.slice(
      at + HEAD + i * NODE,
      at + HEAD + (i + 1) * NODE,
    );
    const name = layout?.functions.find((f) => f.entry === entry)?.name ?? hex(entry);
    // A fold holding one call so far reads as that call.
    const fold = calls > 1;
    const call = fold ? `${name} × ${COUNT.format(calls)}` : width ? `${name}(${value(argHi, argLo, width)})` : name;
    const state = i + 1 === current ? "current" : open > 0 ? "running" : "returned";
    const row: CallRow = {
      call,
      said: fold ? `${plural(calls, "call")} of ${name}` : call,
      result: state !== "returned" ? null : fold ? "all returned" : `returned ${value(retHi, retLo, retWidth)}`,
      state,
      children: [],
    };
    all.push(row);
    (parent ? all[parent - 1].children : rows).push(row);
  }
  const hidden = dropped
    ? `${plural(dropped, "more call")} not shown${outside ? ", the current one among them" : ""}`
    : null;
  return { rows, hidden, x0Width };
}
