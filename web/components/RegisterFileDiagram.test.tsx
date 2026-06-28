import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RegisterFileDiagram } from "./RegisterFileDiagram";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("RegisterFileDiagram", () => {
  it("renders representative cells across every ABI role band", () => {
    render(<RegisterFileDiagram />);
    // argument area, a caller-saved temporary, a callee-saved register, then the
    // fp / lr aliases and sp -- one from each color family.
    expect(screen.getByText("x0")).toBeTruthy();
    expect(screen.getByText("x9")).toBeTruthy();
    expect(screen.getByText("x19")).toBeTruthy();
    expect(screen.getByText("sp")).toBeTruthy();
  });

  it("shows the fp and lr aliases on x29 and x30", () => {
    render(<RegisterFileDiagram />);
    expect(screen.getByText("x29")).toBeTruthy();
    expect(screen.getByText("fp")).toBeTruthy();
    expect(screen.getByText("x30")).toBeTruthy();
    expect(screen.getByText("lr")).toBeTruthy();
  });

  it("notes the zero register", () => {
    render(<RegisterFileDiagram />);
    expect(screen.getByText("xzr")).toBeTruthy();
    expect(screen.getByText("wzr")).toBeTruthy();
  });

  it("colors the role families from tokens, not raw colors", () => {
    const { container } = render(<RegisterFileDiagram />);
    const html = container.innerHTML;
    expect(html).toContain("var(--cyan)"); // arguments / return
    expect(html).toContain("var(--danger)"); // caller-saved
    expect(html).toContain("var(--success)"); // callee-saved
    expect(html).toContain("var(--amber)"); // special (lr / sp)
  });

  it("exposes an accessible name", () => {
    render(<RegisterFileDiagram />);
    expect(screen.getByLabelText("aapcs64 register file")).toBeTruthy();
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<RegisterFileDiagram />);
      expect(screen.getByLabelText("aapcs64 register file")).toBeTruthy();
      unmount();
    }
  });
});
