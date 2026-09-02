import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

// prefetch is a next/link prop, not a DOM attribute: React drops it, so there
// is nothing in the rendered HTML to assert against. This recorder is the only
// way to see it, and it lives in its own file so SiteNav.test.tsx keeps
// rendering the real Link.
vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/practice",
}));

import { SiteNav } from "@/components/chrome/SiteNav";
import { NAV_ROUTES } from "@/lib/content/site";

afterEach(() => cleanup());

function routeLink(label: string): HTMLElement {
  return screen.getByRole("link", { name: label });
}

describe("SiteNav route prefetching", () => {
  it("starts every route link cold", () => {
    render(<SiteNav variant="full" />);
    for (const route of NAV_ROUTES) {
      expect(routeLink(route.label).getAttribute("data-prefetch")).toBe("false");
    }
  });

  it("warms a route link on pointer enter", () => {
    render(<SiteNav variant="full" />);
    const learn = routeLink("Learn");
    fireEvent.mouseEnter(learn);
    expect(routeLink("Learn").getAttribute("data-prefetch")).toBe("null");
    // Only the hovered route warms; the rest stay cold.
    expect(routeLink("Reference").getAttribute("data-prefetch")).toBe("false");
  });

  it("warms a route link on keyboard focus", () => {
    render(<SiteNav variant="full" />);
    fireEvent.focus(routeLink("Learn"));
    expect(routeLink("Learn").getAttribute("data-prefetch")).toBe("null");
  });

  it("leaves the Open playground CTA on the default prefetch", () => {
    render(<SiteNav variant="full" />);
    // The one destination worth warming eagerly: the CTA is the landing's
    // primary action, so it keeps Next's default rather than the hover gate.
    expect(
      screen.getByRole("link", { name: "Open playground" }).getAttribute("data-prefetch"),
    ).toBe("undefined");
  });
});
