import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BitFieldDiagram, type BitField } from "@/components/diagrams/BitFieldDiagram";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

// A worked 32-bit example whose nibble split is easy to eyeball: the four
// byte-wide fields concatenate to 0x8b010013.
const WORKED_FIELDS: BitField[] = [
  { bits: 8, label: "op", value: "10001011" },
  { bits: 8, label: "hi", value: "00000001" },
  { bits: 8, label: "mid", value: "00000000" },
  { bits: 8, label: "Rd", value: "00010011", meaning: "x19" },
];

describe("BitFieldDiagram", () => {
  it("renders one box per field", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 11, label: "opcode" },
          { bits: 5, label: "Rm" },
          { bits: 5, label: "Rn" },
          { bits: 5, label: "Rd" },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("opcode")).toBeTruthy();
  });

  it("sizes each box proportionally to its bit width", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 11, label: "wide" },
          { bits: 5, label: "narrow" },
        ]}
      />,
    );
    const [wide, narrow] = screen.getAllByRole("listitem");
    expect(wide.style.flexGrow).toBe("11");
    expect(narrow.style.flexGrow).toBe("5");
  });

  it("uses a caller color when provided and a token default otherwise", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 8, label: "colored", color: "magenta" },
          { bits: 8, label: "plain" },
        ]}
      />,
    );
    const [colored, plain] = screen.getAllByRole("listitem");
    expect(colored.style.borderTopColor).toBe("magenta");
    expect(plain.style.borderTopColor).toBe("");
    expect(plain.className).toContain("border-t-[var(--border-strong)]");
  });

  it("falls back to a sample encoding when no fields are given", () => {
    render(<BitFieldDiagram />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.getByText("opcode")).toBeTruthy();
  });

  it("stays static without worked values: no readout, no field buttons", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 16, label: "a" },
          { bits: 16, label: "b" },
        ]}
      />,
    );
    expect(screen.queryByLabelText("assembled word")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stays static when the worked values do not fill the word", () => {
    render(
      <BitFieldDiagram
        fields={[
          { bits: 16, label: "a", value: "1010101010101010" },
          { bits: 16, label: "b" }, // no value
        ]}
      />,
    );
    expect(screen.queryByLabelText("assembled word")).toBeNull();
  });

  it("assembles the worked word into nibbles and hex", () => {
    render(<BitFieldDiagram fields={WORKED_FIELDS} asm="add x19, x0, x1" />);
    const readout = screen.getByLabelText("assembled word");
    expect(readout.textContent).toContain("= 0x8b010013");
    // The caption names the worked instruction.
    expect(screen.getByText("add x19, x0, x1")).toBeTruthy();
    // Every field is reachable by keyboard as a labeled button.
    expect(
      screen.getByRole("button", { name: "Rd, 8 bits, 00010011, x19" }),
    ).toBeTruthy();
  });

  it("focusing a field traces it into the caption", () => {
    render(<BitFieldDiagram fields={WORKED_FIELDS} />);
    const field = screen.getByRole("button", {
      name: "Rd, 8 bits, 00010011, x19",
    });
    fireEvent.focus(field);
    expect(screen.getByText("Rd = 00010011 -> x19")).toBeTruthy();
    fireEvent.blur(field);
    expect(screen.queryByText("Rd = 00010011 -> x19")).toBeNull();
  });

  it("renders bit-range headers and the amber destination when bitHeaders is set", () => {
    render(<BitFieldDiagram fields={WORKED_FIELDS} bitHeaders />);
    // Ranges count down from bit 31, one per field, msb first.
    expect(screen.getByText("31 : 24")).toBeTruthy();
    expect(screen.getByText("23 : 16")).toBeTruthy();
    expect(screen.getByText("15 : 8")).toBeTruthy();
    expect(screen.getByText("7 : 0")).toBeTruthy();
    // The destination field (Rd) takes the amber treatment.
    const rd = screen.getAllByRole("listitem")[3];
    expect(rd.className).toContain("var(--amber)");
    expect(rd.style.borderTopColor).toBe("var(--amber)");
    // ...and the worked-encoding interactivity is intact underneath it.
    fireEvent.focus(screen.getByRole("button", { name: "Rd, 8 bits, 00010011, x19" }));
    expect(screen.getByText("Rd = 00010011 -> x19")).toBeTruthy();
  });

  it("prints a single bit number for a one-bit field", () => {
    render(
      <BitFieldDiagram
        bitHeaders
        fields={[
          { bits: 1, label: "sf" },
          { bits: 5, label: "op" },
          { bits: 26, label: "rest" },
        ]}
      />,
    );
    expect(screen.getByText("31")).toBeTruthy();
    expect(screen.getByText("30 : 26")).toBeTruthy();
    expect(screen.getByText("25 : 0")).toBeTruthy();
  });

  it("stays free of bit headers and amber by default", () => {
    render(<BitFieldDiagram fields={WORKED_FIELDS} />);
    expect(screen.queryByText("31 : 24")).toBeNull();
    const rd = screen.getAllByRole("listitem")[3];
    expect(rd.className).not.toContain("var(--amber)");
  });

  it("renders the default form under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<BitFieldDiagram />);
      expect(screen.getByLabelText("instruction encoding")).toBeTruthy();
      unmount();
    }
  });
});
