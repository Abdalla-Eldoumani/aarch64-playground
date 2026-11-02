"use client";

import { createContext, useCallback, useMemo, useState } from "react";

/** The register whose pointer chip the reader is on, and how many presses
 *  have asked the frames view to bring a slot into view. */
export interface PointedSlot {
  reg: number;
  reveal: number;
}

export interface SlotPointer {
  pointed: PointedSlot | null;
  /** A chip under the mouse or focus (`reg`), left (`null`), or pressed
   *  (`reveal`), which also opens the host's stack view. */
  point: (reg: number | null, reveal?: boolean) => void;
}

/** Where a register panel's chips meet a frames view. Each surface that can
 *  show the stack provides its own, so two frames on a lesson page never
 *  light each other's slots; none (the landing's demo) means no chips. */
export const PointerContext = createContext<SlotPointer | null>(null);

/** The provider's value. `open` brings the host's stack view forward and
 *  must keep its identity across renders. */
export function useSlotPointer(open: () => void, running: boolean): SlotPointer {
  const [pointed, setPointed] = useState<PointedSlot | null>(null);
  // A run takes the chips away, unmounted or out of view, and no blur or
  // leave says so: let go of the slot when one starts.
  if (running && pointed) setPointed(null);
  const point = useCallback(
    (reg: number | null, reveal = false) => {
      setPointed((prev) => (reg == null ? null : { reg, reveal: (prev?.reveal ?? 0) + Number(reveal) }));
      if (reveal) open();
    },
    [open],
  );
  return useMemo(() => ({ pointed, point }), [pointed, point]);
}
