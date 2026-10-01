import { useSyncExternalStore } from "react";

/**
 * What the service worker (public/sw.js) has saved for offline use, as it last
 * reported. The worker posts an "offline-status" message to every open tab
 * when asked and whenever a save moves, so every tab shows the same state.
 */
export interface OfflineStatus {
  /** Pages in the "save every page" set (the playground is always saved). */
  pages: number;
  /** Their estimated download size, in bytes. */
  bytes: number;
  /** When every page was saved under the current build, or null. */
  savedAt: Date | null;
  /** How far a running save has got, or null. */
  saving: { done: number; total: number } | null;
  /** Why the last save stopped: the connection, a full disk, or a newer deploy. */
  failure: "network" | "storage" | "update" | null;
}

/** The last status, and what the newest message changed, for announcing. */
export interface OfflineSnapshot {
  status: OfflineStatus;
  change: "started" | "saved" | "failed" | null;
}

let snapshot: OfflineSnapshot | null = null;
const listeners = new Set<() => void>();
let listening = false;

const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** The worker is ours, but a message is still data: anything off-shape is dropped. */
export function parseStatus(data: unknown): OfflineStatus | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.type !== "offline-status" || !count(d.pages) || !count(d.bytes)) return null;
  let savedAt: Date | null = null;
  if (typeof d.savedAt === "string") {
    savedAt = new Date(d.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;
  } else if (d.savedAt !== null) return null;
  let saving: OfflineStatus["saving"] = null;
  if (d.saving !== null) {
    const s = d.saving as Record<string, unknown> | undefined;
    if (!s || !count(s.done) || !count(s.total) || s.done > s.total) return null;
    saving = { done: s.done, total: s.total };
  }
  const failure =
    d.failure === "network" || d.failure === "storage" || d.failure === "update" ? d.failure : null;
  return { pages: d.pages, bytes: d.bytes, savedAt, saving, failure };
}

function changeBetween(before: OfflineStatus | undefined, after: OfflineStatus): OfflineSnapshot["change"] {
  if (!before) return null;
  if (!before.saving && after.saving) return "started";
  if (before.saving && !after.saving) return after.failure ? "failed" : "saved";
  return null;
}

function onMessage(event: MessageEvent): void {
  const status = parseStatus(event.data);
  if (!status) return;
  snapshot = { status, change: changeBetween(snapshot?.status, status) };
  for (const listener of listeners) listener();
}

/** Posts to the active worker. A browser without one never resolves `ready`,
 *  which leaves the status null and every offline control hidden. */
function tellWorker(type: "offline-status" | "save-every-page"): void {
  navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage({ type }))
    .catch(() => {});
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!listening && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    listening = true;
    navigator.serviceWorker.addEventListener("message", onMessage);
    tellWorker("offline-status");
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The latest status from the worker; null until it answers, and always on the server. */
export function useOfflineSnapshot(): OfflineSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => null,
  );
}

/** Decimal megabytes, the unit phone data plans count in. */
export function formatDownload(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

export function formatSavedDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Starts saving every page. Asks the browser to keep the site's storage
 * through storage pressure first; a refusal changes nothing, since the pages
 * are saved either way and only become evictable.
 */
export function saveEveryPage(): void {
  navigator.storage?.persist?.().catch(() => false);
  tellWorker("save-every-page");
}
