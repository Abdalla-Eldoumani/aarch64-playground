import { describe, expect, it } from "vitest";
import {
  CREDIBILITY,
  LICENSE_LABEL,
  LICENSE_URL,
  NAV_ROUTES,
  REPO_URL,
  SHARE_CARD_IMAGE,
  SITE_URL,
  isActiveRoute,
} from "@/lib/content/site";

// site.ts is the single source for routes and canonical URLs; the nav, the
// footer, the sitemap, and robots all read from it. These tests pin the route
// table and the URL derivations with independent literals so a drift in any
// consumer-facing value is a deliberate edit here, not an accident.

describe("canonical urls", () => {
  it("pins the deployed and repository origins", () => {
    expect(SITE_URL).toBe("https://aarch64-playground.vercel.app");
    expect(REPO_URL).toBe("https://github.com/Abdalla-Eldoumani/aarch64-playground");
  });

  it("derives the license link from the repository url", () => {
    expect(LICENSE_URL).toBe(
      "https://github.com/Abdalla-Eldoumani/aarch64-playground/blob/main/LICENSE",
    );
    expect(LICENSE_LABEL).toBe("AGPL-3.0");
  });

  it("keeps the share card image relative at the standard og size", () => {
    // Relative so it resolves through metadataBase to the production origin.
    expect(SHARE_CARD_IMAGE.url).toBe("/og.png");
    expect(SHARE_CARD_IMAGE.width).toBe(1200);
    expect(SHARE_CARD_IMAGE.height).toBe(630);
    expect(SHARE_CARD_IMAGE.alt.length).toBeGreaterThan(0);
  });

  it("states the not-affiliated disclaimer in the credibility copy", () => {
    expect(CREDIBILITY.disclaimer).toContain("Not officially affiliated");
    expect(CREDIBILITY.tagline.length).toBeGreaterThan(0);
    expect(CREDIBILITY.courseContext).toContain("CPSC 355");
    expect(CREDIBILITY.engineNote).toContain("WebAssembly");
  });
});

describe("nav route table", () => {
  it("pins the four routes in nav order with capitalized labels and lowercase hrefs", () => {
    expect(NAV_ROUTES).toEqual([
      { label: "Playground", href: "/playground" },
      { label: "Learn", href: "/learn" },
      { label: "Practice", href: "/practice" },
      { label: "Reference", href: "/reference" },
    ]);
  });
});

describe("isActiveRoute", () => {
  it("marks the root route active only on an exact match", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/learn", "/")).toBe(false);
    expect(isActiveRoute("/anything", "/")).toBe(false);
  });

  it("marks a non-root route active on its own page", () => {
    for (const route of NAV_ROUTES) {
      expect(isActiveRoute(route.href, route.href)).toBe(true);
    }
  });

  it("keeps a section marked while on a nested page", () => {
    expect(isActiveRoute("/learn/loops", "/learn")).toBe(true);
    expect(isActiveRoute("/reference/mov", "/reference")).toBe(true);
    expect(isActiveRoute("/learn/loops/extra", "/learn")).toBe(true);
  });

  it("does not match a sibling path that merely shares the prefix", () => {
    expect(isActiveRoute("/learnx", "/learn")).toBe(false);
    expect(isActiveRoute("/playgrounds", "/playground")).toBe(false);
  });

  it("does not mark a section active from an unrelated page", () => {
    expect(isActiveRoute("/", "/learn")).toBe(false);
    expect(isActiveRoute("/practice", "/learn")).toBe(false);
  });
});
