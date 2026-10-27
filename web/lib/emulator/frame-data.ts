/**
 * The machine's call stack and frame layout, decoded from the flat numbers
 * the wasm hands over (`frames()` once per snapshot, `frame_layout()` and
 * `frame_names()` once per assemble). The crate sends only numbers and the
 * program's own names; the words a student reads are built from these.
 * The row layouts mirror `view_numbers` in emulator/src/frames.rs and
 * `FrameLayout::numbers` in emulator/src/frames/layout.rs.
 */

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

/** The call out of this function happened before lr was saved. */
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
  /** The last `ret` that went to no caller, or null. */
  badReturn: { step: number; pc: number; target: number } | null;
  /** main, then the innermost calls, at most 64. */
  frames: FrameRow[];
  /** Registers holding what a returning call left in a callee-saved
   *  register, with that call's `ret`. */
  leftovers: { register: number; retPc: number }[];
}

const HEADER = 10;
const FRAME_ROW = 18;

function hit(step: number, pc: number, element: number, name: number): FrameHit | null {
  if (step === 0) return null;
  return { step, pc, element: element < 0 ? null : element, arrayName: name < 0 ? null : name };
}

export function decodeFrames(n: ArrayLike<number>): FramesSnapshot | null {
  if (n.length < HEADER) return null;
  const count = n[8];
  const leftoverCount = n[9];
  if (n.length !== HEADER + count * FRAME_ROW + leftoverCount * 2) return null;
  const frames: FrameRow[] = [];
  for (let i = 0; i < count; i++) {
    const r = HEADER + i * FRAME_ROW;
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
  for (let i = HEADER + count * FRAME_ROW; i < n.length; i += 2) {
    leftovers.push({ register: n[i], retPc: n[i + 1] });
  }
  return {
    step: n[0],
    uncounted: n[1],
    hidden: n[2],
    hiddenEntry: n[3],
    chainOk: n[4] === 1,
    badReturn: n[5] === 0 ? null : { step: n[5], pc: n[6], target: n[7] },
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

/** The two exports a layout comes in, as the worker passes them on. */
export interface FrameLayoutPayload {
  numbers: number[];
  names: string[];
}

/** The frames exports as a wasm build has them: absent on one that
 *  predates the stack frames view, which hides the view. */
export interface FrameExports {
  frames?(): Float64Array;
  frame_layout?(): Float64Array;
  frame_names?(): string[];
}

/** One snapshot's call stack numbers, or null on an older wasm. */
export function readFrames(emu: FrameExports): number[] | null {
  const numbers = emu.frames?.();
  return numbers ? Array.from(numbers) : null;
}

/** The last assemble's layout, or null on an older wasm. */
export function readFrameLayout(emu: FrameExports): FrameLayoutPayload | null {
  const numbers = emu.frame_layout?.();
  const names = emu.frame_names?.();
  return numbers && names ? { numbers: Array.from(numbers), names } : null;
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
