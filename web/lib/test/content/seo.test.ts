import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/content/lesson-schema";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  clipDescription,
  composeTitle,
  lessonDescription,
  snippetFromMarkdown,
  toJsonLd,
} from "@/lib/content/seo";

// The route tests (app/seo.test.tsx) hold every shipped page to the limits;
// these pin the edge cases of the helpers that build the copy.

describe("composeTitle", () => {
  it("adds the site name when the whole title fits", () => {
    expect(composeTitle("Pre-test loops")).toBe("Pre-test loops · AArch64 Playground");
  });

  it("keeps a long title bare instead of cutting its own words", () => {
    const longest = "x".repeat(TITLE_MAX - " · AArch64 Playground".length);
    expect(composeTitle(longest)).toHaveLength(TITLE_MAX);
    expect(composeTitle(`${longest}y`)).toBe(`${longest}y`);
  });
});

describe("clipDescription", () => {
  it("leaves a snippet that fits alone, whitespace folded", () => {
    expect(clipDescription("  two\nlines  ")).toBe("two lines");
  });

  it("cuts a long one at a word and marks the cut", () => {
    const clipped = clipDescription("word ".repeat(60));
    expect(clipped.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(clipped).toMatch(/ word\.\.\.$/);
  });
});

describe("snippetFromMarkdown", () => {
  it("skips headings, code, lists, and the lead-in sentence that introduces them", () => {
    const prompt = [
      "## task",
      "Draw a box around one word read from input. For the input `hello`:",
      "",
      "```text",
      "+-------+",
      "```",
      "",
      "- one",
      "- two",
      "",
      "The starter reads the word into `word_buf` and already holds the format string for the middle line.",
    ].join("\n");
    expect(snippetFromMarkdown(prompt)).toBe(
      "Draw a box around one word read from input. The starter reads the word into word_buf and already holds the format string for the middle line.",
    );
  });

  it("never ends a sentence on punctuation inside inline code", () => {
    const prompt =
      "Print every argument in capitals. With `quiet please` the program prints `QUIET!` and then `PLEASE!` on the next line, one per line, as asked.";
    expect(snippetFromMarkdown(prompt)).toBe(prompt.replace(/`/g, ""));
  });

  it("clips at a word when whole sentences come out short", () => {
    const snippet = snippetFromMarkdown(`Two players. ${"then a very long second sentence ".repeat(8)}ends.`);
    expect(snippet.startsWith("Two players. then a very long")).toBe(true);
    expect(snippet.endsWith("...")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("turns a prompt that is only a lead-in into a statement", () => {
    expect(snippetFromMarkdown("A 32-bit add can go wrong in two ways:\n\n- carry\n- overflow")).toBe(
      "A 32-bit add can go wrong in two ways.",
    );
  });
});

describe("lessonDescription", () => {
  it("falls back to the opening prose when a lesson has no summary", () => {
    const lesson: Lesson = {
      title: "Loops",
      slug: "loops",
      order: 1,
      body: [
        { type: "code", language: "asm", source: "b top\n" },
        { type: "prose", markdown: "A loop runs its body again until a test says stop, and cmp sets up that test." },
      ],
    };
    expect(lessonDescription(lesson)).toBe(
      "A loop runs its body again until a test says stop, and cmp sets up that test.",
    );
  });
});

describe("toJsonLd", () => {
  it("escapes < so an authored title cannot close the script element", () => {
    const json = toJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(JSON.parse(json).name).toBe("</script><script>alert(1)</script>");
  });
});
