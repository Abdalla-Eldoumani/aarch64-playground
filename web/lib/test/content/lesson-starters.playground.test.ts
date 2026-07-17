// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { validateLesson } from "@/lib/content/lesson-schema";

// Every lesson editor starter runs on the real node-target emulator. A
// starter that fails to assemble, faults, or never halts is teaching a
// broken program; one lesson shipped a 64-bit load off a `.word` that
// printed garbage the moment a student added a second variable, and no
// test executed lesson starters at all.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

const DIR = path.join(process.cwd(), "content/lessons");
const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".json"));

interface EditorBlock {
  type: "editor";
  starter: string;
  args?: string;
  stdin?: string;
}

function editorBlocks(file: string): EditorBlock[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  const result = validateLesson(parsed);
  if (!result.ok) throw new Error(`${file} failed validation: ${result.error}`);
  return result.lesson.body.filter(
    (block): block is EditorBlock => block.type === "editor",
  );
}

describe("lesson editor starters run clean on the real emulator", () => {
  for (const file of files) {
    it(`${file} starters assemble, run, and halt without error`, () => {
      for (const block of editorBlocks(file)) {
        const emu = new Emulator();
        const asm = emu.assemble_and_load_with_args(
          block.starter,
          block.args ? block.args.split(/\s+/).filter(Boolean) : [],
        ) as { success?: boolean; error?: string | null };
        expect(asm.error ?? null, `${file}: starter failed to assemble`).toBeNull();
        if (block.stdin) emu.push_stdin(block.stdin);
        const run = emu.run_until_break(1_000_000) as { error?: string | null };
        expect(run.error ?? null, `${file}: starter faulted at runtime`).toBeNull();
        expect(emu.is_halted(), `${file}: starter never halted`).toBe(true);
      }
    });
  }
});

describe("printing-defined-variables prints the .word it teaches", () => {
  it("prints 85 and stays correct when a neighbor variable exists", () => {
    const file = "printing-defined-variables.json";
    const [block] = editorBlocks(file);
    expect(block, "lesson has no editor block").toBeDefined();

    const emu = new Emulator();
    emu.assemble_and_load_with_args(block.starter, []);
    emu.run_until_break(1_000_000);
    expect(emu.take_stdout()).toBe("Integer Variable Content: 85\n");

    // The lesson's closing callout invites declaring more variables; a
    // 64-bit load off the .word broke the moment one followed it.
    const withNeighbor = block.starter.replace(
      "importantNumber:      .word 85",
      "importantNumber:      .word 85\n    secondNumber:      .word 7",
    );
    expect(withNeighbor).not.toBe(block.starter);
    const emu2 = new Emulator();
    emu2.assemble_and_load_with_args(withNeighbor, []);
    emu2.run_until_break(1_000_000);
    expect(emu2.take_stdout()).toBe("Integer Variable Content: 85\n");
  });
});
