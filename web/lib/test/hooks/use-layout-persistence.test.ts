import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLayoutPersistence } from "@/lib/hooks/use-layout-persistence";
import type { Breakpoint } from "@/lib/hooks/use-breakpoint";

// The layouts each derive a suffixed scope from their breakpoint; the hook
// only ever sees the string.
const scope = (name: string) => name as Breakpoint;

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

  it("keeps the tablet's two column scopes apart from the laptop's", () => {
    window.localStorage.setItem(`${KEY_PREFIX}lg-left`, "[70,30]");
    window.localStorage.setItem(`${KEY_PREFIX}lg-right`, "[45,55]");
    const left = renderHook(() =>
      useLayoutPersistence(scope("md-left"), [70, 30]),
    );
    const right = renderHook(() =>
      useLayoutPersistence(scope("md-right"), [45, 55]),
    );
    act(() => left.result.current[1]([85, 15]));
    act(() => right.result.current[1]([20, 80]));
    expect(window.localStorage.getItem(`${KEY_PREFIX}md-left`)).toBe("[85,15]");
    expect(window.localStorage.getItem(`${KEY_PREFIX}md-right`)).toBe("[20,80]");
    expect(window.localStorage.getItem(`${KEY_PREFIX}lg-left`)).toBe("[70,30]");
    expect(window.localStorage.getItem(`${KEY_PREFIX}lg-right`)).toBe("[45,55]");
  });

  it("reopens a tablet column on the split a previous visit stored", () => {
    window.localStorage.setItem(`${KEY_PREFIX}md-left`, "[85,15]");
    window.localStorage.setItem(`${KEY_PREFIX}md-right`, "[20,80]");
    const left = renderHook(() =>
      useLayoutPersistence(scope("md-left"), [70, 30]),
    );
    const right = renderHook(() =>
      useLayoutPersistence(scope("md-right"), [45, 55]),
    );
    expect(left.result.current[0]).toEqual([85, 15]);
    expect(right.result.current[0]).toEqual([20, 80]);
  });
  it("is not ready until the stored layout has been read", () => {
    const seen: boolean[] = [];
    const { result } = renderHook(() => {
      const tuple = useLayoutPersistence("lg", [60, 40]);
      seen.push(tuple[3]);
      return tuple;
    });
    expect(seen[0]).toBe(false);
    expect(result.current[3]).toBe(true);
  });

  it("ignores a save that arrives before the stored layout is read", () => {
    // The panel group reports its mounted layout the moment it can measure
    // itself, which beats this hook's load effect. That report must not be
    // written, or a reload loses the reader's split.
    window.localStorage.setItem(`${KEY_PREFIX}lg`, "[30,70]");
    const { result } = renderHook(() => {
      const tuple = useLayoutPersistence("lg", [60, 40]);
      if (!tuple[3]) tuple[1]([60, 40]);
      return tuple;
    });
    expect(window.localStorage.getItem(`${KEY_PREFIX}lg`)).toBe("[30,70]");
    expect(result.current[0]).toEqual([30, 70]);
  });

  it("writes nothing when a pre-load save lands on an empty scope", () => {
    renderHook(() => {
      const tuple = useLayoutPersistence("lg", [60, 40]);
      if (!tuple[3]) tuple[1]([99, 1]);
      return tuple;
    });
    expect(window.localStorage.getItem(`${KEY_PREFIX}lg`)).toBeNull();
  });

  it("saves normally once the read has run", () => {
    const { result } = renderHook(() => useLayoutPersistence("lg", [60, 40]));
    act(() => result.current[1]([25, 75]));
    expect(window.localStorage.getItem(`${KEY_PREFIX}lg`)).toBe("[25,75]");
  });
});
