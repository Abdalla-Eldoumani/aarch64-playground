import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BlanksBlock } from "@/components/practice/BlanksBlock";

afterEach(() => cleanup());

const PROPS = {
  prompt: "Load one byte, zero-extended.",
  code: "___ w20, [x29, 16]",
  blanks: ["ldrb"],
  explanation: "ldrb zero-extends the high-order bits.",
  hint: "Load Register Byte.",
};

describe("BlanksBlock", () => {
  it("renders the code around a labeled input, with checking disabled while empty", () => {
    render(<BlanksBlock {...PROPS} />);
    expect(screen.getByText(/w20, \[x29, 16\]/)).toBeTruthy();
    const input = screen.getByLabelText(PROPS.prompt) as HTMLInputElement;
    expect(input.value).toBe("");
    const check = screen.getByRole("button", { name: "check answer" }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
  });

  it("accepts any listed answer, ignoring case and surrounding spaces", () => {
    const onAttempt = vi.fn();
    render(<BlanksBlock {...PROPS} onAttempt={onAttempt} />);
    fireEvent.change(screen.getByLabelText(PROPS.prompt), { target: { value: "  LDRB " } });
    fireEvent.click(screen.getByRole("button", { name: "check answer" }));
    expect(onAttempt).toHaveBeenCalledWith(true);
    expect(screen.getByText(PROPS.explanation)).toBeTruthy();
  });

  it("shows only the hint on a wrong answer and clears the input through try again", () => {
    const onAttempt = vi.fn();
    render(<BlanksBlock {...PROPS} onAttempt={onAttempt} />);
    const input = screen.getByLabelText(PROPS.prompt) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "strb" } });
    fireEvent.click(screen.getByRole("button", { name: "check answer" }));
    expect(onAttempt).toHaveBeenCalledWith(false);
    expect(screen.getByText(PROPS.hint)).toBeTruthy();
    expect(screen.queryByText(PROPS.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "try again" }));
    expect(input.value).toBe("");
  });
});

describe("BlanksBlock controlled answer", () => {
  // The blank's own outline is off, so the ring is its only focus mark.
  it("rings the blank on keyboard focus", () => {
    render(<BlanksBlock {...PROPS} />);
    expect(screen.getByLabelText(PROPS.prompt).className).toContain("focus-visible:[box-shadow:var(--ring)]");
  });

  it("renders the answer the sheet passes in", () => {
    render(<BlanksBlock {...PROPS} value="ldrb" onValueChange={() => {}} />);
    expect((screen.getByLabelText(PROPS.prompt) as HTMLInputElement).value).toBe("ldrb");
  });

  it("reports every keystroke", () => {
    const onValueChange = vi.fn();
    render(<BlanksBlock {...PROPS} value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText(PROPS.prompt), { target: { value: "ldr" } });
    expect(onValueChange).toHaveBeenCalledWith("ldr");
  });

  it("still owns its answer when no value is passed", () => {
    render(<BlanksBlock {...PROPS} />);
    const input = screen.getByLabelText(PROPS.prompt) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ldrb" } });
    expect(input.value).toBe("ldrb");
  });
});
