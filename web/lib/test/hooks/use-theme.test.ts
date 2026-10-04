// The one theme store: its cycle through the lineup, what it saves, how an
// unknown saved id falls back, that a switch lands at once, and the browser
// chrome colour it keeps in step.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const KEY = "aarch64-playground:theme";

type Store = typeof import("@/lib/hooks/use-theme");

// The store memoizes the resolved theme per module, so each test loads a
// fresh copy after setting up storage and media.
async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("@/lib/hooks/use-theme");
}

function stubMedia(matching: string[]): void {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matching.includes(query) }));
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  window.localStorage.clear();
  stubMedia([]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("useTheme", () => {
  test("the cycle visits every theme in lineup order and wraps", async () => {
    window.localStorage.setItem(KEY, "dark");
    const { useTheme } = await freshStore();
    const { result } = renderHook(() => useTheme());
    const seen: string[] = [result.current[0]];
    for (let i = 0; i < 10; i++) {
      act(() => result.current[1]());
      seen.push(document.documentElement.getAttribute("data-theme") ?? "");
    }
    expect(seen).toEqual([
      "dark",
      "light",
      "high-contrast",
      "midnight",
      "ember",
      "forest",
      "dusk",
      "paper",
      "glacier",
      "rose",
      "dark",
    ]);
  });

  test("persists a choice to localStorage", async () => {
    window.localStorage.setItem(KEY, "dark");
    const { useTheme } = await freshStore();
    const { result } = renderHook(() => useTheme());
    act(() => result.current[2]("forest"));
    expect(window.localStorage.getItem(KEY)).toBe("forest");
    expect(result.current[0]).toBe("forest");
  });

  test("a saved id that is no longer a theme falls back instead of sticking", async () => {
    window.localStorage.setItem(KEY, "neon");
    stubMedia(["(prefers-color-scheme: light)"]);
    const { useTheme } = await freshStore();
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  // A running view transition sends clicks to the page root, so a crossfade
  // would eat the reader's next click; the theme lands in the same call.
  test("a switch lands at once and never starts a view transition", async () => {
    const start = vi.fn();
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
    window.localStorage.setItem(KEY, "dark");
    const { useTheme } = await freshStore();
    const { result } = renderHook(() => useTheme());
    act(() => result.current[2]("rose"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("rose");
    act(() => result.current[1]());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(start).not.toHaveBeenCalled();
  });
});

describe("the browser chrome colour", () => {
  test("follows the page colour of the theme in use", async () => {
    const style = document.createElement("style");
    style.textContent = '[data-theme="ember"] { --bg-base: #14100D; }';
    document.head.append(style);
    try {
      const { useTheme } = await freshStore();
      const { result } = renderHook(() => useTheme());
      act(() => result.current[2]("ember"));
      const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
      expect(meta?.content).toBe("#14100D");
    } finally {
      style.remove();
    }
  });
});
