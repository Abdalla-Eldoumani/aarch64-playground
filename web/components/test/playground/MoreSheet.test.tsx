// Pins the phone playground's menu sheet: it drops the site bar, so its site
// section carries the theme swatches and the source link itself.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MoreSheet } from "@/components/playground/MoreSheet";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("MoreSheet", () => {
  it("carries the theme swatches and the source link in its site section", () => {
    render(<MoreSheet open onClose={vi.fn()} sections={[]} />);
    const site = screen.getByRole("navigation", { name: "site" });
    const group = within(site).getByRole("radiogroup", { name: "theme" });
    expect(within(group).getAllByRole("radio")).toHaveLength(6);
    const source = within(site).getByRole("link", { name: "source on github" });
    expect(source.getAttribute("href")).toMatch(/^https:\/\/github\.com\//);
    expect(source.getAttribute("target")).toBe("_blank");
  });

  it("switches the theme from a swatch and stays open", () => {
    const onClose = vi.fn();
    render(<MoreSheet open onClose={onClose} sections={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: "forest" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("forest");
    expect(onClose).not.toHaveBeenCalled();
  });
});
