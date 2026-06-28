import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// The client renderers are replaced with text markers so this test exercises the
// server route wiring (loader -> page -> props) without pulling in the editor,
// worker, or markdown stack. The markers echo what the pages hand them, so the
// assertions prove the data actually flowed through.
vi.mock("@/components/ExerciseIndex", () => ({
  ExerciseIndex: ({ exercises }: { exercises: Array<{ slug: string }> }) =>
    `exercise-index:${exercises.length}`,
}));
vi.mock("@/components/ExerciseView", () => ({
  ExerciseView: ({ exercise }: { exercise: { slug: string } }) =>
    `exercise-view:${exercise.slug}`,
}));

// notFound throws a sentinel like the real one halts rendering, so an unknown
// slug is observable here as a rejection plus a spy call.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { notFound } from "next/navigation";
import { loadAllExercises } from "@/lib/exercises";
import PracticePage from "./page";
import ExercisePage, { dynamicParams, generateStaticParams } from "./[slug]/page";

const SEEDED_SLUGS = ["sum-to-n", "fix-the-loop-bound"];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("practice routes", () => {
  it("statically enumerates exactly the seeded exercise slugs", () => {
    const slugs = generateStaticParams().map((entry) => entry.slug);
    expect(slugs).toEqual(loadAllExercises().map((exercise) => exercise.slug));
    for (const slug of SEEDED_SLUGS) expect(slugs).toContain(slug);
    // dynamicParams off means only these slugs render; anything else 404s.
    expect(dynamicParams).toBe(false);
  });

  it("renders the index from every validated exercise", () => {
    const expectedCount = loadAllExercises().length;
    render(<PracticePage />);
    expect(screen.getByText(`exercise-index:${expectedCount}`)).toBeTruthy();
  });

  it("renders the view for a known slug", async () => {
    const element = await ExercisePage({
      params: Promise.resolve({ slug: SEEDED_SLUGS[0] }),
    });
    render(element);
    expect(screen.getByText(`exercise-view:${SEEDED_SLUGS[0]}`)).toBeTruthy();
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
  });

  it("not-founds an unknown slug", async () => {
    await expect(
      ExercisePage({ params: Promise.resolve({ slug: "does-not-exist" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(vi.mocked(notFound)).toHaveBeenCalledTimes(1);
  });
});
