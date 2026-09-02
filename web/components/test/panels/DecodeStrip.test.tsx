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
    expect(text).toContain("(score1_r = w19)");
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

  it("keeps a bit string on one line and floors its cell to its own width", () => {
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
    expect(value!.className).toContain("whitespace-nowrap");
    expect(value!.className).not.toContain("break-all");
    // The cell floors on its own content rather than on a computed advance.
    expect(value!.parentElement!.className).toContain("min-w-max");
  });

  it("renders no field row before the program is assembled", () => {
    render(<DecodeStrip source="    mov x0, 1\n" currentLine={null} encodingHex={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("DecodeStrip external-call card", () => {
  // The three steps a `bl printf` costs land on a trampoline and a synthetic
  // stub, so the strip has no encoding and no line of the student's to gloss.
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

  it("replaces the field row and the gloss while the call is on", () => {
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

  it("keeps the cold prompt for the empty machine only", () => {
    const { rerender } = render(
      <DecodeStrip source={CALL_SOURCE} currentLine={null} sessionStarted={false} />,
    );
    expect(
      (screen.getByLabelText("current instruction").textContent ?? "").toLowerCase(),
    ).toContain("step the program");

    // Mid-session with nothing to gloss (an address the map cannot name and
    // no call context): silence, not an instruction to step.
    rerender(<DecodeStrip source={CALL_SOURCE} currentLine={null} sessionStarted />);
    expect(
      (screen.getByLabelText("current instruction").textContent ?? "").toLowerCase(),
    ).not.toContain("step the program");
  });
});
