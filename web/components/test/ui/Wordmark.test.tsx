import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Wordmark } from "@/components/ui/Wordmark";

afterEach(() => cleanup());

describe("Wordmark", () => {
  it("renders one home link whose accessible name carries the visible brand text", () => {
    render(<Wordmark />);

    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("href")).toBe("/");

    // "aarch64" and the screen-reader-only " home" name one link, not two.
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
  });

  it("carries no aria-label that could diverge from the visible text", () => {
    // An aria-label would replace the visible "aarch64" in the link's name,
    // so a screen reader could say something the screen does not.
    render(<Wordmark />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    expect(link.getAttribute("aria-labelledby")).toBeNull();
  });

  it("keeps one home link with no aria-label when the label shows", () => {
    render(<Wordmark showLabel />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
    expect(screen.getByText("playground")).toBeTruthy();
  });

  it("sm-up shows the label but hides it below sm and across the md band", () => {
    render(<Wordmark showLabel="sm-up" />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
    // A 375px nav has no room for the label, and at 768px the labeled mark,
    // the route links and the theme control overflow the screen by 19px.
    const label = screen.getByText("playground");
    expect(label.className).toContain("hidden");
    expect(label.className).toContain("sm:inline");
    expect(label.className).toContain("md:hidden");
    expect(label.className).toContain("lg:inline");
  });

  it("keeps one home link with no aria-label when the label is off", () => {
    render(<Wordmark showLabel={false} />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
    expect(screen.queryByText("playground")).toBeNull();
  });
});
