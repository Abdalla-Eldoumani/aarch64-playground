import { describe, expect, it } from "vitest";
import { escapeRegExp } from "@/lib/asm/escape-regexp";

describe("escapeRegExp", () => {
  it("makes every metacharacter match itself", () => {
    const text = "a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o";
    const re = new RegExp(`^${escapeRegExp(text)}$`);
    expect(re.test(text)).toBe(true);
  });

  it("keeps a dotted mnemonic from matching a look-alike", () => {
    const re = new RegExp(`^${escapeRegExp("b.lt")}$`);
    expect(re.test("b.lt")).toBe(true);
    expect(re.test("bxlt")).toBe(false);
  });

  it("leaves plain text as it is", () => {
    expect(escapeRegExp("add x0, x1, 2")).toBe("add x0, x1, 2");
  });
});
