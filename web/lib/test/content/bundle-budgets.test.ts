import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The size budgets in package.json go wrong quietly in two ways: a bundle the
// app ships loses its budget, or a glob names a chunk by the number webpack
// gives it. That number moves when the code changes, so the glob then measures
// another chunk or none, and an empty match sums to zero and passes. Vitest
// runs from web/, beside package.json.

interface Budget {
  name: string;
  path: string | string[];
  limit: string;
}

function budgets(): Budget[] {
  const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
  const manifest = JSON.parse(raw) as { "size-limit": Budget[] };
  return manifest["size-limit"];
}

function paths(budget: Budget): string[] {
  return Array.isArray(budget.path) ? budget.path : [budget.path];
}

describe("bundle budgets", () => {
  it("names a budget for every bundle the app ships", () => {
    const names = budgets().map((budget) => budget.name);
    for (const lane of ["learn", "practice", "reference", "monaco", "xterm", "wasm", "stylesheets"]) {
      expect(names.some((name) => name.includes(lane))).toBe(true);
    }
  });

  it("names no chunk by the number webpack gives it", () => {
    for (const budget of budgets()) {
      for (const glob of paths(budget)) {
        expect(glob).not.toMatch(/chunks\/\d+[-.]/);
      }
    }
  });

  it("covers the stylesheets", () => {
    const css = budgets().filter((budget) =>
      paths(budget).some((glob) => glob.includes(".next/static/css/")),
    );
    expect(css).toHaveLength(1);
  });

  it("runs the per-route budget script after size-limit", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const manifest = JSON.parse(raw) as { scripts: Record<string, string> };
    // The landing and playground documents load numbered shared chunks, so
    // their budget cannot be a glob at all; it lives in scripts/.
    expect(manifest.scripts.size).toContain("scripts/bundle-budget.js");
  });
});

// scripts/bundle-budget.js is CommonJS one level above web/, so it is loaded
// by path. Its DOMPurify check fails the job on an old copy only if it can
// read that copy's version, whatever quote mark the minifier put around it.
const { dompurifyVersions } = createRequire(import.meta.url)(
  join(process.cwd(), "..", "scripts", "bundle-budget.js"),
) as { dompurifyVersions: (text: string) => number[][] };

describe("the DOMPurify version check", () => {
  it("reads the version in double quotes, single quotes or backticks", () => {
    // Next's minifier writes double quotes; DOMPurify's own purify.min.js
    // writes backticks.
    expect(dompurifyVersions('t.version="3.4.17",t.removed=[]')).toEqual([[3, 4, 17]]);
    expect(dompurifyVersions("t.version='3.4.8',t.removed=[]")).toEqual([[3, 4, 8]]);
    expect(dompurifyVersions("t.version=`3.4.8`,t.removed=[]")).toEqual([[3, 4, 8]]);
  });

  it("finds an old copy in backticks beside a new one", () => {
    const chunk = 'a.version="3.4.17",a.removed=[];b.version=`3.4.8`,b.removed=[]';
    expect(dompurifyVersions(chunk)).toEqual([
      [3, 4, 17],
      [3, 4, 8],
    ]);
  });

  it("skips a version that is not DOMPurify's", () => {
    expect(dompurifyVersions('e.version="19.3.1",e.render=[]')).toEqual([]);
    expect(dompurifyVersions("t.version=\"3.4.8`,t.removed=[]")).toEqual([]);
  });
});
