# Contributing

## Set up

Follow the README's [Run it locally](../README.md#run-it-locally). It builds
both copies of the emulator: the one the site loads (`web/lib/wasm/`) and the
Node.js one the tests load (`web/lib/wasm-node/`). Both folders are generated,
so never edit them.

While you work, run the site from `web/` with:

```bash
npm run dev:all
```

It runs the dev server and, if [cargo-watch](https://github.com/watchexec/cargo-watch)
is installed, rebuilds the emulator whenever a file under `emulator/src`
changes. Without cargo-watch it prints how to install it and runs the dev
server alone. Then rebuild by hand after a Rust change, from the repository
root:

```bash
wasm-pack build emulator --target web --out-dir ../web/lib/wasm
```

If a rebuilt emulator does not show up, stop the dev server, delete
`web/.next/`, and start it again.

## Where things live

- `emulator/`: the Rust crate that becomes the WebAssembly emulator. Nothing in
  it depends on a browser, so it builds and tests natively.
- `web/`: the Next.js site.
  - `components/`: React components, grouped by where they appear: `ui/`,
    `chrome/` (the site's frame), `landing/`, `diagrams/`, `learn/`,
    `practice/`, `reference/`, `playground/`, and `panels/` (the machine views
    beside the editor).
  - `lib/`: the logic, grouped the same way: `emulator/` (talking to the
    machine), `asm/` (completion, formatting, hover text, error messages),
    `content/` (lessons, exercises, reference data), `playground/` (loading,
    saving, and sharing programs), `hooks/`, `terminal/`, and `worker/`.
  - `content/`: lessons and exercises as JSON (see
    [authoring-content.md](authoring-content.md)).
  - `public/examples/`: the example programs in the playground's menu.
- `scripts/`: the deploy build, the corpus check, the header check, the
  dependency audit, the size budget, and the parity sweep.
- `docs/`: these docs.
- `tools/`: small course helpers. Nothing there ships or runs in CI.

[ARCHITECTURE.md](ARCHITECTURE.md) explains how the parts talk to each other,
and [features.md](features.md) maps each feature to its files.

## Naming

- A React component file is `PascalCase.tsx` and matches the component it
  exports. It also exports its `Props` interface.
- Every other file is kebab-case: `use-emulator.ts`, `verify-corpus.js`.
- Tests sit in a `test/` folder beside the code, mirroring its groups:
  `web/lib/test/terminal/dispatch.test.ts` tests
  `web/lib/terminal/dispatch.ts`. Two exceptions follow their subject: App
  Router tests sit beside the route file (`web/app/**/*.test.tsx`), and
  `web/next.config.test.ts` sits beside `web/next.config.mjs`.

## Send a change

1. Open an issue first if the change touches more than one file or the
   assembler's layout.
2. Create a branch off `main`, such as `fix/<short-name>`.
3. Make one logical change per commit. A commit message is one lowercase line
   that says what changed, as `git log --oneline` shows.
4. Run the checks in [TESTING.md](TESTING.md#before-you-open-a-pull-request).
5. Open a pull request against `main` and fill in the template's "How to
   verify" list. The maintainer reviews and merges it.

By opening a pull request you agree to license your contribution under
AGPL-3.0, the project's license.

## Add an instruction

1. Take the encoding from GNU `as` on AArch64 Linux, never from the manual or
   from memory. Assemble every spelling you plan to accept, read the words back
   with `objdump -d`, and record them. Advanced SIMD forms are held to
   `emulator/tests/simd-inventory.txt` by `tests/simd.rs`.
2. Decode it: the `Instruction` enum is in `emulator/src/decoder.rs`, and
   each instruction class has its own file in `emulator/src/decoder/`
   (`data_processing.rs`, `load_store.rs`, `branch.rs`, `fp.rs`, `simd.rs`,
   `simd_fp.rs`). Recognize the bit pattern in the class's file and return
   an `Instruction`. Test it with a hand-encoded word in `decoder/tests.rs`.
3. Execute it: add an arm to `execute` in `emulator/src/executor.rs` and the
   semantics in the same class's file in `emulator/src/executor/`. Set the
   flags through `add_flags`, `sub_flags`, `logic_flags`, or `add_with_carry`
   (an instruction with a carry-in needs `add_with_carry`), and return the
   right `EmuError` on a fault.
4. Assemble it: in `emulator/src/assembler.rs`, add the mnemonic to
   `SUPPORTED_MNEMONICS` and to the `match` in `encode_line`, then write the
   encoder in the fitting file in `emulator/src/assembler/` (`arith.rs`,
   `bitwise.rs`, `load_store.rs`, `branch.rs`, `fp.rs`, or one of the
   three `simd` files). An Advanced SIMD
   instruction is usually one row in a table in `decoder/simd.rs` or
   `decoder/simd_fp.rs`, which the encoder, the decoder, and the disassembler
   all read. Course source reaches the same encoder through `lower_operands` in
   `emulator/src/frontend/pipeline.rs`. A vector operand (`v0.16b`,
   `v0.b[3]`) is read by `parse_vec_operand`; a new register spelling also
   goes in `looks_like_register`, `classify_word`,
   `is_register_or_shift_keyword`, and the lint's `is_reserved_name`.
5. Test it: add a unit test that assembles, runs, and checks the result. If gcc
   emits the instruction, the C corpus (`emulator/tests/c-corpus/`) is the
   best end-to-end test.
6. Document it: add a row to [instruction-reference.md](instruction-reference.md),
   the name to `web/lib/asm/mnemonics.ts`, a hover card to
   `web/lib/asm/instruction-docs.ts`, and an entry to
   `web/lib/content/reference-data.ts`. Tests fail until all four agree with
   the assembler. A change to the library calls or system calls also goes in
   [cpsc355-style-guide.md](cpsc355-style-guide.md).

## Add a feature to the site

1. Write the logic as a plain module in `web/lib/<group>/` with its test in
   `web/lib/test/<group>/`. Tests run in jsdom with plain DOM assertions.
2. If it holds React state, add a hook in `web/lib/hooks/`. For state kept in
   localStorage, copy the `useSyncExternalStore` pattern in
   `use-named-saves.ts` so other tabs stay in sync.
3. Add the component in `web/components/<group>/`. Load anything that pulls in
   Monaco or xterm with `next/dynamic`, and keep that `dynamic()` call at
   module level (as in `lazy-editor.tsx` and `lazy-panels.tsx`): a call made
   during render remounts the component and loses its state.
4. Wire it into `EmbeddablePlayground.tsx` or `FullChromeSurface.tsx`, using an
   existing panel slot so the desktop and phone layouts both pick it up.
5. Add a row to [features.md](features.md).

A feature that reads a URL parameter, an upload, or pasted data also needs a
validator in the same pull request. See [security.md](security.md).

## Code style

- Rust: doc comments on public functions, `Result<T, EmuError>` on paths that
  can fail, and no `unwrap()` outside tests. Match the surrounding formatting
  by hand; do not run `cargo fmt`, which rewrites nearly every file.
- TypeScript: strict mode, no `any`, function components, Tailwind for layout.
  Colors come from the theme variables (`var(--bg-base)` and the rest), which
  are written from `web/lib/theme/tokens.ts`, never from a hex value in a
  component.
- Writing: plain words, no emoji. A comment says why, not what.

## Known traps

- Keep emulator memory pages as `Vec<u8>` (`emulator/src/memory.rs`).
  `Box::new([0u8; 4096])` builds the array on the stack first, and on wasm32
  that makes the allocator trap with `unreachable` in `__rdl_dealloc`. For the
  same reason `Cpu::reset` clears pages and reuses them instead of dropping
  them. A `RuntimeError: unreachable` inside `dlmalloc` is this bug.
- `npm run dev` and `npm run build` pass `--webpack`. The emulator loads
  through webpack's `asyncWebAssembly`, and Turbopack, Next's default, cannot
  load it.
- The repository root's `package.json` exists only so Vercel detects a Next.js
  project. Install and build in `web/`, and do not add a `workspaces` field.
- `npm run dev` rewrites `web/next-env.d.ts`. Do not commit that change.
- The emulator runs in a Web Worker, with a main-thread fallback behind the
  same `EmulatorBackend` interface (`web/lib/emulator/backend.ts`). To force
  the main thread, set the localStorage key `aarch64-playground:backend` to
  `main`.
- The service worker registers only on HTTPS or on `localhost`, so a test over
  a LAN address gets no offline support.
- On Windows, a standalone `rustc` ahead of rustup on `PATH` has no wasm32
  target, and `wasm-pack build` fails with `can't find crate for 'std'`. Remove
  it from `PATH`, or build with
  `RUSTC=$(rustup which rustc) wasm-pack build emulator --target web --out-dir ../web/lib/wasm`
  in Git Bash.
- On Windows, some antivirus quarantines the build scripts cargo compiles for
  a debug test run (`LNK1104: cannot open file ... build_script_build-*.exe`).
  Run the tests with `--release` instead.

## Questions

Open an issue with what you ran, what it printed, your OS, and the output of
`rustc --version` and `node --version`. For a wrong result, include the
assembly program.
