"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function read(): string {
  return window.location.hash.replace(/^#/, "");
}

/**
 * The URL fragment without its `#`, as an external store. The server render
 * and the first client render read "" so hydration matches, then the real
 * fragment arrives, and every later hashchange (back, forward, a clicked
 * `#link`) renders again. React only calls the two functions above in the
 * browser, so they need no window guard.
 */
export function useHashFragment(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
