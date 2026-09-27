// Grade a program against a shipped coding exercise the way the practice page
// does, on the real node-target emulator: the visible run (the exercise's input,
// then end of input, as Check gives it), then every hidden input. Shared by the
// seeded-exercise contract and the checker-hole suite so both grade one way.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { WriteExercise } from "@/lib/content/exercise-schema";
import { loadExercise } from "@/lib/content/exercises";
import {
  checkExercise,
  checkHiddenCase,
  type CheckerSnapshot,
  type HiddenMiss,
} from "@/lib/content/exercise-checker";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { runHeadless } from "@/lib/emulator/headless-run";
import { parseArgs } from "@/lib/playground/args";

// createRequire cannot resolve the Vite `@/` alias, so require a
// node-resolvable absolute path under cwd (web/).
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

export const SOLUTIONS_DIR = path.join(process.cwd(), "lib/test/content/exercise-solutions");

/** The reference program kept beside the tests for one exercise. */
export function solutionFor(slug: string): string {
  return fs.readFileSync(path.join(SOLUTIONS_DIR, `${slug}.s`), "utf8");
}

/** A shipped exercise the emulator grades, or a thrown error naming it. */
export function codingExercise(slug: string): WriteExercise {
  const exercise = loadExercise(slug);
  if (!exercise || (exercise.variant !== "write" && exercise.variant !== "identify-bug")) {
    throw new Error(`${slug} is not an emulator-graded exercise`);
  }
  return exercise;
}

/** Run to completion with the input then end of input, snapshotted in the checker's hex format. */
export function runToSnapshot(source: string, args: string[] = [], stdin?: string): CheckerSnapshot {
  const emu = new Emulator();
  try {
    emu.assemble_and_load_with_args(source, args);
    if (stdin) emu.push_stdin(stdin);
    emu.close_stdin();
    // run_until_break returns control on halt/break/error/cap, so the loop is
    // bounded by its count, never by the program.
    for (let i = 0; i < 50 && !emu.is_halted(); i++) emu.run_until_break(100000);
    const hex = (v: bigint): string => "0x" + BigInt(v).toString(16).padStart(16, "0");
    const registers = Array.from({ length: 31 }, (_, i) => hex(emu.get_register(i)));
    const ec = emu.get_exit_code();
    return {
      registers,
      sp: hex(emu.get_sp()),
      exitCode: ec == null ? null : Number(ec),
      stdout: emu.take_stdout(),
    };
  } finally {
    emu.free();
  }
}

export interface Grade {
  pass: boolean;
  /** What failed first, for an assertion message. */
  why: string;
  /** Set when the visible run passed and a hidden input did not. */
  hiddenMiss?: HiddenMiss;
}

/** Grade one program on an exercise: the visible checks, then every hidden input. */
export async function grade(exercise: WriteExercise, source: string): Promise<Grade> {
  const visible = checkExercise(
    exercise.acceptance,
    runToSnapshot(source, parseArgs(exercise.args ?? ""), exercise.stdin),
    source,
  );
  if (!visible.pass) return { pass: false, why: `visible run: ${visible.summary}` };
  const emu = new Emulator();
  try {
    const machine = new EmulatorInstance(emu);
    for (const [index, testCase] of (exercise.hiddenCases ?? []).entries()) {
      const outcome = await runHeadless(machine, source, parseArgs(testCase.args ?? ""), testCase.stdin);
      const check = checkHiddenCase(testCase, outcome);
      if (check.miss !== null) {
        return {
          pass: false,
          why: `hidden input ${index + 1}: ${check.miss} ${check.detail}`,
          hiddenMiss: check.miss,
        };
      }
    }
  } finally {
    emu.free();
  }
  return { pass: true, why: "" };
}
