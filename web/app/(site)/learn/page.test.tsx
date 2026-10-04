import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

// The client renderers are replaced with text markers so this test exercises the
// server route wiring (loader -> page -> props) without pulling in the editor,
// worker, or markdown stack. The markers echo what the pages hand them, so the
// assertions prove the data actually flowed through.
vi.mock("@/components/learn/LessonIndex", () => ({
  LessonIndex: ({ lessons }: { lessons: Array<{ slug: string }> }) =>
    `lesson-index:${lessons.length}`,
}));
vi.mock("@/components/learn/LessonArticle", () => ({
  LessonArticle: ({
    lesson,
    sheetNumber,
    children,
  }: {
    lesson: { slug: string };
    sheetNumber: string;
    children?: React.ReactNode;
  }) => (
    <>
      {`lesson-article:${lesson.slug}:${sheetNumber}`}
      {children}
    </>
  ),
}));

// notFound throws, as the real one does to stop rendering, so an unknown slug
// shows up here as a rejection plus a spy call.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { notFound } from "next/navigation";
import LearnPage from "./page";
import LessonPage, { dynamicParams, generateStaticParams } from "./[slug]/page";

const SEEDED_SLUGS = ["registers-and-immediates", "stack-and-frame-pointer"];

// Each lesson file is named after its slug, so the folder is a list
// the loader under test did not produce.
const FILE_SLUGS = fs
  .readdirSync(path.join(process.cwd(), "content/lessons"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.slice(0, -".json".length));

// The same folder in reading order, sorted here by each file's own `order`,
// with the raw text kept for the practice links it names.
const BY_ORDER = FILE_SLUGS.map((slug) => {
  const raw = fs.readFileSync(path.join(process.cwd(), "content/lessons", `${slug}.json`), "utf8");
  const { title, order } = JSON.parse(raw) as { title: string; order: number };
  return { slug, title, order, raw };
}).sort((a, b) => a.order - b.order);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("learn routes", () => {
  it("builds one static page per lesson file", () => {
    const slugs = generateStaticParams().map((entry) => entry.slug);
    expect([...slugs].sort()).toEqual([...FILE_SLUGS].sort());
    for (const slug of SEEDED_SLUGS) expect(slugs).toContain(slug);
    // dynamicParams off means only these slugs render; anything else 404s.
    expect(dynamicParams).toBe(false);
  });

  it("renders the index from every validated lesson", () => {
    const expectedCount = FILE_SLUGS.length;
    render(<LearnPage />);
    expect(screen.getByText(`lesson-index:${expectedCount}`)).toBeTruthy();
  });

  it("renders the article for a known slug", async () => {
    const element = await LessonPage({
      params: Promise.resolve({ slug: SEEDED_SLUGS[0] }),
    });
    render(element);
    expect(screen.getByText(new RegExp(`^lesson-article:${SEEDED_SLUGS[0]}:4\\.\\d+$`))).toBeTruthy();
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
  });

  describe.each([
    ["first", 0],
    ["middle", Math.floor(BY_ORDER.length / 2)],
    ["last", BY_ORDER.length - 1],
  ])("the %s lesson's foot", (_, index) => {
    const entry = BY_ORDER[index];

    it("numbers the lesson and links the lessons either side", async () => {
      render(await LessonPage({ params: Promise.resolve({ slug: entry.slug }) }));
      expect(screen.getByText(`lesson-article:${entry.slug}:4.${index + 1}`)).toBeTruthy();
      const nav = screen.getByRole("navigation", { name: "Previous and next lesson" });
      const links = within(nav).getAllByRole("link");
      const expected: { href: string; text: string }[] = [];
      if (index > 0) {
        const before = BY_ORDER[index - 1];
        expected.push({ href: `/learn/${before.slug}`, text: `previous · 4.${index} ${before.title}` });
      }
      if (index < BY_ORDER.length - 1) {
        const after = BY_ORDER[index + 1];
        expected.push({ href: `/learn/${after.slug}`, text: `next · 4.${index + 2} ${after.title}` });
      } else {
        expected.push({ href: "/practice", text: "next · 05 Practice" });
      }
      expect(
        links.map((link) => ({
          href: link.getAttribute("href"),
          text: (link.textContent ?? "").replace(/<- |\s->/g, ""),
        })),
      ).toEqual(expected);
    });

    it("links every exercise the lesson's text names, and nothing else", async () => {
      const { container } = render(
        await LessonPage({ params: Promise.resolve({ slug: entry.slug }) }),
      );
      const named = [...new Set([...entry.raw.matchAll(/\]\(\/practice\/([a-z0-9-]+)\)/g)].map((m) => m[1]))];
      const section = container.querySelector('section[aria-labelledby="lesson-practise-this"]');
      const shown = section
        ? [...section.querySelectorAll("a")].map((a) => a.getAttribute("href")?.replace("/practice/", ""))
        : [];
      expect([...shown].sort()).toEqual([...named].sort());
    });
  });

  it("sends an unknown slug to the 404 page", async () => {
    await expect(
      LessonPage({ params: Promise.resolve({ slug: "does-not-exist" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(vi.mocked(notFound)).toHaveBeenCalledTimes(1);
  });
});
