import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SiteFooter } from "./SiteFooter";
import { NAV_ROUTES, REPO_URL, CREDIBILITY, LICENSE_URL } from "@/lib/site";

afterEach(() => cleanup());

describe("SiteFooter", () => {
  it("renders the exact disclaimer, repo + license links, and route links", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(
        "Built for CPSC 355. Not officially affiliated with the University of Calgary.",
        // The disclaimer shares its fine-print line with the open-source note,
        // so match the sentence inside the line rather than the whole line.
        { exact: false },
      ),
    ).toBeTruthy();

    const links = screen.getAllByRole("link");
    // The repository link points at REPO_URL exactly; the license link is built
    // from REPO_URL and ends at the LICENSE file.
    expect(links.some((l) => l.getAttribute("href") === REPO_URL)).toBe(true);
    expect(
      links.some((l) => l.getAttribute("href")?.endsWith("/blob/main/LICENSE")),
    ).toBe(true);

    // All four routes render as links with their hrefs.
    for (const route of NAV_ROUTES) {
      const link = screen.getByRole("link", { name: route.label });
      expect(link.getAttribute("href")).toBe(route.href);
    }
  });

  it("leaks no email and no author name into the footer body", () => {
    const { container } = render(<SiteFooter />);
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toContain("Abdalla");
  });

  it("renders the credibility text and license link from the shared site source", () => {
    render(<SiteFooter />);
    // Read the same constants the component reads, so a future drift in site.ts
    // fails here instead of passing against a hard-coded copy in the footer.
    expect(screen.getByText(CREDIBILITY.tagline)).toBeTruthy();
    expect(screen.getByText(CREDIBILITY.courseContext)).toBeTruthy();
    expect(screen.getByText(new RegExp(CREDIBILITY.disclaimer))).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === LICENSE_URL)).toBe(true);
  });

  it("carries the merged credibility content: engine note and the open-source line", () => {
    render(<SiteFooter />);
    // The footer is the single home for the facts the landing's credibility band
    // used to restate: how the emulator is built, and that it is open source.
    expect(screen.getByText(CREDIBILITY.engineNote)).toBeTruthy();
    expect(screen.getByText(/open source, free to use and study/i)).toBeTruthy();
  });

  it("links the repository and the license exactly once each", () => {
    render(<SiteFooter />);
    // The merged footer deduplicates what the footer and the old landing band
    // both carried; a second repo or license link is a regression.
    const links = screen.getAllByRole("link");
    expect(links.filter((l) => l.getAttribute("href") === REPO_URL)).toHaveLength(1);
    expect(links.filter((l) => l.getAttribute("href") === LICENSE_URL)).toHaveLength(1);
  });
});
