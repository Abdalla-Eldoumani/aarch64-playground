import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every route builds to a static file and the site runs no server code: no
// proxy in front of the pages, no route handlers, no server actions, and
// nothing that renders a route per request or turns it into ISR. Vitest runs
// with cwd = web/.

const WEB = process.cwd();
const SKIP = /^(components\/test|lib\/test|lib\/wasm|lib\/wasm-node)$/;

/** Every source file under dir, relative to web/ with forward slashes, tests left out. */
function sources(dir: string): string[] {
  return fs.readdirSync(path.join(WEB, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP.test(rel) ? [] : sources(rel);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [rel] : [];
  });
}

// Read once as the suite loads: inside a test, with every worker busy, a
// pass over the tree can overrun the time limit.
const CODE = ["app", "components", "lib"]
  .flatMap(sources)
  .map((file) => ({ file, text: fs.readFileSync(path.join(WEB, file), "utf8") }));

// Each pattern a line of source may not match, and what to write instead.
const BANNED: [RegExp, string][] = [
  [/^\s*["']use server["'];?\s*$/, "a server action needs a server: do the work in the browser or at build time"],
  [/^\s*export const (revalidate|dynamic)\b/, "every route is a static file: drop the route segment export"],
  [/\brevalidate\s*:/, "a revalidating fetch turns every route into ISR: fetch once per build with cache: \"force-cache\""],
  [/\bcache\s*:\s*["']no-store["']/, "a no-store fetch renders the route per request: fetch once per build with cache: \"force-cache\""],
  [/from\s+["']next\/(headers|server)["']/, "a request-time API renders the route per request: read the URL in the browser instead"],
];

describe("the site is static files only", () => {
  it("scans the app, components and lib sources", () => {
    expect(CODE.length).toBeGreaterThan(250);
    expect(CODE.map(({ file }) => file)).toContain("lib/content/github.ts");
  });

  it("has no proxy or middleware in front of the pages", () => {
    const found = ["", "src/"].flatMap((dir) =>
      ["proxy", "middleware"].flatMap((name) =>
        ["ts", "tsx", "js", "jsx", "mjs"]
          .map((ext) => `${dir}${name}.${ext}`)
          .filter((file) => fs.existsSync(path.join(WEB, file))),
      ),
    );
    expect(
      found,
      "a proxy runs a function in front of every page: set headers in next.config.mjs headers() and vercel.json",
    ).toEqual([]);
  });

  it("has no route handlers", () => {
    const handlers = sources("app").filter((file) => /\/route\.[jt]sx?$|\/route\.mjs$/.test(file));
    expect(
      handlers,
      "the site has no server endpoints: write the data at build time into a page or a file under public/",
    ).toEqual([]);
  });

  it("has no server action, ISR setting or request-time API", () => {
    const hits: string[] = [];
    for (const { file, text } of CODE) {
      text.split(/\r?\n/).forEach((line, i) => {
        for (const [pattern, instead] of BANNED) {
          if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${instead}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
