// Pins the shared read-only highlighter: the scanner's token kinds, the
// round-trip that guards the regex against a one-character transcription slip,
// and the class map's dependence on the per-theme --syntax-* tokens.

import { describe, expect, it } from "vitest";
import { KIND_CLASS, tokenizeLine, type TokenKind } from "@/lib/asm/highlight-arm64";
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

  it("takes a quoted string whole", () => {
    expect(textOf('msg:    .string "hello\\n"', "string")).toEqual(['"hello\\n"']);
  });

  it("round-trips every line: the token texts concatenate back to the input", () => {
    for (const line of HERO_PROGRAM.split("\n")) {
      expect(tokenizeLine(line).map((t) => t.text).join("")).toBe(line);
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
