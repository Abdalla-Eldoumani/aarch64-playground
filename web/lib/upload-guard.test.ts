import { describe, expect, test } from "vitest";
import {
  MAX_ARGS_CHARS,
  MAX_BOOKMARK_JSON_BYTES,
  MAX_BUNDLE_DECOMPRESSED_BYTES,
  MAX_SHARE_DECOMPRESSED_BYTES,
  MAX_SHARE_HASH_BYTES,
  MAX_SOURCE_BYTES,
  MAX_STDIN_BYTES,
  MAX_VFS_BYTES,
  checkUploadSize,
  validateArgs,
  validateSource,
  validateStdin,
} from "./upload-guard";

describe("upload-guard", () => {
  test("returns null when size equals the cap", () => {
    expect(checkUploadSize(MAX_VFS_BYTES, MAX_VFS_BYTES, "file")).toBe(null);
  });

  test("returns null when size is below the cap", () => {
    expect(checkUploadSize(0, MAX_SOURCE_BYTES, "file")).toBe(null);
    expect(checkUploadSize(1024, MAX_SOURCE_BYTES, "file")).toBe(null);
  });

  test("returns a labeled error string when over the cap", () => {
    const msg = checkUploadSize(MAX_SOURCE_BYTES + 1, MAX_SOURCE_BYTES, "source file");
    expect(msg).toMatch(/source file/);
    expect(msg).toMatch(/1 MB/);
  });

  test("error string interpolates the cap in MB rounded to integer", () => {
    expect(checkUploadSize(2_000_000_000, 1_048_576, "x")).toBe("x too large (max 1 MB)");
    expect(checkUploadSize(2_000_000_000, MAX_VFS_BYTES, "y")).toBe("y too large (max 10 MB)");
  });
});

describe("upload-guard caps", () => {
  test("the locked sizes match the security decision", () => {
    expect(MAX_SOURCE_BYTES).toBe(1 * 1024 * 1024);
    expect(MAX_VFS_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_ARGS_CHARS).toBe(1000);
    expect(MAX_STDIN_BYTES).toBe(100 * 1024);
    expect(MAX_SHARE_HASH_BYTES).toBe(64 * 1024);
  });

  test("caps are sane and ordered for the cpsc 355 corpus", () => {
    expect(MAX_SOURCE_BYTES).toBeGreaterThan(0);
    expect(MAX_VFS_BYTES).toBeGreaterThan(MAX_SOURCE_BYTES);
    expect(MAX_BOOKMARK_JSON_BYTES).toBeGreaterThan(0);
    expect(MAX_BUNDLE_DECOMPRESSED_BYTES).toBeGreaterThan(0);
    expect(MAX_SHARE_DECOMPRESSED_BYTES).toBeGreaterThan(0);
    expect(MAX_SHARE_HASH_BYTES).toBeGreaterThan(0);
  });
});

describe("validateSource", () => {
  test("accepts source under the cap", () => {
    expect(validateSource("")).toBe(null);
    expect(validateSource("mov x0, 1\nsvc 0\n")).toBe(null);
  });

  test("accepts source exactly at the cap", () => {
    expect(validateSource("x".repeat(MAX_SOURCE_BYTES))).toBe(null);
  });

  test("rejects source one byte over the cap", () => {
    const msg = validateSource("x".repeat(MAX_SOURCE_BYTES + 1));
    expect(msg).toMatch(/source/);
    expect(msg).toMatch(/1 MB/);
  });

  test("counts bytes, not characters (multibyte content)", () => {
    // Each "é" is two UTF-8 bytes, so half the cap in characters fills it.
    const halfCapChars = MAX_SOURCE_BYTES / 2;
    expect(validateSource("é".repeat(halfCapChars))).toBe(null);
    expect(validateSource("é".repeat(halfCapChars + 1))).not.toBe(null);
  });
});

describe("validateArgs", () => {
  test("accepts args under the cap", () => {
    expect(validateArgs("")).toBe(null);
    expect(validateArgs("hello world")).toBe(null);
  });

  test("accepts args exactly at the cap", () => {
    expect(validateArgs("x".repeat(MAX_ARGS_CHARS))).toBe(null);
  });

  test("rejects args one character over the cap", () => {
    const msg = validateArgs("x".repeat(MAX_ARGS_CHARS + 1));
    expect(msg).toMatch(/1000/);
    expect(msg).toMatch(/character/);
  });

  test("counts characters, not bytes (multibyte args stay accepted)", () => {
    // 1000 two-byte characters is 2000 bytes but only 1000 characters.
    expect(validateArgs("é".repeat(MAX_ARGS_CHARS))).toBe(null);
    expect(validateArgs("é".repeat(MAX_ARGS_CHARS + 1))).not.toBe(null);
  });
});

describe("validateStdin", () => {
  test("accepts stdin under the cap", () => {
    expect(validateStdin("")).toBe(null);
    expect(validateStdin("42\n")).toBe(null);
  });

  test("accepts stdin exactly at the cap", () => {
    expect(validateStdin("x".repeat(MAX_STDIN_BYTES))).toBe(null);
  });

  test("rejects stdin one byte over the cap", () => {
    const msg = validateStdin("x".repeat(MAX_STDIN_BYTES + 1));
    expect(msg).toMatch(/stdin/);
    expect(msg).toMatch(/100 KB/);
  });

  test("counts bytes, not characters (multibyte content)", () => {
    const halfCapChars = MAX_STDIN_BYTES / 2;
    expect(validateStdin("é".repeat(halfCapChars))).toBe(null);
    expect(validateStdin("é".repeat(halfCapChars + 1))).not.toBe(null);
  });
});
