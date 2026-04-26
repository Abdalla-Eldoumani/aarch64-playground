import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useTheme } from "@/lib/use-theme";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

afterEach(() => cleanup());

describe("useTheme", () => {
  test("cycle visits dark, light, high-contrast and wraps", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    window.localStorage.setItem("aarch64-playground:theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("dark");
    act(() => result.current[1]());
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    act(() => result.current[1]());
    expect(document.documentElement.getAttribute("data-theme")).toBe("high-contrast");
    act(() => result.current[1]());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("persists to localStorage", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    window.localStorage.setItem("aarch64-playground:theme", "dark");
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]());
    expect(window.localStorage.getItem("aarch64-playground:theme")).toBe("light");
  });
});
