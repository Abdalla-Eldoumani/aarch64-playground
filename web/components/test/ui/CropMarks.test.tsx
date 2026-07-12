// pins the crop-mark furniture: four L-shaped corner marks, purely
// decorative, hidden on phones, never intercepting the pointer, each
// corner pairing exactly the two border sides that meet there.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CropMarks } from "@/components/ui/CropMarks";

afterEach(() => cleanup());

const CORNERS = [
  ["left-[10px]", "top-[10px]", "border-l", "border-t"],
  ["right-[10px]", "top-[10px]", "border-r", "border-t"],
  ["left-[10px]", "bottom-[10px]", "border-l", "border-b"],
  ["right-[10px]", "bottom-[10px]", "border-r", "border-b"],
] as const;

function marks() {
  const { container } = render(<CropMarks />);
  const wrapper = container.firstChild as HTMLElement;
  return { wrapper, spans: Array.from(wrapper.querySelectorAll("span")) };
}

describe("CropMarks", () => {
  it("is decorative, hidden on phones, and lets the pointer through", () => {
    const { wrapper } = marks();
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.className).toContain("pointer-events-none");
    expect(wrapper.className).toContain("hidden sm:block");
  });

  it("renders exactly four marks", () => {
    const { spans } = marks();
    expect(spans.length).toBe(4);
  });

  it("puts one mark in each corner with the two border sides that meet there", () => {
    const { spans } = marks();
    for (const corner of CORNERS) {
      const match = spans.find((s) => corner.every((cls) => s.className.includes(cls)));
      expect(match).toBeTruthy();
    }
  });

  it("draws every mark as a 14px square in the crop token ink", () => {
    const { spans } = marks();
    for (const span of spans) {
      expect(span.className).toContain("h-[14px]");
      expect(span.className).toContain("w-[14px]");
      expect(span.className).toContain("border-[var(--crop)]");
    }
  });
});
