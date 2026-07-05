# Architecture

aarch64-playground is a fully client-side study site for CPSC 355: a
landing page plus the `/playground` debugger and the `/learn`,
`/practice`, and `/reference` content pages. There is no server runtime.
A hand-written Rust AArch64 interpreter, compiled to WASM, does the work
in the browser tab.

## Monorepo shape

Two workspaces:

- `web/`: Next.js 16 (App Router) + React 19 frontend. Monaco editor,
  resizable panels (registers, memory, stack, console, terminal, watches,
  base converter, memory watches, saves), command palette, tutorial
  runner, share links.
- `emulator/`: the Rust crate `aarch64-emulator`, compiled to WASM with
  wasm-pack. Output lands in `web/lib/wasm/` (gitignored).

Emulator modules:

```
registers.rs  X0..X30, SP, PC, NZCV, 32 FP registers
memory.rs     sparse HashMap of 4 KiB pages
decoder.rs    32-bit word to Instruction
executor.rs   per-instruction semantics + NZCV math
fpu.rs        f64 compare flags (NZCV for fcmp)
snapshot.rs   step-back ring + named save states
cpu.rs        step / run loop, host stubs, syscalls, VFS, FDs, bounds
assembler.rs  legacy one-pass encoder (bare-metal source)
frontend/     m4 -> lex -> parse -> sections -> link
hosted/       libc stubs + Linux syscalls
errors.rs     EmuError (each variant carries the source line)
lib.rs        #[wasm_bindgen] API
```

The emulator depends on nothing browser-specific. The wasm-bindgen
wrappers in `lib.rs` are the only place the Rust side touches JS types;
everything else compiles and tests on native.

## Execution flow

1. The user types assembly in Monaco and clicks assemble.
2. `use-emulator.ts` calls `backend.assemble(source, args)`, which reaches
   Rust `Emulator::assemble_and_load` in
   [`lib.rs`](../emulator/src/lib.rs).
3. Source with `.global main`, a `.data`/`.rodata` section, or a host-stub
   reference runs the frontend pipeline (`m4 -> lex -> parse -> sections
   -> link -> encode`); everything else runs the legacy assembler in
   [`assembler.rs`](../emulator/src/assembler.rs).
4. `cpu.reset()` zeroes registers, clears the runtime tables (stdout,
   stdin, VFS, FDs, exit code), zero-fills mapped pages in place, and
   stashes the `__main_return` sentinel in LR. Then `load_sections`
   (hosted) or `load_program` (bare-metal) writes bytes to the section
   bases.
5. step / run call `cpu.step()`, which returns a `StepOutcome`
   (`Advance`, `Halted`, `WaitingForInput`, `Exited(code)`). The run loop
   pauses on `WaitingForInput` and resumes once `push_stdin` arrives.
6. After each call the backend emits a `StateSnapshot` (see State sync);
   React applies it in one shot.

Cardinal rule: state lives in Rust. React reads slices through getters
after every mutation and never mirrors CPU state.

## Frontend pipeline (hosted CPSC 355 source)

```
source
  -> m4.rs      expand define(NAME, BODY); record name=expr per offset
  -> lexer.rs   tokens carrying original_line
  -> parser.rs  one statement per line: directive | instruction
                | label | assignment
  -> sections   group items by section (.text/.rodata/.data/.bss)
  -> pipeline.rs (link): place labels at section offsets; two passes
     resolve forward references; size the `ldr xN, =expr` literal pool;
     plant a per-libc BL trampoline in .text so `bl printf` reaches the
     host stub at 0xFFFF_0000; lower aliases and fold constants, then
     encode each line via assembler::encode_line_absolute
  -> Vec<Section> -> cpu.load_sections()
```

Every pipeline error carries `original_line`, so the Monaco marker lands
on the pre-m4 line the student wrote.

## Legacy assembler

The bare-metal path uses the one-pass `assembler::assemble`: collect
labels, then encode per mnemonic. Pseudo-instructions are rewritten in
the encoder (MOV to MOVZ/MOVK or ORR, CMP/CMN/TST to the flag-setting
SUBS/ADDS/ANDS against XZR, NEG/MVN to SUB/ORN against XZR, CSET to
CSINC, LSL/LSR/ASR immediates to UBFM/SBFM); CBZ/CBNZ and TBZ/TBNZ are
first-class. This keeps the executor to canonical encodings only.

## Decoder

ARMv8 instructions are fixed 32-bit. The decoder is a cascade of
`(word & mask) == pattern` checks, most-specific first, returning a typed
`Instruction`. Verbose but easy to single-step. FP ops dispatch through
`fpu.rs` on execution.

## Memory model

`HashMap<u64, Vec<u8>>` keyed by 4 KiB page base; the first write to an
address auto-maps its page. `Cpu::new` pre-maps the first code pages, the
stack pages below `STACK_BASE`, and one page each at `.rodata`/`.data`/
`.bss`, so no load call allocates mid-call.

`Memory::clear()` zero-fills existing pages in place instead of dropping
them: dropping and re-allocating `Vec<u8>` page buffers trips a dlmalloc
invariant on wasm32 that traps in `__rdl_dealloc`. Keep page buffers
`Vec<u8>`-based and avoid dropping them on hot paths.

Unaligned LDR/STR succeed (matching Linux userspace with `SCTLR.A = 0`);
only the exclusive-access paths still raise `UnalignedAccess`.

## Hosted runtime

`SVC #0` reads `x8` and dispatches into
[`hosted/syscalls.rs`](../emulator/src/hosted/syscalls.rs): read, write,
exit, openat, close, lseek. Other syscalls halt (bare-metal
compatibility).

BL/BLR into `[0xFFFF_0000, 0xFFFF_1000)` dispatches the hosted libc
(printf, scanf, puts, putchar, getchar, strlen, strcmp, strcpy, memset,
memcpy, exit, atof). Stubs read argument registers per AAPCS64, call into
Rust, write results to `x0`/`d0`, then return via `pc = lr`. `main`
returning (a `ret` with the sentinel in LR) halts the CPU with `x0` as
the exit code.

## Execution bounds

The site runs untrusted programs, so two walls live in the emulator and
hold no matter how the source arrived:

- `cpu::MAX_TOTAL_STEPS` = 10_000_000: cumulative executed-instruction
  ceiling across every `step` and `run_until_break`, persistent until
  load/reset. A runaway loop trips it and halts.
- `memory::MAX_MAPPED_PAGES` = 1024 (4 MiB live): a store that would map a
  new page past the cap faults instead of allocating. Kept low because
  the snapshot ring clones every live page each step.

Each abort is a calm halt with a plain-language message in the result
`error` field, never a panic.

## Snapshots and save states

`SnapshotRing` (capacity 128) captures a `Snapshot { regs, mem, halted,
blocked, exit_code, stdin, vfs, open_files, next_fd }` before each
`step()`; `step_back()` pops the newest frame. Stdout and stderr are not
rolled back. Named save states live in a separate
`HashMap<String, Snapshot>` on the same ring, so a named snapshot
survives stepping while the rolling 128-frame history stays intact.

## State sync

[`use-emulator.ts`](../web/lib/use-emulator.ts) owns an `EmulatorBackend`
and subscribes via `onSnapshot`. After every state-mutating call the
backend emits a `StateSnapshot` (defined in `worker/protocol.ts`):

- `registers`, `sp`, `pc`, `nzcv`, and `changedRegs` (indices that differ
  from the previous frame)
- `stdoutDelta`/`stderrDelta`, `exitCode`, `blocked`, `halted`,
  `canStepBack`
- `pcTrace`, `dirtyAddrs`, and `changedMem` for the memory cache;
  `vfsFiles` and `savedStates`
- `frame`: a monotonic counter the React side uses to invalidate caches

The hook applies each snapshot in one shot and keeps its own step
counter. During `runUntilBreak` the worker emits heartbeat snapshots
about every 50 ms (gated on `performance.now()`) so the UI stays live.
The memory cache lives in a ref keyed by `${addr}:${len}` and clears on
each fresh `frame`; panels call the synchronous `getMemory(addr, len)`,
and a miss kicks off an async fetch that bumps a tick to re-render once
bytes arrive.

## Worker layer

The WASM module runs in a Web Worker by default so tight run loops do not
freeze the UI. The boundary is three files in
[`web/lib/worker/`](../web/lib/worker/): `protocol.ts` (message types),
`emulator.worker.ts` (worker entry, instantiates the emulator and
forwards messages), and `client.ts` (`WorkerClient`, which implements
`EmulatorBackend` over the message channel).

`pickBackend()` in [`web/lib/backend.ts`](../web/lib/backend.ts) returns a
`WorkerClient` when `Worker` exists, otherwise a `MainThreadBackend`
wrapping the emulator directly. Force the main thread with
`localStorage["aarch64-playground:backend"] = "main"`.

## Security gates

URL-borne and file-borne payloads pass typed validators before any field
reaches React, the editor, or the emulator (full caps in
[`docs/security.md`](security.md)):

- `diagnostic-bundle.ts::decodeBundle`: per-field type check + 1 MB
  decompressed cap on `?bundle=<lz>`.
- `share.ts::readShareHash`: per-field type check + 1 MB decompressed cap
  on `#p2=<lz>` and `#p=`.
- `named-saves.ts::isValidSave`: per-field type check on bookmark JSON;
  collisions are skipped, not overwritten.
- `upload-guard.ts`: size caps for source (4 MB), VFS (16 MB), and
  bookmark JSON (1 MB) uploads.
- `use-deep-link.ts`: enum checks on `?theme`/`?view`, regex on
  `?example`.

Security headers (CSP, HSTS, COOP, X-Frame-Options DENY, Referrer-Policy,
Permissions-Policy) are defined in both
[`web/middleware.ts`](../web/middleware.ts) and `vercel.json`, kept in
lockstep so they hold under `next start`, in dev, and on Vercel. The CSP
allow-lists the Vercel analytics and speed-insights endpoints.
`vercel.json` additionally sets immutable cache headers for
`/_next/static/`, `/icons/`, and `*.wasm`, and serves `/sw.js` as
`max-age=0, must-revalidate` so worker updates land immediately.

## PWA and service worker

[`web/app/manifest.ts`](../web/app/manifest.ts) generates the manifest
from the App Router. [`web/public/sw.js`](../web/public/sw.js) splits
fetches: cross-origin or non-GET is network-only; navigations are
network-first falling back to cached `/`; `/_next/static/`, `/examples/`,
and `/icons/` are cache-first; everything else is network-first falling
back to cache. [`web/components/RegisterSW.tsx`](../web/components/RegisterSW.tsx)
registers once via `lib/register-sw.ts`, which no-ops on SSR, non-secure
contexts (except localhost), and browsers without
`navigator.serviceWorker`.

## Error surfaces

1. Assembly/pipeline errors: `EmuError::{AssemblyError, PreprocError,
   ParseError, LinkError}`, each with `original_line`. Shown as a red
   Monaco marker and in the bottom error strip.
2. Runtime errors: `UnknownInstruction`, `MemoryFault`, `UnalignedAccess`
   (exclusive-access only), `InvalidRegister`, `UnsupportedSyscall`.
   Shown in the error strip; the CPU is marked halted.
3. WASM load failure: caught in `use-emulator.ts` and shown in place of
   the loading screen.

Rust panics route through `console_error_panic_hook` so the message is
readable in the browser console.

## Testing strategy

- Rust: per-module `#[cfg(test)]` unit tests plus integration suites in
  [`emulator/tests/`](../emulator/tests/) (conformance, acceptance, the
  resource-bound walls, stepping/line-map, hosted end-to-end, the
  CPSC 355 corpus, and the reference drift guard).
- Web: a vitest suite across the lib helpers, the hooks, the worker
  protocol, and the input validators.
- WASM end-to-end: [`scripts/verify-corpus.js`](../scripts/verify-corpus.js)
  builds a Node-target WASM bundle and runs every bare-metal example in
  `web/public/examples/` through it, asserting post-halt register and
  memory state. Treat it as the source of truth for example correctness.

## Gotchas

- Page storage must stay `Vec<u8>`, not `Box<[u8; 4096]>`.
  `Box::new([0u8; 4096])` builds the array on the stack first; on wasm32
  that confuses bundled dlmalloc into an `unreachable` trap in
  `__rdl_dealloc` during `assemble_and_load`.
- `Cpu::reset` calls `self.mem.clear()` (zero-fill in place) rather than
  re-allocating, and preserves host-stub registration so a hosted
  re-assemble keeps `printf`. Dropping the page Vecs hits the same trap.
- `Memory` derives `Clone` because `SnapshotRing` clones all memory each
  step. The dlmalloc rule still holds: clone into a fresh `Vec<u8>` per
  page.

A `RuntimeError: unreachable` on wasm bottoming out in `dlmalloc` /
`RawVecInner::deallocate` is this class of bug.
