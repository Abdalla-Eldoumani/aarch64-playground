import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useCpsc355Mode } from "./use-cpsc355-mode";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
});

describe("useCpsc355Mode", () => {
  it("defaults to off", () => {
    const { result } = renderHook(() => useCpsc355Mode());
    expect(result.current.enabled).toBe(false);
  });

  it("toggles on and persists to localStorage", () => {
    const { result } = renderHook(() => useCpsc355Mode());
    act(() => { result.current.set(true); });
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem("aarch64-playground:cpsc355-mode")).toBe("on");
  });

  it("reads the persisted value on mount", () => {
    window.localStorage.setItem("aarch64-playground:cpsc355-mode", "on");
    const { result } = renderHook(() => useCpsc355Mode());
    expect(result.current.enabled).toBe(true);
  });
});
