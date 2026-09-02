import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The bundle budgets are a contract between package.json and the build, and
// nothing else asserted them. Two things can go quietly wrong: a shipping
// lane loses its budget, and a glob starts naming a webpack-assigned chunk
// id. An id moves with the module graph, so such a glob measures a different
// chunk after the next refactor and an empty match sums to zero and passes.
// Vitest runs with cwd = web/, so package.json is right here.

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
  it("names a budget for every lane the app ships", () => {
    const names = budgets().map((budget) => budget.name);
    for (const lane of ["learn", "practice", "reference", "monaco", "xterm", "wasm", "stylesheets"]) {
      expect(names.some((name) => name.includes(lane))).toBe(true);
    }
  });

  it("globs no chunk name webpack assigns by id", () => {
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

  it("runs the manifest-driven route budget after size-limit", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const manifest = JSON.parse(raw) as { scripts: Record<string, string> };
    // The landing and playground documents load numbered shared chunks, so
    // their budget cannot be a glob at all; it lives in scripts/.
    expect(manifest.scripts.size).toContain("scripts/bundle-budget.js");
  });
});
