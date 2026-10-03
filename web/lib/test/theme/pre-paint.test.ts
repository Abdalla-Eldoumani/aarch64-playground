// The script that picks the theme before first paint, and its twin in the
// store: the same saved values and OS settings give the same theme in both,
// an unknown saved id falls back, and the browser chrome gets that theme's
// colour.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PRE_PAINT_SCRIPT } from "@/lib/theme/pre-paint";

const KEY = "aarch64-playground:theme";

function stubMedia(matching: string[]): void {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matching.includes(query) }));
}

function runScript(): string | null {
  // The same text the layout inlines, run the way the browser runs it.
  new Function(PRE_PAINT_SCRIPT)();
  return document.documentElement.getAttribute("data-theme");
}

async function storeAnswer(): Promise<string> {
  vi.resetModules();
  const { resolveTheme } = await import("@/lib/hooks/use-theme");
  return resolveTheme();
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const CASES: { name: string; saved: string | null; media: string[]; want: string }[] = [
  { name: "a saved theme wins over the OS", saved: "ember", media: ["(prefers-color-scheme: light)"], want: "ember" },
  { name: "a saved original theme still loads", saved: "high-contrast", media: [], want: "high-contrast" },
  { name: "an unknown saved id falls back", saved: "neon", media: [], want: "dark" },
  { name: "a prototype name is not a theme", saved: "constructor", media: [], want: "dark" },
  {
    name: "asking for more contrast gives high contrast",
    saved: null,
    media: ["(prefers-contrast: more)", "(prefers-color-scheme: light)"],
    want: "high-contrast",
  },
  { name: "an OS light scheme gives light", saved: null, media: ["(prefers-color-scheme: light)"], want: "light" },
  { name: "otherwise dark", saved: null, media: [], want: "dark" },
];

describe("first-visit precedence", () => {
  for (const c of CASES) {
    test(`${c.name}, in the script and in the store`, async () => {
      if (c.saved) window.localStorage.setItem(KEY, c.saved);
      stubMedia(c.media);
      expect(runScript()).toBe(c.want);
      expect(await storeAnswer()).toBe(c.want);
    });
  }

  test("blocked storage still follows the OS", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    stubMedia(["(prefers-color-scheme: light)"]);
    expect(runScript()).toBe("light");
  });
});

describe("the browser chrome colour", () => {
  test("goes first in <head> with the chosen theme's page colour and no media", () => {
    window.localStorage.setItem(KEY, "forest");
    stubMedia([]);
    runScript();
    const first = document.head.querySelector('meta[name="theme-color"]');
    expect(first?.getAttribute("content")).toBe("#0C1712");
    expect(first?.hasAttribute("media")).toBe(false);
  });
});
