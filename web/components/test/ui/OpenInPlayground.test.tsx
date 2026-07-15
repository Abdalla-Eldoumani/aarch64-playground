// Pins the shared playground hand-off: an <a> to the given deep link, named
// "Open in playground", styled as the bordered cyan pill, with caller layout
// classes appended. The learn article and the practice sheet both draw from it.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OpenInPlayground } from "@/components/ui/OpenInPlayground";

afterEach(() => cleanup());

describe("OpenInPlayground", () => {
  it("renders a link to the given href with the accessible name", () => {
    render(<OpenInPlayground href="/playground#p2=abc" />);
    const link = screen.getByRole("link", { name: /open in playground/i });
    expect(link.getAttribute("href")).toBe("/playground#p2=abc");
  });

  it("styles the link as a bordered 44px pill and appends caller classes", () => {
    render(<OpenInPlayground href="/playground#x" className="mt-2" />);
    const link = screen.getByRole("link", { name: /open in playground/i });
    expect(link.className).toContain("min-h-[44px]");
    expect(link.className).toContain("border-[color-mix(in_srgb,var(--cyan)");
    expect(link.className).toContain("mt-2");
  });
});
