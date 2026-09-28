/**
 * Table-of-contents helpers for the lesson article. The markdown renderer ids
 * its headings with this same slugify, so keep it the only copy: the toc links
 * and the heading ids then always agree.
 */

import type { Lesson, LessonBlock } from "@/lib/content/lesson-schema";

/**
 * One marker set for slugify and the label, so a heading "the `mov`
 * instruction" reads "the mov instruction" in both.
 */
const INLINE_MARKERS = /[`*_]/g;

/**
 * Links and images reduce to their visible text, because the renderer builds
 * its heading ids from that text and never sees the url.
 */
const LINK_IMAGE = /!?\[([^\]]*)\]\([^)]*\)/g;

/** Matches an h2 or h3 ATX heading line, capturing the hashes and the text. */
const HEADING_LINE = /^(#{2,3})\s+(.+)$/;

/** A code fence: lines inside one render as code, so they never become toc links. */
const FENCE_LINE = /^ {0,3}(?:`{3,}|~{3,})/;

/** Heading text to a url-safe id. Idempotent: slugify(slugify(x)) === slugify(x). */
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
 * The h2/h3 headings of a lesson's prose blocks, in order; the article owns
 * the h1. Ids are not deduplicated: headings are expected to be distinct, and
 * the renderer, sharing slugify, makes the same ids.
 */
export function extractToc(lesson: Pick<Lesson, "body">): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const block of lesson.body) {
    if (!isProse(block)) continue;
    let inFence = false;
    for (const line of block.markdown.split(/\r?\n/)) {
      if (FENCE_LINE.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const match = HEADING_LINE.exec(line);
      if (!match) continue;
      const depth: 2 | 3 = match[1].length === 2 ? 2 : 3;
      const text = match[2]
        .replace(LINK_IMAGE, "$1")
        .replace(INLINE_MARKERS, "")
        .trim();
      entries.push({ depth, text, id: slugify(text) });
    }
  }
  return entries;
}
