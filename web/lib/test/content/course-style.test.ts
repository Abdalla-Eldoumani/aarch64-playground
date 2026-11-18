import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { escapeRegExp } from "@/lib/asm/escape-regexp";

// Directives course files never write, each noted with the spelling the course
// uses instead (docs/cpsc355-style-guide.md). The emulator still accepts some
// so pasted gcc output assembles; this check covers only what the site ships.
const BANNED_DIRECTIVES = new Map([
  [".type", "nothing: GCC function metadata; declare main with .global alone"],
  [".size", "nothing: GCC function metadata, never written by hand"],
  [".globl", ".global"],
  [".section", "a bare .data, .text or .bss"],
  [".quad", ".dword for an 8-byte value"],
  [".xword", ".dword for an 8-byte value"],
  [".space", ".skip"],
  [".p2align", ".balign (a byte count) or .align (a power of two)"],
  [".equ", "m4 define() or name = expression"],
  [".set", "m4 define() or name = expression"],
]);

/** Any of the names, read as literal text, ending at a word boundary. */
function literalAlternation(names: readonly string[]): RegExp {
  return new RegExp(`(${names.map(escapeRegExp).join("|")})\\b`);
}

const bannedRe = literalAlternation([...BANNED_DIRECTIVES.keys()]);

function assertClean(file: string, raw: string): void {
  const hit = bannedRe.exec(raw);
  expect(
    hit,
    `${file} carries \`${hit?.[1] ?? ""}\`, which course files never write; write ${BANNED_DIRECTIVES.get(hit?.[1] ?? "")} instead`,
  ).toBeNull();
}

/** Every file under dir (recursively) whose name ends with ext. */
function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

const rel = (file: string): string => path.relative(process.cwd(), file);

// Every lesson and exercise file, read once as the suite loads: with every
// test worker busy, one pass over them took seconds inside a test.
const CONTENT = ["content/lessons", "content/exercises"]
  .flatMap((dir) => walk(path.join(process.cwd(), dir), ".json"))
  .map((file) => ({ file: rel(file), raw: fs.readFileSync(file, "utf8") }));

describe("authored programs stay inside the course directive vocabulary", () => {
  it("reads each banned name as literal text, not regex syntax", () => {
    const re = literalAlternation([".a+b", ".c\\d"]);
    expect(re.test("x .a+b y")).toBe(true);
    expect(re.test("x .aab y")).toBe(false);
    expect(re.test("x .c\\d y")).toBe(true);
    expect(re.test("x .c7 y")).toBe(false);
  });

  it("lessons and exercises carry no banned directive", () => {
    expect(CONTENT.length).toBeGreaterThanOrEqual(4);
    for (const { file, raw } of CONTENT) assertClean(file, raw);
  });

  it("public example programs carry no banned directive", () => {
    const files = walk(path.join(process.cwd(), "public/examples"), ".s");
    expect(files.length).toBeGreaterThanOrEqual(14);
    for (const file of files) {
      assertClean(rel(file), fs.readFileSync(file, "utf8"));
    }
  });

  it("exercise reference solutions carry no banned directive", () => {
    // They ship: course-instructions.ts reads them at build.
    const files = walk(path.join(process.cwd(), "lib/test/content/exercise-solutions"), ".s");
    expect(files.length).toBeGreaterThanOrEqual(60);
    for (const file of files) {
      assertClean(rel(file), fs.readFileSync(file, "utf8"));
    }
  });

  it("reference try-in-playground payloads carry no banned directive", () => {
    // The module is authored data end to end (seeds, examples, gotcha prose,
    // runnable programs), so scanning the raw source covers every payload.
    const file = path.join(process.cwd(), "lib", "content", "reference-data.ts");
    assertClean("lib/content/reference-data.ts", fs.readFileSync(file, "utf8"));
  });

  it("pitfall demo programs carry no banned directive", () => {
    // Same shape as reference-data: pure authored payload (card snippets plus
    // the runnable broken and fixed programs), so the raw scan covers all of it.
    const files = walk(path.join(process.cwd(), "lib", "content", "pitfalls"), ".ts");
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const file of files) assertClean(rel(file), fs.readFileSync(file, "utf8"));
  });

  it("calling-convention examples carry no banned directive", () => {
    const file = path.join(process.cwd(), "lib", "content", "calling-convention-examples.ts");
    assertClean("lib/content/calling-convention-examples.ts", fs.readFileSync(file, "utf8"));
  });

  it("authoring guide payloads carry no banned directive", () => {
    const guide = path.join(process.cwd(), "..", "docs", "authoring-content.md");
    assertClean("docs/authoring-content.md", fs.readFileSync(guide, "utf8"));
  });
});

// One check for both content folders: lessons and exercises are authored
// alike, and each used to carry its own copy of this pattern.
describe("authored content stays anonymous and undated", () => {
  it("lessons and exercises carry no week labels, archive numbers, or personal data", () => {
    const banned = /week\s*\d|tutorial\s*\d|assignment\s*\d|@[a-z0-9.-]+\.[a-z]{2,}/i;
    for (const { file, raw } of CONTENT) {
      expect(banned.test(raw), `${file} matched a banned pattern`).toBe(false);
    }
  });
});
