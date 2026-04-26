// Service worker for the cpsc 355 playground.
// Strategy:
//   - install: skipWaiting so the new worker activates without a reload.
//   - activate: claim clients + sweep stale caches keyed by version.
//   - fetch:
//       * cross-origin or non-GET -> network only.
//       * /api/c-to-asm           -> network only (Godbolt proxy is dynamic).
//       * navigation              -> network first, fall back to cached "/".
//       * /_next/static, /examples, /icons -> cache first.
//       * else                    -> network first, fall back to cache.

const CACHE_VERSION = "v1";
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
  if (url.pathname.startsWith("/api/c-to-asm")) return;

  // Navigation: network first so a fresh deploy reaches the user;
  // cached "/" keeps the app shell available offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((m) => m || fetch(req))),
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
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
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
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || Response.error())),
  );
});
