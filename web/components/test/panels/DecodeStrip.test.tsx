import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DecodeStrip } from "@/components/panels/DecodeStrip";

afterEach(() => cleanup());

describe("DecodeStrip", () => {
  it("renders the current-instruction label", () => {
    render(<DecodeStrip source="    mov x0, 1\n" currentLine={null} />);
    expect(screen.getByText("current instruction")).toBeTruthy();
  });

  it("explains the line the CPU is on in words", () => {
    const source = "main:\n    mov x0, 1\n    svc 0\n";
    render(<DecodeStrip source={source} currentLine={2} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text.toLowerCase()).toContain("mov");
    expect(text.toLowerCase()).toContain("copy register");
  });

  it("shows the register each m4 name stands for inside the explanation", () => {
    const source = [
      "define(score1_r, w19)",
      ".text",
      "main:",
      "    mov score1_r, 5",
    ].join("\n");
    render(<DecodeStrip source={source} currentLine={4} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text).toContain("(score1_r = w19)");
  });

  it("leaves register names to the field row, but keeps them for a screen reader", () => {
    // movz x19, #5 = 0xd28000b3: the Rd box already reads x19.
    const source = ["define(count_r, x19)", ".text", "main:", "    mov count_r, 5"].join("\n");
    render(<DecodeStrip source={source} currentLine={4} encodingHex="0xd28000b3" />);
    const strip = screen.getByLabelText("current instruction");
    expect(screen.getByRole("img", { name: /instruction encoding/ }).textContent).toContain("x19");
    const shown = strip.querySelector('[aria-hidden="true"]')?.textContent ?? "";
    expect(shown).toContain("mov count_r, 5 ·");
    expect(shown).not.toContain("count_r = x19");
    expect(strip.querySelector(".sr-only")?.textContent).toContain("(count_r = x19)");
  });

  it("keeps an m4 constant in sight, since no box spells it out", () => {
    // add x0, x1, #16 = 0x91004020.
    const source = ["define(size_c, 16)", "main:", "    add x0, x1, size_c"].join("\n");
    render(<DecodeStrip source={source} currentLine={3} encodingHex="0x91004020" />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text).toContain("(size_c = 16)");
  });

  it("shows the step prompt when no line is active", () => {
    render(<DecodeStrip source="    mov x0, 1\n" currentLine={null} />);
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text.toLowerCase()).toContain("step the program");
  });

  it("renders the encoding's bit fields and names the destination register", () => {
    // movz x19, 42: machine word taken from the emulator's disassembly.
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

  it("shows the Rd field as its own five bits", () => {
    // Same movz x19, 42 word: Rd is the five bits 10011.
    render(
      <DecodeStrip source="main:
    mov x19, 42
" currentLine={2} encodingHex="0xd2800553" />,
    );
    const row = screen.getByRole("img", { name: /instruction encoding/ });
    const value = Array.from(row.querySelectorAll("span")).find(
      (span) => span.textContent === "10011",
    );
    expect(value).toBeTruthy();
  });

  it("renders no field row before the program is assembled", () => {
    render(<DecodeStrip source="    mov x0, 1\n" currentLine={null} encodingHex={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("DecodeStrip external-call card", () => {
  // The three steps a `bl printf` takes run in the emulator's own code, not
  // the student's, so the strip has no encoding and no line to explain.
  const CALL_SOURCE = "main:\n    ldr x0, =msg\n    bl printf\n";

  it("names the call and says who runs it", () => {
    render(
      <DecodeStrip
        source={CALL_SOURCE}
        currentLine={3}
        externalCall={{ name: "printf", waiting: false }}
        sessionStarted
      />,
    );
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text).toContain("printf");
    expect(text).toContain("external call · handled by the runtime");
    expect(text).toContain(
      "printf runs inside the interpreter, not in your program; it finishes and returns on a later step",
    );
  });

  it("says what it is waiting for in the blocked variant", () => {
    render(
      <DecodeStrip
        source={CALL_SOURCE}
        currentLine={3}
        externalCall={{ name: "scanf", waiting: true }}
        sessionStarted
      />,
    );
    const text = screen.getByLabelText("current instruction").textContent ?? "";
    expect(text).toContain("scanf");
    expect(text).toContain("waiting for input in the console");
    expect(text).not.toContain("returns on a later step");
  });

  it("replaces the bit fields and the explanation while the call runs", () => {
    const { rerender } = render(
      <DecodeStrip
        source={CALL_SOURCE}
        currentLine={3}
        encodingHex="0xd2800553"
        externalCall={{ name: "printf", waiting: false }}
        sessionStarted
      />,
    );
    // No bit-field row: the word under the pc is not the student's code.
    expect(screen.queryByRole("img")).toBeNull();
    const during = screen.getByLabelText("current instruction").textContent ?? "";
    expect(during.toLowerCase()).not.toContain("branch with link");

    // The call returns: the strip goes back to decoding the line.
    rerender(
      <DecodeStrip
        source={CALL_SOURCE}
        currentLine={3}
        encodingHex="0xd2800553"
        externalCall={null}
        sessionStarted
      />,
    );
    expect(screen.getByRole("img", { name: /instruction encoding/ })).toBeTruthy();
    const after = screen.getByLabelText("current instruction").textContent ?? "";
    expect(after).not.toContain("external call");
  });

  it("shows the step prompt only before the program starts", () => {
    const { rerender } = render(
      <DecodeStrip source={CALL_SOURCE} currentLine={null} sessionStarted={false} />,
    );
    expect(
      (screen.getByLabelText("current instruction").textContent ?? "").toLowerCase(),
    ).toContain("step the program");

    // Mid-run with nothing to explain (an address the map cannot name and no
    // call in progress): stay quiet rather than tell the student to step.
    rerender(<DecodeStrip source={CALL_SOURCE} currentLine={null} sessionStarted />);
    expect(
      (screen.getByLabelText("current instruction").textContent ?? "").toLowerCase(),
    ).not.toContain("step the program");
  });
});
