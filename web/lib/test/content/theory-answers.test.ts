import { describe, expect, it } from "vitest";
import { typedAnswerIsRight } from "@/lib/content/theory-answers";
import { loadExercise } from "@/lib/content/exercises";

describe("typedAnswerIsRight", () => {
  it("ignores case and the spaces around an answer", () => {
    expect(typedAnswerIsRight(["ldr"], "  LDR ")).toBe(true);
    expect(typedAnswerIsRight([" b.ge "], "B.GE")).toBe(true);
  });

  it("takes any of the accepted spellings and nothing else", () => {
    expect(typedAnswerIsRight(["b.ge", "bge"], "bge")).toBe(true);
    expect(typedAnswerIsRight(["b.ge", "bge"], "b.gt")).toBe(false);
    expect(typedAnswerIsRight(["ldr"], "")).toBe(false);
    expect(typedAnswerIsRight(["ldr"], "l dr")).toBe(false);
  });

  it("accepts single for the four-byte float directive, a spelling the assembler takes", () => {
    const exercise = loadExercise("blanks-floating-point");
    if (exercise?.variant !== "blanks") throw new Error("expected the blanks set");
    const directive = exercise.blanks[0];
    expect(directive.code).toContain(".___");
    expect(typedAnswerIsRight(directive.blanks, "single")).toBe(true);
    expect(typedAnswerIsRight(directive.blanks, "float")).toBe(true);
    expect(typedAnswerIsRight(directive.blanks, "double")).toBe(false);
  });
});
