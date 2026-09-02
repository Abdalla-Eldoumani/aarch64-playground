// The palette's action table: the row set never shrinks with the machine's
// state, the blocked guards live in the table (so a palette row no-ops exactly
// where the disabled button does), and a row that would do nothing says why in
// its description instead of disappearing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPaletteCommands, type PaletteDeps } from "@/lib/playground/palette-commands";
import type { Action } from "@/lib/playground/commands";

function makeDeps(overrides: Partial<PaletteDeps> = {}): PaletteDeps {
  return {
    blocked: false,
    programLoaded: true,
    canStepBack: true,
    launchable: false,
    source: "        mov x0, 1\n",
    assemble: vi.fn(),
    step: vi.fn(),
    stepBack: vi.fn(),
    run: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    launchInteractive: vi.fn(),
    formatSource: vi.fn(),
    openShare: vi.fn(),
    openShortcuts: vi.fn(),
    openTour: vi.fn(),
    openConverter: vi.fn(),
    toggleTheme: vi.fn(),
    ...overrides,
  };
}

function row(actions: Action[], id: string): Action {
  const found = actions.find((a) => a.id === id);
  expect(found, `no palette row with id ${id}`).toBeTruthy();
  return found!;
}

// The whole table, in order, written out by hand: a row that disappears or
// arrives changes what the student can find.
const EVERY_ID = [
  "assemble",
  "step",
  "step-back",
  "run",
  "launch-terminal",
  "pause",
  "reset",
  "share",
  "tutorial",
  "base-converter",
  "toggle-theme",
  "format-source",
  "help",
  "import-file",
  "download-asm",
  "download-s",
  "copy-source",
  "open-source",
];

describe("the row set", () => {
  it("lists every row in order on a loaded, idle machine", () => {
    expect(buildPaletteCommands(makeDeps()).map((a) => a.id)).toEqual(EVERY_ID);
  });

  it("drops no row when the machine can do nothing at all", () => {
    const dead = makeDeps({
      blocked: true,
      programLoaded: false,
      canStepBack: false,
      launchable: false,
    });
    expect(buildPaletteCommands(dead).map((a) => a.id)).toEqual(EVERY_ID);
  });

  it("binds the keys the shortcuts modal advertises", () => {
    const actions = buildPaletteCommands(makeDeps());
    expect(row(actions, "assemble").shortcut).toBe("F6");
    expect(row(actions, "step").shortcut).toBe("F10");
    expect(row(actions, "step-back").shortcut).toBe("Shift+F10");
    expect(row(actions, "reset").shortcut).toBe("Shift+F5");
    expect(row(actions, "format-source").shortcut).toBe("Ctrl+Shift+F");
    expect(row(actions, "help").shortcut).toBe("?");
    // Run and pause share F5: one key toggles the run loop.
    expect(row(actions, "run").shortcut).toBe("F5");
    expect(row(actions, "pause").shortcut).toBe("F5");
  });
});

describe("the blocked guards", () => {
  it("swallows step, step back, and run while a read is parked", () => {
    const deps = makeDeps({ blocked: true });
    const actions = buildPaletteCommands(deps);
    row(actions, "step").run();
    row(actions, "step-back").run();
    row(actions, "run").run();
    expect(deps.step).not.toHaveBeenCalled();
    expect(deps.stepBack).not.toHaveBeenCalled();
    expect(deps.run).not.toHaveBeenCalled();
  });

  it("passes them straight through once the read is answered", () => {
    const deps = makeDeps({ blocked: false });
    const actions = buildPaletteCommands(deps);
    row(actions, "step").run();
    row(actions, "step-back").run();
    row(actions, "run").run();
    expect(deps.step).toHaveBeenCalledTimes(1);
    expect(deps.stepBack).toHaveBeenCalledTimes(1);
    expect(deps.run).toHaveBeenCalledTimes(1);
  });

  it("leaves pause, reset, and assemble unguarded, so a stuck read can be cleared", () => {
    const deps = makeDeps({ blocked: true, programLoaded: false });
    const actions = buildPaletteCommands(deps);
    row(actions, "pause").run();
    row(actions, "reset").run();
    row(actions, "assemble").run();
    expect(deps.pause).toHaveBeenCalledTimes(1);
    expect(deps.reset).toHaveBeenCalledTimes(1);
    expect(deps.assemble).toHaveBeenCalledTimes(1);
  });
});

describe("the descriptions that carry the reason", () => {
  it("names the parked read ahead of every other reason", () => {
    const actions = buildPaletteCommands(
      makeDeps({ blocked: true, programLoaded: false, canStepBack: false, launchable: true }),
    );
    const waiting = "(waiting for stdin; feed the console first)";
    expect(row(actions, "step").description).toBe(waiting);
    expect(row(actions, "step-back").description).toBe(waiting);
    expect(row(actions, "run").description).toBe(waiting);
  });

  it("sends a student with no program to the assemble button", () => {
    const actions = buildPaletteCommands(
      makeDeps({ programLoaded: false, canStepBack: false }),
    );
    expect(row(actions, "step").description).toBe("(no program; assemble first)");
    expect(row(actions, "step-back").description).toBe("(nothing to undo; take a step first)");
    expect(row(actions, "run").description).toBe("(no program; assemble first)");
  });

  it("describes an ordinary console run", () => {
    const actions = buildPaletteCommands(makeDeps());
    expect(row(actions, "step").description).toBe("execute one instruction");
    expect(row(actions, "step-back").description).toBe(
      "undo the last instruction",
    );
    expect(row(actions, "run").description).toBe("run until halt or breakpoint");
  });

  it("names the terminal tab when run lands there", () => {
    const loaded = buildPaletteCommands(makeDeps({ launchable: true }));
    expect(row(loaded, "run").description).toBe("run this program in the terminal tab");
    // Nothing assembled yet: in terminal mode run IS the launch, so it says so
    // rather than sending the student to assemble first.
    const cold = buildPaletteCommands(makeDeps({ launchable: true, programLoaded: false }));
    expect(row(cold, "run").description).toBe("assemble, then run it in the terminal tab");
  });
});

describe("start in the terminal", () => {
  it("launches when the program has a pane to land in", () => {
    const deps = makeDeps({ launchable: true });
    const actions = buildPaletteCommands(deps);
    expect(row(actions, "launch-terminal").description).toBe(
      "assemble and run with the terminal pane",
    );
    row(actions, "launch-terminal").run();
    expect(deps.launchInteractive).toHaveBeenCalledTimes(1);
  });

  it("stays in the list but no-ops for a console program", () => {
    const deps = makeDeps({ launchable: false });
    const actions = buildPaletteCommands(deps);
    expect(row(actions, "launch-terminal").description).toBe(
      "(this program runs in the console)",
    );
    row(actions, "launch-terminal").run();
    expect(deps.launchInteractive).not.toHaveBeenCalled();
  });
});

describe("the rows that act on the buffer", () => {
  const SOURCE = "        mov x0, 42\n";
  const blobs: Blob[] = [];
  let clicked: HTMLAnchorElement[] = [];

  beforeEach(() => {
    blobs.length = 0;
    clicked = [];
    // jsdom ships no object-URL support, and the anchor download is the one
    // part of these rows with no observable result of its own.
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:test";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("downloads the buffer under both course extensions", async () => {
    const actions = buildPaletteCommands(makeDeps({ source: SOURCE }));
    row(actions, "download-asm").run();
    row(actions, "download-s").run();
    expect(clicked.map((a) => a.download)).toEqual(["program.asm", "program.s"]);
    expect(blobs).toHaveLength(2);
    expect(blobs[0].type).toBe("text/plain;charset=utf-8");
    expect(await blobs[0].text()).toBe(SOURCE);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(document.querySelector("a")).toBeNull();
  });

  it("copies the buffer through the clipboard", () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    row(buildPaletteCommands(makeDeps({ source: SOURCE })), "copy-source").run();
    expect(writeText).toHaveBeenCalledWith(SOURCE);
  });

  it("clicks the playground's own file input rather than opening a picker of its own", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".s,.asm,.txt";
    document.body.appendChild(input);
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    row(buildPaletteCommands(makeDeps()), "import-file").run();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("does not throw when no file input is mounted", () => {
    expect(() => row(buildPaletteCommands(makeDeps()), "import-file").run()).not.toThrow();
  });

  it("opens the repository in a new tab with the opener severed", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    row(buildPaletteCommands(makeDeps()), "open-source").run();
    expect(open).toHaveBeenCalledWith(
      "https://github.com/Abdalla-Eldoumani/aarch64-playground",
      "_blank",
      "noopener,noreferrer",
    );
  });
});

describe("the plain pass-through rows", () => {
  it("calls exactly the callback it names", () => {
    const deps = makeDeps();
    const actions = buildPaletteCommands(deps);
    row(actions, "share").run();
    row(actions, "tutorial").run();
    row(actions, "base-converter").run();
    row(actions, "toggle-theme").run();
    row(actions, "format-source").run();
    row(actions, "help").run();
    expect(deps.openShare).toHaveBeenCalledTimes(1);
    expect(deps.openTour).toHaveBeenCalledTimes(1);
    expect(deps.openConverter).toHaveBeenCalledTimes(1);
    expect(deps.toggleTheme).toHaveBeenCalledTimes(1);
    expect(deps.formatSource).toHaveBeenCalledTimes(1);
    expect(deps.openShortcuts).toHaveBeenCalledTimes(1);
  });
});
