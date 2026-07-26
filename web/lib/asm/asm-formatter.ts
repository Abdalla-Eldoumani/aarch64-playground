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

function splitOffComment(line: string): { code: string; comment: string | null } {
  // Strip a trailing line comment without disturbing comments inside
  // string literals. The cpsc 355 corpus only uses `//` and `;` as
  // comment markers.
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && inString) {
      i++; // skip escape
      continue;
    }
    if (c === '"') {
      inString = !inString;
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
  return { code: line, comment: null };
}

type CodeShape =
  | { kind: "blank" }
  | { kind: "directive"; text: string }
  | { kind: "label-only"; label: string }
  | { kind: "label-rest"; labels: string[]; rest: string }
  | { kind: "define"; text: string }
  | { kind: "assignment"; text: string }
  | { kind: "instruction"; mnemonic: string; operands: string };

// Sticky so a run of labels stacked on one line (`a: b: mov x0, x1`) peels
// in a single pass. Re-classifying the remainder per label was quadratic in
// the label count and recursed once per label, so a pasted line of 20k
// labels overflowed the stack instead of formatting.
const LABEL_PREFIX_RE = /([A-Za-z_.$][\w.$]*)\s*:\s*/y;

function classifyCode(code: string): CodeShape {
  const trimmed = code.trim();
  if (trimmed.length === 0) return { kind: "blank" };
  if (trimmed.startsWith(".")) return { kind: "directive", text: trimmed };
  if (/^define\s*\(/i.test(trimmed)) return { kind: "define", text: trimmed };
  // Symbol assignment `name = expr`.
  if (/^[A-Za-z_][\w]*\s*=\s*[^=]/.test(trimmed) && !/:\s*$/.test(trimmed)) {
    return { kind: "assignment", text: trimmed };
  }
  // Label: `name:` possibly followed by an instruction or directive on the
  // same line. The `.` stop mirrors the directive test above, which the
  // per-label re-classification used to apply to every remainder.
  const labels: string[] = [];
  let consumed = 0;
  LABEL_PREFIX_RE.lastIndex = 0;
  while (trimmed[consumed] !== ".") {
    const hit = LABEL_PREFIX_RE.exec(trimmed);
    if (hit === null) break;
    labels.push(hit[1]);
    consumed = LABEL_PREFIX_RE.lastIndex;
  }
  if (labels.length > 0) {
    const rest = trimmed.slice(consumed);
    if (rest.length === 0 && labels.length === 1) {
      return { kind: "label-only", label: labels[0] };
    }
    return { kind: "label-rest", labels, rest };
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

// Names the source defines (labels, m4 defines, `.req` aliases, and
// `name = expr` assignments). A label or alias shaped like a register --
// `LR:`, `SP`, `D0` -- must keep its exact case, so it is excluded from
// register lowercasing.
function collectDefinedSymbols(source: string): Set<string> {
  const names = new Set<string>();
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    const label = line.match(/^([A-Za-z_.$][\w.$]*)\s*:/);
    if (label) names.add(label[1]);
    const define = line.match(/^define\s*\(\s*`?([A-Za-z_]\w*)'?\s*,/i);
    if (define) names.add(define[1]);
    const assign = line.match(/^([A-Za-z_]\w*)\s*=\s*[^=]/);
    if (assign) names.add(assign[1]);
    const req = line.match(/^([A-Za-z_]\w*)\s+\.req\b/i);
    if (req) names.add(req[1]);
  }
  return names;
}

function lowercaseRegisters(operands: string, defined: Set<string>): string {
  return operands.replace(REGISTER_RE, (m) => (defined.has(m) ? m : m.toLowerCase()));
}

function formatInstruction(mnemonic: string, operands: string, defined: Set<string>): string {
  const padded = mnemonic.padEnd(MNEMONIC_WIDTH);
  const normalisedOps = lowercaseRegisters(operands, defined);
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

// Labels stay flush left; the code after them keeps a single space from the
// innermost label so `main: ret` still reads as one line, and anything else
// (a directive, a further label) gets the wider gap. Applied innermost-out,
// so only the innermost candidate can still carry the instruction indent.
function formatLabelStack(labels: string[], rest: string, defined: Set<string>): string {
  const tail = rest.length > 0 ? formatShape(classifyCode(rest), defined) : "";
  const innermost = labels.length - 1;
  const head = tail.startsWith(INSTRUCTION_INDENT)
    ? `${labels[innermost]}:${tail.slice(INSTRUCTION_INDENT.length - 1)}`
    : tail.length > 0
      ? `${labels[innermost]}:    ${tail}`
      : `${labels[innermost]}:`;
  // Joined rather than accumulated: re-testing a growing string for the
  // indent prefix flattens it every pass, which is quadratic again.
  const parts = labels.slice(0, innermost).map((label) => `${label}:    `);
  parts.push(head);
  return parts.join("");
}

function formatShape(cls: CodeShape, defined: Set<string>): string {
  switch (cls.kind) {
    case "blank":
      return "";
    case "directive":
    case "define":
    case "assignment":
      return cls.text;
    case "label-only":
      return `${cls.label}:`;
    case "label-rest":
      return formatLabelStack(cls.labels, cls.rest, defined);
    case "instruction":
      return formatInstruction(cls.mnemonic, cls.operands, defined);
  }
}

export function formatAsm(source: string, defined?: Set<string>): string {
  const symbols = defined ?? collectDefinedSymbols(source);
  const out: string[] = [];
  for (const raw of source.split("\n")) {
    if (raw.trim().length === 0) {
      out.push("");
      continue;
    }
    const { code, comment } = splitOffComment(raw);
    const cls = classifyCode(code);
    if (cls.kind === "blank") {
      // Pure comment line -- leave the original whitespace + comment.
      out.push(comment ?? "");
      continue;
    }
    out.push(attachComment(formatShape(cls, symbols), comment));
  }
  return out.join("\n");
}
