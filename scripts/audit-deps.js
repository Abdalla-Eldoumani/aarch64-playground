#!/usr/bin/env node
/*
 * Wraps `npm audit --json` against web/ so the result is machine-readable
 * and exits non-zero on any moderate-or-higher finding. Vercel's build
 * already runs npm install --no-audit, so this script is the gate that
 * fails CI when a new advisory lands on a dep we ship.
 *
 *   node scripts/audit-deps.js                   # production deps + dev
 *   node scripts/audit-deps.js --omit=dev        # production only
 *
 * Exits 0 when no advisory at moderate or higher is present.
 */

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const FAIL_AT = SEVERITY_RANK.moderate;

// Whitelist of accepted args so a stray quote or shell metachar can't
// reach npm. Anything not in this list is dropped with a warning.
const ALLOWED_ARGS = new Set(["--omit=dev", "--omit=optional", "--production"]);

const passthrough = process.argv.slice(2).filter((arg) => {
  if (ALLOWED_ARGS.has(arg)) return true;
  console.error(`audit-deps: ignoring unrecognized arg ${JSON.stringify(arg)}`);
  return false;
});

const cwd = path.join(__dirname, "..", "web");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const args = ["audit", "--json", ...passthrough];

let stdout = "";
try {
  // shell:true is required for .cmd shims on Windows since Node 20's
  // CVE-2024-27980 mitigation rejects them via execFile. Args are
  // whitelisted above so injection isn't reachable.
  stdout = execFileSync(npmCmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: process.platform === "win32",
  });
} catch (e) {
  // npm audit exits non-zero whenever there are vulnerabilities. The
  // JSON body still lands on stdout in that case.
  stdout = e.stdout?.toString() ?? "";
  if (!stdout) {
    console.error(`npm audit failed: ${e.message}`);
    process.exit(2);
  }
}

let report;
try {
  report = JSON.parse(stdout);
} catch (e) {
  console.error(`could not parse npm audit JSON: ${e.message}`);
  console.error(stdout.slice(0, 500));
  process.exit(2);
}

const summary = report.metadata?.vulnerabilities ?? {};
console.log("npm audit summary (web/):");
for (const [sev, count] of Object.entries(summary)) {
  console.log(`  ${sev.padEnd(10)} ${count}`);
}

const failing = Object.entries(summary)
  .filter(([sev]) => SEVERITY_RANK[sev] !== undefined && SEVERITY_RANK[sev] >= FAIL_AT)
  .filter(([, count]) => count > 0);

if (failing.length === 0) {
  console.log("\nno moderate-or-higher advisories. clean.");
  process.exit(0);
}

console.error("\nadvisories:");
const advisories = report.vulnerabilities ?? {};
for (const [name, entry] of Object.entries(advisories)) {
  if (SEVERITY_RANK[entry.severity] >= FAIL_AT) {
    console.error(`  ${name} (${entry.severity}): ${entry.via?.[0]?.title ?? "see npm audit"}`);
  }
}

const total = failing.reduce((acc, [, n]) => acc + n, 0);
console.error(`\n${total} advisor${total === 1 ? "y" : "ies"} at moderate or higher.`);
process.exit(1);
