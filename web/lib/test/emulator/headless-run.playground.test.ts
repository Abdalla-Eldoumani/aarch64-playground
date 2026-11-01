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

  it("note a function that writes over its own saved fp and returns with fp changed", async () => {
    const { noted, plain } = await bothRuns(fixture("own-saved-fp.s"));
    // keep's ret is line 28.
    expect(noted.frameNotes).toEqual([{ kind: "fpChanged", fn: "keep", line: 28 }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("note a write over a caller's saved lr and nothing for the ret it sends astray, with the fault unchanged", async () => {
    const { noted, plain } = await bothRuns(fixture("lr-overwrite.s"));
    // fill's writes 4 to 7 cover main's saved fp (4, 5) and saved lr (6, 7).
    expect(noted.frameNotes).toEqual([
      { kind: "fp", fn: "main", line: 27 },
      { kind: "lr", fn: "main", line: 27 },
    ]);
    expect(noted.error).not.toBeNull();
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // In both, skip_next's ret goes astray, and every later ret hands fp back.
  it("make no note for a stray ret or for main's ret after it", async () => {
    const { noted, plain } = await bothRuns(fixture("astray-then-main.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a stray ret or for its caller's ret after it", async () => {
    const { noted, plain } = await bothRuns(fixture("astray-deep.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a stray ret in a recursion or for the outer call's ret", async () => {
    const { noted, plain } = await bothRuns(fixture("astray-in-recursion.s"));
    // The base case's ret goes astray; the outer call's ldp hands fp back.
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a stray ret three calls deep in a recursion or for the outer calls' rets", async () => {
    const { noted, plain } = await bothRuns(fixture("astray-deep-recursion.s"));
    // The base case's ret goes astray; both outer calls' ldp hand fp back.
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // Each base case's ret goes astray and every call puts x19 to x28 back:
  // the run notes nothing for the stray ret and nothing after it.
  it.each([2, 4])("make no note when count_down(%i), which saves x19, returns astray", async (n) => {
    const source = fixture("astray-x19-recursion.s").replace("mov     x0, 2", `mov     x0, ${n}`);
    const { noted, plain } = await bothRuns(source);
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it.each([
    ["astray-fib.s", "3\n"],
    ["astray-two-step-recursion.s", "7\n"],
  ])("make no note for the stray ret in %s or after it", async (name, stdout) => {
    const { noted, plain } = await bothRuns(fixture(name));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout, exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // In each, main's call comes back with fp changed by a function reached by b.
  it.each([
    ["tail-fp-scratch.s", "set_fp", 18],
    ["tail-own-saved-fp.s", "keep", 27],
    ["tail-after-epilogue.s", "keep", 27],
  ])("note fp changed by a function reached by b (%s)", async (name, fn, line) => {
    const { noted, plain } = await bothRuns(fixture(name));
    expect(noted.frameNotes).toEqual([{ kind: "fpChanged", fn, line }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a tail call, whose ret goes back to its caller's caller", async () => {
    const { noted, plain } = await bothRuns(fixture("tail-call.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toEqual(plain);
    expect(noted.stdout).toBe("7\n");
  });

  it("make no note for a stray ret in a function reached by b", async () => {
    const { noted, plain } = await bothRuns(fixture("branch-astray.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for x19 to x28 left changed by a call", async () => {
    const { noted, plain } = await bothRuns(fixture("x20-left-changed.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted.stdout).toBe("42\n");
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a program that keeps every rule", async () => {
    const { noted, plain } = await bothRuns(solutionFor("the-forgetful-helper"), "100 20\n");
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toEqual(plain);
    expect(noted.stdout).toBe("total = 140\n");
  });

  it("make no note for the forgetful helper's starter, which leaves x19 changed", async () => {
    const { starter } = codingExercise("the-forgetful-helper");
    const { noted, plain } = await bothRuns(starter, "100 20\n");
    expect(noted.frameNotes).toEqual([]);
    expect(noted.stdout).toBe("total = 80\n");
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a forgetful helper fix whose main copies x20 into x21", async () => {
    const { starter } = codingExercise("the-forgetful-helper");
    const copied = starter
      .replace("mov     x19, x0", "mov     x20, x0")
      .replace("add     x19, x19, x19", "add     x20, x20, x20")
      .replace("mov     x0, x19", "mov     x0, x20")
      .replace("add     total_r, total_r, x0", "mov     x21, x20\n        add     total_r, total_r, x21");
    expect(copied).toContain("mov     x21, x20");
    const { noted, plain } = await bothRuns(copied, "100 20\n");
    expect(noted.frameNotes).toEqual([]);
    expect(noted.stdout).toBe("total = 140\n");
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a ret that skips its caller three calls deep in a recursion", async () => {
    const { noted, plain } = await bothRuns(fixture("skip-caller-recursion.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "99\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a call made by hand with adr and b", async () => {
    const { noted, plain } = await bothRuns(fixture("call-by-hand.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "3\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // Each run takes the whole 5,000,000-step budget, about 2.5 s on this
  // machine with or without the notes, so the pair needs more than 5 s.
  it("still end a ret that loops back into its own function at the step budget", { timeout: 30_000 }, async () => {
    // show calls out before saving lr, so every ret it makes goes astray.
    const { noted, plain } = await bothRuns(fixture("lr-not-saved.s"));
    expect(noted.finished).toBe(false);
    expect(noted.frameNotes).toEqual([]);
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

// main calls count(1) to count(1000), after `spin` turns of a three-step loop
// with no call. count leaves fp changed once its argument reaches `from`, so
// a note means call number `from` was checked.
const manyCalls = (from: number, spin = 0) => `define(fp, x29)
define(lr, x30)
define(i_r, x19)

.text

// count(x0 = i): leaves fp changed once i reaches ${from} (bug: fp is the caller's)
        .balign 4
        .global count
count:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =${from}
        cmp     x0, x9
        ldp     fp, lr, [sp], 16
        b.lt    count_done
        mov     fp, x0
count_done:
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x10, =${spin}
spin:
        cbz     x10, spun
        sub     x10, x10, 1
        b       spin
spun:
        mov     i_r, 1
call_next:
        mov     x0, i_r
        bl      count
        add     i_r, i_r, 1
        cmp     i_r, 1000
        b.le    call_next

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

describe("how many calls a run checks", () => {
  // A call takes three of the run's 2,000 stops: its entry, its ret and its
  // return. fp is checked at the ret, so call 667's ret is stop 2,000.
  it("check the first 667 calls of a run that makes them straight away, and no later one", async () => {
    // count's ret is line 19.
    const checked = await runHeadless(machine, manyCalls(667), [], undefined);
    expect(checked.frameNotes).toEqual([{ kind: "fpChanged", fn: "count", line: 19 }]);
    expect((await runHeadless(machine, manyCalls(668), [], undefined)).frameNotes).toEqual([]);
  });

  // Every 250,000 steps with no stop also take a stop. A run that finishes
  // within the 5,000,000-step budget spends at most 19 that way, leaving 660.
  it("check the first 660 calls after 4,752,000 steps with no call", { timeout: 30_000 }, async () => {
    const checked = await runHeadless(machine, manyCalls(660, 1_584_000), [], undefined);
    expect(checked).toMatchObject({ finished: true, exitCode: 0 });
    expect(checked.frameNotes).toHaveLength(1);
    expect((await runHeadless(machine, manyCalls(661, 1_584_000), [], undefined)).frameNotes).toEqual([]);
  });
});
