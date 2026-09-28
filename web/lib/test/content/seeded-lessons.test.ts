import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateLesson } from "@/lib/content/lesson-schema";

// Vitest runs from web/, so the content directory is relative to it.
const DIR = path.join(process.cwd(), "content/lessons");
const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".json"));

describe("seeded lessons", () => {
  it("ships the two seed lessons, so the loops below have files to check", () => {
    expect(files).toContain("registers-and-immediates.json");
    expect(files).toContain("stack-and-frame-pointer.json");
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

  it("carry the date their content last changed, which the sitemap prints", () => {
    for (const file of files) {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      const result = validateLesson(parsed);
      expect(result.ok && result.lesson.lastUpdated, `${file} has no lastUpdated`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
    }
  });
});
