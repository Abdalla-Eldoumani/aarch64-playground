import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { QuizExercise } from "@/lib/content/exercise-schema";

vi.mock("@/lib/playground/solved-state", () => ({
  markSolved: vi.fn(),
}));

import { InteractiveExerciseView } from "@/components/practice/InteractiveExerciseView";
import { markSolved } from "@/lib/playground/solved-state";

afterEach(() => {
  cleanup();
  vi.mocked(markSolved).mockClear();
});

const QUIZ: QuizExercise = {
  title: "Registers Quiz",
  slug: "registers-quiz",
  order: 3,
  prompt: "Answer both questions.",
  variant: "quiz",
  questions: [
    {
      question: "Which register is the frame pointer?",
      options: ["x0", "x29"],
      correctAnswer: 1,
      explanation: "x29 anchors the frame record.",
    },
    {
      question: "Which register is the link register?",
      options: ["x30", "sp"],
      correctAnswer: 0,
      explanation: "x30 holds the return address.",
    },
  ],
};

describe("InteractiveExerciseView", () => {
  it("renders the title, prompt, one block per question, and a zero progress line", () => {
    render(<InteractiveExerciseView exercise={QUIZ} sheetNumber="5.3" />);
    expect(screen.getByRole("heading", { level: 1, name: QUIZ.title })).toBeTruthy();
    expect(screen.getByText(QUIZ.prompt)).toBeTruthy();
    expect(screen.getByText(QUIZ.questions[0].question)).toBeTruthy();
    expect(screen.getByText(QUIZ.questions[1].question)).toBeTruthy();
    expect(screen.getByText("0 of 2 correct")).toBeTruthy();
  });

  it("counts a correct answer once and marks solved only when every question is correct", () => {
    render(<InteractiveExerciseView exercise={QUIZ} />);

    fireEvent.click(screen.getByRole("button", { name: "x29" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Check Answer" })[0]);
    expect(screen.getByText("1 of 2 correct")).toBeTruthy();
    expect(markSolved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "x30" }));
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(screen.getByText("2 of 2 correct")).toBeTruthy();
    expect(markSolved).toHaveBeenCalledTimes(1);
    expect(markSolved).toHaveBeenCalledWith("registers-quiz");
  });

  it("does not advance progress on a wrong answer", () => {
    render(<InteractiveExerciseView exercise={QUIZ} />);
    fireEvent.click(screen.getByRole("button", { name: "x0" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Check Answer" })[0]);
    expect(screen.getByText("0 of 2 correct")).toBeTruthy();
    expect(markSolved).not.toHaveBeenCalled();
  });

  it("offers a back-to-top control after the last block that scrolls the window up", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true });
    render(<InteractiveExerciseView exercise={QUIZ} />);
    fireEvent.click(screen.getByRole("button", { name: "back to top" }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });
});
