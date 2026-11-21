"use client";

import { useCallback, useEffect, useReducer } from "react";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

/**
 * What the site keeps in localStorage, and one way to hear it change: a write
 * here tells this tab through its own named event, and the browser's
 * "storage" event, which reaches only the other tabs, tells the rest. Keys
 * and stored formats belong to the callers and never change here, so a
 * returning student's choices load as they were saved.
 */

// Never "storage": no listener for the browser's event hears this tab's writes.
// It is a StorageEvent only so it carries key and newValue where the browser's
// does, and one handler reads both.
const CHANGED_EVENT = "aarch64-playground:stored-change";

/** Calls back with the new stored text on every change to `key`, in this tab
 *  or another; returns the unsubscribe. */
export function subscribeStored(key: string, callback: (value: string | null) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const follow = (event: Event) => {
    const changed = event as StorageEvent;
    if (changed.key === key) callback(changed.newValue);
  };
  window.addEventListener("storage", follow);
  window.addEventListener(CHANGED_EVENT, follow);
  return () => {
    window.removeEventListener("storage", follow);
    window.removeEventListener(CHANGED_EVENT, follow);
  };
}

/**
 * Writes a value and returns whether it reached storage. This tab hears the
 * write either way: a setting holds for the page even where storage refuses
 * it (a private window, blocked site data, a full quota), and a reader that
 * re-reads storage finds a refused record unchanged, so it never shows as saved.
 */
export function writeStored(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  const saved = safeSetItem(key, value);
  window.dispatchEvent(new StorageEvent(CHANGED_EVENT, { key, newValue: value }));
  return saved;
}

/**
 * A stored setting, the same in every copy on the page and in other tabs.
 * `parse` turns the stored text, null when there is none, into the value, so
 * it owns the fallback and any older format. Read after mount, since the
 * server has no storage; a reducer, so the stored text can arrive from an
 * effect. With `follow` false, each copy reads storage only when it mounts
 * and a change moves only the copy that made it.
 */
export function useStoredSetting<T>(
  key: string,
  parse: (raw: string | null) => T,
  follow = true,
): [T, (value: string) => void] {
  const [raw, apply] = useReducer((_prev: string | null, next: string | null) => next, null);
  useEffect(() => {
    apply(safeGetItem(key));
    return follow ? subscribeStored(key, apply) : undefined;
  }, [key, follow]);
  const save = useCallback((value: string) => {
    if (follow) writeStored(key, value);
    else {
      apply(value);
      safeSetItem(key, value);
    }
  }, [key, follow]);
  return [parse(raw), save];
}

/** A stored on or off setting, kept as "1" or "0". */
export function usePersistedFlag(key: string, fallback = false): [boolean, (next: boolean) => void] {
  const [value, save] = useStoredSetting(key, (raw) => (raw == null ? fallback : raw === "1"));
  const set = useCallback((next: boolean) => save(next ? "1" : "0"), [save]);
  return [value, set];
}
