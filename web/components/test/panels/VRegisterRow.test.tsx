// Pins the vector row: the v0 (q0) label, the lane grouping under each width,
// and the per-LANE write mark derived from the previous snapshot.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VRegisterRow } from "@/components/panels/VRegisterRow";

afterEach(() => cleanup());

// High 64 bits 0x0123456789abcdef, low 64 bits 0xfedcba9876543210.
const PATTERN = "0x0123456789abcdeffedcba9876543210";
const INT_D = { width: "d", float: false } as const;
const INT_S = { width: "s", float: false } as const;
const FLOAT_D = { width: "d", float: true } as const;

describe("VRegisterRow", () => {
  it("labels the register by both of its names", () => {
    render(<VRegisterRow index={0} bitsHex={PATTERN} arrangement={INT_D} />);
    expect(screen.getByText("v0 (q0)")).toBeTruthy();
  });

  it("groups the same bits by the chosen lane width", () => {
    const { rerender } = render(
      <VRegisterRow index={3} bitsHex={PATTERN} arrangement={INT_D} />,
    );
    expect(screen.getByText("0123456789abcdef")).toBeTruthy();
    expect(screen.getByText("fedcba9876543210")).toBeTruthy();
    // Hex mode is hex alone: no decimal under the lanes.
    expect(screen.queryByText("-81985529216486896")).toBeNull();

    rerender(<VRegisterRow index={3} bitsHex={PATTERN} arrangement={INT_S} />);
    expect(screen.getByText("01234567")).toBeTruthy();
    expect(screen.getByText("76543210")).toBeTruthy();
    expect(screen.queryByText("0123456789abcdef")).toBeNull();
  });

  it("states the reading for a screen reader", () => {
    const { container, rerender } = render(
      <VRegisterRow index={0} bitsHex={PATTERN} arrangement={INT_S} />,
    );
    const note = () => (container.querySelector(".sr-only") as HTMLElement).textContent;
    expect(note()).toBe("4 lanes of 32 bits, in hex");
    rerender(<VRegisterRow index={0} bitsHex={PATTERN} arrangement={INT_S} decMode />);
    expect(note()).toBe(
      "4 lanes of 32 bits, signed, with the unsigned value under a negative lane",
    );
    rerender(<VRegisterRow index={0} bitsHex={PATTERN} arrangement={FLOAT_D} decMode />);
    expect(note()).toBe("2 lanes of 64-bit floats");
  });

  it("leads with the signed decimal in dec mode, the unsigned under a negative", () => {
    render(<VRegisterRow index={0} bitsHex={PATTERN} arrangement={INT_D} decMode />);
    // 0xfedcba9876543210 is -81985529216486896 signed and
    // 18364758544493064720 unsigned; lane 1 is positive, so one line.
    expect(screen.getByTitle("lane 0").textContent).toBe(
      "-8198552921648689618364758544493064720",
    );
    expect(screen.getByTitle("lane 1").textContent).toBe("81985529216486895");
  });

  it("reads a float arrangement as floats in dec mode", () => {
    // 3.5 is 0x400c000000000000, -0.0 is 0x8000000000000000.
    render(
      <VRegisterRow
        index={0}
        bitsHex="0x400c0000000000008000000000000000"
        arrangement={FLOAT_D}
        decMode
      />,
    );
    expect(screen.getByTitle("lane 1").textContent).toBe("3.5");
    expect(screen.getByTitle("lane 0").textContent).toBe("-0.0");
  });

  it("marks only the lanes whose bits moved", () => {
    const before = "0x00000000000000000000000000000000";
    const after = "0x0000000000000000000000000000002a";
    render(
      <VRegisterRow index={1} bitsHex={after} prevBitsHex={before} arrangement={INT_D} changed />,
    );
    const changedLane = screen.getByTitle("lane 0");
    const quietLane = screen.getByTitle("lane 1");
    expect(changedLane.className).toContain("var(--amber)");
    expect(quietLane.className).not.toContain("var(--amber)");
    expect(screen.getByText("000000000000002a").className).toContain(
      "var(--changed)",
    );
    expect(screen.getByText("0000000000000000").className).toContain(
      "text-primary",
    );
  });

  it("marks no lane when the previous value is the same or absent", () => {
    const { rerender } = render(
      <VRegisterRow index={1} bitsHex={PATTERN} prevBitsHex={PATTERN} arrangement={INT_D} />,
    );
    expect(screen.getByTitle("lane 0").className).not.toContain("var(--amber)");
    rerender(<VRegisterRow index={1} bitsHex={PATTERN} arrangement={INT_D} />);
    expect(screen.getByTitle("lane 0").className).not.toContain("var(--amber)");
  });

  it("plays the row write flash when the register wrote", () => {
    const { container } = render(
      <VRegisterRow index={2} bitsHex={PATTERN} arrangement={INT_D} changed />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("anim-reg-flash");
    expect(row.className).toContain("var(--amber)");
  });
});
