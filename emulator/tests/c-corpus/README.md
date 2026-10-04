# The C corpus

A hundred and one small C programs, the assembly gcc generates for them
at three optimization levels, and the output a real AArch64 Linux
machine produces when it runs them. The
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
- `NAME.O2.s` / `NAME.O2.out` / `NAME.O2.code`: `-O2` with the corpus
  flags (`-fno-inline -fno-builtin`), so printf stays printf and every
  function stays a call
- `NAME.O2plain.s` / `.out` / `.code`: plain `-O2`, the way a real build
  compiles: printf becomes puts or putchar, small functions inline away,
  loops vectorize, and libc calls such as `fwrite`, `putc` and `sincos`
  appear that the C never wrote
- `NAME.stdin`, `NAME.args`, `NAME.flags`: optional program input,
  arguments, and per-program compile flags

The `-O0` tier is the gate every pull request runs. The two optimized
tiers are `#[ignore]`d there because replaying them triples the suite's
time; the weekly workflow runs them (`cargo test --test c_corpus --
--ignored`). All 101 programs match at all three tiers.

## Where the references came from

The tracked references were produced by gcc 16.2.1 20260819 running
natively on an AArch64 Fedora server (dynamically linked): programs 1 to
50 at `-O0` and `-O2` collected 2026-08-30, programs 51 to 101 and every
plain `-O2` reference 2026-09-27. `tools/sanitize.py regen` rebuilds
everything (all three tiers, or one with `--tier`) with a cross
compiler and qemu-user and fails on any drift from the tracked files, so
a toolchain change announces itself; a scheduled workflow runs it weekly.

Exit codes use the shell convention: a program killed by signal N records
128+N (139 for SIGSEGV, 135 for SIGBUS).

The pending lists in the corpus test are empty: every program assembles
and matches at every tier. The lists stay in the test so a future gap
has to be recorded to be tolerated, and each turns red the day its
program starts assembling.

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
