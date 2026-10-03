"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useTheme, type Theme } from "@/lib/hooks/use-theme";
import { THEMES } from "@/lib/theme/themes";

// The server cannot see the stored or OS theme, so its HTML checks no swatch
// and names no theme rather than a guess that the page's own colours may
// contradict until hydration.
function subscribe(): () => void {
  return () => {};
}
function hydratedOnClient(): boolean {
  return true;
}
function hydratedOnServer(): boolean {
  return false;
}

// A theme's page, machine and interaction colours. Without `themeId` it paints
// the page's own theme, which the pre-paint script set before hydration.
function Swatch({ themeId }: { themeId?: string }) {
  return (
    // The edge is the page's own ink, so a swatch close to the page colour
    // still shows.
    <span aria-hidden="true" className="flex rounded-[2px] border border-[var(--text-tertiary)]">
      <span data-theme={themeId} className="flex h-3.5 w-3.5 items-end gap-px bg-[var(--bg-base)] p-0.5">
        <span className="h-1.5 w-1 bg-[var(--amber)]" />
        <span className="h-1 w-1 bg-[var(--cyan)]" />
      </span>
    </span>
  );
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * The six themes as one radiogroup (WAI-ARIA radio pattern: one tab stop,
 * arrows move and choose, wrapping; Home and End jump to the ends). The frame
 * on the checked swatch is a shape, not only a colour, and slides to the new
 * one. The cells sit flush so the frame moves in whole cell widths at any
 * cell size, the 44px touch minimum included.
 */
function ThemeRadios({
  theme,
  setTheme,
  hydrated,
  cell,
  className,
  id,
  open,
}: {
  theme: Theme;
  setTheme: (next: Theme) => void;
  hydrated: boolean;
  cell: string;
  className: string;
  id?: string;
  /** Set only for the site bar's row, which opens and closes. */
  open?: boolean;
}) {
  const stagger = open !== undefined;
  const at = THEMES.findIndex((t) => t.id === theme);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = THEMES.length - 1;
    const next =
      e.key in STEP
        ? (at + STEP[e.key] + THEMES.length) % THEMES.length
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? last
            : -1;
    if (next < 0) return;
    e.preventDefault();
    setTheme(THEMES[next].id);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="theme"
      data-open={open}
      // Closed, the row is out of the tab order and the accessibility tree
      // while its fade finishes.
      inert={open === false}
      onKeyDown={onKeyDown}
      className={`relative flex p-1 ${className}`}
    >
      {THEMES.map(({ id: themeId, name }, index) => {
        const checked = hydrated && themeId === theme;
        return (
          <button
            key={themeId}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={name}
            title={name}
            // Before hydration nothing is checked, so the first swatch holds
            // the group's one tab stop.
            tabIndex={checked || (!hydrated && index === 0) ? 0 : -1}
            onClick={() => setTheme(themeId)}
            // Swatches arrive from the button outward, the nearest first.
            style={stagger ? ({ "--i": THEMES.length - 1 - index } as CSSProperties) : undefined}
            className={`theme-swatch ${cell} inline-flex shrink-0 items-center justify-center transition-colors hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10`}
          >
            <Swatch themeId={themeId} />
          </button>
        );
      })}
      {hydrated ? (
        <span
          aria-hidden="true"
          className={`theme-marker ${cell} pointer-events-none absolute left-1 top-1 border-2 border-[var(--cyan)]`}
          style={{ transform: `translateX(${at * 100}%)` }}
        />
      ) : null}
    </div>
  );
}

/**
 * Drives the shared useTheme hook, so there is no second theme store.
 * `comfortable` (the phone menus) shows the six 44px swatches in a row.
 * `compact` (the site bar) is one button showing the page's theme that opens
 * the same row sideways, over the nav links, so nothing in the bar moves.
 * Choosing keeps the row open, so a reader can try several.
 */
export function ThemeControl({
  size = "compact",
  className = "",
}: {
  size?: "compact" | "comfortable";
  className?: string;
}) {
  const [theme, , setTheme] = useTheme();
  const hydrated = useSyncExternalStore(subscribe, hydratedOnClient, hydratedOnServer);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const stripId = useId();

  // Opening hands focus to the checked swatch, so arrows work at once; a
  // press anywhere else closes the row.
  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (size === "comfortable") {
    return (
      <ThemeRadios
        theme={theme}
        setTheme={setTheme}
        hydrated={hydrated}
        cell="h-11 w-11"
        className={`w-fit border border-[var(--border)] ${className}`}
      />
    );
  }

  const name = THEMES.find((t) => t.id === theme)?.name;
  return (
    <div
      ref={rootRef}
      className={`relative inline-flex ${className}`}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        setOpen(false);
        buttonRef.current?.focus();
      }}
      // Tab past either end closes the row. A null target is a press, which
      // the pointer listener handles; Safari does not focus a pressed button.
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null;
        if (open && to && !rootRef.current?.contains(to)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={stripId}
        aria-label={hydrated ? `theme: ${name}` : "theme"}
        title={hydrated ? `theme: ${name}` : "theme"}
        onClick={() => setOpen((o) => !o)}
        className="touch-target inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] transition-colors hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        <Swatch />
      </button>
      {/* The wrapper only centres the row on the button; it takes no presses,
          so the closed row never blocks the links under it. */}
      <div className="pointer-events-none absolute inset-y-0 right-full z-10 mr-1 flex items-center">
        <ThemeRadios
          id={stripId}
          theme={theme}
          setTheme={setTheme}
          hydrated={hydrated}
          cell="touch-target h-9 w-9"
          open={open}
          className="theme-strip pointer-events-auto border border-[var(--border-strong)] bg-[var(--bg-raised)] [box-shadow:var(--shadow-overlay)]"
        />
      </div>
    </div>
  );
}
