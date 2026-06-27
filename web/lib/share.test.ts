import { afterEach, describe, expect, it, vi } from "vitest";
import LZString from "lz-string";
import {
  buildShareHash,
  buildShareUrl,
  readShareHash,
  type ShareState,
} from "./share";
import { MAX_SHARE_DECOMPRESSED_BYTES, MAX_SHARE_HASH_BYTES } from "./upload-guard";

describe("share hash p2", () => {
  it("round-trips a state with all fields", () => {
    const state: ShareState = {
      source: "MOV X0, #42\nSVC #0\n",
      args: "hello world",
      stdin: "42\n",
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

  it("strips a non-string args field instead of trusting it", () => {
    const evil = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", args: { malicious: true } }),
    );
    const decoded = readShareHash(`#p2=${evil}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.source).toBe("ret");
    expect(decoded!.args).toBeUndefined();
  });

  it("strips a malformed cursor", () => {
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", cursor: { line: "bad", column: 1 } }),
    );
    const decoded = readShareHash(`#p2=${payload}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.cursor).toBeUndefined();
  });

  it("rejects an oversized p2 payload", () => {
    const huge = "x".repeat(MAX_SHARE_DECOMPRESSED_BYTES + 1);
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: huge }),
    );
    expect(readShareHash(`#p2=${payload}`)).toBeNull();
  });

  it("rejects an oversized p1 payload", () => {
    const huge = "x".repeat(MAX_SHARE_DECOMPRESSED_BYTES + 1);
    const payload = LZString.compressToEncodedURIComponent(huge);
    expect(readShareHash(`#p=${payload}`)).toBeNull();
  });
});

describe("readShareHash decompression-bomb guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a raw fragment over the cap without decompressing it", () => {
    const spy = vi.spyOn(LZString, "decompressFromEncodedURIComponent");
    const oversized = "a".repeat(MAX_SHARE_HASH_BYTES + 1);
    expect(readShareHash(`#p2=${oversized}`)).toBeNull();
    expect(readShareHash(`#p=${oversized}`)).toBeNull();
    // The guard short-circuits before lz-string runs, so a tiny compressed
    // fragment can never be expanded to exhaust the tab's memory.
    expect(spy).not.toHaveBeenCalled();
  });

  it("still decompresses a small valid hash", () => {
    const spy = vi.spyOn(LZString, "decompressFromEncodedURIComponent");
    const state: ShareState = { source: "nop\n" };
    expect(readShareHash(buildShareHash(state))).toEqual(state);
    expect(spy).toHaveBeenCalled();
  });
});

describe("buildShareUrl", () => {
  it("composes the URL with hash and optional deep-link query", () => {
    const url = buildShareUrl({ source: "NOP\n" }, { theme: "dark" });
    expect(url).toContain("?theme=dark");
    expect(url).toContain("#p2=");
  });
});
