import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
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

  it("draws its disabled state off the cyan fill instead of fading it", () => {
    // Half-faded cyan read as live; disabled trades the fill for the sunken
    // surface and the dim label (the browser pass checks the paint).
    render(<Button disabled>off</Button>);
    const cls = screen.getByRole("button", { name: "off" }).className;
    expect(cls).toContain("disabled:bg-[var(--bg-sunken)]");
    expect(cls).toContain("disabled:text-[var(--text-tertiary)]");
    expect(cls).not.toContain("opacity-50");
  });

  it("fires onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
