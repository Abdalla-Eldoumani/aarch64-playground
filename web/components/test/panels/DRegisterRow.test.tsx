import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DRegisterRow } from "@/components/panels/DRegisterRow";

afterEach(() => cleanup());

// 3.5 as an IEEE-754 double is 0x400c000000000000, a known literal, never
// recomputed through the component under test.
const BITS_3_5 = "0x400c000000000000";

describe("DRegisterRow", () => {
  it("decodes the raw bit pattern to the decimal double, and shows only that", () => {
    render(<DRegisterRow index={0} bitsHex={BITS_3_5} />);
    expect(screen.getByText("3.5")).toBeTruthy();
    expect(screen.queryByText(BITS_3_5)).toBeNull();
    expect(screen.getByText("D0")).toBeTruthy();
  });

  it("shows the raw bits and nothing else in hex mode", () => {
    render(<DRegisterRow index={4} bitsHex={BITS_3_5} hexMode />);
    expect(screen.getByText(BITS_3_5)).toBeTruthy();
    expect(screen.queryByText("3.5")).toBeNull();
  });

  it("shows the calling-convention names (arg, save) for d0-d15 only", () => {
    const { unmount } = render(<DRegisterRow index={3} bitsHex="0x0" />);
    expect(screen.getByText("arg3")).toBeTruthy();
    unmount();
    const second = render(<DRegisterRow index={12} bitsHex="0x0" />);
    expect(screen.getByText("save")).toBeTruthy();
    second.unmount();
    render(<DRegisterRow index={20} bitsHex="0x0" />);
    expect(screen.queryByText(/arg|save/)).toBeNull();
  });

  it("reads an s-written pattern as the float it is, suffixed f", () => {
    // An S write zero-extends: 4.5f is 0x40900000 in the low 32 bits.
    // The f64 reading of those bits would be a meaningless denormal.
    render(<DRegisterRow index={0} bitsHex="0x40900000" />);
    expect(screen.getByText("4.5f")).toBeTruthy();
  });

  it("renders a whole-number double with one decimal place", () => {
    // 42.0 is 0x4045000000000000.
    render(<DRegisterRow index={1} bitsHex="0x4045000000000000" />);
    expect(screen.getByText("42.0")).toBeTruthy();
  });

  it("names infinities and NaN instead of printing their bits as a number", () => {
    // +inf, -inf and the default NaN as doubles, then a single's NaN left by
    // an s write, which takes no f suffix.
    const cases: Array<[string, string]> = [
      ["0x7ff0000000000000", "inf"],
      ["0xfff0000000000000", "-inf"],
      ["0x7ff8000000000000", "nan"],
      ["0x000000007fc00000", "nan"],
    ];
    for (const [bits, text] of cases) {
      const { unmount } = render(<DRegisterRow index={5} bitsHex={bits} />);
      expect(screen.getByTitle(text).textContent).toBe(text);
      unmount();
    }
  });

  it("tints the value with --changed and plays the flash on a write", () => {
    const { container } = render(
      <DRegisterRow index={2} bitsHex={BITS_3_5} changed />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("anim-reg-flash");
    expect(screen.getByText("3.5").className).toContain("var(--changed)");
  });
});
