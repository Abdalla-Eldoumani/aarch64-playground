import { describe, expect, it } from "vitest";
import LZString from "lz-string";
import {
  bundleToMarkdown,
  decodeBundle,
  encodeBundle,
  type DiagnosticBundle,
} from "@/lib/playground/diagnostic-bundle";
import { MAX_BUNDLE_DECOMPRESSED_BYTES } from "@/lib/playground/upload-guard";

const sample: DiagnosticBundle = {
  source: ".text\nmain:\n    mov x0, 5\n    svc 0\n",
  args: "./prog hello world",
  stdin: "42\n",
  stdout: "answer = 5\n",
  stderr: "",
  exitCode: 0,
  registers: [
    "0x0000000000000005",
    "0x0000000000000000",
  ],
  sp: "0x0000000080000000",
  pc: "0x0000000000400008",
  stackBytes: "00 00 00 00 00 00 00 00",
  error: null,
};

describe("diagnostic-bundle markdown", () => {
  it("includes every populated section", () => {
    const md = bundleToMarkdown(sample);
    expect(md).toContain("# diagnostic bundle");
    expect(md).toContain("```asm");
    expect(md).toContain("mov x0, 5");
    expect(md).toContain("**args:** `./prog hello world`");
    expect(md).toContain("**stdin:**");
    expect(md).toContain("**stdout:**");
    expect(md).toContain("**exit code:** 0");
    expect(md).toContain("pc = 0x0000000000400008");
    expect(md).toContain("**last 64 stack bytes");
  });

  it("skips empty optional sections so reports stay short", () => {
    const minimal: DiagnosticBundle = { source: "ret\n" };
    const md = bundleToMarkdown(minimal);
    expect(md).not.toContain("**args:**");
    expect(md).not.toContain("**stdin:**");
    expect(md).not.toContain("**stdout:**");
    expect(md).not.toContain("**stderr:**");
    expect(md).not.toContain("exit code");
    expect(md).not.toContain("last error");
    expect(md).not.toContain("registers:");
  });

  it("appends a playground link when an origin is provided", () => {
    const md = bundleToMarkdown(sample, "https://example.com/path");
    expect(md).toMatch(/\(https:\/\/example\.com\/path\?bundle=[^)]+\)/);
  });
});

describe("diagnostic-bundle round-trip", () => {
  it("encodeBundle / decodeBundle restores the original payload", () => {
    const encoded = encodeBundle(sample);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    const decoded = decodeBundle(encoded);
    expect(decoded.kind).toBe("ok");
    if (decoded.kind !== "ok") throw new Error("expected ok");
    expect(decoded.bundle.source).toBe(sample.source);
    expect(decoded.bundle.args).toBe(sample.args);
    expect(decoded.bundle.exitCode).toBe(0);
    expect(decoded.bundle.registers).toEqual(sample.registers);
  });

  it("decodeBundle reports none for missing input and corrupt for malformed", () => {
    expect(decodeBundle(null)).toEqual({ kind: "none" });
    expect(decodeBundle("")).toEqual({ kind: "none" });
    expect(decodeBundle("not-a-real-payload")).toEqual({ kind: "corrupt" });
  });

  it("decodeBundle rejects a non-string args field (type-confusion guard)", () => {
    const evil = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, b: { source: "ret", args: { toString: "x" } } }),
    );
    expect(decodeBundle(evil)).toEqual({ kind: "corrupt" });
  });

  it("decodeBundle rejects non-string entries in registers", () => {
    const evil = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, b: { source: "ret", registers: ["0x1", 42] } }),
    );
    expect(decodeBundle(evil)).toEqual({ kind: "corrupt" });
  });

  it("decodeBundle rejects a future bundle version", () => {
    const future = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 99, b: { source: "ret" } }),
    );
    expect(decodeBundle(future)).toEqual({ kind: "corrupt" });
  });

  it("decodeBundle rejects an oversized decompressed payload", () => {
    const huge = "x".repeat(MAX_BUNDLE_DECOMPRESSED_BYTES + 1);
    const evil = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, b: { source: huge } }),
    );
    expect(decodeBundle(evil)).toEqual({ kind: "too-large" });
  });

  it("decodeBundle accepts an empty source string", () => {
    const encoded = encodeBundle({ source: "" });
    const decoded = decodeBundle(encoded);
    expect(decoded.kind).toBe("ok");
    if (decoded.kind !== "ok") throw new Error("expected ok");
    expect(decoded.bundle.source).toBe("");
  });
});
