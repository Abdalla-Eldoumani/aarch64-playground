# Contributing

## Setup

You need:

- **Rust** (stable, installed via rustup) with the `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`. Use rustup, not a standalone package; wasm-pack requires it.
- **wasm-pack**: `cargo install wasm-pack`, or the installer at <https://wasm-bindgen.github.io/wasm-pack/installer/>.
- **Node.js** 24 or newer (`web/package.json` enforces the floor through `engines`).
- Optional: `cargo install cargo-watch` enables the WASM auto-rebuild half of `npm run dev:all` (without it, `dev:all` still runs the web dev server).

First build:

```bash
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

# the node-target build that `npm test` and scripts/verify-corpus.js load
wasm-pack build --target nodejs --out-dir ../web/lib/wasm-node

cd ../web
npm install
npm run dev
```

Open <http://localhost:3000>. If "loading emulator..." persists, check the browser console; WASM load errors surface inline, though a stale dev cache can hide them (hard-refresh with Ctrl+Shift+R).

## Layout

- `emulator/`: Rust crate, no browser deps in the core. Compiles to WASM via wasm-pack.
- `web/`: Next.js 16 + React 19 app. Imports the WASM module the crate produces.
- `docs/`: this directory. Design rationale lives here and in `ARCHITECTURE.md`; skim the relevant doc before changing an unfamiliar area.
- `scripts/`: build and audit helpers (`vercel-build.sh`, `verify-corpus.js`, `check-headers.js`, `audit-deps.js`, `bundle-budget.js`, `firefox-smoke.mjs`, `wasm-watch.mjs`).
- `tools/`: course helper utilities that are not part of the app or its build (nothing here ships, runs in CI, or is imported by `web/` or `emulator/`).

### Inside `web/`

Components and client logic are grouped by domain so a change lands in an
obvious place and a newcomer can navigate by directory name alone:

- `web/components/`: one React component per file, grouped by surface:
  - `ui/` shared primitives and brand marks (Button, Select, Tabs, Kicker, ...)
  - `chrome/` the site shell (nav, footer, drawer, theme control, PWA bits)
  - `landing/` the home page (hero, feature catalog, die floorplan)
  - `diagrams/` teaching visuals and interactives (bit fields, register files, frame walk, stack alignment)
  - `learn/`, `practice/`, `reference/` the three reading surfaces
  - `playground/` the emulator surface shell (embeddable playground, editor, controls, dialogs)
  - `panels/` the right-tab machine views (registers, memory, stack, console, terminal, watches, converter, saves)
  - `test/` every component test, mirroring the groups above (`test/panels/RegisterPanel.test.tsx`)
- `web/lib/`: client logic, kebab-case one-purpose modules, grouped the same way:
  - `emulator/` talking to the machine (the state hub, backends, replay, decode fields)
  - `asm/` the assembly-language surface (completion, formatting, hover docs, error explaining)
  - `content/` authored lessons, exercises, reference and pitfall data, schemas, site metadata
  - `playground/` program delivery, workspace persistence, sharing, upload guards
  - `hooks/` generic React hooks (`use-emulator` stays in `emulator/` with the machine glue it drives)
  - `terminal/`, `worker/` the shell engine and the Web Worker boundary
  - `test/` every lib test, mirroring the groups (`test/terminal/dispatch.test.ts`)
  - `wasm/`, `wasm-node/` generated wasm-pack output (gitignored; never edit)

### Naming conventions

- Component files are `PascalCase.tsx`, matching the exported component,
  which is the React and Next.js community standard, so a file name is the
  symbol you import.
- A component's `Props` interface is exported alongside it even when
  nothing imports it yet: the export is the component's public shape, and
  keeping the convention uniform beats auditing which ones happen to have
  external consumers today.
- Everything else (lib modules, scripts, docs) is lowercase kebab-case
  (`use-emulator.ts`, `verify-corpus.js`): dashes are the least ambiguous
  word separator in URLs and shells (no escaping, no case-sensitivity
  traps across macOS/Windows/Linux filesystems), which is why it is the
  prevailing convention for non-component files in web projects.
- Directories are short lowercase nouns. Tests live under a `test/` tree
  beside the code they cover, in the same group as their subject, so the
  source directories stay browsable. Two placements are sanctioned
  exceptions, both because the subject itself lives outside the grouped
  tree:
  - App Router files (pages, layouts, error boundaries, the sitemap) keep
    their tests colocated as `web/app/**/*.test.ts(x)`, because the router
    fixes where the subject file sits and there is no group to mirror it
    into.
  - `web/next.config.test.ts` sits beside `web/next.config.mjs` at the web
    root, because the config is a root-level framework file and its test also
    reads `../vercel.json` to hold the two header sets in lockstep; the vitest
    `include` in `web/vitest.config.mts` carries a `*.test.ts` entry so the
    runner still finds it.

## Day-to-day

From `web/`, `npm run dev:all` runs the full loop: cargo-watch rebuilds the WASM on every change under `emulator/src` and `Cargo.toml`, and Next dev reloads when `web/lib/wasm/` updates. Both run under `concurrently` with color-prefixed output. When cargo-watch is not installed, `dev:all` prints the install hint and runs the web dev server alone.

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

By opening a pull request you agree that your contribution is licensed under AGPL-3.0, the same license as the rest of the project.

## Adding a new instruction

0. **Ground truth first**: never derive a bit layout from the manual or from memory. Assemble a probe of every spelling you plan to accept on the course server (`as` on csarm), read the words back with `objdump -d`, and pin each `spelling => 0xWORD` row in `emulator/tests/simd-inventory.txt` (or the equivalent fixture for the family) BEFORE you write the encoder. `tests/simd.rs` then holds the encoder to that capture in both directions, and a form the inventory does not carry is a form nobody has checked.
0b. **Vector syntax**: a `v` register carries its arrangement or its lane in one token (`v0.16b`, `v0.b[3]`). The lexer keeps the whole spelling together, because split apart `16b` reads as an integer literal and the `.` as the current-address symbol; `assembler::parse_vec_operand` is the one reader of that text and every vector encoder goes through it. Anything that has to tell a register from an immediate (`looks_like_register`, `classify_word`, `is_register_or_shift_keyword`, the lint's `is_reserved_name`) knows the `v` names too, so add new spellings to all of them together.
1. **Decoder**: in [`emulator/src/decoder.rs`](../emulator/src/decoder.rs), add a branch that recognizes the bit pattern and returns the `Instruction` variant. Test-drive it with a hand-encoded word.
2. **Executor**: in [`emulator/src/executor.rs`](../emulator/src/executor.rs), add the semantics. Route NZCV through the `add_flags` / `sub_flags` / `logic_flags` / `add_with_carry` helpers at the top of the same file (a carry-in instruction needs `add_with_carry`: the add and sub helpers assume a fixed carry-in and give the wrong C); FP arithmetic lives in `executor.rs` beside the rest (`fpu.rs` holds only the `FCMP` flag rule); faults return the right `EmuError`.
3. **Assembler**: in [`emulator/src/assembler.rs`](../emulator/src/assembler.rs), add the mnemonic to `SUPPORTED_MNEMONICS` and to the `match` in `encode_line`, then implement the encoder (register vs. immediate forms, shifts, the usual ARM64 quirks). Text-only CPSC 355 source flows through [`emulator/src/frontend/pipeline.rs`](../emulator/src/frontend/pipeline.rs) via `lower_operands` into the same backend.
4. **Tests**: each file has a `#[cfg(test)] mod tests`. Add a round-trip test (assemble, run, assert state). If gcc emits the instruction, the C corpus (`tests/c_corpus.rs` over `tests/c-corpus/`) is the natural end-to-end home; `tests/hosted_end_to_end.rs` covers hand-built cases.
5. **Docs**: append the mnemonic to [`docs/instruction-reference.md`](instruction-reference.md), and add its hover card in `web/lib/asm/instruction-docs.ts` with the matching `/reference` entry in `web/lib/content/reference-data.ts` (kept in sync by the reference-encoding test and `emulator/tests/reference_consistency.rs`). For hosted-runtime instructions, also update [`docs/cpsc355-style-guide.md`](cpsc355-style-guide.md).

## Adding a visible feature

Logic (`web/lib/`) is separate from React components (`web/components/`). Write logic as a pure module with tests first, then wire it in.

1. **Pure module**: `web/lib/<group>/<feature>.ts` with types and pure functions, plus its test at `web/lib/test/<group>/<feature>.test.ts` (happy path + edge cases). Tests run in jsdom with plain DOM assertions; `@testing-library/jest-dom` is not installed.
2. **Hook** (if it holds React state): `web/lib/hooks/use-<feature>.ts`. For localStorage-backed state, copy the `useSyncExternalStore` shape from `use-named-saves.ts` so cross-tab sync works.
3. **Component**: `web/components/<group>/<Feature>.tsx`, marked `"use client"` if it uses hooks or browser APIs. Lazy-load heavy components (anything pulling Monaco or xterm) via `next/dynamic` with `ssr: false`, and keep the `dynamic()` call at module scope in a file of its own (`lazy-editor.tsx`, `lazy-panels.tsx`): a call re-evaluated on each render hands React a new component type and remounts the component, losing its state.
4. **Wire in**: `web/components/playground/EmbeddablePlayground.tsx` orchestrates the emulator surface (`web/app/playground/page.tsx` mounts it) and hands the full playground's own chrome to `FullChromeSurface.tsx`, which loads dynamically so the landing hero never ships it. Render into one of their existing panel slots so the resizable and mobile layouts pick it up.
5. **Docs**: add a row to `docs/features.md`, and the README if it adds a deep-link param or shortcut.

If the feature accepts external input (URL params, uploads, paste), add a validator in the same PR. See [`security.md`](security.md).

## Code style

**Rust**: doc comments on public functions; `Result<T, EmuError>` for fallible paths; no `unwrap()` outside tests (`expect()` is fine in tests); one module per concern; tests in `#[cfg(test)] mod tests` next to the code.

**TypeScript**: strict mode, no `any`; functional components with hooks; Tailwind for layout, CSS modules only when Tailwind can't; types next to the component that owns them.

**Writing**: plain language, no buzzwords, no emoji in code, comments, docs, or commits. Comments explain why, not what.

## Gotchas

- **WASM page dealloc trap**: `emulator/src/memory.rs` holds pages as `HashMap<u64, Rc<Vec<u8>>>` (the `Rc` lets snapshot frames share buffers copy-on-write), not `HashMap<u64, Box<[u8; 4096]>>`. Don't switch it back: `Box::new([0u8; 4096])` stack-allocates 4 KiB before moving it to the heap, and on wasm32 that confuses the bundled dlmalloc into an `__rdl_dealloc` `unreachable` trap during `assemble_and_load`. Relatedly, `Cpu::reset` calls `self.mem.clear()`, which zeroes and parks reusable buffers in a recycle pool instead of dropping them, and `Cpu::new` pre-maps the first few code pages. A `RuntimeError: unreachable` on wasm bottoming out in `dlmalloc` is this bug.
- **WASM caching in dev**: Next.js hard-caches compiled WASM under `web/.next/`. If a rebuild doesn't take, delete `web/.next/` and restart `npm run dev`.
- **Webpack flag on Next 16**: the `dev` and `build` scripts pass `--webpack` because the build relies on `webpack.experiments.asyncWebAssembly`. Next 16 defaults to Turbopack, whose async-wasm support isn't sufficient yet; removing the flag breaks the build.
- **Root package.json**: the repo-root `package.json` lists `next` only so Vercel's framework detector finds a Next.js dep at the configured root; the real install happens in `web/`. Don't add unrelated deps there, and don't add a `workspaces` field.
- **tsconfig `strict: true`**: add types, don't reach for `any`. Widen a gnarly wasm-bindgen type in `web/lib/emulator/emulator.ts`, not at the call site.
- **`next-env.d.ts` drift**: `next dev` and `next build` write slightly different import lines. If CI complains, normalize to the production path (`./.next/types/routes.d.ts`).
- **Multiple Rust installs on Windows**: a standalone MSVC `rustc` ahead of rustup on `PATH` lacks the wasm32 target, so `wasm-pack build` fails with `can't find crate for 'std'` even though `rustup target list --installed` shows wasm32. Uninstall the standalone toolchain, or build with `RUSTC=$(rustup which rustc) wasm-pack build --target web --out-dir ../web/lib/wasm`.
- **AV quarantine on Windows**: some consumer antivirus (seen with AVG 2025) quarantines the `build_script_build-*.exe` cargo emits for `serde_core` in the debug profile, surfacing as `LNK1104: cannot open file ... build_script_build-*.exe`. `cargo test --release --lib` produces unflagged hashes and is the workaround. CI is unaffected.
- **`next lint` is gone in Next 16**: lint runs through ESLint flat config. `web/eslint.config.mjs` re-exports `eslint-config-next`'s flat array plus ignores for `lib/wasm/`, `lib/wasm-node/` (wasm-pack-generated), and `coverage/`. `npm run lint` runs `eslint .`.
- **Light theme is CSS-var driven**: overrides live under `[data-theme="light"]` in `globals.css`; read `var(--bg-primary)` and friends. Don't hardcode hex.
- **vitest setup**: `web/vitest.setup.ts` stubs `window.matchMedia` (jsdom lacks it). Stub other jsdom gaps there, not at the call site.
- **Worker-first backend**: the emulator runs in a Web Worker by default. The `EmulatorBackend` interface in `web/lib/emulator/backend.ts` is implemented by `MainThreadBackend` there and by `WorkerClient` in `web/lib/worker/client.ts`; `pickBackend()` chooses, so React doesn't care which is active. Force the main thread via `localStorage.aarch64-playground:backend = "main"`.
- **Service worker skips non-localhost dev**: `register-sw.ts` registers only when `window.isSecureContext` is true or the host is localhost/127.0.0.1. Testing offline over a LAN IP gets no service worker.
- **Toast queue is module-level**: `react-hot-toast` keeps its queue between renders. Tests that mount `<ToastHost>` should match the most-recent toast, not assume a clean slate.

## Questions

File an issue with what you tried (build commands, console output), your OS plus `rustc --version` and `node --version`, and the exact assembly if it's a runtime bug.
