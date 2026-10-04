/**
 * The instruction finder's rules: the groups a student thinks in, the ranked
 * plain-word search, the closest rows when nothing matches, and the finder's
 * state in the URL query. Pure, so the reference page and its tests share one
 * copy.
 */

import type { ReferenceInstruction } from "@/lib/content/reference-data";
import { matchesAllWords } from "@/lib/content/search-words";

export type FinderGroupId =
  | "arithmetic"
  | "logic"
  | "compare"
  | "memory"
  | "float"
  | "vector"
  | "system";

// Data processing mixes two ideas a student keeps apart; these are the
// bitwise, shift, bitfield and extend rows, the rest is arithmetic.
const LOGIC_AND_SHIFTS: ReadonlySet<string> = new Set([
  "and", "ands", "orr", "eor", "mvn", "bic", "orn", "eon", "clz", "cls", "rbit",
  "rev", "rev16", "rev32", "lsl", "lsr", "asr", "ror", "extr", "sbfx", "sxtb",
  "sxth", "sxtw", "uxtb", "uxth", "uxtw", "ubfx", "bfi", "bfxil", "ubfiz", "sbfiz",
]);

export const FINDER_GROUPS: readonly { id: FinderGroupId; label: string }[] = [
  { id: "arithmetic", label: "arithmetic" },
  { id: "logic", label: "logic and shifts" },
  { id: "compare", label: "compare and branch" },
  { id: "memory", label: "load and store" },
  { id: "float", label: "floating point" },
  { id: "vector", label: "vectors" },
  { id: "system", label: "system" },
];

export function groupOf(instruction: ReferenceInstruction): FinderGroupId {
  switch (instruction.category) {
    case "Data processing":
      return LOGIC_AND_SHIFTS.has(instruction.mnemonic) ? "logic" : "arithmetic";
    case "Compare and test":
    case "Conditional select":
    case "Branches":
      return "compare";
    case "Memory":
    case "PC-relative addressing":
      return "memory";
    case "Floating point":
      return "float";
    case "Vector":
      return "vector";
    case "System":
      return "system";
  }
}

// The words a C operator stands for, so "multiply" finds mul, whose summary
// only says `Rd = Rn * Rm`. + - & | are left out: their words are already
// mnemonics, and every address sum would turn up under "add".
const OPERATOR_WORDS: Record<string, string> = {
  "*": "multiply times product",
  "/": "divide quotient",
  "%": "remainder modulo",
  "<<": "shift left",
  ">>": "shift right",
  "^": "xor exclusive",
  "~": "not invert",
};
const OPERATOR = /<<|>>|\+\+|--|&&|\|\||[*/%+\-&|^~]/g;
const C_COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;

/** The C operators a C equivalent uses. A `*` or `&` counts only between two
 *  operands, so a pointer cast or a dereference is not a multiply. */
function operatorsIn(c: string): Set<string> {
  const code = c.replace(C_COMMENT, " ");
  const found = new Set<string>();
  for (const match of code.matchAll(OPERATOR)) {
    const op = match[0];
    // A loop's i++ or a && says nothing about what the instruction does.
    if (op.length === 2 && op[0] === op[1] && op !== "<<" && op !== ">>") continue;
    if (op === "*" || op === "&") {
      const before = code.slice(0, match.index).trimEnd();
      const after = code.slice(match.index + 1).trimStart()[0] ?? "";
      if (!/[\w)\]]$/.test(before) || /\bgoto$/.test(before) || !/[\w(]/.test(after)) continue;
    }
    found.add(op);
  }
  return found;
}

/** One row, read once. `named` is what the row says it is: the mnemonic,
 *  summary and category, plus the operator's words when its C is that one
 *  operator (mul is `*`, so it is a multiply). `text` adds the whole C
 *  equivalent and its comments, a weaker match. */
export interface FinderEntry {
  instruction: ReferenceInstruction;
  group: FinderGroupId;
  named: string;
  text: string;
  operators: ReadonlySet<string>;
  order: number;
}

export function finderEntries(instructions: readonly ReferenceInstruction[]): FinderEntry[] {
  return instructions.map((instruction, order) => {
    const operators = operatorsIn(instruction.cExample);
    const words = [...operators].map((op) => OPERATOR_WORDS[op] ?? "").join(" ");
    const named = `${instruction.mnemonic} ${instruction.summary} ${instruction.category}`;
    return {
      instruction,
      group: groupOf(instruction),
      named: operators.size === 1 ? `${named} ${words}` : named,
      text: `${named} ${instruction.cExample} ${words}`,
      operators,
      order,
    };
  });
}

// Small words that carry no meaning in a search: "load a byte" is "load byte".
const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "to", "of", "into", "from", "in", "on", "at", "by", "with", "for", "it", "its",
]);
const QUERY_TOKEN = /<<|>>|[*/%+\-&|^~=]|[a-z0-9_]+/g;
const EXPRESSION_ONLY = /^[\sa-z0-9_()*/%+\-&|^~=<>]*$/;

/** The operators of a query written as C, such as "x * y" or "a << 2": short
 *  names and numbers around at least one operator. Null for anything else. */
function expressionOperators(query: string): Set<string> | null {
  if (!EXPRESSION_ONLY.test(query)) return null;
  const tokens = query.match(QUERY_TOKEN) ?? [];
  const operators = new Set(tokens.filter((t) => t in OPERATOR_WORDS || "+-&|".includes(t)));
  const operandsAreShort = tokens.every(
    (t) => t === "=" || operators.has(t) || t.length <= 3 || /^(?:\d|0x)/.test(t),
  );
  return operators.size > 0 && operandsAreShort ? operators : null;
}

/** The query's meaningful words, stop words dropped. */
function plainWords(query: string): string[] {
  return query.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "" && !STOP_WORDS.has(word));
}

/** Edit distance with a swap of two neighbours costing one ("mvo" is one
 *  from mov). Gives up past `limit`, so a long mnemonic costs little. */
export function editDistance(a: string, b: string, limit = Infinity): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, rows[i - 1][j] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], rows[i - 2][j - 2] + 1);
      }
    }
    rows.push(row);
  }
  return rows[a.length][b.length];
}

/** Inside one tier: what the course uses first, then the shorter (more basic)
 *  mnemonic, then the reference's own order. */
function byPlainness(course: ReadonlySet<string>) {
  return (a: FinderEntry, b: FinderEntry): number =>
    Number(course.has(b.instruction.mnemonic)) - Number(course.has(a.instruction.mnemonic)) ||
    a.instruction.mnemonic.length - b.instruction.mnemonic.length ||
    a.order - b.order;
}

/** How well a row answers a query: 0 the mnemonic itself, 1 a mnemonic that
 *  starts with it, 2 one that holds it, 3 what the row says it is (or C with
 *  exactly the typed operators), 4 anywhere in its C, 5 a mnemonic one or
 *  two typos away. Null when it does not answer. */
function tierOf(entry: FinderEntry, query: string, typos: boolean): number | null {
  const mnemonic = entry.instruction.mnemonic;
  if (query === mnemonic || (mnemonic === "b.cond" && /^b\.[a-z]{2}$/.test(query))) return 0;
  if (mnemonic.startsWith(query)) return 1;
  if (mnemonic.includes(query)) return 2;
  const operators = expressionOperators(query);
  if (operators) {
    if ([...operators].every((op) => entry.operators.has(op))) {
      return entry.operators.size === operators.size ? 3 : 4;
    }
  } else {
    const words = plainWords(query).join(" ");
    if (words !== "" && matchesAllWords(words, entry.named)) return 3;
    if (words !== "" && matchesAllWords(words, entry.text)) return 4;
  }
  const limit = query.length <= 4 ? 1 : 2;
  return typos && editDistance(query, mnemonic, limit) <= limit ? 5 : null;
}

/** The rows that answer `query`, best first; every row in order for a blank
 *  query. Typos count only when no mnemonic holds what was typed, so "add"
 *  never lists adc. */
export function findInstructions(
  entries: readonly FinderEntry[],
  rawQuery: string,
  course: ReadonlySet<string>,
): FinderEntry[] {
  const query = rawQuery.trim().toLowerCase();
  if (query === "") return [...entries];
  const typos =
    /^[a-z0-9.]{2,}$/.test(query) &&
    !entries.some((entry) => entry.instruction.mnemonic.includes(query));
  const plain = byPlainness(course);
  return entries
    .map((entry) => ({ entry, tier: tierOf(entry, query, typos) }))
    .filter((hit): hit is { entry: FinderEntry; tier: number } => hit.tier !== null)
    .sort((a, b) => a.tier - b.tier || plain(a.entry, b.entry))
    .map((hit) => hit.entry);
}

/** When nothing answers: the rows sharing the most of the query's words,
 *  then the nearest mnemonics by spelling, so the list is never empty. */
export function closestInstructions(
  entries: readonly FinderEntry[],
  rawQuery: string,
  course: ReadonlySet<string>,
  count = 5,
): FinderEntry[] {
  const query = rawQuery.trim().toLowerCase();
  const words = plainWords(query);
  const plain = byPlainness(course);
  return entries
    .map((entry) => ({
      entry,
      shared: words.filter((word) => matchesAllWords(word, entry.text)).length,
      distance: editDistance(query, entry.instruction.mnemonic),
    }))
    .sort((a, b) => b.shared - a.shared || a.distance - b.distance || plain(a.entry, b.entry))
    .slice(0, count)
    .map((hit) => hit.entry);
}

/** What the finder shows, as the URL query holds it, so a shared link opens
 *  the same list: `?q=shift+left&group=logic&show=all`. */
export interface FinderState {
  query: string;
  group: FinderGroupId | null;
  all: boolean;
}

export function readFinderState(search: string): FinderState {
  const params = new URLSearchParams(search);
  const group = params.get("group");
  return {
    query: params.get("q") ?? "",
    group: FINDER_GROUPS.some((g) => g.id === group) ? (group as FinderGroupId) : null,
    all: params.get("show") === "all",
  };
}

/** The query string for a state ("" for the default), keeping any other
 *  parameter the page carries. */
export function finderSearch(state: FinderState, current = ""): string {
  const params = new URLSearchParams(current);
  for (const key of ["q", "group", "show"]) params.delete(key);
  if (state.query !== "") params.set("q", state.query);
  if (state.group) params.set("group", state.group);
  if (state.all) params.set("show", "all");
  const search = params.toString();
  return search === "" ? "" : `?${search}`;
}
