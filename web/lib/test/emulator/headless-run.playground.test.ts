import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { runHeadless, type HeadlessMachine } from "@/lib/emulator/headless-run";
import { codingExercise, solutionFor } from "@/lib/test/content/helpers/grade-exercise";

// The per-call frame notes on real programs, on the node build. Each
// fixture is written to break one rule; the lines named are counted by hand
// from the fixture's text.

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import("@/lib/wasm-node/aarch64_emulator");

const emu = new Emulator();
const machine = new EmulatorInstance(emu);
afterAll(() => emu.free());

// The same machine as a wasm build without the frames exports sees it: a
// run with no frame stops and no notes, the run every result used to come from.
const untracked: HeadlessMachine = Object.create(machine, {
  frames: { value: () => null },
  frameLayout: { value: () => null },
});

const fixture = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures", name), "utf8");

/** A run's outcome, and the outcome of the same run without the notes. */
async function bothRuns(source: string, stdin?: string) {
  const noted = await runHeadless(machine, source, [], stdin);
  const plain = await runHeadless(untracked, source, [], stdin);
  return { noted, plain };
}

describe("the per-call frame notes", () => {
  it("note a call made with sp off a multiple of 16", async () => {
    const { noted, plain } = await bothRuns(fixture("call-sp-off.s"));
    expect(noted.frameNotes).toEqual([{ kind: "sp", fn: "twice", line: 27 }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "42\n", exitCode: 0, stackBalanced: true });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("note a write over a caller's saved fp, and the program still passes as before", async () => {
    const { noted, plain } = await bothRuns(fixture("fp-overwrite.s"));
    expect(noted.frameNotes).toEqual([{ kind: "fp", fn: "main", line: 28 }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "done\n", exitCode: 0, frameIntact: true });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("note a write over a caller's saved lr and the ret it sends astray, with the fault unchanged", async () => {
    const { noted, plain } = await bothRuns(fixture("lr-overwrite.s"));
    // fill's writes 4 to 7 cover main's saved fp (4, 5) and saved lr (6, 7).
    expect(noted.frameNotes).toEqual([
      { kind: "fp", fn: "main", line: 27 },
      { kind: "lr", fn: "main", line: 27 },
      { kind: "return", fn: "main", line: 50 },
    ]);
    expect(noted.error).not.toBeNull();
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("note x19 to x28 left changed by a call, but never by main", async () => {
    const { noted, plain } = await bothRuns(fixture("x20-left-changed.s"));
    // main sets x19 and never puts it back, as course programs do.
    expect(noted.frameNotes).toEqual([{ kind: "callee", fn: "bump", line: 24, register: 20 }]);
    expect(noted.stdout).toBe("42\n");
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a program that keeps every rule", async () => {
    const { noted, plain } = await bothRuns(solutionFor("the-forgetful-helper"), "100 20\n");
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toEqual(plain);
    expect(noted.stdout).toBe("total = 140\n");
  });

  it("note the forgetful helper's x19 on its starter", async () => {
    const { starter } = codingExercise("the-forgetful-helper");
    const { noted, plain } = await bothRuns(starter, "100 20\n");
    // double_it's ret is line 25 of the starter.
    expect(noted.frameNotes).toEqual([{ kind: "callee", fn: "double_it", line: 25, register: 19 }]);
    expect(noted.stdout).toBe("total = 80\n");
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // Each run takes the whole 5,000,000-step budget, about 2.5 s on this
  // machine with or without the notes, so the pair needs more than 5 s.
  it("still end a ret that loops back into its own function at the step budget", { timeout: 30_000 }, async () => {
    // show calls out before saving lr, so every ret it makes goes astray.
    const { noted, plain } = await bothRuns(fixture("lr-not-saved.s"));
    expect(noted.finished).toBe(false);
    expect(noted.frameNotes).toContainEqual({ kind: "return", fn: "show", line: 29 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("clear its breakpoints, so the next run on the machine goes straight through", async () => {
    await runHeadless(machine, fixture("x20-left-changed.s"), [], undefined);
    machine.assembleAndLoadWithArgs(fixture("x20-left-changed.s"), []);
    const slice = machine.runUntilBreak(1_000_000);
    expect(slice.hit_breakpoint).toBe(false);
    expect(slice.halted).toBe(true);
  });
});
