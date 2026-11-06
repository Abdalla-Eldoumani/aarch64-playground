"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
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

interface Layout {
  sizes: number[];
  /** The scope `sizes` were loaded for, null before the first load. */
  loaded: string | null;
}

function mergeLayout(prev: Layout, change: Partial<Layout>): Layout {
  return { ...prev, ...change };
}

/**
 * Panel sizes per scope in localStorage (a breakpoint, plus "-short" in a
 * short window, plus the group's side); reset clears only the current scope.
 * `save` does nothing until `ready`: a panel group can report its
 * size before the stored sizes load, and saving that report would replace
 * them with the fallback on every reload. `ready` is false again from the
 * render that changes `scope` until its sizes load, so nothing applies the
 * last scope's sizes to the new one.
 */
export function useLayoutPersistence(
  scope: string,
  fallback: number[],
): [number[], (next: number[]) => void, () => void, boolean] {
  // A reducer, so the stored layout can arrive from the load effect below.
  const [{ sizes, loaded }, edit] = useReducer(mergeLayout, { sizes: fallback, loaded: null });
  // The synchronous half of `ready`: a save can arrive between the render
  // that changed `scope` and the effect that loads it, and state is too late.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    edit({ sizes: readStored(scope) ?? fallback, loaded: scope });
    loadedFor.current = scope;
    // `fallback` is out of the deps on purpose: a new array identity must not
    // overwrite a loaded layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const save = useCallback(
    (next: number[]) => {
      if (loadedFor.current !== scope) return;
      edit({ sizes: next });
      safeSetItem(`${KEY_PREFIX}${scope}`, JSON.stringify(next));
    },
    [scope],
  );

  const reset = useCallback(() => {
    safeRemoveItem(`${KEY_PREFIX}${scope}`);
    edit({ sizes: fallback });
  }, [scope, fallback]);

  return [sizes, save, reset, loaded === scope];
}
