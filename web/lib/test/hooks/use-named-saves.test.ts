import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});
