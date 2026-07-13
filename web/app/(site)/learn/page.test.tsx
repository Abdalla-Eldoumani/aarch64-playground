import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// The client renderers are replaced with text markers so this test exercises the
// server route wiring (loader -> page -> props) without pulling in the editor,
// worker, or markdown stack. The markers echo what the pages hand them, so the
// assertions prove the data actually flowed through.
vi.mock("@/components/learn/LessonIndex", () => ({
  LessonIndex: ({ lessons }: { lessons: Array<{ slug: string }> }) =>
    `lesson-index:${lessons.length}`,
}));
vi.mock("@/components/learn/LessonArticle", () => ({
  LessonArticle: ({ lesson }: { lesson: { slug: string } }) =>
    `lesson-article:${lesson.slug}`,
}));

// notFound throws a sentinel like the real one halts rendering, so an unknown
// slug is observable here as a rejection plus a spy call.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { notFound } from "next/navigation";
import { loadAllLessons } from "@/lib/content/lessons";
import LearnPage from "./page";
import LessonPage, { dynamicParams, generateStaticParams } from "./[slug]/page";

const SEEDED_SLUGS = ["registers-and-immediates", "stack-and-frame-pointer"];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("learn routes", () => {
  it("statically enumerates exactly the seeded lesson slugs", () => {
    const slugs = generateStaticParams().map((entry) => entry.slug);
    expect(slugs).toEqual(loadAllLessons().map((lesson) => lesson.slug));
    for (const slug of SEEDED_SLUGS) expect(slugs).toContain(slug);
    // dynamicParams off means only these slugs render; anything else 404s.
    expect(dynamicParams).toBe(false);
  });

  it("renders the index from every validated lesson", () => {
    const expectedCount = loadAllLessons().length;
    render(<LearnPage />);
    expect(screen.getByText(`lesson-index:${expectedCount}`)).toBeTruthy();
  });

  it("renders the article for a known slug", async () => {
    const element = await LessonPage({
      params: Promise.resolve({ slug: SEEDED_SLUGS[0] }),
    });
    render(element);
    expect(screen.getByText(`lesson-article:${SEEDED_SLUGS[0]}`)).toBeTruthy();
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
  });

  it("not-founds an unknown slug", async () => {
    await expect(
      LessonPage({ params: Promise.resolve({ slug: "does-not-exist" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(vi.mocked(notFound)).toHaveBeenCalledTimes(1);
  });
});
