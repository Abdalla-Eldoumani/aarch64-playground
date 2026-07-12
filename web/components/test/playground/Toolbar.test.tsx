import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Toolbar, type ToolbarProps } from "@/components/playground/Toolbar";

afterEach(() => cleanup());

function setup(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
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
  it("labels the tools group", () => {
    setup();
    expect(screen.getByText("tools")).toBeTruthy();
    expect(screen.getByRole("group", { name: "share and tools" })).toBeTruthy();
  });

  it("gives every control a visible accessible name (no unlabeled overflow)", () => {
    setup();
    for (const name of [
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


});
