/**
 * Run one program to its end the way the server runs `./program args < input`:
 * the input is queued and then closed, so a read past it sees end of input
 * instead of waiting for a key. The practice checker grades hidden cases on
 * this and the playground runs its checks on it. A run also notes each call
 * that broke a stack rule, and `runToPause` stops a frame exercise's program
 * where its frame is to be drawn.
 */

import type { EmulatorInstance } from "@/lib/emulator/emulator";
import type { FrameNote, HiddenRunOutcome } from "@/lib/content/exercise-checker";
import { callDepth, type FrameLayoutPayload } from "@/lib/emulator/frame-data";
import { decodeFrameLayout, decodeFrames, type FrameLayout } from "@/lib/emulator/stack-frames";

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
  | "frames"
  | "frameLayout"
  | "getLineMap"
  | "setBreakpoint"
  | "clearAllBreakpoints"
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
 * Stops one run makes at calls and returns to read the call stack; past
 * them the rest of the run goes straight through.
 *
 * shortcut: a program making more than about 1,000 calls is checked on its
 * first ones only; raise this if an exercise ever needs more.
 */
const MAX_FRAME_STOPS = 2_000;

/** Notes one run keeps, so a call broken inside a loop cannot flood the result. */
const MAX_FRAME_NOTES = 8;

/** The last assemble's line map, address to source line. */
function sourceLines(machine: HeadlessMachine): Map<number, number> {
  const flat = machine.getLineMap();
  const lines = new Map<number, number>();
  for (let i = 0; i + 1 < flat.length; i += 2) lines.set(flat[i], flat[i + 1]);
  return lines;
}

/**
 * The per-call frame checks, read from the machine's own call tracking. The
 * run stops at every call (a breakpoint on each function's first
 * instruction) and every return (a goal one call shallower than the program
 * stands), and each stop reads the call stack the frames view draws. Null on
 * a wasm build without the frames exports.
 */
function watchFrames(machine: HeadlessMachine) {
  const start = machine.frames();
  const payload = machine.frameLayout();
  const layout: FrameLayout | null = payload && decodeFrameLayout(payload);
  if (!start || !layout) return null;
  const lines = sourceLines(machine);
  const lineOf = (pc: number) => lines.get(pc) ?? null;
  const nameAt = (pc: number) =>
    layout.functions.find((fn) => pc >= fn.entry && pc < fn.end)?.name ?? `0x${pc.toString(16)}`;
  for (const fn of layout.functions) machine.setBreakpoint(fn.entry);

  const notes = new Map<string, FrameNote>();
  const add = (note: FrameNote) => {
    const key = `${note.kind} ${note.fn} ${note.line} ${note.register}`;
    if (notes.size < MAX_FRAME_NOTES && !notes.has(key)) notes.set(key, note);
  };
  let depth = callDepth(start);
  let stops = 0;
  return {
    goal: () => (stops < MAX_FRAME_STOPS ? { depth: depth - 1 } : undefined),
    read() {
      if (stops === MAX_FRAME_STOPS) return;
      stops += 1;
      if (stops === MAX_FRAME_STOPS) machine.clearAllBreakpoints();
      const numbers = machine.frames();
      const snapshot = numbers && decodeFrames(numbers);
      if (!numbers || !snapshot) return;
      depth = callDepth(numbers);
      for (const row of snapshot.frames) {
        const fn = nameAt(row.entry);
        // main starts where the loader left sp; every other row is a call.
        if (row.index > 0 && row.spEntry % 16 !== 0) add({ kind: "sp", fn, line: lineOf(row.callPc) });
        if (row.fpHit) add({ kind: "fp", fn, line: lineOf(row.fpHit.pc) });
        if (row.lrHit) add({ kind: "lr", fn, line: lineOf(row.lrHit.pc) });
      }
      const astray = snapshot.badReturn;
      if (astray) add({ kind: "return", fn: nameAt(astray.call.entry), line: lineOf(astray.pc) });
      // The machine records these at every ret but main's.
      for (const { register, retPc } of snapshot.leftovers) {
        add({ kind: "callee", fn: nameAt(retPc), line: lineOf(retPc), register });
      }
    },
    notes: () => [...notes.values()],
  };
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
      frameNotes: [],
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
  let sinceYield = 0;
  const watch = watchFrames(machine);
  try {
    while (!machine.isHalted() && error === null && steps < HEADLESS_STEP_BUDGET) {
      const slice = machine.runUntilBreak(Math.min(SLICE_STEPS, HEADLESS_STEP_BUDGET - steps), watch?.goal());
      error = slice.error;
      errorLine = slice.error_line;
      watch?.read();
      // A slice that made no progress without halting cannot make any later
      // either, so it ends the run rather than spinning until the budget.
      if (slice.steps_executed === 0 && !slice.halted) break;
      steps += slice.steps_executed;
      sinceYield += slice.steps_executed;
      // A stop at a call or a return is not a slice of its own: the page
      // still gets its turn once per SLICE_STEPS.
      const frameStop = slice.hit_breakpoint || slice.reached || slice.bad_return;
      if (!machine.isHalted() && error === null && (!frameStop || sinceYield >= SLICE_STEPS)) {
        sinceYield = 0;
        await nextTask();
      }
    }
  } finally {
    machine.clearAllBreakpoints();
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
    frameNotes: watch?.notes() ?? [],
  };
}

/** What the frames view draws from, read at a frame exercise's pause. */
export interface PausedMachine {
  frames: number[];
  layout: FrameLayoutPayload;
  sp: number;
  fp: number;
  pc: number;
}

/**
 * Run `source` until it is about to run line `pause.line` for the
 * `pause.hit`th time, and read the call stack there. Null when the program
 * does not assemble, never gets there, or the wasm build cannot draw frames.
 */
export async function runToPause(
  machine: HeadlessMachine,
  source: string,
  pause: { line: number; hit: number },
): Promise<PausedMachine | null> {
  if (!machine.assembleAndLoadWithArgs(source, []).success) return null;
  machine.closeStdin();
  const addresses = [...sourceLines(machine)].filter(([, line]) => line === pause.line).map(([addr]) => addr);
  if (addresses.length === 0) return null;
  const at = Math.min(...addresses);
  machine.setBreakpoint(at);
  try {
    let hits = 0;
    let steps = 0;
    while (!machine.isHalted() && steps < HEADLESS_STEP_BUDGET) {
      const slice = machine.runUntilBreak(Math.min(SLICE_STEPS, HEADLESS_STEP_BUDGET - steps));
      if (slice.error !== null || slice.steps_executed === 0) return null;
      steps += slice.steps_executed;
      if (slice.hit_breakpoint && slice.pc === at && ++hits === pause.hit) {
        const frames = machine.frames();
        const layout = machine.frameLayout();
        if (!frames || !layout) return null;
        const [sp, fp] = [machine.getSp(), machine.getRegister(29)].map(Number);
        return { frames, layout, sp, fp, pc: machine.getPc() };
      }
      if (!slice.hit_breakpoint) await nextTask();
    }
    return null;
  } finally {
    machine.clearAllBreakpoints();
  }
}
