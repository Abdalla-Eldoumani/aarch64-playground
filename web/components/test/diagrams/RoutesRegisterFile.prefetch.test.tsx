import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

// prefetch is a next/link prop, not a DOM attribute, so only a recorder can
// see it. Its own file keeps RoutesRegisterFile.test.tsx on the real Link.
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

import { RoutesRegisterFile } from "@/components/diagrams/RoutesRegisterFile";

afterEach(() => cleanup());

describe("RoutesRegisterFile route prefetching", () => {
  it("never prefetches the jump-table routes", () => {
    render(<RoutesRegisterFile />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.getAttribute("data-prefetch")).toBe("false");
    }
  });
});
