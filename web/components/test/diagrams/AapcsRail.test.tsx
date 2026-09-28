import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AapcsRail } from "@/components/diagrams/AapcsRail";

afterEach(() => {
  cleanup();
});

// Every row group of the rail: range on the left, role note on the right.
// The integer and float callee-saved rows share one note: the role is the
// same in both files.
const ROWS: Array<[string, string]> = [
  ["x0 – x7", "arguments · results"],
  ["x8", "struct result address"],
  ["x9 – x15", "caller-saved temps"],
  ["x16 – x18", "reserved · avoid"],
  ["x19 – x28", "callee-saved"],
  ["x29 · x30", "fp · lr (the frame record)"],
  ["d0 – d7", "float args · results"],
  ["d8 – d15", "callee-saved"],
  ["d16 – d31", "caller-saved float temps"],
  ["v0 – v7", "vector args · results"],
  ["v8 – v15", "callee-saved: low 64 bits only"],
  ["v16 – v31", "caller-saved vector temps"],
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

  it("keeps the amber/cyan legend under the rail, with the one-register note", () => {
    render(<AapcsRail />);
    expect(
      screen.getByText(/Amber = the callee must preserve it/),
    ).toBeTruthy();
    expect(screen.getByText(/row is one register with a/)).toBeTruthy();
  });

  it("names each v row's q form and tints it like its d row", () => {
    render(<AapcsRail />);
    for (const alias of ["q0 – q7", "q8 – q15", "q16 – q31"]) {
      expect(screen.getByText(alias)).toBeTruthy();
    }
    expect(screen.getByText("v0 – v7").className).toContain("var(--cyan)");
    expect(screen.getByText("v8 – v15").className).toContain("var(--amber)");
    expect(screen.getByText("v16 – v31").className).toContain(
      "var(--text-primary)",
    );
    expect(screen.getByText(/named/).textContent).toContain("when read as one value");
  });

  it("tints the argument rows cyan and the callee-saved rows amber", () => {
    render(<AapcsRail />);
    expect(screen.getByText("x0 – x7").className).toContain("var(--cyan)");
    expect(screen.getByText("x19 – x28").className).toContain("var(--amber)");
    expect(screen.getByText("x29 · x30").className).toContain("var(--amber)");
    expect(screen.getByText("x9 – x15").className).not.toContain("var(--amber)");
  });
});
