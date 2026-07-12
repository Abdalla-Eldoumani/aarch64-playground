import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateLesson } from "@/lib/content/lesson-schema";
import { validateExercise } from "@/lib/content/exercise-schema";

// Vitest runs from web/, so the guide sits one level up at the repo root. This
// guard proves the guide ships exactly one valid lesson and one valid exercise,
// so its worked examples can never drift out of the shape the real validators
// accept.
const GUIDE = path.join(process.cwd(), "..", "docs", "authoring-content.md");

/** Parse the body of every fenced ```json block, in document order. */
function jsonBlocks(markdown: string): unknown[] {
  const fence = /```json\s*\n([\s\S]*?)```/g;
  return [...markdown.matchAll(fence)].map((m) => JSON.parse(m[1].trim()) as unknown);
}

const blocks = jsonBlocks(fs.readFileSync(GUIDE, "utf8"));

describe("authoring guide worked examples", () => {
  it("ships at least the two worked examples", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it("has exactly one block that validates as a lesson", () => {
    expect(blocks.filter((block) => validateLesson(block).ok)).toHaveLength(1);
  });

  it("has exactly one block that validates as an exercise", () => {
    expect(blocks.filter((block) => validateExercise(block).ok)).toHaveLength(1);
  });
});
