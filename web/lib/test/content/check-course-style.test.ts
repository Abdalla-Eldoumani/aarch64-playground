import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// scripts/check-course-style.js holds the site's programs to `.balign 4`
// before each exported function and `ldr xN, =label` for addresses. It is
// CommonJS one level above web/ (vitest's cwd), so it is loaded by path.
const SCRIPT = path.join(process.cwd(), "..", "scripts", "check-course-style.js");
const { breaks } = createRequire(import.meta.url)(SCRIPT) as {
  breaks: (text: string) => { line: number; rule: string }[];
};

const program = (...lines: string[]) => lines.join("\n");

describe("course layout rules", () => {
  it("passes a .global with .balign 4 on the code line before it", () => {
    expect(breaks(program(".text", "        .balign 4", "", "        .global main", "main:"))).toEqual([]);
  });

  it("flags a .global with no .balign 4 before it, by line", () => {
    expect(breaks(program(".text", "        .global main", "main:"))).toEqual([
      { line: 2, rule: "balign" },
    ]);
  });

  it("lets a .global name a data label without the alignment", () => {
    const text = program(".data", "        .global count", "count:  .word   5");
    expect(breaks(text)).toEqual([]);
  });

  it("flags an adrp that loads an address, also where a template literal opens", () => {
    expect(breaks(program("        adrp    x0, fmt   // page", "wrong: `adrp x1, msg"))).toEqual([
      { line: 1, rule: "adrp" },
      { line: 2, rule: "adrp" },
    ]);
  });

  it("ignores prose that names the directive or the instruction", () => {
    const prose = program(
      "| `.global main` | make the name visible |",
      "`adrp x9, label` puts the page address in x9.",
      "adrp reads the page, then add supplies the rest.",
    );
    expect(breaks(prose)).toEqual([]);
  });
});
