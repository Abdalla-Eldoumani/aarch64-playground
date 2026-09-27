import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "@/next.config.mjs";

// scripts/check-headers.js audits a deployed site's headers. It is CommonJS
// and sits one level above web/ (vitest's cwd), so it is loaded by path.
const nodeRequire = createRequire(import.meta.url);
const { REQUIRED } = nodeRequire(
  path.join(process.cwd(), "..", "scripts", "check-headers.js"),
) as { REQUIRED: Record<string, (value: string) => boolean> };

const SHIPPED_CSP = SECURITY_HEADERS["Content-Security-Policy"];
const cspPasses = REQUIRED["content-security-policy"];

// The shipped policy with one more source in the given directive, so the
// verdict turns on that source alone.
function withSource(directive: string, source: string): string {
  expect(SHIPPED_CSP).toContain(`${directive} 'self'`);
  return SHIPPED_CSP.replace(`${directive} 'self'`, `${directive} 'self' ${source}`);
}

describe("the header audit script", () => {
  it("passes every header the site ships", () => {
    const shipped = new Map(
      Object.entries(SECURITY_HEADERS).map(([name, value]) => [name.toLowerCase(), value]),
    );
    for (const [name, passes] of Object.entries(REQUIRED)) {
      const value = shipped.get(name);
      expect(value, name).toBeDefined();
      expect(passes(value ?? ""), name).toBe(true);
    }
  });

  it("fails a policy that lets the script CDN back in, however the source spells it", () => {
    for (const source of [
      "https://cdn.jsdelivr.net/npm/",
      "cdn.jsdelivr.net",
      "https://cdn.jsdelivr.net:443",
      "https://CDN.jsDelivr.net",
      "https://*.jsdelivr.net",
      "*",
    ]) {
      expect(cspPasses(withSource("script-src", source)), source).toBe(false);
    }
    expect(cspPasses(withSource("style-src", "https://cdn.jsdelivr.net"))).toBe(false);
  });

  it("does not take a host that only contains the CDN's name for the CDN", () => {
    for (const source of [
      "https://evil-cdn.jsdelivr.net.example.com",
      "cdn.jsdelivr.net.example.com",
      "https://example.com/cdn.jsdelivr.net/",
    ]) {
      expect(cspPasses(withSource("script-src", source)), source).toBe(true);
    }
  });
});
