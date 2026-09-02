import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
  BlanksExercise,
  PredictionExercise,
  QuizExercise,
} from "@/lib/content/exercise-schema";

vi.mock("@/lib/playground/solved-state", () => ({
  markSolved: vi.fn(),
}));

import { InteractiveExerciseView } from "@/components/practice/InteractiveExerciseView";
import { markSolved } from "@/lib/playground/solved-state";

afterEach(() => {
  cleanup();
  vi.mocked(markSolved).mockClear();
  window.localStorage.clear();
});

const ANSWER_KEY = (slug: string) => `aarch64-playground:practice:answer:${slug}`;

function storeAnswer(slug: string, record: Record<string, unknown>): void {
  window.localStorage.setItem(
    ANSWER_KEY(slug),
    JSON.stringify({ version: 1, updatedAt: 1, ...record }),
  );
}

function storedAnswer(slug: string): { kind: string; answers: unknown[] } | null {
  const raw = window.localStorage.getItem(ANSWER_KEY(slug));
  return raw === null ? null : JSON.parse(raw);
}

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
    fireEvent.click(screen.getAllByRole("button", { name: "check answer" })[0]);
    expect(screen.getByText("1 of 2 correct")).toBeTruthy();
    expect(markSolved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "x30" }));
    fireEvent.click(screen.getByRole("button", { name: "check answer" }));
    expect(screen.getByText("2 of 2 correct")).toBeTruthy();
    expect(markSolved).toHaveBeenCalledTimes(1);
    expect(markSolved).toHaveBeenCalledWith("registers-quiz");
  });

  it("does not advance progress on a wrong answer", () => {
    render(<InteractiveExerciseView exercise={QUIZ} />);
    fireEvent.click(screen.getByRole("button", { name: "x0" }));
    fireEvent.click(screen.getAllByRole("button", { name: "check answer" })[0]);
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

const BLANKS: BlanksExercise = {
  title: "Load Store Blanks",
  slug: "load-store-blanks",
  order: 4,
  prompt: "Complete both lines.",
  variant: "blanks",
  blanks: [
    {
      prompt: "Load a doubleword.",
      code: "        ___     x0, [x1]",
      blanks: ["ldr"],
      explanation: "ldr loads.",
    },
    {
      prompt: "Store a doubleword.",
      code: "        ___     x0, [x1]",
      blanks: ["str"],
      explanation: "str stores.",
    },
  ],
};

const PREDICTION: PredictionExercise = {
  title: "Trace The Adds",
  slug: "trace-the-adds",
  order: 5,
  prompt: "Trace both snippets.",
  variant: "prediction",
  predictions: [
    {
      code: "        mov     x0, 2",
      question: "What is in x0?",
      answer: "2",
      explanation: "mov moves the immediate.",
    },
  ],
};

describe("InteractiveExerciseView saved answers", () => {
  it("saves a quiz pick under this slug", () => {
    render(<InteractiveExerciseView exercise={QUIZ} />);

    fireEvent.click(screen.getByRole("button", { name: "x29" }));

    expect(storedAnswer("registers-quiz")).toMatchObject({
      kind: "quiz",
      answers: [1],
    });
  });

  it("restores a saved quiz pick on a later visit", () => {
    storeAnswer("registers-quiz", { kind: "quiz", answers: [1, 0] });
    render(<InteractiveExerciseView exercise={QUIZ} />);

    expect(screen.getByRole("button", { name: "x29" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "x30" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "x0" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("saves and restores a typed blank", () => {
    render(<InteractiveExerciseView exercise={BLANKS} />);
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[1], { target: { value: "str" } });

    expect(storedAnswer("load-store-blanks")).toMatchObject({
      kind: "blanks",
      answers: ["", "str"],
    });

    cleanup();
    render(<InteractiveExerciseView exercise={BLANKS} />);
    expect((screen.getAllByRole("textbox")[1] as HTMLInputElement).value).toBe("str");
  });

  it("saves and restores a typed prediction", () => {
    render(<InteractiveExerciseView exercise={PREDICTION} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2" } });
    expect(storedAnswer("trace-the-adds")).toMatchObject({ kind: "predict", answers: ["2"] });

    cleanup();
    render(<InteractiveExerciseView exercise={PREDICTION} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("2");
  });

  it("ignores a saved record whose kind belongs to another variant", () => {
    storeAnswer("load-store-blanks", { kind: "quiz", answers: [1, 0] });
    render(<InteractiveExerciseView exercise={BLANKS} />);
    for (const input of screen.getAllByRole("textbox")) {
      expect((input as HTMLInputElement).value).toBe("");
    }
  });

  it("ignores a malformed saved record", () => {
    window.localStorage.setItem(ANSWER_KEY("registers-quiz"), "{not json");
    render(<InteractiveExerciseView exercise={QUIZ} />);
    expect(screen.getByRole("button", { name: "x29" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("drops an answer for a question the set no longer has", () => {
    storeAnswer("trace-the-adds", { kind: "predict", answers: ["2", "stale"] });
    render(<InteractiveExerciseView exercise={PREDICTION} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "3" } });
    expect(storedAnswer("trace-the-adds")).toMatchObject({ kind: "predict", answers: ["3"] });
  });

  it("does not store the check result beside the answer", () => {
    render(<InteractiveExerciseView exercise={QUIZ} />);
    fireEvent.click(screen.getByRole("button", { name: "x29" }));
    fireEvent.click(screen.getAllByRole("button", { name: "check answer" })[0]);

    expect(Object.keys(storedAnswer("registers-quiz") as object).sort()).toEqual([
      "answers",
      "kind",
      "updatedAt",
      "version",
    ]);
  });
});
