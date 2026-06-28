import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSolvedSlugs, isSolved, markSolved, subscribeSolved } from "./solved-state";

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
