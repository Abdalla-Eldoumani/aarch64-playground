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
| See what changed between versions | [Releases](https://github.com/Abdalla-Eldoumani/aarch64-playground/releases) |

## Two kinds of doc

Project docs describe the codebase as it is: getting-started, ARCHITECTURE,
CONTRIBUTING, TESTING, DEPLOY, and security.

One doc feeds a page: instruction-reference is read by the web and Rust test
suites, which fail when the `/reference` tables drift from it, so editing it
changes what the site is allowed to ship. The rest are reference docs no code
reads: cpsc355-style-guide is the course voice the guide and the pitfalls
catalog are written to, authoring-content documents the lesson and exercise
JSON format, terminal is the terminal-pane command reference, and features.md
is an index into the source tree.

## Test coverage

The suite gates every PR and is green on `main`; the current shape and
counts live in [TESTING.md](TESTING.md), along with how to run each
layer (the Rust suites, the web suite, the example fixtures, and the
50-program C corpus).
