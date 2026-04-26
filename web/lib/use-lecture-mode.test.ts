import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useLectureMode } from "./use-lecture-mode";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("lecture-mode");
});

describe("useLectureMode", () => {
  it("defaults to off", () => {
    const { result } = renderHook(() => useLectureMode());
    expect(result.current.enabled).toBe(false);
  });

  it("turning on saves the prior theme and forces high-contrast", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { result } = renderHook(() => useLectureMode());
    act(() => { result.current.set(true); });
    expect(document.documentElement.getAttribute("data-theme")).toBe("high-contrast");
    expect(document.documentElement.classList.contains("lecture-mode")).toBe(true);
  });

  it("turning off restores the prior theme", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { result } = renderHook(() => useLectureMode());
    act(() => { result.current.set(true); });
    act(() => { result.current.set(false); });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("lecture-mode")).toBe(false);
  });
});
