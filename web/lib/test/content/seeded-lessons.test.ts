import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateLesson } from "@/lib/content/lesson-schema";

// Vitest runs from web/, so the real content directory is cwd-relative. This
// proves the shipped seed validates headlessly and carries no week labels.
const DIR = path.join(process.cwd(), "content/lessons");
const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".json"));

describe("seeded lessons", () => {
  it("ships at least the two seed lessons", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it("validate, with a numeric-or-string order and a unique slug equal to the filename", () => {
    const slugs = new Set<string>();
    for (const file of files) {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      const result = validateLesson(parsed);
      if (!result.ok) {
        throw new Error(`${file} failed validation: ${result.error}`);
      }
      const stem = file.replace(/\.json$/, "");
      expect(result.lesson.slug).toBe(stem);
      expect(slugs.has(result.lesson.slug)).toBe(false);
      slugs.add(result.lesson.slug);
      expect(result.lesson.order === undefined).toBe(false);
    }
  });

  it("contain no week labels, archive numbers, or personal data", () => {
    const banned = /week\s*\d|tutorial\s*\d|assignment\s*\d|@[a-z0-9.-]+\.[a-z]{2,}/i;
    for (const file of files) {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      expect(banned.test(raw), `${file} matched a banned pattern`).toBe(false);
    }
  });
});
