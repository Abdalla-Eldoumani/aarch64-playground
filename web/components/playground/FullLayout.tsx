"use client";

import type { ReactNode } from "react";
import { isAtLeast, type Breakpoint } from "@/lib/hooks/use-breakpoint";
import { MobileLayout } from "@/components/playground/MobileLayout";
import {
  DEBUG_SPLIT,
  EDITOR_SPLIT,
  PaneSplit,
  ResizableLayout,
} from "@/components/playground/ResizableLayout";
import type { DebugPanes } from "@/components/playground/RightTabs";

export interface FullLayoutProps {
  breakpoint: Breakpoint;
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  /** The debug column's tab strip; the phone layout reaches the same views
   *  through `panes`, so both arrive already rendered. */
  rightTabs: ReactNode;
  panes: DebugPanes;
  consoleBlocked: boolean;
  paneRequest?: { pane: string; nonce: number };
}

/**
 * Which arrangement the full playground wears at this width. Three of them,
 * and the choice is the whole of this component's job: resizable splits from
 * laptop up, two fixed half-width columns at tablet (each one a vertical
 * split of its own, under its own persistence key), and the single-pane
 * phone layout below that. Every pane arrives as a rendered node, so the
 * shell keeps the hub and this keeps the geometry.
 */
export function FullLayout({
  breakpoint,
  editor,
  disassembly,
  registers,
  rightTabs,
  panes,
  consoleBlocked,
  paneRequest,
}: FullLayoutProps) {
  const showResizable = isAtLeast(breakpoint, "lg");
  const showTablet = !showResizable && isAtLeast(breakpoint, "md");

  return (
    // A labeled section, not a main: the playground component is composed
    // inside the landing hero, lessons, exercises, and the reference, all of
    // which already sit inside their page's main. The /playground route
    // supplies the one main around it.
    <section aria-label="cpsc 355 playground" className="flex-1 min-h-0 flex flex-col">
      {showResizable ? (
        <ResizableLayout
          breakpoint={breakpoint}
          editor={editor}
          disassembly={disassembly}
          registers={registers}
          rightTabs={rightTabs}
        />
      ) : showTablet ? (
        <div className="flex flex-row h-full">
          <div className="w-1/2 min-h-0 border-r border-[var(--border)]">
            <PaneSplit
              orientation="vertical"
              spec={EDITOR_SPLIT}
              storageKey={`${breakpoint}-left` as Breakpoint}
              first={editor}
              second={disassembly}
            />
          </div>
          <div className="w-1/2 min-h-0">
            <PaneSplit
              orientation="vertical"
              spec={DEBUG_SPLIT}
              storageKey={`${breakpoint}-right` as Breakpoint}
              first={registers}
              second={rightTabs}
            />
          </div>
        </div>
      ) : (
        <MobileLayout
          editor={editor}
          disassembly={disassembly}
          registers={registers}
          {...panes}
          consoleBlocked={consoleBlocked}
          paneRequest={paneRequest}
        />
      )}
    </section>
  );
}
