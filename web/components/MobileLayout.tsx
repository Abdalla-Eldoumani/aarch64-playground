"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type Tab =
  | "editor"
  | "disasm"
  | "regs"
  | "memory"
  | "stack"
  | "console"
  | "watches"
  | "memwatch"
  | "saves";

export interface MobileLayoutProps {
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  memory: ReactNode;
  stack: ReactNode;
  console: ReactNode;
  watches: ReactNode;
  memwatch: ReactNode;
  saves: ReactNode;
  consoleBlocked?: boolean;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "editor", label: "code" },
  { id: "disasm", label: "disasm" },
  { id: "regs", label: "regs" },
  { id: "memory", label: "mem" },
  { id: "stack", label: "stack" },
  { id: "console", label: "i/o" },
  { id: "watches", label: "watches" },
  { id: "memwatch", label: "memwatch" },
  { id: "saves", label: "saves" },
];

/**
 * Single-column stacked layout for phones (< md). One active pane at a
 * time, selected from a sticky bottom tab strip so the touch target
 * stays above the safe area. Strip scrolls horizontally when nine tabs
 * exceed viewport width; the active tab scrolls itself into view.
 */
export function MobileLayout({
  editor,
  disassembly,
  registers,
  memory,
  stack,
  console,
  watches,
  memwatch,
  saves,
  consoleBlocked,
}: MobileLayoutProps) {
  const [active, setActive] = useState<Tab>("editor");
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = stripRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (typeof node?.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [active]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        {active === "editor" && <div className="h-full flex flex-col">{editor}</div>}
        {active === "disasm" && <div className="h-full overflow-auto">{disassembly}</div>}
        {active === "regs" && <div className="h-full overflow-auto">{registers}</div>}
        {active === "memory" && <div className="h-full overflow-auto">{memory}</div>}
        {active === "stack" && <div className="h-full overflow-auto">{stack}</div>}
        {active === "console" && <div className="h-full flex flex-col">{console}</div>}
        {active === "watches" && <div className="h-full overflow-auto">{watches}</div>}
        {active === "memwatch" && <div className="h-full overflow-auto">{memwatch}</div>}
        {active === "saves" && <div className="h-full overflow-auto">{saves}</div>}
      </div>
      <div
        ref={stripRef}
        role="tablist"
        aria-label="view switcher"
        className="flex border-t border-[var(--border)] bg-[var(--bg-secondary)] overflow-x-auto"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        {TABS.map((t) => {
          const selected = active === t.id;
          const showDot = t.id === "console" && consoleBlocked && !selected;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.id)}
              className={`relative shrink-0 min-w-[3.5rem] h-11 px-3 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                selected
                  ? "text-[var(--accent)] border-t-2 border-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
              {showDot && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
