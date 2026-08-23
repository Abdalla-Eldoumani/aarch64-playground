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
//   - every cache write goes through putBounded, which holds the runtime
//     cache to MAX_RUNTIME_ENTRIES.

// v7 bounds the runtime cache (see putBounded). Editing this file is enough
// on its own to make browsers re-install the worker, but the version bump is
// what retires the old UNBOUNDED cache instead of inheriting however many
// entries it had grown to: activate deletes every cpsc355-runtime-* key that
// is not the current one.
const CACHE_VERSION = "v7";
const RUNTIME_CACHE = `cpsc355-runtime-${CACHE_VERSION}`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// One full working set for a single build is about 220 entries: 93 files under
// /_next/static, 46 addressable documents (landing, playground, the three
// index pages, 8 lessons, 32 exercises, 404), 78 files under /examples, 3
// icons, the manifest, and the share card. 450 is roughly double that, so a
// student who reads every page and loads every example never evicts anything,
// and a redeploy -- which mints a fresh set of hashed /_next/static URLs
// inside the same cache version -- can sit beside the previous build's set
// before the bound bites.
const MAX_RUNTIME_ENTRIES = 450;

const SHELL_PATHS = new Set(APP_SHELL);

/**
 * Write to the runtime cache, then trim it back to the bound.
 *
 * The Cache API exposes no size, no timestamps, and no access record, so
 * the bound is an entry count and the eviction order is the only order
 * available: keys() answers in insertion order, so dropping from the front
 * is FIFO, not LRU. That is acceptable here because eviction is never a
 * correctness event -- every route is network-first or serve-cached-then-
 * revalidate, so an entry evicted too eagerly costs one network round trip
 * and nothing else. The app shell is held back from the candidates: it is
 * the oldest thing in the cache, so plain FIFO would evict the offline
 * fallback first, which is the one entry whose absence a user would feel.
 */
async function putBounded(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  const excess = keys.length - MAX_RUNTIME_ENTRIES;
  if (excess <= 0) return;
  const evictable = keys.filter((k) => !SHELL_PATHS.has(new URL(k.url).pathname));
  await Promise.all(evictable.slice(0, excess).map((k) => cache.delete(k)));
}

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
              caches.open(RUNTIME_CACHE).then((cache) => putBounded(cache, req, copy)),
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
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              event.waitUntil(
                caches.open(RUNTIME_CACHE).then((cache) => putBounded(cache, req, copy)),
              );
            }
            return res;
          })
          .catch(() => cached);
        // /_next/static and /icons carry a build hash in the path, so a
        // changed file is a changed URL and the cached copy can never be
        // stale. /examples does NOT: editing a program in place leaves the
        // path alone, and a pure cache-first answer served the old text
        // until CACHE_VERSION happened to be bumped by hand. Serve the
        // cached copy for speed, then refresh it in the background so the
        // next load is current.
        if (!cached) return network;
        event.waitUntil(network.catch(() => undefined));
        return cached;
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
          event.waitUntil(
            caches.open(RUNTIME_CACHE).then((cache) => putBounded(cache, req, copy)),
          );
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || Response.error())),
  );
});
