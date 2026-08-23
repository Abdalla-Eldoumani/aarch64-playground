# Testing

How to run each kind of test. The PR template lists the minimum gates; this is the full reference.

## Layers

Three layers: Rust unit and integration tests in `emulator/`, a vitest suite in `web/` for the React and library code, and an end-to-end corpus run (`scripts/verify-corpus.js`) that exercises the example programs through a node-target WASM build. At the time of writing that is 900 Rust tests, 1994 web tests, and 16 corpus programs. CI (`.github/workflows/check.yml`) runs all three on every PR to `main`.

## Rust

From the repo root:

```bash
cargo test --manifest-path emulator/Cargo.toml
```

For fast iteration, narrow to the lib target:

```bash
cargo test --manifest-path emulator/Cargo.toml --lib
```

To run one integration suite (they live in `emulator/tests/`, one file per
suite), name it with `--test`; to run one test, add any substring of its
function name:

```bash
cargo test --manifest-path emulator/Cargo.toml --test heap_stubs
cargo test --manifest-path emulator/Cargo.toml --test stepping paused_snapshots
cargo test --manifest-path emulator/Cargo.toml malloc     # every test matching "malloc"
```

On Windows, if `cargo test` fails with `LNK1104: cannot open file build_script_build-*.exe`, antivirus is quarantining the debug build script; run with `--release`. See [`CONTRIBUTING.md`](CONTRIBUTING.md#gotchas). CI is unaffected.

## Web

From `web/`:

```bash
npm test            # one-shot (vitest run)
npm run test:watch  # interactive
```

To test one component or module instead of the whole suite, hand vitest the
file (or several), or filter by test name with `-t`:

```bash
npx vitest run lib/test/playground/file-map.test.ts
npx vitest run components/test/playground/ImportExport.test.tsx
npx vitest run lib/test/playground/          # every test in one group
npx vitest run -t "share hash"               # tests whose name matches
```

Tests live under a `test/` tree beside the code they cover, mirroring the source groups (`web/lib/test/<group>/<feature>.test.ts`, `web/components/test/<group>/<Component>.test.tsx`); contract tests with no single subject file (seeded content, course style, authoring rules) sit in `web/lib/test/content/`. Two placements sit outside that tree, both because the subject does: App Router tests live beside their route file as `web/app/**/*.test.ts(x)`, and `web/proxy.test.ts` lives beside `web/proxy.ts` at the web root (the vitest `include` carries a `*.test.ts` entry for it). [`CONTRIBUTING.md`](CONTRIBUTING.md#naming-conventions) has the reasoning. The runner wires [`web/vitest.setup.ts`](../web/vitest.setup.ts), which stubs `window.matchMedia` (jsdom lacks it). Use plain DOM assertions; `@testing-library/jest-dom` is not installed.

## End-to-end corpus

From the repo root:

```bash
node scripts/verify-corpus.js
```

Runs every CPSC 355 example that has a fixture under `web/public/examples/cpsc355/fixtures/` to completion, asserting stdout and post-run VFS state. It loads a prebuilt node-target bundle rather than building one, so build that first from `emulator/`: `wasm-pack build --target nodejs --out-dir ../web/lib/wasm-node` (or point `WASM_DIR` at an existing build). Run it whenever you touch the assembler, executor, frontend pipeline, or the examples.

## Type and lint

From `web/`:

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
```

The eslint flat config ignores `lib/wasm/` and `lib/wasm-node/` (both wasm-pack-generated) and `coverage/` (v8 coverage output).

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

Drives Firefox through the live app to confirm CSP boots Monaco, the editor renders, and the service worker registers. Back when the editor loaded from a CDN this caught a `style-src` omission Chromium allowed silently; the editor is served same-origin now, and the smoke run still guards the boot.

## What CI runs

`.github/workflows/check.yml` has three jobs:

- **rust**: `cargo test` plus the web and nodejs wasm-pack builds.
- **web**: `npm run lint`, `npm run typecheck`, `npm test -- --coverage`, `npm run build`, `npm run size`.
- **corpus**: `node scripts/verify-corpus.js`.

Each maps to a local command above, with one difference: CI's `--coverage` flag also enforces the coverage floors in `web/vitest.config.ts`, so a suite that passes locally can still fail CI if coverage drops below them.

## Pre-PR checklist

Mirrors the PR template's "How to verify":

1. `cargo test --manifest-path emulator/Cargo.toml` passes.
2. From `web/`, `npm run lint && npm run typecheck && npm test` all pass.
3. `node scripts/verify-corpus.js` passes if the change touches the assembler, executor, or examples.
4. You exercised the change in `npm run dev` (or `npm run dev:all`) if it is UI-visible.

## Start of each term

The course-parity tests run only against a local copy of the current
tutorials, so nothing automated notices when a new offering changes them.
Once per term: refresh the local tutorial set, run
`cargo test --manifest-path emulator/Cargo.toml --test cpsc355_corpus -- --ignored`,
and fix or file whatever no longer assembles or runs.
