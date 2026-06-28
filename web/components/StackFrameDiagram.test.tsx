import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StackFrameDiagram } from "./StackFrameDiagram";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("StackFrameDiagram", () => {
  it("renders the saved fp/lr slot, the fp anchor, locals, and the sp marker", () => {
    render(<StackFrameDiagram />);
    expect(screen.getByText("saved fp, lr")).toBeTruthy();
    expect(screen.getByText("fp (x29)")).toBeTruthy();
    expect(screen.getByText("locals")).toBeTruthy();
    expect(screen.getByText("sp")).toBeTruthy();
  });

  it("notes 16-byte alignment and the downward growth direction", () => {
    render(<StackFrameDiagram />);
    expect(screen.getByText("16-byte aligned")).toBeTruthy();
    expect(screen.getByText(/grows downward/)).toBeTruthy();
  });

  it("uses token tints, not raw colors", () => {
    const { container } = render(<StackFrameDiagram />);
    expect(container.innerHTML).toContain("var(--cyan)");
  });

  it("exposes an accessible name", () => {
    render(<StackFrameDiagram />);
    expect(screen.getByLabelText("aapcs64 stack frame layout")).toBeTruthy();
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<StackFrameDiagram />);
      expect(screen.getByLabelText("aapcs64 stack frame layout")).toBeTruthy();
      unmount();
    }
  });
});
