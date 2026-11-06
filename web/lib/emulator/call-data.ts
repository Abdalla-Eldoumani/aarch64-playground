/** The call card's export as a wasm build has it: absent on one that
 *  predates the card, which hides it. */
export interface CallCardExports {
  last_call?(): Float64Array;
}

/** The printf or scanf call the last step ran, read the same way by the
 *  worker and the main-thread backend; null when the step ran neither. The
 *  numbers stay raw until the card's own chunk words them. */
export function readCallCard(emu: CallCardExports): number[] | null {
  const numbers = emu.last_call?.();
  return numbers?.length ? Array.from(numbers) : null;
}
