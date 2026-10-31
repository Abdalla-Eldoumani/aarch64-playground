import { describe, expect, it } from "vitest";
import type { HiddenRunOutcome } from "@/lib/content/exercise-checker";
import {
  MAX_CHECKS,
  compareOutput,
  exitStatus,
  gradeCheck,
  parseChecks,
  type ProgramCheck,
} from "@/lib/playground/program-checks";

// The comparison rule a check passes by, the shape a check list must have to
// leave a link, and how one run is graded.

describe("compareOutput", () => {
  it("passes identical output as exact", () => {
    expect(compareOutput("sum = 6\n", "sum = 6\n")).toEqual({ kind: "exact" });
  });

  it("allows trailing spaces and tabs at line ends, and says so", () => {
    expect(compareOutput("a\nb\n", "a  \nb\t\n")).toEqual({ kind: "trailing-whitespace" });
  });

  it("allows trailing newlines at the end, either way round", () => {
    expect(compareOutput("done", "done\n\n")).toEqual({ kind: "trailing-whitespace" });
    expect(compareOutput("done\n\n\n", "done\n")).toEqual({ kind: "trailing-whitespace" });
  });

  it("does not allow leading spaces or a blank line in the middle", () => {
    expect(compareOutput("x\n", " x\n")).toEqual({
      kind: "different",
      difference: { line: 1, column: 0, expected: "x", actual: " x" },
    });
    expect(compareOutput("a\nb\n", "a\n\nb\n")).toEqual({
      kind: "different",
      difference: { line: 2, column: 0, expected: "b", actual: "" },
    });
  });

  it("names the first differing line, not a later one", () => {
    expect(compareOutput("1\n2\n3\n", "1\n5\n7\n")).toEqual({
      kind: "different",
      difference: { line: 2, column: 0, expected: "2", actual: "5" },
    });
  });

  it("reports a missing line as null on the side that ran out", () => {
    expect(compareOutput("one\ntwo\n", "one\n")).toEqual({
      kind: "different",
      difference: { line: 2, column: 0, expected: "two", actual: null },
    });
    expect(compareOutput("one\n", "one\nextra\n")).toEqual({
      kind: "different",
      difference: { line: 2, column: 0, expected: null, actual: "extra" },
    });
  });

  it("reads no output as no lines, so blank output still matches an empty expectation", () => {
    expect(compareOutput("", "  \n\n")).toEqual({ kind: "trailing-whitespace" });
    expect(compareOutput("hi\n", "")).toEqual({
      kind: "different",
      difference: { line: 1, column: 0, expected: "hi", actual: null },
    });
  });

  it("names the column where the lines part, past a shared prefix and past any clip", () => {
    expect(compareOutput("sum = 6\n", "sum = 60\n")).toMatchObject({ difference: { column: 7 } });
    expect(compareOutput("sum = 60\n", "sum = 6  \n")).toMatchObject({ difference: { column: 7 } });
    const head = "1 ".repeat(125);
    expect(compareOutput(`${head}7 8\n`, `${head}9 8\n`)).toMatchObject({
      difference: { line: 1, column: 250 },
    });
  });

  it("does not treat a carriage return as trailing whitespace", () => {
    expect(compareOutput("a\n", "a\r\n").kind).toBe("different");
  });

  it("compares a long run of blanks in linear time", () => {
    // A backtracking trim took seconds on each of these.
    const started = performance.now();
    expect(compareOutput(" ".repeat(100_000) + "x", "").kind).toBe("different");
    expect(compareOutput("\n".repeat(100_000) + "x", "").kind).toBe("different");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("parseChecks", () => {
  const good: ProgramCheck = { name: "adds", stdin: "2 3\n", args: "", stdout: "5\n", exitCode: 0 };

  it("keeps a well-formed list, with and without an exit code", () => {
    const noExit = { name: "b", stdin: "", args: "-v", stdout: "" };
    expect(parseChecks([good, noExit])).toEqual([good, noExit]);
  });

  it("copies only the known fields", () => {
    expect(parseChecks([{ ...good, extra: "x" }])).toEqual([good]);
  });

  it("drops the whole list when any entry is malformed", () => {
    expect(parseChecks([good, { ...good, stdout: 5 }])).toBeNull();
    expect(parseChecks([good, { name: "x", stdin: "", stdout: "" }])).toBeNull();
    expect(parseChecks([null])).toBeNull();
    expect(parseChecks("checks")).toBeNull();
    expect(parseChecks({ 0: good })).toBeNull();
  });

  it("refuses an exit code that is not a Linux exit status", () => {
    for (const exitCode of [-1, 256, 1.5, "0", Number.NaN]) {
      expect(parseChecks([{ ...good, exitCode }])).toBeNull();
    }
    expect(parseChecks([{ ...good, exitCode: 255 }])).not.toBeNull();
  });

  it("holds every field to its cap", () => {
    expect(parseChecks([{ ...good, name: "n".repeat(101) }])).toBeNull();
    expect(parseChecks([{ ...good, args: "a".repeat(1001) }])).toBeNull();
    expect(parseChecks([{ ...good, stdin: "a".repeat(100 * 1024 + 1) }])).toBeNull();
    expect(parseChecks([{ ...good, stdout: "a".repeat(100 * 1024 + 1) }])).toBeNull();
  });

  it("caps the number of checks", () => {
    expect(parseChecks(Array.from({ length: MAX_CHECKS }, () => good))).toHaveLength(32);
    expect(parseChecks(Array.from({ length: MAX_CHECKS + 1 }, () => good))).toBeNull();
  });
});

describe("gradeCheck", () => {
  function run(over: Partial<HiddenRunOutcome> = {}): HiddenRunOutcome {
    return {
      assembleError: null,
      error: null,
      errorLine: null,
      finished: true,
      stdout: "5\n",
      exitCode: 0,
      stackBalanced: true,
      frameIntact: true,
      frameNotes: [],
      ...over,
    };
  }
  const check: ProgramCheck = { name: "adds", stdin: "2 3\n", args: "", stdout: "5\n" };

  it("passes matching output and ignores the exit code when the check names none", () => {
    expect(gradeCheck(check, run({ exitCode: 7 }))).toEqual({
      pass: true,
      miss: null,
      error: null,
      exitCode: 7,
      loose: false,
      difference: null,
    });
  });

  it("marks a pass that needed the trailing-whitespace allowance", () => {
    expect(gradeCheck(check, run({ stdout: "5   \n\n" })).loose).toBe(true);
  });

  it("fails a wrong exit code only when the check states one", () => {
    const verdict = gradeCheck({ ...check, exitCode: 0 }, run({ exitCode: 3 }));
    expect(verdict.miss).toBe("exit");
    expect(verdict.exitCode).toBe(3);
  });

  it("grades and reports the exit code as $? shows it, the low byte", () => {
    const minusOne = gradeCheck({ ...check, exitCode: 255 }, run({ exitCode: -1 }));
    expect(minusOne).toMatchObject({ pass: true, exitCode: 255 });
    expect(gradeCheck({ ...check, exitCode: 0 }, run({ exitCode: 256 })).pass).toBe(true);
    expect([exitStatus(-1), exitStatus(256), exitStatus(null)]).toEqual([255, 0, null]);
  });

  it("fails wrong output with the first difference", () => {
    const verdict = gradeCheck(check, run({ stdout: "6\n" }));
    expect(verdict.miss).toBe("stdout");
    expect(verdict.difference).toEqual({ line: 1, column: 0, expected: "5", actual: "6" });
  });

  it("puts how the run ended ahead of the output, and still shows the output", () => {
    const crashed = gradeCheck(check, run({ error: "segmentation fault", stdout: "", finished: true }));
    expect(crashed.miss).toBe("fault");
    expect(crashed.error).toBe("segmentation fault");
    expect(crashed.difference).toEqual({ line: 1, column: 0, expected: "5", actual: null });
    expect(gradeCheck(check, run({ finished: false, exitCode: null })).miss).toBe("step-limit");
  });

  it("treats a load failure as a fault", () => {
    const verdict = gradeCheck(check, run({ assembleError: "no main", finished: false, stdout: "" }));
    expect(verdict.miss).toBe("fault");
    expect(verdict.error).toBe("no main");
  });
});
