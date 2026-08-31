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

- `title`: the heading, a non-empty string.
- `slug`: url-safe kebab-case, matching the file name.
- `order`: the index sorts by this; a number or string.
- `summary`: optional one-line blurb for the index card.
- `tags`: optional list of strings for the index filter.

`body` is an ordered, non-empty list of blocks. Each block's `type` selects
its remaining fields:

- `{ "type": "prose", "markdown": "..." }`: a passage of Markdown.
- `{ "type": "code", "language": "asm", "source": "..." }`: a read-only
  listing with a corner copy button. `language` is `asm`, `c`, or `text`; an
  `asm` listing also gets a button to open it in the playground, while `c` and
  `text` render without one since the emulator only runs assembly.
- `{ "type": "callout", "variant": "note", "markdown": "..." }`: a
  highlighted aside. `variant` is `note`, `warning`, `pitfall`, or `prereq`.
- `{ "type": "editor", "starter": "...", "args": "...", "stdin": "..." }`: an
  inline editor the reader can run and change in place. Only `starter` is
  required; `args` and `stdin` are optional.

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
  "title": "adding two registers",
  "slug": "adding-two-registers",
  "order": 2,
  "summary": "Load two values, add them with the add instruction, and print the result.",
  "tags": [
    "registers",
    "arithmetic"
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
      "starter": "// change the two values and run to watch the sum follow\ndefine(a, x19)\ndefine(b, x20)\n\n        .data\nfmt:    .string \"sum = %lld\\n\"\n\n        .text\n        .balign 4\n        .global main\nmain:\n        stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n\n        mov     a, 6\n        mov     b, 7\n        add     a, a, b\n\n        ldr     x0, =fmt\n        mov     x1, a\n        bl      printf\n\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n"
    }
  ]
}
```

## exercises

An exercise is either a coding sheet (a prompt, starter source, and
acceptance criteria checked by running the reader's program) or an
interactive question set graded in the page.

Fields every variant carries:

- `title`: the heading, a non-empty string.
- `slug`: url-safe kebab-case, matching the file name.
- `order`: the index sorts by this; a number or string. The sheet runs
  every coding exercise first (1 to 27 today) and then every theory set
  (28 onward), so give a new set the next number after the last one on its
  side. Nothing checks that two files share a number, so look before you
  pick.
- `topic`: optional string; the practice page groups exercises under it.
  The topics, their order on the page, and their printed labels live in
  `web/lib/content/practice-topics.ts`; a topic missing from that table
  still renders (its id is the label) but sorts after every listed one, so
  a new topic wants a row there.
- `difficulty`: optional, one of `intro`, `core`, or `challenge`.
- `prompt`: the task description, Markdown.
- `variant`: `write` (the default), `identify-bug`, `quiz`, `prediction`,
  or `blanks`. The variant decides where the exercise appears: `write` and
  `identify-bug` sit in the coding column of the practice page, the other
  three in the theory column.

The coding variants (`write`, and `identify-bug`, where the starter is a
broken program the reader fixes) add:

- `starter`: the source loaded into the editor; may be empty.
- `args`: optional command-line arguments for the run.
- `stdin`: optional input piped to the run.
- `acceptance`: the criteria below.

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
  instruction.
- `{ "kind": "forbids-literal", "value": 12 }`: the source must not contain a
  literal (a number or a string), which stops someone hardcoding the answer.

The checker runs the program and compares its output against these checks. It
never compares against a stored solution, so any correct approach passes and
a coding exercise's file carries no answer key.

### interactive variants

The interactive variants skip the editor and grade entirely in the page, so
their files declare the expected answers (that is by design and only applies
to these variants; coding exercises still never store one). They ship in
topic families named `quiz-basic-<topic>`, `quiz-inter-<topic>`, and
`quiz-advance-<topic>` (titled "Quiz: <Topic> - Fundamentals",
"- Intermediate", and "- Advanced"), `blanks-<topic>` ("Fill in the Blank:
..."), and `predict-<topic>` ("Predict: ..."). Each carries one question
list in place of `starter`/`acceptance`:

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
  "title": "subtract two numbers",
  "slug": "subtract-two-numbers",
  "order": 2,
  "topic": "arithmetic",
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

## writing the assembly

Keep it idiomatic: lowercase mnemonics, register aliases with
`define(name, register)`, the usual prologue and epilogue around `main`, and
only the directives course files actually write (the style guide lists the
ones they never do; a content test enforces that list). Write your own short
program rather than copying one, and run it in the playground before saving so
you know it assembles and prints what your example claims.
