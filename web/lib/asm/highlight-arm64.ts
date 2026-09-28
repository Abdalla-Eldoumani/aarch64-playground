/**
 * The read-only highlighter shared by CodeBlock and the landing hero's
 * StaticCodeView. Editor.tsx builds its Monaco rules from the two patterns
 * exported here, so the editor and the reading surfaces cannot drift. Names
 * come from lib/asm/mnemonics, not instruction-docs, to keep the hover-card
 * text out of the landing bundle. KIND_CLASS holds Tailwind classes, which is
 * why the Tailwind content globs cover lib/.
 */

import { ARM64_MNEMONIC_NAMES } from "@/lib/asm/mnemonics";

export type TokenKind =
  | "keyword"
  | "register"
  | "number"
  | "string"
  | "comment"
  | "label"
  | "text";

export interface Token {
  text: string;
  kind: TokenKind;
}

/**
 * Every mnemonic the playground assembles. Tests tie the list to the
 * assembler's own SUPPORTED_MNEMONICS, so a new instruction is coloured
 * everywhere with nothing to add here. CONDITIONAL_BRANCH_RE covers `b.cond`.
 */
export const ARM64_MNEMONICS: ReadonlySet<string> = new Set(
  ARM64_MNEMONIC_NAMES,
);

/**
 * The same set as one escaped regex alternation, for Editor.tsx's Monaco
 * keyword rule. The caller adds its own word boundaries and the `i` flag.
 */
export const MNEMONIC_ALTERNATION: string = [...ARM64_MNEMONICS]
  .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

/**
 * Every register name: x/w, the SIMD&FP scalar views (b, h, s, d, q), and v
 * with an arrangement (`v3.16b`) or one lane (`v3.b[15]`). Numbers run widest
 * first so an unanchored match cannot stop short (`x30` must not read `x3`).
 */
const REGISTER_BODY =
  "(?:[xw](?:30|[12]\\d|\\d)|sp|xzr|wzr|[bhsdq](?:3[01]|[12]\\d|\\d)" +
  "|v(?:3[01]|[12]\\d|\\d)(?:\\.(?:16b|8b|8h|4h|4s|2s|2d|1d|[bhsd]\\[\\d+\\]))?)";

const REGISTER_RE = new RegExp(`^${REGISTER_BODY}$`, "i");

/**
 * The register alternation for Editor.tsx's Monaco rule, which scans a line.
 * Monarch takes whatever prefix fits, so without the lookahead `x31` would
 * colour as `x3`, the very typo error-explain names. A trailing `\b` cannot
 * stand in, because a lane form ends in `]`.
 */
export const REGISTER_PATTERN = `\\b${REGISTER_BODY}(?![\\w.[])`;
const CONDITIONAL_BRANCH_RE = /^b\.[a-z]{2,4}$/i;
const LABEL_RE = /^[A-Za-z_.$][\w.$]*:$/;
const DIRECTIVE_RE = /^\.[A-Za-z][\w.]*$/;

// Comments and strings win over words; a `#` immediate is a number (the editor
// only colours those); a digit-led token stays plain. A word may end in `[n]`
// so a lane form (`v3.b[15]`) is one token, while a memory operand's `[`
// starts its own.
const SCAN =
  /(\/\/[^\n]*|;[^\n]*)|("(?:[^"\\]|\\.)*")|(#-?(?:0x[0-9a-fA-F]+|\d+))|(\d[\w.$]*)|([A-Za-z_.$][\w.$]*(?:\[\d+\])?:?)|(\s+)|([^\s])/g;

function classifyWord(word: string): TokenKind {
  if (LABEL_RE.test(word)) return "label";
  if (DIRECTIVE_RE.test(word)) return "keyword"; // assembler directives read as keywords
  if (REGISTER_RE.test(word)) return "register";
  if (CONDITIONAL_BRANCH_RE.test(word) || ARM64_MNEMONICS.has(word.toLowerCase())) {
    return "keyword";
  }
  return "text";
}

/** Tokenize one line of A64 source. A non-arm64 caller renders plain text instead. */
export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  SCAN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SCAN.exec(line)) !== null) {
    const [whole, comment, str, num, digitLed, word] = match;
    if (comment !== undefined) tokens.push({ text: comment, kind: "comment" });
    else if (str !== undefined) tokens.push({ text: str, kind: "string" });
    else if (num !== undefined) tokens.push({ text: num, kind: "number" });
    else if (digitLed !== undefined) tokens.push({ text: digitLed, kind: "text" });
    else if (word !== undefined) tokens.push({ text: word, kind: classifyWord(word) });
    else tokens.push({ text: whole, kind: "text" }); // whitespace and punctuation
  }
  return tokens;
}

/** Per-kind Tailwind classes; colors read the per-theme `--syntax-*` tokens. */
export const KIND_CLASS: Record<TokenKind, string> = {
  keyword: "font-bold text-[var(--syntax-keyword)]",
  register: "text-[var(--syntax-register)]",
  number: "text-[var(--syntax-number)]",
  string: "text-[var(--syntax-string)]",
  comment: "italic text-[var(--syntax-comment)]",
  label: "text-[var(--syntax-label)]",
  text: "",
};
