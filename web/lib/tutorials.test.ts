import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TUTORIALS, loadProgress, saveProgress } from "./tutorials";

const STORE_KEY = "aarch64-playground:tutorial-progress";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("tutorial catalog", () => {
  test("every tutorial has at least one step", () => {
    expect(TUTORIALS.length).toBeGreaterThan(0);
    for (const t of TUTORIALS) {
      expect(t.id).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.sourcePath).toMatch(/^\/examples\/cpsc355\//);
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });

  test("ids are unique across the catalog", () => {
    const ids = TUTORIALS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("expect blocks reference real registers", () => {
    const valid = /^(w|x)([0-9]|[12][0-9]|30)$|^(sp|pc)$/;
    for (const t of TUTORIALS) {
      for (const step of t.steps) {
        if (step.expect) {
          expect(step.expect.reg).toMatch(valid);
          expect(typeof step.expect.value).toBe("number");
        }
      }
    }
  });
});

describe("tutorial progress persistence", () => {
  test("loadProgress returns {} when nothing is stored", () => {
    expect(loadProgress()).toEqual({});
  });

  test("saveProgress + loadProgress round-trip", () => {
    saveProgress({ arithmetic: 3 });
    expect(loadProgress()).toEqual({ arithmetic: 3 });
  });

  test("loadProgress returns {} on malformed JSON", () => {
    window.localStorage.setItem(STORE_KEY, "{not valid json");
    expect(loadProgress()).toEqual({});
  });

  test("loadProgress returns {} on a non-object payload", () => {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(42));
    expect(loadProgress()).toEqual({});
  });

  test("saveProgress overwrites previous values", () => {
    saveProgress({ a: 1 });
    saveProgress({ b: 2 });
    expect(loadProgress()).toEqual({ b: 2 });
  });
});
