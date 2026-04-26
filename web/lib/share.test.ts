import { describe, expect, it } from "vitest";
import LZString from "lz-string";
import {
  buildShareHash,
  buildShareUrl,
  readShareHash,
  type ShareState,
} from "./share";

describe("share hash p2", () => {
  it("round-trips a state with all fields", () => {
    const state: ShareState = {
      source: "MOV X0, #42\nSVC #0\n",
      args: "hello world",
      stdin: "42\n",
      view: "playground",
      cursor: { line: 2, column: 5 },
    };
    const hash = buildShareHash(state);
    expect(hash.startsWith("#p2=")).toBe(true);
    expect(readShareHash(hash)).toEqual(state);
  });

  it("round-trips a state with only source", () => {
    const state: ShareState = { source: "NOP\n" };
    expect(readShareHash(buildShareHash(state))).toEqual(state);
  });

  it("decodes a legacy p= hash as source-only state", () => {
    const source = "MOV X0, #1\n";
    const legacy = `#p=${LZString.compressToEncodedURIComponent(source)}`;
    expect(readShareHash(legacy)).toEqual({ source });
  });

  it("returns null for a hash without a known prefix", () => {
    expect(readShareHash("#nope")).toBeNull();
    expect(readShareHash("")).toBeNull();
    expect(readShareHash("#")).toBeNull();
  });

  it("returns null on malformed p2 payloads", () => {
    expect(readShareHash("#p2=notrealgibberish!!!")).toBeNull();
  });

  it("returns null on malformed p= payloads", () => {
    expect(readShareHash("#p=notrealgibberish!!!")).toBeNull();
  });

  it("tolerates a leading # being absent", () => {
    const state: ShareState = { source: "NOP\n" };
    const hash = buildShareHash(state).slice(1);
    expect(readShareHash(hash)).toEqual(state);
  });
});

describe("buildShareUrl", () => {
  it("composes the URL with hash and optional deep-link query", () => {
    const url = buildShareUrl({ source: "NOP\n" }, { theme: "dark" });
    expect(url).toContain("?theme=dark");
    expect(url).toContain("#p2=");
  });
});
