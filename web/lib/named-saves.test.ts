import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSaves,
  exportBundle,
  getSave,
  importBundle,
  listSaves,
  putSave,
  removeSave,
  type NamedSave,
} from "./named-saves";

afterEach(() => {
  clearSaves();
});

beforeEach(() => {
  clearSaves();
});

function makeSave(name: string, stepCount = 5): NamedSave {
  return {
    name,
    source: ".text\nmain:\n  ret\n",
    args: "hello",
    stdin: "",
    stepCount,
    savedAt: "2026-04-25T19:00:00.000Z",
  };
}

describe("named-saves", () => {
  it("starts empty", () => {
    expect(listSaves()).toEqual([]);
    expect(getSave("none")).toBeNull();
  });

  it("put / get / remove round-trips", () => {
    putSave(makeSave("alpha"));
    expect(listSaves().map((s) => s.name)).toEqual(["alpha"]);
    expect(getSave("alpha")?.stepCount).toBe(5);
    removeSave("alpha");
    expect(listSaves()).toEqual([]);
  });

  it("put overwrites an existing entry by name", () => {
    putSave(makeSave("alpha", 5));
    putSave(makeSave("alpha", 9));
    expect(listSaves()).toHaveLength(1);
    expect(getSave("alpha")?.stepCount).toBe(9);
  });

  it("exportBundle returns a versioned envelope", () => {
    putSave(makeSave("alpha"));
    putSave(makeSave("beta"));
    const bundle = exportBundle();
    expect(bundle.version).toBe(1);
    expect(bundle.saves.map((s) => s.name).sort()).toEqual(["alpha", "beta"]);
  });

  it("importBundle adds new entries and skips name collisions", () => {
    putSave(makeSave("alpha"));
    const incoming = {
      version: 1,
      saves: [makeSave("alpha", 99), makeSave("gamma", 3)],
    };
    const result = importBundle(incoming);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(getSave("alpha")?.stepCount).toBe(5); // not clobbered
    expect(getSave("gamma")?.stepCount).toBe(3);
  });

  it("importBundle rejects malformed input", () => {
    expect(importBundle({ wrong: true })).toEqual({ added: 0, skipped: 0 });
    expect(importBundle(null)).toEqual({ added: 0, skipped: 0 });
    expect(importBundle("nope")).toEqual({ added: 0, skipped: 0 });
  });
});
