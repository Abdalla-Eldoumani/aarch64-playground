import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useZoom } from "@/lib/hooks/use-zoom";

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("useZoom", () => {
  test("starts at scale 1 when nothing is stored", () => {
    const { result } = renderHook(() => useZoom("editor"));
    expect(result.current.scale).toBe(1);
  });

  test("zoomIn / zoomOut clamp at the configured bounds", () => {
    const { result } = renderHook(() => useZoom("editor"));
    for (let i = 0; i < 20; i++) {
      act(() => result.current.zoomIn());
    }
    expect(result.current.scale).toBeLessThanOrEqual(1.8);
    for (let i = 0; i < 50; i++) {
      act(() => result.current.zoomOut());
    }
    expect(result.current.scale).toBeGreaterThanOrEqual(0.6);
  });

  test("setScale rounds to two decimals", () => {
    const { result } = renderHook(() => useZoom("editor"));
    act(() => result.current.setScale(1.234));
    expect(result.current.scale).toBe(1.23);
  });

  test("reset returns scale to 1 and persists it", () => {
    const { result } = renderHook(() => useZoom("editor"));
    act(() => result.current.zoomIn());
    act(() => result.current.reset());
    expect(result.current.scale).toBe(1);
    expect(window.localStorage.getItem("aarch64-playground:zoom:editor")).toBe("1");
  });

  test("persists per storage key so panels stay independent", () => {
    const a = renderHook(() => useZoom("editor"));
    const b = renderHook(() => useZoom("memory"));
    act(() => a.result.current.zoomIn());
    expect(a.result.current.scale).toBeGreaterThan(1);
    expect(b.result.current.scale).toBe(1);
  });

  test("ignores out-of-range stored values on init", () => {
    window.localStorage.setItem("aarch64-playground:zoom:editor", "9");
    const { result } = renderHook(() => useZoom("editor"));
    expect(result.current.scale).toBe(1);
  });

  test("ignores non-numeric stored values on init", () => {
    window.localStorage.setItem("aarch64-playground:zoom:editor", "not-a-number");
    const { result } = renderHook(() => useZoom("editor"));
    expect(result.current.scale).toBe(1);
  });

  test("style spread includes the --font-scale CSS var", () => {
    const { result } = renderHook(() => useZoom("editor"));
    act(() => result.current.setScale(1.4));
    const style = result.current.style as Record<string, string>;
    expect(style["--font-scale"]).toBe("1.4");
  });
});
