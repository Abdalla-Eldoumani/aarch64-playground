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

const { ANSWER } = vi.hoisted(() => ({ ANSWER: { source: "" } }));

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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
  it("names the callee-saved register a passing fix leaves changed, and the result still passes", async () => {
    expect(X20_FIX).not.toContain("x19, x0");
    await checkWith(X20_FIX);
    expect(screen.getByText("notes on the calls · they do not change the result")).toBeTruthy();
    // double_it's ret is line 25 of the starter, so of the fix too.
    expect(
      screen.getByText("double_it returns on line 25 with x20 changed: a function must hand x19 to x28 back as it found them"),
    ).toBeTruthy();
    expect(screen.getByText("all checks passed")).toBeTruthy();
    expect(isSolved(EXERCISE.slug)).toBe(true);
  });

  it("names fp when a passing fix leaves it changed", async () => {
    // double_it takes x29 as its scratch register, so main gets fp back changed.
    const fpFix = EXERCISE.starter
      .replace("mov     x19, x0", "mov     x29, x0")
      .replace("add     x19, x19, x19", "add     x29, x29, x29")
      .replace("mov     x0, x19", "mov     x0, x29");
    expect(fpFix).not.toContain("x19, x0");
    await checkWith(fpFix);
    expect(
      screen.getByText("double_it returns on line 25 with fp changed: a function must hand fp back as it found it"),
    ).toBeTruthy();
    expect(screen.getByText("all checks passed")).toBeTruthy();
  });

  it("shows no notes for the reference fix, which uses a scratch register", async () => {
    await checkWith(solutionFor("the-forgetful-helper"));
    expect(screen.queryByText(/notes on the calls/)).toBeNull();
    expect(screen.getByText("all checks passed")).toBeTruthy();
  });
});
