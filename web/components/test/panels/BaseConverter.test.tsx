// pins the base converter: five integer readings and the IEEE-754 reading of
// one bit pattern stay in sync, bad text is refused with a message under its
// own field while the last value stands, and a link can open it at octal or
// at the float reading.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BaseConverter } from "@/components/panels/BaseConverter";

const THEMES = ["dark", "light", "high-contrast"] as const;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

// The message line an input names in aria-describedby: what a screen reader
// reads with the field, and what shows under it.
function messageFor(label: string): string {
  const id = field(label).getAttribute("aria-describedby") ?? "";
  return document.getElementById(id)?.textContent ?? "";
}

function pickWidth(w: 8 | 16 | 32 | 64): void {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${w} bits`) }));
}

describe("BaseConverter sync", () => {
  it("typing hex updates binary, unsigned, signed, and the sign line", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("hex"), { target: { value: "ff" } });
    expect(field("binary").value).toBe("1111 1111");
    expect(field("unsigned").value).toBe("255");
    expect(field("signed (two's complement)").value).toBe("-1");
    expect(screen.getByText("sign bit 1")).toBeTruthy();
    expect(screen.getByText(/signed reading goes negative/)).toBeTruthy();
  });

  it("typing a signed value lands the two's complement pattern", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("signed (two's complement)"), {
      target: { value: "-128" },
    });
    expect(field("hex").value).toBe("80");
    expect(field("binary").value).toBe("1000 0000");
    expect(field("unsigned").value).toBe("128");
  });

  it("typing unsigned and binary sync the other fields", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("unsigned"), { target: { value: "42" } });
    expect(field("hex").value).toBe("2a");
    fireEvent.change(field("binary"), { target: { value: "0110 0100" } });
    expect(field("unsigned").value).toBe("100");
    expect(field("hex").value).toBe("64");
  });

  it("keeps the typed text as-is until blur, then reformats", () => {
    render(<BaseConverter />);
    pickWidth(8);
    const hex = field("hex");
    fireEvent.change(hex, { target: { value: "0xF" } });
    expect(hex.value).toBe("0xF");
    expect(field("unsigned").value).toBe("15");
    fireEvent.blur(hex);
    expect(hex.value).toBe("0f");
  });

  it("a cleared field keeps the value and says so", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("unsigned"), { target: { value: "42" } });
    fireEvent.change(field("hex"), { target: { value: "" } });
    expect(field("unsigned").value).toBe("42");
    expect(messageFor("hex")).toContain("empty");
    expect(field("hex").getAttribute("aria-invalid")).toBe("true");
  });

  it("zero reads the same signed and unsigned", () => {
    render(<BaseConverter />);
    expect(screen.getByText("sign bit 0")).toBeTruthy();
    expect(screen.getByText(/signed and unsigned read the same/)).toBeTruthy();
  });
});

describe("BaseConverter overflow and bad input", () => {
  it("input past the width holds the last value and says so", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("unsigned"), { target: { value: "300" } });
    expect(messageFor("unsigned")).toContain("255");
    // The draft shows what was typed; the canonical value did not move.
    expect(field("unsigned").value).toBe("300");
    expect(field("hex").value).toBe("00");
  });

  it("an over-wide hex value names the bits it needs", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("hex"), { target: { value: "1ff" } });
    expect(messageFor("hex")).toContain("9 bits");
    expect(field("unsigned").value).toBe("0");
  });

  it("garbage input gets a specific message", () => {
    render(<BaseConverter />);
    fireEvent.change(field("hex"), { target: { value: "xyz" } });
    expect(messageFor("hex")).toContain("0-9 and a-f");
    // The message sits with its own field, not with the others.
    expect(messageFor("binary")).toBe("");
  });

  it("blur resolves a held message back to the hint", () => {
    render(<BaseConverter />);
    pickWidth(8);
    const unsigned = field("unsigned");
    fireEvent.change(unsigned, { target: { value: "300" } });
    fireEvent.blur(unsigned);
    expect(unsigned.value).toBe("0");
    expect(messageFor("unsigned")).toBe("");
    expect(unsigned.getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByText(/type in any field/)).toBeTruthy();
  });
});

describe("BaseConverter bit grid", () => {
  it("clicking the sign bit flips every representation", () => {
    render(<BaseConverter />);
    pickWidth(8);
    const sign = screen.getByRole("button", { name: "sign bit 7" });
    expect(sign.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(sign);
    expect(sign.getAttribute("aria-pressed")).toBe("true");
    expect(field("hex").value).toBe("80");
    expect(field("signed (two's complement)").value).toBe("-128");
    fireEvent.click(sign);
    expect(field("hex").value).toBe("00");
  });

  it("aria-pressed mirrors the pattern bit by bit", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("hex"), { target: { value: "2a" } }); // 0010 1010
    const pressed = (i: number) =>
      screen
        .getByRole("button", { name: i === 7 ? `sign bit ${i}` : `bit ${i}` })
        .getAttribute("aria-pressed");
    expect(pressed(0)).toBe("false");
    expect(pressed(1)).toBe("true");
    expect(pressed(3)).toBe("true");
    expect(pressed(5)).toBe("true");
    expect(pressed(7)).toBe("false");
  });

  it("shows the hex digit under each nibble", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("hex"), { target: { value: "ff" } });
    fireEvent.blur(field("hex"));
    // Two nibble captions, one per group of four set bits.
    expect(screen.getAllByText("f").length).toBe(2);
  });

  it("keeps one tab stop and walks bits with the arrow keys", () => {
    render(<BaseConverter />);
    pickWidth(8);
    const grid = screen.getByRole("group", { name: /bit pattern/ });
    const stops = Array.from(
      grid.querySelectorAll<HTMLButtonElement>("[data-bit]"),
    ).filter((b) => b.tabIndex === 0);
    expect(stops.length).toBe(1);
    expect(stops[0].getAttribute("data-bit")).toBe("7");

    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("data-bit")).toBe("6");
    fireEvent.keyDown(grid, { key: "End" });
    expect(document.activeElement?.getAttribute("data-bit")).toBe("0");
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("data-bit")).toBe("0");
    fireEvent.keyDown(grid, { key: "Home" });
    expect(document.activeElement?.getAttribute("data-bit")).toBe("7");
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    expect(document.activeElement?.getAttribute("data-bit")).toBe("7");
  });
});

describe("BaseConverter width changes", () => {
  it("a switch that loses bits keeps the low ones and says so", () => {
    render(<BaseConverter />);
    pickWidth(16);
    fireEvent.change(field("hex"), { target: { value: "01ff" } });
    pickWidth(8);
    expect(screen.getByText(/kept the low 8/)).toBeTruthy();
    expect(field("hex").value).toBe("ff");
    expect(field("unsigned").value).toBe("255");
  });

  it("a switch that fits stays quiet and keeps the pattern", () => {
    render(<BaseConverter />);
    pickWidth(16);
    fireEvent.change(field("unsigned"), { target: { value: "42" } });
    pickWidth(8);
    expect(screen.queryByText(/kept the low/)).toBeNull();
    expect(screen.getByText(/type in any field/)).toBeTruthy();
    expect(field("hex").value).toBe("2a");
  });

  it("growing the width zero-extends, so the unsigned reading is stable", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("hex"), { target: { value: "ff" } });
    pickWidth(16);
    expect(field("hex").value).toBe("00ff");
    expect(field("unsigned").value).toBe("255");
    expect(field("signed (two's complement)").value).toBe("255");
  });
});

describe("BaseConverter octal", () => {
  it("typing octal syncs the other fields, and they sync it", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("octal"), { target: { value: "377" } });
    expect(field("hex").value).toBe("ff");
    expect(field("signed (two's complement)").value).toBe("-1");
    pickWidth(16);
    fireEvent.change(field("hex"), { target: { value: "1ff" } });
    expect(field("octal").value).toBe("000777");
  });

  it("pads to every width's digit count", () => {
    render(<BaseConverter />);
    const expected: Record<8 | 16 | 32 | 64, string> = {
      8: "010",
      16: "000010",
      32: "00000000010",
      64: "0000000000000000000010",
    };
    for (const w of [8, 16, 32, 64] as const) {
      pickWidth(w);
      fireEvent.change(field("unsigned"), { target: { value: "8" } });
      fireEvent.blur(field("unsigned"));
      expect(field("octal").value).toBe(expected[w]);
    }
  });

  it("refuses 8, 9, letters, and values past the width, keeping the value", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("unsigned"), { target: { value: "5" } });
    fireEvent.change(field("octal"), { target: { value: "18" } });
    expect(messageFor("octal")).toContain("8 and 9 are not octal digits");
    fireEvent.change(field("octal"), { target: { value: "7a" } });
    expect(messageFor("octal")).toContain("0-7");
    fireEvent.change(field("octal"), { target: { value: "400" } });
    expect(messageFor("octal")).toContain("9 bits");
    fireEvent.change(field("octal"), { target: { value: "" } });
    expect(messageFor("octal")).toContain("empty");
    expect(field("octal").getAttribute("aria-invalid")).toBe("true");
    expect(field("unsigned").value).toBe("5");
  });
});

describe("BaseConverter IEEE-754 reading", () => {
  function readout(label: string): string {
    const term = screen.getByText(label, { selector: "dt" });
    return term.nextElementSibling?.textContent ?? "";
  }

  it("typing 0.1 at 32 bits fills every field and says it rounded", () => {
    render(<BaseConverter />);
    pickWidth(32);
    fireEvent.change(field("value"), { target: { value: "0.1" } });
    expect(field("hex").value).toBe("3dcccccd");
    expect(field("sign").value).toBe("0");
    expect(field("raw exponent").value).toBe("123");
    expect(field("unbiased exponent").value).toBe("-4");
    expect(field("fraction (hex)").value).toBe("4ccccd");
    expect(readout("class")).toContain("normal");
    expect(readout("binary scientific")).toBe("+1.60000002384185791015625 × 2^-4");
    expect(readout("exact value")).toBe("0.100000001490116119384765625");
    expect(messageFor("value")).toContain("not exact in 32 bits");
    // Rounding is a note, not a refusal.
    expect(field("value").getAttribute("aria-invalid")).toBeNull();
  });

  it("typing 0.1 at 64 bits lands the double's pattern", () => {
    render(<BaseConverter />);
    pickWidth(64);
    fireEvent.change(field("value"), { target: { value: "0.1" } });
    expect(field("hex").value).toBe("3fb999999999999a");
    expect(field("raw exponent").value).toBe("1019");
    expect(field("fraction (hex)").value).toBe("999999999999a");
    expect(readout("exact value")).toBe("0.1000000000000000055511151231257827021181583404541015625");
  });

  it("names the edge classes from their bit patterns", () => {
    render(<BaseConverter />);
    pickWidth(32);
    const cases: Array<[string, string, string]> = [
      ["00000000", "0", "zero"],
      ["80000000", "-0", "zero"],
      ["00000001", "1e-45", "subnormal"],
      ["7f7fffff", "3.4028235e+38", "normal"],
      ["7f800000", "inf", "infinity"],
      ["ff800000", "-inf", "infinity"],
      ["7fc00000", "nan", "quiet NaN"],
      ["7f800001", "nan", "signalling NaN"],
    ];
    for (const [hex, value, kind] of cases) {
      fireEvent.change(field("hex"), { target: { value: hex } });
      fireEvent.blur(field("hex"));
      expect(field("value").value).toBe(value);
      expect(readout("class").startsWith(kind)).toBe(true);
    }
  });

  it("editing one field moves the pattern and keeps the rest", () => {
    render(<BaseConverter />);
    pickWidth(32);
    fireEvent.change(field("value"), { target: { value: "1" } });
    fireEvent.blur(field("value"));
    fireEvent.change(field("sign"), { target: { value: "1" } });
    expect(field("value").value).toBe("-1");
    fireEvent.change(field("unbiased exponent"), { target: { value: "1" } });
    expect(field("value").value).toBe("-2");
    expect(field("raw exponent").value).toBe("128");
    fireEvent.change(field("raw exponent"), { target: { value: "255" } });
    expect(field("value").value).toBe("-inf");
    fireEvent.change(field("fraction (hex)"), { target: { value: "1" } });
    expect(readout("class").startsWith("signalling NaN")).toBe(true);
    fireEvent.change(field("fraction (hex)"), { target: { value: "400000" } });
    expect(field("hex").value).toBe("ffc00000");
  });

  it("refuses out-of-range and malformed text with a message, keeping the value", () => {
    render(<BaseConverter />);
    pickWidth(32);
    fireEvent.change(field("value"), { target: { value: "2.5" } });
    fireEvent.blur(field("value"));
    const cases: Array<[string, string, string]> = [
      ["raw exponent", "256", "0 to 255"],
      ["unbiased exponent", "200", "-127 to 128"],
      ["fraction (hex)", "800000", "0x7fffff"],
      ["sign", "2", "0 (positive) or 1 (negative)"],
      ["value", "1e39", "largest 32-bit float"],
      ["value", "1e-50", "round to 0"],
      ["value", "two", "decimal"],
      ["value", "", "empty"],
    ];
    for (const [label, text, expectIn] of cases) {
      fireEvent.change(field(label), { target: { value: text } });
      expect(messageFor(label)).toContain(expectIn);
      expect(field(label).getAttribute("aria-invalid")).toBe("true");
      expect(field("hex").value).toBe("40200000");
      fireEvent.blur(field(label));
    }
  });

  it("flipping the sign bit in the grid updates the float reading", () => {
    render(<BaseConverter />);
    pickWidth(32);
    fireEvent.click(screen.getByRole("button", { name: "sign bit 31" }));
    expect(field("value").value).toBe("-0");
    expect(readout("exact value")).toBe("-0");
  });

  it("8 and 16 bits have no float reading and say which widths do", () => {
    render(<BaseConverter />);
    pickWidth(16);
    expect(screen.queryByLabelText("value")).toBeNull();
    expect(screen.getByText(/pick 32 or 64 bits/)).toBeTruthy();
  });
});

describe("BaseConverter opened from a link", () => {
  it("the ieee754 view moves an 8-bit width up to 32 and focuses the reading", () => {
    window.localStorage.setItem(
      "aarch64-playground:base-converter",
      JSON.stringify({ width: 8, hex: "2a" }),
    );
    render(<BaseConverter view="ieee754" />);
    expect(
      screen.getByRole("button", { name: /^32 bits/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(field("unsigned").value).toBe("42");
    const reading = screen.getByRole("group", { name: /IEEE-754 float/ });
    expect(document.activeElement).toBe(reading);
  });

  it("the octal view focuses the octal field's row", () => {
    render(<BaseConverter view="octal" />);
    expect(document.activeElement?.contains(field("octal"))).toBe(true);
  });

  it("with no view, nothing takes focus", () => {
    render(<BaseConverter />);
    expect(document.activeElement).toBe(document.body);
  });
});

describe("BaseConverter persistence", () => {
  it("restores the width and value on a fresh mount", () => {
    const first = render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("hex"), { target: { value: "2a" } });
    first.unmount();

    render(<BaseConverter />);
    expect(field("hex").value).toBe("2a");
    expect(
      screen
        .getByRole("button", { name: /^8 bits/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("falls back to a 32-bit zero when the stored blob is junk", () => {
    window.localStorage.setItem(
      "aarch64-playground:base-converter",
      '{"width":13,"hex":"zzz"}',
    );
    render(<BaseConverter />);
    expect(field("hex").value).toBe("00000000");
    expect(
      screen
        .getByRole("button", { name: /^32 bits/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("BaseConverter themes", () => {
  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<BaseConverter />);
      expect(screen.getByRole("group", { name: "bit width" })).toBeTruthy();
      expect(screen.getByRole("group", { name: /bit pattern/ })).toBeTruthy();
      unmount();
    }
  });
});
