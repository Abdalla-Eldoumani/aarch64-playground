import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ExplainStrip } from "./ExplainStrip";

afterEach(() => cleanup());

describe("ExplainStrip", () => {
  it("describes the current instruction with the lookup doc summary", () => {
    const source = "main:\n    mov x0, 1\n    svc 0\n";
    render(<ExplainStrip source={source} currentLine={2} />);
    const explanation = screen.getByLabelText("explain strip").textContent ?? "";
    expect(explanation.toLowerCase()).toContain("mov");
    expect(explanation.toLowerCase()).toContain("copy register");
  });

  it("inlines m4 aliases into the operand list", () => {
    const source = [
      "define(score1_r, w19)",
      ".text",
      ".global main",
      "main:",
      "    mov score1_r, 5",
    ].join("\n");
    render(<ExplainStrip source={source} currentLine={5} />);
    const explanation = screen.getByLabelText("explain strip").textContent ?? "";
    expect(explanation).toContain("score1_r=w19");
  });

  it("falls back to a placeholder when no line is active", () => {
    render(<ExplainStrip source="mov x0, 1\n" currentLine={null} />);
    const explanation = screen.getByLabelText("explain strip").textContent ?? "";
    expect(explanation.toLowerCase()).toContain("step the program");
  });

  it("describes directives even though they have no instruction doc", () => {
    const source = ".data\nmsg: .word 42\n";
    render(<ExplainStrip source={source} currentLine={2} />);
    const explanation = screen.getByLabelText("explain strip").textContent ?? "";
    expect(explanation).toContain(".word");
    expect(explanation.toLowerCase()).toContain("emits data");
  });
});
