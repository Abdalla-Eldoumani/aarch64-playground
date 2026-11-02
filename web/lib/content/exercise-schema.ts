/**
 * The exercise shape and its validator, the one source for both. Exercise
 * files are untrusted JSON, so nothing is rendered or graded until
 * `validateExercise` has checked it field by field; it returns an error
 * instead of throwing.
 */

import { validateArgs, validateSource, validateStdin } from "@/lib/playground/upload-guard";
import { isCalendarDate } from "@/lib/content/lesson-schema";

/** A single result assertion evaluated against emulator output. */
export type ResultAssertion =
  | { kind: "register"; reg: string; equals: number } // reg: "x0".."x30" or "sp"
  | { kind: "exit"; equals: number }
  | { kind: "stdout"; equals: string }
  | { kind: "stdout"; matches: string }; // a declared RegExp pattern

/**
 * A single structural assertion evaluated against the source text. `in`
 * narrows it to one function's body (see exercise-checker's functionBody), so
 * an instruction main already uses cannot satisfy a check about a helper.
 */
export type StructuralAssertion =
  | { kind: "uses-instruction"; mnemonic: string; in?: string }
  | { kind: "forbids-instruction"; mnemonics: string[]; in?: string }
  | { kind: "forbids-literal"; value: number | string; in?: string };

/**
 * One run the student never sees: the program is started with these
 * arguments, fed this input and then end of input (as `./program < file`
 * does), and must print exactly `stdout` and exit with `exitCode`. `edge`
 * marks a boundary input (zero, a negative, an empty line, the largest
 * value), which every coding exercise must include at least once.
 */
export interface HiddenCase {
  args?: string;
  stdin?: string;
  stdout: string;
  exitCode: number;
  edge?: boolean;
}

export type ExerciseVariant = "write" | "identify-bug" | "quiz" | "prediction" | "blanks" | "frame";
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
  /** Optional hint, shown before an attempt. */
  hint?: string;
}

/** A question asking the student to predict what a snippet prints or leaves behind. */
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
 * Fields shared by every variant: what the index, the route, and the first
 * render read.
 */
export interface BaseExercise {
  title: string;
  /** URL-safe kebab-case, unique: the permalink and the solved key. */
  slug: string;
  /** Sortable; the index orders by this, never by a week label. */
  order: number | string;
  /** The day the content last changed, YYYY-MM-DD, for the sitemap. */
  lastUpdated?: string;
  /** Optional index filter. */
  topic?: string;
  /** Optional index filter. */
  difficulty?: ExerciseDifficulty;
  /** Markdown, rendered through the sanitizing pipeline. */
  prompt: string;
}

/**
 * The coding variant: a starter block plus acceptance criteria, checked by
 * running the student's program on the emulator.
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
  /** Optional runs on other inputs, graded after the visible run passes. */
  hiddenCases?: HiddenCase[];
}

/**
 * Multiple choice, graded on the page. The emulator is not used.
 */
export interface QuizExercise extends BaseExercise {
  variant: "quiz";
  questions: QuizQuestion[];
}

/**
 * Predict-the-output questions: the student works out what a snippet does
 * without running it.
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
 * Where a frame exercise stops its program: just before `line` (1-based, in
 * `program`) runs for the `hit`th time.
 */
export interface FramePause {
  line: number;
  hit: number;
}

/** One named slot the student places, and the hint a wrong offset shows. */
export interface FrameSlotQuestion {
  /** The name the frames view gives the slot: `count_s`, `rect_s.width`. */
  name: string;
  hint: string;
}

/**
 * Draw the frame: for the function the program is paused in, the student
 * gives the frame's size, each named slot's offset from fp, and where the
 * saved fp and lr sit. The file stores no answer: the checker runs the
 * program to the pause and reads the frame from the emulator.
 */
export interface FrameExercise extends BaseExercise {
  variant: "frame";
  /** Shown to the student and run as it is; it reads no input. */
  program: string;
  pause: FramePause;
  /** Lowest offset first, as the program lays them out; the page draws
   *  them high address first, above the saved lr and fp, as the frames
   *  view does. */
  slots: FrameSlotQuestion[];
  /** What a wrong frame size, saved fp offset and saved lr offset show. */
  hints: { size: string; savedFp: string; savedLr: string };
}

/**
 * The variants' shapes, discriminated by `variant`.
 */
export type Exercise = WriteExercise | QuizExercise | PredictionExercise | BlanksExercise | FrameExercise;

/**
 * The row the practice index renders: only the seven fields ExerciseIndex
 * reads, so the rest of each exercise (about 232 KB across the set) never
 * reaches the browser. It lives here, not beside the server-only loader, so a
 * client component can name the type without importing that module.
 */
export interface ExerciseIndexRow {
  title: string;
  slug: string;
  order: number | string;
  topic?: string;
  difficulty?: ExerciseDifficulty;
  /** Drives practiceSide(): which side of the practice page the row lands on. */
  variant: ExerciseVariant;
  /** Plain-text row summary, derived from the prompt at build time. */
  blurb: string;
}

/** Discriminated validation result: a typed exercise or a clear error. */
export type ExerciseResult = { ok: true; exercise: Exercise } | { ok: false; error: string };

/** URL-safe kebab-case: lowercase alphanumerics joined by single dashes. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A general-purpose register x0..x30, or the stack pointer sp. */
const REGISTER_PATTERN = /^(x(\d|1\d|2\d|30)|sp)$/;

/** An assembler symbol name, the only thing a structural `in` can scope to. */
const LABEL_PATTERN = /^[A-Za-z_.$][\w.$]*$/;

/** Exit statuses a hosted program can report. */
const MAX_EXIT_STATUS = 255;

/** A frame slot's name: a symbol, a struct field (`rect_s.width`), or an array element (`arr_s[2]`). */
const SLOT_NAME_PATTERN = /^[A-Za-z_.$][\w.$]*(?:\[\d{1,4}\])?$/;

/** Slots one frame exercise asks for: more than any course frame names. */
const MAX_FRAME_SLOTS = 16;

/** The latest arrival at a pause line an exercise may ask for. */
const MAX_PAUSE_HIT = 1000;

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
  if (a.in !== undefined && (typeof a.in !== "string" || !LABEL_PATTERN.test(a.in))) {
    return {
      ok: false,
      error: `acceptance.structural[${index}]: in must be a label name when present`,
    };
  }
  const scope = a.in === undefined ? {} : { in: a.in };
  switch (kind) {
    case "uses-instruction": {
      if (typeof a.mnemonic !== "string" || a.mnemonic.trim().length === 0) {
        return {
          ok: false,
          error: `acceptance.structural[${index}] (uses-instruction): mnemonic must be a non-empty string`,
        };
      }
      return { ok: true, assertion: { kind: "uses-instruction", mnemonic: a.mnemonic, ...scope } };
    }
    case "forbids-instruction": {
      const list = a.mnemonics;
      if (
        !Array.isArray(list) ||
        list.length === 0 ||
        !list.every((m): m is string => typeof m === "string" && m.trim().length > 0)
      ) {
        return {
          ok: false,
          error: `acceptance.structural[${index}] (forbids-instruction): mnemonics must be a non-empty list of strings`,
        };
      }
      return { ok: true, assertion: { kind: "forbids-instruction", mnemonics: list, ...scope } };
    }
    case "forbids-literal": {
      if (typeof a.value !== "number" && typeof a.value !== "string") {
        return {
          ok: false,
          error: `acceptance.structural[${index}] (forbids-literal): value must be a number or string`,
        };
      }
      return { ok: true, assertion: { kind: "forbids-literal", value: a.value, ...scope } };
    }
    default:
      return {
        ok: false,
        error: `acceptance.structural[${index}]: unknown assertion kind "${kind}"`,
      };
  }
}

/**
 * Validate one hidden case, tagging every message with the entry index (e.g.
 * hiddenCases[2]). Its args and stdin face the same caps the args box and the
 * console enforce, so an authored case can never feed the machine more than a
 * student could.
 */
function validateHiddenCase(
  raw: unknown,
  index: number,
): { ok: true; hiddenCase: HiddenCase } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `hiddenCases[${index}]: expected a case object` };
  }
  const c = raw as Record<string, unknown>;
  if (typeof c.stdout !== "string") {
    return { ok: false, error: `hiddenCases[${index}]: stdout must be a string` };
  }
  const code = c.exitCode;
  if (typeof code !== "number" || !Number.isInteger(code) || code < 0 || code > MAX_EXIT_STATUS) {
    return { ok: false, error: `hiddenCases[${index}]: exitCode must be an integer from 0 to 255` };
  }
  const hiddenCase: HiddenCase = { stdout: c.stdout, exitCode: code };
  if (c.args !== undefined) {
    if (typeof c.args !== "string" || validateArgs(c.args) !== null) {
      return { ok: false, error: `hiddenCases[${index}]: args must be a string within the args cap` };
    }
    hiddenCase.args = c.args;
  }
  if (c.stdin !== undefined) {
    if (typeof c.stdin !== "string" || validateStdin(c.stdin) !== null) {
      return { ok: false, error: `hiddenCases[${index}]: stdin must be a string within the stdin cap` };
    }
    hiddenCase.stdin = c.stdin;
  }
  if (c.edge !== undefined) {
    if (typeof c.edge !== "boolean") {
      return { ok: false, error: `hiddenCases[${index}]: edge must be true or false when present` };
    }
    hiddenCase.edge = c.edge;
  }
  return { ok: true, hiddenCase };
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
 * Validate a frame exercise's own fields: the program within the source cap,
 * a pause on one of its lines, at least one uniquely named slot, and a hint
 * for every field the student fills in.
 */
function validateFrameFields(
  o: Record<string, unknown>,
): { ok: true; fields: Pick<FrameExercise, "program" | "pause" | "slots" | "hints"> } | { ok: false; error: string } {
  const program = o.program;
  if (!isFilledString(program) || validateSource(program) !== null) {
    return { ok: false, error: "program: expected a non-empty program within the source cap" };
  }
  const pause = o.pause;
  if (pause == null || typeof pause !== "object" || Array.isArray(pause)) {
    return { ok: false, error: "pause: expected an object with line and hit" };
  }
  const { line, hit } = pause as Record<string, unknown>;
  const lines = program.split("\n").length;
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1 || line > lines) {
    return { ok: false, error: "pause.line: expected the number of a line in program" };
  }
  if (typeof hit !== "number" || !Number.isInteger(hit) || hit < 1 || hit > MAX_PAUSE_HIT) {
    return { ok: false, error: `pause.hit: expected an integer from 1 to ${MAX_PAUSE_HIT}` };
  }
  if (!Array.isArray(o.slots) || o.slots.length === 0 || o.slots.length > MAX_FRAME_SLOTS) {
    return { ok: false, error: `slots: expected 1 to ${MAX_FRAME_SLOTS} slots` };
  }
  const slots: FrameSlotQuestion[] = [];
  for (const [index, raw] of o.slots.entries()) {
    const slot: Record<string, unknown> =
      raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const { name, hint } = slot;
    if (typeof name !== "string" || !SLOT_NAME_PATTERN.test(name)) {
      return { ok: false, error: `slots[${index}]: name must be a slot name such as count_s or rect_s.width` };
    }
    if (slots.some((seen) => seen.name === name)) {
      return { ok: false, error: `slots[${index}]: ${name} is asked for twice` };
    }
    if (!isFilledString(hint)) {
      return { ok: false, error: `slots[${index}]: hint must be a non-empty string` };
    }
    slots.push({ name, hint });
  }
  const hints = o.hints;
  if (hints == null || typeof hints !== "object" || Array.isArray(hints)) {
    return { ok: false, error: "hints: expected an object with size, savedFp and savedLr" };
  }
  const { size, savedFp, savedLr } = hints as Record<string, unknown>;
  if (!isFilledString(size) || !isFilledString(savedFp) || !isFilledString(savedLr)) {
    return { ok: false, error: "hints: size, savedFp and savedLr must be non-empty strings" };
  }
  return { ok: true, fields: { program, pause: { line, hit }, slots, hints: { size, savedFp, savedLr } } };
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

  let lastUpdated: string | undefined;
  if (o.lastUpdated !== undefined) {
    if (!isCalendarDate(o.lastUpdated)) {
      return { ok: false, error: "lastUpdated: expected a YYYY-MM-DD date when present" };
    }
    lastUpdated = o.lastUpdated;
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
      v !== "blanks" &&
      v !== "frame"
    ) {
      return {
        ok: false,
        error: "variant: expected one of write|identify-bug|quiz|prediction|blanks|frame",
      };
    }
    variant = v;
  }

  const base: BaseExercise = { title, slug, order, prompt };
  if (lastUpdated !== undefined) base.lastUpdated = lastUpdated;
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
      if (o.hiddenCases !== undefined) {
        if (!Array.isArray(o.hiddenCases)) {
          return { ok: false, error: "hiddenCases: expected an array when present" };
        }
        const hiddenCases: HiddenCase[] = [];
        for (let i = 0; i < o.hiddenCases.length; i++) {
          const result = validateHiddenCase(o.hiddenCases[i], i);
          if (!result.ok) return result;
          hiddenCases.push(result.hiddenCase);
        }
        exercise.hiddenCases = hiddenCases;
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

    case "frame": {
      const result = validateFrameFields(o);
      if (!result.ok) return result;
      return { ok: true, exercise: { ...base, variant, ...result.fields } };
    }
  }
}
