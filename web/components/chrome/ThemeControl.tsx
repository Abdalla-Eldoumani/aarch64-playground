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

/**
 * Drives the shared useTheme hook, so there is no second theme store. Each
 * option is a swatch painted by its own theme's tokens (`data-theme` on the
 * swatch scopes them), so six fit where three words did; the name is the
 * button's label and tooltip. One bordered strip, so it reads as a single
 * switch. `comfortable` gives the mobile drawer 44px targets.
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
  const sizing = size === "comfortable" ? "min-h-[44px] min-w-[44px]" : "min-h-[32px] min-w-[28px]";

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
            className={`touch-target inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10 ${sizing} ${
              index > 0 ? "border-l border-[var(--border)]" : ""
            } ${active ? "bg-[var(--cyan)]" : "hover:bg-[var(--bg-elevated)]"}`}
          >
            {/* The edge is the page's own ink, so a swatch close to the page
                colour still shows; inside sit the theme's page, machine and
                interaction colours. */}
            <span aria-hidden="true" className="flex rounded-[2px] border border-[var(--text-tertiary)]">
              <span data-theme={id} className="flex h-3.5 w-3.5 items-end gap-px bg-[var(--bg-base)] p-0.5">
                <span className="h-1.5 w-1 bg-[var(--amber)]" />
                <span className="h-1 w-1 bg-[var(--cyan)]" />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
