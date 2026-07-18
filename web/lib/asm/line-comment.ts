/**
 * VS Code-style line-comment toggling for the playground's phone-fallback
 * editor. The desktop Monaco editor handles Ctrl+/ itself through its
 * built-in `editor.action.commentLine` (driven by the language config's
 * `comments.lineComment`); this backs the plain-textarea fallback so both
 * surfaces behave the same.
 *
 * The toggle spans every line the selection touches -- from the line holding
 * `selStart` through the line holding `selEnd`, inclusive, even for a
 * zero-width caret. If every non-blank line in that range is already
 * commented it uncomments; otherwise every non-blank line gets a `//`
 * prefix at the shallowest shared indentation so the markers line up. Blank
 * lines are left untouched. The returned selection spans the same lines so a
 * second toggle is immediate.
 */

/** The canonical CPSC 355 line-comment marker (docs/cpsc355-style-guide.md). */
export const LINE_COMMENT = "//";

export interface LineCommentToggle {
  text: string;
  selStart: number;
  selEnd: number;
}

export function toggleLineComment(
  text: string,
  selStart: number,
  selEnd: number,
): LineCommentToggle {
  const len = text.length;
  const from = Math.max(0, Math.min(selStart, selEnd, len));
  const to = Math.min(len, Math.max(selStart, selEnd, 0));

  // Expand the selection to the whole lines it touches.
  const blockStart = text.lastIndexOf("\n", from - 1) + 1;
  const nextNewline = text.indexOf("\n", to);
  const blockEnd = nextNewline === -1 ? len : nextNewline;

  const before = text.slice(0, blockStart);
  const block = text.slice(blockStart, blockEnd);
  const after = text.slice(blockEnd);

  const lines = block.split("\n");
  const nonBlank = lines.filter((l) => l.trim().length > 0);
  const allCommented =
    nonBlank.length > 0 &&
    nonBlank.every((l) => l.trimStart().startsWith(LINE_COMMENT));

  const newLines = allCommented
    ? lines.map(uncommentLine)
    : commentLines(lines, nonBlank);

  const newBlock = newLines.join("\n");
  return {
    text: before + newBlock + after,
    selStart: blockStart,
    selEnd: blockStart + newBlock.length,
  };
}

/** Prefix `// ` at the shallowest indentation shared by the non-blank lines
 *  (matching how Monaco aligns the inserted marker); blank lines stay blank. */
function commentLines(lines: string[], nonBlank: string[]): string[] {
  const indent = Math.min(
    ...nonBlank.map((l) => l.length - l.trimStart().length),
  );
  return lines.map((l) =>
    l.trim().length === 0
      ? l
      : l.slice(0, indent) + LINE_COMMENT + " " + l.slice(indent),
  );
}

/** Remove one leading `//` (and a single following space, matching how the
 *  comment path inserts it) after the line's own indentation. */
function uncommentLine(line: string): string {
  const lead = line.length - line.trimStart().length;
  const rest = line.slice(lead);
  if (!rest.startsWith(LINE_COMMENT)) return line;
  let body = rest.slice(LINE_COMMENT.length);
  if (body.startsWith(" ")) body = body.slice(1);
  return line.slice(0, lead) + body;
}
