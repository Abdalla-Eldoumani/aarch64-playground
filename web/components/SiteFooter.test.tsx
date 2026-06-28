import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SiteFooter } from "./SiteFooter";
import { NAV_ROUTES, REPO_URL } from "@/lib/site";

afterEach(() => cleanup());

describe("SiteFooter", () => {
  it("renders the exact disclaimer, repo + license links, and route links", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(
        "Built for CPSC 355. Not officially affiliated with the University of Calgary.",
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
});
