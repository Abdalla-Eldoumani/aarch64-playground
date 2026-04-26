"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "aarch64-playground:lecture-mode";
const PRIOR_THEME_KEY = "aarch64-playground:lecture-prior-theme";
const EVENT = "aarch64-playground:lecture-mode-changed";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function applyOn(): void {
  const root = document.documentElement;
  const prior = root.getAttribute("data-theme") ?? "dark";
  try {
    window.localStorage.setItem(PRIOR_THEME_KEY, prior);
  } catch { /* ignore */ }
  root.setAttribute("data-theme", "high-contrast");
  root.classList.add("lecture-mode");
  // Fullscreen needs a user gesture; failures (jsdom, denied permission,
  // iframe sandboxing) are silently swallowed so the rest of the
  // toggle still applies.
  if (document.fullscreenElement == null && root.requestFullscreen) {
    root.requestFullscreen().catch(() => { /* ignore */ });
  }
}

function applyOff(): void {
  const root = document.documentElement;
  let prior = "dark";
  try {
    prior = window.localStorage.getItem(PRIOR_THEME_KEY) ?? "dark";
  } catch { /* ignore */ }
  root.setAttribute("data-theme", prior);
  root.classList.remove("lecture-mode");
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => { /* ignore */ });
  }
}

function write(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch { /* ignore */ }
  if (on) applyOn();
  else applyOff();
  window.dispatchEvent(new CustomEvent(EVENT));
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

export interface LectureModeApi {
  enabled: boolean;
  set: (on: boolean) => void;
  toggle: () => void;
}

/**
 * `useSyncExternalStore` hook over a localStorage-backed boolean.
 * When toggled on, requests fullscreen, switches `data-theme` to
 * `high-contrast` (saving the prior theme so it can be restored), and
 * adds the `lecture-mode` class to `<html>`. Default off. Listens for
 * browser-driven fullscreen exit (ESC) and flips the flag back to off
 * automatically.
 */
export function useLectureMode(): LectureModeApi {
  const enabled = useSyncExternalStore(subscribe, read, () => false);

  // Keep React state in sync if the browser exits fullscreen via ESC
  // or the close-tab affordance. The handler is idempotent because
  // write() compares against the storage value before applying.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => {
      if (!document.fullscreenElement && enabled) {
        write(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [enabled]);

  const set = useCallback((on: boolean) => write(on), []);
  const toggle = useCallback(() => write(!read()), []);
  return { enabled, set, toggle };
}
