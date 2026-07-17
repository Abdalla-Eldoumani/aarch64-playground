import { afterEach, describe, expect, it, vi } from "vitest";
import LZString from "lz-string";
import {
  buildShareHash,
  buildShareUrl,
  readShareHash,
  type ShareState,
} from "@/lib/playground/share";
import { MAX_SHARE_DECOMPRESSED_BYTES, MAX_SHARE_HASH_BYTES } from "@/lib/playground/upload-guard";

// readShareHash returns a discriminated verdict: "none" (not our hash),
// "ok", "corrupt" (our prefix, broken payload), "too-large". Collapsing
// the failures into null used to make a truncated link silently boot the
// autosave with no signal.
function okState(hash: string): ShareState {
  const r = readShareHash(hash);
  if (r.kind !== "ok") throw new Error(`expected ok, got ${r.kind}`);
  return r.state;
}

function kindOf(hash: string): string {
  return readShareHash(hash).kind;
}

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
    expect(okState(hash)).toEqual(state);
  });

  it("round-trips a state with only source", () => {
    const state: ShareState = { source: "NOP\n" };
    expect(okState(buildShareHash(state))).toEqual(state);
  });

  it("decodes a legacy p= hash as source-only state", () => {
    const source = "MOV X0, #1\n";
    const legacy = `#p=${LZString.compressToEncodedURIComponent(source)}`;
    expect(okState(legacy)).toEqual({ source });
  });

  it("reports a hash without a known prefix as not ours", () => {
    expect(kindOf("#nope")).toBe("none");
    expect(kindOf("")).toBe("none");
    expect(kindOf("#")).toBe("none");
  });

  it("reports corrupt when lz-string throws instead of failing closed", () => {
    // "z" decodes to the 2-bit header case lz-string's switch does not
    // handle, so the decoder throws mid-stream (it does NOT return null).
    // This runs during render on boot: an uncontained throw is a blank
    // page with no recovery.
    expect(kindOf("#p2=z")).toBe("corrupt");
    expect(kindOf("#p=z")).toBe("corrupt");
  });

  it("reports corrupt on malformed payloads under either prefix", () => {
    expect(kindOf("#p2=notrealgibberish!!!")).toBe("corrupt");
    expect(kindOf("#p=notrealgibberish!!!")).toBe("corrupt");
  });

  it("tolerates a leading # being absent", () => {
    const state: ShareState = { source: "NOP\n" };
    const hash = buildShareHash(state).slice(1);
    expect(okState(hash)).toEqual(state);
  });

  it("strips a non-string args field instead of trusting it", () => {
    const evil = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", args: { malicious: true } }),
    );
    const decoded = okState(`#p2=${evil}`);
    expect(decoded.source).toBe("ret");
    expect(decoded.args).toBeUndefined();
  });

  it("strips a malformed cursor", () => {
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", cursor: { line: "bad", column: 1 } }),
    );
    expect(okState(`#p2=${payload}`).cursor).toBeUndefined();
  });

  it("reports too-large for an oversized p2 payload", () => {
    const huge = "x".repeat(MAX_SHARE_DECOMPRESSED_BYTES + 1);
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: huge }),
    );
    expect(kindOf(`#p2=${payload}`)).toBe("too-large");
  });

  it("reports too-large for an oversized p1 payload", () => {
    const huge = "x".repeat(MAX_SHARE_DECOMPRESSED_BYTES + 1);
    const payload = LZString.compressToEncodedURIComponent(huge);
    expect(kindOf(`#p=${payload}`)).toBe("too-large");
  });
});

describe("readShareHash decompression-bomb guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a raw fragment over the cap without decompressing it", () => {
    const spy = vi.spyOn(LZString, "decompressFromEncodedURIComponent");
    const oversized = "a".repeat(MAX_SHARE_HASH_BYTES + 1);
    expect(kindOf(`#p2=${oversized}`)).toBe("too-large");
    expect(kindOf(`#p=${oversized}`)).toBe("too-large");
    // The wall short-circuits before lz-string runs.
    expect(spy).not.toHaveBeenCalled();
  });

  it("stops an UNDER-cap bomb at the output ceiling", () => {
    // lz-string output grows quadratically in fragment length: this
    // fragment is a few KB (inside the raw cap) but inflates past the
    // 1 MB output ceiling. The old 64 KB raw cap admitted fragments that
    // inflated to ~200 MB -- the exact attack the guard's comment
    // claimed to stop.
    const bomb = LZString.compressToEncodedURIComponent("a".repeat(2_000_000));
    expect(bomb.length).toBeLessThan(MAX_SHARE_HASH_BYTES);
    expect(kindOf(`#p2=${bomb}`)).toBe("too-large");
  });

  it("still decompresses a small valid hash", () => {
    const spy = vi.spyOn(LZString, "decompressFromEncodedURIComponent");
    const state: ShareState = { source: "nop\n" };
    expect(okState(buildShareHash(state))).toEqual(state);
    expect(spy).toHaveBeenCalled();
  });
});

describe("share integrity checksum", () => {
  it("reports corrupt when a decodable payload's source fails the checksum", () => {
    // A one-character mangle can decode to a VALID payload whose source
    // differs from what the sender shared (17 of 68 substitutions did in
    // the audit); the checksum catches what JSON validation cannot.
    const real = buildShareHash({ source: "mov x0, 1\nret\n" });
    const tampered = `#p2=${LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "mov x2, 1\nret\n", h: "deadbeef" }),
    )}`;
    expect(kindOf(real)).toBe("ok");
    expect(kindOf(tampered)).toBe("corrupt");
  });

  it("accepts an old v2 link that carries no checksum", () => {
    const legacy = `#p2=${LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret\n" }),
    )}`;
    expect(okState(legacy)).toEqual({ source: "ret\n" });
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
// when its prefix, its JSON shape, and its source field all check out.

describe("share hash version and shape guards", () => {
  it("treats an unknown version prefix as not ours even when the payload is valid", () => {
    const valid = LZString.compressToEncodedURIComponent(JSON.stringify({ source: "ret" }));
    expect(kindOf(`#p3=${valid}`)).toBe("none");
    expect(kindOf(`#P2=${valid}`)).toBe("none");
  });

  it("reports corrupt for a p2 payload that decompresses to non-JSON text", () => {
    const notJson = LZString.compressToEncodedURIComponent("mov x0, 1");
    expect(kindOf(`#p2=${notJson}`)).toBe("corrupt");
  });

  it("reports corrupt for p2 JSON that is not an object with a string source", () => {
    for (const payload of [42, "just a string", null, ["ret"], { args: "no source" }]) {
      const hash = `#p2=${LZString.compressToEncodedURIComponent(JSON.stringify(payload))}`;
      expect(kindOf(hash)).toBe("corrupt");
    }
  });

  it("strips a non-string stdin instead of trusting it", () => {
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", stdin: 42 }),
    );
    expect(okState(`#p2=${payload}`).stdin).toBeUndefined();
  });

  it("keeps a well-formed cursor and drops its unknown extra keys", () => {
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ source: "ret", cursor: { line: 3, column: 7, injected: true } }),
    );
    expect(okState(`#p2=${payload}`).cursor).toEqual({ line: 3, column: 7 });
  });

  it("treats a legacy p= payload of the empty string as corrupt", () => {
    const empty = LZString.compressToEncodedURIComponent("");
    expect(kindOf(`#p=${empty}`)).toBe("corrupt");
  });

  it("round-trips multibyte source through the URI-safe alphabet", () => {
    const state: ShareState = { source: "// résumé Δ=1\nret\n" };
    const hash = buildShareHash(state);
    expect(hash).toMatch(/^#p2=[A-Za-z0-9+\-$]*$/);
    expect(okState(hash)).toEqual(state);
  });
});
