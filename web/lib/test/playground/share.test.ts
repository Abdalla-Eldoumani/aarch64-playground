import { afterEach, describe, expect, it, vi } from "vitest";
import LZString from "lz-string";
import {
  buildShareHash,
  buildShareUrl,
  readShareHash,
  type ShareState,
} from "@/lib/playground/share";
import { MAX_SHARE_DECOMPRESSED_BYTES, MAX_SHARE_HASH_BYTES } from "@/lib/playground/upload-guard";

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

// Version and payload-shape edge cases: a decodable fragment is trusted only
// when its prefix, its JSON shape, and its source field all check out; every
// other decode falls back to null so the playground boots clean.

describe("share hash version and shape guards", () => {
  it("rejects an unknown version prefix even when the payload itself is valid", () => {
    const valid = LZString.compressToEncodedURIComponent(JSON.stringify({ source: "ret" }));
    expect(readShareHash(`#p3=${valid}`)).toBeNull();
    expect(readShareHash(`#P2=${valid}`)).toBeNull();
  });

  it("rejects a p2 payload that decompresses to non-JSON text", () => {
    const notJson = LZString.compressToEncodedURIComponent("mov x0, 1");
    expect(readShareHash(`#p2=${notJson}`)).toBeNull();
  });

  it("rejects p2 JSON that is not an object with a string source", () => {
    for (const payload of [42, "just a string", null, ["ret"], { args: "no source" }]) {
      const hash = `#p2=${LZString.compressToEncodedURIComponent(JSON.stringify(payload))}`;
      expect(readShareHash(hash)).toBeNull();
    }
  });

  it("strips a non-string stdin instead of trusting it", () => {
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", stdin: 42 }),
    );
    const decoded = readShareHash(`#p2=${payload}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.stdin).toBeUndefined();
  });

  it("keeps a well-formed cursor and drops its unknown extra keys", () => {
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", cursor: { line: 3, column: 7, injected: true } }),
    );
    const decoded = readShareHash(`#p2=${payload}`);
    expect(decoded!.cursor).toEqual({ line: 3, column: 7 });
  });

  it("treats a legacy p= payload of the empty string as null", () => {
    const empty = LZString.compressToEncodedURIComponent("");
    expect(readShareHash(`#p=${empty}`)).toBeNull();
  });

  it("round-trips multibyte source through the URI-safe alphabet", () => {
    const state: ShareState = { source: "// résumé Δ=1\nret\n" };
    const hash = buildShareHash(state);
    expect(hash).toMatch(/^#p2=[A-Za-z0-9+\-$]*$/);
    expect(readShareHash(hash)).toEqual(state);
  });
});
