import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LessonIndex } from "@/components/learn/LessonIndex";
import type { Lesson } from "@/lib/content/lesson-schema";

afterEach(() => cleanup());

// Two lessons with order 2 then 1, so a correct render proves the order-sort.
const lessons: Lesson[] = [
  {
    title: "Beta Lesson",
    slug: "beta",
    order: 2,
    summary: "about the stack",
    tags: ["stack"],
    body: [{ type: "prose", markdown: "x" }],
  },
  {
    title: "Alpha Lesson",
    slug: "alpha",
    order: 1,
    summary: "about registers",
    tags: ["registers"],
    body: [{ type: "prose", markdown: "x" }],
  },
];

describe("LessonIndex", () => {
  it("renders cards sorted by their order field, each linking to its lesson", () => {
    const { container } = render(<LessonIndex lessons={lessons} />);
    const hrefs = Array.from(container.querySelectorAll('a[href^="/learn/"]')).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["/learn/alpha", "/learn/beta"]);
    expect(screen.getByText("Alpha Lesson")).toBeTruthy();
    expect(screen.getByText("Beta Lesson")).toBeTruthy();
  });

  it("filters by the search query and exposes an accessible search name", () => {
    render(<LessonIndex lessons={lessons} />);
    const input = screen.getByLabelText("search lessons");
    fireEvent.change(input, { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha Lesson")).toBeTruthy();
    expect(screen.queryByText("Beta Lesson")).toBeNull();
  });

  it("finds a lesson from two words typed in another order", () => {
    render(<LessonIndex lessons={lessons} />);
    fireEvent.change(screen.getByLabelText("search lessons"), {
      target: { value: "registers alpha" },
    });
    expect(screen.getByText("Alpha Lesson")).toBeTruthy();
    expect(screen.queryByText("Beta Lesson")).toBeNull();
  });

  it("filters by a selected tag chip", () => {
    render(<LessonIndex lessons={lessons} />);
    fireEvent.click(screen.getByRole("button", { name: "registers" }));
    expect(screen.getByText("Alpha Lesson")).toBeTruthy();
    expect(screen.queryByText("Beta Lesson")).toBeNull();
  });

  // Two dozen chips took five rows over the list on a wide screen and a
  // sideways strip on a phone; folded, the first lessons show at once.
  it("folds the tag chips behind a closed disclosure that wraps them", () => {
    render(<LessonIndex lessons={lessons} />);
    const group = screen.getByRole("group", { name: "Filter by tag" });
    const fold = group.closest("details");
    expect(fold?.open).toBe(false);
    expect(fold?.querySelector("summary")?.textContent).toBe("filter by tag");
    expect(group.className).toContain("flex-wrap");
    expect(group.className).not.toContain("overflow-x-auto");
  });

  it("names how many tags are chosen on the folded control", () => {
    render(<LessonIndex lessons={lessons} />);
    fireEvent.click(screen.getByRole("button", { name: "registers" }));
    const summary = screen.getByRole("group", { name: "Filter by tag" }).closest("details")?.querySelector("summary");
    expect(summary?.textContent).toBe("filter by tag (1 chosen)");
  });

  // Tailwind reads a shadow utility over var(--ring) as a shadow colour and
  // paints no ring, so the ring has to be set as the box-shadow itself.
  // The tag filter's toggle takes its ring from the shared fold-summary rule.
  it("rings the search box and the tag chips on keyboard focus", () => {
    render(<LessonIndex lessons={lessons} />);
    const controls = [
      screen.getByLabelText("search lessons"),
      screen.getByRole("button", { name: "registers" }),
    ];
    for (const control of controls) {
      expect(control.className).toContain("focus-visible:[box-shadow:var(--ring)]");
    }
    expect(screen.getByText("filter by tag").className).toContain("fold-summary");
  });

  it("renders the empty state when there are no lessons", () => {
    const { container } = render(<LessonIndex lessons={[]} />);
    expect(screen.getByText(/no lessons/i)).toBeTruthy();
    expect(container.querySelector('a[href^="/learn/"]')).toBeNull();
  });

  it("renders the loading skeleton instead of the list", () => {
    const { container } = render(<LessonIndex lessons={lessons} loading />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("Alpha Lesson")).toBeNull();
  });
});
