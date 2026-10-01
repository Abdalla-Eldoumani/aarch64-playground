/**
 * Register the service worker after window load, so it does not slow the
 * first paint or hydration. Skipped where the browser has no service worker
 * support, or on plain http anywhere but localhost, where browsers refuse one.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const isSecure =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (!isSecure) return;
  const run = () => {
    navigator.serviceWorker
      // The worker imports its build's file list, and a new list is what
      // starts an update, so the update check must never read a cached copy.
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Registration failures are non-fatal: the app still works online
        // without the cache layer.
      });
  };
  if (document.readyState === "complete") {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
}
