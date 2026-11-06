// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadAllExercises } from "@/lib/content/exercises";
import { validateLesson } from "@/lib/content/lesson-schema";
import type { LintWarning } from "@/lib/emulator/emulator-state";
import { wordLint } from "@/lib/emulator/frame-check";

// The frame check marks nothing a student is handed: every exercise starter
// and prediction program, every lesson editor, every reference program the
// tests keep. A mark on any of them would be a false one. The emulator's own
// suite holds the shipped examples, the C corpus and the course's programs
// to the same.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

function programs(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const exercise of loadAllExercises()) {
    if (exercise.variant === "write" || exercise.variant === "identify-bug") out.push([exercise.slug, exercise.starter]);
    if (exercise.variant === "frame") out.push([exercise.slug, exercise.program]);
    if (exercise.variant === "prediction") {
      exercise.predictions.forEach((p, i) => out.push([`${exercise.slug} prediction ${i}`, p.code]));
    }
  }
  const lessons = path.join(process.cwd(), "content/lessons");
  for (const file of fs.readdirSync(lessons).filter((name) => name.endsWith(".json"))) {
    const result = validateLesson(JSON.parse(fs.readFileSync(path.join(lessons, file), "utf8")));
    if (!result.ok) throw new Error(`${file}: ${result.error}`);
    result.lesson.body.forEach((block, i) => {
      if (block.type === "editor") out.push([`${file} block ${i}`, block.starter]);
    });
  }
  const solutions = path.join(process.cwd(), "lib/test/content/exercise-solutions");
  for (const file of fs.readdirSync(solutions)) out.push([file, fs.readFileSync(path.join(solutions, file), "utf8")]);
  return out;
}

describe("the frame check over the site's own programs", () => {
  it("marks none of them", () => {
    const emu = new Emulator();
    const all = programs();
    // What the editor shows: the-leaky-frame's deliberate 24-byte frame is
    // already the lint's mark, so the frame check adds none there.
    const marks = all.flatMap(([name, source]) =>
      wordLint(emu.lint_source(source) as LintWarning[])
        .filter((warning) => warning.message.startsWith("frame check: "))
        .map((warning) => `${name}: line ${warning.line}: ${warning.message}`),
    );
    // 293 on 2026-10-27: 68 starters, 81 prediction snippets, 76 lesson
    // editors, 68 reference programs. A loader that lost a group fails here.
    expect(all.length).toBeGreaterThanOrEqual(293);
    expect(marks).toEqual([]);
  });
});
