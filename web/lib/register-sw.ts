/**
 * Register the playground's service worker. Called once from a client
 * component after window load so the registration competes with
 * neither the first paint nor the hydration pass.
 *
 * No-ops when:
 *   - running on the server (no `window`)
 *   - the browser doesn't expose `navigator.serviceWorker`
 *     (older Safari, some embedded webviews, or `file://` previews)
 *   - the page is being served over `http:` from anything other than
 *     localhost (browsers reject SW registration outside secure
 *     contexts)
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
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Registration failures are non-fatal -- the app still works
        // online without the cache layer.
      });
  };
  if (document.readyState === "complete") {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
}
