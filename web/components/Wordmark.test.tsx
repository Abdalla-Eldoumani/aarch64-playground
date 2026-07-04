import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Wordmark } from "./Wordmark";

afterEach(() => cleanup());

describe("Wordmark", () => {
  it("renders one home link whose accessible name carries the visible brand text", () => {
    render(<Wordmark />);

    // Primary query from the accessibility contract: the visible "aarch64"
    // mark is part of the link's accessible name.
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("href")).toBe("/");

    // The same link is also reachable by "home": its accessible name contains
    // both the brand text and the "home" affordance (the sr-only span), so the
    // two queries must resolve to one and the same element.
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
  });

  it("carries no aria-label that could diverge from the visible text", () => {
    // Regression guard for the fixed label-content-name-mismatch: the name is
    // built from the visible "aarch64" text plus an sr-only " home", never from
    // an aria-label that says something different from what is on screen.
    render(<Wordmark />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    expect(link.getAttribute("aria-labelledby")).toBeNull();
  });

  it("keeps the contract with the label shown", () => {
    render(<Wordmark showLabel />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    // Still one link, still reachable by both the brand text and "home" even
    // with the "playground" label riding alongside.
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
    expect(screen.getByText("playground")).toBeTruthy();
  });

  it("sm-up renders the label but yields it below the sm breakpoint", () => {
    render(<Wordmark showLabel="sm-up" />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
    // The label stays in the DOM (wide viewports show it) but must carry the
    // responsive classes that keep it out of a 375px nav, where the labeled
    // mark plus the actions cluster overflow the viewport.
    const label = screen.getByText("playground");
    expect(label.className).toContain("hidden");
    expect(label.className).toContain("sm:inline");
  });

  it("keeps the contract with the label hidden", () => {
    render(<Wordmark showLabel={false} />);
    const link = screen.getByRole("link", { name: /aarch64/i });
    expect(link.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("link", { name: /home/i })).toBe(link);
    // Collapsed: the quiet "playground" label is gone, the mark stands alone.
    expect(screen.queryByText("playground")).toBeNull();
  });
});
