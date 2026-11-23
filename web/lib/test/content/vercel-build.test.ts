import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// scripts/vercel-build.sh builds what deploys. Every executable it downloads
// must match a sha256 written in it before anything runs it, and the emulator
// must build from the committed Cargo.lock. The script is read as text one
// level above web/ (vitest's cwd), as check-pins.js reads it.
const ROOT = path.join(process.cwd(), "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const SCRIPT = read("scripts/vercel-build.sh");

/** The script's commands, one per entry: continued lines joined, comments and blank lines dropped. */
const COMMANDS = SCRIPT.replace(/\\\r?\n\s*/g, " ")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));

const matching = (pattern: RegExp) => COMMANDS.filter((line) => pattern.test(line));
const WASM_PACK_BUILDS = matching(/\bwasm-pack build\b/);

describe("scripts/vercel-build.sh", () => {
  it("checks every download against its sha256 before anything runs it", () => {
    const downloads = COMMANDS.flatMap((line, i) => (/\b(curl|wget)\b/.test(line) ? [i] : []));
    expect(downloads, "lines that download").not.toEqual([]);
    for (const i of downloads) {
      expect(COMMANDS[i], "a download piped straight into a shell").not.toMatch(/\|\s*(ba)?sh\b/);
      expect(COMMANDS[i + 1], `the command after ${COMMANDS[i]}`).toMatch(/\bsha256sum --check\b/);
    }
    const fetches = matching(/^fetch /);
    expect(fetches, "calls of fetch, the download function").not.toEqual([]);
    for (const line of fetches) expect(line, "a fetch with no sha256 written in it").toMatch(/ [0-9a-f]{64} /);
  });

  it("leaves rustup and wasm-pack nothing to download for themselves", () => {
    // rustup installs only from the local copy of the release the script checked.
    const rustup = matching(/\brustup (toolchain install|target add|component add|update)\b/);
    expect(rustup, "rustup install commands").not.toEqual([]);
    for (const line of rustup) {
      expect(line).toMatch(/^RUSTUP_DIST_SERVER="file:\/\/[^"]+" rustup /);
      expect(line, "a rustup command that may replace rustup itself").toMatch(/--no-self-update\b/);
    }
    // Without no-install, wasm-pack fetches wasm-bindgen and wasm-opt itself.
    expect(WASM_PACK_BUILDS, "the web and nodejs builds").toHaveLength(2);
    for (const line of WASM_PACK_BUILDS) expect(line).toMatch(/--mode no-install\b/);
    expect(matching(/\bcargo install\b/), "cargo install builds whatever crates.io serves").toEqual([]);
  });

  it("builds the emulator from the committed Cargo.lock", () => {
    for (const line of WASM_PACK_BUILDS) expect(line).toMatch(/ -- --locked$/);
    // wasm-pack's own cargo metadata would rewrite a stale lock before the build saw it.
    const fetch = COMMANDS.indexOf("cargo fetch --locked");
    expect(fetch, "cargo fetch --locked").toBeGreaterThan(-1);
    expect(fetch, "cargo fetch --locked before the first wasm-pack build").toBeLessThan(
      COMMANDS.indexOf(WASM_PACK_BUILDS[0]),
    );
  });

  it("compares the whole wasm-pack version", () => {
    const checks = matching(/\bwasm-pack --version\b/);
    expect(checks, "the version check").toHaveLength(1);
    expect(checks[0]).not.toMatch(/\bgrep\b/);
    expect(checks[0]).toMatch(/"\$\(wasm-pack --version[^)]*\)" != "wasm-pack \$wasm_pack_version"/);
  });

  it("pins the wasm-bindgen CLI the emulator's Cargo.lock names", () => {
    const pinned = SCRIPT.match(/^wasm_bindgen_version="([^"]+)"$/m)?.[1];
    const locked = read("emulator/Cargo.lock").match(/^name = "wasm-bindgen"\r?\nversion = "([^"]+)"$/m)?.[1];
    expect(locked, "wasm-bindgen in Cargo.lock").toBeDefined();
    expect(pinned, "wasm_bindgen_version in the script").toBe(locked);
  });
});
