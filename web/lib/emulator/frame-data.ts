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
