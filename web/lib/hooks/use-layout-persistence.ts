"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Breakpoint } from "@/lib/hooks/use-breakpoint";
import {
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/playground/safe-storage";

const KEY_PREFIX = "aarch64-playground:layout:";

function readStored(bp: Breakpoint): number[] | null {
  const raw = safeGetItem(`${KEY_PREFIX}${bp}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed;
    }
  } catch {
    // malformed payload; the caller's fallback stands.
  }
  return null;
}

/**
 * Panel sizes per breakpoint in localStorage; reset clears only the current
 * breakpoint. `save` does nothing until `ready`: a panel group can report its
 * size before the stored sizes load, and saving that report would replace
 * them with the fallback on every reload.
 */
export function useLayoutPersistence(
  bp: Breakpoint,
  fallback: number[],
): [number[], (next: number[]) => void, () => void, boolean] {
  const [sizes, setSizes] = useState<number[]>(fallback);
  const [ready, setReady] = useState(false);
  // The synchronous half of `ready`: a save can arrive between the render
  // that changed `bp` and the effect that loads it, and state is too late.
  const loadedFor = useRef<Breakpoint | null>(null);

  useEffect(() => {
    loadedFor.current = null;
    setReady(false);
    setSizes(readStored(bp) ?? fallback);
    loadedFor.current = bp;
    setReady(true);
    // `fallback` is out of the deps on purpose: a new array identity must not
    // overwrite a loaded layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bp]);

  const save = useCallback(
    (next: number[]) => {
      if (loadedFor.current !== bp) return;
      setSizes(next);
      safeSetItem(`${KEY_PREFIX}${bp}`, JSON.stringify(next));
    },
    [bp],
  );

  const reset = useCallback(() => {
    safeRemoveItem(`${KEY_PREFIX}${bp}`);
    setSizes(fallback);
  }, [bp, fallback]);

  return [sizes, save, reset, ready];
}
