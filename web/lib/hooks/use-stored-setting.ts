"use client";

import { useCallback, useEffect, useReducer } from "react";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

/**
 * What the site keeps in localStorage, and one way to hear it change: a write
 * here tells this tab through a named event that carries the value, and the
 * browser's "storage" event, which reaches only the other tabs, tells the
 * rest. Keys and stored formats belong to the callers and never change here,
 * so a returning student's choices load as they were saved.
 */

const CHANGED_EVENT = "aarch64-playground:stored-change";

/** Calls back with the new stored text on every change to `key`, in this tab
 *  or another; returns the unsubscribe. */
export function subscribeStored(key: string, callback: (value: string | null) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback(event.newValue);
  };
  const onChange = (event: Event) => {
    const [changed, value] = (event as CustomEvent<[string, string]>).detail;
    if (changed === key) callback(value);
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED_EVENT, onChange);
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
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: [key, value] }));
  return saved;
}

/**
 * A stored setting, the same in every copy on the page. `parse` turns the
 * stored text, null when there is none, into the value, so it owns the
 * fallback and any older format. Read after mount, since the server has no
 * storage; a reducer, so the stored text can arrive from an effect.
 */
export function useStoredSetting<T>(
  key: string,
  parse: (raw: string | null) => T,
): [T, (value: string) => void] {
  const [raw, apply] = useReducer((_prev: string | null, next: string | null) => next, null);
  useEffect(() => {
    apply(safeGetItem(key));
    return subscribeStored(key, apply);
  }, [key]);
  const save = useCallback((value: string) => {
    writeStored(key, value);
  }, [key]);
  return [parse(raw), save];
}

/** A stored on or off setting, kept as "1" or "0". */
export function usePersistedFlag(key: string, fallback = false): [boolean, (next: boolean) => void] {
  const [value, save] = useStoredSetting(key, (raw) => (raw == null ? fallback : raw === "1"));
  const set = useCallback((next: boolean) => save(next ? "1" : "0"), [save]);
  return [value, set];
}
