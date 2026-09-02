import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PredictionBlock } from "@/components/practice/PredictionBlock";

afterEach(() => cleanup());

const PROPS = {
  code: "mov x20, 0x1000\nldr x21, [x20, 16]!",
  question: "What is in x20 afterward?",
  answer: "0x1010",
  explanation: "Pre-indexing updates the base register before the load.",
  hint: "16 in decimal is 0x10 in hex.",
};

describe("PredictionBlock", () => {
  it("renders the snippet and a labeled input, with checking disabled while empty", () => {
    render(<PredictionBlock {...PROPS} />);
    expect(screen.getByText(/mov x20, 0x1000/)).toBeTruthy();
    const check = screen.getByRole("button", { name: "check answer" }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(screen.getByLabelText(PROPS.question)).toBeTruthy();
  });

  it("grades the answer trimmed and case-folded", () => {
    const onAttempt = vi.fn();
    render(<PredictionBlock {...PROPS} onAttempt={onAttempt} />);
    fireEvent.change(screen.getByLabelText(PROPS.question), { target: { value: " 0X1010 " } });
    fireEvent.click(screen.getByRole("button", { name: "check answer" }));
    expect(onAttempt).toHaveBeenCalledWith(true);
    expect(screen.getByText(PROPS.explanation)).toBeTruthy();
  });

  it("shows only the hint on a wrong prediction and resets through try again", () => {
    const onAttempt = vi.fn();
    render(<PredictionBlock {...PROPS} onAttempt={onAttempt} />);
    const input = screen.getByLabelText(PROPS.question) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0x1000" } });
    fireEvent.click(screen.getByRole("button", { name: "check answer" }));
    expect(onAttempt).toHaveBeenCalledWith(false);
    expect(screen.getByText(PROPS.hint)).toBeTruthy();
    expect(screen.queryByText(PROPS.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "try again" }));
    expect(input.value).toBe("");
  });
});

describe("PredictionBlock controlled answer", () => {
  it("renders the answer the sheet passes in", () => {
    render(<PredictionBlock {...PROPS} value="0x1010" onValueChange={() => {}} />);
    expect((screen.getByLabelText(PROPS.question) as HTMLInputElement).value).toBe("0x1010");
  });

  it("reports every keystroke", () => {
    const onValueChange = vi.fn();
    render(<PredictionBlock {...PROPS} value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText(PROPS.question), { target: { value: "0x10" } });
    expect(onValueChange).toHaveBeenCalledWith("0x10");
  });

  it("still owns its answer when no value is passed", () => {
    render(<PredictionBlock {...PROPS} />);
    const input = screen.getByLabelText(PROPS.question) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0x1010" } });
    expect(input.value).toBe("0x1010");
  });
});
