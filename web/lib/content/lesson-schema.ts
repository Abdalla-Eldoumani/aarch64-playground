/**
 * The lesson authoring contract: TypeScript types plus a hand-rolled
 * runtime validator. A lesson is author-supplied JSON, so it is untrusted
 * until `validateLesson` has narrowed it field-by-field. This is the single
 * source of truth for the lesson shape; the loader, the index, and the
 * article all import these types and call this validator, and only a
 * validated lesson is ever rendered.
 *
 * The validator is dependency-free and modeled on the defensive style in
 * upload-guard.ts and share.ts: narrow `unknown` one field at a time,
 * return a discriminated result, never throw.
 */

/** A single body block. The `type` tag selects the per-block fields. */
export type LessonBlock =
  | { type: "prose"; markdown: string }
  | { type: "code"; language: "asm" | "c" | "text"; source: string }
  | { type: "callout"; variant: "note" | "warning" | "pitfall"; markdown: string }
  | { type: "editor"; starter: string; args?: string; stdin?: string };

/** Lesson metadata plus an ordered, non-empty body of blocks. */
export interface Lesson {
  title: string;
  /** URL-safe kebab-case, unique: the permalink and the index key. */
  slug: string;
  /** Sortable; the index orders by this, never by a week label. */
  order: number | string;
  /** Optional one-line index card summary. */
  summary?: string;
  /** Optional index filter tags. */
  tags?: string[];
  /** Ordered, at least one block. */
  body: LessonBlock[];
}

/** Discriminated validation result: a typed lesson or a clear error. */
export type LessonResult = { ok: true; lesson: Lesson } | { ok: false; error: string };

/** URL-safe kebab-case: lowercase alphanumerics joined by single dashes. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate one body block by its `type`, tagging every message with the
 * block index so an author can locate the offending block (e.g. body[2]).
 * Returns a block built only from validated fields.
 */
function validateBlock(
  raw: unknown,
  index: number,
): { ok: true; block: LessonBlock } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `body[${index}]: expected a block object` };
  }
  const b = raw as Record<string, unknown>;
  const type = b.type;
  if (typeof type !== "string") {
    return { ok: false, error: `body[${index}]: missing block type` };
  }
  switch (type) {
    case "prose": {
      if (typeof b.markdown !== "string") {
        return { ok: false, error: `body[${index}] (prose): markdown must be a string` };
      }
      return { ok: true, block: { type: "prose", markdown: b.markdown } };
    }
    case "code": {
      const language = b.language;
      if (language !== "asm" && language !== "c" && language !== "text") {
        return { ok: false, error: `body[${index}] (code): language must be one of asm|c|text` };
      }
      if (typeof b.source !== "string") {
        return { ok: false, error: `body[${index}] (code): source must be a string` };
      }
      return { ok: true, block: { type: "code", language, source: b.source } };
    }
    case "callout": {
      const variant = b.variant;
      if (variant !== "note" && variant !== "warning" && variant !== "pitfall") {
        return {
          ok: false,
          error: `body[${index}] (callout): variant must be one of note|warning|pitfall`,
        };
      }
      if (typeof b.markdown !== "string") {
        return { ok: false, error: `body[${index}] (callout): markdown must be a string` };
      }
      return { ok: true, block: { type: "callout", variant, markdown: b.markdown } };
    }
    case "editor": {
      if (typeof b.starter !== "string") {
        return { ok: false, error: `body[${index}] (editor): starter must be a string` };
      }
      const block: { type: "editor"; starter: string; args?: string; stdin?: string } = {
        type: "editor",
        starter: b.starter,
      };
      if (b.args !== undefined) {
        if (typeof b.args !== "string") {
          return { ok: false, error: `body[${index}] (editor): args must be a string when present` };
        }
        block.args = b.args;
      }
      if (b.stdin !== undefined) {
        if (typeof b.stdin !== "string") {
          return { ok: false, error: `body[${index}] (editor): stdin must be a string when present` };
        }
        block.stdin = b.stdin;
      }
      return { ok: true, block };
    }
    default:
      return { ok: false, error: `body[${index}]: unknown block type "${type}"` };
  }
}

/**
 * Validate an untrusted value against the lesson schema. Returns
 * `{ ok: true, lesson }` with a lesson built only from the known,
 * validated fields, or `{ ok: false, error }` on the first failure with a
 * message naming the offending field or block index. Never throws.
 */
export function validateLesson(data: unknown): LessonResult {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "lesson: expected an object" };
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

  let summary: string | undefined;
  if (o.summary !== undefined) {
    if (typeof o.summary !== "string") {
      return { ok: false, error: "summary: expected a string when present" };
    }
    summary = o.summary;
  }

  let tags: string[] | undefined;
  if (o.tags !== undefined) {
    const rawTags = o.tags;
    if (!Array.isArray(rawTags) || !(rawTags as unknown[]).every((t) => typeof t === "string")) {
      return { ok: false, error: "tags: expected an array of strings when present" };
    }
    tags = rawTags as string[];
  }

  if (!Array.isArray(o.body)) {
    return { ok: false, error: "body: expected an array of blocks" };
  }
  if (o.body.length === 0) {
    return { ok: false, error: "body: expected at least one block" };
  }

  const body: LessonBlock[] = [];
  for (let i = 0; i < o.body.length; i++) {
    const result = validateBlock(o.body[i], i);
    if (!result.ok) return result;
    body.push(result.block);
  }

  const lesson: Lesson = { title, slug, order, body };
  if (summary !== undefined) lesson.summary = summary;
  if (tags !== undefined) lesson.tags = tags;
  return { ok: true, lesson };
}
