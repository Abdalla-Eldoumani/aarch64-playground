"use client";

import { useSyncExternalStore } from "react";
import {
  exportBundle,
  importBundle,
  type ImportResult,
  listSaves,
  putSave,
  removeSave,
  subscribeSaves,
  type NamedSave,
  type SaveBundle,
} from "@/lib/playground/named-saves";

// useSyncExternalStore requires getSnapshot to return the same
// reference until something actually changed; otherwise React loops.
// listSaves() reads from localStorage and returns a fresh array each
// call, so we cache it in module scope and invalidate on the change
// event.
let cachedSnapshot: NamedSave[] = listSaves();
let listenerCount = 0;
function refreshCache(): void {
  cachedSnapshot = listSaves();
}

function subscribe(callback: () => void): () => void {
  // The module-scope snapshot was taken at import time; refresh it when the
  // first consumer subscribes.
  if (listenerCount === 0) refreshCache();
  listenerCount++;
  const unsubscribe = subscribeSaves(() => {
    refreshCache();
    callback();
  });
  return () => {
    listenerCount--;
    unsubscribe();
  };
}

function getSnapshot(): NamedSave[] {
  return cachedSnapshot;
}

const EMPTY: NamedSave[] = [];
function serverSnapshot(): NamedSave[] {
  return EMPTY;
}

export interface NamedSavesApi {
  saves: NamedSave[];
  /** Returns whether the bookmark actually reached storage. */
  put: (save: NamedSave) => boolean;
  remove: (name: string) => boolean;
  exportBundle: () => SaveBundle;
  importBundle: (bundle: unknown) => ImportResult;
}

/**
 * React hook over the localStorage-backed named-saves store. Re-renders
 * any consumer when a save is added, removed, or imported, including
 * cross-tab updates via the native `storage` event.
 */
export function useNamedSaves(): NamedSavesApi {
  const saves = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  return { saves, put: putSave, remove: removeSave, exportBundle, importBundle };
}
