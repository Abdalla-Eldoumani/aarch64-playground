import { describe, expect, it } from "vitest";
import { matchesAllWords } from "@/lib/content/search-words";

describe("matchesAllWords", () => {
  it("finds two words typed in a different order from the text", () => {
    expect(matchesAllWords("armv8 quiz", "Basic quiz: ARMv8 assembly")).toBe(true);
    expect(matchesAllWords("loop pre", "Pre-test loops")).toBe(true);
  });

  it("needs every word, not just one of them", () => {
    expect(matchesAllWords("armv8 stack", "Basic quiz: ARMv8 assembly")).toBe(false);
  });

  it("matches a word by its start, so a partly typed word still finds it", () => {
    expect(matchesAllWords("load", "Load from memory. Picks 32-vs-64 bit based on Wt/Xt.")).toBe(true);
    expect(matchesAllWords("subrout", "Subroutines and the stack")).toBe(true);
  });

  it("does not match the inside of a longer word", () => {
    expect(matchesAllWords("or", "the word for memory")).toBe(false);
    expect(matchesAllWords("dd", "add two registers")).toBe(false);
  });

  it("treats punctuation as a word break in the text and in the query", () => {
    expect(matchesAllWords("cond", "b.cond")).toBe(true);
    expect(matchesAllWords("test", "post-test loop")).toBe(true);
    expect(matchesAllWords("b.cond", "b.cond")).toBe(true);
    expect(matchesAllWords("b.cond", "add two registers")).toBe(false);
    expect(matchesAllWords("[fp", "a watch on [fp, 16]")).toBe(true);
  });

  it("ignores case and extra spaces, and a blank query matches everything", () => {
    expect(matchesAllWords("  QUIZ   basic ", "Basic quiz")).toBe(true);
    expect(matchesAllWords("", "anything")).toBe(true);
    expect(matchesAllWords("   ", "")).toBe(true);
    expect(matchesAllWords("x", "")).toBe(false);
    // Punctuation alone names no word, so it narrows nothing.
    expect(matchesAllWords("@@ ##", "anything")).toBe(true);
  });

  it("finds a later occurrence that starts a word when an earlier one does not", () => {
    expect(matchesAllWords("add", "ladder of add instructions")).toBe(true);
  });
});
