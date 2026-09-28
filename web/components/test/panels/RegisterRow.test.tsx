import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RegisterRow } from "@/components/panels/RegisterRow";

afterEach(() => {
  cleanup();
});

describe("RegisterRow", () => {
  it("renders the name, alias, and value columns", () => {
    render(<RegisterRow name="X0" alias="arg0" value="0x0000000000000001" />);
    expect(screen.getByText("X0")).toBeTruthy();
    expect(screen.getByText("arg0")).toBeTruthy();
    expect(screen.getByText("0x0000000000000001")).toBeTruthy();
  });

  it("keeps the full value one hover away wherever the row wraps", () => {
    render(<RegisterRow name="X9" value="0x0123456789abcdef" />);
    expect(screen.getByText("0x0123456789abcdef").getAttribute("title")).toBe(
      "0x0123456789abcdef",
    );
  });

  it("drives the write flash and value tint from --changed when changed", () => {
    const { container } = render(<RegisterRow name="X2" value="0x2a" changed />);
    // the row plays the reduced-motion-safe reg-flash keyframe (its color comes
    // from --changed in globals.css) and the value carries the --changed tint
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("anim-reg-flash");
    expect(screen.getByText("0x2a").className).toContain("text-[var(--changed)]");
  });

  it("stays static (no flash class, no tint) when unchanged", () => {
    const { container } = render(<RegisterRow name="X3" value="0x0" />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).not.toContain("anim-reg-flash");
    expect(screen.getByText("0x0").className).not.toContain("text-[var(--changed)]");
  });
});
