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
 *   node scripts/bundle-budget.js
 *
 * Exits 0 when every route is inside its limit, 1 otherwise.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const NEXT_DIR = path.join(__dirname, "..", "web", ".next");

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
    // 190,872 B brotli measured.
    limit: 210_000,
  },
  {
    name: "playground document js (every chunk /playground loads)",
    page: "/playground/page",
    document: "playground.html",
    // 203,920 B brotli measured.
    limit: 224_300,
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

  if (failed) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`bundle-budget: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
