# Contributing

## Getting set up

You need:

- **Rust** 1.75+ with the `wasm32-unknown-unknown` target.
  `rustup target add wasm32-unknown-unknown`
- **wasm-pack** 0.12+. `cargo install wasm-pack` or use the installer at
  <https://rustwasm.github.io/wasm-pack/installer/>.
- **Node.js** 18+.

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
- `web/` -- Next.js 14 app. Imports the WASM module the crate produces.
- `docs/` -- you are here.
- `scripts/` -- deploy helpers (Vercel entrypoint).

Each workspace has a `CLAUDE.md` with notes aimed at contributors and AI pairs. Read those before making non-obvious changes.

## Day-to-day loop

```bash
# Rust change -> re-run tests
cd emulator
cargo test --lib

# Rust change visible to the browser -> rebuild WASM
wasm-pack build --target web --out-dir ../web/lib/wasm

# Frontend change -> hot-reloads via next dev
# TypeScript changes don't need a rebuild, but if you change the wasm-bindgen
# public API the bindings in web/lib/wasm/ have to be regenerated.
```

The frontend devserver picks up changes to `web/lib/wasm/` automatically, but a hard-refresh (Ctrl+Shift+R) is sometimes needed to bust the browser's WASM cache.

## Adding a new instruction

1. **Decoder** -- in [`emulator/src/decoder.rs`](../emulator/src/decoder.rs), add a branch to the cascade that recognizes the bit pattern and returns a new `Instruction` variant if needed. Test-drive it with a hand-encoded word.
2. **Executor** -- in [`emulator/src/executor.rs`](../emulator/src/executor.rs), add the semantics. If it touches NZCV, go through `NzcvFlags::set_from_*`. If it faults, return the right `EmuError`.
3. **Assembler** -- in [`emulator/src/assembler.rs`](../emulator/src/assembler.rs), add the mnemonic to the big `match` in `encode_line` and implement the encoder function. Handle register vs. immediate forms, shifts, and the usual ARM64 quirks.
4. **Tests** -- each of the four files has a `#[cfg(test)] mod tests`. Add at least one round-trip test (assemble -> run -> assert state).
5. **README** -- append the mnemonic to the supported-instructions section.

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

## Gotchas to know about

- **WASM page dealloc trap** -- `emulator/src/memory.rs` uses `HashMap<u64, Vec<u8>>` instead of `HashMap<u64, Box<[u8; 4096]>>`. Do not "clean up" by changing this back. Full story in `emulator/CLAUDE.md`.
- **WASM caching in dev** -- Next.js hard-caches compiled WASM under `web/.next/`. If a WASM rebuild doesn't take, delete `web/.next/` and restart `npm run dev`.
- **`strict: true` in tsconfig** -- add types, don't sprinkle `any`. If you hit a gnarly wasm-bindgen-generated type, widen it in `web/lib/emulator.ts`, not at the call site.

## Where to ask questions

File an issue. Include:

- what you tried (build commands, browser console output)
- OS + Rust version + Node version (`rustc --version`, `node --version`)
- the exact assembly that triggered it, if it's a runtime bug
