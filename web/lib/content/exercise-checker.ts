/**
 * Grades an exercise by what the program does, never against a stored
 * solution, so any approach that gets the result passes and the feedback
 * cannot leak an answer. Comments are stripped before the structural checks,
 * so a mnemonic, number or string that appears only in a comment neither
 * counts nor trips a ban.
 */

import type {
  Acceptance,
  HiddenCase,
  ResultAssertion,
  StructuralAssertion,
} from "@/lib/content/exercise-schema";

/**
 * The structural subset of the embed's `EmbeddableState` the checker reads.
 * Declared here so this pure module never imports the heavy client embed; the
 * view passes the real `EmbeddableState`, which satisfies this shape.
 */
export interface CheckerSnapshot {
  registers: string[]; // x0..x30, each "0x" + 16 hex chars
  sp: string; // "0x" + 16 hex chars
  exitCode: number | null;
  stdout: string;
}

/** One evaluated result assertion, with the declared expectation and the observed value. */
export interface ResultCheck {
  assertion: ResultAssertion;
  pass: boolean;
  expected: string;
  actual: string;
}

/**
 * One evaluated structural assertion. `found` names the forbidden mnemonic a
 * forbids-instruction check tripped on, and `scopeMissing` says the function
 * an `in` names is not defined; both describe the student's own source, so
 * reporting them leaks nothing.
 */
export interface StructuralCheck {
  assertion: StructuralAssertion;
  pass: boolean;
  found?: string;
  scopeMissing?: boolean;
}

/** The full result: per-assertion outcomes, an overall pass, and a short summary. */
export interface CheckResult {
  pass: boolean;
  results: ResultCheck[];
  structural: StructuralCheck[];
  summary: string;
}

/** Longest observed value shown verbatim in feedback before it is clipped. */
const MAX_DISPLAY = 200;

/** The exit code a run reports when it never got that far. */
const NO_EXIT = "none (the program did not finish)";

/** A double-quoted string literal on one line, escapes included. */
const STRING_LITERAL = /"(?:[^"\\\n]|\\.)*"/.source;

/**
 * Strip AArch64 comments so structural checks see only real code. One
 * left-to-right pass: a `//` inside a string stays text, and a `//` inside a
 * block comment goes with the block.
 */
function stripComments(source: string): string {
  const pieces = new RegExp(`(${STRING_LITERAL})|/\\*[\\s\\S]*?\\*/|//[^\\n]*`, "g");
  return source.replace(pieces, (match, literal?: string) =>
    literal ?? (match.startsWith("/*") ? " " : ""),
  );
}

/**
 * Only what the machine executes: string literals emptied and label
 * definitions dropped, so `.string "mul"` or a label `mul:` is not a mul.
 */
function instructionText(text: string): string {
  return text
    .replace(new RegExp(STRING_LITERAL, "g"), '""')
    .replace(/^([ \t]*)[A-Za-z_.$][\w.$]*:/gm, "$1");
}

/** Escape every regex metacharacter so author text matches literally. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match `token` as a standalone token, case-insensitively: bounded on each
 * side by a string edge or a non-`[\w.]` character. A consuming prefix plus a
 * lookahead (no lookbehind) keeps it valid on every target browser. So "b.lt"
 * matches but "subs"/"b.ltx" do not, and forbidding 12 does not trip 120 or
 * 0x12.
 */
function standaloneTokenRegex(token: string): RegExp {
  return new RegExp(`(?:^|[^\\w.])${escapeRegExp(token)}(?![\\w.])`, "i");
}

/** Quote a string for feedback (so newlines read as \n) and clip it for display. */
function display(value: string): string {
  const clipped = value.length > MAX_DISPLAY ? `${value.slice(0, MAX_DISPLAY)}...` : value;
  return JSON.stringify(clipped);
}

/** Convert a finite number to a BigInt, or null if it is not an integer. */
function numberToBigInt(value: number): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * Read a 64-bit register value from the snapshot as a BigInt, mapping
 * "x0".."x30" to `registers[n]` and "sp" to `sp`. Returns null for a missing
 * or unparseable value so the caller can report it as unavailable.
 */
function parseReg64(snapshot: CheckerSnapshot, reg: string): bigint | null {
  let hex: string | undefined;
  if (reg === "sp") {
    hex = snapshot.sp;
  } else {
    const match = /^x(\d+)$/.exec(reg);
    if (match) {
      const index = Number(match[1]);
      if (index >= 0 && index <= 30) hex = snapshot.registers[index];
    }
  }
  if (typeof hex !== "string") return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

/** Evaluate one result assertion against the snapshot. */
function evaluateResult(assertion: ResultAssertion, snapshot: CheckerSnapshot): ResultCheck {
  switch (assertion.kind) {
    case "register": {
      const expected = String(assertion.equals);
      const value = parseReg64(snapshot, assertion.reg);
      if (value === null) {
        return { assertion, pass: false, expected, actual: "unavailable" };
      }
      // Show the signed reading; compare as unsigned 64-bit so an author's
      // `equals: -1` matches 0xffffffffffffffff.
      const actual = String(BigInt.asIntN(64, value));
      const expectedBig = numberToBigInt(assertion.equals);
      const pass =
        expectedBig !== null && BigInt.asUintN(64, value) === BigInt.asUintN(64, expectedBig);
      return { assertion, pass, expected, actual };
    }
    case "exit": {
      const expected = String(assertion.equals);
      const actual = snapshot.exitCode === null ? NO_EXIT : String(snapshot.exitCode);
      return { assertion, pass: snapshot.exitCode === assertion.equals, expected, actual };
    }
    case "stdout": {
      if ("equals" in assertion) {
        return {
          assertion,
          pass: snapshot.stdout === assertion.equals,
          expected: display(assertion.equals),
          actual: display(snapshot.stdout),
        };
      }
      let re: RegExp | null = null;
      try {
        re = new RegExp(assertion.matches);
      } catch {
        re = null;
      }
      if (re === null) {
        return {
          assertion,
          pass: false,
          expected: `/${assertion.matches}/`,
          actual: "(invalid pattern)",
        };
      }
      return {
        assertion,
        pass: re.test(snapshot.stdout),
        expected: `/${assertion.matches}/`,
        actual: display(snapshot.stdout),
      };
    }
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

/** A line that opens with a label definition, capturing the name. */
const LABEL_LINE = /^\s*([A-Za-z_.$][\w.$]*):/;

/**
 * Labels that start a function: main and _start, every `bl` target, and every
 * `.global` name. Loop labels inside a function are none of these, so they do
 * not end the function they sit in.
 */
function functionEntries(stripped: string): Set<string> {
  const entries = new Set(["main", "_start"]);
  for (const m of stripped.matchAll(/\bbl\s+([A-Za-z_.$][\w.$]*)/gi)) entries.add(m[1]);
  for (const m of stripped.matchAll(/\.globa?l\s+([A-Za-z_.$][\w.$]*)/gi)) entries.add(m[1]);
  return entries;
}

/**
 * The text of one function: from its label to the next function's label (or
 * the end). Null when the label is not defined, which fails the check rather
 * than quietly grading the whole file.
 */
function functionBody(stripped: string, label: string): string | null {
  const lines = stripped.split("\n");
  const start = lines.findIndex((line) => LABEL_LINE.exec(line)?.[1] === label);
  if (start < 0) return null;
  const entries = functionEntries(stripped);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const name = LABEL_LINE.exec(lines[i])?.[1];
    if (name !== undefined && name !== label && entries.has(name)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/**
 * Whether a mnemonic, or a mnemonic with its operand ("bl fact"), appears as
 * a token. Runs of blanks collapse first, so column-aligned source matches a
 * single-spaced pattern.
 */
function hasInstruction(text: string, mnemonic: string): boolean {
  const token = mnemonic.trim().replace(/\s+/g, " ");
  return standaloneTokenRegex(token).test(instructionText(text).replace(/[ \t]+/g, " "));
}

/** Evaluate one structural assertion against the comment-stripped source. */
function evaluateStructural(assertion: StructuralAssertion, strippedSource: string): StructuralCheck {
  const scope = assertion.in === undefined ? strippedSource : functionBody(strippedSource, assertion.in);
  if (scope === null) return { assertion, pass: false, scopeMissing: true };
  switch (assertion.kind) {
    case "uses-instruction":
      return { assertion, pass: hasInstruction(scope, assertion.mnemonic) };
    case "forbids-instruction": {
      const found = assertion.mnemonics.find((m) => hasInstruction(scope, m));
      return found === undefined ? { assertion, pass: true } : { assertion, pass: false, found };
    }
    case "forbids-literal": {
      if (typeof assertion.value === "number") {
        // A standalone numeric token: forbidding 12 ignores 120 / 0x12, but
        // catches the same value written in hex (0xc), which is still 12.
        const value = assertion.value;
        const hex =
          Number.isInteger(value) && value >= 0
            ? new RegExp(`(?:^|[^\\w.])0x0*${value.toString(16)}(?![\\w.])`, "i")
            : null;
        const present = standaloneTokenRegex(String(value)).test(scope) || !!hex?.test(scope);
        return { assertion, pass: !present };
      }
      // A plain substring for a forbidden string literal.
      return { assertion, pass: !scope.includes(assertion.value) };
    }
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

/**
 * What one run of the student's program on a hidden case produced
 * (lib/emulator/headless-run fills it in).
 */
export interface HiddenRunOutcome {
  /** The assembler's message, or null when the program built. */
  assembleError: string | null;
  /** A runtime fault, or null. */
  error: string | null;
  /** False when the step budget ran out before the program ended. */
  finished: boolean;
  stdout: string;
  exitCode: number | null;
  /** Whether main returned with sp where it found it; null when the program
   *  ended some other way (exit, an exit system call), where sp says nothing. */
  stackBalanced: boolean | null;
  /** False when the program wrote above main's entry sp, into its caller's frame. */
  frameIntact: boolean;
}

/** Why a hidden case failed, first cause first. */
export type HiddenMiss = "assemble" | "fault" | "unfinished" | "stdout" | "exit" | "stack" | "frame";

/**
 * One graded hidden case. `detail` carries only what the student's own run
 * did (its output, its exit code, its error), never the expected value.
 */
export interface HiddenCaseCheck {
  pass: boolean;
  miss: HiddenMiss | null;
  detail: string;
}

/**
 * Grade one hidden case. Beyond output and exit status, it fails an unbalanced
 * stack or a write into the caller's frame: real hardware punishes both later
 * (a misaligned sp at the next call, the caller's saved registers overwritten).
 */
export function checkHiddenCase(testCase: HiddenCase, outcome: HiddenRunOutcome): HiddenCaseCheck {
  const missed = (miss: HiddenMiss, detail = ""): HiddenCaseCheck => ({ pass: false, miss, detail });
  if (outcome.assembleError !== null) return missed("assemble", outcome.assembleError);
  if (outcome.error !== null) return missed("fault", outcome.error);
  if (!outcome.finished) return missed("unfinished");
  if (outcome.stdout !== testCase.stdout) return missed("stdout", display(outcome.stdout));
  if (outcome.exitCode !== testCase.exitCode) {
    return missed("exit", outcome.exitCode === null ? NO_EXIT : String(outcome.exitCode));
  }
  if (outcome.stackBalanced === false) return missed("stack");
  if (!outcome.frameIntact) return missed("frame");
  return { pass: true, miss: null, detail: "" };
}

/**
 * Check an emulator snapshot and source against the exercise's acceptance
 * criteria. Pure and deterministic: result assertions read the snapshot,
 * structural assertions read the comment-stripped source, and `pass` is true
 * only when every result and every structural check passes.
 */
export function checkExercise(
  acceptance: Acceptance,
  snapshot: CheckerSnapshot,
  source: string,
): CheckResult {
  const results = acceptance.results.map((assertion) => evaluateResult(assertion, snapshot));

  const stripped = stripComments(source);
  const structural = (acceptance.structural ?? []).map((assertion) =>
    evaluateStructural(assertion, stripped),
  );

  const total = results.length + structural.length;
  const failed =
    results.filter((check) => !check.pass).length +
    structural.filter((check) => !check.pass).length;
  const pass = failed === 0;
  const summary = pass
    ? "all checks passed"
    : `${total - failed} of ${total} checks passing`;

  return { pass, results, structural, summary };
}
