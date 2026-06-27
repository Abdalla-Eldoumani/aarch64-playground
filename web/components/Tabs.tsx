"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  /** Stable identifier; also the value passed to `onChange` and the ARIA wiring. */
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  /** The `value` of the currently selected tab. */
  active: string;
  onChange: (value: string) => void;
  /** Accessible name for the tablist. */
  label: string;
  /** Panel content for the active tab, rendered inside `role="tabpanel"`. */
  children?: ReactNode;
  className?: string;
}

/**
 * The base tab strip every screen draws from. Owns the full WAI-ARIA tabs
 * structure (tablist / tab / tabpanel): the selected tab is marked with the cyan
 * token (the active-route indicator), carries a roving tabindex, and the arrow
 * keys move selection so the keyboard reaches every tab. Each tab is 44px tall.
 */
export function Tabs({
  items,
  active,
  onChange,
  label,
  children,
  className = "",
}: TabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(value: string) {
    onChange(value);
    tabRefs.current[value]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.value === active);
    if (index < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = (index + delta + items.length) % items.length;
      select(items[next].value);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(items[0].value);
    } else if (event.key === "End") {
      event.preventDefault();
      select(items[items.length - 1].value);
    }
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex" onKeyDown={onKeyDown}>
        {items.map((item) => {
          const selected = item.value === active;
          return (
            <button
              key={item.value}
              ref={(node) => {
                tabRefs.current[item.value] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${item.value}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              className={`relative shrink-0 min-h-[44px] px-4 font-sans text-[14px] font-medium transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                selected
                  ? "text-[var(--cyan)] border-b-2 border-[var(--cyan)]"
                  : "text-[var(--text-secondary)] border-b-2 border-transparent hover:text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
        className="focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        {children}
      </div>
    </div>
  );
}
