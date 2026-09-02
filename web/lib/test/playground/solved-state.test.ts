import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProgressBundle,
  getSolvedSlugs,
  importProgressBundle,
  isSolved,
  markSolved,
  subscribeSolved,
} from "@/lib/playground/solved-state";
import {
  MAX_ANSWER_CHARS,
  putAnswer,
  readAnswer,
  saveAnswer,
} from "@/lib/playground/exercise-answers";

const SOLVED_KEY = "aarch64-playground:practice:solved";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("solved-state", () => {
  it("isSolved is false before and true after markSolved", () => {
    expect(isSolved("sum-two-numbers")).toBe(false);
    markSolved("sum-two-numbers");
    expect(isSolved("sum-two-numbers")).toBe(true);
  });

  it("markSolved is idempotent: a slug is stored once", () => {
    markSolved("loops");
    markSolved("loops");
    expect(getSolvedSlugs()).toEqual(["loops"]);
  });

  it("persists a JSON string array under the practice key", () => {
    markSolved("a");
    markSolved("b");
    expect(window.localStorage.getItem(SOLVED_KEY)).toBe(JSON.stringify(["a", "b"]));
  });

  it("getSolvedSlugs returns [] when nothing is stored", () => {
    expect(getSolvedSlugs()).toEqual([]);
  });

  it("getSolvedSlugs returns [] for a non-JSON stored value", () => {
    window.localStorage.setItem(SOLVED_KEY, "not json");
    expect(getSolvedSlugs()).toEqual([]);
  });

  it("getSolvedSlugs returns [] when the stored JSON is not a string array", () => {
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify({ solved: true }));
    expect(getSolvedSlugs()).toEqual([]);
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify([1, 2, 3]));
    expect(getSolvedSlugs()).toEqual([]);
  });

  it("subscribeSolved fires on a changing markSolved and stops after unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribeSolved(() => {
      calls += 1;
    });
    markSolved("x");
    expect(calls).toBe(1);
    // An idempotent re-mark changes nothing, so no further notification.
    markSolved("x");
    expect(calls).toBe(1);
    unsubscribe();
    markSolved("y");
    expect(calls).toBe(1);
  });

  it("does not throw when localStorage.setItem throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => markSolved("resilient")).not.toThrow();
    spy.mockRestore();
  });
});

describe("progress bundle export", () => {
  it("carries the current solved set at version 1", () => {
    markSolved("loops");
    markSolved("stack-frames");
    expect(buildProgressBundle()).toEqual({
      version: 2,
      solved: ["loops", "stack-frames"],
      answers: {},
    });
  });

  it("exports an empty bundle when nothing is solved", () => {
    expect(buildProgressBundle()).toEqual({ version: 2, solved: [], answers: {} });
  });
});

describe("progress bundle import", () => {
  it("round-trips an exported bundle into an empty browser", () => {
    markSolved("loops");
    markSolved("stack-frames");
    const bundle = buildProgressBundle();
    window.localStorage.clear();

    const result = importProgressBundle(bundle);

    expect(result).toEqual({ ok: true, added: 2, total: 2, answersAdded: 0 });
    expect(getSolvedSlugs()).toEqual(["loops", "stack-frames"]);
  });

  it("unions into the stored set instead of replacing it", () => {
    markSolved("here-already");
    const result = importProgressBundle({ version: 1, solved: ["from-the-file"] });
    expect(result).toEqual({ ok: true, added: 1, total: 2, answersAdded: 0 });
    expect(getSolvedSlugs()).toEqual(["here-already", "from-the-file"]);
  });

  it("counts nothing added when every entry is already solved", () => {
    markSolved("loops");
    const result = importProgressBundle({ version: 1, solved: ["loops"] });
    expect(result).toEqual({ ok: true, added: 0, total: 1, answersAdded: 0 });
    expect(getSolvedSlugs()).toEqual(["loops"]);
  });

  it("deduplicates repeated entries within one bundle", () => {
    const result = importProgressBundle({ version: 1, solved: ["loops", "loops", "  loops  "] });
    expect(result).toEqual({ ok: true, added: 1, total: 1, answersAdded: 0 });
    expect(getSolvedSlugs()).toEqual(["loops"]);
  });

  it("keeps a slug this build has never heard of", () => {
    // A bundle written by a newer catalog has to survive the round trip.
    importProgressBundle({ version: 1, solved: ["an-exercise-from-the-future"] });
    expect(getSolvedSlugs()).toEqual(["an-exercise-from-the-future"]);
  });

  it("notifies subscribers so an open index updates live", () => {
    let calls = 0;
    const unsubscribe = subscribeSolved(() => {
      calls += 1;
    });
    importProgressBundle({ version: 1, solved: ["loops"] });
    expect(calls).toBe(1);
    // Nothing new to store means nothing to announce.
    importProgressBundle({ version: 1, solved: ["loops"] });
    expect(calls).toBe(1);
    unsubscribe();
  });

  // Every hostile shape fails closed: a reason for the student, and the
  // stored set left exactly as it was.
  const rejected: { name: string; raw: unknown; error: string }[] = [
    {
      name: "a version this build does not know",
      raw: { version: 3, solved: ["loops"] },
      error: "that progress file has an unrecognized version",
    },
    {
      name: "a missing version",
      raw: { solved: ["loops"] },
      error: "that progress file has an unrecognized version",
    },
    {
      name: "a solved field that is not an array",
      raw: { version: 1, solved: { loops: true } },
      error: "that progress file has no list of solved exercises",
    },
    {
      name: "numbers in the array",
      raw: { version: 1, solved: ["loops", 7] },
      error: "that progress file has an entry that is not a name",
    },
    {
      name: "an empty entry",
      raw: { version: 1, solved: ["   "] },
      error: "that progress file has an empty entry",
    },
    {
      name: "an entry past the length cap",
      raw: { version: 1, solved: ["x".repeat(65)] },
      error: "that progress file has an entry longer than 64 characters",
    },
    {
      name: "more entries than the cap allows",
      raw: { version: 1, solved: Array.from({ length: 257 }, (_, i) => `e${i}`) },
      error: "that progress file lists too many exercises (max 256)",
    },
    {
      name: "a junk string",
      raw: "not a bundle at all",
      error: "that file is not a progress export",
    },
    { name: "null", raw: null, error: "that file is not a progress export" },
    {
      name: "a bare array",
      raw: ["loops"],
      error: "that file is not a progress export",
    },
  ];

  it.each(rejected)("refuses $name and writes nothing", ({ raw, error }) => {
    markSolved("untouched");
    const before = window.localStorage.getItem(SOLVED_KEY);

    expect(importProgressBundle(raw)).toEqual({ ok: false, error });

    expect(window.localStorage.getItem(SOLVED_KEY)).toBe(before);
    expect(getSolvedSlugs()).toEqual(["untouched"]);
  });

  it("accepts a bundle sitting exactly on the entry cap", () => {
    const solved = Array.from({ length: 256 }, (_, i) => `e${i}`);
    const result = importProgressBundle({ version: 1, solved });
    expect(result).toEqual({ ok: true, added: 256, total: 256, answersAdded: 0 });
  });
});

describe("progress bundle answers", () => {
  it("export carries the saved answers beside the ticks", () => {
    markSolved("loops");
    saveAnswer("loops", { kind: "write", source: "mov x0, 1\nret" });
    saveAnswer("flags-quiz", { kind: "quiz", answers: [1, null] });

    const bundle = buildProgressBundle();

    expect(bundle.solved).toEqual(["loops"]);
    expect(bundle.answers.loops).toMatchObject({ kind: "write", source: "mov x0, 1\nret" });
    expect(bundle.answers["flags-quiz"]).toMatchObject({ kind: "quiz", answers: [1, null] });
  });

  it("fills a slot that is empty on this device", () => {
    const result = importProgressBundle({
      version: 2,
      solved: [],
      answers: {
        loops: { version: 1, kind: "write", source: "from the file", updatedAt: 100 },
      },
    });

    expect(result).toEqual({ ok: true, added: 0, total: 0, answersAdded: 1 });
    expect(readAnswer("loops")).toMatchObject({ kind: "write", source: "from the file" });
  });

  it("keeps a newer local answer and takes a newer imported one", () => {
    putAnswer("newer-here", { version: 1, kind: "write", source: "mine", updatedAt: 500 });
    putAnswer("older-here", { version: 1, kind: "write", source: "mine", updatedAt: 10 });

    const result = importProgressBundle({
      version: 2,
      solved: [],
      answers: {
        "newer-here": { version: 1, kind: "write", source: "theirs", updatedAt: 100 },
        "older-here": { version: 1, kind: "write", source: "theirs", updatedAt: 900 },
      },
    });

    expect(result).toMatchObject({ ok: true, answersAdded: 1 });
    expect(readAnswer("newer-here")).toMatchObject({ source: "mine" });
    expect(readAnswer("older-here")).toMatchObject({ source: "theirs" });
  });

  it("skips a malformed answer and lands the rest of the file", () => {
    const result = importProgressBundle({
      version: 2,
      solved: ["loops"],
      answers: {
        good: { version: 1, kind: "write", source: "ret", updatedAt: 1 },
        "wrong-kind": { version: 1, kind: "essay", answers: ["a"], updatedAt: 1 },
        "no-stamp": { version: 1, kind: "write", source: "ret" },
        "not-an-object": "ret",
      },
    });

    expect(result).toEqual({ ok: true, added: 1, total: 1, answersAdded: 1 });
    expect(readAnswer("good")).toMatchObject({ kind: "write", source: "ret" });
    expect(readAnswer("wrong-kind")).toBeNull();
    expect(readAnswer("no-stamp")).toBeNull();
    expect(readAnswer("not-an-object")).toBeNull();
  });

  it("skips an answer past the character cap", () => {
    const result = importProgressBundle({
      version: 2,
      solved: [],
      answers: {
        huge: {
          version: 1,
          kind: "write",
          source: "x".repeat(MAX_ANSWER_CHARS),
          updatedAt: 1,
        },
      },
    });

    expect(result).toMatchObject({ ok: true, answersAdded: 0 });
    expect(readAnswer("huge")).toBeNull();
  });

  it("accepts a version 1 file that has no answers at all", () => {
    saveAnswer("loops", { kind: "write", source: "kept" });
    const result = importProgressBundle({ version: 1, solved: ["loops"] });
    expect(result).toEqual({ ok: true, added: 1, total: 1, answersAdded: 0 });
    expect(readAnswer("loops")).toMatchObject({ source: "kept" });
  });

  it("refuses a file whose answers section is not a map", () => {
    markSolved("untouched");
    expect(importProgressBundle({ version: 2, solved: [], answers: ["loops"] })).toEqual({
      ok: false,
      error: "that progress file has a malformed answers section",
    });
    expect(getSolvedSlugs()).toEqual(["untouched"]);
  });

  it("refuses a file carrying more answers than the entry cap", () => {
    const answers: Record<string, unknown> = {};
    for (let i = 0; i < 257; i++) {
      answers[`e${i}`] = { version: 1, kind: "write", source: "ret", updatedAt: 1 };
    }
    expect(importProgressBundle({ version: 2, solved: [], answers })).toEqual({
      ok: false,
      error: "that progress file lists too many exercises (max 256)",
    });
  });

  it("round-trips answers through an export into an empty browser", () => {
    markSolved("loops");
    saveAnswer("loops", { kind: "write", source: "my work" });
    saveAnswer("trace", { kind: "predict", answers: ["7"] });
    const bundle = JSON.parse(JSON.stringify(buildProgressBundle())) as unknown;
    window.localStorage.clear();

    expect(importProgressBundle(bundle)).toEqual({
      ok: true,
      added: 1,
      total: 1,
      answersAdded: 2,
    });
    expect(readAnswer("loops")).toMatchObject({ kind: "write", source: "my work" });
    expect(readAnswer("trace")).toMatchObject({ kind: "predict", answers: ["7"] });
  });
});
