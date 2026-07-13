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

  it("a cleared field keeps the value quietly", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("unsigned"), { target: { value: "42" } });
    fireEvent.change(field("hex"), { target: { value: "" } });
    expect(field("unsigned").value).toBe("42");
    expect(screen.getByRole("status").textContent).toContain("type in any field");
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
    expect(screen.getByRole("status").textContent).toContain("255");
    // The draft shows what was typed; the canonical value did not move.
    expect(field("unsigned").value).toBe("300");
    expect(field("hex").value).toBe("00");
  });

  it("an over-wide hex value names the bits it needs", () => {
    render(<BaseConverter />);
    pickWidth(8);
    fireEvent.change(field("hex"), { target: { value: "1ff" } });
    expect(screen.getByRole("status").textContent).toContain("9 bits");
    expect(field("unsigned").value).toBe("0");
  });

  it("garbage input gets a specific message", () => {
    render(<BaseConverter />);
    fireEvent.change(field("hex"), { target: { value: "xyz" } });
    expect(screen.getByRole("status").textContent).toContain("0-9 and a-f");
  });

  it("blur resolves a held message back to the hint", () => {
    render(<BaseConverter />);
    pickWidth(8);
    const unsigned = field("unsigned");
    fireEvent.change(unsigned, { target: { value: "300" } });
    fireEvent.blur(unsigned);
    expect(unsigned.value).toBe("0");
    expect(screen.getByRole("status").textContent).toContain("type in any field");
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
    expect(screen.getByRole("status").textContent).toContain("kept the low 8");
    expect(field("hex").value).toBe("ff");
    expect(field("unsigned").value).toBe("255");
  });

  it("a switch that fits stays quiet and keeps the pattern", () => {
    render(<BaseConverter />);
    pickWidth(16);
    fireEvent.change(field("unsigned"), { target: { value: "42" } });
    pickWidth(8);
    expect(screen.getByRole("status").textContent).toContain("type in any field");
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
