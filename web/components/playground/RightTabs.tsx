"use client";

import type { ReactNode } from "react";
import { useState } from "react";

/** The right-hand tab strip's panes, in the order the strip renders them. */
export type RightTab =
  | "memory"
  | "stack"
  | "console"
  | "term"
  | "watches"
  | "convert"
  | "memwatch"
  | "saves";

/**
 * The eight machine views the debug column switches between. They arrive as
 * rendered nodes rather than as hub fields: the shell owns the single
 * `useEmulator()` hub and builds every panel from it, so no part of the hub
 * has to cross into the layout components that only arrange them.
 */
export interface DebugPanes {
  memory: ReactNode;
  stack: ReactNode;
  console: ReactNode;
  terminal: ReactNode;
  watches: ReactNode;
  converter: ReactNode;
  memwatch: ReactNode;
  saves: ReactNode;
}

export interface RightTabsProps {
  activeTab: RightTab;
  onSelectTab: (tab: RightTab) => void;
  /** Marks the console tab while the machine waits on a stdin read. */
  consoleBlocked: boolean;
  panes: DebugPanes;
}

const TABS: readonly RightTab[] = [
  "memory",
  "stack",
  "console",
  "term",
  "watches",
  "convert",
  "memwatch",
  "saves",
];

/**
 * The debug column's tab strip (tablet and laptop layouts; the phone layout
 * reaches the same panes through MobileLayout's group switcher). The selected
 * tab is the shell's state so a command-palette action can bring a pane
 * forward, but which panes have ever been MOUNTED is this component's own
 * business -- see the terminal latch below.
 */
export function RightTabs({
  activeTab,
  onSelectTab,
  consoleBlocked,
  panes,
}: RightTabsProps) {
  // The terminal mounts lazily on first use and then stays mounted (it hides
  // with CSS in the panel below): a live session must survive tab switches.
  // A latch adjusted during render, not in an effect: the flip only ever
  // happens on the render that selects the tab, so the pane mounts in that
  // same commit rather than one paint later.
  const [termOpened, setTermOpened] = useState(false);
  if (activeTab === "term" && !termOpened) setTermOpened(true);

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex flex-wrap border-b border-[var(--border)] bg-[var(--bg-sunken)] overflow-x-auto"
        role="tablist"
        aria-label="debug view"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab;
          const showDot = tab === "console" && consoleBlocked && !selected;
          return (
            <button
              key={tab}
              id={`right-tab-${tab}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`right-panel-${tab}`}
              className={`relative min-h-[2.25rem] px-4 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
                selected
                  ? "text-[var(--cyan)] border-b border-[var(--cyan)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => onSelectTab(tab)}
            >
              {tab}
              {showDot && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--cyan)]"
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        className="flex-1 min-h-0 overflow-hidden"
        role="tabpanel"
        id={`right-panel-${activeTab}`}
        aria-labelledby={`right-tab-${activeTab}`}
      >
        {activeTab === "memory" && (
          <div className="h-full overflow-auto">{panes.memory}</div>
        )}
        {activeTab === "stack" && (
          <div className="h-full overflow-auto">{panes.stack}</div>
        )}
        {activeTab === "console" && (
          <div className="h-full flex flex-col">{panes.console}</div>
        )}
        {/* The terminal stays MOUNTED once opened and hides with CSS.
            Unmounting it disposed xterm and dropped the io registration,
            so switching to another tab mid-session killed a running
            program's screen and its input -- the student had to re-run
            it. `hidden` keeps the DOM node (and the session) alive. */}
        {termOpened && (
          <div className={activeTab === "term" ? "h-full" : "hidden"}>
            {panes.terminal}
          </div>
        )}
        {activeTab === "watches" && (
          <div className="h-full overflow-auto">{panes.watches}</div>
        )}
        {activeTab === "convert" && (
          <div className="h-full overflow-auto">{panes.converter}</div>
        )}
        {activeTab === "memwatch" && (
          <div className="h-full overflow-auto">{panes.memwatch}</div>
        )}
        {activeTab === "saves" && (
          <div className="h-full overflow-auto">{panes.saves}</div>
        )}
      </div>
    </div>
  );
}
