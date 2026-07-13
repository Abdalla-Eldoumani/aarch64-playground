// pins the doc-rule header strip: both product names are in the tree
// (short one for phones, long one from sm up), the sheet section takes
// the amber ink, and omitted segments simply do not render.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DocRule } from "@/components/ui/DocRule";

afterEach(() => cleanup());

describe("DocRule", () => {
  it("renders the short product code for phones and the long name from sm up", () => {
    render(<DocRule />);
    expect(screen.getByText("aarch64-pg").className).toContain("sm:hidden");
    expect(screen.getByText("aarch64 playground").className).toContain(
      "hidden sm:inline",
    );
  });

  it("renders the section segment in amber when given", () => {
    render(<DocRule section="SECTION 4 · LEARN" />);
    const section = screen.getByText("SECTION 4 · LEARN");
    expect(section.className).toContain("text-[var(--amber)]");
  });

  it("renders the right-aligned context segment when given", () => {
    render(<DocRule context="CPSC 355 STUDY AID" />);
    expect(screen.getByText("CPSC 355 STUDY AID")).toBeTruthy();
  });

  it("drops the section and context segments entirely when omitted", () => {
    const { container } = render(<DocRule />);
    // only the product-name span remains inside the strip row
    const strip = container.firstChild as HTMLElement;
    const row = strip.firstElementChild as HTMLElement;
    expect(row.querySelectorAll(":scope > span").length).toBe(1);
  });

  it("passes className through to the strip", () => {
    const { container } = render(<DocRule className="mb-6" />);
    expect((container.firstChild as HTMLElement).className).toContain("mb-6");
  });
});
