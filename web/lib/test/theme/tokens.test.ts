// The token source and the stylesheet it becomes: every theme carries every
// token in a form the contrast tests can measure, and the Tailwind config
// writes one custom-property block per theme, dark on :root as the default.
import { describe, expect, it, vi } from "vitest";
import tailwindConfig from "@/tailwind.config";
import { THEMES } from "@/lib/theme/themes";
import { SHARED_TOKENS, THEME_TOKENS, themeCssBlocks } from "@/lib/theme/tokens";

// Only these two are drawn over something else, so only they carry alpha.
const TRANSLUCENT = new Set(["selection", "grid-line"]);

describe("the token source", () => {
  it("gives every theme an opaque #RRGGBB for each token, and #RRGGBBAA only where it blends", () => {
    const wrong: string[] = [];
    for (const { id } of THEMES) {
      for (const [name, value] of Object.entries(THEME_TOKENS[id])) {
        const shape = TRANSLUCENT.has(name) ? /^#[0-9A-F]{8}$/ : /^#[0-9A-F]{6}$/;
        if (!shape.test(value)) wrong.push(`${id} ${name}: ${value}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("writes one block per theme, with dark as the default on :root", () => {
    const blocks = themeCssBlocks();
    expect(Object.keys(blocks)).toEqual([
      ":root",
      ':root, [data-theme="dark"]',
      '[data-theme="light"]',
      '[data-theme="high-contrast"]',
      '[data-theme="midnight"]',
      '[data-theme="ember"]',
      '[data-theme="forest"]',
      '[data-theme="dusk"]',
      '[data-theme="paper"]',
      '[data-theme="glacier"]',
      '[data-theme="rose"]',
    ]);
    expect(blocks[":root"]).toEqual({
      "--shadow-overlay": SHARED_TOKENS["shadow-overlay"],
      "--shadow-frame": SHARED_TOKENS["shadow-frame"],
    });
    expect(blocks['[data-theme="ember"]']["--bg-base"]).toBe("#14100D");
    expect(Object.keys(blocks['[data-theme="rose"]'])).toHaveLength(Object.keys(THEME_TOKENS.rose).length);
  });

  it("reaches the stylesheet through the Tailwind config's base layer", () => {
    const addBase = vi.fn();
    const plugins = tailwindConfig.plugins as unknown as { handler: (api: { addBase: typeof addBase }) => void }[];
    for (const p of plugins) p.handler({ addBase });
    expect(addBase).toHaveBeenCalledWith(themeCssBlocks());
  });
});
