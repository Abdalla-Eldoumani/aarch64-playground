"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const KEY_CURRENT = "aarch64-playground:auto-save:current";
const KEY_RECENT = "aarch64-playground:auto-save:recent";
const MAX_RECENT = 10;
const DEBOUNCE_MS = 500;

export interface RecentEntry {
  id: string;
  name: string;
  body: string;
  savedAt: number;
}

export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/** Load the last-saved editor buffer, or `null` if there is none. */
export function loadAutoSavedBuffer(): string | null {
  return safeGetItem(KEY_CURRENT);
}

/**
 * Auto-save the editor buffer on change, debounced by 500ms. The effect
 * writes whenever the incoming `value` stabilizes for the debounce
 * window, so fast typing doesn't hammer localStorage.
 *
 * `enabled` gates the write: only the full playground persists to the
 * shared buffer. Embedded surfaces (the landing hero, lessons, exercises)
 * pass `false` so their host-supplied program never overwrites the
 * playground's saved work.
 */
export function useAutoSave(value: string, enabled: boolean = true): void {
  const lastSavedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      if (value === lastSavedRef.current) return;
      lastSavedRef.current = value;
      safeSetItem(KEY_CURRENT, value);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, enabled]);
}

/**
 * Stored entries are untrusted: another tab, an older build, or a hand-edited
 * localStorage can hold anything. A wrong-shaped element reaches the recents
 * list, where a missing body loads an empty program and a non-string name
 * renders as whatever it is.
 */
function isValidRecent(v: unknown): v is RecentEntry {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.body === "string" &&
    typeof o.savedAt === "number" &&
    Number.isFinite(o.savedAt)
  );
}

/**
 * Ring of the last 10 distinct programs the user assembled/loaded, keyed
 * by content hash so a user loading the same example repeatedly doesn't
 * push out unrelated work.
 */
function loadRecentInitial(): RecentEntry[] {
  const raw = safeGetItem(KEY_RECENT);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    // The cap is re-applied on read: the ring is only bounded where it is
    // written, and a stored array is not something this code wrote.
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidRecent).slice(0, MAX_RECENT);
    }
  } catch {
    // malformed; drop.
  }
  return [];
}

export function useRecentPrograms(): {
  entries: RecentEntry[];
  push: (name: string, body: string) => void;
  clear: () => void;
} {
  const [entries, setEntries] = useState<RecentEntry[]>(loadRecentInitial);

  const push = useCallback((name: string, body: string) => {
    const id = hashString(body);
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      const next = [{ id, name, body, savedAt: Date.now() }, ...filtered].slice(
        0,
        MAX_RECENT,
      );
      safeSetItem(KEY_RECENT, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    safeSetItem(KEY_RECENT, "[]");
  }, []);

  return { entries, push, clear };
}
