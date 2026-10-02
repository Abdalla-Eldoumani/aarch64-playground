import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Rules in globals.css that jsdom cannot apply, read from the real file:
 * every animation waits for no-preference, nothing animated is left unused,
 * Monaco's own fades stop under reduced motion, a lesson frame fits a phone on
 * its side, and a control with no focus style of its own gets the cyan ring.
 */

// Comments out and line endings normalized, so prose about a rule never
// passes for the rule and the lookups hold on a CRLF checkout.
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** The body of every block whose prelude is exactly `prelude`. */
function blocks(prelude: string): string[] {
  const bodies: string[] = [];
  for (let at = css.indexOf(prelude); at >= 0; at = css.indexOf(prelude, at + 1)) {
    const open = css.indexOf("{", at);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        bodies.push(css.slice(open + 1, i));
        break;
      }
    }
  }
  expect(bodies.length, `a block opens with ${prelude}`).toBeGreaterThan(0);
  return bodies;
}

/** Every .ts and .tsx file the site ships, tests left out. */
const shipped = ["app", "components", "lib"]
  .flatMap((dir) =>
    (readdirSync(dir, { recursive: true }) as string[]).map((file) => path.join(dir, file)),
  )
  .filter((file) => /\.tsx?$/.test(file) && !file.split(path.sep).includes("test"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

describe("motion in globals.css", () => {
  it("plays every animation only for a reader who has not asked for less motion", () => {
    let outside = css;
    for (const body of blocks("@media (prefers-reduced-motion: no-preference)")) {
      outside = outside.replace(body, "");
    }
    expect(outside).not.toMatch(/\banimation(?:-name)?\s*:/);
  });

  it("plays every keyframes rule and leaves no animation class unused", () => {
    const played = new Set([...css.matchAll(/\banimation(?:-name)?\s*:\s*([\w-]+)/g)].map((m) => m[1]));
    for (const [, name] of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
      expect(played, `@keyframes ${name}`).toContain(name);
    }
    for (const name of new Set([...css.matchAll(/\.(anim-[\w-]+)/g)].map((m) => m[1]))) {
      expect(shipped.includes(name), `.${name} is used by a component`).toBe(true);
    }
  });

  it("stops Monaco's own fades under reduced motion", () => {
    const reduce = blocks("@media (prefers-reduced-motion: reduce)").join("\n");
    expect(reduce).toMatch(/\.monaco-editor,\s*\.monaco-editor \*\s*\{\s*transition: none !important;\s*\}/);
  });
});

describe("the lesson frame on a short screen", () => {
  it("takes the screen less the site bar under 500px tall, over every width's height", () => {
    const short = blocks("@media (max-height: 499.98px)").join("\n");
    expect(short).toMatch(
      /\.embed-frame\.embed-frame\s*\{\s*height: calc\(100vh - 4rem\);\s*height: calc\(100svh - 4rem\);\s*min-height: 0;\s*\}/,
    );
  });

  it("keeps the portrait phone rule as it was", () => {
    const phone = blocks("@media (max-width: 639.98px) {").join("\n");
    expect(phone).toMatch(
      /\.embed-frame\s*\{\s*height: min\(72vh, 560px\);\s*height: min\(72svh, 560px\);\s*min-height: 420px;\s*\}/,
    );
  });
});

describe("focus in globals.css", () => {
  it("draws the cyan band on any control that has no focus style of its own", () => {
    expect(css).toMatch(
      /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):where\(:focus-visible\)\s*\{\s*outline: 2px solid var\(--focus\);\s*outline-offset: 2px;\s*\}/,
    );
  });
});
