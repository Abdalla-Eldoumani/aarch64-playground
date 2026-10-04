// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { GUIDE_EXAMPLES } from "@/lib/content/calling-convention-examples";

// Every worked example in the calling-convention guide runs on the real
// node-target emulator and must print what the course server printed, byte
// for byte, and exit 0 as it did there. The excerpt the guide shows must be
// cut from the program that runs, so the two cannot drift apart.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

const STEPS = 200_000;
const EXAMPLES = Object.values(GUIDE_EXAMPLES);

function run(source: string) {
  const emu = new Emulator();
  try {
    const asm = emu.assemble_and_load_with_args(source, []) as { error?: string | null };
    if (asm.error) return { buildError: asm.error };
    const result = emu.run_until_break(STEPS) as { error?: string | null };
    const exit = emu.get_exit_code();
    return {
      buildError: null,
      stdout: emu.take_stdout(),
      halted: emu.is_halted(),
      exitCode: exit === undefined ? null : Number(exit),
      error: result.error ?? null,
    };
  } finally {
    emu.free();
  }
}

describe("the calling-convention examples behave as they did on the course server", () => {
  it("covers every example the guide shows", () => {
    expect(EXAMPLES.length).toBe(7);
  });

  for (const example of EXAMPLES) {
    it(`${example.id}: same stdout, exit 0`, () => {
      const got = run(example.source);
      expect(got.buildError, `${example.id}: should build`).toBeNull();
      expect(got.error, `${example.id}: run error`).toBeNull();
      expect(got.halted, `${example.id}: halted`).toBe(true);
      expect(got.exitCode, `${example.id}: exit status`).toBe(0);
      expect(got.stdout, `${example.id}: stdout`).toBe(example.stdout);
    });

    it(`${example.id}: every excerpt piece is a verbatim part of the program`, () => {
      const pieces = example.excerpt === "" ? [] : example.excerpt.split("\n...\n");
      for (const piece of pieces) {
        expect(example.source.includes(piece), `${example.id}: ${piece.slice(0, 40)}`).toBe(true);
      }
    });
  }
});
