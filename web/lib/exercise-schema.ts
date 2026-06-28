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

/** The acceptance criteria: required result checks plus optional structure. */
export interface Acceptance {
  /** At least one; the primary pass/fail criteria. */
  results: ResultAssertion[];
  /** Optional source-shape requirements (an approach, or a forbidden shortcut). */
  structural?: StructuralAssertion[];
}

export type ExerciseVariant = "write" | "identify-bug";
export type ExerciseDifficulty = "intro" | "core" | "challenge";

/** A prompt, starter source, and acceptance criteria as data. */
export interface Exercise {
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
  /** Starting source loaded into the embedded editor (may be empty). */
  starter: string;
  /** Optional command-line arguments passed to the run. */
  args?: string;
  /** Optional stdin passed to the run. */
  stdin?: string;
  /** Defaults to "write" when the author omits it. */
  variant: ExerciseVariant;
  acceptance: Acceptance;
}

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
      if (typeof a.equals !== "number" || !Number.isFinite(a.equals)) {
        return {
          ok: false,
          error: `acceptance.results[${index}] (register): equals must be a finite number`,
        };
      }
      return { ok: true, assertion: { kind: "register", reg, equals: a.equals } };
    }
    case "exit": {
      if (typeof a.equals !== "number" || !Number.isFinite(a.equals)) {
        return {
          ok: false,
          error: `acceptance.results[${index}] (exit): equals must be a finite number`,
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

/**
 * Validate an untrusted value against the exercise schema. Returns
 * `{ ok: true, exercise }` with an exercise built only from the known,
 * validated fields (unknown keys are dropped), or `{ ok: false, error }`
 * on the first failure with a message naming the offending field or
 * assertion index. Never throws.
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

  const prompt = o.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, error: "prompt: expected a non-empty string" };
  }

  const starter = o.starter;
  if (typeof starter !== "string") {
    return { ok: false, error: "starter: expected a string" };
  }

  let args: string | undefined;
  if (o.args !== undefined) {
    if (typeof o.args !== "string") {
      return { ok: false, error: "args: expected a string when present" };
    }
    args = o.args;
  }

  let stdin: string | undefined;
  if (o.stdin !== undefined) {
    if (typeof o.stdin !== "string") {
      return { ok: false, error: "stdin: expected a string when present" };
    }
    stdin = o.stdin;
  }

  let variant: ExerciseVariant = "write";
  if (o.variant !== undefined) {
    const v = o.variant;
    if (v !== "write" && v !== "identify-bug") {
      return { ok: false, error: "variant: expected one of write|identify-bug" };
    }
    variant = v;
  }

  const rawAcceptance = o.acceptance;
  if (rawAcceptance == null || typeof rawAcceptance !== "object" || Array.isArray(rawAcceptance)) {
    return { ok: false, error: "acceptance: expected an object" };
  }
  const acc = rawAcceptance as Record<string, unknown>;

  if (!Array.isArray(acc.results)) {
    return { ok: false, error: "acceptance.results: expected an array" };
  }
  if (acc.results.length === 0) {
    return { ok: false, error: "acceptance.results: expected at least one assertion" };
  }
  const results: ResultAssertion[] = [];
  for (let i = 0; i < acc.results.length; i++) {
    const result = validateResultAssertion(acc.results[i], i);
    if (!result.ok) return result;
    results.push(result.assertion);
  }

  let structural: StructuralAssertion[] | undefined;
  if (acc.structural !== undefined) {
    if (!Array.isArray(acc.structural)) {
      return { ok: false, error: "acceptance.structural: expected an array when present" };
    }
    const list: StructuralAssertion[] = [];
    for (let i = 0; i < acc.structural.length; i++) {
      const result = validateStructuralAssertion(acc.structural[i], i);
      if (!result.ok) return result;
      list.push(result.assertion);
    }
    structural = list;
  }

  const acceptance: Acceptance = { results };
  if (structural !== undefined) acceptance.structural = structural;

  const exercise: Exercise = { title, slug, order, prompt, starter, variant, acceptance };
  if (topic !== undefined) exercise.topic = topic;
  if (difficulty !== undefined) exercise.difficulty = difficulty;
  if (args !== undefined) exercise.args = args;
  if (stdin !== undefined) exercise.stdin = stdin;

  return { ok: true, exercise };
}
