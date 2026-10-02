/**
 * The one search rule the lesson, practice and reference filters share: every
 * word typed has to start a word somewhere in the text, in any order. Matching
 * at word starts keeps a short word from hitting the inside of every longer
 * one ("or" in "for", "word", "memory").
 */

/** Anything but a letter or a digit ends a word, in the text and the query. */
const WORD_BREAK = /[^\p{L}\p{N}]+/u;

/** True when every word of `query` starts a word of `text`, ignoring case.
 *  A blank query matches everything. */
export function matchesAllWords(query: string, text: string): boolean {
  const words = text.toLowerCase().split(WORD_BREAK);
  return query
    .toLowerCase()
    .split(WORD_BREAK)
    .every((typed) => words.some((word) => word.startsWith(typed)));
}
