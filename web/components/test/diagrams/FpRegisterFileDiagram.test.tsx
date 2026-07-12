import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FpRegisterFileDiagram } from "@/components/diagrams/FpRegisterFileDiagram";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("FpRegisterFileDiagram", () => {
  it("renders the three ABI role bands edge to edge", () => {
    render(<FpRegisterFileDiagram />);
    for (const reg of ["d0", "d7", "d8", "d15", "d16", "d31"]) {
      expect(screen.getByText(reg)).toBeTruthy();
    }
  });

  it("labels the callee-saved band with its low-64-bit catch", () => {
    render(<FpRegisterFileDiagram />);
    expect(
      screen.getByText("callee-saved, low 64 bits only (d8-d15)"),
    ).toBeTruthy();
    expect(
      screen.getByText(/only the double-sized view is preserved/),
    ).toBeTruthy();
  });

  it("notes there is no floating-point frame pointer", () => {
    render(<FpRegisterFileDiagram />);
    expect(
      screen.getByText(/There is no floating-point frame pointer/),
    ).toBeTruthy();
  });

  it("tints the bands from tokens: cyan arguments, amber callee-saved, neutral temporaries", () => {
    const { container } = render(<FpRegisterFileDiagram />);
    const html = container.innerHTML;
    expect(html).toContain("var(--cyan)"); // d0-d7, arguments & result
    expect(html).toContain("var(--amber)"); // d8-d15, preserved with a catch
    expect(html).toContain("var(--border-strong)"); // d16-d31, temporaries
    expect(html).not.toContain("var(--danger)");
  });

  it("exposes an accessible name", () => {
    render(<FpRegisterFileDiagram />);
    expect(
      screen.getByLabelText("aapcs64 floating-point register file"),
    ).toBeTruthy();
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<FpRegisterFileDiagram />);
      expect(
        screen.getByLabelText("aapcs64 floating-point register file"),
      ).toBeTruthy();
      unmount();
    }
  });
});
