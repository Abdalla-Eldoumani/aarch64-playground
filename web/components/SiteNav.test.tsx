import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// usePathname must resolve to a real route so the active-route assertion below is
// meaningful; "/practice" is one of the four nav routes.
vi.mock("next/navigation", () => ({
  usePathname: () => "/practice",
}));

import { SiteNav } from "./SiteNav";
import { NAV_ROUTES } from "@/lib/site";

afterEach(() => cleanup());

describe("SiteNav", () => {
  it("full variant carries the label, the CTA, the routes, and marks the active route", () => {
    render(<SiteNav variant="full" />);

    // The "playground" label and the call to action exist only in the full bar.
    expect(screen.getByText("playground")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open playground" })).toBeTruthy();

    // All four routes render as links pointing at their own hrefs.
    expect(NAV_ROUTES).toHaveLength(4);
    for (const route of NAV_ROUTES) {
      const link = screen.getByRole("link", { name: route.label });
      expect(link.getAttribute("href")).toBe(route.href);
    }

    // Exactly the current route (/practice) is flagged aria-current="page";
    // a different route is not.
    expect(
      screen.getByRole("link", { name: "Practice" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Learn" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("slim variant drops the label and CTA but keeps the routes and the github link", () => {
    render(<SiteNav variant="slim" />);

    // Slim omits both the brand label and the Open-playground CTA.
    expect(screen.queryByText("playground")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open playground" })).toBeNull();

    // The route links survive in slim...
    for (const route of NAV_ROUTES) {
      expect(screen.getByRole("link", { name: route.label })).toBeTruthy();
    }

    // ...and the rel-hardened github source link is present in both variants.
    const github = screen.getByRole("link", { name: "source on github" });
    expect(github.getAttribute("rel")).toBe("noreferrer noopener");
  });
});
