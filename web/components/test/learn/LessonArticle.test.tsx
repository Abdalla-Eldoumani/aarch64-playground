import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { slugify } from "@/lib/content/lesson-toc";
import { readShareHash } from "@/lib/playground/share";

// readShareHash can also report a failure; these tests only want the
// decoded state.
function okShareState(hash: string) {
  const r = readShareHash(hash);
  if (r.kind !== "ok") throw new Error(`expected ok, got ${r.kind}`);
  return r.state;
}
import { MAX_STDIN_BYTES } from "@/lib/playground/upload-guard";
import type { Lesson } from "@/lib/content/lesson-schema";
import { loadAllLessons } from "@/lib/content/lessons";

// Stub the shared embeddable with a light marker that echoes the props the
// article feeds it, so the test never instantiates Monaco or the WASM worker.
// React omits an undefined attribute, so a dropped (oversize) stdin shows up as
// a missing data-startstdin, which is the boundary this test guards.
vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: (props: {
    chrome?: string;
    startSource?: string;
    startArgs?: string;
    startStdin?: string;
    registerHeadingLevel?: number;
  }) => (
    <div
      data-testid="embed"
      data-chrome={props.chrome}
      data-startsource={props.startSource}
      data-startargs={props.startArgs}
      data-startstdin={props.startStdin}
      data-headinglevel={props.registerHeadingLevel}
    />
  ),
}));

import { LessonArticle } from "@/components/learn/LessonArticle";

afterEach(() => cleanup());

/** True when `a` comes before `b` in document order. */
function precedes(a: Element, b: Element): boolean {
  return Boolean(
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

/** A whole program: it defines main, so the playground can link it. */
const PROGRAM = "        .global main\nmain:\n        mov     w0, 1\n        ret";

const fullLesson: Lesson = {
  title: "Test Lesson",
  slug: "test-lesson",
  order: 1,
  body: [
    {
      type: "prose",
      markdown: "## First Heading\n\nthe lead paragraph appears here",
    },
    { type: "code", language: "asm", source: PROGRAM },
    { type: "callout", variant: "note", markdown: "a callout body line" },
    {
      type: "editor",
      starter: "// starter program\nret",
      args: "1 2",
      stdin: "queued input",
    },
    { type: "prose", markdown: "## Second Heading\n\nmore body text here" },
  ],
};

describe("LessonArticle", () => {
  it("renders the four block types in body order", () => {
    render(<LessonArticle lesson={fullLesson} />);

    const lead = screen.getByText(/the lead paragraph appears here/i);
    // Both the code block and the editor block carry a playground link,
    // in body order.
    const [codeLink, editorLink] = screen.getAllByRole("link", {
      name: /open in playground/i,
    });
    const noteLabel = screen.getByText("note");
    const embed = screen.getByTestId("embed");
    const secondProse = screen.getByText(/more body text here/i);

    expect(precedes(lead, codeLink)).toBe(true);
    expect(precedes(codeLink, noteLabel)).toBe(true);
    expect(precedes(noteLabel, embed)).toBe(true);
    expect(precedes(embed, editorLink)).toBe(true);
    expect(precedes(editorLink, secondProse)).toBe(true);
  });

  it("names the lesson by its title in the header strip, never by its slug", () => {
    const { container } = render(<LessonArticle lesson={fullLesson} sheetNumber="4.2" />);
    const strip = container.querySelector("article > div");
    expect(strip?.textContent).toContain("lesson 4.2 · Test Lesson");
    expect(container.textContent).not.toContain("test-lesson");
  });

  it("renders prose through the real LessonMarkdown (heading id matches the table of contents)", () => {
    const { container } = render(<LessonArticle lesson={fullLesson} />);
    // A real heading element with the slugified id proves LessonMarkdown ran,
    // not a stub, and that its ids agree with the table of contents links.
    const heading = container.querySelector(`#${slugify("First Heading")}`);
    expect(heading).not.toBeNull();
    expect(heading?.tagName.toLowerCase()).toBe("h2");
    expect(screen.getByText(/the lead paragraph appears here/i)).toBeTruthy();
  });

  it("gives the code block an open-in-playground deep link carrying its source", () => {
    render(<LessonArticle lesson={fullLesson} />);
    const [codeLink] = screen.getAllByRole("link", {
      name: /open in playground/i,
    });
    const href = codeLink.getAttribute("href") ?? "";
    expect(href.startsWith("/playground#p2=")).toBe(true);
    const decoded = okShareState(href.slice("/playground".length));
    expect(decoded).toEqual({ source: PROGRAM });
  });

  it("shows the open-in-playground link only for assembly code blocks", () => {
    const lesson: Lesson = {
      title: "Languages",
      slug: "languages",
      order: 1,
      body: [
        { type: "code", language: "asm", source: PROGRAM },
        { type: "code", language: "c", source: "int main(){ return 0; }" },
        { type: "code", language: "text", source: "plain listing" },
      ],
    };
    render(<LessonArticle lesson={lesson} />);
    // The emulator only runs assembly, so exactly one block (the asm one)
    // carries the hand-off; the C and text blocks render without it.
    const links = screen.getAllByRole("link", { name: /open in playground/i });
    expect(links).toHaveLength(1);
    const decoded = okShareState(
      (links[0].getAttribute("href") ?? "").slice("/playground".length),
    );
    expect(decoded).toEqual({ source: PROGRAM });
  });

  it("leaves the link off an assembly fragment that defines no main", () => {
    const lesson: Lesson = {
      title: "Fragments",
      slug: "fragments",
      order: 1,
      body: [
        { type: "code", language: "asm", source: "        cmp     w19, 5\n        b.gt    done" },
        { type: "code", language: "asm", source: "// the loop body calls main: again\n        b       top" },
      ],
    };
    render(<LessonArticle lesson={lesson} />);
    // A fragment opened alone fails to link, so the hand-off would lead to
    // an error; a `main:` inside a comment does not count as a definition.
    expect(screen.queryAllByRole("link", { name: /open in playground/i })).toHaveLength(0);
  });

  it("gives the editor block a deep link carrying starter, args, and stdin", () => {
    render(<LessonArticle lesson={fullLesson} />);
    const [, editorLink] = screen.getAllByRole("link", {
      name: /open in playground/i,
    });
    const href = editorLink.getAttribute("href") ?? "";
    expect(href.startsWith("/playground#p2=")).toBe(true);
    const decoded = okShareState(href.slice("/playground".length));
    expect(decoded).toEqual({
      source: "// starter program\nret",
      args: "1 2",
      stdin: "queued input",
    });
  });

  it("maps each callout variant to its label", () => {
    const lesson: Lesson = {
      title: "Callouts",
      slug: "callouts",
      order: 1,
      body: [
        { type: "callout", variant: "note", markdown: "n" },
        { type: "callout", variant: "warning", markdown: "w" },
        { type: "callout", variant: "pitfall", markdown: "p" },
      ],
    };
    render(<LessonArticle lesson={lesson} />);
    expect(screen.getByText("note")).toBeTruthy();
    expect(screen.getByText("warning")).toBeTruthy();
    expect(screen.getByText("pitfall")).toBeTruthy();
  });

  it("renders the editor block as the reused embed with its starter and args", () => {
    render(<LessonArticle lesson={fullLesson} />);
    const embed = screen.getByTestId("embed");
    expect(embed.getAttribute("data-chrome")).toBe("embed");
    // Lesson sections are h2, so the panel label inside one is an h3.
    expect(embed.getAttribute("data-headinglevel")).toBe("3");
    expect(embed.getAttribute("data-startsource")).toBe("// starter program\nret");
    expect(embed.getAttribute("data-startargs")).toBe("1 2");
  });

  it("builds the table of contents from the prose headings, linking to the matching ids", () => {
    render(<LessonArticle lesson={fullLesson} />);
    const nav = screen.getByRole("navigation", { name: /on this page/i });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(`#${slugify("First Heading")}`);
    expect(hrefs).toContain(`#${slugify("Second Heading")}`);
  });

  // Open above the article, the contents filled a phone's first screen.
  it("folds the contents above the article and keeps the side rail open", () => {
    render(<LessonArticle lesson={fullLesson} />);
    const nav = screen.getByRole("navigation", { name: /on this page/i });
    const folded = nav.querySelector("details");
    expect(folded?.open).toBe(false);
    expect(folded?.className).toContain("lg:hidden");
    const rail = nav.querySelector(":scope > div");
    expect(rail?.className).toContain("hidden lg:block");
    expect(rail?.querySelectorAll("a").length).toBe(folded?.querySelectorAll("a").length);
  });

  it("numbers each contents entry under the lesson number, starting at 1", () => {
    render(<LessonArticle lesson={fullLesson} sheetNumber="4.2" />);
    const nav = screen.getByRole("navigation", { name: /on this page/i });
    const labels = within(nav)
      .getAllByRole("link")
      .map((a) => (a.textContent ?? "").trim());
    expect(labels[0].startsWith("4.2.1")).toBe(true);
    expect(labels[1].startsWith("4.2.2")).toBe(true);
  });

  // The answers printed right under the questions, so the eye landed on
  // answer 1 while still reading question 2.
  it("keeps the Check yourself answers folded until the reader opens them", () => {
    const lesson: Lesson = {
      title: "Quiz",
      slug: "quiz",
      order: 1,
      body: [
        { type: "prose", markdown: "## Check yourself\n\n1. What is seven?" },
        { type: "callout", variant: "note", markdown: "Answers:\n\n1. The number after six." },
      ],
    };
    const { container } = render(<LessonArticle lesson={lesson} />);
    const answer = screen.getByText("The number after six.");
    const fold = answer.closest("details");
    expect(fold).not.toBeNull();
    expect(fold?.open).toBe(false);
    const summary = fold?.querySelector("summary");
    expect(summary?.textContent).toContain("show answers");
    // The control names itself, so the lead line is not said twice.
    expect(container.textContent).not.toContain("Answers:");
    // The box says what it holds, not "note".
    expect(screen.getByText("answers")).toBeTruthy();
    expect(screen.queryByText("note")).toBeNull();

    summary?.click();
    expect(fold?.open).toBe(true);
  });

  it("leaves a note that is not the answers open", () => {
    render(<LessonArticle lesson={fullLesson} />);
    expect(screen.getByText("a callout body line").closest("details")).toBeNull();
  });

  it("folds the answers on every lesson", { timeout: 30_000 }, () => {
    const lessons = loadAllLessons();
    expect(lessons.length).toBeGreaterThan(0);
    for (const lesson of lessons) {
      const { container, unmount } = render(<LessonArticle lesson={lesson} />);
      const folds = container.querySelectorAll("details:not([open]) > summary");
      const answers = [...folds].filter((s) => s.textContent?.includes("show answers"));
      expect(answers, lesson.slug).toHaveLength(1);
      expect(container.textContent, lesson.slug).not.toContain("Answers:");
      unmount();
    }
  });

  // "4.4.1" named both a contents entry and an example on the same page.
  it("numbers the examples apart from the contents entries", () => {
    const lesson: Lesson = {
      ...fullLesson,
      body: [...fullLesson.body, { type: "editor", starter: "ret" }],
    };
    const { container } = render(<LessonArticle lesson={lesson} sheetNumber="4.2" />);
    const nav = screen.getByRole("navigation", { name: /on this page/i });
    const contentsNumbers = within(nav)
      .getAllByRole("link")
      .map((a) => (a.textContent ?? "").match(/^[\d.]+/)?.[0]);
    const captions = [...container.querySelectorAll("article span")]
      .map((s) => s.textContent ?? "")
      .filter((t) => t.startsWith("example"));
    expect(captions.map((t) => t.match(/^example [\d.]+/)?.[0])).toEqual(["example 1", "example 2"]);
    for (const number of contentsNumbers) {
      for (const caption of captions) expect(caption).not.toContain(` ${number}`);
    }
  });

  it("passes a lesson's stdin under the size cap to the embed", () => {
    const lesson: Lesson = {
      title: "Stdin",
      slug: "stdin-ok",
      order: 1,
      body: [{ type: "editor", starter: "ret", stdin: "small input" }],
    };
    render(<LessonArticle lesson={lesson} />);
    const embed = screen.getByTestId("embed");
    expect(embed.getAttribute("data-startstdin")).toBe("small input");
  });

  it("drops a lesson's stdin over the size cap instead of passing it on", () => {
    const oversize = "x".repeat(MAX_STDIN_BYTES + 1);
    const lesson: Lesson = {
      title: "Stdin",
      slug: "stdin-oversize",
      order: 1,
      body: [{ type: "editor", starter: "ret", stdin: oversize }],
    };
    render(<LessonArticle lesson={lesson} />);
    const embed = screen.getByTestId("embed");
    // Dropped: the marker received no stdin, but still got the starter source.
    expect(embed.getAttribute("data-startstdin")).toBeNull();
    expect(embed.getAttribute("data-startsource")).toBe("ret");
    // The deep link drops it the same way: no oversize stdin in the URL.
    const link = screen.getByRole("link", { name: /open in playground/i });
    const decoded = okShareState((link.getAttribute("href") ?? "").slice("/playground".length));
    expect(decoded).toEqual({ source: "ret" });
  });
});
