"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "high-contrast";

const KEY = "aarch64-playground:theme";
const ORDER: Theme[] = ["dark", "light", "high-contrast"];

function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light" || v === "high-contrast";
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(KEY);
    if (isTheme(saved)) return saved;
  } catch {
    // ignore
  }
  // Fall back to the OS preference if available.
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

/**
 * Persist-aware theme state. Reflects the current theme as a `data-theme`
 * attribute on the root `<html>` element so CSS vars respond via the
 * `[data-theme="..."]` selectors in `globals.css`. Returns the current
 * theme, a cycle function (dark -> light -> high-contrast -> dark), and
 * a direct setter so deep-links can pin a theme on mount.
 */
export function useTheme(): [Theme, () => void, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((t) => {
      const i = ORDER.indexOf(t);
      return ORDER[(i + 1) % ORDER.length];
    });
  }, []);

  return [theme, cycle, setTheme];
}
