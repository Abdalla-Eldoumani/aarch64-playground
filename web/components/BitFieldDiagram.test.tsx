import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BitFieldDiagram } from "./BitFieldDiagram";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("BitFieldDiagram", () => {
  it("renders one box per field", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 11, label: "opcode" },
          { bits: 5, label: "Rm" },
          { bits: 5, label: "Rn" },
          { bits: 5, label: "Rd" },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("opcode")).toBeTruthy();
  });

  it("sizes each box proportionally to its bit width", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 11, label: "wide" },
          { bits: 5, label: "narrow" },
        ]}
      />,
    );
    const [wide, narrow] = screen.getAllByRole("listitem");
    expect(wide.style.flexGrow).toBe("11");
    expect(narrow.style.flexGrow).toBe("5");
  });

  it("uses a caller color when provided and a token default otherwise", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 8, label: "colored", color: "magenta" },
          { bits: 8, label: "plain" },
        ]}
      />,
    );
    const [colored, plain] = screen.getAllByRole("listitem");
    expect(colored.style.borderTopColor).toBe("magenta");
    expect(plain.style.borderTopColor).toBe("");
    expect(plain.className).toContain("border-t-[var(--border-strong)]");
  });

  it("falls back to a sample encoding when no fields are given", () => {
    render(<BitFieldDiagram />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.getByText("opcode")).toBeTruthy();
  });

  it("renders the default form under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<BitFieldDiagram />);
      expect(screen.getByLabelText("instruction encoding")).toBeTruthy();
      unmount();
    }
  });
});
