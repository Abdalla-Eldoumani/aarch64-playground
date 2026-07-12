import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DRegisterRow } from "@/components/panels/DRegisterRow";

afterEach(() => cleanup());

// 3.5 as an IEEE-754 double is 0x400c000000000000 — a known literal, never
// recomputed through the component under test.
const BITS_3_5 = "0x400c000000000000";

describe("DRegisterRow", () => {
  it("decodes the raw bit pattern to the decimal double", () => {
    render(<DRegisterRow index={0} bitsHex={BITS_3_5} />);
    expect(screen.getByText("3.5")).toBeTruthy();
    expect(screen.getByText(BITS_3_5)).toBeTruthy();
    expect(screen.getByText("D0")).toBeTruthy();
  });

  it("swaps primary and secondary in hex mode", () => {
    render(<DRegisterRow index={4} bitsHex={BITS_3_5} hexMode />);
    // Hex leads (13px primary), decimal rides beneath; both visible.
    const primary = screen.getByTitle("3.5");
    expect(primary.textContent).toBe(BITS_3_5);
  });

  it("carries the aapcs aliases for d0-d15 only", () => {
    const { unmount } = render(<DRegisterRow index={3} bitsHex="0x0" />);
    expect(screen.getByText("arg3")).toBeTruthy();
    unmount();
    const second = render(<DRegisterRow index={12} bitsHex="0x0" />);
    expect(screen.getByText("save")).toBeTruthy();
    second.unmount();
    render(<DRegisterRow index={20} bitsHex="0x0" />);
    expect(screen.queryByText(/arg|save/)).toBeNull();
  });

  it("renders integral doubles with one decimal and zero as 0.0", () => {
    // 42.0 is 0x4045000000000000.
    render(<DRegisterRow index={1} bitsHex="0x4045000000000000" />);
    expect(screen.getByText("42.0")).toBeTruthy();
  });

  it("tints the value with --changed and plays the flash on a write", () => {
    const { container } = render(
      <DRegisterRow index={2} bitsHex={BITS_3_5} changed />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("anim-reg-flash");
    expect(screen.getByTitle(BITS_3_5).className).toContain("var(--changed)");
  });
});
