import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PITFALLS, PITFALL_GROUPS } from "@/lib/content/pitfall-data";

// The pitfall catalog: every card under its group, its links, the text and
// group filters (alone, together, and empty), one demo at a time that runs as
// it opens, and a link to one card bringing that card into view.

// The programs each demo was asked to assemble and run, in order.
const runs = vi.hoisted(() => ({ sources: [] as string[] }));

// Stub the shared embeddable with a light marker that echoes the props the
// catalog feeds it and records the runs asked of its handle, so the test never
// instantiates Monaco or the WASM worker.
vi.mock("@/components/playground/EmbeddablePlayground", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  type Props = { chrome?: string; startSource?: string; registerHeadingLevel?: number };
  return {
    EmbeddablePlayground: forwardRef<{ assembleAndRun(): void }, Props>(function Embed(props, ref) {
      useImperativeHandle(ref, () => ({
        assembleAndRun: () => runs.sources.push(props.startSource ?? ""),
      }));
      return (
        <div
          data-testid="embed"
          data-chrome={props.chrome}
          data-startsource={props.startSource}
          data-headinglevel={props.registerHeadingLevel}
        />
      );
    }),
  };
});

// jsdom has no scrollIntoView; opening a demo calls it.
let frameScrolls: { node: Element; options?: boolean | ScrollIntoViewOptions }[];
beforeEach(() => {
  frameScrolls = [];
  runs.sources = [];
  Element.prototype.scrollIntoView = function (this: Element, options) {
    frameScrolls.push({ node: this, options });
  };
});

import { PitfallsCatalog } from "@/components/reference/PitfallsCatalog";

const LESSON_TITLES = Object.fromEntries(
  PITFALLS.map((pitfall) => [pitfall.lesson, `Lesson called ${pitfall.lesson}`]),
);
const FIRST = PITFALLS[0];
const bySlug = (slug: string) => {
  const pitfall = PITFALLS.find((p) => p.slug === slug);
  if (!pitfall) throw new Error(`no pitfall ${slug}`);
  return pitfall;
};

function renderCatalog() {
  return render(<PitfallsCatalog lessonTitles={LESSON_TITLES} />);
}

/** The card titles on screen, in order. */
function shownTitles(): string[] {
  return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

// Each test renders every card, markdown and highlighted code included: about
// a second alone, and longer on a loaded machine.
describe("PitfallsCatalog", { timeout: 15_000 }, () => {
  it("renders every card under its group heading, in group order", () => {
    renderCatalog();
    expect(shownTitles()).toHaveLength(PITFALLS.length);
    const groupHeadings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(groupHeadings).toEqual(PITFALL_GROUPS.map((group) => group.label));
    const stack = screen.getByRole("region", { name: "The stack and calls" });
    const stackTitles = within(stack)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(stackTitles).toEqual(
      PITFALLS.filter((p) => p.group === "stack").map((p) => p.title),
    );
  });

  it("gives each card the fragment lessons link to", () => {
    const { container } = renderCatalog();
    for (const pitfall of PITFALLS) {
      const card = container.querySelector(`#pitfall-${pitfall.slug}`);
      expect(card?.tagName, pitfall.slug).toBe("ARTICLE");
    }
  });

  it("shows the mistake, both outcomes, the fix, and the snippets on a card", () => {
    renderCatalog();
    const card = screen.getByRole("article", { name: FIRST.title });
    const text = card.textContent ?? "";
    expect(text).toContain("wrong");
    expect(text).toContain("right");
    expect(text).toContain("on the server");
    expect(text).toContain("in the playground");
    expect(text).toContain("the fix");
    expect(card.querySelectorAll("pre")).toHaveLength(2);
    // The server line reads as a sentence about the broken program.
    expect(text).toContain("The broken program prints");
  });

  it("links each card to its lesson, its reference entry, and its source", () => {
    renderCatalog();
    const card = screen.getByRole("article", { name: bySlug("cmp-operand-order").title });
    const lesson = within(card).getByRole("link", { name: "Lesson called assembly-conditionals-basics" });
    expect(lesson.getAttribute("href")).toBe("/learn/assembly-conditionals-basics");
    expect(within(card).getByRole("link", { name: "cmp" }).getAttribute("href")).toBe("/reference#cmp");
    const source = within(card).getByRole("link", { name: bySlug("cmp-operand-order").source.title });
    expect(source.getAttribute("href")).toBe(bySlug("cmp-operand-order").source.href);

    const conv = screen.getByRole("article", { name: bySlug("caller-saved-registers").title });
    expect(
      within(conv).getByRole("link", { name: "calling convention" }).getAttribute("href"),
    ).toBe("/reference#calling-convention");
    const cond = screen.getByRole("article", { name: bySlug("off-by-one-loop-bound").title });
    expect(within(cond).getByRole("link", { name: "b.cond" }).getAttribute("href")).toBe(
      "/reference#b-cond",
    );
  });

  it("narrows the list to the cards whose text holds the filter words", () => {
    renderCatalog();
    const box = screen.getByRole("searchbox", { name: "filter the mistakes" });
    fireEvent.change(box, { target: { value: "  CSINC " } });
    expect(shownTitles()).toEqual([bySlug("csinc-adds-one-when-false").title]);
    expect(screen.getByText(`1 of ${PITFALLS.length} mistakes shown`)).toBeTruthy();
    // Only the group that still has a card keeps its heading.
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Flags and branches",
    ]);
  });

  it("narrows the list by group, and two groups show both", () => {
    renderCatalog();
    const flags = screen.getByRole("button", { name: "Flags" });
    fireEvent.click(flags);
    expect(flags.getAttribute("aria-pressed")).toBe("true");
    expect(shownTitles()).toEqual(PITFALLS.filter((p) => p.group === "flags").map((p) => p.title));

    fireEvent.click(screen.getByRole("button", { name: "printf" }));
    expect(shownTitles()).toEqual(
      PITFALLS.filter((p) => p.group === "flags" || p.group === "io").map((p) => p.title),
    );

    // A second press lifts that group again.
    fireEvent.click(flags);
    expect(flags.getAttribute("aria-pressed")).toBe("false");
    expect(shownTitles()).toEqual(PITFALLS.filter((p) => p.group === "io").map((p) => p.title));
  });

  it("combines the group and the words, and says so when nothing matches", () => {
    renderCatalog();
    fireEvent.click(screen.getByRole("button", { name: "Stack" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sdiv" } });
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.getByText(/No mistake matches that filter/)).toBeTruthy();
    expect(screen.getByText(`0 of ${PITFALLS.length} mistakes shown`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "clear the filters" }));
    expect(shownTitles()).toHaveLength(PITFALLS.length);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Stack" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "clear the filters" })).toBeNull();
  });

  it("moves focus to the filter box when the clear button removes itself", () => {
    renderCatalog();
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "ldr" } });
    const clear = screen.getByRole("button", { name: "clear the filters" });
    clear.focus();
    fireEvent.click(clear);
    expect(screen.queryByRole("button", { name: "clear the filters" })).toBeNull();
    expect(document.activeElement).toBe(box);
  });

  it("focuses the filter box only after the cards are back, so it stays on screen", () => {
    renderCatalog();
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "no such mistake" } });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    // Focused while the list is still empty, the box scrolls out of view when
    // the cards land: the browser keeps the footer where it was.
    const calls: { cards: number; preventScroll?: boolean }[] = [];
    const focus = box.focus.bind(box);
    box.focus = (options?: FocusOptions) => {
      calls.push({ cards: document.querySelectorAll("article").length, preventScroll: options?.preventScroll });
      focus(options);
    };
    fireEvent.click(screen.getByRole("button", { name: "clear the filters" }));
    expect(calls).toEqual([{ cards: PITFALLS.length, preventScroll: undefined }]);
    expect(document.activeElement).toBe(box);
  });

  it("keeps spellcheck, autocorrect, and autocapitalize off in the filter", () => {
    renderCatalog();
    const box = screen.getByRole("searchbox");
    expect(box.getAttribute("spellcheck")).toBe("false");
    expect(box.getAttribute("autocorrect")).toBe("off");
    expect(box.getAttribute("autocapitalize")).toBe("off");
  });

  it("running the broken program seeds it into one embed", async () => {
    renderCatalog();
    fireEvent.click(
      screen.getByRole("button", { name: `run the broken program: ${FIRST.title}` }),
    );
    const embed = await screen.findByTestId("embed");
    expect(embed.getAttribute("data-chrome")).toBe("embed");
    expect(embed.getAttribute("data-startsource")).toBe(FIRST.broken.source);
    // Cards are h3 under each group's h2, so the panel label inside is an h4.
    expect(embed.getAttribute("data-headinglevel")).toBe("4");
  });

  it("switching to the fixed program swaps the seeded program in place", async () => {
    renderCatalog();
    const pitfall = bySlug("off-by-one-loop-bound");
    fireEvent.click(screen.getByRole("button", { name: `run the broken program: ${pitfall.title}` }));
    await screen.findByTestId("embed");
    fireEvent.click(screen.getByRole("button", { name: `run the fixed program: ${pitfall.title}` }));
    const embed = await screen.findByTestId("embed");
    expect(embed.getAttribute("data-startsource")).toBe(pitfall.fixed.source);
  });

  // The button says run, so the frame runs its program once as it opens (the
  // broken one shows its assemble error with no second press) and comes into
  // view with its controls, at once rather than gliding the whole page.
  it("runs the program a demo opens with, once, and brings its frame into view", async () => {
    renderCatalog();
    const pitfall = bySlug("mul-takes-registers-only");
    fireEvent.click(screen.getByRole("button", { name: `run the broken program: ${pitfall.title}` }));
    const embed = await screen.findByTestId("embed");
    await waitFor(() => expect(runs.sources).toEqual([pitfall.broken.source]));
    expect(frameScrolls).toEqual([
      { node: embed.closest(".embed-frame"), options: { block: "nearest", behavior: "instant" } },
    ]);

    // A keystroke in the filter re-renders the catalog; the demo does not run again.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mul" } });
    expect(runs.sources).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: `run the fixed program: ${pitfall.title}` }));
    await waitFor(() => expect(runs.sources).toEqual([pitfall.broken.source, pitfall.fixed.source]));
  });

  it("only one demo is live at a time, and a second press closes it", async () => {
    renderCatalog();
    fireEvent.click(screen.getByRole("button", { name: `run the broken program: ${PITFALLS[0].title}` }));
    await screen.findByTestId("embed");
    fireEvent.click(screen.getByRole("button", { name: `run the fixed program: ${PITFALLS[1].title}` }));
    const embed = await screen.findByTestId("embed");
    expect(screen.getAllByTestId("embed")).toHaveLength(1);
    expect(embed.getAttribute("data-startsource")).toBe(PITFALLS[1].fixed.source);
    fireEvent.click(screen.getByRole("button", { name: `close the demo: ${PITFALLS[1].title}` }));
    expect(screen.queryByTestId("embed")).toBeNull();
  });

  describe("a link to one card", () => {
    // jsdom has no scrollIntoView, so a recorder stands in for it.
    let scrolled: string[];
    beforeEach(() => {
      scrolled = [];
      Element.prototype.scrollIntoView = function (this: Element) {
        scrolled.push(this.id);
      };
    });
    afterEach(() => {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    });

    it("brings that card into view when the catalog opens", () => {
      const pitfall = bySlug("ldp-order-matches-stp");
      window.history.replaceState(null, "", `#pitfall-${pitfall.slug}`);
      renderCatalog();
      expect(scrolled).toEqual([`pitfall-${pitfall.slug}`]);
    });

    it("scrolls nowhere when the fragment names no card", () => {
      window.history.replaceState(null, "", "#cmp");
      renderCatalog();
      expect(scrolled).toEqual([]);
    });
  });
});
