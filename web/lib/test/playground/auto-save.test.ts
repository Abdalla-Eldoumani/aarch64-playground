import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutoSave, loadAutoSavedBuffer, useRecentPrograms } from "@/lib/playground/auto-save";

const CURRENT_KEY = "aarch64-playground:auto-save:current";
const RECENT_KEY = "aarch64-playground:auto-save:recent";

function flushDebounce(ms = 600): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useAutoSave", () => {
  it("writes the stable buffer value to localStorage after the debounce", async () => {
    const { rerender } = renderHook(({ v }: { v: string }) => useAutoSave(v), {
      initialProps: { v: "first" },
    });
    rerender({ v: "second" });
    await act(async () => {
      await flushDebounce();
    });
    expect(window.localStorage.getItem(CURRENT_KEY)).toBe("second");
  });

  it("does not write when disabled, so embedded surfaces never overwrite the saved buffer", async () => {
    window.localStorage.setItem(CURRENT_KEY, "playground work");
    const { rerender } = renderHook(
      ({ v }: { v: string }) => useAutoSave(v, false),
      { initialProps: { v: "hero program" } },
    );
    rerender({ v: "hero program stepped" });
    await act(async () => {
      await flushDebounce();
    });
    expect(window.localStorage.getItem(CURRENT_KEY)).toBe("playground work");
  });

  it("loadAutoSavedBuffer surfaces whatever was last saved", () => {
    window.localStorage.setItem(CURRENT_KEY, "saved");
    expect(loadAutoSavedBuffer()).toBe("saved");
  });

  it("loadAutoSavedBuffer returns null when nothing has been saved", () => {
    expect(loadAutoSavedBuffer()).toBeNull();
  });
});

describe("useRecentPrograms", () => {
  it("starts empty and populates via push", () => {
    const { result } = renderHook(() => useRecentPrograms());
    expect(result.current.entries).toEqual([]);
    act(() => result.current.push("first", "mov x0, 1"));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].name).toBe("first");
  });

  it("dedupes by content hash: re-pushing the same body moves it to the front", () => {
    const { result } = renderHook(() => useRecentPrograms());
    act(() => result.current.push("a", "mov x0, 1"));
    act(() => result.current.push("b", "mov x0, 2"));
    act(() => result.current.push("a-again", "mov x0, 1"));
    // Two distinct hashes, latest-first order.
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].name).toBe("a-again");
    expect(result.current.entries[1].name).toBe("b");
  });

  it("caps the ring at 10 entries", () => {
    const { result } = renderHook(() => useRecentPrograms());
    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.push(`name${i}`, `body${i}`);
      }
    });
    expect(result.current.entries).toHaveLength(10);
    // Oldest entries dropped; newest first.
    expect(result.current.entries[0].name).toBe("name14");
    expect(result.current.entries[9].name).toBe("name5");
  });

  it("clear empties the ring and persists the empty state", () => {
    const { result } = renderHook(() => useRecentPrograms());
    act(() => result.current.push("one", "one"));
    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
    expect(window.localStorage.getItem(RECENT_KEY)).toBe("[]");
  });
});
