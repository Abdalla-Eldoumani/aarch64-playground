#!/usr/bin/env bash
# Vercel build entrypoint. Installs the pinned Rust toolchain, wasm-pack and
# the tools wasm-pack runs, compiles the emulator crate to WebAssembly, then
# hands off to next build in web/.
#
# Every executable this script downloads goes through fetch below, which stops
# the build unless the file's sha256 is the one written here. The pins are the
# x86_64 Linux builds, which is what Vercel's build machines run.
set -euo pipefail

if [ "$(uname -sm)" != "Linux x86_64" ]; then
  echo "scripts/vercel-build.sh installs x86_64 Linux tools; this is $(uname -sm)" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

# Both toolchain versions are pinned so the deployed wasm is built by the same
# compilers the release was verified with; a floating "stable" would silently
# rebuild production with a toolchain nothing has tested. Bump both pins
# deliberately, with a full local rebuild and test pass on the new versions.
rust_toolchain="1.99.1"
wasm_pack_version="0.15.1"
# wasm-pack runs the wasm-bindgen CLI that matches the wasm-bindgen crate in
# emulator/Cargo.lock, and wasm-opt from the binaryen release it names.
wasm_bindgen_version="0.2.130"
binaryen_version="version_130"

tools="$(mktemp -d)"

# fetch <url> <sha256> <dir>: saves the file in <dir> under its own name.
fetch() {
  local file="$3/${1##*/}"
  curl --proto '=https' --tlsv1.2 -sSfL --retry 3 -o "$file" "$1"
  echo "$2  $file" | sha256sum --check -
}

echo "--- installing rust toolchain ${rust_toolchain}"
# Vercel's image has rustup; install the pinned rustup only where it is missing.
if ! command -v rustup >/dev/null 2>&1; then
  fetch https://static.rust-lang.org/rustup/archive/1.29.3/x86_64-unknown-linux-gnu/rustup-init \
    b1c8cb14e30889e7e2999e6b69e62d9e9b9ffc0f4df8180564d306d9680e6c55 "$tools"
  chmod +x "$tools/rustup-init"
  "$tools/rustup-init" -y --profile minimal --default-toolchain none
fi
# rustup-init writes $HOME/.cargo/env; an image that ships rustup may not.
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi
# The checked tools below come first on PATH.
mkdir "$tools/bin"
export PATH="$tools/bin:$PATH"

# rustup installs from a local copy of the release holding only the files
# checked here, and checks each part against the manifest a second time.
release="https://static.rust-lang.org/dist"
release_date="2026-10-15"
mirror="$tools/rust/dist"
mkdir -p "$mirror/$release_date"
fetch "$release/channel-rust-$rust_toolchain.toml" \
  fb152be80975c194aa5fc684b2aec3a6e14e2b855efe2faa4e5f8ae6e590f463 "$mirror"
# rustup reads the manifest's hash from a file beside it.
(cd "$mirror" && sha256sum "channel-rust-$rust_toolchain.toml" > "channel-rust-$rust_toolchain.toml.sha256")
fetch "$release/$release_date/rustc-$rust_toolchain-x86_64-unknown-linux-gnu.tar.xz" \
  2ff05ff9c08a90861e7f6e4065b40a8b87463b4576186fd613871c3e37f2091f "$mirror/$release_date"
fetch "$release/$release_date/cargo-$rust_toolchain-x86_64-unknown-linux-gnu.tar.xz" \
  53f3521949404d595efb06a55c12c5658d4ed1c75566f33d3d514eaebe70bd8a "$mirror/$release_date"
fetch "$release/$release_date/rust-std-$rust_toolchain-x86_64-unknown-linux-gnu.tar.xz" \
  109b074225bf5b9ea3820890876bfdf4ed161adbfaf94b2b4b5984c85ee5d958 "$mirror/$release_date"
fetch "$release/$release_date/rust-std-$rust_toolchain-wasm32-unknown-unknown.tar.xz" \
  5f628f857dd00a8aa3fcac2e275665d2782066a5795274ed124c5b560f46423c "$mirror/$release_date"
RUSTUP_DIST_SERVER="file://$tools/rust" rustup toolchain install "$rust_toolchain" \
  --profile minimal --target wasm32-unknown-unknown --no-self-update
# Scope the pin to this process; never rewrite the machine's default toolchain.
export RUSTUP_TOOLCHAIN="$rust_toolchain"

echo "--- installing wasm-pack ${wasm_pack_version}"
# A warm builder may carry some other wasm-pack, and a prefix match would take
# 0.15.10 for 0.15.1, so the whole version string is compared.
if [ "$(wasm-pack --version 2>/dev/null)" != "wasm-pack $wasm_pack_version" ]; then
  fetch "https://github.com/wasm-bindgen/wasm-pack/releases/download/v$wasm_pack_version/wasm-pack-v$wasm_pack_version-x86_64-unknown-linux-musl.tar.gz" \
    410101009739b9d01c7d5affaaad6e9c9a24b4cba6791a4805db8e89b9bf7af2 "$tools"
  tar -xzf "$tools/wasm-pack-v$wasm_pack_version-x86_64-unknown-linux-musl.tar.gz" -C "$tools/bin" \
    --strip-components=1 "wasm-pack-v$wasm_pack_version-x86_64-unknown-linux-musl/wasm-pack"
fi

echo "--- installing wasm-bindgen ${wasm_bindgen_version} and wasm-opt ${binaryen_version}"
# wasm-pack would download these itself without checking them; with
# --mode no-install below it takes them from PATH and downloads nothing.
fetch "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/$wasm_bindgen_version/wasm-bindgen-$wasm_bindgen_version-x86_64-unknown-linux-musl.tar.gz" \
  9687f3bb551b9f66f37ed32a40d7913a00f7962db653054e56857bc306c3227f "$tools"
tar -xzf "$tools/wasm-bindgen-$wasm_bindgen_version-x86_64-unknown-linux-musl.tar.gz" -C "$tools/bin" \
  --strip-components=1 "wasm-bindgen-$wasm_bindgen_version-x86_64-unknown-linux-musl/wasm-bindgen"
fetch "https://github.com/WebAssembly/binaryen/releases/download/$binaryen_version/binaryen-$binaryen_version-x86_64-linux.tar.gz" \
  0a18362361ad05465118cd8eeb72edaeec89de6894bc283576ef4e07aa3babcc "$tools"
tar -xzf "$tools/binaryen-$binaryen_version-x86_64-linux.tar.gz" -C "$tools/bin" \
  --strip-components=2 "binaryen-$binaryen_version/bin/wasm-opt"
# With no-install, wasm-pack skips a wasm-opt it cannot find and still passes.
if [ "$(command -v wasm-opt)" != "$tools/bin/wasm-opt" ]; then
  echo "wasm-opt on PATH is not the checked copy" >&2
  exit 1
fi

echo "--- building emulator (wasm-pack release)"
cd "$repo_root/emulator"
# wasm-pack runs its own cargo metadata first, which would rewrite a stale
# Cargo.lock before the build's --locked could refuse it.
cargo fetch --locked
wasm-pack build --mode no-install --target web --out-dir "$repo_root/web/lib/wasm" -- --locked
# The node-target build never ships, but next build type-checks the test
# files, and six of them type-import this module; without it the deploy
# fails the TypeScript step (Next 16.3 made the check cover tests).
wasm-pack build --mode no-install --target nodejs --out-dir "$repo_root/web/lib/wasm-node" -- --locked

echo "--- building next app"
cd "$repo_root/web"
# Use the project's canonical build command (next build --webpack). The
# next.config webpack() hook (e.g. the `?raw` source-import rule) only
# applies under webpack, so the deploy must match local/CI, not the
# default bundler. The same script then writes public/sw.js, the service
# worker with this build's file list.
#
# Vercel's adapter collects public/ during next build, so a worker written
# after it never ships. A second build with the same build id ships it, and
# --check fails the deploy if the second build's files differ from the list.
# Redraw an id containing "ad", as Next does for its own: ad blockers match it.
PLAYGROUND_BUILD_ID="$(node -e "const c=require('node:crypto');let id;do id=c.randomBytes(12).toString('base64url');while(/ad/i.test(id));console.log(id)")"
export PLAYGROUND_BUILD_ID
npm run build
npx next build --webpack
node ../scripts/write-precache-list.js --check
