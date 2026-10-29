/**
 * The stack frames view as words and boxes: the machine's call stack and
 * the program's frame layout, decoded from the numbers frame-data.ts reads,
 * and the stack's bytes, drawn the way the course draws a frame. High
 * addresses first, one box per saved register, local, array element and
 * gap, each at its offset from fp (from sp while fp is not set yet), with sp
 * and fp marked where they point. Only the view imports this, so none of it
 * ships on a page that never shows the frames.
 */

import type { Width } from "@/lib/asm/base-convert";
import { FRAME_ROW, FRAMES_HEADER, type FrameLayoutPayload } from "@/lib/emulator/frame-data";
import { regionFor, type MemoryRegion } from "@/lib/emulator/memory-map";
import { floatText, integerReading } from "@/lib/emulator/register-format";

// The machine's numbers, decoded. The row layouts mirror `view_numbers` in
// emulator/src/frames.rs and `FrameLayout::numbers` in
// emulator/src/frames/layout.rs.

/** How a drawn frame stands (the crate's `COMPLETE` .. `NO_RECORD`). */
export const FRAME_STATE = {
  /** The frame record is pushed and fp points at it. */
  complete: 0,
  /** Just entered: nothing pushed yet (or all of it popped again). */
  entered: 1,
  /** The record is pushed but fp is not set to it yet. */
  reserved: 2,
  /** A function that never pushes a frame of its own. */
  leaf: 3,
  /** sp and fp match none of the shapes above. */
  nonstandard: 4,
  /** A caller that called out without a frame record. */
  noRecord: 5,
} as const;

/** This function called out before it had stored x30 anywhere. */
export const LR_UNSAVED = 1;
/** qsort or bsearch called this function to compare two elements. */
export const RUNTIME_CALL = 2;

/** The latest write that changed a caller's saved fp or lr. */
export interface FrameHit {
  step: number;
  /** The writing instruction, or the `bl` of the library call that wrote. */
  pc: number;
  /** The array element the write reached, when it went through an array
   *  base, and that array's name (an index into the layout's names). */
  element: number | null;
  arrayName: number | null;
}

export interface FrameRow {
  /** Place in the call stack, 0 for main. */
  index: number;
  /** The address the call entered. */
  entry: number;
  /** The `bl`/`blr`, or the qsort/bsearch stub; 0 for main. */
  callPc: number;
  retAddr: number;
  /** The frame owns `[lo, spEntry)`. */
  spEntry: number;
  lo: number;
  fpEntry: number;
  /** Where the frame record sits, 0 for none. */
  record: number;
  state: number;
  flags: number;
  fpHit: FrameHit | null;
  lrHit: FrameHit | null;
}

export interface FramesSnapshot {
  /** The machine's step count, the clock the hits and the bad return use. */
  step: number;
  /** Calls past the machine's cap, counted but not recorded. */
  uncounted: number;
  /** Calls between main and the innermost drawn ones. */
  hidden: number;
  /** The function every hidden call entered, 0 when they differ. */
  hiddenEntry: number;
  /** The x29 chain in memory matches the call stack. */
  chainOk: boolean;
  /** The last `ret` that went to no caller, with the call it returned from
   *  as that call stood at the `ret` (a later return can pop it), or null. */
  badReturn: {
    step: number;
    pc: number;
    target: number;
    call: Pick<FrameRow, "index" | "entry" | "retAddr" | "flags" | "lrHit"> & {
      /** The return address of the latest `bl`/`blr` it made, 0 before its first. */
      lastRet: number;
    };
  } | null;
  /** main, then the innermost calls, at most 64. */
  frames: FrameRow[];
  /** Registers holding what a returning call left in a callee-saved
   *  register, with that call's `ret`. */
  leftovers: { register: number; retPc: number }[];
}

function hit(step: number, pc: number, element: number, name: number): FrameHit | null {
  if (step === 0) return null;
  return { step, pc, element: element < 0 ? null : element, arrayName: name < 0 ? null : name };
}

export function decodeFrames(n: ArrayLike<number>): FramesSnapshot | null {
  if (n.length < FRAMES_HEADER) return null;
  const count = n[8];
  const leftoverCount = n[9];
  if (n.length !== FRAMES_HEADER + count * FRAME_ROW + leftoverCount * 2) return null;
  const frames: FrameRow[] = [];
  for (let i = 0; i < count; i++) {
    const r = FRAMES_HEADER + i * FRAME_ROW;
    frames.push({
      index: n[r],
      entry: n[r + 1],
      callPc: n[r + 2],
      retAddr: n[r + 3],
      spEntry: n[r + 4],
      lo: n[r + 5],
      fpEntry: n[r + 6],
      record: n[r + 7],
      state: n[r + 8],
      flags: n[r + 9],
      fpHit: hit(n[r + 10], n[r + 11], n[r + 12], n[r + 13]),
      lrHit: hit(n[r + 14], n[r + 15], n[r + 16], n[r + 17]),
    });
  }
  const leftovers: FramesSnapshot["leftovers"] = [];
  for (let i = FRAMES_HEADER + count * FRAME_ROW; i < n.length; i += 2) {
    leftovers.push({ register: n[i], retPc: n[i + 1] });
  }
  return {
    step: n[0],
    uncounted: n[1],
    hidden: n[2],
    hiddenEntry: n[3],
    chainOk: n[4] === 1,
    badReturn:
      n[5] === 0
        ? null
        : {
            step: n[5],
            pc: n[6],
            target: n[7],
            call: {
              index: n[10],
              entry: n[11],
              retAddr: n[12],
              flags: n[13],
              lastRet: n[14],
              lrHit: hit(n[15], n[16], -1, -1),
            },
          },
    frames,
    leftovers,
  };
}

/** A load or store target at a fixed offset from a function's frame record. */
export interface FrameSlot {
  /** Bytes from x29. */
  offset: number;
  width: number;
  float: boolean;
  /** The name written as the offset (`a_s`), or for `[x9, field]` with x9
   *  an array base, the base's name. Null for a plain number. */
  name: string | null;
  /** `field` in that second form. */
  field: string | null;
}

/** An array of `width`-byte elements at `offset`, indexed by a register. */
export interface FrameArray {
  offset: number;
  width: number;
  name: string | null;
}

export interface FunctionLayout {
  entry: number;
  end: number;
  name: string | null;
  /** What its `stp x29, x30, [sp, -N]!` pushes, 0 without one. */
  frameBytes: number;
  makesRecord: boolean;
  slots: FrameSlot[];
  arrays: FrameArray[];
}

export interface FrameLayout {
  /** The names hits refer to by index (`FrameHit.arrayName`). */
  names: string[];
  functions: FunctionLayout[];
}

export function decodeFrameLayout({ numbers: n, names }: FrameLayoutPayload): FrameLayout | null {
  const name = (id: number) => names[id] ?? null;
  const functions: FunctionLayout[] = [];
  let i = 1;
  for (let f = 0; f < (n[0] ?? 0); f++) {
    if (i + 7 > n.length) return null;
    const [entry, end, nameId, frameBytes, makesRecord, slotCount, arrayCount] = Array.from(
      { length: 7 },
      (_, k) => n[i + k],
    );
    i += 7;
    if (i + slotCount * 5 + arrayCount * 3 > n.length) return null;
    const slots: FrameSlot[] = [];
    for (let s = 0; s < slotCount; s++, i += 5) {
      slots.push({ offset: n[i], width: n[i + 1], float: n[i + 2] === 1, name: name(n[i + 3]), field: name(n[i + 4]) });
    }
    const arrays: FrameArray[] = [];
    for (let a = 0; a < arrayCount; a++, i += 3) {
      arrays.push({ offset: n[i], width: n[i + 1], name: name(n[i + 2]) });
    }
    functions.push({ entry, end, name: name(nameId), frameBytes, makesRecord: makesRecord === 1, slots, arrays });
  }
  return i === n.length || n.length === 0 ? { names, functions } : null;
}

// The drawing.

export type BoxKind = "saved" | "local" | "padding" | "reserved";

export interface StackBox {
  /** The lowest address the box covers, and its size in bytes. */
  addr: number;
  size: number;
  /** "fp + 16", or "sp + 16" before fp points at the frame. */
  offset: string;
  kind: BoxKind;
  /** "saved lr (x30)", "a_s = 7", "padding". */
  title: string;
  /** What a pointer to the box's first byte is called ("a_s", "saved lr");
   *  null where only the offset says it (padding, reserved space). */
  name: string | null;
  /** "back to line 40", "int, 4 bytes", "12 bytes". */
  detail: string;
  /** A saved fp or lr that a write changed from what the call left there. */
  overwritten: boolean;
  /** The last step wrote into it: the amber bar. */
  wrote: boolean;
  /** "sp", "fp" or "sp, fp" for the registers pointing into it, else "". */
  marker: string;
}

export interface DrawnFrame {
  /** Place in the call stack, 0 for main. */
  index: number;
  name: string;
  bytes: number;
  /** "called from line 39"; null for main. */
  from: string | null;
  /** What an unfinished or unusual frame is doing, null for a complete one. */
  state: string | null;
  /** Where its offsets count from: the frame record (fp), or sp before fp
   *  points at it. */
  base: Base;
  boxes: StackBox[];
}

interface Base {
  at: number;
  name: string;
}

export interface DrawnStack {
  /** main, then the innermost calls. */
  frames: DrawnFrame[];
  /** The calls left out between main and the innermost ones, in words. */
  folded: string | null;
  /** Calls deeper than the machine keeps track of, in words. */
  untracked: string | null;
  /** Calls deep, main counted. */
  depth: number;
}

/** Bytes read from the stack for one drawing. */
export interface StackBytes {
  addr: number;
  bytes: Uint8Array;
}

export interface DrawInput {
  snapshot: FramesSnapshot;
  layout: FrameLayout | null;
  sp: number;
  fp: number;
  pc: number;
  /** The ranges `rangesToRead` asked for, as read. */
  memory: readonly StackBytes[];
  /** The last step's writes, as `[addr, len]`. */
  written: readonly (readonly [number, number])[];
  /** The machine's address bands: an 8-byte value inside one is a pointer. */
  regions: readonly MemoryRegion[];
  lineLabel: (addr: number) => string | null;
}

const STATE_WORDS: Record<number, string> = {
  [FRAME_STATE.entered]: "just entered, nothing pushed yet",
  [FRAME_STATE.reserved]: "frame reserved, fp not set yet",
  [FRAME_STATE.leaf]: "leaf: no frame of its own",
  [FRAME_STATE.nonstandard]: "nonstandard frame",
  [FRAME_STATE.noRecord]: "no frame record",
};

/** An array draws at most this many elements; the rest fold into one box. */
const MAX_ELEMENTS = 32;
/** shortcut: a frame span reads at most 16 KiB above its low end, so boxes
 *  higher up in a bigger frame show no value; read per box if a course
 *  program ever keeps that much on the stack. */
const MAX_READ = 16 * 1024;

const COUNT = new Intl.NumberFormat("en-US");

/** formatWord32's form, for a 64-bit word too: at least 8 digits. */
function hex(value: number | bigint): string {
  return `0x${BigInt(value).toString(16).padStart(8, "0")}`;
}

function plural(count: number, word: string): string {
  return `${COUNT.format(count)} ${word}${count === 1 ? "" : "s"}`;
}

/** "fp + 16", "sp + 8", "fp - 16": an address in the course's words. */
function offsetText(addr: number, base: Base): string {
  const delta = addr - base.at;
  return `${base.name} ${delta < 0 ? "-" : "+"} ${Math.abs(delta)}`;
}

/** The stack ranges a drawing needs: the drawn frames' bytes, merged where
 *  they touch, so the view reads one or two ranges a snapshot. */
export function rangesToRead(snapshot: FramesSnapshot): [number, number][] {
  const spans = snapshot.frames
    .filter((f) => f.spEntry > f.lo)
    .map((f) => [f.lo, f.spEntry])
    .sort((a, b) => a[0] - b[0]);
  const merged: number[][] = [];
  for (const [lo, hi] of spans) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  return merged.map(([lo, hi]) => [lo, Math.min(hi - lo, MAX_READ)]);
}

function bytesAt(memory: readonly StackBytes[], addr: number, size: number): Uint8Array | null {
  for (const span of memory) {
    const start = addr - span.addr;
    if (start >= 0 && start + size <= span.bytes.length) return span.bytes.subarray(start, start + size);
  }
  return null;
}

function littleEndian(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]);
  return value;
}

/** The 8-byte word at `addr` in the bytes read, or null outside them. */
export function wordAt(memory: readonly StackBytes[], addr: number): bigint | null {
  const bytes = bytesAt(memory, addr, 8);
  return bytes ? littleEndian(bytes) : null;
}

const INT_KINDS: Record<number, string> = { 1: "char", 2: "short", 4: "int", 8: "long" };

/** The C type a slot reads as and its value: an int as a signed decimal, a
 *  long as a decimal, a pointer (a value inside one of the machine's
 *  regions) in hex. */
function typed(
  bytes: Uint8Array | null,
  width: number,
  float: boolean,
  regions: readonly MemoryRegion[],
): { kind: string | null; value: string | null } {
  const bits = bytes ? littleEndian(bytes) : null;
  if (float && (width === 4 || width === 8)) {
    const fw = width === 4 ? 32 : 64;
    return { kind: width === 4 ? "float" : "double", value: bits == null ? null : floatText(bits, fw) };
  }
  if (width === 8 && bits != null && bits <= BigInt(Number.MAX_SAFE_INTEGER) && regionFor(Number(bits), regions)) {
    return { kind: "pointer", value: hex(bits) };
  }
  const kind = INT_KINDS[width] ?? null;
  if (!kind) return { kind: null, value: bits == null ? null : hex(bits) };
  return { kind, value: bits == null ? null : integerReading(bits, (width * 8) as Width).signed };
}

/** One named place in a frame: a slot, or one element of an array. */
interface Item {
  offset: number;
  width: number;
  float: boolean;
  label: string;
  /** StackBox.name: the label, or null for a bare number or the folded rest. */
  name: string | null;
  /** Set on the box that stands for the elements past MAX_ELEMENTS. */
  more?: { count: number; width: number };
}

/** The function's named places inside the frame, lowest first, none
 *  overlapping another. An array runs from its base to the next name above
 *  it (or the frame's top), and wins over a slot at its own base. */
function itemsOf(fn: FunctionLayout | undefined, top: number): Item[] {
  if (!fn) return [];
  const offsets = [...fn.slots, ...fn.arrays].map((s) => s.offset);
  const items: Item[] = [];
  for (const array of fn.arrays) {
    const end = Math.min(top, ...offsets.filter((o) => o > array.offset));
    const count = Math.max(0, Math.floor((end - array.offset) / array.width));
    const name = array.name ?? "array";
    for (let k = 0; k < Math.min(count, MAX_ELEMENTS); k++) {
      const label = `${name}[${k}]`;
      items.push({ offset: array.offset + k * array.width, width: array.width, float: false, label, name: label });
    }
    if (count > MAX_ELEMENTS) {
      const rest = count - MAX_ELEMENTS;
      items.push({
        offset: array.offset + MAX_ELEMENTS * array.width,
        width: rest * array.width,
        float: false,
        label: `${name}[${MAX_ELEMENTS}] to ${name}[${count - 1}]`,
        name: null,
        more: { count: rest, width: array.width },
      });
    }
  }
  for (const slot of fn.slots) {
    const label = slot.field ? `${slot.name ?? "?"}.${slot.field}` : (slot.name ?? `[fp, ${slot.offset}]`);
    items.push({ offset: slot.offset, width: slot.width, float: slot.float, label, name: slot.name && label });
  }
  // Stable, so an array's element keeps its place ahead of a slot at the same offset.
  items.sort((a, b) => a.offset - b.offset);
  const kept: Item[] = [];
  let end = 16;
  for (const item of items) {
    if (item.offset < end || item.offset + item.width > top) continue;
    kept.push(item);
    end = item.offset + item.width;
  }
  return kept;
}

export function drawFrames(input: DrawInput): DrawnStack {
  const { snapshot, layout, memory, written, regions } = input;
  const labels = new Map<number, string | null>();
  // Recursion repeats the same call and return lines, so each is looked up once.
  const lineOf = (addr: number) => {
    if (!labels.has(addr)) labels.set(addr, input.lineLabel(addr));
    return labels.get(addr) ?? null;
  };
  const fnAt = (entry: number) => layout?.functions.find((f) => f.entry === entry);
  const nameOf = (entry: number) => fnAt(entry)?.name ?? hex(entry);
  const rows = snapshot.frames;
  const innermost = rows[rows.length - 1];

  const overwritten = (hit: FrameHit) => {
    const line = lineOf(hit.pc);
    return line ? `overwritten by ${line}` : "overwritten";
  };

  const frameName = (record: number) => {
    const owner = rows.find((r) => r.record === record);
    if (owner) return nameOf(owner.entry);
    return snapshot.hidden > 0 && snapshot.hiddenEntry ? nameOf(snapshot.hiddenEntry) : "the caller";
  };

  const box = (
    addr: number,
    size: number,
    base: Base,
    kind: BoxKind,
    title: string,
    name: string | null,
    detail: string,
    overwritten = false,
  ): StackBox => {
    const inside = (reg: number) => reg >= addr && reg < addr + size;
    return {
      addr,
      size,
      offset: offsetText(addr, base),
      kind,
      title,
      name,
      detail,
      overwritten,
      wrote: written.some(([at, len]) => at < addr + size && addr < at + len),
      marker: [inside(input.sp) && "sp", inside(input.fp) && "fp"].filter(Boolean).join(", "),
    };
  };

  const drawFrame = (row: FrameRow): DrawnFrame => {
    const fn = fnAt(row.entry);
    const released = row === innermost && row.state === FRAME_STATE.entered && input.pc !== row.entry;
    // shortcut: "released" is read from sp back at entry with the pc moved
    // on, which is the epilogue's ldp in course code; a function that runs
    // code before its stp reads as released there too.
    const state = released ? "frame released, ret comes next" : (STATE_WORDS[row.state] ?? null);
    const callLine = lineOf(row.callPc);
    const from =
      row.index === 0
        ? null
        : row.flags & RUNTIME_CALL
          ? "called by qsort or bsearch"
          : callLine && `called from ${callLine}`;
    const R = row.record;
    const hasRecord = R !== 0 && R >= row.lo && R + 16 <= row.spEntry;
    const base = hasRecord && row.state !== FRAME_STATE.reserved ? { at: R, name: "fp" } : { at: input.sp, name: "sp" };
    const boxes: StackBox[] = [];
    if (!hasRecord) {
      if (row.spEntry > row.lo) {
        boxes.push(box(row.lo, row.spEntry - row.lo, base, "reserved", "reserved", null, plural(row.spEntry - row.lo, "byte")));
      }
    } else {
      if (R > row.lo) boxes.push(box(row.lo, R - row.lo, base, "reserved", "reserved", null, plural(R - row.lo, "byte")));
      const savedFp = wordAt(memory, R);
      const fpChanged = savedFp != null && savedFp !== BigInt(row.fpEntry);
      const fpText = fpChanged
        ? hex(savedFp)
        : row.fpEntry === 0
          ? "0, no caller frame"
          : `${frameName(row.fpEntry)}'s frame`;
      const fpHit = fpChanged ? row.fpHit : null;
      boxes.push(box(R, 8, base, "saved", "saved fp (x29)", "saved fp", fpHit ? `${fpText} · ${overwritten(fpHit)}` : fpText, !!fpHit));
      const savedLr = wordAt(memory, R + 8);
      const lrChanged = savedLr != null && savedLr !== BigInt(row.retAddr);
      const lrLine = lrChanged ? lineOf(Number(savedLr)) : lineOf(row.retAddr);
      const lrText = lrChanged
        ? `${hex(savedLr)} (${lrLine ?? "not code"})`
        : row.flags & RUNTIME_CALL
          ? "back to qsort or bsearch"
          : `back to ${lrLine ?? "the C runtime"}`;
      const lrHit = lrChanged ? row.lrHit : null;
      boxes.push(box(R + 8, 8, base, "saved", "saved lr (x30)", "saved lr", lrHit ? `${lrText} · ${overwritten(lrHit)}` : lrText, !!lrHit));
      const top = row.spEntry - R;
      let gap = 16;
      const padding = (to: number) => {
        if (to > gap) boxes.push(box(R + gap, to - gap, base, "padding", "padding", null, plural(to - gap, "byte")));
      };
      for (const item of itemsOf(fn, top)) {
        padding(item.offset);
        const at = R + item.offset;
        if (item.more) {
          const each = INT_KINDS[item.more.width] ?? "element";
          boxes.push(box(at, item.width, base, "local", item.label, item.name, `${plural(item.more.count, `more ${each}`)}, ${plural(item.width, "byte")}`));
        } else {
          const { kind, value } = typed(bytesAt(memory, at, item.width), item.width, item.float, regions);
          const title = value == null ? item.label : `${item.label} = ${value}`;
          const size = plural(item.width, "byte");
          boxes.push(box(at, item.width, base, "local", title, item.name, kind ? `${kind}, ${size}` : size));
        }
        gap = item.offset + item.width;
      }
      padding(top);
    }
    return {
      index: row.index,
      name: fn?.name ?? hex(row.entry),
      bytes: row.spEntry - row.lo,
      from,
      state,
      base,
      boxes: boxes.reverse(),
    };
  };

  return {
    frames: rows.map(drawFrame),
    folded:
      snapshot.hidden > 0
        ? `${plural(snapshot.hidden, "more call")}${snapshot.hiddenEntry ? ` of ${nameOf(snapshot.hiddenEntry)}` : ""}`
        : null,
    untracked:
      snapshot.uncounted > 0
        ? `${plural(snapshot.uncounted, "deeper call")} not shown: the playground stops keeping track this deep`
        : null,
    depth: rows.length + snapshot.hidden + snapshot.uncounted,
  };
}

/** Where `addr` lands in the drawn frames, in a pointer chip's words: the
 *  box's name, plus how far in when it is not the first byte ("a_s",
 *  "a_s + 3"), or the offset alone where the box has no name ("fp + 24");
 *  the function whose frame it is, that frame's place in the call stack,
 *  and the address as an offset in it ("fp + 16"). Null outside every
 *  drawn frame. */
export function slotAt(
  stack: DrawnStack,
  addr: number,
): { slot: string; owner: string; index: number; offset: string } | null {
  for (const frame of stack.frames) {
    const box = frame.boxes.find((b) => addr >= b.addr && addr < b.addr + b.size);
    if (!box) continue;
    const into = addr - box.addr;
    const offset = offsetText(addr, frame.base);
    const slot = box.name == null ? offset : into ? `${box.name} + ${into}` : box.name;
    return { slot, owner: frame.name, index: frame.index, offset };
  }
  return null;
}
