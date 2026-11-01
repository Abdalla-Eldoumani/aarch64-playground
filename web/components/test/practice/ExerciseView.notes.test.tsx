import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, useImperativeHandle, type Ref } from "react";
import path from "node:path";
import { createRequire } from "node:module";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { isSolved } from "@/lib/playground/solved-state";
import { codingExercise, runToSnapshot, solutionFor } from "@/lib/test/content/helpers/grade-exercise";

// The forgetful helper graded the way the page grades it: the visible run's
// snapshot from the node build, then every hidden input on the page's
// headless machine (the node build here too), with the frame notes beside
// the result. The embed is the only stand-in.

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import("@/lib/wasm-node/aarch64_emulator");
const emu = new Emulator();
const machine = new EmulatorInstance(emu);
afterAll(() => emu.free());

vi.mock("@/lib/emulator/emulator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/emulator/emulator")>()),
  loadEmulator: async () => machine,
}));

const { ANSWER, SWITCH } = vi.hoisted(() => ({ ANSWER: { source: "" }, SWITCH: { on: false } }));

// FRAME_NOTES_COUNT as the test sets it, read live, and the grader honouring it.
vi.mock("@/lib/content/exercise-checker", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/content/exercise-checker")>();
  return {
    ...real,
    get FRAME_NOTES_COUNT() {
      return SWITCH.on;
    },
    checkHiddenCase: (...args: Parameters<typeof real.checkHiddenCase>) =>
      real.checkHiddenCase(args[0], args[1], SWITCH.on),
  };
});

vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: forwardRef(function MockEmbed(
    props: { startStdin?: string; onCheck?: (snapshot: unknown) => void },
    ref: Ref<{ getSource: () => string; loadSource: (source: string) => void }>,
  ) {
    useImperativeHandle(ref, () => ({ getSource: () => ANSWER.source, loadSource: () => {} }), []);
    return (
      <button type="button" onClick={() => props.onCheck?.(runToSnapshot(ANSWER.source, [], props.startStdin))}>
        check
      </button>
    );
  }),
}));

import { ExerciseView } from "@/components/practice/ExerciseView";

const EXERCISE = codingExercise("the-forgetful-helper");

// A fix that passes every check but swaps one callee-saved register for
// another: double_it now changes x20 and never puts it back.
const X20_FIX = EXERCISE.starter
  .replace("mov     x19, x0", "mov     x20, x0")
  .replace("add     x19, x19, x19", "add     x20, x20, x20")
  .replace("mov     x0, x19", "mov     x0, x20");

// A fix that passes every check but takes x29 as double_it's scratch
// register, so main gets fp back changed.
const FP_FIX = EXERCISE.starter
  .replace("mov     x19, x0", "mov     x29, x0")
  .replace("add     x19, x19, x19", "add     x29, x29, x29")
  .replace("mov     x0, x19", "mov     x0, x29");

// The reference fix, but main calls double_it with sp 8 bytes off a
// multiple of 16; double_it never touches the stack, so it still passes.
const SP_FIX = solutionFor("the-forgetful-helper")
  .replace("        bl      double_it", "        sub     sp, sp, 8\n        bl      double_it")
  .replace("        add     total_r, total_r, x0", "        add     sp, sp, 8\n        add     total_r, total_r, x0");
// The bl is line 43 once the sub sits above it.
const SP_NOTE = "line 43 calls double_it with sp not a multiple of 16";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  SWITCH.on = false;
});

async function checkWith(source: string) {
  ANSWER.source = source;
  render(<ExerciseView exercise={EXERCISE} />);
  fireEvent.click(screen.getByRole("button", { name: "check" }));
  await waitFor(() => expect(screen.getByText(/checks passing/).textContent).toMatch(/^(\d+) of \1 checks passing$/), {
    timeout: 10_000,
  });
}

describe("the forgetful helper's frame notes", () => {
  it("shows no note for a passing fix that leaves a callee-saved register changed", async () => {
    expect(X20_FIX).not.toContain("x19, x0");
    await checkWith(X20_FIX);
    expect(screen.queryByText(/notes on the calls/)).toBeNull();
    expect(screen.queryByText(/x20 changed/)).toBeNull();
    expect(screen.getByText("all checks passed")).toBeTruthy();
    expect(isSolved(EXERCISE.slug)).toBe(true);
  });

  it("shows no note for a passing fix that leaves fp changed", async () => {
    expect(FP_FIX).not.toContain("x19, x0");
    await checkWith(FP_FIX);
    expect(screen.queryByText(/notes on the calls/)).toBeNull();
    expect(screen.queryByText(/fp changed/)).toBeNull();
    expect(screen.getByText("all checks passed")).toBeTruthy();
  });

  it("names a call made with sp off a multiple of 16, and the result still passes", async () => {
    expect(SP_FIX).toContain("sub     sp, sp, 8");
    await checkWith(SP_FIX);
    expect(screen.getByText("notes on the calls · they do not change the result")).toBeTruthy();
    expect(screen.getByText(SP_NOTE)).toBeTruthy();
    expect(screen.getByText("all checks passed")).toBeTruthy();
  });

  it("heads the notes as counting once the switch makes them count", async () => {
    SWITCH.on = true;
    ANSWER.source = SP_FIX;
    render(<ExerciseView exercise={EXERCISE} />);
    fireEvent.click(screen.getByRole("button", { name: "check" }));
    await waitFor(() => expect(screen.getByText(SP_NOTE)).toBeTruthy(), { timeout: 4_000 });
    expect(screen.queryByText(/they do not change the result/)).toBeNull();
    expect(screen.getByText("notes on the calls")).toBeTruthy();
    expect(screen.getAllByText(/a call in it breaks a stack rule/).length).toBeGreaterThan(0);
  });

  it("shows no notes for the reference fix, which uses a scratch register", async () => {
    await checkWith(solutionFor("the-forgetful-helper"));
    expect(screen.queryByText(/notes on the calls/)).toBeNull();
    expect(screen.getByText("all checks passed")).toBeTruthy();
  });
});
