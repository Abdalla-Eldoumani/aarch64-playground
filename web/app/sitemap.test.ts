import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import robots from "./robots";
import { SITE_URL } from "@/lib/content/site";
import { loadAllLessons } from "@/lib/content/lessons";
import { loadAllExercises } from "@/lib/content/exercises";

describe("sitemap", () => {
  const entries = sitemap();
  // The expected slug sets come from the same loaders the pages use, so adding
  // a lesson or exercise cannot leave the sitemap behind: the count below is
  // the only number to update, and it fails loudly when it drifts.
  const lessonSlugs = loadAllLessons().map((lesson) => lesson.slug);
  const exerciseSlugs = loadAllExercises().map((exercise) => exercise.slug);

  it("lists the five fixed routes plus every lesson and exercise", () => {
    expect(entries).toHaveLength(20);
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

  it("emits absolute URLs anchored to the single site origin", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
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

  it("references the sitemap", () => {
    expect(sitemapUrl?.endsWith("/sitemap.xml")).toBe(true);
  });
});
