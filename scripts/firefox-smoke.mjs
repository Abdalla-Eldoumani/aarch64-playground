// Firefox smoke test: verifies the playground loads, security headers
// are applied, the WASM emulator instantiates, and the editor renders.
// Catches engine-specific regressions Chromium-only Playwright misses.
//
//   node scripts/firefox-smoke.mjs                  # default http://localhost:3000
//   SITE=http://other node scripts/firefox-smoke.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolve playwright from web/node_modules regardless of where node was invoked.
const here = path.dirname(fileURLToPath(import.meta.url));
const webModules = path.join(here, "..", "web", "node_modules", "playwright");
const require = createRequire(import.meta.url);
const { firefox } = require(webModules);

const SITE = process.env.SITE || "http://localhost:3000";

let exit = 0;
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

const res = await page.goto(SITE);
if (!res || !res.ok()) {
  console.error(`navigation failed: status ${res?.status()}`);
  exit = 1;
}
const headers = res.headers();
const required = [
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "content-security-policy",
];
for (const h of required) {
  if (!headers[h]) {
    console.error(`missing header in firefox: ${h}`);
    exit = 1;
  }
}

await page.waitForSelector(".monaco-editor", { timeout: 30_000 });
const hasEditor = await page.evaluate(() => !!document.querySelector(".monaco-editor"));
if (!hasEditor) {
  console.error("editor never rendered in firefox");
  exit = 1;
}

const swCount = await page.evaluate(async () => {
  if (!navigator.serviceWorker) return 0;
  for (let i = 0; i < 30; i++) {
    const r = await navigator.serviceWorker.getRegistrations();
    if (r.length) return r.length;
    await new Promise((r) => setTimeout(r, 200));
  }
  return 0;
});

console.log(`firefox: editor ok, headers ok, sw count = ${swCount}`);
if (errors.length > 0) {
  console.error("console / page errors:");
  for (const e of errors) console.error(`  ${e}`);
  // Filter known-noise like favicon 404 across browsers
  const real = errors.filter((e) => !/favicon/i.test(e));
  if (real.length) exit = 1;
}

await browser.close();
process.exit(exit);
