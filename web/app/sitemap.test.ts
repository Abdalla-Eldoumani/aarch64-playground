import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import robots from "./robots";
import { SITE_URL } from "@/lib/site";

describe("sitemap", () => {
  const entries = sitemap();

  it("lists exactly the four public routes", () => {
    expect(entries).toHaveLength(4);
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
