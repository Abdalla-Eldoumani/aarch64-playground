import { afterEach, describe, expect, test, vi } from "vitest";
import LZString from "lz-string";
import { buildDeepLinkQuery, parseDeepLink, resolveExampleStem } from "@/lib/hooks/use-deep-link";
import { MAX_SHARE_HASH_BYTES } from "@/lib/playground/upload-guard";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseDeepLink", () => {
  test("?example=array-scores names the example", () => {
    expect(parseDeepLink("?example=array-scores").example).toBe("array-scores");
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
    const r = parseDeepLink("?example=array-scores&theme=light&embed=1");
    expect(r).toEqual({
      example: "array-scores",
      theme: "light",
      embed: true,
    });
  });

  test("?bundle=<lz> decodes into the deep link's bundle field", async () => {
    const { encodeBundle } = await import("@/lib/playground/diagnostic-bundle");
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

  test("malformed ?bundle reports a corrupt bundle error", () => {
    const dl = parseDeepLink("?bundle=not-a-payload");
    expect(dl.bundle).toBeUndefined();
    expect(dl.bundleError).toBe("corrupt");
  });

  test("an oversized ?bundle= payload falls back to no bundle before decompressing", () => {
    const spy = vi.spyOn(LZString, "decompressFromEncodedURIComponent");
    const oversized = "a".repeat(MAX_SHARE_HASH_BYTES + 1);
    const dl = parseDeepLink(`?bundle=${oversized}`);
    expect(dl.bundle).toBeUndefined();
    expect(dl.bundleError).toBe("too-large");
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
      example: "array-scores",
      theme: "high-contrast",
      embed: true,
    });
    expect(q).toContain("example=array-scores");
    expect(q).toContain("theme=high-contrast");
    expect(q).toContain("embed=1");
  });

  test("omits embed when false", () => {
    expect(buildDeepLinkQuery({ example: "array-scores", embed: false })).toBe("?example=array-scores");
  });
});

describe("resolveExampleStem", () => {
  test("maps a legacy course-labeled stem to its renamed file", () => {
    expect(resolveExampleStem("week03_exercise")).toBe("basics");
    expect(resolveExampleStem("week08_scores")).toBe("array-scores");
    expect(resolveExampleStem("week11_argv")).toBe("command-line-args");
    expect(resolveExampleStem("week13_copy_file")).toBe("copy-file");
  });

  test("passes an already-clean stem through unchanged", () => {
    expect(resolveExampleStem("basics")).toBe("basics");
    expect(resolveExampleStem("circle-area")).toBe("circle-area");
  });

  test("passes an unknown stem through unchanged", () => {
    expect(resolveExampleStem("not-an-example")).toBe("not-an-example");
  });

  test("does not alias a traversal string, and parseDeepLink still rejects it", () => {
    // resolveExampleStem only remaps the fixed allow-list; path safety is
    // parseDeepLink's job, which drops anything outside /^[\w.-]+$/.
    expect(resolveExampleStem("../etc/passwd")).toBe("../etc/passwd");
    expect(parseDeepLink("?example=../etc/passwd").example).toBeUndefined();
  });
});

describe("parseDeepLink typed-param guards", () => {
  test("an unknown theme value is dropped, not passed through", () => {
    expect(parseDeepLink("?theme=neon").theme).toBeUndefined();
    expect(parseDeepLink("?theme=DARK").theme).toBeUndefined();
  });

  test("an empty example value is dropped", () => {
    expect(parseDeepLink("?example=").example).toBeUndefined();
  });

  test("a wrong-version bundle payload is dropped at the URL level", () => {
    const future = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 99, b: { source: "ret" } }),
    );
    const dl = parseDeepLink(`?bundle=${future}`);
    expect(dl.bundle).toBeUndefined();
    expect(dl.bundleError).toBe("corrupt");
  });

  test("a bundle combines with the other params in one query", async () => {
    const { encodeBundle } = await import("@/lib/playground/diagnostic-bundle");
    const encoded = encodeBundle({ source: "ret\n" });
    const dl = parseDeepLink(`?example=basics&embed=1&bundle=${encoded}`);
    expect(dl.example).toBe("basics");
    expect(dl.embed).toBe(true);
    expect(dl.bundle!.source).toBe("ret\n");
  });
});

describe("legacy alias table invariants", () => {
  test("every alias resolves in one hop to a clean stem outside the legacy set", async () => {
    const { LEGACY_EXAMPLE_ALIASES } = await import("@/lib/hooks/use-deep-link");
    for (const [legacy, clean] of Object.entries(LEGACY_EXAMPLE_ALIASES)) {
      expect(clean).toMatch(/^[a-z0-9-]+$/);
      expect(LEGACY_EXAMPLE_ALIASES[clean]).toBeUndefined();
      expect(resolveExampleStem(legacy)).toBe(clean);
    }
  });
});
