#!/usr/bin/env node
/*
 * cargo-watch is optional: without it we print the install hint and exit 0,
 * so `npm run dev:all` (concurrently --kill-others-on-fail) keeps the web dev
 * server running.
 */
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const emulatorDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "emulator");
const buildCmd = "wasm-pack build --dev --target web --out-dir ../web/lib/wasm";

const hasCargoWatch =
  spawnSync("cargo watch --version", { stdio: "ignore", shell: true }).status === 0;

if (!hasCargoWatch) {
  console.log(
    "cargo-watch is not installed, so the WASM auto-rebuild is off.\n" +
      "Enable it once with:  cargo install cargo-watch\n" +
      "The web dev server still runs; after a Rust change rebuild by hand from emulator/ with:\n" +
      `  ${buildCmd}`,
  );
  process.exit(0);
}

const watch = spawn(`cargo watch -w src -w Cargo.toml -s "${buildCmd}"`, {
  cwd: emulatorDir,
  stdio: "inherit",
  shell: true,
});
watch.on("exit", (code) => process.exit(code ?? 0));
