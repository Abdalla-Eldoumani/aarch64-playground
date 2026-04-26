"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "aarch64-playground:cpsc355-mode";
const EVENT = "aarch64-playground:cpsc355-mode-changed";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function write(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore quota / private mode failures
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onCustom);
  };
}

export interface Cpsc355ModeApi {
  enabled: boolean;
  set: (on: boolean) => void;
  toggle: () => void;
}

/**
 * `useSyncExternalStore` hook over a localStorage-backed boolean.
 * Default off. Server snapshot returns false so SSR matches the
 * never-enabled-yet client state.
 */
export function useCpsc355Mode(): Cpsc355ModeApi {
  const enabled = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((on: boolean) => write(on), []);
  const toggle = useCallback(() => write(!read()), []);
  return { enabled, set, toggle };
}
