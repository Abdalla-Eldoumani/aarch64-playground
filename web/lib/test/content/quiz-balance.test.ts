import { describe, expect, it } from "vitest";
import { loadAllExercises } from "@/lib/content/exercises";
import type { QuizQuestion } from "@/lib/content/exercise-schema";

// A quiz where the right answer is usually option B, or usually the longest
// option, can be passed without reading the question. Across every shipped
// quiz, no position may hold more than 35 percent of the right answers, and
// the right answer may be the strictly longest option in at most 30 percent
// of the questions.
const questions: QuizQuestion[] = loadAllExercises().flatMap((exercise) =>
  exercise.variant === "quiz" ? exercise.questions : [],
);

describe("quiz answers give nothing away by shape", () => {
  it("has quiz questions to measure", () => {
    expect(questions.length).toBeGreaterThan(100);
  });

  it("spreads the right answer over the positions", () => {
    const counts = new Map<number, number>();
    for (const question of questions) {
      counts.set(question.correctAnswer, (counts.get(question.correctAnswer) ?? 0) + 1);
    }
    for (const [position, count] of counts) {
      expect(count / questions.length, `position ${position}`).toBeLessThanOrEqual(0.35);
    }
  });

  it("does not make the right answer the longest option most of the time", () => {
    const longest = questions.filter((question) => {
      const right = question.options[question.correctAnswer].length;
      return question.options.every((option, index) => index === question.correctAnswer || option.length < right);
    });
    expect(longest.length / questions.length).toBeLessThanOrEqual(0.3);
  });
});
