# docs

The written docs for aarch64-playground: how to run it, how it is built, and
how to add to it. The code is the source of truth; these cover the parts that
are not obvious from reading it.

New here? Read [getting-started.md](getting-started.md) for a tour of the site,
then [ARCHITECTURE.md](ARCHITECTURE.md) for how the Rust-to-WASM emulator and
the Next.js frontend fit together. Before you change code,
[CONTRIBUTING.md](CONTRIBUTING.md) has the setup, the directory layout, and the
PR flow.

## By task

| You want to | Read |
| --- | --- |
| See what the site does | [getting-started.md](getting-started.md) |
| Understand how it works | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Set up and open a PR | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Run the tests | [TESTING.md](TESTING.md) |
| Deploy it | [DEPLOY.md](DEPLOY.md) |
| Understand the security stance | [security.md](security.md) |
| Find where a feature lives | [features.md](features.md) |
| Write a lesson or exercise | [authoring-content.md](authoring-content.md) |
| Add or look up an instruction | [instruction-reference.md](instruction-reference.md), then [cpsc355-style-guide.md](cpsc355-style-guide.md) |
| Use the terminal pane | [terminal.md](terminal.md) |

## Two kinds of doc

Project docs describe the codebase as it is: getting-started, ARCHITECTURE,
CONTRIBUTING, TESTING, DEPLOY, and security.

Page-feeding docs are the source for content the site renders, so editing one
changes the live site: instruction-reference feeds the `/reference` tables,
cpsc355-style-guide feeds the calling-convention guide and the pitfalls
catalog, authoring-content documents the lesson and exercise JSON format, and
terminal is the terminal-pane command reference. features.md is an index into
the source tree, not a rendered page.

## Test coverage

The suite gates every PR and is green on `main`: 823 Rust tests, 1546 web
tests, and 15 end-to-end corpus fixtures as of the multi-file work. See
[TESTING.md](TESTING.md) for how to run each layer.
