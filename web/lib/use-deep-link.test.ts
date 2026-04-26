import { describe, expect, test } from "vitest";
import { buildDeepLinkQuery, parseDeepLink } from "@/lib/use-deep-link";

describe("parseDeepLink", () => {
  test("?view=c-to-asm yields view 'c-to-asm'", () => {
    expect(parseDeepLink("?view=c-to-asm").view).toBe("c-to-asm");
  });

  test("?view=playground yields view 'playground'", () => {
    expect(parseDeepLink("?view=playground").view).toBe("playground");
  });

  test("unknown view value is dropped", () => {
    expect(parseDeepLink("?view=garbage").view).toBeUndefined();
  });

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
    expect(r.view).toBeUndefined();
    expect(r.example).toBeUndefined();
    expect(r.theme).toBeUndefined();
    expect(r.embed).toBe(false);
  });

  test("multiple params combine", () => {
    const r = parseDeepLink("?view=c-to-asm&example=week08_scores&theme=light&embed=1");
    expect(r).toEqual({
      view: "c-to-asm",
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
});

describe("buildDeepLinkQuery", () => {
  test("empty link yields empty string", () => {
    expect(buildDeepLinkQuery({})).toBe("");
  });

  test("includes view, example, theme, embed", () => {
    const q = buildDeepLinkQuery({
      view: "c-to-asm",
      example: "week08_scores",
      theme: "high-contrast",
      embed: true,
    });
    expect(q).toContain("view=c-to-asm");
    expect(q).toContain("example=week08_scores");
    expect(q).toContain("theme=high-contrast");
    expect(q).toContain("embed=1");
  });

  test("omits embed when false", () => {
    expect(buildDeepLinkQuery({ view: "playground", embed: false })).toBe("?view=playground");
  });
});
