import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { slugify } from "@/lib/lesson-toc";
import { CallingConventionGuide } from "./CallingConventionGuide";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("CallingConventionGuide", () => {
  it("renders both teaching diagrams", () => {
    render(<CallingConventionGuide />);
    expect(screen.getByLabelText("aapcs64 register file")).toBeTruthy();
    expect(screen.getByLabelText("aapcs64 stack frame layout")).toBeTruthy();
  });

  it("renders the register-role split and the alignment guidance", () => {
    const { container } = render(<CallingConventionGuide />);
    const text = container.textContent ?? "";
    expect(text).toContain("callee-saved");
    expect(text).toContain("16-byte");
    expect(text).toContain("x19");
    // a phrase only the authored prose carries, in neither diagram
    expect(text).toContain("indirect result address");
  });

  it("routes every prose block through the single LessonMarkdown path", () => {
    const { container } = render(<CallingConventionGuide />);
    // The slugified heading ids only appear when the real LessonMarkdown
    // rendered the authored markdown; a stub would not id the headings.
    const registers = container.querySelector(
      `#${slugify("Registers by role")}`,
    );
    const stack = container.querySelector(
      `#${slugify("Stack alignment and the frame pointer")}`,
    );
    expect(registers?.tagName.toLowerCase()).toBe("h2");
    expect(stack?.tagName.toLowerCase()).toBe("h2");
  });

  it("attaches the shared register roles to the inline tokens", () => {
    render(<CallingConventionGuide />);
    // x19 written as inline code resolves to the callee-saved role summary, the
    // same classification the hover cards and the register-file diagram use, so
    // the guide tells one story with them.
    expect(
      screen.getAllByLabelText(/callee-saved register \(x19-x28\)/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows the authentic prologue and epilogue", () => {
    const { container } = render(<CallingConventionGuide />);
    const text = container.textContent ?? "";
    expect(text).toContain("[sp, alloc]!"); // pre-indexed save opens the frame
    expect(text).toContain("[sp], dealloc"); // post-indexed restore closes it
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<CallingConventionGuide />);
      expect(screen.getByLabelText("aapcs64 calling convention")).toBeTruthy();
      unmount();
    }
  });
});
