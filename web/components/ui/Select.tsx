"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectGroup {
  /** Optional group header, rendered in the datasheet label voice. */
  label?: string;
  options: SelectOption[];
}

export interface SelectProps {
  /** Trigger text when no `value` is selected (action selects stay here). */
  placeholder: string;
  /**
   * Overrides the collapsed trigger's text. For action selects whose trigger
   * should report live state rather than a past choice (the memory panel's
   * jump list names the region the window is in). The accessible name stays
   * `ariaLabel` and the open listbox is unaffected.
   */
  triggerLabel?: string;
  /** Controlled selected value; empty/undefined renders the placeholder. */
  value?: string;
  groups: SelectGroup[];
  onSelect: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  size?: "sm" | "xs";
  className?: string;
}

interface Placement {
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxHeight: number;
}

// Viewport margin the list keeps, and the least room worth opening into
// before it flips above the trigger.
const EDGE = 8;
const MIN_ROOM = 200;

// On a touch screen the fixed coordinates give way to a full-width sheet at
// the bottom; `!` so the sheet wins over the inline placement.
const SHEET =
  "[@media(pointer:coarse)]:!inset-x-0 [@media(pointer:coarse)]:!top-auto [@media(pointer:coarse)]:!bottom-0 [@media(pointer:coarse)]:!max-h-[70dvh] [@media(pointer:coarse)]:rounded-b-none [@media(pointer:coarse)]:border-x-0 [@media(pointer:coarse)]:border-b-0 [@media(pointer:coarse)]:pb-[calc(0.5rem+var(--safe-bottom))]";

/**
 * Custom select: a collapsed-listbox replacement for the native `<select>`,
 * so the popover chrome, group headers, and option rows draw from the design
 * tokens in every theme instead of the platform default. Keyboard behavior
 * follows the WAI-ARIA collapsed listbox pattern: focus stays on the trigger,
 * ArrowUp/Down move the active option (aria-activedescendant), Home/End jump,
 * Enter or Space selects, Escape closes, and printable characters type-ahead
 * to the next matching option. Outside pointer-down closes without selecting.
 *
 * The open list is portaled to the body and placed against the trigger with
 * fixed coordinates, so no scrolling or clipping ancestor (the playground's
 * header band, a short panel) can cut it off; it opens upward when the room
 * below is short. On a touch screen it is a bottom sheet over a backdrop
 * instead, with rows a finger can hit.
 */
export function Select({
  placeholder,
  triggerLabel,
  value,
  groups,
  onSelect,
  ariaLabel,
  disabled = false,
  size = "sm",
  className = "",
}: SelectProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef<{ buffer: string; at: number }>({ buffer: "", at: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const flat = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const selected = flat.find((option) => option.value === value);

  const optionId = useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId],
  );

  const openList = useCallback(() => {
    if (disabled || flat.length === 0) return;
    const start = Math.max(
      0,
      flat.findIndex((option) => option.value === value),
    );
    setActiveIndex(start);
    setOpen(true);
  }, [disabled, flat, value]);

  const close = useCallback(() => setOpen(false), []);

  const commit = useCallback(
    (index: number) => {
      const option = flat[index];
      if (!option) return;
      setOpen(false);
      onSelect(option.value);
    },
    [flat, onSelect],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  // Place the list against the trigger: below it, or above it when the room
  // below is short and the room above is larger, and shifted left so it never
  // runs off the right edge. Re-placed on any scroll or resize while open,
  // since fixed coordinates do not follow the trigger by themselves.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - EDGE;
    const above = rect.top - EDGE;
    const up = below < MIN_ROOM && above > below;
    const width = Math.max(rect.width, listRef.current?.offsetWidth ?? 0);
    setPlacement({
      top: up ? undefined : rect.bottom + 4,
      bottom: up ? window.innerHeight - rect.top + 4 : undefined,
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - EDGE - width)),
      minWidth: rect.width,
      maxHeight: Math.max(120, Math.min(up ? above : below, 512, window.innerHeight * 0.7)),
    });
  }, []);
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Keep the active option scrolled into view while navigating.
  useEffect(() => {
    if (!open) return;
    // Optional call: jsdom has no scrollIntoView.
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, optionId]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      const { key } = event;
      if (!open) {
        if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
          event.preventDefault();
          openList();
        }
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        close();
      } else if (key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, flat.length - 1));
      } else if (key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (key === "End") {
        event.preventDefault();
        setActiveIndex(flat.length - 1);
      } else if (key === "Enter" || key === " ") {
        event.preventDefault();
        commit(activeIndex);
      } else if (key === "Tab") {
        close();
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Type-ahead: accumulate briefly, search from the row after the
        // active one so repeats cycle through same-prefix options.
        const now = Date.now();
        const state = typeahead.current;
        // 500ms is the WAI-ARIA type-ahead window: after it, the buffer restarts.
        state.buffer = now - state.at > 500 ? key : state.buffer + key;
        state.at = now;
        const query = state.buffer.toLowerCase();
        const total = flat.length;
        for (let step = 1; step <= total; step++) {
          const index = (activeIndex + step) % total;
          if (flat[index].label.toLowerCase().startsWith(query)) {
            setActiveIndex(index);
            break;
          }
        }
      }
    },
    [disabled, open, openList, close, flat, commit, activeIndex],
  );

  const sizing =
    size === "xs"
      ? "px-2 py-0.5 text-[10px] min-h-[24px] [@media(pointer:coarse)]:text-xs"
      : "px-2 py-1 text-xs min-h-[28px]";

  // Each group's starting flat index, so option ids stay continuous across
  // group boundaries without mutating anything during render.
  const groupOffsets = useMemo(() => {
    const offsets: number[] = [];
    let total = 0;
    for (const group of groups) {
      offsets.push(total);
      total += group.options.length;
    }
    return offsets;
  }, [groups]);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-listbox` : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
        className={`inline-flex w-full max-w-[14rem] items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] font-mono text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] focus:outline-none focus-visible:[box-shadow:var(--ring)] disabled:pointer-events-none disabled:opacity-50 [@media(pointer:coarse)]:min-h-[44px] ${sizing}`}
      >
        <span className="truncate">
          {triggerLabel ?? (selected ? selected.label : placeholder)}
        </span>
        {/* Two 1px strokes forming a caret. */}
        <span
          aria-hidden="true"
          className="inline-block flex-shrink-0 rotate-45 border-[var(--text-tertiary)]"
          style={{
            width: 7,
            height: 7,
            borderWidth: "0 1px 1px 0",
            marginTop: -3,
          }}
        />
      </button>
      {open
        ? createPortal(
            <>
              {/* On a touch screen the sheet sits over a backdrop, so a tap
                  anywhere else closes it the way an outside click does. */}
              <div
                aria-hidden="true"
                className="fixed inset-0 z-50 hidden bg-black/50 [@media(pointer:coarse)]:block"
              />
              <div
                ref={listRef}
                id={`${baseId}-listbox`}
                role="listbox"
                aria-label={ariaLabel}
                className={`anim-modal-rise fixed z-50 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] py-1 [box-shadow:var(--shadow-overlay)] ${SHEET}`}
                style={
                  placement
                    ? {
                        top: placement.top,
                        bottom: placement.bottom,
                        left: placement.left,
                        minWidth: placement.minWidth,
                        maxHeight: placement.maxHeight,
                      }
                    : // Measured before it is shown, so it never flashes at 0,0.
                      { top: 0, left: 0, visibility: "hidden" }
                }
              >
                {groups.map((group, groupIndex) => (
                  <div key={group.label ?? groupIndex}>
                    {group.label ? (
                      <div className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] [@media(pointer:coarse)]:text-[12px]">
                        {group.label}
                      </div>
                    ) : null}
                    {group.options.map((option, optionIndex) => {
                      const index = groupOffsets[groupIndex] + optionIndex;
                      const active = index === activeIndex;
                      return (
                        <div
                          key={option.value || `${index}`}
                          id={optionId(index)}
                          role="option"
                          aria-selected={option.value === value}
                          onPointerDown={(event) => {
                            // Focus stays on the trigger. A mouse selects here, so
                            // the outside-close handler never races the click; a
                            // finger waits for the click below, because a touch
                            // that starts a scroll of the sheet must not pick the
                            // row it started on.
                            event.preventDefault();
                            if (event.pointerType === "touch" || event.pointerType === "pen") return;
                            commit(index);
                          }}
                          onClick={() => commit(index)}
                          onMouseMove={() => setActiveIndex(index)}
                          className={`flex min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] cursor-pointer items-center whitespace-nowrap px-3 font-mono text-xs ${
                            active
                              ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {option.label}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
