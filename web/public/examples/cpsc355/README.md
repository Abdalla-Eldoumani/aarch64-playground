## cpsc 355 tutorial examples

Adapted from CPSC 355 course materials at the University of Calgary for
classroom use. Each file is a copy of a lab/tutorial example and is
included so the playground's example loader can serve them over HTTP.

These files exercise m4 macros (`define()`, `name = expr`), frame-pointer
prologues, `ldr xN, =label` literal loads, extended-register addressing,
the AAPCS64 varargs path through `printf`/`scanf`, and the Linux syscall
surface for `write`/`read`/`exit`/`openat`/`close`/`lseek`.

- `basics.s` -- arithmetic operations
- `globals.s` -- a global variable in `.data` (load and store)
- `locals.s` -- locals on the stack (sum and product)
- `array-scores.s` -- read three scores and average them
- `student-record.s` -- a record on the stack
- `find-max.s` -- a leaf function over an array
- `static-counter.s` -- a static local that persists across calls
- `command-line-args.s` -- iterate argc/argv
- `circle-area.s` -- floating-point area of a circle
- `triangle-area.s` -- single-precision (s register) area of a triangle
- `is-prime.s` -- a primality check
- `hello.s` -- write to stdout via syscall
- `echo.s` -- read a line and echo it
- `write-file.s` -- create and write a file
- `read-file.s` -- open and read a file
- `copy-file.s` -- copy one file to another

Two extra programs are served beyond the tutorial set, both from
https://github.com/Abdalla-Eldoumani/snake-game:

- `snake.s` -- the real-time arcade snake; run it and the playground
  hands it the terminal pane for live keyboard play
- `snake-console.s` -- a turn-based adaptation that plays in the
  console, one typed line of moves per turn
