# Contributing

## Getting set up

You need:

- **Rust** 1.75+ with the `wasm32-unknown-unknown` target.
  `rustup target add wasm32-unknown-unknown`
- **wasm-pack** 0.12+. `cargo install wasm-pack` or use the installer at
  <https://rustwasm.github.io/wasm-pack/installer/>.
- **Node.js** 20+.
- Optional: `cargo install cargo-watch` if you plan to use the `npm run dev:all` loop.

First build:

```bash
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

cd ../web
npm install
npm run dev
```

Open <http://localhost:3000>. If you see "loading emulator..." for more than a second or two, check the browser console -- WASM load errors are now surfaced inline but a stale dev cache occasionally hides them.

## Layout recap

- `emulator/` -- Rust crate, no browser deps in the core. Compiles to WASM via wasm-pack.
- `web/` -- Next.js 16 + React 19 app. Imports the WASM module the crate produces.
- `docs/` -- you are here.
- `scripts/` -- `vercel-build.sh` (Vercel build entrypoint) and `verify-corpus.js` (end-to-end WASM smoke test for every bare-metal example program).

Every non-obvious design decision is captured either in this directory or in `ARCHITECTURE.md`; skim those before making changes in an unfamiliar area.

## Day-to-day loop

The primary loop is `npm run dev:all` from `web/`. cargo-watch
watches `emulator/src` and `Cargo.toml`, re-runs `wasm-pack build --dev`
on every change, and Next.js dev picks up the new files in
`web/lib/wasm/` and reloads. Both run under `concurrently` with
prefix-colored output so the WASM and web sides are easy to tell apart.

```bash
cd web && npm run dev:all
```

Manual fallback if you don't have cargo-watch installed, or for
one-shot rebuilds:

```bash
# Rust change visible to the browser -> rebuild WASM
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

# Frontend change -> hot-reloads via next dev (webpack, not Turbopack).
# TypeScript changes don't need a rebuild, but if you change the
# wasm-bindgen public API the bindings in web/lib/wasm/ have to be
# regenerated.
cd ../web && npm run dev
```

For the test commands you'd run per change type (Rust unit tests,
verify-corpus, vitest), see [`TESTING.md`](TESTING.md).

The frontend devserver picks up changes to `web/lib/wasm/` automatically, but a hard-refresh (Ctrl+Shift+R) is sometimes needed to bust the browser's WASM cache.

## Your first PR

Before tackling a real feature, do a tiny, low-risk PR end to end.
This verifies your local build, branch and commit conventions, the PR
template, branch protection on `main`, CI, and the code-owner review
wiring -- all at once.

1. Pick something tiny: a typo, a missing word, a clarifying comment.
2. Branch with a conventional prefix: `git checkout -b docs/<short-name>`
   (or `fix/`, `feature/`).
3. Commit per the project style: lowercase imperative, one line, three
   sentences max, one logical change.
4. Push and open a PR using the template; fill the "How to verify"
   checklist honestly. [`TESTING.md`](TESTING.md) is the canonical
   command list.
5. Wait for review. Merge happens after approval; squash is recommended.

Doing this once on a typo fix saves a lot of "wait, why is my PR
blocked?" later when the change actually matters.

## Adding a new instruction

1. **Decoder** -- in [`emulator/src/decoder.rs`](../emulator/src/decoder.rs), add a branch to the cascade that recognizes the bit pattern and returns a new `Instruction` variant if needed. Test-drive it with a hand-encoded word.
2. **Executor** -- in [`emulator/src/executor.rs`](../emulator/src/executor.rs), add the semantics. If it touches NZCV, go through `NzcvFlags::set_from_*`. FP arithmetic dispatches through `fpu.rs`. If it faults, return the right `EmuError`.
3. **Assembler** -- in [`emulator/src/assembler.rs`](../emulator/src/assembler.rs), add the mnemonic to the big `match` in `encode_line` and implement the encoder function. Handle register vs. immediate forms, shifts, and the usual ARM64 quirks. If the instruction is only needed for cpsc 355 source, the frontend pipeline in [`emulator/src/frontend/pipeline.rs`](../emulator/src/frontend/pipeline.rs) funnels text through `lower_operands` into the same backend.
4. **Tests** -- each file has a `#[cfg(test)] mod tests`. Add at least one round-trip test (assemble -> run -> assert state). If the instruction shows up in the tutorial corpus, also exercise it through `tests/cpsc355_corpus.rs` or `tests/hosted_end_to_end.rs`.
5. **Docs** -- append the mnemonic to [`docs/instruction-reference.md`](instruction-reference.md) and the README supported-instructions section. If it's hosted-runtime related, also update [`docs/cpsc355-style-guide.md`](cpsc355-style-guide.md).

## Code style

### Rust

- Doc comments on every public function.
- `Result<T, EmuError>` for fallible operations. No `unwrap()` in production paths (`expect()` is OK in tests).
- Module per concern. Don't introduce sibling modules for a single new function.
- Tests live next to the code in `#[cfg(test)] mod tests` blocks.

### TypeScript

- Strict mode on. No `any`.
- Functional components with hooks. No class components.
- Tailwind for layout and basic styling. CSS modules only when Tailwind can't.
- Types live next to the component that owns them.

### Writing

Plain language. No buzzwords. No emoji in code, comments, docs, or commit messages. Comments explain **why**, not what.

## Commit rules

One logical change per commit. Messages are one line, lowercase, three sentences max. Match the style of recent commits (`git log --oneline`).

## PRs

The project is early. Open an issue first if the change is larger than a single file or touches the assembler/decoder layout. For bug fixes and small additions, a PR with a focused description works.

## Adding a new visible feature

The repo separates pure logic (`web/lib/`) from React components
(`web/components/`). Default to writing logic as a pure module + tests
first, then wire it into a component.

1. **Pure module** -- new `web/lib/<feature>.ts` with TS types and
   exported pure functions. Add `web/lib/<feature>.test.ts` next to
   it covering happy path + edge cases. Tests run in jsdom; use plain
   DOM assertions (no `@testing-library/jest-dom`).
2. **Hook** (if React state is involved) -- `web/lib/use-<feature>.ts`.
   For toggles persisted to localStorage, copy the `useSyncExternalStore`
   shape from `use-cpsc355-mode.ts` so cross-tab sync works.
3. **Component** -- `web/components/<Feature>.tsx`. Mark `"use client"`
   if the component uses hooks or browser APIs. Heavy components
   (anything that pulls Monaco or xterm) should be lazy-loaded via
   `next/dynamic` with `ssr: false` from the parent.
4. **Wire into the page** -- `web/app/page.tsx` is the orchestrator.
   Render the new component into one of the existing `*Block` nodes
   so the resizable / mobile / two-column layouts pick it up
   automatically.
5. **Documentation** -- add a row to `docs/features.md` and, if it
   adds a deep-link param or shortcut, the README and the matching
   `CLAUDE.md`.

If the feature accepts external input (URL params, file uploads,
clipboard paste), add a validator in the same PR. See
[`security.md`](security.md) for the patterns the existing gates
follow.

## Gotchas to know about

- **WASM page dealloc trap** -- `emulator/src/memory.rs` uses `HashMap<u64, Vec<u8>>` instead of `HashMap<u64, Box<[u8; 4096]>>`. Do not "clean up" by changing this back: `Box::new([0u8; 4096])` puts a 4 KiB array on the stack before moving it to the heap, and on wasm32 that confuses the bundled dlmalloc enough that `__rdl_dealloc` hits an `unreachable` trap during `assemble_and_load`. Related: `Cpu::reset` calls `self.mem.clear()` (zero-fills in place) rather than re-allocating, and `Cpu::new` pre-maps the first few code pages for the same reason. If you see `RuntimeError: unreachable` on wasm with a stack that bottoms out in `dlmalloc`, it's this class of bug.
- **WASM caching in dev** -- Next.js hard-caches compiled WASM under `web/.next/`. If a WASM rebuild doesn't take, delete `web/.next/` and restart `npm run dev`.
- **Webpack flag on Next 16** -- the `dev` and `build` npm scripts pass `--webpack` because we rely on `webpack.experiments.asyncWebAssembly`. Next 16 defaults to Turbopack, whose async-wasm story isn't where we need it yet. If you remove the flag, the build fails with a webpack-config warning.
- **Root package.json trick** -- there's a near-empty `package.json` at the repo root listing only `next`. It exists so Vercel's framework detector finds a Next.js dep at the configured Root Directory; the real install happens in `web/`. Don't add unrelated deps to the root manifest.
- **`strict: true` in tsconfig** -- add types, don't sprinkle `any`. If you hit a gnarly wasm-bindgen-generated type, widen it in `web/lib/emulator.ts`, not at the call site.
- **`next-env.d.ts` can drift** -- `next dev` and `next build` each write a slightly different `import "./.next/..."` line. If CI complains, normalize it to the production path (`./.next/types/routes.d.ts`).
- **Multiple Rust installs on Windows** -- if you installed Rust via the standalone MSVC `.msi` alongside rustup, your `PATH` may prefer the standalone `rustc`, which doesn't ship the `wasm32-unknown-unknown` target. The symptom is `wasm-pack build` failing with `can't find crate for 'std'` even though `rustup target list --installed` shows wasm32. Either uninstall the standalone install, or build with `RUSTC=$(rustup which rustc) wasm-pack build --target web --out-dir ../web/lib/wasm`. Vercel CI uses rustup exclusively and isn't affected.
- **AVG / McAfee quarantine of debug build scripts on Windows** -- some consumer AV products (confirmed with AVG 2025) quarantine the `build_script_build-*.exe` cargo produces for `serde_core` in the dev profile, which shows up as `LNK1104: cannot open file ... build_script_build-*.exe`. `cargo test --release --lib` produces different hashes that aren't flagged, and is the recommended local test command on affected machines. CI is unaffected.
- **`next lint` is gone in Next 16** -- we migrated to ESLint flat config. The `web/eslint.config.mjs` re-exports `eslint-config-next`'s own flat-config array plus ignore blocks for `lib/wasm/` and `lib/wasm-node/` (wasm-pack-generated JS that isn't ours to lint). `npm run lint` now invokes `eslint .` directly.
- **Heavy components are lazy-loaded** -- CToAsmView, DiffView, CommandPalette, and TutorialRunner are all loaded via `next/dynamic` with `ssr: false` so the initial bundle stays small. When adding a panel that pulls in Monaco or a hefty dep, match this pattern.
- **Light theme is CSS-var driven** -- overrides live under `[data-theme="light"]` in `globals.css`; every component reads `var(--bg-primary)` etc. Don't hardcode hex colors.
- **vitest setup file** -- `web/vitest.setup.ts` stubs `window.matchMedia` because jsdom doesn't ship it. Anything else jsdom is missing should be stubbed there too rather than at the call site.
- **Worker-first backend** -- the WASM emulator runs in a Web Worker by default. The `EmulatorBackend` interface in `web/lib/backend.ts` has two implementations (`WorkerClient` + `MainThreadBackend`) so React doesn't know or care which is active. Force the main thread for debugging via `localStorage.aarch64-playground:backend = "main"`.
- **Service worker is no-op in dev outside localhost** -- `register-sw.ts` only registers when `window.isSecureContext` is true (or hostname is localhost / 127.0.0.1). If you're testing offline behavior over LAN IP, expect no SW.
- **Toast queue is module-level** -- `react-hot-toast` keeps its own queue between renders. Tests that mount `<ToastHost>` should match the most-recent toast text and not assume a clean slate.

## Where to ask questions

File an issue. Include:

- what you tried (build commands, browser console output)
- OS + Rust version + Node version (`rustc --version`, `node --version`)
- the exact assembly that triggered it, if it's a runtime bug
