"use client";

import { useCallback, useState } from "react";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const MIN = 0.6;
const MAX = 1.8;
const STEP = 0.1;

function loadInitialScale(storageKey: string): number {
  const raw = safeGetItem(`aarch64-playground:zoom:${storageKey}`);
  if (raw) {
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed) && parsed >= MIN && parsed <= MAX) return parsed;
  }
  return 1;
}

/**
 * Per-panel zoom. Returns a scale (1 = default), setter, and the CSS
 * style object to spread onto the panel so children pick up
 * `--font-scale` for size inheritance. Persisted in localStorage under
 * the supplied key so each panel remembers its own zoom.
 */
export function useZoom(storageKey: string) {
  const [scale, setScale] = useState<number>(() => loadInitialScale(storageKey));

  const save = useCallback(
    (next: number) => {
      const clamped = Math.min(MAX, Math.max(MIN, Math.round(next * 100) / 100));
      setScale(clamped);
      safeSetItem(`aarch64-playground:zoom:${storageKey}`, String(clamped));
    },
    [storageKey],
  );

  const zoomIn = useCallback(() => save(scale + STEP), [save, scale]);
  const zoomOut = useCallback(() => save(scale - STEP), [save, scale]);
  const reset = useCallback(() => save(1), [save]);

  return {
    scale,
    style: { ["--font-scale" as string]: String(scale) } as React.CSSProperties,
    zoomIn,
    zoomOut,
    reset,
    setScale: save,
  };
}
