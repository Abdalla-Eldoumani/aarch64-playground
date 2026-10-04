import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ShortcutChip } from "@/components/ui/ShortcutChip";

afterEach(() => cleanup());

describe("ShortcutChip", () => {
  // The keys are drawn by CSS, so the button's accessible name and its
  // visible text stay the bare word (label-in-name).
  it("adds no text to the button it sits in", () => {
    render(
      <button type="button">
        assemble
        <ShortcutChip keys="F6" />
      </button>,
    );
    const button = screen.getByRole("button", { name: "assemble" });
    expect(button.textContent).toBe("assemble");
    const chip = button.querySelector("kbd")!;
    expect(chip.getAttribute("data-keys")).toBe("F6");
    expect(chip.getAttribute("aria-hidden")).toBe("true");
  });

  it("hides on touch screens and keeps a caller's spacing", () => {
    const { container } = render(<ShortcutChip keys="Ctrl+K" className="ml-1.5" />);
    const classes = (container.firstChild as HTMLElement).className;
    expect(classes).toContain("[@media(pointer:coarse)]:hidden");
    expect(classes).toContain("ml-1.5");
  });
});
