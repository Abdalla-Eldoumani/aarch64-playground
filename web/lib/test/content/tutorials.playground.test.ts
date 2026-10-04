// @vitest-environment node
// A tutorial's register check has to hold on the real machine at the point
// its step describes. find-max's "Verify the result" once asked for w0 = 70
// after the final printf, which had already returned 14 in w0.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { TUTORIALS } from "@/lib/content/tutorials";

const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

describe("find-max tutorial, Verify the result", () => {
  it("holds the value the step expects once the final printf has returned", () => {
    const tutorial = TUTORIALS.find((t) => t.id === "find-max");
    const step = tutorial?.steps.find((s) => s.title === "Verify the result");
    expect(step?.expect, "the step checks a register").toBeDefined();
    expect(step?.highlight, "the step highlights the lines it describes").toBeDefined();
    if (!tutorial || !step?.expect || !step.highlight) return;

    const source = fs.readFileSync(path.join(process.cwd(), "public", tutorial.sourcePath), "utf8");
    const lines = source.split(/\r?\n/);
    // "Step past the final printf": stop on the first instruction after the
    // last `bl printf` in the step's highlighted lines.
    let callLine = 0;
    for (let n = step.highlight.start; n <= step.highlight.end; n++) {
      if (/^\s*bl\s+printf\b/.test(lines[n - 1] ?? "")) callLine = n;
    }
    expect(callLine, "a bl printf inside the highlight").toBeGreaterThan(0);

    const emu = new Emulator();
    try {
      const asm = emu.assemble_and_load(source) as { error?: string | null };
      expect(asm.error ?? null).toBeNull();
      const map = emu.get_line_map();
      let stopAddr = -1;
      let stopLine = Infinity;
      for (let i = 0; i < map.length; i += 2) {
        if (map[i + 1] > callLine && map[i + 1] < stopLine) {
          stopLine = map[i + 1];
          stopAddr = map[i];
        }
      }
      expect(stopAddr, "an instruction after the call").toBeGreaterThanOrEqual(0);
      emu.set_breakpoint(stopAddr);
      emu.close_stdin();
      for (let i = 0; i < 20 && !emu.is_halted() && Number(emu.get_pc()) !== stopAddr; i++) {
        const result = emu.run_until_break(1_000_000) as { error?: string | null };
        expect(result.error ?? null).toBeNull();
      }
      expect(Number(emu.get_pc()), "stopped after the printf, not at the end").toBe(stopAddr);
      expect(emu.take_stdout()).toContain("Max value: 70\n");

      // The w view of a register is its low 32 bits.
      const w = (n: number) => Number(emu.get_register(n) & 0xffffffffn);
      const reg = Number(step.expect.reg.slice(1));
      expect(w(reg), `${step.expect.reg} at that point`).toBe(step.expect.value);
      expect(w(20)).toBe(70);
      // printf's return: the 14 characters of "Max value: 70\n".
      expect(w(0)).toBe(14);
    } finally {
      emu.free();
    }
  });
});
