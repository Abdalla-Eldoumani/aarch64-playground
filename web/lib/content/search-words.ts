/**
 * The one search rule the lesson, practice and reference filters share: every
 * word typed has to start a word somewhere in the text, in any order. Matching
 * at word starts keeps a short word from hitting the inside of every longer
 * one ("or" in "for", "word", "memory").
 */

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** True when `word` sits in `text` at the start of a word. Both lower case. */
function startsAWord(text: string, word: string): boolean {
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    if (at === 0 || !LETTER_OR_DIGIT.test(text[at - 1])) return true;
  }
  return false;
}

/** True when every word of `query` starts a word of `text`, ignoring case.
 *  A blank query matches everything. */
export function matchesAllWords(query: string, text: string): boolean {
  const lower = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => startsAWord(lower, word));
}
