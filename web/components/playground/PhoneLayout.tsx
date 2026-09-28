"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Select";
import { RunStatus, type RunStatusProps } from "@/components/playground/RunStatus";
import type { DebugPanes } from "@/components/playground/RightTabs";

type Tab = "code" | "regs" | "console" | "more";

/** The views behind "more", in the order the chooser lists them. */
const MORE = [
  { id: "memory", label: "memory" },
  { id: "stack", label: "stack" },
  { id: "disasm", label: "disassembly" },
  { id: "term", label: "terminal" },
  { id: "watches", label: "watches" },
  { id: "convert", label: "converter" },
  { id: "memwatch", label: "memory watches" },
  { id: "saves", label: "saves" },
] as const;
type MoreId = (typeof MORE)[number]["id"];

function isMore(pane: string): pane is MoreId {
  return MORE.some((m) => m.id === pane);
}

export interface PhoneLayoutProps {
  shape: "portrait" | "landscape";
  /** The editor, already placed: it stays mounted through every tab switch
   *  and rotation, so its caret, scroll, and undo history survive. */
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  panes: DebugPanes;
  controls: ReactNode;
  /** Everything the status line reports; the layout decides when the
   *  register peek shows and where tapping it goes. */
  runStatus: Omit<RunStatusProps, "showPeek" | "onOpenRegisters">;
  consoleBlocked: boolean;
  consoleUnread: boolean;
  /** One-shot pane jump from the host (a run that finished, a read that
   *  blocked, a palette action): a new nonce brings the named pane forward. */
  paneRequest?: { pane: string; nonce: number };
  /** Told which view is on screen, so the host can mark what was seen. */
  onPaneShown?: (pane: string) => void;
}

const TAB_BUTTON =
  "relative flex-1 min-w-0 h-11 px-1 font-sans text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cyan)]";

/**
 * Upright and on its side are one element tree placed by the grid, so turning
 * the phone never remounts the editor. On its side the controls and tabs share
 * a row, because a landscape phone has well under 400px of height to give.
 */
export function PhoneLayout({
  shape,
  editor,
  disassembly,
  registers,
  panes,
  controls,
  runStatus,
  consoleBlocked,
  consoleUnread,
  paneRequest,
  onPaneShown,
}: PhoneLayoutProps) {
  const [tab, setTab] = useState<Tab>("code");
  const [more, setMore] = useState<MoreId>("memory");
  // A request is applied once, during the render that sees its nonce; one
  // that arrived before this layout mounted (a desktop palette action before
  // the window was narrowed) is not replayed.
  const [seenNonce, setSeenNonce] = useState(paneRequest?.nonce ?? null);
  if (paneRequest && paneRequest.nonce !== seenNonce) {
    setSeenNonce(paneRequest.nonce);
    const pane = paneRequest.pane;
    if (pane === "code" || pane === "regs" || pane === "console") setTab(pane);
    else if (isMore(pane)) {
      setTab("more");
      setMore(pane);
    }
  }
  const landscape = shape === "landscape";
  // On its side the code is always on screen, so the view beside it falls
  // back to the registers while "code" is the chosen tab.
  const side: Tab = landscape && tab === "code" ? "regs" : tab;
  // The terminal stays mounted once opened and hides with CSS: unmounting it
  // disposes xterm and ends a running program's session.
  const [termOpened, setTermOpened] = useState(false);
  if (side === "more" && more === "term" && !termOpened) setTermOpened(true);

  const shown = side === "more" ? more : side;
  useEffect(() => {
    onPaneShown?.(shown);
  }, [shown, onPaneShown]);

  const consoleDot =
    side === "console" ? null : consoleBlocked ? "waiting for input" : consoleUnread ? "new output" : null;
  const tabs: { id: Tab; label: string }[] = [
    ...(landscape ? [] : [{ id: "code" as const, label: "code" }]),
    { id: "regs", label: "registers" },
    { id: "console", label: "console" },
    { id: "more", label: "more" },
  ];

  const grid = landscape
    ? "grid-cols-[minmax(0,11fr)_minmax(0,9fr)] grid-rows-[auto_minmax(0,1fr)_auto]"
    : "grid-cols-1 grid-rows-[minmax(0,1fr)_auto_auto_auto]";
  const place = landscape
    ? {
        editor: "row-start-1 row-span-2 col-start-1 border-r border-[var(--border)]",
        status: "row-start-1 col-start-2",
        side: "row-start-2 col-start-2",
        controls: "row-start-3 col-start-1 border-r border-[var(--border)] pb-[var(--safe-bottom)]",
        tabs: "row-start-3 col-start-2 pb-[var(--safe-bottom)]",
      }
    : {
        editor: `row-start-1 col-start-1${side === "code" ? "" : " invisible"}`,
        status: "row-start-2 col-start-1",
        side: `row-start-1 col-start-1${side === "code" ? " hidden" : ""}`,
        controls: "row-start-3 col-start-1",
        tabs: "row-start-4 col-start-1 pb-[var(--safe-bottom)]",
      };

  return (
    <div className={`grid flex-1 min-h-0 ${grid}`}>
      <div className={`${place.editor} flex min-h-0 min-w-0 flex-col`}>{editor}</div>

      <div className={`${place.status} min-w-0`}>
        <RunStatus
          {...runStatus}
          showPeek={side !== "regs"}
          onOpenRegisters={() => setTab("regs")}
        />
      </div>

      <div
        id="phone-panel"
        role="tabpanel"
        aria-labelledby={`phone-tab-${side === "code" ? "code" : side}`}
        className={`${place.side} flex min-h-0 min-w-0 flex-col bg-[var(--bg-base)]`}
      >
        {side === "regs" && <div className="h-full min-h-0 overflow-auto">{registers}</div>}
        {side === "console" && <div className="flex h-full min-h-0 flex-col">{panes.console}</div>}
        {side === "more" && (
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-2 py-1">
            <Select
              placeholder="view"
              ariaLabel="choose a view"
              value={more}
              groups={[{ options: MORE.map((m) => ({ value: m.id, label: m.label })) }]}
              onSelect={(next) => isMore(next) && setMore(next)}
              className="w-full max-w-[16rem]"
            />
          </div>
        )}
        {side === "more" && more === "memory" && <div className="min-h-0 flex-1 overflow-auto">{panes.memory}</div>}
        {side === "more" && more === "stack" && <div className="min-h-0 flex-1 overflow-auto">{panes.stack}</div>}
        {side === "more" && more === "disasm" && <div className="min-h-0 flex-1 overflow-auto">{disassembly}</div>}
        {termOpened && (
          <div className={side === "more" && more === "term" ? "min-h-0 flex-1" : "hidden"}>{panes.terminal}</div>
        )}
        {side === "more" && more === "watches" && <div className="min-h-0 flex-1 overflow-auto">{panes.watches}</div>}
        {side === "more" && more === "convert" && <div className="min-h-0 flex-1 overflow-auto">{panes.converter}</div>}
        {side === "more" && more === "memwatch" && <div className="min-h-0 flex-1 overflow-auto">{panes.memwatch}</div>}
        {side === "more" && more === "saves" && <div className="min-h-0 flex-1 overflow-auto">{panes.saves}</div>}
      </div>

      <div className={`${place.controls} min-w-0`}>{controls}</div>

      <div
        role="tablist"
        aria-label="playground view"
        className={`${place.tabs} flex border-t border-[var(--border)] bg-[var(--bg-sunken)]`}
      >
        {tabs.map((t) => {
          const selected = side === t.id;
          const dot = t.id === "console" ? consoleDot : null;
          return (
            <button
              key={t.id}
              id={`phone-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="phone-panel"
              onClick={() => setTab(t.id)}
              className={`${TAB_BUTTON} ${
                selected
                  ? "text-[var(--cyan)] [box-shadow:inset_0_2px_0_0_var(--cyan)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
              {dot && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--cyan)]"
                  />
                  <span className="sr-only">, {dot}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
