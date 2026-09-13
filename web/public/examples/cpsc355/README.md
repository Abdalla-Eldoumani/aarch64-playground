## cpsc 355 examples

A mix of the CPSC 355 Winter 2026 tutorial examples from the University of
Calgary and programs written fresh for this project by Abdalla Eldoumani,
all in the course's house style. They are served here so the playground's
example loader can fetch them over HTTP.

These files exercise m4 macros (`define()`, `name = expr`), frame-pointer
prologues, `ldr xN, =label` literal loads, extended-register addressing,
the AAPCS64 varargs path through `printf`/`scanf`, and the Linux syscall
surface for `write`/`read`/`exit`/`openat`/`close`.

- `basics.s`: arithmetic operations
- `globals.s`: a global variable in `.data` (load and store)
- `locals.s`: locals on the stack (sum and product)
- `array-scores.s`: read three scores and average them
- `student-record.s`: a record on the stack
- `find-max.s`: a leaf function over an array
- `static-counter.s`: a static local that persists across calls
- `command-line-args.s`: iterate argc/argv
- `circle-area.s`: floating-point area of a circle
- `triangle-area.s`: single-precision (s register) area of a triangle
- `is-prime.s`: a primality check
- `hello.s`: write to stdout via syscall
- `echo.s`: read a line and echo it
- `write-file.s`: create and write a file
- `read-file.s`: open and read a file
- `copy-file.s`: copy one file to another

Six extra programs are served beyond the tutorial set:

- `snake.s`: the real-time snake game, six modes, from
  https://github.com/Abdalla-Eldoumani/snake-game; run it and the
  playground hands it the terminal pane for live keyboard play
- `dsav.s` + `dsav/`: the data structures and algorithms visualizer
  from https://github.com/Abdalla-Eldoumani/dsav, the first multi-file
  example: `dsav.s` holds `main`, the seventeen files under `dsav/` load
  into the files strip and link with it. Twelve modules over a shared
  screen kernel (`theme.s` for colour, `ui.s` for the frame and panels).
  Menu-driven; run hands it the terminal pane (typed input echoes,
  animations pace themselves), and `./program` from the term tab works
  too
- `calc.s`: a pocket scientific calculator drawn as a handheld device,
  from https://github.com/Abdalla-Eldoumani/calc; type straight at it or
  walk the key grid with the arrows, and tab switches between chained
  entry and whole expressions (`2+3*4 = 14`); with `console` in the args
  line it is a plain prompt that answers one typed expression per line
- `temp-convert.s`: the temperature instrument, from
  https://github.com/Abdalla-Eldoumani/temp-convert; with the args box
  empty it takes readings one at a time and marks each on the C/F/K
  scales, `console` in the args line draws the same readings without
  colour, and `32 F` prints that one conversion and exits
- `two-sum.s`: the two-sum visualizer, from
  https://github.com/Abdalla-Eldoumani/twosum-arm; menu-driven, it
  animates brute force and the hash set over the same array so the two
  comparison counts land side by side; with `console` in the args line it
  answers one typed array in plain text
- `deadzone.s` + `deadzone/`: the terminal survivor from
  https://github.com/Abdalla-Eldoumani/deadzone, the second multi-file
  example: `deadzone.s` holds `main`, the eleven files under `deadzone/`
  load into the files strip and link with it, in the order the repo's m4
  includes paste them (`constants.s` first, because an equate only
  resolves for the modules below it). Waves of enemies, upgrades on
  level-up, a bomb and a freeze, and a boss at wave 10; run hands it the
  terminal pane and it grabs the keyboard

Six more programs demonstrate the vector (`v`) registers, a register file
the course does not teach, so the rules for the playable extras do not
apply to them:

- `vector-upper.s`: uppercase a typed line, sixteen characters per pass
- `vector-strlen.s`: count the characters in a typed line, sixteen bytes
  compared at once
- `vector-sum.s`: add sixteen ints four lanes at a time
- `vector-dot.s`: dot product of two arrays of eight ints, four
  multiply-accumulates per instruction
- `vector-brighten.s`: brighten a grayscale picture with a saturating
  add, so the bright pixels stop at white instead of wrapping
- `vector-mean.s`: mean of eight floats, four lanes at a time

## adding one of the extras

What a program clears before it joins that set:

- somebody can sit down and play it
- it runs in the terminal pane, not the console
- it has one element you remember afterwards (the snake's combo
  streaks, the calculator's lit key grid)
- both launch modes work, so a student who picks console still gets a
  program that behaves
