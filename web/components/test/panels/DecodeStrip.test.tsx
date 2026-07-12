import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DecodeStrip } from "@/components/panels/DecodeStrip";

afterEach(() => cleanup());

describe("DecodeStrip", () => {
  it("renders the current-instruction label", () => {
    render(<DecodeStrip source="    mov x0, 1\n" currentLine={null} />);
    expect(screen.getByText("current instruction")).toBeTruthy();
  });

  it("renders the mono gloss for the line the CPU is on", () => {
    const source = "main:\n    mov x0, 1\n    svc 0\n";
    render(<DecodeStrip source={source} currentLine={2} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text.toLowerCase()).toContain("mov");
    expect(text.toLowerCase()).toContain("copy register");
  });

  it("inlines m4 alias resolutions into the gloss", () => {
    const source = [
      "define(score1_r, w19)",
      ".text",
      "main:",
      "    mov score1_r, 5",
    ].join("\n");
    render(<DecodeStrip source={source} currentLine={4} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text).toContain("score1_r=w19");
  });

  it("shows the calm prompt when no line is active", () => {
    render(<DecodeStrip source="    mov x0, 1\n" currentLine={null} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text.toLowerCase()).toContain("step the program");
  });

  it("renders the field row for the encoding and lights the destination", () => {
    // movz x19, 42 -- verified machine word from the emulator's disassembly.
    render(
      <DecodeStrip source="main:\n    mov x19, 42\n" currentLine={2} encodingHex="0xd2800553" />,
    );
    const row = screen.getByRole("img", { name: /instruction encoding/ });
    const text = row.textContent ?? "";
    // Field labels and the decoded destination register are visible.
    expect(text).toContain("imm16");
    expect(text).toContain("Rd");
    expect(text).toContain("x19");
    expect(text).toContain("42");
    // The header shows the raw hex.
    expect(screen.getByText("0xd2800553")).toBeTruthy();
  });

  it("renders no field row before the program is assembled", () => {
    render(<DecodeStrip source="    mov x0, 1\n" currentLine={null} encodingHex={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
