/**
 * Client-only persistence for the per-exercise solved set, stored as a JSON
 * string[] of slugs under a single localStorage key. The stored value is
 * treated as untrusted on read: a tampered, absent, or malformed value
 * degrades to "nothing solved" rather than throwing. Every function is
 * SSR-safe (guards `typeof window`) and never throws, even when
 * localStorage is absent or throwing (private mode, sandboxed iframe,
 * quota), reusing auto-save.ts's window-guarded safe-storage helpers.
 *
 * The index reads this set and re-renders when it changes; the exercise
 * view writes to it when a check passes. A same-tab CustomEvent plus the
 * native cross-tab "storage" event keep every open instance in sync (the
 * "storage" event fires only in OTHER tabs, so the same-tab event is what
 * updates the tab that did the writing).
 */

import { safeGetItem, safeSetItem } from "@/lib/auto-save";

const SOLVED_KEY = "aarch64-playground:practice:solved";
/** Same-tab change signal; the native "storage" event covers other tabs only. */
const SOLVED_EVENT = "aarch64-playground:practice:solved";

/**
 * The solved slugs, parsed defensively: absent, non-JSON, or a value that
 * is not an array of strings all degrade to an empty list.
 */
export function getSolvedSlugs(): string[] {
  const raw = safeGetItem(SOLVED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed as string[];
    }
  } catch {
    // malformed; treat as nothing solved.
  }
  return [];
}

/** Whether a slug has been recorded as solved. */
export function isSolved(slug: string): boolean {
  return getSolvedSlugs().includes(slug);
}

/**
 * Record a slug as solved. Idempotent: a slug already present is a no-op,
 * so callers can mark on every passing check without creating duplicates.
 * On a real change it persists the new set, then dispatches the same-tab
 * event so subscribers in this tab update (the native "storage" event only
 * reaches other tabs).
 */
export function markSolved(slug: string): void {
  const current = getSolvedSlugs();
  if (current.includes(slug)) return;
  safeSetItem(SOLVED_KEY, JSON.stringify([...current, slug]));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SOLVED_EVENT));
  }
}

/**
 * Subscribe to solved-set changes. The callback fires on a same-tab
 * markSolved (via the CustomEvent) and on a change in another tab (via the
 * native "storage" event). Returns an unsubscribe that removes both
 * listeners; a no-op on the server where there is no window.
 */
export function subscribeSolved(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === SOLVED_KEY) callback();
  };
  const onSameTab = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(SOLVED_EVENT, onSameTab);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SOLVED_EVENT, onSameTab);
  };
}
