import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * WCAG contrast over the pairs components actually compose, read from the
 * real stylesheet. Token-level fg-on-surface checks never see a background
 * TOKEN paired with a text token (the memory panel's changed-byte cell
 * paints bg-[--amber-dim] under text-[--text-primary]), which is exactly
 * how the high-contrast theme once shipped a 2.8:1 highlight.
 */

// Line endings normalized so the block lookups hold on a CRLF checkout.
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8").replace(
  /\r\n/g,
  "\n",
);

/** The tokens of one theme block, name -> #hex. */
function themeTokens(openingSelector: string): Record<string, string> {
  const start = css.indexOf(openingSelector);
  expect(start, `theme block ${openingSelector} exists`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const tokens: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = {
  dark: ':root,\n[data-theme="dark"]',
  light: '[data-theme="light"]',
  "high-contrast": '[data-theme="high-contrast"]',
} as const;

describe("theme token contrast", () => {
  for (const [theme, selector] of Object.entries(THEMES)) {
    const t = themeTokens(selector);

    it(`${theme}: the changed-byte highlight clears AA under its text`, () => {
      // MemoryPanel.tsx composes bg-[var(--amber-dim)] with
      // text-[var(--text-primary)] on the byte that just changed.
      expect(contrast(t["amber-dim"], t["text-primary"])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: primary and secondary ink clear AA on both surfaces`, () => {
      for (const ink of ["text-primary", "text-secondary"]) {
        for (const surface of ["bg-base", "bg-panel"]) {
          expect(
            contrast(t[ink], t[surface]),
            `${ink} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});
