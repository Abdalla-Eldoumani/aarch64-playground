import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

// prefetch is a next/link prop, not a DOM attribute, so only a recorder can
// see it. Its own file keeps SiteFooter.test.tsx on the real Link.
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

import { SiteFooter } from "@/components/chrome/SiteFooter";
import { NAV_ROUTES } from "@/lib/content/site";

afterEach(() => cleanup());

describe("SiteFooter route prefetching", () => {
  it("never prefetches the footer routes", () => {
    render(<SiteFooter />);
    for (const route of NAV_ROUTES) {
      expect(
        screen.getByRole("link", { name: route.label }).getAttribute("data-prefetch"),
      ).toBe("false");
    }
  });
});
