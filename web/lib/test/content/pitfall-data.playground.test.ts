// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { PITFALLS } from "@/lib/content/pitfall-data";

// Every pitfall demo runs on the real node-target emulator: each fault must
// misbehave exactly the way its card promises (that is the teaching payload),
// and each fix must run clean. A demo that assembles but fails differently --
// or worse, works -- would teach the wrong lesson, so the behavior itself is
// pinned here.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

interface RunOutcome {
  stdout: string;
  halted: boolean;
  exitCode: number | null;
  error: string | null;
}

function runProgram(source: string, maxSteps: number): RunOutcome {
  const emu = new Emulator();
  const asm = emu.assemble_and_load_with_args(source, []) as {
    error?: string | null;
  };
  expect(asm.error ?? null, "demo program failed to assemble").toBeNull();
  const result = emu.run_until_break(maxSteps) as { error?: string | null };
  const exit = emu.get_exit_code();
  return {
    stdout: emu.take_stdout(),
    halted: emu.is_halted(),
    exitCode: exit === undefined ? null : Number(exit),
    error: result.error ?? null,
  };
}

const byTitle = new Map(PITFALLS.map((pitfall) => [pitfall.title, pitfall]));

function demo(title: string) {
  const pitfall = byTitle.get(title);
  expect(pitfall, `no pitfall titled "${title}"`).toBeDefined();
  return pitfall as NonNullable<typeof pitfall>;
}

describe("pitfall demos fail and recover exactly as taught", () => {
  it("ships a fault, a fix, and a watch line on all seven pitfalls", () => {
    expect(PITFALLS).toHaveLength(7);
    for (const pitfall of PITFALLS) {
      expect(pitfall.fault.length, pitfall.title).toBeGreaterThan(0);
      expect(pitfall.fix.length, pitfall.title).toBeGreaterThan(0);
      expect(pitfall.watch.length, pitfall.title).toBeGreaterThan(0);
    }
  });

  it("16-byte stack alignment: the fault prints the misalignment, the fix prints 0", () => {
    const pitfall = demo("16-byte stack alignment");
    const fault = runProgram(pitfall.fault, 100_000);
    expect(fault.stdout).toContain("sp & 15 = 8");
    const fix = runProgram(pitfall.fix, 100_000);
    expect(fix.stdout).toContain("sp & 15 = 0");
    expect(fix.halted).toBe(true);
    expect(fix.exitCode).toBe(0);
  });

  it(
    "fp and lr: the fault loops on its own ret and never halts, the fix exits 0",
    { timeout: 30_000 },
    () => {
      const pitfall = demo("saving and restoring fp and lr");
      // A bounded run is enough to prove the loop: thousands of steps past the
      // print with no halt and no error means ret is chasing its own tail.
      const fault = runProgram(pitfall.fault, 20_000);
      expect(fault.stdout).toBe("greet ran\n"); // printed exactly once
      expect(fault.halted).toBe(false);
      expect(fault.error).toBeNull();
      const fix = runProgram(pitfall.fix, 100_000);
      expect(fix.stdout).toBe("greet ran\n");
      expect(fix.halted).toBe(true);
      expect(fix.exitCode).toBe(0);
    },
  );

  it("sign extension: the fault reads a wild address and faults, the fix reads vals[1]", () => {
    const pitfall = demo("sign extension");
    const fault = runProgram(pitfall.fault, 100_000);
    expect(fault.error).toMatch(/memory fault/);
    expect(fault.halted).toBe(false);
    const fix = runProgram(pitfall.fix, 100_000);
    expect(fix.stdout).toBe("neighbor = 200\n");
    expect(fix.exitCode).toBe(0);
  });

  it("off-by-one: the fault drags the sentinel into the sum, the fix stops at 15", () => {
    const pitfall = demo("off-by-one loop bounds");
    const fault = runProgram(pitfall.fault, 100_000);
    expect(fault.stdout).toBe("sum = 10014\n");
    const fix = runProgram(pitfall.fix, 100_000);
    expect(fix.stdout).toBe("sum = 15\n");
    expect(fix.exitCode).toBe(0);
  });

  it("local allocation: the fault misaligns at the call, the alloc formula holds", () => {
    const pitfall = demo("non-16-byte local allocation");
    const fault = runProgram(pitfall.fault, 100_000);
    expect(fault.stdout).toContain("sp & 15 = 8");
    const fix = runProgram(pitfall.fix, 100_000);
    expect(fix.stdout).toContain("sp & 15 = 0");
    expect(fix.exitCode).toBe(0);
  });

  it("caller-saved: the callee's scratch eats the parked sum, the fix keeps 42", () => {
    const pitfall = demo("caller-saved registers do not survive a call");
    const fault = runProgram(pitfall.fault, 100_000);
    expect(fault.stdout).toBe("step 1 done\nsum = 1\n"); // announce's leftover, not 42
    expect(fault.halted).toBe(true);
    const fix = runProgram(pitfall.fix, 100_000);
    expect(fix.stdout).toBe("step 1 done\nsum = 42\n");
    expect(fix.halted).toBe(true);
    expect(fix.exitCode).toBe(0);
  });

  it("misaligned call: the fault prints sp & 15 = 8 at the bl, the fix prints 0", () => {
    const pitfall = demo("misaligned stack at a call");
    // This emulator does not fault a bl on a misaligned sp (real hardware
    // does, inside printf); the printed low bits are the pinned evidence.
    const fault = runProgram(pitfall.fault, 100_000);
    expect(fault.stdout).toBe("n = 7, sp & 15 = 8\n");
    const fix = runProgram(pitfall.fix, 100_000);
    expect(fix.stdout).toBe("n = 7, sp & 15 = 0\n");
    expect(fix.halted).toBe(true);
    expect(fix.exitCode).toBe(0);
  });
});
