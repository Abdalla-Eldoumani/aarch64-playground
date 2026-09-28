# Testing

The tests come in three layers:

- Rust tests in `emulator/`: unit tests beside the code, and integration
  suites in `emulator/tests/`, one file per suite.
- A vitest suite in `web/` for the site's logic and components.
- `scripts/verify-corpus.js`, which runs the playground's example programs
  through the Node.js copy of the emulator.

Every command below assumes you have built both copies of the emulator, as
the README's [Run it locally](../README.md#run-it-locally) does. Each run
prints its own counts.

## Before you open a pull request

From the repository root:

```bash
cargo test --manifest-path emulator/Cargo.toml
node scripts/verify-corpus.js
```

From `web/`:

```bash
npm run lint
npm run typecheck
npm test
```

If the change shows up on the site, also try it in `npm run dev`. These are
the checks in the pull request template.

## Rust

Run the whole suite from the repository root:

```bash
cargo test --manifest-path emulator/Cargo.toml
```

For a faster loop, run only the unit tests, or one integration suite, or the
tests whose names contain a word:

```bash
cargo test --manifest-path emulator/Cargo.toml --lib
cargo test --manifest-path emulator/Cargo.toml --test heap_stubs
cargo test --manifest-path emulator/Cargo.toml --test stepping paused_snapshots
```

A few suites are worth knowing by name:

- `c_corpus`: 101 small C programs, compiled by gcc on an AArch64 Linux
  server, whose assembly must print the same output and exit with the same
  code as the real machine did. The `-O0` tier runs on every pull request. The
  two `-O2` tiers are ignored there because they triple the time; run them
  with `cargo test --manifest-path emulator/Cargo.toml --test c_corpus -- --ignored`.
  Adding a program needs a cross compiler and qemu-user on Linux; the steps
  are in [emulator/tests/c-corpus/README.md](../emulator/tests/c-corpus/README.md).
- `simd` and `simd_behaviour`: every Advanced SIMD form GNU `as` accepts, as
  captured on the course server, with the 32-bit word each assembles to and
  the registers and memory each changes. The emulator must match both. The
  capture files are regenerated from the server, never edited by hand.
- `error_parity`: the mistakes students make most, such as a missing `main`,
  a misspelled label, or a stack frame that is not a multiple of 16. Each case
  in `emulator/tests/error-parity/` has the program and what the course server
  printed for it (`<case>.server.txt`). The playground's message must start
  with the server's own line and add one line saying what to change.
- `reference_consistency`: [instruction-reference.md](instruction-reference.md)
  must list exactly the mnemonics the assembler accepts.
- `bounds`: the limits that stop a runaway program. Its two slowest tests
  are ignored on pull requests and run weekly in release mode.

On Windows, if a debug test build fails with
`LNK1104: cannot open file ... build_script_build-*.exe`, antivirus is
quarantining a cargo build script. Add `--release`.

## Web

From `web/`:

```bash
npm test
```

To run one test file, or every test in a folder:

```bash
npx vitest run lib/test/playground/file-map.test.ts
npx vitest run lib/test/playground/
```

Tests sit in a `test/` folder that mirrors the code
(`web/lib/test/<group>/`, `web/components/test/<group>/`). Tests that check
the shipped lessons, exercises, and examples as a whole are in
`web/lib/test/content/`. The runner loads `web/vitest.setup.ts`, which adds
the `window.matchMedia` that jsdom lacks. Use plain DOM assertions;
`@testing-library/jest-dom` is not installed.

On a busy machine, jsdom tests can run past their 5-second timeout. If they fail
only on timeouts, run fewer at once with `npm test -- --maxWorkers=4`.

## Example programs

From the repository root:

```bash
node scripts/verify-corpus.js
```

It runs every example in `web/public/examples/cpsc355/` that has a fixture in
`fixtures/` and checks its output, its exit code, and the files it wrote. Then
it assembles every example, fixture or not. It loads `web/lib/wasm-node/`, so
rebuild that after an emulator change. Run it whenever you change the
assembler, the executor, or an example.

## Compare with the course server

On request only, not part of CI. `scripts/parity-sweep.js` runs every program
the site ships (the examples, the lesson and exercise starters, the reference
and pitfall programs, and the home page's program) in the emulator and with
the course toolchain (`m4`, then `gcc`) on the course server, and compares the
output, the exit code, and the files written, byte for byte. The server half
needs key-based ssh access to that server. Without it, run the emulator half
alone:

```bash
node scripts/parity-sweep.js --playground-only
```

It writes the programs and each side's results under
`aarch64-playground-parity` in the OS temp folder, or under `PARITY_SCRATCH`
if you set it, never in the repository. A run with both halves also writes a
`report.md` there with one row per program.

## Size and speed

From `web/`, after `npm run build`:

```bash
npm run size
```

It checks each budget in the `size-limit` list in `web/package.json` (the
route chunks, the lazy editor and terminal, the emulator's `.wasm`, the
stylesheets, and two index payloads), then runs `scripts/bundle-budget.js` for
the shared chunks the home page and the playground load.

`npm run lighthouse` and `npm run lighthouse:mobile` measure a production
server that is already running on <http://localhost:3000> (`npm run start`).
Run each three times and take the median; one run can move several points.
These are unthrottled local numbers, so compare them only with each other.
On Windows, Lighthouse can exit with code 1 after writing its report, when it
cannot delete its temporary Chrome folder; the report is still complete.

`npm run smoke:firefox` opens a page in Firefox through Playwright, checks the
security headers, and waits for the editor to appear. It opens `SITE`, which
defaults to <http://localhost:3000>; the home page has no editor, so point it
at the playground of a running `npm run start`:

```bash
npx playwright install firefox
SITE=http://localhost:3000/playground npm run smoke:firefox
```

The first command downloads Playwright's Firefox, once per machine. A local
server logs errors for Vercel's two analytics scripts, which exist only on
Vercel. In Chrome, each script logs a 404 error and a refused-script error.
In Firefox, each logs one blocked-script error, which the smoke test prints
and ignores.

## What CI runs

`.github/workflows/check.yml` runs on every push and pull request to `main` and
`integration`, and weekly. Its jobs start together, and each one first checks
which files changed (`.github/scripts/classify-changes.js`). On a pull request
a job with nothing to check skips its steps and passes. A docs change runs
nothing, except the two docs the tests read. `docs/authoring-content.md` runs
`wasm`, `corpus`, `web-build`, and `web-test`, and
`docs/instruction-reference.md` runs those four and `rust`. A lesson or
example change skips lint and typecheck, and a change under `emulator/tests/`
runs only the Rust jobs. A change to a workflow, or to a file no rule names,
runs everything, and so does every push.

- `wasm`: builds both emulator bundles, or restores them from a cache keyed on
  the emulator's sources.
- `rust`: `cargo test` without the C corpus, plus the corpus split across
  three jobs (`CORPUS_SHARD=1/3` and so on).
- `corpus`: `node scripts/verify-corpus.js`.
- `web-static`: the dependency audit, a check that `security.txt` is at least
  30 days from its expiry date, `npm run lint`, and `npm run typecheck`.
- `web-build`: `npm run build` and `npm run size`.
- `web-test`: `npm test` split into six shards.
- `coverage`: on pushes and the weekly run only, merges the shards' coverage
  and fails if it drops below the floors in `web/vitest.config.mts`.
- `ci`: fails if any job above failed or was cancelled. It is the one check a
  pull request needs to pass.

Three more workflows run weekly: `bounds.yml` (the slow limit tests),
`corpus.yml` (rebuilds the C corpus with a cross compiler and qemu, and
replays the `-O2` tiers), and `refresh-stars.yml` (see [DEPLOY.md](DEPLOY.md)).

## Once a term

`emulator/tests/local_corpus.rs` runs every `.asm` and `.s` file in a folder
kept outside the repository, for course programs the repository cannot
include. CI never has that folder. Once a term, refresh it and run:

```bash
LOCAL_CORPUS_DIR=<folder> cargo test --manifest-path emulator/Cargo.toml --test local_corpus -- --nocapture
```

Without `LOCAL_CORPUS_DIR` the suite prints a skip line and passes.
