#!/usr/bin/env node
/*
 * Brotli budget for the JavaScript each route's document loads.
 *
 * size-limit can only glob file names, and webpack renumbers the shared
 * chunks whenever the module graph moves, which once left the xterm budget
 * measuring nothing. This reads the build's own manifests instead: the root
 * set from build-manifest.json, and each route's set from
 * app-build-manifest.json, or from the prerendered page's <script src> tags
 * when the build emits no such manifest.
 *
 * It also holds every DOMPurify in the built chunks to the `overrides` pin in
 * web/package.json (checkDompurify below).
 *
 *   node scripts/bundle-budget.js
 *
 * Exits 0 when every route is inside its limit and every DOMPurify is at the
 * pin or newer, 1 otherwise.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const WEB_DIR = path.join(__dirname, "..", "web");
const NEXT_DIR = path.join(WEB_DIR, ".next");

/**
 * One budget per prerendered page. `page` is the app-build-manifest key and
 * `document` the prerendered HTML used when that manifest is absent. Each
 * limit is the measured brotli size plus ten percent; a limit far above the
 * measurement can never fire, so it is a bug.
 */
const ROUTES = [
  {
    name: "landing document js (every chunk / loads)",
    page: "/page",
    document: "index.html",
    // 211.26 kB brotli measured (2026-10-28).
    limit: 212_000,
  },
  {
    name: "playground document js (every chunk /playground loads)",
    page: "/playground/page",
    document: "playground.html",
    // 225.12 kB brotli measured (2026-10-28).
    limit: 226_000,
  },
];

// The same compression @size-limit/file applies, so the two tools' numbers
// match.
function brotliBytes(file) {
  return zlib.brotliCompressSync(fs.readFileSync(file), {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Print bytes the way size-limit does, so both halves of `npm run size` read alike. */
function format(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

/** The chunks every App Router document loads, whatever route it serves. */
function rootChunks() {
  const manifest = readJson(path.join(NEXT_DIR, "build-manifest.json"));
  return [...(manifest.rootMainFiles || []), ...(manifest.polyfillFiles || [])];
}

/** The chunks one route adds on top of the root set. */
function routeChunks(route) {
  const appManifest = path.join(NEXT_DIR, "app-build-manifest.json");
  if (fs.existsSync(appManifest)) {
    const pages = readJson(appManifest).pages || {};
    const entry = pages[route.page];
    if (entry) return entry;
  }
  const html = fs.readFileSync(path.join(NEXT_DIR, "server/app", route.document), "utf8");
  const tags = html.match(/<script src="\/_next\/(static\/chunks\/[^"]+\.js)"/g) || [];
  return tags.map((tag) => tag.replace(/^<script src="\/_next\//, "").replace(/"$/, ""));
}

function measure(route) {
  const files = [...new Set([...rootChunks(), ...routeChunks(route)])].sort();
  if (files.length === 0) {
    throw new Error(`${route.name}: no chunks found, so the budget would pass on nothing`);
  }
  let total = 0;
  for (const file of files) {
    const abs = path.join(NEXT_DIR, file);
    if (!fs.existsSync(abs)) {
      throw new Error(`${route.name}: the build names ${file}, which does not exist`);
    }
    total += brotliBytes(abs);
  }
  return { files: files.length, total };
}

// Minified, DOMPurify reads `n.version="3.4.17",n.removed=[]`; React and xterm
// also assign a bare `version`, so the `removed` after it marks DOMPurify.
const DOMPURIFY_VERSION = /\.version="(\d+)\.(\d+)\.(\d+)",[\w$]+\.removed=\[\]/g;

/** Every DOMPurify version a built chunk states, each as [major, minor, patch]. */
function dompurifyVersions(text) {
  return [...text.matchAll(DOMPURIFY_VERSION)].map((match) => match.slice(1, 4).map(Number));
}

/** True when `version` ([major, minor, patch]) comes before `pin`. */
function isOlder(version, pin) {
  for (let i = 0; i < 3; i++) {
    if (version[i] !== pin[i]) return version[i] < pin[i];
  }
  return false;
}

/**
 * monaco-editor bundles its own DOMPurify, which `overrides` cannot reach, so
 * next.config.mjs swaps it for the installed copy. A Monaco update that moves
 * that file would quietly ship the old copy again; this fails the job instead.
 * Returns the failure messages, empty when every copy is at the pin or newer.
 */
function checkDompurify() {
  const pinned = readJson(path.join(WEB_DIR, "package.json")).overrides?.dompurify;
  const exact = /^(\d+)\.(\d+)\.(\d+)$/.exec(pinned || "");
  if (!exact) throw new Error(`overrides.dompurify in web/package.json is "${pinned}", not an exact x.y.z version`);
  const pin = exact.slice(1).map(Number);

  const chunksDir = path.join(NEXT_DIR, "static", "chunks");
  const copies = [];
  for (const file of fs.readdirSync(chunksDir, { recursive: true })) {
    if (!file.endsWith(".js")) continue;
    const text = fs.readFileSync(path.join(chunksDir, file), "utf8");
    for (const version of dompurifyVersions(text)) copies.push({ file, version });
  }

  console.log("  dompurify in the built chunks");
  console.log(`  Pinned:     ${pinned} (overrides in web/package.json)`);
  if (copies.length === 0) {
    return [
      "found no DOMPurify version in .next/static/chunks, so this check would pass on nothing. " +
        "If the editor still bundles DOMPurify, the minifier now writes it differently: " +
        "update DOMPURIFY_VERSION in scripts/bundle-budget.js to match the built chunk. " +
        "If the editor no longer uses DOMPurify, remove this check and the replacement in next.config.mjs.",
    ];
  }
  const failures = [];
  for (const { file, version } of copies) {
    const tooOld = isOlder(version, pin);
    console.log(`  Found:      ${version.join(".")} in ${file}${tooOld ? " (older than the pin)" : ""}`);
    if (tooOld) {
      failures.push(
        `${file} ships DOMPurify ${version.join(".")}, older than the ${pinned} pinned in web/package.json. ` +
          "monaco-editor bundles its own copy at esm/vs/base/browser/dompurify/dompurify.js, and " +
          "next.config.mjs replaces that file with the installed dompurify. After a monaco-editor update, " +
          "check that the file still has that path and update the replacement in next.config.mjs to match.",
      );
    }
  }
  return failures;
}

function main() {
  if (!fs.existsSync(NEXT_DIR)) {
    console.error("bundle-budget: no web/.next: run `npm run build` in web/ first");
    process.exit(1);
  }

  let failed = false;
  for (const route of ROUTES) {
    const { files, total } = measure(route);
    const over = total - route.limit;
    console.log(`\n  ${route.name}`);
    if (over > 0) {
      failed = true;
      console.log(`  Budget exceeded by ${format(over)}`);
    }
    console.log(`  Size limit: ${format(route.limit)}`);
    console.log(`  Size:       ${format(total)} across ${files} chunks, brotlied`);
  }
  console.log("");

  const dompurify = checkDompurify();
  console.log("");
  for (const message of dompurify) console.error(`bundle-budget: ${message}`);

  if (failed || dompurify.length > 0) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`bundle-budget: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

module.exports = { dompurifyVersions };
