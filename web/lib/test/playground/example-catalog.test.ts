import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  exampleFor,
  fetchExample,
  legacyModeArgsFor,
  modeArgsFor,
  resolveHandoff,
} from "@/lib/playground/playground-handoff";

// What the app does with each shipped example: what a load delivers, whether
// the run-mode control is offered, what the mode puts in the args box, and
// which old `?example=` names still open it. Every row is typed out, so a
// change to any example's facts shows up here.

interface Facts {
  launch?: "terminal";
  files?: string[];
  inputs?: ("args" | "stdin" | "vfs")[];
  interactive?: true;
  /** [console mode, terminal mode, the pre-argv[0] console seed]. */
  modeArgs?: (string | null)[];
}

const DSAV_FILES = [
  "theme.s",
  "ui.s",
  "ansi.s",
  "display.s",
  "utils.s",
  "array.s",
  "stack.s",
  "queue.s",
  "list.s",
  "bst.s",
  "rbt.s",
  "heap.s",
  "hash.s",
  "graph.s",
  "sort.s",
  "search.s",
  "recursion.s",
];

const DEADZONE_FILES = [
  "constants.s",
  "terminal.s",
  "input.s",
  "player.s",
  "enemies.s",
  "projectiles.s",
  "upgrades.s",
  "file-io.s",
  "effects.s",
  "boss.s",
  "abilities.s",
];

const FLAPPY_FILES = ["tty.s", "sim.s", "art.s", "gfx.s", "term.s", "save.s"];

const EXPECTED: Record<string, Facts> = {
  basics: {},
  distance: {},
  globals: {},
  locals: { inputs: ["stdin"] },
  "array-scores": { inputs: ["stdin"] },
  "student-record": { inputs: ["stdin"] },
  "find-max": {},
  "is-prime": {},
  "static-counter": {},
  "command-line-args": { inputs: ["args"] },
  "circle-area": { inputs: ["stdin"] },
  "triangle-area": { inputs: ["stdin"] },
  hello: {},
  echo: { inputs: ["stdin"] },
  "write-file": {},
  "read-file": { inputs: ["vfs"] },
  "copy-file": { inputs: ["vfs"] },
  "vector-upper": { inputs: ["stdin"] },
  "vector-strlen": { inputs: ["stdin"] },
  "vector-sum": {},
  "vector-dot": {},
  "vector-brighten": {},
  "vector-mean": {},
  snake: { interactive: true },
  dsav: { launch: "terminal", files: DSAV_FILES, interactive: true },
  calc: { interactive: true, modeArgs: ["console", "", "./calc console"] },
  "temp-convert": {
    inputs: ["args"],
    interactive: true,
    modeArgs: ["console", "", "./temp-convert console"],
  },
  "two-sum": {
    launch: "terminal",
    interactive: true,
    modeArgs: ["console", "", "./two-sum console"],
  },
  deadzone: { files: DEADZONE_FILES, interactive: true },
  flappy: { launch: "terminal", files: FLAPPY_FILES, interactive: true },
};

const ALIASES: [string, string][] = [
  ["week03_exercise", "basics"],
  ["week08_scores", "array-scores"],
  ["week09_student_record", "student-record"],
  ["week10_find_max", "find-max"],
  ["week11_argv", "command-line-args"],
  ["week11_static_counter", "static-counter"],
  ["week12_fp_circle", "circle-area"],
  ["week12_is_prime", "is-prime"],
  ["week13_hello", "hello"],
  ["week13_echo", "echo"],
  ["week13_write_file", "write-file"],
  ["week13_read_file", "read-file"],
  ["week13_copy_file", "copy-file"],
];

/** Serve every URL, with a body each fixture kind parses. */
function serveEverything() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => (url.endsWith(".vfs.json") ? '{"f.txt": "x"}' : "x\n"),
    })),
  );
}

async function observe(stem: string): Promise<Facts> {
  const payload = await fetchExample(stem);
  expect([payload.stem, payload.label]).toEqual([stem, stem]);
  const facts: Facts = {};
  if (payload.launch) facts.launch = payload.launch as "terminal";
  if (payload.files) facts.files = payload.files.map((file) => file.name);
  const inputs = (["args", "stdin", "vfs"] as const).filter((kind) => payload[kind] !== undefined);
  if (inputs.length > 0) facts.inputs = inputs;
  if (exampleFor(stem)?.interactive === true) facts.interactive = true;
  const modeArgs = [modeArgsFor(stem, "console"), modeArgsFor(stem, "terminal"), legacyModeArgsFor(stem)];
  if (modeArgs.some((value) => value !== null)) facts.modeArgs = modeArgs;
  return facts;
}

const BOOT = { fromShare: false, fromBundle: false };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("every shipped example as the app sees it", () => {
  it("has a main file for every example and an example for every main file", () => {
    const dir = path.join(process.cwd(), "public/examples/cpsc355");
    const mains = fs.readdirSync(dir).filter((file) => file.endsWith(".s"));
    expect(mains.map((file) => file.slice(0, -2)).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("loads each one with its launch, helper files and inputs, and offers the same mode control", async () => {
    serveEverything();
    const observed: Record<string, Facts> = {};
    for (const stem of Object.keys(EXPECTED)) observed[stem] = await observe(stem);
    expect(observed).toEqual(EXPECTED);
  });

  it("opens an old `?example=` name as the example it was renamed to", () => {
    for (const [legacy, stem] of ALIASES) {
      expect(resolveHandoff(BOOT, `?example=${legacy}`, "")).toEqual({ kind: "example", stem });
    }
  });

  it("opens every current name as itself", () => {
    for (const stem of Object.keys(EXPECTED)) {
      expect(resolveHandoff(BOOT, `?example=${stem}`, "")).toEqual({ kind: "example", stem });
    }
  });

  it("passes a name it does not know through unchanged", () => {
    expect(resolveHandoff(BOOT, "?example=not-an-example", "")).toEqual({
      kind: "example",
      stem: "not-an-example",
    });
  });

  it("refuses a built-in object key as an invalid example name, before any fetch", async () => {
    serveEverything();
    for (const key of [
      "constructor",
      "__proto__",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "toLocaleString",
      "__defineGetter__",
      "__defineSetter__",
      "__lookupGetter__",
      "__lookupSetter__",
    ]) {
      const decision = resolveHandoff(BOOT, `?example=${key}`, "");
      expect(decision?.kind).toBe("example");
      if (decision?.kind !== "example") continue;
      await expect(fetchExample(decision.stem), key).rejects.toThrow("invalid example name");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
