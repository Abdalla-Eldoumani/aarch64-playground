// Service worker for AArch64 Playground. After next build,
// scripts/write-precache-list.js writes it to public/sw.js below that build's
// list (self.PRECACHE). Each build keeps one cache, named after its build id.
// - Install saves the core set (the playground, the offline page, and every
//   file a page can load) all or nothing, so a half-saved build never serves.
// - A new build's worker waits until no page of the old build is open, then
//   deletes every other cache: an open page keeps the files it was built
//   with, and a page never loads another build's files.
// - Pages come from the network first, and from the cache offline.
// - Only a 2xx answer from this build is stored, so the host's challenge page
//   or an error page never replaces a saved one.

// The list is part of the served worker's own bytes, so every build's worker
// differs and the browser's byte check starts the update. An imported list
// would rely on the browser re-checking imports, which Safari may skip. A
// failed check (offline, or the host's challenge) leaves the old worker serving.
const { build: BUILD, corePages, files, otherPages, otherBytes } = self.PRECACHE;
const CACHE = `aarch64-playground-${BUILD}`;
const PAGES = new Set([...corePages, ...otherPages]);
const FILES = new Set(files);
const OFFLINE_PAGE = "/offline";
// When the reader saved every page. No page or file lives at this address,
// so the fetch handler never serves it.
const SAVED_KEY = "/sw-saved-every-page";

/** A page the host now serves from a newer deploy than this worker's. */
class StaleBuildError extends Error {}

/** A 2xx straight from this site, not a redirect and not the host's bot
 *  challenge (which can answer with its own page). */
function storable(res) {
  return res.ok && !res.redirected && !res.headers.has("x-vercel-mitigated");
}

/**
 * Fetches one address for the cache. A page must also come from this build:
 * a newer deploy's page would ask for files this cache does not hold.
 */
async function fetchForCache(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!storable(res)) throw new Error(`${url} answered ${res.status}`);
  if (PAGES.has(url) && !(await res.clone().text()).includes(BUILD)) {
    throw new StaleBuildError(url);
  }
  return res;
}

/**
 * A file under /_next/static/ is named after its content, so a copy an older
 * build saved is this build's file too. Reusing it means a deploy that changed
 * little (a star-count rebuild changes nothing but the build id) downloads
 * little.
 */
async function reuseOrFetch(url) {
  if (url.startsWith("/_next/static/")) {
    const saved = await caches.match(url);
    if (saved) return saved;
  }
  return fetchForCache(url);
}

self.addEventListener("install", (event) => {
  event.waitUntil(installBuild());
});

async function installBuild() {
  // A reader who saved every page under the last build keeps them across
  // the update.
  const keepEveryPage = Boolean(await caches.match(SAVED_KEY));
  const cache = await caches.open(CACHE);
  try {
    const urls = [...corePages, ...files, ...(keepEveryPage ? otherPages : [])];
    await Promise.all(urls.map(async (url) => cache.put(url, await reuseOrFetch(url))));
    if (keepEveryPage) await markSaved(cache);
  } catch (err) {
    // The failed install is discarded by the browser; its partial cache
    // must go with it.
    await caches.delete(CACHE);
    throw err;
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(openPage(event, url.pathname));
  } else if (FILES.has(url.pathname)) {
    event.respondWith(openFile(req));
  } else if (req.headers.get("RSC") === "1") {
    // The router's page data, which is not cached. Offline, an empty 204
    // makes Next drop a prefetch and turn a link click into a full page
    // load, which openPage answers, where a failed fetch would log errors.
    event.respondWith(fetch(req).catch(() => new Response(null, { status: 204 })));
  }
  // Anything else, such as the analytics scripts, goes to the network
  // untouched.
});

async function openFile(req) {
  const cache = await caches.open(CACHE);
  // The search part is dropped because the icons are linked with a hash
  // query; every listed file has one copy per build.
  return (await cache.match(req, { ignoreSearch: true, ignoreVary: true })) || fetch(req);
}

async function openPage(event, pathname) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(event.request);
    // Whatever the network says is shown, the challenge page included, so
    // the reader can pass it; only a page from this build is kept.
    if (PAGES.has(pathname) && storable(res)) {
      event.waitUntil(keepIfThisBuild(cache, pathname, res.clone()));
    }
    return res;
  } catch {
    const saved = PAGES.has(pathname) && (await cache.match(pathname, { ignoreVary: true }));
    return saved || (await cache.match(OFFLINE_PAGE, { ignoreVary: true })) || Response.error();
  }
}

async function keepIfThisBuild(cache, pathname, res) {
  if ((await res.clone().text()).includes(BUILD)) await cache.put(pathname, res);
}

// "Save every page": the page asks, this worker fetches, and every open tab
// hears the progress.

/** The save in progress, shared by every tab that asks for it. */
let saving = null;
/** { done, total } while a save runs. */
let progress = null;
/** Why the last save stopped: "network", "storage", "update", or null. */
let failure = null;

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "offline-status") event.waitUntil(broadcast());
  else if (type === "save-every-page") event.waitUntil(saveEveryPage());
});

async function saveEveryPage() {
  if (!saving) {
    saving = runSave().finally(() => {
      saving = null;
      progress = null;
    });
  }
  await saving;
  await broadcast();
}

async function runSave() {
  const cache = await caches.open(CACHE);
  const have = new Set((await cache.keys()).map((req) => new URL(req.url).pathname));
  const todo = otherPages.filter((url) => !have.has(url));
  progress = { done: otherPages.length - todo.length, total: otherPages.length };
  failure = null;
  await broadcast();
  const results = await Promise.allSettled(
    todo.map(async (url) => {
      await cache.put(url, await fetchForCache(url));
      progress.done += 1;
      await broadcast();
    }),
  );
  const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason);
  if (errors.length === 0) await markSaved(cache);
  else if (errors.some((err) => err instanceof StaleBuildError)) failure = "update";
  else if (errors.some((err) => err && err.name === "QuotaExceededError")) failure = "storage";
  else failure = "network";
}

function markSaved(cache) {
  return cache.put(SAVED_KEY, new Response(new Date().toISOString()));
}

async function broadcast() {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(SAVED_KEY);
  const status = {
    type: "offline-status",
    bytes: otherBytes,
    savedAt: saved ? await saved.text() : null,
    saving: progress && { ...progress },
    failure,
  };
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage(status);
}
