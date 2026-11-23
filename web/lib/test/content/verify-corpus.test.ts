import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// scripts/verify-corpus.js is CommonJS one level above web/ (vitest's cwd), so
// it is loaded by path; loading it runs nothing and loads no emulator.
const nodeRequire = createRequire(import.meta.url);
const corpus = nodeRequire(path.join(process.cwd(), "..", "scripts", "verify-corpus.js")) as {
  findSource: (root: string, stem: string) => string | null;
  fixtureTargets: () => { stem: string; source: string | null }[];
  assemblyTargets: () => { stem: string; helpers: string[] }[];
};

const ROOT = path.join(process.cwd(), "public", "examples", "cpsc355");

const DSAV_HELPERS = [
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

const DEADZONE_HELPERS = [
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

const FLAPPY_HELPERS = ["tty.s", "sim.s", "art.s", "gfx.s", "term.s", "save.s"];

describe("verify-corpus's example discovery", () => {
  it("runs each fixture stem against the main file of the same name", () => {
    const targets = corpus
      .fixtureTargets()
      .map(({ stem, source }) => [stem, source && path.relative(ROOT, source)]);
    expect(targets).toEqual([
      ["array-scores", "array-scores.s"],
      ["basics", "basics.s"],
      ["circle-area", "circle-area.s"],
      ["command-line-args", "command-line-args.s"],
      ["copy-file", "copy-file.s"],
      ["distance", "distance.s"],
      ["echo", "echo.s"],
      ["find-max", "find-max.s"],
      ["globals", "globals.s"],
      ["hello", "hello.s"],
      ["is-prime", "is-prime.s"],
      ["locals", "locals.s"],
      ["read-file", "read-file.s"],
      ["static-counter", "static-counter.s"],
      ["student-record", "student-record.s"],
      ["temp-convert", "temp-convert.s"],
      ["triangle-area", "triangle-area.s"],
      ["vector-brighten", "vector-brighten.s"],
      ["vector-dot", "vector-dot.s"],
      ["vector-mean", "vector-mean.s"],
      ["vector-strlen", "vector-strlen.s"],
      ["vector-sum", "vector-sum.s"],
      ["vector-upper", "vector-upper.s"],
      ["write-file", "write-file.s"],
    ]);
  });

  it("never resolves a stem to a file in a helper folder", () => {
    for (const helper of ["array", "sort", "input", "constants", "terminal"]) {
      expect(corpus.findSource(ROOT, helper)).toBeNull();
    }
  });

  it("assembles every shipped example, the multi-file ones with their helpers in paste order", () => {
    expect(corpus.assemblyTargets()).toEqual([
      { stem: "array-scores", helpers: [] },
      { stem: "basics", helpers: [] },
      { stem: "calc", helpers: [] },
      { stem: "circle-area", helpers: [] },
      { stem: "command-line-args", helpers: [] },
      { stem: "copy-file", helpers: [] },
      { stem: "deadzone", helpers: DEADZONE_HELPERS },
      { stem: "distance", helpers: [] },
      { stem: "dsav", helpers: DSAV_HELPERS },
      { stem: "echo", helpers: [] },
      { stem: "find-max", helpers: [] },
      { stem: "flappy", helpers: FLAPPY_HELPERS },
      { stem: "globals", helpers: [] },
      { stem: "hello", helpers: [] },
      { stem: "is-prime", helpers: [] },
      { stem: "locals", helpers: [] },
      { stem: "read-file", helpers: [] },
      { stem: "snake", helpers: [] },
      { stem: "static-counter", helpers: [] },
      { stem: "student-record", helpers: [] },
      { stem: "temp-convert", helpers: [] },
      { stem: "triangle-area", helpers: [] },
      { stem: "two-sum", helpers: [] },
      { stem: "vector-brighten", helpers: [] },
      { stem: "vector-dot", helpers: [] },
      { stem: "vector-mean", helpers: [] },
      { stem: "vector-strlen", helpers: [] },
      { stem: "vector-sum", helpers: [] },
      { stem: "vector-upper", helpers: [] },
      { stem: "write-file", helpers: [] },
    ]);
  });
});
