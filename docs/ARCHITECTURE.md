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

Web modules, grouped by domain (tests live under a `test/` tree in each,
mirroring these groups):

```
components/ui/          shared primitives + brand marks
components/chrome/      site shell (nav, footer, drawer, theme, PWA)
components/landing/     home page
components/diagrams/    teaching visuals and interactives
components/learn/       lesson surfaces        components/practice/  exercises
components/reference/   reference surfaces
components/playground/  emulator surface shell (editor, controls, dialogs)
components/panels/      right-tab machine views
lib/emulator/           state hub, backends, replay, decode fields,
                        address bands, flag math
lib/asm/                completion, formatting, hover docs, error explaining
lib/content/            lessons, exercises, reference + pitfall data, schemas
lib/playground/         program delivery, persistence, sharing,
                        workspace bundles, upload guards
lib/hooks/              generic React hooks
lib/terminal/           xterm shell engine     lib/worker/           worker boundary
lib/wasm/, lib/wasm-node/  generated wasm-pack output (gitignored)
```

Emulator modules:

```
registers.rs  X0..X30, SP, PC, NZCV, 32 FP registers (f32 + f64 views)
memory.rs     sparse HashMap of 4 KiB pages
decoder.rs    32-bit word to Instruction
executor.rs   per-instruction semantics + NZCV math
fpu.rs        float compare flags (NZCV for fcmp)
snapshot.rs   step-back ring + named save states
cpu.rs        step / run loop, host stubs, syscalls, VFS, FDs, bounds
argv.rs       argv table + string pool at ARGV_BASE; prepends ./program
assembler.rs  legacy one-pass encoder (bare-metal source)
frontend/     m4 -> lex -> parse -> sections -> link
hosted/       libc stubs + Linux syscalls
errors.rs     EmuError (the assembly-time variants carry the source line)
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
   stdin, VFS, FDs, exit code), and re-maps the baseline stack/code/data
   pages. Then `load_linked_image` (hosted) or `load_program`
   (bare-metal) writes the bytes to the section bases; the hosted loader
   also stashes the `__main_return` sentinel in LR.
5. step / run call `cpu.step()`, which returns a `StepOutcome`
   (`Advance`, `Halted`, `WaitingForInput`, `Sleeping(ns)`,
   `Exited(code)`). The run loop pauses on `WaitingForInput` and resumes
   once `push_stdin` arrives.
6. After each call the backend emits a `StateSnapshot` (see State sync);
   React applies it in one shot.

State lives in Rust. React reads slices through getters after every
mutation and never mirrors CPU state.

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
  -> LinkedImage -> cpu.load_linked_image()
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

The dispatch itself stays a match on the mnemonic, roughly ninety arms
long, on purpose. Each arm carries the constants that mnemonic needs
(opcode bits, an operand-count rule, the flag-setting variant), and a
match whose arms carry constants reads better than a table of function
pointers: the encoder for any instruction is one grep away, and the
compiler still checks it.

## Shared fact tables

A handful of facts used to be spelled out separately in the assembler, the
decoder, the parser, and the linter, which is how the two copies of a fact
drift apart. Each now has one home, and a test walks the table so a row
added in one place cannot be missed in another:

- Condition codes, `registers.rs`: the primary spelling, its aliases, and
  the 4-bit encoding, read by condition parsing, conditional-branch
  dispatch, and the branch recognizer.
- Register aliases, `registers.rs`: `sp`, `xzr`, `wzr`, `fp`, `lr` with the
  register number and width each resolves to, read by the assembler's
  register parser and its addressing-mode recognizer, the pipeline's
  operand classifier, and the linter's reserved-name check.
- Load/store extend keywords, `decoder.rs`: the keyword, its 3-bit option
  field, and whether the index register must be an X. The assembler encodes
  from it and the decoder decodes back through it. The extended-register
  ADD/SUB keywords stay a separate table, because that form deliberately
  skips the width check to match GAS.
- Directive names, `parser.rs`: every spelling the parser recognizes,
  aliases included. Hosted-mode detection now derives its directive set
  from it rather than keeping a second list.
- Access sizes, `decoder.rs`: the 2-bit size field, the access width in
  bytes, and the offset scale that follows from it.
- Floating-point opcode rows, `decoder.rs`: the mnemonic, the opcode field,
  and the operation, for the two-source and one-source families. FMOV and
  FCVT keep their own encoders, since their opcodes are entangled with the
  operand width.

## Decoder

ARMv8 instructions are fixed 32-bit. The decoder is a cascade of
`(word & mask) == pattern` checks, most-specific first, returning a typed
`Instruction`. Verbose but easy to single-step. Scalar FP instructions
carry their width (the ftype field): the S forms compute in f32 and the
D forms in f64, with `fcvt` converting between the two views; compares
dispatch through `fpu.rs` on execution.

## Memory model

`HashMap<u64, Rc<Vec<u8>>>` keyed by 4 KiB page base; the first write to
an address auto-maps its page, and a write to a page a snapshot frame
still shares copies it through `Rc::make_mut`. `Cpu::new` pre-maps the
first code pages, the stack pages below `STACK_BASE`, and one page each
at `.rodata`/`.data`/`.bss`, so no load call allocates mid-call.

`Memory::clear()` unmaps every page, zeroing and parking the buffers no
snapshot still shares in a free list the next `map_page` reuses:
dropping and re-allocating `Vec<u8>` page buffers trips a dlmalloc
invariant on wasm32 that traps in `__rdl_dealloc`. Keep page buffers
`Vec<u8>`-based and avoid dropping them on hot paths.

Unaligned LDR/STR succeed (matching Linux userspace with `SCTLR.A = 0`),
so no access path raises `UnalignedAccess`.

The layout itself is published: the module-level `memoryMap` export in
[`lib.rs`](../emulator/src/lib.rs) returns the address bands in order (the
four section windows, argv, heap, stack, host stubs) as half-open
`[start, end)` rows built from the same constants the loader uses. The
memory panel reads it once at load, so its jump list and its "in .data"
label cannot drift from the bases; a native test pins every row to its
constant.

## Hosted runtime

`SVC #0` reads `x8` and dispatches into
[`hosted/syscalls.rs`](../emulator/src/hosted/syscalls.rs): read, write,
exit, openat, close, lseek, plus the interactive set (ioctl termios,
fcntl O_NONBLOCK, nanosleep, clock_gettime, getrandom). Other syscalls
halt (bare-metal compatibility).

BL/BLR into `[0xFFFF_0000, 0xFFFF_1000)` dispatches the hosted libc:
the stdio family (printf, sprintf, snprintf, scanf, puts, putchar,
getchar, fflush, fopen, fprintf, fgets, fputs, fclose, with `stdin`/
`stdout`/`stderr` as linkable symbols naming loader-written FILE*
words), the string family (strlen, strcmp, strncmp, strcpy, strncpy,
strcat, strchr, strstr, strtok, memset, memcpy, memcmp, memmove),
conversions and ctype (atoi, atof, strtol, abs, labs, isdigit, isalpha,
isspace, toupper, tolower, plus the `__ctype_b_loc` classification table
gcc lowers the is* macros to), the allocator (malloc, free, calloc,
realloc), rand/srand/time/exit/usleep, and the libm subset (sqrt, pow,
sin, cos, tan, log, log10, exp, floor, fabs, fmod), which takes its
arguments in `d0` (and `d1` for pow and fmod) and returns in `d0`.
malloc and friends run over a fixed 16 MiB heap window at `0x0090_0000`
with host-side allocator state, so a stray store cannot corrupt the
free list; a wild or double free halts with a plain message.
Stubs read argument registers per AAPCS64, call into
Rust, write results to `x0`/`d0`, then return via `pc = lr`. `main`
returning (a `ret` with the sentinel in LR) halts the CPU with `x0` as
the exit code.

A hosted call costs three steps on addresses the program does not hold: the
two words of the trampoline, then the synthetic stub. The `hostCallContext`
export reports which call a paused pc sits inside and recovers the call site
from LR-4 for all three, so the stepping UI can name the call and hold its
marker on the `bl`. The recovery has to be dynamic: one trampoline serves
every call site of the same function, so nothing static can say which
`printf` line a pc belongs to.

## Execution bounds

The site runs untrusted programs, so two walls live in the emulator and
hold no matter how the source arrived:

- `cpu::MAX_TOTAL_STEPS` = 10_000_000: cumulative executed-instruction
  ceiling across every `step` and `run_until_break`, persistent until
  load/reset. A runaway loop trips it and halts.
- `memory::MAX_MAPPED_PAGES` = 8192 (32 MiB live): a store that would map a
  new page past the cap faults instead of allocating. Sized so the 8 MiB
  stack (matching the course servers' `ulimit -s`) and the 16 MiB heap
  window can be fully touched together; the ring's frames share pages
  copy-on-write, so the peak is the live cap plus whatever those frames
  still hold of pages the program has since rewritten.

Each abort halts with a plain-language message in the result `error`
field, never a panic.

## Snapshots and save states

`SnapshotRing` (capacity 128) captures a `Snapshot { regs, mem, halted,
blocked, exit_code, stdin, stdin_segments, stdin_closed, vfs, open_files,
next_fd, rand_state, term, heap, strtok_save, stdout_seen, stderr_seen }`
before each `step()`; `step_back()` pops the
newest frame. Recording stops, and the history clears, in raw mode,
while the host pauses the ring, and once the state a frame copies whole
outgrows `MAX_SNAPSHOT_SIDE_BYTES`, so step-back never leaps over an
unrecorded stretch. The stdout and stderr buffers are not rolled back, but
the `stdout_seen` / `stderr_seen` counters beside them are, so the host
trims its transcript back to what the restored frame had shown. Named save
states live in a separate
`HashMap<String, Snapshot>` on the same ring, so a named snapshot
survives stepping while the rolling 128-frame history stays intact.

## State sync

[`use-emulator.ts`](../web/lib/emulator/use-emulator.ts) owns an `EmulatorBackend`
and subscribes via `onSnapshot`. After every state-mutating call the
backend emits a `StateSnapshot` (defined in `worker/protocol.ts`):

- `registers`, `sp`, `pc`, `nzcv`, and `changedRegs` (indices that differ
  from the previous frame)
- `fpRegisters` (`d0`–`d31` as raw IEEE-754 bit patterns) and
  `changedFpRegs`; both empty when the loaded WASM predates the fp
  surface, which the UI feature-detects
- `stdoutDelta`/`stderrDelta`, `exitCode`, `blocked`, `halted`,
  `canStepBack`
- `externalCall`: the hosted call a paused pc sits inside
  (`{ name, callSitePc, callSiteLine }`), or null on the program's own
  instructions; absent on wasm that predates the export. The hook drops it
  while a run is driving and reports the call site as the current line while
  it is set
- `dirtyAddrs`, a flat `[addr, len, ...]` list driving the memory diff
  tint; `vfsFiles` and `savedStates`
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
freeze the UI. The boundary is four files in
[`web/lib/worker/`](../web/lib/worker/): `protocol.ts` (message types),
`emulator.worker.ts` (worker entry, instantiates the emulator and
forwards messages), `client.ts` (`WorkerClient`, which implements
`EmulatorBackend` over the message channel), and `dead-instance.ts` (the
classifier deciding whether a thrown error left the wasm instance
unusable).

`pickBackend()` in [`web/lib/emulator/backend.ts`](../web/lib/emulator/backend.ts) returns a
`WorkerClient` when `Worker` exists, otherwise a `MainThreadBackend`
wrapping the emulator directly. Force the main thread with
`localStorage["aarch64-playground:backend"] = "main"`.

Both hosts drive the same chunked run loop,
[`web/lib/emulator/run-loop.ts`](../web/lib/emulator/run-loop.ts): it runs
the program in 10,000-step chunks, yields after each one, and reads the
pause flag and the machine generation right after every yield. Each host
supplies only its own part: how a chunk's wasm record is coerced, where a
mid-run snapshot goes, and how often one is emitted.

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
- `upload-guard.ts`: size caps for source (1 MB), VFS (4 MiB), and
  bookmark JSON (1 MB) uploads.
- `use-deep-link.ts`: enum check on `?theme`, regex on `?example`, and
  `?embed` honored only when it is exactly `1`.

Security headers (CSP, HSTS, COOP, X-Frame-Options DENY, Referrer-Policy,
Permissions-Policy) are defined in both
[`web/proxy.ts`](../web/proxy.ts) and `vercel.json`, kept in
lockstep so they hold under `next start`, in dev, and on Vercel. The CSP
allow-lists the Vercel analytics and speed-insights endpoints.
`vercel.json` additionally sets immutable cache headers for
`/_next/static/`, `/icons/`, and `*.wasm`, and serves `/sw.js` as
`max-age=0, must-revalidate` so worker updates land immediately.

## PWA and service worker

[`web/app/manifest.ts`](../web/app/manifest.ts) generates the manifest
from the App Router. [`web/public/sw.js`](../web/public/sw.js) splits
fetches: cross-origin or non-GET is network-only; navigations are
network-first, cached per URL, falling back to that URL's own copy and
then the cached `/` shell; `/_next/static/`, `/examples/`, and `/icons/`
serve the cached copy and refresh it in the background (`/examples/`
needs that revalidation because editing a program in place leaves its
path unchanged); everything else is network-first falling back to cache. [`web/components/chrome/RegisterSW.tsx`](../web/components/chrome/RegisterSW.tsx)
registers once via `lib/playground/register-sw.ts`, which no-ops on SSR, non-secure
contexts (except localhost), and browsers without
`navigator.serviceWorker`.

## Error surfaces

1. Assembly/pipeline errors: `EmuError::{AssemblyError, PreprocError,
   ParseError, LinkError}`, each with `original_line`. Shown as a red
   Monaco marker and in the bottom error strip.
2. Runtime errors: `UnknownInstruction`, `MemoryFault`, `StackOverflow`,
   `ArgvTooLarge`, and `RuntimeError` (the hosted runtime's own wording
   for an unsupported syscall or a failing libc stub). Shown in the error
   strip; the CPU is marked halted.
3. WASM load failure: caught in `use-emulator.ts` and shown in place of
   the loading screen.
4. A React render that throws: [`web/app/error.tsx`](../web/app/error.tsx)
   for a route, `global-error.tsx` when the root layout itself fails. Both
   wear the 404's fault-card register, offer a retry, and copy a small
   markdown report (message, digest, route, autosaved source) built with
   `bundleToMarkdown`. Neither holds emulator state.

Rust panics route through `console_error_panic_hook` so the message is
readable in the browser console.

## Testing strategy

- Rust: per-module `#[cfg(test)]` unit tests plus integration suites in
  [`emulator/tests/`](../emulator/tests/) (conformance, acceptance, the
  resource-bound walls, stepping/line-map, external-call context, hosted
  end-to-end, the CPSC 355 corpus, server parity, and the reference drift
  guard).
- Web: a vitest suite across the lib helpers, the hooks, the worker
  protocol, and the input validators.
- WASM end-to-end: [`scripts/verify-corpus.js`](../scripts/verify-corpus.js)
  runs every CPSC 355 example that has a fixture stem under
  `web/public/examples/cpsc355/fixtures/` through a prebuilt node-target
  WASM bundle, asserting stdout and post-run VFS state. Treat it as the
  source of truth for example correctness.

## Gotchas

- Page storage must stay `Vec<u8>`, not `Box<[u8; 4096]>`.
  `Box::new([0u8; 4096])` builds the array on the stack first; on wasm32
  that confuses bundled dlmalloc into an `unreachable` trap in
  `__rdl_dealloc` during `assemble_and_load`.
- `Cpu::reset` calls `self.mem.clear()`, which zeroes and parks reusable
  page buffers rather than re-allocating, and preserves host-stub
  registration so a hosted re-assemble keeps `printf`. Dropping the page
  Vecs hits the same trap.
- `Memory` has a hand-written `Clone` because `SnapshotRing` clones
  memory each step: it copies the `Rc` page handles and drops the recycle
  pool and dirty log, so only a page rewritten while a frame still holds
  it is ever duplicated.

A `RuntimeError: unreachable` on wasm bottoming out in `dlmalloc` /
`RawVecInner::deallocate` is this class of bug.
