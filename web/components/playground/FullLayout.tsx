"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  isAtLeast,
  type Breakpoint,
  type PhoneShape,
  type ScreenHeight,
} from "@/lib/hooks/use-breakpoint";
import { PhoneLayout, type PhoneLayoutProps } from "@/components/playground/PhoneLayout";
import {
  DEBUG_SPLIT,
  EDITOR_SPLIT,
  FRAMES_SPLIT,
  PaneSplit,
  ResizableLayout,
} from "@/components/playground/ResizableLayout";
import type { DebugPanes } from "@/components/playground/RightTabs";

export interface FullLayoutProps {
  breakpoint: Breakpoint;
  /** Set when the viewport wants the phone arrangement; it wins over the
   *  width breakpoint, since a phone on its side is tablet-wide. */
  phone: PhoneShape;
  /** A short or tall window (useScreenHeight): the splits open, and save,
   *  on their own sizes. */
  height?: ScreenHeight;
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  /** The debug column's tab strip; the phone layout reaches the same views
   *  through `panes`, so both arrive already rendered. */
  rightTabs: ReactNode;
  /** The stack tab is showing the frames, which open the debug column on
   *  their own split. */
  framesOpen?: boolean;
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
/** No box of its own: what a host holds lays out as it would in the slot's
 *  parent. */
export const PASS_THROUGH = "contents";

// The control that had the focus when its host left a slot, for the slot that
// takes the host next, in the same commit.
const focusLeft = new WeakMap<HTMLElement, HTMLElement>();

/**
 * Where a host node is attached in whichever arrangement is on screen. Taking
 * the node out of the page drops its focus on the body, so the slot that takes
 * it next gives the focus back: React runs the old slot's cleanup before the
 * new slot's effect in one commit.
 */
export function HostSlot({ host, className = FILL }: { host: HTMLElement; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    slot.appendChild(host);
    const focused = focusLeft.get(host);
    if (focused?.isConnected && document.activeElement === document.body) {
      focused.focus({ preventScroll: true });
    }
    return () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && host.contains(active)) {
        focusLeft.set(host, active);
        queueMicrotask(() => focusLeft.delete(host));
      }
      if (host.parentNode === slot) slot.removeChild(host);
    };
  }, [host]);
  return <div ref={ref} className={className} />;
}

/** A node of its own, made once, for content that renders there and is
 *  attached by a HostSlot; null on the server. */
export function useHostNode(className = FILL): HTMLElement | null {
  const [host] = useState(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    node.className = className;
    return node;
  });
  return host;
}

/**
 * Picks the full playground's arrangement for the screen size. The editor,
 * the disassembly, the registers and the debug column's tabs each render once
 * into a node of their own that each arrangement attaches, so a resize across
 * a breakpoint moves them without a remount: the caret, the undo history, the
 * focused control and a terminal session survive. The phone layout places its
 * own copies of all but the editor, so crossing into it still remounts them.
 */
export function FullLayout({
  breakpoint,
  phone,
  height = "regular",
  editor,
  disassembly,
  registers,
  rightTabs,
  framesOpen = false,
  panes,
  controls,
  consoleBlocked,
  consoleUnread = false,
  runStatus,
  paneRequest,
  onPaneShown,
}: FullLayoutProps) {
  const editorHost = useHostNode();
  const disasmHost = useHostNode(PASS_THROUGH);
  const regsHost = useHostNode(PASS_THROUGH);
  const tabsHost = useHostNode(PASS_THROUGH);
  const place = (host: HTMLElement | null, node: ReactNode, className?: string) =>
    host ? <HostSlot host={host} className={className} /> : node;
  const placed = place(editorHost, editor);
  const placedDisasm = place(disasmHost, disassembly, PASS_THROUGH);
  const placedRegs = place(regsHost, registers, PASS_THROUGH);
  const placedTabs = place(tabsHost, rightTabs, PASS_THROUGH);
  const showResizable = isAtLeast(breakpoint, "lg");

  return (
    <>
      {phone ? (
        // A labeled section, not a main: the playground component is
        // composed inside the landing hero, lessons, exercises, and the
        // reference, all of which already sit inside their page's main. The
        // /playground route supplies the one main around it.
        <section aria-label="AArch64 Playground" className="flex-1 min-h-0 flex flex-col">
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
          <section aria-label="AArch64 Playground" className="flex-1 min-h-0 flex flex-col">
            {showResizable ? (
              <ResizableLayout
                breakpoint={breakpoint}
                height={height}
                editor={placed}
                disassembly={placedDisasm}
                registers={placedRegs}
                rightTabs={placedTabs}
                framesOpen={framesOpen}
              />
            ) : (
              <div className="flex flex-row h-full">
                <div className="w-1/2 min-h-0 border-r border-[var(--border)]">
                  <PaneSplit
                    orientation="vertical"
                    spec={EDITOR_SPLIT}
                    storageKey={`${breakpoint}-left`}
                    height={height}
                    first={placed}
                    second={placedDisasm}
                  />
                </div>
                <div className="w-1/2 min-h-0">
                  <PaneSplit
                    orientation="vertical"
                    spec={framesOpen ? FRAMES_SPLIT : DEBUG_SPLIT}
                    storageKey={`${breakpoint}-${framesOpen ? "frames" : "right"}`}
                    height={height}
                    first={placedRegs}
                    second={placedTabs}
                  />
                </div>
              </div>
            )}
          </section>
          {controls}
        </>
      )}
      {editorHost && createPortal(editor, editorHost)}
      {/* Only where a slot places them: the phone layout mounts its own, and
          a pane kept mounted out of sight would speak unseen. */}
      {!phone && disasmHost && createPortal(disassembly, disasmHost)}
      {!phone && regsHost && createPortal(registers, regsHost)}
      {!phone && tabsHost && createPortal(rightTabs, tabsHost)}
    </>
  );
}
