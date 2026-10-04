/**
 * Build-time exercise loader. Importing node:fs keeps it server-only: Next
 * will not bundle node built-ins into a client component, so a client import
 * fails the build, without the `server-only` package that would break this
 * module's unit test. A bad file throws with its name, so unchecked content
 * never reaches a renderer or the checker.
 */

import fs from "node:fs";
import path from "node:path";
import {
  validateExercise,
  type Exercise,
  type ExerciseIndexRow,
} from "@/lib/content/exercise-schema";
import { compareByOrder } from "@/lib/content/content-order";

/** The real content directory, resolved against the build's cwd (web/). */
const DEFAULT_DIR = path.join(process.cwd(), "content/exercises");

// A production build reads each folder once. Every exercise page asks for
// the whole folder three times (its metadata, the page, its sheet number) and
// every lesson page once more, which was hundreds of full reads per build.
// Development and tests read it on every call, so an edited file shows at once.
const builtOnce = new Map<string, Exercise[]>();

/**
 * Every `*.json` exercise in `dir`, validated and sorted by `order`. Throws on
 * bad JSON, invalid content, or a duplicate slug. A missing directory counts
 * as empty so the build runs before any exercise exists. `dir` is for tests.
 */
export function loadAllExercises(dir: string = DEFAULT_DIR): Exercise[] {
  if (process.env.NODE_ENV !== "production") return readExercises(dir);
  let exercises = builtOnce.get(dir);
  if (!exercises) {
    exercises = readExercises(dir);
    builtOnce.set(dir, exercises);
  }
  // A copy, so a caller that sorts or splices its list cannot reorder the
  // next caller's.
  return exercises.slice();
}

function readExercises(dir: string): Exercise[] {
  if (!fs.existsSync(dir)) return [];

  // Sort filenames first so the read order (and any order ties) is deterministic.
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const exercises: Exercise[] = [];
  const slugToFile = new Map<string, string>();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`invalid exercise ${file}: ${message}`);
    }

    const result = validateExercise(parsed);
    if (!result.ok) {
      throw new Error(`invalid exercise ${file}: ${result.error}`);
    }

    const { slug } = result.exercise;
    const prior = slugToFile.get(slug);
    if (prior) {
      throw new Error(
        `duplicate exercise slug "${slug}" in ${prior} and ${file}`,
      );
    }
    slugToFile.set(slug, file);
    exercises.push(result.exercise);
  }

  // Stable sort keeps the filename order for exercises that share an `order`.
  return exercises.sort(compareByOrder);
}

/**
 * A row summary from the prompt: the first non-empty line with leading
 * Markdown markers (#, >, -, *) stripped, clipped to a row-sized length. The
 * index renders its inline code, so a clip never stops inside a code span,
 * where the opening backtick would show bare.
 */
function blurbFromPrompt(prompt: string): string {
  const firstLine =
    prompt
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const plain = firstLine.replace(/^[#>\-*\s]+/, "").trim();
  if (plain.length <= 140) return plain;
  let clipped = plain.slice(0, 140);
  if ((clipped.match(/`/g) ?? []).length % 2 === 1) clipped = clipped.slice(0, clipped.lastIndexOf("`"));
  return `${clipped.trimEnd()}...`;
}

/**
 * Every validated exercise narrowed to the index row: same order, same count,
 * same validation, with the fields the index never reads dropped before they
 * can reach the client payload. The blurb is derived here, at build time,
 * because deriving it in the index meant shipping every prompt to do it.
 */
export function loadExerciseIndex(dir: string = DEFAULT_DIR): ExerciseIndexRow[] {
  return loadAllExercises(dir).map((exercise) => ({
    title: exercise.title,
    slug: exercise.slug,
    order: exercise.order,
    topic: exercise.topic,
    difficulty: exercise.difficulty,
    variant: exercise.variant,
    blurb: blurbFromPrompt(exercise.prompt),
  }));
}

/** Find a single validated exercise by slug, or `undefined` when none matches. */
export function loadExercise(
  slug: string,
  dir: string = DEFAULT_DIR,
): Exercise | undefined {
  return loadAllExercises(dir).find((exercise) => exercise.slug === slug);
}
