"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/lib/hooks/use-theme";
import { THEMES } from "@/lib/theme/themes";

// The server cannot see the stored or OS theme, so its HTML presses no option
// rather than a guess that the page's own colours may contradict until
// hydration.
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

/**
 * Drives the shared useTheme hook, so there is no second theme store.
 * `comfortable` (the mobile drawer) lists every theme as a 44px swatch named
 * by its label and tooltip, in one bordered strip so it reads as a single
 * switch. `compact` (the site bar) is one button that steps to the next
 * theme: six 44px swatches do not fit a tablet's bar beside the links.
 */
export function ThemeControl({
  size = "compact",
  className = "",
}: {
  size?: "compact" | "comfortable";
  className?: string;
}) {
  const [theme, cycle, setTheme] = useTheme();
  const hydrated = useSyncExternalStore(subscribe, hydratedOnClient, hydratedOnServer);

  if (size === "compact") {
    const at = THEMES.findIndex((t) => t.id === theme);
    const next = THEMES[(at + 1) % THEMES.length].name;
    return (
      <div role="group" aria-label="theme" className={`inline-flex ${className}`}>
        <button
          type="button"
          aria-label={hydrated ? `theme: ${THEMES[at].name}. switch to ${next}` : "switch theme"}
          title={hydrated ? `${THEMES[at].name} (next: ${next})` : "switch theme"}
          onClick={cycle}
          className="touch-target inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] transition-colors hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          <Swatch />
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="theme"
      className={`inline-flex items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] ${className}`}
    >
      {THEMES.map(({ id, name }, index) => {
        const active = hydrated && theme === id;
        return (
          <button
            key={id}
            type="button"
            aria-label={`${id} theme`}
            aria-pressed={active}
            title={name}
            onClick={() => setTheme(id)}
            className={`touch-target inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10 min-h-[44px] min-w-[44px] ${
              index > 0 ? "border-l border-[var(--border)]" : ""
            } ${active ? "bg-[var(--cyan)]" : "hover:bg-[var(--bg-elevated)]"}`}
          >
            <Swatch themeId={id} />
          </button>
        );
      })}
    </div>
  );
}
