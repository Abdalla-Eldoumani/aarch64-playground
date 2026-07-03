import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Course tutorial files never write these directives; each entry notes the
// spelling the course uses instead. Authored programs must read like course
// work, so a hit in any shipped payload is a style regression. The emulator
// still accepts several of them (`.type`, `.section`, `.quad`) so pasted GCC
// output keeps assembling; this guard covers what the site authors, not what
// the machine tolerates. docs/cpsc355-style-guide.md states the rule.
const BANNED_DIRECTIVES = [
  ".type", // GCC function metadata; course files declare main with .global alone
  ".size", // GCC function metadata; never written by hand in course files
  ".globl", // course spells it .global
  ".section", // course switches sections with bare .data / .text / .bss
  ".quad", // course writes .dword for 8-byte values
  ".xword", // same: .dword is the course's 8-byte spelling
  ".space", // course writes .skip
  ".p2align", // course writes .balign (byte count) or .align (power of two)
  ".equ", // course aliases with m4 define() or name = expression
  ".set", // same: assembler-level aliasing never appears in course files
];

const bannedRe = new RegExp(
  `(${BANNED_DIRECTIVES.map((d) => d.replace(/\./g, "\\.")).join("|")})\\b`,
);

function assertClean(file: string, raw: string): void {
  const hit = bannedRe.exec(raw);
  expect(
    hit,
    `${file} carries \`${hit?.[0] ?? ""}\`, a directive course files never write`,
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

describe("authored programs stay inside the course directive vocabulary", () => {
  it("lessons and exercises carry no banned directive", () => {
    const files = ["content/lessons", "content/exercises"].flatMap((dir) =>
      walk(path.join(process.cwd(), dir), ".json"),
    );
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) {
      assertClean(rel(file), fs.readFileSync(file, "utf8"));
    }
  });

  it("public example programs carry no banned directive", () => {
    const files = walk(path.join(process.cwd(), "public/examples"), ".s");
    expect(files.length).toBeGreaterThanOrEqual(14);
    for (const file of files) {
      assertClean(rel(file), fs.readFileSync(file, "utf8"));
    }
  });

  it("reference try-in-playground payloads carry no banned directive", () => {
    // The module is authored data end to end (seeds, examples, gotcha prose,
    // runnable programs), so scanning the raw source covers every payload.
    const file = path.join(process.cwd(), "lib", "reference-data.ts");
    assertClean("lib/reference-data.ts", fs.readFileSync(file, "utf8"));
  });

  it("authoring guide payloads carry no banned directive", () => {
    const guide = path.join(process.cwd(), "..", "docs", "authoring-content.md");
    assertClean("docs/authoring-content.md", fs.readFileSync(guide, "utf8"));
  });
});
