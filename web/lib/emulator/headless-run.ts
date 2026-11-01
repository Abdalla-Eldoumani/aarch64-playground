/**
 * Run one program to its end the way the server runs `./program args < input`:
 * the input is queued and then closed, so a read past it sees end of input
 * instead of waiting for a key. The practice checker grades hidden cases on
 * this and the playground runs its checks on it. A run also notes the calls
 * it checks that broke a stack rule, up to eight notes a run and none after
 * a ret that goes astray; `runToPause` stops a frame exercise's program where
 * its frame is to be drawn.
 */

import type { EmulatorInstance } from "@/lib/emulator/emulator";
import type { FrameNote, HiddenRunOutcome } from "@/lib/content/exercise-checker";
import { callDepth, type FrameLayoutPayload } from "@/lib/emulator/frame-data";
import { parseLineMap, pcToSourceLineFromMap } from "@/lib/emulator/line-map";
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
 * Stops one run reads the call stack at: calls, rets and returns, a branch or
 * fall-through onto a function's first instruction, a ret that goes astray,
 * and also slice ends, sleeps, the fault that ends a run and the halt, since
 * the run reads it after every slice.
 *
 * shortcut: a long run is checked only in part: past these stops the rest of
 * the run goes unchecked; raise this if an exercise ever needs more.
 */
const MAX_FRAME_STOPS = 2_000;

/** A `ret` through any register: the register sits in bits 5 to 9. */
const RET = 0xd65f0000;
const RET_MASK = 0xfffffc1f;

/**
 * Notes one run keeps. Their key (kind, function, line, register) already
 * makes a call broken inside a loop one note, so this bounds the list for a
 * program that breaks the rules in many places.
 */
const MAX_FRAME_NOTES = 8;

/**
 * The per-call frame checks, read from the machine's own call tracking. The
 * run stops at every call (a breakpoint on each function's first
 * instruction), every ret (a breakpoint on each one in a function) and every
 * return (a goal one call shallower than the program stands) until the stops
 * run out or a ret goes astray, and each stop reads the call stack the frames
 * view draws; the stray ret is the last thing a run notes. Null on a wasm
 * build without the frames exports.
 */
function watchFrames(machine: HeadlessMachine) {
  const start = machine.frames();
  const payload = machine.frameLayout();
  const layout: FrameLayout | null = payload && decodeFrameLayout(payload);
  if (!start || !layout) return null;
  const lines = parseLineMap(machine.getLineMap());
  const lineOf = (pc: number) => pcToSourceLineFromMap(pc, lines);
  const nameAt = (pc: number) =>
    layout.functions.find((fn) => pc >= fn.entry && pc < fn.end)?.name ?? `0x${pc.toString(16)}`;
  // Each ret's address, and the register it returns through.
  const rets = new Map<number, number>();
  for (const fn of layout.functions) {
    machine.setBreakpoint(fn.entry);
    const code = machine.getMemoryRange(fn.entry, fn.end - fn.entry);
    const words = new DataView(code.buffer, code.byteOffset, code.byteLength);
    for (let at = 0; at + 4 <= code.byteLength; at += 4) {
      const word = words.getUint32(at, true);
      if (((word & RET_MASK) >>> 0) !== RET) continue;
      rets.set(fn.entry + at, (word >>> 5) & 31);
      machine.setBreakpoint(fn.entry + at);
    }
  }

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
      const astray = snapshot.badReturn;
      if (astray) {
        // Named for the code that holds the ret: a function reached by b is not
        // on the stack. Past a stray ret the call stack is stale, so the run
        // notes nothing more and goes straight through, as at the stop cap.
        add({ kind: "return", fn: nameAt(astray.pc), line: lineOf(astray.pc) });
        stops = MAX_FRAME_STOPS;
        machine.clearAllBreakpoints();
        return;
      }
      for (const row of snapshot.frames) {
        const fn = nameAt(row.entry);
        if (row.spEntry % 16 !== 0) add({ kind: "sp", fn, line: lineOf(row.callPc) });
        if (row.fpHit) add({ kind: "fp", fn, line: lineOf(row.fpHit.pc) });
        if (row.lrHit) add({ kind: "lr", fn, line: lineOf(row.lrHit.pc) });
      }
      // A ret hands the caller fp as it is now; main's own ret is left out. A
      // ret is checked only when sp is back at the innermost call's entry value
      // and its register holds that call's return address, so a ret that goes
      // astray or skips past its caller is not.
      const pc = machine.getPc();
      const through = rets.get(pc);
      const call = snapshot.frames.at(-1);
      if (
        through !== undefined &&
        call &&
        call.index > 0 &&
        Number(machine.getSp()) === call.spEntry &&
        Number(machine.getRegister(through)) === call.retAddr &&
        Number(machine.getRegister(29)) !== call.fpEntry
      ) {
        add({ kind: "fpChanged", fn: nameAt(pc), line: lineOf(pc) });
      }
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
  const at = parseLineMap(machine.getLineMap()).lineToAddr.get(pause.line);
  if (at === undefined) return null;
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
