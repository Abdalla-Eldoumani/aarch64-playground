## cpsc 355 tutorial examples

Adapted from CPSC 355 course materials at the University of Calgary for
classroom use. Each file is a copy of a lab/tutorial example and is
included so the playground's example loader can serve them over HTTP.

These files exercise m4 macros (`define()`, `name = expr`), frame-pointer
prologues, `ldr xN, =label` literal loads, extended-register addressing,
the AAPCS64 varargs path through `printf`/`scanf`, and the Linux syscall
surface for `write`/`read`/`exit`/`openat`/`close`.

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

Six extra programs are served beyond the tutorial set:

- `snake.s` -- the real-time snake game, six modes, from
  https://github.com/Abdalla-Eldoumani/snake-game; run it and the
  playground hands it the terminal pane for live keyboard play
- `dsav.s` + `dsav/` -- the data structures and algorithms visualizer
  from https://github.com/Abdalla-Eldoumani/dsav, the first multi-file
  example: `dsav.s` holds `main`, the seventeen files under `dsav/` load
  into the files strip and link with it. Twelve modules over a shared
  screen kernel (`theme.s` for colour, `ui.s` for the frame and panels).
  Menu-driven; run hands it the terminal pane (typed input echoes,
  animations pace themselves), and the course way works too:
  `./program` from the term tab
- `calc.s` -- a pocket scientific calculator drawn as a handheld device,
  from https://github.com/Abdalla-Eldoumani/calc; type straight at it or
  walk the key grid with the arrows, and tab switches between chained
  entry and whole expressions (`2+3*4 = 14`)
- `temp-convert.s` -- the temperature instrument, from
  https://github.com/Abdalla-Eldoumani/temp-convert; with the args box
  empty it takes readings one at a time and marks each on the C/F/K
  scales, and `./temp-convert 32 F` in the args box prints that one
  conversion and exits
- `two-sum.s` -- the two-sum visualizer, from
  https://github.com/Abdalla-Eldoumani/twosum-arm; menu-driven, it
  animates brute force and the hash set over the same array so the two
  comparison counts land side by side
- `deadzone.s` + `deadzone/` -- the terminal survivor from
  https://github.com/Abdalla-Eldoumani/deadzone, the second multi-file
  example: `deadzone.s` holds `main`, the eleven files under `deadzone/`
  load into the files strip and link with it, in the order the repo's m4
  includes paste them (`constants.s` first, because an equate only
  resolves for the modules below it). Waves of enemies, upgrades on
  level-up, a bomb and a freeze, and a boss at wave 10; run hands it the
  terminal pane and it grabs the keyboard

## adding one of the extras

What a program clears before it joins that set: it is playable, not a
demonstration, so somebody can sit down and use it; it belongs in the
terminal, so the pane is where it lives rather than the console; it has
a design direction somebody named out loud, with one element you
remember afterwards (the snake's combo streaks, the calculator's lit
key grid, the survivor's freeze); and both launch modes work, so a
student who picks console instead of terminal still gets a program that
behaves.
