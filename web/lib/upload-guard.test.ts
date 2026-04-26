import { describe, expect, test } from "vitest";
import {
  MAX_BOOKMARK_JSON_BYTES,
  MAX_BUNDLE_DECOMPRESSED_BYTES,
  MAX_SHARE_DECOMPRESSED_BYTES,
  MAX_SOURCE_BYTES,
  MAX_VFS_BYTES,
  checkUploadSize,
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
    expect(msg).toMatch(/4 MB/);
  });

  test("error string interpolates the cap in MB rounded to integer", () => {
    expect(checkUploadSize(2_000_000_000, 1_048_576, "x")).toBe("x too large (max 1 MB)");
    expect(checkUploadSize(2_000_000_000, MAX_VFS_BYTES, "y")).toBe("y too large (max 16 MB)");
  });

  test("caps are sane and ordered for the cpsc 355 corpus", () => {
    expect(MAX_SOURCE_BYTES).toBeGreaterThan(0);
    expect(MAX_VFS_BYTES).toBeGreaterThan(MAX_SOURCE_BYTES);
    expect(MAX_BOOKMARK_JSON_BYTES).toBeGreaterThan(0);
    expect(MAX_BUNDLE_DECOMPRESSED_BYTES).toBeGreaterThan(0);
    expect(MAX_SHARE_DECOMPRESSED_BYTES).toBeGreaterThan(0);
  });
});
