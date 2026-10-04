import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Quieter text takes a measured text token, never a fade. Opacity mixes the
 * ink into whatever sits under it, so the colour a reader gets is one no
 * contrast test measures: faded disabled labels fell to 2.2:1. A disabled
 * control takes --text-disabled (and the elevated fill, as ui/Button does);
 * a quieter state takes text-secondary or text-tertiary, or a cue that is
 * not colour (weight, a dashed edge, an underline).
 *
 * This scans every class string, style object and CSS rule the site ships.
 * Opacity inside @keyframes is motion, a state passing on its way to full
 * ink, so CSS is read with its keyframes taken out.
 */

const ROOT = process.cwd();

// Each entry is a fade on something that is not text, with the reason it stays.
const ALLOWED: { file: string; fade: string; reason: string }[] = [
  {
    file: "app/globals.css",
    fade: "opacity: 0",
    reason: "the decode strip's amber latch ring, a bare border on a ::before layer, rests hidden until a step flashes it",
  },
  {
    file: "app/globals.css",
    fade: "opacity: 1",
    reason: "not a fade: it lifts Monaco's own 40% fade off the find box's disabled toggle, which keeps the disabled ink",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (/(^|\/)(node_modules|test|wasm|wasm-node)$/.test(rel)) continue;
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(css|ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

// A class token that fades: an opacity utility under any variants
// (`disabled:opacity-50`, `!opacity-40`, `[opacity:0.5]`, `text-opacity-50`),
// or a colour token given an alpha (`text-[var(--cyan)]/70`).
const FADE_TOKEN =
  /^(?:\S*:)?!?(?:opacity-|text-opacity-|placeholder-opacity-|\[opacity:)|^(?:\S*:)?(?:text|placeholder)-\[(?:var\(|color:)[^\]]*\]\/\S+$/;

// A CSS or style-object opacity; `[opacity:...]` is a class token, read above.
const OPACITY_DECLARATION = /(?<!\[)\bopacity\s*:\s*[^,;}\]\s]+/g;

/** Every fade a file writes: class tokens, style-object keys and CSS declarations. */
function fadesIn(file: string, text: string): string[] {
  const code = stripComments(text);
  if (file.endsWith(".css")) {
    const rules = code.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, " ");
    return [...rules.matchAll(OPACITY_DECLARATION)].map((m) => m[0].trim());
  }
  const found: string[] = [];
  for (const m of code.matchAll(STRING)) {
    const body = m[0].slice(1, -1);
    for (const token of body.split(/[\s"'`${}]+/)) if (FADE_TOKEN.test(token)) found.push(token);
    // CSS written inside a string, such as a component's own <style> block.
    for (const hit of body.matchAll(OPACITY_DECLARATION)) found.push(hit[0].trim());
  }
  // A style object's key: `style={{ opacity: 0.5 }}`.
  for (const hit of code.replace(STRING, '""').matchAll(OPACITY_DECLARATION)) found.push(hit[0].trim());
  return found;
}

describe("no text is dimmed with opacity", () => {
  const files = [...walk("app"), ...walk("components"), ...walk("lib")];
  const fades = files.flatMap((file) =>
    fadesIn(file, readFileSync(path.join(ROOT, file), "utf8")).map((fade) => ({ file, fade })),
  );

  it("finds the files it is meant to scan", () => {
    expect(files).toContain("app/globals.css");
    expect(files).toContain("components/panels/ConsolePanel.tsx");
    expect(files).toContain("components/ui/Select.tsx");
    expect(files.some((f) => f.includes("/test/"))).toBe(false);
  });

  // No allowlist here: a disabled control is still read, so it takes the
  // disabled ink, which the theme tests hold to 3:1 (7:1 in high contrast).
  it("no disabled state fades", () => {
    expect(fades.filter(({ fade }) => /disabled/.test(fade)).map(({ file, fade }) => `${file}: ${fade}`)).toEqual([]);
  });

  it("nothing else fades outside the allowlist", () => {
    const hits = fades.filter(({ file, fade }) => !ALLOWED.some((a) => a.file === file && a.fade === fade));
    expect(hits.map(({ file, fade }) => `${file}: ${fade}`)).toEqual([]);
  });

  it("every allowlist entry is still needed and says why", () => {
    for (const entry of ALLOWED) {
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(fades).toContainEqual({ file: entry.file, fade: entry.fade });
    }
  });

  it("catches a fade in each form, and passes a transition or a keyframe", () => {
    expect(fadesIn("x.tsx", 'const c = "rounded disabled:opacity-50";')).toEqual(["disabled:opacity-50"]);
    expect(fadesIn("x.tsx", '<b className={`p-1 ${on ? "" : "opacity-50"}`} />')).toEqual(["opacity-50"]);
    expect(fadesIn("x.tsx", '<a className="text-[var(--cyan)] hover:opacity-80" />')).toEqual(["hover:opacity-80"]);
    expect(fadesIn("x.tsx", 'const c = "group-disabled:opacity-40 !opacity-30";')).toEqual([
      "group-disabled:opacity-40",
      "!opacity-30",
    ]);
    expect(fadesIn("x.tsx", 'const c = "disabled:[opacity:0.5] text-opacity-60";')).toEqual([
      "disabled:[opacity:0.5]",
      "text-opacity-60",
    ]);
    expect(fadesIn("x.tsx", 'const c = "text-[var(--amber)]/70 text-sm/6";')).toEqual(["text-[var(--amber)]/70"]);
    expect(fadesIn("x.tsx", "<i style={{ opacity: 0.5 }} />")).toEqual(["opacity: 0.5"]);
    expect(fadesIn("x.tsx", "const css = `.x { opacity: .6; }`;")).toEqual(["opacity: .6"]);
    expect(fadesIn("x.css", ".x { color: red; opacity: 0.5; }")).toEqual(["opacity: 0.5"]);
    expect(fadesIn("x.css", "@keyframes f { from { opacity: 0; } to { opacity: 1; } }")).toEqual([]);
    expect(fadesIn("x.tsx", 'const c = "transition-opacity duration-150";')).toEqual([]);
    expect(fadesIn("x.tsx", "// a comment may say opacity-50")).toEqual([]);
  });
});
