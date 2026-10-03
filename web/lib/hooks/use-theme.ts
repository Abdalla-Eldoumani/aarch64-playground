"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";
import { isThemeId, THEME_IDS, THEME_STORAGE_KEY, type ThemeId } from "@/lib/theme/themes";

export type Theme = ThemeId;

// One module-level store, so every consumer (the toolbar toggle, the command
// palette action, and each ThemeControl) reads and writes the same value rather
// than holding independent useState copies that drift apart.
const listeners = new Set<() => void>();
let current: Theme | null = null;

/**
 * The theme a visit starts in: a saved id that is still a theme, then the OS
 * asking for more contrast, then the OS light scheme, then dark. The
 * pre-paint script in lib/theme/pre-paint.ts is the twin that runs before
 * React; a test holds the two to the same answers.
 */
export function resolveTheme(): Theme {
  const saved = safeGetItem(THEME_STORAGE_KEY);
  if (isThemeId(saved)) return saved;
  if (window.matchMedia?.("(prefers-contrast: more)").matches) return "high-contrast";
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

// Memoized in `current` so useSyncExternalStore always gets a stable snapshot.
function read(): Theme {
  if (current) return current;
  // matchMedia in resolveTheme needs the window guard, not just the read.
  if (typeof window === "undefined") return "dark";
  return (current = resolveTheme());
}

// The browser chrome follows the page colour. The pre-paint script made the
// media-less theme-color meta; the computed token keeps this file free of
// colour values.
function paint(next: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  const color = getComputedStyle(root).getPropertyValue("--bg-base").trim();
  if (!color) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.prepend(meta);
  }
  meta.content = color;
}

// A switch lands in the same frame, with no crossfade: a view transition
// sends clicks to the page root while it runs, so the reader's next click
// would be lost. Then every consumer wakes against the one shared value.
function write(next: Theme): void {
  current = next;
  safeSetItem(THEME_STORAGE_KEY, next);
  if (typeof document !== "undefined") paint(next);
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

// Stable server snapshot so the server render and the first client render
// agree; the client reconciles to the resolved theme on mount.
function getServerSnapshot(): Theme {
  return "dark";
}

/**
 * The theme, shared by every consumer and mirrored onto `<html data-theme>`
 * for the token rules. Returns the theme, a cycle through every theme in
 * lineup order, and a setter so a deep link can pin a theme on mount.
 */
export function useTheme(): [Theme, () => void, (next: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, getServerSnapshot);

  // The pre-paint script already set the attribute; mirroring the resolved
  // theme on mount keeps the store, the page and the saved value in step.
  // The write is idempotent, so multiple mounted consumers stay consistent.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const resolved = read();
    paint(resolved);
    safeSetItem(THEME_STORAGE_KEY, resolved);
  }, []);

  const cycle = useCallback(() => {
    write(THEME_IDS[(THEME_IDS.indexOf(read()) + 1) % THEME_IDS.length]);
  }, []);
  const setTheme = useCallback((next: Theme) => write(next), []);

  return [theme, cycle, setTheme];
}
