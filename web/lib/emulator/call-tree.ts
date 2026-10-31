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
const HEAD = 4;
const NODE = 9;

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
}

/** What a call returned: w0 when x0's high half is clear (a 32-bit result
 *  leaves it so), else all of x0. */
export function returnedText(x0: bigint, regions: readonly MemoryRegion[]): string {
  return typed(x0, x0 >> 32n ? 8 : 4, false, regions).value;
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
  const [current, outside, dropped] = [n[at + 1], n[at + 2], n[at + 3]];
  const halves = (hi: number, lo: number) => (BigInt(hi) << 32n) | BigInt(lo);
  const rows: CallRow[] = [];
  const all: CallRow[] = [];
  for (let i = 0; i < count; i++) {
    const [parent, entry, calls, open, width, argHi, argLo, retHi, retLo] = n.slice(
      at + HEAD + i * NODE,
      at + HEAD + (i + 1) * NODE,
    );
    const name = layout?.functions.find((f) => f.entry === entry)?.name ?? hex(entry);
    // A fold holding one call so far reads as that call.
    const fold = calls > 1;
    const call = fold
      ? `${name} × ${COUNT.format(calls)}`
      : width
        ? `${name}(${typed(halves(argHi, argLo), width, false, regions).value})`
        : name;
    const state = i + 1 === current ? "current" : open > 0 ? "running" : "returned";
    const row: CallRow = {
      call,
      said: fold ? `${plural(calls, "call")} of ${name}` : call,
      result: state !== "returned" ? null : fold ? "all returned" : `returned ${returnedText(halves(retHi, retLo), regions)}`,
      state,
      children: [],
    };
    all.push(row);
    (parent ? all[parent - 1].children : rows).push(row);
  }
  const hidden = dropped
    ? `${plural(dropped, "more call")} not shown${outside ? ", the current one among them" : ""}`
    : null;
  return { rows, hidden };
}
