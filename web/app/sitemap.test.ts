import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import robots from "./robots";
import { SITE_URL } from "@/lib/content/site";
import { loadAllLessons } from "@/lib/content/lessons";
import { loadAllExercises } from "@/lib/content/exercises";

describe("sitemap", () => {
  const entries = sitemap();
  // The expected slug sets come from the same loaders the pages use, so adding
  // a lesson or exercise cannot leave the sitemap behind; the derived count
  // fails loudly if the fixed-route set drifts.
  // Read once: each loader call rereads and revalidates the whole folder.
  const lessons = loadAllLessons();
  const exercises = loadAllExercises();
  const lessonSlugs = lessons.map((lesson) => lesson.slug);
  const exerciseSlugs = exercises.map((exercise) => exercise.slug);

  it("lists the five fixed routes plus every lesson and exercise", () => {
    expect(entries).toHaveLength(5 + lessonSlugs.length + exerciseSlugs.length);
  });

  it("carries one entry per lesson at content priority", () => {
    for (const slug of lessonSlugs) {
      const entry = entries.find(
        (candidate) => candidate.url === new URL(`/learn/${slug}`, SITE_URL).toString(),
      );
      expect(entry).toBeDefined();
      expect(entry?.priority).toBe(0.6);
      expect(entry?.changeFrequency).toBe("monthly");
    }
  });

  it("carries one entry per exercise at content priority", () => {
    for (const slug of exerciseSlugs) {
      const entry = entries.find(
        (candidate) => candidate.url === new URL(`/practice/${slug}`, SITE_URL).toString(),
      );
      expect(entry).toBeDefined();
      expect(entry?.priority).toBe(0.6);
      expect(entry?.changeFrequency).toBe("monthly");
    }
  });

  it("emits absolute https URLs on the bare domain", () => {
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\/aarch64-playground\.com\//);
    }
  });

  it("maps the home route to the canonical origin at top priority", () => {
    const home = entries.find(
      (entry) => entry.url === new URL("/", SITE_URL).toString(),
    );
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  it("includes the dedicated playground route", () => {
    const playground = entries.find(
      (entry) => entry.url === new URL("/playground", SITE_URL).toString(),
    );
    expect(playground).toBeDefined();
  });

  it("gives every entry a change frequency and a numeric priority", () => {
    for (const entry of entries) {
      expect(entry.changeFrequency).toBeDefined();
      expect(typeof entry.priority).toBe("number");
    }
  });

  it("dates each lesson and exercise from its own lastUpdated field", () => {
    const pages = [
      ...lessons.map((item) => ({ path: `/learn/${item.slug}`, date: item.lastUpdated })),
      ...exercises.map((item) => ({ path: `/practice/${item.slug}`, date: item.lastUpdated })),
    ];
    for (const page of pages) {
      const entry = entries.find((candidate) => candidate.url === new URL(page.path, SITE_URL).toString());
      expect(page.date, page.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry?.lastModified, page.path).toBe(page.date);
    }
  });

  it("dates each index by its newest item and leaves undated what no content file dates", () => {
    const newest = (dates: (string | undefined)[]) => dates.filter(Boolean).sort().at(-1);
    const lastmod = (path: string) =>
      entries.find((entry) => entry.url === new URL(path, SITE_URL).toString())?.lastModified;
    expect(lastmod("/learn")).toBe(newest(lessons.map((item) => item.lastUpdated)));
    expect(lastmod("/practice")).toBe(newest(exercises.map((item) => item.lastUpdated)));
    for (const path of ["/", "/playground", "/reference"]) expect(lastmod(path), path).toBeUndefined();
  });

  it("never stamps the build time", () => {
    // A date is always a content file's string, never a Date made at build.
    for (const entry of entries) {
      expect(entry.lastModified === undefined || typeof entry.lastModified === "string", entry.url).toBe(true);
    }
  });
});

describe("robots", () => {
  const policy = robots();
  const rule = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules;
  const sitemapUrl = Array.isArray(policy.sitemap)
    ? policy.sitemap[0]
    : policy.sitemap;

  it("allows every user agent to index the site", () => {
    expect(rule?.userAgent).toBe("*");
    expect(rule?.allow).toBe("/");
  });

  it("references the sitemap at its https address", () => {
    expect(sitemapUrl).toBe("https://aarch64-playground.com/sitemap.xml");
  });
});
