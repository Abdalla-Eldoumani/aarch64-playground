# Testing

How to run each kind of test. The PR template lists the minimum gates; this is the full reference.

## Layers

Three layers: Rust unit and integration tests in `emulator/` (the 50-program C corpus rides among them, described below), a vitest suite in `web/` for the React and library code, and an end-to-end example run (`scripts/verify-corpus.js`) that exercises the shipped programs through a node-target WASM build. Each run prints its own counts; the last measured shape was 1,050 Rust tests (825 of them unit tests on the lib target, the rest spread over twenty-three integration suites; there are no doc tests), 2,149 web tests across 183 files, and 16 example fixtures, all passing. CI (`.github/workflows/check.yml`) runs all of it on every PR to `main`.

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

Tests live under a `test/` tree beside the code they cover, mirroring the source groups (`web/lib/test/<group>/<feature>.test.ts`, `web/components/test/<group>/<Component>.test.tsx`); contract tests with no single subject file (seeded content, course style, authoring rules) sit in `web/lib/test/content/`. Two placements sit outside that tree, both because the subject does: App Router tests live beside their route file as `web/app/**/*.test.ts(x)`, and `web/next.config.test.ts` lives beside `web/next.config.mjs` at the web root (the vitest `include` carries a `*.test.ts` entry for it). [`CONTRIBUTING.md`](CONTRIBUTING.md#naming-conventions) has the reasoning. The runner wires [`web/vitest.setup.ts`](../web/vitest.setup.ts), which stubs `window.matchMedia` (jsdom lacks it). Use plain DOM assertions; `@testing-library/jest-dom` is not installed.

## End-to-end corpus

From the repo root:

```bash
node scripts/verify-corpus.js
```

Runs every CPSC 355 example that has a fixture under `web/public/examples/cpsc355/fixtures/` to completion, asserting stdout and post-run VFS state. It then assembles every shipped example, fixture or not, so a program no fixture exercises still has to build; `is-prime` is skipped there because it is a leaf function with no entry point and ships without a caller. It loads a prebuilt node-target bundle rather than building one, so build that first from `emulator/`: `wasm-pack build --target nodejs --out-dir ../web/lib/wasm-node` (or point `WASM_DIR` at an existing build). Run it whenever you touch the assembler, executor, frontend pipeline, or the examples.

## The SIMD conformance suites

Two suites replay a capture taken on the course server (GNU as 2.46.1 and
gcc 16.2.1 on csarm, 2026-09-13) rather than anything written by hand:

```bash
cargo test --manifest-path emulator/Cargo.toml --test simd
cargo test --manifest-path emulator/Cargo.toml --test simd_behaviour
```

`emulator/tests/simd-inventory.txt` holds every Advanced SIMD form GAS
accepts, 2,208 of them, as `spelling => 0xWORD` plus the spelling objdump
prints back when it differs. `tests/simd.rs` requires each line whose
family has landed to assemble to exactly that word, decode, and print
back through `decoder::format`; each line whose mnemonic is still on
`NOT_YET` (shared through `tests/common/mod.rs`) must be REJECTED, so the
queue flips red the moment a family lands rather than quietly rotting.

`emulator/tests/simd-behaviour.txt` is the other half: for three input
sets, the registers and 16-byte memory chunks each line actually changed
on the server. `tests/simd_behaviour.rs` rebuilds that machine state and
replays every implemented line, so a form that encodes correctly but
moves the wrong bytes still fails. Neither fixture is ever hand-edited;
both are regenerated from the probe.

The two counts move together as families land. Today `simd.rs` holds
2,205 lines to their word and rejects none, with 3 literal loads checked
through the hosted pipeline instead, and `simd_behaviour.rs` replays
every one of its 6,615 rows. The queue is empty: every family the
inventory carries has landed, and `common::NOT_YET` stays so a family
taken back out has somewhere to be declared.

## The C corpus

Fifty small C programs compiled by gcc, whose assembly is replayed
through the emulator and required to match a real AArch64 machine's
stdout and exit code byte for byte. It proves the emulator against code
a compiler wrote rather than code a person wrote for the emulator; its
first sweep found a silent wrong-target bug in every dotless conditional
branch. It runs inside the ordinary Rust suite with no toolchain at all:

```bash
cargo test --manifest-path emulator/Cargo.toml --test c_corpus
```

At `-O0` the corpus is a gate and all 50 programs match. The `-O2` tier
is an ignored coverage map (`-- --ignored` runs it), not a gate; it
passes 50 of 50 against a recorded floor of 50, the last two gaps having
closed when the vector immediates landed (`13_float_double` zeroes its
struct with `movi d31, #0` once the optimizer drops the `q` copies its
`-O0` tier makes, and `14_float_single` zeroes a float with
`movi v0.2s, #0`). Both pending lists are empty. A pending program is
not counted as passing: it is kept out of the failure list because its
gap is already recorded, and out of the passing count because it never
ran. One that starts assembling turns its tier red, so a fix gets
recorded instead of passing unnoticed.

Adding a program and regenerating the references needs a cross
compiler and qemu-user; [`emulator/tests/c-corpus/README.md`](../emulator/tests/c-corpus/README.md)
has the steps, where the tracked references came from, and the one
recorded hardware-versus-qemu divergence. A weekly workflow
(`corpus.yml`) regenerates everything and fails on drift, so a toolchain
change is caught without a PR.

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
npm run size               # size-limit budgets from package.json, then scripts/bundle-budget.js
npm run lighthouse         # desktop preset, headless
npm run lighthouse:mobile  # mobile preset, headless
```

`npm run size` is two halves. size-limit checks the globbed budgets in
`web/package.json`: the learn, practice, and reference route entry chunks,
the lazy monaco and xterm chunks, the wasm module, the stylesheets, and the
two flight payloads the index routes send (`practice.rsc` and `learn.rsc`).
`scripts/bundle-budget.js` covers what a glob cannot. The App Router's
shared chunks are named by webpack ids that move whenever the module graph
moves, so it reads the build's own manifests and sums the brotli bytes of
every chunk the landing and playground documents load. Every limit on both
sides is the measured total plus ten percent.

The lighthouse runs need a `next start` server already on
`http://localhost:3000`. Lighthouse is pinned at 13.4.1 in
`web/package.json` so a before-and-after comparison is same-version. Run it
three times on an otherwise idle machine and take the median of FCP, LCP,
TBT, CLS, and the performance score; one run moves several points by
itself. These are unthrottled localhost numbers and do not line up with
PageSpeed Insights, which throttles, so compare them only against other
local runs.

## Cross-browser smoke

From `web/`:

```bash
npm run smoke:firefox
```

Drives Firefox through the live app to confirm CSP boots Monaco and the editor renders, and prints the service-worker registration count. Back when the editor loaded from a CDN this caught a `style-src` omission Chromium allowed silently; the editor is served same-origin now, and the smoke run still guards the boot.

## What CI runs

`.github/workflows/check.yml` fans out so nothing waits on anything it
does not need:

- **wasm**: the web and nodejs wasm-pack builds, uploaded as an artifact
  every other job below downloads. The bundles are cached on a hash of the
  emulator sources and the two tool pins, so a change that leaves the
  emulator alone restores them instead of installing a toolchain.
- **rust**: four jobs that run alongside the web jobs: `cargo test` minus
  the corpus gate, and the fifty-program corpus sliced three ways
  (`CORPUS_SHARD=i/3`, read by the test itself), every program running
  exactly once across the slices. A plain local `cargo test` still runs
  the whole suite in one piece.
- **corpus**: `node scripts/verify-corpus.js`.
- **web-static**: the dependency audit, `npm run lint`, `npm run typecheck`.
- **web-build**: `npm run build` and `npm run size`.
- **web-test**: `npm test -- --coverage` split into six shards
  (`--shard=n/6`), every test file running exactly once across them.
- **coverage**: merges the shards' blob reports (vitest writes them under
  `web/.vitest/blob/`, which the shard jobs upload and this job downloads)
  and enforces the coverage floors in `web/vitest.config.mts` on the
  whole-suite numbers, so a suite that passes locally can still fail CI if
  coverage drops below them.

Every web job restores `web/node_modules` through one composite action
(`.github/actions/node-setup`) keyed on the manifest and lockfile with
their `version` fields removed, so a release bump does not cold-install
every job. Each job maps to a local command above. The shards set `VITEST_SHARD` so
the floors are judged once on the merged report rather than against a
shard's partial slice; a plain local `npm test -- --coverage` still
enforces them directly.

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
