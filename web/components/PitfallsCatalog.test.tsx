import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PitfallsCatalog } from "./PitfallsCatalog";

const THEMES = ["dark", "light", "high-contrast"] as const;

const TITLES = [
  "16-byte stack alignment",
  "saving and restoring fp and lr",
  "sign extension",
  "off-by-one loop bounds",
  "non-16-byte local allocation",
];

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("PitfallsCatalog", () => {
  it("renders the five pitfall cards", () => {
    render(<PitfallsCatalog />);
    for (const title of TITLES) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it("labels a wrong and a right block on every card", () => {
    render(<PitfallsCatalog />);
    expect(screen.getAllByText("wrong")).toHaveLength(5);
    expect(screen.getAllByText("right")).toHaveLength(5);
  });

  it("renders a CodeBlock pre for each wrong and right snippet (ten total)", () => {
    const { container } = render(<PitfallsCatalog />);
    expect(container.querySelectorAll("pre")).toHaveLength(10);
  });

  it("shows the wrong vs right asm tokens for the alignment, sign, and loop traps", () => {
    const { container } = render(<PitfallsCatalog />);
    const text = container.textContent ?? "";
    // alignment: the misaligned vs aligned prologue allocation
    expect(text).toContain("[sp, -8]!");
    expect(text).toContain("[sp, -16]!");
    // sign extension: the fix introduces sxtw
    expect(text).toContain("sxtw    x0, w0");
    // off-by-one: the only change is the branch condition
    expect(text).toContain("b.gt    done");
    expect(text).toContain("b.ge    done");
  });

  it("accents wrong with --danger and right with --success tokens", () => {
    const { container } = render(<PitfallsCatalog />);
    const html = container.innerHTML;
    expect(html).toContain("var(--danger)");
    expect(html).toContain("var(--success)");
  });

  it("renders each cause through the real LessonMarkdown path", () => {
    const { container } = render(<PitfallsCatalog />);
    // a cause string only present if LessonMarkdown actually rendered the prose
    expect(container.textContent).toContain("bl overwrites lr");
  });

  it("exposes an accessible name", () => {
    render(<PitfallsCatalog />);
    expect(screen.getByLabelText("cpsc 355 pitfalls")).toBeTruthy();
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<PitfallsCatalog />);
      expect(screen.getByLabelText("cpsc 355 pitfalls")).toBeTruthy();
      unmount();
    }
  });
});
