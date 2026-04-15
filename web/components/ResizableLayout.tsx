"use client";

import type { ReactNode } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import type { Breakpoint } from "@/lib/use-breakpoint";
import { useLayoutPersistence } from "@/lib/use-layout-persistence";

export interface ResizableLayoutProps {
  breakpoint: Breakpoint;
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  rightTabs: ReactNode;
}

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

/**
 * Laptop-and-up (lg+) layout: an outer horizontal split between the
 * editor column and the debug column. Each column is itself a vertical
 * split. All four handles persist their position per breakpoint so
 * resizing at laptop width doesn't clobber tablet/phone defaults.
 */
export function ResizableLayout({
  breakpoint,
  editor,
  disassembly,
  registers,
  rightTabs,
}: ResizableLayoutProps) {
  const outerIds = ["panel-left", "panel-right"];
  const leftIds = ["panel-editor", "panel-disasm"];
  const rightIds = ["panel-regs", "panel-tabs"];

  const [outer, saveOuter] = useLayoutPersistence(breakpoint, [55, 45]);
  const [leftInner, saveLeftInner] = useLayoutPersistence(
    `${breakpoint}-left` as Breakpoint,
    [70, 30],
  );
  const [rightInner, saveRightInner] = useLayoutPersistence(
    `${breakpoint}-right` as Breakpoint,
    [45, 55],
  );

  return (
    <Group
      orientation="horizontal"
      defaultLayout={toLayout(outer, outerIds)}
      onLayoutChange={(layout) => saveOuter(toArray(layout, outerIds, outer))}
      style={{ height: "100%" }}
    >
      <Panel id="panel-left" minSize="25%" defaultSize={`${outer[0] ?? 55}%`}>
        <Group
          orientation="vertical"
          defaultLayout={toLayout(leftInner, leftIds)}
          onLayoutChange={(layout) => saveLeftInner(toArray(layout, leftIds, leftInner))}
          style={{ height: "100%" }}
        >
          <Panel
            id="panel-editor"
            minSize="20%"
            defaultSize={`${leftInner[0] ?? 70}%`}
          >
            {editor}
          </Panel>
          <Separator />
          <Panel
            id="panel-disasm"
            minSize="15%"
            defaultSize={`${leftInner[1] ?? 30}%`}
          >
            {disassembly}
          </Panel>
        </Group>
      </Panel>
      <Separator />
      <Panel id="panel-right" minSize="25%" defaultSize={`${outer[1] ?? 45}%`}>
        <Group
          orientation="vertical"
          defaultLayout={toLayout(rightInner, rightIds)}
          onLayoutChange={(layout) =>
            saveRightInner(toArray(layout, rightIds, rightInner))
          }
          style={{ height: "100%" }}
        >
          <Panel
            id="panel-regs"
            minSize="20%"
            defaultSize={`${rightInner[0] ?? 45}%`}
          >
            {registers}
          </Panel>
          <Separator />
          <Panel
            id="panel-tabs"
            minSize="20%"
            defaultSize={`${rightInner[1] ?? 55}%`}
          >
            {rightTabs}
          </Panel>
        </Group>
      </Panel>
    </Group>
  );
}
