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

  it("fires onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
