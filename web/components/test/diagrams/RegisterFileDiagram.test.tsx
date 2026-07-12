import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RegisterFileDiagram } from "@/components/diagrams/RegisterFileDiagram";

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
    // the special lr/sp group reads a neutral token; --amber stays reserved for
    // surfaces where execution is implied, so this static page never spends it.
    expect(html).not.toContain("var(--amber)");
    expect(html).toContain("var(--border-strong)"); // special (lr / sp)
  });

  it("labels x18 as platform-reserved rather than caller-saved", () => {
    render(<RegisterFileDiagram />);
    // x18 is the platform register: the caller-saved band stops at x17, and x18
    // is called out as platform-reserved, matching REGISTER_ROLES and the guide.
    expect(screen.queryByText(/x9-x18/)).toBeNull();
    expect(
      screen.getByText(/caller-saved, volatile across a call \(x9-x17\)/),
    ).toBeTruthy();
    expect(screen.getByText(/platform-reserved/)).toBeTruthy();
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
