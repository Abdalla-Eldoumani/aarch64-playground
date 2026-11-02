import postcss from "postcss";
import { describe, expect, it } from "vitest";
import dropComments from "./postcss-drop-comments.js";

async function commentsLeft(css: string): Promise<string[]> {
  const { root } = await postcss([dropComments()]).process(css, { from: undefined });
  const left: string[] = [];
  root.walkComments((comment) => {
    left.push(comment.text);
  });
  return left;
}

describe("postcss drop-comments step", () => {
  it("keeps a comment whose text starts with !, on one line or with tailwind's line breaks", async () => {
    const css = "/*! keep one */\n/*\n! tailwindcss v3.4.19 | MIT License\n*/\na { color: red; }";
    expect(await commentsLeft(css)).toEqual(["! keep one", "! tailwindcss v3.4.19 | MIT License"]);
  });

  it("drops every other comment, inside a rule too, and leaves the rules alone", async () => {
    const css = "/* why the rule */\na { color: red; /* why the colour */ }\n/** doc */\nb { margin: 0; }";
    const { css: out } = await postcss([dropComments()]).process(css, { from: undefined });
    expect(await commentsLeft(css)).toEqual([]);
    expect(out).toContain("a { color: red; }");
    expect(out).toContain("b { margin: 0; }");
  });
});
