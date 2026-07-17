"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  exportBundle as moduleExportBundle,
  importBundle as moduleImportBundle,
  type ImportResult,
  listSaves,
  putSave,
  removeSave,
  SAVES_CHANGED_EVENT,
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
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === "aarch64-playground:named-saves") {
      refreshCache();
      callback();
    }
  };
  const onCustom = () => {
    refreshCache();
    callback();
  };
  if (listenerCount === 0) refreshCache();
  listenerCount++;
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAVES_CHANGED_EVENT, onCustom);
  return () => {
    listenerCount--;
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAVES_CHANGED_EVENT, onCustom);
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
 * any consumer when a save is added, removed, or imported -- including
 * cross-tab updates via the native `storage` event.
 */
export function useNamedSaves(): NamedSavesApi {
  const saves = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const put = useCallback((save: NamedSave) => putSave(save), []);
  const remove = useCallback((name: string) => removeSave(name), []);
  const exportBundle = useCallback(() => moduleExportBundle(), []);
  const importBundle = useCallback(
    (bundle: unknown) => moduleImportBundle(bundle),
    [],
  );
  return { saves, put, remove, exportBundle, importBundle };
}
