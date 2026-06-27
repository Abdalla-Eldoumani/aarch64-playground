"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type GroupId = "view" | "state" | "inspect" | "tools" | "save";

export interface MobileLayoutProps {
  editor: ReactNode;
  disassembly: ReactNode;
  registers: ReactNode;
  memory: ReactNode;
  stack: ReactNode;
  console: ReactNode;
  terminal: ReactNode;
  watches: ReactNode;
  memwatch: ReactNode;
  saves: ReactNode;
  consoleBlocked?: boolean;
}

interface Member {
  id: string;
  label: string;
  node: ReactNode;
  /** Per-pane wrapper: editor and console flex-column, the rest scroll. */
  className: string;
}

interface Group {
  id: GroupId;
  label: string;
  members: Member[];
}

/**
 * Single-pane phone layout (< md). The ten panes are condensed into five
 * use-case groups in a sticky bottom strip; a group with more than one
 * member exposes an in-pane sub-switch so every pane stays reachable. The
 * five 44px targets share the width (no fixed min-width), so the strip fits
 * a 375px screen without horizontal scroll and sits above the safe area.
 * The selected group and pane read --cyan (interaction).
 */
export function MobileLayout({
  editor,
  disassembly,
  registers,
  memory,
  stack,
  console,
  terminal,
  watches,
  memwatch,
  saves,
  consoleBlocked,
}: MobileLayoutProps) {
  const groups: Group[] = [
    {
      id: "view",
      label: "view",
      members: [
        { id: "code", label: "code", node: editor, className: "h-full flex flex-col" },
        { id: "disasm", label: "disasm", node: disassembly, className: "h-full overflow-auto" },
      ],
    },
    {
      id: "state",
      label: "state",
      members: [
        { id: "regs", label: "registers", node: registers, className: "h-full overflow-auto" },
      ],
    },
    {
      id: "inspect",
      label: "inspect",
      members: [
        { id: "memory", label: "memory", node: memory, className: "h-full overflow-auto" },
        { id: "stack", label: "stack", node: stack, className: "h-full overflow-auto" },
        { id: "console", label: "console", node: console, className: "h-full flex flex-col" },
      ],
    },
    {
      id: "tools",
      label: "tools",
      members: [
        { id: "term", label: "terminal", node: terminal, className: "h-full" },
        { id: "watches", label: "watches", node: watches, className: "h-full overflow-auto" },
      ],
    },
    {
      id: "save",
      label: "save",
      members: [
        { id: "memwatch", label: "memwatch", node: memwatch, className: "h-full overflow-auto" },
        { id: "saves", label: "saves", node: saves, className: "h-full overflow-auto" },
      ],
    },
  ];

  const [activeGroup, setActiveGroup] = useState<GroupId>("view");
  const [memberByGroup, setMemberByGroup] = useState<Record<GroupId, string>>({
    view: "code",
    state: "regs",
    inspect: "memory",
    tools: "term",
    save: "memwatch",
  });
  const stripRef = useRef<HTMLDivElement>(null);

  const group = groups.find((g) => g.id === activeGroup) ?? groups[0];
  const member =
    group.members.find((m) => m.id === memberByGroup[group.id]) ?? group.members[0];
  // The blocked dot clears only once the console pane is actually on screen.
  const consoleHidden = !(group.id === "inspect" && member.id === "console");

  useEffect(() => {
    const node = stripRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (typeof node?.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeGroup]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {group.members.length > 1 && (
        <div
          role="tablist"
          aria-label={`${group.label} panes`}
          className="flex shrink-0 border-b border-[var(--border)] bg-[var(--bg-sunken)]"
        >
          {group.members.map((m) => {
            const selected = m.id === member.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() =>
                  setMemberByGroup((prev) => ({ ...prev, [group.id]: m.id }))
                }
                className={`min-h-[2.25rem] px-3 font-sans text-[11px] font-medium tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
                  selected
                    ? "text-[var(--cyan)] border-b border-[var(--cyan)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        key={`${group.id}:${member.id}`}
        className="flex-1 min-h-0 overflow-hidden anim-tab-fade"
      >
        <div className={member.className}>{member.node}</div>
      </div>

      <div
        ref={stripRef}
        role="tablist"
        aria-label="view switcher"
        className="flex border-t border-[var(--border)] bg-[var(--bg-sunken)]"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        {groups.map((g) => {
          const selected = g.id === activeGroup;
          const showDot = g.id === "inspect" && Boolean(consoleBlocked) && consoleHidden;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveGroup(g.id)}
              className={`relative flex-1 min-w-0 h-11 px-1 text-center overflow-hidden whitespace-nowrap font-sans text-[11px] font-medium tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
                selected
                  ? "text-[var(--cyan)] border-t-2 border-[var(--cyan)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {g.label}
              {showDot && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-[var(--cyan)]"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
