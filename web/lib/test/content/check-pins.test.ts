import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// .github/scripts/check-pins.js holds the workflows' Rust and wasm-pack pins
// to the ones scripts/vercel-build.sh deploys with. It is CommonJS one level
// above web/ (vitest's cwd), so it is loaded by path.
const SCRIPT = path.join(process.cwd(), "..", ".github", "scripts", "check-pins.js");
const { mismatches } = createRequire(import.meta.url)(SCRIPT) as {
  mismatches: (read: (file: string) => string) => string[];
};

function repo(over: Record<string, string> = {}) {
  const files: Record<string, string> = {
    "scripts/vercel-build.sh": 'set -e\nrust_toolchain="1.96.0"\nwasm_pack_version="0.14.0"\n',
    ".github/workflows/check.yml": 'env:\n  RUST_TOOLCHAIN: "1.96.0"\n  WASM_PACK_VERSION: "0.14.0"\n',
    ".github/workflows/browser.yml": 'env:\n  RUST_TOOLCHAIN: "1.96.0"\n  WASM_PACK_VERSION: "0.14.0"\n',
    ".github/workflows/bounds.yml": 'env:\n  RUST_TOOLCHAIN: "1.96.0"\n',
    ".github/workflows/corpus.yml": 'env:\n  RUST_TOOLCHAIN: "1.96.0"\n',
    ...over,
  };
  return (file: string) => files[file];
}

describe("the toolchain pin check", () => {
  it("passes when every pin matches the deploy script", () => {
    expect(mismatches(repo())).toEqual([]);
  });

  it("names a workflow that tests another compiler than the deploy ships", () => {
    expect(
      mismatches(repo({ "scripts/vercel-build.sh": 'rust_toolchain="1.97.0"\nwasm_pack_version="0.14.0"\n' })),
    ).toEqual([
      ".github/workflows/check.yml: rust 1.96.0, but scripts/vercel-build.sh deploys 1.97.0",
      ".github/workflows/browser.yml: rust 1.96.0, but scripts/vercel-build.sh deploys 1.97.0",
      ".github/workflows/bounds.yml: rust 1.96.0, but scripts/vercel-build.sh deploys 1.97.0",
      ".github/workflows/corpus.yml: rust 1.96.0, but scripts/vercel-build.sh deploys 1.97.0",
    ]);
    expect(
      mismatches(repo({ ".github/workflows/check.yml": 'RUST_TOOLCHAIN: "1.96.0"\nWASM_PACK_VERSION: "0.13.1"\n' })),
    ).toEqual([".github/workflows/check.yml: wasm-pack 0.13.1, but scripts/vercel-build.sh deploys 0.14.0"]);
  });

  it("fails on a pin it can no longer find, so a rename cannot pass unchecked", () => {
    expect(mismatches(repo({ ".github/workflows/bounds.yml": 'env:\n  TOOLCHAIN: "1.96.0"\n' }))).toEqual([
      ".github/workflows/bounds.yml: no rust pin found",
    ]);
  });

  it("passes on this repository", () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
