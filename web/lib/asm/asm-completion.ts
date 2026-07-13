import { INSTRUCTION_DOCS } from "@/lib/asm/instruction-docs";

/**
 * Pure suggestion engine for the Monaco completion provider.
 *
 * The provider passes us the source, the current line up to the cursor,
 * and the cursor's column-within-line position. We classify the context
 * (directive / mnemonic / operand / branch target) and return a ranked
 * list. The Monaco wrapper translates each suggestion into a
 * `CompletionItem` shape, so this module stays test-friendly without a
 * Monaco dependency.
 */

export interface CompletionContext {
  /** Full source buffer; used to scrape labels, m4 aliases, and
   *  symbol assignments. */
  source: string;
  /** Just the current line up to (and including) the cursor column. */
  line: string;
  /** 1-based column position. */
  position: number;
}

export type SuggestionKind =
  | "directive"
  | "instruction"
  | "register"
  | "alias"
  | "label"
  | "libc";

export interface Suggestion {
  label: string;
  kind: SuggestionKind;
  detail?: string;
  /** Optional snippet body (with `${1:...}` placeholders). When absent
   *  Monaco inserts the bare label. */
  insertText?: string;
}

const DIRECTIVES: Suggestion[] = [
  ".text", ".data", ".rodata", ".bss",
  ".section", ".global", ".globl",
  ".string", ".asciz", ".ascii",
  ".byte", ".hword", ".short", ".word", ".quad",
  ".double", ".float",
  ".skip", ".zero", ".balign", ".align",
  ".type", ".size",
].map((name) => ({ label: name, kind: "directive", detail: "directive" }));

const REGISTERS: Suggestion[] = [
  ...Array.from({ length: 31 }, (_, i) => `x${i}`),
  ...Array.from({ length: 31 }, (_, i) => `w${i}`),
  "sp", "xzr", "wzr", "fp", "lr",
  ...Array.from({ length: 32 }, (_, i) => `d${i}`),
].map((name) => ({ label: name, kind: "register", detail: "register" }));

const LIBC: Suggestion[] = [
  "printf", "scanf", "puts", "putchar", "getchar",
  "strlen", "strcmp", "strcpy", "memset", "memcpy",
  "exit", "atof",
].map((name) => ({ label: name, kind: "libc", detail: "host stub" }));

function instructionSuggestions(): Suggestion[] {
  return Object.keys(INSTRUCTION_DOCS).map((m) => ({
    label: m.toLowerCase(),
    kind: "instruction",
    detail: INSTRUCTION_DOCS[m].summary,
  }));
}

const DEFINE_RE = /\bdefine\s*\(\s*([A-Za-z_][\w]*)\s*,\s*([^)]+?)\s*\)/g;

function aliasSuggestions(source: string): Suggestion[] {
  const out: Suggestion[] = [];
  for (const m of source.matchAll(DEFINE_RE)) {
    out.push({
      label: m[1],
      kind: "alias",
      detail: `alias for ${m[2].trim()}`,
    });
  }
  return out;
}

const LABEL_RE = /^\s*([A-Za-z_.$][\w.$]*)\s*:/gm;
const ASSIGNMENT_RE = /^\s*([A-Za-z_][\w]*)\s*=\s*[^=]/gm;

function labelSuggestions(source: string): Suggestion[] {
  const out: Suggestion[] = [];
  for (const m of source.matchAll(LABEL_RE)) {
    out.push({ label: m[1], kind: "label", detail: "label" });
  }
  for (const m of source.matchAll(ASSIGNMENT_RE)) {
    out.push({ label: m[1], kind: "label", detail: "symbol" });
  }
  return out;
}

function isInOperandContext(line: string): boolean {
  // We're in operand context if the line contains a mnemonic followed
  // by whitespace before the cursor: e.g. `  mov ` or `  ldr w0, [`.
  return /^\s*[A-Za-z_.][\w.]*\s+\S*$/.test(line) || /^\s*[A-Za-z_.][\w.]*\s+/.test(line);
}

function isBranchContext(line: string): boolean {
  // Lines that start with bl / b / b.cond / br / blr / cbz / etc.
  return /^\s*(bl|blr|br|b|b\.[a-z]+|cbz|cbnz|tbz|tbnz)\s+/i.test(line);
}

function isDirectiveContext(line: string): boolean {
  // The cursor sits inside a token starting with `.` at this column.
  return /^\s*\.\w*$/.test(line);
}

function isMnemonicStartContext(line: string): boolean {
  // First non-blank token in the line (no whitespace yet after the
  // current word) -- we're typing the mnemonic.
  return /^\s*[A-Za-z_][\w.]*$/.test(line) && !line.trimStart().startsWith(".");
}

function dedupe(items: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of items) {
    const key = `${s.kind}:${s.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function buildSuggestions(c: CompletionContext): Suggestion[] {
  const sliced = c.line.slice(0, c.position);
  if (isDirectiveContext(sliced)) {
    return DIRECTIVES.slice();
  }
  if (isBranchContext(sliced)) {
    // Branch targets: labels + libc names + an "alias" fallback (for
    // `bl <m4 alias to libc>` style code).
    return dedupe([
      ...labelSuggestions(c.source),
      ...LIBC,
      ...aliasSuggestions(c.source),
    ]);
  }
  if (isOperandContextOnly(sliced)) {
    return dedupe([
      ...REGISTERS,
      ...aliasSuggestions(c.source),
      ...labelSuggestions(c.source),
    ]);
  }
  if (isMnemonicStartContext(sliced)) {
    return dedupe([
      ...instructionSuggestions(),
      ...DIRECTIVES,
      ...labelSuggestions(c.source),
    ]);
  }
  // Fallback (start of empty line, etc.): everything.
  return dedupe([
    ...instructionSuggestions(),
    ...DIRECTIVES,
    ...REGISTERS,
    ...LIBC,
    ...labelSuggestions(c.source),
    ...aliasSuggestions(c.source),
  ]);
}

function isOperandContextOnly(line: string): boolean {
  // True when there's already a mnemonic followed by whitespace and we
  // aren't in a branch (those handled separately).
  if (!isInOperandContext(line)) return false;
  if (isBranchContext(line)) return false;
  return true;
}
