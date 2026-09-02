import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSaves,
  exportBundle,
  getSave,
  importBundle,
  listSaves,
  putSave,
  removeSave,
  type NamedSave,
} from "@/lib/playground/named-saves";

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
    expect(result).toEqual({ ok: true, added: 1, skipped: 1, stored: true });
    expect(getSave("alpha")?.stepCount).toBe(5); // not clobbered
    expect(getSave("gamma")?.stepCount).toBe(3);
  });

  it("importBundle names a structurally wrong payload instead of counting zeros", () => {
    // {added: 0, skipped: 0} reads as a clean import, so a wrong shape gets
    // its own outcome.
    expect(importBundle({ wrong: true })).toEqual({ ok: false, reason: "not-a-bundle" });
    expect(importBundle(null)).toEqual({ ok: false, reason: "not-a-bundle" });
    expect(importBundle("nope")).toEqual({ ok: false, reason: "not-a-bundle" });
    expect(importBundle({ version: 2, saves: [] })).toEqual({ ok: false, reason: "not-a-bundle" });
  });

  it("importBundle reports an all-rejected bundle as ok with zero added", () => {
    const result = importBundle({ version: 1, saves: [{ junk: true }, 42] });
    expect(result).toEqual({ ok: true, added: 0, skipped: 2, stored: true });
  });

  it("putSave reports whether storage accepted the write", () => {
    expect(putSave(makeSave("alpha"))).toBe(true);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    try {
      expect(putSave(makeSave("beta"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
    expect(getSave("beta")).toBeNull();
  });
});
