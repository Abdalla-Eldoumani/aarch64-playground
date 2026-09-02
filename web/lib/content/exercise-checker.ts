/**
 * The outcome-based exercise checker. `checkExercise` is a pure function: its
 * only inputs are the declared `acceptance`, an emulator `snapshot`, and the
 * student's `source` text. It evaluates result assertions against the snapshot
 * (registers / exit code / stdout) and structural assertions against the
 * comment-stripped source, returning a per-assertion pass/fail with a
 * human-readable expected-vs-actual.
 *
 * It never holds, reads, or compares a reference solution: any approach that
 * produces the declared outcomes passes, and the result carries no answer, so
 * feedback can be shown without leaking a solution. Comments are stripped
 * before structural checks so a mnemonic or literal that appears only inside a
 * comment neither satisfies a `uses-instruction` nor trips a `forbids-literal`.
 */

import type { Acceptance, ResultAssertion, StructuralAssertion } from "@/lib/content/exercise-schema";

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

/** One evaluated structural assertion. */
export interface StructuralCheck {
  assertion: StructuralAssertion;
  pass: boolean;
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

/**
 * Strip AArch64 comments so structural checks see only real code. Block
 * comments are removed first (so a `//` inside a block is already gone), then
 * line comments to end of line.
 */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlocks.replace(/\/\/[^\n]*/g, "");
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
      const actual = snapshot.exitCode === null ? "none" : String(snapshot.exitCode);
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

/** Evaluate one structural assertion against the comment-stripped source. */
function evaluateStructural(assertion: StructuralAssertion, strippedSource: string): StructuralCheck {
  switch (assertion.kind) {
    case "uses-instruction": {
      const present = standaloneTokenRegex(assertion.mnemonic).test(strippedSource);
      return { assertion, pass: present };
    }
    case "forbids-literal": {
      if (typeof assertion.value === "number") {
        // A standalone numeric token: forbidding 12 ignores 120 / 0x12.
        const present = standaloneTokenRegex(String(assertion.value)).test(strippedSource);
        return { assertion, pass: !present };
      }
      // A plain substring for a forbidden string literal.
      return { assertion, pass: !strippedSource.includes(assertion.value) };
    }
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
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
