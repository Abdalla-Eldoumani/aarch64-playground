import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

// The checker frame is the editor, not practice text, and it needs a worker.
vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: () => null,
}));

// The real loaders, read once as the file loads: one read opens every
// exercise file, and a read per test overran the five-second limit.
vi.mock("@/lib/content/exercises", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/content/exercises")>();
  const all = real.loadAllExercises();
  const index = real.loadExerciseIndex();
  return {
    ...real,
    loadAllExercises: () => all,
    loadExerciseIndex: () => index,
    loadExercise: (slug: string) => all.find((exercise) => exercise.slug === slug),
  };
});

import PracticePage from "./page";
import ExercisePage, { generateStaticParams } from "./[slug]/page";

afterEach(cleanup);

/** Every text node with a backtick that is not inside code or a code block. */
function bareBackticks(root: HTMLElement): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.includes("`") && !node.parentElement?.closest("code, pre")) {
      hits.push(node.textContent.trim());
    }
  }
  return hits;
}

// Markdown marks code with backticks; a backtick a student can see means a
// field was rendered as plain text where it needed the renderer.
describe("practice text shows no backtick outside code", () => {
  it("/practice", () => {
    const { container } = render(<PracticePage />);
    expect(container.querySelectorAll("a[href^='/practice/'] code").length).toBeGreaterThan(0);
    expect(bareBackticks(container)).toEqual([]);
  });

  it.each(generateStaticParams().map(({ slug }) => [slug]))("/practice/%s", async (slug) => {
    const { container } = render(await ExercisePage({ params: Promise.resolve({ slug }) }));
    expect(bareBackticks(container)).toEqual([]);
  });
});
