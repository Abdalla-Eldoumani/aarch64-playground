// pins the crop-mark furniture: four corner marks, purely decorative,
// hidden on phones, never intercepting the pointer.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CropMarks } from "@/components/ui/CropMarks";

afterEach(() => cleanup());

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
});
