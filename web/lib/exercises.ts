/**
 * Build-time, server-only exercise loader. The `node:fs` / `node:path` imports are
 * the server-only guard: Next refuses to bundle node built-ins into a Client
 * Component, so a client module that imports this file fails the build. That is
 * an equivalent of `import "server-only"` without adding the `server-only`
 * package, which would break the no-new-deps fence and this module's own unit
 * test. Only server components import this; client renderers receive
 * already-validated exercises as props.
 *
 * Every file is validated by `validateExercise` at load. Invalid JSON or invalid
 * content throws an `Error` that names the offending file, so unvalidated
 * content can never reach a renderer or the checker.
 */

import fs from "node:fs";
import path from "node:path";
import { validateExercise, type Exercise } from "@/lib/exercise-schema";

/** The real content directory, resolved against the build's cwd (web/). */
const DEFAULT_DIR = path.join(process.cwd(), "content/exercises");

/**
 * Order comparator matching the index's defensive rule: two numbers compare
 * numerically, two strings via `localeCompare`, and a mixed pair falls back to
 * a string comparison so the sort is always total.
 */
function compareOrder(a: Exercise["order"], b: Exercise["order"]): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return String(a).localeCompare(String(b));
}

/**
 * Read, parse, and validate every `*.json` exercise in `dir` (defaults to the
 * real content directory). Returns the valid exercises sorted by `order`. Throws
 * a named `Error` on unparseable JSON, on content that fails `validateExercise`,
 * or on a duplicate slug. An absent directory is treated as empty so the build
 * does not crash before any exercise is authored. The `dir` parameter exists
 * only for testability; production callers pass nothing.
 */
export function loadAllExercises(dir: string = DEFAULT_DIR): Exercise[] {
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
  return exercises.sort((a, b) => compareOrder(a.order, b.order));
}

/** Find a single validated exercise by slug, or `undefined` when none matches. */
export function loadExercise(
  slug: string,
  dir: string = DEFAULT_DIR,
): Exercise | undefined {
  return loadAllExercises(dir).find((exercise) => exercise.slug === slug);
}
