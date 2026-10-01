import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

// scripts/write-precache-list.js turns a finished build into the service
// worker's two lists. It is CommonJS one level above web/ (vitest's cwd), so
// it is loaded by path and run against a small build laid out on disk.
const nodeRequire = createRequire(import.meta.url);
const { collectPrecache, renderPrecache } = nodeRequire(
  path.join(process.cwd(), "..", "scripts", "write-precache-list.js"),
) as {
  collectPrecache: (webDir: string) => Record<string, unknown> & {
    corePages: string[];
    files: string[];
    otherPages: string[];
    coreBytes: number;
    otherBytes: number;
  };
  renderPrecache: (list: object) => string;
};

const made: string[] = [];

afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function write(root: string, rel: string, body: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

/** A build with the routes Next prerenders for this site, in miniature. */
function fakeBuild(routes = ["/", "/playground", "/offline", "/learn/loops", "/_not-found", "/manifest.webmanifest"]) {
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "precache-"));
  made.push(web);
  write(web, ".next/BUILD_ID", "abc123\n");
  write(
    web,
    ".next/prerender-manifest.json",
    JSON.stringify({ routes: Object.fromEntries(routes.map((route) => [route, {}])) }),
  );
  for (const route of routes) {
    const stem = route === "/" ? "index" : route.slice(1);
    if (route.endsWith(".webmanifest")) write(web, `.next/server/app/${stem}.body`, "{}");
    else write(web, `.next/server/app/${stem}.html`, `<html>${"page ".repeat(50)}</html>`);
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

  it("refuses a build without the playground or the offline page", () => {
    expect(() => collectPrecache(fakeBuild(["/", "/playground"]))).toThrow(/\/offline/);
  });

  it("refuses a route with no prerendered output", () => {
    const web = fakeBuild();
    fs.rmSync(path.join(web, ".next/server/app/learn/loops.html"));
    expect(() => collectPrecache(web)).toThrow(/\/learn\/loops/);
  });

  it("writes a script that hands the worker the lists and nothing else", () => {
    const list = collectPrecache(fakeBuild());
    const scope: { PRECACHE?: Record<string, unknown> } = {};
    vm.runInNewContext(renderPrecache(list), { self: scope });
    expect(Object.keys(scope.PRECACHE ?? {}).sort()).toEqual(
      ["build", "corePages", "files", "otherBytes", "otherPages"].sort(),
    );
    expect(scope.PRECACHE?.files).toEqual(list.files);
  });
});
