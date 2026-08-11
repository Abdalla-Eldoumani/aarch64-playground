import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AapcsRail } from "@/components/diagrams/AapcsRail";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

// Every row group of the rail: range on the left, role note on the right.
// The integer and float callee-saved rows share one note on purpose: the
// role is one story across both files.
const ROWS: Array<[string, string]> = [
  ["x0 – x7", "arguments · results"],
  ["x8", "indirect result"],
  ["x9 – x15", "caller-saved temps"],
  ["x16 – x18", "platform · avoid"],
  ["x19 – x28", "callee-saved"],
  ["x29 · x30", "fp · lr -- the frame record"],
  ["d0 – d7", "float args · results"],
  ["d8 – d15", "callee-saved"],
  ["d16 – d31", "caller-saved float temps"],
];

describe("AapcsRail", () => {
  it("renders the header and every register row group with its role note", () => {
    render(<AapcsRail />);
    const rail = screen.getByRole("complementary", {
      name: "aapcs64 register file rail",
    });
    expect(within(rail).getByText(/register file · aapcs64/i)).toBeTruthy();
    const items = within(rail).getAllByRole("listitem");
    expect(items).toHaveLength(ROWS.length);
    for (const [range, note] of ROWS) {
      expect(within(rail).getByText(range)).toBeTruthy();
      expect(within(rail).getAllByText(note).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the amber/cyan legend under the rail, with the two-views note", () => {
    render(<AapcsRail />);
    expect(
      screen.getByText(/Amber = the callee must preserve it/),
    ).toBeTruthy();
    expect(screen.getByText(/two names, one register, one role/)).toBeTruthy();
  });

  it("tints the argument rows cyan and the callee-saved rows amber", () => {
    render(<AapcsRail />);
    expect(screen.getByText("x0 – x7").className).toContain("var(--cyan)");
    expect(screen.getByText("x19 – x28").className).toContain("var(--amber)");
    expect(screen.getByText("x29 · x30").className).toContain("var(--amber)");
    // The platform rows read at 60% opacity: theirs to avoid, not to style up.
    expect(screen.getByText("x16 – x18").closest("li")?.className).toContain(
      "opacity-60",
    );
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<AapcsRail />);
      expect(
        screen.getByRole("complementary", {
          name: "aapcs64 register file rail",
        }),
      ).toBeTruthy();
      unmount();
    }
  });
});
