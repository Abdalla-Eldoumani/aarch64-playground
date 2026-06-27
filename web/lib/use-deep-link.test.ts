import { afterEach, describe, expect, test, vi } from "vitest";
import LZString from "lz-string";
import { buildDeepLinkQuery, parseDeepLink } from "@/lib/use-deep-link";
import { MAX_SHARE_HASH_BYTES } from "@/lib/upload-guard";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseDeepLink", () => {
  test("?example=week08_scores names the example", () => {
    expect(parseDeepLink("?example=week08_scores").example).toBe("week08_scores");
  });

  test("malicious example with slash is dropped", () => {
    expect(parseDeepLink("?example=../etc/passwd").example).toBeUndefined();
  });

  test("?theme=light yields theme 'light'", () => {
    expect(parseDeepLink("?theme=light").theme).toBe("light");
  });

  test("?theme=high-contrast yields theme 'high-contrast'", () => {
    expect(parseDeepLink("?theme=high-contrast").theme).toBe("high-contrast");
  });

  test("?embed=1 yields embed true", () => {
    expect(parseDeepLink("?embed=1").embed).toBe(true);
  });

  test("?embed=0 yields embed false", () => {
    expect(parseDeepLink("?embed=0").embed).toBe(false);
  });

  test("absent params yield undefined fields and embed false", () => {
    const r = parseDeepLink("");
    expect(r.example).toBeUndefined();
    expect(r.theme).toBeUndefined();
    expect(r.embed).toBe(false);
  });

  test("multiple params combine", () => {
    const r = parseDeepLink("?example=week08_scores&theme=light&embed=1");
    expect(r).toEqual({
      example: "week08_scores",
      theme: "light",
      embed: true,
    });
  });

  test("?bundle=<lz> decodes into the deep link's bundle field", async () => {
    const { encodeBundle } = await import("@/lib/diagnostic-bundle");
    const encoded = encodeBundle({
      source: ".text\nmain:\n    mov x0, 9\n    svc 0\n",
      args: "demo",
      exitCode: 9,
    });
    const dl = parseDeepLink(`?bundle=${encoded}`);
    expect(dl.bundle).not.toBeUndefined();
    expect(dl.bundle!.source).toContain("mov x0, 9");
    expect(dl.bundle!.args).toBe("demo");
    expect(dl.bundle!.exitCode).toBe(9);
  });

  test("malformed ?bundle is silently dropped", () => {
    const dl = parseDeepLink("?bundle=not-a-payload");
    expect(dl.bundle).toBeUndefined();
  });

  test("an oversized ?bundle= payload falls back to no bundle before decompressing", () => {
    const spy = vi.spyOn(LZString, "decompressFromEncodedURIComponent");
    const oversized = "a".repeat(MAX_SHARE_HASH_BYTES + 1);
    const dl = parseDeepLink(`?bundle=${oversized}`);
    expect(dl.bundle).toBeUndefined();
    // The decompression-bomb guard rejects the raw fragment before lz-string
    // is invoked, so a tiny payload cannot expand to exhaust the tab.
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("buildDeepLinkQuery", () => {
  test("empty link yields empty string", () => {
    expect(buildDeepLinkQuery({})).toBe("");
  });

  test("includes example, theme, embed", () => {
    const q = buildDeepLinkQuery({
      example: "week08_scores",
      theme: "high-contrast",
      embed: true,
    });
    expect(q).toContain("example=week08_scores");
    expect(q).toContain("theme=high-contrast");
    expect(q).toContain("embed=1");
  });

  test("omits embed when false", () => {
    expect(buildDeepLinkQuery({ example: "week08_scores", embed: false })).toBe("?example=week08_scores");
  });
});
