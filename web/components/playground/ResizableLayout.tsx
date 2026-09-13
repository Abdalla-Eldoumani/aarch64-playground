"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useGroupRef,
  type Layout,
} from "react-resizable-panels";
import type { Breakpoint } from "@/lib/hooks/use-breakpoint";
import { useLayoutPersistence } from "@/lib/hooks/use-layout-persistence";

export interface ResizableLayoutProps {
  breakpoint: Breakpoint;
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  rightTabs: ReactNode;
}

/** What one draggable pair is: its panes, its opening split, its floors, and
 *  the name a screen reader reads off the grip between them. */
export interface SplitSpec {
  ids: [string, string];
  defaults: [number, number];
  minSizes: [string, string];
  label: string;
}

export const MAIN_SPLIT: SplitSpec = {
  ids: ["panel-left", "panel-right"],
  defaults: [55, 45],
  minSizes: ["25%", "25%"],
  label: "resize editor and debug column",
};

export const EDITOR_SPLIT: SplitSpec = {
  ids: ["panel-editor", "panel-disasm"],
  defaults: [70, 30],
  minSizes: ["20%", "15%"],
  label: "resize editor and disassembly",
};

export const DEBUG_SPLIT: SplitSpec = {
  ids: ["panel-regs", "panel-tabs"],
  defaults: [45, 55],
  minSizes: ["20%", "20%"],
  label: "resize registers and tabs",
};

// The one grip. A bare <Separator /> is a zero-width transparent div, so the
// seam has to be drawn here: a 6px band in --border that takes the
// interaction pole (--cyan) on hover, focus and drag, with a centred mark so
// the band reads as a handle rather than a rule. The three states the library
// publishes on data-separator cover the cases :hover cannot -- a pointer that
// has left the element mid-drag is still dragging.
const SEPARATOR_CLASS = [
  // z-10 so the focus ring paints over the neighbouring panes rather than
  // under the edge of whichever one happens to come later in the flow.
  "group/grip relative z-10 flex items-center justify-center",
  "bg-[var(--border)] transition-colors",
  "hover:bg-[var(--cyan)]",
  "data-[separator=hover]:bg-[var(--cyan)]",
  "data-[separator=active]:bg-[var(--cyan)]",
  "data-[separator=focus]:bg-[var(--cyan)]",
  "focus-visible:outline-none focus-visible:[box-shadow:var(--ring)]",
].join(" ");

// The mark is a notch of the page surface cut out of the band, not a lighter
// line drawn on it: --border-strong reads as white on white in high-contrast,
// where it and --border are the same #FFFFFF, while --bg-base is the one
// token guaranteed to contrast with --border in every theme, because being
// visible against the base surface is what --border is for.
const GRIP_CLASS = [
  "pointer-events-none block bg-[var(--bg-base)] transition-colors",
  "group-hover/grip:bg-[var(--cyan-dim)]",
  "group-data-[separator=hover]/grip:bg-[var(--cyan-dim)]",
  "group-data-[separator=active]/grip:bg-[var(--cyan-dim)]",
  "group-data-[separator=focus]/grip:bg-[var(--cyan-dim)]",
].join(" ");

function toArray(layout: Layout | undefined, ids: string[], fallback: number[]): number[] {
  if (!layout) return fallback;
  return ids.map((id, i) => layout[id] ?? fallback[i] ?? 0);
}

function toLayout(sizes: number[], ids: string[]): Layout {
  const out: Layout = {};
  ids.forEach((id, i) => {
    out[id] = sizes[i] ?? 0;
  });
  return out;
}

export interface PaneSplitProps {
  orientation: "horizontal" | "vertical";
  spec: SplitSpec;
  /** localStorage scope: one entry per breakpoint per group. */
  storageKey: Breakpoint;
  first: ReactNode;
  second: ReactNode;
}

/**
 * Two panes and the grip between them. Every split in the playground is one
 * of these, so the band, the states, the aria-label, the keyboard resize the
 * library binds to the focused separator, and the double-click reset are
 * written once and worn by all of them.
 */
export function PaneSplit({
  orientation,
  spec,
  storageKey,
  first,
  second,
}: PaneSplitProps) {
  const { ids, defaults, minSizes, label } = spec;
  const [sizes, save] = useLayoutPersistence(storageKey, defaults);
  const groupRef = useGroupRef();

  // The library's own double-click resets a panel to its `defaultSize`, which
  // here IS the persisted size, so it would be a no-op after the first drag.
  // Ours goes back to the authored split and writes that through.
  const reset = useCallback(() => {
    save(defaults);
    groupRef.current?.setLayout(toLayout(defaults, ids));
  }, [defaults, groupRef, ids, save]);

  // The stored split arrives one render late: useLayoutPersistence reads
  // localStorage in an effect, and `defaultLayout` / `defaultSize` are read
  // only at mount, so without this the group opens on the authored default
  // and the reader's saved sizes are lost on every reload. The equality guard
  // is load-bearing: a drag reports through onLayoutChange -> save -> new
  // sizes -> this effect, and pushing that same layout back would loop.
  useEffect(() => {
    const handle = groupRef.current;
    if (!handle) return;
    const current = handle.getLayout();
    const drifted = ids.some(
      (id, i) => Math.abs((current[id] ?? 0) - (sizes[i] ?? 0)) > 0.01,
    );
    if (drifted) handle.setLayout(toLayout(sizes, ids));
  }, [groupRef, ids, sizes]);

  const horizontal = orientation === "horizontal";

  return (
    <Group
      orientation={orientation}
      groupRef={groupRef}
      defaultLayout={toLayout(sizes, ids)}
      onLayoutChange={(layout) => save(toArray(layout, ids, sizes))}
      style={{ height: "100%" }}
    >
      <Panel
        id={ids[0]}
        minSize={minSizes[0]}
        defaultSize={`${sizes[0] ?? defaults[0]}%`}
      >
        {first}
      </Panel>
      <Separator
        aria-label={label}
        className={`${SEPARATOR_CLASS} ${
          horizontal ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
        }`}
        disableDoubleClick
        onDoubleClick={reset}
      >
        <span
          aria-hidden="true"
          className={`${GRIP_CLASS} ${horizontal ? "h-6 w-0.5" : "h-0.5 w-6"}`}
        />
      </Separator>
      <Panel
        id={ids[1]}
        minSize={minSizes[1]}
        defaultSize={`${sizes[1] ?? defaults[1]}%`}
      >
        {second}
      </Panel>
    </Group>
  );
}

/**
 * Laptop-and-up (lg+) layout: an outer horizontal split between the
 * editor column and the debug column. Each column is itself a vertical
 * split. All three grips persist their position per breakpoint so
 * resizing at laptop width doesn't clobber tablet/phone defaults.
 */
export function ResizableLayout({
  breakpoint,
  editor,
  disassembly,
  registers,
  rightTabs,
}: ResizableLayoutProps) {
  return (
    <PaneSplit
      orientation="horizontal"
      spec={MAIN_SPLIT}
      storageKey={breakpoint}
      first={
        <PaneSplit
          orientation="vertical"
          spec={EDITOR_SPLIT}
          storageKey={`${breakpoint}-left` as Breakpoint}
          first={editor}
          second={disassembly}
        />
      }
      second={
        <PaneSplit
          orientation="vertical"
          spec={DEBUG_SPLIT}
          storageKey={`${breakpoint}-right` as Breakpoint}
          first={registers}
          second={rightTabs}
        />
      }
    />
  );
}
