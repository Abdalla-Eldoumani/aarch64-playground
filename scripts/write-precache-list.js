#!/usr/bin/env node
/*
 * Writes web/public/sw.js, the service worker: the list of addresses it keeps
 * for offline use, read from the build beside it, then the worker's code from
 * web/lib/playground/sw.js. `npm run build` runs it after next build, so the
 * list always names the files of the build it ships with
 * (scripts/vercel-build.sh builds through that script).
 *
 *   node scripts/write-precache-list.js
 *   node scripts/write-precache-list.js --check   (public/sw.js lists this build?)
 *
 * The core set is the playground, the offline page, and every file a page can
 * load: the build's static output (chunks, CSS, fonts, the emulator's .wasm),
 * the example programs, the icons, and the other prerendered files such as
 * the manifest. The worker saves it on install. Every other prerendered page
 * goes in a second set, saved when the reader asks for every page.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const WEB_DIR = path.join(__dirname, "..", "web");
const WORKER_SOURCE = path.join(WEB_DIR, "lib", "playground", "sw.js");
const OUT_FILE = path.join(WEB_DIR, "public", "sw.js");

/** Pages the worker saves on install: the manifest's start page, and the page
 *  it answers with when an unsaved page is opened offline. */
const CORE_PAGES = ["/playground", "/offline"];

/** Folders under public/ that the playground fetches from at run time. */
const PUBLIC_FOLDERS = ["examples", "icons"];

/** Every file under dir, as paths relative to it with forward slashes. */
function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * The address as the browser requests it. Next writes `[slug]` folders into
 * its pages as `%5Bslug%5D`, and the worker matches addresses exactly.
 */
function address(pathname) {
  return encodeURI(pathname);
}

/**
 * Gzip size stands in for the download size: hosts send these files
 * compressed, and brotli, where used, comes out smaller still.
 */
function downloadBytes(file) {
  return zlib.gzipSync(fs.readFileSync(file)).length;
}

/**
 * Prerendered files a build wrote under server/route-cache, by route. A build
 * with a deployment adapter (Vercel sets NEXT_ADAPTER_PATH) writes them there,
 * at <kind>/<hash of the source page>/$<route>.html or .body, instead of
 * under server/app. The hash is Next's own, so the files are found by name.
 */
function routeCacheOutputs(nextDir) {
  const cacheDir = path.join(nextDir, "server", "route-cache");
  const byRoute = new Map();
  if (!fs.existsSync(cacheDir)) return byRoute;
  for (const rel of walk(cacheDir)) {
    const match = /^[^/]+\/[^/]+\/\$(\/.+\.(?:html|body))$/.exec(rel);
    if (match) byRoute.set(match[1], path.join(cacheDir, rel));
  }
  return byRoute;
}

/**
 * Reads a finished build under webDir and returns the two sets. Throws when
 * the build is missing a core page, since a worker without the playground
 * would install and then fail the reader offline.
 */
function collectPrecache(webDir) {
  const nextDir = path.join(webDir, ".next");
  const appDir = path.join(nextDir, "server", "app");
  const build = fs.readFileSync(path.join(nextDir, "BUILD_ID"), "utf8").trim();
  const manifest = JSON.parse(fs.readFileSync(path.join(nextDir, "prerender-manifest.json"), "utf8"));
  const cached = routeCacheOutputs(nextDir);
  const output = (stem, ext) => {
    const plain = path.join(appDir, `${stem}${ext}`);
    return fs.existsSync(plain) ? plain : cached.get(`/${stem}${ext}`);
  };

  const pages = [];
  const files = [];
  for (const route of Object.keys(manifest.routes).sort()) {
    // The 404 and error shells answer for addresses that do not exist; Next
    // serves them itself and they are never opened by address.
    if (route.startsWith("/_")) continue;
    const stem = route === "/" ? "index" : route.slice(1);
    const html = output(stem, ".html");
    const body = output(stem, ".body");
    if (html) pages.push({ url: address(route), file: html });
    else if (body) files.push({ url: address(route), file: body });
    else throw new Error(`no prerendered output for ${route}`);
  }

  const staticDir = path.join(nextDir, "static");
  for (const rel of walk(staticDir)) {
    files.push({ url: address(`/_next/static/${rel}`), file: path.join(staticDir, rel) });
  }
  for (const folder of PUBLIC_FOLDERS) {
    const dir = path.join(webDir, "public", folder);
    for (const rel of walk(dir)) {
      files.push({ url: address(`/${folder}/${rel}`), file: path.join(dir, rel) });
    }
  }

  const corePages = pages.filter((page) => CORE_PAGES.includes(page.url));
  const missing = CORE_PAGES.filter((url) => !corePages.some((page) => page.url === url));
  if (missing.length > 0) throw new Error(`the build has no ${missing.join(", ")} page`);
  const otherPages = pages.filter((page) => !CORE_PAGES.includes(page.url));
  const sum = (entries) => entries.reduce((total, entry) => total + downloadBytes(entry.file), 0);
  const stored = (entries) => entries.reduce((total, entry) => total + fs.statSync(entry.file).size, 0);

  return {
    build,
    corePages: corePages.map((page) => page.url),
    files: files.map((file) => file.url).sort(),
    otherPages: otherPages.map((page) => page.url),
    otherBytes: sum(otherPages),
    // Not read by the worker: the summary line prints them.
    coreBytes: sum([...corePages, ...files]),
    coreStoredBytes: stored([...corePages, ...files]),
    otherStoredBytes: stored(otherPages),
  };
}

/**
 * The served worker: one global holding the list, then the worker's code.
 * The list carries the build id, so every build's worker is different bytes,
 * which is what a browser checks to start an update.
 */
function renderWorker(list, source) {
  const { coreBytes, coreStoredBytes, otherStoredBytes, ...forWorker } = list;
  return (
    "// Written by scripts/write-precache-list.js after next build. Not tracked.\n" +
    `self.PRECACHE = ${JSON.stringify(forWorker)};\n` +
    source
  );
}

function megabytes(bytes) {
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

/** The list a written worker carries, or null when it carries none. */
function workerList(text) {
  const match = /^self\.PRECACHE = (\{.*\});$/m.exec(text);
  return match ? JSON.parse(match[1]) : null;
}

/** Whether a written list names exactly this build's id, pages and files. */
function sameFiles(list, written) {
  const keys = ["build", "corePages", "files", "otherPages"];
  return written !== null && keys.every((key) => JSON.stringify(list[key]) === JSON.stringify(written[key]));
}

function main() {
  const list = collectPrecache(WEB_DIR);
  if (process.argv.includes("--check")) {
    // vercel-build.sh's second build ships the worker its first build wrote,
    // so the worker must still name this build's files.
    if (!sameFiles(list, workerList(fs.readFileSync(OUT_FILE, "utf8")))) {
      console.error(`public/sw.js does not list the files of build ${list.build}`);
      process.exitCode = 1;
    } else console.log(`public/sw.js lists the files of build ${list.build}`);
    return;
  }
  fs.writeFileSync(OUT_FILE, renderWorker(list, fs.readFileSync(WORKER_SOURCE, "utf8")));
  const coreCount = list.corePages.length + list.files.length;
  console.log(
    `precache list for build ${list.build}: core ${coreCount} entries, ` +
      `${megabytes(list.coreBytes)} download, ${megabytes(list.coreStoredBytes)} stored; ` +
      `other pages ${list.otherPages.length}, ${megabytes(list.otherBytes)} download, ` +
      `${megabytes(list.otherStoredBytes)} stored`,
  );
}

// A test loads the functions without touching the real build.
if (require.main === module) main();

module.exports = { CORE_PAGES, collectPrecache, renderWorker, workerList, sameFiles };
