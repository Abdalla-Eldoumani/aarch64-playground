import { describe, expect, it } from "vitest";
import { buildShareHash, readShareHash } from "./share";

describe("share hash", () => {
  it("round-trips a simple program", () => {
    const source = "MOV X0, #42\nSVC #0\n";
    const hash = buildShareHash(source);
    expect(hash.startsWith("#p=")).toBe(true);
    expect(readShareHash(hash)).toBe(source);
  });

  it("round-trips a multi-line program with unicode comments", () => {
    const source = `// greeting
MOV X0, #1
LDR X1, =msg
// end
`;
    expect(readShareHash(buildShareHash(source))).toBe(source);
  });

  it("returns null for a hash without the p= prefix", () => {
    expect(readShareHash("#nope")).toBeNull();
    expect(readShareHash("")).toBeNull();
    expect(readShareHash("#")).toBeNull();
  });

  it("returns null on malformed compressed payloads", () => {
    expect(readShareHash("#p=notrealgibberish!!!")).toBeNull();
  });

  it("tolerates a leading # being absent", () => {
    const source = "NOP\n";
    const hash = buildShareHash(source).slice(1);
    expect(readShareHash(hash)).toBe(source);
  });
});
