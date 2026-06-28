import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAllExercises, loadExercise } from "./exercises";

// A fresh temp fixtures directory per test, cleaned up afterward, so the loader
// is driven against controlled files and never the real content directory.
let dir: string;

function makeDir(): string {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "exercises-"));
  return dir;
}

function write(name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
}

function exerciseJson(over: Record<string, unknown>): string {
  return JSON.stringify({
    title: "Sample",
    slug: "sample",
    order: 1,
    prompt: "# do the thing",
    starter: "",
    variant: "write",
    acceptance: { results: [{ kind: "register", reg: "x0", equals: 0 }] },
    ...over,
  });
}

afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe("loadAllExercises", () => {
  it("returns exercises sorted by order ascending, not by filename", () => {
    makeDir();
    // Filename order (a,b) is the reverse of the desired order, so a correct
    // result proves the order-sort, not the filesystem order.
    write("a.json", exerciseJson({ slug: "second", order: 2, title: "Second" }));
    write("b.json", exerciseJson({ slug: "first", order: 1, title: "First" }));
    expect(loadAllExercises(dir).map((e) => e.slug)).toEqual(["first", "second"]);
  });

  it("looks an exercise up by slug and returns undefined for an unknown slug", () => {
    makeDir();
    write("a.json", exerciseJson({ slug: "first", order: 1 }));
    expect(loadExercise("first", dir)?.slug).toBe("first");
    expect(loadExercise("missing", dir)).toBeUndefined();
  });

  it("throws naming the file and the validator message on invalid content", () => {
    makeDir();
    // Missing prompt: validateExercise fails with a message mentioning the field.
    write(
      "broken.json",
      JSON.stringify({
        title: "Broken",
        slug: "broken",
        order: 1,
        starter: "",
        variant: "write",
        acceptance: { results: [{ kind: "register", reg: "x0", equals: 0 }] },
      }),
    );
    expect(() => loadAllExercises(dir)).toThrow(/broken\.json/);
    expect(() => loadAllExercises(dir)).toThrow(/prompt/);
  });

  it("throws naming both files on a duplicate slug", () => {
    makeDir();
    write("one.json", exerciseJson({ slug: "dup", order: 1, title: "One" }));
    write("two.json", exerciseJson({ slug: "dup", order: 2, title: "Two" }));
    expect(() => loadAllExercises(dir)).toThrow(/dup/);
    expect(() => loadAllExercises(dir)).toThrow(/one\.json/);
    expect(() => loadAllExercises(dir)).toThrow(/two\.json/);
  });

  it("throws naming the file on unparseable json", () => {
    makeDir();
    write("bad.json", "{ not valid json ");
    expect(() => loadAllExercises(dir)).toThrow(/bad\.json/);
  });

  it("returns an empty list for an empty or absent directory", () => {
    makeDir();
    // An existing but empty directory: nothing to load.
    expect(loadAllExercises(dir)).toEqual([]);
    // An absent directory must not crash the build before the content is authored.
    expect(loadAllExercises(path.join(dir, "does-not-exist"))).toEqual([]);
  });
});
