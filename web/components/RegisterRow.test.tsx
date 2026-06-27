import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RegisterRow } from "./RegisterRow";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("RegisterRow", () => {
  it("renders the name, alias, and value columns", () => {
    render(<RegisterRow name="X0" alias="arg0" value="0x0000000000000001" />);
    expect(screen.getByText("X0")).toBeTruthy();
    expect(screen.getByText("arg0")).toBeTruthy();
    expect(screen.getByText("0x0000000000000001")).toBeTruthy();
  });

  it("aligns the value with tabular figures so hex lines up", () => {
    render(<RegisterRow name="X1" value="0x00000000deadbeef" />);
    expect(screen.getByText("0x00000000deadbeef").className).toContain("tabular-nums");
  });

  it("drives the write flash and value tint from --changed when changed", () => {
    const { container } = render(<RegisterRow name="X2" value="0x2a" changed />);
    // the flash overlay reads its color from the theme-following --changed token
    expect(container.innerHTML).toContain("bg-[var(--changed)]");
    expect(screen.getByText("0x2a").className).toContain("text-[var(--changed)]");
  });

  it("stays static (no flash overlay, no tint) when unchanged", () => {
    const { container } = render(<RegisterRow name="X3" value="0x0" />);
    expect(container.innerHTML).not.toContain("bg-[var(--changed)]");
    expect(screen.getByText("0x0").className).not.toContain("text-[var(--changed)]");
  });

  it("keeps the alias legible: secondary token at full opacity, not a faded label", () => {
    render(<RegisterRow name="X30" alias="lr" value="0x0" />);
    const alias = screen.getByText("lr");
    expect(alias.className).toContain("text-[var(--text-secondary)]");
    expect(alias.className).not.toContain("opacity-");
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<RegisterRow name="X0" alias="arg0" value="0x0" changed />);
      expect(screen.getByText("X0")).toBeTruthy();
      unmount();
    }
  });
});
