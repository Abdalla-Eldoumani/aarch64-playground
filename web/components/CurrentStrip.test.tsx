import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CurrentStrip } from "./CurrentStrip";

afterEach(() => cleanup());

describe("CurrentStrip", () => {
  it("renders the bold current-instruction label", () => {
    render(<CurrentStrip source="    mov x0, 1\n" currentLine={null} />);
    expect(screen.getByText("current instruction")).toBeTruthy();
  });

  it("renders the mono gloss for the line the CPU is on", () => {
    const source = "main:\n    mov x0, 1\n    svc 0\n";
    render(<CurrentStrip source={source} currentLine={2} />);
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
    render(<CurrentStrip source={source} currentLine={4} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text).toContain("score1_r=w19");
  });

  it("shows the calm prompt when no line is active", () => {
    render(<CurrentStrip source="    mov x0, 1\n" currentLine={null} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text.toLowerCase()).toContain("step the program");
  });
});
