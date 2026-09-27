// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { validateLesson, type Lesson, type LessonBlock } from "@/lib/content/lesson-schema";
import { parseArgs } from "@/lib/playground/args";

// Every lesson program runs on the real node-target emulator and must print
// exactly what its lesson promises. A starter that fails to assemble, faults,
// or never halts is teaching a broken program; one lesson shipped a 64-bit
// load off a `.word` that printed garbage the moment a student added a second
// variable, and the prose of another quoted output its program no longer gave.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

const DIR = path.join(process.cwd(), "content/lessons");
const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".json"));

type EditorBlock = Extract<LessonBlock, { type: "editor" }>;

function loadLesson(file: string): Lesson {
  const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  const result = validateLesson(parsed);
  if (!result.ok) throw new Error(`${file} failed validation: ${result.error}`);
  return result.lesson;
}

function editorBlocks(file: string): EditorBlock[] {
  return loadLesson(file).body.filter((block): block is EditorBlock => block.type === "editor");
}

interface RunResult {
  error: string | null;
  halted: boolean;
  stdout: string;
  exitCode: number | null;
  notes: number;
}

/**
 * Run one program the way the servers run `./program args < stdin`: the
 * input ends after the authored seed, so a read-until-end program finishes
 * instead of waiting for a key the lesson frame would get from the student.
 */
function run(source: string, args: string[] = [], stdin?: string): RunResult {
  const emu = new Emulator();
  try {
    const asm = emu.assemble_and_load_with_args(source, args) as { error?: string | null };
    if (asm.error) {
      return { error: `assemble: ${asm.error}`, halted: false, stdout: "", exitCode: null, notes: 0 };
    }
    if (stdin) emu.push_stdin(stdin);
    emu.close_stdin();
    let error: string | null = null;
    // run_until_break hands control back at a halt or a fault, so the loop
    // is bounded by its count, never by the program.
    for (let i = 0; i < 20 && !emu.is_halted() && error === null; i++) {
      const step = emu.run_until_break(1_000_000) as { error?: string | null };
      error = step.error ?? null;
    }
    const code = emu.get_exit_code();
    return {
      error,
      halted: emu.is_halted(),
      stdout: emu.take_stdout(),
      exitCode: code === undefined ? null : Number(code),
      notes: emu.take_clobber_notes().length,
    };
  } finally {
    emu.free();
  }
}

describe("lesson programs print what their lessons promise", () => {
  for (const file of files) {
    it(`${file}: every editor matches its expectedOutput`, () => {
      const blocks = editorBlocks(file);
      blocks.forEach((block, k) => {
        const where = `${file} editor ${k + 1}`;
        expect(block.expectedOutput, `${where} has no expectedOutput`).toBeDefined();
        const result = run(block.starter, parseArgs(block.args ?? ""), block.stdin);
        expect(result.error, `${where} faulted`).toBeNull();
        expect(result.halted, `${where} never halted`).toBe(true);
        // A read of a register a library call clobbered is a program that
        // works here by luck and fails on the servers.
        expect(result.notes, `${where} read a register a call clobbered`).toBe(0);
        expect(result.stdout, `${where} stdout`).toBe(block.expectedOutput?.stdout);
        if (block.expectedOutput?.exitCode !== undefined) {
          expect(result.exitCode, `${where} exit status`).toBe(block.expectedOutput.exitCode);
        }
      });
    });
  }

  it("a code block that links to the playground is a whole program that runs", () => {
    // LessonArticle offers the playground link only on asm blocks that define
    // main; each of those must assemble and halt cleanly once it opens.
    let checked = 0;
    for (const file of files) {
      for (const block of loadLesson(file).body) {
        if (block.type !== "code" || block.language !== "asm") continue;
        if (!/^[ \t]*main:/m.test(block.source)) continue;
        checked += 1;
        const result = run(block.source);
        expect(result.error, `${file}: linked code block faulted`).toBeNull();
        expect(result.halted, `${file}: linked code block never halted`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("the authoring guide's worked lesson prints its own expectedOutput", () => {
    // The guide is where an author copies the shape from, so its example
    // has to hold to the same rule as the shipped lessons.
    const guide = fs.readFileSync(path.join(process.cwd(), "..", "docs", "authoring-content.md"), "utf8");
    const lessons = [...guide.matchAll(/```json\s*\n([\s\S]*?)```/g)]
      .map((m) => validateLesson(JSON.parse(m[1].trim()) as unknown))
      .flatMap((r) => (r.ok ? [r.lesson] : []));
    expect(lessons).toHaveLength(1);
    const editors = lessons[0].body.filter((b): b is EditorBlock => b.type === "editor");
    expect(editors.length).toBeGreaterThan(0);
    for (const block of editors) {
      expect(block.expectedOutput).toBeDefined();
      expect(run(block.starter, parseArgs(block.args ?? ""), block.stdin).stdout).toBe(
        block.expectedOutput?.stdout,
      );
    }
  });

  it("compares stdout byte for byte, so a changed program fails its lesson", () => {
    const [block] = editorBlocks("printing-strings-hello-world.json");
    const altered = block.starter.replace("Hello, World!", "Hello, world!");
    expect(altered).not.toBe(block.starter);
    expect(run(altered).stdout).not.toBe(block.expectedOutput?.stdout);
  });
});

describe("printing-defined-variables prints the .word it teaches", () => {
  it("prints 85 and stays correct when a neighbor variable exists", () => {
    const file = "printing-defined-variables.json";
    const [block] = editorBlocks(file);
    expect(block, "lesson has no editor block").toBeDefined();
    expect(run(block.starter).stdout).toBe("Integer Variable Content: 85\n");

    // The lesson's closing callout invites declaring more variables; a
    // 64-bit load off the .word broke the moment one followed it.
    const withNeighbor = block.starter.replace(
      "importantNumber:      .word 85",
      "importantNumber:      .word 85\n    secondNumber:      .word 7",
    );
    expect(withNeighbor).not.toBe(block.starter);
    expect(run(withNeighbor).stdout).toBe("Integer Variable Content: 85\n");
  });
});
