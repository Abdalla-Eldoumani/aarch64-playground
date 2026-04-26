#!/usr/bin/env node
/*
 * Verifies that the playground returns the security headers we promise
 * in docs/security.md and vercel.json. Defaults to the production URL;
 * pass an alternative origin as the first argument (or via SITE env)
 * to verify a preview deploy or `npm run dev`.
 *
 *   node scripts/check-headers.js
 *   node scripts/check-headers.js https://aarch64-playground-preview.vercel.app
 *   SITE=http://localhost:3000 node scripts/check-headers.js
 *
 * Exits 0 on success, 1 on any header mismatch or fetch failure.
 */

const SITE = process.argv[2] || process.env.SITE || "https://aarch64-playground.vercel.app";

const REQUIRED = {
  "x-content-type-options": (v) => v === "nosniff",
  "x-frame-options": (v) => v === "DENY",
  "referrer-policy": (v) => v === "strict-origin-when-cross-origin",
  "permissions-policy": (v) => /camera=\(\)/.test(v) && /microphone=\(\)/.test(v),
  "cross-origin-opener-policy": (v) => v === "same-origin",
  "content-security-policy": (v) =>
    /default-src 'self'/.test(v) &&
    /'wasm-unsafe-eval'/.test(v) &&
    /frame-ancestors 'none'/.test(v) &&
    /object-src 'none'/.test(v),
};

async function main() {
  let res;
  try {
    res = await fetch(SITE, { redirect: "manual" });
  } catch (e) {
    console.error(`fetch failed: ${e.message}`);
    process.exit(1);
  }
  console.log(`GET ${SITE} -> ${res.status}`);
  if (!res.ok) {
    console.error("non-2xx response, header check skipped");
    process.exit(1);
  }
  let failures = 0;
  for (const [name, predicate] of Object.entries(REQUIRED)) {
    const value = res.headers.get(name);
    if (!value) {
      console.error(`MISS  ${name}`);
      failures++;
      continue;
    }
    if (!predicate(value)) {
      console.error(`BAD   ${name}: ${value}`);
      failures++;
      continue;
    }
    console.log(`OK    ${name}`);
  }
  if (failures > 0) {
    console.error(`\n${failures} header check(s) failed`);
    process.exit(1);
  }
  console.log(`\nall ${Object.keys(REQUIRED).length} security headers present and valid`);
}

main();
