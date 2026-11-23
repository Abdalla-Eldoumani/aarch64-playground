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
- `bounds`: the limits that stop a runaway program, and the caps on the
  stack view's records. Its three slowest tests are ignored on pull requests
  and run weekly in release mode. The m4 budget, the macro warning cap, the
  library-call hand-back and the filled `.space` bound are tested beside
  their code, and `step_back_memory` checks, at the allocator, that the
  step-back history stays in proportion to what its steps wrote.
- `any_word` and `any_source`: seeded tests that nothing makes the emulator
  panic. `any_word` (`emulator/tests/any_word.rs`) sends 500,000 random
  32-bit words through the decoder, one step of the machine, and the
  disassembler. `any_source` (`emulator/tests/any_source.rs`) sends 4,000
  sources up to the editor's 1 MiB cap, a quarter random bytes and the rest
  lines built from the assembler's mnemonics, directives, and library names,
  through the lint, both assemblers, and the loader. An error, a fault, or a
  halt passes; a panic fails and names the seed and the case. The seed is
  fixed, so a rerun repeats every case in order:
  `cargo test --manifest-path emulator/Cargo.toml --test any_word`.

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

On request only, not part of CI. `scripts/parity-sweep.js` runs the programs
the site ships (the examples, the lesson and exercise starters, the reference
and pitfall programs, the home page's program, and the two starters in
[authoring-content.md](authoring-content.md)) in the emulator and with
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

What the comparisons with the course server found, read on 2026-11-23:

- **The site's programs.** The sweep covers 622: 30 examples, 76 lesson
  programs, 71 exercise starters, 370 reference programs, 72 pitfalls, the
  home page's program, and the two starters in
  [authoring-content.md](authoring-content.md). The exercises' hidden
  solutions and the guide's programs are not in it. 621 of the 622 were run
  on the server on 2026-11-06. Here, 616 of those give the same output, exit
  code, and written files, byte for byte, or both sides refuse to build them.
  One terminal game builds on both sides and is not compared. The other 4
  differ, each for a reason the README's list gives: the math functions, a
  `_start` program, an unfinished exercise starter that prints registers it
  never set, and an example whose files define the same names, which GNU m4
  cannot read as one pasted file. The newest example, flappy, has not been
  run on the server yet.
- **C programs.** `c_corpus` holds 101 programs compiled by gcc on the
  server, at three optimization levels. 98 print the server's output and exit
  with its code at every level; the other 3 crash on purpose and must stop
  with the playground's own fault message.
- **Error messages.** `error_parity` holds 15 common mistakes with the
  server's own error on record.
- **Vector instructions.** Each of the 2,208 Advanced SIMD forms in
  `emulator/tests/simd-inventory.txt` assembles to the word GNU `as` gives on
  the server, and the results match the server's in all 6,618 recorded cases
  in `simd-behaviour.txt`.
- **Recorded runs.** 2,224 server runs of programs written for course-style
  exercises, picked because an earlier version of the playground and the
  server disagreed on them, kept outside the repository. 794 now agree: the
  same kind of result (refused when building, refused when linking, crashed,
  ran out of time, or finished) and, for a run that finished, the same output
  and exit code. Most of the rest come from the differences the README lists.

The README's [Known differences from the course server](../README.md#known-differences-from-the-course-server)
lists those differences, each with what to write instead.

## Size and speed

From `web/`, after `npm run build`:

```bash
npm run size
```

It checks each budget in the `size-limit` list in `web/package.json` (the
route chunks, the lazy editor and terminal, the lazy stack frames view, frame
cards, and call card, the emulator's `.wasm`, the stylesheets, and two index
payloads), then runs `scripts/bundle-budget.js` for
the shared chunks the home page and the playground load. That script also
fails when any copy of DOMPurify in the built chunks is older than the version
`overrides` pins in `web/package.json` (docs/security.md, "Dependencies").

`npm run lighthouse` and `npm run lighthouse:mobile` measure a production
server that is already running on <http://localhost:3000> (`npm run start`).
Run each three times and take the median; one run can move several points.
These are unthrottled local numbers, so compare them only with each other.
On Windows, Lighthouse can exit with code 1 after writing its report, when it
cannot delete its temporary Chrome folder; the report is still complete.

`npm run smoke:firefox` opens the playground in Firefox through Playwright,
checks the security headers, and waits for the editor to appear. It opens
`/playground` on the origin in `SITE`, which defaults to
<http://localhost:3000>, so start `npm run start` first:

```bash
npx playwright install firefox
npm run smoke:firefox
```

The first command downloads Playwright's Firefox, once per machine. A local
server logs errors for Vercel's two analytics scripts, which exist only on
Vercel. In Chrome, each script logs a 404 error and a refused-script error.
In Firefox, each logs one blocked-script error, which the smoke test prints
and ignores.

`npm run smoke:browser` drives the playground in Chromium instead, without the
header check: it loads a program from a share link, assembles it, steps five
instructions and reads two registers, runs it to its console output, and opens
a share link with two checks, one right and one wrong, expecting one pass and
one fail. Then it checks the stack frames: it opens the locals example
(`web/public/examples/cpsc355/locals.s`) from a share link, steps to its
`scanf`, types `7 4` into the console, takes one more step, which returns
from `scanf` into `main`, and reads the
stack tab's frames, expecting `a_s = 7` in the box at `fp + 16` and `b_s = 4`
in the box at `fp + 20`, where the course's slides put them. It builds every
link with the site's own share encoder (`web/lib/playground/share.ts`), so a
change to the link format reaches the test. It also fails on any console or
page error except the analytics errors above and a missing favicon, the same
filter the Firefox test uses (`scripts/smoke-noise.mjs`). It reads `SITE` the
same way. With the maintainer's bypass value in the `PROBE_TOKEN` environment
variable, every request the page makes to the site carries it in the
`x-playground-probe` header. The browser's own check for a new service worker
goes without it. So the same test can run against
<https://aarch64-playground.com>, whose firewall answers scripts with a
challenge. The test never prints the value. Run `npx playwright install chromium` first, or set `CHROMIUM_PATH` to
an installed Chromium:

```bash
npm run build
npm run start &
npm run smoke:browser
```

## What CI runs

`.github/workflows/check.yml` runs on every push and pull request to `main` and
`integration`, and weekly. Its jobs start together, and each one first checks
which files changed (`.github/scripts/classify-changes.js`). On a pull request
a job with nothing to check skips its steps and passes. A docs change runs
nothing, except the two docs the tests read. `docs/authoring-content.md` runs
`wasm`, `corpus`, `web-build`, and `web-test`, and
`docs/instruction-reference.md` runs those four and `rust`. A lesson or
example change skips lint and typecheck, and a change under `emulator/tests/`
runs only the Rust jobs, except the error-parity cases, the one corpus
program the web tests read, and `c_corpus.rs` (a web test holds the name
`cargo test` skips to it), which also run `wasm`, `corpus`, `web-build`, and
`web-test`. The three web files the `wasm_codes` test reads,
`web/lib/emulator/call-cards.ts`, `stack-frames.ts` and `clobber-note.ts`,
also run `rust`. A change to
`scripts/vercel-build.sh` runs none of the Rust jobs:
CI never runs that script, `web-static` checks its
toolchain pins against the workflows, and `web-test` runs
`vercel-build.test.ts`, which checks that the script holds every download to
a pinned hash. A change to a workflow, or to a file no
rule names, runs everything, and so do a push to `main`, the weekly run, and
the pull request from `integration` to `main`.
The example catalog, `web/lib/playground/example-catalog.ts`, also runs
`rust`: `frames.rs` and `filler_examples.rs` read its helper lists. So does
the editor's completion list, `web/lib/asm/asm-completion.ts`: `stub_table.rs`
holds its library calls to the stub table.

A push to `integration` runs only `wasm`, `web-build`, and the gate job, which
it names `ci (cache warm-up)`. `wasm` and `web-build` refill the caches that
pull requests into `integration` restore, and `web-build` skips its browser
smoke there. The pull request from `integration`
to `main` tests the same changes, so a push to `integration` with no such pull
request open runs no tests.

- `wasm`: builds both emulator bundles, or restores them from a cache keyed on
  the emulator's sources.
- `rust`: `cargo test` without the C corpus, plus the corpus split across
  three jobs (`CORPUS_SHARD=1/3` and so on).
- `corpus`: `node scripts/verify-corpus.js`, then
  `node scripts/check-course-style.js`, which holds the site's own programs to
  `.balign 4` before each exported function and `ldr xN, =label` for
  addresses.
- `web-static`: a check that the Rust and wasm-pack versions in the workflows
  match the ones `scripts/vercel-build.sh` deploys with
  (`.github/scripts/check-pins.js`), the dependency audit, a check that
  `security.txt` is at least 30 days from its expiry date, `npm run lint`, and
  `npm run typecheck`.
- `web-build`: `npm run build`, a check that the lazy chunks the size budgets
  name (Monaco, its worker, the terminal, xterm, the frames view, the frame
  cards, and the call card) exist, since a budget
  whose files match nothing passes, and `npm run size`. Then, on the same
  build, `next start` and `scripts/browser-smoke.mjs` in Chromium, so any
  change that runs the build runs the smoke too.
- `web-test`: `npm test` split into six shards.
- `coverage`: on pushes to `main`, the weekly run, and the pull request from
  `integration` only, merges the shards' coverage and fails if it drops below
  the floors in `web/vitest.config.mts`.
- `ci`: fails if any job above failed or was cancelled. It is the one check a
  pull request needs to pass.

Three more workflows run weekly: `bounds.yml` (the slow limit tests),
`corpus.yml` (rebuilds the C corpus with a cross compiler and qemu, and
replays the `-O2` tiers), and `refresh-stars.yml` (see [DEPLOY.md](DEPLOY.md)).
`browser.yml` runs every night: the Chromium smoke test and the Firefox one
against a production build, whatever changed.

## Once a term

`emulator/tests/local_corpus.rs` runs every `.asm` and `.s` file in a folder
kept outside the repository, for course programs the repository cannot
include. CI never has that folder. Once a term, refresh it and run:

```bash
LOCAL_CORPUS_DIR=<folder> cargo test --manifest-path emulator/Cargo.toml --test local_corpus -- --nocapture
```

Without `LOCAL_CORPUS_DIR` the suite prints a skip line and passes.
