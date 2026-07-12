import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeControl } from "@/components/chrome/ThemeControl";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeControl", () => {
  it("renders exactly three theme options with full accessible names", () => {
    render(<ThemeControl />);
    expect(screen.getByRole("button", { name: "dark theme" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "light theme" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "high-contrast theme" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("marks exactly one option active with aria-pressed (the default)", () => {
    render(<ThemeControl />);
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    // matchMedia is stubbed to "not light" and localStorage is cleared, so the
    // hook's default resolves to dark.
    expect(pressed[0].getAttribute("aria-label")).toBe("dark theme");
  });

  it("selecting light sets data-theme=light and moves aria-pressed", () => {
    render(<ThemeControl />);
    const light = screen.getByRole("button", { name: "light theme" });
    fireEvent.click(light);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(light.getAttribute("aria-pressed")).toBe("true");
  });
});
