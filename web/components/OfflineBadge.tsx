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
 * One-line status strip that appears at the top of the page when the
 * browser reports offline. Renders nothing when online so it stays
 * out of the way during normal use. The service worker keeps the app
 * shell + examples cached, so most of the playground keeps working
 * while offline; only the C-to-asm pane (which proxies Godbolt) goes
 * dark.
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
      offline -- the playground is using cached files; C-to-asm needs network access.
    </div>
  );
}
