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
  it("renders cards ordered by order, each linking to its lesson", () => {
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
    const input = screen.getByLabelText("Search lessons");
    fireEvent.change(input, { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha Lesson")).toBeTruthy();
    expect(screen.queryByText("Beta Lesson")).toBeNull();
  });

  it("filters by a selected tag chip", () => {
    render(<LessonIndex lessons={lessons} />);
    fireEvent.click(screen.getByRole("button", { name: "registers" }));
    expect(screen.getByText("Alpha Lesson")).toBeTruthy();
    expect(screen.queryByText("Beta Lesson")).toBeNull();
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
