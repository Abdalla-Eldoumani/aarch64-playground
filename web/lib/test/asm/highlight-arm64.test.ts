// Pins the shared read-only highlighter: the scanner's token kinds, the
// round-trip that guards the regex against a one-character transcription slip,
// and the class map's dependence on the per-theme --syntax-* tokens.

import { describe, expect, it } from "vitest";
import {
  ARM64_MNEMONICS,
  KIND_CLASS,
  MNEMONIC_ALTERNATION,
  REGISTER_PATTERN,
  tokenizeLine,
  type TokenKind,
} from "@/lib/asm/highlight-arm64";
import { ARM64_MNEMONIC_NAMES } from "@/lib/asm/mnemonics";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { HERO_PROGRAM } from "@/lib/content/landing-content";

const kinds = (line: string): TokenKind[] => tokenizeLine(line).map((t) => t.kind);
const textOf = (line: string, kind: TokenKind): string[] =>
  tokenizeLine(line).filter((t) => t.kind === kind).map((t) => t.text);

describe("tokenizeLine", () => {
  it("classifies a mnemonic, its registers, and a # immediate", () => {
    expect(kinds("        add     x0, x1, #4")).toEqual([
      "text",
      "keyword",
      "text",
      "register",
      "text",
      "text",
      "register",
      "text",
      "text",
      "number",
    ]);
  });

  it("takes a // comment to end of line, ahead of any word inside it", () => {
    const comments = textOf("        mov x0, 1 // add x1", "comment");
    expect(comments).toEqual(["// add x1"]);
    expect(kinds("        mov x0, 1 // add x1")).not.toContain("label");
  });

  it("marks a trailing-colon word as a label and a leading-dot word as a keyword", () => {
    expect(kinds("main:   .global main")).toEqual([
      "label",
      "text",
      "keyword",
      "text",
      "text",
    ]);
  });

  it("colors a conditional branch and a bare register alias", () => {
    expect(kinds("        b.lt sp")).toEqual(["text", "keyword", "text", "register"]);
  });

  it("colors every view of the SIMD&FP file, arrangement and lane included", () => {
    for (const reg of ["b3", "h3", "s3", "d3", "q3", "v0", "v31"]) {
      expect(textOf(`        fmov ${reg}`, "register"), reg).toEqual([reg]);
    }
    expect(textOf("        add v3.16b, v7.8h, v21.2d", "register")).toEqual([
      "v3.16b",
      "v7.8h",
      "v21.2d",
    ]);
    // A lane form is one token, index and all.
    expect(textOf("        ins v3.b[15], w7", "register")).toEqual([
      "v3.b[15]",
      "w7",
    ]);
    // A memory operand's bracket still stands on its own.
    expect(textOf("        ldr q0, [x7]", "register")).toEqual(["q0", "x7"]);
    // v32 is not a register, so the name stays plain text.
    expect(textOf("        add v32.16b, v1.16b, v2.16b", "register")).toEqual([
      "v1.16b",
      "v2.16b",
    ]);
  });

  it("colors every mnemonic the reference documents, vector ones included", () => {
    const plain = REFERENCE_INSTRUCTIONS.map((i) => i.mnemonic).filter(
      (m) => m !== "b.cond",
    );
    const missed = plain.filter(
      (m) => !kinds(`        ${m} x0`).includes("keyword"),
    );
    expect(missed, "documented mnemonics the highlighter leaves plain").toEqual(
      [],
    );
    // The three that motivated deriving the set instead of curating one.
    for (const m of ["movi", "addv", "sqadd"]) {
      expect(textOf(`        ${m} v1.4s`, "keyword"), m).toEqual([m]);
    }
  });

  it("takes a quoted string whole", () => {
    expect(textOf('msg:    .string "hello\\n"', "string")).toEqual(['"hello\\n"']);
  });

  it("round-trips every line: the token texts concatenate back to the input", () => {
    for (const line of HERO_PROGRAM.split("\n")) {
      expect(tokenizeLine(line).map((t) => t.text).join("")).toBe(line);
    }
  });
});

// The Monaco grammar in components/playground/Editor.tsx wraps
// MNEMONIC_ALTERNATION in `\b(...)\b` with the case-insensitive flag. It cannot
// be tested through Monaco in jsdom, so the pattern itself is pinned here: what
// the grammar colours is exactly what this alternation matches.
describe("MNEMONIC_ALTERNATION (the editor's keyword rule)", () => {
  const keyword = new RegExp(`\\b(${MNEMONIC_ALTERNATION})\\b`, "i");

  it("carries the shared name list and nothing else", () => {
    // mnemonics.test.ts pins that list to the hover-card table; this pins the
    // highlighter to the list, so the chain runs card -> name -> colour.
    expect([...ARM64_MNEMONICS].sort()).toEqual(
      [...ARM64_MNEMONIC_NAMES].sort(),
    );
  });

  it("matches every documented mnemonic, vector ones included", () => {
    const missed = REFERENCE_INSTRUCTIONS.map((i) => i.mnemonic)
      .filter((m) => m !== "b.cond")
      .filter((m) => !keyword.test(`        ${m} v1.4s, v2.4s`));
    expect(missed, "mnemonics the editor's keyword rule would miss").toEqual([]);
    for (const m of ["stp", "movi", "addv", "sqadd", "ld4r"]) {
      expect(keyword.test(`        ${m} v1.4s`), m).toBe(true);
    }
  });

  it("drops the B.COND placeholder and escapes any regex metacharacter", () => {
    // The table's conditional-branch entry is a placeholder, not a spelling:
    // the editor adds the concrete `b.eq` forms from its own COND_BRANCHES.
    expect(ARM64_MNEMONICS.has("b.cond")).toBe(false);
    // Nothing in the alternation may reach the regex engine unescaped, or a
    // future dotted entry would match any character in the dot's place.
    expect(MNEMONIC_ALTERNATION).not.toMatch(/(^|[^\\])[.*+?^${}()[\]]/);
    expect(keyword.test("        frobnicate x0")).toBe(false);
  });

  it("leaves a register name alone", () => {
    for (const reg of ["v1.4s", "q0", "x19"]) {
      expect(new RegExp(`^(${MNEMONIC_ALTERNATION})$`, "i").test(reg), reg).toBe(
        false,
      );
    }
  });
});

// The Monaco register rule is `new RegExp(REGISTER_PATTERN, "i")`, matched at
// the cursor the way Monarch matches. Monarch takes whatever prefix fits, so
// the cases that matter are the near-misses: a name one digit too far, a lane
// suffix that is not an arrangement, an identifier that opens with one.
describe("REGISTER_PATTERN (the editor's register rule)", () => {
  const at = (text: string) => new RegExp(REGISTER_PATTERN, "i").exec(text);

  it("takes a real register name whole", () => {
    for (const [text, expected] of [
      ["v3.16b, v7.8h", "v3.16b"],
      ["v3.b[15], w7", "v3.b[15]"],
      ["q0, [x7]", "q0"],
      ["sp, -16", "sp"],
      ["x30, x29", "x30"],
      ["v31.2d", "v31.2d"],
      ["d15", "d15"],
    ] as const) {
      expect(at(text)?.[0], text).toBe(expected);
    }
  });

  it("colours no prefix of a name the register file does not have", () => {
    // Every one of these used to come back as a two-character prefix.
    for (const text of [
      "v32",
      "x31",
      "w31",
      "b32",
      "q32",
      "d32",
      "v1label",
      "v3.3s",
    ]) {
      expect(at(text)?.[0] ?? null, text).toBeNull();
    }
  });

  it("agrees with the highlighter on whole words", () => {
    const whole = (w: string) =>
      new RegExp(`^${REGISTER_PATTERN}$`, "i").test(w);
    for (const w of ["x0", "sp", "b3", "v0.4s", "v0.d[1]"]) {
      expect(whole(w), w).toBe(true);
      expect(tokenizeLine(`        mov ${w}`).at(-1)?.kind, w).toBe("register");
    }
    for (const w of ["x31", "v32", "v3.3s"]) {
      expect(whole(w), w).toBe(false);
      expect(tokenizeLine(`        mov ${w}`).at(-1)?.kind, w).not.toBe(
        "register",
      );
    }
  });
});

describe("KIND_CLASS", () => {
  it("names a --syntax-* custom property for every kind but plain text", () => {
    for (const kind of Object.keys(KIND_CLASS) as TokenKind[]) {
      if (kind === "text") {
        expect(KIND_CLASS[kind]).toBe("");
        continue;
      }
      expect(KIND_CLASS[kind]).toMatch(/var\(--syntax-/);
    }
  });
});
