import { describe, expect, test } from "vitest";
import { validateLesson } from "./lesson-schema";

/** A complete, valid lesson exercising all four block types. */
function validLesson() {
  return {
    title: "Moving Values",
    slug: "moving-values",
    order: 1,
    summary: "How mov copies a value into a register.",
    tags: ["registers", "basics"],
    body: [
      { type: "prose", markdown: "## intro\nThe `mov` instruction copies a value." },
      { type: "code", language: "asm", source: "mov x0, 1\n" },
      { type: "callout", variant: "note", markdown: "Registers are 64-bit." },
      { type: "editor", starter: "mov x0, 1\n", args: "", stdin: "" },
    ],
  };
}

/** Validate and return the error string, asserting the input was rejected. */
function rejectError(data: unknown): string {
  const result = validateLesson(data);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected validation to fail");
  return result.error;
}

describe("validateLesson (valid)", () => {
  test("accepts a full lesson and echoes the validated fields", () => {
    const result = validateLesson(validLesson());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const { lesson } = result;
    expect(lesson.title).toBe("Moving Values");
    expect(lesson.slug).toBe("moving-values");
    expect(lesson.order).toBe(1);
    expect(lesson.summary).toBe("How mov copies a value into a register.");
    expect(lesson.tags).toEqual(["registers", "basics"]);
    expect(lesson.body).toHaveLength(4);
    expect(lesson.body.map((b) => b.type)).toEqual(["prose", "code", "callout", "editor"]);
  });

  test("accepts a string order and omits absent optional fields", () => {
    const result = validateLesson({
      title: "Intro",
      slug: "intro",
      order: "a",
      body: [{ type: "prose", markdown: "hello" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.lesson.order).toBe("a");
    expect(result.lesson.summary).toBeUndefined();
    expect(result.lesson.tags).toBeUndefined();
  });

  test("drops unknown top-level keys, keeping only validated fields", () => {
    const result = validateLesson({
      title: "Intro",
      slug: "intro",
      order: 1,
      body: [{ type: "prose", markdown: "hello" }],
      injected: "<script>",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.lesson).not.toHaveProperty("injected");
  });
});

describe("validateLesson (malformed metadata)", () => {
  test("rejects non-object input naming the lesson", () => {
    expect(rejectError(null)).toMatch(/lesson/);
    expect(rejectError([])).toMatch(/lesson/);
    expect(rejectError("nope")).toMatch(/lesson/);
  });

  test("rejects a missing title", () => {
    expect(rejectError({ slug: "intro", order: 1, body: [{ type: "prose", markdown: "x" }] })).toMatch(
      /title/,
    );
  });

  test("rejects a non-kebab slug", () => {
    expect(rejectError({ ...validLesson(), slug: "Not Kebab" })).toMatch(/slug/);
    expect(rejectError({ ...validLesson(), slug: "has spaces" })).toMatch(/slug/);
  });

  test("rejects a missing order", () => {
    expect(rejectError({ title: "Intro", slug: "intro", body: [{ type: "prose", markdown: "x" }] })).toMatch(
      /order/,
    );
  });

  test("rejects tags that are not a string array", () => {
    expect(rejectError({ ...validLesson(), tags: [1, 2] })).toMatch(/tags/);
    expect(rejectError({ ...validLesson(), tags: "registers" })).toMatch(/tags/);
  });

  test("rejects a body that is not an array", () => {
    expect(rejectError({ ...validLesson(), body: "x" })).toMatch(/body/);
  });

  test("rejects an empty body", () => {
    expect(rejectError({ ...validLesson(), body: [] })).toMatch(/body/);
  });
});

describe("validateLesson (malformed blocks)", () => {
  test("rejects an unknown block type with the block index", () => {
    const error = rejectError({ ...validLesson(), body: [{ type: "video", src: "x" }] });
    expect(error).toMatch(/body\[\d+\]/);
  });

  test("rejects a callout with a bad variant", () => {
    const error = rejectError({
      ...validLesson(),
      body: [{ type: "callout", variant: "danger", markdown: "x" }],
    });
    expect(error).toMatch(/body\[\d+\]/);
    expect(error).toMatch(/variant/);
  });

  test("rejects a code block with a bad language", () => {
    const error = rejectError({
      ...validLesson(),
      body: [{ type: "code", language: "python", source: "x" }],
    });
    expect(error).toMatch(/body\[\d+\]/);
    expect(error).toMatch(/language/);
  });

  test("rejects an editor block missing its starter", () => {
    const error = rejectError({ ...validLesson(), body: [{ type: "editor", args: "" }] });
    expect(error).toMatch(/body\[\d+\]/);
    expect(error).toMatch(/starter/);
  });

  test("names the offending block index past the first block", () => {
    const error = rejectError({
      ...validLesson(),
      body: [
        { type: "prose", markdown: "ok" },
        { type: "callout", variant: "bad", markdown: "x" },
      ],
    });
    expect(error).toMatch(/body\[1\]/);
  });
});
