// Every page the sitemap lists, read the way a crawler reads it: the title,
// the snippet, the canonical address, the share card, and the structured
// data. Lesson and exercise copy comes from content files, so these tests
// hold every shipped file to the limits, not just the ones written today.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

// The client views are markers: this file reads route metadata and the
// ld+json the routes render, not the views. The star lookup would reach
// the network.
vi.mock("@/components/landing/Hero", () => ({ Hero: () => null }));
vi.mock("@/components/diagrams/RoutesRegisterFile", () => ({ RoutesRegisterFile: () => null }));
vi.mock("@/components/landing/FeatureCatalog", () => ({ FeatureCatalog: () => null }));
vi.mock("@/components/learn/LessonArticle", () => ({ LessonArticle: () => null }));
vi.mock("@/components/practice/ExerciseView", () => ({ ExerciseView: () => null }));
vi.mock("@/components/practice/InteractiveExerciseView", () => ({ InteractiveExerciseView: () => null }));
vi.mock("@/lib/content/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/github")>()),
  fetchStarCount: async () => null,
}));
// The real content, read once: each page call rereads the whole folder, and
// 140 pages of that is most of this file's run time.
vi.mock("@/lib/content/lessons", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/content/lessons")>();
  const all = real.loadAllLessons();
  return { ...real, loadAllLessons: () => all, loadLesson: (slug: string) => all.find((item) => item.slug === slug) };
});
vi.mock("@/lib/content/exercises", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/content/exercises")>();
  const all = real.loadAllExercises();
  return { ...real, loadAllExercises: () => all, loadExercise: (slug: string) => all.find((item) => item.slug === slug) };
});

import sitemap from "./sitemap";
import LandingPage, { metadata as homeMetadata } from "./(site)/page";
import { metadata as learnMetadata } from "./(site)/learn/page";
import LessonPage, { generateMetadata as lessonMetadata } from "./(site)/learn/[slug]/page";
import { metadata as practiceMetadata } from "./(site)/practice/page";
import ExercisePage, { generateMetadata as exerciseMetadata } from "./(site)/practice/[slug]/page";
import { metadata as referenceMetadata } from "./(site)/reference/page";
import PlaygroundLayout, { metadata as playgroundMetadata } from "./playground/layout";
import { metadata as notFoundMetadata } from "./not-found";
import { loadAllLessons } from "@/lib/content/lessons";
import { loadAllExercises } from "@/lib/content/exercises";
import { practiceSide } from "@/lib/content/practice-topics";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/content/seo";
import { SHARE_CARD_IMAGE, SITE_NAME, SITE_URL } from "@/lib/content/site";

afterEach(() => cleanup());

const lessons = loadAllLessons();
const exercises = loadAllExercises();
const slugParams = (slug: string) => ({ params: Promise.resolve({ slug }) });

interface Page {
  path: string;
  meta: Metadata;
}

const pages: Page[] = [
  { path: "/", meta: homeMetadata },
  { path: "/playground", meta: playgroundMetadata },
  { path: "/learn", meta: learnMetadata },
  { path: "/practice", meta: practiceMetadata },
  { path: "/reference", meta: referenceMetadata },
  ...(await Promise.all(
    lessons.map(async (lesson) => ({
      path: `/learn/${lesson.slug}`,
      meta: await lessonMetadata(slugParams(lesson.slug)),
    })),
  )),
  ...(await Promise.all(
    exercises.map(async (exercise) => ({
      path: `/practice/${exercise.slug}`,
      meta: await exerciseMetadata(slugParams(exercise.slug)),
    })),
  )),
];

function titleOf(meta: Metadata): string {
  const title = meta.title;
  if (title && typeof title === "object" && "absolute" in title && title.absolute) return title.absolute;
  throw new Error("expected an absolute title");
}

describe("per-page titles and snippets", () => {
  it("cover every page the sitemap lists", () => {
    const listed = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(pages.map((page) => page.path).sort()).toEqual(listed.sort());
  });

  it("give each page its own title, inside Google's display length", () => {
    const seen = new Map<string, string>();
    for (const { path: route, meta } of pages) {
      const title = titleOf(meta);
      expect(title.length, `${route}: ${title}`).toBeLessThanOrEqual(TITLE_MAX);
      expect(title, route).not.toMatch(/—/);
      expect(seen.get(title), `${route} shares its title with ${seen.get(title)}`).toBeUndefined();
      seen.set(title, route);
    }
  });

  it("carry the site name wherever it fits beside the page's own title", () => {
    const suffix = ` · ${SITE_NAME}`;
    for (const { path: route, meta } of pages) {
      const title = titleOf(meta);
      if (!title.endsWith(suffix)) expect(title.length + suffix.length, route).toBeGreaterThan(TITLE_MAX);
    }
  });

  it("give each page its own snippet, inside Google's display length", () => {
    const seen = new Map<string, string>();
    for (const { path: route, meta } of pages) {
      const description = meta.description ?? "";
      expect(description.length, `${route}: ${description}`).toBeGreaterThanOrEqual(50);
      expect(description.length, `${route}: ${description}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(description, route).not.toMatch(/—|checked by running your program against|tuned for/);
      expect(seen.get(description), `${route} shares its snippet with ${seen.get(description)}`).toBeUndefined();
      seen.set(description, route);
    }
  });

  it("say what a lesson teaches with its summary, and what an exercise asks with its prompt", async () => {
    const lesson = lessons.find((item) => item.slug === "pretest-loop")!;
    expect((await lessonMetadata(slugParams("pretest-loop"))).description).toBe(lesson.summary);
    const exercise = await exerciseMetadata(slugParams("sum-to-n"));
    expect(exercise.description).toMatch(/^Write a loop that adds up every integer from 1 to n/);
  });

  it("restate the whole card with the page's own address", () => {
    for (const { path: route, meta } of pages) {
      const title = titleOf(meta);
      expect(meta.alternates?.canonical, route).toBe(route);
      const og = meta.openGraph;
      expect(og?.url, route).toBe(route);
      expect(og?.siteName, route).toBe(SITE_NAME);
      expect(og?.title, route).toBe(title);
      expect(og?.description, route).toBe(meta.description);
      expect(og?.images, route).toEqual([SHARE_CARD_IMAGE]);
      expect(meta.twitter?.title, route).toBe(title);
      expect(meta.twitter?.images, route).toEqual([SHARE_CARD_IMAGE]);
    }
  });

  it("keep the 404 out of the index, with no address of its own", () => {
    expect(notFoundMetadata.robots).toEqual({ index: false });
    expect(notFoundMetadata.alternates).toBeNull();
    expect(notFoundMetadata.openGraph?.url).toBeUndefined();
    expect(titleOf(notFoundMetadata)).toBe(`404 · ${SITE_NAME}`);
  });
});

type Node = Record<string, unknown>;

/** The ld+json payloads a rendered page carries, parsed, with their raw text. */
function structuredData(element: React.ReactElement): { raw: string; graph: Node[] }[] {
  const { container } = render(element);
  const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
  cleanup();
  return scripts.map((script) => {
    const raw = script.textContent ?? "";
    const parsed = JSON.parse(raw) as Node;
    expect(parsed["@context"]).toBe("https://schema.org");
    return { raw, graph: parsed["@graph"] as Node[] };
  });
}

/** Every string in the payload that names a web address. */
function urlsIn(value: unknown): string[] {
  if (typeof value === "string") return /^[a-z]+:\/\//i.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(urlsIn);
  return [];
}

const siteUrl = (route: string) => new URL(route, SITE_URL).href;

// Google's required properties for each type it reads, plus the fields
// schema.org needs to say what the page is.
function expectWebSite(node: Node) {
  expect(node.name).toBe(SITE_NAME);
  expect(node.url).toBe(siteUrl("/"));
}

function expectBreadcrumb(node: Node, trail: [string, string][]) {
  expect(node["@type"]).toBe("BreadcrumbList");
  expect(node.itemListElement).toEqual(
    trail.map(([name, route], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: siteUrl(route),
    })),
  );
}

function expectLearningResource(node: Node, fields: { name: string; route: string; type: string; date?: string }) {
  expect(node["@type"]).toBe("LearningResource");
  expect(node.name).toBe(fields.name);
  expect(typeof node.description).toBe("string");
  expect(node.url).toBe(siteUrl(fields.route));
  expect(node.learningResourceType).toBe(fields.type);
  expect(node.inLanguage).toBe("en");
  expect(node.isAccessibleForFree).toBe(true);
  expect(node.dateModified).toBe(fields.date);
  expectWebSite(node.isPartOf as Node);
}

describe("structured data per route type", () => {
  it("names the site on the home page", () => {
    const [payload] = structuredData(<LandingPage />);
    expect(payload.graph).toHaveLength(1);
    const [site] = payload.graph;
    expect(site["@type"]).toBe("WebSite");
    expectWebSite(site);
    expect(site.description).toBe(homeMetadata.description);
  });

  it("describes the playground as a free app", async () => {
    const [payload] = structuredData(await PlaygroundLayout({ children: null }));
    const [app] = payload.graph;
    expect(app["@type"]).toBe("SoftwareApplication");
    expect(app.name).toBe(SITE_NAME);
    expect(app.url).toBe(siteUrl("/playground"));
    expect(app.applicationCategory).toBe("EducationalApplication");
    expect(app.operatingSystem).toBeTruthy();
    expect(app.offers).toEqual({ "@type": "Offer", price: 0, priceCurrency: "CAD" });
  });

  it("marks every lesson as a learning resource with its trail", async () => {
    for (const lesson of lessons) {
      const route = `/learn/${lesson.slug}`;
      const [payload] = structuredData(await LessonPage(slugParams(lesson.slug)));
      const [resource, trail] = payload.graph;
      expectLearningResource(resource, { name: lesson.title, route, type: "lesson", date: lesson.lastUpdated });
      expectBreadcrumb(trail, [["Home", "/"], ["Learn", "/learn"], [lesson.title, route]]);
    }
  });

  it("marks every exercise as an exercise or a quiz, with its topic and trail", async () => {
    for (const exercise of exercises) {
      const route = `/practice/${exercise.slug}`;
      const [payload] = structuredData(await ExercisePage(slugParams(exercise.slug)));
      const [resource, trail] = payload.graph;
      expectLearningResource(resource, {
        name: exercise.title,
        route,
        type: practiceSide(exercise) === "code" ? "exercise" : "quiz",
        date: exercise.lastUpdated,
      });
      expect((resource.about as Node).name, route).toBeTruthy();
      expectBreadcrumb(trail, [["Home", "/"], ["Practice", "/practice"], [exercise.title, route]]);
    }
  });

  it("gives out only https addresses on the bare domain, with no raw < in the payload", async () => {
    const payloads = [
      ...structuredData(<LandingPage />),
      ...structuredData(await PlaygroundLayout({ children: null })),
      ...structuredData(await LessonPage(slugParams(lessons[0].slug))),
      ...structuredData(await ExercisePage(slugParams(exercises[0].slug))),
    ];
    for (const { raw, graph } of payloads) {
      expect(raw).not.toContain("<");
      for (const url of urlsIn(graph)) expect(url).toMatch(/^https:\/\/aarch64-playground\.com\//);
    }
  });
});

describe("llms.txt", () => {
  // Vitest runs from web/, so the public dir sits under the cwd.
  const text = fs.readFileSync(path.join(process.cwd(), "public", "llms.txt"), "utf8");
  const links = [...text.matchAll(/\]\((\S+?)\)/g)].map((match) => match[1]);

  it("opens with the site's name, as the format asks", () => {
    expect(text.startsWith(`# ${SITE_NAME}\n`)).toBe(true);
  });

  it("links every main section by its https address", () => {
    for (const route of ["/", "/playground", "/learn", "/practice", "/reference"]) {
      expect(links, route).toContain(siteUrl(route));
    }
  });

  it("gives out only https links, and site links only on the bare domain", () => {
    for (const link of links) {
      expect(link).toMatch(/^https:\/\//);
      if (link.includes("aarch64-playground.com")) {
        expect(link).toMatch(/^https:\/\/aarch64-playground\.com\//);
      }
    }
  });

  it("stays plain text with no em dash", () => {
    expect(text).not.toMatch(/—/);
    expect(text).not.toMatch(/<[a-z]/i);
  });
});
