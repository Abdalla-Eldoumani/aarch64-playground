import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { THEMES } from "@/lib/theme/themes";
import { THEME_TOKENS, type ThemeTokens } from "@/lib/theme/tokens";
import { contrast, over } from "@/lib/test/content/helpers/contrast";

/**
 * WCAG 2.2 AA in every theme, measured on the token values the page paints:
 * every text token on every surface and fill it can sit on at 4.5:1 (7:1 in
 * high contrast), disabled text at 3:1, and the marks a reader must find
 * (field edges, focus, the pc and breakpoint marks) at 3:1. Checking text
 * only against the page background is how high contrast once shipped a
 * 2.8:1 highlight.
 */

// Every token that is drawn as text somewhere. Placeholders count: the last
// test below holds them to tokens in this list.
const TEXT = [
  "text-primary",
  "text-secondary",
  "text-tertiary",
  "amber",
  "cyan",
  "success",
  "warning",
  "danger",
  "changed",
  "syntax-keyword",
  "syntax-register",
  "syntax-number",
  "syntax-string",
  "syntax-comment",
  "syntax-label",
] as const satisfies readonly (keyof ThemeTokens)[];

const SURFACES = ["bg-base", "bg-sunken", "bg-raised", "bg-panel", "bg-elevated"] as const;

// The translucent fills, painted on the two surfaces rows and code lines sit
// on. 15% is the strongest tint any component draws under text: the current
// line (amber), the breakpoint and error line (danger), a selected row
// (cyan), and the feedback bands (success, warning).
function surfaces(t: ThemeTokens): [string, string][] {
  const out: [string, string][] = SURFACES.map((s) => [s, t[s]]);
  for (const under of ["bg-base", "bg-sunken"] as const) {
    for (const role of ["amber", "cyan", "success", "warning", "danger"] as const) {
      out.push([`${role} 15% on ${under}`, over(t[role], t[under], 0.15)]);
    }
  }
  return out;
}

function shortfalls(pairs: [string, string, string][], bar: number): string[] {
  return pairs
    .map(([name, fg, bg]) => [name, contrast(fg, bg)] as const)
    .filter(([, ratio]) => ratio < bar)
    .map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}`);
}

const converter = readFileSync(path.join(process.cwd(), "components/panels/BaseConverter.tsx"), "utf8");

for (const { id } of THEMES) {
  const t = THEME_TOKENS[id];
  const textBar = id === "high-contrast" ? 7 : 4.5;

  describe(`${id} theme contrast`, () => {
    it(`every text token reads on every surface and fill at ${textBar}:1`, () => {
      const pairs: [string, string, string][] = [];
      for (const ink of TEXT) {
        for (const [name, surface] of surfaces(t)) pairs.push([`${ink} on ${name}`, t[ink], surface]);
      }
      expect(shortfalls(pairs, textBar)).toEqual([]);
    });

    it(`selected text reads on the selection at ${textBar}:1`, () => {
      // The page's own text inks, which ::selection keeps under its wash.
      const pairs: [string, string, string][] = [];
      for (const ink of ["text-primary", "text-secondary", "text-tertiary"] as const) {
        for (const under of ["bg-base", "bg-sunken"] as const) {
          pairs.push([`${ink} on selection over ${under}`, t[ink], over(t.selection, t[under])]);
        }
      }
      expect(shortfalls(pairs, textBar)).toEqual([]);
    });

    it(`the filled controls keep their labels at ${textBar}:1`, () => {
      const pairs: [string, string, string][] = [
        // MemoryPanel's changed byte, and the panels' filled buttons.
        ["text-primary on amber-dim", t["text-primary"], t["amber-dim"]],
        ["text-primary on cyan-dim", t["text-primary"], t["cyan-dim"]],
        // The primary action, at rest and hovered (Button.tsx mixes 12% of
        // the primary text into the fill).
        ["on-cyan on cyan", t["on-cyan"], t.cyan],
        ["on-cyan on hovered cyan", t["on-cyan"], over(t["text-primary"], t.cyan, 0.12)],
        // The embed's run button labels its cyan fill with the page colour.
        ["bg-base on cyan", t["bg-base"], t.cyan],
        ["text-primary on hovered secondary", t["text-primary"], over(t["text-primary"], t["bg-elevated"], 0.08)],
        // A disabled ui/Button: the tertiary ink on the sunken fill.
        ["text-tertiary on bg-sunken", t["text-tertiary"], t["bg-sunken"]],
      ];
      expect(shortfalls(pairs, textBar)).toEqual([]);
    });

    it("disabled text reads on every surface", () => {
      // Stricter than WCAG, which exempts disabled controls: a reader still
      // needs to know what the control would do. High contrast holds all
      // text, disabled included, to 7:1.
      const bar = id === "high-contrast" ? 7 : 3;
      const pairs = SURFACES.map((s): [string, string, string] => [
        `text-disabled on ${s}`,
        t["text-disabled"],
        t[s],
      ]);
      expect(shortfalls(pairs, bar)).toEqual([]);
    });

    it("field edges, focus and the machine's marks stand out at 3:1", () => {
      const marks = ["border-control", "focus", "amber", "cyan", "danger", "changed", "success"] as const;
      const pairs: [string, string, string][] = [];
      for (const mark of marks) {
        for (const s of SURFACES) pairs.push([`${mark} on ${s}`, t[mark], t[s]]);
      }
      // A breakpoint dot on the current line.
      pairs.push(["danger on the current line", t.danger, over(t.amber, t["bg-base"], 0.15)]);
      // BaseConverter's off bit cell is bg-raised; its hover border is read
      // from the component.
      const hover = /hover:border-\[var\(--([\w-]+)\)\]/.exec(converter)?.[1] ?? "missing";
      pairs.push([`converter hover --${hover}`, t[hover as keyof ThemeTokens], t["bg-raised"]]);
      expect(shortfalls(pairs, 3)).toEqual([]);
    });
  });
}

describe("placeholder text", () => {
  // Tailwind's preflight paints every placeholder a fixed grey that no theme
  // is measured against, so globals.css must override it with a token.
  it("takes a measured text token, by default and where a field sets its own", () => {
    const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    const rule =
      /@layer base\s*\{\s*input::placeholder,\s*textarea::placeholder\s*\{\s*color:\s*var\(--([a-z-]+)\);/.exec(css);
    expect(rule?.[1]).toBe("text-tertiary");
    expect(css.indexOf(rule?.[0] ?? "")).toBeGreaterThan(css.indexOf("@tailwind base"));

    const components = path.join(process.cwd(), "components");
    const own = readdirSync(components, { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".tsx"))
      .flatMap((f) => [
        ...readFileSync(path.join(components, f), "utf8").matchAll(
          /(disabled:)?placeholder:text-\[var\(--([a-z-]+)\)\]/g,
        ),
      ])
      .map((m) => ({ disabled: m[1] !== undefined, ink: m[2] }));
    expect(own.length).toBeGreaterThan(0);
    // A disabled field's placeholder takes the disabled ink, held to 3:1 above.
    const measured = ({ disabled, ink }: { disabled: boolean; ink: string }) =>
      disabled ? ink === "text-disabled" : (TEXT as readonly string[]).includes(ink);
    expect(own.filter((p) => !measured(p))).toEqual([]);
  });
});
