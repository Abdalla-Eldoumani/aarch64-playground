// Pins the directives and debugger reference: its three sections render, every
// key it prints is the key the command palette binds, and every watch it lists
// is one the watch grammar reads (and the m4 name it warns about is not).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DirectivesAndDebugger } from "@/components/reference/DirectivesAndDebugger";
import { DEBUG_CONTROLS, WATCH_FORMS } from "@/lib/content/directives-reference";
import { buildPaletteCommands, type PaletteDeps } from "@/lib/playground/palette-commands";
import { evaluateWatch, type EvalContext } from "@/lib/emulator/watch-expr";

afterEach(cleanup);

const noop = () => {};
const DEPS: PaletteDeps = {
  blocked: false,
  programLoaded: true,
  isRunning: false,
  canStepBack: true,
  launchable: false,
  source: "",
  assemble: noop,
  step: noop,
  stepBack: noop,
  run: noop,
  pause: noop,
  reset: noop,
  launchInteractive: noop,
  formatSource: noop,
  openShare: noop,
  openShortcuts: noop,
  openTutorials: noop,
  openWalkthrough: noop,
  openConverter: noop,
  toggleTheme: noop,
};

// A machine stopped inside a frame: fp at 0x1000, a frame slot sum_s at 16.
const CTX: EvalContext = {
  readRegister: (name) => {
    const values: Record<string, bigint> = { fp: 0x1000n, sp: 0x1000n, lr: 0x400100n, w19: 5n, x21: 0x1010n };
    return values[name.toLowerCase()] ?? null;
  },
  readMemory: () => 0x48n,
  resolveSlotOffset: (name) => (name === "sum_s" ? 16n : null),
  resolveLabelAddress: () => null,
};

describe("DirectivesAndDebugger", () => {
  it("renders its three sections and a row for each directive, control and watch", () => {
    render(<DirectivesAndDebugger />);
    expect(screen.getByLabelText("directives and debugger")).toBeTruthy();
    for (const title of ["sections and data", "names and constants", "the debugger"]) {
      expect(screen.getByText(new RegExp(`· ${title}$`))).toBeTruthy();
    }
    const cells = [...document.querySelectorAll("td")].map((cell) => cell.textContent);
    for (const text of ['fmt: .string "%d\\n"', "buffer: .skip 256", "Shift+F10", "[fp, sum_s]", "*x21"]) {
      expect(cells).toContain(text);
    }
  });

  it("prints the key the command palette binds for each control", () => {
    const palette = buildPaletteCommands(DEPS);
    const expected: Record<string, string> = {
      assemble: "F6",
      run: "F5",
      step: "F10",
      back: "Shift+F10",
      reset: "Shift+F5",
    };
    expect(Object.fromEntries(DEBUG_CONTROLS.map((c) => [c.control, c.key]))).toEqual(expected);
    for (const control of DEBUG_CONTROLS) {
      expect(palette.find((command) => command.id === control.command)?.shortcut).toBe(control.key);
    }
  });

  it("lists only watches the watch grammar reads", () => {
    expect(WATCH_FORMS.map((w) => w.form)).toEqual(["w19", "[fp, 16]", "[fp, sum_s]", "sum_s[1]", "*x21"]);
    for (const { form } of WATCH_FORMS) {
      expect(evaluateWatch(form, CTX), form).not.toHaveProperty("error");
    }
    // The page tells students an m4 name does not work in a watch.
    expect(evaluateWatch("count_r", CTX)).toHaveProperty("error");
  });
});
