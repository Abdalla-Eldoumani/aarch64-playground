import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { extractToc, slugify } from "@/lib/content/lesson-toc";
import { lookupDoc } from "@/lib/asm/instruction-docs";
import type { LessonBlock } from "@/lib/content/lesson-schema";

afterEach(() => cleanup());

describe("LessonMarkdown", () => {
  it("gives an h2 a slugified id matching the table of contents", () => {
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

  it("makes a known instruction a focusable hover definition carrying its summary", () => {
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

  it("renders a summary's code as code in the card, and drops its backticks from the label", () => {
    const { container } = render(<LessonMarkdown markdown="then `neg` it" />);
    const card = container.querySelector('[role="tooltip"]');
    expect(card?.querySelector("code")?.textContent).toBe("SUB Rd, ZR, Rn");
    expect(card?.textContent).not.toContain("`");
    const note = container.querySelector('[role="note"]');
    expect(note?.getAttribute("aria-label")).toBe("Rd = -Rn (alias for SUB Rd, ZR, Rn).");
    expect(note?.getAttribute("title")).toBe("Rd = -Rn (alias for SUB Rd, ZR, Rn).");
  });

  it("renders an inline excerpt as a phrase: code without a hover note, a link as its text", () => {
    const { container } = render(
      <LessonMarkdown inline markdown="Read `mov` with **care** and [print](/learn) it" />,
    );
    const root = container.firstElementChild;
    expect(root?.tagName).toBe("SPAN");
    expect(root?.querySelector("p, div")).toBeNull();
    expect(root?.querySelector("code")?.textContent).toBe("mov");
    expect(root?.querySelector("strong")?.textContent).toBe("care");
    // Inside a practice row's link a focusable note or a second link would be
    // a control nested in a control.
    expect(root?.querySelector("[tabindex], [role='note'], a")).toBeNull();
    expect(root?.textContent).toBe("Read mov with care and print it");
  });

  it("renders an unknown token as plain code with no hover definition", () => {
    const { container } = render(
      <LessonMarkdown markdown="the `zzz` token is plain" />,
    );
    expect(container.querySelector("[tabindex]")).toBeNull();
    const code = container.querySelector("code");
    expect(code?.textContent).toBe("zzz");
  });

  it("renders an unlabeled multi-line fenced block as block code, not an inline hover definition", () => {
    const markdown = ["```", "mov x0, 1", "add x1, x1, 2", "```"].join("\n");
    const { container } = render(<LessonMarkdown markdown={markdown} />);
    // The fence lands in a <pre>, and its <code> takes the plain block style,
    // not the inline-code chrome.
    expect(container.querySelector("pre")).not.toBeNull();
    expect(container.querySelector("pre code")?.className).toBe("font-mono");
    // A code listing is not a word to define, so nothing inside it hovers.
    expect(container.querySelector('[tabindex="0"]')).toBeNull();
    expect(container.querySelector('[role="note"]')).toBeNull();
  });

  it("makes a register a focusable hover definition that names its role", () => {
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

  it("keeps a formatted heading's id equal to its table of contents id", () => {
    const markdown = "## the `mov` instruction";
    const { container } = render(<LessonMarkdown markdown={markdown} />);
    const h2 = container.querySelector("h2");
    expect(h2?.id).toBe("the-mov-instruction");
    const block: LessonBlock = { type: "prose", markdown };
    const tocId = extractToc({ body: [block] })[0].id;
    expect(h2?.id).toBe(tocId);
  });

  it("renders a markdown table inside a sideways scroller", () => {
    const markdown = [
      "| Specifier | Bytes |",
      "| --- | ---: |",
      "| `%d` | 4 |",
    ].join("\n");
    const { container } = render(<LessonMarkdown markdown={markdown} />);
    const table = container.querySelector("table");
    // A wide table scrolls inside its box instead of widening a phone's page.
    expect(table?.parentElement?.className).toContain("overflow-x-auto");
    expect(container.querySelector("th")?.textContent).toBe("Specifier");
    const td = container.querySelectorAll("td");
    // The column's right alignment survives sanitizing.
    expect(td[1]?.style.textAlign).toBe("right");
    expect(td[1]?.textContent).toBe("4");
  });
});
