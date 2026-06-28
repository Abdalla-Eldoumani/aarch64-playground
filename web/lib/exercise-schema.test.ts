import { describe, expect, test } from "vitest";
import { validateExercise } from "./exercise-schema";

/** A complete, valid exercise exercising every optional field and assertion kind. */
function validExercise() {
  return {
    title: "Sum Two Numbers",
    slug: "sum-two-numbers",
    order: 1,
    topic: "arithmetic",
    difficulty: "core",
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

describe("validateExercise (valid)", () => {
  test("accepts a full exercise and echoes the validated fields", () => {
    const result = validateExercise(validExercise());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const { exercise } = result;
    expect(exercise.title).toBe("Sum Two Numbers");
    expect(exercise.slug).toBe("sum-two-numbers");
    expect(exercise.order).toBe(1);
    expect(exercise.topic).toBe("arithmetic");
    expect(exercise.difficulty).toBe("core");
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
