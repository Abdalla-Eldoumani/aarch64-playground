/**
 * The exercise authoring contract: TypeScript types plus a hand-rolled
 * runtime validator. An exercise is author-supplied JSON, so it is
 * untrusted until `validateExercise` has narrowed it field-by-field. This
 * is the single source of truth for the exercise shape; the loader, the
 * checker, the index, and the view all import these types and call this
 * validator, and only a validated exercise is ever rendered or evaluated.
 *
 * The validator is dependency-free and modeled on the defensive style in
 * lesson-schema.ts and upload-guard.ts: narrow `unknown` one field at a
 * time, return a discriminated result, never throw. A stdout `matches`
 * pattern is compiled here, at validation time, so an author's
 * un-compilable regular expression is rejected on load instead of throwing
 * later when the checker runs it against program output.
 */

/** A single result assertion evaluated against emulator output. */
export type ResultAssertion =
  | { kind: "register"; reg: string; equals: number } // reg: "x0".."x30" or "sp"
  | { kind: "exit"; equals: number }
  | { kind: "stdout"; equals: string }
  | { kind: "stdout"; matches: string }; // a declared RegExp pattern

/** A single structural assertion evaluated against the source text. */
export type StructuralAssertion =
  | { kind: "uses-instruction"; mnemonic: string }
  | { kind: "forbids-literal"; value: number | string };

export type ExerciseVariant = "write" | "identify-bug" | "quiz" | "prediction" | "blanks";
export type ExerciseDifficulty = "intro" | "core" | "challenge";

/** The acceptance criteria: required result checks plus optional structure. */
export interface Acceptance {
  /** At least one; the primary pass/fail criteria. */
  results: ResultAssertion[];
  /** Optional source-shape requirements (an approach, or a forbidden shortcut). */
  structural?: StructuralAssertion[];
}

/** A standard multiple-choice question with a single correct answer index. */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  /** Optional nudges to guide the user before an attempt. */
  hint?: string;
}

/** A mental tracing exercise requiring the user to predict the output or state of a snippet. */
export interface PredictionQuestion {
  code: string;
  question: string;
  answer: string;
  explanation: string;
  hint?: string;
}

/** A syntax-focused exercise where the user fills in missing parts of a code block. */
export interface BlanksQuestion {
  prompt: string;
  code: string;
  blanks: string[];
  explanation: string;
  hint?: string;
}

/**
 * Core fields shared by EVERY exercise variant. These properties govern
 * how the exercise is indexed, routed, and initially rendered before
 * variant-specific UI logic takes over.
 */
export interface BaseExercise {
  title: string;
  /** URL-safe kebab-case, unique: the permalink and the solved key. */
  slug: string;
  /** Sortable; the index orders by this, never by a week label. */
  order: number | string;
  /** Optional index filter. */
  topic?: string;
  /** Optional index filter. */
  difficulty?: ExerciseDifficulty;
  /** Markdown, rendered through the sanitizing pipeline. */
  prompt: string;
}

/**
 * The original, WASM-backed coding variant. Strictly requires a starter code
 * block and acceptance criteria to evaluate the student's program against
 * the live AArch64 emulator.
 */
export interface WriteExercise extends BaseExercise {
  variant: "write" | "identify-bug";
  /** Starting source loaded into the embedded editor (may be empty). */
  starter: string;
  acceptance: Acceptance;
  /** Optional command-line arguments passed to the run. */
  args?: string;
  /** Optional stdin passed to the run. */
  stdin?: string;
}

/**
 * A strictly client-side interactive variant. Bypasses the emulator entirely
 * in favor of an isolated multiple-choice block.
 */
export interface QuizExercise extends BaseExercise {
  variant: "quiz";
  questions: QuizQuestion[];
}

/**
 * A mental tracing variant. Requires the student to predict the output or
 * internal state of a provided code snippet without executing it.
 */
export interface PredictionExercise extends BaseExercise {
  variant: "prediction";
  predictions: PredictionQuestion[];
}

/**
 * A syntax-focused variant where students must provide the exact missing
 * tokens to complete a partial code block.
 */
export interface BlanksExercise extends BaseExercise {
  variant: "blanks";
  blanks: BlanksQuestion[];
}

/**
 * The discriminated union: TypeScript narrows this to a specific layout
 * and strict requirement set based on the `variant` discriminator.
 */
export type Exercise = WriteExercise | QuizExercise | PredictionExercise | BlanksExercise;

/** Discriminated validation result: a typed exercise or a clear error. */
export type ExerciseResult = { ok: true; exercise: Exercise } | { ok: false; error: string };

/** URL-safe kebab-case: lowercase alphanumerics joined by single dashes. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A general-purpose register x0..x30, or the stack pointer sp. */
const REGISTER_PATTERN = /^(x(\d|1\d|2\d|30)|sp)$/;

/**
 * Validate one result assertion by its `kind`, tagging every message with
 * the entry index so an author can locate the offending assertion (e.g.
 * acceptance.results[1]). Returns an assertion built only from validated
 * fields.
 */
function validateResultAssertion(
  raw: unknown,
  index: number,
): { ok: true; assertion: ResultAssertion } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `acceptance.results[${index}]: expected an assertion object` };
  }
  const a = raw as Record<string, unknown>;
  const kind = a.kind;
  if (typeof kind !== "string") {
    return { ok: false, error: `acceptance.results[${index}]: missing assertion kind` };
  }
  switch (kind) {
    case "register": {
      const reg = a.reg;
      if (typeof reg !== "string" || !REGISTER_PATTERN.test(reg)) {
        return {
          ok: false,
          error: `acceptance.results[${index}] (register): reg must be x0-x30 or sp`,
        };
      }
      if (typeof a.equals !== "number" || !Number.isInteger(a.equals)) {
        return {
          ok: false,
          error: `acceptance.results[${index}] (register): equals must be an integer`,
        };
      }
      return { ok: true, assertion: { kind: "register", reg, equals: a.equals } };
    }
    case "exit": {
      if (typeof a.equals !== "number" || !Number.isInteger(a.equals)) {
        return {
          ok: false,
          error: `acceptance.results[${index}] (exit): equals must be an integer`,
        };
      }
      return { ok: true, assertion: { kind: "exit", equals: a.equals } };
    }
    case "stdout": {
      const hasEquals = a.equals !== undefined;
      const hasMatches = a.matches !== undefined;
      if (hasEquals === hasMatches) {
        return {
          ok: false,
          error: `acceptance.results[${index}] (stdout): expected exactly one of equals or matches`,
        };
      }
      if (hasEquals) {
        if (typeof a.equals !== "string") {
          return {
            ok: false,
            error: `acceptance.results[${index}] (stdout): equals must be a string`,
          };
        }
        return { ok: true, assertion: { kind: "stdout", equals: a.equals } };
      }
      if (typeof a.matches !== "string") {
        return {
          ok: false,
          error: `acceptance.results[${index}] (stdout): matches must be a string`,
        };
      }
      // Compile the author's pattern now so an un-compilable RegExp is
      // rejected at load rather than thrown later when the checker runs it.
      try {
        new RegExp(a.matches);
      } catch {
        return {
          ok: false,
          error: `acceptance.results[${index}] (stdout): matches must be a valid regular expression`,
        };
      }
      return { ok: true, assertion: { kind: "stdout", matches: a.matches } };
    }
    default:
      return { ok: false, error: `acceptance.results[${index}]: unknown assertion kind "${kind}"` };
  }
}

/**
 * Validate one structural assertion by its `kind`, tagging every message
 * with the entry index (e.g. acceptance.structural[0]).
 */
function validateStructuralAssertion(
  raw: unknown,
  index: number,
): { ok: true; assertion: StructuralAssertion } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `acceptance.structural[${index}]: expected an assertion object` };
  }
  const a = raw as Record<string, unknown>;
  const kind = a.kind;
  if (typeof kind !== "string") {
    return { ok: false, error: `acceptance.structural[${index}]: missing assertion kind` };
  }
  switch (kind) {
    case "uses-instruction": {
      if (typeof a.mnemonic !== "string" || a.mnemonic.trim().length === 0) {
        return {
          ok: false,
          error: `acceptance.structural[${index}] (uses-instruction): mnemonic must be a non-empty string`,
        };
      }
      return { ok: true, assertion: { kind: "uses-instruction", mnemonic: a.mnemonic } };
    }
    case "forbids-literal": {
      if (typeof a.value !== "number" && typeof a.value !== "string") {
        return {
          ok: false,
          error: `acceptance.structural[${index}] (forbids-literal): value must be a number or string`,
        };
      }
      return { ok: true, assertion: { kind: "forbids-literal", value: a.value } };
    }
    default:
      return {
        ok: false,
        error: `acceptance.structural[${index}]: unknown assertion kind "${kind}"`,
      };
  }
}

/** A non-empty trimmed string, the shape every question text field must have. */
function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate one quiz question, tagging every message with the entry index
 * (e.g. questions[1]). Returns a question built only from validated fields.
 */
function validateQuizQuestion(
  raw: unknown,
  index: number,
): { ok: true; question: QuizQuestion } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `questions[${index}]: expected a question object` };
  }
  const q = raw as Record<string, unknown>;
  if (!isFilledString(q.question)) {
    return { ok: false, error: `questions[${index}]: question must be a non-empty string` };
  }
  if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isFilledString)) {
    return {
      ok: false,
      error: `questions[${index}]: options must be at least two non-empty strings`,
    };
  }
  const answer = q.correctAnswer;
  if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer >= q.options.length) {
    return {
      ok: false,
      error: `questions[${index}]: correctAnswer must be an index into options`,
    };
  }
  if (!isFilledString(q.explanation)) {
    return { ok: false, error: `questions[${index}]: explanation must be a non-empty string` };
  }
  const question: QuizQuestion = {
    question: q.question,
    options: q.options,
    correctAnswer: answer,
    explanation: q.explanation,
  };
  if (q.hint !== undefined) {
    if (typeof q.hint !== "string") {
      return { ok: false, error: `questions[${index}]: hint must be a string when present` };
    }
    question.hint = q.hint;
  }
  return { ok: true, question };
}

/**
 * Validate one prediction question, tagging every message with the entry
 * index (e.g. predictions[0]).
 */
function validatePredictionQuestion(
  raw: unknown,
  index: number,
): { ok: true; question: PredictionQuestion } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `predictions[${index}]: expected a question object` };
  }
  const q = raw as Record<string, unknown>;
  if (!isFilledString(q.code)) {
    return { ok: false, error: `predictions[${index}]: code must be a non-empty string` };
  }
  if (!isFilledString(q.question)) {
    return { ok: false, error: `predictions[${index}]: question must be a non-empty string` };
  }
  if (!isFilledString(q.answer)) {
    return { ok: false, error: `predictions[${index}]: answer must be a non-empty string` };
  }
  if (!isFilledString(q.explanation)) {
    return { ok: false, error: `predictions[${index}]: explanation must be a non-empty string` };
  }
  const question: PredictionQuestion = {
    code: q.code,
    question: q.question,
    answer: q.answer,
    explanation: q.explanation,
  };
  if (q.hint !== undefined) {
    if (typeof q.hint !== "string") {
      return { ok: false, error: `predictions[${index}]: hint must be a string when present` };
    }
    question.hint = q.hint;
  }
  return { ok: true, question };
}

/**
 * Validate one blanks question, tagging every message with the entry index
 * (e.g. blanks[2]). The code must carry exactly one `___` marker: the
 * renderer splits on the marker to embed its input field, so zero markers
 * leaves nowhere to answer and a second one silently drops source text.
 */
function validateBlanksQuestion(
  raw: unknown,
  index: number,
): { ok: true; question: BlanksQuestion } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `blanks[${index}]: expected a question object` };
  }
  const q = raw as Record<string, unknown>;
  if (!isFilledString(q.prompt)) {
    return { ok: false, error: `blanks[${index}]: prompt must be a non-empty string` };
  }
  if (typeof q.code !== "string" || q.code.split("___").length !== 2) {
    return {
      ok: false,
      error: `blanks[${index}]: code must be a string with exactly one ___ marker`,
    };
  }
  if (!Array.isArray(q.blanks) || q.blanks.length === 0 || !q.blanks.every(isFilledString)) {
    return {
      ok: false,
      error: `blanks[${index}]: blanks must be at least one non-empty accepted string`,
    };
  }
  if (!isFilledString(q.explanation)) {
    return { ok: false, error: `blanks[${index}]: explanation must be a non-empty string` };
  }
  const question: BlanksQuestion = {
    prompt: q.prompt,
    code: q.code,
    blanks: q.blanks,
    explanation: q.explanation,
  };
  if (q.hint !== undefined) {
    if (typeof q.hint !== "string") {
      return { ok: false, error: `blanks[${index}]: hint must be a string when present` };
    }
    question.hint = q.hint;
  }
  return { ok: true, question };
}

/**
 * Validate an untrusted value against the exercise schema. Returns
 * `{ ok: true, exercise }` with an exercise built only from the known,
 * validated fields (unknown keys are dropped), or `{ ok: false, error }`
 * on the first failure with a message naming the offending field.
 */
export function validateExercise(data: unknown): ExerciseResult {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "exercise: expected an object" };
  }
  const o = data as Record<string, unknown>;

  const title = o.title;
  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, error: "title: expected a non-empty string" };
  }

  const slug = o.slug;
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "slug: expected url-safe kebab-case" };
  }

  const order = o.order;
  if (typeof order !== "number" && typeof order !== "string") {
    return { ok: false, error: "order: expected a number or string" };
  }

  const prompt = o.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, error: "prompt: expected a non-empty string" };
  }

  let topic: string | undefined;
  if (o.topic !== undefined) {
    if (typeof o.topic !== "string") {
      return { ok: false, error: "topic: expected a string when present" };
    }
    topic = o.topic;
  }

  let difficulty: ExerciseDifficulty | undefined;
  if (o.difficulty !== undefined) {
    const d = o.difficulty;
    if (d !== "intro" && d !== "core" && d !== "challenge") {
      return { ok: false, error: "difficulty: expected one of intro|core|challenge" };
    }
    difficulty = d;
  }

  let variant: ExerciseVariant = "write";
  if (o.variant !== undefined) {
    const v = o.variant;
    if (
      v !== "write" &&
      v !== "identify-bug" &&
      v !== "quiz" &&
      v !== "prediction" &&
      v !== "blanks"
    ) {
      return {
        ok: false,
        error: "variant: expected one of write|identify-bug|quiz|prediction|blanks",
      };
    }
    variant = v;
  }

  const base: BaseExercise = { title, slug, order, prompt };
  if (topic !== undefined) base.topic = topic;
  if (difficulty !== undefined) base.difficulty = difficulty;

  // The variant decides which fields are required from here: coding variants
  // carry a starter and acceptance for the emulator-backed checker, the
  // interactive variants carry their own validated question lists instead.
  switch (variant) {
    case "write":
    case "identify-bug": {
      const starter = o.starter;
      if (typeof starter !== "string") {
        return { ok: false, error: "starter: expected a string for coding exercises" };
      }

      const rawAcceptance = o.acceptance;
      if (rawAcceptance == null || typeof rawAcceptance !== "object" || Array.isArray(rawAcceptance)) {
        return { ok: false, error: "acceptance: expected an object for coding exercises" };
      }
      const acc = rawAcceptance as Record<string, unknown>;

      if (!Array.isArray(acc.results) || acc.results.length === 0) {
        return { ok: false, error: "acceptance.results: expected an array with at least one assertion" };
      }

      const results: ResultAssertion[] = [];
      for (let i = 0; i < acc.results.length; i++) {
        const result = validateResultAssertion(acc.results[i], i);
        if (!result.ok) return result;
        results.push(result.assertion);
      }

      const acceptance: Acceptance = { results };

      if (acc.structural !== undefined) {
        if (!Array.isArray(acc.structural)) {
          return { ok: false, error: "acceptance.structural: expected an array when present" };
        }
        const structural: StructuralAssertion[] = [];
        for (let i = 0; i < acc.structural.length; i++) {
          const result = validateStructuralAssertion(acc.structural[i], i);
          if (!result.ok) return result;
          structural.push(result.assertion);
        }
        acceptance.structural = structural;
      }

      const exercise: WriteExercise = { ...base, variant, starter, acceptance };

      if (o.args !== undefined) {
        if (typeof o.args !== "string") return { ok: false, error: "args: expected a string when present" };
        exercise.args = o.args;
      }
      if (o.stdin !== undefined) {
        if (typeof o.stdin !== "string") return { ok: false, error: "stdin: expected a string when present" };
        exercise.stdin = o.stdin;
      }

      return { ok: true, exercise };
    }

    case "quiz": {
      if (!Array.isArray(o.questions) || o.questions.length === 0) {
        return { ok: false, error: "questions: expected at least one question for the quiz variant" };
      }
      const questions: QuizQuestion[] = [];
      for (let i = 0; i < o.questions.length; i++) {
        const result = validateQuizQuestion(o.questions[i], i);
        if (!result.ok) return result;
        questions.push(result.question);
      }
      return { ok: true, exercise: { ...base, variant, questions } };
    }

    case "prediction": {
      if (!Array.isArray(o.predictions) || o.predictions.length === 0) {
        return {
          ok: false,
          error: "predictions: expected at least one question for the prediction variant",
        };
      }
      const predictions: PredictionQuestion[] = [];
      for (let i = 0; i < o.predictions.length; i++) {
        const result = validatePredictionQuestion(o.predictions[i], i);
        if (!result.ok) return result;
        predictions.push(result.question);
      }
      return { ok: true, exercise: { ...base, variant, predictions } };
    }

    case "blanks": {
      if (!Array.isArray(o.blanks) || o.blanks.length === 0) {
        return { ok: false, error: "blanks: expected at least one question for the blanks variant" };
      }
      const blanks: BlanksQuestion[] = [];
      for (let i = 0; i < o.blanks.length; i++) {
        const result = validateBlanksQuestion(o.blanks[i], i);
        if (!result.ok) return result;
        blanks.push(result.question);
      }
      return { ok: true, exercise: { ...base, variant, blanks } };
    }
  }
}
