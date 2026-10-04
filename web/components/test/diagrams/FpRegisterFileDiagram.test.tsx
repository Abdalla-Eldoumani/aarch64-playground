// Pins the vector register role map: 32 cells in three role bands, each cell
// one 128-bit register whose bar shows what a call keeps. Only v8-v15 keep
// anything, and only bits 63:0, their d view.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FpRegisterFileDiagram } from "@/components/diagrams/FpRegisterFileDiagram";

afterEach(() => {
  cleanup();
});

describe("FpRegisterFileDiagram", () => {
  it("exposes an accessible name", () => {
    render(<FpRegisterFileDiagram />);
    expect(screen.getByLabelText("aapcs64 vector register file")).toBeTruthy();
  });

  it("draws all 32 registers in the three AAPCS64 role bands", () => {
    render(<FpRegisterFileDiagram />);
    const bands = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(bands).toEqual([
      "arguments & result",
      "callee-saved, low 64 bits only",
      "caller-saved temporaries",
    ]);
    const cells = screen.getAllByLabelText(/^v\d+: /);
    expect(cells.map((cell) => cell.textContent?.match(/^v\d+/)?.[0])).toEqual(
      Array.from({ length: 32 }, (_, n) => `v${n}`),
    );
  });

  it("says a call keeps bits 63:0 of v8-v15 and nothing of the rest", () => {
    render(<FpRegisterFileDiagram />);
    for (const n of [8, 15]) {
      expect(
        screen.getByLabelText(`v${n}: bits 63:0, d${n}, kept across a call; bits 127:64 may change`),
      ).toBeTruthy();
    }
    for (const n of [0, 7, 16, 31]) {
      expect(screen.getByLabelText(`v${n}: a call may change all 128 bits`)).toBeTruthy();
    }
  });

  it("names each cell's d view, the course's name for the kept half", () => {
    render(<FpRegisterFileDiagram />);
    const v8 = screen.getByLabelText(/^v8: /);
    expect(within(v8).getByText("d8")).toBeTruthy();
  });

  it("teaches the halves in the footer and notes there is no floating-point frame pointer", () => {
    const { container } = render(<FpRegisterFileDiagram />);
    const text = container.textContent ?? "";
    expect(text).toContain("the left half of its bar is bits 127:64");
    expect(text).toContain("A call keeps only the solid halves, d8 to d15");
    expect(text).toContain("There is no floating-point frame pointer");
  });

  it("tints the bands from tokens: cyan arguments, amber callee-saved, neutral temporaries", () => {
    const { container } = render(<FpRegisterFileDiagram />);
    const html = container.innerHTML;
    expect(html).toContain("var(--cyan)");
    expect(html).toContain("var(--amber)");
    expect(html).toContain("var(--border-strong)");
    expect(html).not.toContain("var(--danger)");
  });
});
