import { describe, expect, test } from "vitest";
import { validateExercise, type WriteExercise } from "@/lib/content/exercise-schema";

/** A complete, valid exercise exercising every optional field and assertion kind. */
function validExercise() {
  return {
    title: "Sum Two Numbers",
    slug: "sum-two-numbers",
    order: 1,
    topic: "arithmetic",
    difficulty: "Intermediate",
    prompt: "## task\nAdd the two arguments and leave the sum in x0.",
    starter: "mov x0, 0\n",
    args: "2 3",
    stdin: "",
    variant: "write",
    acceptance: {
      results: [
        { kind: "register", reg: "x0", equals: 5 },
        { kind: "exit", equals: 0 },
        { kind: "stdout", matches: "^sum=\\d+$" },
      ],
      structural: [
        { kind: "uses-instruction", mnemonic: "add" },
        { kind: "forbids-literal", value: 5 },
      ],
    },
  };
}

/** Validate and return the error string, asserting the input was rejected. */
function rejectError(data: unknown): string {
  const result = validateExercise(data);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected validation to fail");
  return result.error;
}

/** Validate and return the exercise, asserting it narrowed to a coding variant. */
function acceptWrite(data: unknown): WriteExercise {
  const result = validateExercise(data);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  const { exercise } = result;
  if (exercise.variant !== "write" && exercise.variant !== "identify-bug") {
    throw new Error(`expected a coding variant, got ${exercise.variant}`);
  }
  return exercise;
}

describe("validateExercise (valid)", () => {
  test("accepts a full exercise and echoes the validated fields", () => {
    const exercise = acceptWrite(validExercise());
    expect(exercise.title).toBe("Sum Two Numbers");
    expect(exercise.slug).toBe("sum-two-numbers");
    expect(exercise.order).toBe(1);
    expect(exercise.topic).toBe("arithmetic");
    expect(exercise.difficulty).toBe("Intermediate");
    expect(exercise.args).toBe("2 3");
    expect(exercise.stdin).toBe("");
    expect(exercise.variant).toBe("write");
    expect(exercise.acceptance).toEqual({
      results: [
        { kind: "register", reg: "x0", equals: 5 },
        { kind: "exit", equals: 0 },
        { kind: "stdout", matches: "^sum=\\d+$" },
      ],
      structural: [
        { kind: "uses-instruction", mnemonic: "add" },
        { kind: "forbids-literal", value: 5 },
      ],
    });
  });

  test("defaults variant to write when it is omitted", () => {
    const { variant: _drop, ...withoutVariant } = validExercise();
    const result = validateExercise(withoutVariant);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.exercise.variant).toBe("write");
  });

  test("drops unknown top-level keys, keeping only validated fields", () => {
    const result = validateExercise({ ...validExercise(), injected: "<script>" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.exercise).not.toHaveProperty("injected");
  });
});

describe("validateExercise (malformed metadata)", () => {
  test("rejects non-object input naming the exercise", () => {
    expect(rejectError(null)).toMatch(/exercise/);
    expect(rejectError([])).toMatch(/exercise/);
    expect(rejectError("nope")).toMatch(/exercise/);
  });

  test("rejects a missing title", () => {
    const { title: _drop, ...rest } = validExercise();
    expect(rejectError(rest)).toMatch(/title/);
  });

  test("rejects a non-kebab slug", () => {
    expect(rejectError({ ...validExercise(), slug: "Not Kebab" })).toMatch(/slug/);
    expect(rejectError({ ...validExercise(), slug: "has spaces" })).toMatch(/slug/);
  });

  test("rejects a missing order", () => {
    const { order: _drop, ...rest } = validExercise();
    expect(rejectError(rest)).toMatch(/order/);
  });

  test("rejects a missing or empty prompt", () => {
    const { prompt: _drop, ...rest } = validExercise();
    expect(rejectError(rest)).toMatch(/prompt/);
    expect(rejectError({ ...validExercise(), prompt: "   " })).toMatch(/prompt/);
  });

  test("rejects a starter that is not a string", () => {
    expect(rejectError({ ...validExercise(), starter: 42 })).toMatch(/starter/);
  });

  test("rejects an unknown difficulty", () => {
    expect(rejectError({ ...validExercise(), difficulty: "easy" })).toMatch(/difficulty/);
  });

  test("rejects an unknown variant", () => {
    expect(rejectError({ ...validExercise(), variant: "fix-it" })).toMatch(/variant/);
  });
});

describe("validateExercise (malformed acceptance)", () => {
  test("rejects a missing acceptance", () => {
    const { acceptance: _drop, ...rest } = validExercise();
    expect(rejectError(rest)).toMatch(/acceptance/);
  });

  test("rejects an empty results array", () => {
    expect(rejectError({ ...validExercise(), acceptance: { results: [] } })).toMatch(
      /acceptance\.results/,
    );
  });

  test("rejects a register assertion with a bad reg, naming the index", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: { results: [{ kind: "register", reg: "x31", equals: 5 }] },
    });
    expect(error).toMatch(/acceptance\.results\[0\]/);
    expect(error).toMatch(/reg/);
  });

  test("rejects a register assertion with a non-number equals", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: { results: [{ kind: "register", reg: "x0", equals: "five" }] },
    });
    expect(error).toMatch(/acceptance\.results\[0\]/);
    expect(error).toMatch(/equals/);
  });

  test("rejects a non-integer register equals (no correct solution could satisfy it)", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: { results: [{ kind: "register", reg: "x0", equals: 5.5 }] },
    });
    expect(error).toMatch(/acceptance\.results\[0\]/);
    expect(error).toMatch(/equals must be an integer/);
  });

  test("rejects a non-integer exit equals", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: { results: [{ kind: "exit", equals: 0.1 }] },
    });
    expect(error).toMatch(/acceptance\.results\[0\]/);
    expect(error).toMatch(/equals must be an integer/);
  });

  test("rejects a stdout assertion with both equals and matches", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: { results: [{ kind: "stdout", equals: "a", matches: "b" }] },
    });
    expect(error).toMatch(/acceptance\.results\[0\]/);
    expect(error).toMatch(/stdout/);
  });

  test("rejects a stdout assertion with neither equals nor matches", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: { results: [{ kind: "stdout" }] },
    });
    expect(error).toMatch(/acceptance\.results\[0\]/);
    expect(error).toMatch(/stdout/);
  });

  test("rejects a stdout matches that is not a compilable RegExp", () => {
    expect(
      rejectError({
        ...validExercise(),
        acceptance: { results: [{ kind: "stdout", matches: "(" }] },
      }),
    ).toMatch(/matches/);
  });

  test("rejects a structural entry with an unknown kind, naming the index", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: {
        results: [{ kind: "exit", equals: 0 }],
        structural: [{ kind: "uses-branch" }],
      },
    });
    expect(error).toMatch(/acceptance\.structural\[0\]/);
  });

  test("rejects a forbids-literal with a value that is neither number nor string", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: {
        results: [{ kind: "exit", equals: 0 }],
        structural: [{ kind: "forbids-literal", value: true }],
      },
    });
    expect(error).toMatch(/acceptance\.structural\[0\]/);
    expect(error).toMatch(/value/);
  });
});

describe("validateExercise (assertion field guards)", () => {
  test("rejects a whitespace-only title", () => {
    expect(rejectError({ ...validExercise(), title: " \t " })).toMatch(/title/);
  });

  test("rejects non-string topic, args, and stdin when present", () => {
    expect(rejectError({ ...validExercise(), topic: 3 })).toMatch(/topic/);
    expect(rejectError({ ...validExercise(), args: 3 })).toMatch(/args/);
    expect(rejectError({ ...validExercise(), stdin: 3 })).toMatch(/stdin/);
  });

  test("accepts an empty starter string", () => {
    const exercise = acceptWrite({ ...validExercise(), starter: "" });
    expect(exercise.starter).toBe("");
  });

  test("rejects an acceptance that is not an object", () => {
    expect(rejectError({ ...validExercise(), acceptance: "all good" })).toMatch(/acceptance/);
    expect(rejectError({ ...validExercise(), acceptance: [] })).toMatch(/acceptance/);
  });

  test("rejects results that are not an array", () => {
    expect(rejectError({ ...validExercise(), acceptance: { results: "x" } })).toMatch(
      /acceptance\.results: expected an array/,
    );
  });

  test("rejects structural that is present but not an array", () => {
    expect(
      rejectError({
        ...validExercise(),
        acceptance: { results: [{ kind: "exit", equals: 0 }], structural: "add" },
      }),
    ).toMatch(/acceptance\.structural: expected an array/);
  });

  test("accepts sp and x30, rejects w0 and x300", () => {
    const withReg = (reg: string) => ({
      ...validExercise(),
      acceptance: { results: [{ kind: "register", reg, equals: 0 }] },
    });
    expect(validateExercise(withReg("sp")).ok).toBe(true);
    expect(validateExercise(withReg("x30")).ok).toBe(true);
    expect(rejectError(withReg("w0"))).toMatch(/reg must be x0-x30 or sp/);
    expect(rejectError(withReg("x300"))).toMatch(/reg/);
  });

  test("names the failing results index past the first entry", () => {
    const error = rejectError({
      ...validExercise(),
      acceptance: {
        results: [
          { kind: "exit", equals: 0 },
          { kind: "register", reg: "x0", equals: "five" },
        ],
      },
    });
    expect(error).toMatch(/acceptance\.results\[1\]/);
  });

  test("rejects a results entry that is not an object, naming the index", () => {
    expect(
      rejectError({ ...validExercise(), acceptance: { results: [null] } }),
    ).toMatch(/acceptance\.results\[0\]: expected an assertion object/);
  });

  test("rejects a stdout equals that is not a string", () => {
    expect(
      rejectError({
        ...validExercise(),
        acceptance: { results: [{ kind: "stdout", equals: 5 }] },
      }),
    ).toMatch(/equals must be a string/);
  });

  test("rejects a uses-instruction with an empty or blank mnemonic", () => {
    const withMnemonic = (mnemonic: unknown) => ({
      ...validExercise(),
      acceptance: {
        results: [{ kind: "exit", equals: 0 }],
        structural: [{ kind: "uses-instruction", mnemonic }],
      },
    });
    expect(rejectError(withMnemonic(""))).toMatch(/mnemonic must be a non-empty string/);
    expect(rejectError(withMnemonic("   "))).toMatch(/mnemonic/);
    expect(rejectError(withMnemonic(7))).toMatch(/mnemonic/);
  });

  test("accepts a stdout equals-only assertion", () => {
    const exercise = acceptWrite({
      ...validExercise(),
      acceptance: { results: [{ kind: "stdout", equals: "120\n" }] },
    });
    expect(exercise.acceptance.results).toEqual([{ kind: "stdout", equals: "120\n" }]);
  });

  test("names an unknown result kind in the error", () => {
    expect(
      rejectError({
        ...validExercise(),
        acceptance: { results: [{ kind: "memory", equals: 0 }] },
      }),
    ).toMatch(/unknown assertion kind "memory"/);
  });
});

/** A complete, valid interactive exercise for each variant. */
function validQuiz() {
  return {
    title: "Registers Quiz",
    slug: "registers-quiz",
    order: 3,
    prompt: "Answer the questions.",
    variant: "quiz",
    questions: [
      {
        question: "Which register is the frame pointer?",
        options: ["x0", "x29"],
        correctAnswer: 1,
        explanation: "x29 anchors the frame record.",
        hint: "It pairs with the link register.",
      },
    ],
  };
}

function validPrediction() {
  return {
    title: "Trace the Store",
    slug: "trace-the-store",
    order: 4,
    prompt: "Trace by hand.",
    variant: "prediction",
    predictions: [
      {
        code: "mov x20, 0x1000\nldr x21, [x20, 16]!",
        question: "What is in x20 afterward?",
        answer: "0x1010",
        explanation: "Pre-indexing updates the base register.",
      },
    ],
  };
}

function validBlanks() {
  return {
    title: "Complete the Load",
    slug: "complete-the-load",
    order: 5,
    prompt: "Fill in the blank.",
    variant: "blanks",
    blanks: [
      {
        prompt: "Load one byte, zero-extended.",
        code: "___ w20, [x29, 16]",
        blanks: ["ldrb"],
        explanation: "ldrb zero-extends the high-order bits.",
      },
    ],
  };
}

describe("validateExercise (interactive variants)", () => {
  test("accepts a quiz and echoes only the validated question fields", () => {
    const result = validateExercise({
      ...validQuiz(),
      questions: [{ ...validQuiz().questions[0], injected: "<script>" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    if (result.exercise.variant !== "quiz") throw new Error("expected the quiz variant");
    expect(result.exercise.questions).toHaveLength(1);
    expect(result.exercise.questions[0]).not.toHaveProperty("injected");
    expect(result.exercise.questions[0].correctAnswer).toBe(1);
  });

  test("rejects a quiz with no questions, one option, or an out-of-range answer", () => {
    expect(rejectError({ ...validQuiz(), questions: [] })).toMatch(/questions/);
    expect(
      rejectError({
        ...validQuiz(),
        questions: [{ ...validQuiz().questions[0], options: ["only one"] }],
      }),
    ).toMatch(/questions\[0\]: options/);
    expect(
      rejectError({
        ...validQuiz(),
        questions: [{ ...validQuiz().questions[0], correctAnswer: 2 }],
      }),
    ).toMatch(/questions\[0\]: correctAnswer/);
  });

  test("a quiz does not require starter or acceptance", () => {
    expect(validateExercise(validQuiz()).ok).toBe(true);
  });

  test("accepts a prediction and rejects one missing its answer", () => {
    expect(validateExercise(validPrediction()).ok).toBe(true);
    const { answer: _drop, ...withoutAnswer } = validPrediction().predictions[0];
    expect(rejectError({ ...validPrediction(), predictions: [withoutAnswer] })).toMatch(
      /predictions\[0\]: answer/,
    );
  });

  test("accepts a blanks question and pins exactly one ___ marker in its code", () => {
    expect(validateExercise(validBlanks()).ok).toBe(true);
    const noMarker = { ...validBlanks().blanks[0], code: "ldrb w20, [x29, 16]" };
    expect(rejectError({ ...validBlanks(), blanks: [noMarker] })).toMatch(/blanks\[0\]: code/);
    const twoMarkers = { ...validBlanks().blanks[0], code: "___ w20, [x29, ___]" };
    expect(rejectError({ ...validBlanks(), blanks: [twoMarkers] })).toMatch(/blanks\[0\]: code/);
  });

  test("rejects a blanks question with no accepted answers", () => {
    expect(
      rejectError({ ...validBlanks(), blanks: [{ ...validBlanks().blanks[0], blanks: [] }] }),
    ).toMatch(/blanks\[0\]: blanks/);
  });
});
