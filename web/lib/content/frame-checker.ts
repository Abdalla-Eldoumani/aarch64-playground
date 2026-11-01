/**
 * Grades a draw-the-frame exercise: each number the student typed against
 * the frame the emulator draws at the exercise's pause. The right numbers
 * are read from the machine, never from the exercise file, and never reach
 * the page: a field is marked right or wrong, no more. Imported on the
 * first check, so the page's own chunk never carries the frame decoding.
 */

import type { FrameExercise } from "@/lib/content/exercise-schema";
import type { PausedMachine } from "@/lib/emulator/headless-run";
import { decodeFrameLayout, decodeFrames, drawFrames } from "@/lib/emulator/stack-frames";

/** What the student typed: the frame size, each slot in the exercise's order, the saved fp and lr. */
export interface FrameAnswers {
  size: string;
  slots: string[];
  savedFp: string;
  savedLr: string;
}

/** One field after a check. `invalid` is anything but a whole number of bytes. */
export type FieldMark = "right" | "wrong" | "empty" | "invalid";

export interface FrameMarks {
  size: FieldMark;
  slots: FieldMark[];
  savedFp: FieldMark;
  savedLr: FieldMark;
}

/** The frame at the pause, as numbers of bytes; null for a slot the frame does not have. */
export interface ExpectedFrame {
  size: number;
  slots: (number | null)[];
  savedFp: number | null;
  savedLr: number | null;
}

/** Digits a field may hold: no course frame is a million bytes, and a longer string is never parsed. */
const MAX_DIGITS = 6;

/** A typed field as a whole number of bytes, or why it is not one. */
export function typedBytes(text: string): number | "empty" | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return "empty";
  if (trimmed.length > MAX_DIGITS || !/^[0-9]+$/.test(trimmed)) return "invalid";
  return Number(trimmed);
}

/**
 * The innermost frame at the pause, the one the program is stopped in, in
 * bytes from fp. Null when the machine stopped before that frame's fp was
 * set, so offsets from fp mean nothing yet.
 */
export function expectedFrame(exercise: Pick<FrameExercise, "slots">, paused: PausedMachine): ExpectedFrame | null {
  const snapshot = decodeFrames(paused.frames);
  const layout = decodeFrameLayout(paused.layout);
  if (!snapshot || !layout) return null;
  const stack = drawFrames({
    snapshot,
    layout,
    sp: paused.sp,
    fp: paused.fp,
    pc: paused.pc,
    // Offsets and sizes need no values, so no bytes are read.
    memory: [],
    written: [],
    regions: [],
    lineLabel: () => null,
  });
  const frame = stack.frames[stack.frames.length - 1];
  if (!frame || frame.base.name !== "fp") return null;
  const offsetOf = (name: string) => {
    const box = frame.boxes.find((b) => b.name === name);
    return box ? box.addr - frame.base.at : null;
  };
  return {
    size: frame.bytes,
    slots: exercise.slots.map((slot) => offsetOf(slot.name)),
    savedFp: offsetOf("saved fp"),
    savedLr: offsetOf("saved lr"),
  };
}

function mark(text: string, want: number | null): FieldMark {
  const typed = typedBytes(text);
  if (typed === "empty" || typed === "invalid") return typed;
  return typed === want ? "right" : "wrong";
}

/** Every field marked against the frame the machine drew. */
export function gradeFrame(expected: ExpectedFrame, answers: FrameAnswers): FrameMarks {
  return {
    size: mark(answers.size, expected.size),
    slots: expected.slots.map((want, i) => mark(answers.slots[i] ?? "", want)),
    savedFp: mark(answers.savedFp, expected.savedFp),
    savedLr: mark(answers.savedLr, expected.savedLr),
  };
}
