/**
 * Run one program to its end the way the server runs `./program args < input`:
 * the input is queued and then closed, so a read past it sees end of input
 * instead of waiting for a key. The practice checker grades hidden cases on
 * this and the playground runs its checks on it.
 */

import type { EmulatorInstance } from "@/lib/emulator/emulator";
import type { HiddenRunOutcome } from "@/lib/content/exercise-checker";

/** The machine methods a headless run needs; EmulatorInstance has them all. */
export type HeadlessMachine = Pick<
  EmulatorInstance,
  | "assembleAndLoadWithArgs"
  | "uploadVfsFile"
  | "pushStdin"
  | "closeStdin"
  | "runUntilBreak"
  | "isHalted"
  | "takeStdout"
  | "getExitCode"
  | "getSp"
  | "getPc"
  | "getRegister"
  | "getMemoryRange"
>;

/**
 * One machine for every headless run on the page, made on first use. Each
 * assemble resets it, so runs cannot leak into each other, and a single
 * instance means repeated checks never pile up emulator memory.
 */
let shared: Promise<EmulatorInstance> | null = null;
let lastUse: Promise<void> = Promise.resolve();

function sharedMachine(): Promise<EmulatorInstance> {
  shared ??= import("@/lib/emulator/emulator")
    .then((m) => m.loadEmulator())
    .catch((error: unknown) => {
      // A failed load (offline, a stale chunk) must not stick for the page's life.
      shared = null;
      throw error;
    });
  return shared;
}

/**
 * Lend the page's headless machine to `use`. A run yields between slices and
 * a load resets the machine, so each use waits for the one before to end,
 * failed or not. The queue keeps no use's result alive.
 */
export function withHeadlessMachine<T>(use: (machine: HeadlessMachine) => Promise<T>): Promise<T> {
  const turn = lastUse.then(async () => use(await sharedMachine()));
  lastUse = turn.then(() => undefined, () => undefined);
  return turn;
}

/**
 * Steps one run may take. Every shipped reference solution needs well under a
 * million; the rest is room for a slower student approach, while a loop that
 * never ends gives up in a fraction of a second.
 */
export const HEADLESS_STEP_BUDGET = 5_000_000;

/** Steps per slice; the run yields between slices so the page keeps painting. */
const SLICE_STEPS = 250_000;

/**
 * Bytes checked above main's entry sp. That is the caller's frame on real
 * hardware; a local stored past the top of main's own frame lands here.
 */
const FRAME_GUARD_BYTES = 64;

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * `files` (name to text) go into the file system after the load, as a normal
 * run's seed files do.
 */
export async function runHeadless(
  machine: HeadlessMachine,
  source: string,
  args: string[],
  stdin: string | undefined,
  files: Record<string, string> = {},
): Promise<HiddenRunOutcome> {
  const loaded = machine.assembleAndLoadWithArgs(source, args);
  if (!loaded.success) {
    return {
      assembleError: loaded.error ?? "the program did not assemble",
      error: null,
      errorLine: null,
      finished: false,
      stdout: "",
      exitCode: null,
      stackBalanced: null,
      frameIntact: true,
    };
  }
  // The load emptied the file system.
  const encoder = new TextEncoder();
  for (const [name, body] of Object.entries(files)) machine.uploadVfsFile(name, encoder.encode(body));
  if (stdin) machine.pushStdin(stdin);
  machine.closeStdin();

  // main returns to whatever lr held at entry, so a halt there is a return
  // from main, and only then does the final sp say anything about its frame.
  const entrySp = BigInt(machine.getSp());
  const returnAddress = BigInt(machine.getRegister(30));
  const guardAddress = Number(entrySp);
  const guardBefore = machine.getMemoryRange(guardAddress, FRAME_GUARD_BYTES).slice();

  let error: string | null = null;
  let errorLine: number | null = null;
  let steps = 0;
  while (!machine.isHalted() && error === null && steps < HEADLESS_STEP_BUDGET) {
    const slice = machine.runUntilBreak(Math.min(SLICE_STEPS, HEADLESS_STEP_BUDGET - steps));
    error = slice.error;
    errorLine = slice.error_line;
    // A slice that made no progress without halting cannot make any later
    // either, so it ends the run rather than spinning until the budget.
    if (slice.steps_executed === 0 && !slice.halted) break;
    steps += slice.steps_executed;
    if (!machine.isHalted() && error === null) await nextTask();
  }

  const finished = machine.isHalted();
  const returnedFromMain = finished && BigInt(machine.getPc()) === returnAddress;
  return {
    assembleError: null,
    error,
    errorLine,
    finished,
    stdout: machine.takeStdout(),
    exitCode: machine.getExitCode(),
    stackBalanced: returnedFromMain ? BigInt(machine.getSp()) === entrySp : null,
    frameIntact: sameBytes(guardBefore, machine.getMemoryRange(guardAddress, FRAME_GUARD_BYTES)),
  };
}
