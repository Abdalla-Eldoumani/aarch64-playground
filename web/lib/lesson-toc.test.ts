import { describe, expect, test } from "vitest";
import type { Lesson } from "@/lib/lesson-schema";
import { extractToc, slugify } from "./lesson-toc";

describe("slugify", () => {
  test("lowercases and dashes spaces", () => {
    expect(slugify("Moving Values")).toBe("moving-values");
  });

  test("strips inline-code backticks but keeps the inner text", () => {
    expect(slugify("the `mov` instruction")).toBe("the-mov-instruction");
  });

  test("strips bold/italic markers", () => {
    expect(slugify("**bold** and _italic_")).toBe("bold-and-italic");
  });

  test("trims and collapses repeated separators", () => {
    expect(slugify("  Spaced  --  Out  ")).toBe("spaced-out");
  });

  test("drops punctuation", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  test("passes through an already-kebab string", () => {
    expect(slugify("already-kebab")).toBe("already-kebab");
  });

  test("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  test("is idempotent", () => {
    for (const input of ["Moving Values", "the `mov` instruction", "  Spaced  --  Out  "]) {
      expect(slugify(slugify(input))).toBe(slugify(input));
    }
  });
});

/** A lesson whose prose blocks mix h2/h3 headings with noise and other blocks. */
const lesson: Pick<Lesson, "body"> = {
  body: [
    {
      type: "prose",
      markdown: ["intro paragraph", "## First Section", "some body text", "### Sub A", "#### too deep"].join(
        "\n",
      ),
    },
    { type: "code", language: "asm", source: "## not a heading\nmov x0, 1" },
    { type: "callout", variant: "note", markdown: "## also ignored" },
    { type: "prose", markdown: "## the `mov` instruction\n### Details" },
    { type: "editor", starter: "## nope" },
  ],
};

describe("extractToc", () => {
  const toc = extractToc(lesson);

  test("returns only h2/h3 headings from prose blocks, in order", () => {
    expect(toc).toHaveLength(4);
    expect(toc.map((e) => e.text)).toEqual([
      "First Section",
      "Sub A",
      "the mov instruction",
      "Details",
    ]);
  });

  test("records the heading depth", () => {
    expect(toc.map((e) => e.depth)).toEqual([2, 3, 2, 3]);
  });

  test("ignores #### headings, non-heading lines, and non-prose blocks", () => {
    expect(toc.some((e) => e.text === "too deep")).toBe(false);
    expect(toc.some((e) => e.text === "not a heading")).toBe(false);
    expect(toc.some((e) => e.text === "also ignored")).toBe(false);
    expect(toc.some((e) => e.text === "nope")).toBe(false);
  });

  test("every id equals slugify(text)", () => {
    for (const entry of toc) {
      expect(entry.id).toBe(slugify(entry.text));
    }
  });

  test("a formatted heading slugifies to the stripped, kebab id", () => {
    const entry = toc.find((e) => e.text === "the mov instruction");
    expect(entry?.id).toBe("the-mov-instruction");
  });

  test("returns an empty toc when no prose headings exist", () => {
    expect(extractToc({ body: [{ type: "code", language: "asm", source: "## x" }] })).toEqual([]);
  });
});
