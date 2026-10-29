"use client";

import type { ReactNode } from "react";
import type { FrameLayoutPayload } from "@/lib/emulator/frame-data";
import { frameBoxes, slotAt } from "@/lib/emulator/stack-frames";
import type { SlotPointer } from "@/components/panels/slot-pointer";

interface ChipsInput {
  frames: readonly number[];
  frameLayout: FrameLayoutPayload | null;
  registers: readonly string[];
  sp: string;
  pc: number;
  point: SlotPointer["point"];
}

/**
 * A chip for each x register that points into a drawn frame, naming the slot
 * and whose frame it is ("a_s · main"), indexed like `registers`. x29 gets
 * none: the frames view's fp marker already says where it points, as its sp
 * marker does for sp, and a chip there would sit on every step of every
 * call. Loaded with the frames chunk, so a page that cannot show the stack
 * never ships these words.
 */
export function pointerChips({ frames, frameLayout, registers, sp, pc, point }: ChipsInput): ReactNode[] {
  const stack = frameBoxes(frames, frameLayout, registers, sp, pc);
  if (!stack) return [];
  return registers.map((hex, reg) => {
    const target = reg === 29 ? null : slotAt(stack, parseInt(hex, 16));
    if (!target) return null;
    // Under a coarse pointer the button is 44px tall through padding its
    // negative margin gives back, so the row keeps its height; centred, so a
    // click at its middle (a tap, a switch device) lands on its own face,
    // which sits above a neighbour's reach. In a narrow column the owner goes
    // first, so the slot's name stays whole.
    return (
      <button
        key={reg}
        type="button"
        aria-label={`x${reg} points to ${target.slot} in ${target.owner}'s frame. Show it in the stack.`}
        onMouseEnter={() => point(reg)}
        onMouseLeave={() => point(null)}
        onFocus={() => point(reg)}
        onBlur={() => point(null)}
        onClick={() => point(reg, true)}
        className="group relative min-w-0 max-w-full focus:outline-none [@media(pointer:coarse)]:my-[calc((1.25em_-_44px)/2)] [@media(pointer:coarse)]:min-w-[44px] [@media(pointer:coarse)]:py-[calc((44px_-_1.25em)/2)]"
      >
        <span className="relative block truncate px-[0.25ch] text-[var(--cyan)] [box-shadow:inset_0_0_0_1px_var(--cyan)] group-hover:bg-[var(--bg-elevated)] group-focus-visible:[box-shadow:inset_0_0_0_2px_var(--focus)] [@media(pointer:coarse)]:z-[1]">
          {target.slot}
          <span className="[@container(max-width:12ch)]:hidden"> · {target.owner}</span>
        </span>
      </button>
    );
  });
}
