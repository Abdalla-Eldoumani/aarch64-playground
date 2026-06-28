import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAllLessons, loadLesson } from "./lessons";

// A fresh temp fixtures directory per test, cleaned up afterward, so the loader
// is driven against controlled files and never the real content directory.
let dir: string;

function makeDir(): string {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-"));
  return dir;
}

function write(name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
}

function lessonJson(over: Record<string, unknown>): string {
  return JSON.stringify({
    title: "Sample",
    slug: "sample",
    order: 1,
    body: [{ type: "prose", markdown: "# heading" }],
    ...over,
  });
}

afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe("loadAllLessons", () => {
  it("returns lessons sorted by order ascending, not by filename", () => {
    makeDir();
    // Filename order (a,b) is the reverse of the desired order, so a correct
    // result proves the order-sort, not the filesystem order.
    write("a.json", lessonJson({ slug: "second", order: 2, title: "Second" }));
    write("b.json", lessonJson({ slug: "first", order: 1, title: "First" }));
    expect(loadAllLessons(dir).map((l) => l.slug)).toEqual(["first", "second"]);
  });

  it("looks a lesson up by slug and returns undefined for an unknown slug", () => {
    makeDir();
    write("a.json", lessonJson({ slug: "first", order: 1 }));
    expect(loadLesson("first", dir)?.slug).toBe("first");
    expect(loadLesson("missing", dir)).toBeUndefined();
  });

  it("throws naming the file and the validator message on invalid content", () => {
    makeDir();
    // Missing title: validateLesson fails with a message mentioning the field.
    write(
      "broken.json",
      JSON.stringify({
        slug: "broken",
        order: 1,
        body: [{ type: "prose", markdown: "x" }],
      }),
    );
    expect(() => loadAllLessons(dir)).toThrow(/broken\.json/);
    expect(() => loadAllLessons(dir)).toThrow(/title/);
  });

  it("throws naming both files on a duplicate slug", () => {
    makeDir();
    write("one.json", lessonJson({ slug: "dup", order: 1, title: "One" }));
    write("two.json", lessonJson({ slug: "dup", order: 2, title: "Two" }));
    expect(() => loadAllLessons(dir)).toThrow(/dup/);
    expect(() => loadAllLessons(dir)).toThrow(/one\.json/);
    expect(() => loadAllLessons(dir)).toThrow(/two\.json/);
  });

  it("throws naming the file on unparseable json", () => {
    makeDir();
    write("bad.json", "{ not valid json ");
    expect(() => loadAllLessons(dir)).toThrow(/bad\.json/);
  });
});
