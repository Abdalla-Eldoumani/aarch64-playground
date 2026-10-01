import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Toolbar, type ToolbarProps } from "@/components/playground/Toolbar";

afterEach(() => cleanup());

function setup(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    onShare: vi.fn(),
    onTutorials: vi.fn(),
    onToggleTheme: vi.fn(),
    buildDiagnostic: vi.fn(async () => ({ source: "" })),
    onOpenCommandPalette: vi.fn(),
    onOpenShortcuts: vi.fn(),
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

  it("gives every control a visible, accessible name", () => {
    setup();
    for (const name of [
      "share program",
      "diagnostic bundle",
      "tutorials",
      "toggle theme",
      // The palette opener's name is its visible label (WCAG label-in-name);
      // the title carries the longer description.
      "commands",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("opens the command palette from a visible button, not only a shortcut", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "commands" }));
    expect(props.onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("opens the tutorials from the button named for them", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "tutorials" }));
    expect(props.onTutorials).toHaveBeenCalledTimes(1);
  });

  // On a phone the tutorials panel is a third tap from the menu, so the menu
  // offers the walkthrough itself; the wide band keeps it inside tutorials.
  it("offers the walkthrough only where it is passed", () => {
    const onWalkthrough = vi.fn();
    setup({ onWalkthrough });
    fireEvent.click(screen.getByRole("button", { name: "walkthrough" }));
    expect(onWalkthrough).toHaveBeenCalledTimes(1);
    cleanup();
    setup();
    expect(screen.queryByRole("button", { name: "walkthrough" })).toBeNull();
  });

  // The toolbar renders in the band, the short window's run row and the
  // phone sheet, so the source link and the shortcut list ride inside it.
  it("links the source and opens the shortcut list", () => {
    const props = setup();
    const source = screen.getByRole("link", { name: "source on github" });
    expect(source.getAttribute("href")).toBe(
      "https://github.com/Abdalla-Eldoumani/aarch64-playground",
    );
    expect(source.getAttribute("target")).toBe("_blank");
    fireEvent.click(screen.getByRole("button", { name: "keyboard shortcuts" }));
    expect(props.onOpenShortcuts).toHaveBeenCalledTimes(1);
  });
});
