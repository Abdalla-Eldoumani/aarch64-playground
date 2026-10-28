/**
 * The frames exports as they cross the worker: `frames()` once per
 * snapshot, `frame_layout()` and `frame_names()` once per assemble, read
 * with a feature test so a wasm build without them answers null. The
 * numbers stay raw until the frames view decodes them (stack-frames.ts), so
 * the decoders ship in the view's chunk, not with every page the hub runs on.
 */

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

/** How many calls deep the program is, main counted: the drawn frames, the
 *  ones folded between main and them, and the ones past the machine's cap
 *  (header slots 8, 2 and 1 of `view_numbers` in emulator/src/frames.rs). */
export function callDepth(frames: readonly number[]): number {
  return frames[8] + frames[2] + frames[1];
}

/** The x19 to x28 a returning call left changed and nothing has written
 *  since: the register of each pair after the 10-number header and the 18
 *  numbers a frame of `view_numbers`. */
export function calleeLeftovers(frames: readonly number[] | null): number[] {
  if (!frames) return [];
  const out: number[] = [];
  for (let i = 10 + frames[8] * 18; i < frames.length; i += 2) out.push(frames[i]);
  return out;
}
