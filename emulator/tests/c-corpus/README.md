# The C corpus

Fifty small C programs, the assembly gcc generates for them, and the
output a real AArch64 Linux machine produces when it runs them. The
corpus test (`cargo test --test c_corpus`) assembles each program's `.s`
in the emulator, runs it, and requires stdout and the exit code to match
the reference byte for byte. It needs no compiler, no qemu, and no
network: everything it reads is tracked here.

With a reasonably functional libc, gcc can generate an endless supply of
test programs, and a real machine can say what each one must do. The first sweep of this corpus
found a silent wrong-target bug in every dotless conditional branch
(`bne loop`), which is every conditional branch gcc emits.

## Per program

- `NAME.c`: the source
- `NAME.s`: gcc's `-O0` assembly, sanitized (exactly what a student
  could paste into the playground)
- `NAME.out` / `NAME.code`: reference stdout and exit code
- `NAME.O2.s` / `NAME.O2.out` / `NAME.O2.code`: the `-O2` tier, run as an
  ignored coverage map (`cargo test --test c_corpus -- --ignored`). It is
  not a correctness gate, but it holds a recorded floor: 50 of 50 must
  pass, and growth is recorded by raising the floor. The `-O0` tier is
  the gate and all 50 of 50 match
- `NAME.stdin`, `NAME.args`, `NAME.flags`: optional program input,
  arguments, and per-program compile flags

## Where the references came from

The tracked references were produced by gcc 16.2.1 20260819 running
natively on an AArch64 Fedora server (dynamically linked, collected
2026-08-30). `tools/sanitize.py regen` rebuilds everything with a cross
compiler and qemu-user and fails on any drift from the tracked files, so
a toolchain change announces itself; a scheduled workflow runs it weekly.

Exit codes use the shell convention: a program killed by signal N records
128+N (139 for SIGSEGV, 135 for SIGBUS).

Both pending lists in the corpus test are empty: every program assembles
and matches at both tiers. The last two exceptions were `13_float_double`
and `14_float_single`, each waiting at -O2 alone on the vector immediate
gcc zeroes with (`movi d31, #0` and `movi v0.2s, #0`), and both now pass.
The lists stay in the test so a future gap has to be recorded to be
tolerated, and either turns red the day its program starts assembling.

Three programs crash on purpose, and the corpus test asserts the
emulator's own diagnosis instead of an output match:

- `44_null_deref` dereferences NULL. Real hardware dies with SIGSEGV
  (139); the playground halts with its segmentation-fault message.
- `45_misaligned_sp` misaligns the stack pointer before a call. Real
  hardware dies with SIGBUS (135) before any output; qemu-user tolerates
  the misalignment and runs the program to completion. The playground
  deliberately sides with the hardware and halts with its bus-error
  message; `regen` under qemu skips this program's run comparison (the
  divergence is recorded in the script, not rediscovered weekly).
- `46_stack_overflow` recurses without a base case. Real hardware dies
  with SIGSEGV (139); the playground halts with its stack-overflow
  message.

The playground names the fault where the server prints a bare
`Segmentation fault`.

## Adding a program

Drop `NAME.c` (plus `.stdin`/`.args`/`.flags` if it needs them) beside
the others, run `tools/sanitize.py regen --only NAME --write` on a
machine with the cross toolchain, and commit the files it writes. The
corpus test discovers programs by directory scan; no list to edit. Keep
new programs inside the hosted libc surface (the playground's
instruction reference lists it).
