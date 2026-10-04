"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/playground/safe-storage";

const KEY_PREFIX = "aarch64-playground:layout:";

function readStored(scope: string): number[] | null {
  const raw = safeGetItem(`${KEY_PREFIX}${scope}`);
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
 * Panel sizes per scope in localStorage (a breakpoint, plus "-short" in a
 * short window, plus the group's side); reset clears only the current scope.
 * `save` does nothing until `ready`: a panel group can report its
 * size before the stored sizes load, and saving that report would replace
 * them with the fallback on every reload.
 */
export function useLayoutPersistence(
  scope: string,
  fallback: number[],
): [number[], (next: number[]) => void, () => void, boolean] {
  const [sizes, setSizes] = useState<number[]>(fallback);
  const [ready, setReady] = useState(false);
  // The synchronous half of `ready`: a save can arrive between the render
  // that changed `scope` and the effect that loads it, and state is too late.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    loadedFor.current = null;
    setReady(false);
    setSizes(readStored(scope) ?? fallback);
    loadedFor.current = scope;
    setReady(true);
    // `fallback` is out of the deps on purpose: a new array identity must not
    // overwrite a loaded layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const save = useCallback(
    (next: number[]) => {
      if (loadedFor.current !== scope) return;
      setSizes(next);
      safeSetItem(`${KEY_PREFIX}${scope}`, JSON.stringify(next));
    },
    [scope],
  );

  const reset = useCallback(() => {
    safeRemoveItem(`${KEY_PREFIX}${scope}`);
    setSizes(fallback);
  }, [scope, fallback]);

  return [sizes, save, reset, ready];
}
