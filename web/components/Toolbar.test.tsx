import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Toolbar, type ToolbarProps } from "./Toolbar";

afterEach(() => cleanup());

function setup(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    cpsc355Enabled: false,
    onToggleCpsc355: vi.fn(),
    lectureEnabled: false,
    onToggleLecture: vi.fn(),
    hotspotEnabled: false,
    onToggleHotspot: vi.fn(),
    onShare: vi.fn(),
    onTour: vi.fn(),
    onToggleTheme: vi.fn(),
    buildDiagnostic: vi.fn(() => ({ source: "" })),
    onOpenCommandPalette: vi.fn(),
    sourceLink: (
      <a href="https://example.com" aria-label="View source on GitHub">
        source
      </a>
    ),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe("Toolbar", () => {
  it("labels both on-screen groups", () => {
    setup();
    expect(screen.getByText("view and modes")).toBeTruthy();
    expect(screen.getByText("share and tools")).toBeTruthy();
    expect(screen.getByRole("group", { name: "view and modes" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "share and tools" })).toBeTruthy();
  });

  it("gives every control a visible accessible name (no unlabeled overflow)", () => {
    setup();
    for (const name of [
      "toggle cpsc 355 lint mode",
      "toggle lecture mode",
      "toggle hotspot heat map",
      "share program",
      "copy diagnostic bundle to clipboard",
      "start guided tour",
      "toggle theme",
      // The palette opener's name is its visible label (WCAG label-in-name);
      // the title carries the longer description.
      "commands",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("opens the command palette from a visible control (discovery without a shortcut)", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "commands" }));
    expect(props.onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("reflects an active mode with aria-pressed", () => {
    setup({ cpsc355Enabled: true });
    const cpsc = screen.getByRole("button", { name: "toggle cpsc 355 lint mode" });
    expect(cpsc.getAttribute("aria-pressed")).toBe("true");
    const lecture = screen.getByRole("button", { name: "toggle lecture mode" });
    expect(lecture.getAttribute("aria-pressed")).toBe("false");
  });
});
