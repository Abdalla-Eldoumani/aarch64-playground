#!/usr/bin/env bash
# Vercel build entrypoint. Installs Rust + wasm-pack if missing, compiles the
# emulator crate to WebAssembly, then hands off to next build in web/.
#
# Why not just `cargo install --locked wasm-pack` at top level? wasm-pack 0.14
# requires rustup; Vercel's build image ships with system rustc but not rustup,
# so we install a minimal rustup profile into $HOME first.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

echo "--- installing rust toolchain"
if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain stable
fi
# rustup-init.sh writes $HOME/.cargo/env on Linux/macOS. Source it if it
# exists (Vercel's fresh build image); skip otherwise so the script works
# in environments that already have cargo on PATH (CI with cached toolchain,
# local Windows/Git Bash).
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

rustup target add wasm32-unknown-unknown

echo "--- installing wasm-pack"
if ! command -v wasm-pack >/dev/null 2>&1; then
  cargo install --locked wasm-pack
fi

echo "--- building emulator (wasm-pack release)"
cd "$repo_root/emulator"
wasm-pack build --target web --out-dir "$repo_root/web/lib/wasm"

echo "--- building next app"
cd "$repo_root/web"
# Use the project's canonical build command (next build --webpack). The
# next.config webpack() hook (e.g. the `?raw` source-import rule) only
# applies under webpack, so the deploy must match local/CI, not the
# default bundler.
npm run build
