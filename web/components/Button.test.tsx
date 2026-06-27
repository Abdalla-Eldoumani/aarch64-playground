import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("Button", () => {
  it("defaults to the primary variant: 44px, cyan fill, on-cyan text", () => {
    render(<Button>Run</Button>);
    const button = screen.getByRole("button", { name: "Run" });
    expect(button.className).toContain("min-h-[44px]");
    expect(button.className).toContain("bg-[var(--cyan)]");
    expect(button.className).toContain("text-[var(--on-cyan)]");
  });

  it("shows the focus-ring affordance on every variant", () => {
    for (const variant of ["primary", "secondary", "ghost"] as const) {
      const { unmount } = render(<Button variant={variant}>label</Button>);
      const button = screen.getByRole("button", { name: "label" });
      expect(button.className).toContain("focus-visible:[box-shadow:var(--ring)]");
      unmount();
    }
  });

  it("drives secondary and ghost from surface tokens, not the cyan fill", () => {
    render(<Button variant="secondary">edit</Button>);
    expect(screen.getByRole("button", { name: "edit" }).className).toContain(
      "bg-[var(--bg-elevated)]",
    );
    cleanup();
    render(<Button variant="ghost">edit</Button>);
    const ghost = screen.getByRole("button", { name: "edit" });
    expect(ghost.className).toContain("bg-transparent");
    expect(ghost.className).not.toContain("bg-[var(--cyan)]");
  });

  it("defaults type to button and forwards native attributes", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled aria-label="assemble">
        Assemble
      </Button>,
    );
    const button = screen.getByRole("button", { name: "assemble" }) as HTMLButtonElement;
    expect(button.type).toBe("button");
    expect(button.disabled).toBe(true);
  });

  it("fires onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<Button>themed</Button>);
      expect(screen.getByRole("button", { name: "themed" })).toBeTruthy();
      unmount();
    }
  });
});
