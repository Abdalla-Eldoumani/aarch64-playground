/**
 * The read-only ARM64 syntax highlighter: one scanner pass per line, and the
 * class map its tokens render through. Two surfaces share it (the reading
 * surfaces' CodeBlock and the landing hero's StaticCodeView), so the scanner
 * and the colors are written once. The mnemonic set is not written here at
 * all: it comes from lib/asm/mnemonics, and the editor's Monaco grammar builds
 * its keyword and register rules from the two patterns this file exports, so
 * the reading surfaces and the editor cannot drift.
 *
 * The names arrive from that module rather than from instruction-docs on
 * purpose: the landing page highlights its hero program through this file, and
 * importing the hover-card table here would put every summary, detail and
 * example into the landing bundle for nothing.
 *
 * Text in, data out: no React, no emulator calls. KIND_CLASS holds Tailwind
 * class strings, which are data, and the components own the elements. The
 * Tailwind content globs cover lib/ for exactly this file.
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
 * Every mnemonic the playground assembles, as a set for the scanner's lookup.
 * The names come from lib/asm/mnemonics, which the drift guards pin to the
 * hover-card table and through it to the assembler's own SUPPORTED_MNEMONICS,
 * so adding an instruction colours it on every surface with no list here to
 * remember. The conditional branches are not in it: CONDITIONAL_BRANCH_RE
 * below matches those.
 */
export const ARM64_MNEMONICS: ReadonlySet<string> = new Set(
  ARM64_MNEMONIC_NAMES,
);

/**
 * The same set as one regex alternation, escaped, for a caller that colours by
 * pattern instead of by lookup. components/playground/Editor.tsx wraps this in
 * its Monaco keyword rule, so the editor and the reading surfaces colour one
 * set. The caller supplies its own word boundaries and the case-insensitive
 * flag.
 */
export const MNEMONIC_ALTERNATION: string = [...ARM64_MNEMONICS]
  .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

/**
 * The whole register file as one alternation: the general names, the five
 * scalar views of a SIMD&FP entry (b, h, s, d, q), and the vector view with
 * either an arrangement (`v3.16b`) or one indexed lane (`v3.b[15]`), which the
 * scanner hands over as a single word.
 *
 * The number alternatives run widest first so an unanchored match cannot stop
 * short: `x30` must not come back as `x3`. Anchored callers are indifferent to
 * the order, so one body serves both.
 */
const REGISTER_BODY =
  "(?:[xw](?:30|[12]\\d|\\d)|sp|xzr|wzr|[bhsdq](?:3[01]|[12]\\d|\\d)" +
  "|v(?:3[01]|[12]\\d|\\d)(?:\\.(?:16b|8b|8h|4h|4s|2s|2d|1d|[bhsd]\\[\\d+\\]))?)";

const REGISTER_RE = new RegExp(`^${REGISTER_BODY}$`, "i");

/**
 * The same alternation for a caller that scans a line instead of testing a
 * whole word: components/playground/Editor.tsx wraps this in its Monaco
 * register rule, so the editor and the reading surfaces recognise one set.
 *
 * A leading `\b` alone is not enough. Monarch matches at the cursor and takes
 * whatever prefix fits, so `x31` would colour as `x3` and `v3.3s` as `v3` --
 * and `x31` is exactly the typo error-explain exists to name. A trailing `\b`
 * cannot close it either, because a lane form ends in `]`, which already sits
 * on a word boundary. The lookahead does: a register name may not be followed
 * by another word character, a dot, or a bracket.
 */
export const REGISTER_PATTERN = `\\b${REGISTER_BODY}(?![\\w.[])`;
const CONDITIONAL_BRANCH_RE = /^b\.[a-z]{2,4}$/i;
const LABEL_RE = /^[A-Za-z_.$][\w.$]*:$/;
const DIRECTIVE_RE = /^\.[A-Za-z][\w.]*$/;

// One scanner pass per line, longest-meaningful-chunk first: line comments and
// strings win over words; a `#`-prefixed immediate is a number (mirroring the
// editor, which only colors `#` immediates); a digit-led token stays plain; a
// trailing-colon word is a label. A word may end in a bracketed index so a lane
// form (`v3.b[15]`) scans as one token; a memory operand still starts at its
// own `[`, which no word precedes.
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
