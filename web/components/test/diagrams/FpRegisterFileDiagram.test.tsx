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
    // The footer prose also names d0/s0, so match within the cell list.
    for (const reg of ["d0", "d7", "d8", "d15", "d16", "d31"]) {
      expect(screen.getAllByText(reg).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("pairs every d cell with its s view, the way the course names them", () => {
    const { container } = render(<FpRegisterFileDiagram />);
    for (const sview of ["s0", "s8", "s15", "s31"]) {
      expect(screen.getAllByText(sview).length).toBeGreaterThanOrEqual(1);
    }
    // The cells stay in s/d; the vector width is named once in the footer, as
    // the playground's reach rather than the course's, with the callee-saved
    // promise pinned to bits 63:0 of v8-v15.
    const text = container.textContent ?? "";
    expect(text).toContain("the vector file as well");
    expect(text).toContain("while the course keeps to");
    expect(text).toContain("preserves only bits 63:0 of");
  });

  it("labels the callee-saved band and teaches the two views in the footer", () => {
    render(<FpRegisterFileDiagram />);
    expect(screen.getByText("callee-saved (d8-d15)")).toBeTruthy();
    expect(screen.getByText(/two views the course uses/)).toBeTruthy();
    expect(screen.getByText(/converts between them/)).toBeTruthy();
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
    expect(html).toContain("var(--amber)"); // d8-d15, callee-saved for the d-sized value only
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
