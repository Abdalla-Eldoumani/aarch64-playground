/**
 * A program's own test cases: what it should print, and optionally exit
 * with, for a given stdin and command line. The playground's checks panel
 * edits them and share links carry them, so everything read from outside is
 * validated here and a malformed list is dropped whole.
 */

import type { HiddenRunOutcome } from "@/lib/content/exercise-checker";
import { validateArgs, validateStdin } from "@/lib/playground/upload-guard";

export interface ProgramCheck {
  name: string;
  stdin: string;
  /** argv[1..], in the args box's own form. */
  args: string;
  stdout: string;
  /** Compared only when present. */
  exitCode?: number;
}

/** More than this in a link is a hand-crafted payload, not a test list. */
export const MAX_CHECKS = 32;

/** Longer than any name a person types; the link's byte caps bound the rest. */
export const MAX_NAME_CHARS = 100;

/** A Linux exit status, as `$?` shows it. */
function isExitStatus(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

/** A run's exit code as `$?` shows it: the low byte of the emulator's signed int. */
export function exitStatus(code: number | null): number | null {
  return code === null ? null : code & 0xff;
}

function isCheck(value: unknown): value is ProgramCheck {
  if (value == null || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.name === "string" &&
    c.name.length <= MAX_NAME_CHARS &&
    typeof c.stdin === "string" &&
    validateStdin(c.stdin) === null &&
    typeof c.args === "string" &&
    validateArgs(c.args) === null &&
    typeof c.stdout === "string" &&
    // Expected output is held to the stdin cap: it is typed or pasted the same way.
    validateStdin(c.stdout) === null &&
    (c.exitCode === undefined || isExitStatus(c.exitCode))
  );
}

/**
 * The checks in an untrusted value, copied down to the known fields, or null
 * when anything about it is off: one bad entry drops the list, never the link.
 */
export function parseChecks(value: unknown): ProgramCheck[] | null {
  if (!Array.isArray(value) || value.length > MAX_CHECKS || !value.every(isCheck)) return null;
  return value.map((c: ProgramCheck) => ({
    name: c.name,
    stdin: c.stdin,
    args: c.args,
    stdout: c.stdout,
    ...(c.exitCode === undefined ? {} : { exitCode: c.exitCode }),
  }));
}

/**
 * The lines left once trailing spaces and tabs come off every line and
 * trailing newlines off the end. No output is no lines, not one empty one.
 */
function loosen(text: string): string[] {
  // Loops, not regexes: an end-anchored blank-run regex backtracks
  // quadratically, and the text can come from a share link.
  const lines = text.split("\n").map((line) => {
    let end = line.length;
    while (end > 0 && (line[end - 1] === " " || line[end - 1] === "\t")) end--;
    return line.slice(0, end);
  });
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** The first line where two outputs part, 1-based; null is a missing line. */
export interface OutputDifference {
  line: number;
  /** Where in that line they part, 0-based, after trailing blanks come off. */
  column: number;
  expected: string | null;
  actual: string | null;
}

export type OutputMatch =
  | { kind: "exact" }
  | { kind: "trailing-whitespace" }
  | { kind: "different"; difference: OutputDifference };

/**
 * Exact, or equal once trailing blanks on each line and trailing newlines at
 * the end are ignored (said so, since the course servers would show them).
 */
export function compareOutput(expected: string, actual: string): OutputMatch {
  if (expected === actual) return { kind: "exact" };
  const want = loosen(expected);
  const got = loosen(actual);
  const lines = Math.max(want.length, got.length);
  for (let i = 0; i < lines; i++) {
    if (want[i] !== got[i]) {
      const expected = want[i] ?? null;
      const actual = got[i] ?? null;
      const [a, b] = [expected ?? "", actual ?? ""];
      let column = 0;
      while (column < a.length && a[column] === b[column]) column++;
      return { kind: "different", difference: { line: i + 1, column, expected, actual } };
    }
  }
  return { kind: "trailing-whitespace" };
}

/** Why a check failed, the run's own ending first. */
export type CheckMiss = "fault" | "step-limit" | "stdout" | "exit";

export interface CheckVerdict {
  pass: boolean;
  miss: CheckMiss | null;
  /** The machine's message for a fault. */
  error: string | null;
  /** As `$?` shows it. */
  exitCode: number | null;
  /** Passed only by ignoring trailing whitespace. */
  loose: boolean;
  /** Set whenever the output differs, whatever ended the run. */
  difference: OutputDifference | null;
}

/** Grade one run of a program that assembled. */
export function gradeCheck(check: ProgramCheck, outcome: HiddenRunOutcome): CheckVerdict {
  const match = compareOutput(check.stdout, outcome.stdout);
  const difference = match.kind === "different" ? match.difference : null;
  // The workspace assembled before any check ran, so a load failing here is
  // as much a fault as one at run time.
  const error = outcome.assembleError ?? outcome.error;
  const exitCode = exitStatus(outcome.exitCode);
  const miss: CheckMiss | null =
    error !== null
      ? "fault"
      : !outcome.finished
        ? "step-limit"
        : difference !== null
          ? "stdout"
          : check.exitCode !== undefined && exitCode !== check.exitCode
            ? "exit"
            : null;
  return {
    pass: miss === null,
    miss,
    error,
    exitCode,
    loose: miss === null && match.kind === "trailing-whitespace",
    difference,
  };
}
