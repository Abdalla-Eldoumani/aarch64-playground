import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { slugify } from "@/lib/content/lesson-toc";
import { readShareHash } from "@/lib/playground/share";

// readShareHash returns a discriminated verdict; these tests only
// care about the ok payload.
function okShareState(hash: string) {
  const r = readShareHash(hash);
  if (r.kind !== "ok") throw new Error(`expected ok, got ${r.kind}`);
  return r.state;
}
import { MAX_STDIN_BYTES } from "@/lib/playground/upload-guard";
import type { Lesson } from "@/lib/content/lesson-schema";

// Stub the shared embeddable with a light marker that echoes the props the
// article feeds it, so the test never instantiates Monaco or the WASM worker.
// React omits an undefined attribute, so a dropped (oversize) stdin shows up as
// a missing data-startstdin -- exactly the boundary this test guards.
vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: (props: {
    chrome?: string;
    startSource?: string;
    startArgs?: string;
    startStdin?: string;
  }) => (
    <div
      data-testid="embed"
      data-chrome={props.chrome}
      data-startsource={props.startSource}
      data-startargs={props.startArgs}
      data-startstdin={props.startStdin}
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

const fullLesson: Lesson = {
  title: "Test Lesson",
  slug: "test-lesson",
  order: 1,
  body: [
    {
      type: "prose",
      markdown: "## First Heading\n\nthe lead paragraph appears here",
    },
    { type: "code", language: "asm", source: "mov x0, #1\nret" },
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

  it("caps the prose measure per block and leaves the figure uncapped", () => {
    const { container } = render(<LessonArticle lesson={fullLesson} />);
    // The article column runs the full sheet width; the cap moved onto the
    // reading blocks, so the figure can be wider than the paragraphs.
    expect(container.querySelector("article")!.className).not.toContain("max-w-2xl");
    expect(screen.getByTestId("embed").closest(".max-w-2xl")).toBeNull();
    expect(
      screen.getByText(/the lead paragraph appears here/i).closest(".max-w-2xl"),
    ).not.toBeNull();
  });

  it("renders prose through the real LessonMarkdown (heading id matches the toc)", () => {
    const { container } = render(<LessonArticle lesson={fullLesson} />);
    // A real heading element with the slugified id proves LessonMarkdown ran,
    // not a stub, and that its ids agree with the toc anchors.
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
    expect(decoded).toEqual({ source: "mov x0, #1\nret" });
  });

  it("shows the open-in-playground link only for assembly code blocks", () => {
    const lesson: Lesson = {
      title: "Languages",
      slug: "languages",
      order: 1,
      body: [
        { type: "code", language: "asm", source: "mov x0, #1\nret" },
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
    expect(decoded).toEqual({ source: "mov x0, #1\nret" });
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
    expect(embed.getAttribute("data-startsource")).toBe("// starter program\nret");
    expect(embed.getAttribute("data-startargs")).toBe("1 2");
  });

  it("builds the toc from the prose headings, linking to the matching ids", () => {
    render(<LessonArticle lesson={fullLesson} />);
    const nav = screen.getByRole("navigation", { name: /on this page/i });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(`#${slugify("First Heading")}`);
    expect(hrefs).toContain(`#${slugify("Second Heading")}`);
  });

  it("forwards an in-cap author stdin to the embed", () => {
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

  it("drops an author stdin that exceeds the cap rather than forwarding it", () => {
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
