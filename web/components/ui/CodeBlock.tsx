"use client";

export interface CodeBlockProps {
  /** The source to render, read-only. */
  code: string;
  /** Dialect hint. "arm64" assembly is tokenized; anything else renders as
   *  plain monospaced text. */
  language?: string;
  /** Zero-based line to mark as the current line (amber left bar + tint),
   *  the debugger's current-line treatment for teaching walkthroughs. */
  highlightLine?: number;
  className?: string;
}

type TokenKind = "keyword" | "register" | "number" | "string" | "comment" | "label" | "text";

interface Token {
  text: string;
  kind: TokenKind;
}

// The mnemonics the editor's Monaco grammar colors as keywords, mirrored so a
// read-only block matches the editor's keyword set. The editor owns the Monaco
// copy (web/components/Editor.tsx); both are the curated CPSC 355 set, kept in
// step so the two surfaces color the same tokens.
const MNEMONICS = new Set<string>([
  "mov", "movz", "movk", "movn", "add", "adds", "sub", "subs", "mul", "madd",
  "msub", "udiv", "sdiv", "neg", "and", "ands", "orr", "eor", "mvn", "tst",
  "lsl", "lsr", "asr", "ror", "sxtb", "sxth", "sxtw", "uxtb", "uxth", "cmp",
  "cmn", "ldr", "str", "ldrb", "strb", "ldrh", "strh", "ldp", "stp", "ldrsb",
  "ldrsh", "ldrsw", "adr", "adrp", "b", "bl", "br", "blr", "ret", "cbz",
  "cbnz", "tbz", "tbnz", "csel", "csinc", "cset", "nop", "svc", "fmov", "fadd",
  "fsub", "fmul", "fdiv", "fcmp", "scvtf", "fcvtzs",
]);

const REGISTER_RE = /^(?:x(?:[12]?\d|30)|w(?:[12]?\d|30)|sp|xzr|wzr)$/i;
const CONDITIONAL_BRANCH_RE = /^b\.[a-z]{2,4}$/i;
const LABEL_RE = /^[A-Za-z_.$][\w.$]*:$/;
const DIRECTIVE_RE = /^\.[A-Za-z][\w.]*$/;

// One scanner pass per line, longest-meaningful-chunk first: line comments and
// strings win over words; a `#`-prefixed immediate is a number (mirroring the
// editor, which only colors `#` immediates); a digit-led token stays plain; a
// trailing-colon word is a label.
const SCAN =
  /(\/\/[^\n]*|;[^\n]*)|("(?:[^"\\]|\\.)*")|(#-?(?:0x[0-9a-fA-F]+|\d+))|(\d[\w.$]*)|([A-Za-z_.$][\w.$]*:?)|(\s+)|([^\s])/g;

function classifyWord(word: string): TokenKind {
  if (LABEL_RE.test(word)) return "label";
  if (DIRECTIVE_RE.test(word)) return "keyword"; // assembler directives read as keywords
  if (REGISTER_RE.test(word)) return "register";
  if (CONDITIONAL_BRANCH_RE.test(word) || MNEMONICS.has(word.toLowerCase())) return "keyword";
  return "text";
}

function tokenizeLine(line: string): Token[] {
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

const KIND_CLASS: Record<TokenKind, string> = {
  keyword: "font-bold text-[var(--syntax-keyword)]",
  register: "text-[var(--syntax-register)]",
  number: "text-[var(--syntax-number)]",
  string: "text-[var(--syntax-string)]",
  comment: "italic text-[var(--syntax-comment)]",
  label: "text-[var(--syntax-label)]",
  text: "",
};

/**
 * Read-only syntax-colored code block. Tokenizes assembly into React spans whose
 * colors read from the `--syntax-*` tokens (defined per theme in globals.css to
 * match the editor), so the block and the editor stay visually consistent. Code
 * is rendered as text spans only (no HTML-string injection path), so a
 * caller-supplied string cannot inject markup.
 */
export function CodeBlock({
  code,
  language = "arm64",
  highlightLine,
  className = "",
}: CodeBlockProps) {
  const lines = code.replace(/\n$/, "").split("\n");
  const tokenizedLines =
    language === "arm64"
      ? lines.map(tokenizeLine)
      : lines.map((line): Token[] => [{ text: line, kind: "text" }]);

  return (
    <pre
      className={`overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--text-primary)] ${className}`}
    >
      <code>
        {tokenizedLines.map((tokens, lineIndex) => (
          <span
            key={lineIndex}
            data-current={lineIndex === highlightLine || undefined}
            className={`block min-h-[1.4em] ${
              lineIndex === highlightLine
                ? "bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] [box-shadow:inset_3px_0_0_0_var(--amber)]"
                : ""
            }`}
          >
            {tokens.map((token, tokenIndex) => (
              <span key={tokenIndex} className={KIND_CLASS[token.kind]}>
                {token.text}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  );
}
