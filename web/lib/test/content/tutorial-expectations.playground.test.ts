// @vitest-environment node
// Every register check a tutorial offers, run on the real machine at the
// point its step describes: the first instruction after the step's
// highlighted lines, or the end of the program when nothing follows them.
// A check that only named a real register could still promise a value the
// program never holds there, as find-max's once did.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { TUTORIALS, type Tutorial, type TutorialStep } from "@/lib/content/tutorials";
import { parseArgs } from "@/lib/playground/args";

const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

/** What the register panel shows for a name: a w register is the low 32 bits. */
function readReg(emu: InstanceType<typeof Emulator>, name: string): number {
  const value = BigInt(emu.get_register(Number(name.slice(1))));
  return Number(name.startsWith("w") ? value & 0xffffffffn : value);
}

type Checked = { tutorial: Tutorial; step: TutorialStep & { expect: NonNullable<TutorialStep["expect"]> } };

const CHECKS: Checked[] = TUTORIALS.flatMap((tutorial) =>
  tutorial.steps.flatMap((step) => (step.expect ? [{ tutorial, step: { ...step, expect: step.expect } }] : [])),
);

describe("tutorial register checks hold on the machine", () => {
  it("covers every check in the catalog", () => {
    // The table below runs each check; this list keeps it from running none.
    expect(CHECKS.map(({ tutorial, step }) => `${tutorial.id}: ${step.expect.reg}`)).toEqual([
      "arithmetic: x19",
      "arithmetic: x21",
      "stack-frames: w23",
      "records-and-arrays: w19",
      "find-max: w20",
      "static-vs-argv: w20",
      "syscalls: w0",
    ]);
  });

  it.each(CHECKS.map((c) => [`${c.tutorial.id} / ${c.step.title}`, c] as const))(
    "%s",
    (_label, { tutorial, step }) => {
      expect(step.highlight, "a checked step highlights the lines it describes").toBeDefined();
      const end = step.highlight!.end;
      const source = fs.readFileSync(path.join(process.cwd(), "public", tutorial.sourcePath), "utf8");
      const emu = new Emulator();
      try {
        const asm = emu.assemble_and_load_with_args(source, parseArgs(tutorial.args ?? "")) as {
          error?: string | null;
        };
        expect(asm.error ?? null).toBeNull();
        // The first instruction past the highlight, in source order.
        const map = emu.get_line_map();
        let stopAddr = -1;
        let stopLine = Infinity;
        for (let i = 0; i < map.length; i += 2) {
          if (map[i + 1] > end && map[i + 1] < stopLine) {
            stopLine = map[i + 1];
            stopAddr = map[i];
          }
        }
        if (stopAddr >= 0) emu.set_breakpoint(stopAddr);
        if (tutorial.stdin) emu.push_stdin(tutorial.stdin);
        emu.close_stdin();
        for (let i = 0; i < 20 && !emu.is_halted() && Number(emu.get_pc()) !== stopAddr; i++) {
          const run = emu.run_until_break(1_000_000) as { error?: string | null };
          expect(run.error ?? null).toBeNull();
        }
        if (stopAddr >= 0) expect(Number(emu.get_pc()), "stopped after the highlight").toBe(stopAddr);
        else expect(emu.is_halted(), "ran to the end").toBe(true);
        expect(readReg(emu, step.expect.reg), `${step.expect.reg} after line ${end}`).toBe(step.expect.value);
      } finally {
        emu.free();
      }
    },
  );
});
