// Lesson and exercise pages both link to the playground through this one
// component.
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

  it("appends caller layout classes", () => {
    render(<OpenInPlayground href="/playground#x" className="mt-2" />);
    const link = screen.getByRole("link", { name: /open in playground/i });
    expect(link.className).toContain("mt-2");
  });
});
