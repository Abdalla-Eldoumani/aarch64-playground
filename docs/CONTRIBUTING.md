# Contributing

## Setup

You need:

- **Rust** (stable, installed via rustup) with the `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`. Use rustup, not a standalone package; wasm-pack requires it.
- **wasm-pack**: `cargo install wasm-pack`, or the installer at <https://rustwasm.github.io/wasm-pack/installer/>.
- **Node.js** 20+.
- Optional: `cargo install cargo-watch` for the `npm run dev:all` loop.

First build:

```bash
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

cd ../web
npm install
npm run dev
```

Open <http://localhost:3000>. If "loading emulator..." persists, check the browser console; WASM load errors surface inline, though a stale dev cache can hide them (hard-refresh with Ctrl+Shift+R).

## Layout

- `emulator/`: Rust crate, no browser deps in the core. Compiles to WASM via wasm-pack.
- `web/`: Next.js 16 + React 19 app. Imports the WASM module the crate produces.
- `docs/`: this directory. Design rationale lives here and in `ARCHITECTURE.md`; skim the relevant doc before changing an unfamiliar area.
- `scripts/`: `vercel-build.sh` (Vercel build entrypoint) and `verify-corpus.js` (end-to-end WASM smoke test for the example corpus).

## Day-to-day

From `web/`, `npm run dev:all` runs the full loop: cargo-watch rebuilds the WASM on every change under `emulator/src` and `Cargo.toml`, and Next dev reloads when `web/lib/wasm/` updates. Both run under `concurrently` with color-prefixed output.

```bash
cd web && npm run dev:all
```

Without cargo-watch, rebuild by hand:

```bash
# Rust change: rebuild WASM
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

# Frontend change: next dev (webpack) hot-reloads. TypeScript needs no
# rebuild, but a changed wasm-bindgen public API means regenerating the
# bindings in web/lib/wasm/.
cd ../web && npm run dev
```

Next dev picks up `web/lib/wasm/` automatically; a hard-refresh (Ctrl+Shift+R) sometimes clears the browser's WASM cache. For test commands per change type, see [`TESTING.md`](TESTING.md).

## Workflow and PRs

`main` is the protected trunk. Branch off `main`, push, and open one pull request; the maintainer reviews and merges (squash preferred). There is no long-lived integration branch.

1. Branch with a conventional prefix: `git checkout -b docs/<short-name>` (or `fix/`, `feature/`).
2. One logical change per commit. Messages are one line, lowercase, imperative, three sentences max; match `git log --oneline`.
3. Open a PR with the template and fill the "How to verify" checklist honestly. [`TESTING.md`](TESTING.md) is the canonical command list.

Open an issue first if the change is larger than a single file or touches the assembler/decoder layout. For a first contribution, run a tiny PR (a typo fix) end to end to exercise your build, the template, branch protection, CI, and code-owner review before a real change depends on it.

## Adding a new instruction

1. **Decoder**: in [`emulator/src/decoder.rs`](../emulator/src/decoder.rs), add a branch that recognizes the bit pattern and returns the `Instruction` variant. Test-drive it with a hand-encoded word.
2. **Executor**: in [`emulator/src/executor.rs`](../emulator/src/executor.rs), add the semantics. Route NZCV through `NzcvFlags::set_from_*`; FP arithmetic goes through `fpu.rs`; faults return the right `EmuError`.
3. **Assembler**: in [`emulator/src/assembler.rs`](../emulator/src/assembler.rs), add the mnemonic to the `match` in `encode_line` and implement the encoder (register vs. immediate forms, shifts, the usual ARM64 quirks). Text-only CPSC 355 source flows through [`emulator/src/frontend/pipeline.rs`](../emulator/src/frontend/pipeline.rs) via `lower_operands` into the same backend.
4. **Tests**: each file has a `#[cfg(test)] mod tests`. Add a round-trip test (assemble, run, assert state). If the instruction appears in the corpus, also exercise it through `tests/cpsc355_corpus.rs` or `tests/hosted_end_to_end.rs`.
5. **Docs**: append the mnemonic to [`docs/instruction-reference.md`](instruction-reference.md) and the README's supported-instructions list. For hosted-runtime instructions, also update [`docs/cpsc355-style-guide.md`](cpsc355-style-guide.md). `emulator/tests/reference_consistency.rs` enforces that the reference and the assembler agree.

## Adding a visible feature

Logic (`web/lib/`) is separate from React components (`web/components/`). Write logic as a pure module with tests first, then wire it in.

1. **Pure module**: `web/lib/<feature>.ts` with types and pure functions, plus `web/lib/<feature>.test.ts` (happy path + edge cases). Tests run in jsdom with plain DOM assertions; `@testing-library/jest-dom` is not installed.
2. **Hook** (if it holds React state): `web/lib/use-<feature>.ts`. For localStorage toggles, copy the `useSyncExternalStore` shape from `use-cpsc355-mode.ts` so cross-tab sync works.
3. **Component**: `web/components/<Feature>.tsx`, marked `"use client"` if it uses hooks or browser APIs. Lazy-load heavy components (anything pulling Monaco or xterm) via `next/dynamic` with `ssr: false`.
4. **Wire in**: `web/app/page.tsx` is the orchestrator; render into an existing `*Block` node so the resizable/mobile/two-column layouts pick it up.
5. **Docs**: add a row to `docs/features.md`, and the README if it adds a deep-link param or shortcut.

If the feature accepts external input (URL params, uploads, paste), add a validator in the same PR. See [`security.md`](security.md).

## Code style

**Rust**: doc comments on public functions; `Result<T, EmuError>` for fallible paths; no `unwrap()` outside tests (`expect()` is fine in tests); one module per concern; tests in `#[cfg(test)] mod tests` next to the code.

**TypeScript**: strict mode, no `any`; functional components with hooks; Tailwind for layout, CSS modules only when Tailwind can't; types next to the component that owns them.

**Writing**: plain language, no buzzwords, no emoji in code, comments, docs, or commits. Comments explain why, not what.

## Gotchas

- **WASM page dealloc trap**: `emulator/src/memory.rs` uses `HashMap<u64, Vec<u8>>`, not `HashMap<u64, Box<[u8; 4096]>>`. Don't switch it back: `Box::new([0u8; 4096])` stack-allocates 4 KiB before moving it to the heap, and on wasm32 that confuses the bundled dlmalloc into an `__rdl_dealloc` `unreachable` trap during `assemble_and_load`. Relatedly, `Cpu::reset` calls `self.mem.clear()` (zero-fill in place) instead of re-allocating, and `Cpu::new` pre-maps the first few code pages. A `RuntimeError: unreachable` on wasm bottoming out in `dlmalloc` is this bug.
- **WASM caching in dev**: Next.js hard-caches compiled WASM under `web/.next/`. If a rebuild doesn't take, delete `web/.next/` and restart `npm run dev`.
- **Webpack flag on Next 16**: the `dev` and `build` scripts pass `--webpack` because the build relies on `webpack.experiments.asyncWebAssembly`. Next 16 defaults to Turbopack, whose async-wasm support isn't sufficient yet; removing the flag breaks the build.
- **Root package.json**: the repo-root `package.json` lists `next` only so Vercel's framework detector finds a Next.js dep at the configured root; the real install happens in `web/`. Don't add unrelated deps there, and don't add a `workspaces` field.
- **tsconfig `strict: true`**: add types, don't reach for `any`. Widen a gnarly wasm-bindgen type in `web/lib/emulator.ts`, not at the call site.
- **`next-env.d.ts` drift**: `next dev` and `next build` write slightly different import lines. If CI complains, normalize to the production path (`./.next/types/routes.d.ts`).
- **Multiple Rust installs on Windows**: a standalone MSVC `rustc` ahead of rustup on `PATH` lacks the wasm32 target, so `wasm-pack build` fails with `can't find crate for 'std'` even though `rustup target list --installed` shows wasm32. Uninstall the standalone toolchain, or build with `RUSTC=$(rustup which rustc) wasm-pack build --target web --out-dir ../web/lib/wasm`.
- **AV quarantine on Windows**: some consumer antivirus (seen with AVG 2025) quarantines the `build_script_build-*.exe` cargo emits for `serde_core` in the debug profile, surfacing as `LNK1104: cannot open file ... build_script_build-*.exe`. `cargo test --release --lib` produces unflagged hashes and is the workaround. CI is unaffected.
- **`next lint` is gone in Next 16**: lint runs through ESLint flat config. `web/eslint.config.mjs` re-exports `eslint-config-next`'s flat array plus ignores for `lib/wasm/` and `lib/wasm-node/` (wasm-pack-generated). `npm run lint` runs `eslint .`.
- **Light theme is CSS-var driven**: overrides live under `[data-theme="light"]` in `globals.css`; read `var(--bg-primary)` and friends. Don't hardcode hex.
- **vitest setup**: `web/vitest.setup.ts` stubs `window.matchMedia` (jsdom lacks it). Stub other jsdom gaps there, not at the call site.
- **Worker-first backend**: the emulator runs in a Web Worker by default. `EmulatorBackend` in `web/lib/backend.ts` has `WorkerClient` and `MainThreadBackend` implementations so React doesn't care which is active. Force the main thread via `localStorage.aarch64-playground:backend = "main"`.
- **Service worker skips non-localhost dev**: `register-sw.ts` registers only when `window.isSecureContext` is true or the host is localhost/127.0.0.1. Testing offline over a LAN IP gets no service worker.
- **Toast queue is module-level**: `react-hot-toast` keeps its queue between renders. Tests that mount `<ToastHost>` should match the most-recent toast, not assume a clean slate.

## Questions

File an issue with what you tried (build commands, console output), your OS plus `rustc --version` and `node --version`, and the exact assembly if it's a runtime bug.
