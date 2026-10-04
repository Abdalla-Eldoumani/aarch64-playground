import { describe, expect, it } from "vitest";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { courseMnemonics, coursePrograms, mnemonicsIn } from "@/lib/content/course-instructions";

const KNOWN = REFERENCE_INSTRUCTIONS.map((i) => i.mnemonic);

describe("mnemonicsIn", () => {
  it("reads the first word of each statement past its labels", () => {
    const words = mnemonicsIn(
      [
        "define(count_r, w19)",
        "        .text",
        'fmt:    .string "add; b.eq // not code"',
        "main:   stp     x29, x30, [sp, -16]!",
        "loop:   cmp     count_r, 10   // ldrb in a comment",
        "        b.lt    loop",
        "        /* sdiv in a block comment */",
        "        mov w0, 0; ret",
      ].join("\n"),
    );
    expect([...words].filter((w) => KNOWN.includes(w)).sort()).toEqual(
      ["b.cond", "cmp", "mov", "ret", "stp"],
    );
  });
});

describe("the course's instructions", () => {
  const course = courseMnemonics(KNOWN);

  it("comes from the programs the site carries", () => {
    expect(coursePrograms().length).toBeGreaterThan(100);
  });

  it("holds instructions the lessons teach", () => {
    for (const mnemonic of ["mov", "add", "mul", "sdiv", "msub", "ldr", "str", "stp", "ldp", "cmp", "b.cond", "bl", "ret", "fmul"]) {
      expect(course).toContain(mnemonic);
    }
  });

  it("leaves out an instruction no course program uses", () => {
    expect(course).not.toContain("sqrdmulh");
    expect(course).not.toContain("pmull");
  });

  it("keeps the reference's order and only its rows", () => {
    expect(course).toEqual(KNOWN.filter((m) => course.includes(m)));
    expect(course.length).toBeLessThan(KNOWN.length);
  });
});
