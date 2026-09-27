# authoring content

The playground ships two kinds of study content: lessons at `/learn` and
exercises at `/practice`. Each is a single JSON file you add to the repo. No
application code, no database: drop a file in the right folder and it shows up.

## where files live

- a lesson is `web/content/lessons/<slug>.json`
- an exercise is `web/content/exercises/<slug>.json`

The `slug` is the file name without `.json` and becomes the page URL, so keep
it unique and url-safe: lowercase letters and digits joined by single dashes,
like `adding-two-registers`. The index lists every file in the folder and
sorts by the `order` field, so `order` sets the sequence. Plain numbers work;
leave gaps to insert something later.

Long text fields are Markdown (a lesson's prose, an exercise's prompt). They
render through a sanitizer: headings, lists, links, and inline code work, raw
HTML is stripped. Write Markdown, not HTML.

Every file is validated against the schema below when it loads. A missing or
wrong-typed field shows a clear error instead of rendering, so a malformed
file is hard to ship by accident.

## lessons

Metadata plus an ordered list of content blocks.

Metadata:

- `title`: the heading, a non-empty string, in sentence case. Capitalize
  the first word and any proper noun or identifier that carries its own
  spelling (AArch64, ARMv8, `printf`, `.data`, `x19`), and nothing else.
  No trailing period, and no "in ARMv8 AArch64 Assembly" suffix: every
  page here is that, and the suffix pushes the words that tell one lesson
  from another off the end of an index card.
- `slug`: url-safe kebab-case, matching the file name.
- `order`: the index sorts by this; a number or string.
- `summary`: optional one-line blurb for the index card. Say what the
  reader will be able to do, not that the lesson covers a topic.
- `tags`: optional list of strings for the index filter. A tag is
  lowercase, written with spaces rather than dashes, and names a concept
  a reader would search for instead of restating the title. The shipped
  lessons use these between them: armv8 basics, arrays, binary
  arithmetic, binary logic, bitwise, branching, command-line arguments,
  conditionals, external data, floating point, format strings, frame
  pointer, immediates, input and output, loops, memory and the stack,
  post-test loop, pre-test loop, printing, registers, stack, strings,
  subroutines, system architecture, variables. Most of them match a
  practice topic. Reuse one of those unless the lesson teaches something
  none of them names.

`body` is an ordered, non-empty list of blocks. Each block's `type` selects
its remaining fields:

- `{ "type": "prose", "markdown": "..." }`: a passage of Markdown.
- `{ "type": "code", "language": "asm", "source": "..." }`: a read-only
  listing with a corner copy button. `language` is `asm`, `c`, or `text`. An
  `asm` listing that is a whole program (it has a `main:` label) also gets a
  button to open it in the playground. A fragment, and every `c` or `text`
  listing, renders without one: a fragment alone fails to link, and the
  emulator only runs assembly.
- `{ "type": "callout", "variant": "note", "markdown": "..." }`: a
  highlighted aside. `variant` is `note`, `warning`, `pitfall`, or `prereq`.
- `{ "type": "editor", "starter": "...", "args": "...", "stdin": "...",
  "expectedOutput": { "stdout": "...", "exitCode": 0 } }`: an inline editor
  the reader can run and change in place. Only `starter` is required.
  `args` and `stdin` are optional. `expectedOutput` is optional in the
  schema but every shipped editor carries one: `stdout` is exactly what the
  program prints when it runs with the block's own `args` and `stdin`, byte
  for byte, and `exitCode` (0 to 255) is the exit status, which can be left
  out when the lesson never mentions it. A test runs every lesson program on
  the emulator with its input closed after `stdin`, the way `./program <
  file` runs on the servers, and fails when the output differs, so write the
  value from a real run on the servers, never from memory.

Blocks render top to bottom.

### a worked lesson

The program this lesson teaches:

```asm
// add two registers and print the sum
define(a, x19)
define(b, x20)

        .data
fmt:    .string "sum = %lld\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     a, 6                        // first value
        mov     b, 7                        // second value
        add     a, a, b                     // a now holds the sum

        ldr     x0, =fmt
        mov     x1, a
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
```

`source` and `starter` are JSON strings, so each line break is written as
`\n`. Saved as `web/content/lessons/adding-two-registers.json`:

```json
{
  "title": "Adding two registers",
  "slug": "adding-two-registers",
  "order": 2,
  "summary": "Load two values, add them with the add instruction, and print the result.",
  "tags": [
    "registers",
    "immediates"
  ],
  "body": [
    {
      "type": "prose",
      "markdown": "The `add` instruction takes two source registers, adds them, and writes the result to a destination register. The destination can be one of the sources, so `add a, a, b` reads as \"a becomes a plus b\"."
    },
    {
      "type": "code",
      "language": "asm",
      "source": "// add two registers and print the sum\ndefine(a, x19)\ndefine(b, x20)\n\n        .data\nfmt:    .string \"sum = %lld\\n\"\n\n        .text\n        .balign 4\n        .global main\nmain:\n        stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n\n        mov     a, 6                        // first value\n        mov     b, 7                        // second value\n        add     a, a, b                     // a now holds the sum\n\n        ldr     x0, =fmt\n        mov     x1, a\n        bl      printf\n\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n"
    },
    {
      "type": "callout",
      "variant": "note",
      "markdown": "`add` also accepts a small immediate in place of the second register, so `add a, a, 1` adds one to a register without loading the constant first."
    },
    {
      "type": "editor",
      "starter": "// change the two values and run to watch the sum follow\ndefine(a, x19)\ndefine(b, x20)\n\n        .data\nfmt:    .string \"sum = %lld\\n\"\n\n        .text\n        .balign 4\n        .global main\nmain:\n        stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n\n        mov     a, 6\n        mov     b, 7\n        add     a, a, b\n\n        ldr     x0, =fmt\n        mov     x1, a\n        bl      printf\n\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n",
      "expectedOutput": {
        "stdout": "sum = 13\n",
        "exitCode": 0
      }
    }
  ]
}
```

## exercises

An exercise is either a coding sheet (a prompt, starter source, and
acceptance criteria checked by running the reader's program) or an
interactive question set graded in the page.

Fields every variant carries:

- `title`: the heading, a non-empty string, in the same sentence case as
  a lesson title, and with no difficulty word in it: `difficulty` carries
  the tier and the index prints it as its own chip. The page's metadata
  title composes the two as `<title> (<difficulty>)`, so the three sets of
  a theory family still get three distinct browser tabs and share cards
  while the heading on the page stays bare.
- `slug`: url-safe kebab-case, matching the file name.
- `order`: the index sorts by this; a number or string. The sheet runs
  every coding exercise first and then every theory set, each side grouped
  by topic in course order, and the number is the exercise's position on
  that sheet. A new coding exercise goes where its topic and lesson put it,
  and every exercise after it moves down one. Nothing checks that two files
  share a number, so look before you pick.
- `topic`: optional string; the practice page groups exercises under it.
  The sixteen topics, their order on the page, and their printed labels
  live in `web/lib/content/practice-topics.ts`; a topic missing from that
  table still renders (its id is the label) but sorts after every listed
  one, so a new topic wants a row there.
- `difficulty`: optional, one of `intro`, `core`, or `challenge`.
- `prompt`: the task description, Markdown. Open with the task itself: what
  the starter gives the reader, and what the program has to do. A sentence
  that only sets a mood should become a hint ("One pass over the array is
  enough") or go.
- `variant`: `write` (the default), `identify-bug`, `quiz`, `prediction`,
  or `blanks`. The variant decides where the exercise appears: `write` and
  `identify-bug` sit in the coding column of the practice page, the other
  three in the theory column.

The coding variants (`write`, and `identify-bug`, where the starter is a
broken program the reader fixes) add:

- `starter`: the source loaded into the editor; may be empty.
- `args`: optional command-line arguments for the run. When it is not empty
  the editor shows an args box holding it, so the reader can try others.
- `stdin`: optional input for the run. Check feeds it and then ends the
  input, the way `./program < file` does on the servers, so a read past it
  sees end of file.
- `acceptance`: the criteria below.
- `hiddenCases`: more runs the reader never sees, checked once the visible
  one passes. Each is
  `{ "args": "...", "stdin": "...", "stdout": "...", "exitCode": 0, "edge": true }`:
  the program starts with `args` (optional), reads `stdin` (optional) and
  then end of input, and must print exactly `stdout` and exit with
  `exitCode` (0 to 255). `edge` marks a boundary input such as 0, a
  negative number, an empty line, no input at all, or the largest value.
  Every shipped coding exercise carries at least three cases, one of them
  an edge; a content test checks that, and runs its reference solution
  (kept beside the tests in `web/lib/test/content/exercise-solutions/`,
  never in the exercise file) against every case. A hidden run also fails
  when `main` returns with `sp` somewhere other than where it started, or
  when the program writes above `main`'s frame, into its caller's stack.
  A failing case shows the reader its input and their own output, never
  the expected text.

`acceptance.results` is a non-empty list of checks against the run:

- `{ "kind": "register", "reg": "x0", "equals": 5 }`: a register holds a value
  after the run. `reg` is `x0` through `x30`, or `sp`; `equals` is an integer.
- `{ "kind": "exit", "equals": 0 }`: the exit code.
- `{ "kind": "stdout", "equals": "..." }`: the whole output equals a string.
- `{ "kind": "stdout", "matches": "..." }`: the output matches a regular
  expression. Use exactly one of `equals` or `matches` per `stdout` check.

`acceptance.structural` is an optional list of checks against the source text,
useful for requiring an approach or ruling out a shortcut:

- `{ "kind": "uses-instruction", "mnemonic": "sub" }`: the source must use an
  instruction. The mnemonic may carry its operand, as in `"bl fact"`.
- `{ "kind": "forbids-instruction", "mnemonics": ["mul", "madd"] }`: none of
  these may appear. Each entry is matched as a whole word, so it can also
  name a register such as `x19`.
- `{ "kind": "forbids-literal", "value": 12 }`: the source must not contain a
  literal, which stops someone hardcoding the answer. A number is matched as
  a whole token and never shown to the reader. A string is matched anywhere
  and is shown (`does not contain %lo`), so use strings for shortcuts the
  prompt already rules out, not for the answer; the hidden cases already
  catch a hardcoded answer.

Any structural check can add `"in": "label"` to look only inside one
function: from that label to the next label that starts a function (`main`,
any `bl` target, any `.global` name). That is how `call-yourself` requires
`bl fact` inside `fact` itself, where a `bl` in `main` does not count.

The checker runs the program and compares its output against these checks. It
never compares against a stored solution, so any correct approach passes and
a coding exercise's file carries no answer key.

### interactive variants

The interactive variants skip the editor and grade entirely in the page, so
their files declare the expected answers (coding exercises still store none).
They ship in families named `quiz-basic-<family>`, `quiz-inter-<family>`, and
`quiz-advance-<family>` (all three titled "Quiz: <subject>"),
`blanks-<family>` ("Fill in the blank: <subject>"), and
`predict-<family>` ("Predict: <subject>"). Every set on one topic uses
the same subject name, so a reader scanning the theory column sees three
kinds of practice on one subject rather than three names for one topic.
The family is the shared part of a topic's slugs (five where a prediction
set exists, four otherwise) and is usually the `topic` id, but it does not
have to be: the memory-and-stack sets are the `frame-stack` family under the
`memory` topic, and a slug never changes once shipped, so pick the family
name once. Each carries one question list in place of
`starter`/`acceptance`:

- `quiz`: `questions`, each
  `{ "question": "...", "options": ["...", "..."], "correctAnswer": 1,
  "explanation": "...", "hint": "..." }`. `options` needs at least two
  entries and `correctAnswer` is an index into it.
- `prediction`: `predictions`, each
  `{ "code": "...", "question": "...", "answer": "...", "explanation": "...",
  "hint": "..." }`. The reader's input is compared to `answer` trimmed and
  case-insensitively.
- `blanks`: `blanks`, each
  `{ "prompt": "...", "code": "ldr x0, ___", "blanks": ["=label"],
  "explanation": "...", "hint": "..." }`. `code` carries exactly one `___`
  marker where the input field lands, and `blanks` lists every accepted
  answer.

`hint` is optional everywhere and is the only feedback a wrong attempt sees;
the explanation renders only after a correct one. Unlike the exercise
`prompt`, the per-question fields (`question`, `options`, `code`, `answer`,
`explanation`, `hint`, and a blank's `prompt`) render as plain text, so
write mnemonics and registers bare there; a backtick would show up as a
literal character.

### a worked exercise

The starter the reader begins from:

```asm
// subtract b from a and print the difference
define(a, x19)
define(b, x20)

        .data
fmt:    .string "diff = %lld\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     a, 20
        mov     b, 8

        // TODO: subtract b from a, leaving the result in a

        ldr     x0, =fmt
        mov     x1, a
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
```

Saved as `web/content/exercises/subtract-two-numbers.json`:

```json
{
  "title": "Subtract two numbers",
  "slug": "subtract-two-numbers",
  "order": 2,
  "topic": "armv8",
  "difficulty": "intro",
  "prompt": "The starter loads two values, `a` and `b`. Subtract `b` from `a` so the difference ends up in `a`, then let the program print it.\n\n## what is checked\n\n- the printed line reads `diff = 12`\n- the program exits cleanly\n- the difference is computed, not written in as a constant",
  "starter": "// subtract b from a and print the difference\ndefine(a, x19)\ndefine(b, x20)\n\n        .data\nfmt:    .string \"diff = %lld\\n\"\n\n        .text\n        .balign 4\n        .global main\nmain:\n        stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n\n        mov     a, 20\n        mov     b, 8\n\n        // TODO: subtract b from a, leaving the result in a\n\n        ldr     x0, =fmt\n        mov     x1, a\n        bl      printf\n\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n",
  "args": "",
  "variant": "write",
  "acceptance": {
    "results": [
      {
        "kind": "stdout",
        "equals": "diff = 12\n"
      },
      {
        "kind": "exit",
        "equals": 0
      }
    ],
    "structural": [
      {
        "kind": "uses-instruction",
        "mnemonic": "sub"
      },
      {
        "kind": "forbids-literal",
        "value": 12
      }
    ]
  }
}
```

That is the smallest file the schema accepts. Before it ships it also needs
`hiddenCases`, which means reading `a` and `b` from `stdin` with `scanf`
rather than fixing them with `mov` (otherwise every case prints the same
line), and a reference solution, `subtract-two-numbers.s`, in
`web/lib/test/content/exercise-solutions/`.

## writing the assembly

Keep it idiomatic: lowercase mnemonics, register aliases with
`define(name, register)`, the usual prologue and epilogue around `main`, and
only the directives course files actually write (the style guide lists the
ones they never do; a content test enforces that list). Write your own short
program rather than copying one, and run it in the playground before saving so
you know it assembles and prints what your example claims.
