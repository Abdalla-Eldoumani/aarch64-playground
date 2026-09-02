/**
 * Shell-style command-line argument parser. Splits on whitespace, preserves the
 * contents of double- or single-quoted spans, and treats `\\` followed by any
 * character as an escape (the next character is inserted literally), except
 * inside single quotes, where bash keeps the backslash literal.
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
  return parseArgsDetailed(input).map((t) => t.text);
}

export interface ParsedToken {
  text: string;
  /** True when any part of the token was quoted or backslash-escaped.
   *  The terminal uses this to tell a redirect operator `>` from a
   *  literal `">"` the student deliberately protected. */
  quoted: boolean;
}

/** The tokenizer behind `parseArgs`, keeping the quoting facts. */
export function parseArgsDetailed(input: string): ParsedToken[] {
  const out: ParsedToken[] = [];
  let buf = "";
  let inQuote: '"' | "'" | null = null;
  let hasToken = false;
  let quoted = false;

  const flush = () => {
    if (hasToken) {
      out.push({ text: buf, quoted });
      buf = "";
      hasToken = false;
      quoted = false;
    }
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    // Backslash escapes the next char OUTSIDE single quotes; bash keeps it
    // literal inside '...' (so `'C:\dir'` stays `C:\dir`).
    if (ch === "\\" && i + 1 < input.length && inQuote !== "'") {
      buf += input[i + 1];
      hasToken = true;
      quoted = true;
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
      quoted = true;
      continue;
    }

    if (/\s/.test(ch)) {
      flush();
      continue;
    }

    buf += ch;
    hasToken = true;
  }

  flush();
  return out;
}
