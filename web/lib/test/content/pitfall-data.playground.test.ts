// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { PITFALLS, type PitfallRun } from "@/lib/content/pitfall-data";

// Every broken and fixed program runs on the real node-target emulator and is
// held to what the course server did with it (the stdout and the end each
// card stores, captured on the server). A broken program that misbehaves
// differently here would teach the wrong lesson, so the behaviour is pinned.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

// Enough for every program that ends; a program the server stopped at its
// 10-second limit must still be running here after this many steps.
const STEPS = 200_000;

interface Outcome {
  buildError: string | null;
  stdout: string;
  halted: boolean;
  exitCode: number | null;
  error: string | null;
}

function run(source: string): Outcome {
  const emu = new Emulator();
  try {
    const asm = emu.assemble_and_load_with_args(source, []) as { error?: string | null };
    if (asm.error) {
      return { buildError: asm.error, stdout: "", halted: false, exitCode: null, error: null };
    }
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

function expectServerEnd(label: string, expected: PitfallRun, got: Outcome): void {
  const { ends } = expected;
  if ("buildError" in ends) {
    // as refused it; the playground refuses it too, in words of its own for
    // the immediate errors, so only the refusal is compared.
    expect(got.buildError, `${label}: should not build`).toBeTruthy();
    return;
  }
  expect(got.buildError, `${label}: should build`).toBeNull();
  expect(got.stdout, `${label}: stdout`).toBe(expected.stdout);
  if ("exit" in ends) {
    expect(got.error, `${label}: run error`).toBeNull();
    expect(got.halted, `${label}: halted`).toBe(true);
    expect(got.exitCode, `${label}: exit status`).toBe(ends.exit);
  } else if ("signal" in ends) {
    expect(got.halted, `${label}: halted`).toBe(true);
    expect(got.error, `${label}: fault`).toBeTruthy();
    // The server's bus error is the stack-alignment fault; the playground
    // names it the same way, and words every other fault on its own.
    expect(/^Bus error/.test(got.error ?? ""), `${label}: bus error`).toBe(ends.signal === "SIGBUS");
  } else {
    expect(got.halted, `${label}: still running`).toBe(false);
    expect(got.error, `${label}: run error`).toBeNull();
  }
}

describe("pitfall programs behave as they did on the course server", () => {
  for (const pitfall of PITFALLS) {
    it(`${pitfall.slug}: broken and fixed`, () => {
      expectServerEnd(`${pitfall.slug} broken`, pitfall.broken, run(pitfall.broken.source));
      expectServerEnd(`${pitfall.slug} fixed`, pitfall.fixed, run(pitfall.fixed.source));
    });
  }

  it("every fixed program builds and exits 0", () => {
    for (const pitfall of PITFALLS) {
      expect(pitfall.fixed.ends, pitfall.slug).toEqual({ exit: 0 });
    }
  });

  it("every broken program misbehaves where the server can see it", () => {
    // A broken program either fails on the server or prints something other
    // than its fix does; one that behaved identically would teach nothing.
    for (const pitfall of PITFALLS) {
      const same =
        "exit" in pitfall.broken.ends &&
        pitfall.broken.ends.exit === 0 &&
        pitfall.broken.stdout === pitfall.fixed.stdout;
      expect(same, pitfall.slug).toBe(false);
    }
  });
});
