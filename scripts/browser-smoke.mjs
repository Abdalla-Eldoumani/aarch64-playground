// Chromium smoke test against a production build (`next build`, then
// `next start`) running the real WebAssembly emulator: the playground loads
// with a clean console, a program assembles, runs and prints, stepping
// leaves the expected registers, and checks opened from a share link report
// a pass and a fail.
//
//   node scripts/browser-smoke.mjs                   # http://localhost:3000
//   SITE=http://localhost:4000 node scripts/browser-smoke.mjs
//   CHROMIUM_PATH=/path/to/chrome node scripts/browser-smoke.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Playwright and lz-string resolve from web/node_modules wherever node was invoked.
const here = path.dirname(fileURLToPath(import.meta.url));
const webModules = path.join(here, "..", "web", "node_modules");
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(webModules, "playwright"));
const LZString = require(path.join(webModules, "lz-string"));

const site = new URL(process.env.SITE || "http://localhost:3000");
const STEP_TIMEOUT = 30_000;

const PROGRAM = `        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x19, 42
        mov     x20, 7
        add     x21, x19, x20
        ldr     x0, =fmt
        mov     x1, x21
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret

        .data
fmt:    .string "smoke %ld\\n"
`;

/** A `#p2=` link as the share dialog writes it; the checksum is optional. */
function shareUrl(state) {
  const url = new URL("/playground", site);
  url.hash = `p2=${LZString.compressToEncodedURIComponent(JSON.stringify(state))}`;
  return url.href;
}

const failures = [];
function expect(ok, what) {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
// The wide layout: the right-hand tabs sit beside the editor.
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
// Every wait is bounded, so a broken page fails here instead of hanging the job.
page.setDefaultTimeout(STEP_TIMEOUT);
const errors = [];
page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()} ${msg.location().url}`);
});

try {
  // The register value as the panel shows it, hex or decimal.
  const register = (name) =>
    page.evaluate((reg) => {
      for (const row of document.querySelectorAll("div.font-mono")) {
        const label = row.firstElementChild;
        if (label?.textContent?.trim().toLowerCase() === reg) {
          return row.querySelector("[title]")?.getAttribute("title") ?? null;
        }
      }
      return null;
    }, name);
  const asNumber = (text) => (text == null ? NaN : Number(BigInt(text.replace(/[\s_]/g, ""))));

  const response = await page.goto(shareUrl({ source: PROGRAM }), { waitUntil: "load" });
  expect(response?.ok() === true, `the playground answers (${response?.status()})`);
  // The run row's assemble; the empty disassembly pane offers one too.
  const assemble = page.locator('[data-walkthrough="assemble"]');
  await assemble.waitFor();

  // Stepping: stp, mov, then the three moves into x19, x20 and x21.
  await assemble.click();
  // A click waits for the button to be enabled, which it is once the program loads.
  for (let i = 1; i <= 5; i++) {
    await page.getByRole("button", { name: "step", exact: true }).click();
    await page.getByLabel(`${i} ${i === 1 ? "instruction" : "instructions"} executed`).waitFor();
  }
  expect(asNumber(await register("x19")) === 42, "stepping writes 42 into x19");
  expect(asNumber(await register("x21")) === 49, "stepping writes 49 into x21");

  // Running to the end prints into the console.
  await page.getByRole("button", { name: "run", exact: true }).click();
  await page.getByRole("tab", { name: /^console/ }).click();
  await page.getByText("smoke 49").waitFor();
  expect(true, "the run prints its output in the console");
  expect(await page.getByText("exit 0", { exact: true }).isVisible(), "the console shows exit 0");

  // Checks from a link: one right, one deliberately wrong.
  await page.goto(
    shareUrl({
      source: PROGRAM,
      checks: [
        { name: "prints the sum", stdin: "", args: "", stdout: "smoke 49\n", exitCode: 0 },
        { name: "expects the wrong sum", stdin: "", args: "", stdout: "smoke 50\n" },
      ],
    }),
    { waitUntil: "load" },
  );
  const checksTab = page.getByRole("tab", { name: "checks" });
  await checksTab.waitFor();
  expect((await checksTab.getAttribute("aria-selected")) === "true", "a link with checks opens the checks tab");
  await page.getByRole("button", { name: "run checks" }).click();
  await page.getByRole("status").filter({ hasText: "1 of 2 checks pass" }).waitFor();
  expect(true, "the checks report 1 of 2 passing");
  expect(await page.getByText("wrong output").isVisible(), "the wrong check reports wrong output");
  expect(await page.getByText('"smoke 50"').isVisible(), "the wrong check shows the expected line");
} catch (error) {
  expect(false, `the run reached its end (${error instanceof Error ? error.message : error})`);
} finally {
  // Vercel's analytics scripts 404 under `next start`; nothing else is noise.
  const real = errors.filter((e) => !/favicon/i.test(e) && !/_vercel\/(insights|speed-insights)/i.test(e));
  expect(real.length === 0, `no console or page errors${real.length ? `:\n  ${real.join("\n  ")}` : ""}`);
  await browser.close();
}

process.exitCode = failures.length > 0 ? 1 : 0;
