"use client";

import { useSyncExternalStore } from "react";
import { formatSavedDate, useOfflineSnapshot } from "@/lib/playground/offline-status";

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
 * The emulator runs in the browser, so going offline is news, not an error.
 * The badge says what the service worker has saved: the playground always,
 * every other page only after "save every page" (or a visit online).
 */
export function OfflineBadge() {
  // Default to online for the SSR snapshot so hydration matches the
  // optimistic state on first paint.
  const online = useSyncExternalStore(subscribe, read, () => true);
  const snapshot = useOfflineSnapshot();
  if (online) return null;

  const savedAt = snapshot?.status.savedAt;
  // No answer from a worker: nothing is known to be saved.
  let message = "offline: other pages will load once you reconnect";
  if (savedAt) {
    message = `offline: every page is saved on this device (saved ${formatSavedDate(savedAt)})`;
  } else if (snapshot) {
    // Two lines at most on a 320px phone, so the badge stays a status line.
    message = "offline: the playground works; other pages open only if saved or visited";
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="px-3 py-1 text-[12px] text-center bg-[var(--bg-sunken)] border-b border-[var(--border)] text-[var(--text-secondary)]"
    >
      {message}
    </div>
  );
}
