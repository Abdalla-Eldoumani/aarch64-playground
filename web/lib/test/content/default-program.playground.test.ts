// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// The program /playground opens with is the first one a visitor assembles
// and steps, so it has to be clean: no lint mark when it loads, no note while
// it runs, and few enough steps to walk through by hand. The old default
// shadowed the `b` instruction with an m4 name and greeted every visitor
// with a warning.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

// Whatever file the page imports is the default, so a new default is held
// to these checks the moment it lands.
const page = fs.readFileSync(path.join(process.cwd(), "app/playground/page.tsx"), "utf8");
const stem = /import DEFAULT_SOURCE from "@\/public\/examples\/cpsc355\/([\w-]+)\.s\?raw"/.exec(page)?.[1];
const examples = path.join(process.cwd(), "public/examples/cpsc355");

describe("the cold-load default program", () => {
  it("is an example with an output fixture", () => {
    expect(stem).toBe("distance");
    expect(fs.existsSync(path.join(examples, "fixtures", `${stem}.stdout`))).toBe(true);
  });

  it("lints clean, steps to the end in under 300 steps with no note, and prints its fixture", () => {
    const source = fs.readFileSync(path.join(examples, `${stem}.s`), "utf8");
    // The output the university server printed for this program.
    const expected = fs.readFileSync(path.join(examples, "fixtures", `${stem}.stdout`), "utf8").replace(/\r\n/g, "\n");
    const emu = new Emulator();
    try {
      expect(emu.lint_source(source)).toEqual([]);
      const asm = emu.assemble_and_load(source) as { success: boolean; error?: string | null };
      expect(asm.error ?? null).toBeNull();
      let steps = 0;
      const notes: number[] = [];
      // Bounded by the count, never by the program.
      while (!emu.is_halted() && steps < 300) {
        const result = emu.step() as { error?: string | null };
        expect(result.error ?? null).toBeNull();
        steps++;
        notes.push(...emu.take_clobber_notes());
      }
      expect(emu.is_halted()).toBe(true);
      expect(steps).toBeLessThan(300);
      expect(notes).toEqual([]);
      expect(Number(emu.get_exit_code())).toBe(0);
      expect(emu.take_stdout()).toBe(expected);
    } finally {
      emu.free();
    }
  });
});
