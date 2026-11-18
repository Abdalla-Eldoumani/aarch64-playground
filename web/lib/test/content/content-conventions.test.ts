import { describe, expect, it } from "vitest";
import { lessonLinks } from "@/lib/content/lesson-links";
import { loadAllLessons } from "@/lib/content/lessons";
import { loadAllExercises, loadExerciseIndex } from "@/lib/content/exercises";
import { PRACTICE_TOPICS } from "@/lib/content/practice-topics";

// Content conventions the schemas leave open, so a slip still validates and
// ships: duplicate sheet numbers, unlisted topics and tags, an exercise no
// lesson reaches, and Markdown in fields that render as plain text.

// Read once: per-test reads of the folders overran the time limit.
const lessons = loadAllLessons();
const exercises = loadAllExercises();
const rows = loadExerciseIndex();

// The lesson filter chips. A new spelling here is a new chip on /learn.
const LESSON_TAGS = new Set([
  "armv8 basics",
  "arrays",
  "binary arithmetic",
  "binary logic",
  "bitwise",
  "branching",
  "command-line arguments",
  "conditionals",
  "external data",
  "floating point",
  "format strings",
  "frame pointer",
  "immediates",
  "input and output",
  "loops",
  "memory and the stack",
  "post-test loop",
  "pre-test loop",
  "printing",
  "registers",
  "stack",
  "strings",
  "subroutines",
  "system architecture",
  "variables",
]);

// Per-question fields that render as plain text, where a backtick reaches
// the student as a literal.
const PLAIN_FIELDS = ["question", "options", "prompt", "explanation", "hint", "code", "answer"];

/** Each question of an exercise's theory variant, with its list name. */
function questions(exercise: object): { list: string; index: number; fields: Record<string, unknown> }[] {
  return (["questions", "predictions", "blanks"] as const).flatMap((list) => {
    const value: unknown = (exercise as Record<string, unknown>)[list];
    if (!Array.isArray(value)) return [];
    return value.map((fields: Record<string, unknown>, index) => ({ list, index, fields }));
  });
}

describe("content conventions the schemas leave open", () => {
  it("gives every exercise its own order", () => {
    const seen = new Map<number | string, string>();
    const clashes: string[] = [];
    for (const { slug, order } of exercises) {
      const other = seen.get(order);
      if (other) clashes.push(`${slug} and ${other} share order ${order}: append at the next order after the highest`);
      seen.set(order, slug);
    }
    expect(exercises.length).toBeGreaterThan(50);
    expect(clashes).toEqual([]);
  });

  it("files every exercise under a practice topic", () => {
    const topics = new Set(PRACTICE_TOPICS.map((topic) => topic.id));
    const unlisted = exercises
      .filter((exercise) => exercise.topic !== undefined && !topics.has(exercise.topic))
      .map((exercise) => `${exercise.slug}: topic "${exercise.topic}" is not in PRACTICE_TOPICS (lib/content/practice-topics.ts)`);
    expect(unlisted).toEqual([]);
  });

  it("tags lessons from the closed vocabulary", () => {
    const unknown = lessons.flatMap((lesson) =>
      (lesson.tags ?? [])
        .filter((tag) => !LESSON_TAGS.has(tag))
        .map((tag) => `${lesson.slug}: tag "${tag}" is not in LESSON_TAGS; use a listed tag or add it on purpose`),
    );
    expect(unknown).toEqual([]);
  });

  it("links every exercise from at least one lesson", () => {
    const linked = new Set(
      lessons.flatMap((lesson) =>
        lessonLinks(lessons, lesson.slug, rows).practice.flatMap((group) => group.links.map((link) => link.href)),
      ),
    );
    const orphans = exercises
      .filter((exercise) => !linked.has(`/practice/${exercise.slug}`))
      .map((exercise) => `${exercise.slug}: link it from a lesson's ## Practice list`);
    expect(orphans).toEqual([]);
  });

  it("keeps each blank's code on one line", () => {
    const multiline = exercises.flatMap((exercise) =>
      questions(exercise)
        .filter(({ list, fields }) => list === "blanks" && String(fields.code).includes("\n"))
        .map(({ index }) => `${exercise.slug} blanks[${index}]: one line of code; name the lines around it in the prompt`),
    );
    expect(multiline).toEqual([]);
  });

  it("writes no Markdown in the per-question fields, which render as plain text", () => {
    const ticks = exercises.flatMap((exercise) =>
      questions(exercise).flatMap(({ list, index, fields }) =>
        PLAIN_FIELDS.filter((field) => [fields[field]].flat().some((text) => String(text).includes("`"))).map(
          (field) => `${exercise.slug} ${list}[${index}].${field}: write mnemonics and registers bare, without backticks`,
        ),
      ),
    );
    expect(ticks).toEqual([]);
  });
});
