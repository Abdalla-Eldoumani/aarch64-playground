import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "./next.config.mjs";

// vercel.json and next.config.mjs each promise the security headers on their
// own layer (the platform's deploy-time copy and the framework's). This test
// makes a drift between the two a suite failure. Vitest runs with cwd = web/,
// so vercel.json sits one level up.

function vercelCatchAllHeaders(): Record<string, string> {
  const raw = readFileSync(join(process.cwd(), "..", "vercel.json"), "utf8");
  const config = JSON.parse(raw) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const catchAll = config.headers.find((block) => block.source === "/(.*)");
  if (!catchAll) throw new Error("vercel.json lost its catch-all header block");
  return Object.fromEntries(catchAll.headers.map((h) => [h.key, h.value]));
}

async function configuredHeaders(): Promise<Record<string, string>> {
  const blocks = await nextConfig.headers!();
  // The one block that reaches every page: its source starts with the
  // catch-all parameter, and the asset exclusions ride inside it.
  const site = blocks.find((block) => block.source.startsWith("/:path("));
  if (!site) throw new Error("next.config.mjs lost its site-wide header block");
  return Object.fromEntries(site.headers.map((h) => [h.key, h.value]));
}

describe("security header lockstep", () => {
  it("keeps vercel.json and next.config.mjs on the identical header set", async () => {
    // NODE_ENV is "test" here, so the config builds its production policy:
    // the dev-only 'unsafe-eval' branch is the one sanctioned difference
    // between the files, and it must be absent from both strings under test.
    expect(vercelCatchAllHeaders()).toEqual(SECURITY_HEADERS);
    expect(await configuredHeaders()).toEqual(SECURITY_HEADERS);
  });

  it("never ships eval or a third-party script cdn in production", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    // 'wasm-unsafe-eval' is sanctioned (the emulator); bare 'unsafe-eval'
    // would reopen eval-based XSS, and the vendored editor ended the last
    // third-party script origin.
    expect(csp).not.toMatch(/(?<!wasm-)'unsafe-eval'/);
    expect(csp).not.toContain("cdn.jsdelivr.net");
    expect(csp).toContain("'wasm-unsafe-eval'");
  });
});
