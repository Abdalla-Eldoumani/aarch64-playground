import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ANSWER_CHARS,
  clearAnswer,
  putAnswer,
  readAllAnswers,
  readAnswer,
  saveAnswer,
  validateAnswer,
  type StoredAnswer,
} from "@/lib/playground/exercise-answers";

const KEY = (slug: string) => `aarch64-playground:practice:answer:${slug}`;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("exercise answers store", () => {
  it("round-trips a coding answer", () => {
    saveAnswer("sum-two", { kind: "write", source: "mov x0, 1\nret" });
    expect(readAnswer("sum-two")).toMatchObject({
      version: 1,
      kind: "write",
      source: "mov x0, 1\nret",
    });
  });

  it("round-trips each theory answer shape", () => {
    saveAnswer("a-quiz", { kind: "quiz", answers: [2, null, 0] });
    saveAnswer("a-blanks", { kind: "blanks", answers: ["ldr", ""] });
    saveAnswer("a-predict", { kind: "predict", answers: ["42"] });
    expect(readAnswer("a-quiz")).toMatchObject({ kind: "quiz", answers: [2, null, 0] });
    expect(readAnswer("a-blanks")).toMatchObject({ kind: "blanks", answers: ["ldr", ""] });
    expect(readAnswer("a-predict")).toMatchObject({ kind: "predict", answers: ["42"] });
  });

  it("stamps updatedAt on every save", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    saveAnswer("stamped", { kind: "write", source: "ret" });
    expect(readAnswer("stamped")?.updatedAt).toBe(1_700_000_000_000);
  });

  it("stores one key per slug", () => {
    saveAnswer("first", { kind: "write", source: "a" });
    saveAnswer("second", { kind: "write", source: "b" });
    expect(window.localStorage.getItem(KEY("first"))).toContain('"source":"a"');
    expect(window.localStorage.getItem(KEY("second"))).toContain('"source":"b"');
  });

  it("returns null when nothing is stored", () => {
    expect(readAnswer("never-visited")).toBeNull();
  });

  it("clearAnswer forgets one slug and leaves the others", () => {
    saveAnswer("kept", { kind: "write", source: "a" });
    saveAnswer("dropped", { kind: "write", source: "b" });
    clearAnswer("dropped");
    expect(readAnswer("dropped")).toBeNull();
    expect(readAnswer("kept")).not.toBeNull();
  });

  it("refuses an answer past the character cap and stores nothing", () => {
    const stored = saveAnswer("huge", { kind: "write", source: "x".repeat(MAX_ANSWER_CHARS) });
    expect(stored).toBe(false);
    expect(readAnswer("huge")).toBeNull();
  });

  it("accepts an answer just under the cap", () => {
    // The wrapper fields cost well under 100 characters.
    const stored = saveAnswer("large", {
      kind: "write",
      source: "x".repeat(MAX_ANSWER_CHARS - 100),
    });
    expect(stored).toBe(true);
    expect(readAnswer("large")?.kind).toBe("write");
  });

  it("does not throw when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => saveAnswer("resilient", { kind: "write", source: "ret" })).not.toThrow();
    expect(saveAnswer("resilient", { kind: "write", source: "ret" })).toBe(false);
  });

  const malformed: { name: string; raw: string }[] = [
    { name: "non-json", raw: "not json" },
    { name: "a bare array", raw: JSON.stringify([1, 2]) },
    { name: "a missing version", raw: JSON.stringify({ kind: "write", source: "a", updatedAt: 1 }) },
    {
      name: "a version this build does not know",
      raw: JSON.stringify({ version: 2, kind: "write", source: "a", updatedAt: 1 }),
    },
    { name: "a missing updatedAt", raw: JSON.stringify({ version: 1, kind: "write", source: "a" }) },
    {
      name: "an unknown kind",
      raw: JSON.stringify({ version: 1, kind: "essay", answers: ["a"], updatedAt: 1 }),
    },
    {
      name: "a write answer with no source",
      raw: JSON.stringify({ version: 1, kind: "write", updatedAt: 1 }),
    },
    {
      name: "a quiz answer holding strings",
      raw: JSON.stringify({ version: 1, kind: "quiz", answers: ["2"], updatedAt: 1 }),
    },
    {
      name: "a blanks answer holding numbers",
      raw: JSON.stringify({ version: 1, kind: "blanks", answers: [7], updatedAt: 1 }),
    },
  ];

  it.each(malformed)("ignores $name rather than throwing", ({ raw }) => {
    window.localStorage.setItem(KEY("tampered"), raw);
    expect(() => readAnswer("tampered")).not.toThrow();
    expect(readAnswer("tampered")).toBeNull();
  });

  it("keeps only the fields of the named kind", () => {
    const answer = validateAnswer({
      version: 1,
      kind: "write",
      source: "ret",
      answers: ["smuggled"],
      updatedAt: 5,
    });
    expect(answer).toEqual({ version: 1, kind: "write", source: "ret", updatedAt: 5 });
  });
});

describe("readAllAnswers", () => {
  it("collects every saved answer keyed by slug", () => {
    saveAnswer("one", { kind: "write", source: "a" });
    saveAnswer("two", { kind: "quiz", answers: [1] });
    const all = readAllAnswers();
    expect(Object.keys(all).sort()).toEqual(["one", "two"]);
    expect(all.two).toMatchObject({ kind: "quiz", answers: [1] });
  });

  it("returns an empty map when nothing is saved", () => {
    expect(readAllAnswers()).toEqual({});
  });

  it("ignores unrelated keys and malformed entries", () => {
    saveAnswer("good", { kind: "write", source: "a" });
    window.localStorage.setItem("aarch64-playground:auto-save:current", "mov x0, 1");
    window.localStorage.setItem(KEY("bad"), "{not json");
    expect(Object.keys(readAllAnswers())).toEqual(["good"]);
  });

  it("carries the exporting device's updatedAt through putAnswer", () => {
    const answer: StoredAnswer = { version: 1, kind: "write", source: "ret", updatedAt: 42 };
    expect(putAnswer("imported", answer)).toBe(true);
    expect(readAnswer("imported")).toEqual(answer);
  });
});
