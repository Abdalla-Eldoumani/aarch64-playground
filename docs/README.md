# docs

How to use the playground, how it is built, and how to add to it. The code is
the final word; these docs cover what reading it will not tell you quickly.
To run the site on your machine, start with the [README](../README.md).

| You want to | Read |
| --- | --- |
| Take a tour of the site | [getting-started.md](getting-started.md) |
| Use the terminal pane | [terminal.md](terminal.md) |
| Look up an instruction, library call, or system call | [instruction-reference.md](instruction-reference.md) |
| Write assembly the way course files do | [cpsc355-style-guide.md](cpsc355-style-guide.md) |
| Understand how the emulator and the site fit together | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Find the file behind a feature | [features.md](features.md) |
| Set up, change code, and open a pull request | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Run the tests | [TESTING.md](TESTING.md) |
| Write a lesson or an exercise | [authoring-content.md](authoring-content.md) |
| Deploy it | [DEPLOY.md](DEPLOY.md) |
| Check what it defends against | [security.md](security.md) |
| See what changed between versions | [Releases](https://github.com/Abdalla-Eldoumani/aarch64-playground/releases) |

Two docs are checked by tests, so an edit to them can fail the build:

- `instruction-reference.md`: the Rust and web test suites fail when its
  instruction tables and the `/reference` page drift from what the assembler
  accepts.
- `authoring-content.md`: its two worked examples must pass the lesson and
  exercise validators and the course-style check, and the lesson's program
  must print the output the example says it does.

`diagrams/` holds the four SVG diagrams in `ARCHITECTURE.md`. Their addresses
and limits come from constants in `emulator/src`, so a change to one of those
needs the same change in the diagram.
