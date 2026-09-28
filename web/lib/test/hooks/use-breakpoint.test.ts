import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { isAtLeast, phoneShape, useBreakpoint, usePhoneShape } from "@/lib/hooks/use-breakpoint";

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
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount, result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("md");
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    remove.mockRestore();
  });

  test("a phone's very first render is already xs, never the laptop's lg", () => {
    // Reading the width one effect late made every phone mount the laptop
    // layout, lay it out, and throw it away a frame later.
    setWidth(360);
    const seen: string[] = [];
    renderHook(() => {
      const bp = useBreakpoint();
      seen.push(bp);
      return bp;
    });
    expect(seen[0]).toBe("xs");
    expect(seen).not.toContain("lg");
  });
});

describe("phoneShape", () => {
  test("a phone held upright is portrait", () => {
    expect(phoneShape(390, 844)).toBe("portrait");
    expect(phoneShape(320, 568)).toBe("portrait");
  });

  test("a phone on its side is landscape even when it is tablet-wide", () => {
    expect(phoneShape(844, 390)).toBe("landscape");
    expect(phoneShape(863, 360)).toBe("landscape");
  });

  test("tablets and laptops get no phone arrangement", () => {
    expect(phoneShape(810, 1080)).toBeNull();
    expect(phoneShape(1080, 810)).toBeNull();
    expect(phoneShape(1024, 768)).toBeNull();
    expect(phoneShape(1440, 900)).toBeNull();
  });
});

describe("usePhoneShape", () => {
  test("a phone's very first render already has its shape", () => {
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
    setWidth(390);
    const seen: Array<string | null> = [];
    renderHook(() => {
      const shape = usePhoneShape();
      seen.push(shape);
      return shape;
    });
    expect(seen[0]).toBe("portrait");
    expect(seen).not.toContain(null);
  });

  test("follows a rotation", () => {
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
    setWidth(390);
    const { result } = renderHook(() => usePhoneShape());
    expect(result.current).toBe("portrait");
    act(() => {
      Object.defineProperty(window, "innerHeight", { value: 390, configurable: true, writable: true });
      setWidth(844);
    });
    expect(result.current).toBe("landscape");
  });
});
