// Service worker for AArch64 Playground: network first for pages so a new
// deploy reaches students, cache first for build files, examples, and icons,
// and a size bound on the one runtime cache.

// Bumping CACHE_VERSION retires the previous runtime cache instead of
// inheriting its entries: activate deletes every cpsc355-runtime-* key that
// is not the current one.
const CACHE_VERSION = "v7";
const RUNTIME_CACHE = `cpsc355-runtime-${CACHE_VERSION}`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// One build's full working set is about 220 entries (pages, build files,
// examples, icons). Double that lets a student open everything without an
// eviction, with room for the next deploy's hashed files beside it.
const MAX_RUNTIME_ENTRIES = 450;

const SHELL_PATHS = new Set(APP_SHELL);

/**
 * Write to the runtime cache, then trim it to the bound. The Cache API has no
 * sizes or access times, so the bound is an entry count and the oldest go
 * first, which only ever costs a refetch. The app shell, oldest of all and the
 * offline fallback, is never evicted.
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
      // Pre-warm the app shell. Failures are tolerated: a request
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

  // Pages: network first so a new deploy reaches the student. Each page caches
  // under its own URL, since one shared "/" key would show offline /learn as
  // whichever page loaded last. waitUntil keeps a stopping worker from
  // dropping the write half done.
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
            // last resort: no cached copy and no shell, so retry the network
            // and let it fail visibly.
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
        // /examples paths carry no build hash, so an edited program keeps its
        // URL. Serve the cached copy for speed and refresh it in the
        // background so the next load is current.
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
