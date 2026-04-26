/**
 * Lightweight AArch64 source formatter for the cpsc 355 corpus.
 *
 * Goals:
 *   - Lowercase mnemonics so the corpus reads consistently regardless of
 *     student typing.
 *   - Indent instructions to a consistent column and pad the mnemonic so
 *     operands line up vertically across consecutive lines.
 *   - Keep labels, directives, m4 `define(...)`, and `name = expr`
 *     assignments at column 0 (the cpsc 355 convention).
 *   - Preserve trailing comments after the code (with a single space
 *     gap when the code already extends past the alignment column,
 *     otherwise pad up to `COMMENT_COLUMN`).
 *   - Be idempotent: `formatAsm(formatAsm(x)) === formatAsm(x)`.
 *
 * Not in scope: instruction-level rewriting (e.g. expanding aliases),
 * pseudo-op normalisation, or reordering.
 */

const INSTRUCTION_INDENT = "        "; // 8 spaces
const MNEMONIC_WIDTH = 8; // chars including trailing whitespace
const COMMENT_COLUMN = 40;

interface SplitLine {
  raw: string;
  trimmed: string;
  comment: string | null;
  /** Indent that was already there. Used only for blank-line preservation. */
  indent: string;
}

const COMMENT_RE = /(\s*)(\/\/|;).*$/;

function splitOffComment(line: string): { code: string; comment: string | null } {
  // Strip a trailing line comment without disturbing comments inside
  // string literals. The cpsc 355 corpus only uses `//` and `;` as
  // comment markers.
  let inString = false;
  let lastQuote = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && inString) {
      i++; // skip escape
      continue;
    }
    if (c === '"') {
      inString = !inString;
      lastQuote = i;
      continue;
    }
    if (inString) continue;
    if (c === "/" && line[i + 1] === "/") {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
    if (c === ";") {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
  }
  // dummy use of lastQuote so the linter doesn't drop the binding
  void lastQuote;
  return { code: line, comment: null };
}

function classifyCode(code: string):
  | { kind: "blank" }
  | { kind: "directive"; text: string }
  | { kind: "label-only"; label: string }
  | { kind: "label-rest"; label: string; rest: string }
  | { kind: "define"; text: string }
  | { kind: "assignment"; text: string }
  | { kind: "instruction"; mnemonic: string; operands: string } {
  const trimmed = code.trim();
  if (trimmed.length === 0) return { kind: "blank" };
  if (trimmed.startsWith(".")) return { kind: "directive", text: trimmed };
  if (/^define\s*\(/i.test(trimmed)) return { kind: "define", text: trimmed };
  // Symbol assignment `name = expr`.
  if (/^[A-Za-z_][\w]*\s*=\s*[^=]/.test(trimmed) && !/:\s*$/.test(trimmed)) {
    return { kind: "assignment", text: trimmed };
  }
  // Label: `name:` possibly followed by an instruction or directive on the same line.
  const labelMatch = trimmed.match(/^([A-Za-z_.$][\w.$]*)\s*:\s*(.*)$/);
  if (labelMatch) {
    const label = labelMatch[1];
    const rest = labelMatch[2].trim();
    if (rest.length === 0) return { kind: "label-only", label };
    return { kind: "label-rest", label, rest };
  }
  // Instruction: first whitespace-separated token is the mnemonic.
  const space = trimmed.search(/\s/);
  if (space < 0) return { kind: "instruction", mnemonic: trimmed.toLowerCase(), operands: "" };
  return {
    kind: "instruction",
    mnemonic: trimmed.slice(0, space).toLowerCase(),
    operands: trimmed.slice(space + 1).trim(),
  };
}

// Register identifiers a formatter is safe to lowercase. Labels and
// m4 aliases are case-sensitive and stay untouched.
const REGISTER_RE = /\b(X[0-9]|X[12][0-9]|X30|W[0-9]|W[12][0-9]|W30|SP|XZR|WZR|FP|LR|D[0-9]|D[12][0-9]|D3[01])\b/g;

function lowercaseRegisters(operands: string): string {
  return operands.replace(REGISTER_RE, (m) => m.toLowerCase());
}

function formatInstruction(mnemonic: string, operands: string): string {
  const padded = mnemonic.padEnd(MNEMONIC_WIDTH);
  const normalisedOps = lowercaseRegisters(operands);
  const code = normalisedOps.length > 0 ? `${padded}${normalisedOps}` : mnemonic;
  return `${INSTRUCTION_INDENT}${code}`;
}

function attachComment(code: string, comment: string | null): string {
  if (comment == null) return code;
  // Normalise the comment marker spacing: strip leading whitespace
  // from the comment fragment and decide on the gap to the code.
  const trimmedComment = comment.trim();
  if (code.length === 0) return trimmedComment;
  const targetColumn = Math.max(COMMENT_COLUMN, code.length + 1);
  const gap = " ".repeat(targetColumn - code.length);
  return `${code}${gap}${trimmedComment}`;
}

export function formatAsm(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    if (raw.trim().length === 0) {
      out.push("");
      continue;
    }
    const { code, comment } = splitOffComment(raw);
    const cls = classifyCode(code);
    let formattedCode: string;
    switch (cls.kind) {
      case "blank":
        // Pure comment line -- leave the original whitespace + comment.
        out.push(comment ?? "");
        continue;
      case "directive":
        formattedCode = cls.text;
        break;
      case "define":
        formattedCode = cls.text;
        break;
      case "assignment":
        formattedCode = cls.text;
        break;
      case "label-only":
        formattedCode = `${cls.label}:`;
        break;
      case "label-rest": {
        // Re-format the rest using the same classifier.
        const restFormatted = formatAsm(cls.rest).trimEnd();
        if (restFormatted.startsWith(INSTRUCTION_INDENT)) {
          formattedCode = `${cls.label}:${restFormatted.slice(INSTRUCTION_INDENT.length - 1)}`;
        } else {
          // Directive after label: keep label flush, then a tab gap.
          formattedCode = `${cls.label}:    ${restFormatted}`;
        }
        break;
      }
      case "instruction":
        formattedCode = formatInstruction(cls.mnemonic, cls.operands);
        break;
    }
    out.push(attachComment(formattedCode, comment));
  }
  return out.join("\n");
}
