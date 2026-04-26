import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useHotspotMode } from "./use-hotspot-mode";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
});

describe("useHotspotMode", () => {
  it("defaults to off", () => {
    const { result } = renderHook(() => useHotspotMode());
    expect(result.current.enabled).toBe(false);
  });

  it("toggles on and persists to localStorage", () => {
    const { result } = renderHook(() => useHotspotMode());
    act(() => { result.current.set(true); });
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem("aarch64-playground:hotspot-mode")).toBe("on");
  });

  it("reads the persisted value on mount", () => {
    window.localStorage.setItem("aarch64-playground:hotspot-mode", "on");
    const { result } = renderHook(() => useHotspotMode());
    expect(result.current.enabled).toBe(true);
  });
});
