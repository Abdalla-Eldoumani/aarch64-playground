// pins the bit-ruler strip: decorative only, labels on the nibble
// boundaries with 31 and 0 pinned inside the edges, and off-byte labels
// hidden below sm.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BitRuler } from "@/components/ui/BitRuler";

afterEach(() => cleanup());

const NIBBLE_LABELS = ["31", "28", "24", "20", "16", "12", "8", "4", "0"];

describe("BitRuler", () => {
  it("is decorative: the whole strip is aria-hidden", () => {
    const { container } = render(<BitRuler />);
    const strip = container.firstChild as HTMLElement;
    expect(strip.getAttribute("aria-hidden")).toBe("true");
  });

  it("labels exactly the nibble boundaries, one span per label", () => {
    const { container } = render(<BitRuler />);
    for (const label of NIBBLE_LABELS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(container.querySelectorAll("span").length).toBe(NIBBLE_LABELS.length);
  });

  it("pins bit 31 to the left edge and bit 0 to the right edge", () => {
    render(<BitRuler />);
    const left = screen.getByText("31");
    const right = screen.getByText("0");
    expect(left.style.left).toBe("4px");
    expect(left.style.transform).toBe("none");
    expect(right.style.right).toBe("4px");
    expect(right.style.transform).toBe("none");
  });

  it("hides the off-byte labels below sm and keeps byte boundaries visible", () => {
    render(<BitRuler />);
    for (const hidden of ["28", "20", "12", "4"]) {
      expect(screen.getByText(hidden).className).toContain("hidden sm:inline");
    }
    for (const always of ["31", "24", "16", "8", "0"]) {
      expect(screen.getByText(always).className).not.toContain("hidden");
    }
  });
});
