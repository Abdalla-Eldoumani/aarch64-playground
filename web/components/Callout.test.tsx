import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Callout, type CalloutType } from "./Callout";

const THEMES = ["dark", "light", "high-contrast"] as const;

// Each variant's field must read from its semantic token, never a raw color.
const TOKEN_BY_TYPE: Record<CalloutType, string> = {
  note: "var(--cyan)",
  warning: "var(--warning)",
  pitfall: "var(--danger)",
};

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("Callout", () => {
  it("drives each variant from its semantic token", () => {
    for (const type of ["note", "warning", "pitfall"] as const) {
      const { container, unmount } = render(<Callout type={type}>body</Callout>);
      const field = container.firstElementChild as HTMLElement;
      expect(field.className).toContain(TOKEN_BY_TYPE[type]);
      unmount();
    }
  });

  it("renders its children", () => {
    render(
      <Callout type="note">
        <code>x29</code> is the frame pointer
      </Callout>,
    );
    expect(screen.getByText("is the frame pointer", { exact: false })).toBeTruthy();
    expect(screen.getByText("x29")).toBeTruthy();
  });

  it("labels each variant", () => {
    render(<Callout type="pitfall">careful</Callout>);
    expect(screen.getByText("pitfall")).toBeTruthy();
  });

  it("renders every variant under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      for (const type of ["note", "warning", "pitfall"] as const) {
        const { unmount } = render(<Callout type={type}>body</Callout>);
        expect(screen.getByText("body")).toBeTruthy();
        unmount();
      }
    }
  });
});
