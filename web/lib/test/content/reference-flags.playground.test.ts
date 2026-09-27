// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { playgroundSource } from "@/lib/playground/playground-source";

// The reference badges each instruction "sets nzcv" or "does not set flags".
// This runs every entry's own example on the real node-target emulator and
// checks the claim where the instruction executes: just before each line that
// uses the mnemonic, two lines force NZCV to a known value (cmp xzr, xzr sets
// Z and C, so the ccmp's ne fails and it writes its literal), then the flags
// are read after that one instruction steps. Two different values are forced
// in two runs, so an instruction that writes the flags cannot match both by
// luck, and one that leaves them alone must hand both back untouched.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

// N=1 Z=0 C=0 V=1, and its complement.
const FORCED = [0b1001, 0b0110] as const;

/** The mnemonic a source line starts with, past an optional label. */
function lineMnemonic(line: string): string {
  const code = line.replace(/\/\/.*$/, "").replace(/^\s*[\w.]+:/, "").trim();
  return code.split(/\s+/)[0]?.toLowerCase() ?? "";
}

function usesMnemonic(line: string, mnemonic: string): boolean {
  const word = lineMnemonic(line);
  return mnemonic === "b.cond" ? /^b\.[a-z]{2}$/.test(word) : word === mnemonic;
}

/** The flags before and after every executed use of the mnemonic, with the
 *  flags forced to `value` just before each one. */
function observe(mnemonic: string, program: string, value: number) {
  const lines = program.split("\n");
  const out: string[] = [];
  const targets = new Set<number>(); // 1-based lines in `out`
  for (const line of lines) {
    if (usesMnemonic(line, mnemonic)) {
      out.push("        cmp     xzr, xzr", `        ccmp    xzr, xzr, ${value}, ne`);
      targets.add(out.length + 1);
    }
    out.push(line);
  }
  const emu = new Emulator();
  const assembled = emu.assemble_and_load_with_args(out.join("\n"), []) as {
    error?: string | null;
  };
  if (assembled.error) throw new Error(`${mnemonic}: ${assembled.error}`);
  const map = Array.from(emu.get_line_map());
  const addresses = new Set<number>();
  for (let i = 0; i + 1 < map.length; i += 2) {
    if (targets.has(map[i + 1])) addresses.add(map[i]);
  }
  const seen: Array<{ before: number; after: number }> = [];
  for (let step = 0; step < 5_000 && seen.length < 4 && !emu.is_halted(); step++) {
    const at = addresses.has(Number(emu.get_pc()));
    const before = emu.get_nzcv();
    const result = emu.step() as { error?: string | null };
    if (at) seen.push({ before, after: emu.get_nzcv() });
    if (result.error) break;
  }
  return seen;
}

describe("the reference's flag badges match the machine", () => {
  it("names at least one flag setter and one that leaves the flags alone", () => {
    expect(REFERENCE_INSTRUCTIONS.filter((i) => i.setsFlags).length).toBe(13);
    expect(REFERENCE_INSTRUCTIONS.some((i) => !i.setsFlags)).toBe(true);
  });

  it("checks every entry's claim where its example runs it", { timeout: 60_000 }, () => {
    const wrong: string[] = [];
    for (const inst of REFERENCE_INSTRUCTIONS) {
      const runs = FORCED.map((value) => ({
        value,
        seen: observe(inst.mnemonic, playgroundSource(inst), value),
      }));
      if (runs.some((r) => r.seen.length === 0)) {
        wrong.push(`${inst.mnemonic}: the example never runs it`);
        continue;
      }
      for (const { value, seen } of runs) {
        if (seen.some((s) => s.before !== value)) {
          wrong.push(`${inst.mnemonic}: the forced flags did not hold`);
        }
      }
      const changed = runs.some((r) => r.seen.some((s) => s.after !== s.before));
      if (inst.setsFlags && !changed) {
        wrong.push(`${inst.mnemonic}: badged as setting nzcv, but the flags never moved`);
      }
      if (!inst.setsFlags && changed) {
        wrong.push(`${inst.mnemonic}: badged as leaving the flags, but they moved`);
      }
    }
    expect(wrong, "flag claims the emulator contradicts").toEqual([]);
  });
});
