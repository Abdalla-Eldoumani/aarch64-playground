// Chromium smoke test against a production build (`next build`, then
// `next start`) running the real WebAssembly emulator: the playground loads
// with a clean console, a program assembles, runs and prints, stepping
// leaves the expected registers, checks opened from a share link report a
// pass and a fail, and the stack tab's frames show the locals example's
// two ints at their offsets after its scanf.
//
//   node scripts/browser-smoke.mjs                   # http://localhost:3000
//   SITE=http://localhost:4000 node scripts/browser-smoke.mjs
//   CHROMIUM_PATH=/path/to/chrome node scripts/browser-smoke.mjs
//   PROBE_TOKEN=... SITE=https://aarch64-playground.com node scripts/browser-smoke.mjs

import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { realErrors } from "./smoke-noise.mjs";

// Playwright resolves from web/node_modules wherever node was invoked.
const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, "..", "web");
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(web, "node_modules", "playwright"));

// The site's own share encoder, so a change to the link format reaches this
// test. Node strips the types; this hook resolves the web code's `@/` alias.
registerHooks({
  resolve: (specifier, context, next) =>
    next(specifier.startsWith("@/") ? pathToFileURL(path.join(web, `${specifier.slice(2)}.ts`)).href : specifier, context),
});
const { buildShareHash } = await import(pathToFileURL(path.join(web, "lib", "playground", "share.ts")).href);

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

/** A `#p2=` link as the share dialog writes it. */
function shareUrl(state) {
  return new URL(`/playground${buildShareHash(state)}`, site).href;
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
// Production's bot challenge lets a request carrying the probe header
// through. Only the site under test gets it: the page also calls Vercel's
// analytics hosts.
const probeToken = process.env.PROBE_TOKEN;
if (probeToken) {
  await context.route(
    (url) => url.origin === site.origin,
    (route) => route.continue({ headers: { ...route.request().headers(), "x-playground-probe": probeToken } }),
  );
}
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
  // A click waits for the button to be enabled, which it is once the program loads.
  const step = async (count, done = 0) => {
    for (let i = done + 1; i <= done + count; i++) {
      await page.getByRole("button", { name: "step", exact: true }).click();
      await page.getByLabel(`${i} ${i === 1 ? "instruction" : "instructions"} executed`).waitFor();
    }
  };

  const response = await page.goto(shareUrl({ source: PROGRAM }), { waitUntil: "load" });
  expect(response?.ok() === true, `the playground answers (${response?.status()})`);
  // The run row's assemble; the empty disassembly pane offers one too.
  const assemble = page.locator('[data-walkthrough="assemble"]');
  await assemble.waitFor();

  // Stepping: stp, mov, then the three moves into x19, x20 and x21.
  await assemble.click();
  await step(5);
  expect(asNumber(await register("x19")) === 42, "stepping writes 42 into x19");
  expect(asNumber(await register("x21")) === 49, "stepping writes 49 into x21");

  // Running to the end prints into the console.
  await page.getByRole("button", { name: "run", exact: true }).click();
  await page.getByRole("tab", { name: /^console/ }).click();
  await page.getByText("smoke 49").waitFor();
  expect(true, "the run prints its output in the console");
  expect(await page.getByText("exit 0", { exact: true }).isVisible(), "the console shows exit 0");

  // Checks from a link: one right, one deliberately wrong. about:blank first,
  // so the link boots the page as a fresh tab would, not as a hash change.
  await page.goto("about:blank");
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
  await page.getByRole("tab", { name: "checks", selected: true }).waitFor();
  expect(true, "a link with checks opens the checks tab");
  await page.getByRole("button", { name: "run checks" }).click();
  await page.getByRole("status").filter({ hasText: "1 of 2 checks pass" }).waitFor();
  expect(true, "the checks report 1 of 2 passing");
  expect(await page.getByText("wrong output").isVisible(), "the wrong check reports wrong output");
  expect(await page.getByText('"smoke 50"').isVisible(), "the wrong check shows the expected line");

  // The frames: the shipped locals example reads 7 and 4 with one scanf into
  // a_s = 16 and b_s = 20, as the course's slides lay out its frame.
  await page.goto("about:blank");
  const locals = readFileSync(path.join(web, "public", "examples", "cpsc355", "locals.s"), "utf8");
  await page.goto(shareUrl({ source: locals }), { waitUntil: "load" });
  await assemble.click();
  // stp, mov, ldr, bl printf and its three runtime steps, ldr, add, add, then
  // bl scanf and its three, the last waiting for input. The playground drops
  // a link's stdin so a program waits for the student, so it is typed here.
  await step(14);
  await page.getByRole("textbox", { name: "Standard input" }).fill("7 4");
  await page.getByRole("button", { name: "send", exact: true }).click();
  // scanf returns into main, at ldr a_r, [fp, a_s].
  await step(1, 14);
  await page.getByRole("tab", { name: /^stack/ }).click();
  await page.getByRole("group", { name: "frames or bytes" }).getByRole("button", { name: "frames" }).click();
  const mainFrame = page.getByRole("list", { name: "main's frame, high address first" });
  // The box at that offset, so a value elsewhere on the page cannot pass.
  const slot = (offset) => mainFrame.getByRole("listitem").filter({ has: page.getByText(offset, { exact: true }) });
  await slot("fp + 16").getByText("a_s = 7", { exact: true }).waitFor();
  expect(true, "the frames show a_s = 7 at fp + 16 after the scanf");
  await slot("fp + 20").getByText("b_s = 4", { exact: true }).waitFor();
  expect(true, "the frames show b_s = 4 at fp + 20 after the scanf");
} catch (error) {
  expect(false, `the run reached its end (${error instanceof Error ? error.message : error})`);
} finally {
  const real = realErrors(errors);
  expect(real.length === 0, `no console or page errors${real.length ? `:\n  ${real.join("\n  ")}` : ""}`);
  await browser.close();
}

process.exitCode = failures.length > 0 ? 1 : 0;
