import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { runHeadless, type HeadlessMachine } from "@/lib/emulator/headless-run";
import { codingExercise, solutionFor } from "@/lib/test/content/helpers/grade-exercise";

// The per-call frame notes on real programs, on the node build, collected as
// they are once FRAME_NOTES_COUNT is on. Each fixture is written to break one
// rule; the lines named are counted by hand from the fixture's text.

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import("@/lib/wasm-node/aarch64_emulator");

const emu = new Emulator();
const machine = new EmulatorInstance(emu);
afterAll(() => emu.free());

// The same machine as a wasm build without the frames exports sees it: a
// run with no frame stops and no notes.
const untracked: HeadlessMachine = Object.create(machine, {
  frames: { value: () => null },
  frameLayout: { value: () => null },
});

const fixture = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures", name), "utf8");

/** A run's outcome with the notes, the same run without them, and the run as the switch leaves it. */
async function bothRuns(source: string, stdin?: string) {
  const noted = await runHeadless(machine, source, [], stdin, {}, true);
  const plain = await runHeadless(untracked, source, [], stdin, {}, true);
  const off = await runHeadless(machine, source, [], stdin);
  expect(off).toEqual(plain);
  return { noted, plain };
}

describe("the per-call frame notes", () => {
  it("are not collected while the switch is off", async () => {
    const off = await runHeadless(machine, fixture("call-sp-off.s"), [], undefined);
    expect(off.frameNotes).toEqual([]);
  });

  it("note a call made with sp off a multiple of 16", async () => {
    const { noted, plain } = await bothRuns(fixture("call-sp-off.s"));
    expect(noted.frameNotes).toEqual([{ kind: "sp", fn: "twice", line: 27 }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "42\n", exitCode: 0, stackBalanced: true });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // No function starts where these calls go, so each is named by its address,
  // as the frames view names it.
  it.each([
    ["blr-unlisted-sp-off.s", "0x00400034", 22],
    ["section-text-sp-off.s", "0x00400030", 21],
    ["numeric-label-sp-off.s", "0x00400030", 20],
  ])("note the call in %s made with sp off, by its address", async (name, fn, line) => {
    const { noted, plain } = await bothRuns(fixture(name));
    expect(noted.frameNotes).toEqual([{ kind: "sp", fn, line }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "42\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("note a write over main's saved fp, and the program still passes as before", async () => {
    const { noted, plain } = await bothRuns(fixture("fp-overwrite.s"));
    expect(noted.frameNotes).toEqual([{ kind: "fp", fn: "main", line: null, at: 28 }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "done\n", exitCode: 0, frameIntact: true });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("note a write over main's saved fp and lr, with the fault unchanged", async () => {
    const { noted, plain } = await bothRuns(fixture("lr-overwrite.s"));
    // fill's writes 4 to 7 cover main's saved fp (4, 5) and saved lr (6, 7).
    expect(noted.frameNotes).toEqual([
      { kind: "fp", fn: "main", line: null, at: 27 },
      { kind: "lr", fn: "main", line: null, at: 27 },
    ]);
    expect(noted.error).not.toBeNull();
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("name a call that comes back with fp changed by its call site", async () => {
    const { noted, plain } = await bothRuns(fixture("own-saved-fp.s"));
    expect(noted.frameNotes).toEqual([{ kind: "fpChanged", fn: "keep", line: 37 }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // In each, main's call comes back with fp changed by a function the call
  // reached by b or by falling through: the note names main's call, not the
  // function that holds the ret.
  it.each([
    ["tail-fp-scratch.s", "hand_on", 33],
    ["tail-own-saved-fp.s", "pass_on", 42],
    ["tail-after-epilogue.s", "add_one", 48],
    ["tail-caller-fp-scratch.s", "set_up", 37],
    ["fall-through-fp-scratch.s", "set_up", 36],
  ])("note fp changed by the call main makes in %s", async (name, fn, line) => {
    const { noted, plain } = await bothRuns(fixture(name));
    expect(noted.frameNotes).toEqual([{ kind: "fpChanged", fn, line }]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("name a write over a frame that a b reached by the call that made the frame", async () => {
    const { noted, plain } = await bothRuns(fixture("tail-then-callee-writes.s"));
    // main's call to tidy on line 53 holds outer's record once tidy reaches outer by b.
    expect(noted.frameNotes).toEqual([
      { kind: "fp", fn: "tidy", line: 53, at: 20 },
      { kind: "fpChanged", fn: "tidy", line: 53 },
    ]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("note x19 to x28 left changed by a call", async () => {
    const { noted, plain } = await bothRuns(fixture("x20-left-changed.s"));
    expect(noted.frameNotes).toEqual([{ kind: "callee", fn: "bump", line: 34, register: 20 }]);
    expect(noted.stdout).toBe("42\n");
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a tail call, whose ret goes back to its caller's caller", async () => {
    const { noted, plain } = await bothRuns(fixture("tail-call.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toEqual(plain);
    expect(noted.stdout).toBe("7\n");
  });

  // Past a return to no caller or past its own the call stack may be stale,
  // so each of these notes nothing, there or after.
  it.each([
    ["astray-then-main.s", "7\n"],
    ["astray-deep.s", "7\n"],
    ["astray-in-recursion.s", "7\n"],
    ["astray-deep-recursion.s", "7\n"],
    ["astray-fib.s", "3\n"],
    ["astray-two-step-recursion.s", "7\n"],
    ["branch-astray.s", "7\n"],
    ["skip-caller-recursion.s", "99\n"],
    ["skip-recursion-alloc-fill.s", "99\n"],
  ])("make no note for the stray or skipping ret in %s or after it", async (name, stdout) => {
    const { noted, plain } = await bothRuns(fixture(name));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout, exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it.each([2, 4])("make no note when count_down(%i), which saves x19, returns astray", async (n) => {
    const source = fixture("astray-x19-recursion.s").replace("mov     x0, 2", `mov     x0, ${n}`);
    const { noted, plain } = await bothRuns(source);
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "7\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a call made by hand with adr and b", async () => {
    const { noted, plain } = await bothRuns(fixture("call-by-hand.s"));
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toMatchObject({ error: null, finished: true, stdout: "3\n", exitCode: 0 });
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("make no note for a program that keeps every rule", async () => {
    const { noted, plain } = await bothRuns(solutionFor("the-forgetful-helper"), "100 20\n");
    expect(noted.frameNotes).toEqual([]);
    expect(noted).toEqual(plain);
    expect(noted.stdout).toBe("total = 140\n");
  });

  it("note the forgetful helper's starter, which leaves x19 changed", async () => {
    const { starter } = codingExercise("the-forgetful-helper");
    const { noted, plain } = await bothRuns(starter, "100 20\n");
    expect(noted.frameNotes).toEqual([{ kind: "callee", fn: "double_it", line: 42, register: 19 }]);
    expect(noted.stdout).toBe("total = 80\n");
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  // Each run takes the whole 5,000,000-step budget, about 2.5 s on this
  // machine with or without the notes, so the three need more than 5 s.
  it("still end a ret that loops back into its own function at the step budget", { timeout: 30_000 }, async () => {
    // show calls out before saving lr, so every ret it makes goes astray.
    const { noted, plain } = await bothRuns(fixture("lr-not-saved.s"));
    expect(noted.finished).toBe(false);
    expect(noted.frameNotes).toEqual([]);
    expect({ ...noted, frameNotes: [] }).toEqual(plain);
  });

  it("clear its breakpoints, so the next run on the machine goes straight through", async () => {
    await runHeadless(machine, fixture("x20-left-changed.s"), [], undefined, {}, true);
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
  // return. fp is checked at the return, so call 666's return is stop 1,998.
  it("check the first 666 calls of a run that makes them straight away, and no later one", async () => {
    // main's call to count is line 36.
    const checked = await runHeadless(machine, manyCalls(666), [], undefined, {}, true);
    expect(checked.frameNotes).toEqual([{ kind: "fpChanged", fn: "count", line: 36 }]);
    expect((await runHeadless(machine, manyCalls(667), [], undefined, {}, true)).frameNotes).toEqual([]);
  });

  // Every 250,000 steps with no stop also take a stop. A run that finishes
  // within the 5,000,000-step budget spends at most 19 that way, leaving 660.
  it("check the first 660 calls after 4,752,000 steps with no call", { timeout: 30_000 }, async () => {
    const checked = await runHeadless(machine, manyCalls(660, 1_584_000), [], undefined, {}, true);
    expect(checked).toMatchObject({ finished: true, exitCode: 0 });
    expect(checked.frameNotes).toHaveLength(1);
    expect((await runHeadless(machine, manyCalls(661, 1_584_000), [], undefined, {}, true)).frameNotes).toEqual([]);
  });
});
