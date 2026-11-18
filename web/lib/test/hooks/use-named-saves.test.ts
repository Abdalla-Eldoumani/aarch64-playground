import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useNamedSaves } from "@/lib/hooks/use-named-saves";
import { clearSaves } from "@/lib/playground/named-saves";

afterEach(() => cleanup());

beforeEach(() => {
  clearSaves();
});

const sample = {
  name: "alpha",
  source: ".text\nmain:\n  ret\n",
  args: undefined,
  stdin: undefined,
  stepCount: 5,
  savedAt: "2026-04-25T19:00:00.000Z",
};

describe("useNamedSaves", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useNamedSaves());
    expect(result.current.saves).toEqual([]);
  });

  it("put adds a save and re-renders", () => {
    const { result } = renderHook(() => useNamedSaves());
    act(() => { result.current.put(sample); });
    expect(result.current.saves).toHaveLength(1);
    expect(result.current.saves[0].name).toBe("alpha");
  });

  it("remove deletes a save and re-renders", () => {
    const { result } = renderHook(() => useNamedSaves());
    act(() => { result.current.put(sample); });
    act(() => { result.current.remove("alpha"); });
    expect(result.current.saves).toEqual([]);
  });

  // A save storage refuses (a full quota, a private window) reports false and
  // never shows in the list.
  it("leaves the list as it was when storage refuses a save", () => {
    const { result } = renderHook(() => useNamedSaves());
    act(() => { result.current.put(sample); });
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    let stored = true;
    try {
      act(() => { stored = result.current.put({ ...sample, name: "beta" }); });
    } finally {
      spy.mockRestore();
    }
    expect(stored).toBe(false);
    expect(result.current.saves.map((s) => s.name)).toEqual(["alpha"]);
  });

  // The browser tells a page when another of its tabs writes the key; a
  // change to some other key leaves the list as it was.
  it("refreshes when another tab changes the saves, and only then", () => {
    const { result } = renderHook(() => useNamedSaves());
    const key = "aarch64-playground:named-saves";
    act(() => {
      window.localStorage.setItem(key, JSON.stringify([sample]));
      window.dispatchEvent(new StorageEvent("storage", { key, storageArea: window.localStorage }));
    });
    expect(result.current.saves.map((s) => s.name)).toEqual(["alpha"]);
    act(() => {
      window.localStorage.setItem(key, "[]");
      window.dispatchEvent(new StorageEvent("storage", { key: "aarch64-playground:theme" }));
    });
    expect(result.current.saves.map((s) => s.name)).toEqual(["alpha"]);
  });
});
