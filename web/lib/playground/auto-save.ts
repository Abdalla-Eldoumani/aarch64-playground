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
 * Save the buffer once it has been still for 500ms, so typing does not write
 * on every key. Embedded copies (the hero, lessons, exercises) pass `false`
 * for `enabled` so their program never overwrites the playground's saved work.
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
 * Stored entries are untrusted: another tab, an older build, or a hand edit
 * can leave anything there, and a wrong-shaped one would load an empty
 * program or show a name that is not text.
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
