"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

export type Theme = "dark" | "light" | "high-contrast";

const KEY = "aarch64-playground:theme";
const ORDER: Theme[] = ["dark", "light", "high-contrast"];

function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light" || v === "high-contrast";
}

// One module-level store, so every consumer (the toolbar toggle, the command
// palette action, and each ThemeControl) reads and writes the same value rather
// than holding independent useState copies that drift apart.
const listeners = new Set<() => void>();
let current: Theme | null = null;

// Resolve the active theme once, in precedence order: a persisted
// choice, then the OS preference, then dark. The result is memoized in
// `current` so useSyncExternalStore always gets a stable snapshot.
function read(): Theme {
  if (current) return current;
  // matchMedia below needs the window guard, not just the read.
  if (typeof window === "undefined") return "dark";
  const saved = safeGetItem(KEY);
  if (isTheme(saved)) return (current = saved);
  current = window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
  return current;
}

// Wake every consumer so all theme controls re-render against the one
// shared value.
function write(next: Theme): void {
  current = next;
  safeSetItem(KEY, next);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", next);
  }
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
 * Persist-aware theme state shared across every consumer. Reflects the current
 * theme as a `data-theme` attribute on the root `<html>` element so CSS vars
 * respond via the `[data-theme="..."]` selectors in `globals.css`. Returns the
 * current theme, a cycle function (dark -> light -> high-contrast -> dark), and
 * a direct setter so deep-links can pin a theme on mount.
 */
export function useTheme(): [Theme, () => void, (next: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, getServerSnapshot);

  // Nothing sets `data-theme` before hydration, so mirror the resolved theme
  // onto the document on mount. The write is idempotent, so multiple mounted
  // consumers stay consistent.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const resolved = read();
    document.documentElement.setAttribute("data-theme", resolved);
    safeSetItem(KEY, resolved);
  }, []);

  const cycle = useCallback(() => {
    write(ORDER[(ORDER.indexOf(read()) + 1) % ORDER.length]);
  }, []);
  const setTheme = useCallback((next: Theme) => write(next), []);

  return [theme, cycle, setTheme];
}
