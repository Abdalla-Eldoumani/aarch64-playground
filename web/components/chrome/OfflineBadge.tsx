"use client";

import { useSyncExternalStore } from "react";

function read(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * The emulator runs in the browser and the service worker serves what a
 * visit already fetched, so going offline is news, not an error.
 */
export function OfflineBadge() {
  // Default to online for the SSR snapshot so hydration matches the
  // optimistic state on first paint.
  const online = useSyncExternalStore(subscribe, read, () => true);
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="px-3 py-1 text-[11px] text-center bg-[var(--bg-sunken)] border-b border-[var(--border)] text-[var(--text-secondary)]"
    >
      offline: the playground runs fully in your browser and keeps working from cached files
    </div>
  );
}
