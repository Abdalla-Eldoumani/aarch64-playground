/**
 * Pure table-of-contents helpers for the lesson article: `slugify` turns a
 * heading's visible text into a stable, url-safe id, and `extractToc` pulls
 * the h2/h3 headings out of a lesson's prose blocks in document order.
 *
 * The markdown renderer reuses this same `slugify` to id its rendered
 * headings, so the toc anchors and the heading ids always agree. Keep
 * slugify here as the single source; never reimplement it in the renderer.
 *
 * No React, no DOM, no markdown library: headings are found by scanning
 * prose lines, so these functions stay pure and unit-testable.
 */

import type { Lesson, LessonBlock } from "@/lib/lesson-schema";

/**
 * Inline-markdown markers (code backticks, bold/italic asterisks and
 * underscores) are removed while their inner text is kept, so a heading
 * like "the `mov` instruction" yields the label "the mov instruction".
 * One source for the marker set so slugify and the human label agree.
 */
const INLINE_MARKERS = /[`*_]/g;

/** Matches an h2 or h3 ATX heading line, capturing the hashes and the text. */
const HEADING_LINE = /^(#{2,3})\s+(.+)$/;

/**
 * Map heading text to a stable, url-safe id: lowercase, strip inline
 * markers (keeping inner text), turn every run of non-alphanumerics into a
 * single dash, and trim leading/trailing dashes. Deterministic and
 * idempotent: slugify(slugify(x)) === slugify(x).
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(INLINE_MARKERS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** One table-of-contents entry: a heading's depth, human label, and anchor id. */
export interface TocEntry {
  depth: 2 | 3;
  text: string;
  id: string;
}

/** True for prose blocks, narrowing the block to its markdown-bearing shape. */
function isProse(block: LessonBlock): block is Extract<LessonBlock, { type: "prose" }> {
  return block.type === "prose";
}

/**
 * Extract the h2/h3 headings from a lesson's prose blocks, in document
 * order, as toc entries. The article owns the h1 title, so only h2/h3 are
 * collected; code/callout/editor blocks and non-heading lines are skipped.
 * Ids are not deduped: distinct headings are an authoring expectation, and
 * the renderer (sharing slugify) will produce the same ids.
 */
export function extractToc(lesson: Pick<Lesson, "body">): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const block of lesson.body) {
    if (!isProse(block)) continue;
    for (const line of block.markdown.split(/\r?\n/)) {
      const match = HEADING_LINE.exec(line);
      if (!match) continue;
      const depth: 2 | 3 = match[1].length === 2 ? 2 : 3;
      const text = match[2].replace(INLINE_MARKERS, "").trim();
      entries.push({ depth, text, id: slugify(text) });
    }
  }
  return entries;
}
