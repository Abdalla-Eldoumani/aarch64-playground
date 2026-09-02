/**
 * Client-only persistence for what a student actually typed into an
 * exercise: the editor buffer of a coding exercise, and the selections or
 * typed answers of a theory set. One localStorage key per slug, so a
 * single oversized answer cannot cost every other exercise its record and
 * a cleared exercise is one removal.
 *
 * Modeled on solved-state.ts, which stores the tick beside this: every
 * stored value is treated as untrusted on read (another tab, an older
 * build, or a hand-edited store can hold anything), a malformed entry is
 * ignored rather than thrown on, and every function is SSR-safe and never
 * throws through the shared safe-storage helpers.
 *
 * The solved tick says an exercise was passed; this says what the student
 * wrote, so nobody retypes an answer after a reload. The check RESULT is
 * deliberately not stored: the tick already carries it, and a stored
 * verdict would outlive the source it graded.
 */

import {
  safeGetItem,
  safeKeys,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/playground/safe-storage";

const ANSWER_PREFIX = "aarch64-playground:practice:answer:";

/**
 * Characters one stored answer may serialize to. localStorage is a few MiB
 * shared across every slug plus the playground's own autosave, recents,
 * and bookmarks, and a course exercise answer is a few hundred lines.
 */
export const MAX_ANSWER_CHARS = 64 * 1024;

/**
 * The work itself, one arm per surface. The theory arms carry the block's
 * own answer shape: an option index (null before a pick) for the quiz, the
 * typed string for blanks and mental-trace predictions.
 */
export type AnswerBody =
  | { kind: "write"; source: string }
  | { kind: "quiz"; answers: (number | null)[] }
  | { kind: "blanks"; answers: string[] }
  | { kind: "predict"; answers: string[] };

export type AnswerKind = AnswerBody["kind"];

/**
 * The stored record: the work plus the two fields the store itself needs.
 * `updatedAt` is what lets an import decide whose copy is newer, so it is
 * stamped on every write and carried through an export unchanged.
 */
export type StoredAnswer = AnswerBody & { version: 1; updatedAt: number };

function keyFor(slug: string): string {
  return `${ANSWER_PREFIX}${slug}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isChoiceArray(value: unknown): value is (number | null)[] {
  return (
    Array.isArray(value) &&
    value.every((item) => item === null || (typeof item === "number" && Number.isInteger(item)))
  );
}

/**
 * Narrow an untrusted value to a stored answer, field by field, or null.
 * Only the fields of the matching arm survive, so a record carrying both a
 * `source` and an `answers` list stores whichever its kind names.
 */
export function validateAnswer(raw: unknown): StoredAnswer | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.updatedAt !== "number" || !Number.isFinite(o.updatedAt)) return null;
  const stamp = { version: 1, updatedAt: o.updatedAt } as const;
  switch (o.kind) {
    case "write":
      return typeof o.source === "string" ? { ...stamp, kind: "write", source: o.source } : null;
    case "quiz":
      return isChoiceArray(o.answers) ? { ...stamp, kind: "quiz", answers: o.answers } : null;
    case "blanks":
      return isStringArray(o.answers) ? { ...stamp, kind: "blanks", answers: o.answers } : null;
    case "predict":
      return isStringArray(o.answers) ? { ...stamp, kind: "predict", answers: o.answers } : null;
    default:
      return null;
  }
}

/** The stored answer for one exercise, or null when there is none to trust. */
export function readAnswer(slug: string): StoredAnswer | null {
  const raw = safeGetItem(keyFor(slug));
  if (!raw) return null;
  try {
    return validateAnswer(JSON.parse(raw) as unknown);
  } catch {
    // malformed; treat as nothing saved.
    return null;
  }
}

/**
 * Store a record as given, cap included. Import uses this to keep the
 * exporting device's `updatedAt`; a live surface goes through saveAnswer.
 * An over-cap record is dropped rather than truncated: half an answer is
 * worse than none, and the surface that wrote it still holds the whole one.
 */
export function putAnswer(slug: string, answer: StoredAnswer): boolean {
  const serialized = JSON.stringify(answer);
  if (serialized.length > MAX_ANSWER_CHARS) return false;
  return safeSetItem(keyFor(slug), serialized);
}

/** Store the student's current work, stamped now. */
export function saveAnswer(slug: string, body: AnswerBody): boolean {
  return putAnswer(slug, { ...body, version: 1, updatedAt: Date.now() });
}

/** Forget one exercise's saved work; what an explicit reset does. */
export function clearAnswer(slug: string): void {
  safeRemoveItem(keyFor(slug));
}

/**
 * Every saved answer, keyed by slug, for the export bundle. Keys are the
 * store's own prefix, and each value is re-validated: an entry another
 * build left behind must not reach a file a student hands to someone else.
 */
export function readAllAnswers(): Record<string, StoredAnswer> {
  const all: Record<string, StoredAnswer> = {};
  for (const key of safeKeys()) {
    if (!key.startsWith(ANSWER_PREFIX)) continue;
    const slug = key.slice(ANSWER_PREFIX.length);
    if (slug.length === 0) continue;
    const answer = readAnswer(slug);
    if (answer) all[slug] = answer;
  }
  return all;
}
