#!/usr/bin/env node
/*
 * Brotli budget for the JavaScript a route's document actually loads.
 *
 * size-limit can only glob file names, and the App Router's shared chunks
 * are named by webpack-assigned ids that move whenever the module graph
 * moves. A glob over those ids measures the wrong chunk the moment a
 * refactor renumbers them, which is how the xterm budget once ended up
 * measuring nothing. So this reads the build's own manifests
 * instead of guessing at names: the root set from build-manifest.json, and
 * the per-route set from app-build-manifest.json when the build emits one,
 * otherwise from the prerendered document's own <script src> list, which is
 * exactly what the browser fetches.
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
 * One budget per prerendered entry document. `page` is the
 * app-build-manifest key; `document` is the prerendered HTML that answers
 * the same question when that manifest is absent. Limits are the measured
 * brotli total plus ten percent, so a limit far above the measurement (a
 * budget that can never fire) is a bug to fix here.
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
    // 234,934 B brotli measured.
    limit: 258_400,
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
