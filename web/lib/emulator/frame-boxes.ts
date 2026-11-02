import type { FrameLayoutPayload } from "@/lib/emulator/frame-data";
import { decodeFrameLayout, decodeFrames, drawFrames, type DrawnStack } from "@/lib/emulator/stack-frames";

/** The frames drawn with no bytes read: where each box sits, all `slotAt`
 *  needs (the pointer chips, the call card). Its own module, so the frame
 *  cards' chunk, which never names an address, does not carry it. Null
 *  without a call stack. */
export function frameBoxes(
  frames: readonly number[] | null,
  layout: FrameLayoutPayload | null,
  registers: readonly string[],
  sp: string,
  pc: number,
): DrawnStack | null {
  const snapshot = frames && decodeFrames(frames);
  if (!snapshot) return null;
  return drawFrames({
    snapshot,
    layout: layout && decodeFrameLayout(layout),
    sp: parseInt(sp, 16) || 0,
    fp: parseInt(registers[29] ?? "", 16) || 0,
    pc,
    memory: [],
    written: [],
    regions: [],
    lineLabel: () => null,
  });
}
