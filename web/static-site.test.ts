import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Fails on a proxy or middleware file, an app route handler, and the BANNED
// source lines below. Vitest runs with cwd = web/.

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

// The service worker's fetches run in the browser and render no route.
const SERVICE_WORKER = "lib/playground/sw.js";

// App page and layout files; page.test.tsx does not match.
const PAGE_OR_LAYOUT = /^app\/(.+\/)?(page|layout)\.(ts|tsx|js|jsx|mjs)$/;

const everywhere = () => true;
const notTheWorker = (file: string) => file !== SERVICE_WORKER;
const pageOrLayout = (file: string) => PAGE_OR_LAYOUT.test(file);

// Each pattern a line of source may not match, what to write instead, and
// the files it applies to.
const BANNED: [RegExp, string, (file: string) => boolean][] = [
  [/^\s*["']use server["'];?\s*$/, "a server action needs a server: do the work in the browser or at build time", everywhere],
  [/^\s*export const (revalidate|dynamic)\b/, "every route is a static file: drop the route segment export", everywhere],
  [/\brevalidate\s*:/, "a revalidating fetch turns every route into ISR: fetch once per build with cache: \"force-cache\"", notTheWorker],
  [/\bcache\s*:\s*["']no-store["']/, "a no-store fetch renders the route per request: fetch once per build with cache: \"force-cache\"", notTheWorker],
  [/from\s+["']next\/(headers|server)["']/, "a request-time API renders the route per request: read the URL in the browser instead", everywhere],
  [
    /\b(searchParams|useSearchParams)\b/,
    "searchParams or useSearchParams in a page or layout file (the searchParams prop renders the route per request): read the URL with useSearchParams() in a client component outside the page and layout files",
    pageOrLayout,
  ],
];

/** Every banned line in one file, as "file:line: what to do instead". */
function banned(file: string, text: string): string[] {
  return text.split(/\r?\n/).flatMap((line, i) =>
    BANNED.filter(([pattern, , applies]) => applies(file) && pattern.test(line)).map(
      ([, instead]) => `${file}:${i + 1}: ${instead}`,
    ),
  );
}

describe("the site is static files only", () => {
  it("scans the app, components and lib sources, tests left out", () => {
    expect(CODE.length).toBeGreaterThan(250);
    const files = CODE.map(({ file }) => file);
    expect(files).toContain("lib/content/github.ts");
    expect(files.filter((file) => /\.test\./.test(file))).toEqual([]);
  });

  it("flags searchParams and useSearchParams in a page or layout file only, and no-store everywhere but the service worker", () => {
    const flagged = (file: string, ...lines: string[]) => banned(file, lines.join("\n")).length > 0;
    // Flagged: the prop, destructured and typed, through props, or destructured over lines.
    expect(flagged("app/(site)/r3/page.tsx", "export default async function Page({ searchParams }: { searchParams: Promise<object> }) {")).toBe(true);
    expect(flagged("app/(site)/r4/page.tsx", 'export default async function Page(props: PageProps<"/r4">) {', "  const { q } = await props.searchParams;")).toBe(true);
    expect(flagged("app/(site)/r5/page.tsx", "export default async function Page({", "  searchParams,", '}: PageProps<"/r5">) {')).toBe(true);
    // Flagged: a "use client" page calling useSearchParams, whatever it names the result.
    expect(flagged("app/(site)/r6/page.tsx", '"use client";', "const searchParams = useSearchParams();")).toBe(true);
    expect(flagged("app/(site)/r6b/page.tsx", '"use client";', "const params = useSearchParams();")).toBe(true);
    expect(flagged("app/(site)/r6c/page.tsx", '"use client";', 'return <p>{useSearchParams().get("q")}</p>;')).toBe(true);
    // Not flagged: a client component outside page and layout files, a route's own test, the service worker.
    expect(flagged("app/(site)/learn/UrlChip.tsx", '"use client";', "const searchParams = useSearchParams();")).toBe(false);
    expect(flagged("app/(site)/learn/page.test.tsx", "render(<Page searchParams={{}} />);")).toBe(false);
    expect(flagged(SERVICE_WORKER, 'const res = await fetch(url, { cache: "no-store" });')).toBe(false);
    expect(flagged("lib/content/feed.ts", 'await fetch(url, { cache: "no-store" });')).toBe(true);
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
    expect(CODE.flatMap(({ file, text }) => banned(file, text))).toEqual([]);
  });
});
