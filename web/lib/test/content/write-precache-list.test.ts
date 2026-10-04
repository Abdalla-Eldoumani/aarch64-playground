import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

// scripts/write-precache-list.js turns a finished build into the service
// worker: its two lists, then the worker's code. It is CommonJS one level
// above web/ (vitest's cwd), so it is loaded by path and run against a small
// build laid out on disk.
const nodeRequire = createRequire(import.meta.url);
const { collectPrecache, renderWorker, workerList, sameFiles } = nodeRequire(
  path.join(process.cwd(), "..", "scripts", "write-precache-list.js"),
) as {
  collectPrecache: (webDir: string) => Record<string, unknown> & {
    corePages: string[];
    files: string[];
    otherPages: string[];
    coreBytes: number;
    otherBytes: number;
  };
  renderWorker: (list: object, source: string) => string;
  workerList: (text: string) => Record<string, unknown> | null;
  sameFiles: (list: object, written: Record<string, unknown> | null) => boolean;
};
const WORKER_SOURCE = fs.readFileSync(path.join(process.cwd(), "lib", "playground", "sw.js"), "utf8");

const made: string[] = [];

afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function write(root: string, rel: string, body: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

/**
 * A build with the routes Next prerenders for this site, in miniature. With
 * `adapter`, the prerendered files sit where a deployment adapter's build
 * writes them: server/route-cache/<kind>/<hash of the source page>/$<route>.
 */
function fakeBuild(
  routes = ["/", "/playground", "/offline", "/learn/loops", "/_not-found", "/manifest.webmanifest"],
  build = "abc123",
  adapter = false,
) {
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "precache-"));
  made.push(web);
  write(web, ".next/BUILD_ID", `${build}\n`);
  write(
    web,
    ".next/prerender-manifest.json",
    JSON.stringify({ routes: Object.fromEntries(routes.map((route) => [route, {}])) }),
  );
  for (const route of routes) {
    const stem = route === "/" ? "index" : route.slice(1);
    const handler = route.endsWith(".webmanifest");
    const at = adapter
      ? `.next/server/route-cache/${handler ? "APP_ROUTE" : "APP_PAGE"}/9f2c${stem.length}/$/${stem}`
      : `.next/server/app/${stem}`;
    if (handler) write(web, `${at}.body`, "{}");
    else write(web, `${at}.html`, `<html>${"page ".repeat(50)}</html>`);
  }
  write(web, ".next/static/chunks/main-1.js", "console.log(1)");
  write(web, ".next/static/chunks/app/(site)/learn/[slug]/page-2.js", "console.log(2)");
  write(web, ".next/static/media/emulator.wasm", "\0asm");
  write(web, "public/examples/cpsc355/basics.s", "main:\n");
  write(web, "public/examples/cpsc355/dsav/array.s", "array:\n");
  write(web, "public/icons/icon-192.png", "png");
  write(web, "public/og.png", "not needed offline");
  return web;
}

describe("the precache list", () => {
  it("puts the playground, the offline page and every file in the core set", () => {
    const list = collectPrecache(fakeBuild());
    expect(list.build).toBe("abc123");
    expect(list.corePages).toEqual(["/offline", "/playground"]);
    expect(list.files).toEqual([
      "/_next/static/chunks/app/(site)/learn/%5Bslug%5D/page-2.js",
      "/_next/static/chunks/main-1.js",
      "/_next/static/media/emulator.wasm",
      "/examples/cpsc355/basics.s",
      "/examples/cpsc355/dsav/array.s",
      "/icons/icon-192.png",
      "/manifest.webmanifest",
    ]);
  });

  it("leaves every other page to the save-every-page set, and the 404 shell out", () => {
    const list = collectPrecache(fakeBuild());
    expect(list.otherPages).toEqual(["/", "/learn/loops"]);
    expect(JSON.stringify(list)).not.toContain("_not-found");
    expect(JSON.stringify(list)).not.toContain("og.png");
  });

  it("measures both sets as compressed downloads", () => {
    const list = collectPrecache(fakeBuild());
    expect(list.coreBytes).toBeGreaterThan(0);
    // Two pages of repeated text compress to well under their stored size.
    expect(list.otherBytes).toBeGreaterThan(0);
    expect(list.otherBytes).toBeLessThan(2 * 270);
  });

  it("finds the pages a deployment adapter's build wrote under route-cache", () => {
    // Vercel builds with an adapter, so its prerendered files are not under
    // server/app; a list that only looked there failed the deploy.
    const list = collectPrecache(fakeBuild(undefined, "abc123", true));
    expect(list.corePages).toEqual(["/offline", "/playground"]);
    expect(list.otherPages).toEqual(["/", "/learn/loops"]);
    expect(list.files).toContain("/manifest.webmanifest");
    expect(list.otherBytes).toBeGreaterThan(0);
  });

  it("refuses a build without the playground or the offline page", () => {
    expect(() => collectPrecache(fakeBuild(["/", "/playground"]))).toThrow(/\/offline/);
  });

  it("refuses a route with no prerendered output", () => {
    const web = fakeBuild();
    fs.rmSync(path.join(web, ".next/server/app/learn/loops.html"));
    expect(() => collectPrecache(web)).toThrow(/\/learn\/loops/);
  });

  it("hands the worker the lists and nothing else", () => {
    const list = collectPrecache(fakeBuild());
    const scope: { PRECACHE?: Record<string, unknown> } = {};
    vm.runInNewContext(renderWorker(list, ""), { self: scope });
    expect(Object.keys(scope.PRECACHE ?? {}).sort()).toEqual(
      ["build", "corePages", "files", "otherBytes", "otherPages"].sort(),
    );
    expect(scope.PRECACHE?.files).toEqual(list.files);
  });

  it("writes a worker whose own bytes differ between two builds of the same code", () => {
    // A browser starts an update only when the worker script's bytes change;
    // Safari may not re-check a script the worker imports.
    const first = renderWorker(collectPrecache(fakeBuild(undefined, "abc123")), WORKER_SOURCE);
    const second = renderWorker(collectPrecache(fakeBuild(undefined, "def456")), WORKER_SOURCE);
    expect(first).not.toBe(second);
    expect(first.endsWith(WORKER_SOURCE)).toBe(true);
    expect(second.endsWith(WORKER_SOURCE)).toBe(true);
    expect(WORKER_SOURCE).not.toMatch(/importScripts/);
  });
});

describe("the deploy's second-build check", () => {
  it("reads back the list a written worker carries", () => {
    const list = collectPrecache(fakeBuild());
    const written = workerList(renderWorker(list, WORKER_SOURCE));
    expect(sameFiles(list, written)).toBe(true);
  });

  it("refuses a worker written by another build or naming other files", () => {
    const list = collectPrecache(fakeBuild());
    const other = workerList(renderWorker(collectPrecache(fakeBuild(undefined, "def456")), WORKER_SOURCE));
    expect(sameFiles(list, other)).toBe(false);
    const web = fakeBuild();
    write(web, ".next/static/chunks/main-2.js", "console.log(3)");
    const moreFiles = workerList(renderWorker(collectPrecache(web), WORKER_SOURCE));
    expect(sameFiles(list, moreFiles)).toBe(false);
  });

  it("refuses a worker with no list", () => {
    expect(sameFiles(collectPrecache(fakeBuild()), workerList(WORKER_SOURCE))).toBe(false);
  });
});
