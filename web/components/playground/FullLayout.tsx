"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isAtLeast, type Breakpoint, type PhoneShape } from "@/lib/hooks/use-breakpoint";
import { PhoneLayout, type PhoneLayoutProps } from "@/components/playground/PhoneLayout";
import {
  DEBUG_SPLIT,
  EDITOR_SPLIT,
  PaneSplit,
  ResizableLayout,
} from "@/components/playground/ResizableLayout";
import type { DebugPanes } from "@/components/playground/RightTabs";

export interface FullLayoutProps {
  breakpoint: Breakpoint;
  /** Set when the viewport wants the phone arrangement; it wins over the
   *  width breakpoint, since a phone on its side is tablet-wide. */
  phone: PhoneShape;
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  /** The debug column's tab strip; the phone layout reaches the same views
   *  through `panes`, so both arrive already rendered. */
  rightTabs: ReactNode;
  panes: DebugPanes;
  /** The run controls: a full-width row under the tablet and laptop
   *  layouts, and a cell of the phone grid. */
  controls: ReactNode;
  consoleBlocked: boolean;
  consoleUnread?: boolean;
  runStatus: PhoneLayoutProps["runStatus"];
  paneRequest?: { pane: string; nonce: number };
  onPaneShown?: (pane: string) => void;
}

const FILL = "h-full min-h-0 flex flex-col";

/** Where the editor is attached in whichever arrangement is on screen. */
function EditorSlot({ host }: { host: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    slot.appendChild(host);
    return () => {
      if (host.parentNode === slot) slot.removeChild(host);
    };
  }, [host]);
  return <div ref={ref} className={FILL} />;
}

/**
 * Which arrangement the full playground wears. Four of them, and the choice is
 * the whole of this component's job: resizable splits from laptop up, two
 * fixed half-width columns at tablet (each one a vertical split of its own,
 * under its own persistence key), and the phone layout, upright or on its
 * side. Every pane arrives as a rendered node, so the shell keeps the hub and
 * this keeps the geometry.
 *
 * The editor is rendered once, into a node of its own that each arrangement
 * attaches where it wants it. Switching arrangements (a rotation, a window
 * dragged across a breakpoint) moves that node instead of remounting the
 * editor, so the code's caret, scroll, and undo history come along.
 */
export function FullLayout({
  breakpoint,
  phone,
  editor,
  disassembly,
  registers,
  rightTabs,
  panes,
  controls,
  consoleBlocked,
  consoleUnread = false,
  runStatus,
  paneRequest,
  onPaneShown,
}: FullLayoutProps) {
  const [host] = useState(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    node.className = FILL;
    return node;
  });
  const placed = host ? <EditorSlot host={host} /> : editor;
  const showResizable = isAtLeast(breakpoint, "lg");

  return (
    <>
      {phone ? (
        // A labeled section, not a main: the playground component is
        // composed inside the landing hero, lessons, exercises, and the
        // reference, all of which already sit inside their page's main. The
        // /playground route supplies the one main around it.
        <section aria-label="cpsc 355 playground" className="flex-1 min-h-0 flex flex-col">
          <PhoneLayout
            shape={phone}
            editor={placed}
            disassembly={disassembly}
            registers={registers}
            panes={panes}
            controls={controls}
            runStatus={runStatus}
            consoleBlocked={consoleBlocked}
            consoleUnread={consoleUnread}
            paneRequest={paneRequest}
            onPaneShown={onPaneShown}
          />
        </section>
      ) : (
        <>
          <section aria-label="cpsc 355 playground" className="flex-1 min-h-0 flex flex-col">
            {showResizable ? (
              <ResizableLayout
                breakpoint={breakpoint}
                editor={placed}
                disassembly={disassembly}
                registers={registers}
                rightTabs={rightTabs}
              />
            ) : (
              <div className="flex flex-row h-full">
                <div className="w-1/2 min-h-0 border-r border-[var(--border)]">
                  <PaneSplit
                    orientation="vertical"
                    spec={EDITOR_SPLIT}
                    storageKey={`${breakpoint}-left` as Breakpoint}
                    first={placed}
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
            )}
          </section>
          {controls}
        </>
      )}
      {host && createPortal(editor, host)}
    </>
  );
}
