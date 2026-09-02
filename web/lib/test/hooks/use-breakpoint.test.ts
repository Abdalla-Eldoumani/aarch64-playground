import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { isAtLeast, useBreakpoint } from "@/lib/hooks/use-breakpoint";

afterEach(() => cleanup());

function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: px,
    configurable: true,
    writable: true,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("isAtLeast", () => {
  test("xs is the smallest, 2xl is the largest", () => {
    expect(isAtLeast("xs", "xs")).toBe(true);
    expect(isAtLeast("2xl", "xs")).toBe(true);
    expect(isAtLeast("xs", "sm")).toBe(false);
    expect(isAtLeast("md", "lg")).toBe(false);
    expect(isAtLeast("lg", "md")).toBe(true);
  });
});

describe("useBreakpoint", () => {
  test("classifies widths through every named threshold", () => {
    setWidth(360);
    const { result, rerender } = renderHook(() => useBreakpoint());
    act(() => setWidth(360));
    rerender();
    expect(result.current).toBe("xs");

    act(() => setWidth(640));
    expect(result.current).toBe("sm");
    act(() => setWidth(768));
    expect(result.current).toBe("md");
    act(() => setWidth(1024));
    expect(result.current).toBe("lg");
    act(() => setWidth(1280));
    expect(result.current).toBe("xl");
    act(() => setWidth(1536));
    expect(result.current).toBe("2xl");
  });

  test("unsubscribes on unmount", () => {
    setWidth(800);
    const { unmount, result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("md");
    unmount();
    // No assertion: this checks only that unmount runs the resize cleanup
    // without throwing.
  });
});
