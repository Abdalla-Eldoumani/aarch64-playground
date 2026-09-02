"use client";

import { useCallback, useEffect, useState } from "react";
import type { Breakpoint } from "@/lib/hooks/use-breakpoint";
import {
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/playground/safe-storage";

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
    const raw = safeGetItem(`${KEY_PREFIX}${bp}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
          setSizes(parsed);
          return;
        }
      } catch {
        // malformed payload; fall through to fallback.
      }
    }
    setSizes(fallback);
    // `fallback` is out of the deps on purpose: a new array identity must not
    // overwrite a loaded layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bp]);

  const save = useCallback(
    (next: number[]) => {
      setSizes(next);
      safeSetItem(`${KEY_PREFIX}${bp}`, JSON.stringify(next));
    },
    [bp],
  );

  const reset = useCallback(() => {
    safeRemoveItem(`${KEY_PREFIX}${bp}`);
    setSizes(fallback);
  }, [bp, fallback]);

  return [sizes, save, reset];
}
