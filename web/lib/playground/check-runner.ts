/**
 * Runs the playground's checks on the page's headless machine, never the one
 * the student is debugging, so a check run leaves the registers, breakpoints
 * and console on screen as they were.
 */

import type { HiddenRunOutcome } from "@/lib/content/exercise-checker";
import { runHeadless, withHeadlessMachine } from "@/lib/emulator/headless-run";
import { parseArgs } from "@/lib/playground/args";
import { combineSources, errorWithLocation, type Workspace } from "@/lib/playground/file-map";
import type { ProgramCheck } from "@/lib/playground/program-checks";

export type ChecksRun =
  /** The workspace did not assemble, so nothing ran. */
  | { kind: "assemble-error"; message: string }
  | { kind: "ran"; outcomes: HiddenRunOutcome[] };

/**
 * Assemble the workspace once as the gate, then run each check from a fresh
 * load (each load takes that check's argv, and resets the machine). `files`
 * are the working set's staged files, which every check's run can open. A
 * fault comes back led by its file and line, as the gate's error does.
 */
export function runChecks(
  workspace: Workspace,
  checks: ProgramCheck[],
  files: Record<string, string>,
): Promise<ChecksRun> {
  // The machine counts lines in the combined source; the student reads each file's own.
  const located = (error: string, line: number | null): string => {
    const first = line == null ? undefined : { line, message: error };
    return errorWithLocation(error, first, workspace.main, workspace.extras) ?? error;
  };
  return withHeadlessMachine(async (machine) => {
    const combined = combineSources(workspace.main, workspace.extras);
    const built = machine.assembleAndLoadWithArgs(combined, []);
    if (!built.success) {
      const message = located(built.error ?? "the program did not assemble", built.error_line);
      return { kind: "assemble-error", message };
    }
    const outcomes: HiddenRunOutcome[] = [];
    for (const check of checks) {
      const run = await runHeadless(machine, combined, parseArgs(check.args), check.stdin, files);
      outcomes.push(run.error === null ? run : { ...run, error: located(run.error, run.errorLine) });
    }
    return { kind: "ran", outcomes };
  });
}
