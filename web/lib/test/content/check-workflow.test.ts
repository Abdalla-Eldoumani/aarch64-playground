import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// .github/workflows/check.yml says some things more than once, and GitHub
// checks none of the copies against each other: the jobs ci waits for, the
// two conditions that read the branch, the vitest shard count, and the
// corpus test the cargo job skips by name. The workflow is read as text one
// level above web/ (vitest's cwd), as .github/scripts/check-pins.js reads it.
const ROOT = path.join(process.cwd(), "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const WORKFLOW = read(".github/workflows/check.yml").split(/\r?\n/);

// A push to integration only warms caches, so the jobs that only test skip
// it; the coverage floors run where the whole suite gates a landing; ci's
// name marks the warm-up run with the skip's negation.
const SKIP = "github.event_name != 'push' || github.ref_name != 'integration'";
const GATE = "github.ref_name == 'main' || github.head_ref == 'integration'";
const WARM_UP = "github.event_name == 'push' && github.ref_name == 'integration'";

/** Each job under `jobs:` with its own lines. */
function jobs(lines: string[]) {
  const result = new Map<string, string[]>();
  let block: string[] = [];
  for (const line of lines.slice(lines.indexOf("jobs:") + 1)) {
    const id = line.match(/^ {2}([\w-]+):$/)?.[1];
    if (id) result.set(id, (block = []));
    else block.push(line);
  }
  return result;
}

const JOBS = jobs(WORKFLOW);

function job(id: string) {
  const lines = JOBS.get(id);
  if (!lines) throw new Error(`check.yml has no ${id} job`);
  return lines;
}

/** A key set on the job itself, four spaces in. */
const key = (lines: string[], name: string) =>
  lines.map((line) => line.match(new RegExp(`^ {4}${name}: (.*)$`))?.[1]).find((value) => value !== undefined);

/**
 * The fns whose line starts `fn ` right under a run of stretches that each go
 * from `#[` at column 0 to a first `]` ending its line, when the run holds
 * `#[test]` and not `#[ignore`. In an integration test a top-level test's
 * full name is the bare fn name, which is what --exact compares.
 * shortcut: these pass though cargo would not run the fn as the skip expects:
 * a `mod m {` whose body stays at column 0 (cargo names the test `m::...`,
 * which the --exact skip misses); `#[cfg_attr(..., ignore)]`; and, above
 * `#[test]`, `#[ignore = "..."]` with a `]` in its reason or `#[ignore]` with
 * a comment after it on its line (cargo ignores the fn); revisit if
 * c_corpus.rs gains an inline module or any of these attribute forms.
 */
function liveTests(source: string) {
  return [...source.matchAll(/((?:^#\[[^\]]*\]\r?\n)+)^fn (\w+)/gm)]
    .filter(([, attributes]) => attributes.includes("#[test]") && !attributes.includes("#[ignore"))
    .map(([, , name]) => name);
}

describe("check.yml", () => {
  it("makes ci wait for every other job", () => {
    const needs = (key(job("ci"), "needs")?.match(/^\[(.*)\]$/)?.[1] ?? "").split(",").map((id) => id.trim());
    const others = [...JOBS.keys()].filter((id) => id !== "ci");
    expect(
      others.filter((id) => !needs.includes(id)),
      "jobs missing from ci's needs",
    ).toEqual([]);
    expect(
      needs.filter((id) => !others.includes(id)),
      "ci's needs names a job that does not exist",
    ).toEqual([]);
  });

  it("gives every job the run it is meant for", () => {
    const conditions = Object.fromEntries([...JOBS].map(([id, lines]) => [id, key(lines, "if")]));
    expect(conditions, "each job's if:").toEqual({
      wasm: undefined,
      rust: SKIP,
      corpus: SKIP,
      "web-static": SKIP,
      "web-build": undefined,
      "web-test": SKIP,
      coverage: GATE,
      browser: SKIP,
      ci: "always()",
    });
  });

  it("writes each condition on the branch the same way everywhere", () => {
    const stray = WORKFLOW.flatMap((line, i) =>
      /github\.(ref_name|head_ref)\b/.test(line.replaceAll(SKIP, "").replaceAll(GATE, "").replaceAll(WARM_UP, ""))
        ? [`line ${i + 1}: ${line.trim()}`]
        : [],
    );
    expect(stray, "a branch condition that differs from its other copies").toEqual([]);
    const copies = (condition: string) => WORKFLOW.filter((line) => line.includes(condition)).length;
    expect(copies(GATE), "copies of the coverage gate (the COVERAGE flag, the blob upload, the coverage job)").toBe(3);
    expect(copies(WARM_UP), "copies of the warm-up run's test in ci's name").toBe(1);
  });

  it("runs every vitest shard and divides the suite by the number of shards", () => {
    const lines = job("web-test");
    const start = lines.indexOf("      matrix:");
    const end = lines.findIndex((line, i) => i > start && !line.startsWith("       "));
    const matrix = lines.slice(start + 1, end).map((line) => line.trim());
    // strategy.job-total counts every combination, so shard is the only key.
    expect(matrix, "web-test's matrix").toEqual([expect.stringMatching(/^shard: \[[\d, ]+\]$/)]);
    const shards = matrix[0].slice("shard: [".length, -1).split(",").map(Number);
    expect(shards, "shard numbers, 1 to the count").toEqual(Array.from(shards, (_, i) => i + 1));
    const divisor = lines
      .map((line) => line.match(/--shard=\$\{\{ matrix\.shard \}\}\/(\$\{\{ strategy\.job-total \}\}|\d+)/)?.[1])
      .find(Boolean);
    expect(
      divisor === "${{ strategy.job-total }}" ? shards.length : Number(divisor),
      `vitest's --shard divisor (${divisor}) against the matrix's ${shards.length} shards`,
    ).toBe(shards.length);
  });

  it("skips in cargo test only the corpus test the corpus shards run", () => {
    // Every line whose first non-blank character is not `#`, in any job or key:
    // a new step's --skip without --exact on its line fails.
    const skipping = WORKFLOW.flatMap((line, i) =>
      !line.trimStart().startsWith("#") && line.includes("--skip") ? [{ line, at: `line ${i + 1}: ${line.trim()}` }] : [],
    );
    expect(skipping, "lines of check.yml that pass --skip").not.toEqual([]);
    const live = liveTests(read("emulator/tests/c_corpus.rs"));
    for (const { line, at } of skipping) {
      // Without --exact, libtest skips every test in every binary whose name
      // contains the filter; with it, only tests named exactly that.
      // shortcut: --exact counts anywhere on the line, a trailing comment
      // included; revisit if a skip line ever carries a comment.
      // shortcut: a name is read only as word characters and `:` straight
      // after `--skip ` or `--skip=`, so a quoted name, a ${{ }} expression or
      // extra spaces are not checked against c_corpus.rs; revisit if a skip
      // takes one of those forms.
      expect(line, `${at} needs --exact on the same line`).toMatch(/--exact\b/);
      for (const [, skip] of line.matchAll(/--skip[= ]([\w:]+)/g)) {
        expect(live, `${at} skips ${skip}, which is not one of these c_corpus.rs tests`).toContain(skip);
      }
    }
  });
});
