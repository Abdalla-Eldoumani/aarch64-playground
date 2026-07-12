import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLayoutPersistence } from "@/lib/hooks/use-layout-persistence";

const KEY_PREFIX = "aarch64-playground:layout:";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useLayoutPersistence", () => {
  it("returns the fallback when no persisted layout exists", () => {
    const { result } = renderHook(() =>
      useLayoutPersistence("lg", [60, 40]),
    );
    expect(result.current[0]).toEqual([60, 40]);
  });

  it("save writes a per-breakpoint entry and updates state", () => {
    const { result } = renderHook(() =>
      useLayoutPersistence("lg", [60, 40]),
    );
    act(() => result.current[1]([70, 30]));
    expect(result.current[0]).toEqual([70, 30]);
    expect(window.localStorage.getItem(`${KEY_PREFIX}lg`)).toBe("[70,30]");
  });

  it("entries per breakpoint are independent", () => {
    const lg = renderHook(() => useLayoutPersistence("lg", [60, 40]));
    const md = renderHook(() => useLayoutPersistence("md", [55, 45]));
    act(() => lg.result.current[1]([30, 70]));
    // md sees its own fallback, not lg's update.
    expect(md.result.current[0]).toEqual([55, 45]);
  });

  it("reset clears only the current breakpoint", () => {
    window.localStorage.setItem(`${KEY_PREFIX}lg`, "[70,30]");
    window.localStorage.setItem(`${KEY_PREFIX}md`, "[80,20]");
    const { result } = renderHook(() =>
      useLayoutPersistence("lg", [60, 40]),
    );
    act(() => result.current[2]());
    expect(window.localStorage.getItem(`${KEY_PREFIX}lg`)).toBeNull();
    expect(window.localStorage.getItem(`${KEY_PREFIX}md`)).toBe("[80,20]");
  });

  it("ignores malformed localStorage payloads and falls back", () => {
    window.localStorage.setItem(`${KEY_PREFIX}lg`, "not json");
    const { result } = renderHook(() =>
      useLayoutPersistence("lg", [60, 40]),
    );
    expect(result.current[0]).toEqual([60, 40]);
  });
});
