import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuizBlock } from "@/components/practice/QuizBlock";

afterEach(() => cleanup());

const PROPS = {
  question: "Which register is the frame pointer?",
  options: ["x0", "x29", "x30"],
  correctAnswer: 1,
  explanation: "x29 anchors the frame record.",
  hint: "It pairs with the link register.",
};

describe("QuizBlock", () => {
  it("renders the question and every option, with checking disabled until a selection", () => {
    render(<QuizBlock {...PROPS} />);
    expect(screen.getByText(PROPS.question)).toBeTruthy();
    for (const option of PROPS.options) expect(screen.getByRole("button", { name: option })).toBeTruthy();
    const check = screen.getByRole("button", { name: "Check Answer" }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "x0" }));
    expect(check.disabled).toBe(false);
  });

  it("shows the explanation and reports success on the correct answer", () => {
    const onAttempt = vi.fn();
    render(<QuizBlock {...PROPS} onAttempt={onAttempt} />);
    fireEvent.click(screen.getByRole("button", { name: "x29" }));
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(screen.getByText(PROPS.explanation)).toBeTruthy();
    expect(onAttempt).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
  });

  it("shows only the hint on a wrong answer and resets through Try Again", () => {
    const onAttempt = vi.fn();
    render(<QuizBlock {...PROPS} onAttempt={onAttempt} />);
    fireEvent.click(screen.getByRole("button", { name: "x0" }));
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(onAttempt).toHaveBeenCalledWith(false);
    expect(screen.getByText(PROPS.hint)).toBeTruthy();
    expect(screen.queryByText(PROPS.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.getByRole("button", { name: "Check Answer" })).toBeTruthy();
  });

  it("locks the options once submitted", () => {
    render(<QuizBlock {...PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: "x29" }));
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    const option = screen.getByRole("button", { name: "x0" }) as HTMLButtonElement;
    expect(option.disabled).toBe(true);
  });
});
