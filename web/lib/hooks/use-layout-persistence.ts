"use client";

import { useCallback, useEffect, useState } from "react";
import type { Breakpoint } from "@/lib/hooks/use-breakpoint";

const KEY_PREFIX = "aarch64-playground:layout:";

/**
 * Persist a layout-size array per breakpoint in localStorage. Crossing a
 * breakpoint loads that breakpoint's entry or falls back to the caller's
 * default. Reset clears the current breakpoint only.
 */
export function useLayoutPersistence(
  bp: Breakpoint,
  fallback: number[],
): [number[], (next: number[]) => void, () => void] {
  const [sizes, setSizes] = useState<number[]>(fallback);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`${KEY_PREFIX}${bp}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
          setSizes(parsed);
          return;
        }
      }
    } catch {
      // localStorage can throw in private mode; fall through to fallback.
    }
    setSizes(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bp]);

  const save = useCallback(
    (next: number[]) => {
      setSizes(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(`${KEY_PREFIX}${bp}`, JSON.stringify(next));
      } catch {
        // best-effort; storage can fail in sandboxed iframes.
      }
    },
    [bp],
  );

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(`${KEY_PREFIX}${bp}`);
      } catch {
        // ignore
      }
    }
    setSizes(fallback);
  }, [bp, fallback]);

  return [sizes, save, reset];
}
