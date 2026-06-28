import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LessonMarkdown } from "./LessonMarkdown";
import { extractToc, slugify } from "@/lib/lesson-toc";
import { lookupDoc } from "@/lib/instruction-docs";
import type { LessonBlock } from "@/lib/lesson-schema";

afterEach(() => cleanup());

describe("LessonMarkdown", () => {
  it("gives an h2 a slugified id matching the toc", () => {
    const { container } = render(<LessonMarkdown markdown="## Moving Values" />);
    const h2 = container.querySelector("h2");
    expect(h2).not.toBeNull();
    expect(h2?.id).toBe("moving-values");
    expect(h2?.id).toBe(slugify("Moving Values"));
  });

  it("strips script tags, event-handler attributes, and javascript: hrefs", () => {
    const markdown = [
      "<script>alert('x')</script>",
      "[link](javascript:alert(1))",
      "<img src=x onerror=alert(1)>",
    ].join("\n\n");
    const { container } = render(<LessonMarkdown markdown={markdown} />);

    // No executable script element survives.
    expect(container.querySelector("script")).toBeNull();
    // No event-handler attribute survives on any element.
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    // No element carries a javascript: protocol href.
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    }
  });

  it("makes a known instruction a focusable hover-define carrying its summary", () => {
    const { container } = render(
      <LessonMarkdown markdown="use the `mov` instruction" />,
    );
    const focusable = container.querySelector('[tabindex="0"]');
    expect(focusable).not.toBeNull();
    const expected = lookupDoc("mov")?.summary ?? "";
    expect(expected.length).toBeGreaterThan(0);
    const label = focusable?.getAttribute("aria-label") ?? "";
    const title = focusable?.getAttribute("title") ?? "";
    expect(label + title).toContain(expected);
  });

  it("renders an unknown token as plain code with no hover affordance", () => {
    const { container } = render(
      <LessonMarkdown markdown="the `zzz` token is plain" />,
    );
    expect(container.querySelector("[tabindex]")).toBeNull();
    const code = container.querySelector("code");
    expect(code?.textContent).toBe("zzz");
  });

  it("makes a register a focusable hover-define with a non-empty role", () => {
    const { container } = render(
      <LessonMarkdown markdown="the `x0` register holds an argument" />,
    );
    const focusable = container.querySelector('[tabindex="0"]');
    expect(focusable).not.toBeNull();
    const label = focusable?.getAttribute("aria-label") ?? "";
    const title = focusable?.getAttribute("title") ?? "";
    // Non-empty proves the register source is wired, not hollow.
    expect((label + title).length).toBeGreaterThan(0);
  });

  it("keeps a formatted heading's id equal to the toc's id", () => {
    const markdown = "## the `mov` instruction";
    const { container } = render(<LessonMarkdown markdown={markdown} />);
    const h2 = container.querySelector("h2");
    expect(h2?.id).toBe("the-mov-instruction");
    const block: LessonBlock = { type: "prose", markdown };
    const tocId = extractToc({ body: [block] })[0].id;
    expect(h2?.id).toBe(tocId);
  });
});
