/**
 * Shell-style command-line argument parser. Splits on whitespace,
 * preserves the contents of double- or single-quoted spans, and treats
 * `\\` followed by any character as an escape (the next character is
 * inserted literally).
 *
 * Empty input produces an empty array. Unterminated quotes are tolerant:
 * the rest of the line is treated as the final argument's contents.
 *
 * Examples:
 *   parseArgs("hello world")       -> ["hello", "world"]
 *   parseArgs('"has spaces"')      -> ["has spaces"]
 *   parseArgs('a "b c" d')         -> ["a", "b c", "d"]
 *   parseArgs("a\\ b")             -> ["a b"]
 *   parseArgs("")                   -> []
 */
export function parseArgs(input: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote: '"' | "'" | null = null;
  let hasToken = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === "\\" && i + 1 < input.length) {
      buf += input[i + 1];
      hasToken = true;
      i++;
      continue;
    }

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
        continue;
      }
      buf += ch;
      hasToken = true;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      hasToken = true;
      continue;
    }

    if (/\s/.test(ch)) {
      if (hasToken) {
        out.push(buf);
        buf = "";
        hasToken = false;
      }
      continue;
    }

    buf += ch;
    hasToken = true;
  }

  if (hasToken) {
    out.push(buf);
  }

  return out;
}
