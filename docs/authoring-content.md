# authoring content

The playground ships two kinds of study content: **lessons** at `/learn`,
and **exercises** at `/practice`. Each one is a single JSON file you add to
the repo. You never write application code to add content, and there is no
database: drop a file in the right folder and it shows up.

This guide covers the JSON format for each, with one complete worked example
you can copy and adapt.

## where files live

- a lesson is `web/content/lessons/<slug>.json`
- an exercise is `web/content/exercises/<slug>.json`

The `slug` is the file name without `.json`, and it becomes the page's URL,
so keep it unique and url-safe: lowercase letters and digits joined by single
dashes, like `adding-two-registers`. The index page lists every file in the
folder and sorts by the `order` field you set, so `order` is how you choose
the sequence. Plain numbers work well; leave gaps if you want room to insert
something later.

Long text fields are Markdown (a lesson's prose, an exercise's prompt). They
render through a sanitizer, so headings, lists, links, and inline code all
work, but raw HTML is stripped. Write Markdown, not HTML.

Every file is checked against the format below when it loads. If a field is
missing or has the wrong type, the page shows a clear error instead of
rendering, so a malformed file is hard to ship by accident.

## lessons

A lesson is some metadata plus an ordered list of content blocks.

Metadata:

- `title`: the heading text, a non-empty string.
- `slug`: url-safe kebab-case, matching the file name.
- `order`: a number the index sorts by.
- `summary`: optional one-line blurb for the index card.
- `tags`: optional list of strings for the index filter.

`body` is an ordered list of blocks. Each block has a `type` that selects its
remaining fields:

- `{ "type": "prose", "markdown": "..." }`: a passage of Markdown.
- `{ "type": "code", "language": "asm", "source": "..." }`: a read-only
  listing with a button to open it in the playground. `language` is `asm`,
  `c`, or `text`.
- `{ "type": "callout", "variant": "note", "markdown": "..." }`: a
  highlighted aside. `variant` is `note`, `warning`, or `pitfall`.
- `{ "type": "editor", "starter": "...", "args": "...", "stdin": "..." }`: an
  inline editor a reader can run and change in place. Only `starter` is
  required; `args` and `stdin` are optional.

The blocks render top to bottom, in the order you list them.

### a worked lesson

Here is the program this lesson teaches:

```asm
// add two registers and print the sum
define(a, x19)
define(b, x20)

        .data
fmt:    .string "sum = %lld\n"

        .text
        .balign 4
        .global main
        .type main, @function
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

Because `source` and `starter` are JSON strings, each line break is written
as `\n`. Saved as `web/content/lessons/adding-two-registers.json`:

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
      "source": "// add two registers and print the sum\ndefine(a, x19)\ndefine(b, x20)\n\n        .data\nfmt:    .string \"sum = %lld\\n\"\n\n        .text\n        .balign 4\n        .global main\n        .type main, @function\nmain:\n        stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n\n        mov     a, 6                        // first value\n        mov     b, 7                        // second value\n        add     a, a, b                     // a now holds the sum\n\n        ldr     x0, =fmt\n        mov     x1, a\n        bl      printf\n\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n"
    },
    {
      "type": "callout",
      "variant": "note",
      "markdown": "`add` also accepts a small immediate in place of the second register, so `add a, a, 1` adds one to a register without loading the constant first."
    },
    {
      "type": "editor",
      "starter": "// change the two values and run to watch the sum follow\ndefine(a, x19)\ndefine(b, x20)\n\n        .data\nfmt:    .string \"sum = %lld\\n\"\n\n        .text\n        .balign 4\n        .global main\n        .type main, @function\nmain:\n        stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n\n        mov     a, 6\n        mov     b, 7\n        add     a, a, b\n\n        ldr     x0, =fmt\n        mov     x1, a\n        bl      printf\n\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n"
    }
  ]
}
```

## exercises

An exercise is a prompt, some starter source, and acceptance criteria as
data.

Metadata and fields:

- `title`: the heading text, a non-empty string.
- `slug`: url-safe kebab-case, matching the file name.
- `order`: a number the index sorts by.
- `topic`: optional string for the index filter.
- `difficulty`: optional, one of `intro`, `core`, or `challenge`.
- `prompt`: the task description, Markdown.
- `starter`: the source loaded into the editor. It may be empty.
- `args`: optional command-line arguments for the run.
- `stdin`: optional input piped to the run.
- `variant`: `write` (the default) or `identify-bug`, where the starter is a
  broken program the reader has to fix.
- `acceptance`: the criteria, described below.

`acceptance.results` is a list of at least one check run against the program's
output:

- `{ "kind": "register", "reg": "x0", "equals": 5 }`: a register holds a
  value after the run. `reg` is `x0` through `x30`, or `sp`.
- `{ "kind": "exit", "equals": 0 }`: the program's exit code.
- `{ "kind": "stdout", "equals": "..." }`: the whole output equals a string.
- `{ "kind": "stdout", "matches": "..." }`: the output matches a regular
  expression. Use exactly one of `equals` or `matches` in a `stdout` check.

`acceptance.structural` is an optional list of checks run against the source
text, useful for requiring an approach or ruling out a shortcut:

- `{ "kind": "uses-instruction", "mnemonic": "sub" }`: the source must use a
  given instruction.
- `{ "kind": "forbids-literal", "value": 12 }`: the source must not contain a
  literal, which keeps someone from hardcoding the answer.

The checker runs the program and compares what it produced against these
checks. It never compares against a stored solution, so any correct approach
passes and the file itself carries no answer key.

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
        .type main, @function
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
  "starter": "// subtract b from a and print the difference\ndefine(a, x19)\ndefine(b, x20)\n\n        .data\nfmt:    .string \"diff = %lld\\n\"\n\n        .text\n        .balign 4\n        .global main\n        .type main, @function\nmain:\n        stp     x29, x30, [sp, -16]!\n        mov     x29, sp\n\n        mov     a, 20\n        mov     b, 8\n\n        // TODO: subtract b from a, leaving the result in a\n\n        ldr     x0, =fmt\n        mov     x1, a\n        bl      printf\n\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n",
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

Keep the assembly idiomatic: lowercase mnemonics, register aliases with
`define(name, register)`, and the usual prologue and epilogue around `main`.
Write your own short program rather than copying one from elsewhere, and run
it in the playground before you save the file, so you know it assembles and
prints what your example claims.
