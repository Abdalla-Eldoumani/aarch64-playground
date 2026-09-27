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

const SITE = process.argv[2] || process.env.SITE || "https://aarch64-playground.com";

// The host each source in a CSP names, from every directive of every policy
// (one header value can hold several, joined by commas). https: and http:
// admit any host, so they read as *; a keyword such as 'self' or another
// bare scheme such as blob: names none.
function cspHosts(policy) {
  return policy
    .split(/[;,]/)
    .flatMap((directive) => directive.trim().split(/\s+/).slice(1))
    .map((source) => (/^https?:$/i.test(source) ? "*" : source))
    .filter((source) => !source.startsWith("'") && !/^[a-z][a-z0-9+.-]*:$/i.test(source))
    .map((source) => source.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/:]/)[0].toLowerCase());
}

// Whole-host comparison, so a look-alike such as cdn.jsdelivr.net.example.com
// is not mistaken for the CDN, while a wildcard that covers it still counts.
function allowsHost(policy, host) {
  return cspHosts(policy).some(
    (h) => h === host || h === "*" || (h.startsWith("*.") && host.endsWith(h.slice(1))),
  );
}

const REQUIRED = {
  "x-content-type-options": (v) => v === "nosniff",
  "strict-transport-security": (v) => /max-age=\d/.test(v),
  "x-frame-options": (v) => v === "DENY",
  "referrer-policy": (v) => v === "strict-origin-when-cross-origin",
  "permissions-policy": (v) => /camera=\(\)/.test(v) && /microphone=\(\)/.test(v),
  "cross-origin-opener-policy": (v) => v === "same-origin",
  "content-security-policy": (v) =>
    /default-src 'self'/.test(v) &&
    /'wasm-unsafe-eval'/.test(v) &&
    /frame-ancestors 'none'/.test(v) &&
    /object-src 'none'/.test(v) &&
    // Monaco is vendored, so no third-party script origin may reappear, and
    // the dev-only eval allowance must never reach production.
    !allowsHost(v, "cdn.jsdelivr.net") &&
    !/'unsafe-eval'/.test(v),
};

async function main() {
  let res;
  try {
    // The production firewall challenges non-browser clients; a deploy
    // probe presents the bypass token when the operator has one.
    const headers = process.env.PROBE_TOKEN
      ? { "x-playground-probe": process.env.PROBE_TOKEN }
      : {};
    res = await fetch(SITE, { redirect: "manual", headers });
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

// A test loads the predicates without fetching anything.
if (require.main === module) main();

module.exports = { REQUIRED };
