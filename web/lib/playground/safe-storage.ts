/**
 * localStorage behind one window guard and one try/catch, for every surface
 * that persists something: the panels, the generic hooks, the workspace
 * stores, the backend picker.
 *
 * Both defenses are needed at every site. There is no `window` during SSR, and
 * a real browser can still throw on the property access itself (a sandboxed
 * iframe, a third-party context with site data blocked) or on the write (quota,
 * private mode). Hand-rolled per module, five call sites carried the try/catch
 * and no window guard.
 *
 * A read degrades to null, so a caller's "nothing stored" path covers a
 * broken store too. A write reports whether the value actually reached
 * storage: swallowing that let a named save render the STALE record as if
 * the update had landed. Removal has no caller that can act on the outcome,
 * so it stays void.
 *
 * localStorage only. Nothing here uses sessionStorage; add it when something
 * does, rather than mirroring an API no one calls.
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
