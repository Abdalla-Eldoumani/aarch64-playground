import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { extractToc, slugify } from "@/lib/content/lesson-toc";
import { lookupDoc } from "@/lib/asm/instruction-docs";
import type { LessonBlock } from "@/lib/content/lesson-schema";

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

  it("renders an unlabeled multi-line fenced block as block code, not an inline hover-define", () => {
    const markdown = ["```", "mov x0, 1", "add x1, x1, 2", "```"].join("\n");
    const { container } = render(<LessonMarkdown markdown={markdown} />);
    // The fence lands in a <pre>, and its <code> takes the plain block style,
    // not the inline-code chrome.
    expect(container.querySelector("pre")).not.toBeNull();
    expect(container.querySelector("pre code")?.className).toBe("font-mono");
    // No hover-define affordance is attached anywhere inside the fence.
    expect(container.querySelector('[tabindex="0"]')).toBeNull();
    expect(container.querySelector('[role="note"]')).toBeNull();
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

  it("renders a gfm table with padded, ruled cells inside a sideways scroller", () => {
    const markdown = [
      "| Specifier | Bytes |",
      "| --- | ---: |",
      "| `%d` | 4 |",
    ].join("\n");
    const { container } = render(<LessonMarkdown markdown={markdown} />);
    const table = container.querySelector("table");
    expect(table?.parentElement?.className).toContain("overflow-x-auto");
    expect(table?.className).toContain("tabular-nums");
    const th = container.querySelector("th");
    const td = container.querySelectorAll("td");
    expect(th?.className).toContain("px-3 py-2");
    expect(th?.className).toContain("font-semibold");
    expect(th?.className).toContain("border-[var(--border)]");
    expect(td[1]?.className).toContain("px-3 py-2");
    expect(td[1]?.className).toContain("border-[var(--border)]");
    // The column's right alignment survives sanitizing.
    expect(td[1]?.style.textAlign).toBe("right");
    expect(td[1]?.textContent).toBe("4");
  });
});
