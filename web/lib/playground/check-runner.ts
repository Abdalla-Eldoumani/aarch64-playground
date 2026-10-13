/**
 * Runs the playground's checks on a machine of their own, never the one the
 * student is debugging, so a check run leaves the registers, breakpoints and
 * console on screen as they were.
 */

import type { HiddenRunOutcome } from "@/lib/content/exercise-checker";
import type { EmulatorInstance } from "@/lib/emulator/emulator";
import { runHeadless, type HeadlessMachine } from "@/lib/emulator/headless-run";
import { parseArgs } from "@/lib/playground/args";
import { combineSources, errorWithLocation, type Workspace } from "@/lib/playground/file-map";
import type { ProgramCheck } from "@/lib/playground/program-checks";

export type ChecksRun =
  /** The workspace did not assemble, so nothing ran. */
  | { kind: "assemble-error"; message: string }
  | { kind: "ran"; outcomes: HiddenRunOutcome[] };

/**
 * Assemble the workspace once as the gate, then run each check from a fresh
 * load (each load takes that check's argv, and resets the machine).
 */
export async function runChecks(
  machine: HeadlessMachine,
  workspace: Workspace,
  checks: ProgramCheck[],
): Promise<ChecksRun> {
  const combined = combineSources(workspace.main, workspace.extras);
  const built = machine.assembleAndLoadWithArgs(combined, []);
  if (!built.success) {
    const error = built.error ?? "the program did not assemble";
    const first = built.error_line == null ? undefined : { line: built.error_line, message: error };
    return {
      kind: "assemble-error",
      message: errorWithLocation(error, first, workspace.main, workspace.extras) ?? error,
    };
  }
  const outcomes: HiddenRunOutcome[] = [];
  for (const check of checks) {
    outcomes.push(await runHeadless(machine, combined, parseArgs(check.args), check.stdin));
  }
  return { kind: "ran", outcomes };
}

/**
 * One machine for every check run on the page, made on the first run. Each
 * load resets it, so runs cannot leak into each other.
 */
let checksMachine: Promise<EmulatorInstance> | null = null;

export function machineForChecks(): Promise<EmulatorInstance> {
  checksMachine ??= import("@/lib/emulator/emulator")
    .then((m) => m.loadEmulator())
    .catch((error: unknown) => {
      // A failed load (offline, a stale chunk) must not stick for the page's life.
      checksMachine = null;
      throw error;
    });
  return checksMachine;
}
