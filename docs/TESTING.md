# Testing

How to run each kind of test in this repo. The PR template lists the
minimum gates; this file is the full reference.

## Overview

Three layers of tests: Rust unit and integration tests in `emulator/`,
a vitest suite in `web/` covering the React and library code, and an
end-to-end corpus run via `scripts/verify-corpus.js` that exercises
every example program through the WASM build in node. CI
(`.github/workflows/check.yml`) runs all of these on every PR to
`main`.

## Rust tests

From the repo root:

```bash
cargo test --manifest-path emulator/Cargo.toml
```

For fast iteration during a Rust change, narrow to the lib target:

```bash
cargo test --manifest-path emulator/Cargo.toml --lib
```

If `cargo test` fails locally on Windows with `LNK1104: cannot open
file build_script_build-*.exe`, that's AVG / McAfee quarantining the
debug build script. Run with `--release` instead. The full background
and a few related Rust gotchas live in
[`CONTRIBUTING.md`](CONTRIBUTING.md#gotchas-to-know-about). CI is
unaffected.

## Web tests

From `web/`:

```bash
npm test           # one-shot via vitest run
npm run test:watch # interactive
```

Tests live next to the code they cover, e.g. `web/lib/<feature>.test.ts`
or `web/components/<Component>.test.tsx`. The vitest config wires
[`web/vitest.setup.ts`](../web/vitest.setup.ts), which stubs
`window.matchMedia` because jsdom doesn't ship it. Use plain DOM
assertions; `@testing-library/jest-dom` matchers are not installed.

## End-to-end corpus

From the repo root:

```bash
node scripts/verify-corpus.js
```

Builds a node-target WASM bundle and runs every example program in
`web/public/examples/` to completion, asserting registers, memory, and
hosted-runtime output match the values encoded in each fixture. Run
this whenever you touch the assembler, executor, frontend pipeline,
or `web/public/examples/`.

## Type and lint

From `web/`:

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint . via flat config
```

The eslint flat config ignores `lib/wasm/` and `lib/wasm-node/`
because both are wasm-pack-generated and not ours to lint.

## Performance and size

From `web/`:

```bash
npm run size              # size-limit budgets defined in package.json
npm run lighthouse        # desktop preset, headless
npm run lighthouse:mobile # mobile preset, headless
```

The lighthouse runs need a `next start` server already listening on
`http://localhost:3000`.

## Cross-browser smoke

From `web/`:

```bash
npm run smoke:firefox
```

Drives a Firefox engine through the live app to verify CSP boots
Monaco, the editor renders, and the service worker registers. This
caught the `cdn.jsdelivr.net` style-src omission that Chromium
silently allowed.

## What CI runs

`.github/workflows/check.yml` has three jobs. The `rust` job runs
`cargo test` and the two wasm-pack builds (web and nodejs targets).
The `web` job runs `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`, and `npm run size`. The `corpus` job runs
`node scripts/verify-corpus.js`. Each maps directly to the local
commands above, so anything that passes locally on this checklist
should pass in CI.

## Pre-PR checklist

Mirrors the PR template's "How to verify" minimums:

1. `cargo test --manifest-path emulator/Cargo.toml` passes.
2. From `web/`, `npm run lint && npm run typecheck && npm test` all pass.
3. `node scripts/verify-corpus.js` passes if your change touches the
   assembler, executor, or examples.
4. You have manually exercised the change in `npm run dev` (or
   `npm run dev:all`) if it's UI-visible.
