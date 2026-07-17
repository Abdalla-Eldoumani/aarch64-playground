// The playground's persistent home directory. The full playground mirrors
// its working file set (uploads, terminal redirect outputs, loaded example
// fixtures) into IndexedDB so the files are still there after a reload, a
// route change, or a closed tab. IndexedDB rather than localStorage because
// the VFS cap (MAX_VFS_BYTES, 4 MiB) crowds typical localStorage quotas.
// Every entry point degrades to session-only silently: no IndexedDB (SSR,
// some private windows), a blocked open, or a broken transaction must never
// take the playground down over a convenience feature.

import { MAX_VFS_BYTES } from "@/lib/playground/upload-guard";

const DB_NAME = "aarch64-playground";
const DB_VERSION = 1;
const STORE = "vfs";
const KEY = "working-set";

/** UTF-8 size of the whole working set; the persistence cap is the same
 *  cap the live VFS enforces, so persistence never widens what fits. */
export function workingSetBytes(files: Record<string, string>): number {
  let total = 0;
  for (const [name, body] of Object.entries(files)) {
    total += name.length + new TextEncoder().encode(body).byteLength;
  }
  return total;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function isWorkingSet(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((body) => typeof body === "string")
  );
}

/** The persisted working set, or null when none exists (first visit,
 *  storage unavailable, or a payload that fails the shape check). */
export async function loadPersistedVfs(): Promise<Record<string, string> | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        db.close();
        resolve(isWorkingSet(request.result) ? request.result : null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/** Persist the working set. An over-cap set is skipped (the previous
 *  persisted copy stays) rather than truncated: silently dropping some of
 *  a student's files would be worse than keeping yesterday's whole set. */
export async function savePersistedVfs(files: Record<string, string>): Promise<void> {
  if (workingSetBytes(files) > MAX_VFS_BYTES) return;
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(files, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
