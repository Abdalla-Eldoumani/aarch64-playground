# Testing

How to run each kind of test. The PR template lists the minimum gates; this is the full reference.

## Layers

Three layers: Rust unit and integration tests in `emulator/`, a vitest suite in `web/` for the React and library code, and an end-to-end corpus run (`scripts/verify-corpus.js`) that exercises the example programs through a node-target WASM build. As of the correctness pass that is 756 Rust tests, 1450 web tests, and 15 corpus programs. CI (`.github/workflows/check.yml`) runs all three on every PR to `main`.

## Rust

From the repo root:

```bash
cargo test --manifest-path emulator/Cargo.toml
```

For fast iteration, narrow to the lib target:

```bash
cargo test --manifest-path emulator/Cargo.toml --lib
```

On Windows, if `cargo test` fails with `LNK1104: cannot open file build_script_build-*.exe`, antivirus is quarantining the debug build script; run with `--release`. See [`CONTRIBUTING.md`](CONTRIBUTING.md#gotchas). CI is unaffected.

## Web

From `web/`:

```bash
npm test            # one-shot (vitest run)
npm run test:watch  # interactive
```

Tests live under a `test/` tree beside the code they cover, mirroring the source groups (`web/lib/test/<group>/<feature>.test.ts`, `web/components/test/<group>/<Component>.test.tsx`); contract tests with no single subject file (seeded content, course style, authoring rules) sit in `web/lib/test/content/`. The runner wires [`web/vitest.setup.ts`](../web/vitest.setup.ts), which stubs `window.matchMedia` (jsdom lacks it). Use plain DOM assertions; `@testing-library/jest-dom` is not installed.

## End-to-end corpus

From the repo root:

```bash
node scripts/verify-corpus.js
```

Builds a node-target WASM bundle and runs every CPSC 355 example that has a fixture under `web/public/examples/cpsc355/fixtures/` to completion, asserting stdout and post-run VFS state. Run it whenever you touch the assembler, executor, frontend pipeline, or the examples.

## Type and lint

From `web/`:

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
```

The eslint flat config ignores `lib/wasm/` and `lib/wasm-node/`, both wasm-pack-generated.

## Size and performance

From `web/`:

```bash
npm run size               # size-limit budgets from package.json
npm run lighthouse         # desktop preset, headless
npm run lighthouse:mobile  # mobile preset, headless
```

The lighthouse runs need a `next start` server already on `http://localhost:3000`.

## Cross-browser smoke

From `web/`:

```bash
npm run smoke:firefox
```

Drives Firefox through the live app to confirm CSP boots Monaco, the editor renders, and the service worker registers. This caught a `cdn.jsdelivr.net` style-src omission Chromium allowed silently.

## What CI runs

`.github/workflows/check.yml` has three jobs:

- **rust**: `cargo test` plus the web and nodejs wasm-pack builds.
- **web**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run size`.
- **corpus**: `node scripts/verify-corpus.js`.

Each maps to a local command above, so a clean local run should pass CI.

## Pre-PR checklist

Mirrors the PR template's "How to verify":

1. `cargo test --manifest-path emulator/Cargo.toml` passes.
2. From `web/`, `npm run lint && npm run typecheck && npm test` all pass.
3. `node scripts/verify-corpus.js` passes if the change touches the assembler, executor, or examples.
4. You exercised the change in `npm run dev` (or `npm run dev:all`) if it is UI-visible.
