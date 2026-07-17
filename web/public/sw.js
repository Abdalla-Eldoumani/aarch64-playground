// Service worker for the cpsc 355 playground.
// Strategy:
//   - install: skipWaiting so the new worker activates without a reload.
//   - activate: claim clients + sweep stale caches keyed by version.
//   - fetch:
//       * cross-origin or non-GET -> network only.
//       * navigation              -> network first, cache 2xx per URL,
//                                    fall back to that URL's copy, then the shell.
//       * /_next/static, /examples, /icons -> cache first.
//       * else                    -> network first, fall back to cache.

const CACHE_VERSION = "v3";
const RUNTIME_CACHE = `cpsc355-runtime-${CACHE_VERSION}`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) => {
      // Pre-warm the app shell. Failures are tolerated -- a request
      // that 404s during install shouldn't kill the install.
      return Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("cpsc355-runtime-") && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isCacheFirst(url) {
  const p = url.pathname;
  return (
    p.startsWith("/_next/static/") ||
    p.startsWith("/examples/") ||
    p.startsWith("/icons/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: network first so a fresh deploy reaches the user. Each
  // route caches under ITS OWN URL -- the old fixed "/" key held whichever
  // route loaded last (installing the PWA overwrote it with /playground,
  // and any 404 poisoned it), so offline /learn rendered the wrong page.
  // Only 2xx documents are cached, and the write is carried by
  // waitUntil so a terminating worker cannot drop it half-done. Offline
  // fallback: the request's own cached copy, then the pre-cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)),
            );
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((m) => m || caches.match("/"))
            .then((m) => m || fetch(req)),
        ),
    );
    return;
  }

  if (isCacheFirst(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)));
          }
          return res;
        });
      }),
    );
    return;
  }

  // Default: network first, fall back to cache.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)));
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || Response.error())),
  );
});
