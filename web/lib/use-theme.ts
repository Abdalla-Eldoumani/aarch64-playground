"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "aarch64-playground:theme";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
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
 * Persist-aware theme state. Reflects the current theme as a
 * `data-theme` attribute on the root `<html>` element so CSS vars can
 * respond via the `[data-theme="light"]` selector defined in
 * `globals.css`.
 */
export function useTheme(): [Theme, () => void] {
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

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return [theme, toggle];
}
