// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { playgroundSource } from "@/lib/playground/playground-source";

// The try-in-playground link carries playgroundSource(inst); if a payload fails
// to assemble the link drops the student onto an immediate error. This drives
// the real node-target emulator (the same assembler the playground runs) over
// every reference entry so an un-assemblable payload can never ship.
//
// The node-target build loads synchronously via require (it reads its .wasm from
// __dirname). createRequire cannot resolve the Vite `@/` alias, so require a
// node-resolvable absolute path under cwd (web/).
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

describe("every try-in-playground payload assembles", () => {
  it("assembles the deep-link source for every reference instruction", () => {
    const failures: string[] = [];
    for (const inst of REFERENCE_INSTRUCTIONS) {
      const emu = new Emulator();
      const result = emu.assemble_and_load_with_args(
        playgroundSource(inst),
        [],
      ) as { error?: string | null };
      if (result.error) failures.push(`${inst.mnemonic}: ${result.error}`);
    }
    expect(failures, "deep-link payloads that fail to assemble").toEqual([]);
  });

  it("runs every payload to a clean halt", { timeout: 30_000 }, () => {
    // The reference can also run these in place, so a payload that assembles
    // but faults mid-run (a load off a zero register, an unbalanced sp)
    // would strand the student on an error the entry never mentions.
    const failures: string[] = [];
    for (const inst of REFERENCE_INSTRUCTIONS) {
      const emu = new Emulator();
      emu.assemble_and_load_with_args(playgroundSource(inst), []);
      const result = emu.run_until_break(100_000) as {
        error?: string | null;
      };
      if (result.error) {
        failures.push(`${inst.mnemonic}: ${result.error}`);
      } else if (!emu.is_halted()) {
        failures.push(`${inst.mnemonic}: never halted`);
      }
    }
    expect(failures, "payloads that fail when run").toEqual([]);
  });
});
