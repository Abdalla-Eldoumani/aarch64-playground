/**
 * The read-only ARM64 syntax highlighter: one scanner pass per line, and the
 * class map its tokens render through. Two surfaces share it (the reading
 * surfaces' CodeBlock and the landing hero's StaticCodeView), so the mnemonic
 * set, the scanner, and the colors are written once. The mnemonics are the
 * curated CPSC 355 set the editor's Monaco grammar also colors as keywords
 * (web/components/playground/Editor.tsx owns the Monaco copy); the two are kept
 * in step so every surface colors the same tokens.
 *
 * Text in, data out: no React, no emulator calls. KIND_CLASS holds Tailwind
 * class strings, which are data, and the components own the elements. The
 * Tailwind content globs cover lib/ for exactly this file.
 */

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

const MNEMONICS = new Set<string>([
  "mov", "movz", "movk", "movn", "add", "adds", "sub", "subs", "mul", "madd",
  "msub", "udiv", "sdiv", "neg", "and", "ands", "orr", "eor", "mvn", "tst",
  "lsl", "lsr", "asr", "ror", "sxtb", "sxth", "sxtw", "uxtb", "uxth", "cmp",
  "cmn", "ldr", "str", "ldrb", "strb", "ldrh", "strh", "ldp", "stp", "ldrsb",
  "ldrsh", "ldrsw", "adr", "adrp", "b", "bl", "br", "blr", "ret", "cbz",
  "cbnz", "tbz", "tbnz", "csel", "csinc", "cset", "nop", "svc", "fmov", "fadd",
  "fsub", "fmul", "fdiv", "fcmp", "scvtf", "fcvtzs",
]);

// The whole register file: the general names, the five scalar views of a
// SIMD&FP entry (b, h, s, d, q), and the vector view with either an arrangement
// (`v3.16b`) or one indexed lane (`v3.b[15]`), which the scanner hands over as
// a single word.
const REGISTER_RE =
  /^(?:[xw](?:[12]?\d|30)|sp|xzr|wzr|[bhsdq](?:[12]?\d|3[01])|v(?:[12]?\d|3[01])(?:\.(?:16b|8b|8h|4h|4s|2s|2d|1d|[bhsd]\[\d+\]))?)$/i;
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
  if (CONDITIONAL_BRANCH_RE.test(word) || MNEMONICS.has(word.toLowerCase())) return "keyword";
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
