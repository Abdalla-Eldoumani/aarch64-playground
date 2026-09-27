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
      "Put the border in `.data`, then print the border, the middle line, and the border again.",
    ].join("\n");
    expect(snippetFromMarkdown(prompt)).toBe(
      "Draw a box around one word read from input. Put the border in .data, then print the border, the middle line, and the border again.",
    );
  });

  it("keeps an opening lead-in, since it states the task", () => {
    const prompt = [
      "A 32-bit add can go wrong in two ways, and the flags record both:",
      "",
      "- V: the signed answer does not fit",
      "- C: a 1 carries out of bit 31",
      "",
      "Add the two inputs with `adds`, which sets the flags.",
    ].join("\n");
    expect(snippetFromMarkdown(prompt)).toBe(
      "A 32-bit add can go wrong in two ways, and the flags record both. Add the two inputs with adds, which sets the flags.",
    );
  });

  it("leaves out register aliases and the starter's plumbing", () => {
    expect(
      snippetFromMarkdown(
        "Two friends trade a secret handshake as a number. The starter reads it and holds the strings. Put the code in `code_r`, then print one action for each set bit.",
      ),
    ).toBe("Two friends trade a secret handshake as a number.");
    expect(
      snippetFromMarkdown("Three values arrive in `a_r`, `b_r`, and `c_r`. Compute (a + b) - c and print it."),
    ).toBe("Compute (a + b) - c and print it.");
  });

  it("keeps a starter opening only when the task points back to it", () => {
    expect(snippetFromMarkdown("The starter reads one signed number. Print its magnitude.")).toBe(
      "The starter reads one signed number. Print its magnitude.",
    );
    expect(snippetFromMarkdown("The starter reads a board into `board`. Print who wins, or keep playing.")).toBe(
      "Print who wins, or keep playing.",
    );
  });

  it("never lets a starter opening stand alone", () => {
    const opening =
      "The starter reads a price in cents and a quantity straight into two words in .data, called price and quantity.";
    const snippet = snippetFromMarkdown(
      `${opening} Multiply them, store the product in the third word, and print all three words with a single call.`,
    );
    expect(snippet.startsWith(`${opening} Multiply them`)).toBe(true);
    expect(snippet.endsWith("...")).toBe(true);
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
