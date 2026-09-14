// Pins the vector row: the v0 (q0) label, the lane grouping under each width,
// and the per-LANE write mark derived from the previous snapshot.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VRegisterRow } from "@/components/panels/VRegisterRow";

afterEach(() => cleanup());

// High 64 bits 0x0123456789abcdef, low 64 bits 0xfedcba9876543210.
const PATTERN = "0x0123456789abcdeffedcba9876543210";

describe("VRegisterRow", () => {
  it("labels the register by both of its names", () => {
    render(<VRegisterRow index={0} bitsHex={PATTERN} width="d" />);
    expect(screen.getByText("v0 (q0)")).toBeTruthy();
  });

  it("groups the same bits by the chosen lane width", () => {
    const { rerender } = render(
      <VRegisterRow index={3} bitsHex={PATTERN} width="d" />,
    );
    expect(screen.getByText("0123456789abcdef")).toBeTruthy();
    expect(screen.getByText("fedcba9876543210")).toBeTruthy();
    // -81985529216486896 is 0xfedcba9876543210 read signed at 64 bits.
    expect(screen.getByText("-81985529216486896")).toBeTruthy();

    rerender(<VRegisterRow index={3} bitsHex={PATTERN} width="s" />);
    expect(screen.getByText("01234567")).toBeTruthy();
    expect(screen.getByText("76543210")).toBeTruthy();
    expect(screen.getByText("-1985229329")).toBeTruthy();
    expect(screen.queryByText("0123456789abcdef")).toBeNull();
  });

  it("states the hex/decimal signedness pairing for a screen reader", () => {
    const { container } = render(
      <VRegisterRow index={0} bitsHex={PATTERN} width="s" />,
    );
    const note = container.querySelector(".sr-only") as HTMLElement;
    expect(note.textContent).toBe(
      "4 lanes of 32 bits; hex is unsigned, decimal is signed",
    );
  });

  it("leads with the signed decimal in dec mode", () => {
    render(<VRegisterRow index={0} bitsHex={PATTERN} width="d" decMode />);
    const lane = screen.getByTitle("lane 0");
    // Primary reading first, the hex beneath it.
    expect(lane.textContent).toBe("-81985529216486896fedcba9876543210");
  });

  it("marks only the lanes whose bits moved", () => {
    const before = "0x00000000000000000000000000000000";
    const after = "0x0000000000000000000000000000002a";
    render(
      <VRegisterRow index={1} bitsHex={after} prevBitsHex={before} width="d" changed />,
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
      <VRegisterRow index={1} bitsHex={PATTERN} prevBitsHex={PATTERN} width="d" />,
    );
    expect(screen.getByTitle("lane 0").className).not.toContain("var(--amber)");
    rerender(<VRegisterRow index={1} bitsHex={PATTERN} width="d" />);
    expect(screen.getByTitle("lane 0").className).not.toContain("var(--amber)");
  });

  it("plays the row write flash when the register wrote", () => {
    const { container } = render(
      <VRegisterRow index={2} bitsHex={PATTERN} width="d" changed />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("anim-reg-flash");
    expect(row.className).toContain("var(--amber)");
  });
});
