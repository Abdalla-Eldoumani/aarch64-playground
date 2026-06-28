import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// Control the solved set: only "solved-one" is solved, and subscribe is a no-op.
vi.mock("@/lib/solved-state", () => ({
  getSolvedSlugs: () => ["solved-one"],
  subscribeSolved: () => () => {},
}));

import { ExerciseIndex } from "./ExerciseIndex";
import type { Exercise } from "@/lib/exercise-schema";

afterEach(() => cleanup());

function makeExercise(over: Partial<Exercise>): Exercise {
  return {
    title: "Sample",
    slug: "sample",
    order: 1,
    prompt: "# do the thing",
    starter: "",
    variant: "write",
    acceptance: { results: [{ kind: "register", reg: "x0", equals: 0 }] },
    ...over,
  };
}

// order 2 then 1, so a correct render proves the order-sort; distinct topics and
// difficulties drive the filter tests; "solved-one" is the mocked-solved slug.
const exercises: Exercise[] = [
  makeExercise({
    title: "Beta Exercise",
    slug: "unsolved-two",
    order: 2,
    topic: "stack",
    difficulty: "core",
    prompt: "# work with the stack",
  }),
  makeExercise({
    title: "Alpha Exercise",
    slug: "solved-one",
    order: 1,
    topic: "registers",
    difficulty: "intro",
    prompt: "# work with registers",
  }),
];

describe("ExerciseIndex", () => {
  it("renders cards ordered by order, each linking to its exercise", () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const hrefs = Array.from(container.querySelectorAll('a[href^="/practice/"]')).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["/practice/solved-one", "/practice/unsolved-two"]);
    expect(screen.getByText("Alpha Exercise")).toBeTruthy();
    expect(screen.getByText("Beta Exercise")).toBeTruthy();
  });

  it("filters by the search query (title and topic) with an accessible search name", () => {
    render(<ExerciseIndex exercises={exercises} />);
    const input = screen.getByLabelText("Search exercises");
    fireEvent.change(input, { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha Exercise")).toBeTruthy();
    expect(screen.queryByText("Beta Exercise")).toBeNull();
    fireEvent.change(input, { target: { value: "stack" } });
    expect(screen.getByText("Beta Exercise")).toBeTruthy();
    expect(screen.queryByText("Alpha Exercise")).toBeNull();
  });

  it("filters by a selected topic chip, toggling aria-pressed", () => {
    render(<ExerciseIndex exercises={exercises} />);
    const chip = screen.getByRole("button", { name: "registers" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Alpha Exercise")).toBeTruthy();
    expect(screen.queryByText("Beta Exercise")).toBeNull();
  });

  it("filters by a selected difficulty chip", () => {
    render(<ExerciseIndex exercises={exercises} />);
    const chip = screen.getByRole("button", { name: "intro" });
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Alpha Exercise")).toBeTruthy();
    expect(screen.queryByText("Beta Exercise")).toBeNull();
  });

  it("renders the empty state when there are no exercises", () => {
    const { container } = render(<ExerciseIndex exercises={[]} />);
    expect(screen.getByText("No exercises yet.")).toBeTruthy();
    expect(container.querySelector('a[href^="/practice/"]')).toBeNull();
  });

  it("renders the no-match state when the query matches nothing", () => {
    render(<ExerciseIndex exercises={exercises} />);
    fireEvent.change(screen.getByLabelText("Search exercises"), {
      target: { value: "zzznomatch" },
    });
    expect(screen.getByText("No exercises match your search.")).toBeTruthy();
  });

  it("renders the loading skeleton instead of the list", () => {
    const { container } = render(<ExerciseIndex exercises={exercises} loading />);
    expect(container.querySelector('[data-testid="exercise-index-skeleton"]')).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("Alpha Exercise")).toBeNull();
  });

  it("shows the solved indicator only on a solved card, after mount", async () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    // The indicator is set by the post-mount effect.
    await screen.findByText("solved");
    const solvedCard = container.querySelector('a[href="/practice/solved-one"]') as HTMLElement;
    const unsolvedCard = container.querySelector('a[href="/practice/unsolved-two"]') as HTMLElement;
    expect(within(solvedCard).queryByText("solved")).not.toBeNull();
    expect(within(unsolvedCard).queryByText("solved")).toBeNull();
  });
});
