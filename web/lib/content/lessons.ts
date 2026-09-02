/**
 * Build-time, server-only lesson loader. The `node:fs` / `node:path` imports are
 * the server-only guard: Next refuses to bundle node built-ins into a Client
 * Component, so any `"use client"` module that imports this file is a build
 * error. That is an equivalent of `import "server-only"` without adding the
 * `server-only` package, which would break the no-new-deps fence and this
 * module's own unit test. Only server components import this; client renderers
 * receive already-validated lessons as props.
 *
 * Every file is validated by `validateLesson` at load. Invalid JSON or invalid
 * content throws an `Error` that names the offending file, so unvalidated
 * content can never reach a renderer.
 */

import fs from "node:fs";
import path from "node:path";
import {
  validateLesson,
  type Lesson,
  type LessonIndexRow,
} from "@/lib/content/lesson-schema";
import { compareByOrder } from "@/lib/content/content-order";

/** The real content directory, resolved against the build's cwd (web/). */
const DEFAULT_DIR = path.join(process.cwd(), "content/lessons");

/**
 * Read, parse, and validate every `*.json` lesson in `dir` (defaults to the
 * real content directory). Returns the valid lessons sorted by `order`. Throws
 * a named `Error` on unparseable JSON, on content that fails `validateLesson`,
 * or on a duplicate slug. The `dir` parameter exists only for testability;
 * production callers pass nothing.
 */
export function loadAllLessons(dir: string = DEFAULT_DIR): Lesson[] {
  // Sort filenames first so the read order (and any order ties) is deterministic.
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const lessons: Lesson[] = [];
  const slugToFile = new Map<string, string>();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`invalid lesson ${file}: ${message}`);
    }

    const result = validateLesson(parsed);
    if (!result.ok) {
      throw new Error(`invalid lesson ${file}: ${result.error}`);
    }

    const { slug } = result.lesson;
    const prior = slugToFile.get(slug);
    if (prior) {
      throw new Error(
        `duplicate lesson slug "${slug}" in ${prior} and ${file}`,
      );
    }
    slugToFile.set(slug, file);
    lessons.push(result.lesson);
  }

  // Stable sort keeps the filename order for lessons that share an `order`.
  return lessons.sort(compareByOrder);
}

/**
 * Every validated lesson narrowed to the index row: same order, same count,
 * same validation, with `body` dropped before it can reach the client
 * payload. The index never reads a block, and the bodies are almost all of
 * what the lessons weigh.
 */
export function loadLessonIndex(dir: string = DEFAULT_DIR): LessonIndexRow[] {
  return loadAllLessons(dir).map((lesson) => ({
    title: lesson.title,
    slug: lesson.slug,
    order: lesson.order,
    summary: lesson.summary,
    tags: lesson.tags,
  }));
}

/** Find a single validated lesson by slug, or `undefined` when none matches. */
export function loadLesson(
  slug: string,
  dir: string = DEFAULT_DIR,
): Lesson | undefined {
  return loadAllLessons(dir).find((lesson) => lesson.slug === slug);
}
