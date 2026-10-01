// Pins the editor's feature list to monaco's own register.all: the loader runs
// the features one task at a time, and only register.all's order keeps that
// the same as the single import it replaced. A monaco upgrade that adds,
// drops, or reorders a feature fails here instead of changing the editor, so a
// new feature is either listed or left out by name.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const FEATURES = join(here, "../../../node_modules/monaco-editor/esm/vs/features");
const SUBJECT = join(here, "../../playground/monaco-features.ts");

/** The files a monaco entry imports for their side effects, in order. */
function importsOf(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/^import '([^']+)';/gm)].map((m) =>
    normalize(join(dirname(file), m[1])),
  );
}

/** register.all's imports, each named by the feature entry that imports the
 *  same file (or that is the file, as find's is). */
function registerAllOrder(): string[] {
  const featureOf = new Map<string, string>();
  for (const name of readdirSync(FEATURES)) {
    const entry = join(FEATURES, name, "register.js");
    if (!existsSync(entry)) continue;
    featureOf.set(normalize(entry), name);
    for (const target of importsOf(entry)) featureOf.set(target, name);
  }
  return importsOf(join(FEATURES, "register.all.js")).map(
    (target) => featureOf.get(target) ?? `unmatched: ${target}`,
  );
}

// Features the editor leaves out on purpose, each with nothing in this app
// that draws it. The editor never imports register.all, so a feature dropped
// here is gone from the bundle, not just from the list.
const LEFT_OUT = ["inlineCompletions"];

describe("monaco feature list", () => {
  it("names every feature register.all imports but the ones left out, in register.all's order", () => {
    const listed = [
      ...readFileSync(SUBJECT, "utf8").matchAll(/"monaco-editor\/features\/([^/"]+)\/register"/g),
    ].map((m) => m[1]);
    const order = registerAllOrder();
    expect(order.length).toBeGreaterThan(60);
    // A left-out name monaco no longer has would hide a typo in this list.
    for (const name of LEFT_OUT) expect(order).toContain(name);
    expect(listed).toEqual(order.filter((name) => !LEFT_OUT.includes(name)));
  });
});
