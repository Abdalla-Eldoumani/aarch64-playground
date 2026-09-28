/**
 * localStorage behind a window check and a try/catch: there is no `window`
 * on the server, and a browser can throw on any access (sandboxed iframe,
 * blocked site data, full quota, private mode). Reads fall back to null;
 * writes return whether they landed, so a failed save never shows as saved.
 */

export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns whether the value reached storage. */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // storage quota / sandboxed iframe / private mode
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to undo: the key either never existed or is unreachable
  }
}

/**
 * Every localStorage key, so the practice answers (one key per exercise) can
 * all be found for an export. A broken store reads as empty.
 */
export function safeKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key !== null) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}
