import { describe, expect, test } from "vitest";
import { parseArgs } from "@/lib/playground/args";

describe("parseArgs", () => {
  test("empty input yields empty array", () => {
    expect(parseArgs("")).toEqual([]);
  });

  test("whitespace-only input yields empty array", () => {
    expect(parseArgs("   \t  ")).toEqual([]);
  });

  test("simple words separated by space", () => {
    expect(parseArgs("hello world")).toEqual(["hello", "world"]);
  });

  test("double-quoted span preserves whitespace", () => {
    expect(parseArgs('"has spaces"')).toEqual(["has spaces"]);
  });

  test("mix of quoted and bare", () => {
    expect(parseArgs('a "b c" d')).toEqual(["a", "b c", "d"]);
  });

  test("single-quoted span preserves whitespace", () => {
    expect(parseArgs("'two words'")).toEqual(["two words"]);
  });

  test("backslash escapes the next character", () => {
    expect(parseArgs("a\\ b")).toEqual(["a b"]);
  });

  test("multiple spaces collapse", () => {
    expect(parseArgs("a   b   c")).toEqual(["a", "b", "c"]);
  });

  test("empty quoted string still produces a token", () => {
    expect(parseArgs('a "" b')).toEqual(["a", "", "b"]);
  });

  test("unterminated quote keeps the rest as the final token", () => {
    expect(parseArgs('a "b c')).toEqual(["a", "b c"]);
  });

  test("tabs separate like spaces", () => {
    expect(parseArgs("a\tb")).toEqual(["a", "b"]);
  });
});
