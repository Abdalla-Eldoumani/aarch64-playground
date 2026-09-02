#!/usr/bin/env bash
# Vercel build entrypoint. Installs Rust + wasm-pack if missing, compiles the
# emulator crate to WebAssembly, then hands off to next build in web/.
#
# wasm-pack 0.14 requires rustup, and Vercel's build image ships system rustc
# without it, so a top-level `cargo install --locked wasm-pack` fails; install
# a minimal rustup profile into $HOME first.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

# Both toolchain versions are pinned so the deployed wasm is built by the same
# compilers the release was verified with; a floating "stable" would silently
# rebuild production with a toolchain nothing has tested. Bump both pins
# deliberately, with a full local rebuild and test pass on the new versions.
rust_toolchain="1.96.0"
wasm_pack_version="0.14.0"

echo "--- installing rust toolchain ${rust_toolchain}"
if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain "$rust_toolchain"
fi
# rustup-init.sh writes $HOME/.cargo/env on Linux/macOS. Source it if it
# exists (Vercel's fresh build image); skip otherwise so the script works
# in environments that already have cargo on PATH (CI with cached toolchain,
# local Windows/Git Bash).
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

rustup toolchain install "$rust_toolchain" --profile minimal
# Scope the pin to this process; never rewrite the machine's default toolchain.
export RUSTUP_TOOLCHAIN="$rust_toolchain"
rustup target add wasm32-unknown-unknown

echo "--- installing wasm-pack ${wasm_pack_version}"
# A warm builder may carry some other wasm-pack; the pin holds only if the
# version is checked, not just the command's presence.
if ! command -v wasm-pack >/dev/null 2>&1 \
  || ! wasm-pack --version | grep -q "wasm-pack $wasm_pack_version"; then
  cargo install --locked --force --version "$wasm_pack_version" wasm-pack
fi

echo "--- building emulator (wasm-pack release)"
cd "$repo_root/emulator"
wasm-pack build --target web --out-dir "$repo_root/web/lib/wasm"
# The node-target build never ships, but next build type-checks the test
# files, and six of them type-import this module; without it the deploy
# fails the TypeScript step (Next 16.3 made the check cover tests).
wasm-pack build --target nodejs --out-dir "$repo_root/web/lib/wasm-node"

echo "--- building next app"
cd "$repo_root/web"
# Use the project's canonical build command (next build --webpack). The
# next.config webpack() hook (e.g. the `?raw` source-import rule) only
# applies under webpack, so the deploy must match local/CI, not the
# default bundler.
npm run build
